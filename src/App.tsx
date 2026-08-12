import { useEffect, useState } from 'react'
import type {
  BranchInfo,
  Commit,
  ConflictState,
  FileStatus,
  GitActionResult,
  RepoStatus,
  StashInfo,
} from '../shared/ipc-contract'
import { CommitGraph } from './components/graph/CommitGraph'
import { StatusPanel } from './components/sidebar/StatusPanel'
import { BranchPanel } from './components/sidebar/BranchPanel'
import { StashPanel } from './components/sidebar/StashPanel'
import { CommandPreviewModal } from './components/command-preview/CommandPreviewModal'
import { ConflictPanel } from './components/conflict/ConflictPanel'
import { InteractiveRebasePanel } from './components/rebase/InteractiveRebasePanel'
import { DiffViewerModal } from './components/diff/DiffViewerModal'
import { CommandLog, type LastCommand } from './components/CommandLog'
import { buildCommandPreview, type GitAction } from './lib/gitCommandPreview'

const isRemoteUrl = (value: string): boolean => /^(https?:\/\/|git@)/i.test(value.trim())

function App() {
  const [repoPath, setRepoPath] = useState('')
  const [activeRepoPath, setActiveRepoPath] = useState('')
  const [commits, setCommits] = useState<Commit[]>([])
  const [rawOutput, setRawOutput] = useState('')
  const [showRaw, setShowRaw] = useState(false)
  const [status, setStatus] = useState<RepoStatus | null>(null)
  const [branches, setBranches] = useState<BranchInfo[]>([])
  const [stashes, setStashes] = useState<StashInfo[]>([])
  const [conflictState, setConflictState] = useState<ConflictState | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [watching, setWatching] = useState(false)

  const [pendingAction, setPendingAction] = useState<GitAction | null>(null)
  const [actionLoading, setActionLoading] = useState(false)
  const [lastCommand, setLastCommand] = useState<LastCommand | null>(null)
  const [resetToken, setResetToken] = useState(0)

  const [interactiveRebaseTarget, setInteractiveRebaseTarget] = useState<string | null>(null)
  const [diffTarget, setDiffTarget] = useState<FileStatus | null>(null)

  async function refreshRepo(path: string) {
    if (!path) return
    setLoading(true)
    setError(null)

    const [graphData, logResult, statusResult, branchResult, conflictResult, stashResult] = await Promise.all([
      window.gitedu.getCommitGraphData(path),
      window.gitedu.getCommitGraph(path),
      window.gitedu.getRepoStatus(path),
      window.gitedu.listBranches(path),
      window.gitedu.getConflictState(path),
      window.gitedu.listStashes(path),
    ])

    if (graphData.success) {
      setCommits(graphData.commits)
      setRawOutput(logResult.output)
      setActiveRepoPath(path)
    } else {
      setError(graphData.error ?? 'Error desconocido')
      setCommits([])
      setRawOutput('')
    }
    setStatus(statusResult.success ? statusResult : null)
    setBranches(branchResult.success ? branchResult.branches : [])
    setConflictState(conflictResult)
    setStashes(stashResult.success ? stashResult.stashes : [])
    setLoading(false)
  }

  // Vigila el .git del repo activo: si algo lo cambia por fuera (terminal, otro
  // editor...), el evento llega aquí y recargamos solos, sin que haga falta pulsar nada.
  useEffect(() => {
    if (!activeRepoPath) return

    let cancelled = false
    window.gitedu.watchRepo(activeRepoPath).then((ok) => {
      if (!cancelled) setWatching(ok)
    })

    const unsubscribe = window.gitedu.onRepoChanged(() => {
      refreshRepo(activeRepoPath)
    })

    return () => {
      cancelled = true
      unsubscribe()
    }
  }, [activeRepoPath])

  // El input acepta tanto una ruta local como una URL remota (https://... o
  // git@...): si detecta una URL, clona primero a ~/GitEdu-Repos y luego carga
  // el clon local — GitEdu nunca opera directamente sobre un repo remoto.
  async function loadOrClone(input: string) {
    const trimmed = input.trim()
    if (!trimmed) return

    if (!isRemoteUrl(trimmed)) {
      await refreshRepo(trimmed)
      return
    }

    setLoading(true)
    setError(null)
    const cloneResult = await window.gitedu.cloneRepo(trimmed)
    setLastCommand({ command: cloneResult.command, success: cloneResult.success, error: cloneResult.error })

    if (!cloneResult.success) {
      setError(cloneResult.error ?? 'No se pudo clonar el repositorio.')
      setLoading(false)
      return
    }

    setRepoPath(cloneResult.localPath)
    await refreshRepo(cloneResult.localPath)
  }

  async function handleBrowse() {
    const selected = await window.gitedu.selectRepoFolder()
    if (selected) {
      setRepoPath(selected)
      refreshRepo(selected)
    }
  }

  // Acciones de bajo riesgo (reversibles, rutinarias): se ejecutan al instante
  // y solo dejan constancia en el log de comandos, sin bloquear con un modal.
  async function runImmediate(action: () => Promise<GitActionResult>) {
    setActionLoading(true)
    const result = await action()
    setLastCommand({ command: result.command, success: result.success, error: result.error })
    setActionLoading(false)
    if (repoPath) await refreshRepo(repoPath)
  }

  function requestAction(action: GitAction) {
    setPendingAction(action)
  }

  async function confirmPendingAction() {
    if (!pendingAction) return
    setActionLoading(true)

    let result: GitActionResult
    switch (pendingAction.type) {
      case 'commit':
        result = await window.gitedu.commit(repoPath, pendingAction.message)
        break
      case 'mergeBranch':
        result = await window.gitedu.mergeBranch(repoPath, pendingAction.branchName)
        break
      case 'rebaseBranch':
        result = await window.gitedu.rebaseBranch(repoPath, pendingAction.ontoBranch)
        break
      case 'push':
        result = await window.gitedu.push(repoPath)
        break
      case 'createBranch':
        result = await window.gitedu.createBranch(repoPath, pendingAction.name)
        break
      case 'checkoutBranch':
        result = await window.gitedu.checkoutBranch(repoPath, pendingAction.name)
        break
      case 'fetch':
        result = await window.gitedu.fetch(repoPath)
        break
      case 'pull':
        result = await window.gitedu.pull(repoPath)
        break
      case 'stashSave':
        result = await window.gitedu.stashSave(repoPath, pendingAction.message)
        break
      case 'stashPop':
        result = await window.gitedu.stashPop(repoPath, pendingAction.index)
        break
      case 'stashDrop':
        result = await window.gitedu.stashDrop(repoPath, pendingAction.index)
        break
    }

    setLastCommand({ command: result.command, success: result.success, error: result.error })
    setActionLoading(false)
    setPendingAction(null)
    if (result.success) setResetToken((t) => t + 1)
    await refreshRepo(repoPath)
  }

  function handleInteractiveRebaseExecuted(result: GitActionResult) {
    setLastCommand({ command: result.command, success: result.success, error: result.error })
    setInteractiveRebaseTarget(null)
    if (result.success) setResetToken((t) => t + 1)
    refreshRepo(repoPath)
  }

  async function runConflictAction(action: () => Promise<GitActionResult>) {
    setActionLoading(true)
    const result = await action()
    setLastCommand({ command: result.command, success: result.success, error: result.error })
    setActionLoading(false)
    await refreshRepo(repoPath)
  }

  function handleContinueConflict() {
    if (conflictState?.inProgress === 'merge') {
      return runConflictAction(() => window.gitedu.continueMerge(repoPath))
    }
    if (conflictState?.inProgress === 'rebase') {
      return runConflictAction(() => window.gitedu.continueRebase(repoPath))
    }
  }

  function handleAbortConflict() {
    if (conflictState?.inProgress === 'merge') {
      return runConflictAction(() => window.gitedu.abortMerge(repoPath))
    }
    if (conflictState?.inProgress === 'rebase') {
      return runConflictAction(() => window.gitedu.abortRebase(repoPath))
    }
  }

  const currentBranchName = status?.branch ?? null

  const highlightRefs =
    pendingAction?.type === 'mergeBranch'
      ? [pendingAction.currentBranch, pendingAction.branchName].filter((r): r is string => !!r)
      : pendingAction?.type === 'rebaseBranch'
        ? [pendingAction.currentBranch, pendingAction.ontoBranch].filter((r): r is string => !!r)
        : []

  return (
    <div className="flex h-screen flex-col bg-slate-950 text-slate-100">
      <header className="border-b border-slate-800 p-4">
        <div className="mb-3 flex items-center gap-2">
          <h1 className="text-lg font-bold">GitEdu</h1>
          {watching && (
            <span
              className="flex items-center gap-1 rounded-full bg-emerald-900/40 px-2 py-0.5 text-[10px] text-emerald-300"
              title="GitEdu está vigilando este repositorio: si cambias algo desde la terminal, se recargará solo."
            >
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" /> en vivo
            </span>
          )}
        </div>

        <div className="flex gap-2">
          <input
            className="flex-1 rounded border border-slate-700 bg-slate-900 px-3 py-2 font-mono text-sm outline-none focus:border-emerald-500"
            placeholder="/ruta/al/repositorio o https://github.com/usuario/repo"
            value={repoPath}
            onChange={(e) => setRepoPath(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && loadOrClone(repoPath)}
          />
          <button
            className="rounded border border-slate-700 px-4 py-2 text-sm hover:bg-slate-800"
            onClick={handleBrowse}
          >
            Examinar...
          </button>
          <button
            className="rounded bg-emerald-600 px-4 py-2 text-sm hover:bg-emerald-500 disabled:opacity-50"
            onClick={() => loadOrClone(repoPath)}
            disabled={loading || !repoPath}
          >
            {loading ? 'Cargando...' : isRemoteUrl(repoPath) ? 'Clonar y cargar' : 'Cargar grafo'}
          </button>
        </div>

        {isRemoteUrl(repoPath) && !loading && (
          <p className="mt-2 text-xs text-slate-500">
            Se clonará en <code className="font-mono">~/GitEdu-Repos/</code> y luego se cargará desde ahí.
          </p>
        )}

        {error && <p className="mt-2 text-sm text-red-400">{error}</p>}

        {rawOutput && (
          <div className="mt-2">
            <button
              className="text-xs text-slate-400 underline hover:text-slate-200"
              onClick={() => setShowRaw((v) => !v)}
            >
              {showRaw ? 'Ocultar' : 'Ver'} comando ejecutado:{' '}
              <code className="font-mono">git log --oneline --graph --all --decorate</code>
            </button>
            {showRaw && (
              <pre className="mt-2 max-h-40 overflow-auto rounded bg-black p-3 text-xs">{rawOutput}</pre>
            )}
          </div>
        )}
      </header>

      <div className="flex flex-1 overflow-hidden">
        <aside className="w-72 shrink-0 overflow-y-auto border-r border-slate-800">
          <StatusPanel
            key={resetToken}
            status={status}
            onStage={(filePath) => runImmediate(() => window.gitedu.stageFile(repoPath, filePath))}
            onUnstage={(filePath) => runImmediate(() => window.gitedu.unstageFile(repoPath, filePath))}
            onViewDiff={(file) => setDiffTarget(file)}
            onRequestCommit={(message) => requestAction({ type: 'commit', message })}
            busy={actionLoading}
          />
          <BranchPanel
            branches={branches}
            onCheckout={(name) => requestAction({ type: 'checkoutBranch', name })}
            onCreateBranch={(name) => requestAction({ type: 'createBranch', name })}
            onRequestMerge={(branchName) =>
              requestAction({ type: 'mergeBranch', branchName, currentBranch: currentBranchName })
            }
            onRequestRebase={(ontoBranch) =>
              requestAction({ type: 'rebaseBranch', ontoBranch, currentBranch: currentBranchName })
            }
            onOpenInteractiveRebase={(ontoBranch) => setInteractiveRebaseTarget(ontoBranch)}
            onRequestPush={() => requestAction({ type: 'push' })}
            onRequestFetch={() => requestAction({ type: 'fetch' })}
            onRequestPull={() => requestAction({ type: 'pull' })}
            busy={actionLoading}
          />
          <StashPanel
            stashes={stashes}
            onRequestStashSave={(message) => requestAction({ type: 'stashSave', message })}
            onRequestStashPop={(index, stashMessage) => requestAction({ type: 'stashPop', index, stashMessage })}
            onRequestStashDrop={(index, stashMessage) => requestAction({ type: 'stashDrop', index, stashMessage })}
            busy={actionLoading}
          />
        </aside>

        <main className="flex-1">
          <CommitGraph commits={commits} highlightRefs={highlightRefs} />
        </main>
      </div>

      <CommandLog entry={lastCommand} />

      {pendingAction && (
        <CommandPreviewModal
          preview={buildCommandPreview(pendingAction)}
          loading={actionLoading}
          onConfirm={confirmPendingAction}
          onCancel={() => setPendingAction(null)}
        />
      )}

      {interactiveRebaseTarget && (
        <InteractiveRebasePanel
          repoPath={repoPath}
          ontoBranch={interactiveRebaseTarget}
          currentBranch={currentBranchName}
          onClose={() => setInteractiveRebaseTarget(null)}
          onExecuted={handleInteractiveRebaseExecuted}
        />
      )}

      {diffTarget && (
        <DiffViewerModal
          repoPath={repoPath}
          filePath={diffTarget.path}
          status={diffTarget.status}
          onClose={() => setDiffTarget(null)}
        />
      )}

      {conflictState?.inProgress && (
        <ConflictPanel
          conflictState={conflictState}
          busy={actionLoading}
          onResolveOurs={(file) => runConflictAction(() => window.gitedu.resolveConflictOurs(repoPath, file))}
          onResolveTheirs={(file) => runConflictAction(() => window.gitedu.resolveConflictTheirs(repoPath, file))}
          onMarkResolved={(file) => runConflictAction(() => window.gitedu.markConflictResolved(repoPath, file))}
          onContinue={handleContinueConflict}
          onAbort={handleAbortConflict}
        />
      )}
    </div>
  )
}

export default App
