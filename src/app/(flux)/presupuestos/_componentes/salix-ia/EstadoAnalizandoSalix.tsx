'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { Check } from 'lucide-react'
import { EsqueletoBrillo } from '@/componentes/ui/EsqueletoBrillo'
import type { EstadoPaso } from './tipos'

/**
 * EstadoAnalizandoSalix — Pantalla mientras la IA está procesando.
 *
 * Muestra:
 *  - Checklist de 3 pasos (identificar / matchear / similares).
 *    Cada item tiene marker circular: vacío (pendiente), pulsando violeta
 *    (activo), check teal sólido (hecho).
 *  - 2 skeletons con shimmer desfasado (0ms y 300ms) para anticipar las
 *    cards de propuestas que van a entrar.
 *
 * Los pasos vienen del hook useSecuenciaAnalisis (no se calculan acá).
 */

interface PropsEstadoAnalizandoSalix {
  pasos: EstadoPaso[]
}

export function EstadoAnalizandoSalix({ pasos }: PropsEstadoAnalizandoSalix) {
  return (
    <div className="px-5 py-5 space-y-5">
      {/* Checklist */}
      <div className="space-y-2.5">
        {pasos.map((p, i) => (
          <motion.div
            key={p.paso}
            initial={{ opacity: 0, x: -4 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.06, duration: 0.25 }}
            className="flex items-center gap-2.5"
          >
            <MarkerPaso estado={p.estado} />
            <span
              className="text-xs transition-colors duration-300"
              style={{
                color:
                  p.estado === 'activo' ? 'var(--texto-primario)' :
                  p.estado === 'hecho' ? 'var(--texto-secundario)' :
                  'var(--texto-terciario)',
              }}
            >
              {p.etiqueta}
            </span>
          </motion.div>
        ))}
      </div>

      {/* Skeletons de las cards que están por llegar */}
      <div className="space-y-3">
        <EsqueletoBrillo variante="tarjeta" lineas={3} retraso={0} />
        <EsqueletoBrillo variante="tarjeta" lineas={3} retraso={300} />
      </div>
    </div>
  )
}

// Marker circular del item de checklist. Tres estados visuales claros.
function MarkerPaso({ estado }: { estado: EstadoPaso['estado'] }) {
  const cfg = {
    pendiente: { fondo: 'transparent',                borde: 'var(--borde-fuerte)',        animacion: undefined },
    activo:    { fondo: 'var(--insignia-primario-fondo)', borde: 'var(--insignia-primario)', animacion: 'flux-pulso-rapido 1s ease-in-out infinite' },
    hecho:     { fondo: 'var(--insignia-primario)',   borde: 'var(--insignia-primario)',    animacion: undefined },
  }[estado]

  return (
    <div
      className="size-4 rounded-full border-2 flex items-center justify-center shrink-0 transition-all duration-300"
      style={{ backgroundColor: cfg.fondo, borderColor: cfg.borde, animation: cfg.animacion }}
    >
      <AnimatePresence>
        {estado === 'hecho' && (
          <motion.span
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className="text-white inline-flex"
          >
            <Check size={10} strokeWidth={3} />
          </motion.span>
        )}
      </AnimatePresence>
    </div>
  )
}
