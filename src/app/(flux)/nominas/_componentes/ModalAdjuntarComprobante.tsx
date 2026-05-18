'use client'

/**
 * ModalAdjuntarComprobante — Modal liviano para adjuntar (o reemplazar)
 * el comprobante de un pago de nómina ya registrado.
 *
 * Flujo:
 *   1. Operador clickea "Adjuntar comprobante" en la card del empleado pagado.
 *   2. Selecciona archivo (PDF/imagen). Se sube a Storage via
 *      POST /api/nominas/pagos/comprobante → devuelve URL pública.
 *   3. Al confirmar, hace PATCH /api/nominas/pagos/[id] con la nueva URL
 *      y actualiza el ledger.
 *
 * Si el pago ya tenía comprobante, muestra el archivo actual y permite
 * reemplazarlo o quitarlo. No reabre el modal de pago — esto es estrictamente
 * para adjuntar/reemplazar comprobante después del hecho.
 *
 * Se monta a nivel del dashboard (VistaNomina) para no acoplarlo a la card.
 */

import { useEffect, useRef, useState } from 'react'
import { FileText, Upload, X as IconX, Loader2, ExternalLink, Trash2 } from 'lucide-react'
import { ModalAdaptable as Modal } from '@/componentes/ui/ModalAdaptable'
import { useToast } from '@/componentes/feedback/Toast'

const TAMANO_MAXIMO_MB = 10
const TIPOS_ACEPTADOS = '.pdf,.jpg,.jpeg,.png,.webp'

interface Props {
  abierto: boolean
  onCerrar: () => void
  pagoId: string | null
  nombreEmpleado: string
  montoAbonado: number
  /** URL del comprobante ya cargado (si existe). */
  comprobanteActualUrl: string | null
  /** Callback tras guardar exitoso — la vista padre refresca. */
  onGuardado: () => Promise<void> | void
}

function fmtMonto(v: number): string {
  return `$${v.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
}

function nombreDesdeUrl(url: string): string {
  try {
    const u = new URL(url)
    const partes = u.pathname.split('/').filter(Boolean)
    return decodeURIComponent(partes[partes.length - 1] ?? 'Comprobante')
  } catch {
    return 'Comprobante'
  }
}

export function ModalAdjuntarComprobante({
  abierto, onCerrar, pagoId, nombreEmpleado, montoAbonado, comprobanteActualUrl, onGuardado,
}: Props) {
  const toast = useToast()
  const inputArchivo = useRef<HTMLInputElement>(null)
  const [urlSubida, setUrlSubida] = useState<string | null>(null)
  const [nombreSubido, setNombreSubido] = useState<string | null>(null)
  const [subiendo, setSubiendo] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [arrastrando, setArrastrando] = useState(false)

  // Reset al abrir/cerrar para evitar arrastrar estado entre invocaciones.
  useEffect(() => {
    if (abierto) {
      setUrlSubida(null)
      setNombreSubido(null)
      setSubiendo(false)
      setGuardando(false)
      setArrastrando(false)
    }
  }, [abierto])

  const subirArchivo = async (archivo: File) => {
    if (archivo.size > TAMANO_MAXIMO_MB * 1024 * 1024) {
      toast.mostrar('error', `El archivo supera ${TAMANO_MAXIMO_MB} MB`)
      return
    }
    setSubiendo(true)
    try {
      const fd = new FormData()
      fd.append('archivo', archivo)
      const res = await fetch('/api/nominas/pagos/comprobante', { method: 'POST', body: fd })
      const data = await res.json()
      if (!res.ok) {
        toast.mostrar('error', data.error || 'No se pudo subir el comprobante')
        return
      }
      setUrlSubida(data.url)
      setNombreSubido(archivo.name)
    } catch (err) {
      console.error('[ModalAdjuntarComprobante] error al subir:', err)
      toast.mostrar('error', 'Error de red al subir')
    } finally {
      setSubiendo(false)
      if (inputArchivo.current) inputArchivo.current.value = ''
    }
  }

  const onSeleccionar = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (f) void subirArchivo(f)
  }

  const onDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setArrastrando(false)
    const f = e.dataTransfer.files?.[0]
    if (f) void subirArchivo(f)
  }

  const guardar = async (urlNueva: string | null) => {
    if (!pagoId) return
    setGuardando(true)
    try {
      const res = await fetch(`/api/nominas/pagos/${pagoId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ comprobante_url: urlNueva }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast.mostrar('error', data.error || 'No se pudo guardar')
        return
      }
      toast.mostrar('exito', urlNueva ? 'Comprobante adjunto' : 'Comprobante quitado')
      await onGuardado()
      onCerrar()
    } catch {
      toast.mostrar('error', 'Error de red al guardar')
    } finally {
      setGuardando(false)
    }
  }

  // El "estado actual" es el comprobante recién subido (prioridad) o el ya
  // persistido en el pago. Si urlSubida está seteado, prevalece sobre el
  // existente — el operador acaba de elegir uno nuevo.
  const urlMostrada = urlSubida ?? comprobanteActualUrl
  const nombreMostrado = nombreSubido ?? (comprobanteActualUrl ? nombreDesdeUrl(comprobanteActualUrl) : null)
  const yaExistia = !!comprobanteActualUrl && !urlSubida
  const hayCambio = urlSubida !== null || (urlMostrada === null && comprobanteActualUrl !== null)

  return (
    <Modal
      abierto={abierto}
      onCerrar={() => { if (!subiendo && !guardando) onCerrar() }}
      titulo="Adjuntar comprobante"
      tamano="md"
      accionSecundaria={{ etiqueta: 'Cancelar', onClick: onCerrar }}
      accionPrimaria={{
        etiqueta: comprobanteActualUrl && !urlSubida ? 'Cerrar' : 'Guardar',
        onClick: () => {
          if (comprobanteActualUrl && !urlSubida) {
            onCerrar()
            return
          }
          void guardar(urlSubida)
        },
        cargando: guardando,
        disabled: subiendo || (!hayCambio && !comprobanteActualUrl),
      }}
    >
      <div className="space-y-4">
        {/* ── Contexto del pago ── */}
        <div className="flex items-baseline justify-between gap-3 px-3 py-2 rounded-lg bg-white/[0.025] border border-white/[0.05]">
          <div className="min-w-0">
            <p className="text-[10px] uppercase tracking-wider text-texto-terciario">Empleado</p>
            <p className="text-sm font-medium text-texto-primario truncate">{nombreEmpleado}</p>
          </div>
          <div className="text-right shrink-0">
            <p className="text-[10px] uppercase tracking-wider text-texto-terciario">Pago registrado</p>
            <p className="text-sm font-semibold text-insignia-exito tabular-nums">{fmtMonto(montoAbonado)}</p>
          </div>
        </div>

        {/* ── Comprobante actual (si hay) ── */}
        {urlMostrada ? (
          <div className="space-y-2">
            <div className="flex items-center gap-2.5 rounded-lg border border-white/[0.06] bg-white/[0.03] px-3 py-2.5">
              <div className="size-8 rounded-md bg-white/[0.04] flex items-center justify-center shrink-0">
                <FileText size={14} className="text-texto-secundario" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm text-texto-primario truncate">{nombreMostrado}</p>
                <p className="text-[11px] text-texto-terciario">
                  {urlSubida ? 'Subido recién · pendiente de guardar' : 'Adjunto'}
                </p>
              </div>
              <a
                href={urlMostrada}
                target="_blank"
                rel="noopener noreferrer"
                className="shrink-0 text-texto-terciario hover:text-texto-marca p-1.5 rounded-md hover:bg-white/[0.05]"
                title="Abrir en nueva pestaña"
              >
                <ExternalLink size={13} />
              </a>
              <button
                type="button"
                onClick={() => {
                  if (urlSubida) {
                    setUrlSubida(null)
                    setNombreSubido(null)
                  } else {
                    void guardar(null)
                  }
                }}
                disabled={subiendo || guardando}
                className="shrink-0 text-texto-terciario hover:text-insignia-peligro p-1.5 rounded-md hover:bg-insignia-peligro/10 disabled:opacity-40"
                title={urlSubida ? 'Quitar selección' : 'Eliminar comprobante adjunto'}
              >
                {urlSubida ? <IconX size={13} /> : <Trash2 size={13} />}
              </button>
            </div>

            {/* Reemplazar */}
            <button
              type="button"
              onClick={() => inputArchivo.current?.click()}
              disabled={subiendo || guardando}
              className="w-full inline-flex items-center justify-center gap-1.5 text-[11px] text-texto-terciario hover:text-texto-marca py-1.5 disabled:opacity-50"
            >
              <Upload size={11} />
              Reemplazar {yaExistia ? 'comprobante' : 'archivo'}
            </button>
          </div>
        ) : (
          /* ── Drop zone (sin comprobante) ── */
          <div
            onDragOver={(e) => { e.preventDefault(); setArrastrando(true) }}
            onDragLeave={() => setArrastrando(false)}
            onDrop={onDrop}
            onClick={() => !subiendo && inputArchivo.current?.click()}
            className={`relative w-full rounded-xl border-2 border-dashed transition-colors px-4 py-8 cursor-pointer text-center
              ${arrastrando
                ? 'border-texto-marca bg-texto-marca/5'
                : 'border-white/[0.08] hover:border-white/[0.18] bg-white/[0.015] hover:bg-white/[0.03]'}
              ${subiendo ? 'pointer-events-none opacity-70' : ''}`}
          >
            {subiendo ? (
              <div className="flex flex-col items-center gap-2 text-texto-secundario">
                <Loader2 size={20} className="animate-spin" />
                <p className="text-sm">Subiendo…</p>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2">
                <div className="size-10 rounded-full bg-white/[0.05] flex items-center justify-center">
                  <Upload size={16} className="text-texto-secundario" />
                </div>
                <p className="text-sm text-texto-primario">
                  Arrastrá un archivo o <span className="text-texto-marca">elegí uno</span>
                </p>
                <p className="text-[11px] text-texto-terciario">
                  PDF, JPG, PNG · hasta {TAMANO_MAXIMO_MB} MB
                </p>
              </div>
            )}
          </div>
        )}

        <input
          ref={inputArchivo}
          type="file"
          accept={TIPOS_ACEPTADOS}
          onChange={onSeleccionar}
          className="hidden"
        />

        <p className="text-[11px] text-texto-terciario leading-relaxed">
          Si la transferencia es masiva, podés adjuntar el mismo comprobante a cada empleado del lote.
        </p>
      </div>
    </Modal>
  )
}
