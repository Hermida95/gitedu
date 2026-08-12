import { useState } from 'react'
import type { BranchInfo, Commit, ConflictState, GitActionResult, RepoStatus } from '../shared/ipc-contract'
import { CommitGraph } from './components/graph/CommitGraph'
import { StatusPanel } from './components/sidebar/StatusPanel'
import { BranchPanel } from './components/sidebar/BranchPanel'
import { CommandPreviewModal } from './components/command-preview/CommandPreviewModal'
import { ConflictPanel } from './components/conflict/ConflictPanel'
import { InteractiveRebasePanel } from './components/rebase/InteractiveRebasePanel'
import { CommandLog, type LastCommand } from './components/CommandLog'
import { buildCommandPreview, type GitAction } from './lib/gitCommandPreview'

function App() {
  const [repoPath, setRepoPath] = useState('')
  const [commits, setCommits] = useState<Commit[]>([])
  const [rawOutput, setRawOutput] = useState('')
  const [showRaw, setShowRaw] = useState(false)
  const [status, setStatus] = useState<RepoStatus | null>(null)
  const [branches, setBranches] = useState<BranchInfo[]>([])
  const [conflictState, setConflictState] = useState<ConflictState | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const [pendingAction, setPendingAction] = useState<GitAction | null>(null)
  const [actionLoading, setActionLoading] = useState(false)
  const [lastCommand, setLastCommand] = useState<LastCommand | null>(null)
  const [resetToken, setResetToken] = useState(0)

  const [interactiveRebaseTarget, setInteractiveRebaseTarget] = useState<string | null>(null)

  async function refreshRepo(path: string) {
    if (!path) return
    setLoading(true)
    setError(null)

    const [graphData, logResult, statusResult, branchResult, conflictResult] = await Promise.all([
      window.gitedu.getCommitGraphData(path),
      window.gitedu.getCommitGraph(path),
      window.gitedu.getRepoStatus(path),
      window.gitedu.listBranches(path),
      window.gitedu.getConflictState(path),
    ])

    if (graphData.success) {
      setCommits(graphData.commits)
      setRawOutput(logResult.output)
    } else {
      setError(graphData.error ?? 'Error desconocido')
      setCommits([])
      setRawOutput('')
    }
    setStatus(statusResult.success ? statusResult : null)
    setBranches(branchResult.success ? branchResult.branches : [])
    setConflictState(conflictResult)
    setLoading(false)
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
        <h1 className="mb-3 text-lg font-bold">GitEdu</h1>

        <div className="flex gap-2">
          <input
            className="flex-1 rounded border border-slate-700 bg-slate-900 px-3 py-2 font-mono text-sm outline-none focus:border-emerald-500"
            placeholder="/ruta/al/repositorio"
            value={repoPath}
            onChange={(e) => setRepoPath(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && refreshRepo(repoPath)}
          />
          <button
            className="rounded border border-slate-700 px-4 py-2 text-sm hover:bg-slate-800"
            onClick={handleBrowse}
          >
            Examinar...
          </button>
          <button
            className="rounded bg-emerald-600 px-4 py-2 text-sm hover:bg-emerald-500 disabled:opacity-50"
            onClick={() => refreshRepo(repoPath)}
            disabled={loading || !repoPath}
          >
            {loading ? 'Cargando...' : 'Cargar grafo'}
          </button>
        </div>

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
            onRequestCommit={(message) => requestAction({ type: 'commit', message })}
            busy={actionLoading}
          />
          <BranchPanel
            branches={branches}
            onCheckout={(name) => runImmediate(() => window.gitedu.checkoutBranch(repoPath, name))}
            onCreateBranch={(name) => runImmediate(() => window.gitedu.createBranch(repoPath, name))}
            onRequestMerge={(branchName) =>
              requestAction({ type: 'mergeBranch', branchName, currentBranch: currentBranchName })
            }
            onRequestRebase={(ontoBranch) =>
              requestAction({ type: 'rebaseBranch', ontoBranch, currentBranch: currentBranchName })
            }
            onOpenInteractiveRebase={(ontoBranch) => setInteractiveRebaseTarget(ontoBranch)}
            onRequestPush={() => requestAction({ type: 'push' })}
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
