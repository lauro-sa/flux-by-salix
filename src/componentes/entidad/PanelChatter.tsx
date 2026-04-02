'use client'

/**
 * PanelChatter — Panel de mensajes y eventos vinculados a una entidad.
 * Combina timeline de eventos de sistema + mensajes del usuario + input para enviar.
 * Para presupuestos: botones confirmar/rechazar comprobantes + responder al portal.
 * Se usa en: editor de presupuestos, detalle de contacto, etc.
 */

import { useState, useEffect, useRef, useCallback } from 'react'
import {
  Send, MessageSquare, Clock, CheckCircle2, XCircle,
  Eye, FileText, ArrowRightLeft, Globe, CreditCard,
  Loader2, StickyNote, Check, X, Reply, ClipboardList, RotateCcw,
} from 'lucide-react'
import { Avatar } from '@/componentes/ui/Avatar'
import { Boton } from '@/componentes/ui/Boton'
import { TextArea } from '@/componentes/ui/TextArea'
import { useTraduccion } from '@/lib/i18n'
import type { EntradaChatter, AccionSistema } from '@/tipos/chatter'

// ─── Iconos y colores por acción de sistema ───
const ICONOS_ACCION: Record<AccionSistema, { icono: React.ReactNode; color: string }> = {
  creado: { icono: <FileText size={14} />, color: 'bg-texto-marca/10 text-texto-marca' },
  estado_cambiado: { icono: <ArrowRightLeft size={14} />, color: 'bg-estado-pendiente/10 text-estado-pendiente' },
  portal_enviado: { icono: <Globe size={14} />, color: 'bg-canal-correo/10 text-canal-correo' },
  portal_visto: { icono: <Eye size={14} />, color: 'bg-insignia-info/10 text-insignia-info' },
  portal_aceptado: { icono: <CheckCircle2 size={14} />, color: 'bg-insignia-exito/10 text-insignia-exito' },
  portal_rechazado: { icono: <XCircle size={14} />, color: 'bg-insignia-peligro/10 text-insignia-peligro' },
  portal_comprobante: { icono: <CreditCard size={14} />, color: 'bg-insignia-advertencia/10 text-insignia-advertencia' },
  pago_confirmado: { icono: <CheckCircle2 size={14} />, color: 'bg-insignia-exito/10 text-insignia-exito' },
  pago_rechazado: { icono: <XCircle size={14} />, color: 'bg-insignia-peligro/10 text-insignia-peligro' },
  pdf_generado: { icono: <FileText size={14} />, color: 'bg-texto-terciario/10 text-texto-terciario' },
  campo_editado: { icono: <Clock size={14} />, color: 'bg-texto-terciario/10 text-texto-terciario' },
  actividad_creada: { icono: <ClipboardList size={14} />, color: 'bg-insignia-info/10 text-insignia-info' },
  actividad_completada: { icono: <CheckCircle2 size={14} />, color: 'bg-insignia-exito/10 text-insignia-exito' },
  actividad_reactivada: { icono: <RotateCcw size={14} />, color: 'bg-insignia-advertencia/10 text-insignia-advertencia' },
}

// ─── Props ───
interface PropsPanelChatter {
  entidadTipo: string
  entidadId: string
  className?: string
}

// ─── Formatear fecha relativa ───
function fechaRelativa(fecha: string): string {
  const ahora = new Date()
  const d = new Date(fecha)
  const diff = ahora.getTime() - d.getTime()
  const minutos = Math.floor(diff / 60000)
  const horas = Math.floor(diff / 3600000)
  const dias = Math.floor(diff / 86400000)

  if (minutos < 1) return 'Ahora'
  if (minutos < 60) return `Hace ${minutos}m`
  if (horas < 24) return `Hace ${horas}h`
  if (dias < 7) return `Hace ${dias}d`
  return d.toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: dias > 365 ? 'numeric' : undefined })
}

export function PanelChatter({ entidadTipo, entidadId, className = '' }: PropsPanelChatter) {
  const { t } = useTraduccion()
  const [entradas, setEntradas] = useState<EntradaChatter[]>([])
  const [cargando, setCargando] = useState(true)
  const [mensaje, setMensaje] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [tab, setTab] = useState<'todo' | 'mensajes' | 'sistema'>('todo')
  const [modoRespuestaPortal, setModoRespuestaPortal] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  // Cargar entradas
  const cargar = useCallback(async () => {
    try {
      const res = await fetch(`/api/chatter?entidad_tipo=${entidadTipo}&entidad_id=${entidadId}`)
      if (res.ok) {
        const data = await res.json()
        setEntradas(data.entradas || [])
      }
    } catch { /* silencioso */ }
    setCargando(false)
  }, [entidadTipo, entidadId])

  useEffect(() => {
    if (entidadId) cargar()
  }, [entidadId, cargar])

  // Auto-scroll al fondo cuando cambian las entradas
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [entradas])

  // Enviar mensaje (nota interna o respuesta al portal)
  const enviar = async () => {
    const texto = mensaje.trim()
    if (!texto || enviando) return

    setEnviando(true)
    try {
      if (modoRespuestaPortal && entidadTipo === 'presupuesto') {
        // Enviar como mensaje al portal del cliente
        const res = await fetch(`/api/presupuestos/${entidadId}/mensajes-portal`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ contenido: texto }),
        })
        if (res.ok) {
          setMensaje('')
          setModoRespuestaPortal(false)
          // También registrar en chatter local para que se vea
          await fetch('/api/chatter', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              entidad_tipo: entidadTipo,
              entidad_id: entidadId,
              tipo: 'mensaje',
              contenido: texto,
              metadata: { portal: true },
            }),
          })
          await cargar()
        }
      } else {
        // Nota interna estándar
        const res = await fetch('/api/chatter', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            entidad_tipo: entidadTipo,
            entidad_id: entidadId,
            tipo: 'mensaje',
            contenido: texto,
          }),
        })
        if (res.ok) {
          setMensaje('')
          await cargar()
        }
      }
    } catch { /* silencioso */ }
    setEnviando(false)
    inputRef.current?.focus()
  }

  // Confirmar/rechazar comprobante
  const accionComprobante = async (entradaId: string, comprobanteId: string, accion: 'confirmar' | 'rechazar') => {
    try {
      const res = await fetch(`/api/presupuestos/${entidadId}/comprobantes`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ comprobante_id: comprobanteId, accion }),
      })
      if (res.ok) {
        await cargar()
      }
    } catch { /* silencioso */ }
  }

  // Filtrar por tab
  const entradasFiltradas = entradas.filter(e => {
    if (tab === 'mensajes') return e.tipo === 'mensaje' || e.tipo === 'nota_interna'
    if (tab === 'sistema') return e.tipo === 'sistema'
    return true
  })

  // Detectar si hay mensajes del portal (para mostrar botón responder)
  const hayMensajesPortal = entradas.some(e => e.metadata?.portal && e.autor_id === 'portal')

  return (
    <div className={`flex flex-col bg-superficie-tarjeta border border-borde-sutil rounded-xl overflow-hidden ${className}`}>
      {/* Header con tabs */}
      <div className="px-4 py-3 border-b border-borde-sutil flex items-center justify-between">
        <h3 className="text-sm font-semibold text-texto-primario flex items-center gap-1.5">
          <MessageSquare size={15} />
          Actividad
        </h3>
        <div className="flex gap-1 text-xs">
          {(['todo', 'mensajes', 'sistema'] as const).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-2 py-1 rounded-md transition-colors capitalize focus-visible:outline-2 focus-visible:outline-texto-marca focus-visible:-outline-offset-2 ${
                tab === t
                  ? 'bg-superficie-hover text-texto-primario font-medium'
                  : 'text-texto-terciario hover:text-texto-secundario'
              }`}
            >
              {t === 'todo' ? 'Todo' : t === 'mensajes' ? 'Mensajes' : 'Sistema'}
            </button>
          ))}
        </div>
      </div>

      {/* Timeline de entradas */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-1 max-h-[400px] min-h-[120px]">
        {cargando ? (
          <div className="flex items-center justify-center h-20 text-texto-terciario">
            <Loader2 size={18} className="animate-spin" />
          </div>
        ) : entradasFiltradas.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-20 text-texto-terciario text-xs">
            <MessageSquare size={20} className="mb-1 opacity-40" />
            Sin actividad
          </div>
        ) : (
          entradasFiltradas.map(entrada => (
            <EntradaItem
              key={entrada.id}
              entrada={entrada}
              entidadTipo={entidadTipo}
              onAccionComprobante={accionComprobante}
            />
          ))
        )}
      </div>

      {/* Input de mensaje */}
      <div className="px-4 py-3 border-t border-borde-sutil space-y-2">
        {/* Toggle responder al portal */}
        {entidadTipo === 'presupuesto' && hayMensajesPortal && (
          <button
            onClick={() => {
              setModoRespuestaPortal(!modoRespuestaPortal)
              inputRef.current?.focus()
            }}
            className={`flex items-center gap-1 text-xs transition-colors rounded focus-visible:outline-2 focus-visible:outline-texto-marca focus-visible:-outline-offset-2 ${
              modoRespuestaPortal
                ? 'text-texto-marca font-medium'
                : 'text-texto-terciario hover:text-texto-secundario'
            }`}
          >
            <Reply size={12} />
            {modoRespuestaPortal ? 'Respondiendo al cliente (portal)' : 'Responder al cliente'}
          </button>
        )}

        <div className="flex gap-2 items-end">
          <TextArea
            ref={inputRef}
            value={mensaje}
            onChange={(e) => setMensaje(e.target.value)}
            enviarConEnter
            onEnviar={enviar}
            placeholder={modoRespuestaPortal
              ? 'Escribí un mensaje para el cliente (se verá en el portal)...'
              : 'Escribí una nota o mensaje...'
            }
            rows={1}
          />
          <Boton
            variante="primario"
            tamano="sm"
            soloIcono
            titulo="Enviar"
            icono={<Send size={16} />}
            onClick={enviar}
            disabled={!mensaje.trim() || enviando}
            cargando={enviando}
          />
        </div>
      </div>
    </div>
  )
}

// ─── Componente de entrada individual ───
function EntradaItem({
  entrada,
  entidadTipo,
  onAccionComprobante,
}: {
  entrada: EntradaChatter
  entidadTipo: string
  onAccionComprobante: (entradaId: string, comprobanteId: string, accion: 'confirmar' | 'rechazar') => void
}) {
  const [accionando, setAccionando] = useState(false)
  const esSistema = entrada.tipo === 'sistema'
  const esNotaInterna = entrada.tipo === 'nota_interna'
  const esMensajePortal = entrada.metadata?.portal && entrada.autor_id === 'portal'
  const accion = entrada.metadata?.accion as AccionSistema | undefined
  const config = accion ? ICONOS_ACCION[accion] : null

  // Detectar si es un comprobante pendiente de confirmación
  const esComprobante = accion === 'portal_comprobante'
  const comprobanteId = entrada.metadata?.detalles?.comprobante_id as string | undefined
  // Si ya hay una entrada posterior de pago_confirmado o pago_rechazado para este comprobante, no mostrar botones
  const yaProcesado = accion === 'pago_confirmado' || accion === 'pago_rechazado'

  const handleAccion = async (acc: 'confirmar' | 'rechazar') => {
    if (accionando || !comprobanteId) return
    setAccionando(true)
    await onAccionComprobante(entrada.id, comprobanteId, acc)
    setAccionando(false)
  }

  if (esSistema) {
    return (
      <div className="flex items-start gap-2 py-1.5">
        <div className={`flex items-center justify-center size-6 rounded-full shrink-0 ${config?.color || 'bg-superficie-hover text-texto-terciario'}`}>
          {config?.icono || <Clock size={12} />}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs text-texto-secundario leading-relaxed">
            <span className="font-medium text-texto-primario">{entrada.autor_nombre}</span>
            {' · '}
            {entrada.contenido}
          </p>
          {/* Adjuntos */}
          {entrada.adjuntos?.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-1">
              {entrada.adjuntos.map((adj, i) => (
                <a
                  key={i}
                  href={adj.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-xs text-texto-marca hover:underline bg-superficie-app px-2 py-0.5 rounded"
                >
                  <FileText size={10} />
                  {adj.nombre}
                </a>
              ))}
            </div>
          )}
          {/* Botones confirmar/rechazar comprobante */}
          {esComprobante && entidadTipo === 'presupuesto' && comprobanteId && (
            <div className="flex items-center gap-2 mt-2">
              <Boton
                variante="exito"
                tamano="xs"
                icono={<Check size={12} />}
                onClick={() => handleAccion('confirmar')}
                disabled={accionando}
                cargando={accionando}
              >
                Confirmar pago
              </Boton>
              <Boton
                variante="peligro"
                tamano="xs"
                icono={<X size={12} />}
                onClick={() => handleAccion('rechazar')}
                disabled={accionando}
              >
                Rechazar
              </Boton>
            </div>
          )}
          <span className="text-xxs text-texto-terciario">{fechaRelativa(entrada.creado_en)}</span>
        </div>
      </div>
    )
  }

  return (
    <div className={`flex items-start gap-2 py-2 ${
      esNotaInterna ? 'bg-insignia-advertencia/5 -mx-2 px-2 rounded-lg'
        : esMensajePortal ? 'bg-texto-marca/5 -mx-2 px-2 rounded-lg'
          : ''
    }`}>
      <Avatar
        nombre={entrada.autor_nombre}
        foto={entrada.autor_avatar_url}
        tamano="xs"
      />
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2">
          <span className="text-xs font-semibold text-texto-primario">{entrada.autor_nombre}</span>
          {esNotaInterna && (
            <span className="text-xxs text-insignia-advertencia flex items-center gap-0.5">
              <StickyNote size={10} /> Nota interna
            </span>
          )}
          {esMensajePortal && (
            <span className="text-xxs text-texto-marca flex items-center gap-0.5">
              <Globe size={10} /> Portal
            </span>
          )}
          <span className="text-xxs text-texto-terciario ml-auto shrink-0">{fechaRelativa(entrada.creado_en)}</span>
        </div>
        <p className="text-sm text-texto-secundario mt-0.5 whitespace-pre-wrap">{entrada.contenido}</p>
        {/* Adjuntos */}
        {entrada.adjuntos?.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-1.5">
            {entrada.adjuntos.map((adj, i) => (
              <a
                key={i}
                href={adj.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-xs text-texto-marca hover:underline bg-superficie-app px-2 py-1 rounded"
              >
                <FileText size={12} />
                {adj.nombre}
              </a>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
