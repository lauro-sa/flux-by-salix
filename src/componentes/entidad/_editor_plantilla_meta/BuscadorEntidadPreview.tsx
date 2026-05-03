'use client'

/**
 * BuscadorEntidadPreview — Selector universal para la vista previa del editor de
 * plantillas WA. Permite elegir entre Contacto, Visita, Presupuesto, Orden y
 * Actividad; al seleccionar, carga el detalle y las FKs relacionadas
 * (ej. el contacto asociado a una visita) para alimentar los datos reales.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { User, MapPin, FileText, Wrench, ListTodo, Briefcase, X, ChevronDown } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { EntidadPlantillaWA } from '@/lib/whatsapp/variables'

// ─── Configuración por tipo ───

interface TipoConfig {
  valor: EntidadPlantillaWA
  etiqueta: string
  icono: LucideIcon
  endpointList: string
  endpointDetalle: (id: string) => string
  collectionKey: string
  /** Construye el label que se muestra en resultados de búsqueda */
  resumen: (it: Record<string, unknown>) => { titulo: string; subtitulo?: string }
  /** Query de búsqueda por texto (nombre del param) */
  paramBusqueda?: string
}

const CONFIG: Record<EntidadPlantillaWA, TipoConfig> = {
  contacto: {
    valor: 'contacto',
    etiqueta: 'Contacto',
    icono: User,
    endpointList: '/api/contactos',
    endpointDetalle: id => `/api/contactos/${id}`,
    collectionKey: 'contactos',
    paramBusqueda: 'busqueda',
    resumen: c => ({
      titulo: `${String(c.nombre || '')} ${String(c.apellido || '')}`.trim() || 'Sin nombre',
      subtitulo: String(c.correo || c.telefono || '') || undefined,
    }),
  },
  visita: {
    valor: 'visita',
    etiqueta: 'Visita',
    icono: MapPin,
    endpointList: '/api/visitas',
    endpointDetalle: id => `/api/visitas/${id}`,
    collectionKey: 'visitas',
    resumen: v => ({
      titulo: String(v.contacto_nombre || 'Visita'),
      subtitulo: [String(v.estado || ''), v.fecha_programada ? new Date(String(v.fecha_programada)).toLocaleDateString('es-AR') : ''].filter(Boolean).join(' · ') || undefined,
    }),
  },
  presupuesto: {
    valor: 'presupuesto',
    etiqueta: 'Presupuesto',
    icono: FileText,
    endpointList: '/api/presupuestos',
    endpointDetalle: id => `/api/presupuestos/${id}`,
    collectionKey: 'presupuestos',
    paramBusqueda: 'busqueda',
    resumen: p => ({
      titulo: String(p.numero || 'Presupuesto'),
      subtitulo: String(p.contacto_nombre || p.estado || '') || undefined,
    }),
  },
  orden: {
    valor: 'orden',
    etiqueta: 'Orden',
    icono: Wrench,
    endpointList: '/api/ordenes',
    endpointDetalle: id => `/api/ordenes/${id}`,
    collectionKey: 'ordenes',
    resumen: o => ({
      titulo: String(o.numero || 'Orden'),
      subtitulo: String(o.titulo || o.estado || '') || undefined,
    }),
  },
  actividad: {
    valor: 'actividad',
    etiqueta: 'Actividad',
    icono: ListTodo,
    endpointList: '/api/actividades',
    endpointDetalle: id => `/api/actividades/${id}`,
    collectionKey: 'actividades',
    resumen: a => ({
      titulo: String(a.titulo || 'Actividad'),
      subtitulo: a.fecha_vencimiento ? new Date(String(a.fecha_vencimiento)).toLocaleDateString('es-AR') : undefined,
    }),
  },
  nomina: {
    valor: 'nomina',
    etiqueta: 'Empleado',
    icono: Briefcase,
    // /api/miembros devuelve la lista completa (sin paginar) — filtramos client-side.
    endpointList: '/api/miembros',
    endpointDetalle: id => `/api/miembros?id=${id}`,
    collectionKey: 'miembros',
    resumen: m => {
      const perfil = (m.perfil as Record<string, unknown> | null) || null
      const nombre = String(perfil?.nombre || m.nombre || '').trim()
      const apellido = String(perfil?.apellido || m.apellido || '').trim()
      const titulo = `${nombre} ${apellido}`.trim() || 'Empleado'
      const correo = String(perfil?.correo || '') || undefined
      const puesto = (m.puesto as Record<string, unknown> | null)?.nombre as string | undefined
      return { titulo, subtitulo: puesto || correo }
    },
  },
}

// ─── Tipo del seleccionado (lo que se muestra como "chip" arriba) ───

export interface EntidadSeleccionada {
  tipo: EntidadPlantillaWA
  id: string
  titulo: string
  subtitulo?: string
}

interface Props {
  /** Tipos habilitados. Si vacío o no se pasa, se habilitan todos. */
  tiposPermitidos?: EntidadPlantillaWA[]
  seleccionado: EntidadSeleccionada | null
  onSeleccionar: (sel: EntidadSeleccionada) => void
  onLimpiar: () => void
}

export function BuscadorEntidadPreview({
  tiposPermitidos,
  seleccionado,
  onSeleccionar,
  onLimpiar,
}: Props) {
  const tipos = useMemo<EntidadPlantillaWA[]>(() => {
    const todos: EntidadPlantillaWA[] = ['contacto', 'visita', 'presupuesto', 'orden', 'actividad', 'nomina']
    if (!tiposPermitidos || tiposPermitidos.length === 0) return todos
    return todos.filter(t => tiposPermitidos.includes(t))
  }, [tiposPermitidos])

  const [tipoActivo, setTipoActivo] = useState<EntidadPlantillaWA>(tipos[0] || 'contacto')
  useEffect(() => {
    if (!tipos.includes(tipoActivo)) setTipoActivo(tipos[0] || 'contacto')
  }, [tipos, tipoActivo])

  const [busqueda, setBusqueda] = useState('')
  const [resultados, setResultados] = useState<Record<string, unknown>[]>([])
  const [cargando, setCargando] = useState(false)
  const [mostrar, setMostrar] = useState(false)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const config = CONFIG[tipoActivo]

  // Cargar recientes cuando cambia el tipo, con búsqueda vacía
  const cargarResultados = useCallback(async (q: string) => {
    setCargando(true)
    try {
      const cfg = CONFIG[tipoActivo]
      const params = new URLSearchParams()
      params.set('limite', '10')
      params.set('por_pagina', '10')
      if (q && cfg.paramBusqueda) params.set(cfg.paramBusqueda, q)
      const url = `${cfg.endpointList}?${params.toString()}`
      const res = await fetch(url)
      const data = await res.json()
      let lista = (data?.[cfg.collectionKey] as Array<Record<string, unknown>>) || []
      // Filtrado client-side para entidades sin búsqueda server-side (ej. miembros).
      // Coincide contra el título/subtítulo que se muestra en la lista.
      if (q && !cfg.paramBusqueda) {
        const qNorm = q.toLowerCase()
        lista = lista.filter(it => {
          const r = cfg.resumen(it)
          return `${r.titulo || ''} ${r.subtitulo || ''}`.toLowerCase().includes(qNorm)
        })
      }
      setResultados(lista.slice(0, 20))
    } catch {
      setResultados([])
    } finally {
      setCargando(false)
    }
  }, [tipoActivo])

  useEffect(() => {
    if (!mostrar) return
    if (timeoutRef.current) clearTimeout(timeoutRef.current)
    timeoutRef.current = setTimeout(() => {
      cargarResultados(busqueda)
    }, busqueda ? 250 : 0)
    return () => { if (timeoutRef.current) clearTimeout(timeoutRef.current) }
  }, [busqueda, mostrar, cargarResultados])

  const seleccionar = (item: Record<string, unknown>) => {
    const id = String(item.id || '')
    if (!id) return
    const r = config.resumen(item)
    onSeleccionar({ tipo: tipoActivo, id, titulo: r.titulo, subtitulo: r.subtitulo })
    setBusqueda('')
    setMostrar(false)
  }

  // Si hay selección, mostrar el chip
  if (seleccionado) {
    const Icono = CONFIG[seleccionado.tipo].icono
    return (
      <div className="flex items-center gap-2 px-3 py-1.5 rounded-card border border-borde-sutil bg-superficie-tarjeta">
        <Icono size={13} className="text-texto-terciario flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-sm truncate text-texto-primario leading-tight">{seleccionado.titulo}</p>
          {seleccionado.subtitulo && (
            <p className="text-xxs truncate text-texto-terciario leading-tight">{seleccionado.subtitulo}</p>
          )}
        </div>
        <button
          onClick={onLimpiar}
          className="p-0.5 rounded hover:bg-superficie-hover transition-colors cursor-pointer"
          aria-label="Quitar selección"
        >
          <X size={13} className="text-texto-terciario" />
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-1.5">
      {/* Tabs de tipo (solo si hay más de uno) */}
      {tipos.length > 1 && (
        <div className="flex flex-wrap gap-1">
          {tipos.map(t => {
            const cfg = CONFIG[t]
            const Icono = cfg.icono
            const activo = tipoActivo === t
            return (
              <button
                key={t}
                type="button"
                onClick={() => { setTipoActivo(t); setResultados([]); setBusqueda('') }}
                className={`inline-flex items-center gap-1 text-xxs px-2 py-0.5 rounded-boton font-medium transition-colors cursor-pointer border ${
                  activo
                    ? 'bg-texto-marca/15 border-texto-marca/40 text-texto-marca'
                    : 'bg-white/[0.03] border-white/[0.06] text-texto-terciario hover:text-texto-secundario'
                }`}
              >
                <Icono size={10} />
                {cfg.etiqueta}
              </button>
            )
          })}
        </div>
      )}

      {/* Input de búsqueda — siempre habilitado. Si la API soporta búsqueda
          server-side se manda como param; si no, filtramos client-side. */}
      <div className="relative">
        <div className="flex items-center gap-1.5" style={{ borderBottom: '1.5px solid var(--borde-fuerte)' }}>
          <input
            ref={inputRef}
            type="text"
            value={busqueda}
            onChange={e => setBusqueda(e.target.value)}
            onFocus={() => setMostrar(true)}
            onBlur={() => setTimeout(() => setMostrar(false), 200)}
            placeholder={`Buscar ${config.etiqueta.toLowerCase()}…`}
            className="flex-1 text-sm bg-transparent outline-none py-1.5 text-texto-primario"
          />
          <ChevronDown size={14} className="text-texto-terciario" />
        </div>

        {mostrar && (
          <div
            className="absolute left-0 right-0 top-full mt-1 z-50 rounded-popover shadow-elevada max-h-[280px] overflow-y-auto"
            style={{ background: 'var(--superficie-elevada)', border: '1px solid var(--borde-sutil)' }}
          >
            {cargando ? (
              <p className="px-3 py-4 text-xs text-center text-texto-terciario">Cargando…</p>
            ) : resultados.length > 0 ? (
              <div className="py-1">
                {resultados.map((it, i) => {
                  const r = config.resumen(it)
                  const Icono = config.icono
                  return (
                    <button
                      key={String(it.id || i)}
                      className="w-full flex items-center gap-2.5 px-3 py-2 text-left transition-colors hover:bg-[var(--superficie-hover)]"
                      onMouseDown={e => { e.preventDefault(); seleccionar(it) }}
                    >
                      <Icono size={14} className="text-texto-terciario flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate text-texto-primario">{r.titulo}</p>
                        {r.subtitulo && <p className="text-xs truncate text-texto-terciario">{r.subtitulo}</p>}
                      </div>
                    </button>
                  )
                })}
              </div>
            ) : (
              <p className="px-3 py-4 text-xs text-center text-texto-terciario">
                {busqueda ? 'Sin resultados' : 'Sin registros'}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
