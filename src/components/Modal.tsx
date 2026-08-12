import { useEffect, useRef, type ReactNode } from 'react'

interface ModalProps {
  /** Si se pasa, Escape cierra el modal y se anuncia como cerrable. */
  onClose?: () => void
  /** id del elemento (normalmente el <h2> del título) que describe el modal para lectores de pantalla. */
  labelledBy: string
  /** Clases completas del contenedor visible (tamaño, padding...); cada modal tiene contenido distinto. */
  className: string
  children: ReactNode
}

const FOCUSABLE_SELECTOR =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

// Envoltorio compartido por todos los modales de la app: antes cada uno
// reimplementaba su propio backdrop y ninguno gestionaba el foco de teclado
// (Escape, atrapar el Tab dentro, devolver el foco al cerrar) ni se anunciaba
// como diálogo a un lector de pantalla. Centralizarlo aquí lo arregla una vez
// para los cinco modales en vez de cinco veces.
export function Modal({ onClose, labelledBy, className, children }: ModalProps) {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null
    const container = containerRef.current
    const focusable = container?.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)
    focusable?.[0]?.focus()

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape' && onClose) {
        onClose()
        return
      }
      if (event.key === 'Tab' && focusable && focusable.length > 0) {
        const first = focusable[0]
        const last = focusable[focusable.length - 1]
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault()
          last.focus()
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault()
          first.focus()
        }
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      previouslyFocused?.focus()
    }
  }, [onClose])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div ref={containerRef} role="dialog" aria-modal="true" aria-labelledby={labelledBy} className={className}>
        {children}
      </div>
    </div>
  )
}
