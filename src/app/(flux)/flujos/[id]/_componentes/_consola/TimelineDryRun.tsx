'use client'

import { useState } from 'react'
import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  Loader2,
  StopCircle,
} from 'lucide-react'
import { useTraduccion } from '@/lib/i18n'
import { iconoDefaultAccion } from '@/lib/workflows/iconos-flujo'
import { etiquetaAccion } from '@/lib/workflows/etiquetas-accion'
import type { PasoLogDryRun } from '@/lib/workflows/correr-ejecucion-dryrun'
import type { TipoAccion } from '@/tipos/workflow'
import type { EstadoDryRun } from './hooks/useDryRun'
import type { RespuestaDryRun } from './tipos'

/**
 * Timeline del dry-run (sub-PR 19.5).
 *
 * Renderiza el log completo cuando termina la corrida + un loader mientras
 * está cargando + un mensaje de error si falló. La sección "Volver a
 * ejecutar" + el banner ámbar viven acá: cuando el resumen tiene
 * `no_implementados > 0`, mostramos el banner explicando que esos pasos
 * fallarán al activar el flujo (caveat D3 del coordinador).
 */

interface PropsTimelineDryRun {
  estado: EstadoDryRun
  onCorrer: () => void
}

export default function TimelineDryRun({ estado, onCorrer }: PropsTimelineDryRun) {
  const { t } = useTraduccion()

  if (estado.tipo === 'idle') {
    return (
      <div className="flex flex-col items-center justify-center py-10 px-4 text-center gap-3">
        <p className="text-sm text-texto-terciario">
          {t('flujos.editor.consola.dryrun.titulo')}
        </p>
        <button
          type="button"
          onClick={onCorrer}
          className="inline-flex items-center justify-center gap-2 px-3 h-8 rounded-md bg-texto-marca/15 hover:bg-texto-marca/20 border border-texto-marca/40 text-texto-marca text-xs font-medium transition-colors"
        >
          {t('flujos.editor.consola.cta_correr')}
        </button>
      </div>
    )
  }

  if (estado.tipo === 'cargando') {
    return (
      <div className="flex flex-col items-center justify-center py-10 text-texto-terciario gap-2">
        <Loader2 size={20} className="animate-spin" />
        <p className="text-sm">{t('flujos.editor.consola.cargando')}</p>
      </div>
    )
  }

  if (estado.tipo === 'error') {
    return (
      <div className="p-4">
        <div className="rounded-lg border border-insignia-peligro/30 bg-insignia-peligro/10 p-3">
          <p className="text-sm font-medium text-insignia-peligro-texto">
            {t('flujos.editor.consola.dryrun.error_correr')}
          </p>
          <p className="text-xs text-texto-secundario mt-1">{estado.mensaje}</p>
        </div>
        <div className="mt-3">
          <button
            type="button"
            onClick={onCorrer}
            className="inline-flex items-center justify-center gap-2 px-3 h-8 rounded-md bg-superficie-elevada hover:bg-white/[0.04] border border-borde-sutil text-texto-secundario text-xs font-medium transition-colors"
          >
            {t('flujos.editor.consola.cta_volver_a_correr')}
          </button>
        </div>
      </div>
    )
  }

  // OK
  return <ContenidoCorrida respuesta={estado.respuesta} onCorrer={onCorrer} />
}

// =============================================================
// Contenido del modo OK (banner ámbar + log + resumen)
// =============================================================

function ContenidoCorrida({
  respuesta,
  onCorrer,
}: {
  respuesta: RespuestaDryRun
  onCorrer: () => void
}) {
  const { t } = useTraduccion()
  const { log, resumen, duracion_total_ms } = respuesta

  return (
    <div className="flex flex-col gap-2 p-3 sm:p-4">
      {resumen.no_implementados > 0 && (
        <div className="rounded-lg border border-insignia-advertencia/30 bg-insignia-advertencia/10 p-3 mb-1 flex items-start gap-2.5">
          <AlertTriangle size={16} className="shrink-0 mt-0.5 text-insignia-advertencia-texto" />
          <div className="min-w-0">
            <p className="text-sm font-medium text-insignia-advertencia-texto">
              {t('flujos.editor.consola.banner_no_implementadas_titulo')}
            </p>
            <p className="text-xs text-texto-secundario mt-0.5">
              {t('flujos.editor.consola.banner_no_implementadas_desc').replace(
                '{{n}}',
                String(resumen.no_implementados),
              )}
            </p>
          </div>
        </div>
      )}

      <div className="text-[11px] font-medium text-texto-terciario uppercase tracking-wider">
        {t('flujos.editor.consola.dryrun.titulo')}
      </div>

      {log.length === 0 ? (
        <p className="text-sm text-texto-terciario py-4 text-center">
          {t('flujos.editor.consola.sin_pasos')}
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          {log.map((paso) => (
            <TarjetaPasoDryRun key={`${paso.paso}-${paso.tipo}`} paso={paso} />
          ))}
        </div>
      )}

      {/* Resumen + Volver a ejecutar */}
      <div className="mt-3 pt-3 border-t border-white/[0.07] flex flex-wrap items-center gap-3 justify-between">
        <div className="flex items-center gap-3 text-xs text-texto-secundario flex-wrap">
          {resumen.terminado_temprano && (
            <span className="inline-flex items-center gap-1.5 text-texto-terciario">
              <StopCircle size={12} />
              {t('flujos.editor.consola.dryrun.terminado_temprano')}
            </span>
          )}
          <span className="text-insignia-exito-texto">
            {t('flujos.editor.consola.dryrun.resumen_completados').replace(
              '{{n}}',
              String(resumen.completados),
            )}
          </span>
          {resumen.fallados > 0 && (
            <span className="text-insignia-peligro-texto">
              {t('flujos.editor.consola.dryrun.resumen_fallados').replace(
                '{{n}}',
                String(resumen.fallados),
              )}
            </span>
          )}
          <span className="text-texto-terciario">
            {t('flujos.editor.consola.dryrun.resumen_total').replace(
              '{{ms}}',
              String(duracion_total_ms),
            )}
          </span>
        </div>
        <button
          type="button"
          onClick={onCorrer}
          className="inline-flex items-center justify-center gap-2 px-3 h-8 rounded-md bg-texto-marca/15 hover:bg-texto-marca/20 border border-texto-marca/40 text-texto-marca text-xs font-medium transition-colors"
        >
          {t('flujos.editor.consola.cta_volver_a_correr')}
        </button>
      </div>
    </div>
  )
}

// =============================================================
// Tarjeta de un paso del log
// =============================================================

function TarjetaPasoDryRun({ paso }: { paso: PasoLogDryRun }) {
  const { t } = useTraduccion()
  const [expandido, setExpandido] = useState(paso.estado === 'fallado')

  const Icono = iconoDefaultAccion(paso.tipo as TipoAccion)
  const ok = paso.estado === 'ok'
  const noImplementada = paso.no_implementada === true

  // Texto de la línea de resumen (1 línea, truncable).
  const resumen = (() => {
    if (!ok) return paso.error?.mensaje ?? t('flujos.editor.consola.dryrun.paso_fallado')
    if (noImplementada) return t('flujos.editor.consola.dryrun.accion_no_implementada_inline')
    return resumirRespuesta(paso, t)
  })()

  return (
    <div
      className={[
        'rounded-lg border transition-colors',
        ok
          ? noImplementada
            ? 'border-insignia-advertencia/30 bg-insignia-advertencia/5'
            : 'border-borde-sutil bg-superficie-tarjeta'
          : 'border-insignia-peligro/30 bg-insignia-peligro/5',
      ].join(' ')}
    >
      <button
        type="button"
        onClick={() => setExpandido((v) => !v)}
        className="w-full flex items-start gap-3 p-3 text-left hover:bg-white/[0.02] rounded-lg"
        aria-expanded={expandido}
      >
        <span
          className={[
            'size-7 shrink-0 rounded-md flex items-center justify-center',
            ok
              ? noImplementada
                ? 'bg-insignia-advertencia/15 text-insignia-advertencia-texto'
                : 'bg-insignia-exito/15 text-insignia-exito-texto'
              : 'bg-insignia-peligro/15 text-insignia-peligro-texto',
          ].join(' ')}
        >
          {ok ? (
            noImplementada ? (
              <AlertTriangle size={14} strokeWidth={1.8} />
            ) : (
              <CheckCircle2 size={14} strokeWidth={1.8} />
            )
          ) : (
            <XCircle size={14} strokeWidth={1.8} />
          )}
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 text-xs">
            <span className="text-texto-terciario shrink-0">{paso.paso}.</span>
            <Icono size={12} className="text-texto-terciario shrink-0" />
            <span className="text-texto-primario truncate font-medium">
              {etiquetaAccion(t, paso.tipo)}
            </span>
            <span className="text-texto-terciario shrink-0">
              {t('flujos.editor.consola.dryrun.duracion_ms').replace(
                '{{ms}}',
                String(paso.duracion_ms),
              )}
            </span>
          </div>
          <p className="text-xs text-texto-secundario mt-0.5 truncate">{resumen}</p>
        </div>
        <span className="shrink-0 text-texto-terciario mt-0.5">
          {expandido ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </span>
      </button>
      {expandido && (
        <div className="px-3 pb-3 pt-1 border-t border-white/[0.07]">
          <DetallePasoDryRun paso={paso} />
        </div>
      )}
    </div>
  )
}

// =============================================================
// Resumen línea-única según el tipo de acción
// =============================================================

function resumirRespuesta(
  paso: PasoLogDryRun,
  t: (clave: string) => string,
): string {
  const r = paso.respuesta
  if (!r) return t('flujos.editor.consola.dryrun.paso_completado')
  switch (paso.tipo) {
    case 'enviar_whatsapp_plantilla':
      return t('flujos.editor.consola.dryrun.accion_simulada_whatsapp')
        .replace('{{plantilla}}', String(r.plantilla ?? ''))
        .replace('{{destinatario}}', String(r.destinatario ?? ''))
    case 'crear_actividad':
      return t('flujos.editor.consola.dryrun.accion_simulada_actividad')
        .replace('{{titulo}}', String(r.titulo ?? ''))
        .replace('{{tipo}}', String(r.tipo_etiqueta ?? r.tipo_actividad_id ?? ''))
    case 'cambiar_estado_entidad':
      return t('flujos.editor.consola.dryrun.accion_simulada_estado')
        .replace('{{entidad}}', String(r.entidad_tipo ?? ''))
        .replace('{{nuevo}}', String(r.estado_nuevo ?? ''))
    case 'notificar_usuario':
      return t('flujos.editor.consola.dryrun.accion_simulada_notificar')
        .replace('{{usuario}}', String(r.usuario_id ?? ''))
        .replace('{{titulo}}', String(r.titulo ?? ''))
    default:
      return t('flujos.editor.consola.dryrun.accion_simulada_generica').replace(
        '{{tipo}}',
        paso.tipo,
      )
  }
}

function DetallePasoDryRun({ paso }: { paso: PasoLogDryRun }) {
  return (
    <pre className="text-[11px] font-mono whitespace-pre-wrap break-words text-texto-secundario bg-superficie-app rounded p-2 max-h-48 overflow-auto">
      {JSON.stringify(paso, null, 2)}
    </pre>
  )
}
