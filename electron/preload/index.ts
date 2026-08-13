// Única puerta de entrada del renderer al mundo Node/Electron. Con
// contextIsolation:true + sandbox:true, el renderer NO tiene `require` ni
// `ipcRenderer` — solo ve el objeto `window.gitedu` que se construye aquí
// explícitamente. Cada función es una llamada a un canal IPC concreto y
// nada más: no se expone ipcRenderer en crudo, así que el renderer no puede
// invocar un canal arbitrario que no esté listado abajo. Ver vite-env.d.ts
// para el tipo `Window.gitedu` que usa el resto del renderer.
import { contextBridge, ipcRenderer } from 'electron'
import {
  IPC_CHANNELS,
  type BranchListResult,
  type CloneRepoResult,
  type CommitGraphData,
  type ConflictState,
  type FileDiffResult,
  type FileStatusCode,
  type GitActionResult,
  type GitLogResult,
  type RebaseCommitsResult,
  type RebaseStep,
  type RepoStatus,
  type StashListResult,
} from '../../shared/ipc-contract'

contextBridge.exposeInMainWorld('gitedu', {
  // --- Grafo y estado del repo (lecturas) ---
  getCommitGraph: (repoPath: string): Promise<GitLogResult> =>
    ipcRenderer.invoke(IPC_CHANNELS.GET_COMMIT_GRAPH, repoPath),
  getCommitGraphData: (repoPath: string): Promise<CommitGraphData> =>
    ipcRenderer.invoke(IPC_CHANNELS.GET_COMMIT_GRAPH_DATA, repoPath),
  selectRepoFolder: (): Promise<string | null> => ipcRenderer.invoke(IPC_CHANNELS.SELECT_REPO_FOLDER),

  getRepoStatus: (repoPath: string): Promise<RepoStatus> =>
    ipcRenderer.invoke(IPC_CHANNELS.GET_REPO_STATUS, repoPath),
  listBranches: (repoPath: string): Promise<BranchListResult> =>
    ipcRenderer.invoke(IPC_CHANNELS.LIST_BRANCHES, repoPath),

  // --- Acciones de escritura ---
  stageFile: (repoPath: string, filePath: string): Promise<GitActionResult> =>
    ipcRenderer.invoke(IPC_CHANNELS.STAGE_FILE, repoPath, filePath),
  unstageFile: (repoPath: string, filePath: string): Promise<GitActionResult> =>
    ipcRenderer.invoke(IPC_CHANNELS.UNSTAGE_FILE, repoPath, filePath),
  commit: (repoPath: string, message: string): Promise<GitActionResult> =>
    ipcRenderer.invoke(IPC_CHANNELS.COMMIT, repoPath, message),
  createBranch: (repoPath: string, name: string): Promise<GitActionResult> =>
    ipcRenderer.invoke(IPC_CHANNELS.CREATE_BRANCH, repoPath, name),
  checkoutBranch: (repoPath: string, name: string): Promise<GitActionResult> =>
    ipcRenderer.invoke(IPC_CHANNELS.CHECKOUT_BRANCH, repoPath, name),
  mergeBranch: (repoPath: string, branchName: string): Promise<GitActionResult> =>
    ipcRenderer.invoke(IPC_CHANNELS.MERGE_BRANCH, repoPath, branchName),
  rebaseBranch: (repoPath: string, ontoBranch: string): Promise<GitActionResult> =>
    ipcRenderer.invoke(IPC_CHANNELS.REBASE_BRANCH, repoPath, ontoBranch),
  push: (repoPath: string): Promise<GitActionResult> => ipcRenderer.invoke(IPC_CHANNELS.PUSH, repoPath),

  // --- Conflictos de merge/rebase ---
  getConflictState: (repoPath: string): Promise<ConflictState> =>
    ipcRenderer.invoke(IPC_CHANNELS.GET_CONFLICT_STATE, repoPath),
  resolveConflictOurs: (repoPath: string, filePath: string): Promise<GitActionResult> =>
    ipcRenderer.invoke(IPC_CHANNELS.RESOLVE_CONFLICT_OURS, repoPath, filePath),
  resolveConflictTheirs: (repoPath: string, filePath: string): Promise<GitActionResult> =>
    ipcRenderer.invoke(IPC_CHANNELS.RESOLVE_CONFLICT_THEIRS, repoPath, filePath),
  markConflictResolved: (repoPath: string, filePath: string): Promise<GitActionResult> =>
    ipcRenderer.invoke(IPC_CHANNELS.MARK_CONFLICT_RESOLVED, repoPath, filePath),
  continueMerge: (repoPath: string): Promise<GitActionResult> =>
    ipcRenderer.invoke(IPC_CHANNELS.CONTINUE_MERGE, repoPath),
  abortMerge: (repoPath: string): Promise<GitActionResult> =>
    ipcRenderer.invoke(IPC_CHANNELS.ABORT_MERGE, repoPath),
  continueRebase: (repoPath: string): Promise<GitActionResult> =>
    ipcRenderer.invoke(IPC_CHANNELS.CONTINUE_REBASE, repoPath),
  abortRebase: (repoPath: string): Promise<GitActionResult> =>
    ipcRenderer.invoke(IPC_CHANNELS.ABORT_REBASE, repoPath),

  // --- Rebase interactivo ---
  getRebaseCommits: (repoPath: string, ontoBranch: string): Promise<RebaseCommitsResult> =>
    ipcRenderer.invoke(IPC_CHANNELS.GET_REBASE_COMMITS, repoPath, ontoBranch),
  runInteractiveRebase: (repoPath: string, ontoBranch: string, steps: RebaseStep[]): Promise<GitActionResult> =>
    ipcRenderer.invoke(IPC_CHANNELS.RUN_INTERACTIVE_REBASE, repoPath, ontoBranch, steps),

  // --- Clonar / inicializar ---
  cloneRepo: (remoteUrl: string): Promise<CloneRepoResult> => ipcRenderer.invoke(IPC_CHANNELS.CLONE_REPO, remoteUrl),
  initRepo: (folderPath: string): Promise<GitActionResult> => ipcRenderer.invoke(IPC_CHANNELS.INIT_REPO, folderPath),

  fetch: (repoPath: string): Promise<GitActionResult> => ipcRenderer.invoke(IPC_CHANNELS.FETCH, repoPath),
  pull: (repoPath: string): Promise<GitActionResult> => ipcRenderer.invoke(IPC_CHANNELS.PULL, repoPath),

  // --- Stash ---
  listStashes: (repoPath: string): Promise<StashListResult> =>
    ipcRenderer.invoke(IPC_CHANNELS.LIST_STASHES, repoPath),
  stashSave: (repoPath: string, message: string): Promise<GitActionResult> =>
    ipcRenderer.invoke(IPC_CHANNELS.STASH_SAVE, repoPath, message),
  stashPop: (repoPath: string, index: number): Promise<GitActionResult> =>
    ipcRenderer.invoke(IPC_CHANNELS.STASH_POP, repoPath, index),
  stashDrop: (repoPath: string, index: number): Promise<GitActionResult> =>
    ipcRenderer.invoke(IPC_CHANNELS.STASH_DROP, repoPath, index),

  // --- Diff de un fichero ---
  getFileDiff: (repoPath: string, filePath: string, status: FileStatusCode): Promise<FileDiffResult> =>
    ipcRenderer.invoke(IPC_CHANNELS.GET_FILE_DIFF, repoPath, filePath, status),

  // --- Vigilancia en vivo del repo ---
  // watchRepo arranca un fs.watch en el main process sobre el .git indicado.
  // onRepoChanged suscribe un callback al evento que ese watcher dispara (con
  // debounce) cuando algo lo modifica desde fuera de la app — p.ej. el
  // usuario ejecutando `git commit` a mano en una terminal. Devuelve una
  // función de limpieza para que el componente pueda darse de baja al
  // desmontarse y no acumular listeners duplicados en cada recarga del repo.
  watchRepo: (repoPath: string): Promise<boolean> => ipcRenderer.invoke(IPC_CHANNELS.WATCH_REPO, repoPath),
  onRepoChanged: (callback: () => void): (() => void) => {
    const listener = () => callback()
    ipcRenderer.on(IPC_CHANNELS.REPO_CHANGED_EVENT, listener)
    return () => ipcRenderer.removeListener(IPC_CHANNELS.REPO_CHANGED_EVENT, listener)
  },
})
