// Operaciones de ESCRITURA sobre un repositorio git: todo lo que cambia su
// estado (stage, commit, ramas, merge, rebase, push, stash...) pasa por aquí.
// La mayoría de funciones son un fino wrapper sobre runGit() con el array de
// argumentos concreto; el rebase interactivo y el clonado son las excepciones
// con lógica propia (ver los comentarios grandes más abajo, en cada sección).
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import fsPromises from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import type { CloneRepoResult, GitActionResult, RebaseStep } from '../../shared/ipc-contract'
import { GIT_ENV, assertGitRepo, extractGitErrorMessage } from './gitService'

const execFileAsync = promisify(execFile)

function formatCommand(args: string[]): string {
  return ['git', ...args].join(' ')
}

async function runGit(repoPath: string, args: string[]): Promise<GitActionResult> {
  const command = formatCommand(args)
  const invalidRepoError = assertGitRepo(repoPath)
  if (invalidRepoError) {
    return { success: false, command, output: '', error: invalidRepoError }
  }

  try {
    // execFile (no exec/shell): los args (mensajes de commit, nombres de rama...) nunca pasan por un shell.
    const { stdout, stderr } = await execFileAsync('git', args, {
      cwd: repoPath,
      maxBuffer: 1024 * 1024 * 10,
      env: GIT_ENV,
    })
    return { success: true, command, output: stdout || stderr }
  } catch (err) {
    const message = extractGitErrorMessage(err)
    return { success: false, command, output: '', error: message }
  }
}

// A diferencia de runGit, esta NO exige que ya exista un .git — es precisamente
// para el caso contrario: una carpeta normal que todavía no es un repositorio.
export async function initRepo(folderPath: string): Promise<GitActionResult> {
  const command = 'git init'

  try {
    await fsPromises.access(folderPath)
  } catch {
    return { success: false, command, output: '', error: `"${folderPath}" no existe.` }
  }

  try {
    const { stdout, stderr } = await execFileAsync('git', ['init'], { cwd: folderPath, env: GIT_ENV })
    return { success: true, command, output: stdout || stderr }
  } catch (err) {
    return { success: false, command, output: '', error: extractGitErrorMessage(err) }
  }
}

export const stageFile = (repoPath: string, filePath: string): Promise<GitActionResult> =>
  runGit(repoPath, ['add', '--', filePath])

export const unstageFile = (repoPath: string, filePath: string): Promise<GitActionResult> =>
  runGit(repoPath, ['restore', '--staged', '--', filePath])

export const commitChanges = (repoPath: string, message: string): Promise<GitActionResult> =>
  runGit(repoPath, ['commit', '-m', message])

// '--' delimita opciones de argumentos: sin él, un nombre de rama que empiece
// por '-' (input libre del usuario) podría interpretarse como un flag de git.
export const createBranch = (repoPath: string, name: string): Promise<GitActionResult> =>
  runGit(repoPath, ['branch', '--', name])

export const checkoutBranch = (repoPath: string, name: string): Promise<GitActionResult> =>
  runGit(repoPath, ['checkout', name])

export const mergeBranch = (repoPath: string, branchName: string): Promise<GitActionResult> =>
  runGit(repoPath, ['merge', '--no-edit', branchName])

export const rebaseBranch = (repoPath: string, ontoBranch: string): Promise<GitActionResult> =>
  runGit(repoPath, ['rebase', ontoBranch])

export const pushBranch = (repoPath: string): Promise<GitActionResult> => runGit(repoPath, ['push'])

export const fetchRepo = (repoPath: string): Promise<GitActionResult> => runGit(repoPath, ['fetch'])

export const pullBranch = (repoPath: string): Promise<GitActionResult> => runGit(repoPath, ['pull'])

export const stashSave = (repoPath: string, message: string): Promise<GitActionResult> =>
  message ? runGit(repoPath, ['stash', 'push', '-m', message]) : runGit(repoPath, ['stash', 'push'])

export const stashPop = (repoPath: string, index: number): Promise<GitActionResult> =>
  runGit(repoPath, ['stash', 'pop', `stash@{${index}}`])

export const stashDrop = (repoPath: string, index: number): Promise<GitActionResult> =>
  runGit(repoPath, ['stash', 'drop', `stash@{${index}}`])

// --- Resolución de conflictos (merge y rebase comparten los mismos comandos) ---

export const resolveConflictOurs = async (repoPath: string, filePath: string): Promise<GitActionResult> => {
  const checkout = await runGit(repoPath, ['checkout', '--ours', '--', filePath])
  if (!checkout.success) return checkout
  return runGit(repoPath, ['add', '--', filePath])
}

export const resolveConflictTheirs = async (repoPath: string, filePath: string): Promise<GitActionResult> => {
  const checkout = await runGit(repoPath, ['checkout', '--theirs', '--', filePath])
  if (!checkout.success) return checkout
  return runGit(repoPath, ['add', '--', filePath])
}

// Para cuando el usuario ha editado el fichero a mano fuera de la app y ya lo dejó como quería.
export const markConflictResolved = (repoPath: string, filePath: string): Promise<GitActionResult> =>
  runGit(repoPath, ['add', '--', filePath])

export const continueMerge = (repoPath: string): Promise<GitActionResult> =>
  runGit(repoPath, ['commit', '--no-edit'])

export const abortMerge = (repoPath: string): Promise<GitActionResult> => runGit(repoPath, ['merge', '--abort'])

export const continueRebase = async (repoPath: string): Promise<GitActionResult> => {
  const result = await runGit(repoPath, ['rebase', '--continue'])
  if (result.success) await cleanupRebaseTmpDir(repoPath)
  return result
}

export const abortRebase = async (repoPath: string): Promise<GitActionResult> => {
  const result = await runGit(repoPath, ['rebase', '--abort'])
  if (result.success) await cleanupRebaseTmpDir(repoPath)
  return result
}

// --- Rebase interactivo ---
//
// git rebase -i normalmente abre un editor para que la persona escriba la secuencia
// pick/squash/drop/reword. Aquí no hay terminal: en su lugar generamos nosotros mismos
// el fichero de secuencia y usamos GIT_SEQUENCE_EDITOR como un simple "cp" que lo copia
// sobre el fichero que git espera editar. Es la misma técnica que usan varias
// herramientas de automatización de git para scriptar rebases interactivos.
//
// El "reword" se resuelve sin editor añadiendo una línea `exec git commit --amend -F <fichero>`
// justo después del pick: -F lee el mensaje de un fichero, así que el contenido del mensaje
// nunca pasa por el shell (evita que un mensaje con comillas o `;` se interprete como comando).

const REBASE_MARKER_REL_PATH = path.join('.git', 'gitedu-rebase-tmpdir')

async function cleanupRebaseTmpDir(repoPath: string): Promise<void> {
  const markerPath = path.join(repoPath, REBASE_MARKER_REL_PATH)
  try {
    const tmpDir = (await fsPromises.readFile(markerPath, 'utf8')).trim()
    if (tmpDir) await fsPromises.rm(tmpDir, { recursive: true, force: true })
    await fsPromises.rm(markerPath, { force: true })
  } catch {
    // No había un rebase interactivo de GitEdu en curso (o ya se limpió); no hay nada que hacer.
  }
}

export async function runInteractiveRebase(
  repoPath: string,
  ontoBranch: string,
  steps: RebaseStep[]
): Promise<GitActionResult> {
  const command = `git rebase -i ${ontoBranch}`
  const invalidRepoError = assertGitRepo(repoPath)
  if (invalidRepoError) {
    return { success: false, command, output: '', error: invalidRepoError }
  }

  // Cada hash acaba en dos sitios sensibles: una línea de la secuencia de rebase
  // (que git interpreta) y, en los reword, el nombre de un fichero usado dentro
  // de una línea `exec` (que git ejecuta con una shell). La UI de GitEdu siempre
  // manda hashes reales tal cual los devolvió git, nunca texto libre del usuario,
  // pero esto es la última barrera: si algo (un bug, una IPC llamada a mano)
  // colara un hash con comillas, `;` o un salto de línea, sin esto se colaría
  // hasta un `exec` de git y se ejecutaría como comando de shell arbitrario.
  const validHash = /^[0-9a-f]{4,64}$/i
  const invalidStep = steps.find((step) => !validHash.test(step.hash))
  if (invalidStep) {
    return { success: false, command, output: '', error: `Hash de commit inválido: "${invalidStep.hash}".` }
  }

  const tmpDir = await fsPromises.mkdtemp(path.join(os.tmpdir(), 'gitedu-rebase-'))
  await fsPromises.writeFile(path.join(repoPath, REBASE_MARKER_REL_PATH), tmpDir, 'utf8')

  try {
    const todoLines: string[] = []
    for (const step of steps) {
      if (step.action === 'drop') {
        todoLines.push(`drop ${step.hash}`)
        continue
      }
      if (step.action === 'squash') {
        // "fixup" en vez de "squash": combina el commit sin pedir un editor para
        // fusionar los mensajes (se queda con el mensaje del commit anterior).
        todoLines.push(`fixup ${step.hash}`)
        continue
      }

      todoLines.push(`pick ${step.hash}`)
      if (step.action === 'reword' && step.message) {
        const msgFile = path.join(tmpDir, `msg-${step.hash}.txt`)
        await fsPromises.writeFile(msgFile, step.message, 'utf8')
        todoLines.push(`exec git commit --amend -F "${msgFile}"`)
      }
    }

    const todoFile = path.join(tmpDir, 'todo.txt')
    await fsPromises.writeFile(todoFile, todoLines.join('\n') + '\n', 'utf8')

    const { stdout, stderr } = await execFileAsync('git', ['rebase', '-i', ontoBranch], {
      cwd: repoPath,
      maxBuffer: 1024 * 1024 * 10,
      env: { ...GIT_ENV, GIT_SEQUENCE_EDITOR: `cp "${todoFile}"` },
    })

    // Terminó sin pausas (no hubo conflictos): ya no hace falta el directorio temporal.
    await cleanupRebaseTmpDir(repoPath)
    return { success: true, command, output: stdout || stderr }
  } catch (err) {
    // Si se pausó por un conflicto, NO limpiamos: los pasos "exec" pendientes (reword de
    // commits posteriores) todavía necesitan sus ficheros de mensaje cuando se continúe.
    return { success: false, command, output: '', error: extractGitErrorMessage(err) }
  }
}

// --- Clonar desde una URL remota ---
//
// Deriva un nombre de carpeta a partir de la URL y solo se queda con caracteres
// seguros: evita que una URL manipulada ("...git/../../algo") escape del
// directorio de destino fijo (~/GitEdu-Repos).
//
// El whitelist de caracteres por sí solo NO basta: '.' es un carácter permitido
// (nombres de repo legítimos lo llevan, p.ej. "foo.js"), así que una URL que
// termine en "/.." pasa el filtro intacta y `path.join(destParent, '..')` se
// sale directamente del directorio de destino. Por eso se rechazan '.'/'..'
// explícitamente aquí, y además se verifica la ruta final más abajo.
function deriveRepoFolderName(remoteUrl: string): string {
  const lastSegment = remoteUrl.replace(/\.git$/, '').split(/[/\\]/).filter(Boolean).pop() ?? 'repo'
  const safeName = lastSegment.replace(/[^a-zA-Z0-9._-]/g, '-')
  if (!safeName || safeName === '.' || safeName === '..') return 'repo'
  return safeName
}

export async function cloneRepo(remoteUrl: string): Promise<CloneRepoResult> {
  const destParent = path.join(os.homedir(), 'GitEdu-Repos')
  const localPath = path.join(destParent, deriveRepoFolderName(remoteUrl))
  const command = `git clone ${remoteUrl} ${localPath}`

  // Defensa en profundidad: aunque deriveRepoFolderName ya rechaza '.'/'..', esto
  // garantiza que localPath nunca pueda quedar fuera de destParent pase lo que pase.
  if (localPath !== destParent && !localPath.startsWith(destParent + path.sep)) {
    return { success: false, command, localPath: '', output: '', error: 'Ruta de destino inválida.' }
  }

  if (assertGitRepo(localPath) === null) {
    // Ya se había clonado en una sesión anterior: lo abrimos tal cual, sin volver a clonar.
    return { success: true, command, localPath, output: 'Ya estaba clonado en local; abriendo el existente.' }
  }

  try {
    await fsPromises.mkdir(destParent, { recursive: true })
    const { stdout, stderr } = await execFileAsync('git', ['clone', remoteUrl, localPath], {
      maxBuffer: 1024 * 1024 * 10,
      env: GIT_ENV,
    })
    return { success: true, command, localPath, output: stdout || stderr }
  } catch (err) {
    return { success: false, command, localPath: '', output: '', error: extractGitErrorMessage(err) }
  }
}
