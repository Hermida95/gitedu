import { useEffect, useState } from 'react'
import type { GitActionResult, RebaseCommitInfo, RebaseStep, RebaseStepAction } from '../../../shared/ipc-contract'

interface StepRow {
  hash: string
  shortHash: string
  originalMessage: string
  action: RebaseStepAction
  message: string
}

interface InteractiveRebasePanelProps {
  repoPath: string
  ontoBranch: string
  currentBranch: string | null
  onClose: () => void
  onExecuted: (result: GitActionResult) => void
}

const ACTION_LABELS: Record<RebaseStepAction, string> = {
  pick: 'Pick (mantener)',
  reword: 'Reword (cambiar mensaje)',
  squash: 'Squash (fusionar con el anterior)',
  drop: 'Drop (descartar)',
}

function buildTodoPreview(rows: StepRow[]): string {
  const lines: string[] = []
  rows.forEach((row) => {
    if (row.action === 'drop') {
      lines.push(`drop ${row.shortHash}  ${row.originalMessage}`)
      return
    }
    if (row.action === 'squash') {
      lines.push(`fixup ${row.shortHash}  ${row.originalMessage}`)
      return
    }
    lines.push(`pick ${row.shortHash}  ${row.originalMessage}`)
    if (row.action === 'reword') {
      lines.push(`exec git commit --amend -m "${row.message.replace(/"/g, '\\"')}"`)
    }
  })
  return lines.join('\n')
}

export function InteractiveRebasePanel({
  repoPath,
  ontoBranch,
  currentBranch,
  onClose,
  onExecuted,
}: InteractiveRebasePanelProps) {
  const [rows, setRows] = useState<StepRow[] | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [executing, setExecuting] = useState(false)

  useEffect(() => {
    let cancelled = false
    window.gitedu.getRebaseCommits(repoPath, ontoBranch).then((result) => {
      if (cancelled) return
      if (result.success) {
        setRows(
          result.commits.map((c: RebaseCommitInfo) => ({
            hash: c.hash,
            shortHash: c.shortHash,
            originalMessage: c.message,
            action: 'pick',
            message: c.message,
          }))
        )
      } else {
        setLoadError(result.error ?? 'No se pudieron obtener los commits.')
      }
    })
    return () => {
      cancelled = true
    }
  }, [repoPath, ontoBranch])

  function updateRow(index: number, patch: Partial<StepRow>) {
    setRows((prev) => (prev ? prev.map((r, i) => (i === index ? { ...r, ...patch } : r)) : prev))
  }

  function moveRow(index: number, direction: -1 | 1) {
    setRows((prev) => {
      if (!prev) return prev
      const target = index + direction
      if (target < 0 || target >= prev.length) return prev
      const next = [...prev]
      ;[next[index], next[target]] = [next[target], next[index]]
      return next
    })
  }

  async function handleExecute() {
    if (!rows) return
    setExecuting(true)
    const steps: RebaseStep[] = rows.map((r) => ({
      hash: r.hash,
      action: r.action,
      message: r.action === 'reword' ? r.message : undefined,
    }))
    const result = await window.gitedu.runInteractiveRebase(repoPath, ontoBranch, steps)
    setExecuting(false)
    onExecuted(result)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="flex max-h-[85vh] w-full max-w-2xl flex-col rounded-lg border border-slate-700 bg-slate-900 p-5 shadow-xl">
        <h2 className="text-base font-bold text-slate-100">Rebase interactivo</h2>
        <p className="mt-1 text-sm text-slate-400">
          Commits de{' '}
          <span className="font-mono text-emerald-400">{currentBranch ?? 'la rama actual'}</span> que no están
          en <span className="font-mono text-emerald-400">{ontoBranch}</span>, del más antiguo al más
          reciente (el mismo orden que usa <code className="font-mono">git rebase -i</code>).
        </p>

        {loadError && <p className="mt-3 text-sm text-red-400">{loadError}</p>}

        {rows && (
          <div className="mt-3 flex-1 space-y-2 overflow-y-auto">
            {rows.map((row, index) => (
              <div key={row.hash} className="rounded border border-slate-700 bg-slate-950 p-2">
                <div className="flex items-center gap-2">
                  <div className="flex flex-col">
                    <button
                      className="text-slate-500 hover:text-slate-200 disabled:opacity-30"
                      disabled={index === 0}
                      onClick={() => moveRow(index, -1)}
                      title="Mover arriba"
                    >
                      ▲
                    </button>
                    <button
                      className="text-slate-500 hover:text-slate-200 disabled:opacity-30"
                      disabled={index === rows.length - 1}
                      onClick={() => moveRow(index, 1)}
                      title="Mover abajo"
                    >
                      ▼
                    </button>
                  </div>

                  <span className="shrink-0 font-mono text-xs text-emerald-400">{row.shortHash}</span>

                  <select
                    className="shrink-0 rounded border border-slate-700 bg-slate-900 px-1 py-1 text-xs outline-none focus:border-emerald-500"
                    value={row.action}
                    onChange={(e) => updateRow(index, { action: e.target.value as RebaseStepAction })}
                  >
                    {(Object.keys(ACTION_LABELS) as RebaseStepAction[])
                      .filter((action) => action !== 'squash' || index > 0)
                      .map((action) => (
                        <option key={action} value={action}>
                          {ACTION_LABELS[action]}
                        </option>
                      ))}
                  </select>

                  <span className="truncate text-xs text-slate-300" title={row.originalMessage}>
                    {row.originalMessage}
                  </span>
                </div>

                {row.action === 'reword' && (
                  <input
                    className="mt-2 w-full rounded border border-slate-700 bg-slate-900 px-2 py-1 font-mono text-xs outline-none focus:border-emerald-500"
                    value={row.message}
                    onChange={(e) => updateRow(index, { message: e.target.value })}
                  />
                )}
              </div>
            ))}
            {rows.length === 0 && (
              <p className="text-sm text-slate-500">No hay commits que rebasar: las ramas ya coinciden.</p>
            )}
          </div>
        )}

        {rows && rows.length > 0 && (
          <div className="mt-3">
            <p className="mb-1 text-xs uppercase tracking-wide text-slate-500">
              Vista previa de la secuencia que se ejecutará
            </p>
            <pre className="max-h-32 overflow-auto rounded bg-black p-2 text-[11px] text-emerald-400">
              {buildTodoPreview(rows)}
            </pre>
          </div>
        )}

        <div className="mt-4 flex justify-end gap-2">
          <button
            className="rounded border border-slate-700 px-4 py-2 text-sm hover:bg-slate-800 disabled:opacity-50"
            onClick={onClose}
            disabled={executing}
          >
            Cancelar
          </button>
          <button
            className="rounded bg-amber-600 px-4 py-2 text-sm hover:bg-amber-500 disabled:opacity-50"
            onClick={handleExecute}
            disabled={executing || !rows || rows.length === 0}
          >
            {executing ? 'Ejecutando...' : 'Ejecutar rebase interactivo'}
          </button>
        </div>
      </div>
    </div>
  )
}
