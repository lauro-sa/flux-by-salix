'use client'

/**
 * EntradaTimeline — Renderiza una entrada individual del chatter.
 * Soporta múltiples tipos: sistema, mensaje, nota_interna, correo, whatsapp.
 * Cada tipo tiene su propia visualización con íconos, colores y acciones.
 * Se usa en: PanelChatter (timeline unificada).
 */

import { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import {
  FileText, Check, X, ChevronDown, ChevronUp,
  StickyNote, Globe, Mail, Paperclip,
  Clock, Pencil, Trash2, CheckCircle2, CalendarClock, Ban, Link,
  Calendar, Users, AlertTriangle, Eye, User, MapPin, Briefcase, CreditCard,
} from 'lucide-react'
import NextLink from 'next/link'
import { useFormato } from '@/hooks/useFormato'
import { IconoWhatsApp } from '@/componentes/iconos/IconoWhatsApp'
import { motion, AnimatePresence } from 'framer-motion'
import { Avatar } from '@/componentes/ui/Avatar'
import { Boton } from '@/componentes/ui/Boton'
import type { AccionSistema } from '@/tipos/chatter'
import { ICONOS_ACCION, fechaRelativa, fechaCompleta, formatearTextoWA } from './constantes'
import HtmlSeguro from '@/componentes/ui/HtmlSeguro'
import type { PropsEntradaTimeline } from './tipos'
import { EntradaVisita } from './EntradaVisita'
import { EntradaPago } from './EntradaPago'
import Image from 'next/image'

// Acciones que se renderizan como EntradaPago (card distintiva)
const ACCIONES_PAGO = new Set(['pago_confirmado', 'pago_rechazado', 'portal_comprobante'])

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
  onVerActividad,
  onRegistrarPagoDesdeMensaje,
  onEditarPago,
  onEliminarPago,
  pagoVinculado,
  autorOrigenPago,
}: PropsEntradaTimeline) {
  const { locale } = useFormato()
  const esSistema = entrada.tipo === 'sistema'
  const esCorreo = entrada.tipo === 'correo'
  const esWhatsApp = entrada.tipo === 'whatsapp'
  const esVisita = entrada.tipo === 'visita'
  const esNotaInterna = entrada.tipo === 'nota_interna'
  const esMensaje = entrada.tipo === 'mensaje'
  const esMensajePortal = esMensaje && entrada.metadata?.portal && entrada.autor_id === 'portal'

  const fh = formatoHora

  if (esVisita) {
    return <EntradaVisita entrada={entrada} formatoHora={fh} locale={locale} />
  }
  // Pagos se renderizan con EntradaPago (card distintiva) en vez del sistema genérico
  if (esSistema && ACCIONES_PAGO.has(entrada.metadata?.accion || '')) {
    return (
      <EntradaPago
        entrada={entrada}
        formatoHora={fh}
        locale={locale}
        onEditar={onEditarPago}
        onEliminar={onEliminarPago}
        autorOrigen={autorOrigenPago}
      />
    )
  }
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
        onVerActividad={onVerActividad}
      />
    )
  }
  if (esCorreo) {
    return (
      <EntradaCorreo
        entrada={entrada}
        formatoHora={fh}
        locale={locale}
        onRegistrarPagoDesdeMensaje={onRegistrarPagoDesdeMensaje}
        pagoVinculado={pagoVinculado}
      />
    )
  }
  if (esWhatsApp) {
    return (
      <EntradaWhatsApp
        entrada={entrada}
        formatoHora={fh}
        locale={locale}
        onRegistrarPagoDesdeMensaje={onRegistrarPagoDesdeMensaje}
        pagoVinculado={pagoVinculado}
      />
    )
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

  return (
    <EntradaMensaje
      entrada={entrada}
      esMensajePortal={!!esMensajePortal}
      formatoHora={fh}
      locale={locale}
      onRegistrarPagoDesdeMensaje={onRegistrarPagoDesdeMensaje}
      pagoVinculado={pagoVinculado}
    />
  )
}

// ─── Mini-botón compartido: registrar como pago desde un mensaje ───
function BotonRegistrarPago({
  onClick,
  className = '',
}: { onClick: () => void; className?: string }) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full border border-borde-sutil text-xxs text-texto-secundario hover:border-insignia-exito/40 hover:text-insignia-exito hover:bg-insignia-exito/5 transition-colors ${className}`}
      title="Registrar como pago — vincula este mensaje al comprobante"
    >
      <CreditCard size={10} />
      Registrar como pago
    </button>
  )
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
  onVerActividad,
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
  onVerActividad?: (actividadId: string, metadata: Record<string, unknown>) => void
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

  // Datos enriquecidos: desde metadata o fetch
  interface DatosActividad {
    tipo_etiqueta?: string
    tipo_color?: string
    prioridad?: string
    fecha_vencimiento?: string | null
    asignados?: { id: string; nombre: string }[]
    descripcion?: string | null
  }
  const [datosAct, setDatosAct] = useState<DatosActividad | null>(null)

  // Fetch datos de la actividad si la metadata no tiene la info enriquecida
  useEffect(() => {
    if (!esActividadCreada || !actividadId) return
    if (entrada.metadata?.tipo_etiqueta) return // Ya tiene datos enriquecidos
    let cancelado = false
    fetch(`/api/actividades/${actividadId}`)
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (cancelado || !data) return
        // Buscar etiqueta del tipo (el API devuelve tipo_id, no la etiqueta directamente)
        setDatosAct({
          prioridad: data.prioridad,
          fecha_vencimiento: data.fecha_vencimiento,
          asignados: data.asignados,
          descripcion: data.descripcion,
        })
      })
      .catch(() => {})
    return () => { cancelado = true }
  }, [esActividadCreada, actividadId, entrada.metadata?.tipo_etiqueta])

  const tipoEtiqueta = entrada.metadata?.tipo_etiqueta as string | undefined
  const tipoColor = (entrada.metadata?.tipo_color as string) || '#5b5bd6'
  const actPrioridad = (entrada.metadata?.prioridad ?? datosAct?.prioridad) as string | undefined
  const actFechaVenc = (entrada.metadata?.fecha_vencimiento ?? datosAct?.fecha_vencimiento) as string | undefined
  const actAsignados = (entrada.metadata?.asignados ?? datosAct?.asignados) as { id: string; nombre: string }[] | undefined
  const actDescripcion = (entrada.metadata?.descripcion ?? datosAct?.descripcion) as string | undefined
  const actVencida = actFechaVenc && !actividadResuelta && new Date(actFechaVenc) < new Date()

  return (
    <div className="flex items-start gap-2.5 py-2 group">
      <div className={`flex items-center justify-center size-6 rounded-full shrink-0 mt-0.5 ${config?.color || 'bg-superficie-hover text-texto-terciario'}`}>
        {config?.icono || <Clock size={12} />}
      </div>
      <div className="flex-1 min-w-0">

        {/* ── Actividad creada — card rica ── */}
        {esActividadCreada ? (
          <>
            <p className="text-xs text-texto-terciario mb-1.5">
              <span className="font-medium text-texto-secundario">{entrada.autor_nombre}</span>
              {' · creó actividad'}
            </p>
            <div
              className={`rounded-card border p-3 space-y-2 transition-colors ${
                actividadResuelta
                  ? 'border-white/[0.05] bg-white/[0.01] opacity-60'
                  : 'border-white/[0.08] bg-white/[0.03] hover:border-white/[0.12] cursor-pointer'
              }`}
              onClick={() => {
                if (actividadId && onVerActividad) {
                  onVerActividad(actividadId, (entrada.metadata || {}) as Record<string, unknown>)
                }
              }}
            >
              {/* Header: tipo pill + título */}
              <div className="flex items-start gap-2">
                {tipoEtiqueta && (
                  <span
                    className="inline-flex items-center shrink-0 px-2 py-0.5 rounded-full text-[10px] font-medium mt-0.5"
                    style={{
                      border: `1px solid ${tipoColor}50`,
                      backgroundColor: `color-mix(in srgb, ${tipoColor} 10%, transparent)`,
                      color: tipoColor,
                    }}
                  >
                    {tipoEtiqueta}
                  </span>
                )}
                <span className="text-sm font-medium text-texto-primario leading-snug flex-1 min-w-0">
                  {entrada.metadata?.titulo as string || entrada.contenido}
                </span>
              </div>

              {/* Descripción (truncada) */}
              {actDescripcion && (
                <p className="text-xs text-texto-terciario line-clamp-2 leading-relaxed">{actDescripcion}</p>
              )}

              {/* Meta: fecha + prioridad + asignados */}
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px]">
                {actFechaVenc && (
                  <span className={`inline-flex items-center gap-1 ${actVencida ? 'text-insignia-peligro font-medium' : 'text-texto-terciario'}`}>
                    {actVencida ? <AlertTriangle size={10} /> : <Calendar size={10} />}
                    {new Date(actFechaVenc).toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })}
                  </span>
                )}
                {actPrioridad && actPrioridad !== 'normal' && (
                  <span className={`inline-flex items-center gap-1 ${actPrioridad === 'alta' ? 'text-insignia-peligro' : 'text-insignia-info'}`}>
                    <AlertTriangle size={10} />
                    {actPrioridad === 'alta' ? 'Alta' : 'Baja'}
                  </span>
                )}
                {actAsignados && actAsignados.length > 0 && (
                  <span className="inline-flex items-center gap-1 text-texto-terciario">
                    <Users size={10} />
                    {actAsignados.map(a => a.nombre).join(', ')}
                  </span>
                )}
              </div>

              {/* Vínculos relacionados */}
              {vinculosRelacionados && vinculosRelacionados.length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5">
                  <Link size={9} className="text-texto-terciario shrink-0" />
                  {vinculosRelacionados.map((v, i) => (
                    <span key={v.id} className="text-[10px] text-texto-marca">
                      {v.nombre}
                      {i < vinculosRelacionados.length - 1 && <span className="text-texto-terciario ml-1">·</span>}
                    </span>
                  ))}
                </div>
              )}

              {/* Resuelta badge */}
              {actividadResuelta && (
                <span className="inline-flex items-center gap-1 text-[10px] text-insignia-exito bg-insignia-exito/10 px-2 py-0.5 rounded-full font-medium">
                  <CheckCircle2 size={9} />
                  Resuelta
                </span>
              )}
            </div>

            {/* Botones de acción — debajo de la card */}
            {mostrarBotonesActividad && (
              <div className="flex flex-wrap items-center gap-1.5 mt-2">
                <Boton variante="exito" tamano="xs" icono={<CheckCircle2 size={12} />} onClick={handleCompletar} disabled={accionando} cargando={accionando}>
                  Completar
                </Boton>
                <div className="relative" ref={refMenuPosponer}>
                  <Boton variante="secundario" tamano="xs" icono={<CalendarClock size={12} />} iconoDerecho={<ChevronDown size={10} />} onClick={() => setMenuPosponer(!menuPosponer)} disabled={accionando}>
                    Posponer
                  </Boton>
                  <AnimatePresence>
                    {menuPosponer && (
                      <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.12 }}
                        className="absolute left-0 bottom-full mb-1 z-50 bg-superficie-elevada border border-borde-sutil rounded-popover shadow-xl py-1 min-w-[120px]">
                        {OPCIONES_POSPONER.map(opcion => (
                          <button key={opcion.dias} onClick={() => handlePosponer(opcion.dias)}
                            className="w-full text-left px-3 py-1.5 text-xs text-texto-secundario hover:bg-superficie-hover hover:text-texto-primario transition-colors">
                            {opcion.etiqueta}
                          </button>
                        ))}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
                {onEditarActividad && (
                  <Boton variante="fantasma" tamano="xs" icono={<Pencil size={12} />} onClick={() => actividadId && onEditarActividad(actividadId)} disabled={accionando}>
                    Editar
                  </Boton>
                )}
                <Boton variante="fantasma" tamano="xs" icono={<Ban size={12} />} onClick={handleCancelar} disabled={accionando} className="text-texto-terciario hover:text-insignia-peligro">
                  Cancelar
                </Boton>
                {onEliminarActividad && (
                  <Boton variante="fantasma" tamano="xs" icono={<Trash2 size={12} />} onClick={() => actividadId && onEliminarActividad(actividadId)} disabled={accionando} className="text-texto-terciario hover:text-insignia-peligro">
                    Eliminar
                  </Boton>
                )}
              </div>
            )}

            <span className="text-xxs text-texto-terciario opacity-0 group-hover:opacity-100 transition-opacity mt-1" title={fechaCompleta(entrada.creado_en, formatoHora, locale)}>
              {fechaRelativa(entrada.creado_en, formatoHora, locale)}
            </span>
          </>
        ) : (
          /* ── Resto de entradas de sistema (no actividad) — renderizado original ── */
          <>
            <p className="text-xs text-texto-secundario leading-relaxed">
              <span className="font-medium text-texto-primario">{entrada.autor_nombre}</span>
              {' · '}
              {entrada.contenido}
            </p>

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

            <ListaAdjuntos adjuntos={entrada.adjuntos} />

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

            <span className="text-xxs text-texto-terciario opacity-0 group-hover:opacity-100 transition-opacity" title={fechaCompleta(entrada.creado_en, formatoHora, locale)}>
              {fechaRelativa(entrada.creado_en, formatoHora, locale)}
            </span>
          </>
        )}

      </div>
    </div>
  )
}

// ─── Estilos dark mode para inyectar en el iframe de correo ───
const CSS_DARK_MODE_CORREO = `
  html, body {
    background: transparent !important;
    color: #d1d5db !important;
  }
  * {
    border-color: #374151 !important;
  }
  /* Invertir fondos blancos/claros a oscuros */
  div, td, th, table, section, article, header, footer, main {
    background-color: transparent !important;
  }
  /* Texto: forzar colores legibles */
  p, span, li, td, th, h1, h2, h3, h4, h5, h6, a, strong, em, b, i, u, label, div {
    color: #d1d5db !important;
  }
  a { color: #60a5fa !important; }
  blockquote {
    border-left-color: #4b5563 !important;
    color: #9ca3af !important;
  }
  blockquote * { color: #9ca3af !important; }
  hr { border-color: #374151 !important; }
  img { opacity: 0.9; }
`

// ─── Iframe aislado para renderizar HTML de correo ───
function IframeCorreo({ html }: { html: string }) {
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const [altura, setAltura] = useState(200)
  const [esDark, setEsDark] = useState(false)

  // Detectar dark mode del sistema/app
  useEffect(() => {
    const verificar = () => setEsDark(document.documentElement.classList.contains('dark')
      || window.matchMedia('(prefers-color-scheme: dark)').matches)
    verificar()
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    mq.addEventListener('change', verificar)
    const observer = new MutationObserver(verificar)
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
    return () => { mq.removeEventListener('change', verificar); observer.disconnect() }
  }, [])

  // Inyectar estilos dark mode dentro del HTML del correo
  const htmlFinal = useMemo(() => {
    if (!esDark) return html
    const styleTag = `<style>${CSS_DARK_MODE_CORREO}</style>`
    // Insertar antes de </head> si existe, si no antes de </html> o al final
    if (html.includes('</head>')) return html.replace('</head>', `${styleTag}</head>`)
    if (html.includes('</html>')) return html.replace('</html>', `${styleTag}</html>`)
    return styleTag + html
  }, [html, esDark])

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
      srcDoc={htmlFinal}
      sandbox="allow-same-origin"
      className="w-full border-0"
      style={{ height: `${altura}px`, maxHeight: '500px' }}
      title="Correo enviado"
    />
  )
}

// ─── Entrada de correo (expandible) ───
function EntradaCorreo({
  entrada,
  formatoHora,
  locale,
  onRegistrarPagoDesdeMensaje,
  pagoVinculado,
}: {
  entrada: PropsEntradaTimeline['entrada']
  formatoHora: string
  locale: string
  onRegistrarPagoDesdeMensaje?: (entrada: PropsEntradaTimeline['entrada']) => void
  pagoVinculado?: { pago_id: string; monto: string; moneda: string }
}) {
  const [expandido, setExpandido] = useState(false)
  const accion = entrada.metadata?.accion as AccionSistema | undefined
  const esRecibido = accion === 'correo_recibido'
  const asunto = entrada.metadata?.correo_asunto || ''
  const destinatario = entrada.metadata?.correo_destinatario || entrada.metadata?.correo_de || ''
  const cc = entrada.metadata?.correo_cc
  const cco = entrada.metadata?.correo_cco
  const htmlCorreo = entrada.metadata?.correo_html
  const relacionadoCon = entrada.metadata?.relacionado_con

  return (
    <div className="space-y-1 bg-canal-correo/[0.03] -mx-3 px-3 py-2 rounded-card">
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
      <div className={`rounded-card border overflow-hidden ml-8 ${
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

      {/* Chips "También en:" — otras entidades donde quedó registrado este correo */}
      {relacionadoCon && relacionadoCon.length > 0 && (
        <ChipsRelacionados items={relacionadoCon} />
      )}

      {/* Acción: registrar como pago — solo en correos recibidos.
          Un correo enviado por nosotros nunca es un comprobante, así que el botón
          no tiene sentido ahí. */}
      {onRegistrarPagoDesdeMensaje && esRecibido && !pagoVinculado && (
        <div className="ml-8 mt-1.5">
          <BotonRegistrarPago onClick={() => onRegistrarPagoDesdeMensaje(entrada)} />
        </div>
      )}
      {pagoVinculado && (
        <div className="ml-8 mt-1.5">
          <ChipPagoVinculado pago={pagoVinculado} />
        </div>
      )}
    </div>
  )
}

// ─── Chip "Registrado como pago $X" ───
// Aparece en correos/WA/mensajes cuando ya se cargó un pago tomando esa
// entrada como origen. Reemplaza al botón "Registrar como pago" para que
// el correo no parezca un evento duplicado del pago.
function ChipPagoVinculado({ pago }: { pago: { pago_id: string; monto: string; moneda: string } }) {
  const monto = Number(pago.monto || 0)
  const formato = (() => {
    try {
      return new Intl.NumberFormat('es-AR', { style: 'currency', currency: pago.moneda, maximumFractionDigits: 2 }).format(monto)
    } catch {
      return `${monto.toLocaleString('es-AR', { maximumFractionDigits: 2 })} ${pago.moneda}`
    }
  })()
  const irAPago = () => {
    const el = document.querySelector(`[data-pago-id="${pago.pago_id}"]`)
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }
  return (
    <button
      type="button"
      onClick={irAPago}
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full border border-insignia-exito/30 bg-insignia-exito/10 text-xxs text-insignia-exito hover:bg-insignia-exito/15 transition-colors"
      title="Ver pago vinculado en la timeline"
    >
      <CheckCircle2 size={10} />
      Registrado como pago · {formato}
    </button>
  )
}

// ─── Chips clickeables de entidades relacionadas ───
// Muestra "También en: [Empresa X] [Presupuesto 001] ..."
// Cada chip es un Link a la ficha de esa entidad.
function ChipsRelacionados({ items }: { items: { tipo: string; id: string; nombre: string }[] }) {
  const rutaEntidad = (tipo: string, id: string): string | null => {
    switch (tipo) {
      case 'contacto': return `/contactos/${id}`
      case 'presupuesto': return `/presupuestos/${id}`
      case 'orden_trabajo': return `/ordenes/${id}`
      case 'visita': return `/visitas/${id}`
      default: return null
    }
  }
  const iconoEntidad = (tipo: string) => {
    switch (tipo) {
      case 'contacto': return <User size={10} />
      case 'presupuesto': return <FileText size={10} />
      case 'orden_trabajo': return <Briefcase size={10} />
      case 'visita': return <MapPin size={10} />
      default: return <Link size={10} />
    }
  }

  return (
    <div className="ml-8 mt-1.5 flex items-center gap-1.5 flex-wrap text-xxs">
      <span className="text-texto-terciario">También en:</span>
      {items.map((it, idx) => {
        const ruta = rutaEntidad(it.tipo, it.id)
        const contenido = (
          <span
            key={`${it.tipo}:${it.id}:${idx}`}
            className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full border border-borde-sutil text-texto-secundario hover:border-texto-marca/40 hover:text-texto-marca hover:bg-texto-marca/5 transition-colors"
          >
            {iconoEntidad(it.tipo)}
            <span className="truncate max-w-[140px]">{it.nombre}</span>
          </span>
        )
        return ruta ? (
          <NextLink key={`${it.tipo}:${it.id}:${idx}`} href={ruta} className="no-underline">
            {contenido}
          </NextLink>
        ) : (
          <span key={`${it.tipo}:${it.id}:${idx}`}>{contenido}</span>
        )
      })}
    </div>
  )
}

// ─── Entrada de WhatsApp ───
function EntradaWhatsApp({
  entrada,
  formatoHora,
  locale,
  onRegistrarPagoDesdeMensaje,
  pagoVinculado,
}: {
  entrada: PropsEntradaTimeline['entrada']
  formatoHora: string
  locale: string
  onRegistrarPagoDesdeMensaje?: (entrada: PropsEntradaTimeline['entrada']) => void
  pagoVinculado?: { pago_id: string; monto: string; moneda: string }
}) {
  const numero = entrada.metadata?.whatsapp_numero || ''
  const destinatario = entrada.metadata?.whatsapp_destinatario || ''
  const plantilla = entrada.metadata?.whatsapp_plantilla
  const waStatus = entrada.metadata?.wa_status
  const botones = entrada.metadata?.whatsapp_botones

  return (
    <div className="rounded-card border border-canal-whatsapp/20 bg-canal-whatsapp/[0.03] overflow-hidden">
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
        <HtmlSeguro
          html={formatearTextoWA(entrada.contenido)}
          como="p"
          className="text-xs text-texto-secundario whitespace-pre-wrap leading-relaxed"
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

      {/* Acción: registrar como pago (solo cuando el padre lo soporta) */}
      {onRegistrarPagoDesdeMensaje && !pagoVinculado && (
        <div className="mt-1.5 px-3 pb-2">
          <BotonRegistrarPago onClick={() => onRegistrarPagoDesdeMensaje(entrada)} />
        </div>
      )}
      {pagoVinculado && (
        <div className="mt-1.5 px-3 pb-2">
          <ChipPagoVinculado pago={pagoVinculado} />
        </div>
      )}
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
    <div className="group flex items-start gap-2.5 py-2 bg-insignia-advertencia/5 -mx-3 px-3 rounded-card">
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
          <HtmlSeguro
            html={htmlContenido}
            className="text-sm text-texto-secundario mt-1 prose prose-sm max-w-none [&_p]:my-0.5 [&_ul]:my-1 [&_ol]:my-1 [&_li]:my-0"
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
function EntradaMensaje({
  entrada,
  esMensajePortal,
  formatoHora,
  locale,
  onRegistrarPagoDesdeMensaje,
  pagoVinculado,
}: {
  entrada: PropsEntradaTimeline['entrada']
  esMensajePortal: boolean
  formatoHora: string
  locale: string
  onRegistrarPagoDesdeMensaje?: (entrada: PropsEntradaTimeline['entrada']) => void
  pagoVinculado?: { pago_id: string; monto: string; moneda: string }
}) {
  return (
    <div className={`flex items-start gap-2.5 py-2 ${
      esMensajePortal ? 'bg-texto-marca/5 -mx-3 px-3 py-2 rounded-card' : ''
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
        {onRegistrarPagoDesdeMensaje && !pagoVinculado && (
          <div className="mt-1.5">
            <BotonRegistrarPago onClick={() => onRegistrarPagoDesdeMensaje(entrada)} />
          </div>
        )}
        {pagoVinculado && (
          <div className="mt-1.5">
            <ChipPagoVinculado pago={pagoVinculado} />
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Detectar tipo de archivo ───
function tipoArchivo(mime: string, nombre: string): 'imagen' | 'pdf' | 'video' | 'audio' | 'otro' {
  if (mime?.startsWith('image/')) return 'imagen'
  if (mime === 'application/pdf' || nombre?.endsWith('.pdf')) return 'pdf'
  if (mime?.startsWith('video/')) return 'video'
  if (mime?.startsWith('audio/')) return 'audio'
  return 'otro'
}

const COLORES_MINI: Record<ReturnType<typeof tipoArchivo>, string> = {
  imagen: 'text-insignia-info',
  pdf: 'text-insignia-peligro',
  video: 'text-texto-marca',
  audio: 'text-insignia-advertencia',
  otro: 'text-texto-terciario',
}

function IconoMini({ tipo }: { tipo: ReturnType<typeof tipoArchivo> }) {
  switch (tipo) {
    case 'pdf': return <FileText size={18} />
    case 'imagen': return <FileText size={18} />
    default: return <FileText size={18} />
  }
}

// ─── Lista de adjuntos reutilizable (mini tarjetas con preview) ───
function ListaAdjuntos({ adjuntos }: { adjuntos?: { url: string; nombre: string; tipo?: string }[] }) {
  if (!adjuntos?.length) return null

  return (
    <div className="flex flex-wrap gap-2 mt-2">
      {adjuntos.map((adj, i) => {
        const tipo = tipoArchivo(adj.tipo || '', adj.nombre)
        const esImagen = tipo === 'imagen'

        return (
          <a
            key={i}
            href={adj.url}
            target="_blank"
            rel="noopener noreferrer"
            className="group block w-[120px] rounded-boton border border-borde-sutil overflow-hidden hover:border-texto-marca/30 transition-colors"
            title={adj.nombre}
          >
            {/* Preview */}
            <div className="relative aspect-[4/3] bg-superficie-app flex items-center justify-center overflow-hidden">
              {esImagen ? (
                <Image src={adj.url} alt={adj.nombre} fill sizes="120px" className="object-cover" />
              ) : (
                <span className={COLORES_MINI[tipo]}>
                  <IconoMini tipo={tipo} />
                </span>
              )}
            </div>
            {/* Nombre */}
            <div className="flex items-center gap-1 px-1.5 py-1 bg-superficie-hover/40">
              <span className={`shrink-0 ${COLORES_MINI[tipo]}`}><FileText size={10} /></span>
              <span className="text-xxs text-texto-primario truncate">{adj.nombre}</span>
            </div>
          </a>
        )
      })}
    </div>
  )
}
