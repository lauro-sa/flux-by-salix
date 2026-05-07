'use client'

import { motion } from 'framer-motion'
import { Workflow, Sparkles } from 'lucide-react'
import { Boton } from '@/componentes/ui/Boton'
import { Insignia } from '@/componentes/ui/Insignia'
import { useTraduccion } from '@/lib/i18n'
import { useModulos } from '@/hooks/useModulos'
import {
  plantillasDestacadas,
  type PlantillaSugerida,
} from '@/lib/workflows/plantillas-sugeridas'
import {
  etiquetaDisparador,
} from '@/lib/workflows/etiquetas-disparador'
import { iconoLucide } from './iconos-plantilla'

/**
 * EstadoVacioFlujos — Hero educativo cuando la empresa no tiene ningún flujo.
 *
 * Sigue la misma metáfora visual que `EstadoVacio` (ícono grande arriba +
 * título + descripción + acción), pero agrega una zona de mini-cards de
 * plantillas sugeridas. Componente dedicado en lugar de extender el
 * genérico (decisión D6 del plan de scope) — la zona de plantillas es
 * muy específica de flujos y no tiene reuso fuera del módulo.
 *
 * Las plantillas se filtran por módulos instalados de la empresa
 * (via `useModulos.tieneModulo`). Si tras filtrar no hay 3 disponibles
 * mostramos las que queden (1-2). Si no queda ninguna (caso muy raro:
 * empresa sin ningún módulo opcional) renderizamos solo título +
 * descripción + botón "Crear desde cero".
 */

interface Props {
  /** Si el user no tiene permiso `crear`, ocultamos los botones. */
  puedeCrear: boolean
  /** Click en una mini-card → abre modal con la plantilla preseleccionada. */
  onUsarPlantilla: (plantilla: PlantillaSugerida) => void
  /** Click en "Crear desde cero" → abre modal en pestaña "Desde cero". */
  onCrearDesdeCero: () => void
}

export default function EstadoVacioFlujos({
  puedeCrear,
  onUsarPlantilla,
  onCrearDesdeCero,
}: Props) {
  const { t } = useTraduccion()
  const { tieneModulo } = useModulos()
  const destacadas = plantillasDestacadas(tieneModulo, 3)

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: 'easeOut' }}
      className="flex flex-col items-center justify-center px-6 py-12 text-center max-w-3xl mx-auto"
    >
      {/* Ícono principal */}
      <motion.div
        initial={{ opacity: 0, scale: 0.6 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.6, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
        className="mb-5 text-texto-terciario icono-dibujar"
      >
        <Workflow size={64} strokeWidth={1.3} />
      </motion.div>

      <h2 className="text-xl font-semibold text-texto-primario mb-3">
        {t('flujos.estado_vacio.titulo')}
      </h2>
      <p className="text-base text-texto-terciario max-w-xl leading-relaxed mb-8">
        {t('flujos.estado_vacio.descripcion')}
      </p>

      {/* Plantillas sugeridas (solo si hay módulos compatibles instalados) */}
      {puedeCrear && destacadas.length > 0 && (
        <div className="w-full">
          <div className="flex items-center justify-center gap-2 mb-4">
            <Sparkles size={14} className="text-texto-marca" />
            <span className="text-[11px] font-medium text-texto-terciario uppercase tracking-wider">
              {t('flujos.estado_vacio.titulo_plantillas')}
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-8">
            {destacadas.map((p) => (
              <CardPlantilla key={p.id} plantilla={p} onClick={() => onUsarPlantilla(p)} />
            ))}
          </div>
        </div>
      )}

      {puedeCrear && (
        <Boton variante="secundario" tamano="md" onClick={onCrearDesdeCero}>
          {t('flujos.estado_vacio.crear_desde_cero')}
        </Boton>
      )}
    </motion.div>
  )
}

// =============================================================
// Card de plantilla — versión compacta usada también en el modal.
// =============================================================
// La extraemos a este archivo para no duplicar el render. ModalNuevoFlujo
// importa CardPlantilla y la reusa con un onClick distinto.

interface PropsCard {
  plantilla: PlantillaSugerida
  onClick: () => void
}

export function CardPlantilla({ plantilla, onClick }: PropsCard) {
  const { t } = useTraduccion()
  const Icono = iconoLucide(plantilla.icono)
  const colorClases = COLORES_FONDO_ICONO[plantilla.color]

  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex flex-col items-start gap-3 p-4 rounded-popover border border-borde-sutil bg-superficie-tarjeta hover:bg-superficie-elevada hover:border-borde-fuerte transition-all duration-150 text-left cursor-pointer"
    >
      <div className="flex items-center gap-3 w-full">
        <div className={`shrink-0 size-10 rounded-boton flex items-center justify-center ${colorClases}`}>
          <Icono size={18} strokeWidth={1.6} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold text-texto-primario truncate">
            {plantilla.fallback_es.titulo}
          </div>
        </div>
      </div>
      <p className="text-xs text-texto-terciario leading-relaxed line-clamp-3">
        {plantilla.fallback_es.descripcion}
      </p>
      <div className="mt-auto pt-1">
        <Insignia color="neutro" tamano="sm" variante="outline">
          {t('flujos.modal_nuevo.plantilla_disparador')}
          {etiquetaDisparador(t, plantilla.tipo_disparador)}
        </Insignia>
      </div>
    </button>
  )
}

// Mapeo color de plantilla → clases de fondo + texto del ícono.
// Se usa el patrón de Insignia (bg-insignia-*-fondo + text-insignia-*-texto).
const COLORES_FONDO_ICONO: Record<PlantillaSugerida['color'], string> = {
  exito: 'bg-insignia-exito-fondo text-insignia-exito-texto',
  peligro: 'bg-insignia-peligro-fondo text-insignia-peligro-texto',
  advertencia: 'bg-insignia-advertencia-fondo text-insignia-advertencia-texto',
  info: 'bg-insignia-info-fondo text-insignia-info-texto',
  primario: 'bg-insignia-primario-fondo text-insignia-primario-texto',
  rosa: 'bg-insignia-rosa-fondo text-insignia-rosa-texto',
  cyan: 'bg-insignia-cyan-fondo text-insignia-cyan-texto',
  violeta: 'bg-insignia-violeta-fondo text-insignia-violeta-texto',
  naranja: 'bg-insignia-naranja-fondo text-insignia-naranja-texto',
}
