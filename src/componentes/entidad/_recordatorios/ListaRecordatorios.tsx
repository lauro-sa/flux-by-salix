'use client'

import { AlarmClock, CheckCircle2, Plus } from 'lucide-react'
import { Boton } from '@/componentes/ui/Boton'
import { AnimatePresence } from 'framer-motion'
import { type Recordatorio } from './tipos'
import { ItemRecordatorio } from './ItemRecordatorio'

/**
 * ListaRecordatorios — Muestra la lista de recordatorios activos o completados,
 * incluyendo estados vacíos y de carga.
 */

interface ListaRecordatoriosProps {
  tipo: 'activos' | 'completados'
  recordatorios: Recordatorio[]
  cargando: boolean
  onToggleCompletar: (id: string, completado: boolean) => void
  onEliminar: (r: Recordatorio) => void
  onIrACrear?: () => void
}

function ListaRecordatorios({ tipo, recordatorios, cargando, onToggleCompletar, onEliminar, onIrACrear }: ListaRecordatoriosProps) {
  /* Spinner de carga */
  if (cargando) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="size-5 border-2 border-texto-terciario/30 border-t-texto-marca rounded-full animate-spin" />
      </div>
    )
  }

  /* Estado vacío */
  if (recordatorios.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 gap-2 text-texto-terciario">
        {tipo === 'activos' ? (
          <>
            <AlarmClock size={28} strokeWidth={1.2} className="opacity-40" />
            <p className="text-sm">Sin recordatorios activos</p>
            {onIrACrear && (
              <Boton tamano="sm" variante="fantasma" onClick={onIrACrear}>
                <Plus size={14} />
                Crear uno
              </Boton>
            )}
          </>
        ) : (
          <>
            <CheckCircle2 size={28} strokeWidth={1.2} className="opacity-40" />
            <p className="text-sm">Sin recordatorios completados</p>
          </>
        )}
      </div>
    )
  }

  /* Lista */
  return (
    <div className="flex flex-col gap-0.5">
      <AnimatePresence>
        {recordatorios.map((r, idx) => (
          <ItemRecordatorio
            key={r.id}
            recordatorio={r}
            indice={idx}
            onToggleCompletar={onToggleCompletar}
            onEliminar={onEliminar}
          />
        ))}
      </AnimatePresence>
    </div>
  )
}

export { ListaRecordatorios }
