/// <reference types="vite/client" />

// Tipo de window.gitedu para el renderer: debe reflejar exactamente lo que
// electron/preload/index.ts expone vía contextBridge, campo a campo. Es un
// duplicado deliberado (no se puede importar código del proceso preload aquí)
// — si se añade una función en preload/index.ts, hay que añadirla aquí también.
import type {
  BranchListResult,
  CloneRepoResult,
  CommitGraphData,
  ConflictState,
  FileDiffResult,
  FileStatusCode,
  GitActionResult,
  GitLogResult,
  RebaseCommitsResult,
  RebaseStep,
  RepoStatus,
  StashListResult,
} from '../shared/ipc-contract'

declare global {
  interface Window {
    gitedu: {
      getCommitGraph: (repoPath: string) => Promise<GitLogResult>
      getCommitGraphData: (repoPath: string) => Promise<CommitGraphData>
      selectRepoFolder: () => Promise<string | null>

      getRepoStatus: (repoPath: string) => Promise<RepoStatus>
      listBranches: (repoPath: string) => Promise<BranchListResult>

      stageFile: (repoPath: string, filePath: string) => Promise<GitActionResult>
      unstageFile: (repoPath: string, filePath: string) => Promise<GitActionResult>
      commit: (repoPath: string, message: string) => Promise<GitActionResult>
      createBranch: (repoPath: string, name: string) => Promise<GitActionResult>
      checkoutBranch: (repoPath: string, name: string) => Promise<GitActionResult>
      mergeBranch: (repoPath: string, branchName: string) => Promise<GitActionResult>
      rebaseBranch: (repoPath: string, ontoBranch: string) => Promise<GitActionResult>
      push: (repoPath: string) => Promise<GitActionResult>

      getConflictState: (repoPath: string) => Promise<ConflictState>
      resolveConflictOurs: (repoPath: string, filePath: string) => Promise<GitActionResult>
      resolveConflictTheirs: (repoPath: string, filePath: string) => Promise<GitActionResult>
      markConflictResolved: (repoPath: string, filePath: string) => Promise<GitActionResult>
      continueMerge: (repoPath: string) => Promise<GitActionResult>
      abortMerge: (repoPath: string) => Promise<GitActionResult>
      continueRebase: (repoPath: string) => Promise<GitActionResult>
      abortRebase: (repoPath: string) => Promise<GitActionResult>

      getRebaseCommits: (repoPath: string, ontoBranch: string) => Promise<RebaseCommitsResult>
      runInteractiveRebase: (repoPath: string, ontoBranch: string, steps: RebaseStep[]) => Promise<GitActionResult>

      cloneRepo: (remoteUrl: string) => Promise<CloneRepoResult>
      initRepo: (folderPath: string) => Promise<GitActionResult>

      fetch: (repoPath: string) => Promise<GitActionResult>
      pull: (repoPath: string) => Promise<GitActionResult>

      listStashes: (repoPath: string) => Promise<StashListResult>
      stashSave: (repoPath: string, message: string) => Promise<GitActionResult>
      stashPop: (repoPath: string, index: number) => Promise<GitActionResult>
      stashDrop: (repoPath: string, index: number) => Promise<GitActionResult>

      getFileDiff: (repoPath: string, filePath: string, status: FileStatusCode) => Promise<FileDiffResult>

      watchRepo: (repoPath: string) => Promise<boolean>
      onRepoChanged: (callback: () => void) => () => void
    }
  }
}

export {}
