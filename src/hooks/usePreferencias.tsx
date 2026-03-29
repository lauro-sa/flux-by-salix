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
}

interface Preferencias {
  tema: string
  efecto: string
  fondo_cristal: string
  escala: string
  sidebar_orden: string[] | null
  sidebar_ocultos: string[] | null
  sidebar_deshabilitados: string[] | null
  sidebar_colapsado: boolean
  /** Estado del sidebar por sección: { "/inbox": true, "/contactos": false } (true = colapsado) */
  sidebar_secciones: Record<string, boolean>
  /** Config de tablas por módulo: { usuarios: {...}, contactos: {...} } */
  config_tablas: Record<string, ConfigTabla>
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
  sidebar_secciones: {},
  config_tablas: {},
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

  // Cargar preferencias al montar o cuando cambia el usuario
  useEffect(() => {
    const dispositivoId = obtenerDispositivoId()
    dispositivoIdRef.current = dispositivoId

    const cargar = async () => {
      // Si hay usuario, intentar cargar de BD
      if (usuario) {
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
              sidebar_secciones: datos.sidebar_secciones || {},
              config_tablas: datos.config_tablas || {},
            }
            setPreferencias(prefs)
            // Sincronizar a localStorage como cache
            localStorage.setItem(CLAVE_PREFS_LOCAL, JSON.stringify(prefs))
            setCargando(false)
            return
          }
        } catch {
          // Fallback a localStorage
        }
      }

      // Sin usuario o error → cargar de localStorage
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

  // Guardar preferencias (debounced 500ms)
  const guardar = useCallback((cambios: Partial<Preferencias>) => {
    setPreferencias(prev => {
      const nuevas = { ...prev, ...cambios }

      // Guardar en localStorage inmediatamente (cache local)
      localStorage.setItem(CLAVE_PREFS_LOCAL, JSON.stringify(nuevas))

      // Debounce el guardado en BD
      if (guardarTimeoutRef.current) {
        clearTimeout(guardarTimeoutRef.current)
      }

      guardarTimeoutRef.current = setTimeout(() => {
        if (!usuario) return

        fetch('/api/preferencias', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            dispositivo_id: dispositivoIdRef.current,
            ...nuevas,
          }),
        }).catch(() => {
          // Silencioso — el localStorage tiene la copia
        })
      }, 500)

      return nuevas
    })
  }, [usuario])

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
