'use client'

import { useState, useCallback, useEffect, useRef, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { crearClienteNavegador } from '@/lib/supabase/cliente'
import { Tabs } from '@/componentes/ui/Tabs'
import { Boton } from '@/componentes/ui/Boton'
import {
  MessageCircle, Mail, Hash, Settings, PanelRightOpen, PanelRightClose,
  Plus, Pen,
} from 'lucide-react'
import { ListaConversaciones } from './_componentes/ListaConversaciones'
import { PanelWhatsApp, VisorMedia, type MediaVisor } from './_componentes/PanelWhatsApp'
import { PanelCorreo } from './_componentes/PanelCorreo'
import { CompositorCorreo, type DatosCorreo } from './_componentes/CompositorCorreo'
import { PanelInterno } from './_componentes/PanelInterno'
import { PanelInfoContacto } from './_componentes/PanelInfoContacto'
import type {
  TipoCanal, EstadoConversacion, ConversacionConDetalles,
  MensajeConAdjuntos, CanalInterno, CanalInbox, ModuloEmpresa,
} from '@/tipos/inbox'
import type { DatosMensaje } from './_componentes/CompositorMensaje'

/**
 * Página principal del Inbox — 3 tabs (WhatsApp, Correo, Interno).
 * Layout 3 paneles: lista conversaciones | chat | info contacto.
 * Se adapta según módulos activos de la empresa.
 */

// Tabs del inbox según módulos activos
function generarTabs(modulosActivos: Set<string>) {
  const tabs = []
  if (modulosActivos.has('inbox_whatsapp')) {
    tabs.push({ clave: 'whatsapp', etiqueta: 'WhatsApp', icono: <MessageCircle size={14} /> })
  }
  if (modulosActivos.has('inbox_correo')) {
    tabs.push({ clave: 'correo', etiqueta: 'Correo', icono: <Mail size={14} /> })
  }
  if (modulosActivos.has('inbox_interno')) {
    tabs.push({ clave: 'interno', etiqueta: 'Interno', icono: <Hash size={14} /> })
  }
  return tabs
}

export default function PaginaInbox() {
  const router = useRouter()
  const supabase = useMemo(() => crearClienteNavegador(), [])

  // Estado global del inbox
  const [tabActivo, setTabActivo] = useState<TipoCanal>('whatsapp')
  const [modulosActivos, setModulosActivos] = useState<Set<string>>(
    new Set(['inbox_whatsapp', 'inbox_correo', 'inbox_interno']) // Por defecto todos activos
  )

  // Conversaciones
  const [conversaciones, setConversaciones] = useState<ConversacionConDetalles[]>([])
  const [conversacionSeleccionada, setConversacionSeleccionada] = useState<ConversacionConDetalles | null>(null)
  const [busqueda, setBusqueda] = useState('')
  const [filtroEstado, setFiltroEstado] = useState<EstadoConversacion | 'todas'>('todas')
  const [cargandoConversaciones, setCargandoConversaciones] = useState(false)

  // Mensajes
  const [mensajes, setMensajes] = useState<MensajeConAdjuntos[]>([])
  const [cargandoMensajes, setCargandoMensajes] = useState(false)
  const [enviando, setEnviando] = useState(false)

  // Canales internos
  const [canalesPublicos, setCanalesPublicos] = useState<CanalInterno[]>([])
  const [canalesPrivados, setCanalesPrivados] = useState<CanalInterno[]>([])
  const [canalInternoSeleccionado, setCanalInternoSeleccionado] = useState<CanalInterno | null>(null)

  // Panel info contacto
  const [panelInfoAbierto, setPanelInfoAbierto] = useState(false)

  // Correo: redactar nuevo + canales disponibles
  const [redactandoNuevo, setRedactandoNuevo] = useState(false)
  const [canalesCorreo, setCanalesCorreo] = useState<CanalInbox[]>([])
  const [canalCorreoActivo, setCanalCorreoActivo] = useState<string>('')

  // Visor de media fullscreen (compartido entre PanelWhatsApp y PanelInfoContacto)
  const [visorAbierto, setVisorAbierto] = useState(false)
  const [visorIndice, setVisorIndice] = useState(0)

  // Recopilar todos los medios visuales para el visor
  const todosLosMedias = useMemo<MediaVisor[]>(() => {
    const medias: MediaVisor[] = []
    for (const msg of mensajes) {
      if (msg.tipo_contenido === 'imagen' || msg.tipo_contenido === 'video') {
        for (const adj of msg.adjuntos) {
          medias.push({
            url: adj.url,
            tipo: msg.tipo_contenido === 'video' ? 'video' : 'imagen',
            caption: msg.texto && !/^\[(Imagen|Video|Audio|Sticker|Documento|Ubicación|Contacto)/.test(msg.texto) ? msg.texto : null,
            fecha: msg.creado_en,
          })
        }
      }
    }
    return medias
  }, [mensajes])

  const abrirVisor = useCallback((url: string) => {
    const idx = todosLosMedias.findIndex(m => m.url === url)
    setVisorIndice(idx >= 0 ? idx : 0)
    setVisorAbierto(true)
  }, [todosLosMedias])

  const busquedaRef = useRef(busqueda)
  busquedaRef.current = busqueda

  // Cargar módulos activos de la empresa
  useEffect(() => {
    const cargarConfig = async () => {
      try {
        const res = await fetch('/api/inbox/config')
        const data = await res.json()
        if (data.modulos) {
          const activos = new Set<string>(
            data.modulos
              .filter((m: ModuloEmpresa) => m.activo)
              .map((m: ModuloEmpresa) => m.modulo)
          )
          if (activos.size > 0) {
            setModulosActivos(activos)
            // Seleccionar primer tab activo
            if (activos.has('inbox_whatsapp')) setTabActivo('whatsapp')
            else if (activos.has('inbox_correo')) setTabActivo('correo')
            else if (activos.has('inbox_interno')) setTabActivo('interno')
          }
        }
      } catch {
        // Si falla, mantener todos activos por defecto
      }
    }
    cargarConfig()
  }, [])

  // Cargar conversaciones cuando cambia el tab o filtros
  const cargarConversaciones = useCallback(async () => {
    setCargandoConversaciones(true)
    try {
      const params = new URLSearchParams()
      params.set('tipo_canal', tabActivo)
      if (filtroEstado !== 'todas') params.set('estado', filtroEstado)
      if (busquedaRef.current) params.set('busqueda', busquedaRef.current)

      const res = await fetch(`/api/inbox/conversaciones?${params}`)
      const data = await res.json()
      setConversaciones(data.conversaciones || [])
    } catch {
      setConversaciones([])
    } finally {
      setCargandoConversaciones(false)
    }
  }, [tabActivo, filtroEstado])

  useEffect(() => {
    cargarConversaciones()
  }, [cargarConversaciones])

  // Búsqueda con debounce
  const montadoRef = useRef(false)
  useEffect(() => {
    if (!montadoRef.current) { montadoRef.current = true; return }
    const timeout = setTimeout(() => cargarConversaciones(), 300)
    return () => clearTimeout(timeout)
  }, [busqueda, cargarConversaciones])

  // Cargar canales de correo cuando se activa el tab
  useEffect(() => {
    if (tabActivo !== 'correo') return
    const cargar = async () => {
      try {
        const res = await fetch('/api/inbox/canales?tipo=correo')
        const data = await res.json()
        const canales = data.canales || []
        setCanalesCorreo(canales)
        if (canales.length > 0 && !canalCorreoActivo) {
          setCanalCorreoActivo(canales[0].id)
        }
      } catch {
        // silenciar
      }
    }
    cargar()
  }, [tabActivo])

  // Cargar canales internos
  useEffect(() => {
    if (tabActivo !== 'interno') return
    const cargar = async () => {
      try {
        const res = await fetch('/api/inbox/internos')
        const data = await res.json()
        setCanalesPublicos(data.canales || [])
        setCanalesPrivados(data.privados || [])
      } catch {
        // silenciar
      }
    }
    cargar()
  }, [tabActivo])

  // Seleccionar conversación y cargar mensajes
  const seleccionarConversacion = useCallback(async (id: string) => {
    setRedactandoNuevo(false)
    const conv = conversaciones.find(c => c.id === id) || null
    setConversacionSeleccionada(conv)
    if (!conv) return

    setCargandoMensajes(true)
    try {
      const res = await fetch(`/api/inbox/mensajes?conversacion_id=${id}`)
      const data = await res.json()
      setMensajes(data.mensajes || [])
    } catch {
      setMensajes([])
    } finally {
      setCargandoMensajes(false)
    }
  }, [conversaciones])

  // Enviar mensaje (WhatsApp usa API de Meta, interno usa mensajes genérico)
  const enviarMensaje = useCallback(async (datos: DatosMensaje) => {
    if (!conversacionSeleccionada) return
    setEnviando(true)
    try {
      let mediaUrl: string | undefined
      let mediaFilename: string | undefined

      // Si hay archivo adjunto, subirlo a Supabase Storage primero
      if (datos.archivo) {
        const nombreArchivo = datos.archivo.name
          .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
          .replace(/[^a-zA-Z0-9._-]/g, '_')
          .slice(0, 100)
        const path = `inbox/enviados/${conversacionSeleccionada.id}/${Date.now()}_${nombreArchivo}`

        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('adjuntos')
          .upload(path, datos.archivo, {
            contentType: datos.archivo.type,
            upsert: true,
          })

        if (uploadError) {
          console.error('Error subiendo archivo:', uploadError)
          return
        }

        const { data: urlData } = supabase.storage
          .from('adjuntos')
          .getPublicUrl(uploadData.path)

        mediaUrl = urlData.publicUrl
        mediaFilename = datos.archivo.name
      }

      // WhatsApp: enviar vía API de Meta
      if (conversacionSeleccionada.tipo_canal === 'whatsapp') {
        // Mapear tipo_contenido a tipo de Meta
        const tipoMeta: Record<string, string> = {
          texto: 'text',
          imagen: 'image',
          video: 'video',
          audio: 'audio',
          documento: 'document',
        }

        const res = await fetch('/api/inbox/whatsapp/enviar', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            conversacion_id: conversacionSeleccionada.id,
            tipo: tipoMeta[datos.tipo_contenido] || 'text',
            texto: datos.texto || undefined,
            media_url: mediaUrl,
            media_caption: datos.tipo_contenido !== 'texto' && datos.tipo_contenido !== 'audio' ? datos.texto : undefined,
            media_filename: mediaFilename,
          }),
        })
        const data = await res.json()
        if (data.mensaje) {
          setMensajes(prev => [...prev, { ...data.mensaje, adjuntos: [] }])
        }
      } else {
        // Interno u otros: solo guardar en BD
        const res = await fetch('/api/inbox/mensajes', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            conversacion_id: conversacionSeleccionada.id,
            texto: datos.texto,
            tipo_contenido: datos.tipo_contenido,
          }),
        })
        const data = await res.json()
        if (data.mensaje) {
          setMensajes(prev => [...prev, { ...data.mensaje, adjuntos: [] }])
        }
      }
    } catch (err) {
      console.error('Error enviando mensaje:', err)
    } finally {
      setEnviando(false)
    }
  }, [conversacionSeleccionada, supabase])

  // Enviar correo (vía API dedicada de correo)
  const enviarCorreo = useCallback(async (datos: DatosCorreo) => {
    setEnviando(true)
    try {
      const res = await fetch('/api/inbox/correo/enviar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversacion_id: conversacionSeleccionada?.id || null,
          canal_id: canalCorreoActivo,
          ...datos,
        }),
      })
      const data = await res.json()
      if (data.mensaje) {
        // Si era correo nuevo, seleccionar la conversación creada
        if (!conversacionSeleccionada && data.conversacion_id) {
          setRedactandoNuevo(false)
          cargarConversaciones()
        } else {
          setMensajes(prev => [...prev, { ...data.mensaje, adjuntos: [] }])
        }
      }
    } catch {
      // TODO: toast de error
    } finally {
      setEnviando(false)
    }
  }, [conversacionSeleccionada, canalCorreoActivo, cargarConversaciones])

  // Marcar conversación como spam
  const marcarSpam = useCallback(async (conversacionId: string) => {
    try {
      await fetch(`/api/inbox/conversaciones/${conversacionId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ estado: 'spam' }),
      })
      // Remover de la lista si no estamos filtrando por spam
      setConversaciones(prev => prev.filter(c => c.id !== conversacionId))
      if (conversacionSeleccionada?.id === conversacionId) {
        setConversacionSeleccionada(null)
        setMensajes([])
      }
    } catch {
      // TODO: toast de error
    }
  }, [conversacionSeleccionada])

  // Desmarcar spam (devolver a abierta)
  const desmarcarSpam = useCallback(async (conversacionId: string) => {
    try {
      await fetch(`/api/inbox/conversaciones/${conversacionId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ estado: 'abierta' }),
      })
      // Si estamos en filtro spam, remover de la lista
      if (filtroEstado === 'spam') {
        setConversaciones(prev => prev.filter(c => c.id !== conversacionId))
      } else {
        setConversaciones(prev => prev.map(c =>
          c.id === conversacionId ? { ...c, estado: 'abierta' as const } : c
        ))
      }
      if (conversacionSeleccionada?.id === conversacionId) {
        setConversacionSeleccionada(prev => prev ? { ...prev, estado: 'abierta' } : prev)
      }
    } catch {
      // TODO: toast de error
    }
  }, [conversacionSeleccionada, filtroEstado])

  // Marcar leído/no leído
  const toggleLeido = useCallback(async (conversacionId: string, sinLeer: number) => {
    const nuevoValor = sinLeer > 0 ? 0 : 1
    try {
      await fetch(`/api/inbox/conversaciones/${conversacionId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mensajes_sin_leer: nuevoValor }),
      })
      setConversaciones(prev => prev.map(c =>
        c.id === conversacionId ? { ...c, mensajes_sin_leer: nuevoValor } : c
      ))
      if (conversacionSeleccionada?.id === conversacionId) {
        setConversacionSeleccionada(prev => prev ? { ...prev, mensajes_sin_leer: nuevoValor } : prev)
      }
    } catch {
      // TODO: toast de error
    }
  }, [conversacionSeleccionada])

  // Archivar conversación (marcar como resuelta)
  const archivarConversacion = useCallback(async (conversacionId: string) => {
    try {
      await fetch(`/api/inbox/conversaciones/${conversacionId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ estado: 'resuelta' }),
      })
      setConversaciones(prev => prev.filter(c => c.id !== conversacionId))
      if (conversacionSeleccionada?.id === conversacionId) {
        setConversacionSeleccionada(null)
        setMensajes([])
      }
    } catch {
      // TODO: toast de error
    }
  }, [conversacionSeleccionada])

  // ─── Supabase Realtime: mensajes nuevos en la conversación activa ───
  const conversacionIdRef = useRef<string | null>(null)
  conversacionIdRef.current = conversacionSeleccionada?.id || null

  // ─── Polling de mensajes: chequear nuevos cada 3 segundos ───
  // Realtime con RLS + service role inserts no siempre entrega eventos,
  // así que usamos polling como mecanismo principal y confiable.
  const ultimoMensajeRef = useRef<string | null>(null)

  useEffect(() => {
    const convId = conversacionSeleccionada?.id
    if (!convId) return

    const poll = async () => {
      try {
        const res = await fetch(`/api/inbox/mensajes?conversacion_id=${convId}`)
        const data = await res.json()
        if (data.mensajes && conversacionIdRef.current === convId) {
          const nuevos = data.mensajes as MensajeConAdjuntos[]
          const ultimoNuevo = nuevos[nuevos.length - 1]?.id
          // Solo actualizar si hay cambios
          if (ultimoNuevo !== ultimoMensajeRef.current || nuevos.some(
            (m, i) => m.adjuntos.length !== (mensajes[i]?.adjuntos?.length ?? -1)
          )) {
            ultimoMensajeRef.current = ultimoNuevo
            setMensajes(nuevos)
          }

          // Si hay mensajes de media sin adjuntos, pedir reintento de descarga
          const mediaSinAdjunto = nuevos.some(
            m => ['imagen', 'audio', 'video', 'documento', 'sticker'].includes(m.tipo_contenido)
              && m.adjuntos.length === 0
          )
          if (mediaSinAdjunto) {
            fetch('/api/inbox/whatsapp/media-pendiente', { method: 'POST' }).catch(() => {})
          }
        }
      } catch { /* silenciar */ }
    }

    // Polling cada 3 segundos
    const intervalo = setInterval(poll, 3000)

    return () => clearInterval(intervalo)
  }, [conversacionSeleccionada?.id])

  // ─── Polling de lista de conversaciones: cada 5 segundos ───
  useEffect(() => {
    const poll = async () => {
      try {
        const params = new URLSearchParams()
        params.set('tipo_canal', tabActivo)
        if (filtroEstado !== 'todas') params.set('estado', filtroEstado)
        if (busquedaRef.current) params.set('busqueda', busquedaRef.current)

        const res = await fetch(`/api/inbox/conversaciones?${params}`)
        const data = await res.json()
        if (data.conversaciones) {
          setConversaciones(data.conversaciones)
          // Actualizar la conversación seleccionada si cambió
          if (conversacionSeleccionada) {
            const actualizada = data.conversaciones.find(
              (c: ConversacionConDetalles) => c.id === conversacionSeleccionada.id
            )
            if (actualizada) {
              setConversacionSeleccionada(actualizada)
            }
          }
        }
      } catch { /* silenciar */ }
    }

    const intervalo = setInterval(poll, 5000)
    return () => clearInterval(intervalo)
  }, [tabActivo, filtroEstado, conversacionSeleccionada?.id])

  // Extraer firma del canal de correo activo
  const firmaCorreo = useMemo(() => {
    const canal = canalesCorreo.find(c => c.id === canalCorreoActivo)
    if (!canal) return undefined
    const config = canal.config_conexion as Record<string, unknown>
    return (config?.firma as string) || undefined
  }, [canalesCorreo, canalCorreoActivo])

  // Extraer email del canal activo
  const emailCanalActivo = useMemo(() => {
    const canal = canalesCorreo.find(c => c.id === canalCorreoActivo)
    if (!canal) return ''
    const config = canal.config_conexion as { email?: string; usuario?: string }
    return config?.email || config?.usuario || ''
  }, [canalesCorreo, canalCorreoActivo])

  const tabs = generarTabs(modulosActivos)
  const totalNoLeidos = conversaciones.reduce((sum, c) => sum + c.mensajes_sin_leer, 0)

  // Si no hay módulos activos
  if (tabs.length === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center max-w-sm">
          <div
            className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4"
            style={{ background: 'var(--superficie-hover)' }}
          >
            <Mail size={32} style={{ color: 'var(--texto-terciario)' }} />
          </div>
          <h2 className="text-base font-semibold mb-2" style={{ color: 'var(--texto-primario)' }}>
            Inbox no activado
          </h2>
          <p className="text-sm mb-4" style={{ color: 'var(--texto-secundario)' }}>
            Activá los módulos de WhatsApp, Correo o Mensajería interna desde la configuración de tu empresa.
          </p>
          <Boton
            variante="primario"
            icono={<Settings size={14} />}
            onClick={() => router.push('/configuracion')}
          >
            Ir a configuración
          </Boton>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-[calc(100vh-var(--header-alto))]">
      {/* Barra superior: tabs + acciones */}
      <div
        className="flex items-center justify-between px-4 py-1.5 flex-shrink-0"
        style={{
          borderBottom: '1px solid var(--borde-sutil)',
          background: 'var(--superficie-tarjeta)',
        }}
      >
        <Tabs
          tabs={tabs.map(t => ({
            clave: t.clave,
            etiqueta: t.etiqueta,
            icono: t.icono,
          }))}
          activo={tabActivo}
          onChange={(clave) => {
            setTabActivo(clave as TipoCanal)
            setConversacionSeleccionada(null)
            setMensajes([])
          }}
        />

        <div className="flex items-center gap-1">
          {/* Botón redactar correo nuevo */}
          {tabActivo === 'correo' && canalesCorreo.length > 0 && (
            <Boton
              variante="primario"
              tamano="xs"
              icono={<Pen size={14} />}
              onClick={() => {
                setConversacionSeleccionada(null)
                setMensajes([])
                setRedactandoNuevo(true)
              }}
            >
              Redactar
            </Boton>
          )}
          {/* Toggle panel info */}
          <Boton
            variante="fantasma"
            tamano="xs"
            soloIcono
            icono={panelInfoAbierto ? <PanelRightClose size={16} /> : <PanelRightOpen size={16} />}
            onClick={() => setPanelInfoAbierto(!panelInfoAbierto)}
          />
          {/* Configuración */}
          <Boton
            variante="fantasma"
            tamano="xs"
            soloIcono
            icono={<Settings size={16} />}
            onClick={() => router.push('/inbox/configuracion')}
          />
        </div>
      </div>

      {/* Contenido principal: 3 paneles */}
      <div className="flex flex-1 min-h-0">
        {/* Panel izquierdo: lista de conversaciones (no en tab interno) */}
        {tabActivo !== 'interno' && (
          <div className="w-80 flex-shrink-0">
            <ListaConversaciones
              conversaciones={conversaciones}
              seleccionada={conversacionSeleccionada?.id || null}
              onSeleccionar={seleccionarConversacion}
              busqueda={busqueda}
              onBusqueda={setBusqueda}
              filtroEstado={filtroEstado}
              onFiltroEstado={setFiltroEstado}
              tipoCanal={tabActivo}
              cargando={cargandoConversaciones}
              totalNoLeidos={totalNoLeidos}
            />
          </div>
        )}

        {/* Panel central: chat/correo/interno */}
        {tabActivo === 'whatsapp' && (
          <PanelWhatsApp
            conversacion={conversacionSeleccionada}
            mensajes={mensajes}
            onEnviar={enviarMensaje}
            onAbrirVisor={abrirVisor}
            cargando={cargandoMensajes}
            enviando={enviando}
          />
        )}

        {tabActivo === 'correo' && (
          redactandoNuevo ? (
            <div className="flex-1 flex flex-col p-4" style={{ background: 'var(--superficie-app)' }}>
              <CompositorCorreo
                tipo="nuevo"
                canalesCorreo={canalesCorreo.map(c => ({
                  id: c.id,
                  nombre: c.nombre,
                  email: (c.config_conexion as { email?: string; usuario?: string })?.email
                    || (c.config_conexion as { email?: string; usuario?: string })?.usuario
                    || c.nombre,
                }))}
                canalSeleccionado={canalCorreoActivo}
                onCambiarCanal={setCanalCorreoActivo}
                onEnviar={enviarCorreo}
                onCancelar={() => setRedactandoNuevo(false)}
                cargando={enviando}
                firma={firmaCorreo}
              />
            </div>
          ) : (
            <PanelCorreo
              conversacion={conversacionSeleccionada}
              mensajes={mensajes}
              onEnviarCorreo={enviarCorreo}
              onMarcarSpam={marcarSpam}
              onDesmarcarSpam={desmarcarSpam}
              onArchivar={archivarConversacion}
              onToggleLeido={toggleLeido}
              cargando={cargandoMensajes}
              enviando={enviando}
              emailCanal={emailCanalActivo}
              firma={firmaCorreo}
            />
          )
        )}

        {tabActivo === 'interno' && (
          <PanelInterno
            conversacion={conversacionSeleccionada}
            mensajes={mensajes}
            canalesPublicos={canalesPublicos}
            canalesPrivados={canalesPrivados}
            canalSeleccionado={canalInternoSeleccionado}
            onSeleccionarCanal={setCanalInternoSeleccionado}
            onCrearCanal={() => {}} // TODO: modal crear canal
            onEnviar={enviarMensaje}
            cargando={cargandoMensajes}
            enviando={enviando}
          />
        )}

        {/* Panel derecho: info contacto + galería de medios (colapsable) */}
        {tabActivo !== 'interno' && (
          <PanelInfoContacto
            conversacion={conversacionSeleccionada}
            mensajes={mensajes}
            abierto={panelInfoAbierto}
            onCerrar={() => setPanelInfoAbierto(false)}
            onAbrirVisor={abrirVisor}
          />
        )}
      </div>

      {/* Visor de media fullscreen (compartido) */}
      <VisorMedia
        medias={todosLosMedias}
        indice={visorIndice}
        abierto={visorAbierto}
        onCerrar={() => setVisorAbierto(false)}
        onCambiarIndice={setVisorIndice}
      />
    </div>
  )
}
