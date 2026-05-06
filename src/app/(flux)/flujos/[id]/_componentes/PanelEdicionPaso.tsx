'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { Eye } from 'lucide-react'
import { useTraduccion } from '@/lib/i18n'
import {
  iconoDefaultAccion,
  iconoDefaultDisparador,
} from '@/lib/workflows/iconos-flujo'
import { etiquetaDisparador } from '@/lib/workflows/etiquetas-disparador'
import { etiquetaAccion } from '@/lib/workflows/etiquetas-accion'
import { posicionPaso } from '@/lib/workflows/posicion-paso'
import { variablesDisponibles } from '@/lib/workflows/variables-disponibles'
import HeaderPanel from './_panel/HeaderPanel'
import SubHeaderPanel from './_panel/SubHeaderPanel'
import FooterPanel from './_panel/FooterPanel'
import PanelEsperar from './_panel/secciones/PanelEsperar'
import PanelTerminar from './_panel/secciones/PanelTerminar'
import PanelDisparadorCron from './_panel/secciones/PanelDisparadorCron'
import PanelDisparadorActividadCompletada from './_panel/secciones/PanelDisparadorActividadCompletada'
import PanelEnviarWhatsApp from './_panel/secciones/PanelEnviarWhatsApp'
import PanelNotificarUsuario from './_panel/secciones/PanelNotificarUsuario'
import PanelCrearActividad from './_panel/secciones/PanelCrearActividad'
import PanelCambiarEstado from './_panel/secciones/PanelCambiarEstado'
import PanelBranch from './_panel/secciones/PanelBranch'
import PanelAsignarUsuario from './_panel/secciones/PanelAsignarUsuario'
import PanelEtiqueta from './_panel/secciones/PanelEtiqueta'
import PanelNotificarGrupo from './_panel/secciones/PanelNotificarGrupo'
import PanelEnviarWhatsAppTexto from './_panel/secciones/PanelEnviarWhatsAppTexto'
import PanelEnviarCorreoTexto from './_panel/secciones/PanelEnviarCorreoTexto'
import PanelDisparadorEntidadEstadoCambio from './_panel/secciones/PanelDisparadorEntidadEstadoCambio'
import PanelDisparadorEntidadCreada from './_panel/secciones/PanelDisparadorEntidadCreada'
import PanelDisparadorEntidadCampoCambia from './_panel/secciones/PanelDisparadorEntidadCampoCambia'
import PanelDisparadorRelativoACampo from './_panel/secciones/PanelDisparadorRelativoACampo'
import PanelTipoPendiente from './_panel/secciones/PanelTipoPendiente'
import { usePreviewContexto } from './_picker/usePreviewContexto'
import type { AccionConId } from '@/lib/workflows/ids-pasos'
import type {
  AccionCambiarEstadoEntidad,
  AccionCondicionBranch,
  AccionCrearActividad,
  AccionEnviarWhatsappPlantilla,
  AccionEsperar,
  AccionGenerica,
  AccionNotificarUsuario,
  AccionTerminarFlujo,
  AccionWorkflow,
  DisparadorActividadCompletada,
  DisparadorEntidadCampoCambia,
  DisparadorEntidadCreada,
  DisparadorEntidadEstadoCambio,
  DisparadorTiempoCron,
  DisparadorTiempoRelativoACampo,
  DisparadorWorkflow,
  TipoAccion,
  TipoDisparador,
} from '@/tipos/workflow'
import type { EntidadConEstado } from '@/tipos/estados'

/**
 * Panel lateral derecho del editor visual de flujos.
 *
 * Sub-PR 19.3a — shell + 4 tipos básicos (esperar, terminar_flujo,
 *                tiempo.cron, actividad.completada).
 * Sub-PR 19.3b — agrega 4 acciones (whatsapp, notificar_usuario,
 *                crear_actividad, cambiar_estado_entidad) + 4 disparadores
 *                (entidad.estado_cambio, entidad.creada,
 *                entidad.campo_cambia, tiempo.relativo_a_campo).
 *                También: nombre editable inline + carga de contexto
 *                preview vía `usePreviewContexto`.
 *
 * Tipos no cubiertos todavía caen en `PanelTipoPendiente`. Branch +
 * mobile bottom-sheet + tipos genéricos restantes llegan en 19.3c.
 *
 * El componente NO toca la mecánica de apertura/cierre — la sigue
 * gestionando `EditorFlujo` vía las props `abierto` + `onCerrar`.
 */

type Seleccion =
  | { tipo: 'disparador' }
  | { tipo: 'paso'; id: string }

interface Props {
  flujoId: string
  abierto: boolean
  onCerrar: () => void
  seleccion: Seleccion | null
  /** Disparador actual del flujo (jsonb opaco, narrowing en runtime). */
  disparador:
    | { tipo?: TipoDisparador; configuracion?: Record<string, unknown>; etiqueta?: string }
    | null
  /** Árbol de pasos con ids estables (raíz). */
  pasosRaiz: AccionConId[]
  soloLectura: boolean
  onActualizarPaso: (id: string, parche: Partial<AccionWorkflow>) => void
  onEliminarPaso: (id: string) => void
  onActualizarDisparador: (parche: Partial<DisparadorWorkflow>) => void
}

export default function PanelEdicionPaso({
  flujoId,
  abierto,
  onCerrar,
  seleccion,
  disparador,
  pasosRaiz,
  soloLectura,
  onActualizarPaso,
  onEliminarPaso,
  onActualizarDisparador,
}: Props) {
  const { t } = useTraduccion()

  // Contexto de preview cargado del backend. Re-fetch cuando cambia
  // tipoDisparador (caveat del coordinador implementado en el hook).
  const { contexto } = usePreviewContexto({
    flujoId,
    tipoDisparador: disparador?.tipo ?? null,
  })

  // Fuentes de variables disponibles según disparador (función pura).
  const { fuentes } = variablesDisponibles(disparador)

  // Tipo-entidad del disparador para que paneles tipo `cambiar_estado_entidad`
  // puedan auto-llenar cuando el flujo es entidad-bound.
  const tipoEntidadDisparador = (() => {
    if (!disparador?.configuracion) return null
    const t = (disparador.configuracion as Record<string, unknown>).entidad_tipo
    return typeof t === 'string' ? (t as EntidadConEstado) : null
  })()

  // Datos derivados de la selección actual.
  const datos = (() => {
    if (!seleccion) return null

    if (seleccion.tipo === 'disparador') {
      const tipo = (disparador?.tipo ?? null) as TipoDisparador | null
      const Icono = tipo ? iconoDefaultDisparador(tipo) : null
      const fallbackTitulo = tipo
        ? etiquetaDisparador(t, tipo)
        : t('flujos.editor.panel.titulo_default')
      return {
        modo: 'disparador' as const,
        Icono,
        etiqueta: disparador?.etiqueta,
        fallbackTitulo,
        tipo,
      }
    }

    const paso = encontrarPaso(pasosRaiz, seleccion.id)
    const tipo = (paso?.tipo ?? null) as TipoAccion | null
    const Icono = tipo ? iconoDefaultAccion(tipo) : null
    const fallbackTitulo = tipo
      ? etiquetaAccion(t, tipo)
      : t('flujos.editor.panel.titulo_default')
    const posicion = posicionPaso(pasosRaiz, seleccion.id)
    return {
      modo: 'paso' as const,
      Icono,
      etiqueta: paso?.etiqueta,
      fallbackTitulo,
      tipo,
      paso,
      posicion,
    }
  })()

  // Handler de edición de la etiqueta (campo `etiqueta?: string`).
  // Para paso → mutamos el paso por id. Para disparador → mergeamos
  // sobre el disparador actual.
  const onCambiarEtiqueta = (nueva: string) => {
    if (!seleccion || soloLectura) return
    const valor = nueva.length > 0 ? nueva : undefined
    if (seleccion.tipo === 'paso') {
      onActualizarPaso(seleccion.id, { etiqueta: valor } as Partial<AccionWorkflow>)
    } else if (disparador) {
      // Reusar disparador actual + mergear etiqueta. El padre acepta el
      // shape entero (escribe en `flujo.disparador`).
      onActualizarDisparador({
        ...(disparador as DisparadorWorkflow),
        etiqueta: valor,
      } as DisparadorWorkflow)
    }
  }

  return (
    <AnimatePresence>
      {abierto && datos && (
        <motion.aside
          initial={{ x: '100%', opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: '100%', opacity: 0 }}
          transition={{ duration: 0.18, ease: 'easeOut' }}
          className="fixed inset-y-0 right-0 z-30 w-full md:w-[480px] bg-superficie-app border-l border-borde-sutil flex flex-col shadow-2xl"
          role="dialog"
          aria-label={datos.fallbackTitulo}
        >
          <HeaderPanel
            Icono={datos.Icono}
            etiqueta={datos.etiqueta}
            fallbackTitulo={datos.fallbackTitulo}
            soloLectura={soloLectura}
            onCambiarEtiqueta={onCambiarEtiqueta}
            onCerrar={onCerrar}
          />

          {datos.modo === 'paso' ? (
            <SubHeaderPanel
              modo="paso"
              tipoLegible={datos.fallbackTitulo}
              posicion={datos.posicion}
            />
          ) : (
            <SubHeaderPanel modo="disparador" tipoLegible={datos.fallbackTitulo} />
          )}

          {soloLectura && (
            <div
              role="status"
              className="shrink-0 flex items-center gap-2 px-4 py-2.5 bg-superficie-tarjeta border-b border-borde-sutil text-xs text-texto-secundario"
            >
              <Eye size={14} className="shrink-0 text-texto-terciario" />
              {t('flujos.editor.panel.banner_lectura')}
            </div>
          )}

          <div className="flex-1 overflow-y-auto">
            {datos.modo === 'disparador'
              ? renderDisparador({
                  tipo: datos.tipo,
                  disparadorRaw: disparador,
                  soloLectura,
                  onCambiar: onActualizarDisparador,
                  fallbackTitulo: datos.fallbackTitulo,
                })
              : renderPaso({
                  paso: datos.paso ?? null,
                  soloLectura,
                  onCambiar: (parche) => {
                    if (seleccion?.tipo === 'paso') onActualizarPaso(seleccion.id, parche)
                  },
                  fallbackTitulo: datos.fallbackTitulo,
                  fuentes,
                  contexto,
                  tipoEntidadDisparador,
                })}
          </div>

          <FooterPanel
            modo={datos.modo}
            soloLectura={soloLectura}
            onCerrar={onCerrar}
            onEliminar={() => {
              if (seleccion?.tipo === 'paso') {
                onEliminarPaso(seleccion.id)
              }
            }}
          />
        </motion.aside>
      )}
    </AnimatePresence>
  )
}

// =============================================================
// Render del cuerpo según tipo
// =============================================================

interface RenderDisparadorArgs {
  tipo: TipoDisparador | null
  disparadorRaw:
    | { tipo?: TipoDisparador; configuracion?: Record<string, unknown>; etiqueta?: string }
    | null
  soloLectura: boolean
  onCambiar: (parche: Partial<DisparadorWorkflow>) => void
  fallbackTitulo: string
}

function renderDisparador(args: RenderDisparadorArgs) {
  const { tipo, disparadorRaw, soloLectura, onCambiar, fallbackTitulo } = args

  if (!tipo || !disparadorRaw) {
    return <PanelTipoPendiente tipoLegible={fallbackTitulo} />
  }
  const cfg = (disparadorRaw.configuracion ?? {}) as Record<string, unknown>

  if (tipo === 'tiempo.cron') {
    const expresion = typeof cfg.expresion === 'string' ? cfg.expresion : '0 9 * * *'
    return (
      <PanelDisparadorCron
        disparador={{ tipo: 'tiempo.cron', configuracion: { expresion } }}
        soloLectura={soloLectura}
        onCambiar={onCambiar}
      />
    )
  }

  if (tipo === 'actividad.completada') {
    const tipoClave = cfg.tipo_clave
    const disparador: DisparadorActividadCompletada = {
      tipo: 'actividad.completada',
      configuracion: typeof tipoClave === 'string' ? { tipo_clave: tipoClave } : {},
    }
    return (
      <PanelDisparadorActividadCompletada
        disparador={disparador}
        soloLectura={soloLectura}
        onCambiar={onCambiar}
      />
    )
  }

  if (tipo === 'entidad.estado_cambio') {
    const disparador: DisparadorEntidadEstadoCambio = {
      tipo: 'entidad.estado_cambio',
      configuracion: {
        entidad_tipo: (cfg.entidad_tipo as EntidadConEstado) ?? 'presupuesto',
        hasta_clave: typeof cfg.hasta_clave === 'string' ? cfg.hasta_clave : '',
        desde_clave: typeof cfg.desde_clave === 'string' ? cfg.desde_clave : null,
      },
    }
    return (
      <PanelDisparadorEntidadEstadoCambio
        disparador={disparador}
        soloLectura={soloLectura}
        onCambiar={onCambiar}
      />
    )
  }

  if (tipo === 'entidad.creada') {
    const disparador: DisparadorEntidadCreada = {
      tipo: 'entidad.creada',
      configuracion: {
        entidad_tipo: (cfg.entidad_tipo as EntidadConEstado) ?? 'presupuesto',
      },
    }
    return (
      <PanelDisparadorEntidadCreada
        disparador={disparador}
        soloLectura={soloLectura}
        onCambiar={onCambiar}
      />
    )
  }

  if (tipo === 'entidad.campo_cambia') {
    const disparador: DisparadorEntidadCampoCambia = {
      tipo: 'entidad.campo_cambia',
      configuracion: {
        entidad_tipo: (cfg.entidad_tipo as EntidadConEstado) ?? 'presupuesto',
        campo: typeof cfg.campo === 'string' ? cfg.campo : '',
        valor: cfg.valor as string | number | boolean | null | undefined,
      },
    }
    return (
      <PanelDisparadorEntidadCampoCambia
        disparador={disparador}
        soloLectura={soloLectura}
        onCambiar={onCambiar}
      />
    )
  }

  if (tipo === 'tiempo.relativo_a_campo') {
    const disparador: DisparadorTiempoRelativoACampo = {
      tipo: 'tiempo.relativo_a_campo',
      configuracion: {
        entidad_tipo: (cfg.entidad_tipo as EntidadConEstado) ?? 'presupuesto',
        campo_fecha: typeof cfg.campo_fecha === 'string' ? cfg.campo_fecha : '',
        delta_dias: typeof cfg.delta_dias === 'number' ? cfg.delta_dias : 0,
        hora_local: typeof cfg.hora_local === 'string' ? cfg.hora_local : '09:00',
        tolerancia_dias: typeof cfg.tolerancia_dias === 'number' ? cfg.tolerancia_dias : 0,
      },
    }
    return (
      <PanelDisparadorRelativoACampo
        disparador={disparador}
        soloLectura={soloLectura}
        onCambiar={onCambiar}
      />
    )
  }

  return <PanelTipoPendiente tipoLegible={fallbackTitulo} />
}

interface RenderPasoArgs {
  paso: AccionConId | null
  soloLectura: boolean
  onCambiar: (parche: Partial<AccionWorkflow>) => void
  fallbackTitulo: string
  fuentes: ReturnType<typeof variablesDisponibles>['fuentes']
  contexto: ReturnType<typeof usePreviewContexto>['contexto']
  tipoEntidadDisparador: EntidadConEstado | null
}

function renderPaso(args: RenderPasoArgs) {
  const { paso, soloLectura, onCambiar, fallbackTitulo, fuentes, contexto, tipoEntidadDisparador } = args

  if (!paso) return <PanelTipoPendiente tipoLegible={fallbackTitulo} />

  if (paso.tipo === 'esperar') {
    return (
      <PanelEsperar
        paso={paso as AccionEsperar}
        soloLectura={soloLectura}
        onCambiar={onCambiar}
      />
    )
  }

  if (paso.tipo === 'terminar_flujo') {
    return (
      <PanelTerminar
        paso={paso as AccionTerminarFlujo}
        soloLectura={soloLectura}
        onCambiar={onCambiar}
      />
    )
  }

  if (paso.tipo === 'enviar_whatsapp_plantilla') {
    return (
      <PanelEnviarWhatsApp
        paso={paso as AccionEnviarWhatsappPlantilla}
        soloLectura={soloLectura}
        onCambiar={onCambiar}
        fuentes={fuentes}
        contexto={contexto}
      />
    )
  }

  if (paso.tipo === 'notificar_usuario') {
    return (
      <PanelNotificarUsuario
        paso={paso as AccionNotificarUsuario}
        soloLectura={soloLectura}
        onCambiar={onCambiar}
        fuentes={fuentes}
        contexto={contexto}
      />
    )
  }

  if (paso.tipo === 'crear_actividad') {
    return (
      <PanelCrearActividad
        paso={paso as AccionCrearActividad}
        soloLectura={soloLectura}
        onCambiar={onCambiar}
        fuentes={fuentes}
        contexto={contexto}
      />
    )
  }

  if (paso.tipo === 'cambiar_estado_entidad') {
    return (
      <PanelCambiarEstado
        paso={paso as AccionCambiarEstadoEntidad}
        soloLectura={soloLectura}
        onCambiar={onCambiar}
        fuentes={fuentes}
        contexto={contexto}
        tipoEntidadDisparador={tipoEntidadDisparador}
      />
    )
  }

  if (paso.tipo === 'condicion_branch') {
    return (
      <PanelBranch
        paso={paso as AccionCondicionBranch}
        soloLectura={soloLectura}
        onCambiar={onCambiar}
        fuentes={fuentes}
        contexto={contexto}
      />
    )
  }

  if (paso.tipo === 'asignar_usuario') {
    return (
      <PanelAsignarUsuario
        paso={paso as AccionGenerica}
        soloLectura={soloLectura}
        onCambiar={onCambiar}
        fuentes={fuentes}
        contexto={contexto}
      />
    )
  }

  if (paso.tipo === 'agregar_etiqueta' || paso.tipo === 'quitar_etiqueta') {
    return (
      <PanelEtiqueta
        paso={paso as AccionGenerica}
        modo={paso.tipo === 'agregar_etiqueta' ? 'agregar' : 'quitar'}
        soloLectura={soloLectura}
        onCambiar={onCambiar}
        fuentes={fuentes}
        contexto={contexto}
      />
    )
  }

  if (paso.tipo === 'notificar_grupo') {
    return (
      <PanelNotificarGrupo
        paso={paso as AccionGenerica}
        soloLectura={soloLectura}
        onCambiar={onCambiar}
        fuentes={fuentes}
        contexto={contexto}
      />
    )
  }

  if (paso.tipo === 'enviar_whatsapp_texto') {
    return (
      <PanelEnviarWhatsAppTexto
        paso={paso as AccionGenerica}
        soloLectura={soloLectura}
        onCambiar={onCambiar}
        fuentes={fuentes}
        contexto={contexto}
      />
    )
  }

  if (paso.tipo === 'enviar_correo_texto') {
    return (
      <PanelEnviarCorreoTexto
        paso={paso as AccionGenerica}
        soloLectura={soloLectura}
        onCambiar={onCambiar}
        fuentes={fuentes}
        contexto={contexto}
      />
    )
  }

  return <PanelTipoPendiente tipoLegible={fallbackTitulo} />
}

function encontrarPaso(pasos: AccionConId[], id: string): AccionConId | null {
  for (const p of pasos) {
    if (p.id === id) return p
    if (p.tipo === 'condicion_branch') {
      const si = (p.acciones_si as AccionConId[] | undefined) ?? []
      const enSi = encontrarPaso(si, id)
      if (enSi) return enSi
      const no = (p.acciones_no as AccionConId[] | undefined) ?? []
      const enNo = encontrarPaso(no, id)
      if (enNo) return enNo
    }
  }
  return null
}
