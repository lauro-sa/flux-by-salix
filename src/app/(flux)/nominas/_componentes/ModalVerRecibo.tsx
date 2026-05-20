'use client'

/**
 * Modal de "Ver recibo" — previsualiza el PDF del recibo embebido
 * en un iframe y ofrece las acciones principales del flujo de
 * liquidación en un solo lugar:
 *
 *   - Regenerar el PDF (fuerza recálculo después de cambios).
 *   - Descargar.
 *   - Enviar por correo/WhatsApp (delega al ModalEnviarReciboNomina).
 *   - Registrar pago (delega al ModalConfirmarPagoNomina).
 *
 * Modo:
 *   - Si hay `pagoId` (pago ya grabado): usa el PDF definitivo de
 *     `/api/nominas/pagos/[id]/pdf` que regenera en cada GET con
 *     los datos snapshoteados del pago.
 *   - Si NO hay pago: usa `/api/nominas/recibo-preview` que
 *     genera un BORRADOR con los datos calculados en vivo (incluye
 *     ajustes del período, conceptos automáticos, todo).
 *
 * El iframe se refresca al hacer "Regenerar" cambiando un cache
 * buster en el src. Mostrar PDF en iframe funciona en todos los
 * browsers modernos vía el visor nativo.
 */

import { useEffect, useState } from 'react'
import {
  Loader2, RotateCw, Download, Send, Banknote, AlertCircle,
} from 'lucide-react'
import { ModalAdaptable as Modal } from '@/componentes/ui/ModalAdaptable'
import { Boton } from '@/componentes/ui/Boton'
import { useToast } from '@/componentes/feedback/Toast'
import { useReportarCarga } from '@/hooks/useCargaGlobal'

interface Props {
  abierto: boolean
  onCerrar: () => void
  miembroId: string
  periodoInicio: string
  periodoFin: string
  /**
   * Si hay un pago grabado para este período, su id. El modal usa
   * el PDF definitivo. Si no hay, genera un borrador en vivo.
   */
  pagoId?: string | null
  /** Callback para abrir el modal de envío (correo/WhatsApp). */
  onEnviar?: () => void
  /** Callback para abrir el modal de registrar pago. */
  onRegistrarPago?: () => void
}

export function ModalVerRecibo({
  abierto, onCerrar, miembroId, periodoInicio, periodoFin, pagoId,
  onEnviar, onRegistrarPago,
}: Props) {
  const toast = useToast()
  const [url, setUrl] = useState<string | null>(null)
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  /**
   * Cache buster que se incrementa al regenerar. El iframe lo usa en
   * el query string para forzar al browser a re-pedirlo aunque la URL
   * firmada coincida.
   */
  const [versionVista, setVersionVista] = useState(0)

  // Generación/regeneración del PDF de recibo. El backend recalcula valores
  // y arma el PDF — visible en la BarraProgresoGlobal del header.
  useReportarCarga(cargando && abierto, `nomina-recibo-${pagoId ?? `${miembroId}-${periodoInicio}`}`)

  const cargar = async () => {
    setCargando(true)
    setError(null)
    try {
      let res: Response
      if (pagoId) {
        res = await fetch(`/api/nominas/pagos/${pagoId}/pdf`)
      } else {
        res = await fetch('/api/nominas/recibo-preview', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            miembro_id: miembroId,
            periodo_inicio: periodoInicio,
            periodo_fin: periodoFin,
          }),
        })
      }
      const data = await res.json()
      if (!res.ok || !data.url) {
        const msg = data.error || 'No se pudo generar el PDF'
        setError(msg)
        toast.mostrar('error', msg)
        return
      }
      setUrl(data.url)
      setVersionVista(v => v + 1)
    } catch (err) {
      console.error('[ModalVerRecibo] error:', err)
      setError('Error de red')
    } finally {
      setCargando(false)
    }
  }

  useEffect(() => {
    if (!abierto) {
      setUrl(null)
      setError(null)
      return
    }
    cargar()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [abierto, miembroId, periodoInicio, periodoFin, pagoId])

  // src con cache buster para forzar refresh del iframe al regenerar.
  const srcIframe = url ? `${url}#v=${versionVista}` : null

  const descargar = () => {
    if (!url) return
    window.open(url, '_blank')
  }

  return (
    <Modal
      abierto={abierto}
      onCerrar={onCerrar}
      titulo={pagoId ? 'Recibo generado' : 'Vista previa del recibo'}
      tamano="3xl"
      sinPadding
      accionPeligro={undefined}
      accionSecundaria={onEnviar ? { etiqueta: 'Enviar', onClick: onEnviar, icono: <Send size={13} /> } : undefined}
      accionPrimaria={onRegistrarPago && !pagoId ? {
        etiqueta: 'Registrar pago',
        onClick: onRegistrarPago,
        icono: <Banknote size={13} />,
      } : undefined}
      footerExtraIzquierda={
        <div className="flex items-center gap-2">
          <Boton variante="fantasma" tamano="sm" icono={<RotateCw size={13} />}
            onClick={cargar} disabled={cargando}>
            Regenerar
          </Boton>
          <Boton variante="fantasma" tamano="sm" icono={<Download size={13} />}
            onClick={descargar} disabled={!url || cargando}>
            Descargar
          </Boton>
        </div>
      }
    >
      <div className="relative bg-superficie-elevada" style={{ minHeight: '70vh' }}>
        {/* Banner cuando es borrador (sin pago grabado) */}
        {!pagoId && url && !error && (
          <div className="flex items-start gap-2 px-4 py-2 bg-insignia-info/10 border-b border-insignia-info/20 text-xs text-insignia-info">
            <AlertCircle size={13} className="shrink-0 mt-0.5" />
            <span>
              <strong>Borrador</strong> — todavía no registraste el pago. Lo que ves se va a generar
              definitivo al confirmar.
            </span>
          </div>
        )}

        {error ? (
          <div className="flex flex-col items-center justify-center gap-3 py-20 px-4 text-center">
            <AlertCircle size={32} className="text-insignia-peligro" />
            <p className="text-sm text-texto-secundario">{error}</p>
            <Boton variante="secundario" tamano="sm" icono={<RotateCw size={13} />} onClick={cargar}>
              Reintentar
            </Boton>
          </div>
        ) : cargando && !url ? (
          <div className="flex items-center justify-center py-32 text-texto-terciario">
            <Loader2 size={24} className="animate-spin" />
          </div>
        ) : srcIframe ? (
          <iframe
            key={srcIframe}
            src={srcIframe}
            className="w-full block bg-white"
            style={{ height: '70vh', border: 'none' }}
            title="Recibo de nómina"
          />
        ) : null}

        {/* Overlay de regenerando sin destruir el iframe actual */}
        {cargando && url && (
          <div className="absolute inset-0 bg-superficie-elevada/60 backdrop-blur-sm flex items-center justify-center">
            <div className="flex items-center gap-2 text-sm text-texto-secundario bg-superficie-tarjeta border border-borde-sutil rounded-lg px-3 py-2 shadow">
              <Loader2 size={14} className="animate-spin" />
              Regenerando...
            </div>
          </div>
        )}
      </div>
    </Modal>
  )
}
