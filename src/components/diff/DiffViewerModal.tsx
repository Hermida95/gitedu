import { useEffect, useState } from 'react'
import type { FileStatusCode } from '../../../shared/ipc-contract'
import { Modal } from '../Modal'

interface DiffViewerModalProps {
  repoPath: string
  filePath: string
  status: FileStatusCode
  onClose: () => void
}

function DiffLine({ line }: { line: string }) {
  let className = 'text-slate-400'
  if (line.startsWith('+') && !line.startsWith('+++')) className = 'text-emerald-400 bg-emerald-950/40'
  else if (line.startsWith('-') && !line.startsWith('---')) className = 'text-red-400 bg-red-950/40'
  else if (line.startsWith('@@')) className = 'text-sky-400'
  else if (line.startsWith('diff --git') || line.startsWith('index ')) className = 'text-slate-400'

  return <div className={`whitespace-pre px-2 ${className}`}>{line || ' '}</div>
}

export function DiffViewerModal({ repoPath, filePath, status, onClose }: DiffViewerModalProps) {
  const [diff, setDiff] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setDiff(null)
    setError(null)
    window.gitedu.getFileDiff(repoPath, filePath, status).then((result) => {
      if (cancelled) return
      if (result.success) setDiff(result.diff)
      else setError(result.error ?? 'No se pudo obtener el diff.')
    })
    return () => {
      cancelled = true
    }
  }, [repoPath, filePath, status])

  return (
    <Modal
      onClose={onClose}
      labelledBy="diff-viewer-title"
      className="flex max-h-[85vh] w-full max-w-3xl flex-col rounded-lg border border-slate-700 bg-slate-900 p-5 shadow-xl"
    >
      <div className="mb-3 flex items-center justify-between">
        <h2 id="diff-viewer-title" className="truncate font-mono text-sm font-bold text-slate-100" title={filePath}>
          {filePath}
        </h2>
        <button
          className="shrink-0 rounded border border-slate-700 px-3 py-1.5 text-xs hover:bg-slate-800"
          onClick={onClose}
        >
          Cerrar
        </button>
      </div>

      <div className="flex-1 overflow-auto rounded bg-black py-2 font-mono text-xs">
        {error && <p className="px-2 text-red-400">{error}</p>}
        {!error && diff === null && <p className="px-2 text-slate-400">Cargando diff...</p>}
        {!error && diff === '' && <p className="px-2 text-slate-400">Sin diferencias que mostrar.</p>}
        {!error && diff && diff.split('\n').map((line, i) => <DiffLine key={i} line={line} />)}
      </div>
    </Modal>
  )
}
