import type { ConflictState } from '../../../shared/ipc-contract'

interface ConflictPanelProps {
  conflictState: ConflictState
  busy: boolean
  onResolveOurs: (filePath: string) => void
  onResolveTheirs: (filePath: string) => void
  onMarkResolved: (filePath: string) => void
  onContinue: () => void
  onAbort: () => void
}

export function ConflictPanel({
  conflictState,
  busy,
  onResolveOurs,
  onResolveTheirs,
  onMarkResolved,
  onContinue,
  onAbort,
}: ConflictPanelProps) {
  const label = conflictState.inProgress === 'rebase' ? 'rebase' : 'merge'
  const allResolved = conflictState.conflictedFiles.length === 0

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="w-full max-w-xl rounded-lg border border-amber-700 bg-slate-900 p-5 shadow-xl">
        <h2 className="text-base font-bold text-amber-400">Conflicto durante el {label}</h2>
        <p className="mt-1 text-sm text-slate-300">
          Git ha pausado la operación porque los mismos cambios chocan en uno o más ficheros. Resuelve cada
          fichero y luego continúa (o aborta para volver al estado anterior).
        </p>

        {conflictState.conflictedFiles.length > 0 ? (
          <ul className="mt-4 space-y-2">
            {conflictState.conflictedFiles.map((file) => (
              <li key={file} className="rounded border border-slate-700 bg-slate-950 p-2">
                <p className="mb-2 truncate font-mono text-xs text-slate-200" title={file}>
                  {file}
                </p>
                <div className="flex flex-wrap gap-2">
                  <button
                    className="rounded border border-slate-700 px-2 py-1 text-xs hover:bg-slate-800 disabled:opacity-50"
                    disabled={busy}
                    onClick={() => onResolveOurs(file)}
                  >
                    Usar la mía (ours)
                  </button>
                  <button
                    className="rounded border border-slate-700 px-2 py-1 text-xs hover:bg-slate-800 disabled:opacity-50"
                    disabled={busy}
                    onClick={() => onResolveTheirs(file)}
                  >
                    Usar la entrante (theirs)
                  </button>
                  <button
                    className="rounded border border-slate-700 px-2 py-1 text-xs hover:bg-slate-800 disabled:opacity-50"
                    disabled={busy}
                    onClick={() => onMarkResolved(file)}
                    title="Usa esto si ya has editado el fichero a mano fuera de GitEdu"
                  >
                    Ya lo edité a mano: marcar resuelto
                  </button>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-4 text-sm text-emerald-400">
            Todos los ficheros están resueltos. Puedes continuar el {label}.
          </p>
        )}

        <p className="mt-4 text-xs text-slate-500">
          GitEdu no incluye un editor de diffs en 3 vías: "ours"/"theirs" toma un lado completo del fichero
          conflictivo. Para fusiones línea a línea más finas, edita el fichero con tu editor habitual y usa
          "marcar resuelto".
        </p>

        <div className="mt-5 flex justify-end gap-2">
          <button
            className="rounded border border-red-800 px-4 py-2 text-sm text-red-300 hover:bg-red-950 disabled:opacity-50"
            disabled={busy}
            onClick={onAbort}
          >
            Abortar {label}
          </button>
          <button
            className="rounded bg-emerald-600 px-4 py-2 text-sm hover:bg-emerald-500 disabled:opacity-50"
            disabled={busy || !allResolved}
            onClick={onContinue}
          >
            Continuar {label}
          </button>
        </div>
      </div>
    </div>
  )
}
