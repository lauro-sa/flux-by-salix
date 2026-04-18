'use client'

/**
 * Footer de acciones compartido por Modal, BottomSheet y ModalAdaptable.
 *
 * Define una API estructurada con 3 roles:
 *   - accionPrimaria   → botón principal (Guardar, Crear, Confirmar). Va a la derecha.
 *   - accionSecundaria → botón secundario (Cancelar). Va a la derecha, pegado a primaria.
 *   - accionPeligro    → botón destructivo (Eliminar, Descartar). Va a la izquierda.
 *
 * Primaria + secundaria se renderizan dentro de un <GrupoBotones> para que
 * queden visualmente juntas con caras internas planas (estilo toolbar Odoo/Linear).
 *
 * Estados cruzados automáticos: mientras una acción está cargando, las otras
 * quedan deshabilitadas para evitar clicks paralelos.
 *
 * Escape hatch: los componentes que lo usan siguen aceptando el prop `acciones`
 * (ReactNode) para casos donde se necesita un layout 100% custom (>3 botones,
 * grupos múltiples, etc.).
 */

import type { ReactNode } from 'react'
import { Boton } from '@/componentes/ui/Boton'
import { GrupoBotones } from '@/componentes/ui/GrupoBotones'

/** Descriptor de una acción de footer de modal. */
interface AccionModal {
  etiqueta: string
  onClick: () => void | Promise<void>
  /** Mostrar spinner + deshabilitar click */
  cargando?: boolean
  /** Deshabilitar (además de lo que se calcula automáticamente por cargando cruzado) */
  disabled?: boolean
  /** Ícono opcional a la izquierda del texto */
  icono?: ReactNode
}

interface PropiedadesFooterAcciones {
  primaria?: AccionModal
  secundaria?: AccionModal
  peligro?: AccionModal
}

/**
 * Renderiza el footer estándar. Devuelve `null` si no hay ninguna acción
 * estructurada (para que el componente padre pueda decidir no renderizar
 * el contenedor del footer).
 */
function FooterAccionesModal({ primaria, secundaria, peligro }: PropiedadesFooterAcciones) {
  if (!primaria && !secundaria && !peligro) return null

  // Mientras una acción cargue, las otras quedan deshabilitadas (evita doble click)
  const algunaCargando = !!(primaria?.cargando || secundaria?.cargando || peligro?.cargando)

  return (
    <div className="flex items-center justify-between w-full gap-3">
      {/* Izquierda: acción de peligro (opcional) */}
      <div>
        {peligro && (
          <Boton
            variante="peligro"
            tamano="sm"
            icono={peligro.icono}
            onClick={peligro.onClick}
            cargando={peligro.cargando}
            disabled={peligro.disabled || (algunaCargando && !peligro.cargando)}
          >
            {peligro.etiqueta}
          </Boton>
        )}
      </div>

      {/* Derecha: secundaria + primaria agrupadas */}
      {(primaria || secundaria) && (
        <GrupoBotones>
          {secundaria && (
            <Boton
              variante="secundario"
              tamano="sm"
              icono={secundaria.icono}
              onClick={secundaria.onClick}
              cargando={secundaria.cargando}
              disabled={secundaria.disabled || (algunaCargando && !secundaria.cargando)}
            >
              {secundaria.etiqueta}
            </Boton>
          )}
          {primaria && (
            <Boton
              variante="primario"
              tamano="sm"
              icono={primaria.icono}
              onClick={primaria.onClick}
              cargando={primaria.cargando}
              disabled={primaria.disabled || (algunaCargando && !primaria.cargando)}
            >
              {primaria.etiqueta}
            </Boton>
          )}
        </GrupoBotones>
      )}
    </div>
  )
}

export { FooterAccionesModal, type AccionModal, type PropiedadesFooterAcciones }
