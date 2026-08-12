import { Handle, Position, type NodeProps } from '@xyflow/react'

export interface CommitNodeData {
  shortHash: string
  message: string
  author: string
  date: string
  refs: string[]
  highlighted: boolean
  [key: string]: unknown
}

export function CommitNode({ data }: NodeProps) {
  const commit = data as CommitNodeData

  return (
    <div
      className={`w-[260px] rounded-lg border bg-slate-900 px-3 py-2 text-xs text-slate-100 shadow-md ${
        commit.highlighted ? 'border-amber-400 ring-2 ring-amber-400/50' : 'border-slate-700'
      }`}
    >
      <Handle type="target" position={Position.Top} className="!bg-emerald-500" />

      {/* El mensaje es lo que de verdad importa al escanear el historial, así que
          va primero y con más peso visual que el hash — antes competían por la
          atención en el orden contrario. */}
      <p className="truncate text-sm font-semibold text-slate-100" title={commit.message}>
        {commit.message}
      </p>

      <div className="mt-1.5 flex flex-wrap items-center gap-1">
        <span className="font-mono text-xs text-emerald-400">{commit.shortHash}</span>
        {commit.refs.map((ref) => (
          <span key={ref} className="rounded bg-emerald-900/60 px-1.5 py-0.5 text-[10px] text-emerald-300">
            {ref}
          </span>
        ))}
      </div>

      <p className="mt-1 truncate text-[10px] text-slate-400">
        {commit.author} · {new Date(commit.date).toLocaleString()}
      </p>

      <Handle type="source" position={Position.Bottom} className="!bg-emerald-500" />
    </div>
  )
}
