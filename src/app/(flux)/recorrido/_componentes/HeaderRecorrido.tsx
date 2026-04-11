'use client'

/**
 * HeaderRecorrido — Header flotante sobre el mapa, compacto para mobile.
 * Una sola fila: ← | < Hoy > | ● 1/5
 * Se usa en: PaginaRecorrido, overlay absoluto sobre el mapa.
 */

import { ArrowLeft, ChevronLeft, ChevronRight } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useFormato } from '@/hooks/useFormato'

interface PropiedadesHeaderRecorrido {
  fecha: string // YYYY-MM-DD
  onCambiarFecha: (fecha: string) => void
  completadas: number
  total: number
}

function HeaderRecorrido({ fecha, onCambiarFecha, completadas, total }: PropiedadesHeaderRecorrido) {
  const router = useRouter()
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
    <header
      className="absolute top-0 left-0 right-0 z-10 flex items-center justify-between px-3"
      style={{ paddingTop: 'calc(env(safe-area-inset-top, 4px) + 6px)' }}
    >
      {/* Atrás */}
      <button
        onClick={() => router.push('/dashboard')}
        className="flex items-center justify-center size-9 rounded-full bg-black/50 backdrop-blur-md border border-white/10"
        aria-label="Volver"
      >
        <ArrowLeft size={16} className="text-white" />
      </button>

      {/* Fecha */}
      <div className="flex items-center rounded-full bg-black/50 backdrop-blur-md border border-white/10">
        <button
          onClick={() => cambiarDia(-1)}
          className="flex items-center justify-center size-8 rounded-full hover:bg-white/10 transition-colors"
        >
          <ChevronLeft size={14} className="text-white/60" />
        </button>
        <button
          onClick={() => onCambiarFecha(hoyStr)}
          className="px-1.5 min-w-[44px] text-center"
        >
          <span className="text-xs font-semibold text-white">{fechaTexto}</span>
        </button>
        <button
          onClick={() => cambiarDia(1)}
          className="flex items-center justify-center size-8 rounded-full hover:bg-white/10 transition-colors"
        >
          <ChevronRight size={14} className="text-white/60" />
        </button>
      </div>

      {/* Progreso */}
      {total > 0 ? (
        <div className="flex items-center gap-1 rounded-full bg-black/50 backdrop-blur-md border border-white/10 px-2.5 py-1.5">
          <div className="size-1.5 rounded-full" style={{
            backgroundColor: completadas >= total ? 'var(--insignia-exito)' : 'var(--insignia-info)',
          }} />
          <span className="text-xs font-medium text-white">{completadas}/{total}</span>
        </div>
      ) : (
        <div className="size-9" /> // spacer para mantener centrado
      )}
    </header>
  )
}

export { HeaderRecorrido }
