'use client'

/**
 * ListaAccionesRapidas — lista animada de acciones contextuales al
 * registro visible (contacto, presupuesto, …). Se renderiza dentro del
 * panel de Salix IA cuando la ruta actual tiene acciones disponibles.
 *
 * Cada item es un botón que dispara la acción adaptada al dispositivo
 * (tel:/wa.me/mailto/maps en móvil; copiar o web en PC).
 */

import { motion } from 'framer-motion'
import { Loader2, Zap } from 'lucide-react'
import type { AccionRapida } from '@/hooks/useAccionesRapidas'

interface Propiedades {
  acciones: AccionRapida[]
  cargando: boolean
  /** Si true, el panel completo es solo de acciones (sin IA abajo). */
  soloAcciones?: boolean
  /** Callback para cerrar el panel tras ejecutar una acción (opcional). */
  onAccionEjecutada?: () => void
}

function ListaAccionesRapidas({
  acciones,
  cargando,
  soloAcciones = false,
  onAccionEjecutada,
}: Propiedades) {
  if (cargando && acciones.length === 0) {
    return (
      <div className="flex items-center gap-2 px-4 py-6 justify-center">
        <Loader2 className="size-3.5 animate-spin text-texto-terciario" />
        <span className="text-xs text-texto-terciario">Cargando acciones…</span>
      </div>
    )
  }

  if (acciones.length === 0) return null

  return (
    <div className={soloAcciones ? 'flex-1 overflow-y-auto px-3 py-3 scrollbar-auto-oculto' : 'px-3 py-3 border-b border-white/[0.07]'}>
      <div className="flex items-center gap-1.5 px-1 pb-2">
        <Zap className="size-3 text-texto-terciario" />
        <span className="text-[11px] font-medium text-texto-terciario uppercase tracking-wider">
          Acciones rápidas
        </span>
      </div>

      <div className="space-y-1">
        {acciones.map((accion, idx) => {
          const Icono = accion.icono
          return (
            <motion.button
              key={accion.clave}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.18, delay: idx * 0.03, ease: 'easeOut' }}
              whileTap={{ scale: 0.98 }}
              onClick={async () => {
                // Cerrar el panel PRIMERO: si la acción navega (router.push)
                // o abre un protocolo (tel:/wa.me/mailto/maps), el panel no
                // queda flotando sobre la vista destino al volver atrás.
                onAccionEjecutada?.()
                await accion.onEjecutar()
              }}
              className="w-full flex items-center gap-3 px-3 py-2 rounded-card border border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.05] hover:border-white/[0.1] transition-colors text-left group cursor-pointer"
            >
              <div className="size-8 rounded-card bg-white/[0.04] flex items-center justify-center shrink-0 group-hover:bg-white/[0.07] transition-colors">
                <Icono className={`size-4 ${accion.colorIcono}`} strokeWidth={1.75} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-texto-primario leading-tight">{accion.etiqueta}</p>
                {accion.descripcion && (
                  <p className="text-[11px] text-texto-terciario truncate mt-0.5">
                    {accion.descripcion}
                  </p>
                )}
              </div>
            </motion.button>
          )
        })}
      </div>
    </div>
  )
}

export { ListaAccionesRapidas }
