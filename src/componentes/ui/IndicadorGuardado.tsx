'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { Check, Loader2, AlertCircle, Undo2 } from 'lucide-react'
import type { EstadoGuardado } from '@/hooks/useAutoguardado'

/**
 * IndicadorGuardado — muestra estado sutil de autoguardado + opción deshacer.
 * Tipo Gmail: "Guardado · Deshacer" que desaparece después de unos segundos.
 * Se usa en: configuración, edición de registros.
 */
function IndicadorGuardado({ estado, puedeDeshacer, onDeshacer }: {
  estado: EstadoGuardado
  puedeDeshacer?: boolean
  onDeshacer?: () => void
}) {
  return (
    <AnimatePresence>
      {estado !== 'idle' && (
        <motion.div
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          transition={{ duration: 0.2 }}
          className={[
            'inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full',
            estado === 'guardando' ? 'text-texto-terciario' : '',
            estado === 'guardado' ? 'text-insignia-exito bg-insignia-exito/10' : '',
            estado === 'error' ? 'text-insignia-peligro bg-insignia-peligro/10' : '',
          ].join(' ')}
        >
          {estado === 'guardando' && <Loader2 size={12} className="animate-spin" />}
          {estado === 'guardado' && <Check size={12} />}
          {estado === 'error' && <AlertCircle size={12} />}

          {estado === 'guardando' && 'Guardando...'}
          {estado === 'guardado' && 'Guardado'}
          {estado === 'error' && 'Error al guardar'}

          {estado === 'guardado' && puedeDeshacer && onDeshacer && (
            <>
              <span className="text-texto-terciario mx-0.5">·</span>
              <button
                onClick={onDeshacer}
                className="inline-flex items-center gap-1 text-texto-marca hover:underline bg-transparent border-none cursor-pointer p-0 text-xs font-medium"
              >
                <Undo2 size={11} />
                Deshacer
              </button>
            </>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  )
}

export { IndicadorGuardado }
