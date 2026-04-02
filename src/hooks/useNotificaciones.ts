'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { crearClienteNavegador } from '@/lib/supabase/cliente'
import { sonidos } from '@/hooks/useSonido'
import type { RealtimeChannel } from '@supabase/supabase-js'

/**
 * useNotificaciones — Hook para notificaciones en tiempo real.
 * Fetch inicial vía API + Supabase Realtime para inserts instantáneos.
 * Reproduce sonido al llegar una nueva notificación (respeta modo concentración y config).
 * Se usa en: Header (3 popovers de notificaciones).
 */

/* ─── Tipos ─── */

/** Categoría de notificación (para separar en los 3 popovers) */
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
}

/* Mapeo de tipo de notificación → categoría */
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
  calendario: 'actividades',

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
}

function categorizarNotificacion(tipo: string): CategoriaNotificacion {
  return MAPA_CATEGORIAS[tipo] || 'sistema'
}

/* ─── Preferencias de notificación (localStorage) ─── */

const CLAVE_PREFS = 'flux_prefs_notificaciones'

export interface PrefsNotificacion {
  /** Sonido global habilitado */
  sonidoGlobal: boolean
  /** Sonido por categoría */
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

/* ─── Opciones del hook ─── */

interface OpcionesNotificaciones {
  /** Deshabilitar fetch automático (útil para la vitrina) */
  deshabilitado?: boolean
  /** Callback cuando llega una notificación nueva (para integrar con modo concentración) */
  onNueva?: (n: Notificacion) => void
  /** Si el modo concentración está activo para cierta categoría */
  estaSilenciada?: (categoria: CategoriaNotificacion) => boolean
}

/* Contador global para generar nombres de canal únicos por instancia */
let contadorInstancia = 0

function useNotificaciones(opciones: OpcionesNotificaciones = {}) {
  const { deshabilitado = false, onNueva, estaSilenciada } = opciones

  const [notificaciones, setNotificaciones] = useState<Notificacion[]>([])
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [prefs, setPrefs] = useState<PrefsNotificacion>(PREFS_DEFAULT)
  const canalRef = useRef<RealtimeChannel | null>(null)

  /* Refs para evitar closures stale en el callback de Realtime */
  const onNuevaRef = useRef(onNueva)
  onNuevaRef.current = onNueva
  const estaSilenciadaRef = useRef(estaSilenciada)
  estaSilenciadaRef.current = estaSilenciada
  const prefsRef = useRef(prefs)
  prefsRef.current = prefs

  /* ID único por instancia del hook (para nombre de canal Realtime) */
  const instanciaIdRef = useRef<number>(0)
  if (instanciaIdRef.current === 0) {
    contadorInstancia += 1
    instanciaIdRef.current = contadorInstancia
  }

  /* Cargar preferencias */
  useEffect(() => { setPrefs(leerPrefs()) }, [])

  /* Actualizar preferencias */
  const actualizarPrefs = useCallback((nuevas: Partial<PrefsNotificacion>) => {
    setPrefs((prev) => {
      const actualizadas = { ...prev, ...nuevas }
      guardarPrefs(actualizadas)
      return actualizadas
    })
  }, [])

  /* Reproducir sonido si corresponde (usa refs para valores frescos) */
  const reproducirSonido = useCallback((n: Notificacion) => {
    const p = prefsRef.current
    if (!p.sonidoGlobal) return
    const categoria = categorizarNotificacion(n.tipo)

    /* Respetar modo concentración */
    if (estaSilenciadaRef.current?.(categoria)) return

    /* Respetar config por categoría */
    if (categoria === 'inbox' && !p.sonidoInbox) return
    if (categoria === 'actividades' && !p.sonidoActividades) return
    if (categoria === 'sistema' && !p.sonidoSistema) return

    sonidos.notificacion()
  }, [])

  /* Obtener notificaciones (fetch inicial) */
  const obtener = useCallback(async () => {
    if (deshabilitado) return
    try {
      setCargando((prev) => prev || notificaciones.length === 0)
      const res = await fetch('/api/inbox/notificaciones?limite=50')
      if (!res.ok) throw new Error('Error al obtener notificaciones')
      const datos = await res.json()
      setNotificaciones(datos.notificaciones || [])
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido')
    } finally {
      setCargando(false)
    }
  }, [deshabilitado, notificaciones.length])

  /* Ref persistente para el ID del usuario actual */
  const usuarioIdRef = useRef<string | null>(null)

  /* Fetch inicial + Supabase Realtime */
  useEffect(() => {
    if (deshabilitado) return

    const supabase = crearClienteNavegador()

    /* Obtener user ID de forma rápida (sesión en cache) + fetch de notificaciones */
    const inicializar = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        usuarioIdRef.current = session?.user?.id || null
      } catch { /* silenciar */ }

      /* Si no se pudo obtener de sesión, intentar con getUser */
      if (!usuarioIdRef.current) {
        try {
          const { data: { user } } = await supabase.auth.getUser()
          usuarioIdRef.current = user?.id || null
        } catch { /* silenciar */ }
      }

      await obtener()

      /* Extraer user ID de las notificaciones cargadas como último recurso */
      if (!usuarioIdRef.current) {
        setNotificaciones((prev) => {
          if (prev.length > 0 && prev[0].usuario_id) {
            usuarioIdRef.current = prev[0].usuario_id
          }
          return prev
        })
      }

      /* Suscribirse a cambios en la tabla notificaciones */
      const uid = usuarioIdRef.current
      const nombreCanal = `notificaciones_realtime_${instanciaIdRef.current}`
      const canalRT = supabase
        .channel(nombreCanal)
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
            /* Filtrar notificaciones de otros usuarios (seguridad client-side) */
            if (usuarioIdRef.current && nueva.usuario_id !== usuarioIdRef.current) return
            setNotificaciones((prev) => {
              if (prev.some((n) => n.id === nueva.id)) return prev
              return [nueva, ...prev]
            })
            reproducirSonido(nueva)
            onNuevaRef.current?.(nueva)
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
        .subscribe()

      canalRef.current = canalRT
    }

    inicializar()

    return () => {
      canalRef.current?.unsubscribe()
      canalRef.current = null
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deshabilitado])

  /* Marcar como leídas */
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
    } catch {
      /* silencioso */
    }
  }, [])

  /* Marcar todas como leídas */
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

  /* Descartar */
  const descartar = useCallback(async (id: string) => {
    await marcarLeidas([id])
    setNotificaciones((prev) => prev.filter((n) => n.id !== id))
  }, [marcarLeidas])

  /* Filtrar por categoría */
  const porCategoria = useCallback((categoria: CategoriaNotificacion) => {
    return notificaciones.filter((n) => categorizarNotificacion(n.tipo) === categoria)
  }, [notificaciones])

  /* Contadores */
  const noLeidasPorCategoria = useCallback((categoria: CategoriaNotificacion) => {
    return notificaciones.filter(
      (n) => !n.leida && categorizarNotificacion(n.tipo) === categoria
    ).length
  }, [notificaciones])

  const totalNoLeidas = notificaciones.filter((n) => !n.leida).length

  return {
    notificaciones,
    cargando,
    error,
    prefs,
    actualizarPrefs,
    obtener,
    marcarLeidas,
    marcarTodasLeidas,
    descartar,
    porCategoria,
    noLeidasPorCategoria,
    totalNoLeidas,
    categorizarNotificacion,
  }
}

export { useNotificaciones, categorizarNotificacion, leerPrefs, guardarPrefs, PREFS_DEFAULT }
