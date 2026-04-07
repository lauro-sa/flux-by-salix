'use client'

import { Suspense, useState, useCallback, useEffect, useRef, useMemo } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
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
import VistaPipeline from './_componentes/VistaPipeline'
import { KanbanSquare } from 'lucide-react'
import { sonidos } from '@/hooks/useSonido'
import { useEsMovil } from '@/hooks/useEsMovil'
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

export default function PaginaInboxWrapper() {
  return (
    <Suspense fallback={null}>
      <PaginaInbox />
    </Suspense>
  )
}

function PaginaInbox() {
  const { t } = useTraduccion()
  const router = useRouter()
  const searchParams = useSearchParams()
  const { mostrar } = useToast()
  const supabase = useMemo(() => crearClienteNavegador(), [])

  // Estado global del inbox
  const [tabActivo, setTabActivo] = useState<TipoCanal>('whatsapp')
  const [vistaWA, setVistaWA] = useState<'conversaciones' | 'pipeline'>('conversaciones')
  const [configCargada, setConfigCargada] = useState(false)
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

  // Ancho de la lista de conversaciones (redimensionable, persistido)
  const [anchoLista, setAnchoLista] = useState(340)
  const redimensionandoRef = useRef(false)
  useEffect(() => {
    const guardado = localStorage.getItem('flux_inbox_ancho_lista')
    if (guardado) setAnchoLista(parseInt(guardado))
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

  // ─── Responsive: detección móvil + vista activa ───
  const esMovil = useEsMovil()

  // Vista móvil: qué pantalla se muestra en cada canal
  type VistaMovilWA = 'lista' | 'chat' | 'info'
  type VistaMovilCorreo = 'sidebar' | 'lista' | 'correo'
  type VistaMovilInterno = 'canales' | 'chat'

  const [vistaMovilWA, setVistaMovilWA] = useState<VistaMovilWA>('lista')
  const [vistaMovilCorreo, setVistaMovilCorreo] = useState<VistaMovilCorreo>('sidebar')
  const [vistaMovilInterno, setVistaMovilInterno] = useState<VistaMovilInterno>('canales')

  // Al seleccionar conversación en móvil, avanzar a la vista de chat/correo
  const seleccionarConversacionMovil = useCallback((id: string) => {
    // La selección real se delega a seleccionarConversacion (definida después)
    // Aquí solo manejamos la navegación de vista
    if (esMovil) {
      if (tabActivo === 'whatsapp') setVistaMovilWA('chat')
      else if (tabActivo === 'correo') setVistaMovilCorreo('correo')
    }
  }, [esMovil, tabActivo])

  // Reset de vistas móviles cuando cambia de tab
  useEffect(() => {
    setVistaMovilWA('lista')
    setVistaMovilCorreo('sidebar')
    setVistaMovilInterno('canales')
  }, [tabActivo])

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

  // Cargar módulos activos de la empresa (ANTES de cargar conversaciones)
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
            // Seleccionar primer tab activo, SOLO si no hay navegación desde notificación
            const urlParams = new URLSearchParams(window.location.search)
            if (!urlParams.has('conv') && !urlParams.has('tab')) {
              if (activos.has('inbox_whatsapp')) setTabActivo('whatsapp')
              else if (activos.has('inbox_correo')) setTabActivo('correo')
              else if (activos.has('inbox_interno')) setTabActivo('interno')
            }
          }
        }
      } catch {
        // Si falla, mantener todos activos por defecto
      } finally {
        // Marcar config como cargada para habilitar fetch de conversaciones
        setConfigCargada(true)
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
    // No cargar hasta que la config esté lista
    if (!configCargada) return
    // Para correo, esperar a que haya canal activo (evita doble fetch)
    if (tabActivo === 'correo' && !canalTodas && !canalCorreoActivo) return
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
  }, [construirParamsConversaciones, configCargada, tabActivo, canalCorreoActivo, canalTodas])

  useEffect(() => {
    cargarConversaciones()
  }, [cargarConversaciones])

  // Abrir conversación desde URL (?conv=xxx) cuando se navega desde una notificación
  const convParamAnteriorRef = useRef<string | null>(null)
  useEffect(() => {
    const convId = searchParams.get('conv')
    const tabParam = searchParams.get('tab')

    // Si solo pide cambiar de tab sin conversación específica
    if (tabParam && !convId) {
      if (tabParam === 'interno' || tabParam === 'correo' || tabParam === 'whatsapp') {
        setTabActivo(tabParam as TipoCanal)
      }
      window.history.replaceState({}, '', window.location.pathname)
      return
    }

    if (!convId) return
    // Evitar re-procesar el mismo convId
    if (convParamAnteriorRef.current === convId) return
    convParamAnteriorRef.current = convId

    // Abrir conversación por ID — optimizado para mínima latencia
    const abrirDesdeUrl = async () => {
      try {
        // Si ya sabemos el tab desde la URL, cambiar inmediatamente (sin esperar fetch)
        if (tabParam === 'interno' || tabParam === 'correo' || tabParam === 'whatsapp') {
          setTabActivo(tabParam as TipoCanal)
        }

        setCargandoMensajes(true)

        // Lanzar todas las peticiones en paralelo
        const promesas: Promise<unknown>[] = [
          fetch(`/api/inbox/conversaciones/${convId}`),
          fetch(`/api/inbox/mensajes?conversacion_id=${convId}&por_pagina=200`),
        ]
        // Si es interno, cargar canales en paralelo también
        if (tabParam === 'interno') {
          promesas.push(fetch('/api/inbox/internos'))
        }

        const [resConv, resMsgs, resInternos] = await Promise.all(promesas) as Response[]

        // Procesar conversación
        const dataConv = await resConv.json()
        const conv = dataConv.conversacion
        if (!conv) return

        // Si no teníamos tab de la URL, determinarlo de la conversación
        if (!tabParam) {
          const tipoCanal = (conv.tipo_canal || conv.canal?.tipo) as TipoCanal | undefined
          if (tipoCanal) setTabActivo(tipoCanal)

          // Si resulta ser interno y no cargamos canales, hacerlo ahora
          if (tipoCanal === 'interno' && conv.canal_interno_id) {
            try {
              const resInt = await fetch('/api/inbox/internos')
              const dataInt = await resInt.json()
              const todos = [...(dataInt.canales || []), ...(dataInt.grupos || []), ...(dataInt.privados || [])] as CanalInterno[]
              const ci = todos.find((c) => c.id === conv.canal_interno_id)
              if (ci) setCanalInternoSeleccionado(ci)
              setCanalesPublicos(dataInt.canales || [])
              setCanalesGrupos(dataInt.grupos || [])
              setCanalesPrivados(dataInt.privados || [])
              canalesInternosCargadosRef.current = true
            } catch { /* silenciar */ }
          }
        }

        // Procesar canales internos (si se cargaron en paralelo)
        if (resInternos && conv.canal_interno_id) {
          try {
            const dataInt = await resInternos.json()
            const todos = [...(dataInt.canales || []), ...(dataInt.grupos || []), ...(dataInt.privados || [])] as CanalInterno[]
            const ci = todos.find((c) => c.id === conv.canal_interno_id)
            if (ci) setCanalInternoSeleccionado(ci)
            setCanalesPublicos(dataInt.canales || [])
            setCanalesGrupos(dataInt.grupos || [])
            setCanalesPrivados(dataInt.privados || [])
            canalesInternosCargadosRef.current = true
          } catch { /* silenciar */ }
        }

        // Procesar mensajes
        const dataMsgs = await resMsgs.json()
        const msgs = dataMsgs.mensajes || []
        setConversacionSeleccionada(conv)
        setMensajes(msgs)
        setHayMasAnteriores((dataMsgs.total || 0) > msgs.length)
        setCargandoMensajes(false)

        // Fire-and-forget: marcar notificaciones como leídas
        marcarNotificacionesLeidasDeConversacion(convId)

        // Limpiar params de la URL
        window.history.replaceState({}, '', window.location.pathname)
        convParamAnteriorRef.current = null
      } catch {
        setCargandoMensajes(false)
      }
    }
    abrirDesdeUrl()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams])

  // Búsqueda con debounce
  const montadoRef = useRef(false)
  useEffect(() => {
    if (!montadoRef.current) { montadoRef.current = true; return }
    if (!configCargada) return
    const timeout = setTimeout(() => cargarConversaciones(), 300)
    return () => clearTimeout(timeout)
  }, [busqueda, cargarConversaciones, configCargada])

  // Cargar canales de correo cuando se activa el tab (después de config)
  useEffect(() => {
    if (tabActivo !== 'correo' || !configCargada) return
    const cargar = async () => {
      try {
        const res = await fetch('/api/inbox/canales?tipo=correo')
        const data = await res.json()
        const canales = (data.canales || []) as CanalInbox[]
        setCanalesCorreo(canales)
        // Validar que el canal activo siga existiendo; si no, seleccionar el primero
        const idsCanales = new Set(canales.map(c => c.id))
        if (canales.length > 0 && (!canalCorreoActivo || !idsCanales.has(canalCorreoActivo))) {
          // Preferir canal principal, sino el primero
          const principal = canales.find(c => c.es_principal)
          setCanalCorreoActivo(principal?.id || canales[0].id)
        }
        if (canales.length <= 1) {
          setCanalTodas(false)
        }
      } catch {
        // silenciar
      }
    }
    cargar()
  }, [tabActivo, configCargada])

  // Cargar contadores de no leídos (endpoint dedicado, eficiente)
  const cargarContadores = useCallback(async () => {
    try {
      const res = await fetch('/api/inbox/correo/contadores')
      const data = await res.json()
      setContadoresCorreo(data.contadores || {})
    } catch { /* silenciar */ }
  }, [])

  useEffect(() => {
    if (tabActivo !== 'correo' || !configCargada) return
    cargarContadores()
    // Refrescar contadores cada 60 segundos
    const intervalo = setInterval(cargarContadores, 60000)
    return () => clearInterval(intervalo)
  }, [tabActivo, cargarContadores, configCargada])

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

  // Auto-sincronizar correos cada 60 segundos
  useEffect(() => {
    if (tabActivo !== 'correo' || !configCargada) return
    const intervalo = setInterval(sincronizarCorreos, 60000)
    return () => clearInterval(intervalo)
  }, [tabActivo, sincronizarCorreos, configCargada])

  // Obtener userId del usuario autenticado
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) setUsuarioId(data.user.id)
    })
  }, [supabase])

  // Cargar canales internos
  const canalesInternosCargadosRef = useRef(false)
  const cargarCanalesInternos = useCallback(async () => {
    try {
      const res = await fetch('/api/inbox/internos')
      const data = await res.json()
      setCanalesPublicos(data.canales || [])
      setCanalesGrupos(data.grupos || [])
      setCanalesPrivados(data.privados || [])
      canalesInternosCargadosRef.current = true
    } catch {
      // silenciar
    }
  }, [])

  useEffect(() => {
    if (tabActivo !== 'interno' || !configCargada) return
    cargarCanalesInternos()
  }, [tabActivo, cargarCanalesInternos, configCargada])

  // Sincronizar: si el canal seleccionado ya no existe en las listas, deseleccionar
  useEffect(() => {
    if (!canalInternoSeleccionado) return
    if (!canalesInternosCargadosRef.current) return // aún no cargados
    const todosLosCanales = [...canalesPublicos, ...canalesPrivados, ...canalesGrupos]
    const existe = todosLosCanales.some(c => c.id === canalInternoSeleccionado.id)
    if (!existe) {
      setCanalInternoSeleccionado(null)
      setConversacionSeleccionada(null)
      setMensajes([])
    }
  }, [canalesPublicos, canalesPrivados, canalesGrupos, canalInternoSeleccionado])

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
          // Marcar notificaciones de esta conversación como leídas
          marcarNotificacionesLeidasDeConversacion(data.conversacion.id)
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

  // Marcar notificaciones de una conversación como leídas y actualizar el header
  const marcarNotificacionesLeidasDeConversacion = useCallback((conversacionId: string) => {
    fetch('/api/inbox/notificaciones', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ referencia_id: conversacionId }),
    }).catch(() => { /* silenciar */ })
    // Notificar al hook de notificaciones del header para que actualice su estado local
    window.dispatchEvent(new CustomEvent('flux:notificaciones-leidas', { detail: { referenciaId: conversacionId } }))
  }, [])

  // Seleccionar conversación y cargar mensajes
  const seleccionarConversacion = useCallback(async (id: string) => {
    setRedactandoNuevo(false)
    const conv = conversaciones.find(c => c.id === id) || null
    setConversacionSeleccionada(conv)
    if (!conv) return

    // Navegar a vista de chat en móvil
    if (esMovil) {
      if (tabActivo === 'whatsapp') setVistaMovilWA('chat')
      else if (tabActivo === 'correo') setVistaMovilCorreo('correo')
    }

    // Marcar notificaciones de esta conversación como leídas
    marcarNotificacionesLeidasDeConversacion(id)

    // Marcar conversación como leída (optimista + API)
    if (conv.mensajes_sin_leer !== 0) {
      setConversaciones(prev => prev.map(c => c.id === id ? { ...c, mensajes_sin_leer: 0 } : c))
      setConversacionSeleccionada(prev => prev ? { ...prev, mensajes_sin_leer: 0 } : prev)
      fetch(`/api/inbox/conversaciones/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mensajes_sin_leer: 0 }),
      }).catch(() => {})
    }

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
  }, [conversaciones, marcarNotificacionesLeidasDeConversacion, esMovil, tabActivo])

  // ─── Realtime: escuchar mensajes nuevos y cambios de estado ───
  useEffect(() => {
    const convId = conversacionSeleccionada?.id
    if (!convId) return

    const canal = supabase
      .channel(`inbox-mensajes-${convId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'mensajes',
        filter: `conversacion_id=eq.${convId}`,
      }, (payload) => {
        const nuevo = payload.new as MensajeConAdjuntos
        // Solo agregar si no existe ya (evitar duplicados con mensajes optimistas)
        setMensajes(prev => {
          if (prev.some(m => m.id === nuevo.id)) return prev
          // Si es un mensaje optimista pendiente (wa_message_id coincide), reemplazar
          const idxOptimista = prev.findIndex(m => m.id?.startsWith('temp-'))
          if (idxOptimista >= 0 && !nuevo.es_entrante) {
            const copia = [...prev]
            copia[idxOptimista] = { ...nuevo, adjuntos: nuevo.adjuntos || [] }
            return copia
          }
          return [...prev, { ...nuevo, adjuntos: nuevo.adjuntos || [] }]
        })
        // Actualizar conversación en la lista (ultimo_mensaje, etc.)
        setConversaciones(prev => prev.map(c =>
          c.id === convId ? {
            ...c,
            ultimo_mensaje_texto: nuevo.texto || '',
            ultimo_mensaje_en: nuevo.creado_en,
            ultimo_mensaje_es_entrante: nuevo.es_entrante,
          } : c
        ))
      })
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'mensajes',
        filter: `conversacion_id=eq.${convId}`,
      }, (payload) => {
        const actualizado = payload.new as MensajeConAdjuntos
        // Actualizar estado (palomitas) y otros campos del mensaje
        setMensajes(prev => prev.map(m =>
          m.id === actualizado.id
            ? { ...m, wa_status: actualizado.wa_status, estado: actualizado.estado }
            : m
        ))
      })
      .subscribe()

    return () => {
      supabase.removeChannel(canal)
    }
  }, [conversacionSeleccionada?.id, supabase])

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
      remitente_id: usuarioId || null,
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

  // Reaccionar a un mensaje (optimistic update + API call)
  // Compartido entre WhatsApp, Interno y cualquier canal
  const reaccionarMensaje = useCallback(async (mensajeId: string, emoji: string) => {
    // Optimistic update inmediato
    setMensajes(prev => prev.map(m => {
      if (m.id !== mensajeId) return m
      const reacciones = { ...(m.reacciones || {}) } as Record<string, string[]>
      const usuarios = [...(reacciones[emoji] || [])]
      const yaReacciono = usuarios.includes(usuarioId)

      if (yaReacciono) {
        reacciones[emoji] = usuarios.filter(uid => uid !== usuarioId)
        if (reacciones[emoji].length === 0) delete reacciones[emoji]
      } else {
        // Quitar reacciones previas del usuario en otros emojis (como WhatsApp)
        for (const key of Object.keys(reacciones)) {
          reacciones[key] = reacciones[key].filter(uid => uid !== usuarioId)
          if (reacciones[key].length === 0) delete reacciones[key]
        }
        reacciones[emoji] = [...(reacciones[emoji] || []), usuarioId]
      }

      return { ...m, reacciones }
    }))

    // Enviar al server en background
    try {
      // Para WhatsApp usar el endpoint dedicado, para internos el genérico
      const esWhatsApp = conversacionSeleccionada?.tipo_canal === 'whatsapp'
      if (esWhatsApp) {
        await fetch('/api/inbox/whatsapp/reaccion', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            conversacion_id: conversacionSeleccionada.id,
            mensaje_id: mensajeId,
            emoji: emoji,
          }),
        })
      } else {
        await fetch(`/api/inbox/mensajes/${mensajeId}/reaccion`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ emoji }),
        })
      }
    } catch { /* silenciar — el optimistic update ya se aplicó */ }
  }, [usuarioId, conversacionSeleccionada])

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
        setCanalInternoSeleccionado(null)
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
        // Limpiar canal interno seleccionado para cerrar el panel completamente
        setCanalInternoSeleccionado(null)
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
      // No hacer polling si la pestaña está oculta (ahorra batería en mobile/PWA)
      if (document.hidden || cancelado) return
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
            // Un temp se considera "conocido" si un mensaje del server tiene el mismo texto
            // y fue creado en los últimos 10 segundos (evita duplicados por timing)
            const temporales = prev.filter(m => {
              if (!m.id.startsWith('temp-')) return false
              if (idsServer.has(m.id)) return false
              // Si hay un mensaje del server con el mismo texto reciente, el temp ya no es necesario
              const duplicadoEnServer = nuevos.some(n =>
                n.texto === m.texto &&
                n.remitente_id === m.remitente_id &&
                Math.abs(new Date(n.creado_en).getTime() - new Date(m.creado_en).getTime()) < 15000
              )
              return !duplicadoEnServer
            })
            const merged = [...nuevos, ...temporales]
            // Solo actualizar si hay cambios reales
            if (merged.length === prev.length && merged.every((m, i) =>
              m.id === prev[i]?.id && m.adjuntos.length === prev[i]?.adjuntos?.length
            )) return prev
            // Sonar si hay mensajes nuevos entrantes que no teníamos
            const ultimoAnterior = ultimoMensajeRef.current
            const ultimoNuevo = nuevos[nuevos.length - 1]?.id
            if (ultimoAnterior && ultimoNuevo && ultimoAnterior !== ultimoNuevo) {
              const mensajeNuevo = nuevos[nuevos.length - 1]
              if (mensajeNuevo?.es_entrante || (mensajeNuevo?.remitente_id && !mensajeNuevo.id.startsWith('temp-'))) {
                sonidos.notificacion()
              }
              // Marcar notificaciones como leídas: estamos viendo la conversación activamente
              marcarNotificacionesLeidasDeConversacion(convId)
            }
            ultimoMensajeRef.current = ultimoNuevo
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

    // Ejecutar poll inmediatamente + cada 5 segundos
    // (3s era demasiado agresivo, genera tráfico innecesario en mobile/PWA)
    poll()
    const intervalo = setInterval(poll, 5000)

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
    if (!configCargada) return
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

    const intervalo = setInterval(poll, 5000)
    return () => {
      cancelado = true
      abortController.abort()
      clearInterval(intervalo)
    }
  }, [construirParamsConversaciones, conversacionSeleccionada?.id, configCargada])

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
    <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
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
          {/* Toggle vista WhatsApp: conversaciones / pipeline (solo desktop) */}
          {tabActivo === 'whatsapp' && !esMovil && (
            <div className="flex items-center border border-borde-sutil rounded-lg overflow-hidden mr-1">
              <Boton
                variante={vistaWA === 'conversaciones' ? 'primario' : 'fantasma'}
                tamano="xs"
                soloIcono
                titulo="Vista conversaciones"
                icono={<Rows2 size={14} />}
                onClick={() => setVistaWA('conversaciones')}
                className="!rounded-none !rounded-l-lg"
              />
              <Boton
                variante={vistaWA === 'pipeline' ? 'primario' : 'fantasma'}
                tamano="xs"
                soloIcono
                titulo="Vista pipeline"
                icono={<KanbanSquare size={14} />}
                onClick={() => setVistaWA('pipeline')}
                className="!rounded-none !rounded-r-lg"
              />
            </div>
          )}
          {/* Toggle panel info (solo WhatsApp tiene panel lateral de info) */}
          {tabActivo === 'whatsapp' && (
            <Boton
              variante="fantasma"
              tamano="xs"
              soloIcono
              titulo="Alternar panel de info"
              icono={panelInfoAbierto ? <PanelRightClose size={16} /> : <PanelRightOpen size={16} />}
              onClick={() => setPanelInfoAbierto(!panelInfoAbierto)}
            />
          )}
          {/* Sincronizar correos manualmente */}
          {tabActivo === 'correo' && (
              <Boton
                variante="fantasma"
                tamano="xs"
                soloIcono
                titulo={sincronizando ? 'Sincronizando...' : 'Sincronizar correos'}
                icono={<RefreshCw size={16} className={sincronizando ? 'animate-spin' : ''} />}
                onClick={sincronizarCorreos}
                disabled={sincronizando}
              />
          )}
          {/* Configuración */}
          <Boton
            variante="fantasma"
            tamano="xs"
            soloIcono
            titulo="Configuración"
            icono={<Settings size={16} />}
            onClick={() => router.push('/inbox/configuracion')}
          />
        </div>
      </div>

      {/* Contenido principal */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* ─── CORREO: layout responsivo (sidebar | lista | contenido) ─── */}
        {tabActivo === 'correo' && (
          <>
            {/* ─── MÓVIL: vistas una a la vez ─── */}
            {esMovil ? (
              <>
                {/* Vista 1: Sidebar de cuentas y carpetas */}
                {vistaMovilCorreo === 'sidebar' && (
                  <div className="flex-1 flex flex-col h-full overflow-y-auto" style={{ background: 'var(--superficie-sidebar, var(--superficie-tarjeta))' }}>
                    <SidebarCorreo
                      canales={canalesCorreo}
                      canalActivo={canalCorreoActivo}
                      carpetaActiva={carpetaCorreo}
                      colapsado={false}
                      esMovil
                      onSeleccionarCanal={(id) => {
                        setCanalCorreoActivo(id)
                        setCanalTodas(false)
                        setConversacionSeleccionada(null)
                        setMensajes([])
                        setVistaMovilCorreo('lista')
                      }}
                      onSeleccionarCarpeta={(carpeta) => {
                        setCarpetaCorreo(carpeta)
                        setConversacionSeleccionada(null)
                        setMensajes([])
                        setVistaMovilCorreo('lista')
                      }}
                      onRedactar={() => {
                        setConversacionSeleccionada(null)
                        setMensajes([])
                        setRedactandoNuevo(true)
                        setVistaMovilCorreo('correo')
                      }}
                      contadores={contadoresCorreo}
                      canalTodas={canalTodas}
                      onSeleccionarTodas={() => {
                        setCanalTodas(true)
                        setCanalCorreoActivo('')
                        setConversacionSeleccionada(null)
                        setMensajes([])
                        setVistaMovilCorreo('lista')
                      }}
                    />
                  </div>
                )}

                {/* Vista 2: Lista de correos */}
                {vistaMovilCorreo === 'lista' && (
                  <div className="flex-1 flex flex-col h-full overflow-hidden">
                    {/* Header con botón atrás — min 44px de zona táctil */}
                    <div className="flex items-center gap-2 px-2 min-h-[44px] flex-shrink-0" style={{ borderBottom: '1px solid var(--borde-sutil)', background: 'var(--superficie-tarjeta)' }}>
                      <Boton
                        variante="fantasma"
                        tamano="sm"
                        icono={<ArrowLeft size={18} />}
                        onClick={() => setVistaMovilCorreo('sidebar')}
                      >
                        Cuentas
                      </Boton>
                      <span className="text-sm font-medium truncate flex-1 text-right" style={{ color: 'var(--texto-secundario)' }}>
                        {carpetaCorreo === 'entrada' ? 'Entrada' : carpetaCorreo === 'enviados' ? 'Enviados' : carpetaCorreo === 'spam' ? 'Spam' : 'Archivado'}
                      </span>
                    </div>
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
                  </div>
                )}

                {/* Vista 3: Correo abierto o redactando */}
                {vistaMovilCorreo === 'correo' && (
                  <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
                    {/* Header con botón atrás — min 44px zona táctil */}
                    <div className="flex items-center gap-2 px-2 min-h-[44px] flex-shrink-0" style={{ borderBottom: '1px solid var(--borde-sutil)', background: 'var(--superficie-tarjeta)' }}>
                      <Boton
                        variante="fantasma"
                        tamano="sm"
                        icono={<ArrowLeft size={18} />}
                        onClick={() => { setVistaMovilCorreo('lista'); setConversacionSeleccionada(null); setMensajes([]); setRedactandoNuevo(false) }}
                      >
                        {t('comun.volver')}
                      </Boton>
                    </div>
                    {redactandoNuevo ? (
                      <div className="flex-1 flex flex-col p-3" style={{ background: 'var(--superficie-app)' }}>
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
                          onCancelar={() => { setRedactandoNuevo(false); setVistaMovilCorreo('lista') }}
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
                )}
              </>
            ) : (
              /* ─── DESKTOP: layout original con columnas ─── */
              <>
                {/* Columna 1: Sidebar cuentas + carpetas */}
                <div
                  className="flex flex-col flex-shrink-0 transition-all duration-200 h-full overflow-hidden"
                  style={{
                    width: sidebarCorreoColapsado ? 48 : 224,
                    borderRight: '1px solid var(--borde-sutil)',
                    background: 'var(--superficie-sidebar, var(--superficie-tarjeta))',
                  }}
                >
                  <div className="flex items-center justify-center h-9 flex-shrink-0" style={{ borderBottom: '1px solid var(--borde-sutil)' }}>
                    <Boton variante="fantasma" tamano="xs" soloIcono titulo="Alternar panel" icono={sidebarCorreoColapsado ? <PanelLeftOpen size={15} /> : <PanelLeftClose size={15} />} onClick={toggleSidebarCorreo} />
                  </div>
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

                {/* Panel principal desktop */}
                {modoVista === 'columna' ? (
                  <>
                    <div
                      className="flex flex-col flex-shrink-0 transition-all duration-200 h-full overflow-hidden"
                      style={{ width: listaCorreoColapsada ? 40 : 320, borderRight: '1px solid var(--borde-sutil)' }}
                    >
                      <div className="flex items-center justify-between px-2 h-9 flex-shrink-0" style={{ borderBottom: '1px solid var(--borde-sutil)' }}>
                        <Boton variante="fantasma" tamano="xs" soloIcono titulo="Alternar lista" icono={listaCorreoColapsada ? <PanelLeftOpen size={14} /> : <PanelLeftClose size={14} />} onClick={toggleListaCorreo} />
                        <div className="flex items-center gap-0.5 rounded-md p-0.5" style={{ background: 'var(--superficie-hover)' }}>
                          <Boton variante="fantasma" tamano="xs" soloIcono icono={<Columns2 size={12} />} onClick={() => cambiarModoVista('columna')} titulo="Vista columna" style={{ color: 'var(--texto-marca)', background: 'var(--superficie-seleccionada)' }} />
                          <Boton variante="fantasma" tamano="xs" soloIcono icono={<Rows2 size={12} />} onClick={() => cambiarModoVista('fila')} titulo="Vista fila" style={{ color: 'var(--texto-terciario)' }} />
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
                    <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
                      <div className="flex items-center justify-between px-2 h-9 flex-shrink-0" style={{ borderBottom: '1px solid var(--borde-sutil)' }}>
                        <div className="flex items-center gap-2">
                          {(conversacionSeleccionada || redactandoNuevo) && (
                            <Boton variante="fantasma" tamano="xs" icono={<ArrowLeft size={14} />} onClick={() => { setConversacionSeleccionada(null); setMensajes([]); setRedactandoNuevo(false) }}>
                              {t('comun.volver')}
                            </Boton>
                          )}
                        </div>
                        <div className="flex items-center gap-0.5 rounded-md p-0.5" style={{ background: 'var(--superficie-hover)' }}>
                          <Boton variante="fantasma" tamano="xs" soloIcono icono={<Columns2 size={12} />} onClick={() => cambiarModoVista('columna')} titulo="Vista columna" style={{ color: 'var(--texto-terciario)' }} />
                          <Boton variante="fantasma" tamano="xs" soloIcono icono={<Rows2 size={12} />} onClick={() => cambiarModoVista('fila')} titulo="Vista fila" style={{ color: 'var(--texto-marca)', background: 'var(--superficie-seleccionada)' }} />
                        </div>
                      </div>
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
          </>
        )}

        {/* ─── WHATSAPP: layout responsivo (lista | chat | info) ─── */}
        {tabActivo === 'whatsapp' && (
          <>
            {vistaWA === 'pipeline' && !esMovil ? (
              <div className="flex-1 overflow-auto p-4">
                <VistaPipeline tipoCanal="whatsapp" />
              </div>
            ) : (
            <>
            {/* Lista de conversaciones — oculta en móvil cuando hay chat abierto */}
            {(!esMovil || vistaMovilWA === 'lista') && (
              <div
                className={esMovil ? 'flex-1' : 'flex-shrink-0 relative'}
                style={esMovil ? undefined : { width: anchoLista, minWidth: 280, maxWidth: 500 }}
              >
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
                    const patchMultiple = async (cambios: Record<string, unknown>) => {
                      await Promise.all(ids.map(id =>
                        fetch(`/api/inbox/conversaciones/${id}`, {
                          method: 'PATCH',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify(cambios),
                        })
                      ))
                      cargarConversaciones()
                    }
                    if (accion === 'marcar_leido') await patchMultiple({ mensajes_sin_leer: 0 })
                    if (accion === 'marcar_no_leido') await patchMultiple({ mensajes_sin_leer: 1 })
                    if (accion === 'cerrar') await patchMultiple({ estado: 'resuelta' })
                  }}
                  onAccionMenu={async (accion, convId, datos) => {
                    const patchConv = async (cambios: Record<string, unknown>) => {
                      await fetch(`/api/inbox/conversaciones/${convId}`, {
                        method: 'PATCH',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(cambios),
                      })
                      // Actualizar optimista en la lista
                      setConversaciones(prev => prev.map(c =>
                        c.id === convId ? { ...c, ...cambios } : c
                      ))
                    }
                    switch (accion) {
                      case 'marcar_leido':
                        await patchConv({ mensajes_sin_leer: 0 })
                        break
                      case 'marcar_no_leido':
                        await patchConv({ mensajes_sin_leer: 1 })
                        break
                      case 'marcar_lectura': {
                        // Toggle: -1 = marcado manual (punto sin número), 0 = leído
                        const convActual = conversaciones.find(c => c.id === convId)
                        if (convActual && convActual.mensajes_sin_leer !== 0) {
                          await patchConv({ mensajes_sin_leer: 0 })
                        } else {
                          await patchConv({ mensajes_sin_leer: -1 })
                        }
                        break
                      }
                      case 'fijar':
                      case 'fijar_para_mi': {
                        const convActualPin = conversaciones.find(c => c.id === convId)
                        if (convActualPin?._fijada) {
                          await fetch(`/api/inbox/conversaciones/${convId}/pins`, { method: 'DELETE' })
                        } else {
                          await fetch(`/api/inbox/conversaciones/${convId}/pins`, { method: 'POST', headers: { 'Content-Type': 'application/json' } })
                        }
                        cargarConversaciones()
                        break
                      }
                      case 'silenciar': {
                        const convActualSil = conversaciones.find(c => c.id === convId)
                        if (convActualSil?._silenciada) {
                          await fetch(`/api/inbox/conversaciones/${convId}/silenciar`, { method: 'DELETE' })
                        } else {
                          await fetch(`/api/inbox/conversaciones/${convId}/silenciar`, { method: 'POST', headers: { 'Content-Type': 'application/json' } })
                        }
                        cargarConversaciones()
                        break
                      }
                      case 'pipeline': {
                        const convActualPip = conversaciones.find(c => c.id === convId)
                        await patchConv({ en_pipeline: !convActualPip?.en_pipeline })
                        break
                      }
                      case 'bloquear':
                        await patchConv({ bloqueada: true })
                        cargarConversaciones()
                        break
                      case 'papelera':
                      case 'mover_papelera':
                        await patchConv({ en_papelera: true })
                        cargarConversaciones()
                        break
                      case 'fijar_para_usuario':
                        if (datos && typeof datos === 'object' && 'usuario_ids' in datos) {
                          const ids = (datos as { usuario_ids: string[] }).usuario_ids
                          await Promise.all(ids.map(uid =>
                            fetch(`/api/inbox/conversaciones/${convId}/pins`, {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ usuario_id: uid }),
                            })
                          ))
                        }
                        break
                    }
                  }}
                  esAdmin={true}
                />
                {/* Drag handle para redimensionar — hidden en mobile via CSS */}
                <div
                  className="absolute top-0 -right-px w-[3px] h-full cursor-col-resize z-10 hidden md:block opacity-0 hover:opacity-100 active:opacity-100 transition-opacity"
                  style={{ backgroundColor: 'var(--texto-marca)' }}
                    onMouseDown={(e) => {
                      e.preventDefault()
                      redimensionandoRef.current = true
                      const inicio = e.clientX
                      const anchoInicial = anchoLista
                      const onMove = (ev: MouseEvent) => {
                        if (!redimensionandoRef.current) return
                        const nuevoAncho = Math.max(280, Math.min(500, anchoInicial + (ev.clientX - inicio)))
                        setAnchoLista(nuevoAncho)
                      }
                      const onUp = () => {
                        redimensionandoRef.current = false
                        localStorage.setItem('flux_inbox_ancho_lista', String(anchoLista))
                        document.removeEventListener('mousemove', onMove)
                        document.removeEventListener('mouseup', onUp)
                      }
                      document.addEventListener('mousemove', onMove)
                      document.addEventListener('mouseup', onUp)
                    }}
                  />
              </div>
            )}
            {/* Chat — en móvil pantalla completa con botón atrás */}
            {(!esMovil || vistaMovilWA === 'chat') && (
              <ErrorBoundary mensaje="Error en el panel de WhatsApp">
              <PanelWhatsApp
                conversacion={conversacionSeleccionada}
                mensajes={mensajes}
                onEnviar={enviarMensaje}
                onAbrirVisor={abrirVisor}
                iaHabilitada={iaHabilitada}
                esMovil={esMovil}
                onVolver={() => { setVistaMovilWA('lista'); setConversacionSeleccionada(null); setMensajes([]) }}
                onAbrirInfo={() => setVistaMovilWA('info')}
                onEtiquetasCambiaron={(etiquetas) => {
                  setConversacionSeleccionada(prev => prev ? { ...prev, etiquetas } : null)
                  setConversaciones(prev => prev.map(c =>
                    c.id === conversacionSeleccionada?.id ? { ...c, etiquetas } : c
                  ))
                }}
                onEditarNota={async (id, texto) => {
                  setMensajes(prev => prev.map(m =>
                    m.id === id ? { ...m, texto, editado_en: new Date().toISOString() } : m
                  ))
                  try {
                    await fetch(`/api/inbox/mensajes/${id}`, {
                      method: 'PATCH',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ texto }),
                    })
                  } catch { /* revertir */ }
                }}
                onEliminarNota={async (id) => {
                  setMensajes(prev => prev.filter(m => m.id !== id))
                  try {
                    await fetch(`/api/inbox/mensajes/${id}`, { method: 'DELETE' })
                  } catch { /* revertir */ }
                }}
                cargando={cargandoMensajes}
                enviando={enviando}
                onCargarAnteriores={cargarMensajesAnteriores}
                hayMasAnteriores={hayMasAnteriores}
                cargandoAnteriores={cargandoAnteriores}
                onReaccionar={reaccionarMensaje}
                onCambioConversacion={(cambios) => {
                  setConversacionSeleccionada(prev => prev ? { ...prev, ...cambios } : null)
                  setConversaciones(prev => prev.map(c =>
                    c.id === conversacionSeleccionada?.id ? { ...c, ...cambios } : c
                  ))
                }}
              />
              </ErrorBoundary>
            )}
            {/* Info contacto — en móvil pantalla completa */}
            {esMovil && vistaMovilWA === 'info' && (
              <div className="flex-1 overflow-y-auto" style={{ background: 'var(--superficie-app)' }}>
                <PanelInfoContacto
                  conversacion={conversacionSeleccionada}
                  mensajes={mensajes}
                  abierto={true}
                  onCerrar={() => setVistaMovilWA('chat')}
                  onAbrirVisor={abrirVisor}
                  esMovil
                />
              </div>
            )}
            </>
            )}
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
                onSeleccionarCanal={(canal) => {
                  setCanalInternoSeleccionado(canal)
                  if (!canal) {
                    setConversacionSeleccionada(null)
                    setMensajes([])
                  }
                  // En móvil, navegar al chat cuando se selecciona un canal
                  if (esMovil && canal) setVistaMovilInterno('chat')
                }}
                onCrearCanal={() => setModalCrearInterno(true)}
                onEnviar={enviarMensaje}
                cargando={cargandoMensajes}
                enviando={enviando}
                usuarioId={usuarioId}
                onRecargarCanales={cargarCanalesInternos}
                onReaccionar={reaccionarMensaje}
                esMovil={esMovil}
                vistaMovil={vistaMovilInterno}
                onVolverMovil={() => {
                  setVistaMovilInterno('canales')
                  setCanalInternoSeleccionado(null)
                  setConversacionSeleccionada(null)
                  setMensajes([])
                }}
              />
            </ErrorBoundary>
            <ModalCrearCanalInterno
              abierto={modalCrearInterno}
              onCerrar={() => setModalCrearInterno(false)}
              onCreado={async (canalCreado?: CanalInterno) => {
                // Agregar canal al estado local inmediatamente para que aparezca en sidebar
                if (canalCreado) {
                  const tipo = canalCreado.tipo
                  if (tipo === 'publico') setCanalesPublicos(prev => [canalCreado, ...prev])
                  else if (tipo === 'grupo') setCanalesGrupos(prev => [canalCreado, ...prev])
                  else setCanalesPrivados(prev => [canalCreado, ...prev])
                  // Auto-seleccionar para abrir la conversación
                  setCanalInternoSeleccionado(canalCreado)
                }
                // Sincronizar con BD en background (nombres DM resueltos, etc.)
                cargarCanalesInternos()
              }}
            />
          </>
        )}

        {/* Panel derecho: info contacto + galería de medios (solo WhatsApp, solo desktop, solo vista conversaciones) */}
        {tabActivo === 'whatsapp' && !esMovil && vistaWA === 'conversaciones' && (
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
