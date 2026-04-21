'use client'

import { Circle, CheckCircle2, Trash2, Repeat, Bell, Clock } from 'lucide-react'
import { IconoWhatsApp } from '@/componentes/iconos/IconoWhatsApp'
import { textoRecurrencia } from '@/componentes/ui/SelectorRecurrencia'
import { useFormato } from '@/hooks/useFormato'
import { motion } from 'framer-motion'
import { type Recordatorio, formatearFecha, hoyISO } from './tipos'

/**
 * ItemRecordatorio — Fila individual de un recordatorio.
 * Touch-friendly: altura mínima 52px, eliminar siempre visible en mobile,
 * tap en el cuerpo abre el editor, tap en el check completa.
 */

interface ItemRecordatorioProps {
  recordatorio: Recordatorio
  indice: number
  onToggleCompletar: (id: string, completado: boolean) => void
  onEliminar: (r: Recordatorio) => void
  onEditar?: (r: Recordatorio) => void
}

function ItemRecordatorio({ recordatorio: r, indice, onToggleCompletar, onEliminar, onEditar }: ItemRecordatorioProps) {
  const { locale } = useFormato()
  const esCompletado = r.completado
  const esVencido = !esCompletado && r.fecha < hoyISO()

  return (
    <motion.div
      key={r.id}
      initial={{ opacity: 0, x: -12 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, height: 0 }}
      transition={{ duration: 0.18, delay: indice * 0.025 }}
      className={`group relative flex items-center gap-2 py-2.5 pl-2 pr-1 rounded-card transition-colors ${
        esVencido
          ? 'hover:bg-insignia-peligro/5'
          : 'hover:bg-white/[0.03]'
      }`}
    >
      {/* Indicador lateral para vencidos */}
      {esVencido && (
        <span className="absolute left-0 top-2 bottom-2 w-0.5 rounded-full bg-insignia-peligro-texto/60" />
      )}

      {/* Check táctil */}
      <button
        type="button"
        onClick={() => onToggleCompletar(r.id, !esCompletado)}
        className={`shrink-0 size-9 rounded-full flex items-center justify-center transition-colors ${
          esCompletado
            ? 'text-insignia-exito-texto hover:bg-insignia-exito/10'
            : 'text-texto-terciario hover:text-texto-marca hover:bg-white/[0.05]'
        }`}
        title={esCompletado ? 'Marcar como pendiente' : 'Marcar como hecho'}
      >
        {esCompletado
          ? <CheckCircle2 size={18} strokeWidth={2} />
          : <Circle size={18} strokeWidth={1.5} />
        }
      </button>

      {/* Contenido — click abre editor */}
      <button
        type="button"
        onClick={() => !esCompletado && onEditar?.(r)}
        disabled={esCompletado || !onEditar}
        className={`flex-1 min-w-0 text-left py-0.5 ${!esCompletado && onEditar ? 'cursor-pointer' : 'cursor-default'}`}
      >
        <p className={`text-sm leading-snug truncate ${
          esCompletado
            ? 'text-texto-terciario line-through'
            : 'text-texto-primario font-medium'
        }`}>
          {r.titulo}
        </p>

        <div className="flex items-center gap-x-2 gap-y-0.5 mt-0.5 flex-wrap">
          {/* Fecha con énfasis si es vencido */}
          <span className={`text-[11px] inline-flex items-center gap-1 ${
            esVencido ? 'text-insignia-peligro-texto font-semibold' : 'text-texto-terciario'
          }`}>
            {esVencido && <Clock size={10} strokeWidth={2.5} />}
            {formatearFecha(r.fecha, locale)}
            {r.hora && <span className="opacity-80">· {r.hora}</span>}
          </span>

          {/* Recurrencia */}
          {r.repetir !== 'ninguno' && (
            <span
              className="text-[11px] text-texto-terciario inline-flex items-center gap-0.5"
              title={r.recurrencia ? textoRecurrencia(r.recurrencia) : r.repetir}
            >
              <Repeat size={10} />
              {r.recurrencia ? textoRecurrencia(r.recurrencia) : r.repetir}
            </span>
          )}

          {/* Alerta modal */}
          {r.alerta_modal && (
            <span className="text-[11px] text-texto-terciario inline-flex items-center gap-0.5" title="Alerta con modal">
              <Bell size={10} />
            </span>
          )}

          {/* WhatsApp */}
          {r.notificar_whatsapp && (
            <span className="text-[11px] text-canal-whatsapp/70 inline-flex items-center gap-0.5" title="Avisar por WhatsApp">
              <IconoWhatsApp size={10} />
            </span>
          )}

          {/* Nota */}
          {r.descripcion && (
            <span className="text-[11px] text-texto-terciario/80 truncate max-w-[140px]" title={r.descripcion}>
              — {r.descripcion}
            </span>
          )}
        </div>
      </button>

      {/* Eliminar — siempre visible en mobile (touch-friendly), fade-in en desktop */}
      <button
        type="button"
        onClick={() => onEliminar(r)}
        className="shrink-0 size-9 rounded-full flex items-center justify-center text-texto-terciario/60 hover:text-insignia-peligro-texto hover:bg-insignia-peligro/10 transition-colors md:opacity-0 md:group-hover:opacity-100"
        title="Eliminar"
      >
        <Trash2 size={14} />
      </button>
    </motion.div>
  )
}

export { ItemRecordatorio }
