'use client'

import { createContext, useContext, useState, useEffect, useCallback, useRef, type ReactNode } from 'react'
import { useAuth } from './useAuth'

/**
 * Hook y proveedor de preferencias de usuario por dispositivo.
 * Sincroniza tema, efecto, escala y config del sidebar con la BD.
 * Genera un ID de dispositivo estable (hash del userAgent + screen).
 * Fallback a localStorage si no hay sesión.
 * Se usa en: useTema, Sidebar, layout.
 */

/** Config guardada de una tabla específica */
interface ConfigTabla {
  columnasVisibles?: string[]
  ordenColumnas?: string[]
  columnasAncladas?: string[]
  anchoColumnas?: Record<string, number>
  alineacionColumnas?: Record<string, string>
  tipoVista?: string
  opcionesVisuales?: Record<string, boolean>
  /** Posición de la barra de acciones masivas: arriba o abajo */
  barraAccionesPosicion?: string
  /** Permite campos extra para configs especiales (ej: __inbox_correo) */
  [clave: string]: unknown
}

interface Preferencias {
  tema: string
  efecto: string
  fondo_cristal: string
  escala: string
  sidebar_orden: Record<string, string[]> | null
  sidebar_ocultos: string[] | null
  sidebar_deshabilitados: string[] | null
  sidebar_colapsado: boolean
  /** Modo auto-ocultar: sidebar siempre colapsado, se expande al hover. Anula sidebar_secciones */
  sidebar_auto_ocultar: boolean
  /** Estado del sidebar por sección: { "/inbox": true, "/contactos": false } (true = colapsado) */
  sidebar_secciones: Record<string, boolean>
  /** Config de tablas por módulo: { usuarios: {...}, contactos: {...} } */
  config_tablas: Record<string, ConfigTabla>
  /** Admin/propietario: recibir todas las notificaciones aunque no estés asignado */
  recibir_todas_notificaciones: boolean
  /** Secciones donde el chatter NO se ancla al costado. ['*'] = ninguna sección. ['presupuestos'] = solo esa */
  chatter_sin_lateral: string[]
  /** Auto-colapsar sidebar principal en páginas con menú secundario (configuración, mi-cuenta, etc.) */
  sidebar_auto_colapsar_config: boolean
}

interface ContextoPreferencias {
  preferencias: Preferencias
  cargando: boolean
  guardar: (cambios: Partial<Preferencias>) => void
}

const DEFAULTS: Preferencias = {
  tema: 'sistema',
  efecto: 'solido',
  fondo_cristal: 'aurora',
  escala: 'normal',
  sidebar_orden: null,
  sidebar_ocultos: null,
  sidebar_deshabilitados: null,
  sidebar_colapsado: false,
  sidebar_auto_ocultar: false,
  sidebar_secciones: {},
  config_tablas: {},
  recibir_todas_notificaciones: false,
  chatter_sin_lateral: [],
  sidebar_auto_colapsar_config: true,
}

const CLAVE_DISPOSITIVO = 'flux_dispositivo_id'
const CLAVE_PREFS_LOCAL = 'flux_preferencias'

/** Genera un ID de dispositivo estable basado en características del browser */
function obtenerDispositivoId(): string {
  if (typeof window === 'undefined') return 'ssr'

  // Intentar recuperar uno existente
  const existente = localStorage.getItem(CLAVE_DISPOSITIVO)
  if (existente) return existente

  // Generar uno nuevo basado en características del dispositivo
  const datos = [
    navigator.userAgent,
    screen.width,
    screen.height,
    screen.colorDepth,
    Intl.DateTimeFormat().resolvedOptions().timeZone,
  ].join('|')

  // Hash simple pero estable
  let hash = 0
  for (let i = 0; i < datos.length; i++) {
    const char = datos.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash |= 0
  }

  const id = `dev_${Math.abs(hash).toString(36)}`
  localStorage.setItem(CLAVE_DISPOSITIVO, id)
  return id
}

const ContextoPreferenciasInterno = createContext<ContextoPreferencias | null>(null)

function ProveedorPreferencias({ children }: { children: ReactNode }) {
  const { usuario } = useAuth()
  const [preferencias, setPreferencias] = useState<Preferencias>(DEFAULTS)
  const [cargando, setCargando] = useState(true)
  const dispositivoIdRef = useRef<string>('ssr')
  const guardarTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  /** Ref con los últimos cambios pendientes para flush antes de cerrar */
  const cambiosPendientesRef = useRef<Record<string, unknown> | null>(null)
  const usuarioRef = useRef(usuario)
  usuarioRef.current = usuario

  // Cargar preferencias al montar o cuando cambia el usuario
  useEffect(() => {
    const dispositivoId = obtenerDispositivoId()
    dispositivoIdRef.current = dispositivoId

    setCargando(true)

    const cargar = async () => {
      if (usuario) {
        // Pre-cargar localStorage como cache optimista mientras se consulta la API
        try {
          const local = localStorage.getItem(CLAVE_PREFS_LOCAL)
          if (local) setPreferencias({ ...DEFAULTS, ...JSON.parse(local) })
        } catch { /* ignorar */ }

        try {
          const res = await fetch(`/api/preferencias?dispositivo_id=${dispositivoId}`)
          if (res.ok) {
            const datos = await res.json()
            const prefs: Preferencias = {
              tema: datos.tema || DEFAULTS.tema,
              efecto: datos.efecto || DEFAULTS.efecto,
              fondo_cristal: datos.fondo_cristal || DEFAULTS.fondo_cristal,
              escala: datos.escala || DEFAULTS.escala,
              sidebar_orden: datos.sidebar_orden || null,
              sidebar_ocultos: datos.sidebar_ocultos || null,
              sidebar_deshabilitados: datos.sidebar_deshabilitados || null,
              sidebar_colapsado: datos.sidebar_colapsado ?? false,
              sidebar_auto_ocultar: datos.sidebar_auto_ocultar ?? false,
              sidebar_secciones: datos.sidebar_secciones || {},
              config_tablas: datos.config_tablas || {},
              recibir_todas_notificaciones: datos.recibir_todas_notificaciones ?? false,
              chatter_sin_lateral: datos.chatter_sin_lateral || [],
              sidebar_auto_colapsar_config: datos.sidebar_auto_colapsar_config ?? true,
            }
            setPreferencias(prefs)
            localStorage.setItem(CLAVE_PREFS_LOCAL, JSON.stringify(prefs))
            setCargando(false)
            return
          }
        } catch {
          // API falló — el localStorage ya se pre-cargó arriba
        }

        setCargando(false)
        return
      }

      // Sin usuario → cargar de localStorage
      try {
        const local = localStorage.getItem(CLAVE_PREFS_LOCAL)
        if (local) {
          setPreferencias({ ...DEFAULTS, ...JSON.parse(local) })
        }
      } catch {
        // Usar defaults
      }

      setCargando(false)
    }

    cargar()
  }, [usuario])

  /** Construye el payload para enviar a la API */
  const construirPayload = useCallback((prefs: Preferencias): Record<string, unknown> => ({
    dispositivo_id: dispositivoIdRef.current,
    tema: prefs.tema,
    efecto: prefs.efecto,
    fondo_cristal: prefs.fondo_cristal,
    escala: prefs.escala,
    sidebar_orden: prefs.sidebar_orden,
    sidebar_ocultos: prefs.sidebar_ocultos,
    sidebar_deshabilitados: prefs.sidebar_deshabilitados,
    sidebar_colapsado: prefs.sidebar_colapsado,
    sidebar_auto_ocultar: prefs.sidebar_auto_ocultar,
    sidebar_secciones: prefs.sidebar_secciones,
    config_tablas: prefs.config_tablas,
    chatter_sin_lateral: prefs.chatter_sin_lateral,
    sidebar_auto_colapsar_config: prefs.sidebar_auto_colapsar_config,
  }), [])

  /** Envía los cambios pendientes a la BD inmediatamente (sin debounce) */
  const flushPendientes = useCallback(() => {
    if (!cambiosPendientesRef.current || !usuarioRef.current) return
    const payload = cambiosPendientesRef.current
    cambiosPendientesRef.current = null
    if (guardarTimeoutRef.current) {
      clearTimeout(guardarTimeoutRef.current)
      guardarTimeoutRef.current = null
    }
    // sendBeacon es más confiable que fetch en beforeunload
    const blob = new Blob([JSON.stringify(payload)], { type: 'application/json' })
    navigator.sendBeacon('/api/preferencias', blob)
  }, [])

  // Flush antes de cerrar la pestaña o navegar fuera
  useEffect(() => {
    const handler = () => flushPendientes()
    window.addEventListener('beforeunload', handler)
    return () => {
      window.removeEventListener('beforeunload', handler)
      // También flush al desmontar el provider (navegación SPA)
      flushPendientes()
    }
  }, [flushPendientes])

  // Guardar preferencias (debounced 500ms con flush seguro)
  const guardar = useCallback((cambios: Partial<Preferencias>) => {
    setPreferencias(prev => {
      const nuevas = { ...prev, ...cambios }

      // Guardar en localStorage inmediatamente (cache local)
      localStorage.setItem(CLAVE_PREFS_LOCAL, JSON.stringify(nuevas))

      const payload = construirPayload(nuevas)

      // Guardar referencia de cambios pendientes para flush
      cambiosPendientesRef.current = payload

      // Debounce el guardado en BD
      if (guardarTimeoutRef.current) {
        clearTimeout(guardarTimeoutRef.current)
      }

      guardarTimeoutRef.current = setTimeout(() => {
        if (!usuarioRef.current) return
        cambiosPendientesRef.current = null

        fetch('/api/preferencias', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        }).catch(() => {
          // Silencioso — el localStorage tiene la copia
        })
      }, 500)

      return nuevas
    })
  }, [construirPayload])

  return (
    <ContextoPreferenciasInterno.Provider value={{ preferencias, cargando, guardar }}>
      {children}
    </ContextoPreferenciasInterno.Provider>
  )
}

function usePreferencias() {
  const ctx = useContext(ContextoPreferenciasInterno)
  if (!ctx) throw new Error('usePreferencias debe usarse dentro de <ProveedorPreferencias>')
  return ctx
}

export { ProveedorPreferencias, usePreferencias, type Preferencias, type ConfigTabla }
