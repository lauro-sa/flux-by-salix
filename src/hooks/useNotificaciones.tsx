'use client'

import { createContext, useContext, useState, useEffect, useCallback, useRef, type ReactNode } from 'react'
import { crearClienteNavegador } from '@/lib/supabase/cliente'
import { sonidos } from '@/hooks/useSonido'
import type { RealtimeChannel } from '@supabase/supabase-js'

/**
 * Notificaciones — Provider centralizado + hook.
 *
 * Antes el hook se montaba 4 veces (Sidebar, MenuMovil, NotificacionesHeader,
 * ToastNotificacion) y cada instancia abría su propio canal Realtime + fetch
 * inicial. Eso multiplicaba el costo en Supabase. Ahora todo vive en un
 * Provider único; los consumidores leen del contexto y pueden suscribirse a
 * "nueva notificación" si necesitan reaccionar (toast, etc.).
 */

/* ─── Tipos ─── */

export type CategoriaNotificacion = 'inbox' | 'actividades' | 'sistema'

export interface Notificacion {
  id: string
  empresa_id: string
  usuario_id: string
  tipo: string
  titulo: string
  cuerpo?: string | null
  icono?: string | null
  color?: string | null
  url?: string | null
  leida: boolean
  referencia_tipo?: string | null
  referencia_id?: string | null
  creada_en: string
  tipo_etiqueta?: string | null
  tipo_color?: string | null
}

const MAPA_CATEGORIAS: Record<string, CategoriaNotificacion> = {
  nuevo_mensaje: 'inbox',
  mencion: 'inbox',
  sla_vencido: 'inbox',
  mensaje_whatsapp: 'inbox',
  mensaje_correo: 'inbox',
  mensaje_interno: 'inbox',

  actividad: 'actividades',
  asignacion: 'actividades',
  actividad_asignada: 'actividades',
  actividad_pronto_vence: 'actividades',
  actividad_vencida: 'actividades',
  recordatorio: 'actividades',
  recordatorio_evento: 'actividades',
  calendario: 'actividades',
  evento_asignado: 'actividades',

  cumpleanios_propio: 'sistema',
  cumpleanios_colega: 'sistema',
  anuncio: 'sistema',
  portal_vista: 'sistema',
  portal_aceptado: 'sistema',
  portal_rechazado: 'sistema',
  portal_cancelado: 'sistema',
  documento_estado: 'sistema',
  actualizacion: 'sistema',
  usuario_pendiente: 'sistema',
  fichaje_automatico: 'sistema',
}

function categorizarNotificacion(tipo: string): CategoriaNotificacion {
  return MAPA_CATEGORIAS[tipo] || 'sistema'
}

/* ─── Preferencias de notificación (localStorage) ─── */

const CLAVE_PREFS = 'flux_prefs_notificaciones'

export interface PrefsNotificacion {
  sonidoGlobal: boolean
  sonidoInbox: boolean
  sonidoActividades: boolean
  sonidoSistema: boolean
}

const PREFS_DEFAULT: PrefsNotificacion = {
  sonidoGlobal: true,
  sonidoInbox: true,
  sonidoActividades: true,
  sonidoSistema: true,
}

function leerPrefs(): PrefsNotificacion {
  if (typeof window === 'undefined') return PREFS_DEFAULT
  try {
    const raw = localStorage.getItem(CLAVE_PREFS)
    if (!raw) return PREFS_DEFAULT
    return { ...PREFS_DEFAULT, ...JSON.parse(raw) }
  } catch {
    return PREFS_DEFAULT
  }
}

function guardarPrefs(prefs: PrefsNotificacion) {
  if (typeof window === 'undefined') return
  localStorage.setItem(CLAVE_PREFS, JSON.stringify(prefs))
}

/* ─── Contexto ─── */

type SubscriberNueva = (n: Notificacion) => void

interface ValorContexto {
  notificaciones: Notificacion[]
  cargando: boolean
  cargandoMas: boolean
  error: string | null
  prefs: PrefsNotificacion
  actualizarPrefs: (n: Partial<PrefsNotificacion>) => void
  obtener: () => Promise<void>
  cargarMas: () => Promise<void>
  hayMas: boolean
  marcarLeidas: (ids: string[]) => Promise<void>
  marcarLeidasPorReferencia: (referenciaId: string) => Promise<void>
  marcarTodasLeidas: (categoria?: CategoriaNotificacion) => Promise<void>
  descartar: (id: string) => Promise<void>
  porCategoria: (categoria: CategoriaNotificacion) => Notificacion[]
  noLeidasPorCategoria: (categoria: CategoriaNotificacion) => number
  totalNoLeidas: number
  categorizarNotificacion: (tipo: string) => CategoriaNotificacion
  suscribirNueva: (cb: SubscriberNueva) => () => void
  /** Setter para que un consumidor (NotificacionesHeader) inyecte estaSilenciada */
  registrarEstaSilenciada: (fn: ((c: CategoriaNotificacion) => boolean) | null) => void
}

const ContextoNotificaciones = createContext<ValorContexto | null>(null)

interface PropsProveedor {
  children: ReactNode
  /** Si true, no monta canal Realtime ni fetch (vitrina, server-rendered, etc.) */
  deshabilitado?: boolean
}

function ProveedorNotificaciones({ children, deshabilitado = false }: PropsProveedor) {
  const [notificaciones, setNotificaciones] = useState<Notificacion[]>([])
  const [cargando, setCargando] = useState(false)
  const [cargandoMas, setCargandoMas] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [totalEnServidor, setTotalEnServidor] = useState(0)
  const [prefs, setPrefs] = useState<PrefsNotificacion>(PREFS_DEFAULT)

  const canalRef = useRef<RealtimeChannel | null>(null)
  const usuarioIdRef = useRef<string | null>(null)
  const subscribersRef = useRef<Set<SubscriberNueva>>(new Set())
  const estaSilenciadaRef = useRef<((c: CategoriaNotificacion) => boolean) | null>(null)
  const prefsRef = useRef(prefs)
  prefsRef.current = prefs

  /* Reconexión con backoff */
  const intentosReconexionRef = useRef(0)
  const timerReconexionRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  /* Cargar preferencias */
  useEffect(() => { setPrefs(leerPrefs()) }, [])

  const actualizarPrefs = useCallback((nuevas: Partial<PrefsNotificacion>) => {
    setPrefs((prev) => {
      const actualizadas = { ...prev, ...nuevas }
      guardarPrefs(actualizadas)
      return actualizadas
    })
  }, [])

  const reproducirSonido = useCallback((n: Notificacion) => {
    const p = prefsRef.current
    if (!p.sonidoGlobal) return
    const categoria = categorizarNotificacion(n.tipo)
    if (estaSilenciadaRef.current?.(categoria)) return
    if (categoria === 'inbox' && !p.sonidoInbox) return
    if (categoria === 'actividades' && !p.sonidoActividades) return
    if (categoria === 'sistema' && !p.sonidoSistema) return
    sonidos.notificacion()
  }, [])

  const obtener = useCallback(async () => {
    if (deshabilitado) return
    try {
      setCargando((prev) => prev || notificaciones.length === 0)
      const res = await fetch('/api/inbox/notificaciones?limite=50')
      if (!res.ok) throw new Error('Error al obtener notificaciones')
      const datos = await res.json()
      setNotificaciones(datos.notificaciones || [])
      setTotalEnServidor(datos.total || 0)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido')
    } finally {
      setCargando(false)
    }
  }, [deshabilitado, notificaciones.length])

  const cargarMas = useCallback(async () => {
    if (deshabilitado || cargandoMas) return
    try {
      setCargandoMas(true)
      const offset = notificaciones.length
      const res = await fetch(`/api/inbox/notificaciones?limite=50&offset=${offset}`)
      if (!res.ok) throw new Error('Error al cargar más notificaciones')
      const datos = await res.json()
      const nuevas = (datos.notificaciones || []) as Notificacion[]
      if (nuevas.length > 0) {
        setNotificaciones((prev) => {
          const idsExistentes = new Set(prev.map((n) => n.id))
          const sinDuplicados = nuevas.filter((n) => !idsExistentes.has(n.id))
          return [...prev, ...sinDuplicados]
        })
      }
      setTotalEnServidor(datos.total || 0)
    } catch {
      /* silencioso */
    } finally {
      setCargandoMas(false)
    }
  }, [deshabilitado, cargandoMas, notificaciones.length])

  const hayMas = notificaciones.length < totalEnServidor

  /* Fetch inicial + Supabase Realtime (UNA sola vez por sesión de app) */
  useEffect(() => {
    if (deshabilitado) return

    const supabase = crearClienteNavegador()

    const inicializar = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        usuarioIdRef.current = session?.user?.id || null
      } catch { /* silenciar */ }

      if (!usuarioIdRef.current) {
        try {
          const { data: { user } } = await supabase.auth.getUser()
          usuarioIdRef.current = user?.id || null
        } catch { /* silenciar */ }
      }

      await obtener()

      if (!usuarioIdRef.current) {
        setNotificaciones((prev) => {
          if (prev.length > 0 && prev[0].usuario_id) {
            usuarioIdRef.current = prev[0].usuario_id
          }
          return prev
        })
      }

      const uid = usuarioIdRef.current
      const canalRT = supabase
        .channel('notificaciones_realtime_global')
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'notificaciones',
            ...(uid ? { filter: `usuario_id=eq.${uid}` } : {}),
          },
          (payload) => {
            const nueva = payload.new as Notificacion
            if (usuarioIdRef.current && nueva.usuario_id !== usuarioIdRef.current) return
            setNotificaciones((prev) => {
              if (prev.some((n) => n.id === nueva.id)) return prev
              return [nueva, ...prev]
            })
            reproducirSonido(nueva)
            /* Notificar a todos los suscriptores (toasts, push, etc.) */
            subscribersRef.current.forEach((cb) => {
              try { cb(nueva) } catch { /* silenciar */ }
            })
          }
        )
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'notificaciones',
            ...(uid ? { filter: `usuario_id=eq.${uid}` } : {}),
          },
          (payload) => {
            const actualizada = payload.new as Notificacion
            setNotificaciones((prev) =>
              prev.map((n) => n.id === actualizada.id ? actualizada : n)
            )
          }
        )
        .on(
          'postgres_changes',
          {
            event: 'DELETE',
            schema: 'public',
            table: 'notificaciones',
          },
          (payload) => {
            const eliminadaId = (payload.old as { id: string }).id
            setNotificaciones((prev) => prev.filter((n) => n.id !== eliminadaId))
          }
        )
        .subscribe((estado) => {
          if (estado === 'SUBSCRIBED') {
            intentosReconexionRef.current = 0
          } else if (estado === 'CHANNEL_ERROR' || estado === 'TIMED_OUT') {
            const intento = intentosReconexionRef.current
            const delay = Math.min(2000 * Math.pow(2, intento), 30000)
            intentosReconexionRef.current = intento + 1

            if (timerReconexionRef.current) clearTimeout(timerReconexionRef.current)
            timerReconexionRef.current = setTimeout(() => {
              canalRef.current?.unsubscribe()
              canalRef.current = null
              obtener()
              inicializar()
            }, delay)
          }
        })

      canalRef.current = canalRT
    }

    inicializar()

    return () => {
      if (timerReconexionRef.current) clearTimeout(timerReconexionRef.current)
      canalRef.current?.unsubscribe()
      canalRef.current = null
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deshabilitado])

  /* Sincronización entre tabs/instancias de marcado como leído */
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail || {}
      const { referenciaId, ids, categoria } = detail as {
        referenciaId?: string
        ids?: string[]
        categoria?: CategoriaNotificacion
      }
      if (categoria) {
        setNotificaciones((prev) =>
          prev.map((n) => categorizarNotificacion(n.tipo) === categoria ? { ...n, leida: true } : n)
        )
      }
      if (referenciaId) {
        setNotificaciones((prev) =>
          prev.map((n) => n.referencia_id === referenciaId ? { ...n, leida: true } : n)
        )
      }
      if (ids?.length) {
        setNotificaciones((prev) =>
          prev.map((n) => ids.includes(n.id) ? { ...n, leida: true } : n)
        )
      }
    }
    window.addEventListener('flux:notificaciones-leidas', handler)
    return () => window.removeEventListener('flux:notificaciones-leidas', handler)
  }, [])

  const marcarLeidas = useCallback(async (ids: string[]) => {
    try {
      await fetch('/api/inbox/notificaciones', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids }),
      })
      setNotificaciones((prev) =>
        prev.map((n) => ids.includes(n.id) ? { ...n, leida: true } : n)
      )
      window.dispatchEvent(new CustomEvent('flux:notificaciones-leidas', { detail: { ids } }))
    } catch {
      /* silencioso */
    }
  }, [])

  const marcarTodasLeidas = useCallback(async (categoria?: CategoriaNotificacion) => {
    if (categoria) {
      const ids = notificaciones
        .filter((n) => !n.leida && categorizarNotificacion(n.tipo) === categoria)
        .map((n) => n.id)
      if (ids.length > 0) await marcarLeidas(ids)
    } else {
      try {
        await fetch('/api/inbox/notificaciones', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ todas: true }),
        })
        setNotificaciones((prev) => prev.map((n) => ({ ...n, leida: true })))
      } catch {
        /* silencioso */
      }
    }
  }, [notificaciones, marcarLeidas])

  const marcarLeidasPorReferencia = useCallback(async (referenciaId: string) => {
    try {
      await fetch('/api/inbox/notificaciones', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ referencia_id: referenciaId }),
      })
      setNotificaciones((prev) =>
        prev.map((n) => n.referencia_id === referenciaId ? { ...n, leida: true } : n)
      )
      window.dispatchEvent(new CustomEvent('flux:notificaciones-leidas', { detail: { referenciaId } }))
    } catch {
      /* silencioso */
    }
  }, [])

  const descartar = useCallback(async (id: string) => {
    await marcarLeidas([id])
    setNotificaciones((prev) => prev.filter((n) => n.id !== id))
  }, [marcarLeidas])

  const porCategoria = useCallback((categoria: CategoriaNotificacion) => {
    return notificaciones.filter((n) => categorizarNotificacion(n.tipo) === categoria)
  }, [notificaciones])

  const noLeidasPorCategoria = useCallback((categoria: CategoriaNotificacion) => {
    return notificaciones.filter(
      (n) => !n.leida && categorizarNotificacion(n.tipo) === categoria
    ).length
  }, [notificaciones])

  const totalNoLeidas = notificaciones.filter((n) => !n.leida).length

  /* Suscripción para reaccionar a notificaciones nuevas (toasts, etc.) */
  const suscribirNueva = useCallback((cb: SubscriberNueva) => {
    subscribersRef.current.add(cb)
    return () => { subscribersRef.current.delete(cb) }
  }, [])

  const registrarEstaSilenciada = useCallback(
    (fn: ((c: CategoriaNotificacion) => boolean) | null) => {
      estaSilenciadaRef.current = fn
    },
    []
  )

  const valor: ValorContexto = {
    notificaciones,
    cargando,
    cargandoMas,
    error,
    prefs,
    actualizarPrefs,
    obtener,
    cargarMas,
    hayMas,
    marcarLeidas,
    marcarLeidasPorReferencia,
    marcarTodasLeidas,
    descartar,
    porCategoria,
    noLeidasPorCategoria,
    totalNoLeidas,
    categorizarNotificacion,
    suscribirNueva,
    registrarEstaSilenciada,
  }

  return (
    <ContextoNotificaciones.Provider value={valor}>
      {children}
    </ContextoNotificaciones.Provider>
  )
}

/* ─── Hook público ─── */

interface OpcionesNotificaciones {
  /** Callback al llegar una notificación nueva. Se suscribe al provider. */
  onNueva?: (n: Notificacion) => void
  /** Si el modo concentración está activo para cierta categoría. Se registra en el provider. */
  estaSilenciada?: (categoria: CategoriaNotificacion) => boolean
}

function useNotificaciones(opciones: OpcionesNotificaciones = {}) {
  const ctx = useContext(ContextoNotificaciones)
  if (!ctx) throw new Error('useNotificaciones debe usarse dentro de <ProveedorNotificaciones>')

  const { onNueva, estaSilenciada } = opciones
  const onNuevaRef = useRef(onNueva)
  onNuevaRef.current = onNueva

  /* Si el caller pasa onNueva, lo suscribimos al provider */
  useEffect(() => {
    if (!onNueva) return
    return ctx.suscribirNueva((n) => onNuevaRef.current?.(n))
  }, [ctx, onNueva])

  /* Si el caller pasa estaSilenciada, lo registra como fuente de silenciado */
  useEffect(() => {
    if (!estaSilenciada) return
    ctx.registrarEstaSilenciada(estaSilenciada)
    return () => { ctx.registrarEstaSilenciada(null) }
  }, [ctx, estaSilenciada])

  return ctx
}

export {
  ProveedorNotificaciones,
  useNotificaciones,
  categorizarNotificacion,
  leerPrefs,
  guardarPrefs,
  PREFS_DEFAULT,
}
