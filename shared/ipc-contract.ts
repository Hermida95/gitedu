// Único punto de verdad para la comunicación entre el proceso principal
// (electron/) y el renderer (src/): nombres de canal IPC + las formas de los
// datos que viajan por ellos. Se importa desde los tres sitios de siempre —
// los handlers de electron/main/ipc/*.ts, electron/preload/index.ts, y
// src/vite-env.d.ts — así que renombrar un canal o cambiar un tipo aquí hace
// que TypeScript señale automáticamente todos los sitios que hay que tocar.
//
// Patrón repetido en casi todos los resultados: `success: boolean` +
// `error?: string`. Es deliberado en vez de lanzar excepciones a través de
// IPC — el renderer siempre recibe una respuesta con la que puede pintar la
// UI (mensaje de error incluido) sin necesitar try/catch en cada llamada.

export const IPC_CHANNELS = {
  // Lecturas: construir el grafo, ver el estado del repo, listar ramas/stashes...
  GET_COMMIT_GRAPH: 'git:getCommitGraph',
  GET_COMMIT_GRAPH_DATA: 'git:getCommitGraphData',
  SELECT_REPO_FOLDER: 'dialog:selectRepoFolder',
  GET_REPO_STATUS: 'git:getRepoStatus',
  LIST_BRANCHES: 'git:listBranches',

  // Escrituras básicas: mueven el estado local del repo (staging, commits, ramas, push).
  STAGE_FILE: 'git:stageFile',
  UNSTAGE_FILE: 'git:unstageFile',
  COMMIT: 'git:commit',
  CREATE_BRANCH: 'git:createBranch',
  CHECKOUT_BRANCH: 'git:checkoutBranch',
  MERGE_BRANCH: 'git:mergeBranch',
  REBASE_BRANCH: 'git:rebaseBranch',
  PUSH: 'git:push',

  // Resolución de conflictos: comparten los mismos comandos entre un merge y
  // un rebase pausados (ver ConflictPanel.tsx).
  GET_CONFLICT_STATE: 'git:getConflictState',
  RESOLVE_CONFLICT_OURS: 'git:resolveConflictOurs',
  RESOLVE_CONFLICT_THEIRS: 'git:resolveConflictTheirs',
  MARK_CONFLICT_RESOLVED: 'git:markConflictResolved',
  CONTINUE_MERGE: 'git:continueMerge',
  ABORT_MERGE: 'git:abortMerge',
  CONTINUE_REBASE: 'git:continueRebase',
  ABORT_REBASE: 'git:abortRebase',

  // Rebase interactivo scriptado (ver el comentario grande en gitActions.ts
  // sobre el truco de GIT_SEQUENCE_EDITOR).
  GET_REBASE_COMMITS: 'git:getRebaseCommits',
  RUN_INTERACTIVE_REBASE: 'git:runInteractiveRebase',

  // Abrir un repo que todavía no existe localmente (clonar) o que existe pero
  // no es un repo git todavía (inicializar).
  CLONE_REPO: 'git:cloneRepo',
  INIT_REPO: 'git:initRepo',

  FETCH: 'git:fetch',
  PULL: 'git:pull',

  LIST_STASHES: 'git:listStashes',
  STASH_SAVE: 'git:stashSave',
  STASH_POP: 'git:stashPop',
  STASH_DROP: 'git:stashDrop',

  GET_FILE_DIFF: 'git:getFileDiff',

  // WATCH_REPO es un invoke normal (arranca/para el fs.watch del main process);
  // REPO_CHANGED_EVENT no se invoca nunca desde el renderer — es el nombre del
  // evento que el main process empuja solo, vía webContents.send, cuando algo
  // cambia el .git vigilado desde fuera de la app.
  WATCH_REPO: 'git:watchRepo',
  REPO_CHANGED_EVENT: 'git:repoChanged',
} as const

// --- Grafo de commits ---

export interface GitLogResult {
  success: boolean
  output: string
  error?: string
}

export interface Commit {
  hash: string
  shortHash: string
  parents: string[]
  author: string
  date: string
  message: string
  // Nombres de rama/tag/origin-tracking que apuntan a este commit ("main",
  // "origin/main", "v1.0"...). Vacío si ninguna referencia lo señala.
  refs: string[]
}

export interface CommitGraphData {
  success: boolean
  commits: Commit[]
  error?: string
}

// --- Estado del repositorio (ficheros, ramas) ---

export type FileStatusCode = 'staged' | 'unstaged' | 'untracked' | 'conflicted'

export interface FileStatus {
  path: string
  status: FileStatusCode
  // Código crudo de dos caracteres tal cual lo da `git status --porcelain=v2`
  // (p.ej. "M.", ".M", "??", "UU") — se guarda por si algún día hace falta
  // más detalle del que da FileStatusCode.
  raw: string
}

export interface RepoStatus {
  success: boolean
  branch: string | null // null si HEAD está desacoplado (detached)
  upstream: string | null
  ahead: number
  behind: number
  files: FileStatus[]
  error?: string
}

export interface BranchInfo {
  name: string
  isCurrent: boolean
  isRemote: boolean
}

export interface BranchListResult {
  success: boolean
  branches: BranchInfo[]
  error?: string
}

// --- Acciones de escritura ---

// Resultado de cualquier acción de escritura (commit, merge, rebase, push...).
// `command` siempre lleva el comando exacto ejecutado, para el panel didáctico.
export interface GitActionResult {
  success: boolean
  command: string
  output: string
  error?: string
}

// --- Conflictos ---

export type ConflictInProgress = 'merge' | 'rebase' | null

export interface ConflictState {
  inProgress: ConflictInProgress
  conflictedFiles: string[]
}

// --- Rebase interactivo ---

export type RebaseStepAction = 'pick' | 'squash' | 'drop' | 'reword'

export interface RebaseStep {
  hash: string
  action: RebaseStepAction
  // Solo se usa (y hace falta) cuando action === 'reword'.
  message?: string
}

export interface RebaseCommitInfo {
  hash: string
  shortHash: string
  message: string
  author: string
}

export interface RebaseCommitsResult {
  success: boolean
  commits: RebaseCommitInfo[]
  error?: string
}

// --- Clonar / inicializar ---

export interface CloneRepoResult {
  success: boolean
  command: string
  localPath: string
  output: string
  error?: string
}

// --- Stash ---

export interface StashInfo {
  index: number
  message: string
}

export interface StashListResult {
  success: boolean
  stashes: StashInfo[]
  error?: string
}

// --- Diff ---

export interface FileDiffResult {
  success: boolean
  diff: string
  error?: string
}
