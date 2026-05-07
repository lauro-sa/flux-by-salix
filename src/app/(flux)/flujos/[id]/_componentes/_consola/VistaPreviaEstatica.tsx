'use client'

import { useMemo, useState } from 'react'
import { ChevronDown, ChevronRight, AlertCircle, Clock, GitBranch, StopCircle } from 'lucide-react'
import { useTraduccion } from '@/lib/i18n'
import {
  resolverEnObjeto,
  VariableFaltanteError,
  type ContextoVariables,
} from '@/lib/workflows/resolver-variables'
import { evaluarCondicion } from '@/lib/workflows/evaluar-condicion'
import { iconoDefaultAccion } from '@/lib/workflows/iconos-flujo'
import { nombreMostrablePaso, etiquetaAccion } from '@/lib/workflows/etiquetas-accion'
import {
  esAccionConocida,
  esAccionEnviarWhatsappPlantilla,
  esAccionCrearActividad,
  esAccionCambiarEstadoEntidad,
  esAccionNotificarUsuario,
  esAccionEsperar,
  esAccionCondicionBranch,
  esAccionTerminarFlujo,
  type AccionWorkflow,
  type TipoAccion,
} from '@/tipos/workflow'

/**
 * Vista previa estática de un flujo (sub-PR 19.5, decisión D3 = A).
 *
 * Resuelve `{{vars}}` en cada paso contra el contexto del PR 16, evalúa
 * condiciones de branch, y muestra los valores rellenados — sin ejecutar
 * nada. Cero side-effects garantizado por construcción: solo llama a
 * funciones puras (`resolverEnObjeto`, `evaluarCondicion`).
 *
 * Para acciones con shape inválido o tipos desconocidos, mostramos un
 * card neutral en lugar de fallar — la validación tiempo real (sub-PR
 * 19.4) ya se encarga de marcar esos pasos en el canvas.
 */

interface PropsVistaPreviaEstatica {
  acciones: unknown[]
  contexto: ContextoVariables
}

export default function VistaPreviaEstatica({
  acciones,
  contexto,
}: PropsVistaPreviaEstatica) {
  const { t } = useTraduccion()

  if (acciones.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center text-center py-10 text-texto-terciario">
        <p className="text-sm">{t('flujos.editor.consola.sin_pasos')}</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-2 p-3 sm:p-4">
      <div className="text-[11px] font-medium text-texto-terciario uppercase tracking-wider">
        {t('flujos.editor.consola.preview.titulo')}
      </div>
      <p className="text-xs text-texto-terciario mb-2">
        {t('flujos.editor.consola.preview.descripcion')}
      </p>
      {acciones.map((accion, i) => (
        <TarjetaPreviewPaso
          key={(accion as { id?: string })?.id ?? i}
          numero={i + 1}
          accion={accion}
          contexto={contexto}
          t={t}
        />
      ))}
    </div>
  )
}

// =============================================================
// Tarjeta de un paso resuelto
// =============================================================

interface PropsTarjeta {
  numero: number
  accion: unknown
  contexto: ContextoVariables
  t: (clave: string) => string
}

function TarjetaPreviewPaso({ numero, accion, contexto, t }: PropsTarjeta) {
  const [expandido, setExpandido] = useState(false)

  const { resuelto, errorVariable } = useMemo(() => {
    if (!esAccionConocida(accion)) return { resuelto: null, errorVariable: null }
    try {
      return {
        resuelto: resolverEnObjeto(accion, contexto) as AccionWorkflow,
        errorVariable: null,
      }
    } catch (e) {
      if (e instanceof VariableFaltanteError) {
        return { resuelto: null, errorVariable: e.message }
      }
      return { resuelto: null, errorVariable: e instanceof Error ? e.message : String(e) }
    }
  }, [accion, contexto])

  const tipo = (accion as { tipo?: TipoAccion })?.tipo ?? null
  const Icono = tipo ? iconoDefaultAccion(tipo) : Clock
  const nombre = nombreMostrablePaso(t, accion as { etiqueta?: string; tipo?: string })

  return (
    <div className="rounded-lg border border-borde-sutil bg-superficie-tarjeta">
      <button
        type="button"
        onClick={() => setExpandido((v) => !v)}
        className="w-full flex items-start gap-3 p-3 text-left hover:bg-white/[0.02] transition-colors rounded-lg"
        aria-expanded={expandido}
      >
        <span className="size-7 shrink-0 rounded-md bg-superficie-elevada flex items-center justify-center text-texto-secundario">
          <Icono size={14} strokeWidth={1.6} />
        </span>
        <div className="flex-1 min-w-0">
          <div className="text-xs text-texto-terciario">
            {t('flujos.editor.consola.preview.paso_titulo')
              .replace('{{n}}', String(numero))
              .replace('{{nombre}}', nombre)}
          </div>
          <ResumenPaso resuelto={resuelto} errorVariable={errorVariable} contexto={contexto} t={t} />
        </div>
        <span className="shrink-0 text-texto-terciario mt-0.5">
          {expandido ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </span>
      </button>
      {expandido && (
        <div className="px-3 pb-3 pt-1 border-t border-white/[0.07]">
          <DetallePaso resuelto={resuelto} errorVariable={errorVariable} t={t} />
        </div>
      )}
    </div>
  )
}

// =============================================================
// Resumen línea-única (1 línea por paso)
// =============================================================

interface PropsResumen {
  resuelto: AccionWorkflow | null
  errorVariable: string | null
  contexto: ContextoVariables
  t: (clave: string) => string
}

function ResumenPaso({ resuelto, errorVariable, contexto, t }: PropsResumen) {
  if (errorVariable) {
    return (
      <p className="text-xs text-insignia-peligro-texto mt-1 flex items-center gap-1.5">
        <AlertCircle size={12} />
        {t('flujos.editor.consola.preview.variable_faltante').replace('{{ruta}}', errorVariable)}
      </p>
    )
  }
  if (!resuelto) {
    return <p className="text-xs text-texto-terciario mt-1">—</p>
  }
  if (esAccionEnviarWhatsappPlantilla(resuelto)) {
    return (
      <p className="text-xs text-texto-secundario mt-1 truncate">
        {t('flujos.editor.consola.dryrun.accion_simulada_whatsapp')
          .replace('{{plantilla}}', resuelto.plantilla_nombre)
          .replace('{{destinatario}}', resuelto.telefono)}
      </p>
    )
  }
  if (esAccionCrearActividad(resuelto)) {
    return (
      <p className="text-xs text-texto-secundario mt-1 truncate">
        {t('flujos.editor.consola.dryrun.accion_simulada_actividad')
          .replace('{{titulo}}', resuelto.titulo)
          .replace('{{tipo}}', resuelto.tipo_actividad_id)}
      </p>
    )
  }
  if (esAccionCambiarEstadoEntidad(resuelto)) {
    return (
      <p className="text-xs text-texto-secundario mt-1 truncate">
        {t('flujos.editor.consola.dryrun.accion_simulada_estado')
          .replace('{{entidad}}', resuelto.entidad_tipo)
          .replace('{{nuevo}}', resuelto.hasta_clave)}
      </p>
    )
  }
  if (esAccionNotificarUsuario(resuelto)) {
    return (
      <p className="text-xs text-texto-secundario mt-1 truncate">
        {t('flujos.editor.consola.dryrun.accion_simulada_notificar')
          .replace('{{usuario}}', resuelto.usuario_id)
          .replace('{{titulo}}', resuelto.titulo)}
      </p>
    )
  }
  if (esAccionEsperar(resuelto)) {
    if (typeof resuelto.duracion_ms === 'number') {
      return (
        <p className="text-xs text-texto-secundario mt-1 flex items-center gap-1.5">
          <Clock size={12} />
          {t('flujos.editor.consola.preview.esperaria').replace('{{texto}}', formatearDuracion(resuelto.duracion_ms))}
        </p>
      )
    }
    if (typeof resuelto.hasta_fecha === 'string') {
      return (
        <p className="text-xs text-texto-secundario mt-1 flex items-center gap-1.5">
          <Clock size={12} />
          {t('flujos.editor.consola.preview.esperaria_hasta').replace('{{fecha}}', resuelto.hasta_fecha)}
        </p>
      )
    }
    return <p className="text-xs text-texto-terciario mt-1">—</p>
  }
  if (esAccionCondicionBranch(resuelto)) {
    let resultado = false
    try {
      resultado = evaluarCondicion(resuelto.condicion, contexto)
    } catch {
      resultado = false
    }
    return (
      <p className="text-xs text-texto-secundario mt-1 flex items-center gap-1.5">
        <GitBranch size={12} />
        {resultado
          ? t('flujos.editor.consola.preview.rama_si_resuelta')
          : t('flujos.editor.consola.preview.rama_no_resuelta')}
      </p>
    )
  }
  if (esAccionTerminarFlujo(resuelto)) {
    return (
      <p className="text-xs text-texto-secundario mt-1 flex items-center gap-1.5">
        <StopCircle size={12} />
        {t('flujos.editor.consola.preview.terminar_flujo')}
      </p>
    )
  }
  // Acción no soportada — etiqueta legible.
  return (
    <p className="text-xs text-texto-terciario mt-1 truncate">
      {etiquetaAccion(t, (resuelto as { tipo?: string }).tipo)}
    </p>
  )
}

// =============================================================
// Detalle expandido — JSON formateado del paso resuelto
// =============================================================

function DetallePaso({
  resuelto,
  errorVariable,
  t,
}: {
  resuelto: AccionWorkflow | null
  errorVariable: string | null
  t: (clave: string) => string
}) {
  if (errorVariable) {
    return (
      <p className="text-xs text-insignia-peligro-texto py-1">
        {t('flujos.editor.consola.preview.variable_faltante').replace('{{ruta}}', errorVariable)}
      </p>
    )
  }
  if (!resuelto) return <p className="text-xs text-texto-terciario">—</p>
  return (
    <pre className="text-[11px] font-mono whitespace-pre-wrap break-words text-texto-secundario bg-superficie-app rounded p-2 max-h-48 overflow-auto">
      {JSON.stringify(resuelto, null, 2)}
    </pre>
  )
}

// =============================================================
// Helpers locales
// =============================================================

function formatearDuracion(ms: number): string {
  const segundos = Math.round(ms / 1000)
  if (segundos < 60) return `${segundos}s`
  const minutos = Math.round(segundos / 60)
  if (minutos < 60) return `${minutos}min`
  const horas = Math.round(minutos / 60)
  if (horas < 24) return `${horas}h`
  const dias = Math.round(horas / 24)
  return `${dias}d`
}
