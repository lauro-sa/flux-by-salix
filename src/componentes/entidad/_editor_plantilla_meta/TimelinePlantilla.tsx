'use client'

/**
 * TimelinePlantilla — Stepper horizontal con los hitos de una plantilla WA:
 * Creada → Enviada a Meta → En revisión → Aprobada / Rechazada.
 *
 * Cada paso muestra un punto, la etiqueta, y la fecha/hora en que ocurrió.
 * Los eventos auxiliares (ediciones, errores puntuales) se muestran
 * colapsados debajo para no ensuciar el recorrido principal.
 */

import { useEffect, useMemo, useState } from 'react'
import {
  FileText, Send, Clock, CheckCircle2, XCircle, AlertTriangle,
  ChevronDown, Pencil, RefreshCw, Ban, Pause,
} from 'lucide-react'
import type { EventoHistorialPlantilla } from '@/tipos/whatsapp'

interface Props {
  plantillaId: string
  locale: string
  /** Cambiar este número dispara un refetch del historial (ej: tras re-enviar a Meta). */
  refrescoKey?: number
}

// ─── Pasos fijos del recorrido de aprobación ───

type ClavePaso = 'creada' | 'enviada' | 'revision' | 'resultado'

interface DefinicionPaso {
  clave: ClavePaso
  etiqueta: string
  icono: typeof FileText
}

const PASOS: DefinicionPaso[] = [
  { clave: 'creada',    etiqueta: 'Creada',        icono: FileText     },
  { clave: 'enviada',   etiqueta: 'Enviada a Meta', icono: Send        },
  { clave: 'revision',  etiqueta: 'En revisión',   icono: Clock        },
  { clave: 'resultado', etiqueta: 'Aprobada',      icono: CheckCircle2 },
]

// Config visual para eventos secundarios (edición, error intermedio, etc.)
const CONFIG_EVENTO_AUX: Record<
  EventoHistorialPlantilla['evento'],
  { icono: typeof FileText; color: string; etiqueta: string }
> = {
  creada:         { icono: FileText,     color: 'var(--texto-terciario)',     etiqueta: 'Creada' },
  editada:        { icono: Pencil,       color: 'var(--texto-terciario)',     etiqueta: 'Editada' },
  enviada_a_meta: { icono: Send,         color: 'var(--insignia-info)',       etiqueta: 'Enviada a Meta' },
  aprobada:       { icono: CheckCircle2, color: 'var(--insignia-exito)',      etiqueta: 'Aprobada' },
  rechazada:      { icono: XCircle,      color: 'var(--insignia-peligro)',    etiqueta: 'Rechazada' },
  deshabilitada:  { icono: Ban,          color: 'var(--insignia-peligro)',    etiqueta: 'Deshabilitada' },
  pausada:        { icono: Pause,        color: 'var(--insignia-advertencia)', etiqueta: 'Pausada' },
  error:          { icono: AlertTriangle, color: 'var(--insignia-peligro)',   etiqueta: 'Error al enviar' },
  sincronizada:   { icono: RefreshCw,    color: 'var(--texto-terciario)',     etiqueta: 'Sincronizada' },
}

// Estados que indican que la plantilla YA pasó por Meta (cualquier resultado definitivo).
const ESTADOS_RESUELTOS = new Set(['aprobada', 'rechazada', 'deshabilitada', 'pausada'])

function formatearFechaCorta(iso: string, locale: string): string {
  const d = new Date(iso)
  if (isNaN(d.getTime())) return iso
  return d.toLocaleString(locale, {
    day: '2-digit', month: 'short',
    hour: '2-digit', minute: '2-digit',
  })
}

function formatearFechaLarga(iso: string, locale: string): string {
  const d = new Date(iso)
  if (isNaN(d.getTime())) return iso
  return d.toLocaleString(locale, {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

export function TimelinePlantilla({ plantillaId, locale, refrescoKey = 0 }: Props) {
  const [eventos, setEventos] = useState<EventoHistorialPlantilla[]>([])
  const [cargando, setCargando] = useState(true)
  const [verAuxiliares, setVerAuxiliares] = useState(false)

  useEffect(() => {
    let cancelado = false
    setCargando(true)
    fetch(`/api/whatsapp/plantillas/${plantillaId}/historial`)
      .then(r => r.ok ? r.json() : { eventos: [] })
      .then(data => { if (!cancelado) setEventos(data.eventos || []) })
      .catch(() => { if (!cancelado) setEventos([]) })
      .finally(() => { if (!cancelado) setCargando(false) })
    return () => { cancelado = true }
  }, [plantillaId, refrescoKey])

  // ─── Reducir eventos a estado por paso ───
  const estadoPasos = useMemo(() => {
    // Para cada paso guardamos la fecha en la que se alcanzó (o null si no se alcanzó).
    const base: Record<ClavePaso, { fecha: string | null; detalle?: string }> = {
      creada:    { fecha: null },
      enviada:   { fecha: null },
      revision:  { fecha: null },
      resultado: { fecha: null },
    }

    let resultado: 'aprobada' | 'rechazada' | 'deshabilitada' | 'pausada' | null = null

    for (const ev of eventos) {
      if (ev.evento === 'creada' && !base.creada.fecha) {
        base.creada.fecha = ev.creado_en
      }
      if (ev.evento === 'enviada_a_meta') {
        // Cada vez que se envía, reseteamos el tramo "aprobada/rechazada" porque
        // se volvió a revisión.
        base.enviada.fecha = ev.creado_en
        base.revision.fecha = ev.creado_en
        base.resultado = { fecha: null }
        resultado = null
      }
      if (ESTADOS_RESUELTOS.has(ev.evento)) {
        base.resultado = { fecha: ev.creado_en, detalle: ev.detalle || undefined }
        resultado = ev.evento as 'aprobada' | 'rechazada' | 'deshabilitada' | 'pausada'
      }
    }

    return { pasos: base, resultado }
  }, [eventos])

  // Eventos auxiliares (ediciones, errores) que no encajan en los 4 pasos.
  const eventosAux = useMemo(() => {
    return eventos.filter(e => e.evento === 'editada' || e.evento === 'error')
  }, [eventos])

  if (cargando) {
    return (
      <div className="rounded-card border border-borde-sutil bg-superficie-tarjeta p-3 flex items-center gap-2 text-xxs text-texto-terciario">
        <Clock size={12} className="animate-pulse" />
        Cargando línea de tiempo…
      </div>
    )
  }

  if (eventos.length === 0) return null

  const { pasos, resultado } = estadoPasos

  // Paso actual = último paso con fecha. Los siguientes quedan "pendientes".
  const indicePasoActual = PASOS.reduce(
    (max, paso, i) => (pasos[paso.clave].fecha ? i : max),
    -1,
  )

  // ¿El resultado es un rechazo? Se refleja pintando el último paso en rojo.
  const resultadoNegativo = resultado === 'rechazada' || resultado === 'deshabilitada'

  return (
    <div className="rounded-card border border-borde-sutil bg-superficie-tarjeta p-4">
      <div className="flex items-center gap-2 mb-4">
        <Clock size={14} className="text-texto-terciario" />
        <h3 className="text-[11px] font-medium text-texto-terciario uppercase tracking-wider">
          Recorrido de aprobación
        </h3>
      </div>

      {/* Stepper horizontal */}
      <div className="relative flex items-start justify-between gap-2 overflow-x-auto pb-1">
        {PASOS.map((paso, i) => {
          const datos = pasos[paso.clave]
          const alcanzado = !!datos.fecha
          const esActual = i === indicePasoActual
          const esUltimo = i === PASOS.length - 1

          // Colores según estado.
          let color = 'var(--texto-terciario)'
          let bg = 'var(--superficie-app)'
          let borde = 'var(--borde-sutil)'
          if (esUltimo && resultado) {
            if (resultadoNegativo) {
              color = 'var(--insignia-peligro)'
              bg = 'color-mix(in srgb, var(--insignia-peligro) 15%, var(--superficie-app))'
              borde = 'var(--insignia-peligro)'
            } else if (resultado === 'aprobada') {
              color = 'var(--insignia-exito)'
              bg = 'color-mix(in srgb, var(--insignia-exito) 15%, var(--superficie-app))'
              borde = 'var(--insignia-exito)'
            } else if (resultado === 'pausada') {
              color = 'var(--insignia-advertencia)'
              bg = 'color-mix(in srgb, var(--insignia-advertencia) 15%, var(--superficie-app))'
              borde = 'var(--insignia-advertencia)'
            }
          } else if (alcanzado) {
            color = 'var(--texto-marca)'
            bg = 'color-mix(in srgb, var(--texto-marca) 15%, var(--superficie-app))'
            borde = 'var(--texto-marca)'
          }

          // El icono y la etiqueta del resultado final cambian según aprobada/rechazada.
          let Icono = paso.icono
          let etiqueta = paso.etiqueta
          if (esUltimo && resultado) {
            if (resultado === 'rechazada') { Icono = XCircle; etiqueta = 'Rechazada' }
            else if (resultado === 'deshabilitada') { Icono = Ban; etiqueta = 'Deshabilitada' }
            else if (resultado === 'pausada') { Icono = Pause; etiqueta = 'Pausada' }
            else if (resultado === 'aprobada') { Icono = CheckCircle2; etiqueta = 'Aprobada' }
          }

          return (
            <div key={paso.clave} className="flex-1 min-w-[80px] flex flex-col items-center text-center relative">
              {/* Línea conectora hacia el siguiente paso */}
              {!esUltimo && (
                <div
                  className="absolute top-[11px] left-1/2 right-0 h-px -z-0"
                  style={{
                    width: 'calc(100% - 12px)',
                    marginLeft: '14px',
                    background: i < indicePasoActual
                      ? 'var(--texto-marca)'
                      : 'var(--borde-sutil)',
                  }}
                  aria-hidden
                />
              )}

              {/* Punto */}
              <div
                className="size-6 rounded-full flex items-center justify-center relative z-10 transition-colors"
                style={{ background: bg, border: `1.5px solid ${borde}` }}
                title={datos.detalle || etiqueta}
              >
                <Icono size={12} style={{ color }} />
              </div>

              {/* Etiqueta y fecha */}
              <div className="mt-2">
                <p
                  className={`text-[11px] font-medium leading-tight ${esActual ? 'text-texto-primario' : ''}`}
                  style={{ color: alcanzado ? (esUltimo && resultado ? color : 'var(--texto-primario)') : 'var(--texto-terciario)' }}
                >
                  {etiqueta}
                </p>
                <p className="text-[10px] text-texto-terciario mt-0.5 tabular-nums">
                  {datos.fecha ? formatearFechaCorta(datos.fecha, locale) : '—'}
                </p>
              </div>
            </div>
          )
        })}
      </div>

      {/* Detalle del resultado (si fue rechazo o error) */}
      {resultado && pasos.resultado.detalle && (resultadoNegativo || resultado === 'pausada') && (
        <div
          className="mt-4 rounded-card px-3 py-2 border"
          style={{
            background: 'color-mix(in srgb, var(--insignia-peligro) 8%, transparent)',
            borderColor: 'color-mix(in srgb, var(--insignia-peligro) 30%, transparent)',
          }}
        >
          <p className="text-xxs text-insignia-peligro break-words">
            <strong>Motivo:</strong> {pasos.resultado.detalle}
          </p>
        </div>
      )}

      {/* Eventos auxiliares colapsables */}
      {eventosAux.length > 0 && (
        <div className="mt-4 pt-3 border-t border-borde-sutil">
          <button
            type="button"
            onClick={() => setVerAuxiliares(v => !v)}
            className="w-full flex items-center justify-between text-xxs text-texto-terciario hover:text-texto-secundario transition-colors"
          >
            <span>{eventosAux.length} evento{eventosAux.length !== 1 ? 's' : ''} adicional{eventosAux.length !== 1 ? 'es' : ''} (ediciones, errores)</span>
            <ChevronDown
              size={12}
              className={`transition-transform ${verAuxiliares ? 'rotate-180' : ''}`}
            />
          </button>
          {verAuxiliares && (
            <ul className="mt-2 space-y-1.5">
              {eventosAux.map(ev => {
                const cfg = CONFIG_EVENTO_AUX[ev.evento] || CONFIG_EVENTO_AUX.sincronizada
                const Icono = cfg.icono
                return (
                  <li key={ev.id} className="flex items-start gap-2 text-xxs">
                    <Icono size={11} style={{ color: cfg.color }} className="shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline gap-2 flex-wrap">
                        <span className="font-medium text-texto-secundario">{cfg.etiqueta}</span>
                        {ev.usuario_nombre && (
                          <span className="text-texto-terciario">por {ev.usuario_nombre}</span>
                        )}
                        <span className="text-texto-terciario ml-auto tabular-nums">
                          {formatearFechaLarga(ev.creado_en, locale)}
                        </span>
                      </div>
                      {ev.detalle && (
                        <p className="text-texto-terciario mt-0.5 break-words">{ev.detalle}</p>
                      )}
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
