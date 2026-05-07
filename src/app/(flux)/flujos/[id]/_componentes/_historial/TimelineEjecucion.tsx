'use client'

import {
  AlertCircle,
  Check,
  Clock,
  Hourglass,
  RotateCcw,
  X,
} from 'lucide-react'
import { useTraduccion } from '@/lib/i18n'
import { useFormato } from '@/hooks/useFormato'
import { etiquetaAccion } from '@/lib/workflows/etiquetas-accion'
import { formatearDuracion } from './formato-ejecucion'
import type { AccionPendiente } from '@/tipos/workflow'

/**
 * TimelineEjecucion — pinta el `log[]` de una ejecución paso por paso
 * con valores resueltos, duraciones e intentos (sub-PR 19.6).
 *
 * Distinto de `TimelineDryRun` (sub-PR 19.5):
 *   - Dry-run muestra `{ simulado, accion_simulada, payload }`.
 *   - Ejecución real tiene shape `PasoLog` con `intentos[]`, `error`,
 *     `inicio_en`/`fin_en` reales.
 *   Forzarlos a un componente común requiere abstracciones que no
 *   pagan ahora — si emerge duplicación, extraemos subcomponentes
 *   finos a `_compartido/`.
 *
 * Cierre defensivo: el `log` viene como `unknown` (jsonb). Validamos
 * shape antes de leer cada campo. Si una entrada está rota se muestra
 * con badge "registro inválido" en vez de crashear.
 */

interface Props {
  log: unknown
  pendientes: AccionPendiente[]
}

interface PasoNormalizado {
  paso: number | null
  tipo: string
  estado: 'ok' | 'fallado' | 'desconocido'
  inicio_en: string | null
  fin_en: string | null
  intentos: IntentoNormalizado[]
  error: { mensaje: string; raw_class?: string; status?: number } | null
  continuoPesADeFallo: boolean
}

interface IntentoNormalizado {
  n: number
  ts: string
  duracion_ms: number
  resultado: string
  error?: { mensaje: string; raw_class?: string; status?: number }
}

export default function TimelineEjecucion({ log, pendientes }: Props) {
  const { t } = useTraduccion()
  const pasos = normalizarLog(log)

  if (pasos.length === 0 && pendientes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-10 text-texto-terciario text-center">
        <Clock size={20} className="mb-2 opacity-40" />
        <p className="text-xs">{t('flujos.historial.timeline.sin_pasos')}</p>
      </div>
    )
  }

  return (
    <ol className="flex flex-col gap-3">
      {pasos.map((p, i) => (
        <FilaPaso key={`paso-${i}`} paso={p} t={t} />
      ))}
      {pendientes.length > 0 && (
        <>
          <li className="px-3 pt-1 pb-0.5">
            <span className="text-[11px] font-medium text-texto-terciario uppercase tracking-wider">
              {t('flujos.historial.timeline.pendientes')}
            </span>
          </li>
          {pendientes.map((p) => (
            <FilaPendiente key={p.id} pendiente={p} t={t} />
          ))}
        </>
      )}
    </ol>
  )
}

// ─── Fila de paso ejecutado ─────────────────────────────────────────

function FilaPaso({
  paso,
  t,
}: {
  paso: PasoNormalizado
  t: ReturnType<typeof useTraduccion>['t']
}) {
  const formato = useFormato()
  const tieneIntentosMultiples = paso.intentos.length > 1

  const duracionMs =
    paso.inicio_en && paso.fin_en
      ? new Date(paso.fin_en).getTime() - new Date(paso.inicio_en).getTime()
      : null
  const duracionStr = formatearDuracion(duracionMs !== null ? duracionMs / 1000 : null)

  return (
    <li
      className={`rounded-card border px-3 py-2.5 flex flex-col gap-1.5 ${
        paso.estado === 'fallado' && !paso.continuoPesADeFallo
          ? 'border-insignia-peligro-texto/30 bg-insignia-peligro-fondo/20'
          : 'border-borde-sutil bg-superficie-tarjeta'
      }`}
    >
      <div className="flex items-center gap-2 min-w-0">
        <IconoEstadoPaso estado={paso.estado} continuo={paso.continuoPesADeFallo} />
        <span className="text-xs font-medium text-texto-primario truncate">
          {paso.paso !== null ? `${paso.paso}. ` : ''}
          {etiquetaAccion(t, paso.tipo as Parameters<typeof etiquetaAccion>[1])}
        </span>
        <div className="flex-1" />
        <span className="text-xxs text-texto-terciario font-mono shrink-0">
          {duracionStr}
        </span>
      </div>

      {paso.inicio_en && (
        <div className="text-xxs text-texto-terciario font-mono">
          {formato.fecha(paso.inicio_en, { conHora: true })}
        </div>
      )}

      {tieneIntentosMultiples && (
        <div className="flex items-center gap-1 text-xxs text-texto-secundario">
          <RotateCcw size={11} />
          <span>
            {t('flujos.historial.timeline.intentos').replace(
              '{{n}}',
              String(paso.intentos.length),
            )}
          </span>
        </div>
      )}

      {paso.error && (
        <div className="mt-1 rounded border border-insignia-peligro-texto/30 bg-insignia-peligro-fondo/30 px-2 py-1.5 flex items-start gap-1.5">
          <AlertCircle size={12} className="text-insignia-peligro-texto shrink-0 mt-0.5" />
          <div className="flex flex-col gap-0.5 min-w-0">
            <p className="text-xs text-texto-primario break-words">
              {paso.error.mensaje}
            </p>
            {paso.error.raw_class && (
              <p className="text-xxs font-mono text-texto-terciario">
                {paso.error.raw_class}
                {paso.error.status ? ` · status ${paso.error.status}` : ''}
              </p>
            )}
          </div>
        </div>
      )}

      {paso.continuoPesADeFallo && (
        <p className="text-xxs text-texto-terciario italic">
          {t('flujos.historial.timeline.continuo_pese_fallo')}
        </p>
      )}
    </li>
  )
}

// ─── Fila de paso pendiente (esperar / diferido) ────────────────────

function FilaPendiente({
  pendiente,
  t,
}: {
  pendiente: AccionPendiente
  t: ReturnType<typeof useTraduccion>['t']
}) {
  const formato = useFormato()
  return (
    <li className="rounded-card border border-borde-sutil bg-superficie-tarjeta px-3 py-2.5 flex flex-col gap-1.5 opacity-90">
      <div className="flex items-center gap-2 min-w-0">
        <Hourglass
          size={14}
          className="text-insignia-advertencia-texto shrink-0"
        />
        <span className="text-xs font-medium text-texto-primario truncate">
          {etiquetaAccion(t, pendiente.tipo_accion)}
        </span>
        <div className="flex-1" />
        <span className="text-xxs text-texto-terciario shrink-0">
          {t('flujos.historial.timeline.pendiente_estado')}
        </span>
      </div>
      <div className="text-xxs text-texto-terciario font-mono">
        {t('flujos.historial.timeline.ejecutar_en')}{' '}
        {formato.fecha(pendiente.ejecutar_en, { conHora: true })}
      </div>
    </li>
  )
}

// ─── Icono semántico por estado del paso ────────────────────────────

function IconoEstadoPaso({
  estado,
  continuo,
}: {
  estado: PasoNormalizado['estado']
  continuo: boolean
}) {
  if (estado === 'ok') {
    return <Check size={14} className="text-insignia-exito-texto shrink-0" />
  }
  if (estado === 'fallado') {
    return continuo ? (
      <AlertCircle size={14} className="text-insignia-advertencia-texto shrink-0" />
    ) : (
      <X size={14} className="text-insignia-peligro-texto shrink-0" />
    )
  }
  return <AlertCircle size={14} className="text-texto-terciario shrink-0" />
}

// ─── Normalizador defensivo del log ─────────────────────────────────
// El `log` viene como `unknown` (columna jsonb). Versiones legacy
// pueden tener shapes distintos; entradas rotas no deben crashear el
// drawer entero. Validamos cada entrada y devolvemos la lista plana.

function normalizarLog(log: unknown): PasoNormalizado[] {
  if (!Array.isArray(log)) return []
  const result: PasoNormalizado[] = []
  for (const raw of log) {
    if (!raw || typeof raw !== 'object') continue
    const obj = raw as Record<string, unknown>
    const tipo = typeof obj.tipo === 'string' ? obj.tipo : 'desconocido'
    const estadoCrudo = obj.estado
    const estado: PasoNormalizado['estado'] =
      estadoCrudo === 'ok' || estadoCrudo === 'fallado'
        ? estadoCrudo
        : 'desconocido'
    const intentos = normalizarIntentos(obj.intentos)
    // Error: lo extraemos del intento más reciente fallido para mostrar
    // arriba (UX: que el error siempre se vea sin abrir intentos). Si
    // no hay intentos pero el paso está fallado, fallback al campo
    // top-level `error` de versiones legacy del executor.
    const intentoFallido = [...intentos].reverse().find((i) => i.error)
    const errorTop =
      obj.error && typeof obj.error === 'object'
        ? (obj.error as { mensaje?: string; raw_class?: string; status?: number })
        : null
    const error: PasoNormalizado['error'] = intentoFallido?.error
      ? intentoFallido.error
      : errorTop?.mensaje
        ? {
            mensaje: errorTop.mensaje,
            raw_class: errorTop.raw_class,
            status: errorTop.status,
          }
        : null
    result.push({
      paso: typeof obj.paso === 'number' ? obj.paso : null,
      tipo,
      estado,
      inicio_en: typeof obj.inicio_en === 'string' ? obj.inicio_en : null,
      fin_en: typeof obj.fin_en === 'string' ? obj.fin_en : null,
      intentos,
      error,
      continuoPesADeFallo: obj.continuo_pese_a_fallo === true,
    })
  }
  return result
}

function normalizarIntentos(raw: unknown): IntentoNormalizado[] {
  if (!Array.isArray(raw)) return []
  const out: IntentoNormalizado[] = []
  for (const r of raw) {
    if (!r || typeof r !== 'object') continue
    const obj = r as Record<string, unknown>
    const error =
      obj.error && typeof obj.error === 'object'
        ? (obj.error as { mensaje?: string; raw_class?: string; status?: number })
        : undefined
    out.push({
      n: typeof obj.n === 'number' ? obj.n : 0,
      ts: typeof obj.ts === 'string' ? obj.ts : '',
      duracion_ms: typeof obj.duracion_ms === 'number' ? obj.duracion_ms : 0,
      resultado: typeof obj.resultado === 'string' ? obj.resultado : 'desconocido',
      error: error?.mensaje
        ? {
            mensaje: error.mensaje,
            raw_class: error.raw_class,
            status: error.status,
          }
        : undefined,
    })
  }
  return out
}
