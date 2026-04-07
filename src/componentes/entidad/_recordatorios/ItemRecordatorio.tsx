'use client'

import { Circle, CheckCircle2, Trash2, Repeat, Maximize2 } from 'lucide-react'
import { Boton } from '@/componentes/ui/Boton'
import { textoRecurrencia } from '@/componentes/ui/SelectorRecurrencia'
import { useFormato } from '@/hooks/useFormato'
import { motion } from 'framer-motion'
import { type Recordatorio, formatearFecha, hoyISO } from './tipos'

/**
 * ItemRecordatorio — Fila individual de un recordatorio (activo o completado).
 * Muestra check, título, metadatos y botón eliminar al hover.
 */

interface ItemRecordatorioProps {
  recordatorio: Recordatorio
  indice: number
  onToggleCompletar: (id: string, completado: boolean) => void
  onEliminar: (r: Recordatorio) => void
}

function ItemRecordatorio({ recordatorio: r, indice, onToggleCompletar, onEliminar }: ItemRecordatorioProps) {
  const { locale } = useFormato()
  const esCompletado = r.completado

  return (
    <motion.div
      key={r.id}
      initial={{ opacity: 0, x: -16 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, height: 0 }}
      transition={{ duration: 0.2, delay: indice * 0.03 }}
      className="group flex items-start gap-2.5 py-2.5 px-1 rounded-lg hover:bg-superficie-hover transition-colors"
    >
      {/* Botón check */}
      <Boton
        variante="fantasma"
        tamano="xs"
        soloIcono
        icono={esCompletado ? <CheckCircle2 size={16} strokeWidth={1.5} /> : <Circle size={16} strokeWidth={1.5} />}
        onClick={() => onToggleCompletar(r.id, !esCompletado)}
        titulo={esCompletado ? 'Descompletar' : 'Completar'}
        className={`shrink-0 mt-0.5 ${esCompletado ? 'text-insignia-exito hover:text-texto-marca' : 'text-texto-terciario hover:text-texto-marca'}`}
      />

      {/* Contenido */}
      <div className="flex-1 min-w-0">
        {esCompletado ? (
          <>
            <p className="text-sm text-texto-terciario line-through truncate">{r.titulo}</p>
            <span className="text-xxs text-texto-terciario">{formatearFecha(r.fecha, locale)}</span>
          </>
        ) : (
          <>
            <p className="text-sm font-medium text-texto-primario truncate">{r.titulo}</p>
            <div className="flex items-center gap-2 mt-0.5 flex-wrap">
              <span className={`text-xxs ${r.fecha < hoyISO() ? 'text-insignia-peligro-texto font-semibold' : 'text-texto-terciario'}`}>
                {formatearFecha(r.fecha, locale)}
              </span>
              {r.hora && <span className="text-xxs text-texto-terciario">{r.hora}</span>}
              {r.repetir !== 'ninguno' && (
                <span className="text-xxs text-texto-terciario flex items-center gap-0.5" title={r.recurrencia ? textoRecurrencia(r.recurrencia!) : r.repetir}>
                  <Repeat size={10} />
                  {r.recurrencia ? textoRecurrencia(r.recurrencia!) : r.repetir}
                </span>
              )}
              {r.alerta_modal && (
                <span className="text-xxs text-texto-terciario flex items-center gap-0.5" title="Se abre modal al momento">
                  <Maximize2 size={10} />
                </span>
              )}
            </div>
          </>
        )}
      </div>

      {/* Botón eliminar */}
      <Boton
        variante="fantasma"
        tamano="xs"
        soloIcono
        icono={<Trash2 size={13} />}
        onClick={() => onEliminar(r)}
        titulo="Eliminar"
        className="shrink-0 self-center opacity-0 group-hover:opacity-100 text-texto-terciario hover:text-insignia-peligro-texto"
      />
    </motion.div>
  )
}

export { ItemRecordatorio }
