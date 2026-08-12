import type { CommandPreview } from '../../lib/gitCommandPreview'
import { Modal } from '../Modal'

interface CommandPreviewModalProps {
  preview: CommandPreview
  loading: boolean
  onConfirm: () => void
  onCancel: () => void
}

export function CommandPreviewModal({ preview, loading, onConfirm, onCancel }: CommandPreviewModalProps) {
  return (
    <Modal
      onClose={loading ? undefined : onCancel}
      labelledBy="command-preview-title"
      className="w-full max-w-lg rounded-lg border border-slate-700 bg-slate-900 p-5 shadow-xl"
    >
      <h2 id="command-preview-title" className="text-base font-bold text-slate-100">
        {preview.title}
      </h2>

      <p className="mt-3 text-xs uppercase tracking-wide text-slate-400">Comando que se va a ejecutar</p>
      <pre className="mt-1 overflow-auto rounded bg-black px-3 py-2 font-mono text-sm text-emerald-400">
        $ {preview.command}
      </pre>

      <p className="mt-3 text-sm text-slate-300">{preview.description}</p>

      {preview.impact.length > 0 && (
        <ul className="mt-3 space-y-1 text-sm text-slate-400">
          {preview.impact.map((line) => (
            <li key={line} className="flex gap-2">
              <span className={preview.danger ? 'text-amber-400' : 'text-emerald-400'} aria-hidden="true">
                •
              </span>
              <span>{line}</span>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-5 flex justify-end gap-2">
        <button
          className="rounded border border-slate-700 px-4 py-2 text-sm hover:bg-slate-800 disabled:opacity-50"
          onClick={onCancel}
          disabled={loading}
        >
          Cancelar
        </button>
        <button
          className={`rounded px-4 py-2 text-sm font-semibold text-white disabled:opacity-50 ${
            preview.danger ? 'bg-amber-700 hover:bg-amber-600' : 'bg-emerald-700 hover:bg-emerald-600'
          }`}
          onClick={onConfirm}
          disabled={loading}
        >
          {loading ? 'Ejecutando...' : 'Confirmar y ejecutar'}
        </button>
      </div>
    </Modal>
  )
}
