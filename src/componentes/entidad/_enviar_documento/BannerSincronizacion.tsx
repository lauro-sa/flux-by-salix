'use client'

/**
 * Banner que aparece en la cabecera del modal "Enviar documento" para
 * comunicar el estado de regeneración de los recursos del envío (PDF +
 * PDF congelado + link público del portal).
 *
 * Estados:
 *   - 'sincronizando' → spinner + "Preparando documento…"
 *   - 'ok'            → check verde + "Documento sincronizado" (autohide
 *     en 4 s controlado por el padre).
 *   - 'desactualizado' → alerta amarilla + mensaje custom + botón
 *     "Reintentar" cuando lo pasen.
 *   - 'error'         → x roja + mensaje custom + botón "Reintentar".
 *
 * No maneja su propia visibilidad: el padre la envuelve en
 * `<AnimatePresence>` y decide cuándo mostrarlo (estado 'ok' se
 * auto-desvanece, los otros tres se mantienen).
 */

import { AlertTriangle, Check, Loader2, RotateCcw, XCircle } from 'lucide-react'
import type { ReactNode } from 'react'
import type { EstadoSincronizacionEnvio } from '@/lib/presupuestos/sincronizar-recursos-envio'

interface Props {
  estado: EstadoSincronizacionEnvio
  mensaje?: string | null
  onReintentar?: () => void
}

interface ConfigEstado {
  icono: ReactNode
  texto: string
  clases: {
    fondo: string
    borde: string
    texto: string
  }
  reintentarVisible: boolean
}

const CONFIG: Record<EstadoSincronizacionEnvio, ConfigEstado> = {
  sincronizando: {
    icono: <Loader2 size={14} className="animate-spin" />,
    texto: 'Preparando documento…',
    clases: {
      fondo: 'bg-superficie-hover',
      borde: 'border-borde-sutil',
      texto: 'text-texto-secundario',
    },
    reintentarVisible: false,
  },
  ok: {
    icono: <Check size={14} />,
    texto: 'Documento sincronizado',
    clases: {
      fondo: 'bg-insignia-exito/10',
      borde: 'border-insignia-exito/30',
      texto: 'text-insignia-exito',
    },
    reintentarVisible: false,
  },
  desactualizado: {
    icono: <AlertTriangle size={14} />,
    texto: 'El documento cambió desde el último envío',
    clases: {
      fondo: 'bg-insignia-advertencia/10',
      borde: 'border-insignia-advertencia/30',
      texto: 'text-insignia-advertencia',
    },
    reintentarVisible: true,
  },
  error: {
    icono: <XCircle size={14} />,
    texto: 'No se pudo preparar el documento',
    clases: {
      fondo: 'bg-insignia-peligro/10',
      borde: 'border-insignia-peligro/30',
      texto: 'text-insignia-peligro',
    },
    reintentarVisible: true,
  },
}

export function BannerSincronizacion({ estado, mensaje, onReintentar }: Props) {
  const cfg = CONFIG[estado]
  const textoVisible = mensaje?.trim() || cfg.texto

  return (
    <div
      className={`flex items-center justify-between gap-3 px-6 py-2 border-b ${cfg.clases.fondo} ${cfg.clases.borde}`}
      role="status"
      aria-live="polite"
    >
      <div className={`flex items-center gap-2 text-xs font-medium ${cfg.clases.texto} min-w-0`}>
        <span className="shrink-0">{cfg.icono}</span>
        <span className="truncate">{textoVisible}</span>
      </div>
      {cfg.reintentarVisible && onReintentar && (
        <button
          type="button"
          onClick={onReintentar}
          className={`inline-flex items-center gap-1 text-[11px] font-semibold ${cfg.clases.texto} hover:opacity-80 shrink-0`}
        >
          <RotateCcw size={12} />
          Reintentar
        </button>
      )}
    </div>
  )
}

export default BannerSincronizacion
