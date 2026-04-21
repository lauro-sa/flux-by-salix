'use client'

import { useState, useCallback, useEffect, useRef, useMemo } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { crearClienteNavegador } from '@/lib/supabase/cliente'
import { useToast } from '@/componentes/feedback/Toast'
import { useEsMovil } from '@/hooks/useEsMovil'
import { sonidos } from '@/hooks/useSonido'
import { useEscucharReactivacion } from '@/hooks/useReactivacionPWA'
import type {
  EstadoConversacion, ConversacionConDetalles,
  MensajeConAdjuntos, VistaMovilWA,
} from '@/tipos/inbox'
import type { DatosMensaje } from '@/componentes/mensajeria/CompositorMensaje'
import type { MediaVisor } from './PanelWhatsApp'
import { useTraduccion } from '@/lib/i18n'
import { DEBOUNCE_BUSQUEDA, INTERVALO_POLLING } from '@/lib/constantes/timeouts'

/**
 * Hook principal de WhatsApp — centraliza estado, data fetching,
 * realtime, polling y acciones de la sección WhatsApp independiente.
 * Extraído de useEstadoInbox para desacoplar WhatsApp como módulo propio.
 */

export function useEstadoWhatsApp() {
  const { t } = useTraduccion()
  const router = useRouter()
  const searchParams = useSearchParams()
  const { mostrar } = useToast()
  const supabase = useMemo(() => crearClienteNavegador(), [])

  // ─── Estado principal ───
  const abriendoDesdeUrlRef = useRef(false)
  const [vistaWA, setVistaWA] = useState<'conversaciones' | 'pipeline'>('conversaciones')
  const [configCargada, setConfigCargada] = useState(false)

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

  // Panel info contacto
  const [panelInfoAbierto, setPanelInfoAbierto] = useState(false)

  // Bot/IA habilitados
  const [iaHabilitada, setIaHabilitada] = useState(false)
  const [botHabilitado, setBotHabilitado] = useState(false)

  // WhatsApp: modal nuevo mensaje + canal WA
  const [modalNuevoWA, setModalNuevoWA] = useState(false)
  const [canalWAId, setCanalWAId] = useState<string>('')
  const [usuarioId, setUsuarioId] = useState<string>('')

  // Ancho de la lista de conversaciones (redimensionable, persistido)
  const [anchoLista, setAnchoLista] = useState(340)
  const redimensionandoRef = useRef(false)
  useEffect(() => {
    const guardado = localStorage.getItem('flux_wa_ancho_lista')
    if (guardado) setAnchoLista(parseInt(guardado))
  }, [])

  // ─── Responsive ───
  const esMovil = useEsMovil()
  const [vistaMovilWA, setVistaMovilWA] = useState<VistaMovilWA>('lista')

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

  // ─── Cargar config ───
  useEffect(() => {
    const cargarConfig = async () => {
      try {
        const [resChatbot, resAgente] = await Promise.all([
          fetch('/api/inbox/chatbot').then(r => r.json()).catch(() => ({ config: null })),
          fetch('/api/inbox/agente-ia/config').then(r => r.json()).catch(() => ({ config: null })),
        ])
        setBotHabilitado(resChatbot.config?.activo ?? false)
        setIaHabilitada(resAgente.config?.activo ?? false)
      } catch { /* Si falla, quedan en false */ }
      setConfigCargada(true)
    }
    cargarConfig()
  }, [])

  // Cargar canal WhatsApp activo
  useEffect(() => {
    if (!configCargada) return
    fetch('/api/whatsapp/canales')
      .then(r => r.json())
      .then(data => {
        const canales = data.canales || []
        if (canales.length > 0) setCanalWAId(canales[0].id)
      })
      .catch(() => {})
  }, [configCargada])

  // ─── Params de filtro para conversaciones ───
  const construirParamsConversaciones = useCallback(() => {
    const params = new URLSearchParams()
    params.set('tipo_canal', 'whatsapp')
    if (filtroEstado !== 'todas') params.set('estado', filtroEstado)
    if (busquedaRef.current) params.set('busqueda', busquedaRef.current)
    if (filtroEtiqueta) params.set('etiqueta', filtroEtiqueta)
    if (soloNoLeidos) params.set('no_leidos', 'true')
    return params
  }, [filtroEstado, filtroEtiqueta, soloNoLeidos])

  // ─── Cargar conversaciones ───
  const cargarConversaciones = useCallback(async () => {
    if (!configCargada) return
    if (abriendoDesdeUrlRef.current) return
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
  }, [construirParamsConversaciones, configCargada])

  useEffect(() => {
    cargarConversaciones()
  }, [cargarConversaciones])

  // ─── Abrir conversación desde URL (?conv=xxx) ───
  const convParamAnteriorRef = useRef<string | null>(null)
  useEffect(() => {
    const convId = searchParams.get('conv')
    if (!convId) return
    if (convParamAnteriorRef.current === convId) return
    convParamAnteriorRef.current = convId
    abriendoDesdeUrlRef.current = true

    const abrirDesdeUrl = async () => {
      try {
        setCargandoMensajes(true)
        const [resConv, resMsgs] = await Promise.all([
          fetch(`/api/inbox/conversaciones/${convId}`),
          fetch(`/api/inbox/mensajes?conversacion_id=${convId}&por_pagina=200`),
        ])

        const dataConv = await resConv.json()
        const conv = dataConv.conversacion
        if (!conv) return

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

        const params = new URLSearchParams()
        params.set('tipo_canal', 'whatsapp')
        try {
          const resList = await fetch(`/api/inbox/conversaciones?${params}`)
          const dataList = await resList.json()
          setConversaciones(dataList.conversaciones || [])
        } catch { /* silenciar */ }
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

  // Obtener userId
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) setUsuarioId(data.user.id)
    })
  }, [supabase])

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
    const conv = conversaciones.find(c => c.id === id) || null
    setConversacionSeleccionada(conv)
    if (!conv) return

    if (esMovil) setVistaMovilWA('chat')

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
  }, [conversaciones, marcarNotificacionesLeidasDeConversacion, esMovil])

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
      .channel(`wa-mensajes-${convId}`)
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
  }, [conversacionSeleccionada?.id, supabase, reactivacion])

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
        const path = `whatsapp/enviados/${conversacionSeleccionada.id}/${Date.now()}_${nombreArchivo}`

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

      // Notas internas
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

      // Enviar por WhatsApp
      const tipoMeta: Record<string, string> = {
        texto: 'text', imagen: 'image', video: 'video',
        audio: 'audio', documento: 'document',
      }

      const res = await fetch('/api/whatsapp/enviar', {
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
    } catch {
      setMensajes(prev => prev.map(m =>
        m.id === tempId ? { ...m, wa_status: 'failed', estado: 'fallido' as const } : m
      ))
    } finally {
      setEnviando(false)
    }
  }, [conversacionSeleccionada, supabase, usuarioId])

  // ─── Enviar nuevo WhatsApp (plantilla) ───
  const enviarNuevoWhatsApp = useCallback(async (telefono: string, plantilla: import('@/tipos/whatsapp').PlantillaWhatsApp, valoresVariables: string[]) => {
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

    const resEnvio = await fetch('/api/whatsapp/enviar', {
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
      await fetch('/api/whatsapp/reaccion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversacion_id: conversacionSeleccionada?.id,
          mensaje_id: mensajeId,
          emoji: emoji,
        }),
      })
    } catch { /* silenciar */ }
  }, [usuarioId, conversacionSeleccionada])

  // ─── Acciones de conversación ───
  const eliminarMultiples = useCallback(async (ids: string[]) => {
    let errores = 0
    for (const id of ids) {
      try {
        await fetch(`/api/inbox/conversaciones/${id}`, { method: 'DELETE' })
      } catch { errores++ }
    }
    setConversaciones(prev => prev.filter(c => !ids.includes(c.id)))
    if (conversacionSeleccionada && ids.includes(conversacionSeleccionada.id)) {
      setConversacionSeleccionada(null)
      setMensajes([])
    }
    if (errores > 0) {
      mostrar('advertencia', `${ids.length - errores} de ${ids.length} eliminadas (${errores} fallaron)`)
    } else {
      mostrar('exito', `${ids.length} conversación${ids.length > 1 ? 'es' : ''} eliminada${ids.length > 1 ? 's' : ''}`)
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
            fetch('/api/whatsapp/media-pendiente', { method: 'POST' }).catch(() => {})
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
  const totalNoLeidos = conversaciones.reduce((sum, c) => sum + c.mensajes_sin_leer, 0)

  return {
    t,
    router,

    // Vista
    vistaWA,
    setVistaWA,
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

    // Panel info
    panelInfoAbierto,
    setPanelInfoAbierto,

    // Bot/IA
    iaHabilitada,
    botHabilitado,

    // WhatsApp
    modalNuevoWA,
    setModalNuevoWA,
    canalWAId,
    enviarNuevoWhatsApp,

    // Acciones conversación
    eliminarMultiples,

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

    // Redimensionado
    anchoLista,
    setAnchoLista,
    redimensionandoRef,
  }
}

export type EstadoWhatsApp = ReturnType<typeof useEstadoWhatsApp>
