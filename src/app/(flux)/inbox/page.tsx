'use client'

import { useState, useCallback, useEffect, useRef, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { crearClienteNavegador } from '@/lib/supabase/cliente'
import { useToast } from '@/componentes/feedback/Toast'
import { Tabs } from '@/componentes/ui/Tabs'
import { Boton } from '@/componentes/ui/Boton'
import {
  Mail, Hash, Settings, PanelRightOpen, PanelRightClose,
  PanelLeftOpen, PanelLeftClose,
  Plus, Pen, Columns2, Rows2, ArrowLeft, RefreshCw,
} from 'lucide-react'
import { IconoWhatsApp } from '@/componentes/iconos/IconoWhatsApp'
import { ErrorBoundary } from '@/componentes/feedback/ErrorBoundary'
import { ListaConversaciones } from './_componentes/ListaConversaciones'
import { PanelWhatsApp, VisorMedia, type MediaVisor } from './_componentes/PanelWhatsApp'
import { PanelCorreo } from './_componentes/PanelCorreo'
import { CompositorCorreo, type DatosCorreo } from './_componentes/CompositorCorreo'
import { SidebarCorreo, type CarpetaCorreo } from './_componentes/SidebarCorreo'
import { PanelInterno } from './_componentes/PanelInterno'
import { ModalCrearCanalInterno } from './_componentes/ModalCrearCanalInterno'
import { PanelInfoContacto } from './_componentes/PanelInfoContacto'
import type {
  TipoCanal, EstadoConversacion, ConversacionConDetalles,
  MensajeConAdjuntos, CanalInterno, CanalInbox, ModuloEmpresa,
} from '@/tipos/inbox'
import { useTraduccion } from '@/lib/i18n'
import type { DatosMensaje } from './_componentes/CompositorMensaje'

/**
 * Página principal del Inbox — 3 tabs (WhatsApp, Correo, Interno).
 * Layout 3 paneles: lista conversaciones | chat | info contacto.
 * Se adapta según módulos activos de la empresa.
 */

// Tabs del inbox según módulos activos
function generarTabs(modulosActivos: Set<string>, t: (clave: string) => string) {
  const tabs = []
  if (modulosActivos.has('inbox_whatsapp')) {
    tabs.push({ clave: 'whatsapp', etiqueta: t('inbox.canales.whatsapp'), icono: <IconoWhatsApp size={14} /> })
  }
  if (modulosActivos.has('inbox_correo')) {
    tabs.push({ clave: 'correo', etiqueta: t('inbox.canales.correo'), icono: <Mail size={14} /> })
  }
  if (modulosActivos.has('inbox_interno')) {
    tabs.push({ clave: 'interno', etiqueta: t('inbox.canales.interno'), icono: <Hash size={14} /> })
  }
  return tabs
}

export default function PaginaInbox() {
  const { t } = useTraduccion()
  const router = useRouter()
  const { mostrar } = useToast()
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
  const [filtroEtiqueta, setFiltroEtiqueta] = useState('')
  const [soloNoLeidos, setSoloNoLeidos] = useState(false)
  const [cargandoConversaciones, setCargandoConversaciones] = useState(false)

  // Mensajes
  const [mensajes, setMensajes] = useState<MensajeConAdjuntos[]>([])
  const [cargandoMensajes, setCargandoMensajes] = useState(false)
  const [enviando, setEnviando] = useState(false)
  const [hayMasAnteriores, setHayMasAnteriores] = useState(false)
  const [cargandoAnteriores, setCargandoAnteriores] = useState(false)
  const paginaMensajesRef = useRef(1)

  // Canales internos
  const [canalesPublicos, setCanalesPublicos] = useState<CanalInterno[]>([])
  const [canalesPrivados, setCanalesPrivados] = useState<CanalInterno[]>([])
  const [canalesGrupos, setCanalesGrupos] = useState<CanalInterno[]>([])
  const [canalInternoSeleccionado, setCanalInternoSeleccionado] = useState<CanalInterno | null>(null)
  const [modalCrearInterno, setModalCrearInterno] = useState(false)
  const [usuarioId, setUsuarioId] = useState<string>('')

  // Panel info contacto
  const [panelInfoAbierto, setPanelInfoAbierto] = useState(false)

  // IA habilitada para el inbox
  const [iaHabilitada, setIaHabilitada] = useState(false)

  // Correo: redactar nuevo + canales disponibles + carpeta
  const [redactandoNuevo, setRedactandoNuevo] = useState(false)
  const [canalesCorreo, setCanalesCorreo] = useState<CanalInbox[]>([])
  const [canalCorreoActivo, setCanalCorreoActivo] = useState<string>('')
  const [carpetaCorreo, setCarpetaCorreo] = useState<CarpetaCorreo>('entrada')
  const [canalTodas, setCanalTodas] = useState(false)
  const [contadoresCorreo, setContadoresCorreo] = useState<Record<string, { entrada: number; spam: number }>>({})
  const [sincronizando, setSincronizando] = useState(false)

  // Modo de vista: 'columna' (3 paneles) o 'fila' (lista se reemplaza por correo al seleccionar)
  type ModoVista = 'columna' | 'fila'
  const [modoVista, setModoVista] = useState<ModoVista>(() => {
    if (typeof window === 'undefined') return 'columna'
    return (localStorage.getItem('flux_inbox_modo_vista') as ModoVista) || 'columna'
  })

  const cambiarModoVista = useCallback((modo: ModoVista) => {
    setModoVista(modo)
    localStorage.setItem('flux_inbox_modo_vista', modo)
  }, [])

  // Layout colapsable del correo (persistido en localStorage)
  const [sidebarCorreoColapsado, setSidebarCorreoColapsado] = useState(() => {
    if (typeof window === 'undefined') return false
    return localStorage.getItem('flux_inbox_sidebar_colapsado') === 'true'
  })
  const [listaCorreoColapsada, setListaCorreoColapsada] = useState(() => {
    if (typeof window === 'undefined') return false
    return localStorage.getItem('flux_inbox_lista_colapsada') === 'true'
  })

  const toggleSidebarCorreo = useCallback(() => {
    setSidebarCorreoColapsado(prev => {
      const nuevo = !prev
      localStorage.setItem('flux_inbox_sidebar_colapsado', String(nuevo))
      return nuevo
    })
  }, [])

  const toggleListaCorreo = useCallback(() => {
    setListaCorreoColapsada(prev => {
      const nuevo = !prev
      localStorage.setItem('flux_inbox_lista_colapsada', String(nuevo))
      return nuevo
    })
  }, [])

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
        // Config IA del inbox
        if (data.config?.ia_habilitada !== undefined) {
          setIaHabilitada(data.config.ia_habilitada)
        }

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

  // Helper: construir params de filtro para conversaciones (DRY — usado en carga y polling)
  const construirParamsConversaciones = useCallback(() => {
    const params = new URLSearchParams()
    params.set('tipo_canal', tabActivo)

    if (tabActivo === 'correo') {
      if (!canalTodas && canalCorreoActivo) {
        params.set('canal_id', canalCorreoActivo)
      }
      switch (carpetaCorreo) {
        case 'entrada': params.set('estado', 'abierta'); break
        case 'enviados': params.set('enviados', 'true'); break
        case 'spam': params.set('estado', 'spam'); break
        case 'archivado': params.set('estado', 'resuelta'); break
      }
    } else {
      if (filtroEstado !== 'todas') params.set('estado', filtroEstado)
    }

    if (busquedaRef.current) params.set('busqueda', busquedaRef.current)
    if (filtroEtiqueta) params.set('etiqueta', filtroEtiqueta)
    if (soloNoLeidos) params.set('no_leidos', 'true')
    return params
  }, [tabActivo, filtroEstado, filtroEtiqueta, soloNoLeidos, carpetaCorreo, canalCorreoActivo, canalTodas])

  // Cargar conversaciones cuando cambia el tab, filtros o carpeta de correo
  const cargarConversaciones = useCallback(async () => {
    setCargandoConversaciones(true)
    try {
      const params = construirParamsConversaciones()

      const res = await fetch(`/api/inbox/conversaciones?${params}`)
      const data = await res.json()
      setConversaciones(data.conversaciones || [])
    } catch {
      setConversaciones([])
    } finally {
      setCargandoConversaciones(false)
    }
  }, [construirParamsConversaciones])

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
        const canales = (data.canales || []) as CanalInbox[]
        setCanalesCorreo(canales)
        // Validar que el canal activo siga existiendo; si no, seleccionar el primero
        const idsCanales = new Set(canales.map(c => c.id))
        if (canales.length > 0 && (!canalCorreoActivo || !idsCanales.has(canalCorreoActivo))) {
          setCanalCorreoActivo(canales[0].id)
        }
        if (canales.length <= 1) {
          setCanalTodas(false)
        }
      } catch {
        // silenciar
      }
    }
    cargar()
  }, [tabActivo])

  // Cargar contadores de no leídos (endpoint dedicado, eficiente)
  const cargarContadores = useCallback(async () => {
    try {
      const res = await fetch('/api/inbox/correo/contadores')
      const data = await res.json()
      setContadoresCorreo(data.contadores || {})
    } catch { /* silenciar */ }
  }, [])

  useEffect(() => {
    if (tabActivo !== 'correo') return
    cargarContadores()
    // Refrescar contadores cada 30 segundos
    const intervalo = setInterval(cargarContadores, 30000)
    return () => clearInterval(intervalo)
  }, [tabActivo, cargarContadores])

  // Sincronizar correos manualmente (llama al endpoint que trae correos nuevos de Gmail/IMAP)
  const sincronizandoRef = useRef(false)
  const sincronizarCorreos = useCallback(async () => {
    if (sincronizandoRef.current) return
    sincronizandoRef.current = true
    setSincronizando(true)
    try {
      const res = await fetch('/api/inbox/correo/sincronizar', { method: 'POST' })
      const data = await res.json()
      // Refrescar lista y contadores después de sincronizar
      await Promise.all([cargarConversaciones(), cargarContadores()])
      return data
    } catch {
      // silenciar
    } finally {
      sincronizandoRef.current = false
      setSincronizando(false)
    }
  }, [cargarConversaciones, cargarContadores])

  // Auto-sincronizar correos cada 30 segundos
  useEffect(() => {
    if (tabActivo !== 'correo') return
    const intervalo = setInterval(sincronizarCorreos, 30000)
    return () => clearInterval(intervalo)
  }, [tabActivo, sincronizarCorreos])

  // Obtener userId del usuario autenticado
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) setUsuarioId(data.user.id)
    })
  }, [supabase])

  // Cargar canales internos
  const cargarCanalesInternos = useCallback(async () => {
    try {
      const res = await fetch('/api/inbox/internos')
      const data = await res.json()
      setCanalesPublicos(data.canales || [])
      setCanalesGrupos(data.grupos || [])
      setCanalesPrivados(data.privados || [])
    } catch {
      // silenciar
    }
  }, [])

  useEffect(() => {
    if (tabActivo !== 'interno') return
    cargarCanalesInternos()
  }, [tabActivo, cargarCanalesInternos])

  // Cuando se selecciona un canal interno, buscar/crear conversación y cargar mensajes
  useEffect(() => {
    if (tabActivo !== 'interno' || !canalInternoSeleccionado) return

    const cargar = async () => {
      setCargandoMensajes(true)
      paginaMensajesRef.current = 1
      try {
        // Asegurar que existe una conversación para este canal interno
        const res = await fetch(`/api/inbox/internos/${canalInternoSeleccionado.id}/conversacion`, {
          method: 'POST',
        })
        const data = await res.json()
        if (data.conversacion) {
          setConversacionSeleccionada(data.conversacion)
          // Cargar mensajes de esa conversación
          const resMsgs = await fetch(`/api/inbox/mensajes?conversacion_id=${data.conversacion.id}&por_pagina=200`)
          const dataMsgs = await resMsgs.json()
          const msgs = dataMsgs.mensajes || []
          setMensajes(msgs)
          setHayMasAnteriores((dataMsgs.total || 0) > msgs.length)
        }
      } catch {
        setMensajes([])
      } finally {
        setCargandoMensajes(false)
      }
    }
    cargar()
  }, [tabActivo, canalInternoSeleccionado?.id])

  // Seleccionar conversación y cargar mensajes
  const seleccionarConversacion = useCallback(async (id: string) => {
    setRedactandoNuevo(false)
    const conv = conversaciones.find(c => c.id === id) || null
    setConversacionSeleccionada(conv)
    if (!conv) return

    setCargandoMensajes(true)
    paginaMensajesRef.current = 1
    try {
      const POR_PAGINA = 200
      const res = await fetch(`/api/inbox/mensajes?conversacion_id=${id}&por_pagina=${POR_PAGINA}`)
      const data = await res.json()
      const msgs = data.mensajes || []
      setMensajes(msgs)
      setHayMasAnteriores((data.total || 0) > msgs.length)
    } catch {
      setMensajes([])
      setHayMasAnteriores(false)
    } finally {
      setCargandoMensajes(false)
    }
  }, [conversaciones])

  // Cargar mensajes anteriores (scroll infinito)
  const cargarMensajesAnteriores = useCallback(async () => {
    const convId = conversacionSeleccionada?.id
    if (!convId || cargandoAnteriores || !hayMasAnteriores) return

    setCargandoAnteriores(true)
    try {
      const POR_PAGINA = 200
      const pagina = paginaMensajesRef.current + 1
      const res = await fetch(`/api/inbox/mensajes?conversacion_id=${convId}&por_pagina=${POR_PAGINA}&pagina=${pagina}`)
      const data = await res.json()
      if (conversacionIdRef.current !== convId) return

      const anteriores = (data.mensajes || []) as MensajeConAdjuntos[]
      if (anteriores.length > 0) {
        paginaMensajesRef.current = pagina
        setMensajes(prev => {
          const idsExistentes = new Set(prev.map(m => m.id))
          const nuevos = anteriores.filter(m => !idsExistentes.has(m.id))
          return [...nuevos, ...prev]
        })
      }
      setHayMasAnteriores(anteriores.length >= POR_PAGINA)
    } catch {
      // silenciar
    } finally {
      setCargandoAnteriores(false)
    }
  }, [conversacionSeleccionada?.id, cargandoAnteriores, hayMasAnteriores])

  // Enviar mensaje con optimistic update (se muestra inmediato, si falla se marca error)
  const enviarMensaje = useCallback(async (datos: DatosMensaje) => {
    if (!conversacionSeleccionada) return
    setEnviando(true)

    // ─── Optimistic update: mostrar el mensaje INMEDIATAMENTE ───
    const tempId = `temp-${Date.now()}`
    const mensajeOptimista: MensajeConAdjuntos = {
      id: tempId,
      empresa_id: '',
      conversacion_id: conversacionSeleccionada.id,
      es_entrante: false,
      remitente_tipo: 'agente',
      remitente_id: null,
      remitente_nombre: null,
      tipo_contenido: datos.tipo_contenido,
      texto: datos.texto || null,
      html: null,
      es_nota_interna: datos.es_nota_interna || false,
      correo_de: null, correo_para: null, correo_cc: null, correo_cco: null,
      correo_asunto: null, correo_message_id: null, correo_in_reply_to: null, correo_references: null,
      wa_message_id: null,
      wa_status: 'sending' as string,
      wa_tipo_mensaje: null,
      respuesta_a_id: null, hilo_raiz_id: null, cantidad_respuestas: 0,
      reacciones: {},
      metadata: {},
      estado: 'enviado' as const,
      error_envio: null,
      plantilla_id: null,
      creado_en: new Date().toISOString(),
      editado_en: null, eliminado_en: null,
      adjuntos: datos.archivo ? [{
        id: `temp-adj-${Date.now()}`,
        mensaje_id: tempId,
        empresa_id: '',
        nombre_archivo: datos.archivo.name,
        tipo_mime: datos.archivo.type,
        tamano_bytes: datos.archivo.size,
        url: URL.createObjectURL(datos.archivo),
        storage_path: '',
        miniatura_url: null,
        duracion_segundos: null,
        es_sticker: false,
        es_animado: false,
        creado_en: new Date().toISOString(),
      }] : [],
    }

    // Mostrar inmediatamente en la UI
    setMensajes(prev => [...prev, mensajeOptimista])

    // ─── Enviar en background ───
    try {
      let mediaUrl: string | undefined
      let mediaFilename: string | undefined

      // Subir archivo a Storage si hay
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
          // Marcar como fallido
          setMensajes(prev => prev.map(m =>
            m.id === tempId ? { ...m, wa_status: 'failed', estado: 'fallido' as const } : m
          ))
          return
        }

        const { data: urlData } = supabase.storage
          .from('adjuntos')
          .getPublicUrl(uploadData.path)

        mediaUrl = urlData.publicUrl
        mediaFilename = datos.archivo.name
      }

      // Notas internas: no se envían al cliente, van directo a BD
      if (datos.es_nota_interna) {
        const res = await fetch('/api/inbox/mensajes', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            conversacion_id: conversacionSeleccionada.id,
            texto: datos.texto,
            tipo_contenido: 'texto',
            es_nota_interna: true,
          }),
        })
        const data = await res.json()
        if (data.mensaje) {
          setMensajes(prev => prev.map(m =>
            m.id === tempId ? { ...data.mensaje, adjuntos: [] } : m
          ))
        }
        return
      }

      if (conversacionSeleccionada.tipo_canal === 'whatsapp') {
        const tipoMeta: Record<string, string> = {
          texto: 'text', imagen: 'image', video: 'video',
          audio: 'audio', documento: 'document',
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

        if (!res.ok) {
          setMensajes(prev => prev.map(m =>
            m.id === tempId ? { ...m, wa_status: 'failed', estado: 'fallido' as const } : m
          ))
          return
        }

        const data = await res.json()
        if (data.mensaje) {
          // Reemplazar el mensaje temporal por el real del servidor
          setMensajes(prev => prev.map(m =>
            m.id === tempId ? {
              ...data.mensaje,
              adjuntos: data.mensaje.adjuntos?.length > 0 ? data.mensaje.adjuntos : mensajeOptimista.adjuntos,
            } : m
          ))
        }
      } else {
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
          setMensajes(prev => prev.map(m =>
            m.id === tempId ? { ...data.mensaje, adjuntos: [] } : m
          ))
        }
      }
    } catch {
      // Marcar como fallido en la UI
      setMensajes(prev => prev.map(m =>
        m.id === tempId ? { ...m, wa_status: 'failed', estado: 'fallido' as const } : m
      ))
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
        mostrar('exito', 'Correo enviado')
      }
    } catch {
      mostrar('error', 'Error al enviar el correo')
    } finally {
      setEnviando(false)
    }
  }, [conversacionSeleccionada, canalCorreoActivo, cargarConversaciones, mostrar])

  // Programar envío de correo
  const programarCorreo = useCallback(async (datos: DatosCorreo, enviarEn: string) => {
    try {
      await fetch('/api/inbox/correo/programar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          canal_id: canalCorreoActivo,
          conversacion_id: conversacionSeleccionada?.id || null,
          ...datos,
          enviar_en: enviarEn,
        }),
      })
      setRedactandoNuevo(false)
      mostrar('exito', 'Correo programado correctamente')
    } catch {
      mostrar('error', 'Error al programar el correo')
    }
  }, [canalCorreoActivo, conversacionSeleccionada, mostrar])

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
      mostrar('info', 'Marcado como spam')
    } catch {
      mostrar('error', 'Error al marcar como spam')
    }
  }, [conversacionSeleccionada, mostrar])

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
      mostrar('exito', 'Restaurado de spam')
    } catch {
      mostrar('error', 'Error al restaurar de spam')
    }
  }, [conversacionSeleccionada, filtroEstado, mostrar])

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
      mostrar('error', 'Error al cambiar estado de lectura')
    }
  }, [conversacionSeleccionada, mostrar])

  // Eliminar múltiples conversaciones (selección masiva)
  const eliminarMultiples = useCallback(async (ids: string[]) => {
    let errores = 0
    for (const id of ids) {
      try {
        if (tabActivo === 'correo') {
          await fetch('/api/inbox/correo/eliminar', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ conversacion_id: id }),
          })
        } else {
          await fetch(`/api/inbox/conversaciones/${id}`, { method: 'DELETE' })
        }
      } catch { errores++ }
    }
    setConversaciones(prev => prev.filter(c => !ids.includes(c.id)))
    if (conversacionSeleccionada && ids.includes(conversacionSeleccionada.id)) {
      setConversacionSeleccionada(null)
      setMensajes([])
    }
    cargarContadores()
    if (errores > 0) {
      mostrar('advertencia', `${ids.length - errores} de ${ids.length} eliminadas (${errores} fallaron)`)
    } else {
      mostrar('exito', `${ids.length} conversación${ids.length > 1 ? 'es' : ''} eliminada${ids.length > 1 ? 's' : ''}`)
    }
  }, [conversacionSeleccionada, cargarContadores, tabActivo, mostrar])

  // Eliminar conversación (de Flux + servidor IMAP/Gmail)
  const eliminarConversacion = useCallback(async (conversacionId: string) => {
    try {
      await fetch('/api/inbox/correo/eliminar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conversacion_id: conversacionId }),
      })
      setConversaciones(prev => prev.filter(c => c.id !== conversacionId))
      if (conversacionSeleccionada?.id === conversacionId) {
        setConversacionSeleccionada(null)
        setMensajes([])
      }
      mostrar('exito', 'Conversación eliminada')
    } catch {
      mostrar('error', 'Error al eliminar la conversación')
    }
  }, [conversacionSeleccionada, mostrar])

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
      mostrar('exito', 'Conversación archivada')
    } catch {
      mostrar('error', 'Error al archivar')
    }
  }, [conversacionSeleccionada, mostrar])

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

    let cancelado = false
    const abortController = new AbortController()

    const poll = async () => {
      try {
        const res = await fetch(
          `/api/inbox/mensajes?conversacion_id=${convId}&por_pagina=200`,
          { signal: abortController.signal }
        )
        const data = await res.json()
        // Verificar que la conversación no cambió mientras esperábamos la respuesta
        if (cancelado || conversacionIdRef.current !== convId) return
        if (data.mensajes) {
          const nuevos = data.mensajes as MensajeConAdjuntos[]
          // Mergear: mensajes del server + temporales (optimistic) que aún no llegaron
          setMensajes(prev => {
            const idsServer = new Set(nuevos.map(m => m.id))
            // Mantener mensajes temporales que el server aún no conoce
            const temporales = prev.filter(m => m.id.startsWith('temp-') && !idsServer.has(m.id))
            const merged = [...nuevos, ...temporales]
            // Solo actualizar si hay cambios reales
            if (merged.length === prev.length && merged.every((m, i) =>
              m.id === prev[i]?.id && m.adjuntos.length === prev[i]?.adjuntos?.length
            )) return prev
            ultimoMensajeRef.current = nuevos[nuevos.length - 1]?.id
            return merged
          })

          // Si hay mensajes de media sin adjuntos, pedir reintento de descarga
          const mediaSinAdjunto = nuevos.some(
            m => ['imagen', 'audio', 'video', 'documento', 'sticker'].includes(m.tipo_contenido)
              && m.adjuntos.length === 0
          )
          if (mediaSinAdjunto) {
            fetch('/api/inbox/whatsapp/media-pendiente', { method: 'POST' }).catch(() => {})
          }
        }
      } catch {
        // Ignorar errores de abort y otros
      }
    }

    // Polling cada 3 segundos
    const intervalo = setInterval(poll, 3000)

    return () => {
      cancelado = true
      abortController.abort()
      clearInterval(intervalo)
    }
  }, [conversacionSeleccionada?.id])

  // ─── Polling de lista de conversaciones: cada 10 segundos ───
  // Usa los MISMOS filtros que cargarConversaciones para no pisar datos.
  // Solo hace polling si la pestaña está visible (ahorra batería y ancho de banda).
  useEffect(() => {
    let cancelado = false
    const abortController = new AbortController()

    const poll = async () => {
      // No hacer polling si la pestaña está oculta
      if (document.hidden || cancelado) return
      try {
        const params = construirParamsConversaciones()
        const res = await fetch(`/api/inbox/conversaciones?${params}`, { signal: abortController.signal })
        const data = await res.json()
        if (cancelado) return
        if (data.conversaciones) {
          setConversaciones(data.conversaciones)
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

    const intervalo = setInterval(poll, 10000)
    return () => {
      cancelado = true
      abortController.abort()
      clearInterval(intervalo)
    }
  }, [construirParamsConversaciones, conversacionSeleccionada?.id])

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

  const tabs = generarTabs(modulosActivos, t)
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
            setSoloNoLeidos(false)
            paginaMensajesRef.current = 1
            setHayMasAnteriores(false)
            setCargandoAnteriores(false)
          }}
        />

        <div className="flex items-center gap-1">
          {/* Toggle panel info (solo WhatsApp tiene panel lateral de info) */}
          {tabActivo === 'whatsapp' && (
            <Boton
              variante="fantasma"
              tamano="xs"
              soloIcono
              icono={panelInfoAbierto ? <PanelRightClose size={16} /> : <PanelRightOpen size={16} />}
              onClick={() => setPanelInfoAbierto(!panelInfoAbierto)}
            />
          )}
          {/* Sincronizar correos manualmente */}
          {tabActivo === 'correo' && (
            <span title={sincronizando ? 'Sincronizando...' : 'Sincronizar correos'}>
              <Boton
                variante="fantasma"
                tamano="xs"
                soloIcono
                icono={<RefreshCw size={16} className={sincronizando ? 'animate-spin' : ''} />}
                onClick={sincronizarCorreos}
                disabled={sincronizando}
              />
            </span>
          )}
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

      {/* Contenido principal */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* ─── CORREO: layout tipo cliente de email (sidebar | lista | contenido) ─── */}
        {tabActivo === 'correo' && (
          <>
            {/* Columna 1: Sidebar cuentas + carpetas (con su toggle arriba) */}
            <div
              className="flex flex-col flex-shrink-0 transition-all duration-200 h-full overflow-hidden"
              style={{
                width: sidebarCorreoColapsado ? 48 : 224,
                borderRight: '1px solid var(--borde-sutil)',
                background: 'var(--superficie-sidebar, var(--superficie-tarjeta))',
              }}
            >
              {/* Toggle del sidebar */}
              <div className="flex items-center justify-center h-9 flex-shrink-0" style={{ borderBottom: '1px solid var(--borde-sutil)' }}>
                <button
                  onClick={toggleSidebarCorreo}
                  className="p-1.5 rounded-md transition-colors"
                  style={{ color: 'var(--texto-terciario)' }}
                >
                  {sidebarCorreoColapsado ? <PanelLeftOpen size={15} /> : <PanelLeftClose size={15} />}
                </button>
              </div>
              {/* Contenido del sidebar */}
              <div className="flex-1 overflow-hidden">
                <SidebarCorreo
                  canales={canalesCorreo}
                  canalActivo={canalCorreoActivo}
                  carpetaActiva={carpetaCorreo}
                  colapsado={sidebarCorreoColapsado}
                  onSeleccionarCanal={(id) => {
                    setCanalCorreoActivo(id)
                    setCanalTodas(false)
                    setConversacionSeleccionada(null)
                    setMensajes([])
                  }}
                  onSeleccionarCarpeta={(carpeta) => {
                    setCarpetaCorreo(carpeta)
                    setConversacionSeleccionada(null)
                    setMensajes([])
                  }}
                  onRedactar={() => {
                    setConversacionSeleccionada(null)
                    setMensajes([])
                    setRedactandoNuevo(true)
                  }}
                  contadores={contadoresCorreo}
                  canalTodas={canalTodas}
                  onSeleccionarTodas={() => {
                    setCanalTodas(true)
                    setCanalCorreoActivo('')
                    setConversacionSeleccionada(null)
                    setMensajes([])
                  }}
                />
              </div>
            </div>

            {/* ─── Panel principal: depende del modo de vista ─── */}
            {modoVista === 'columna' ? (
              <>
                {/* MODO COLUMNA: lista | correo (2 paneles separados) */}
                <div
                  className="flex flex-col flex-shrink-0 transition-all duration-200 h-full overflow-hidden"
                  style={{ width: listaCorreoColapsada ? 40 : 320, borderRight: '1px solid var(--borde-sutil)' }}
                >
                  <div className="flex items-center justify-between px-2 h-9 flex-shrink-0" style={{ borderBottom: '1px solid var(--borde-sutil)' }}>
                    <button onClick={toggleListaCorreo} className="p-1 rounded-md" style={{ color: 'var(--texto-terciario)' }}>
                      {listaCorreoColapsada ? <PanelLeftOpen size={14} /> : <PanelLeftClose size={14} />}
                    </button>
                    {/* Selector de vista */}
                    <div className="flex items-center gap-0.5 rounded-md p-0.5" style={{ background: 'var(--superficie-hover)' }}>
                      <button
                        onClick={() => cambiarModoVista('columna')}
                        className="p-1 rounded"
                        style={{ color: 'var(--texto-marca)', background: 'var(--superficie-seleccionada)' }}
                      >
                        <Columns2 size={12} />
                      </button>
                      <button
                        onClick={() => cambiarModoVista('fila')}
                        className="p-1 rounded"
                        style={{ color: 'var(--texto-terciario)' }}
                      >
                        <Rows2 size={12} />
                      </button>
                    </div>
                  </div>
                  {!listaCorreoColapsada && (
                    <div className="flex-1 overflow-hidden">
                      <ListaConversaciones
                        conversaciones={conversaciones}
                        seleccionada={conversacionSeleccionada?.id || null}
                        onSeleccionar={seleccionarConversacion}
                        busqueda={busqueda}
                        onBusqueda={setBusqueda}
                        filtroEstado={filtroEstado}
                        onFiltroEstado={setFiltroEstado}
                        tipoCanal="correo"
                        cargando={cargandoConversaciones}
                        totalNoLeidos={totalNoLeidos}
                        onEliminarSeleccion={eliminarMultiples}
                        soloNoLeidos={soloNoLeidos}
                        onToggleNoLeidos={() => setSoloNoLeidos(prev => !prev)}
                      />
                    </div>
                  )}
                </div>

                <div className="flex-1 flex flex-col min-w-0 h-full overflow-x-hidden">
                  {redactandoNuevo ? (
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
                        onProgramar={programarCorreo}
                        onCancelar={() => setRedactandoNuevo(false)}
                        cargando={enviando}
                        firma={firmaCorreo}
                      />
                    </div>
                  ) : (
                    <ErrorBoundary mensaje="Error en el panel de correo"><PanelCorreo
                      conversacion={conversacionSeleccionada}
                      mensajes={mensajes}
                      onEnviarCorreo={enviarCorreo}
                      onMarcarSpam={marcarSpam}
                      onDesmarcarSpam={desmarcarSpam}
                      onArchivar={archivarConversacion}
                      onEliminar={eliminarConversacion}
                      onToggleLeido={toggleLeido}
                      cargando={cargandoMensajes}
                      enviando={enviando}
                      emailCanal={emailCanalActivo}
                      firma={firmaCorreo}
                    /></ErrorBoundary>
                  )}
                </div>
              </>
            ) : (
              <>
                {/* MODO FILA: lista y correo comparten el mismo panel */}
                <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
                  {/* Barra con selector de vista + botón volver */}
                  <div className="flex items-center justify-between px-2 h-9 flex-shrink-0" style={{ borderBottom: '1px solid var(--borde-sutil)' }}>
                    <div className="flex items-center gap-2">
                      {(conversacionSeleccionada || redactandoNuevo) && (
                        <button
                          onClick={() => { setConversacionSeleccionada(null); setMensajes([]); setRedactandoNuevo(false) }}
                          className="flex items-center gap-1.5 px-2 py-1 rounded-md text-xs transition-colors"
                          style={{ color: 'var(--texto-secundario)' }}
                        >
                          <ArrowLeft size={14} />
                          <span>{t('comun.volver')}</span>
                        </button>
                      )}
                    </div>
                    <div className="flex items-center gap-0.5 rounded-md p-0.5" style={{ background: 'var(--superficie-hover)' }}>
                      <button
                        onClick={() => cambiarModoVista('columna')}
                        className="p-1 rounded"
                        style={{ color: 'var(--texto-terciario)' }}
                      >
                        <Columns2 size={12} />
                      </button>
                      <button
                        onClick={() => cambiarModoVista('fila')}
                        className="p-1 rounded"
                        style={{ color: 'var(--texto-marca)', background: 'var(--superficie-seleccionada)' }}
                      >
                        <Rows2 size={12} />
                      </button>
                    </div>
                  </div>

                  {/* Contenido: lista O correo (no ambos) */}
                  {redactandoNuevo ? (
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
                        onProgramar={programarCorreo}
                        onCancelar={() => setRedactandoNuevo(false)}
                        cargando={enviando}
                        firma={firmaCorreo}
                      />
                    </div>
                  ) : conversacionSeleccionada ? (
                    <ErrorBoundary mensaje="Error en el panel de correo"><PanelCorreo
                      conversacion={conversacionSeleccionada}
                      mensajes={mensajes}
                      onEnviarCorreo={enviarCorreo}
                      onMarcarSpam={marcarSpam}
                      onDesmarcarSpam={desmarcarSpam}
                      onArchivar={archivarConversacion}
                      onEliminar={eliminarConversacion}
                      onToggleLeido={toggleLeido}
                      cargando={cargandoMensajes}
                      enviando={enviando}
                      emailCanal={emailCanalActivo}
                      firma={firmaCorreo}
                    /></ErrorBoundary>
                  ) : (
                    <div className="flex-1 overflow-hidden">
                      <ListaConversaciones
                        conversaciones={conversaciones}
                        seleccionada={null}
                        onSeleccionar={seleccionarConversacion}
                        busqueda={busqueda}
                        onBusqueda={setBusqueda}
                        filtroEstado={filtroEstado}
                        onFiltroEstado={setFiltroEstado}
                        tipoCanal="correo"
                        cargando={cargandoConversaciones}
                        totalNoLeidos={totalNoLeidos}
                        onEliminarSeleccion={eliminarMultiples}
                        soloNoLeidos={soloNoLeidos}
                        onToggleNoLeidos={() => setSoloNoLeidos(prev => !prev)}
                      />
                    </div>
                  )}
                </div>
              </>
            )}
          </>
        )}

        {/* ─── WHATSAPP: layout original (lista | chat | info) ─── */}
        {tabActivo === 'whatsapp' && (
          <>
            <div className="w-80 flex-shrink-0">
              <ListaConversaciones
                conversaciones={conversaciones}
                seleccionada={conversacionSeleccionada?.id || null}
                onSeleccionar={seleccionarConversacion}
                busqueda={busqueda}
                onBusqueda={setBusqueda}
                filtroEstado={filtroEstado}
                onFiltroEstado={setFiltroEstado}
                filtroEtiqueta={filtroEtiqueta}
                onFiltroEtiqueta={setFiltroEtiqueta}
                tipoCanal="whatsapp"
                cargando={cargandoConversaciones}
                totalNoLeidos={totalNoLeidos}
                onEliminarSeleccion={eliminarMultiples}
                soloNoLeidos={soloNoLeidos}
                onToggleNoLeidos={() => setSoloNoLeidos(prev => !prev)}
                onOperacionMasiva={async (accion, ids) => {
                  const admin = async (cambios: Record<string, unknown>) => {
                    await Promise.all(ids.map(id =>
                      fetch(`/api/inbox/conversaciones/${id}`, {
                        method: 'PATCH',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(cambios),
                      })
                    ))
                    cargarConversaciones()
                  }
                  if (accion === 'marcar_leido') await admin({ mensajes_sin_leer: 0 })
                  if (accion === 'marcar_no_leido') await admin({ mensajes_sin_leer: 1 })
                  if (accion === 'cerrar') await admin({ estado: 'resuelta' })
                }}
              />
            </div>
            <ErrorBoundary mensaje="Error en el panel de WhatsApp">
            <PanelWhatsApp
              conversacion={conversacionSeleccionada}
              mensajes={mensajes}
              onEnviar={enviarMensaje}
              onAbrirVisor={abrirVisor}
              iaHabilitada={iaHabilitada}
              onEtiquetasCambiaron={(etiquetas) => {
                // Actualizar inmediatamente en la UI sin esperar polling
                setConversacionSeleccionada(prev => prev ? { ...prev, etiquetas } : null)
                setConversaciones(prev => prev.map(c =>
                  c.id === conversacionSeleccionada?.id ? { ...c, etiquetas } : c
                ))
              }}
              onEditarNota={async (id, texto) => {
                // Optimistic update
                setMensajes(prev => prev.map(m =>
                  m.id === id ? { ...m, texto, editado_en: new Date().toISOString() } : m
                ))
                try {
                  await fetch(`/api/inbox/mensajes/${id}`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ texto }),
                  })
                } catch {
                  // Revertir en caso de error (recargar mensajes)
                }
              }}
              onEliminarNota={async (id) => {
                // Optimistic: remover de la lista
                setMensajes(prev => prev.filter(m => m.id !== id))
                try {
                  await fetch(`/api/inbox/mensajes/${id}`, { method: 'DELETE' })
                } catch {
                  // Revertir en caso de error
                }
              }}
              cargando={cargandoMensajes}
              enviando={enviando}
              onCargarAnteriores={cargarMensajesAnteriores}
              hayMasAnteriores={hayMasAnteriores}
              cargandoAnteriores={cargandoAnteriores}
            />
            </ErrorBoundary>
          </>
        )}

        {tabActivo === 'interno' && (
          <>
            <ErrorBoundary mensaje="Error en mensajería interna">
              <PanelInterno
                conversacion={conversacionSeleccionada}
                mensajes={mensajes}
                canalesPublicos={canalesPublicos}
                canalesPrivados={canalesPrivados}
                canalesGrupos={canalesGrupos}
                canalSeleccionado={canalInternoSeleccionado}
                onSeleccionarCanal={setCanalInternoSeleccionado}
                onCrearCanal={() => setModalCrearInterno(true)}
                onEnviar={enviarMensaje}
                cargando={cargandoMensajes}
                enviando={enviando}
                usuarioId={usuarioId}
                onRecargarCanales={cargarCanalesInternos}
              />
            </ErrorBoundary>
            <ModalCrearCanalInterno
              abierto={modalCrearInterno}
              onCerrar={() => setModalCrearInterno(false)}
              onCreado={cargarCanalesInternos}
            />
          </>
        )}

        {/* Panel derecho: info contacto + galería de medios (solo WhatsApp) */}
        {tabActivo === 'whatsapp' && (
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
