'use client'

/**
 * EntradaPago — Render distintivo de un pago en el timeline del chatter.
 * Diseño: fila de timeline con un ribete lateral verde, monto tabular
 * destacado, método como chip neutro y comprobante como mini-thumb.
 * Sin fondo de burbuja (para no parecerse a un mensaje de WhatsApp).
 *
 * Se renderiza desde EntradaTimeline cuando la entrada es de tipo 'sistema'
 * con acción: pago_confirmado | pago_rechazado | portal_comprobante.
 */

import { useState } from 'react'
import { Paperclip, XCircle, Check, Pencil, Trash2 } from 'lucide-react'
import { Lightbox } from '@/componentes/ui/Lightbox'
import { ETIQUETAS_METODO_PAGO, type MetodoPago } from '@/tipos/presupuesto-pago'
import type { EntradaChatter } from '@/tipos/chatter'
import { fechaRelativa, fechaCompleta } from './constantes'

interface PropsEntradaPago {
  entrada: EntradaChatter
  formatoHora: string
  locale: string
  onEditar?: (pagoId: string) => void
  onEliminar?: (pagoId: string, monto: string, moneda: string) => void
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

export function EntradaPago({ entrada, formatoHora, locale, onEditar, onEliminar }: PropsEntradaPago) {
  const [lightbox, setLightbox] = useState<
    { url: string; nombre: string; tipo: string } | null
  >(null)

  const accion = entrada.metadata?.accion
  const esRechazado = accion === 'pago_rechazado'
  const esPortal = accion === 'portal_comprobante'

  const monto = Number(entrada.metadata?.monto_pago || 0)
  const moneda = (entrada.metadata?.pago_moneda as string) || 'ARS'
  const metodo = entrada.metadata?.pago_metodo as MetodoPago | undefined
  const fechaPago =
    (entrada.metadata?.pago_fecha as string) ||
    (entrada.metadata?.fecha_evento as string) ||
    entrada.creado_en
  const descripcion = entrada.metadata?.descripcion_pago as string | undefined
  // Info de cuota — "Cuota N de M" + descripción
  const cuotaNumero = entrada.metadata?.cuota_numero as number | null | undefined
  const cuotasTotal = entrada.metadata?.cuotas_total as number | null | undefined
  const cuotaDescripcion = entrada.metadata?.cuota_descripcion as string | null | undefined
  const etiquetaCuota =
    cuotaNumero && cuotasTotal
      ? `Cuota ${cuotaNumero} de ${cuotasTotal}${cuotaDescripcion ? ` · ${cuotaDescripcion}` : ''}`
      : entrada.metadata?.cuota_id
        ? 'Imputado a cuota'
        : 'A cuenta'

  // Tema según tipo (ribete lateral + color del monto)
  const tema = esRechazado
    ? {
      ribete: 'bg-insignia-peligro',
      color: 'text-insignia-peligro',
      chipBorde: 'border-insignia-peligro/30',
      titulo: 'Pago rechazado',
    }
    : esPortal
      ? {
        ribete: 'bg-insignia-advertencia',
        color: 'text-insignia-advertencia',
        chipBorde: 'border-insignia-advertencia/30',
        titulo: 'Comprobante recibido',
      }
      : {
        ribete: 'bg-insignia-exito',
        color: 'text-insignia-exito',
        chipBorde: 'border-insignia-exito/30',
        titulo: 'Pago registrado',
      }

  const comprobante = entrada.adjuntos?.[0]
  const pagoId = entrada.metadata?.pago_id as string | undefined
  const puedeEditar = !!onEditar && !!pagoId && !esPortal
  const puedeEliminar = !!onEliminar && !!pagoId && !esPortal

  return (
    <div className="group flex items-stretch gap-2.5">
      {/* Ribete lateral vertical (identidad visual del pago) */}
      <div className={`w-0.5 rounded-full shrink-0 ${tema.ribete} opacity-70`} />

      <div className="flex-1 min-w-0">
        {/* Línea de encabezado: autor · título · fecha + acciones en hover */}
        <div className="flex items-center gap-2">
          <div className={`size-5 rounded-full flex items-center justify-center shrink-0 ${tema.color}`}>
            {esRechazado ? <XCircle className="size-3.5" /> : <Check className="size-3.5" strokeWidth={3} />}
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

        {/* Monto destacado + chips inline */}
        <div className="ml-7 mt-0.5 flex items-baseline gap-2 flex-wrap">
          <span className={`text-base font-semibold tabular-nums ${tema.color}`}>
            {fmtMoneda(monto, moneda)}
          </span>
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

        {/* Chip de cuota: "Cuota 1 de 2 · Adelanto" (o "A cuenta") */}
        <div className="ml-7 mt-1">
          <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full border text-xxs bg-superficie-tarjeta/40 ${
            cuotaNumero
              ? `${tema.chipBorde} ${tema.color}`
              : 'border-borde-sutil text-texto-secundario'
          }`}>
            {etiquetaCuota}
          </span>
        </div>

        {descripcion && (
          <p className="ml-7 mt-1 text-xs text-texto-secundario leading-snug">{descripcion}</p>
        )}

        {/* Comprobante como chip compacto (miniatura + nombre) */}
        {comprobante && (
          <div className="ml-7 mt-1.5">
            <ComprobanteChip
              url={comprobante.url}
              nombre={comprobante.nombre}
              tipo={comprobante.tipo}
              onVer={() =>
                setLightbox({
                  url: comprobante.url,
                  nombre: comprobante.nombre,
                  tipo: comprobante.tipo,
                })
              }
            />
          </div>
        )}
      </div>

      {lightbox && (
        <Lightbox
          url={lightbox.url}
          nombre={lightbox.nombre}
          tipo={lightbox.tipo}
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
  onVer,
}: {
  url: string
  nombre: string
  tipo: string
  onVer: () => void
}) {
  const esImagen = tipo.startsWith('image/') || /\.(jpg|jpeg|png|webp|gif|heic|bmp)$/i.test(nombre)
  const esPDF = tipo === 'application/pdf' || /\.pdf$/i.test(nombre)

  return (
    <button
      type="button"
      onClick={onVer}
      className="inline-flex items-center gap-2 pl-1 pr-2.5 py-1 rounded-full border border-borde-sutil bg-superficie-tarjeta/60 hover:bg-white/[0.04] max-w-full group/chip cursor-pointer"
      title="Ver comprobante"
    >
      {esImagen ? (
        <div className="size-6 rounded-full border border-borde-sutil bg-black/20 overflow-hidden shrink-0">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={url} alt="" className="w-full h-full object-cover" />
        </div>
      ) : esPDF ? (
        <div className="size-6 rounded-full bg-insignia-peligro/10 text-insignia-peligro flex items-center justify-center shrink-0 text-[8px] font-semibold">
          PDF
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
