'use client'

/**
 * HeaderRecorrido — Header flotante sobre el mapa, compacto para mobile.
 * Una sola fila centrada: < Fecha > · ● 2/5
 * Sin botón atrás (el header principal de la app tiene la navegación).
 */

import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useFormato } from '@/hooks/useFormato'

interface PropiedadesHeaderRecorrido {
  fecha: string // YYYY-MM-DD
  onCambiarFecha: (fecha: string) => void
  completadas: number
  total: number
}

function HeaderRecorrido({ fecha, onCambiarFecha, completadas, total }: PropiedadesHeaderRecorrido) {
  const formato = useFormato()

  const fechaObj = new Date(fecha + 'T12:00:00')
  const ahora = new Date()
  const hoyStr = `${ahora.getFullYear()}-${String(ahora.getMonth() + 1).padStart(2, '0')}-${String(ahora.getDate()).padStart(2, '0')}`
  const esHoy = fecha === hoyStr

  const fechaTexto = esHoy ? 'Hoy' : formato.fecha(fechaObj, { corta: true })

  const cambiarDia = (delta: number) => {
    const nueva = new Date(fechaObj)
    nueva.setDate(nueva.getDate() + delta)
    const yyyy = nueva.getFullYear()
    const mm = String(nueva.getMonth() + 1).padStart(2, '0')
    const dd = String(nueva.getDate()).padStart(2, '0')
    onCambiarFecha(`${yyyy}-${mm}-${dd}`)
  }

  return (
    <header className="absolute top-0 left-0 right-0 z-10 flex items-center justify-center gap-2 px-3 pt-2">
      {/* Fecha + Progreso — una sola pill centrada */}
      <div className="flex items-center rounded-full bg-black/50 backdrop-blur-md border border-white/10">
        <button
          onClick={() => cambiarDia(-1)}
          className="flex items-center justify-center size-8 rounded-full hover:bg-white/10 transition-colors"
        >
          <ChevronLeft size={14} className="text-white/60" />
        </button>
        <button
          onClick={() => onCambiarFecha(hoyStr)}
          className="px-1 min-w-[44px] text-center"
        >
          <span className="text-xs font-semibold text-white">{fechaTexto}</span>
        </button>
        <button
          onClick={() => cambiarDia(1)}
          className="flex items-center justify-center size-8 rounded-full hover:bg-white/10 transition-colors"
        >
          <ChevronRight size={14} className="text-white/60" />
        </button>

        {/* Separador + progreso dentro de la misma pill */}
        {total > 0 && (
          <>
            <div className="w-px h-4 bg-white/15" />
            <div className="flex items-center gap-1 px-2.5 py-1.5">
              <div className="size-1.5 rounded-full" style={{
                backgroundColor: completadas >= total ? 'var(--insignia-exito)' : 'var(--insignia-info)',
              }} />
              <span className="text-xs font-medium text-white">{completadas}/{total}</span>
            </div>
          </>
        )}
      </div>
    </header>
  )
}

export { HeaderRecorrido }
