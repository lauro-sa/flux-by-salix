'use client'

import { useState } from 'react'
import { Buscador } from '@/componentes/ui/Buscador'
import { Avatar } from '@/componentes/ui/Avatar'
import { Insignia } from '@/componentes/ui/Insignia'
import { Tabs } from '@/componentes/ui/Tabs'
import { Boton } from '@/componentes/ui/Boton'
import {
  MessageCircle, Mail, Users, Send, Paperclip, Smile,
  MoreHorizontal, Phone, Star, Archive, Bot, Clock,
  Reply, ReplyAll, Forward, Trash2, AlertOctagon,
  Pen, ChevronDown, ChevronUp, Inbox, FileText, MessageSquare,
} from 'lucide-react'

/**
 * Prototipo visual del Inbox — 3 tabs: Chat (WhatsApp), Correo, Interno.
 * Cada tab tiene su propio layout adaptado al canal.
 */

// ========== DATOS FAKE ==========

// WhatsApp
interface ConvWhatsapp {
  id: string; contacto: string; ultimoMensaje: string; hora: string
  noLeidos: number; asignado?: string; etapa?: string; esBot?: boolean
}

const convsWhatsapp: ConvWhatsapp[] = [
  { id: '1', contacto: 'Juan Pérez', ultimoMensaje: 'Necesito un presupuesto para 50 unidades', hora: '5 min', noLeidos: 3, asignado: 'María', etapa: 'Nuevo' },
  { id: '2', contacto: 'Lucía Martínez', ultimoMensaje: 'Confirmo la reunión para el jueves a las 10', hora: '2h', noLeidos: 0, asignado: 'María', etapa: 'Negociación', esBot: true },
  { id: '3', contacto: 'Proveedor TechParts', ultimoMensaje: 'Los precios están en el PDF adjunto', hora: 'Ayer', noLeidos: 0 },
  { id: '4', contacto: 'Diego Romero', ultimoMensaje: '¿Tienen stock del modelo X200?', hora: 'Ayer', noLeidos: 1, etapa: 'Nuevo' },
]

interface MsgChat { id: string; contenido: string; hora: string; esEntrante: boolean; autor?: string; esBot?: boolean }

const msgsChat: MsgChat[] = [
  { id: '1', contenido: 'Hola, buenas tardes. Necesito un presupuesto para 50 unidades del producto PRD-0023.', hora: '14:32', esEntrante: true },
  { id: '2', contenido: '¡Hola Juan! Gracias por contactarnos. ¿Para cuándo necesitarías la entrega?', hora: '14:33', esEntrante: false, esBot: true },
  { id: '3', contenido: 'Para la primera semana de abril si es posible.', hora: '14:35', esEntrante: true },
  { id: '4', contenido: 'Perfecto, te preparo el presupuesto y te lo envío hoy. ¿Necesitás factura A o B?', hora: '14:36', esEntrante: false, esBot: true },
  { id: '5', contenido: 'Factura A por favor. CUIT 30-71234567-9', hora: '14:38', esEntrante: true },
  { id: '6', contenido: 'Anotado. En unos minutos te envío el presupuesto. ¡Gracias Juan!', hora: '14:39', esEntrante: false, autor: 'María' },
]

// Correo
interface Correo {
  id: string; de: string; deEmail: string; asunto: string; preview: string
  fecha: string; leido: boolean; estrella: boolean; adjuntos: number; threadCount?: number
}

const correos: Correo[] = [
  { id: '1', de: 'Ana García', deEmail: 'ana@corp.com', asunto: 'Re: Factura #FA-2026-00042', preview: 'Adjunto el comprobante de pago correspondiente al mes de marzo. Por favor confirmar recepción.', fecha: '14:20', leido: false, estrella: false, adjuntos: 1, threadCount: 4 },
  { id: '2', de: 'Roberto Sánchez', deEmail: 'roberto@empresa.com', asunto: 'Solicitud de cotización — Servicios de mantenimiento anual', preview: 'Estimados, solicito cotización para el servicio de mantenimiento preventivo anual de nuestros equipos...', fecha: '11:05', leido: false, estrella: true, adjuntos: 0 },
  { id: '3', de: 'Carolina Vega', deEmail: 'carolina@tech.io', asunto: 'Re: Propuesta comercial', preview: 'Nos interesa avanzar con la propuesta. ¿Podemos agendar una reunión para la semana que viene?', fecha: 'Ayer', leido: true, estrella: false, adjuntos: 0, threadCount: 6 },
  { id: '4', de: 'Soporte Proveedor', deEmail: 'soporte@proveedor.com', asunto: 'Actualización de precios — Lista Marzo 2026', preview: 'Le informamos que a partir del 1° de abril entran en vigencia los nuevos precios...', fecha: 'Ayer', leido: true, estrella: false, adjuntos: 2 },
  { id: '5', de: 'Newsletter TechNews', deEmail: 'news@technews.com', asunto: 'Las 10 tendencias en software empresarial 2026', preview: 'Descubrí las herramientas que están transformando la gestión de PyMEs en Latinoamérica...', fecha: 'Mar 23', leido: true, estrella: false, adjuntos: 0 },
]

// Interno
interface MsgInterno { id: string; autor: string; contenido: string; hora: string; canal: string }

const msgsInternos: MsgInterno[] = [
  { id: '1', autor: 'Pedro', contenido: '¿Alguien puede cubrir la visita de mañana a TechParts? Me surgió un imprevisto.', hora: '13:20', canal: 'Equipo Ventas' },
  { id: '2', autor: 'María', contenido: 'Yo puedo ir. ¿A qué hora es?', hora: '13:25', canal: 'Equipo Ventas' },
  { id: '3', autor: 'Pedro', contenido: '10:30 en su oficina de Palermo. Te paso la dirección por privado.', hora: '13:26', canal: 'Equipo Ventas' },
  { id: '4', autor: 'Carlos', contenido: 'Se resolvió el ticket #234 del cliente Gómez. Era un tema de permisos.', hora: '12:00', canal: 'Soporte' },
  { id: '5', autor: 'Ana', contenido: 'Actualicé los precios del catálogo. Revisen antes de enviar cotizaciones.', hora: '11:15', canal: 'General' },
]

// ========== COMPONENTE PRINCIPAL ==========

export default function PaginaInbox() {
  const [tabActivo, setTabActivo] = useState('chat')
  const [busqueda, setBusqueda] = useState('')
  const [convActiva, setConvActiva] = useState('1')
  const [correoActivo, setCorreoActivo] = useState('')
  const [mensaje, setMensaje] = useState('')
  const [threadExpandido, setThreadExpandido] = useState(false)

  return (
    <div className="flex flex-col h-[calc(100dvh-var(--header-alto))] -m-6">

      {/* Tabs principales */}
      <div className="px-4 pt-2 bg-superficie-tarjeta border-b border-borde-sutil shrink-0">
        <Tabs
          tabs={[
            { clave: 'chat', etiqueta: 'WhatsApp', icono: <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>, contador: 4 },
            { clave: 'correo', etiqueta: 'Correo', icono: <Mail size={15} />, contador: 2 },
            { clave: 'interno', etiqueta: 'Mensajes', icono: <MessageSquare size={15} /> },
          ]}
          activo={tabActivo}
          onChange={setTabActivo}
        />
      </div>

      {/* ========== TAB WHATSAPP (Chat) ========== */}
      {tabActivo === 'chat' && (
        <div className="flex flex-1 min-h-0">
          {/* Lista de conversaciones */}
          <div className="w-[320px] shrink-0 border-r border-borde-sutil flex flex-col bg-superficie-tarjeta">
            <div className="px-3 py-3">
              <Buscador valor={busqueda} onChange={setBusqueda} placeholder="Buscar en WhatsApp..." />
            </div>
            <div className="flex-1 overflow-y-auto">
              {convsWhatsapp.map((c) => (
                <button
                  key={c.id}
                  onClick={() => setConvActiva(c.id)}
                  className={[
                    'w-full flex items-start gap-2.5 px-3 py-2.5 text-left border-none cursor-pointer transition-colors duration-100',
                    c.id === convActiva ? 'bg-superficie-seleccionada' : 'bg-transparent hover:bg-superficie-hover',
                  ].join(' ')}
                >
                  <Avatar nombre={c.contacto} tamano="sm" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1">
                      <span className={`text-sm truncate ${c.noLeidos ? 'font-semibold text-texto-primario' : 'text-texto-primario'}`}>{c.contacto}</span>
                      <span className="text-xs text-texto-terciario shrink-0">{c.hora}</span>
                    </div>
                    <div className="flex items-center gap-1 mt-0.5">
                      {c.esBot && <Bot size={11} className="text-texto-marca shrink-0" />}
                      <p className={`text-sm truncate ${c.noLeidos ? 'text-texto-secundario' : 'text-texto-terciario'}`}>{c.ultimoMensaje}</p>
                    </div>
                    {(c.etapa || c.asignado) && (
                      <div className="flex items-center gap-1 mt-1">
                        {c.etapa && <Insignia color="neutro">{c.etapa}</Insignia>}
                        {c.asignado && <span className="text-xxs text-texto-terciario">→ {c.asignado}</span>}
                      </div>
                    )}
                  </div>
                  {c.noLeidos > 0 && (
                    <span className="bg-canal-whatsapp text-white text-xxs font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1 shrink-0 mt-0.5">
                      {c.noLeidos}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Chat */}
          <div className="flex-1 flex flex-col min-w-0">
            <div className="flex items-center justify-between px-4 py-2.5 border-b border-borde-sutil shrink-0">
              <div className="flex items-center gap-2.5">
                <Avatar nombre="Juan Pérez" tamano="sm" />
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-texto-primario">Juan Pérez</span>
                    <span className="text-xs text-canal-whatsapp flex items-center gap-0.5"><MessageCircle size={11} /> WhatsApp</span>
                  </div>
                  <span className="text-xs text-texto-terciario">+54 11 2345-6789</span>
                </div>
              </div>
              <div className="flex items-center gap-0.5">
                <button className="size-7 rounded-md bg-transparent border-none text-texto-terciario cursor-pointer hover:bg-superficie-hover flex items-center justify-center"><Phone size={15} /></button>
                <button className="size-7 rounded-md bg-transparent border-none text-texto-terciario cursor-pointer hover:bg-superficie-hover flex items-center justify-center"><Star size={15} /></button>
                <button className="size-7 rounded-md bg-transparent border-none text-texto-terciario cursor-pointer hover:bg-superficie-hover flex items-center justify-center"><MoreHorizontal size={15} /></button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-2.5">
              <div className="flex items-center gap-3 py-1"><div className="flex-1 h-px bg-borde-sutil" /><span className="text-xs text-texto-terciario">Hoy</span><div className="flex-1 h-px bg-borde-sutil" /></div>
              {msgsChat.map((m) => (
                <div key={m.id} className={`flex ${m.esEntrante ? 'justify-start' : 'justify-end'}`}>
                  <div className={[
                    'max-w-[65%] rounded-2xl px-3.5 py-2 text-sm leading-relaxed',
                    m.esEntrante ? 'bg-superficie-hover text-texto-primario rounded-bl-sm' : 'bg-texto-marca text-texto-inverso rounded-br-sm',
                  ].join(' ')}>
                    {!m.esEntrante && (m.esBot || m.autor) && (
                      <div className={`flex items-center gap-1 text-xxs mb-0.5 ${m.esEntrante ? 'text-texto-terciario' : 'text-texto-inverso/70'}`}>
                        {m.esBot && <Bot size={10} />}{m.esBot ? 'Agente Flux' : m.autor}
                      </div>
                    )}
                    {m.contenido}
                    <div className={`text-xxs mt-0.5 text-right ${m.esEntrante ? 'text-texto-terciario' : 'text-texto-inverso/60'}`}>{m.hora}</div>
                  </div>
                </div>
              ))}
              <div className="flex justify-start">
                <div className="flex items-center gap-2 bg-superficie-hover rounded-2xl px-3.5 py-2 text-sm text-texto-terciario">
                  <Bot size={13} className="text-texto-marca" /><Clock size={11} className="animate-pulse" /> Agente escribiendo...
                </div>
              </div>
            </div>

            <div className="px-4 py-2.5 border-t border-borde-sutil shrink-0">
              <div className="flex items-end gap-2 border border-borde-sutil rounded-lg px-3 py-2">
                <button className="size-7 rounded-md bg-transparent border-none text-texto-terciario cursor-pointer hover:text-texto-secundario flex items-center justify-center"><Paperclip size={16} /></button>
                <textarea value={mensaje} onChange={(e) => setMensaje(e.target.value)} placeholder="Escribir mensaje..." rows={1} className="flex-1 resize-none border-none outline-none bg-transparent text-sm text-texto-primario placeholder:text-texto-terciario leading-relaxed py-0.5" />
                <button className="size-7 rounded-md bg-transparent border-none text-texto-terciario cursor-pointer flex items-center justify-center"><Smile size={16} /></button>
                <button className={`size-7 rounded-md border-none cursor-pointer flex items-center justify-center ${mensaje.trim() ? 'bg-texto-marca text-texto-inverso' : 'bg-superficie-hover text-texto-terciario'}`}><Send size={14} /></button>
              </div>
              <div className="flex items-center gap-2 mt-1.5 text-xxs text-texto-terciario">
                <Bot size={10} /> Agente activo · <button className="bg-transparent border-none text-texto-marca cursor-pointer text-xxs p-0 hover:underline">Pausar</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========== TAB CORREO ========== */}
      {tabActivo === 'correo' && (
        <div className="flex flex-1 min-h-0">

          {/* Sidebar de carpetas */}
          <div className="w-[200px] shrink-0 border-r border-borde-sutil flex flex-col bg-superficie-tarjeta py-2">
            <div className="px-3 mb-2">
              <Boton variante="primario" tamano="sm" anchoCompleto icono={<Pen size={14} />}>Redactar</Boton>
            </div>

            {[
              { nombre: 'Recibidos', icono: <Inbox size={15} />, conteo: 2, activa: true },
              { nombre: 'Enviados', icono: <Send size={15} />, conteo: 0, activa: false },
              { nombre: 'Borradores', icono: <FileText size={15} />, conteo: 1, activa: false },
              { nombre: 'Destacados', icono: <Star size={15} />, conteo: 0, activa: false },
              { nombre: 'Spam', icono: <AlertOctagon size={15} />, conteo: 0, activa: false },
              { nombre: 'Eliminados', icono: <Trash2 size={15} />, conteo: 0, activa: false },
            ].map((carpeta) => (
              <button
                key={carpeta.nombre}
                className={[
                  'flex items-center gap-2.5 w-full px-3 py-1.5 text-sm text-left border-none cursor-pointer transition-colors',
                  carpeta.activa
                    ? 'bg-superficie-seleccionada text-texto-marca font-medium'
                    : 'bg-transparent text-texto-secundario hover:bg-superficie-hover',
                ].join(' ')}
              >
                <span className="shrink-0 flex">{carpeta.icono}</span>
                <span className="flex-1">{carpeta.nombre}</span>
                {carpeta.conteo > 0 && (
                  <span className={`text-xs font-semibold ${carpeta.activa ? 'text-texto-marca' : 'text-texto-terciario'}`}>{carpeta.conteo}</span>
                )}
              </button>
            ))}

            <div className="h-px bg-borde-sutil my-2 mx-3" />
            <div className="px-3 text-xxs font-semibold text-texto-terciario uppercase tracking-wider mb-1">Etiquetas</div>
            {[
              { nombre: 'Clientes', color: 'bg-insignia-exito' },
              { nombre: 'Facturas', color: 'bg-insignia-info' },
              { nombre: 'Proveedores', color: 'bg-insignia-advertencia' },
            ].map((et) => (
              <button key={et.nombre} className="flex items-center gap-2 w-full px-3 py-1 text-sm text-left border-none bg-transparent text-texto-terciario cursor-pointer hover:bg-superficie-hover">
                <span className={`size-2 rounded-full ${et.color} shrink-0`} />
                {et.nombre}
              </button>
            ))}
          </div>

          {/* Contenido principal: lista o correo abierto */}
          <div className="flex-1 flex flex-col min-w-0">

            {/* Toolbar superior */}
            <div className="flex items-center justify-between px-4 py-2 border-b border-borde-sutil shrink-0 gap-2">
              {correoActivo && (
                <button onClick={() => setCorreoActivo('')} className="flex items-center gap-1 text-sm text-texto-secundario bg-transparent border-none cursor-pointer hover:text-texto-primario p-1">
                  <ChevronDown size={14} className="rotate-90" /> Volver
                </button>
              )}
              <Buscador valor={busqueda} onChange={setBusqueda} placeholder="Buscar correos..." className="flex-1 max-w-md" />
              {correoActivo && (
                <div className="flex items-center gap-0.5">
                  <button className="size-7 rounded-md bg-transparent border-none text-texto-terciario cursor-pointer hover:bg-superficie-hover flex items-center justify-center" title="Archivar"><Archive size={15} /></button>
                  <button className="size-7 rounded-md bg-transparent border-none text-texto-terciario cursor-pointer hover:bg-superficie-hover flex items-center justify-center" title="Spam"><AlertOctagon size={15} /></button>
                  <button className="size-7 rounded-md bg-transparent border-none text-texto-terciario cursor-pointer hover:bg-superficie-hover flex items-center justify-center" title="Eliminar"><Trash2 size={15} /></button>
                  <span className="text-xs text-texto-terciario mx-1">5 de 302</span>
                  <button className="size-7 rounded-md bg-transparent border-none text-texto-terciario cursor-pointer hover:bg-superficie-hover flex items-center justify-center"><ChevronUp size={15} /></button>
                  <button className="size-7 rounded-md bg-transparent border-none text-texto-terciario cursor-pointer hover:bg-superficie-hover flex items-center justify-center"><ChevronDown size={15} /></button>
                </div>
              )}
            </div>

            {/* VISTA LISTA (sin correo abierto) */}
            {!correoActivo && (
              <div className="flex-1 overflow-y-auto">
                {correos.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => setCorreoActivo(c.id)}
                    className={[
                      'w-full flex items-center gap-0 px-3 py-0 text-left border-none border-b border-borde-sutil cursor-pointer transition-colors duration-75 h-10',
                      !c.leido ? 'bg-superficie-tarjeta hover:bg-superficie-hover' : 'bg-transparent hover:bg-superficie-hover',
                    ].join(' ')}
                  >
                    {/* Checkbox */}
                    <input type="checkbox" className="size-3.5 cursor-pointer shrink-0 mr-2.5" onClick={(e) => e.stopPropagation()} />
                    {/* Estrella */}
                    <button onClick={(e) => { e.stopPropagation() }} className="shrink-0 mr-2.5 bg-transparent border-none cursor-pointer p-0 flex items-center text-texto-terciario hover:text-insignia-advertencia">
                      <Star size={14} className={c.estrella ? 'fill-insignia-advertencia text-insignia-advertencia' : ''} />
                    </button>
                    {/* Remitente */}
                    <span className={`w-[180px] shrink-0 text-sm truncate ${!c.leido ? 'font-semibold text-texto-primario' : 'text-texto-secundario'}`}>
                      {c.de}
                      {c.threadCount && <span className="text-texto-terciario font-normal text-xs ml-1">({c.threadCount})</span>}
                    </span>
                    {/* Asunto + preview */}
                    <div className="flex-1 min-w-0 flex items-center gap-1.5 mx-3">
                      <span className={`text-sm truncate shrink-0 max-w-[50%] ${!c.leido ? 'text-texto-primario font-medium' : 'text-texto-secundario'}`}>{c.asunto}</span>
                      <span className="text-sm text-texto-terciario truncate">— {c.preview}</span>
                    </div>
                    {/* Adjuntos */}
                    {c.adjuntos > 0 && <Paperclip size={13} className="text-texto-terciario shrink-0 mr-2" />}
                    {/* Fecha */}
                    <span className={`text-sm shrink-0 ${!c.leido ? 'text-texto-primario font-medium' : 'text-texto-terciario'}`}>{c.fecha}</span>
                  </button>
                ))}
              </div>
            )}

            {/* VISTA CORREO ABIERTO (estilo Gmail thread) */}
            {correoActivo && (() => {
              const correo = correos.find((c) => c.id === correoActivo)
              if (!correo) return null
              return (
                <div className="flex-1 overflow-y-auto">
                  {/* Asunto */}
                  <div className="px-6 pt-5 pb-3">
                    <div className="flex items-center gap-3">
                      <h1 className="text-xl font-semibold text-texto-primario flex-1">{correo.asunto}</h1>
                      <Insignia color="neutro">Recibidos ×</Insignia>
                    </div>
                  </div>

                  {/* Mensajes anteriores del thread (colapsados) */}
                  {correo.threadCount && correo.threadCount > 1 && (
                    <div className="px-6">
                      {[...Array(correo.threadCount - 1)].map((_, i) => (
                        <button key={i} onClick={() => setThreadExpandido(!threadExpandido)} className="w-full flex items-center gap-3 px-0 py-3 border-b border-borde-sutil text-left bg-transparent border-x-0 border-t-0 cursor-pointer hover:bg-superficie-hover -mx-0">
                          <Avatar nombre={i % 2 === 0 ? correo.de : 'Yo'} tamano="sm" />
                          <div className="flex-1 min-w-0">
                            <span className="text-sm font-medium text-texto-primario">{i % 2 === 0 ? correo.de : 'Yo'}</span>
                            <p className="text-sm text-texto-terciario truncate mt-0.5">
                              {i === 0 ? 'Estimados, los contacto para confirmar la asistencia...' : 'Perfecto, avancemos con el presupuesto...'}
                            </p>
                          </div>
                          <span className="text-xs text-texto-terciario shrink-0">mar, {10 + i * 3} mar</span>
                        </button>
                      ))}
                      {/* Indicador de mensajes colapsados */}
                      <button className="flex items-center justify-center w-8 h-8 rounded-full border border-borde-sutil text-xs text-texto-terciario font-semibold bg-superficie-tarjeta cursor-pointer hover:bg-superficie-hover my-1">
                        {correo.threadCount - 1}
                      </button>
                    </div>
                  )}

                  {/* Último mensaje (expandido completo) */}
                  <div className="px-6 py-4 border-b border-borde-sutil">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-start gap-3">
                        <Avatar nombre={correo.de} tamano="md" />
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold text-texto-primario">{correo.de}</span>
                            <span className="text-xs text-texto-terciario">&lt;{correo.deEmail}&gt;</span>
                          </div>
                          <div className="text-xs text-texto-terciario mt-0.5">
                            para Grupo, Info, Grupo ▾
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <span className="text-xs text-texto-terciario mr-2">{correo.fecha}</span>
                        <button className="size-7 rounded-md bg-transparent border-none text-texto-terciario cursor-pointer hover:bg-superficie-hover flex items-center justify-center"><Star size={15} /></button>
                        <button className="size-7 rounded-md bg-transparent border-none text-texto-terciario cursor-pointer hover:bg-superficie-hover flex items-center justify-center"><Reply size={15} /></button>
                        <button className="size-7 rounded-md bg-transparent border-none text-texto-terciario cursor-pointer hover:bg-superficie-hover flex items-center justify-center"><MoreHorizontal size={15} /></button>
                      </div>
                    </div>

                    {/* Cuerpo del correo */}
                    <div className="text-sm text-texto-primario leading-relaxed whitespace-pre-line pl-12">
                      Muchas gracias por la pronta respuesta!{'\n\n'}
                      {correo.preview}{'\n\n'}
                      Aprovecho este mail ya que tenemos una consulta adicional sobre el servicio contratado. Quizá puedan revisarla y sugieran alguna mejora.{'\n\n'}
                      Muchas gracias!{'\n'}
                      Saludos,{'\n\n'}
                      <div className="border-t border-borde-sutil pt-3 mt-3">
                        <p className="font-bold text-texto-primario text-base tracking-tight">{correo.de.split(' ')[0].toUpperCase()}</p>
                        <p className="text-sm text-texto-secundario mt-1">{correo.de} · Facility Manager</p>
                        <div className="flex flex-col gap-0.5 mt-2 text-sm text-texto-terciario">
                          <span>Tel. (+54 11) 4309 5400</span>
                          <span>WhatsApp (+54 911) 3628 8057</span>
                        </div>
                      </div>
                    </div>

                    {/* Adjuntos */}
                    {correo.adjuntos > 0 && (
                      <div className="flex gap-2 mt-5 pl-12">
                        {[...Array(correo.adjuntos)].map((_, i) => (
                          <div key={i} className="flex items-center gap-2 px-3 py-2.5 bg-superficie-hover rounded-lg text-sm text-texto-secundario cursor-pointer hover:bg-superficie-activa border border-borde-sutil">
                            <Paperclip size={13} />
                            <div>
                              <p className="font-medium">{i === 0 ? 'comprobante_pago.pdf' : `documento_${i + 1}.pdf`}</p>
                              <p className="text-xs text-texto-terciario">245 KB</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Botones Responder / Responder a todos / Reenviar (como Gmail) */}
                  <div className="px-6 py-4 pl-[72px]">
                    <div className="flex items-center gap-2">
                      <button className="flex items-center gap-2 px-4 py-2 rounded-full border border-borde-sutil bg-superficie-tarjeta text-sm text-texto-secundario cursor-pointer hover:bg-superficie-hover transition-colors">
                        <Reply size={15} /> Responder
                      </button>
                      <button className="flex items-center gap-2 px-4 py-2 rounded-full border border-borde-sutil bg-superficie-tarjeta text-sm text-texto-secundario cursor-pointer hover:bg-superficie-hover transition-colors">
                        <ReplyAll size={15} /> Responder a todos
                      </button>
                      <button className="flex items-center gap-2 px-4 py-2 rounded-full border border-borde-sutil bg-superficie-tarjeta text-sm text-texto-secundario cursor-pointer hover:bg-superficie-hover transition-colors">
                        <Forward size={15} /> Reenviar
                      </button>
                    </div>
                  </div>
                </div>
              )
            })()}
          </div>
        </div>
      )}

      {/* ========== TAB INTERNO ========== */}
      {tabActivo === 'interno' && (
        <div className="flex flex-1 min-h-0">
          {/* Canales */}
          <div className="w-[220px] shrink-0 border-r border-borde-sutil flex flex-col bg-superficie-tarjeta">
            <div className="px-3 py-3 text-xs font-semibold text-texto-terciario uppercase tracking-wider">
              Canales
            </div>
            {['General', 'Equipo Ventas', 'Soporte', 'Anuncios'].map((canal) => (
              <button key={canal} className={`flex items-center gap-2 px-3 py-2 text-sm text-left border-none cursor-pointer transition-colors ${canal === 'Equipo Ventas' ? 'bg-superficie-seleccionada text-texto-primario font-medium' : 'bg-transparent text-texto-secundario hover:bg-superficie-hover'}`}>
                <span className="text-texto-terciario">#</span> {canal}
              </button>
            ))}
            <div className="px-3 py-3 mt-auto text-xs font-semibold text-texto-terciario uppercase tracking-wider">
              Mensajes directos
            </div>
            {['María López', 'Carlos Ruiz', 'Pedro García'].map((u) => (
              <button key={u} className="flex items-center gap-2 px-3 py-1.5 text-sm text-left border-none bg-transparent text-texto-secundario cursor-pointer hover:bg-superficie-hover">
                <Avatar nombre={u} tamano="xs" /> {u}
              </button>
            ))}
          </div>

          {/* Chat interno */}
          <div className="flex-1 flex flex-col min-w-0">
            <div className="flex items-center gap-2 px-4 py-2.5 border-b border-borde-sutil shrink-0">
              <span className="text-texto-terciario font-semibold">#</span>
              <span className="text-sm font-semibold text-texto-primario">Equipo Ventas</span>
              <span className="text-xs text-texto-terciario">· 5 miembros</span>
            </div>

            <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-4">
              {msgsInternos.filter((m) => m.canal === 'Equipo Ventas').map((m) => (
                <div key={m.id} className="flex gap-2.5">
                  <Avatar nombre={m.autor} tamano="sm" />
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-texto-primario">{m.autor}</span>
                      <span className="text-xs text-texto-terciario">{m.hora}</span>
                    </div>
                    <p className="text-sm text-texto-secundario mt-0.5 leading-relaxed">{m.contenido}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="px-4 py-2.5 border-t border-borde-sutil shrink-0">
              <div className="flex items-end gap-2 border border-borde-sutil rounded-lg px-3 py-2">
                <button className="size-7 rounded-md bg-transparent border-none text-texto-terciario cursor-pointer flex items-center justify-center"><Paperclip size={16} /></button>
                <textarea placeholder="Escribir en #Equipo Ventas..." rows={1} className="flex-1 resize-none border-none outline-none bg-transparent text-sm text-texto-primario placeholder:text-texto-terciario leading-relaxed py-0.5" />
                <button className="size-7 rounded-md bg-texto-marca text-texto-inverso border-none cursor-pointer flex items-center justify-center"><Send size={14} /></button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
