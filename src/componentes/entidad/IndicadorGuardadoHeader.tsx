'use client'

/**
 * Chip compacto que aparece al lado del breadcrumb del Header mostrando
 * el estado del autoguardado del editor activo (presupuesto, OT, etc.).
 *
 * El estado lo emite cada editor vía `useReportarGuardado()`. Si el
 * estado es `null` o `'idle'`, el chip no se renderiza (no ocupa espacio
 * visual cuando no hay nada que reportar).
 *
 * Transiciones esperadas (las dispara el editor):
 *   - `'guardando'`  →  spinner + "Guardando…"
 *   - `'guardado'`   →  check  + "Guardado"   (≈1.5 s y vuelve a null)
 *   - `'error'`      →  x      + "Error al guardar"
 */

import { AnimatePresence, motion } from 'framer-motion'
import { Check, Loader2, AlertCircle } from 'lucide-react'
import { useIndicadorGuardado } from '@/hooks/useIndicadorGuardado'

export function IndicadorGuardadoHeader() {
  const { estado } = useIndicadorGuardado()

  if (estado === null || estado === 'idle') return null

  const config =
    estado === 'guardando'
      ? {
          icono: <Loader2 size={12} className="animate-spin" />,
          texto: 'Guardando…',
          clase: 'text-texto-terciario',
        }
      : estado === 'guardado'
        ? {
            icono: <Check size={12} />,
            texto: 'Guardado',
            clase: 'text-insignia-exito',
          }
        : {
            icono: <AlertCircle size={12} />,
            texto: 'Error al guardar',
            clase: 'text-insignia-peligro',
          }

  return (
    <AnimatePresence mode="wait">
      <motion.span
        key={estado}
        initial={{ opacity: 0, y: -2 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -2 }}
        transition={{ duration: 0.15 }}
        className={`inline-flex items-center gap-1 text-[11px] font-medium ${config.clase}`}
        aria-live="polite"
      >
        {config.icono}
        {config.texto}
      </motion.span>
    </AnimatePresence>
  )
}

export default IndicadorGuardadoHeader
