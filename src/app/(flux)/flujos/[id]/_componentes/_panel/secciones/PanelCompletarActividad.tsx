'use client'

import { useMemo } from 'react'
import { useTraduccion } from '@/lib/i18n'
import SeccionPanel from '../SeccionPanel'
import InputConVariables from '../../_picker/InputConVariables'
import SelectorTipoActividad from '../selectores/SelectorTipoActividad'
import SelectorMiembro from '../selectores/SelectorMiembro'
import SelectorPopoverBase, {
  type OpcionSelector,
} from '../selectores/SelectorPopoverBase'
import {
  PLANTILLAS_COMPLETAR_ACTIVIDAD,
  type PlantillaCompletarActividad,
} from '@/lib/workflows/plantillas-completar-actividad'
import {
  ENTIDADES_RELACIONABLES,
  type EntidadRelacionable,
} from '@/tipos/actividades-relaciones'
import type { ContextoVariables } from '@/lib/workflows/resolver-variables'
import type { FuenteVariables } from '@/lib/workflows/variables-disponibles'
import type {
  AccionCompletarActividad,
  AccionWorkflow,
} from '@/tipos/workflow'

/**
 * Panel para `accion: completar_actividad` (sub-PR 20.4).
 *
 * Estructura espejo de `PanelCrearActividad` (sub-PR 19.3b) con cuatro
 * secciones:
 *   1. CRITERIO (abierto): tipo de actividad, vinculada a entidad,
 *      contacto, asignado, estado actual.
 *   2. COMPORTAMIENTO (abierto): si_multiple, si_no_encuentra.
 *   3. PLANTILLAS (default override por estado): cuatro plantillas
 *      curadas. Arranca abierta cuando `criterio` está vacío para guiar
 *      al usuario a un punto de partida; arranca colapsada cuando ya
 *      hay algún filtro seteado para no estorbar la edición.
 *   4. AVANZADO (cerrado): motivo (con variables), continuar_si_falla.
 *
 * Validación inline: replica la regla del validador del 20.1 (al menos
 * `tipo_actividad_id` o `relacionada_a` presente). Si la regla cambia
 * en `validacion-flujo.ts`, hay que mantener paridad acá — el banner
 * global del editor (sub-PR 19.4) sigue siendo la fuente de verdad
 * para errores de publicación.
 */

interface Props {
  paso: AccionCompletarActividad
  soloLectura: boolean
  onCambiar: (parche: Partial<AccionWorkflow>) => void
  fuentes: FuenteVariables[]
  contexto: ContextoVariables
}

const ESTADOS_CANONICOS = ['pendiente', 'completada', 'cancelada'] as const
type EstadoCanonico = (typeof ESTADOS_CANONICOS)[number]

const SI_MULTIPLE_OPCIONES: ReadonlyArray<
  AccionCompletarActividad['criterio']['si_multiple']
> = ['mas_antigua', 'mas_reciente', 'todas', 'fallar']

const SI_NO_ENCUENTRA_OPCIONES: ReadonlyArray<
  NonNullable<AccionCompletarActividad['criterio']['si_no_encuentra']>
> = ['continuar', 'fallar']

export default function PanelCompletarActividad({
  paso,
  soloLectura,
  onCambiar,
  fuentes,
  contexto,
}: Props) {
  const { t } = useTraduccion()
  const c = paso.criterio

  // El estado del shape acepta cualquier string; en UI curamos a 3
  // canónicos (pendiente / completada / cancelada). Si en BD hay un
  // valor custom seteado por edición JSON, lo respetamos como `pendiente`
  // de visualización y ofrecemos pasar a uno canónico al editar.
  const estadoActual: EstadoCanonico =
    c.estado_clave && (ESTADOS_CANONICOS as readonly string[]).includes(c.estado_clave)
      ? (c.estado_clave as EstadoCanonico)
      : 'pendiente'

  const cambiarCriterio = (
    parche: Partial<AccionCompletarActividad['criterio']>,
  ) => {
    const nuevo = { ...c, ...parche }
    onCambiar({ criterio: nuevo } as Partial<AccionWorkflow>)
  }

  const aplicarPlantilla = (p: PlantillaCompletarActividad) => {
    // Pisamos el criterio entero: el contrato de "plantilla" es punto
    // de partida limpio. El usuario edita después si quiere.
    onCambiar({ criterio: { ...p.criterio } } as Partial<AccionWorkflow>)
  }

  // PLANTILLAS arranca abierta si no hay filtros POSITIVOS del user
  // (tipo de actividad o entidad vinculada). Defaults de comportamiento
  // (estado='pendiente', si_multiple, si_no_encuentra) NO cuentan: son
  // valores iniciales del shape, no decisiones del usuario. Asignado y
  // contacto tampoco — son refinamientos, no filtros estructurales.
  const criterioVacio = useMemo(() => {
    return !c.tipo_actividad_id && !c.relacionada_a
  }, [c.tipo_actividad_id, c.relacionada_a])

  // Validación inline: misma regla que el validador pre-publicar.
  // Si el editor sigue dejando publicar igual (modelo "publicar tira
  // 422"), este mensaje es la advertencia temprana al lado del campo.
  const errorFiltroPositivo =
    !c.tipo_actividad_id && !c.relacionada_a
      ? t('flujos.editor.panel.completar_actividad.error_filtro_positivo')
      : null

  return (
    <>
      <SeccionPanel titulo={t('flujos.editor.panel.seccion.criterio')}>
        {/* Tipo de actividad */}
        <div className="flex flex-col gap-1">
          <span className="text-sm font-medium text-texto-secundario">
            {t('flujos.editor.panel.completar_actividad.tipo_id_label')}
          </span>
          <SelectorTipoActividad
            valor={c.tipo_actividad_id ?? null}
            onChange={(id) => cambiarCriterio({ tipo_actividad_id: id })}
            disabled={soloLectura}
          />
          <p className="text-xs text-texto-terciario leading-relaxed">
            {t('flujos.editor.panel.completar_actividad.tipo_id_ayuda')}
          </p>
        </div>

        {/* Relacionada a — pills entidad_tipo */}
        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-texto-secundario">
            {t('flujos.editor.panel.completar_actividad.relacionada_label')}
          </span>
          <SelectorEntidadRelacionada
            valor={c.relacionada_a?.entidad_tipo ?? null}
            soloLectura={soloLectura}
            onChange={(tipo) => {
              if (tipo === null) {
                cambiarCriterio({ relacionada_a: undefined })
              } else {
                cambiarCriterio({
                  relacionada_a: {
                    entidad_tipo: tipo,
                    entidad_id: c.relacionada_a?.entidad_id ?? '{{entidad.id}}',
                  },
                })
              }
            }}
            t={t}
          />
          {c.relacionada_a && (
            <div className="mt-1 flex flex-col gap-1">
              <span className="text-xs font-medium text-texto-secundario">
                {t('flujos.editor.panel.completar_actividad.relacionada_entidad_id_label')}
              </span>
              <InputConVariables
                valor={c.relacionada_a.entidad_id}
                onChange={(v) =>
                  cambiarCriterio({
                    relacionada_a: c.relacionada_a
                      ? { ...c.relacionada_a, entidad_id: v }
                      : undefined,
                  })
                }
                placeholder={t(
                  'flujos.editor.panel.completar_actividad.relacionada_entidad_id_placeholder',
                )}
                contexto={contexto}
                fuentes={fuentes}
                soloLectura={soloLectura}
                ariaLabel={t(
                  'flujos.editor.panel.completar_actividad.relacionada_entidad_id_label',
                )}
              />
            </div>
          )}
          <p className="text-xs text-texto-terciario leading-relaxed">
            {t('flujos.editor.panel.completar_actividad.relacionada_ayuda')}
          </p>
          {/* Validación inline cerca del primer campo afectado: avisa
              cuando ni `tipo_actividad_id` ni `relacionada_a` están
              seteados. El banner global del editor (sub-PR 19.4) sigue
              siendo la fuente de verdad para errores de publicación. */}
          {errorFiltroPositivo && (
            <p
              role="status"
              className="text-xs text-insignia-peligro-texto leading-relaxed"
            >
              {errorFiltroPositivo}
            </p>
          )}
        </div>

        {/* Contacto */}
        <div className="flex flex-col gap-1">
          <span className="text-sm font-medium text-texto-secundario">
            {t('flujos.editor.panel.completar_actividad.contacto_label')}
          </span>
          <InputConVariables
            valor={c.contacto_id ?? ''}
            onChange={(v) =>
              cambiarCriterio({ contacto_id: v.length > 0 ? v : undefined })
            }
            placeholder={t(
              'flujos.editor.panel.completar_actividad.contacto_placeholder',
            )}
            contexto={contexto}
            fuentes={fuentes}
            soloLectura={soloLectura}
            ariaLabel={t('flujos.editor.panel.completar_actividad.contacto_label')}
          />
        </div>

        {/* Asignado a */}
        <div className="flex flex-col gap-1">
          <span className="text-sm font-medium text-texto-secundario">
            {t('flujos.editor.panel.completar_actividad.asignado_label')}
          </span>
          <SelectorMiembro
            valor={c.asignado_id ?? null}
            onChange={(id) => cambiarCriterio({ asignado_id: id })}
            disabled={soloLectura}
          />
        </div>

        {/* Estado actual de la actividad — pills de 3 opciones canónicas */}
        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-texto-secundario">
            {t('flujos.editor.panel.completar_actividad.estado_label')}
          </span>
          <PillsExclusivos
            valor={estadoActual}
            opciones={ESTADOS_CANONICOS.map((e) => ({
              valor: e,
              etiqueta: t(`flujos.editor.panel.completar_actividad.estado_${e}`),
            }))}
            onChange={(v) => cambiarCriterio({ estado_clave: v })}
            soloLectura={soloLectura}
          />
        </div>
      </SeccionPanel>

      <SeccionPanel titulo={t('flujos.editor.panel.seccion.comportamiento')}>
        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-texto-secundario">
            {t('flujos.editor.panel.completar_actividad.si_multiple_label')}
          </span>
          <PillsExclusivos
            valor={c.si_multiple}
            opciones={SI_MULTIPLE_OPCIONES.map((v) => ({
              valor: v,
              etiqueta: t(`flujos.editor.panel.completar_actividad.si_multiple_${v}`),
            }))}
            onChange={(v) =>
              cambiarCriterio({
                si_multiple: v as AccionCompletarActividad['criterio']['si_multiple'],
              })
            }
            soloLectura={soloLectura}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-texto-secundario">
            {t('flujos.editor.panel.completar_actividad.si_no_encuentra_label')}
          </span>
          <PillsExclusivos
            valor={c.si_no_encuentra ?? 'continuar'}
            opciones={SI_NO_ENCUENTRA_OPCIONES.map((v) => ({
              valor: v,
              etiqueta: t(`flujos.editor.panel.completar_actividad.si_no_encuentra_${v}`),
            }))}
            onChange={(v) =>
              cambiarCriterio({
                si_no_encuentra:
                  v as NonNullable<AccionCompletarActividad['criterio']['si_no_encuentra']>,
              })
            }
            soloLectura={soloLectura}
          />
        </div>
      </SeccionPanel>

      <SeccionPanel
        titulo={t('flujos.editor.panel.seccion.plantillas')}
        defaultAbierto={criterioVacio}
      >
        <p className="text-xs text-texto-terciario leading-relaxed">
          {t('flujos.editor.panel.completar_actividad.plantillas_ayuda')}
        </p>
        <div className="grid grid-cols-1 gap-2">
          {PLANTILLAS_COMPLETAR_ACTIVIDAD.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => !soloLectura && aplicarPlantilla(p)}
              disabled={soloLectura}
              className={[
                'flex flex-col gap-1 text-left rounded-md border border-borde-sutil',
                'px-3 py-2.5 transition-colors',
                soloLectura
                  ? 'cursor-not-allowed opacity-60'
                  : 'cursor-pointer hover:bg-superficie-hover hover:border-borde-fuerte',
              ].join(' ')}
            >
              <span className="text-sm font-medium text-texto-primario">
                {t(
                  `flujos.editor.panel.completar_actividad.plantilla.${p.id}.titulo`,
                )}
              </span>
              <span className="text-xs text-texto-terciario leading-relaxed">
                {t(
                  `flujos.editor.panel.completar_actividad.plantilla.${p.id}.descripcion`,
                )}
              </span>
            </button>
          ))}
        </div>
      </SeccionPanel>

      <SeccionPanel
        titulo={t('flujos.editor.panel.seccion.avanzado')}
        defaultAbierto={false}
      >
        <div className="flex flex-col gap-1">
          <span className="text-sm font-medium text-texto-secundario">
            {t('flujos.editor.panel.completar_actividad.motivo_label')}
          </span>
          <InputConVariables
            valor={paso.motivo ?? ''}
            onChange={(v) =>
              onCambiar({ motivo: v.length > 0 ? v : undefined } as Partial<AccionWorkflow>)
            }
            placeholder={t(
              'flujos.editor.panel.completar_actividad.motivo_placeholder',
            )}
            contexto={contexto}
            fuentes={fuentes}
            soloLectura={soloLectura}
            ariaLabel={t('flujos.editor.panel.completar_actividad.motivo_label')}
          />
          <p className="text-xs text-texto-terciario leading-relaxed">
            {t('flujos.editor.panel.completar_actividad.motivo_ayuda')}
          </p>
        </div>

        <label className="flex items-start gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={paso.continuar_si_falla === true}
            onChange={(e) =>
              onCambiar({
                continuar_si_falla: e.target.checked,
              } as Partial<AccionWorkflow>)
            }
            disabled={soloLectura}
            className="mt-0.5 cursor-pointer"
          />
          <span className="flex flex-col gap-0.5">
            <span className="text-sm text-texto-primario">
              {t('flujos.editor.panel.avanzado.continuar_si_falla_label')}
            </span>
            <span className="text-xs text-texto-terciario leading-relaxed">
              {t('flujos.editor.panel.avanzado.continuar_si_falla_ayuda')}
            </span>
          </span>
        </label>
      </SeccionPanel>
    </>
  )
}

// =============================================================
// Sub-componentes locales (no se reusan fuera del panel todavía)
// =============================================================

interface OpcionPill {
  valor: string
  etiqueta: string
}

/**
 * Pills mutuamente exclusivas siguiendo el patrón de `PanelBranch`
 * (operador Y/O). Si un futuro panel necesita el mismo control,
 * conviene extraerlo a `_panel/PillsExclusivos.tsx`.
 */
function PillsExclusivos({
  valor,
  opciones,
  onChange,
  soloLectura,
}: {
  valor: string
  opciones: OpcionPill[]
  onChange: (v: string) => void
  soloLectura: boolean
}) {
  return (
    <div className="inline-flex flex-wrap rounded-md border border-borde-sutil overflow-hidden">
      {opciones.map((op, i) => {
        const activo = op.valor === valor
        return (
          <button
            key={op.valor}
            type="button"
            onClick={() => !soloLectura && onChange(op.valor)}
            disabled={soloLectura}
            className={[
              'px-3 py-1 text-xs font-medium transition-colors',
              i > 0 ? 'border-l border-borde-sutil' : '',
              activo
                ? 'bg-texto-marca/15 text-texto-marca'
                : 'text-texto-secundario hover:bg-superficie-hover',
              soloLectura ? 'cursor-not-allowed opacity-70' : 'cursor-pointer',
            ].join(' ')}
            aria-pressed={activo}
          >
            {op.etiqueta}
          </button>
        )
      })}
    </div>
  )
}

/**
 * Selector de "vinculada a": SelectorPopoverBase con 1 opción "Sin
 * vínculo" + 1 opción por cada `EntidadRelacionable` del set cerrado
 * (sub-PR 20.2). 11 opciones es demasiado para pills (CLAUDE.md: >5
 * opciones → seleccion-compacto), así que vive como popover con
 * buscador.
 *
 * "Sin vínculo" funciona como placeholder cuando no hay selección y
 * como opción del popover para volver a deseleccionar. Las etiquetas
 * legibles se reusan de `cambiar_estado.entidad.*` para los 9 tipos
 * `EntidadConEstado` (ya traducidos en es/en/pt) y se suma `contacto`
 * con clave dedicada.
 */
function SelectorEntidadRelacionada({
  valor,
  soloLectura,
  onChange,
  t,
}: {
  valor: string | null
  soloLectura: boolean
  onChange: (tipo: EntidadRelacionable | null) => void
  t: (clave: string) => string
}) {
  const etiquetaSinVinculo = t(
    'flujos.editor.panel.completar_actividad.relacionada_ninguna',
  )
  const etiquetaContacto = t(
    'flujos.editor.panel.completar_actividad.entidad_contacto',
  )

  const opciones: OpcionSelector[] = [
    { id: '__ninguna__', etiqueta: etiquetaSinVinculo },
    ...ENTIDADES_RELACIONABLES.map((e) => ({
      id: e,
      etiqueta:
        e === 'contacto'
          ? etiquetaContacto
          : t(`flujos.editor.panel.cambiar_estado.entidad.${e}`),
    })),
  ]

  const seleccionada =
    valor === null ? null : (opciones.find((o) => o.id === valor) ?? null)

  return (
    <SelectorPopoverBase
      placeholder={etiquetaSinVinculo}
      seleccionada={seleccionada}
      opciones={opciones}
      onSeleccionar={(op) =>
        onChange(
          op.id === '__ninguna__' ? null : (op.id as EntidadRelacionable),
        )
      }
      disabled={soloLectura}
    />
  )
}
