'use client'

import type { ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronLeft, FlaskConical, History, Workflow } from 'lucide-react'
import { useTraduccion } from '@/lib/i18n'
import { Boton } from '@/componentes/ui/Boton'
import { Insignia, type ColorInsignia } from '@/componentes/ui/Insignia'
import { MiniSelectorIcono } from '@/componentes/ui/MiniSelectorIcono'
import { MenuFilaFlujo } from '../../_componentes/MenuFilaFlujo'
import IndicadorGuardado from './IndicadorGuardado'
import NombreFlujoEditable from './NombreFlujoEditable'
import { iconoLucideFlujo, resolverEstiloColorFlujo } from '@/lib/workflows/iconos-flujo'
import type { EstadoFlujo } from '@/tipos/workflow'
import type { FlujoEditable } from './hooks/useEditorFlujo'

/**
 * Header sticky del editor de flujos (sub-PR 19.2).
 *
 * Layout:
 *   [← Volver] [ícono] [nombre inline] [pill estado] [● borrador?] |
 *   [indicador guardado] [Probar] [Historial]
 *   [acciones contextuales] [tres puntos]
 *
 * Acciones contextuales (D15, ajustada por el coordinador):
 *   • borrador          → [Activar]
 *   • activo s/ borrador → ninguna  (Pausar va al menú tres puntos)
 *   • activo c/ borrador → [Publicar cambios] [Descartar cambios]
 *   • pausado s/ borrador → [Reactivar]
 *   • pausado c/ borrador → [Publicar cambios] [Descartar cambios]
 *                           (Reactivar va al menú tres puntos)
 *
 * "Probar" abre la consola sandbox como overlay (sub-PR 19.5).
 *
 * Los tabs "Editor" / "Historial" (sub-PR 19.6) cambian la vista
 * principal vía URL `?vista=...`. Cambiar tab NO descarta cambios
 * (el autoguardado del hook sigue corriendo). El estado activo se
 * representa con `aria-pressed` + estilo destacado.
 */

const COLOR_ESTADO: Record<EstadoFlujo, ColorInsignia> = {
  activo: 'exito',
  pausado: 'advertencia',
  borrador: 'neutro',
}

interface Props {
  flujo: FlujoEditable
  esBorradorInterno: boolean
  guardando: boolean
  ultimoGuardado: number | null
  /** Si el usuario solo tiene permiso de ver, el header se muestra
   *  pero deshabilita todas las acciones de mutación. */
  soloLectura: boolean
  onCambiarNombre: (nuevo: string) => void
  onCambiarIcono: (nuevo: string) => void
  // Acciones de mutación de estado (cada una llama un endpoint distinto)
  onActivar: () => void
  onPausar: () => void
  onPublicar: () => void
  onDescartarBorrador: () => void
  onDuplicar: () => void
  onEliminar: () => void
  // Sandbox (sub-PR 19.5) — overlay sobre cualquier vista
  onProbar: () => void
  // Tabs Editor / Historial (sub-PR 19.6)
  vista: 'editor' | 'historial'
  onCambiarVista: (vista: 'editor' | 'historial') => void
}

export default function HeaderEditorFlujo({
  flujo,
  esBorradorInterno,
  guardando,
  ultimoGuardado,
  soloLectura,
  onCambiarNombre,
  onCambiarIcono,
  onActivar,
  onPausar,
  onPublicar,
  onDescartarBorrador,
  onDuplicar,
  onEliminar,
  onProbar,
  vista,
  onCambiarVista,
}: Props) {
  const { t } = useTraduccion()
  const router = useRouter()
  const permisos = flujo.permisos ?? { editar: false, eliminar: false, activar: false }

  // Color para la bolita del MiniSelectorIcono. El helper acepta
  // tanto tokens (`violeta`, `exito`, …) como hex literal (`#7c3aed`),
  // que vienen del selector de color con gotero del modal "Desde cero".
  const colorIconoCss = resolverEstiloColorFlujo(flujo.color)

  // Acciones contextuales del header según estado + borrador interno.
  const accionesContextuales = (() => {
    if (soloLectura || !permisos.activar) return null
    if (esBorradorInterno) {
      return (
        <>
          <Boton variante="primario" tamano="sm" onClick={onPublicar}>
            {t('flujos.editor.accion.publicar')}
          </Boton>
          <Boton variante="secundario" tamano="sm" onClick={onDescartarBorrador}>
            {t('flujos.editor.accion.descartar')}
          </Boton>
        </>
      )
    }
    if (flujo.estado === 'borrador') {
      return (
        <Boton variante="primario" tamano="sm" onClick={onActivar}>
          {t('flujos.accion.activar')}
        </Boton>
      )
    }
    if (flujo.estado === 'pausado') {
      return (
        <Boton variante="primario" tamano="sm" onClick={onActivar}>
          {t('flujos.editor.accion.reactivar')}
        </Boton>
      )
    }
    return null
  })()

  return (
    <header
      className="sticky top-0 z-20 shrink-0 flex flex-wrap items-center gap-2 sm:gap-3 px-3 sm:px-6 py-3 min-h-[4.25rem] border-b border-borde-sutil bg-superficie-app/95 backdrop-blur-sm"
    >
      {/* Volver */}
      <Boton
        variante="fantasma"
        tamano="sm"
        icono={<ChevronLeft size={16} />}
        onClick={() => router.push('/flujos')}
        aria-label={t('flujos.editor.volver_listado')}
        className="shrink-0"
      >
        <span className="hidden sm:inline">{t('flujos.titulo')}</span>
      </Boton>

      <div className="hidden sm:block w-px h-6 bg-borde-sutil shrink-0" />

      {/* Ícono clickeable + nombre inline */}
      <div className="flex items-center gap-2 min-w-0 flex-1">
        <div className="shrink-0">
          {soloLectura ? (
            <span
              className="inline-flex items-center justify-center size-7 rounded-md border border-borde-sutil bg-superficie-tarjeta text-texto-secundario"
              style={{ color: colorIconoCss }}
              aria-hidden="true"
            >
              {(() => {
                const Icono = iconoLucideFlujo(flujo.icono)
                return <Icono size={14} strokeWidth={1.6} />
              })()}
            </span>
          ) : (
            <MiniSelectorIcono
              valor={flujo.icono ?? 'Workflow'}
              color={colorIconoCss}
              onChange={onCambiarIcono}
              titulo={t('flujos.editor.elegir_icono')}
            />
          )}
        </div>

        <NombreFlujoEditable
          valor={flujo.nombre}
          onCambiar={onCambiarNombre}
          soloLectura={soloLectura}
        />

        <Insignia color={COLOR_ESTADO[flujo.estado]} tamano="sm">
          {t(`flujos.estados.${flujo.estado}`)}
        </Insignia>

        {esBorradorInterno && (
          <span
            className="size-2 shrink-0 rounded-full bg-insignia-advertencia-texto"
            title={t('flujos.tooltip_borrador_pendiente')}
            aria-label={t('flujos.tooltip_borrador_pendiente')}
          />
        )}
      </div>

      {/* Indicador de guardado */}
      <IndicadorGuardado guardando={guardando} ultimoGuardado={ultimoGuardado} />

      {/* Tabs Editor / Historial (sub-PR 19.6).
          Toggle visual: el tab activo se destaca con `aria-pressed` +
          fondo sutil. Cambiar tab no descarta cambios — el editor
          mantiene su state aunque la vista esté oculta. */}
      <div
        role="tablist"
        aria-label={t('flujos.editor.tabs.aria_label')}
        className="flex items-center gap-0.5 rounded-md border border-borde-sutil bg-superficie-tarjeta p-0.5 shrink-0"
      >
        <TabBoton
          activo={vista === 'editor'}
          icono={<Workflow size={14} />}
          etiqueta={t('flujos.editor.tabs.editor')}
          onClick={() => onCambiarVista('editor')}
        />
        <TabBoton
          activo={vista === 'historial'}
          icono={<History size={14} />}
          etiqueta={t('flujos.editor.tabs.historial')}
          onClick={() => onCambiarVista('historial')}
        />
      </div>

      {/* Probar — abre la consola sandbox como overlay (sub-PR 19.5).
          Independiente de las tabs: se puede abrir tanto desde Editor
          como desde Historial. */}
      <Boton
        variante="fantasma"
        tamano="sm"
        icono={<FlaskConical size={14} />}
        onClick={onProbar}
        tooltip={t('flujos.editor.accion.probar_tooltip')}
      >
        <span className="hidden lg:inline">{t('flujos.editor.accion.probar')}</span>
      </Boton>

      {/* Acciones contextuales por estado */}
      {accionesContextuales && (
        <div className="flex items-center gap-2 shrink-0 ml-auto md:ml-0">{accionesContextuales}</div>
      )}

      {/* Tres puntos: Duplicar / Pausar(act) / Reactivar(pau) / Eliminar.
          Excluimos `editar` porque ya estás editando. */}
      <MenuFilaFlujo
        estado={flujo.estado}
        permisos={{
          editar: permisos.editar,
          eliminar: permisos.eliminar,
          activar: permisos.activar,
          // El editor se muestra a usuarios con permiso ver — `crear` no es
          // estrictamente necesario, pero "Duplicar" sí lo es. Lo derivamos
          // de `editar` (si podés editar, podés duplicar; el backend valida).
          crear: permisos.editar,
        }}
        excluirAcciones={['editar']}
        onEditar={() => undefined}
        onDuplicar={onDuplicar}
        onActivar={onActivar}
        onPausar={onPausar}
        onEliminar={onEliminar}
      />
    </header>
  )
}

// Tab compacto del switcher Editor/Historial. Toggle puro: el tab
// activo se ve destacado con fondo sutil + texto primario; el inactivo
// muestra solo ícono+texto secundario y reacciona a hover. La etiqueta
// se oculta en pantallas chicas para mantener el header compacto.
function TabBoton({
  activo,
  icono,
  etiqueta,
  onClick,
}: {
  activo: boolean
  icono: ReactNode
  etiqueta: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-pressed={activo}
      onClick={onClick}
      className={`flex items-center gap-1.5 px-2 sm:px-2.5 py-1 rounded text-xs font-medium transition-colors ${
        activo
          ? 'bg-superficie-hover text-texto-primario'
          : 'text-texto-terciario hover:text-texto-secundario hover:bg-superficie-hover/60'
      }`}
    >
      {icono}
      <span className="hidden md:inline">{etiqueta}</span>
    </button>
  )
}
