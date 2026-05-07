'use client'

import { useState } from 'react'
import { MoreVertical, Edit3, Eye, Copy, Play, Pause, Trash2 } from 'lucide-react'
import { Popover } from '@/componentes/ui/Popover'
import { OpcionMenu } from '@/componentes/ui/OpcionMenu'
import { useTraduccion } from '@/lib/i18n'
import type { EstadoFlujo } from '@/tipos/workflow'

/**
 * MenuFilaFlujo — Menú "tres puntos" por fila del listado de flujos.
 *
 * Acciones (orden plan UX §1.4): Editar / Duplicar / Activar o Pausar /
 * Eliminar. La acción Activar/Pausar es excluyente según `estado`:
 *   - Borrador → "Activar" (publica + activa atómicamente, ver PR 18.2).
 *   - Activo   → "Pausar".
 *   - Pausado  → "Activar" (reanudar).
 *
 * Permisos UI condicionales (decisión §1.4.4 del plan):
 *   - Sin `editar` → "Editar" se reemplaza por "Ver".
 *   - Sin `eliminar` → ítem oculto.
 *   - Sin `activar` → ítems Activar/Pausar ocultos.
 *   - Sin `crear` → ítem "Duplicar" oculto (duplicar requiere crear).
 */

/**
 * Acciones que el menú puede ofrecer. Sirve como llave del prop
 * opcional `excluirAcciones` para suprimir ítems desde el llamador
 * sin tener que componer un menú alternativo. Patrón additivo —
 * preserva el comportamiento default del listado (D13 del plan UX 19.2).
 */
type AccionMenuFlujo = 'editar' | 'duplicar' | 'activar-pausar' | 'eliminar'

interface Props {
  estado: EstadoFlujo
  permisos: {
    editar: boolean
    eliminar: boolean
    activar: boolean
    crear: boolean
  }
  onEditar: () => void
  onDuplicar: () => void
  onActivar: () => void
  onPausar: () => void
  onEliminar: () => void
  /**
   * Acciones a ocultar aunque haya permiso. Útil cuando el menú vive
   * dentro de un contexto que ya provee la acción (ej: el header del
   * editor visual oculta `editar` porque el usuario ya está editando).
   *
   * Default: no excluye nada, comportamiento idéntico a antes del
   * sub-PR 19.2.
   */
  excluirAcciones?: ReadonlyArray<AccionMenuFlujo>
}

export function MenuFilaFlujo({
  estado,
  permisos,
  onEditar,
  onDuplicar,
  onActivar,
  onPausar,
  onEliminar,
  excluirAcciones,
}: Props) {
  const { t } = useTraduccion()
  const [abierto, setAbierto] = useState(false)

  function cerrarYEjecutar(fn: () => void) {
    setAbierto(false)
    fn()
  }

  const excluido = (a: AccionMenuFlujo) => excluirAcciones?.includes(a) ?? false

  return (
    <Popover
      abierto={abierto}
      onCambio={setAbierto}
      ancho={200}
      alineacion="fin"
      contenido={
        <div className="py-1.5 px-1.5">
          {!excluido('editar') && (
            <OpcionMenu
              icono={permisos.editar ? <Edit3 size={14} /> : <Eye size={14} />}
              onClick={() => cerrarYEjecutar(onEditar)}
            >
              {permisos.editar ? t('flujos.accion.editar') : t('flujos.accion.ver')}
            </OpcionMenu>
          )}
          {!excluido('duplicar') && permisos.crear && (
            <OpcionMenu icono={<Copy size={14} />} onClick={() => cerrarYEjecutar(onDuplicar)}>
              {t('flujos.accion.duplicar')}
            </OpcionMenu>
          )}
          {!excluido('activar-pausar') && permisos.activar && estado !== 'activo' && (
            <OpcionMenu icono={<Play size={14} />} onClick={() => cerrarYEjecutar(onActivar)}>
              {t('flujos.accion.activar')}
            </OpcionMenu>
          )}
          {!excluido('activar-pausar') && permisos.activar && estado === 'activo' && (
            <OpcionMenu icono={<Pause size={14} />} onClick={() => cerrarYEjecutar(onPausar)}>
              {t('flujos.accion.pausar')}
            </OpcionMenu>
          )}
          {!excluido('eliminar') && permisos.eliminar && (
            <OpcionMenu peligro icono={<Trash2 size={14} />} onClick={() => cerrarYEjecutar(onEliminar)}>
              {t('flujos.accion.eliminar')}
            </OpcionMenu>
          )}
        </div>
      }
    >
      <button
        type="button"
        onClick={(e) => e.stopPropagation()}
        aria-label={t('comun.acciones')}
        className="flex items-center justify-center size-7 rounded-boton border border-transparent bg-transparent text-texto-terciario cursor-pointer hover:bg-superficie-hover hover:text-texto-secundario transition-colors"
      >
        <MoreVertical size={16} />
      </button>
    </Popover>
  )
}
