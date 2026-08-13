// Barra fija al pie de la app: muestra el último comando git ejecutado (y su
// error, si falló). Es la mitad "después" del par didáctico con
// CommandPreviewModal (el "antes") — juntos cierran el círculo de "aquí está
// lo que se va a ejecutar" / "esto es lo que realmente pasó".
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
      <span className="text-slate-400">$</span> {entry.command}
      {!entry.success && entry.error && <span className="ml-2 text-red-400">→ {entry.error}</span>}
    </footer>
  )
}
