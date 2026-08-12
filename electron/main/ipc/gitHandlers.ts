import { ipcMain } from 'electron'
import {
  getCommitGraph,
  getCommitGraphData,
  getConflictState,
  getRebaseCommits,
  getRepoStatus,
  listBranches,
} from '../../services/gitService'
import { IPC_CHANNELS } from '../../../shared/ipc-contract'

export function registerGitHandlers(): void {
  ipcMain.handle(IPC_CHANNELS.GET_COMMIT_GRAPH, async (_event, repoPath: string) => {
    return getCommitGraph(repoPath)
  })

  ipcMain.handle(IPC_CHANNELS.GET_COMMIT_GRAPH_DATA, async (_event, repoPath: string) => {
    return getCommitGraphData(repoPath)
  })

  ipcMain.handle(IPC_CHANNELS.GET_REPO_STATUS, async (_event, repoPath: string) => {
    return getRepoStatus(repoPath)
  })

  ipcMain.handle(IPC_CHANNELS.LIST_BRANCHES, async (_event, repoPath: string) => {
    return listBranches(repoPath)
  })

  ipcMain.handle(IPC_CHANNELS.GET_CONFLICT_STATE, async (_event, repoPath: string) => {
    return getConflictState(repoPath)
  })

  ipcMain.handle(IPC_CHANNELS.GET_REBASE_COMMITS, async (_event, repoPath: string, ontoBranch: string) => {
    return getRebaseCommits(repoPath, ontoBranch)
  })
}
