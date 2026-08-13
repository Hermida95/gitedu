// Componente raíz: orquesta todo el estado de nivel de aplicación (repo
// activo, grafo, status, ramas, stashes, conflictos, la acción pendiente de
// confirmación) y compone los paneles/modales que operan sobre él. Los
// componentes hijos son en su mayoría "tontos" — reciben datos y callbacks,
// y toda la lógica de qué llamar y cuándo refrescar vive aquí.
import { lazy, Suspense, useEffect, useState } from 'react'
import type {
  BranchInfo,
  Commit,
  ConflictState,
  FileStatus,
  GitActionResult,
  RepoStatus,
  StashInfo,
} from '../shared/ipc-contract'
import { StatusPanel } from './components/sidebar/StatusPanel'
import { BranchPanel } from './components/sidebar/BranchPanel'
import { StashPanel } from './components/sidebar/StashPanel'
import { CommandPreviewModal } from './components/command-preview/CommandPreviewModal'
import { ConflictPanel } from './components/conflict/ConflictPanel'
import { DiffViewerModal } from './components/diff/DiffViewerModal'
import { CommandLog, type LastCommand } from './components/CommandLog'
import { buildCommandPreview, type GitAction } from './lib/gitCommandPreview'
import { addRecentRepo, getRecentRepos, removeRecentRepo } from './lib/recentRepos'

// React Flow + dagre (via CommitGraph) is the single biggest chunk in the app,
// and SandboxView pulls in the whole simulator + lesson track. Neither is
// needed for the very first paint, so they're split out instead of bloating
// the initial bundle every user downloads regardless of whether they ever
// open a graph or the learning mode.
const CommitGraph = lazy(() => import('./components/graph/CommitGraph').then((m) => ({ default: m.CommitGraph })))
const InteractiveRebasePanel = lazy(() =>
  import('./components/rebase/InteractiveRebasePanel').then((m) => ({ default: m.InteractiveRebasePanel }))
)
const SandboxView = lazy(() => import('./components/sandbox/SandboxView').then((m) => ({ default: m.SandboxView })))

const GRAPH_LOADING_FALLBACK = (
  <div className="flex h-full items-center justify-center text-sm text-slate-400">Cargando grafo...</div>
)

const isRemoteUrl = (value: string): boolean => /^(https?:\/\/|git@)/i.test(value.trim())

function App() {
  // Modo real (repo en disco, vía IPC) vs. sandbox (motor en memoria, ver
  // gitSimulator.ts) — mutuamente excluyentes, cada uno con su propia rama del JSX abajo.
  const [mode, setMode] = useState<'real' | 'sandbox'>('real')

  // Identidad y carga del repo activo. `repoPath` es el texto del input
  // (puede ser una ruta o una URL sin cargar todavía); `activeRepoPath` es el
  // último repo que se cargó con éxito y es el que vigila el watcher.
  const [repoPath, setRepoPath] = useState('')
  const [recentRepos, setRecentRepos] = useState<string[]>(getRecentRepos)
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

  // Ciclo de vida de una acción con confirmación (ver confirmPendingAction):
  // pendingAction llena el CommandPreviewModal; al confirmarse, lastCommand
  // alimenta el CommandLog. resetToken se incrementa tras cada acción exitosa
  // y se pasa como `key` a StatusPanel para forzar su remonte — así se
  // descarta cualquier borrador de mensaje de commit o selección de fichero
  // que ya no tiene sentido una vez que el estado del repo cambió.
  const [pendingAction, setPendingAction] = useState<GitAction | null>(null)
  const [actionLoading, setActionLoading] = useState(false)
  const [lastCommand, setLastCommand] = useState<LastCommand | null>(null)
  const [resetToken, setResetToken] = useState(0)

  // Paneles modales que se abren aparte del flujo de confirmación estándar.
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
      setRecentRepos(addRecentRepo(path))
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

  function openRecent(path: string) {
    setRepoPath(path)
    refreshRepo(path)
  }

  function forgetRecent(path: string) {
    setRecentRepos(removeRecentRepo(path))
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
      case 'initRepo':
        result = await window.gitedu.initRepo(pendingAction.folderPath)
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

  // Mientras se confirma un merge/rebase, resalta en el grafo las dos ramas
  // implicadas (origen y destino) para que se vea de un vistazo qué va a combinarse.
  const highlightRefs =
    pendingAction?.type === 'mergeBranch'
      ? [pendingAction.currentBranch, pendingAction.branchName].filter((r): r is string => !!r)
      : pendingAction?.type === 'rebaseBranch'
        ? [pendingAction.currentBranch, pendingAction.ontoBranch].filter((r): r is string => !!r)
        : []

  return (
    <div className="flex h-screen flex-col bg-slate-950 text-slate-100">
      <header className="border-b border-slate-800 p-4">
        <div className="mb-3 flex items-center gap-3">
          <h1 className="text-lg font-bold">GitEdu</h1>

          <div className="flex rounded border border-slate-700 text-xs">
            <button
              className={`px-3 py-1 ${mode === 'real' ? 'bg-emerald-700 text-white' : 'text-slate-400 hover:bg-slate-800'}`}
              onClick={() => setMode('real')}
            >
              Repositorio real
            </button>
            <button
              className={`px-3 py-1 ${mode === 'sandbox' ? 'bg-amber-700 text-white' : 'text-slate-400 hover:bg-slate-800'}`}
              onClick={() => setMode('sandbox')}
            >
              Modo aprendizaje
            </button>
          </div>

          {mode === 'real' && watching && (
            <span
              className="flex items-center gap-1 rounded-full bg-emerald-900/40 px-2 py-0.5 text-[10px] text-emerald-300"
              title="GitEdu está vigilando este repositorio: si cambias algo desde la terminal, se recargará solo."
            >
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" /> en vivo
            </span>
          )}
        </div>

        {mode === 'real' && (
          <>
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
                className="rounded bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-600 disabled:opacity-50"
                onClick={() => loadOrClone(repoPath)}
                disabled={loading || !repoPath}
              >
                {loading ? 'Cargando...' : isRemoteUrl(repoPath) ? 'Clonar y cargar' : 'Cargar grafo'}
              </button>
            </div>

            {recentRepos.length > 0 && (
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                <span className="text-xs text-slate-400">Recientes:</span>
                {recentRepos.map((path) => (
                  <div
                    key={path}
                    className="group flex items-center gap-1 rounded border border-slate-700 py-1 pl-2 pr-1 hover:border-emerald-600"
                  >
                    <button
                      className="max-w-[14rem] truncate font-mono text-xs text-slate-300 hover:text-emerald-300 disabled:opacity-50"
                      onClick={() => openRecent(path)}
                      disabled={loading}
                      title={path}
                    >
                      {path.split('/').pop() || path}
                    </button>
                    <button
                      className="rounded px-1 text-slate-500 opacity-0 hover:text-red-400 group-hover:opacity-100 group-focus-within:opacity-100"
                      onClick={() => forgetRecent(path)}
                      disabled={loading}
                      aria-label={`Quitar ${path} de recientes`}
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}

            {isRemoteUrl(repoPath) && !loading && (
              <p className="mt-2 text-xs text-slate-400">
                Se clonará en <code className="font-mono">~/GitEdu-Repos/</code> y luego se cargará desde ahí.
              </p>
            )}

            {error && (
              <div className="mt-2 flex items-center gap-3">
                <p className="text-sm text-red-400">{error}</p>
                {!isRemoteUrl(repoPath) && repoPath && (
                  <button
                    className="shrink-0 rounded border border-slate-700 px-2 py-1 text-xs hover:bg-slate-800"
                    onClick={() => requestAction({ type: 'initRepo', folderPath: repoPath })}
                  >
                    Inicializar repositorio Git aquí
                  </button>
                )}
              </div>
            )}

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
          </>
        )}

        {mode === 'sandbox' && (
          <p className="text-sm text-slate-400">
            Practica commits, ramas, merge, rebase, fetch y pull sobre un repositorio de mentira — sin clonar
            ni tocar nada real.
          </p>
        )}
      </header>

      {mode === 'sandbox' ? (
        <Suspense
          fallback={
            <div className="flex flex-1 items-center justify-center text-sm text-slate-400">
              Cargando modo aprendizaje...
            </div>
          }
        >
          <SandboxView />
        </Suspense>
      ) : (
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
            <Suspense fallback={GRAPH_LOADING_FALLBACK}>
              <CommitGraph commits={commits} highlightRefs={highlightRefs} />
            </Suspense>
          </main>
        </div>
      )}

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
        <Suspense fallback={null}>
          <InteractiveRebasePanel
            repoPath={repoPath}
            ontoBranch={interactiveRebaseTarget}
            currentBranch={currentBranchName}
            onClose={() => setInteractiveRebaseTarget(null)}
            onExecuted={handleInteractiveRebaseExecuted}
          />
        </Suspense>
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
