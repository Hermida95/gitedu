import { useState } from 'react'
import type { FileStatus, RepoStatus } from '../../../shared/ipc-contract'

interface StatusPanelProps {
  status: RepoStatus | null
  onStage: (filePath: string) => void
  onUnstage: (filePath: string) => void
  onViewDiff: (file: FileStatus) => void
  onRequestCommit: (message: string) => void
  busy: boolean
}

function FileRow({ file, onToggle, onViewDiff }: { file: FileStatus; onToggle: () => void; onViewDiff: () => void }) {
  return (
    <li className="flex items-center justify-between gap-2 rounded px-2 py-1 text-xs hover:bg-slate-800">
      <button
        className="min-w-0 flex-1 truncate text-left font-mono text-slate-300 hover:text-emerald-400 hover:underline"
        title={`${file.path} — ver diff`}
        onClick={onViewDiff}
      >
        {file.path}
      </button>
      <button
        className="shrink-0 rounded border border-slate-700 px-2 py-0.5 text-slate-300 hover:bg-slate-700"
        onClick={onToggle}
      >
        {file.status === 'staged' ? 'Unstage' : 'Stage'}
      </button>
    </li>
  )
}

export function StatusPanel({ status, onStage, onUnstage, onViewDiff, onRequestCommit, busy }: StatusPanelProps) {
  const [message, setMessage] = useState('')

  if (!status) {
    return <p className="p-3 text-sm text-slate-500">Carga un repositorio para ver su estado.</p>
  }

  const staged = status.files.filter((f) => f.status === 'staged')
  const unstaged = status.files.filter((f) => f.status === 'unstaged' || f.status === 'conflicted')
  const untracked = status.files.filter((f) => f.status === 'untracked')

  return (
    <div className="flex flex-col gap-3 p-3">
      <div className="text-sm">
        <span className="font-semibold text-emerald-400">{status.branch ?? 'HEAD desacoplado'}</span>
        {status.upstream && (
          <span className="ml-2 text-xs text-slate-500">
            {status.upstream}
            {status.ahead > 0 && ` · ${status.ahead} por subir`}
            {status.behind > 0 && ` · ${status.behind} por bajar`}
          </span>
        )}
      </div>

      <section>
        <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
          Staged ({staged.length})
        </h3>
        <ul className="space-y-0.5">
          {staged.map((f) => (
            <FileRow key={f.path} file={f} onToggle={() => onUnstage(f.path)} onViewDiff={() => onViewDiff(f)} />
          ))}
          {staged.length === 0 && <p className="px-2 text-xs text-slate-600">Nada preparado para commit.</p>}
        </ul>
      </section>

      <section>
        <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
          Sin stage ({unstaged.length + untracked.length})
        </h3>
        <ul className="space-y-0.5">
          {[...unstaged, ...untracked].map((f) => (
            <FileRow key={f.path} file={f} onToggle={() => onStage(f.path)} onViewDiff={() => onViewDiff(f)} />
          ))}
          {unstaged.length + untracked.length === 0 && (
            <p className="px-2 text-xs text-slate-600">Directorio de trabajo limpio.</p>
          )}
        </ul>
      </section>

      <section>
        <textarea
          className="w-full resize-none rounded border border-slate-700 bg-slate-900 p-2 font-mono text-xs outline-none focus:border-emerald-500"
          rows={3}
          placeholder="Mensaje de commit"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
        />
        <button
          className="mt-2 w-full rounded bg-emerald-600 px-3 py-2 text-sm hover:bg-emerald-500 disabled:opacity-50"
          disabled={busy || !message.trim() || staged.length === 0}
          onClick={() => onRequestCommit(message.trim())}
        >
          Commit ({staged.length} fichero{staged.length === 1 ? '' : 's'})
        </button>
      </section>
    </div>
  )
}
