export interface LastCommand {
  command: string
  success: boolean
  error?: string
}

export function CommandLog({ entry }: { entry: LastCommand | null }) {
  if (!entry) return null

  return (
    <footer
      className={`border-t px-4 py-2 font-mono text-xs ${
        entry.success ? 'border-slate-800 bg-slate-900 text-slate-400' : 'border-red-900 bg-red-950/60 text-red-300'
      }`}
    >
      <span className="text-slate-500">$</span> {entry.command}
      {!entry.success && entry.error && <span className="ml-2 text-red-400">→ {entry.error}</span>}
    </footer>
  )
}
