'use client'

import { createContext, useContext, useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'

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
  '/ordenes': { etiqueta: 'Órdenes de trabajo', ruta: '/ordenes', modulo: 'ordenes' },
  '/auditoria': { etiqueta: 'Auditoría', ruta: '/auditoria', modulo: 'auditoria' },
  '/marketing': { etiqueta: 'Marketing', ruta: '/marketing', modulo: 'marketing' },
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
  /**
   * Devuelve la última URL conocida de un módulo (con query string de filtros si existían).
   * Si no hay URL guardada, devuelve la ruta original. Las migajas la usan para preservar
   * los filtros del listado al hacer click en la migaja del módulo.
   */
  obtenerRutaModulo: (ruta: string) => string
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

    // Insertar intermedias: el módulo de origen va ANTES del módulo actual
    // Ej: desde=/actividades en /presupuestos/nuevo → Actividades > Presupuestos > Nuevo
    if (intermedias.length > 0) {
      const conPadres: Migaja[] = []
      for (const inter of intermedias) {
        const segmentos = inter.ruta.split('/').filter(Boolean)
        if (segmentos.length > 0) {
          const rutaPadre = `/${segmentos[0]}`
          const padreExiste = migajas.some(m => m.ruta === rutaPadre) || conPadres.some(m => m.ruta === rutaPadre)
          if (!padreExiste && MIGAJAS_MODULOS[rutaPadre] && rutaPadre !== inter.ruta) {
            conPadres.push(MIGAJAS_MODULOS[rutaPadre])
          }
        }
        conPadres.push(inter)
      }
      // Insertar al inicio (antes del módulo actual) para respetar el orden de navegación
      migajas.splice(0, 0, ...conPadres)
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
  const searchParams = useSearchParams()
  const historialRef = useRef<string[]>([])
  const [migajasDinamicas, setMigajasDinamicasState] = useState<Record<string, string>>({})
  const pathnameAnteriorRef = useRef(pathname)
  // Última URL conocida (con query) de cada módulo. Se actualiza al instante cuando los listados
  // sincronizan filtros vía replaceState. Permite que las migajas restauren los filtros al volver.
  const ultimasUrlsRef = useRef<Record<string, string>>({})

  // Hookea history.replaceState/pushState para detectar cambios de URL que Next no observa
  // (los listados usan replaceState directo para mantener filtros en la URL).
  useEffect(() => {
    if (typeof window === 'undefined') return

    const capturar = () => {
      const path = window.location.pathname
      if (MIGAJAS_MODULOS[path]) {
        ultimasUrlsRef.current[path] = path + window.location.search
      }
    }

    const replaceOriginal = window.history.replaceState
    const pushOriginal = window.history.pushState

    window.history.replaceState = function (...args: Parameters<typeof window.history.replaceState>) {
      replaceOriginal.apply(this, args)
      capturar()
    }
    window.history.pushState = function (...args: Parameters<typeof window.history.pushState>) {
      pushOriginal.apply(this, args)
      capturar()
    }

    window.addEventListener('popstate', capturar)
    capturar() // Captura inicial

    return () => {
      window.history.replaceState = replaceOriginal
      window.history.pushState = pushOriginal
      window.removeEventListener('popstate', capturar)
    }
  }, [])

  // Parámetros de contexto de navegación (reactivos via useSearchParams).
  // `?desde=` puede traer query string (ej: `/inbox?conv=xxx&tab=correo`) cuando
  // queremos volver no solo al módulo sino al estado exacto (conversación abierta).
  // Separamos en `origenRaw` (URL completa con query) y `origenPath` (solo el path,
  // sin query) para mapearlo a MIGAJAS_MODULOS.
  const origenRaw = searchParams.get('origen') || searchParams.get('desde') || null
  const origenPath = origenRaw ? origenRaw.split('?')[0] : null
  const origenActual = origenPath

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
    // Si no tiene ?desde ni ?origen, limpiar migajas que no sean la ruta actual
    if (!origenActual) {
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
  const extras: Migaja[] = Object.entries(migajasDinamicas)
    .filter(([ruta]) => {
      if (pathname === ruta) return true           // Es la ruta actual
      if (pathname.startsWith(ruta)) return true   // Es prefijo (subrutas)
      // Incluir intermedias si hay contexto de navegación (desde/origen)
      if (origenActual && ruta === origenActual) return true
      return false
    })
    .map(([ruta, etiqueta]) => ({ ruta, etiqueta }))

  // Si hay ?desde= y es un módulo estático, agregar como migaja intermedia.
  // Si traía query string (ej: `/inbox?conv=xxx`), preservarlo en `ruta` para
  // que al hacer click en la migaja se vuelva al estado exacto (conversación
  // abierta, filtros, etc.), no solo al listado del módulo.
  if (origenActual && MIGAJAS_MODULOS[origenActual] && !extras.some(e => e.ruta === origenActual)) {
    const baseMigaja = MIGAJAS_MODULOS[origenActual]
    const conRuta = origenRaw && origenRaw !== origenActual
      ? { ...baseMigaja, ruta: origenRaw }
      : baseMigaja
    extras.unshift(conRuta)
  }
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

  const obtenerRutaModulo = useCallback((ruta: string) => {
    return ultimasUrlsRef.current[ruta] ?? ruta
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
        obtenerRutaModulo,
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
