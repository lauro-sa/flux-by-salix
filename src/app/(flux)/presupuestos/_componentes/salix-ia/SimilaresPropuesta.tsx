'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronDown } from 'lucide-react'
import type { SugerenciaIA } from './tipos'

/**
 * SimilaresPropuesta — Bloque colapsable que aparece debajo de una
 * línea propuesta "nueva" cuando la IA encontró candidatos del catálogo
 * que se parecen pero no matchean exacto.
 *
 * El usuario puede expandirlo, ver los candidatos con su razón ("Es
 * similar pero el usuario dijo puerta, no portón"), y clickear uno para
 * reemplazar la línea nueva por el servicio existente.
 *
 * Empieza colapsado para no saturar la lista. El caret rota 180° al abrir.
 */

interface PropsSimilaresPropuesta {
  candidatos: SugerenciaIA[]
  onUsar: (sugerencia: SugerenciaIA) => void
}

export function SimilaresPropuesta({ candidatos, onUsar }: PropsSimilaresPropuesta) {
  const [abierto, setAbierto] = useState(false)

  if (candidatos.length === 0) return null

  return (
    <div className="mt-2 rounded-card border border-borde-sutil bg-black/20 overflow-hidden">
      <button
        type="button"
        onClick={() => setAbierto(v => !v)}
        className="w-full flex items-center justify-between gap-2 px-3 py-2 text-left hover:bg-superficie-hover transition-colors"
        aria-expanded={abierto}
      >
        <span className="text-xs text-texto-secundario">
          ¿Existe algo similar? · {candidatos.length} {candidatos.length === 1 ? 'candidato' : 'candidatos'}
        </span>
        <motion.span
          animate={{ rotate: abierto ? 180 : 0 }}
          transition={{ duration: 0.25, ease: 'easeOut' }}
          className="inline-flex text-texto-terciario"
        >
          <ChevronDown size={14} />
        </motion.span>
      </button>

      <AnimatePresence initial={false}>
        {abierto && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
            className="overflow-hidden"
          >
            <ul className="divide-y divide-borde-sutil/60">
              {candidatos.map((c, i) => (
                <li key={`${c.codigo}-${i}`}>
                  <button
                    type="button"
                    onClick={() => onUsar(c)}
                    className="group w-full px-3 py-2.5 text-left hover:bg-superficie-hover transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-insignia-primario-fondo text-insignia-primario-texto">
                        {c.referencia_interna || c.codigo}
                      </span>
                      <span className="text-xs font-medium text-texto-primario flex-1 min-w-0 truncate">{c.nombre}</span>
                      <span className="text-[10px] font-medium text-insignia-primario-texto opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                        Usar este →
                      </span>
                    </div>
                    <p className="text-[10px] text-texto-terciario mt-1 leading-snug">{c.razon}</p>
                  </button>
                </li>
              ))}
            </ul>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
