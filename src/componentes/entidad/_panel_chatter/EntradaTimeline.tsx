'use client'

/**
 * EntradaTimeline — Renderiza una entrada individual del chatter.
 * Soporta múltiples tipos: sistema, mensaje, nota_interna, correo, whatsapp.
 * Cada tipo tiene su propia visualización con íconos, colores y acciones.
 * Se usa en: PanelChatter (timeline unificada).
 */

import { useState, useRef, useEffect, useCallback } from 'react'
import {
  FileText, Check, X, ChevronDown, ChevronUp,
  StickyNote, Globe, Mail, Paperclip,
  Clock, Pencil, Trash2, CheckCircle2, CalendarClock, Ban, Link,
} from 'lucide-react'
import DOMPurify from 'isomorphic-dompurify'
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
  actividadesResueltas,
  onCompletarActividad,
  onPosponerActividad,
  onCancelarActividad,
  onEditarActividad,
  onEliminarActividad,
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
    return (
      <EntradaSistema
        entrada={entrada}
        entidadTipo={entidadTipo}
        formatoHora={fh}
        locale={locale}
        onAccionComprobante={onAccionComprobante}
        actividadesResueltas={actividadesResueltas}
        onCompletarActividad={onCompletarActividad}
        onPosponerActividad={onPosponerActividad}
        onCancelarActividad={onCancelarActividad}
        onEditarActividad={onEditarActividad}
        onEliminarActividad={onEliminarActividad}
      />
    )
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

// ─── Opciones predefinidas para posponer actividad ───
const OPCIONES_POSPONER = [
  { etiqueta: '1 día', dias: 1 },
  { etiqueta: '3 días', dias: 3 },
  { etiqueta: '1 semana', dias: 7 },
  { etiqueta: '2 semanas', dias: 14 },
]

// ─── Entrada de sistema ───
function EntradaSistema({
  entrada,
  entidadTipo,
  formatoHora,
  locale,
  onAccionComprobante,
  actividadesResueltas,
  onCompletarActividad,
  onPosponerActividad,
  onCancelarActividad,
  onEditarActividad,
  onEliminarActividad,
}: {
  entrada: PropsEntradaTimeline['entrada']
  entidadTipo: string
  formatoHora: string
  locale: string
  onAccionComprobante: PropsEntradaTimeline['onAccionComprobante']
  actividadesResueltas?: Set<string>
  onCompletarActividad?: (actividadId: string) => Promise<void>
  onPosponerActividad?: (actividadId: string, dias: number) => Promise<void>
  onCancelarActividad?: (actividadId: string) => Promise<void>
  onEditarActividad?: (actividadId: string) => void
  onEliminarActividad?: (actividadId: string) => Promise<void>
}) {
  const [accionando, setAccionando] = useState(false)
  const [menuPosponer, setMenuPosponer] = useState(false)
  const refMenuPosponer = useRef<HTMLDivElement>(null)

  const accion = entrada.metadata?.accion as AccionSistema | undefined
  const config = accion ? ICONOS_ACCION[accion] : null
  const esComprobante = accion === 'portal_comprobante'
  const comprobanteId = entrada.metadata?.detalles?.comprobante_id as string | undefined

  // Detectar si es una entrada de actividad creada con botones accionables
  const esActividadCreada = accion === 'actividad_creada'
  const actividadId = entrada.metadata?.actividad_id
  const actividadResuelta = actividadId ? actividadesResueltas?.has(actividadId) : false
  const mostrarBotonesActividad = esActividadCreada && actividadId && !actividadResuelta

  // Vínculos relacionados (ej: Presupuesto #452 · Edificio Torres del Sol)
  const vinculosRelacionados = entrada.metadata?.vinculos_relacionados

  const handleAccion = async (acc: 'confirmar' | 'rechazar') => {
    if (accionando || !comprobanteId) return
    setAccionando(true)
    await onAccionComprobante(entrada.id, comprobanteId, acc)
    setAccionando(false)
  }

  // Acciones de actividad
  const handleCompletar = async () => {
    if (accionando || !actividadId || !onCompletarActividad) return
    setAccionando(true)
    await onCompletarActividad(actividadId)
    setAccionando(false)
  }

  const handlePosponer = async (dias: number) => {
    if (accionando || !actividadId || !onPosponerActividad) return
    setMenuPosponer(false)
    setAccionando(true)
    await onPosponerActividad(actividadId, dias)
    setAccionando(false)
  }

  const handleCancelar = async () => {
    if (accionando || !actividadId || !onCancelarActividad) return
    setAccionando(true)
    await onCancelarActividad(actividadId)
    setAccionando(false)
  }

  // Cerrar menú posponer al hacer clic fuera
  useEffect(() => {
    if (!menuPosponer) return
    const handleClickFuera = (e: MouseEvent) => {
      if (refMenuPosponer.current && !refMenuPosponer.current.contains(e.target as Node)) {
        setMenuPosponer(false)
      }
    }
    document.addEventListener('mousedown', handleClickFuera)
    return () => document.removeEventListener('mousedown', handleClickFuera)
  }, [menuPosponer])

  return (
    <div className="flex items-start gap-2.5 py-2 group">
      <div className={`flex items-center justify-center size-6 rounded-full shrink-0 mt-0.5 ${config?.color || 'bg-superficie-hover text-texto-terciario'}`}>
        {config?.icono || <Clock size={12} />}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-texto-secundario leading-relaxed">
          <span className="font-medium text-texto-primario">{entrada.autor_nombre}</span>
          {' · '}
          {entrada.contenido}
        </p>

        {/* Vínculos relacionados (ej: documentos y contactos vinculados a la actividad) */}
        {vinculosRelacionados && vinculosRelacionados.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 mt-1">
            <Link size={10} className="text-texto-terciario shrink-0" />
            {vinculosRelacionados.map((v, i) => (
              <span key={v.id} className="text-xxs text-texto-marca">
                {v.nombre}
                {i < vinculosRelacionados.length - 1 && <span className="text-texto-terciario ml-1.5">·</span>}
              </span>
            ))}
          </div>
        )}

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

        {/* Botones de acción para actividades — siempre visibles mientras la actividad esté activa */}
        {mostrarBotonesActividad && (
          <div className="flex flex-wrap items-center gap-1.5 mt-2">
            {/* Completar */}
            <Boton
              variante="exito"
              tamano="xs"
              icono={<CheckCircle2 size={12} />}
              onClick={handleCompletar}
              disabled={accionando}
              cargando={accionando}
            >
              Completar
            </Boton>

            {/* Posponer con dropdown — z-50 para no quedar cortado */}
            <div className="relative" ref={refMenuPosponer}>
              <Boton
                variante="secundario"
                tamano="xs"
                icono={<CalendarClock size={12} />}
                iconoDerecho={<ChevronDown size={10} />}
                onClick={() => setMenuPosponer(!menuPosponer)}
                disabled={accionando}
              >
                Posponer
              </Boton>

              <AnimatePresence>
                {menuPosponer && (
                  <motion.div
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    transition={{ duration: 0.12 }}
                    className="absolute left-0 bottom-full mb-1 z-50 bg-superficie-elevada border border-borde-sutil rounded-lg shadow-xl py-1 min-w-[120px]"
                  >
                    {OPCIONES_POSPONER.map(opcion => (
                      <button
                        key={opcion.dias}
                        onClick={() => handlePosponer(opcion.dias)}
                        className="w-full text-left px-3 py-1.5 text-xs text-texto-secundario hover:bg-superficie-hover hover:text-texto-primario transition-colors"
                      >
                        {opcion.etiqueta}
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Editar — reabrir modal para modificar la actividad */}
            {onEditarActividad && (
              <Boton
                variante="fantasma"
                tamano="xs"
                icono={<Pencil size={12} />}
                onClick={() => actividadId && onEditarActividad(actividadId)}
                disabled={accionando}
              >
                Editar
              </Boton>
            )}

            {/* Cancelar */}
            <Boton
              variante="fantasma"
              tamano="xs"
              icono={<Ban size={12} />}
              onClick={handleCancelar}
              disabled={accionando}
              className="text-texto-terciario hover:text-insignia-peligro"
            >
              Cancelar
            </Boton>

            {/* Eliminar */}
            {onEliminarActividad && (
              <Boton
                variante="fantasma"
                tamano="xs"
                icono={<Trash2 size={12} />}
                onClick={() => actividadId && onEliminarActividad(actividadId)}
                disabled={accionando}
                className="text-texto-terciario hover:text-insignia-peligro"
              >
                Eliminar
              </Boton>
            )}
          </div>
        )}

        {/* Indicador de actividad ya resuelta */}
        {esActividadCreada && actividadId && actividadResuelta && (
          <span className="inline-flex items-center gap-1 mt-1.5 text-xxs text-insignia-exito bg-insignia-exito/10 px-2 py-0.5 rounded-full font-medium">
            <CheckCircle2 size={10} />
            Resuelta
          </span>
        )}

        <span className="text-xxs text-texto-terciario opacity-0 group-hover:opacity-100 transition-opacity" title={fechaCompleta(entrada.creado_en, formatoHora, locale)}>
          {fechaRelativa(entrada.creado_en, formatoHora, locale)}
        </span>
      </div>
    </div>
  )
}

// ─── Iframe aislado para renderizar HTML de correo ───
function IframeCorreo({ html }: { html: string }) {
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const [altura, setAltura] = useState(200)

  const ajustarAltura = useCallback(() => {
    const iframe = iframeRef.current
    if (!iframe?.contentDocument?.body) return
    const h = iframe.contentDocument.body.scrollHeight
    if (h > 0) setAltura(Math.min(h + 16, 500))
  }, [])

  useEffect(() => {
    const iframe = iframeRef.current
    if (!iframe) return
    const handleLoad = () => {
      ajustarAltura()
      // Observer para cambios dinámicos (imágenes cargando, etc.)
      const observer = new MutationObserver(ajustarAltura)
      if (iframe.contentDocument?.body) {
        observer.observe(iframe.contentDocument.body, { childList: true, subtree: true, attributes: true })
      }
      return () => observer.disconnect()
    }
    iframe.addEventListener('load', handleLoad)
    return () => iframe.removeEventListener('load', handleLoad)
  }, [ajustarAltura])

  return (
    <iframe
      ref={iframeRef}
      srcDoc={html}
      sandbox="allow-same-origin"
      className="w-full border-0"
      style={{ height: `${altura}px`, maxHeight: '500px' }}
      title="Correo enviado"
    />
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
    <div className="space-y-1 bg-canal-correo/[0.03] -mx-3 px-3 py-2 rounded-lg my-0.5">
      {/* Línea de sistema: quién ejecutó la acción */}
      <div className="flex items-center gap-2.5">
        <div className="flex items-center justify-center size-6 rounded-full shrink-0 bg-canal-correo/10 text-canal-correo">
          <Mail size={12} />
        </div>
        <p className="text-xs text-texto-secundario leading-relaxed flex-1 min-w-0">
          <span className="font-medium text-texto-primario">{entrada.autor_nombre}</span>
          {' · '}
          {esRecibido ? 'Correo recibido' : 'Envió correo'}
          {asunto ? `: ${asunto}` : ''}
        </p>
        <span className="text-xxs text-texto-terciario shrink-0">{fechaRelativa(entrada.creado_en, formatoHora, locale)}</span>
      </div>

      {/* Card del correo expandible */}
      <div className={`rounded-lg border overflow-hidden ml-8 ${
        esRecibido
          ? 'border-canal-correo/30 bg-canal-correo/5'
          : 'border-borde-sutil bg-superficie-app/60'
      }`}>
        {/* Header del correo */}
        <button
          onClick={() => setExpandido(!expandido)}
          className="w-full flex items-center gap-2.5 px-3 py-2 text-left hover:bg-superficie-hover/50 transition-colors"
        >
          <div className="flex-1 min-w-0">
            <p className="text-xs text-texto-secundario truncate">{asunto || entrada.contenido}</p>
            {destinatario && (
              <p className="text-xxs text-texto-terciario truncate mt-0.5">
                {esRecibido ? 'De' : 'Para'}: {destinatario}
                {cc && <span className="ml-1.5">· CC: {cc}</span>}
                {cco && <span className="ml-1.5">· CCO: {cco}</span>}
              </p>
            )}
          </div>
          <div className="flex items-center gap-1 shrink-0">
            {entrada.adjuntos?.length > 0 && (
              <span className="flex items-center gap-0.5 text-xxs text-texto-terciario">
                <Paperclip size={10} />
                {entrada.adjuntos.length}
              </span>
            )}
            {htmlCorreo && (
              expandido ? <ChevronUp size={14} className="text-texto-terciario" /> : <ChevronDown size={14} className="text-texto-terciario" />
            )}
          </div>
        </button>

        {/* Cuerpo expandible del correo — iframe aislado para no romper estilos */}
        <AnimatePresence>
          {expandido && htmlCorreo && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <div className="border-t border-borde-sutil">
                <IframeCorreo html={htmlCorreo} />
                {entrada.adjuntos?.length > 0 && (
                  <div className="px-3 py-1">
                    <ListaAdjuntos adjuntos={entrada.adjuntos} />
                  </div>
                )}
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
    </div>
  )
}

// ─── Entrada de WhatsApp ───
function EntradaWhatsApp({ entrada, formatoHora, locale }: { entrada: PropsEntradaTimeline['entrada']; formatoHora: string; locale: string }) {
  const numero = entrada.metadata?.whatsapp_numero || ''
  const destinatario = entrada.metadata?.whatsapp_destinatario || ''
  const plantilla = entrada.metadata?.whatsapp_plantilla
  const waStatus = entrada.metadata?.wa_status
  const botones = entrada.metadata?.whatsapp_botones

  return (
    <div className="rounded-lg border border-canal-whatsapp/20 bg-canal-whatsapp/[0.03] overflow-hidden my-1">
      {/* Header: nombre + plantilla badge */}
      <div className="flex items-center gap-2.5 px-3 pt-2.5 pb-1">
        <div className="flex items-center justify-center size-7 rounded-full bg-canal-whatsapp/10 text-canal-whatsapp shrink-0">
          <IconoWhatsApp size={14} />
        </div>
        <span className="text-xs font-semibold text-texto-primario">
          {destinatario || numero || 'WhatsApp'}
        </span>
        {plantilla && <span className="text-xxs px-1.5 py-px rounded bg-superficie-hover text-texto-terciario">Plantilla</span>}
      </div>

      {/* Subtítulo: para + enviado por */}
      <p className="text-xxs text-texto-terciario px-3 pl-[52px] pb-2">
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
        <span className="text-xxs text-texto-terciario">
          {new Date(entrada.creado_en).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit', hour12: formatoHora === '12h' })}
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
                  className="flex items-center justify-center gap-1 py-2 text-sm font-medium no-underline hover:bg-superficie-hover/50 transition-colors"
                  style={{ color: '#00a5f4' }}
                >
                  🔗 {btn.texto}
                </a>
              )
            }
            return (
              <div
                key={i}
                className="flex items-center justify-center gap-1 py-2 text-sm font-medium"
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
  locale,
  onEditar,
  onEliminar,
}: {
  entrada: PropsEntradaTimeline['entrada']
  esPropia: boolean
  formatoHora: string
  locale: string
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
          <span className="text-xxs text-insignia-advertencia flex items-center gap-0.5 font-medium">
            <StickyNote size={10} /> Nota interna
          </span>
          {fueEditada && (
            <span className="text-xxs text-texto-terciario italic">editada</span>
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
            <span className="text-xxs text-texto-terciario" title={fechaCompleta(entrada.creado_en, formatoHora, locale)}>
              {fechaRelativa(entrada.creado_en, formatoHora, locale)}
            </span>
          </div>
        </div>
        {htmlContenido ? (
          <div
            className="text-sm text-texto-secundario mt-1 prose prose-sm max-w-none [&_p]:my-0.5 [&_ul]:my-1 [&_ol]:my-1 [&_li]:my-0"
            dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(htmlContenido) }}
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
function EntradaMensaje({ entrada, esMensajePortal, formatoHora, locale }: { entrada: PropsEntradaTimeline['entrada']; esMensajePortal: boolean; formatoHora: string; locale: string }) {
  return (
    <div className={`flex items-start gap-2.5 py-2 ${
      esMensajePortal ? 'bg-texto-marca/5 -mx-3 px-3 rounded-lg my-0.5' : ''
    }`}>
      <Avatar nombre={entrada.autor_nombre} foto={entrada.autor_avatar_url} tamano="xs" />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-texto-primario">{entrada.autor_nombre}</span>
          {esMensajePortal && (
            <span className="text-xxs text-texto-marca flex items-center gap-0.5">
              <Globe size={10} /> Portal
            </span>
          )}
          <span className="text-xxs text-texto-terciario ml-auto shrink-0" title={fechaCompleta(entrada.creado_en, formatoHora, locale)}>
            {fechaRelativa(entrada.creado_en, formatoHora, locale)}
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
