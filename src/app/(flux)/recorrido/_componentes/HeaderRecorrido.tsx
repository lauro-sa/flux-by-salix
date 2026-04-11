'use client'

/**
 * HeaderRecorrido — Header flotante transparente sobre el mapa.
 * Muestra: botón atrás, navegación de fecha (< Hoy >), badge progreso.
 * Se usa en: PaginaRecorrido, overlay absoluto sobre el mapa.
 */

import { ArrowLeft, ChevronLeft, ChevronRight } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useFormato } from '@/hooks/useFormato'
import { useTraduccion } from '@/lib/i18n'

interface PropiedadesHeaderRecorrido {
  fecha: string // YYYY-MM-DD
  onCambiarFecha: (fecha: string) => void
  completadas: number
  total: number
}

function HeaderRecorrido({ fecha, onCambiarFecha, completadas, total }: PropiedadesHeaderRecorrido) {
  const router = useRouter()
  const formato = useFormato()
  const { t } = useTraduccion()

  const fechaObj = new Date(fecha + 'T12:00:00')
  const ahora = new Date()
  const hoyStr = `${ahora.getFullYear()}-${String(ahora.getMonth() + 1).padStart(2, '0')}-${String(ahora.getDate()).padStart(2, '0')}`
  const esHoy = fecha === hoyStr

  const fechaTexto = esHoy ? 'Hoy' : formato.fecha(fechaObj, { conHora: false })

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
      className="absolute top-0 left-0 right-0 z-10 flex items-center gap-2 px-3"
      style={{
        paddingTop: 'calc(env(safe-area-inset-top, 8px) + 8px)',
      }}
    >
      {/* Botón atrás — pill con blur */}
      <button
        onClick={() => router.push('/dashboard')}
        className="flex items-center justify-center size-10 rounded-full bg-black/40 backdrop-blur-md border border-white/10"
        aria-label="Volver"
      >
        <ArrowLeft size={18} className="text-white" />
      </button>

      <div className="flex-1" />

      {/* Navegación de fecha — pill con blur */}
      <div className="flex items-center gap-0.5 rounded-full bg-black/40 backdrop-blur-md border border-white/10 px-1">
        <button
          onClick={() => cambiarDia(-1)}
          className="flex items-center justify-center size-8 rounded-full hover:bg-white/10 transition-colors"
        >
          <ChevronLeft size={16} className="text-white/70" />
        </button>
        <button
          onClick={() => onCambiarFecha(hoyStr)}
          className="px-2 py-1 min-w-[60px] text-center"
        >
          <span className="text-sm font-semibold text-white">{fechaTexto}</span>
        </button>
        <button
          onClick={() => cambiarDia(1)}
          className="flex items-center justify-center size-8 rounded-full hover:bg-white/10 transition-colors"
        >
          <ChevronRight size={16} className="text-white/70" />
        </button>
      </div>

      <div className="flex-1" />

      {/* Badge progreso — pill con blur */}
      {total > 0 && (
        <div className="flex items-center gap-1.5 rounded-full bg-black/40 backdrop-blur-md border border-white/10 px-3 py-2">
          <div className="size-2 rounded-full" style={{
            backgroundColor: completadas >= total ? 'var(--insignia-exito)' : 'var(--insignia-info)',
          }} />
          <span className="text-sm font-medium text-white">{completadas}/{total}</span>
        </div>
      )}
    </header>
  )
}

export { HeaderRecorrido }
