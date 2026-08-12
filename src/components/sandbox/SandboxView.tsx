import { useState } from 'react'
import { CommitGraph } from '../graph/CommitGraph'
import { CommandPreviewModal } from '../command-preview/CommandPreviewModal'
import { buildCommandPreview, type GitAction } from '../../lib/gitCommandPreview'
import {
  checkout,
  commitChange,
  createBranch,
  createInitialState,
  editFile,
  fetch as simFetch,
  merge,
  pull,
  push,
  rebase,
  simStateToCommits,
  simulateTeammateCommit,
  stageChange,
  unstageChange,
  type SimState,
} from '../../lib/gitSimulator'

function applyAction(state: SimState, action: GitAction): SimState {
  switch (action.type) {
    case 'commit':
      return commitChange(state, action.message)
    case 'createBranch':
      return createBranch(state, action.name)
    case 'checkoutBranch':
      return checkout(state, action.name)
    case 'mergeBranch':
      return merge(state, action.branchName)
    case 'rebaseBranch':
      return rebase(state, action.ontoBranch)
    case 'push':
      return push(state)
    case 'fetch':
      return simFetch(state)
    case 'pull':
      return pull(state)
    default:
      return state
  }
}

export function SandboxView() {
  const [state, setState] = useState<SimState>(createInitialState)
  const [pendingAction, setPendingAction] = useState<GitAction | null>(null)
  const [newBranchName, setNewBranchName] = useState('')
  const [selectedBranch, setSelectedBranch] = useState('')
  const [commitMessage, setCommitMessage] = useState('')

  const branchNames = Object.keys(state.branches)
  const otherBranches = branchNames.filter((b) => b !== state.currentBranch)
  const currentTip = state.branches[state.currentBranch]
  const localOrigin = state.localOriginRefs[state.currentBranch]

  const highlightRefs =
    pendingAction?.type === 'mergeBranch'
      ? [state.currentBranch, pendingAction.branchName]
      : pendingAction?.type === 'rebaseBranch'
        ? [state.currentBranch, pendingAction.ontoBranch]
        : []

  function confirm() {
    if (!pendingAction) return
    setState((s) => applyAction(s, pendingAction))
    setPendingAction(null)
    if (pendingAction.type === 'commit') setCommitMessage('')
  }

  return (
    <div className="flex flex-1 overflow-hidden">
      <aside className="w-72 shrink-0 overflow-y-auto border-r border-slate-800">
        <div className="border-b border-amber-900/40 bg-amber-950/20 p-3 text-xs text-amber-300">
          Modo aprendizaje: nada de esto toca ficheros ni repositorios reales. Es un repo de mentira, en
          memoria, solo para practicar.
        </div>

        <div className="flex flex-col gap-3 p-3">
          <div className="text-sm">
            <span className="font-semibold text-emerald-400">{state.currentBranch}</span>
            {!currentTip && <span className="ml-2 text-xs text-slate-400">(sin commits todavía)</span>}
          </div>

          <section>
            <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">Cambios</h3>
            <button
              className="w-full rounded border border-slate-700 px-2 py-1 text-xs hover:bg-slate-800 disabled:opacity-50"
              disabled={state.hasPendingChange}
              onClick={() => setState(editFile)}
            >
              Simular un cambio en un fichero
            </button>

            {state.hasPendingChange && !state.staged && (
              <button
                className="mt-2 w-full rounded border border-slate-700 px-2 py-1 text-xs hover:bg-slate-800"
                onClick={() => setState(stageChange)}
              >
                Stage
              </button>
            )}
            {state.staged && (
              <button
                className="mt-2 w-full rounded border border-slate-700 px-2 py-1 text-xs hover:bg-slate-800"
                onClick={() => setState(unstageChange)}
              >
                Unstage
              </button>
            )}

            <textarea
              className="mt-2 w-full resize-none rounded border border-slate-700 bg-slate-900 p-2 font-mono text-xs outline-none focus:border-emerald-500"
              rows={2}
              placeholder="Mensaje de commit"
              value={commitMessage}
              onChange={(e) => setCommitMessage(e.target.value)}
            />
            <button
              className="mt-2 w-full rounded bg-emerald-700 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-600 disabled:opacity-50"
              disabled={!state.staged || !commitMessage.trim()}
              onClick={() => setPendingAction({ type: 'commit', message: commitMessage.trim() })}
            >
              Commit
            </button>
            {!state.staged && (
              <p className="mt-1 text-xs text-slate-400">
                {state.hasPendingChange ? '👆 Pulsa Stage primero.' : 'Simula un cambio primero.'}
              </p>
            )}
          </section>

          <section className="border-t border-slate-800 pt-3">
            <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">Ramas</h3>
            <ul className="mb-2 max-h-28 space-y-0.5 overflow-auto">
              {branchNames.map((b) => (
                <li
                  key={b}
                  className={`flex items-center justify-between rounded px-2 py-1 text-xs ${
                    b === state.currentBranch ? 'bg-emerald-900/40 text-emerald-300' : 'text-slate-300'
                  }`}
                >
                  <span className="font-mono">{b}</span>
                  {b !== state.currentBranch && (
                    <button
                      className="rounded border border-slate-700 px-2 py-1 hover:bg-slate-700"
                      onClick={() => setPendingAction({ type: 'checkoutBranch', name: b })}
                    >
                      Checkout
                    </button>
                  )}
                </li>
              ))}
            </ul>

            <div className="flex gap-2">
              <input
                className="flex-1 rounded border border-slate-700 bg-slate-900 px-2 py-1 font-mono text-xs outline-none focus:border-emerald-500"
                placeholder="nueva-rama"
                value={newBranchName}
                onChange={(e) => setNewBranchName(e.target.value)}
                disabled={!currentTip}
              />
              <button
                className="shrink-0 rounded border border-slate-700 px-2 py-1 text-xs hover:bg-slate-800 disabled:opacity-50"
                disabled={!currentTip || !newBranchName.trim() || newBranchName.trim() in state.branches}
                onClick={() => {
                  setPendingAction({ type: 'createBranch', name: newBranchName.trim() })
                  setNewBranchName('')
                }}
              >
                Crear
              </button>
            </div>

            <select
              className="mt-2 w-full rounded border border-slate-700 bg-slate-900 px-2 py-1 font-mono text-xs outline-none focus:border-emerald-500"
              value={selectedBranch}
              onChange={(e) => setSelectedBranch(e.target.value)}
            >
              <option value="">Selecciona una rama...</option>
              {otherBranches.map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </select>
            <div className="mt-2 flex gap-2">
              <button
                className="flex-1 rounded border border-slate-700 px-2 py-1 text-xs hover:bg-slate-800 disabled:opacity-50"
                disabled={!selectedBranch}
                onClick={() =>
                  setPendingAction({ type: 'mergeBranch', branchName: selectedBranch, currentBranch: state.currentBranch })
                }
              >
                Merge en {state.currentBranch}
              </button>
              <button
                className="flex-1 rounded border border-slate-700 px-2 py-1 text-xs hover:bg-slate-800 disabled:opacity-50"
                disabled={!selectedBranch}
                onClick={() =>
                  setPendingAction({ type: 'rebaseBranch', ontoBranch: selectedBranch, currentBranch: state.currentBranch })
                }
              >
                Rebase sobre
              </button>
            </div>
          </section>

          <section className="border-t border-slate-800 pt-3">
            <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">
              Remoto (simulado)
            </h3>
            <p className="mb-2 text-xs text-slate-400">
              {localOrigin === currentTip
                ? 'Tu rama y origin están al día.'
                : localOrigin
                  ? 'Hay diferencias con origin.'
                  : 'Todavía no has hecho push.'}
            </p>
            <div className="flex gap-2">
              <button
                className="flex-1 rounded border border-slate-700 px-2 py-1 text-xs hover:bg-slate-800 disabled:opacity-50"
                disabled={!currentTip}
                onClick={() => setPendingAction({ type: 'fetch' })}
              >
                Fetch
              </button>
              <button
                className="flex-1 rounded border border-slate-700 px-2 py-1 text-xs hover:bg-slate-800 disabled:opacity-50"
                disabled={!currentTip}
                onClick={() => setPendingAction({ type: 'pull' })}
              >
                Pull
              </button>
            </div>
            <button
              className="mt-2 w-full rounded bg-amber-700 px-3 py-2 text-sm font-semibold text-white hover:bg-amber-600 disabled:opacity-50"
              disabled={!currentTip}
              onClick={() => setPendingAction({ type: 'push' })}
            >
              Push
            </button>
            <button
              className="mt-2 w-full rounded border border-slate-700 px-2 py-1 text-xs hover:bg-slate-800 disabled:opacity-50"
              disabled={!currentTip}
              onClick={() => setState(simulateTeammateCommit)}
              title="Simula que otra persona subió un commit sin que tú lo sepas todavía"
            >
              Simular cambio de un compañero
            </button>
          </section>

          <button
            className="mt-2 rounded border border-red-900 px-2 py-1 text-xs text-red-300 hover:bg-red-950"
            onClick={() => setState(createInitialState())}
          >
            Reiniciar sandbox
          </button>
        </div>
      </aside>

      <main className="flex-1">
        <CommitGraph commits={simStateToCommits(state)} highlightRefs={highlightRefs} />
      </main>

      {pendingAction && (
        <CommandPreviewModal
          preview={buildCommandPreview(pendingAction)}
          loading={false}
          onConfirm={confirm}
          onCancel={() => setPendingAction(null)}
        />
      )}
    </div>
  )
}
