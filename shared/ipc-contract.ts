export const IPC_CHANNELS = {
  GET_COMMIT_GRAPH: 'git:getCommitGraph',
  GET_COMMIT_GRAPH_DATA: 'git:getCommitGraphData',
  SELECT_REPO_FOLDER: 'dialog:selectRepoFolder',
  GET_REPO_STATUS: 'git:getRepoStatus',
  LIST_BRANCHES: 'git:listBranches',
  STAGE_FILE: 'git:stageFile',
  UNSTAGE_FILE: 'git:unstageFile',
  COMMIT: 'git:commit',
  CREATE_BRANCH: 'git:createBranch',
  CHECKOUT_BRANCH: 'git:checkoutBranch',
  MERGE_BRANCH: 'git:mergeBranch',
  REBASE_BRANCH: 'git:rebaseBranch',
  PUSH: 'git:push',

  GET_CONFLICT_STATE: 'git:getConflictState',
  RESOLVE_CONFLICT_OURS: 'git:resolveConflictOurs',
  RESOLVE_CONFLICT_THEIRS: 'git:resolveConflictTheirs',
  MARK_CONFLICT_RESOLVED: 'git:markConflictResolved',
  CONTINUE_MERGE: 'git:continueMerge',
  ABORT_MERGE: 'git:abortMerge',
  CONTINUE_REBASE: 'git:continueRebase',
  ABORT_REBASE: 'git:abortRebase',

  GET_REBASE_COMMITS: 'git:getRebaseCommits',
  RUN_INTERACTIVE_REBASE: 'git:runInteractiveRebase',

  CLONE_REPO: 'git:cloneRepo',
} as const

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
  refs: string[]
}

export interface CommitGraphData {
  success: boolean
  commits: Commit[]
  error?: string
}

export type FileStatusCode = 'staged' | 'unstaged' | 'untracked' | 'conflicted'

export interface FileStatus {
  path: string
  status: FileStatusCode
  raw: string
}

export interface RepoStatus {
  success: boolean
  branch: string | null
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

// Resultado de cualquier acción de escritura (commit, merge, rebase, push...).
// `command` siempre lleva el comando exacto ejecutado, para el panel didáctico.
export interface GitActionResult {
  success: boolean
  command: string
  output: string
  error?: string
}

export type ConflictInProgress = 'merge' | 'rebase' | null

export interface ConflictState {
  inProgress: ConflictInProgress
  conflictedFiles: string[]
}

export type RebaseStepAction = 'pick' | 'squash' | 'drop' | 'reword'

export interface RebaseStep {
  hash: string
  action: RebaseStepAction
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

export interface CloneRepoResult {
  success: boolean
  command: string
  localPath: string
  output: string
  error?: string
}
