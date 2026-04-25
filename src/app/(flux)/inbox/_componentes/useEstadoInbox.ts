'use client'

import { useState, useCallback, useEffect, useRef, useMemo } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { crearClienteNavegador } from '@/lib/supabase/cliente'
import { useToast } from '@/componentes/feedback/Toast'
import { useEsMovil } from '@/hooks/useEsMovil'
import { useEscucharReactivacion } from '@/hooks/useReactivacionPWA'
import type {
  TipoCanal, EstadoConversacion, ConversacionConDetalles,
  MensajeConAdjuntos, CanalInterno, CanalMensajeria, ModuloEmpresa,
} from '@/tipos/inbox'
import type { DatosMensaje } from '@/componentes/mensajeria/CompositorMensaje'
import type { DatosCorreo } from './CompositorCorreo'
import type { CarpetaCorreo } from './SidebarCorreo'
import { useTraduccion } from '@/lib/i18n'
import { DEBOUNCE_BUSQUEDA, INTERVALO_HEARTBEAT, INTERVALO_POLLING } from '@/lib/constantes/timeouts'

/**
 * Hook principal del Inbox — centraliza estado de Correo e Interno.
 * WhatsApp se separó a su propio hook (useEstadoWhatsApp) en /whatsapp.
 */

export type ModoVista = 'columna' | 'fila'
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
  const [tabActivo, setTabActivo] = useState<TipoCanal>('correo')
  const [configCargada, setConfigCargada] = useState(false)
  const [modulosActivos, setModulosActivos] = useState<Set<string>>(
    new Set(['inbox_correo', 'inbox_interno'])
  )

  // Conversaciones
  const [conversaciones, setConversaciones] = useState<ConversacionConDetalles[]>([])
  const [conversacionSeleccionada, setConversacionSeleccionada] = useState<ConversacionConDetalles | null>(null)
  const [busqueda, setBusqueda] = useState('')
  const [filtroEstado, setFiltroEstado] = useState<EstadoConversacion | 'todas'>('todas')
  const [soloNoLeidos, setSoloNoLeidos] = useState(false)
  const [cargandoConversaciones, setCargandoConversaciones] = useState(false)

  // Mensajes
  const [mensajes, setMensajes] = useState<MensajeConAdjuntos[]>([])
  const [cargandoMensajes, setCargandoMensajes] = useState(false)
  const [enviando, setEnviando] = useState(false)
  const paginaMensajesRef = useRef(1)

  // Canales internos
  const [canalesPublicos, setCanalesPublicos] = useState<CanalInterno[]>([])
  const [canalesPrivados, setCanalesPrivados] = useState<CanalInterno[]>([])
  const [canalesGrupos, setCanalesGrupos] = useState<CanalInterno[]>([])
  const [canalInternoSeleccionado, setCanalInternoSeleccionado] = useState<CanalInterno | null>(null)
  const [modalCrearInterno, setModalCrearInterno] = useState(false)
  const [usuarioId, setUsuarioId] = useState<string>('')

  // Correo
  const [redactandoNuevo, setRedactandoNuevo] = useState(false)
  // Destinatarios precargados cuando se abre el compositor desde una acción
  // rápida (ej. `/inbox?nuevo=1&para=juan@ejemplo.com&tab=correo`). Se pasa
  // a CompositorCorreo como `paraInicial` y luego se limpia.
  const [paraRedactarNuevo, setParaRedactarNuevo] = useState<string[]>([])
  const [canalesCorreo, setCanalesCorreo] = useState<CanalMensajeria[]>([])
  const [canalCorreoActivo, setCanalCorreoActivo] = useState<string>('')
  const [carpetaCorreo, setCarpetaCorreo] = useState<CarpetaCorreo>('entrada')
  const [canalTodas, setCanalTodas] = useState(false)
  const [contadoresCorreo, setContadoresCorreo] = useState<Record<string, { entrada: number; spam: number }>>({})
  const [sincronizando, setSincronizando] = useState(false)
  const [ultimoSync, setUltimoSync] = useState<Date | null>(null)

  // Modo de vista correo
  const [modoVista, setModoVista] = useState<ModoVista>(() => {
    if (typeof window === 'undefined') return 'columna'
    return (localStorage.getItem('flux_inbox_modo_vista') as ModoVista) || 'columna'
  })

  const cambiarModoVista = useCallback((modo: ModoVista) => {
    setModoVista(modo)
    localStorage.setItem('flux_inbox_modo_vista', modo)
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
  const [vistaMovilCorreo, setVistaMovilCorreo] = useState<VistaMovilCorreo>('sidebar')
  const [vistaMovilInterno, setVistaMovilInterno] = useState<VistaMovilInterno>('canales')

  useEffect(() => {
    setVistaMovilCorreo('sidebar')
    setVistaMovilInterno('canales')
  }, [tabActivo])

  const busquedaRef = useRef(busqueda)
  busquedaRef.current = busqueda

  // ─── Cargar config de empresa ───
  useEffect(() => {
    const cargarConfig = async () => {
      try {
        const res = await fetch('/api/correo/config')
        const data = await res.json()

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
              if (activos.has('inbox_correo')) setTabActivo('correo')
              else if (activos.has('inbox_interno')) setTabActivo('interno')
            }
          }
        }
      } catch {
        // Si falla, mantener defaults
      } finally {
        setConfigCargada(true)
      }
    }
    cargarConfig()
  }, [])

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
    if (soloNoLeidos) params.set('no_leidos', 'true')
    return params
  }, [tabActivo, filtroEstado, soloNoLeidos, carpetaCorreo, canalCorreoActivo, canalTodas])

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
      if (tabParam === 'interno' || tabParam === 'correo') {
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
        if (tabParam === 'interno' || tabParam === 'correo') {
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
          if (tipoCanal && tipoCanal !== 'whatsapp') setTabActivo(tipoCanal)

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
        setCargandoMensajes(false)

        marcarNotificacionesLeidasDeConversacion(convId)

        window.history.replaceState({}, '', window.location.pathname)
        convParamAnteriorRef.current = null

        abriendoDesdeUrlRef.current = false
        const tabFinal = tabParam || (conv.tipo_canal || conv.canal?.tipo) as string
        if (tabFinal && tabFinal !== 'whatsapp') {
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

  // ─── Abrir compositor de correo desde URL (?nuevo=1&para=<correo>&tab=correo) ───
  // Usado por las acciones rápidas (panel Salix IA → "Redactar en Flux").
  // Cambia al tab correo, abre el compositor y precarga el destinatario.
  // Validamos el formato del correo para evitar precargar basura desde un
  // link manipulado (no es XSS — React escapa — pero sí evita ruido en UI).
  const nuevoParamAnteriorRef = useRef<string | null>(null)
  useEffect(() => {
    const nuevoParam = searchParams.get('nuevo')
    const paraParam = searchParams.get('para')
    if (nuevoParam !== '1' || !paraParam) return
    if (nuevoParamAnteriorRef.current === paraParam) return

    // Validación liviana de formato email (no exhaustiva, solo descarta basura).
    const esEmailValido = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(paraParam) && paraParam.length <= 254
    if (!esEmailValido) {
      // Limpiar la URL para que el ?para inválido no quede pegado
      window.history.replaceState({}, '', window.location.pathname)
      return
    }

    nuevoParamAnteriorRef.current = paraParam

    setTabActivo('correo')
    setConversacionSeleccionada(null)
    setMensajes([])
    setParaRedactarNuevo([paraParam])
    setRedactandoNuevo(true)

    window.history.replaceState({}, '', window.location.pathname)
    nuevoParamAnteriorRef.current = null
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
        const res = await fetch('/api/correo/canales')
        const data = await res.json()
        const canales = (data.canales || []) as CanalMensajeria[]
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
      setUltimoSync(new Date())
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
      if (tabActivo === 'correo') setVistaMovilCorreo('correo')
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
    } catch {
      setMensajes([])
    } finally {
      setCargandoMensajes(false)
    }
  }, [conversaciones, marcarNotificacionesLeidasDeConversacion, esMovil, tabActivo])

  // Contador para forzar re-suscripción del canal al volver del background
  const [reactivacion, setReactivacion] = useState(0)
  useEscucharReactivacion(useCallback(() => {
    setReactivacion(v => v + 1)
  }, []))

  // ─── Realtime: escuchar mensajes nuevos ───
  useEffect(() => {
    const convId = conversacionSeleccionada?.id
    if (!convId) return
    void reactivacion // fuerza re-suscripción al volver del background

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
      .subscribe()

    return () => {
      supabase.removeChannel(canal)
    }
  }, [conversacionSeleccionada?.id, supabase, reactivacion])

  // ─── Enviar mensaje (interno) ───
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
      wa_message_id: null, wa_status: null, wa_tipo_mensaje: null,
      respuesta_a_id: null, hilo_raiz_id: null, cantidad_respuestas: 0,
      reacciones: {},
      metadata: {},
      estado: 'enviado' as const,
      error_envio: null,
      plantilla_id: null,
      creado_en: new Date().toISOString(),
      editado_en: null, eliminado_en: null,
      adjuntos: [],
    }

    setMensajes(prev => [...prev, mensajeOptimista])

    try {
      const res = await fetch('/api/inbox/mensajes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversacion_id: conversacionSeleccionada.id,
          texto: datos.texto,
          tipo_contenido: datos.tipo_contenido,
          es_nota_interna: datos.es_nota_interna || false,
        }),
      })
      const data = await res.json()
      if (data.mensaje) {
        setMensajes(prev => prev.map(m =>
          m.id === tempId ? { ...data.mensaje, adjuntos: [] } : m
        ))
      }
    } catch {
      setMensajes(prev => prev.filter(m => m.id !== tempId))
    } finally {
      setEnviando(false)
    }
  }, [conversacionSeleccionada, usuarioId])

  // ─── Reaccionar a mensaje (interno) ───
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
      await fetch(`/api/inbox/mensajes/${mensajeId}/reaccion`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ emoji }),
      })
    } catch { /* silenciar */ }
  }, [usuarioId])

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
    t,
    router,

    // Estado principal
    tabActivo,
    setTabActivo,
    tabCambiadoManualRef,
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
    paginaMensajesRef,
    enviarMensaje,
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

    // Correo
    redactandoNuevo,
    setRedactandoNuevo,
    paraRedactarNuevo,
    setParaRedactarNuevo,
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
    ultimoSync,
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

    // Acciones conversación
    marcarSpam,
    desmarcarSpam,
    toggleLeido,
    eliminarMultiples,
    eliminarConversacion,
    archivarConversacion,

    // Vistas móviles
    vistaMovilCorreo,
    setVistaMovilCorreo,
    vistaMovilInterno,
    setVistaMovilInterno,
  }
}

export type EstadoInbox = ReturnType<typeof useEstadoInbox>
