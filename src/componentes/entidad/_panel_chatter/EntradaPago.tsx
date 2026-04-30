'use client'

/**
 * EntradaPago — Render distintivo de un pago en el timeline del chatter.
 * Diseño: fila de timeline con un ribete lateral verde, monto tabular
 * destacado, método como chip neutro y comprobantes como mini-thumbs.
 *
 * Maneja 3 variantes vía metadata.accion:
 *   - pago_confirmado : pago normal o adicional (es_adicional → ribete azul)
 *   - portal_comprobante : el cliente subió un comprobante por el portal
 */

import { useEffect, useState } from 'react'
import { Paperclip, Check, Pencil, Trash2, Sparkles, ReceiptText, AlertCircle, Mail, MessageSquare } from 'lucide-react'
import { IconoWhatsApp } from '@/componentes/iconos/IconoWhatsApp'
import { Lightbox } from '@/componentes/ui/Lightbox'
import { ETIQUETAS_METODO_PAGO, type MetodoPago } from '@/tipos/presupuesto-pago'
import type { EntradaChatter } from '@/tipos/chatter'
import { fechaRelativa, fechaCompleta } from './constantes'

// Métodos de pago donde tiene sentido pedir comprobante: transferencia,
// depósito y cheque. Para efectivo / tarjeta / otro no se exige.
const METODOS_REQUIEREN_COMPROBANTE: MetodoPago[] = ['transferencia', 'deposito', 'cheque']

interface PropsEntradaPago {
  entrada: EntradaChatter
  formatoHora: string
  locale: string
  onEditar?: (pagoId: string) => void
  onEliminar?: (pagoId: string, monto: string, moneda: string) => void
  /** Autor + tipo del mensaje desde el que se registró el pago (correo /
   *  WhatsApp / mensaje). Permite mostrar un chip "desde correo de X" que
   *  scrollea al evento origen. */
  autorOrigen?: { autor: string; tipo: string }
}

function fmtMoneda(monto: number, moneda: string) {
  try {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: moneda,
      maximumFractionDigits: 2,
    }).format(monto)
  } catch {
    return `${monto.toLocaleString('es-AR', { maximumFractionDigits: 2 })} ${moneda}`
  }
}

export function EntradaPago({ entrada, formatoHora, locale, onEditar, onEliminar, autorOrigen }: PropsEntradaPago) {
  const [lightbox, setLightbox] = useState<
    { url: string; nombre: string; tipo: string; endpointDescarga?: string } | null
  >(null)

  const accion = entrada.metadata?.accion
  const esPortal = accion === 'portal_comprobante'
  const meta = entrada.metadata as Record<string, unknown> | undefined
  const esAdicional = !!meta?.es_adicional
  const conceptoAdicional = (meta?.concepto_adicional as string | undefined) || undefined

  const monto = Number(entrada.metadata?.monto_pago || 0)
  const moneda = (entrada.metadata?.pago_moneda as string) || 'ARS'
  const metodo = entrada.metadata?.pago_metodo as MetodoPago | undefined
  const editadoPorNombre = (meta?.editado_por_nombre as string | undefined) || undefined
  const editadoEn = (meta?.editado_en as string | undefined) || undefined
  // Mostrar "editado por X" sólo si el editor es distinto del creador.
  const fueEditadoPorOtro = editadoPorNombre && editadoPorNombre.trim() !== '' && editadoPorNombre !== entrada.autor_nombre
  const fechaPago =
    (entrada.metadata?.pago_fecha as string) ||
    (entrada.metadata?.fecha_evento as string) ||
    entrada.creado_en
  const descripcion = entrada.metadata?.descripcion_pago as string | undefined
  const montoPercepciones = Number((meta?.monto_percepciones as string) || 0)

  // Info de cuota — "Cuota N de M" + descripción
  const cuotaNumero = entrada.metadata?.cuota_numero as number | null | undefined
  const cuotasTotal = entrada.metadata?.cuotas_total as number | null | undefined
  const cuotaDescripcion = entrada.metadata?.cuota_descripcion as string | null | undefined

  let etiquetaCuota: string
  if (esAdicional) {
    etiquetaCuota = 'Adicional'
  } else if (cuotaNumero && cuotasTotal) {
    etiquetaCuota = `Cuota ${cuotaNumero} de ${cuotasTotal}${cuotaDescripcion ? ` · ${cuotaDescripcion}` : ''}`
  } else if (entrada.metadata?.cuota_id) {
    etiquetaCuota = 'Imputado a cuota'
  } else {
    etiquetaCuota = 'A cuenta'
  }

  // Tema según tipo
  const tema = esAdicional
    ? {
      ribete: 'bg-insignia-info',
      color: 'text-insignia-info',
      chipBorde: 'border-insignia-info/30',
      titulo: 'Adicional registrado',
      icono: <Sparkles className="size-3.5" />,
    }
    : esPortal
      ? {
        ribete: 'bg-insignia-advertencia',
        color: 'text-insignia-advertencia',
        chipBorde: 'border-insignia-advertencia/30',
        titulo: 'Comprobante recibido',
        icono: <Check className="size-3.5" strokeWidth={3} />,
      }
      : {
        ribete: 'bg-insignia-exito',
        color: 'text-insignia-exito',
        chipBorde: 'border-insignia-exito/30',
        titulo: 'Pago registrado',
        icono: <Check className="size-3.5" strokeWidth={3} />,
      }

  const adjuntos = entrada.adjuntos || []
  const pagoId = entrada.metadata?.pago_id as string | undefined
  const puedeEditar = !!onEditar && !!pagoId && !esPortal
  const puedeEliminar = !!onEliminar && !!pagoId && !esPortal

  const mensajeOrigenId = entrada.metadata?.mensaje_origen_chatter_id
  const irAOrigen = () => {
    if (!mensajeOrigenId) return
    const el = document.querySelector(`[data-chatter-entrada-id="${mensajeOrigenId}"]`)
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }

  return (
    <div className="group flex items-stretch gap-2.5" data-pago-id={pagoId}>
      {/* Ribete lateral vertical (identidad visual del pago) */}
      <div className={`w-0.5 rounded-full shrink-0 ${tema.ribete} opacity-70`} />

      <div className="flex-1 min-w-0">
        {/* Línea de encabezado: autor · título · fecha + acciones en hover */}
        <div className="flex items-center gap-2">
          <div className={`size-5 rounded-full flex items-center justify-center shrink-0 ${tema.color}`}>
            {tema.icono}
          </div>
          <p className="text-xs text-texto-secundario flex-1 min-w-0 truncate">
            <span className="font-medium text-texto-primario">{entrada.autor_nombre}</span>
            <span className="text-texto-terciario"> · </span>
            {tema.titulo}
          </p>
          <div className="flex items-center gap-0.5 shrink-0">
            {(puedeEditar || puedeEliminar) && (
              <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                {puedeEditar && (
                  <button
                    type="button"
                    onClick={() => onEditar?.(pagoId!)}
                    className="size-6 rounded-boton flex items-center justify-center text-texto-terciario hover:text-texto-secundario hover:bg-white/[0.06]"
                    aria-label="Editar pago"
                    title="Editar"
                  >
                    <Pencil className="size-3" />
                  </button>
                )}
                {puedeEliminar && (
                  <button
                    type="button"
                    onClick={() => onEliminar?.(pagoId!, String(monto), moneda)}
                    className="size-6 rounded-boton flex items-center justify-center text-texto-terciario hover:text-insignia-peligro hover:bg-white/[0.06]"
                    aria-label="Eliminar pago"
                    title="Eliminar"
                  >
                    <Trash2 className="size-3" />
                  </button>
                )}
              </div>
            )}
            <span
              className="text-xxs text-texto-terciario ml-1"
              title={fechaCompleta(fechaPago, formatoHora, locale)}
            >
              {fechaRelativa(fechaPago, formatoHora, locale)}
            </span>
          </div>
        </div>

        {/* Monto destacado + chips inline.
            Cuando hay percepciones, el número grande es el total cobrado
            (= monto al banco + percepciones), porque ese es el cobro real
            desde la perspectiva del cliente. Abajo se muestra el desglose
            "X al banco · Y retenciones" en chico para no confundir al lector. */}
        <div className="ml-7 mt-0.5">
          <div className="flex items-baseline gap-2 flex-wrap">
            <span className={`text-base font-semibold tabular-nums ${tema.color}`}>
              {fmtMoneda(monto + montoPercepciones, moneda)}
            </span>
            {montoPercepciones > 0 && (
              <span className="text-xxs text-texto-terciario">
                total cobrado
              </span>
            )}
            {metodo && (
              <span className="text-xxs text-texto-terciario">
                · {ETIQUETAS_METODO_PAGO[metodo] || metodo}
              </span>
            )}
            {entrada.metadata?.pago_fecha && (
              <span className="text-xxs text-texto-terciario">
                · {fechaCompleta(entrada.metadata.pago_fecha as string, formatoHora, locale)}
              </span>
            )}
          </div>
          {montoPercepciones > 0 && (
            <p className="text-xxs text-texto-terciario mt-0.5 tabular-nums">
              <span>{fmtMoneda(monto, moneda)} al banco</span>
              <span className="mx-1.5">·</span>
              <span className="text-insignia-advertencia">
                {fmtMoneda(montoPercepciones, moneda)} retenciones
              </span>
            </p>
          )}
        </div>

        {/* Chip: cuota / a cuenta / adicional + origen + indicador "editado por X" */}
        <div className="ml-7 mt-1 flex items-center gap-2 flex-wrap">
          <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full border text-xxs bg-superficie-tarjeta/40 ${
            cuotaNumero || esAdicional
              ? `${tema.chipBorde} ${tema.color}`
              : 'border-borde-sutil text-texto-secundario'
          }`}>
            {etiquetaCuota}
          </span>
          {autorOrigen && mensajeOrigenId && (
            <button
              type="button"
              onClick={irAOrigen}
              className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full border border-borde-sutil bg-superficie-tarjeta/40 text-xxs text-texto-secundario hover:border-canal-correo/40 hover:text-canal-correo hover:bg-canal-correo/5 transition-colors"
              title="Ver mensaje origen del pago"
            >
              {autorOrigen.tipo === 'correo' ? (
                <Mail size={10} />
              ) : autorOrigen.tipo === 'whatsapp' ? (
                <IconoWhatsApp size={10} />
              ) : (
                <MessageSquare size={10} />
              )}
              desde {autorOrigen.tipo === 'correo' ? 'correo' : autorOrigen.tipo === 'whatsapp' ? 'WhatsApp' : 'mensaje'} de {autorOrigen.autor}
            </button>
          )}
          {fueEditadoPorOtro && (
            <span
              className="inline-flex items-center gap-1 text-xxs text-texto-terciario italic"
              title={editadoEn ? `Editado por ${editadoPorNombre} el ${fechaCompleta(editadoEn, formatoHora, locale)}` : `Editado por ${editadoPorNombre}`}
            >
              <Pencil className="size-2.5" />
              editado por {editadoPorNombre}
              {editadoEn && <span> · {fechaRelativa(editadoEn, formatoHora, locale)}</span>}
            </span>
          )}
        </div>

        {esAdicional && conceptoAdicional && (
          <p className="ml-7 mt-1 text-xs text-texto-secundario leading-snug">
            {conceptoAdicional}
          </p>
        )}

        {descripcion && (
          <p className="ml-7 mt-1 text-xs text-texto-secundario leading-snug">{descripcion}</p>
        )}

        {/* Comprobantes adjuntos (chips compactos, uno por archivo) */}
        {adjuntos.length > 0 && (
          <div className="ml-7 mt-1.5 flex flex-wrap gap-1.5">
            {adjuntos.map((c, i) => (
              <ComprobanteChip
                key={i}
                url={c.url}
                nombre={c.nombre}
                tipo={c.tipo}
                endpointDescarga={c.endpoint_descarga}
                onVer={() => setLightbox({
                  url: c.url,
                  nombre: c.nombre,
                  tipo: c.tipo,
                  endpointDescarga: c.endpoint_descarga,
                })}
              />
            ))}
          </div>
        )}

        {/* Advertencia: pago por transferencia/depósito/cheque sin comprobante.
            Sólo visible para pagos registrados internos (no para portal_comprobante,
            que ya implica que llegó un comprobante). Click → editar para adjuntar. */}
        {!esPortal && metodo && METODOS_REQUIEREN_COMPROBANTE.includes(metodo) && adjuntos.length === 0 && (
          <button
            type="button"
            onClick={() => puedeEditar && onEditar?.(pagoId!)}
            disabled={!puedeEditar}
            className="ml-7 mt-1.5 inline-flex items-center gap-1.5 px-2 py-1 rounded-md border border-insignia-advertencia/30 bg-insignia-advertencia/10 text-xxs text-insignia-advertencia hover:bg-insignia-advertencia/15 transition-colors cursor-pointer disabled:opacity-60 disabled:cursor-default"
            title={puedeEditar ? 'Agregar el comprobante de la transferencia' : 'Falta cargar el comprobante'}
          >
            <AlertCircle className="size-3" />
            Falta el comprobante
            {puedeEditar && <span className="text-texto-terciario ml-0.5">· adjuntar</span>}
          </button>
        )}
      </div>

      {lightbox && (
        <Lightbox
          url={lightbox.url}
          nombre={lightbox.nombre}
          tipo={lightbox.tipo}
          endpointDescarga={lightbox.endpointDescarga}
          onCerrar={() => setLightbox(null)}
        />
      )}
    </div>
  )
}

// ─── Chip compacto del comprobante ───────────────────────────────────────
function ComprobanteChip({
  url,
  nombre,
  tipo,
  endpointDescarga,
  onVer,
}: {
  url: string
  nombre: string
  tipo: string
  endpointDescarga?: string
  onVer: () => void
}) {
  const esImagen = tipo.startsWith('image/') || /\.(jpg|jpeg|png|webp|gif|heic|bmp)$/i.test(nombre)
  const esPDF = tipo === 'application/pdf' || /\.pdf$/i.test(nombre)
  // Heurística: si el nombre contiene "retencion"/"percepcion" o el tipo
  // del adjunto es 'percepcion' (cuando viene del backend nuevo), mostramos
  // ícono de retención. Ojo: AdjuntoChatter no tiene una key explícita así
  // que detectamos por nombre.
  const esRetencion = /retenci|percepc/i.test(nombre)

  // Para bucket privado: la url viene vacía y hay endpoint_descarga.
  // Pedimos la signed URL una sola vez para mostrar el thumb de imagen.
  const [urlThumb, setUrlThumb] = useState<string>(url)
  useEffect(() => {
    if (url) { setUrlThumb(url); return }
    if (!esImagen || !endpointDescarga) return
    let cancelado = false
    fetch(endpointDescarga)
      .then(async (r) => {
        if (!r.ok) return
        const data = (await r.json()) as { url: string }
        if (!cancelado) setUrlThumb(data.url)
      })
      .catch(() => { /* silencioso: cae al ícono genérico */ })
    return () => { cancelado = true }
  }, [url, esImagen, endpointDescarga])

  return (
    <button
      type="button"
      onClick={onVer}
      className="inline-flex items-center gap-2 pl-1 pr-2.5 py-1 rounded-full border border-borde-sutil bg-superficie-tarjeta/60 hover:bg-white/[0.04] max-w-full group/chip cursor-pointer"
      title="Ver comprobante"
    >
      {esImagen && urlThumb ? (
        <div className="size-6 rounded-full border border-borde-sutil bg-black/20 overflow-hidden shrink-0">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={urlThumb} alt="" className="w-full h-full object-cover" />
        </div>
      ) : esImagen ? (
        <div className="size-6 rounded-full border border-borde-sutil bg-black/20 shrink-0" />
      ) : esPDF ? (
        <div className="size-6 rounded-full bg-insignia-peligro/10 text-insignia-peligro flex items-center justify-center shrink-0 text-[8px] font-semibold">
          PDF
        </div>
      ) : esRetencion ? (
        <div className="size-6 rounded-full bg-insignia-advertencia/10 text-insignia-advertencia flex items-center justify-center shrink-0">
          <ReceiptText className="size-3" />
        </div>
      ) : (
        <div className="size-6 rounded-full bg-white/[0.05] text-texto-terciario flex items-center justify-center shrink-0">
          <Paperclip className="size-3" />
        </div>
      )}
      <span className="text-xxs text-texto-secundario truncate group-hover/chip:text-texto-marca transition-colors">
        {nombre}
      </span>
    </button>
  )
}
