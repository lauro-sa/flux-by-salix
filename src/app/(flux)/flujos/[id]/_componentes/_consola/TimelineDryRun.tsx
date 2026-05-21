'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  ChevronDown,
  ChevronRight,
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
  /**
   * Acciones del flujo en su versión editable. Las usamos para
   * mostrar los íconos en la animación de carga del dry-run: un
   * barrido secuencial que va iluminando cada paso, dando la
   * sensación de "ejecutándose paso a paso" mientras el endpoint
   * corre. Si no se pasa o está vacío, usamos un fallback discreto.
   */
  acciones?: unknown[]
}

export default function TimelineDryRun({ estado, onCorrer, acciones }: PropsTimelineDryRun) {
  const { t } = useTraduccion()

  if (estado.tipo === 'idle') {
    return (
      <div className="flex-1 min-h-0 flex flex-col items-center justify-center py-10 px-4 text-center gap-3 overflow-y-auto">
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
      <div className="flex-1 min-h-0 flex flex-col items-center justify-center py-8 px-4 text-center gap-4 overflow-y-auto">
        <AnimacionEjecutando acciones={acciones ?? []} />
        <p className="text-xs text-texto-terciario animate-pulse">
          {t('flujos.editor.consola.cargando')}
        </p>
      </div>
    )
  }

  if (estado.tipo === 'error') {
    return (
      <div className="flex-1 min-h-0 flex flex-col overflow-y-auto">
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

  // Estructura: log scrolleable (flex-1) + footer sticky (shrink-0).
  // El footer con "Volver a ejecutar" queda SIEMPRE al fondo de la
  // consola, independiente del tamaño del log o de la altura que el
  // usuario le haya dado al panel.
  return (
    <div className="flex-1 min-h-0 flex flex-col">
      {/* Log scrolleable */}
      <div className="flex-1 min-h-0 overflow-y-auto p-3 sm:p-4">
        <div className="flex flex-col gap-2">
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
            <motion.div
              // Stagger entrance: cada tarjeta aparece con 120ms de
              // delay incremental. Da la sensación de "se ejecutó
              // paso por paso" aunque el resultado llegue de un saque.
              initial="hidden"
              animate="visible"
              variants={{
                hidden: {},
                visible: { transition: { staggerChildren: 0.12 } },
              }}
              className="flex flex-col gap-2"
            >
              {log.map((paso) => (
                <motion.div
                  key={`${paso.paso}-${paso.tipo}`}
                  variants={{
                    hidden: { opacity: 0, y: 8 },
                    visible: { opacity: 1, y: 0, transition: { duration: 0.22, ease: 'easeOut' } },
                  }}
                >
                  <TarjetaPasoDryRun paso={paso} />
                </motion.div>
              ))}
            </motion.div>
          )}
        </div>
      </div>

      {/* Footer sticky con resumen + Volver a ejecutar */}
      <div className="shrink-0 px-3 sm:px-4 py-2.5 border-t border-white/[0.07] bg-superficie-app flex flex-wrap items-center gap-3 justify-between">
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
    case 'enviar_correo_plantilla':
    case 'enviar_respuesta_rapida_correo': {
      const nombre = String(r.nombre_legible ?? '')
      const destinatario = String(r.destinatario ?? '')
      const asunto = String(r.asunto ?? '')
      const tipoLabel = paso.tipo === 'enviar_correo_plantilla'
        ? 'plantilla'
        : 'respuesta rápida'
      if (nombre && destinatario) {
        return `Enviaría ${tipoLabel} "${nombre}" a ${destinatario}${asunto ? ` · "${asunto}"` : ''}`
      }
      return `Enviaría ${tipoLabel} a ${destinatario || '(destinatario desconocido)'}`
    }
    case 'enviar_correo_texto': {
      const destinatario = String(r.destinatario ?? '')
      const asunto = String(r.asunto ?? '')
      if (destinatario && asunto) {
        return `Enviaría correo a ${destinatario} · "${asunto}"`
      }
      return `Enviaría correo a ${destinatario || '(destinatario desconocido)'}`
    }
    case 'condicion_branch': {
      const rama = r.rama_ejecutada === 'si' ? 'Sí' : r.rama_ejecutada === 'no' ? 'No' : null
      const subPasos = Array.isArray(r.sub_pasos) ? r.sub_pasos : []
      const exitosos = subPasos.filter(
        (s): s is { estado?: string } => typeof s === 'object' && s !== null && (s as { estado?: string }).estado === 'ok',
      ).length
      const fallados = subPasos.filter(
        (s): s is { estado?: string } => typeof s === 'object' && s !== null && (s as { estado?: string }).estado === 'fallado',
      ).length
      if (!rama) return 'Condición evaluada'
      const partes = [`Tomó la rama ${rama}`]
      if (subPasos.length === 0) {
        partes.push('sin sub-acciones')
      } else {
        partes.push(`${exitosos} sub-acción(es) ejecutada(s)`)
        if (fallados > 0) partes.push(`${fallados} con error`)
      }
      return partes.join(' · ')
    }
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
    case 'esperar':
      if (typeof r.duracion_ms === 'number') {
        const ms = r.duracion_ms as number
        const seg = Math.round(ms / 1000)
        if (seg < 60) return `Esperaría ${seg} segundo(s)`
        const min = Math.round(seg / 60)
        if (min < 60) return `Esperaría ${min} minuto(s)`
        const hr = Math.round(min / 60)
        if (hr < 24) return `Esperaría ${hr} hora(s)`
        return `Esperaría ${Math.round(hr / 24)} día(s)`
      }
      if (typeof r.hasta_fecha === 'string') {
        return `Esperaría hasta ${r.hasta_fecha}`
      }
      return 'Pausaría el flujo'
    case 'terminar_flujo':
      return 'Terminaría el flujo'
    default:
      return t('flujos.editor.consola.dryrun.accion_simulada_generica').replace(
        '{{tipo}}',
        paso.tipo,
      )
  }
}

function DetallePasoDryRun({ paso }: { paso: PasoLogDryRun }) {
  const { t } = useTraduccion()

  // Caso especial condicion_branch: mostramos los sub-pasos como
  // mini-cards legibles en lugar del JSON crudo. Para el caso
  // canónico (Si → Enviar respuesta rápida), el usuario ve algo
  // tipo "1. Enviar respuesta rápida (320ms) — Enviaría respuesta
  // rápida 'Fuera de horario' a cliente@ejemplo.com".
  if (paso.tipo === 'condicion_branch' && paso.respuesta) {
    const r = paso.respuesta
    const subPasos = Array.isArray(r.sub_pasos) ? (r.sub_pasos as Array<Record<string, unknown>>) : []
    return (
      <div className="flex flex-col gap-2">
        {subPasos.length === 0 ? (
          <p className="text-xs text-texto-terciario italic">
            Sin sub-acciones — la rama está vacía, el flujo termina acá.
          </p>
        ) : (
          subPasos.map((sub, idx) => (
            <SubPasoDryRun key={idx} sub={sub} t={t} />
          ))
        )}
      </div>
    )
  }

  // Fallback genérico: JSON crudo. Pendiente mejorar para los otros
  // tipos (enviar_correo_*, crear_actividad, etc.).
  return (
    <pre className="text-[11px] font-mono whitespace-pre-wrap break-words text-texto-secundario bg-superficie-app rounded p-2">
      {JSON.stringify(paso, null, 2)}
    </pre>
  )
}

/**
 * Animación de "ejecutando dry-run". Muestra cada acción del flujo
 * como un mini-ícono que se va iluminando secuencialmente (barrido
 * de pulse), dando la sensación de progreso paso por paso. Es 100%
 * estética — el endpoint corre en paralelo, completamente desacoplado.
 *
 * Si no hay acciones (estado raro), usamos un puñado de "dots" como
 * fallback discreto en lugar de un spinner pelado.
 */
function AnimacionEjecutando({ acciones }: { acciones: unknown[] }) {
  // Extraemos los íconos de cada acción. Si no son acciones válidas
  // (shape desconocido), usamos un punto genérico.
  const items: Array<{ Icono: ReturnType<typeof iconoDefaultAccion> | null }> =
    acciones.length > 0
      ? acciones.map((a) => {
          const tipo = typeof a === 'object' && a !== null
            ? ((a as { tipo?: unknown }).tipo as TipoAccion | undefined)
            : undefined
          return { Icono: tipo ? iconoDefaultAccion(tipo) : null }
        })
      : [{ Icono: null }, { Icono: null }, { Icono: null }]

  return (
    <div className="flex items-center gap-3">
      {items.map((it, idx) => {
        const Icono = it.Icono
        return (
          <motion.div
            key={idx}
            // Cada item pulsa con un delay incremental y vuelve al
            // baseline, formando un "barrido" continuo. `repeatDelay`
            // grande deja una pausa antes del próximo ciclo para que
            // se sienta calmo y premium, no nervioso.
            initial={{ opacity: 0.35, scale: 0.9 }}
            animate={{ opacity: [0.35, 1, 0.35], scale: [0.9, 1.05, 0.9] }}
            transition={{
              duration: 0.9,
              delay: idx * 0.18,
              repeat: Infinity,
              repeatDelay: Math.max(0, (items.length - 1 - idx) * 0.18 + 0.2),
              ease: 'easeInOut',
            }}
            className="shrink-0 inline-flex items-center justify-center size-9 rounded-md bg-texto-marca/15 text-texto-marca border border-texto-marca/30"
            aria-hidden="true"
          >
            {Icono ? (
              <Icono size={16} strokeWidth={1.7} />
            ) : (
              <span className="size-1.5 rounded-full bg-texto-marca" />
            )}
          </motion.div>
        )
      })}
    </div>
  )
}

function SubPasoDryRun({
  sub,
  t,
}: {
  sub: Record<string, unknown>
  t: (k: string) => string
}) {
  const tipo = typeof sub.tipo === 'string' ? sub.tipo : 'desconocido'
  const estado = typeof sub.estado === 'string' ? sub.estado : 'ok'
  const duracion = typeof sub.duracion_ms === 'number' ? sub.duracion_ms : 0
  const ok = estado === 'ok'
  // Reciclamos `resumirRespuesta` armando un PasoLogDryRun "falso"
  // para los sub-pasos (mismo shape, distinta jerarquía en el JSON).
  const pasoLike = {
    paso: typeof sub.sub_paso === 'number' ? sub.sub_paso : 0,
    tipo,
    estado,
    inicio_en: '',
    fin_en: '',
    duracion_ms: duracion,
    respuesta: (sub.respuesta as Record<string, unknown> | undefined) ?? undefined,
  } as unknown as PasoLogDryRun
  const resumen = ok
    ? resumirRespuesta(pasoLike, t)
    : (typeof (sub.error as { mensaje?: string } | undefined)?.mensaje === 'string'
        ? (sub.error as { mensaje: string }).mensaje
        : 'Error sin detalle')

  return (
    <div
      className={[
        'rounded-md border px-2.5 py-1.5 text-xs',
        ok
          ? 'border-borde-sutil bg-superficie-app'
          : 'border-insignia-peligro/30 bg-insignia-peligro/5',
      ].join(' ')}
    >
      <div className="flex items-center gap-2">
        <span className="text-texto-terciario shrink-0">{pasoLike.paso}.</span>
        <span className="text-texto-primario font-medium truncate">
          {tipo === 'enviar_correo_texto' && 'Enviar correo'}
          {tipo === 'enviar_correo_plantilla' && 'Enviar correo (plantilla)'}
          {tipo === 'enviar_respuesta_rapida_correo' && 'Enviar respuesta rápida'}
          {tipo === 'enviar_whatsapp_plantilla' && 'Enviar WhatsApp'}
          {tipo === 'crear_actividad' && 'Crear actividad'}
          {tipo === 'cambiar_estado_entidad' && 'Cambiar estado'}
          {tipo === 'notificar_usuario' && 'Notificar usuario'}
          {tipo === 'terminar_flujo' && 'Terminar flujo'}
          {![
            'enviar_correo_texto',
            'enviar_correo_plantilla',
            'enviar_respuesta_rapida_correo',
            'enviar_whatsapp_plantilla',
            'crear_actividad',
            'cambiar_estado_entidad',
            'notificar_usuario',
            'terminar_flujo',
          ].includes(tipo) && tipo}
        </span>
        <span className="ml-auto text-texto-terciario shrink-0">{duracion} ms</span>
      </div>
      <p className={['text-xs mt-0.5 truncate', ok ? 'text-texto-secundario' : 'text-insignia-peligro-texto'].join(' ')}>
        {resumen}
      </p>
    </div>
  )
}
