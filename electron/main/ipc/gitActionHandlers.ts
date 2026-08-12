import { ipcMain } from 'electron'
import {
  abortMerge,
  abortRebase,
  checkoutBranch,
  cloneRepo,
  commitChanges,
  continueMerge,
  continueRebase,
  createBranch,
  fetchRepo,
  markConflictResolved,
  mergeBranch,
  pullBranch,
  pushBranch,
  rebaseBranch,
  resolveConflictOurs,
  resolveConflictTheirs,
  runInteractiveRebase,
  stageFile,
  stashDrop,
  stashPop,
  stashSave,
  unstageFile,
} from '../../services/gitActions'
import { IPC_CHANNELS, type RebaseStep } from '../../../shared/ipc-contract'

export function registerGitActionHandlers(): void {
  ipcMain.handle(IPC_CHANNELS.STAGE_FILE, async (_event, repoPath: string, filePath: string) => {
    return stageFile(repoPath, filePath)
  })

  ipcMain.handle(IPC_CHANNELS.UNSTAGE_FILE, async (_event, repoPath: string, filePath: string) => {
    return unstageFile(repoPath, filePath)
  })

  ipcMain.handle(IPC_CHANNELS.COMMIT, async (_event, repoPath: string, message: string) => {
    return commitChanges(repoPath, message)
  })

  ipcMain.handle(IPC_CHANNELS.CREATE_BRANCH, async (_event, repoPath: string, name: string) => {
    return createBranch(repoPath, name)
  })

  ipcMain.handle(IPC_CHANNELS.CHECKOUT_BRANCH, async (_event, repoPath: string, name: string) => {
    return checkoutBranch(repoPath, name)
  })

  ipcMain.handle(IPC_CHANNELS.MERGE_BRANCH, async (_event, repoPath: string, branchName: string) => {
    return mergeBranch(repoPath, branchName)
  })

  ipcMain.handle(IPC_CHANNELS.REBASE_BRANCH, async (_event, repoPath: string, ontoBranch: string) => {
    return rebaseBranch(repoPath, ontoBranch)
  })

  ipcMain.handle(IPC_CHANNELS.PUSH, async (_event, repoPath: string) => {
    return pushBranch(repoPath)
  })

  ipcMain.handle(IPC_CHANNELS.RESOLVE_CONFLICT_OURS, async (_event, repoPath: string, filePath: string) => {
    return resolveConflictOurs(repoPath, filePath)
  })

  ipcMain.handle(IPC_CHANNELS.RESOLVE_CONFLICT_THEIRS, async (_event, repoPath: string, filePath: string) => {
    return resolveConflictTheirs(repoPath, filePath)
  })

  ipcMain.handle(IPC_CHANNELS.MARK_CONFLICT_RESOLVED, async (_event, repoPath: string, filePath: string) => {
    return markConflictResolved(repoPath, filePath)
  })

  ipcMain.handle(IPC_CHANNELS.CONTINUE_MERGE, async (_event, repoPath: string) => {
    return continueMerge(repoPath)
  })

  ipcMain.handle(IPC_CHANNELS.ABORT_MERGE, async (_event, repoPath: string) => {
    return abortMerge(repoPath)
  })

  ipcMain.handle(IPC_CHANNELS.CONTINUE_REBASE, async (_event, repoPath: string) => {
    return continueRebase(repoPath)
  })

  ipcMain.handle(IPC_CHANNELS.ABORT_REBASE, async (_event, repoPath: string) => {
    return abortRebase(repoPath)
  })

  ipcMain.handle(
    IPC_CHANNELS.RUN_INTERACTIVE_REBASE,
    async (_event, repoPath: string, ontoBranch: string, steps: RebaseStep[]) => {
      return runInteractiveRebase(repoPath, ontoBranch, steps)
    }
  )

  ipcMain.handle(IPC_CHANNELS.CLONE_REPO, async (_event, remoteUrl: string) => {
    return cloneRepo(remoteUrl)
  })

  ipcMain.handle(IPC_CHANNELS.FETCH, async (_event, repoPath: string) => {
    return fetchRepo(repoPath)
  })

  ipcMain.handle(IPC_CHANNELS.PULL, async (_event, repoPath: string) => {
    return pullBranch(repoPath)
  })

  ipcMain.handle(IPC_CHANNELS.STASH_SAVE, async (_event, repoPath: string, message: string) => {
    return stashSave(repoPath, message)
  })

  ipcMain.handle(IPC_CHANNELS.STASH_POP, async (_event, repoPath: string, index: number) => {
    return stashPop(repoPath, index)
  })

  ipcMain.handle(IPC_CHANNELS.STASH_DROP, async (_event, repoPath: string, index: number) => {
    return stashDrop(repoPath, index)
  })
}
