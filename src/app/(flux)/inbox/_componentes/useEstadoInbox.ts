'use client'

import { useState, useCallback, useEffect, useRef, useMemo } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { crearClienteNavegador } from '@/lib/supabase/cliente'
import { useToast } from '@/componentes/feedback/Toast'
import { useEsMovil } from '@/hooks/useEsMovil'
import { sonidos } from '@/hooks/useSonido'
import type {
  TipoCanal, EstadoConversacion, ConversacionConDetalles,
  MensajeConAdjuntos, CanalInterno, CanalInbox, ModuloEmpresa,
} from '@/tipos/inbox'
import type { DatosMensaje } from './CompositorMensaje'
import type { DatosCorreo } from './CompositorCorreo'
import type { CarpetaCorreo } from './SidebarCorreo'
import type { MediaVisor } from './PanelWhatsApp'
import { useTraduccion } from '@/lib/i18n'
import { DEBOUNCE_BUSQUEDA, INTERVALO_HEARTBEAT, INTERVALO_POLLING } from '@/lib/constantes/timeouts'

/**
 * Hook principal del Inbox — centraliza todo el estado,
 * data fetching, realtime, polling y acciones.
 * Usado por PaginaInbox como orquestador.
 */

// Tipo auxiliar para el modo de vista del correo
export type ModoVista = 'columna' | 'fila'

// Vistas móviles por canal
export type VistaMovilWA = 'lista' | 'chat' | 'info'
export type VistaMovilCorreo = 'sidebar' | 'lista' | 'correo'
export type VistaMovilInterno = 'canales' | 'chat'

export function useEstadoInbox() {
  const { t } = useTraduccion()
  const router = useRouter()
  const searchParams = useSearchParams()
  const { mostrar } = useToast()
  const supabase = useMemo(() => crearClienteNavegador(), [])

  // ─── Estado global del inbox ───
  const abriendoDesdeUrlRef = useRef(false)
  const tabCambiadoManualRef = useRef(false)
  const [tabActivo, setTabActivo] = useState<TipoCanal>('whatsapp')
  const [vistaWA, setVistaWA] = useState<'conversaciones' | 'pipeline'>('conversaciones')
  const [configCargada, setConfigCargada] = useState(false)
  const [modulosActivos, setModulosActivos] = useState<Set<string>>(
    new Set(['inbox_whatsapp', 'inbox_correo', 'inbox_interno'])
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

  // Bot/IA habilitados
  const [iaHabilitada, setIaHabilitada] = useState(false)
  const [botHabilitado, setBotHabilitado] = useState(false)

  // Correo
  const [redactandoNuevo, setRedactandoNuevo] = useState(false)
  const [canalesCorreo, setCanalesCorreo] = useState<CanalInbox[]>([])
  const [canalCorreoActivo, setCanalCorreoActivo] = useState<string>('')
  const [carpetaCorreo, setCarpetaCorreo] = useState<CarpetaCorreo>('entrada')
  const [canalTodas, setCanalTodas] = useState(false)
  const [contadoresCorreo, setContadoresCorreo] = useState<Record<string, { entrada: number; spam: number }>>({})
  const [sincronizando, setSincronizando] = useState(false)

  // WhatsApp: modal nuevo mensaje + canal WA
  const [modalNuevoWA, setModalNuevoWA] = useState(false)
  const [canalWAId, setCanalWAId] = useState<string>('')

  // Modo de vista correo
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

  // Layout colapsable del correo
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

  // ─── Responsive ───
  const esMovil = useEsMovil()

  const [vistaMovilWA, setVistaMovilWA] = useState<VistaMovilWA>('lista')
  const [vistaMovilCorreo, setVistaMovilCorreo] = useState<VistaMovilCorreo>('sidebar')
  const [vistaMovilInterno, setVistaMovilInterno] = useState<VistaMovilInterno>('canales')

  // Reset de vistas móviles cuando cambia de tab
  useEffect(() => {
    setVistaMovilWA('lista')
    setVistaMovilCorreo('sidebar')
    setVistaMovilInterno('canales')
  }, [tabActivo])

  // Visor de media fullscreen
  const [visorAbierto, setVisorAbierto] = useState(false)
  const [visorIndice, setVisorIndice] = useState(0)

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

  // ─── Cargar config de empresa ───
  useEffect(() => {
    const cargarConfig = async () => {
      try {
        const res = await fetch('/api/inbox/config')
        const data = await res.json()
        try {
          const [resChatbot, resAgente] = await Promise.all([
            fetch('/api/inbox/chatbot').then(r => r.json()).catch(() => ({ config: null })),
            fetch('/api/inbox/agente-ia/config').then(r => r.json()).catch(() => ({ config: null })),
          ])
          setBotHabilitado(resChatbot.config?.activo ?? false)
          setIaHabilitada(resAgente.config?.activo ?? false)
        } catch { /* Si falla, quedan en false */ }

        if (data.modulos) {
          const activos = new Set<string>(
            data.modulos
              .filter((m: ModuloEmpresa) => m.activo)
              .map((m: ModuloEmpresa) => m.modulo)
          )
          if (activos.size > 0) {
            setModulosActivos(activos)
            const urlParams = new URLSearchParams(window.location.search)
            if (!urlParams.has('conv') && !urlParams.has('tab') && !tabCambiadoManualRef.current) {
              if (activos.has('inbox_whatsapp')) setTabActivo('whatsapp')
              else if (activos.has('inbox_correo')) setTabActivo('correo')
              else if (activos.has('inbox_interno')) setTabActivo('interno')
            }
          }
        }
      } catch {
        // Si falla, mantener todos activos por defecto
      } finally {
        setConfigCargada(true)
      }
    }
    cargarConfig()
  }, [])

  // Cargar canal WhatsApp activo
  useEffect(() => {
    if (!configCargada || !modulosActivos.has('inbox_whatsapp')) return
    fetch('/api/inbox/canales?tipo=whatsapp')
      .then(r => r.json())
      .then(data => {
        const canales = data.canales || []
        if (canales.length > 0) setCanalWAId(canales[0].id)
      })
      .catch(() => {})
  }, [configCargada, modulosActivos])

  // ─── Params de filtro para conversaciones ───
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

  // ─── Cargar conversaciones ───
  const cargarConversaciones = useCallback(async () => {
    if (!configCargada) return
    if (abriendoDesdeUrlRef.current) return
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

  // ─── Abrir conversación desde URL (?conv=xxx) ───
  const canalesInternosCargadosRef = useRef(false)
  const convParamAnteriorRef = useRef<string | null>(null)
  useEffect(() => {
    const convId = searchParams.get('conv')
    const tabParam = searchParams.get('tab')

    if (tabParam && !convId) {
      if (tabParam === 'interno' || tabParam === 'correo' || tabParam === 'whatsapp') {
        setTabActivo(tabParam as TipoCanal)
      }
      window.history.replaceState({}, '', window.location.pathname)
      return
    }

    if (!convId) return
    if (convParamAnteriorRef.current === convId) return
    convParamAnteriorRef.current = convId
    abriendoDesdeUrlRef.current = true

    const abrirDesdeUrl = async () => {
      try {
        if (tabParam === 'interno' || tabParam === 'correo' || tabParam === 'whatsapp') {
          setTabActivo(tabParam as TipoCanal)
        }

        setCargandoMensajes(true)

        const promesas: Promise<unknown>[] = [
          fetch(`/api/inbox/conversaciones/${convId}`),
          fetch(`/api/inbox/mensajes?conversacion_id=${convId}&por_pagina=200`),
        ]
        if (tabParam === 'interno') {
          promesas.push(fetch('/api/inbox/internos'))
        }

        const [resConv, resMsgs, resInternos] = await Promise.all(promesas) as Response[]

        const dataConv = await resConv.json()
        const conv = dataConv.conversacion
        if (!conv) return

        if (!tabParam) {
          const tipoCanal = (conv.tipo_canal || conv.canal?.tipo) as TipoCanal | undefined
          if (tipoCanal) setTabActivo(tipoCanal)

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

        const dataMsgs = await resMsgs.json()
        const msgs = dataMsgs.mensajes || []
        setConversacionSeleccionada(conv)
        setMensajes(msgs)
        setHayMasAnteriores((dataMsgs.total || 0) > msgs.length)
        setCargandoMensajes(false)

        marcarNotificacionesLeidasDeConversacion(convId)

        window.history.replaceState({}, '', window.location.pathname)
        convParamAnteriorRef.current = null

        abriendoDesdeUrlRef.current = false
        const tabFinal = tabParam || (conv.tipo_canal || conv.canal?.tipo) as string
        if (tabFinal && tabFinal !== 'correo') {
          const params = new URLSearchParams()
          params.set('tipo_canal', tabFinal)
          try {
            const resList = await fetch(`/api/inbox/conversaciones?${params}`)
            const dataList = await resList.json()
            setConversaciones(dataList.conversaciones || [])
          } catch { /* silenciar */ }
        }
      } catch {
        setCargandoMensajes(false)
        abriendoDesdeUrlRef.current = false
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
    const timeout = setTimeout(() => cargarConversaciones(), DEBOUNCE_BUSQUEDA)
    return () => clearTimeout(timeout)
  }, [busqueda, cargarConversaciones, configCargada])

  // ─── Cargar canales de correo ───
  useEffect(() => {
    if (tabActivo !== 'correo' || !configCargada) return
    const cargar = async () => {
      try {
        const res = await fetch('/api/inbox/canales?tipo=correo')
        const data = await res.json()
        const canales = (data.canales || []) as CanalInbox[]
        setCanalesCorreo(canales)
        const idsCanales = new Set(canales.map(c => c.id))
        if (canales.length > 0 && (!canalCorreoActivo || !idsCanales.has(canalCorreoActivo))) {
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

  // Contadores de correo
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
    const intervalo = setInterval(cargarContadores, INTERVALO_HEARTBEAT)
    return () => clearInterval(intervalo)
  }, [tabActivo, cargarContadores, configCargada])

  // Sincronizar correos
  const sincronizandoRef = useRef(false)
  const sincronizarCorreos = useCallback(async () => {
    if (sincronizandoRef.current) return
    sincronizandoRef.current = true
    setSincronizando(true)
    try {
      const res = await fetch('/api/inbox/correo/sincronizar', { method: 'POST' })
      const data = await res.json()
      await Promise.all([cargarConversaciones(), cargarContadores()])
      return data
    } catch {
      // silenciar
    } finally {
      sincronizandoRef.current = false
      setSincronizando(false)
    }
  }, [cargarConversaciones, cargarContadores])

  useEffect(() => {
    if (tabActivo !== 'correo' || !configCargada) return
    const intervalo = setInterval(sincronizarCorreos, INTERVALO_HEARTBEAT)
    return () => clearInterval(intervalo)
  }, [tabActivo, sincronizarCorreos, configCargada])

  // Obtener userId
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) setUsuarioId(data.user.id)
    })
  }, [supabase])

  // ─── Canales internos ───
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

  // Sincronizar canal seleccionado con listas
  useEffect(() => {
    if (!canalInternoSeleccionado) return
    if (!canalesInternosCargadosRef.current) return
    const todosLosCanales = [...canalesPublicos, ...canalesPrivados, ...canalesGrupos]
    const existe = todosLosCanales.some(c => c.id === canalInternoSeleccionado.id)
    if (!existe) {
      setCanalInternoSeleccionado(null)
      setConversacionSeleccionada(null)
      setMensajes([])
    }
  }, [canalesPublicos, canalesPrivados, canalesGrupos, canalInternoSeleccionado])

  // Cargar mensajes al seleccionar canal interno
  useEffect(() => {
    if (tabActivo !== 'interno' || !canalInternoSeleccionado) return

    const cargar = async () => {
      setCargandoMensajes(true)
      paginaMensajesRef.current = 1
      try {
        const res = await fetch(`/api/inbox/internos/${canalInternoSeleccionado.id}/conversacion`, {
          method: 'POST',
        })
        const data = await res.json()
        if (data.conversacion) {
          setConversacionSeleccionada(data.conversacion)
          marcarNotificacionesLeidasDeConversacion(data.conversacion.id)
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

  // ─── Marcar notificaciones leídas ───
  const marcarNotificacionesLeidasDeConversacion = useCallback((conversacionId: string) => {
    fetch('/api/inbox/notificaciones', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ referencia_id: conversacionId }),
    }).catch(() => { /* silenciar */ })
    window.dispatchEvent(new CustomEvent('flux:notificaciones-leidas', { detail: { referenciaId: conversacionId } }))
  }, [])

  // ─── Seleccionar conversación ───
  const seleccionarConversacion = useCallback(async (id: string) => {
    setRedactandoNuevo(false)
    const conv = conversaciones.find(c => c.id === id) || null
    setConversacionSeleccionada(conv)
    if (!conv) return

    if (esMovil) {
      if (tabActivo === 'whatsapp') setVistaMovilWA('chat')
      else if (tabActivo === 'correo') setVistaMovilCorreo('correo')
    }

    marcarNotificacionesLeidasDeConversacion(id)

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

  // ─── Realtime: escuchar mensajes nuevos ───
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
        setMensajes(prev => {
          if (prev.some(m => m.id === nuevo.id)) return prev
          const idxOptimista = prev.findIndex(m => m.id?.startsWith('temp-'))
          if (idxOptimista >= 0 && !nuevo.es_entrante) {
            const copia = [...prev]
            copia[idxOptimista] = { ...nuevo, adjuntos: nuevo.adjuntos || [] }
            return copia
          }
          return [...prev, { ...nuevo, adjuntos: nuevo.adjuntos || [] }]
        })
        setConversaciones(prev => prev.map(c =>
          c.id === convId ? {
            ...c,
            ultimo_mensaje_texto: nuevo.texto || '',
            ultimo_mensaje_en: nuevo.creado_en,
            ultimo_mensaje_es_entrante: nuevo.es_entrante,
            mensajes_sin_leer: 0,
          } : c
        ))
        if (nuevo.es_entrante) {
          fetch(`/api/inbox/conversaciones/${convId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ mensajes_sin_leer: 0 }),
          }).catch(() => {})
        }
      })
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'mensajes',
        filter: `conversacion_id=eq.${convId}`,
      }, (payload) => {
        const actualizado = payload.new as MensajeConAdjuntos
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

  // ─── Cargar mensajes anteriores ───
  const conversacionIdRef = useRef<string | null>(null)
  conversacionIdRef.current = conversacionSeleccionada?.id || null

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

  // ─── Enviar mensaje (optimistic update) ───
  const enviarMensaje = useCallback(async (datos: DatosMensaje) => {
    if (!conversacionSeleccionada) return
    setEnviando(true)

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

    setMensajes(prev => [...prev, mensajeOptimista])

    try {
      let mediaUrl: string | undefined
      let mediaFilename: string | undefined

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
      setMensajes(prev => prev.map(m =>
        m.id === tempId ? { ...m, wa_status: 'failed', estado: 'fallido' as const } : m
      ))
    } finally {
      setEnviando(false)
    }
  }, [conversacionSeleccionada, supabase])

  // ─── Enviar nuevo WhatsApp ───
  const enviarNuevoWhatsApp = useCallback(async (telefono: string, plantilla: import('@/tipos/inbox').PlantillaWhatsApp, valoresVariables: string[]) => {
    if (!canalWAId) throw new Error('No hay canal WhatsApp configurado')

    const resConv = await fetch('/api/inbox/conversaciones', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        canal_id: canalWAId,
        tipo_canal: 'whatsapp',
        identificador_externo: telefono,
      }),
    })
    if (!resConv.ok) {
      const data = await resConv.json().catch(() => ({ error: 'Error desconocido' }))
      mostrar('error', data.error || 'Error al crear conversación')
      throw new Error(data.error)
    }
    const { conversacion } = await resConv.json()

    const componentesMeta: Record<string, unknown>[] = []
    const cuerpo = plantilla.componentes?.cuerpo
    if (cuerpo?.texto) {
      const matches = cuerpo.texto.match(/\{\{\d+\}\}/g)
      if (matches && matches.length > 0) {
        const parametros = matches.map((_, i) => {
          const valor = valoresVariables[i]?.trim() || '\u200B'
          return { type: 'text', text: valor }
        })
        componentesMeta.push({ type: 'body', parameters: parametros })
      }
    }
    const encabezado = plantilla.componentes?.encabezado
    if (encabezado?.tipo === 'TEXT' && encabezado.texto?.includes('{{1}}')) {
      componentesMeta.push({
        type: 'header',
        parameters: [{ type: 'text', text: encabezado.ejemplo || '' }],
      })
    }

    const resEnvio = await fetch('/api/inbox/whatsapp/enviar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        conversacion_id: conversacion.id,
        canal_id: canalWAId,
        tipo: 'plantilla',
        plantilla_nombre_api: plantilla.nombre_api,
        plantilla_idioma: plantilla.idioma,
        plantilla_componentes: componentesMeta,
      }),
    })
    if (!resEnvio.ok) {
      const data = await resEnvio.json().catch(() => ({ error: 'Error desconocido' }))
      mostrar('error', data.error || 'Error al enviar plantilla')
      throw new Error(data.error)
    }

    mostrar('exito', `Plantilla enviada a ${telefono}`)

    await cargarConversaciones()
    seleccionarConversacion(conversacion.id)
    if (esMovil) setVistaMovilWA('chat')
  }, [canalWAId, mostrar, cargarConversaciones, seleccionarConversacion, esMovil])

  // ─── Reaccionar a mensaje ───
  const reaccionarMensaje = useCallback(async (mensajeId: string, emoji: string) => {
    setMensajes(prev => prev.map(m => {
      if (m.id !== mensajeId) return m
      const reacciones = { ...(m.reacciones || {}) } as Record<string, string[]>
      const usuarios = [...(reacciones[emoji] || [])]
      const yaReacciono = usuarios.includes(usuarioId)

      if (yaReacciono) {
        reacciones[emoji] = usuarios.filter(uid => uid !== usuarioId)
        if (reacciones[emoji].length === 0) delete reacciones[emoji]
      } else {
        for (const key of Object.keys(reacciones)) {
          reacciones[key] = reacciones[key].filter(uid => uid !== usuarioId)
          if (reacciones[key].length === 0) delete reacciones[key]
        }
        reacciones[emoji] = [...(reacciones[emoji] || []), usuarioId]
      }

      return { ...m, reacciones }
    }))

    try {
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
    } catch { /* silenciar */ }
  }, [usuarioId, conversacionSeleccionada])

  // ─── Enviar correo ───
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

  // Programar correo
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

  // ─── Acciones de conversación ───
  const marcarSpam = useCallback(async (conversacionId: string) => {
    try {
      await fetch(`/api/inbox/conversaciones/${conversacionId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ estado: 'spam' }),
      })
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

  const desmarcarSpam = useCallback(async (conversacionId: string) => {
    try {
      await fetch(`/api/inbox/conversaciones/${conversacionId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ estado: 'abierta' }),
      })
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
        setCanalInternoSeleccionado(null)
      }
      mostrar('exito', 'Conversación archivada')
    } catch {
      mostrar('error', 'Error al archivar')
    }
  }, [conversacionSeleccionada, mostrar])

  // ─── Polling de mensajes ───
  const ultimoMensajeRef = useRef<string | null>(null)

  useEffect(() => {
    const convId = conversacionSeleccionada?.id
    if (!convId) return

    let cancelado = false
    const abortController = new AbortController()

    const poll = async () => {
      if (document.hidden || cancelado) return
      try {
        const res = await fetch(
          `/api/inbox/mensajes?conversacion_id=${convId}&por_pagina=200`,
          { signal: abortController.signal }
        )
        const data = await res.json()
        if (cancelado || conversacionIdRef.current !== convId) return
        if (data.mensajes) {
          const nuevos = data.mensajes as MensajeConAdjuntos[]
          setMensajes(prev => {
            const idsServer = new Set(nuevos.map(m => m.id))
            const temporales = prev.filter(m => {
              if (!m.id.startsWith('temp-')) return false
              if (idsServer.has(m.id)) return false
              const duplicadoEnServer = nuevos.some(n =>
                n.texto === m.texto &&
                n.remitente_id === m.remitente_id &&
                Math.abs(new Date(n.creado_en).getTime() - new Date(m.creado_en).getTime()) < 15000
              )
              return !duplicadoEnServer
            })
            const merged = [...nuevos, ...temporales]
            if (merged.length === prev.length && merged.every((m, i) =>
              m.id === prev[i]?.id && m.adjuntos.length === prev[i]?.adjuntos?.length
            )) return prev
            const ultimoAnterior = ultimoMensajeRef.current
            const ultimoNuevo = nuevos[nuevos.length - 1]?.id
            if (ultimoAnterior && ultimoNuevo && ultimoAnterior !== ultimoNuevo) {
              const mensajeNuevo = nuevos[nuevos.length - 1]
              if (mensajeNuevo?.es_entrante || (mensajeNuevo?.remitente_id && !mensajeNuevo.id.startsWith('temp-'))) {
                sonidos.notificacion()
              }
              marcarNotificacionesLeidasDeConversacion(convId)
            }
            ultimoMensajeRef.current = ultimoNuevo
            return merged
          })

          const mediaSinAdjunto = nuevos.some(
            m => ['imagen', 'audio', 'video', 'documento', 'sticker'].includes(m.tipo_contenido)
              && m.adjuntos.length === 0
          )
          if (mediaSinAdjunto) {
            fetch('/api/inbox/whatsapp/media-pendiente', { method: 'POST' }).catch(() => {})
          }
        }
      } catch {
        // Ignorar errores de abort
      }
    }

    poll()
    const intervalo = setInterval(poll, INTERVALO_POLLING)

    return () => {
      cancelado = true
      abortController.abort()
      clearInterval(intervalo)
    }
  }, [conversacionSeleccionada?.id])

  // ─── Polling de lista de conversaciones ───
  useEffect(() => {
    if (!configCargada) return
    let cancelado = false
    const abortController = new AbortController()

    const poll = async () => {
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

    const intervalo = setInterval(poll, INTERVALO_POLLING)
    return () => {
      cancelado = true
      abortController.abort()
      clearInterval(intervalo)
    }
  }, [construirParamsConversaciones, conversacionSeleccionada?.id, configCargada])

  // ─── Valores derivados ───
  const firmaCorreo = useMemo(() => {
    const canal = canalesCorreo.find(c => c.id === canalCorreoActivo)
    if (!canal) return undefined
    const config = canal.config_conexion as Record<string, unknown>
    return (config?.firma as string) || undefined
  }, [canalesCorreo, canalCorreoActivo])

  const emailCanalActivo = useMemo(() => {
    const canal = canalesCorreo.find(c => c.id === canalCorreoActivo)
    if (!canal) return ''
    const config = canal.config_conexion as { email?: string; usuario?: string }
    return config?.email || config?.usuario || ''
  }, [canalesCorreo, canalCorreoActivo])

  const totalNoLeidos = conversaciones.reduce((sum, c) => sum + c.mensajes_sin_leer, 0)

  return {
    // Traducciones y navegación
    t,
    router,

    // Estado principal
    tabActivo,
    setTabActivo,
    tabCambiadoManualRef,
    vistaWA,
    setVistaWA,
    modulosActivos,
    esMovil,

    // Conversaciones
    conversaciones,
    setConversaciones,
    conversacionSeleccionada,
    setConversacionSeleccionada,
    busqueda,
    setBusqueda,
    filtroEstado,
    setFiltroEstado,
    filtroEtiqueta,
    setFiltroEtiqueta,
    soloNoLeidos,
    setSoloNoLeidos,
    cargandoConversaciones,
    totalNoLeidos,
    seleccionarConversacion,
    cargarConversaciones,

    // Mensajes
    mensajes,
    setMensajes,
    cargandoMensajes,
    enviando,
    hayMasAnteriores,
    cargandoAnteriores,
    paginaMensajesRef,
    enviarMensaje,
    cargarMensajesAnteriores,
    reaccionarMensaje,

    // Canales internos
    canalesPublicos,
    setCanalesPublicos,
    canalesPrivados,
    setCanalesPrivados,
    canalesGrupos,
    setCanalesGrupos,
    canalInternoSeleccionado,
    setCanalInternoSeleccionado,
    modalCrearInterno,
    setModalCrearInterno,
    usuarioId,
    cargarCanalesInternos,

    // Panel info
    panelInfoAbierto,
    setPanelInfoAbierto,

    // Bot/IA
    iaHabilitada,
    botHabilitado,

    // Correo
    redactandoNuevo,
    setRedactandoNuevo,
    canalesCorreo,
    canalCorreoActivo,
    setCanalCorreoActivo,
    carpetaCorreo,
    setCarpetaCorreo,
    canalTodas,
    setCanalTodas,
    contadoresCorreo,
    sincronizando,
    sincronizarCorreos,
    modoVista,
    cambiarModoVista,
    sidebarCorreoColapsado,
    toggleSidebarCorreo,
    listaCorreoColapsada,
    toggleListaCorreo,
    enviarCorreo,
    programarCorreo,
    firmaCorreo,
    emailCanalActivo,

    // WhatsApp
    modalNuevoWA,
    setModalNuevoWA,
    canalWAId,
    enviarNuevoWhatsApp,

    // Acciones conversación
    marcarSpam,
    desmarcarSpam,
    toggleLeido,
    eliminarMultiples,
    eliminarConversacion,
    archivarConversacion,

    // Visor media
    todosLosMedias,
    visorAbierto,
    setVisorAbierto,
    visorIndice,
    setVisorIndice,
    abrirVisor,

    // Vistas móviles
    vistaMovilWA,
    setVistaMovilWA,
    vistaMovilCorreo,
    setVistaMovilCorreo,
    vistaMovilInterno,
    setVistaMovilInterno,

    // Redimensionado
    anchoLista,
    setAnchoLista,
    redimensionandoRef,
  }
}

/** Tipo de retorno del hook, útil para tipado de sub-componentes */
export type EstadoInbox = ReturnType<typeof useEstadoInbox>
