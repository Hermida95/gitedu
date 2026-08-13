// Operaciones de LECTURA sobre un repositorio git: grafo de commits, estado de
// ficheros, ramas, stashes, diffs... Nada aquí modifica el repo — las
// escrituras (commit, merge, push...) viven en gitActions.ts. Separar ambas
// cosas deja claro, con solo mirar el import, qué funciones pueden cambiar el
// estado del repo del usuario y cuáles son siempre seguras de llamar.
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import fs from 'node:fs'
import path from 'node:path'
import type {
  BranchInfo,
  BranchListResult,
  Commit,
  CommitGraphData,
  ConflictInProgress,
  ConflictState,
  FileDiffResult,
  FileStatus,
  FileStatusCode,
  GitLogResult,
  RebaseCommitInfo,
  RebaseCommitsResult,
  RepoStatus,
  StashInfo,
  StashListResult,
} from '../../shared/ipc-contract'

const execFileAsync = promisify(execFile)

// GIT_EDITOR=true evita que cualquier subcomando se quede colgado esperando un editor
// interactivo (la app no tiene TTY). GIT_TERMINAL_PROMPT=0 hace lo mismo para credenciales.
export const GIT_ENV = {
  ...process.env,
  GIT_EDITOR: 'true',
  GIT_TERMINAL_PROMPT: '0',
}

// Separadores de control: nunca aparecen en mensajes de commit ni nombres,
// a diferencia de '|' o espacios, así que el parseo no se rompe con mensajes libres.
const FIELD_SEP = '\x1f'
const RECORD_SEP = '\x1e'

export function assertGitRepo(repoPath: string): string | null {
  const gitDir = path.join(repoPath, '.git')
  if (!fs.existsSync(gitDir)) {
    return `"${repoPath}" no es un repositorio Git válido.`
  }
  return null
}

// Cuando execFile falla (p.ej. un merge con conflictos), el mensaje útil de git
// viene en stdout/stderr del proceso, no en err.message (que solo dice "Command failed").
export function extractGitErrorMessage(err: unknown): string {
  if (err && typeof err === 'object') {
    const e = err as { stderr?: string; stdout?: string; message?: string }
    const detail = (e.stderr || e.stdout || '').trim()
    if (detail) return detail
    if (e.message) return e.message
  }
  return String(err)
}

// Un repo recién creado con `git init` es válido pero no tiene HEAD todavía, así que
// `git log` falla. Lo comprobamos con esto (en vez de mirar el texto del error de git,
// que cambia de idioma según la configuración regional) para no confundirlo con un error real.
async function hasAnyCommit(repoPath: string): Promise<boolean> {
  return execFileAsync('git', ['rev-parse', '--verify', 'HEAD'], { cwd: repoPath, env: GIT_ENV })
    .then(() => true)
    .catch(() => false)
}

export async function getCommitGraph(repoPath: string): Promise<GitLogResult> {
  const invalidRepoError = assertGitRepo(repoPath)
  if (invalidRepoError) {
    return { success: false, output: '', error: invalidRepoError }
  }

  try {
    // execFile (no exec/shell) evita inyección de comandos: los args nunca pasan por un shell.
    const { stdout } = await execFileAsync(
      'git',
      ['log', '--oneline', '--graph', '--all', '--decorate'],
      { cwd: repoPath, maxBuffer: 1024 * 1024 * 10, env: GIT_ENV }
    )
    return { success: true, output: stdout }
  } catch (err) {
    if (!(await hasAnyCommit(repoPath))) {
      return { success: true, output: '' }
    }
    const message = extractGitErrorMessage(err)
    return { success: false, output: '', error: message }
  }
}

async function getRefsByCommit(repoPath: string): Promise<Map<string, string[]>> {
  const { stdout } = await execFileAsync(
    'git',
    ['for-each-ref', '--format=%(objectname) %(refname:short)', 'refs/heads', 'refs/remotes', 'refs/tags'],
    { cwd: repoPath, maxBuffer: 1024 * 1024 * 10, env: GIT_ENV }
  )

  const refsByCommit = new Map<string, string[]>()
  for (const line of stdout.trim().split('\n')) {
    if (!line) continue
    const [hash, ref] = line.split(' ')
    const existing = refsByCommit.get(hash) ?? []
    existing.push(ref)
    refsByCommit.set(hash, existing)
  }
  return refsByCommit
}

export async function getCommitGraphData(repoPath: string): Promise<CommitGraphData> {
  const invalidRepoError = assertGitRepo(repoPath)
  if (invalidRepoError) {
    return { success: false, commits: [], error: invalidRepoError }
  }

  try {
    const format = ['%H', '%h', '%P', '%an', '%ad', '%s'].join(FIELD_SEP) + RECORD_SEP
    const [{ stdout }, refsByCommit] = await Promise.all([
      execFileAsync(
        'git',
        ['log', '--all', '--date=iso-strict', `--pretty=format:${format}`],
        { cwd: repoPath, maxBuffer: 1024 * 1024 * 20, env: GIT_ENV }
      ),
      getRefsByCommit(repoPath),
    ])

    const commits: Commit[] = stdout
      .split(RECORD_SEP)
      .map((record) => record.replace(/^\n/, ''))
      .filter(Boolean)
      .map((record) => {
        const [hash, shortHash, parentsRaw, author, date, message] = record.split(FIELD_SEP)
        return {
          hash,
          shortHash,
          parents: parentsRaw ? parentsRaw.split(' ').filter(Boolean) : [],
          author,
          date,
          message,
          refs: refsByCommit.get(hash) ?? [],
        }
      })

    return { success: true, commits }
  } catch (err) {
    if (!(await hasAnyCommit(repoPath))) {
      return { success: true, commits: [] }
    }
    const message = extractGitErrorMessage(err)
    return { success: false, commits: [], error: message }
  }
}

export function parsePorcelainV2(stdout: string): Omit<RepoStatus, 'success' | 'error'> {
  let branch: string | null = null
  let upstream: string | null = null
  let ahead = 0
  let behind = 0
  const files: FileStatus[] = []

  for (const line of stdout.split('\n')) {
    if (!line) continue

    if (line.startsWith('# branch.head ')) {
      const head = line.slice('# branch.head '.length)
      branch = head === '(detached)' ? null : head
    } else if (line.startsWith('# branch.upstream ')) {
      upstream = line.slice('# branch.upstream '.length)
    } else if (line.startsWith('# branch.ab ')) {
      const match = line.match(/\+(\d+) -(\d+)/)
      if (match) {
        ahead = Number(match[1])
        behind = Number(match[2])
      }
    } else if (line.startsWith('1 ') || line.startsWith('2 ')) {
      // "1"/"2" = entradas normales/renombradas. Campos: XY sub mH mI mW hH hI [Xscore] path
      const parts = line.split(' ')
      const xy = parts[1]
      const pathIndex = line.startsWith('2 ') ? 9 : 8
      const filePath = parts.slice(pathIndex).join(' ').split('\t')[0]
      const [x, y] = xy.split('')
      // Un fichero puede tener cambios staged y unstaged a la vez; priorizamos
      // "staged" porque es lo relevante para decidir si ya se puede commitear.
      const status: FileStatusCode = x !== '.' ? 'staged' : y !== '.' ? 'unstaged' : 'unstaged'
      files.push({ path: filePath, status, raw: xy })
    } else if (line.startsWith('? ')) {
      files.push({ path: line.slice(2), status: 'untracked', raw: '??' })
    } else if (line.startsWith('u ')) {
      const parts = line.split(' ')
      const filePath = parts.slice(10).join(' ')
      files.push({ path: filePath, status: 'conflicted', raw: parts[1] })
    }
  }

  return { branch, upstream, ahead, behind, files }
}

export async function getRepoStatus(repoPath: string): Promise<RepoStatus> {
  const invalidRepoError = assertGitRepo(repoPath)
  if (invalidRepoError) {
    return { success: false, branch: null, upstream: null, ahead: 0, behind: 0, files: [], error: invalidRepoError }
  }

  try {
    const { stdout } = await execFileAsync(
      'git',
      ['status', '--porcelain=v2', '--branch'],
      { cwd: repoPath, maxBuffer: 1024 * 1024 * 10, env: GIT_ENV }
    )
    return { success: true, ...parsePorcelainV2(stdout) }
  } catch (err) {
    const message = extractGitErrorMessage(err)
    return { success: false, branch: null, upstream: null, ahead: 0, behind: 0, files: [], error: message }
  }
}

export async function listBranches(repoPath: string): Promise<BranchListResult> {
  const invalidRepoError = assertGitRepo(repoPath)
  if (invalidRepoError) {
    return { success: false, branches: [], error: invalidRepoError }
  }

  try {
    const { stdout } = await execFileAsync(
      'git',
      ['for-each-ref', '--format=%(refname)|%(HEAD)', 'refs/heads', 'refs/remotes'],
      { cwd: repoPath, maxBuffer: 1024 * 1024 * 10, env: GIT_ENV }
    )
    const branches: BranchInfo[] = stdout
      .trim()
      .split('\n')
      .filter(Boolean)
      .map((line) => {
        const [refname, headMarker] = line.split('|')
        const isRemote = refname.startsWith('refs/remotes/')
        const name = refname.replace(/^refs\/(heads|remotes)\//, '')
        return { name, isCurrent: headMarker === '*', isRemote }
      })
    return { success: true, branches }
  } catch (err) {
    const message = extractGitErrorMessage(err)
    return { success: false, branches: [], error: message }
  }
}

// Un merge o rebase en curso se detecta por la presencia de estos ficheros/directorios
// que git crea dentro de .git mientras la operación está pausada por conflictos.
export async function getConflictState(repoPath: string): Promise<ConflictState> {
  const gitDir = path.join(repoPath, '.git')
  const inProgress: ConflictInProgress = fs.existsSync(path.join(gitDir, 'MERGE_HEAD'))
    ? 'merge'
    : fs.existsSync(path.join(gitDir, 'rebase-merge')) || fs.existsSync(path.join(gitDir, 'rebase-apply'))
      ? 'rebase'
      : null

  if (!inProgress) return { inProgress: null, conflictedFiles: [] }

  const status = await getRepoStatus(repoPath)
  const conflictedFiles = status.files.filter((f) => f.status === 'conflicted').map((f) => f.path)
  return { inProgress, conflictedFiles }
}

// Commits que un `git rebase -i <ontoBranch>` reordenaría/reescribiría: los alcanzables
// desde HEAD que no están ya en ontoBranch, en el mismo orden (más antiguo primero) que
// muestra el editor de secuencia real.
export async function getRebaseCommits(repoPath: string, ontoBranch: string): Promise<RebaseCommitsResult> {
  const invalidRepoError = assertGitRepo(repoPath)
  if (invalidRepoError) {
    return { success: false, commits: [], error: invalidRepoError }
  }

  try {
    const format = ['%H', '%h', '%s', '%an'].join(FIELD_SEP) + RECORD_SEP
    const { stdout } = await execFileAsync(
      'git',
      ['log', '--reverse', `--pretty=format:${format}`, `${ontoBranch}..HEAD`],
      { cwd: repoPath, maxBuffer: 1024 * 1024 * 10, env: GIT_ENV }
    )

    const commits: RebaseCommitInfo[] = stdout
      .split(RECORD_SEP)
      .map((record) => record.replace(/^\n/, ''))
      .filter(Boolean)
      .map((record) => {
        const [hash, shortHash, message, author] = record.split(FIELD_SEP)
        return { hash, shortHash, message, author }
      })

    return { success: true, commits }
  } catch (err) {
    const message = extractGitErrorMessage(err)
    return { success: false, commits: [], error: message }
  }
}

export async function listStashes(repoPath: string): Promise<StashListResult> {
  const invalidRepoError = assertGitRepo(repoPath)
  if (invalidRepoError) {
    return { success: false, stashes: [], error: invalidRepoError }
  }

  try {
    const format = ['%gd', '%s'].join(FIELD_SEP)
    const { stdout } = await execFileAsync('git', ['stash', 'list', `--pretty=format:${format}`], {
      cwd: repoPath,
      maxBuffer: 1024 * 1024 * 10,
      env: GIT_ENV,
    })

    const stashes: StashInfo[] = stdout
      .trim()
      .split('\n')
      .filter(Boolean)
      .map((line, i) => {
        const [ref, message] = line.split(FIELD_SEP)
        const match = ref.match(/stash@\{(\d+)\}/)
        return { index: match ? Number(match[1]) : i, message: message ?? '' }
      })

    return { success: true, stashes }
  } catch (err) {
    const message = extractGitErrorMessage(err)
    return { success: false, stashes: [], error: message }
  }
}

export async function getFileDiff(
  repoPath: string,
  filePath: string,
  status: FileStatusCode
): Promise<FileDiffResult> {
  const invalidRepoError = assertGitRepo(repoPath)
  if (invalidRepoError) {
    return { success: false, diff: '', error: invalidRepoError }
  }

  // Un fichero sin rastrear no tiene nada que "diferenciar" en el índice: se compara
  // contra /dev/null para mostrar todo su contenido como líneas añadidas.
  const args =
    status === 'untracked'
      ? ['diff', '--no-index', '--', '/dev/null', filePath]
      : status === 'staged'
        ? ['diff', '--cached', '--', filePath]
        : ['diff', '--', filePath]

  try {
    const { stdout } = await execFileAsync('git', args, {
      cwd: repoPath,
      maxBuffer: 1024 * 1024 * 10,
      env: GIT_ENV,
    })
    return { success: true, diff: stdout }
  } catch (err) {
    // git diff --no-index sale con código 1 (no es un error) en cuanto detecta
    // cualquier diferencia, así que el diff real viene igualmente en stdout.
    const e = err as { stdout?: string }
    if (status === 'untracked' && e.stdout) {
      return { success: true, diff: e.stdout }
    }
    const message = extractGitErrorMessage(err)
    return { success: false, diff: '', error: message }
  }
}
