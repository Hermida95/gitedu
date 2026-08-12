import { useState } from 'react'
import type { BranchInfo } from '../../../shared/ipc-contract'

interface BranchPanelProps {
  branches: BranchInfo[]
  onCheckout: (name: string) => void
  onCreateBranch: (name: string) => void
  onRequestMerge: (branchName: string) => void
  onRequestRebase: (ontoBranch: string) => void
  onOpenInteractiveRebase: (ontoBranch: string) => void
  onRequestPush: () => void
  busy: boolean
}

export function BranchPanel({
  branches,
  onCheckout,
  onCreateBranch,
  onRequestMerge,
  onRequestRebase,
  onOpenInteractiveRebase,
  onRequestPush,
  busy,
}: BranchPanelProps) {
  const [newBranchName, setNewBranchName] = useState('')
  const [selectedBranch, setSelectedBranch] = useState('')

  const currentBranch = branches.find((b) => b.isCurrent)
  const otherBranches = branches.filter((b) => !b.isCurrent)

  return (
    <div className="flex flex-col gap-3 border-t border-slate-800 p-3">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Ramas</h3>

      <ul className="max-h-40 space-y-0.5 overflow-auto">
        {branches.map((branch) => (
          <li
            key={branch.name}
            className={`flex items-center justify-between rounded px-2 py-1 text-xs ${
              branch.isCurrent ? 'bg-emerald-900/40 text-emerald-300' : 'text-slate-300'
            }`}
          >
            <span className="truncate font-mono" title={branch.name}>
              {branch.name}
              {branch.isRemote && <span className="ml-1 text-slate-500">(remota)</span>}
            </span>
            {!branch.isCurrent && !branch.isRemote && (
              <button
                className="shrink-0 rounded border border-slate-700 px-2 py-0.5 hover:bg-slate-700"
                onClick={() => onCheckout(branch.name)}
                disabled={busy}
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
        />
        <button
          className="shrink-0 rounded border border-slate-700 px-2 py-1 text-xs hover:bg-slate-800 disabled:opacity-50"
          disabled={busy || !newBranchName.trim()}
          onClick={() => {
            onCreateBranch(newBranchName.trim())
            setNewBranchName('')
          }}
        >
          Crear
        </button>
      </div>

      <div className="flex flex-col gap-2">
        <select
          className="rounded border border-slate-700 bg-slate-900 px-2 py-1 font-mono text-xs outline-none focus:border-emerald-500"
          value={selectedBranch}
          onChange={(e) => setSelectedBranch(e.target.value)}
        >
          <option value="">Selecciona una rama...</option>
          {otherBranches.map((b) => (
            <option key={b.name} value={b.name}>
              {b.name}
            </option>
          ))}
        </select>

        <div className="flex gap-2">
          <button
            className="flex-1 rounded border border-slate-700 px-2 py-1 text-xs hover:bg-slate-800 disabled:opacity-50"
            disabled={busy || !selectedBranch}
            onClick={() => onRequestMerge(selectedBranch)}
          >
            Merge en {currentBranch?.name ?? 'actual'}
          </button>
          <button
            className="flex-1 rounded border border-slate-700 px-2 py-1 text-xs hover:bg-slate-800 disabled:opacity-50"
            disabled={busy || !selectedBranch}
            onClick={() => onRequestRebase(selectedBranch)}
          >
            Rebase sobre
          </button>
        </div>

        <button
          className="rounded border border-slate-700 px-2 py-1 text-xs hover:bg-slate-800 disabled:opacity-50"
          disabled={busy || !selectedBranch}
          onClick={() => onOpenInteractiveRebase(selectedBranch)}
        >
          Rebase interactivo sobre...
        </button>
      </div>

      <button
        className="rounded bg-amber-600 px-3 py-2 text-sm hover:bg-amber-500 disabled:opacity-50"
        disabled={busy}
        onClick={onRequestPush}
      >
        Push
      </button>
    </div>
  )
}
