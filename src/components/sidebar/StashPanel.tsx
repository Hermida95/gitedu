import { useState } from 'react'
import type { StashInfo } from '../../../shared/ipc-contract'

interface StashPanelProps {
  stashes: StashInfo[]
  onRequestStashSave: (message: string) => void
  onRequestStashPop: (index: number, message: string) => void
  onRequestStashDrop: (index: number, message: string) => void
  busy: boolean
}

export function StashPanel({
  stashes,
  onRequestStashSave,
  onRequestStashPop,
  onRequestStashDrop,
  busy,
}: StashPanelProps) {
  const [message, setMessage] = useState('')

  return (
    <div className="flex flex-col gap-2 border-t border-slate-800 p-3">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400">Stash ({stashes.length})</h3>

      <ul className="max-h-32 space-y-1 overflow-auto">
        {stashes.map((s) => (
          <li key={s.index} className="rounded border border-slate-700 bg-slate-950 p-1.5 text-xs">
            <p className="truncate text-slate-300" title={s.message}>
              {s.message}
            </p>
            <div className="mt-1 flex gap-1">
              <button
                className="flex-1 rounded border border-slate-700 px-1.5 py-1 hover:bg-slate-700 disabled:opacity-50"
                disabled={busy}
                onClick={() => onRequestStashPop(s.index, s.message)}
              >
                Recuperar
              </button>
              <button
                className="flex-1 rounded border border-red-900 text-red-300 px-1.5 py-1 hover:bg-red-950 disabled:opacity-50"
                disabled={busy}
                onClick={() => onRequestStashDrop(s.index, s.message)}
              >
                Eliminar
              </button>
            </div>
          </li>
        ))}
        {stashes.length === 0 && <p className="px-1 text-xs text-slate-400">No hay stashes guardados.</p>}
      </ul>

      <div className="flex gap-2">
        <input
          className="flex-1 rounded border border-slate-700 bg-slate-900 px-2 py-1 font-mono text-xs outline-none focus:border-emerald-500"
          placeholder="mensaje (opcional)"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
        />
        <button
          className="shrink-0 rounded border border-slate-700 px-2 py-1 text-xs hover:bg-slate-800 disabled:opacity-50"
          disabled={busy}
          onClick={() => {
            onRequestStashSave(message.trim())
            setMessage('')
          }}
        >
          Guardar
        </button>
      </div>
    </div>
  )
}
