'use client'

import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { useSearchParams } from 'next/navigation'
import { DEBOUNCE_BUSQUEDA } from '@/lib/constantes/timeouts'

/**
 * useFiltrosUrl — Hook reutilizable para listados con filtros sincronizados a URL.
 *
 * Resuelve dos problemas que tenían todos los listados con filtros:
 *
 * 1. Sync bidireccional: el patrón anterior solo sincronizaba estado → URL.
 *    Cuando el usuario volvía al listado por migajas o botón atrás, Next.js
 *    a veces preservaba el árbol de React y la URL cambiaba sin re-montar
 *    el componente, perdiendo los filtros del usuario. Este hook re-lee desde
 *    URL → estado cuando detecta un cambio externo (no escrito por nosotros).
 *
 * 2. Boilerplate: cada listado repetía useState + parser + useEffect de sync.
 *    Acá se declara una vez con un schema tipado.
 *
 * Ejemplo:
 * ```tsx
 * const filtros = useFiltrosUrl({
 *   pathname: '/visitas',
 *   campos: {
 *     estado: { defecto: ESTADOS_ACTIVOS },              // tipo lista
 *     vista: { defecto: 'todas' },                       // tipo string
 *     sin_asignado: { defecto: false },                  // tipo booleano
 *     fecha: { defecto: '' },                            // tipo string vacío
 *   },
 *   busqueda: { claveUrl: 'q', defecto: '' },
 *   pagina: { defecto: 1 },
 * })
 *
 * filtros.valores.estado            // ['completada']
 * filtros.set('estado', ['completada', 'cancelada'])
 * filtros.setMultiple({ estado: [], pagina: 1 })
 * filtros.limpiar()                 // resetea todo a defaults
 * filtros.busquedaInput             // valor inmediato del input
 * filtros.busquedaActiva            // valor con debounce (para queries)
 * filtros.setBusquedaInput('foo')
 * filtros.pagina / filtros.setPagina(2)
 * filtros.cuentaActivos()           // cantidad de filtros distintos al default
 * ```
 *
 * Cada campo puede tener `parser` y `serializer` custom si su lógica de URL es
 * especial (ej: migraciones, normalización). Por defecto se infiere del valor
 * default: array → lista CSV, boolean → 'true'/(omitido), number → str, string → str.
 */

type TipoFiltro = 'string' | 'lista' | 'booleano' | 'numero'

interface ConfigFiltro<T> {
  /** Valor por defecto. Cuando el filtro está en su default, se omite de la URL. */
  defecto: T
  /** Tipo explícito; si no se da se infiere del defecto. */
  tipo?: TipoFiltro
  /** Nombre del param URL si difiere del nombre de la clave. */
  claveUrl?: string
  /** Parser custom: convierte string crudo de la URL al tipo deseado. */
  parser?: (raw: string | null, defecto: T) => T
  /** Serializer custom: convierte el valor a string para URL. Devolver null para omitir. */
  serializer?: (valor: T, defecto: T) => string | null
}

type ConfigFiltros = Record<string, ConfigFiltro<any>>

type ValoresFiltros<C extends ConfigFiltros> = {
  [K in keyof C]: C[K] extends ConfigFiltro<infer T> ? T : never
}

interface OpcionesFiltrosUrl<C extends ConfigFiltros> {
  /** Pathname base del listado (ej: '/visitas'). Se usa al escribir la URL. */
  pathname: string
  /** Configuración de cada filtro. */
  campos: C
  /** Configuración opcional de búsqueda (input + debounce). */
  busqueda?: { defecto?: string; claveUrl?: string; debounceMs?: number }
  /** Configuración opcional de paginación. */
  pagina?: { defecto?: number; claveUrl?: string }
}

interface ResultadoFiltrosUrl<C extends ConfigFiltros> {
  /** Valores actuales de todos los filtros configurados. */
  valores: ValoresFiltros<C>
  /** Setter por clave individual. */
  set<K extends keyof C>(clave: K, valor: ValoresFiltros<C>[K]): void
  /** Setter parcial (varios campos a la vez). */
  setMultiple(parcial: Partial<ValoresFiltros<C>>): void
  /** Resetea todos los filtros a sus defaults. */
  limpiar(): void
  /** Cantidad de filtros con valor distinto al default. */
  cuentaActivos(): number
  /** True si todos los filtros están en su default. */
  estaEnDefecto(): boolean
  /** Valor del input de búsqueda (inmediato — sin debounce). */
  busquedaInput: string
  /** Valor con debounce (para usar en queries / API). */
  busquedaActiva: string
  setBusquedaInput(valor: string): void
  /** Página actual del listado. */
  pagina: number
  setPagina(valor: number): void
}

/* ── Helpers de parsing/serialización ── */

function inferirTipo(defecto: unknown): TipoFiltro {
  if (Array.isArray(defecto)) return 'lista'
  if (typeof defecto === 'boolean') return 'booleano'
  if (typeof defecto === 'number') return 'numero'
  return 'string'
}

function parsearValor(raw: string | null, tipo: TipoFiltro, defecto: unknown): unknown {
  if (raw === null) return defecto
  switch (tipo) {
    case 'lista':
      return raw.split(',').filter(Boolean)
    case 'booleano':
      return raw === 'true'
    case 'numero': {
      const n = Number(raw)
      return Number.isFinite(n) ? n : defecto
    }
    default:
      return raw
  }
}

function serializarValor(valor: unknown, tipo: TipoFiltro, defecto: unknown): string | null {
  // Si el valor coincide con el default, omitir de la URL para no ensuciar.
  if (sonIgualesParaTipo(valor, defecto, tipo)) return null
  switch (tipo) {
    case 'lista': {
      const arr = valor as unknown[]
      if (arr.length === 0) return null
      return arr.join(',')
    }
    case 'booleano':
      return valor === true ? 'true' : null
    case 'numero':
      return String(valor)
    default:
      return valor === '' ? null : String(valor)
  }
}

function sonIgualesParaTipo(a: unknown, b: unknown, tipo: TipoFiltro): boolean {
  if (tipo === 'lista') {
    if (!Array.isArray(a) || !Array.isArray(b)) return a === b
    if (a.length !== b.length) return false
    const setA = new Set(a as unknown[])
    return (b as unknown[]).every(v => setA.has(v))
  }
  return a === b
}

/* ── Hook ── */

function useFiltrosUrl<C extends ConfigFiltros>(
  opciones: OpcionesFiltrosUrl<C>,
): ResultadoFiltrosUrl<C> {
  const { pathname, campos, busqueda, pagina: paginaCfg } = opciones
  const searchParams = useSearchParams()

  const claveBusqueda = busqueda?.claveUrl ?? 'q'
  const defectoBusqueda = busqueda?.defecto ?? ''
  const debounceMs = busqueda?.debounceMs ?? DEBOUNCE_BUSQUEDA
  const clavePagina = paginaCfg?.claveUrl ?? 'pagina'
  const defectoPagina = paginaCfg?.defecto ?? 1

  // Memorizar campos para que el efecto de re-sync no dispare por cambios de
  // identidad del objeto (los listados suelen pasar literales inline).
  const camposRef = useRef(campos)
  camposRef.current = campos

  /* ── Estado de filtros (inicializado desde URL) ── */
  const [valores, setValores] = useState<ValoresFiltros<C>>(() => {
    const result = {} as Record<string, unknown>
    for (const clave of Object.keys(camposRef.current)) {
      const cfg = camposRef.current[clave]
      const tipo = cfg.tipo ?? inferirTipo(cfg.defecto)
      const claveUrl = cfg.claveUrl ?? clave
      const raw = searchParams.get(claveUrl)
      result[clave] = cfg.parser ? cfg.parser(raw, cfg.defecto) : parsearValor(raw, tipo, cfg.defecto)
    }
    return result as ValoresFiltros<C>
  })

  /* ── Estado de búsqueda + debounce ── */
  const [busquedaInput, setBusquedaInput] = useState<string>(
    () => searchParams.get(claveBusqueda) ?? defectoBusqueda,
  )
  const [busquedaActiva, setBusquedaActiva] = useState<string>(busquedaInput)

  // Debounce: aplicar el valor del input a busquedaActiva tras delay
  useEffect(() => {
    const t = setTimeout(() => setBusquedaActiva(busquedaInput), debounceMs)
    return () => clearTimeout(t)
  }, [busquedaInput, debounceMs])

  /* ── Estado de paginación ── */
  const [pagina, setPagina] = useState<number>(() => {
    const raw = searchParams.get(clavePagina)
    const n = raw ? Number(raw) : defectoPagina
    return Number.isFinite(n) && n > 0 ? n : defectoPagina
  })

  // Reset de página cuando cambian filtros o búsqueda activa.
  // No corre en el primer render para respetar la página restaurada desde URL.
  const primerResetPaginaRef = useRef(true)
  useEffect(() => {
    if (primerResetPaginaRef.current) {
      primerResetPaginaRef.current = false
      return
    }
    setPagina(1)
    // valores es una referencia: cualquier cambio en filtros llega acá vía useState.
    // busquedaActiva también dispara reset.
  }, [valores, busquedaActiva])

  /* ── Sync valores → URL ── */
  // Sentinela del último query string que escribimos: para distinguir cambios
  // "internos" (que ya sabemos) de "externos" (back/migajas/popstate).
  const ultimaUrlEscritaRef = useRef<string | null>(null)

  useEffect(() => {
    const params = new URLSearchParams()
    // Filtros
    for (const clave of Object.keys(camposRef.current)) {
      const cfg = camposRef.current[clave]
      const tipo = cfg.tipo ?? inferirTipo(cfg.defecto)
      const claveUrl = cfg.claveUrl ?? clave
      const valor = (valores as Record<string, unknown>)[clave]
      const serialized = cfg.serializer
        ? cfg.serializer(valor, cfg.defecto)
        : serializarValor(valor, tipo, cfg.defecto)
      if (serialized !== null) params.set(claveUrl, serialized)
    }
    // Búsqueda
    if (busquedaActiva && busquedaActiva !== defectoBusqueda) {
      params.set(claveBusqueda, busquedaActiva)
    }
    // Paginación
    if (pagina !== defectoPagina) {
      params.set(clavePagina, String(pagina))
    }
    const qs = params.toString()
    ultimaUrlEscritaRef.current = qs
    if (typeof window !== 'undefined') {
      window.history.replaceState(null, '', qs ? `${pathname}?${qs}` : pathname)
    }
  }, [valores, busquedaActiva, pagina, pathname, claveBusqueda, defectoBusqueda, clavePagina, defectoPagina])

  /* ── Sync URL → estado (cuando cambia externamente) ── */
  useEffect(() => {
    const actual = searchParams.toString()
    // Si coincide con lo que nosotros escribimos último, no es un cambio externo.
    if (actual === ultimaUrlEscritaRef.current) return

    // Re-leer filtros desde URL
    const nuevoEstado = {} as Record<string, unknown>
    for (const clave of Object.keys(camposRef.current)) {
      const cfg = camposRef.current[clave]
      const tipo = cfg.tipo ?? inferirTipo(cfg.defecto)
      const claveUrl = cfg.claveUrl ?? clave
      const raw = searchParams.get(claveUrl)
      nuevoEstado[clave] = cfg.parser
        ? cfg.parser(raw, cfg.defecto)
        : parsearValor(raw, tipo, cfg.defecto)
    }
    setValores(prev => {
      let cambio = false
      for (const clave of Object.keys(camposRef.current)) {
        const cfg = camposRef.current[clave]
        const tipo = cfg.tipo ?? inferirTipo(cfg.defecto)
        if (!sonIgualesParaTipo((prev as Record<string, unknown>)[clave], nuevoEstado[clave], tipo)) {
          cambio = true
          break
        }
      }
      return cambio ? (nuevoEstado as ValoresFiltros<C>) : prev
    })

    // Re-leer búsqueda
    const nuevaBusqueda = searchParams.get(claveBusqueda) ?? defectoBusqueda
    setBusquedaInput(prev => (prev === nuevaBusqueda ? prev : nuevaBusqueda))
    setBusquedaActiva(prev => (prev === nuevaBusqueda ? prev : nuevaBusqueda))

    // Re-leer página
    const rawPag = searchParams.get(clavePagina)
    const nuevaPagina = rawPag ? Number(rawPag) : defectoPagina
    if (Number.isFinite(nuevaPagina) && nuevaPagina > 0) {
      setPagina(prev => (prev === nuevaPagina ? prev : nuevaPagina))
    }
  }, [searchParams, claveBusqueda, defectoBusqueda, clavePagina, defectoPagina])

  /* ── Setters ── */

  const set = useCallback(
    <K extends keyof C>(clave: K, valor: ValoresFiltros<C>[K]) => {
      setValores(prev => ({ ...prev, [clave]: valor }))
    },
    [],
  )

  const setMultiple = useCallback((parcial: Partial<ValoresFiltros<C>>) => {
    setValores(prev => ({ ...prev, ...parcial }))
  }, [])

  const limpiar = useCallback(() => {
    const result = {} as Record<string, unknown>
    for (const clave of Object.keys(camposRef.current)) {
      result[clave] = camposRef.current[clave].defecto
    }
    setValores(result as ValoresFiltros<C>)
    setBusquedaInput(defectoBusqueda)
    setBusquedaActiva(defectoBusqueda)
    setPagina(defectoPagina)
  }, [defectoBusqueda, defectoPagina])

  const cuentaActivos = useCallback(() => {
    let count = 0
    for (const clave of Object.keys(camposRef.current)) {
      const cfg = camposRef.current[clave]
      const tipo = cfg.tipo ?? inferirTipo(cfg.defecto)
      const valor = (valores as Record<string, unknown>)[clave]
      if (!sonIgualesParaTipo(valor, cfg.defecto, tipo)) count++
    }
    return count
  }, [valores])

  const estaEnDefecto = useCallback(() => cuentaActivos() === 0, [cuentaActivos])

  return useMemo(
    () => ({
      valores,
      set,
      setMultiple,
      limpiar,
      cuentaActivos,
      estaEnDefecto,
      busquedaInput,
      busquedaActiva,
      setBusquedaInput,
      pagina,
      setPagina,
    }),
    [valores, set, setMultiple, limpiar, cuentaActivos, estaEnDefecto, busquedaInput, busquedaActiva, pagina],
  )
}

export { useFiltrosUrl }
export type { ConfigFiltro, OpcionesFiltrosUrl, ResultadoFiltrosUrl, ValoresFiltros, TipoFiltro }
