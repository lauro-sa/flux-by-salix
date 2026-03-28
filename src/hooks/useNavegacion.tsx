'use client'

import { createContext, useContext, useCallback, useRef, useState, type ReactNode } from 'react'
import { usePathname } from 'next/navigation'

/**
 * Sistema de navegación con migajas (breadcrumbs) e historial contextual.
 *
 * Problema que resuelve:
 *   Cuando navegás Contactos → Detalle → Edición → Actividad vinculada,
 *   necesitás poder volver paso a paso. Las migajas muestran el camino completo.
 *
 * Cómo funciona:
 *   - Cada página declara su migaja con useMigaja({ etiqueta, ruta })
 *   - El componente <Migajas /> renderiza el camino completo
 *   - Se mantiene un historial de navegación para volver atrás
 *   - Soporte cross-módulo: si vas de Contactos a un Presupuesto, la migaja muestra ambos
 */

// Definición de una migaja individual
interface Migaja {
  etiqueta: string
  ruta: string
  modulo?: string // Para colorear con el token del módulo
}

// Mapa de rutas a migajas estáticas (las dinámicas se agregan en runtime)
const MIGAJAS_MODULOS: Record<string, Migaja> = {
  '/dashboard': { etiqueta: 'Inicio', ruta: '/dashboard', modulo: 'dashboard' },
  '/contactos': { etiqueta: 'Contactos', ruta: '/contactos', modulo: 'contactos' },
  '/actividades': { etiqueta: 'Actividades', ruta: '/actividades', modulo: 'actividades' },
  '/visitas': { etiqueta: 'Visitas', ruta: '/visitas', modulo: 'visitas' },
  '/documentos': { etiqueta: 'Documentos', ruta: '/documentos', modulo: 'documentos' },
  '/productos': { etiqueta: 'Productos', ruta: '/productos', modulo: 'productos' },
  '/inbox': { etiqueta: 'Inbox', ruta: '/inbox', modulo: 'inbox' },
  '/asistencias': { etiqueta: 'Asistencias', ruta: '/asistencias', modulo: 'asistencias' },
  '/calendario': { etiqueta: 'Calendario', ruta: '/calendario', modulo: 'calendario' },
  '/presupuestos': { etiqueta: 'Presupuestos', ruta: '/presupuestos', modulo: 'presupuestos' },
  '/ordenes': { etiqueta: 'Órdenes', ruta: '/ordenes', modulo: 'ordenes' },
  '/auditoria': { etiqueta: 'Auditoría', ruta: '/auditoria', modulo: 'auditoria' },
  '/usuarios': { etiqueta: 'Usuarios', ruta: '/usuarios', modulo: 'usuarios' },
  '/configuracion': { etiqueta: 'Configuración', ruta: '/configuracion', modulo: 'configuracion' },
  '/vitrina': { etiqueta: 'Vitrina', ruta: '/vitrina', modulo: 'vitrina' },
}

interface ContextoNavegacion {
  migajas: Migaja[]
  historial: string[]
  volverAtras: () => void
  puedeVolver: boolean
  obtenerMigajasParaRuta: (ruta: string, extras?: Migaja[]) => Migaja[]
  /** Reemplaza la migaja de un segmento dinámico (UUID) por un nombre legible */
  setMigajaDinamica: (ruta: string, etiqueta: string) => void
  migajasDinamicas: Record<string, string>
}

const ContextoNavegacionInterno = createContext<ContextoNavegacion | null>(null)

/**
 * Genera migajas automáticas a partir de la URL actual.
 * /contactos/123/editar → [Inicio, Contactos, Detalle, Editar]
 */
function generarMigajas(pathname: string, extras?: Migaja[]): Migaja[] {
  const migajas: Migaja[] = []

  if (pathname === '/dashboard' || pathname === '/') return migajas

  // Separar la ruta en segmentos
  const segmentos = pathname.split('/').filter(Boolean)
  let rutaAcumulada = ''

  for (const segmento of segmentos) {
    rutaAcumulada += `/${segmento}`

    // Buscar si el segmento tiene una migaja estática
    const estatica = MIGAJAS_MODULOS[rutaAcumulada]
    if (estatica) {
      migajas.push(estatica)
    } else {
      // Segmento dinámico (ID, acción, etc.)
      const etiqueta = formatearSegmento(segmento)
      migajas.push({ etiqueta, ruta: rutaAcumulada })
    }
  }

  // Agregar migajas extra (para detalle dinámico: nombre del contacto, etc.)
  if (extras) {
    const reemplazos: Migaja[] = []
    const intermedias: Migaja[] = []

    for (const extra of extras) {
      const idx = migajas.findIndex(m => m.ruta === extra.ruta)
      if (idx >= 0) {
        // Reemplazar migaja existente (ej: UUID → nombre real)
        migajas[idx] = extra
        reemplazos.push(extra)
      } else {
        // Migaja intermedia (ej: contacto de origen antes del actual)
        intermedias.push(extra)
      }
    }

    // Insertar intermedias antes de la última migaja (el detalle actual)
    if (intermedias.length > 0 && migajas.length > 1) {
      migajas.splice(migajas.length - 1, 0, ...intermedias)
    }
  }

  return migajas
}

/**
 * Convierte un segmento de URL a texto legible.
 * "editar" → "Editar", "nuevo" → "Nuevo", UUID → "Detalle"
 */
function formatearSegmento(segmento: string): string {
  // Si es un UUID o ID numérico, mostrar "Detalle"
  if (/^[0-9a-f-]{36}$/i.test(segmento) || /^\d+$/.test(segmento)) {
    return 'Detalle'
  }

  // Capitalizar: "editar" → "Editar"
  return segmento.charAt(0).toUpperCase() + segmento.slice(1).replace(/-/g, ' ')
}

function ProveedorNavegacion({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  const historialRef = useRef<string[]>([])
  const [migajasDinamicas, setMigajasDinamicasState] = useState<Record<string, string>>({})
  const pathnameAnteriorRef = useRef(pathname)

  // Agregar al historial cuando cambia la ruta
  if (
    historialRef.current.length === 0 ||
    historialRef.current[historialRef.current.length - 1] !== pathname
  ) {
    historialRef.current = [...historialRef.current.slice(-19), pathname]
  }

  // Limpiar migajas dinámicas intermedias cuando se navega a otra página
  // (mantener solo la del pathname actual)
  if (pathnameAnteriorRef.current !== pathname) {
    pathnameAnteriorRef.current = pathname
    const desdeParam = typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('desde') : null
    // Si no tiene ?desde, limpiar todas las migajas que no sean la ruta actual
    if (!desdeParam) {
      const claves = Object.keys(migajasDinamicas)
      const aLimpiar = claves.filter(ruta => ruta !== pathname && !pathname.startsWith(ruta))
      if (aLimpiar.length > 0) {
        setMigajasDinamicasState(prev => {
          const nuevo = { ...prev }
          for (const ruta of aLimpiar) delete nuevo[ruta]
          return nuevo
        })
      }
    }
  }

  // Filtrar migajas dinámicas para la ruta actual
  const desdeActual = typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('desde') : null
  const extras: Migaja[] = Object.entries(migajasDinamicas)
    .filter(([ruta]) => {
      if (pathname === ruta) return true           // Es la ruta actual
      if (pathname.startsWith(ruta)) return true   // Es prefijo (subrutas)
      // Solo incluir intermedias si hay ?desde (navegación entre vinculados)
      if (desdeActual && ruta.includes(desdeActual)) return true
      return false
    })
    .map(([ruta, etiqueta]) => ({ ruta, etiqueta }))
  const migajas = generarMigajas(pathname, extras.length > 0 ? extras : undefined)

  const volverAtras = useCallback(() => {
    if (historialRef.current.length > 1) {
      historialRef.current.pop()
      const anterior = historialRef.current[historialRef.current.length - 1]
      window.history.back()
      if (anterior) {
        setTimeout(() => {
          if (window.location.pathname === pathname) {
            window.location.href = anterior
          }
        }, 100)
      }
    }
  }, [pathname])

  const obtenerMigajasParaRuta = useCallback(
    (ruta: string, extrasParam?: Migaja[]) => generarMigajas(ruta, extrasParam),
    []
  )

  const setMigajaDinamica = useCallback((ruta: string, etiqueta: string) => {
    setMigajasDinamicasState(prev => {
      if (prev[ruta] === etiqueta) return prev
      return { ...prev, [ruta]: etiqueta }
    })
  }, [])

  return (
    <ContextoNavegacionInterno.Provider
      value={{
        migajas,
        historial: historialRef.current,
        volverAtras,
        puedeVolver: historialRef.current.length > 1,
        obtenerMigajasParaRuta,
        setMigajaDinamica,
        migajasDinamicas,
      }}
    >
      {children}
    </ContextoNavegacionInterno.Provider>
  )
}

function useNavegacion() {
  const ctx = useContext(ContextoNavegacionInterno)
  if (!ctx) throw new Error('useNavegacion debe usarse dentro de <ProveedorNavegacion>')
  return ctx
}

export { ProveedorNavegacion, useNavegacion, generarMigajas, MIGAJAS_MODULOS }
export type { Migaja }
