'use client'

/**
 * EntradaTimeline — Renderiza una entrada individual del chatter.
 * Soporta múltiples tipos: sistema, mensaje, nota_interna, correo, whatsapp.
 * Cada tipo tiene su propia visualización con íconos, colores y acciones.
 * Se usa en: PanelChatter (timeline unificada).
 */

import { useState } from 'react'
import {
  FileText, Check, X, ChevronDown, ChevronUp,
  StickyNote, Globe, Mail, Paperclip,
  Clock, Pencil, Trash2,
} from 'lucide-react'
import { useFormato } from '@/hooks/useFormato'
import { IconoWhatsApp } from '@/componentes/iconos/IconoWhatsApp'
import { motion, AnimatePresence } from 'framer-motion'
import { Avatar } from '@/componentes/ui/Avatar'
import { Boton } from '@/componentes/ui/Boton'
import type { AccionSistema } from '@/tipos/chatter'
import { ICONOS_ACCION, fechaRelativa, fechaCompleta, formatearTextoWA } from './constantes'
import type { PropsEntradaTimeline } from './tipos'

export function EntradaTimeline({
  entrada,
  entidadTipo,
  usuarioActualId,
  formatoHora = '24h',
  onAccionComprobante,
  onEditarNota,
  onEliminarNota,
}: PropsEntradaTimeline) {
  const { locale } = useFormato()
  const esSistema = entrada.tipo === 'sistema'
  const esCorreo = entrada.tipo === 'correo'
  const esWhatsApp = entrada.tipo === 'whatsapp'
  const esNotaInterna = entrada.tipo === 'nota_interna'
  const esMensaje = entrada.tipo === 'mensaje'
  const esMensajePortal = esMensaje && entrada.metadata?.portal && entrada.autor_id === 'portal'

  const fh = formatoHora

  if (esSistema) {
    return <EntradaSistema entrada={entrada} entidadTipo={entidadTipo} formatoHora={fh} locale={locale} onAccionComprobante={onAccionComprobante} />
  }
  if (esCorreo) {
    return <EntradaCorreo entrada={entrada} formatoHora={fh} locale={locale} />
  }
  if (esWhatsApp) {
    return <EntradaWhatsApp entrada={entrada} formatoHora={fh} locale={locale} />
  }
  if (esNotaInterna) {
    const esPropia = !!usuarioActualId && entrada.autor_id === usuarioActualId
    return (
      <EntradaNotaInterna
        entrada={entrada}
        esPropia={esPropia}
        formatoHora={fh}
        locale={locale}
        onEditar={onEditarNota ? () => onEditarNota(entrada) : undefined}
        onEliminar={onEliminarNota ? () => onEliminarNota(entrada.id) : undefined}
      />
    )
  }

  return <EntradaMensaje entrada={entrada} esMensajePortal={!!esMensajePortal} formatoHora={fh} locale={locale} />
}

// ─── Entrada de sistema ───
function EntradaSistema({
  entrada,
  entidadTipo,
  formatoHora,
  locale,
  onAccionComprobante,
}: {
  entrada: PropsEntradaTimeline['entrada']
  entidadTipo: string
  formatoHora: string
  locale: string
  onAccionComprobante: PropsEntradaTimeline['onAccionComprobante']
}) {
  const [accionando, setAccionando] = useState(false)
  const accion = entrada.metadata?.accion as AccionSistema | undefined
  const config = accion ? ICONOS_ACCION[accion] : null
  const esComprobante = accion === 'portal_comprobante'
  const comprobanteId = entrada.metadata?.detalles?.comprobante_id as string | undefined

  const handleAccion = async (acc: 'confirmar' | 'rechazar') => {
    if (accionando || !comprobanteId) return
    setAccionando(true)
    await onAccionComprobante(entrada.id, comprobanteId, acc)
    setAccionando(false)
  }

  return (
    <div className="flex items-start gap-2.5 py-1.5 group">
      <div className={`flex items-center justify-center size-6 rounded-full shrink-0 mt-0.5 ${config?.color || 'bg-superficie-hover text-texto-terciario'}`}>
        {config?.icono || <Clock size={12} />}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-texto-secundario leading-relaxed">
          <span className="font-medium text-texto-primario">{entrada.autor_nombre}</span>
          {' · '}
          {entrada.contenido}
        </p>

        {/* Adjuntos */}
        <ListaAdjuntos adjuntos={entrada.adjuntos} />

        {/* Botones confirmar/rechazar comprobante */}
        {esComprobante && entidadTipo === 'presupuesto' && comprobanteId && (
          <div className="flex items-center gap-2 mt-2">
            <Boton variante="exito" tamano="xs" icono={<Check size={12} />} onClick={() => handleAccion('confirmar')} disabled={accionando} cargando={accionando}>
              Confirmar pago
            </Boton>
            <Boton variante="peligro" tamano="xs" icono={<X size={12} />} onClick={() => handleAccion('rechazar')} disabled={accionando}>
              Rechazar
            </Boton>
          </div>
        )}

        <span className="text-[10px] text-texto-terciario opacity-0 group-hover:opacity-100 transition-opacity" title={fechaCompleta(entrada.creado_en, formatoHora, locale)}>
          {fechaRelativa(entrada.creado_en, formatoHora, locale)}
        </span>
      </div>
    </div>
  )
}

// ─── Entrada de correo (expandible) ───
function EntradaCorreo({ entrada, formatoHora, locale }: { entrada: PropsEntradaTimeline['entrada']; formatoHora: string; locale: string }) {
  const [expandido, setExpandido] = useState(false)
  const accion = entrada.metadata?.accion as AccionSistema | undefined
  const esRecibido = accion === 'correo_recibido'
  const asunto = entrada.metadata?.correo_asunto || ''
  const destinatario = entrada.metadata?.correo_destinatario || entrada.metadata?.correo_de || ''
  const cc = entrada.metadata?.correo_cc
  const cco = entrada.metadata?.correo_cco
  const htmlCorreo = entrada.metadata?.correo_html

  return (
    <div className={`rounded-lg border overflow-hidden my-1 ${
      esRecibido
        ? 'border-canal-correo/30 bg-canal-correo/5'
        : 'border-borde-sutil bg-superficie-app/50'
    }`}>
      {/* Header del correo */}
      <button
        onClick={() => setExpandido(!expandido)}
        className="w-full flex items-center gap-2.5 px-3 py-2 text-left hover:bg-superficie-hover/50 transition-colors"
      >
        <div className="flex items-center justify-center size-7 rounded-full bg-canal-correo/10 text-canal-correo shrink-0">
          <Mail size={14} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-texto-primario truncate">{entrada.autor_nombre}</span>
            <span className="text-[10px] text-texto-terciario shrink-0">{fechaRelativa(entrada.creado_en, formatoHora)}</span>
          </div>
          <div className="flex items-center gap-1.5 mt-0.5">
            {esRecibido && <span className="text-[10px] px-1 py-px rounded bg-canal-correo/15 text-canal-correo font-medium">Recibido</span>}
            <p className="text-xs text-texto-secundario truncate">{asunto || entrada.contenido}</p>
          </div>
          {destinatario && (
            <p className="text-[10px] text-texto-terciario truncate mt-0.5">
              {esRecibido ? 'De' : 'Para'}: {destinatario}
              {cc && <span className="ml-1.5">· CC: {cc}</span>}
              {cco && <span className="ml-1.5">· CCO: {cco}</span>}
            </p>
          )}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {entrada.adjuntos?.length > 0 && (
            <span className="flex items-center gap-0.5 text-[10px] text-texto-terciario">
              <Paperclip size={10} />
              {entrada.adjuntos.length}
            </span>
          )}
          {htmlCorreo && (
            expandido ? <ChevronUp size={14} className="text-texto-terciario" /> : <ChevronDown size={14} className="text-texto-terciario" />
          )}
        </div>
      </button>

      {/* Cuerpo expandible del correo */}
      <AnimatePresence>
        {expandido && htmlCorreo && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-3 py-2 border-t border-borde-sutil">
              <div
                className="text-xs text-texto-secundario prose prose-sm max-w-none [&_img]:max-w-full [&_img]:h-auto"
                dangerouslySetInnerHTML={{ __html: htmlCorreo }}
              />
              <ListaAdjuntos adjuntos={entrada.adjuntos} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Si no tiene HTML, mostrar contenido como texto */}
      {expandido && !htmlCorreo && entrada.contenido && (
        <div className="px-3 py-2 border-t border-borde-sutil">
          <p className="text-xs text-texto-secundario whitespace-pre-wrap">{entrada.contenido}</p>
          <ListaAdjuntos adjuntos={entrada.adjuntos} />
        </div>
      )}
    </div>
  )
}

// ─── Entrada de WhatsApp ───
function EntradaWhatsApp({ entrada, formatoHora }: { entrada: PropsEntradaTimeline['entrada']; formatoHora: string }) {
  const numero = entrada.metadata?.whatsapp_numero || ''
  const destinatario = entrada.metadata?.whatsapp_destinatario || ''
  const plantilla = entrada.metadata?.whatsapp_plantilla
  const waStatus = entrada.metadata?.wa_status
  const botones = entrada.metadata?.whatsapp_botones

  return (
    <div className="rounded-lg border border-borde-sutil bg-superficie-app/50 overflow-hidden my-1.5">
      {/* Header: nombre + plantilla badge */}
      <div className="flex items-center gap-2.5 px-3 pt-2.5 pb-1">
        <div className="flex items-center justify-center size-7 rounded-full bg-canal-whatsapp/10 text-canal-whatsapp shrink-0">
          <IconoWhatsApp size={14} />
        </div>
        <span className="text-xs font-semibold text-texto-primario">
          {destinatario || numero || 'WhatsApp'}
        </span>
        {plantilla && <span className="text-[10px] px-1.5 py-px rounded bg-superficie-hover text-texto-terciario">Plantilla</span>}
      </div>

      {/* Subtítulo: para + enviado por */}
      <p className="text-[10px] text-texto-terciario px-3 pl-[52px] pb-2">
        {numero && <>Para: {numero}</>}
        {numero && entrada.autor_nombre && <> · </>}
        {entrada.autor_nombre && <>Enviado por {entrada.autor_nombre}</>}
      </p>

      {/* Contenido del mensaje */}
      <div className="px-3 pl-[52px] pb-1.5">
        <p
          className="text-xs text-texto-secundario whitespace-pre-wrap leading-relaxed"
          dangerouslySetInnerHTML={{ __html: formatearTextoWA(entrada.contenido) }}
        />
      </div>

      {/* Hora + palomitas (estilo inbox: abajo a la derecha) */}
      <div className="flex items-center justify-end gap-1 px-3 pb-2">
        <span className="text-[10px] text-texto-terciario">
          {new Date(entrada.creado_en).toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' })}
        </span>
        <PalomitasWA estado={waStatus} />
      </div>

      {/* Botones de plantilla (estilo inbox: ancho completo, separados) */}
      {botones && botones.length > 0 && (
        <div className="border-t border-borde-sutil space-y-px">
          {botones.map((btn, i) => {
            const esLink = btn.tipo === 'URL' && btn.url
            if (esLink) {
              return (
                <a
                  key={i}
                  href={btn.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-1 py-2 text-[13px] font-medium no-underline hover:bg-superficie-hover/50 transition-colors"
                  style={{ color: '#00a5f4' }}
                >
                  🔗 {btn.texto}
                </a>
              )
            }
            return (
              <div
                key={i}
                className="flex items-center justify-center gap-1 py-2 text-[13px] font-medium"
                style={{ color: '#00a5f4' }}
              >
                {btn.tipo === 'PHONE_NUMBER' && '📞 '}
                {btn.texto}
              </div>
            )
          })}
        </div>
      )}

      <ListaAdjuntos adjuntos={entrada.adjuntos} />
    </div>
  )
}

// ─── Palomitas de estado WhatsApp ───
function PalomitasWA({ estado }: { estado?: string }) {
  if (!estado) return null

  // Enviado: ✓ gris | Entregado: ✓✓ gris | Leído: ✓✓ azul | Fallido: ✗ rojo
  switch (estado) {
    case 'sent':
      return (
        <span className="text-texto-terciario" title="Enviado">
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="3 8.5 6.5 12 13 4" />
          </svg>
        </span>
      )
    case 'delivered':
      return (
        <span className="text-texto-terciario" title="Entregado">
          <svg width="16" height="14" viewBox="0 0 20 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="1 8.5 4.5 12 11 4" />
            <polyline points="6 8.5 9.5 12 16 4" />
          </svg>
        </span>
      )
    case 'read':
      return (
        <span className="text-[#53bdeb]" title="Leído">
          <svg width="16" height="14" viewBox="0 0 20 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="1 8.5 4.5 12 11 4" />
            <polyline points="6 8.5 9.5 12 16 4" />
          </svg>
        </span>
      )
    case 'failed':
      return (
        <span className="text-insignia-peligro" title="Fallido">
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="8" cy="8" r="6" />
            <line x1="6" y1="6" x2="10" y2="10" />
            <line x1="10" y1="6" x2="6" y2="10" />
          </svg>
        </span>
      )
    default:
      return null
  }
}

// ─── Nota interna (con formato rico) ───
function EntradaNotaInterna({
  entrada,
  esPropia,
  formatoHora,
  onEditar,
  onEliminar,
}: {
  entrada: PropsEntradaTimeline['entrada']
  esPropia: boolean
  formatoHora: string
  onEditar?: () => void
  onEliminar?: () => void
}) {
  const htmlContenido = entrada.metadata?.contenido_html
  const fueEditada = !!entrada.editado_en

  return (
    <div className="group flex items-start gap-2.5 py-2 bg-insignia-advertencia/5 -mx-3 px-3 rounded-lg my-0.5">
      <Avatar nombre={entrada.autor_nombre} foto={entrada.autor_avatar_url} tamano="xs" />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-texto-primario">{entrada.autor_nombre}</span>
          <span className="text-[10px] text-insignia-advertencia flex items-center gap-0.5 font-medium">
            <StickyNote size={10} /> Nota interna
          </span>
          {fueEditada && (
            <span className="text-[10px] text-texto-terciario italic">editada</span>
          )}

          <div className="ml-auto flex items-center gap-1 shrink-0">
            {/* Botones editar/eliminar (solo notas propias, visibles en hover) */}
            {esPropia && (
              <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                {onEditar && (
                  <button
                    onClick={onEditar}
                    className="p-1 rounded hover:bg-insignia-advertencia/15 text-texto-terciario hover:text-texto-secundario transition-colors"
                    title="Editar nota"
                  >
                    <Pencil size={12} />
                  </button>
                )}
                {onEliminar && (
                  <button
                    onClick={onEliminar}
                    className="p-1 rounded hover:bg-insignia-peligro/15 text-texto-terciario hover:text-insignia-peligro transition-colors"
                    title="Eliminar nota"
                  >
                    <Trash2 size={12} />
                  </button>
                )}
              </div>
            )}
            <span className="text-[10px] text-texto-terciario" title={fechaCompleta(entrada.creado_en, formatoHora)}>
              {fechaRelativa(entrada.creado_en, formatoHora)}
            </span>
          </div>
        </div>
        {htmlContenido ? (
          <div
            className="text-sm text-texto-secundario mt-1 prose prose-sm max-w-none [&_p]:my-0.5 [&_ul]:my-1 [&_ol]:my-1 [&_li]:my-0"
            dangerouslySetInnerHTML={{ __html: htmlContenido }}
          />
        ) : (
          <p className="text-sm text-texto-secundario mt-0.5 whitespace-pre-wrap">{entrada.contenido}</p>
        )}
        <ListaAdjuntos adjuntos={entrada.adjuntos} />
      </div>
    </div>
  )
}

// ─── Mensaje normal o portal ───
function EntradaMensaje({ entrada, esMensajePortal, formatoHora }: { entrada: PropsEntradaTimeline['entrada']; esMensajePortal: boolean; formatoHora: string }) {
  return (
    <div className={`flex items-start gap-2.5 py-2 ${
      esMensajePortal ? 'bg-texto-marca/5 -mx-3 px-3 rounded-lg my-0.5' : ''
    }`}>
      <Avatar nombre={entrada.autor_nombre} foto={entrada.autor_avatar_url} tamano="xs" />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-texto-primario">{entrada.autor_nombre}</span>
          {esMensajePortal && (
            <span className="text-[10px] text-texto-marca flex items-center gap-0.5">
              <Globe size={10} /> Portal
            </span>
          )}
          <span className="text-[10px] text-texto-terciario ml-auto shrink-0" title={fechaCompleta(entrada.creado_en, formatoHora)}>
            {fechaRelativa(entrada.creado_en, formatoHora)}
          </span>
        </div>
        <p className="text-sm text-texto-secundario mt-0.5 whitespace-pre-wrap">{entrada.contenido}</p>
        <ListaAdjuntos adjuntos={entrada.adjuntos} />
      </div>
    </div>
  )
}

// ─── Lista de adjuntos reutilizable ───
function ListaAdjuntos({ adjuntos }: { adjuntos?: { url: string; nombre: string; tipo?: string }[] }) {
  if (!adjuntos?.length) return null

  return (
    <div className="flex flex-wrap gap-1.5 mt-1.5">
      {adjuntos.map((adj, i) => (
        <a
          key={i}
          href={adj.url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1 text-xs text-texto-marca hover:underline bg-superficie-app px-2 py-1 rounded border border-borde-sutil"
        >
          <FileText size={11} />
          <span className="truncate max-w-[150px]">{adj.nombre}</span>
        </a>
      ))}
    </div>
  )
}
