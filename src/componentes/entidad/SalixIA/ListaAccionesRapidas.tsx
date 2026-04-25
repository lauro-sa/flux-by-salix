'use client'

/**
 * ListaAccionesRapidas — lista de acciones contextuales del registro visible
 * (contacto, presupuesto, etc.). Diseño "Salix Glass" — Vision OS-inspired.
 *
 * Estructura:
 *   1. HERO CARD: el primer item "ir-contacto" se renderiza grande, con
 *      avatar dorado de iniciales + nombre destacado. Es la entidad principal.
 *   2. Otras navegaciones (ir-atencion, ver-ot, etc.) como cards secundarias.
 *   3. Cards de canales (Llamar/WhatsApp/Correo/Navegar) con íconos circulares
 *      brand (gradient propio por canal). Las duales tienen header copiable.
 *
 * La lógica de qué acciones aparecer NO se toca — viene del hook. Acá solo
 * se cambia el render visual.
 */

import { motion } from 'framer-motion'
import { Loader2, Zap, Copy, AlertCircle, ChevronUp, ChevronRight, UserRound } from 'lucide-react'
import { inferirGrupo, type AccionRapida, type GrupoAccion } from '@/hooks/useAccionesRapidas'

interface Propiedades {
  acciones: AccionRapida[]
  cargando: boolean
  error?: string | null
  soloAcciones?: boolean
  onAccionEjecutada?: () => void
  onColapsar?: () => void
}

const ORDEN_GRUPOS: GrupoAccion[] = ['navegacion', 'llamar', 'whatsapp', 'correo', 'direccion']
const ETIQUETA_GRUPO: Record<GrupoAccion, string> = {
  navegacion: 'Ir a',
  llamar: 'Llamar',
  whatsapp: 'WhatsApp',
  correo: 'Correo',
  direccion: 'Ubicación',
}

/** Clase del ícono circular brand según el grupo de la acción. */
function claseIconoBrand(grupo: GrupoAccion): string {
  switch (grupo) {
    case 'llamar':
      return 'salix-icon-circle salix-icon-phone'
    case 'whatsapp':
      return 'salix-icon-circle salix-icon-whatsapp'
    case 'correo':
      return 'salix-icon-circle salix-icon-email'
    case 'direccion':
      return 'salix-icon-circle salix-icon-location'
    case 'navegacion':
      return 'salix-icon-circle salix-icon-link'
  }
}

function ListaAccionesRapidas({
  acciones,
  cargando,
  error,
  soloAcciones = false,
  onAccionEjecutada,
  onColapsar,
}: Propiedades) {
  if (cargando && acciones.length === 0) {
    return (
      <div className="flex items-center gap-2 px-4 py-6 justify-center">
        <Loader2 className="size-3.5 animate-spin text-white/40" />
        <span className="text-xs text-white/45">Cargando acciones…</span>
      </div>
    )
  }

  if (error && acciones.length === 0) {
    return (
      <div className="flex items-center gap-2 px-4 py-6 justify-center text-center">
        <AlertCircle className="size-3.5 text-rose-400 shrink-0" />
        <span className="text-xs text-white/45">No se pudieron cargar las acciones rápidas.</span>
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

  // El "hero card" es la primera acción de navegación (típicamente "Ir al
  // contacto" en presupuesto/orden/visita, o "Ir al contacto vinculado" en
  // un mismo contacto). Solo aplica si su clave es exactamente 'ir-contacto'.
  const navegaciones = porGrupo.get('navegacion') || []
  const hero = navegaciones.find((a) => a.clave === 'ir-contacto') || null
  const navegacionesRestantes = navegaciones.filter((a) => a !== hero)

  return (
    <div
      className={
        soloAcciones
          ? 'flex-1 overflow-y-auto px-3 py-3 scrollbar-auto-oculto'
          : // Cuando convive con el chat abajo, la lista TOMA todo el espacio
            // sobrante (flex-1 + min-h-0 para que el overflow funcione dentro
            // de un flex). Scroll interno si hay muchas acciones; si hay
            // pocas, simplemente ocupa lo natural y el resto queda al chat.
            'flex-1 min-h-0 overflow-y-auto px-3 py-3 border-b border-white/[0.07] scrollbar-auto-oculto'
      }
    >
      <div className="flex items-center justify-between px-1 pb-2">
        <div className="flex items-center gap-1.5">
          <Zap className="size-3 text-white/45" />
          <span className="salix-section-label">Acciones rápidas</span>
        </div>
        {onColapsar && (
          <button
            onClick={onColapsar}
            className="p-1 -m-1 rounded text-white/40 hover:text-white/90 hover:bg-white/[0.04] transition-colors cursor-pointer"
            title="Minimizar"
            aria-label="Minimizar acciones rápidas"
          >
            <ChevronUp className="size-3.5" strokeWidth={2} />
          </button>
        )}
      </div>

      {/* HERO CARD — entidad principal. Mismo círculo brand (36px) que el
          resto de las acciones, con ícono de contactos. El nombre del contacto
          ya aparece al lado, así que no hace falta avatar con iniciales. */}
      {hero && (
        <motion.button
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.22, ease: 'easeOut' }}
          whileTap={{ scale: 0.98 }}
          onClick={async () => {
            onAccionEjecutada?.()
            await hero.onEjecutar?.()
          }}
          className="salix-hero w-full flex items-center gap-3 p-3 mb-3 text-left cursor-pointer group"
        >
          <div
            className="salix-icon-circle salix-icon-link shrink-0"
            style={{ width: 36, height: 36 }}
          >
            <UserRound className="size-4" strokeWidth={2} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[11px] text-white/55 leading-none">{hero.etiqueta}</p>
            <p className="text-[15px] text-white/95 font-medium leading-tight mt-1 truncate">
              {hero.descripcion || 'Sin nombre'}
            </p>
          </div>
          <ChevronRight
            className="size-4 text-white/40 group-hover:text-white/80 transition-colors shrink-0"
            strokeWidth={2}
          />
        </motion.button>
      )}

      <div className="space-y-3">
        {gruposActivos.map((grupo, grupoIdx) => {
          // Para "navegacion": si ya consumimos el hero, mostramos el resto.
          const items = grupo === 'navegacion' ? navegacionesRestantes : porGrupo.get(grupo)!
          if (items.length === 0) return null
          const hayMultiples = acciones.length > 1
          const delBaseGrupo = hayMultiples ? grupoIdx * 0.04 : 0
          const claseIcono = claseIconoBrand(grupo)

          return (
            <div key={grupo}>
              <p className="salix-section-label px-1 pb-1.5">{ETIQUETA_GRUPO[grupo]}</p>
              <div className="space-y-1.5">
                {items.map((accion, idx) => {
                  const tieneSub = !!accion.subacciones && accion.subacciones.length >= 2
                  const transicion = {
                    duration: 0.18,
                    delay: hayMultiples ? delBaseGrupo + idx * 0.025 : 0,
                    ease: 'easeOut' as const,
                  }
                  const Icono = accion.icono

                  // Card DUAL: header (copiable) + 2 botones simétricos abajo.
                  if (tieneSub) {
                    const headerCopiable = !!accion.onCopiar
                    const HeaderTag = headerCopiable ? 'button' : 'div'
                    return (
                      <motion.div
                        key={accion.clave}
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={transicion}
                        className="salix-card-dual"
                      >
                        <HeaderTag
                          {...(headerCopiable
                            ? {
                                onClick: async () => {
                                  // Copiar NO cierra el panel (intencional —
                                  // user copia, después usa otra sub-acción).
                                  await accion.onCopiar?.()
                                },
                              }
                            : {})}
                          className={`w-full flex items-center gap-3 px-3 py-2.5 text-left ${
                            headerCopiable
                              ? 'salix-subbtn cursor-pointer group'
                              : ''
                          }`}
                        >
                          <div className={claseIcono} style={{ width: 36, height: 36 }}>
                            <Icono className="size-4" strokeWidth={2} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-[13px] text-white/95 font-medium leading-tight">
                              {accion.etiqueta}
                            </p>
                            {accion.descripcion && (
                              <p className="text-[11px] text-white/50 truncate mt-0.5">
                                {accion.descripcion}
                              </p>
                            )}
                          </div>
                          {headerCopiable && (
                            <Copy
                              className="size-3.5 text-white/30 group-hover:text-white/70 transition-colors shrink-0"
                              strokeWidth={1.75}
                              aria-label="Tocá para copiar"
                            />
                          )}
                        </HeaderTag>
                        <div className="grid grid-cols-2 border-t border-white/[0.06] divide-x divide-white/[0.06]">
                          {accion.subacciones!.map((sub) => {
                            const IconoSub = sub.icono
                            return (
                              <button
                                key={sub.clave}
                                onClick={async () => {
                                  onAccionEjecutada?.()
                                  await sub.onEjecutar()
                                }}
                                className="salix-subbtn flex items-center justify-center gap-1.5 px-3 py-2 text-xs text-white/70 hover:text-white cursor-pointer"
                              >
                                {IconoSub && (
                                  <IconoSub
                                    className={`size-3.5 ${sub.colorIcono || 'text-white/50'}`}
                                    strokeWidth={1.75}
                                  />
                                )}
                                <span>{sub.etiqueta}</span>
                              </button>
                            )
                          })}
                        </div>
                      </motion.div>
                    )
                  }

                  // Card SIMPLE: ícono brand circular + texto + toda la fila clickeable.
                  return (
                    <motion.button
                      key={accion.clave}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={transicion}
                      whileTap={{ scale: 0.98 }}
                      onClick={async () => {
                        onAccionEjecutada?.()
                        await accion.onEjecutar?.()
                      }}
                      className="salix-card w-full flex items-center gap-3 px-3 py-2.5 text-left cursor-pointer"
                    >
                      <div className={claseIcono} style={{ width: 36, height: 36 }}>
                        <Icono className="size-4" strokeWidth={2} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] text-white/95 font-medium leading-tight">
                          {accion.etiqueta}
                        </p>
                        {accion.descripcion && (
                          <p className="text-[11px] text-white/50 truncate mt-0.5">
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
