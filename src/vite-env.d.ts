/// <reference types="vite/client" />

import type {
  BranchListResult,
  CommitGraphData,
  ConflictState,
  GitActionResult,
  GitLogResult,
  RebaseCommitsResult,
  RebaseStep,
  RepoStatus,
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
    }
  }
}

export {}
