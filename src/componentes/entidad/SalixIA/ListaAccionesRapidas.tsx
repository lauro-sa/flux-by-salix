'use client'

/**
 * ListaAccionesRapidas — lista animada de acciones contextuales al
 * registro visible (contacto, presupuesto, …). Se renderiza dentro del
 * panel de Salix IA cuando la ruta actual tiene acciones disponibles.
 *
 * Cada item es un botón que dispara la acción adaptada al dispositivo
 * (tel:/wa.me/mailto/maps en móvil; copiar o web en PC).
 *
 * Cuando hay acciones de distintos grupos, las segmenta visualmente con
 * subtítulos pequeños (Navegación / Llamar / WhatsApp / Correo / Navegar).
 */

import { motion } from 'framer-motion'
import { Loader2, Zap } from 'lucide-react'
import { inferirGrupo, type AccionRapida, type GrupoAccion } from '@/hooks/useAccionesRapidas'

interface Propiedades {
  acciones: AccionRapida[]
  cargando: boolean
  /** Si true, el panel completo es solo de acciones (sin IA abajo). */
  soloAcciones?: boolean
  /** Callback para cerrar el panel tras ejecutar una acción (opcional). */
  onAccionEjecutada?: () => void
}

// Orden de aparición de los grupos + etiquetas visibles.
const ORDEN_GRUPOS: GrupoAccion[] = ['navegacion', 'llamar', 'whatsapp', 'correo', 'direccion']
const ETIQUETA_GRUPO: Record<GrupoAccion, string> = {
  navegacion: 'Ir a',
  llamar: 'Llamar',
  whatsapp: 'WhatsApp',
  correo: 'Correo',
  direccion: 'Navegar en mapa',
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

  // Agrupar por grupo preservando el orden original dentro de cada grupo.
  const porGrupo = new Map<GrupoAccion, AccionRapida[]>()
  for (const accion of acciones) {
    const g = inferirGrupo(accion.clave)
    const lista = porGrupo.get(g) || []
    lista.push(accion)
    porGrupo.set(g, lista)
  }
  const gruposActivos = ORDEN_GRUPOS.filter((g) => porGrupo.has(g))
  // Si todas las acciones caen en un solo grupo no hace falta subtitular
  // (evita ruido visual cuando solo hay, p. ej., "Ir al contacto").
  const mostrarSubtitulos = gruposActivos.length > 1

  return (
    <div
      className={
        soloAcciones
          ? 'flex-1 overflow-y-auto px-3 py-3 scrollbar-auto-oculto'
          : 'px-3 py-3 border-b border-white/[0.07]'
      }
    >
      <div className="flex items-center gap-1.5 px-1 pb-2">
        <Zap className="size-3 text-texto-terciario" />
        <span className="text-[11px] font-medium text-texto-terciario uppercase tracking-wider">
          Acciones rápidas
        </span>
      </div>

      <div className="space-y-3">
        {gruposActivos.map((grupo, grupoIdx) => {
          const delBaseGrupo = grupoIdx * 0.04
          const items = porGrupo.get(grupo)!
          return (
            <div key={grupo}>
              {mostrarSubtitulos && (
                <p className="text-[10px] font-medium text-texto-terciario/70 uppercase tracking-wider px-1 pb-1.5">
                  {ETIQUETA_GRUPO[grupo]}
                </p>
              )}
              <div className="space-y-1">
                {items.map((accion, idx) => {
                  const Icono = accion.icono
                  return (
                    <motion.button
                      key={accion.clave}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{
                        duration: 0.18,
                        delay: delBaseGrupo + idx * 0.025,
                        ease: 'easeOut',
                      }}
                      whileTap={{ scale: 0.98 }}
                      onClick={async () => {
                        // Cerrar el panel PRIMERO: si la acción navega o abre
                        // un protocolo, no queda flotando sobre la vista destino.
                        onAccionEjecutada?.()
                        await accion.onEjecutar()
                      }}
                      className="w-full flex items-center gap-3 px-3 py-2 rounded-card border border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.05] hover:border-white/[0.1] transition-colors text-left group cursor-pointer"
                    >
                      <div className="size-8 rounded-card bg-white/[0.04] flex items-center justify-center shrink-0 group-hover:bg-white/[0.07] transition-colors">
                        <Icono
                          className={`size-4 ${accion.colorIcono}`}
                          strokeWidth={1.75}
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-texto-primario leading-tight">
                          {accion.etiqueta}
                        </p>
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
        })}
      </div>
    </div>
  )
}

export { ListaAccionesRapidas }
