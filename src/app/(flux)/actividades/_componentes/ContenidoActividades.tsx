'use client'

import { useState, useEffect, useLayoutEffect, useCallback, useMemo, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { useListado, useConfig } from '@/hooks/useListado'
import { useBusquedaDebounce } from '@/hooks/useBusquedaDebounce'
import { GuardPagina } from '@/componentes/entidad/GuardPagina'
import { PlantillaListado } from '@/componentes/entidad/PlantillaListado'
import { TablaDinamica } from '@/componentes/tablas/TablaDinamica'
import type { ColumnaDinamica } from '@/componentes/tablas/TablaDinamica'
import {
  PlusCircle, Download, ClipboardList, CalendarClock,
  CheckCircle, Clock, User, Trash2, History,
  RotateCcw, ChevronDown, ChevronUp, XCircle,
} from 'lucide-react'
import type { AccionLote } from '@/componentes/tablas/tipos-tabla'
import { ModalConfirmacion } from '@/componentes/ui/ModalConfirmacion'
import { EstadoVacio } from '@/componentes/feedback/EstadoVacio'
import { Boton } from '@/componentes/ui/Boton'
import { Insignia } from '@/componentes/ui/Insignia'
import { Tooltip } from '@/componentes/ui/Tooltip'
import { obtenerIcono } from '@/componentes/ui/SelectorIcono'
import { IndicadorEditado } from '@/componentes/ui/IndicadorEditado'
import { ModalActividad } from './ModalActividad'
import type { Actividad, Vinculo } from './ModalActividad'
import { ACCIONES_TIPO_ACTIVIDAD } from './_acciones_tipo'
import type { TipoActividad } from '../configuracion/_tipos'
import type { EstadoActividad } from '../configuracion/secciones/SeccionEstados'
import { crearClienteNavegador } from '@/lib/supabase/cliente'
import { useToast } from '@/componentes/feedback/Toast'
import { useFormato } from '@/hooks/useFormato'
import { useTraduccion } from '@/lib/i18n'
import { useModalVisita } from '@/hooks/useModalVisita'
import { ModalVisita } from '@/app/(flux)/visitas/_componentes/ModalVisita'
import { useRol } from '@/hooks/useRol'

/**
 * Contenido interactivo de actividades — Client Component.
 * Recibe datosInicialesJson del Server Component para renderizar sin loading.
 * React Query toma el control para filtros, paginación y refetch.
 */

const COLORES_PRIORIDAD: Record<string, { color: string; etiqueta: string }> = {
  baja: { color: 'info', etiqueta: 'Baja' },
  normal: { color: 'neutro', etiqueta: 'Normal' },
  alta: { color: 'peligro', etiqueta: 'Alta' },
}

/** Formato de fecha relativa inteligente:
 * Hoy, Ayer, Mañana → literal
 * 2-6 días → nombre del día (Lunes, Martes...)
 * +7 días → fecha corta (15 abr)
 */
function fechaCorta(iso: string | null, locale: string): string {
  if (!iso) return 'Sin fecha'
  const fecha = new Date(iso)
  const hoy = new Date(); hoy.setHours(0, 0, 0, 0)
  const diff = Math.floor((fecha.getTime() - hoy.getTime()) / 86400000)

  if (diff === 0) return 'Hoy'
  if (diff === 1) return 'Mañana'
  if (diff === -1) return 'Ayer'

  // 2-6 días (pasado o futuro) → nombre del día
  if (diff >= 2 && diff <= 6) {
    return fecha.toLocaleDateString(locale, { weekday: 'long' }).replace(/^\w/, c => c.toUpperCase())
  }
  if (diff <= -2 && diff >= -6) {
    return fecha.toLocaleDateString(locale, { weekday: 'long' }).replace(/^\w/, c => c.toUpperCase())
  }

  // +7 días → fecha corta
  return fecha.toLocaleDateString(locale, { day: '2-digit', month: 'short' })
}

const POR_PAGINA = 50

/** Vista por defecto: mías */
const VISTA_DEFAULT = 'todas'

/**
 * Etiqueta que muestra el nombre completo si entra en el ancho disponible;
 * si no, cae a la abreviatura. Se adapta dinámicamente al resize de la columna.
 */
function EtiquetaTipoAdaptable({ completo, abreviado }: { completo: string; abreviado: string }) {
  const contenedorRef = useRef<HTMLSpanElement>(null)
  const medidorRef = useRef<HTMLSpanElement>(null)
  const [usarCompleto, setUsarCompleto] = useState(true)

  useLayoutEffect(() => {
    if (!abreviado) { setUsarCompleto(true); return }
    const cont = contenedorRef.current
    const med = medidorRef.current
    if (!cont || !med) return
    const medir = () => {
      setUsarCompleto(med.offsetWidth <= cont.clientWidth)
    }
    medir()
    const ro = new ResizeObserver(medir)
    ro.observe(cont)
    return () => ro.disconnect()
  }, [completo, abreviado])

  return (
    <span ref={contenedorRef} className="relative flex-1 text-xs font-semibold overflow-hidden whitespace-nowrap">
      {usarCompleto || !abreviado ? completo : abreviado}
      {/* Medidor invisible con el texto completo para detectar si cabe */}
      <span ref={medidorRef} className="absolute -left-[9999px] top-0 whitespace-nowrap text-xs font-semibold" aria-hidden="true">
        {completo}
      </span>
    </span>
  )
}

interface Props {
  datosInicialesJson?: Record<string, unknown>
}

export default function ContenidoActividades({ datosInicialesJson }: Props) {
  return (
    <GuardPagina modulo="actividades">
      <ContenidoActividadesInterno datosInicialesJson={datosInicialesJson} />
    </GuardPagina>
  )
}

function ContenidoActividadesInterno({ datosInicialesJson }: Props) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { mostrar } = useToast()
  const formato = useFormato()
  const { t } = useTraduccion()
  const modalVisitaHook = useModalVisita()
  const { tienePermiso } = useRol()
  const puedeCrear = tienePermiso('actividades', 'crear')
  const puedeEliminar = tienePermiso('actividades', 'eliminar')
  const puedeCompletar = tienePermiso('actividades', 'completar')
  const puedeEditar = tienePermiso('actividades', 'editar')
  // Marcar notificaciones de actividades como leídas al entrar a la página
  const notificacionesMarcadasRef = useRef(false)
  useEffect(() => {
    if (notificacionesMarcadasRef.current) return
    notificacionesMarcadasRef.current = true
    const tipos = [
      'actividad', 'asignacion', 'actividad_asignada',
      'actividad_pronto_vence', 'actividad_vencida',
      'recordatorio', 'recordatorio_evento', 'calendario', 'evento_asignado',
    ]
    fetch('/api/inbox/notificaciones', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ todas: true, tipos }),
    }).then(() => {
      // Sincronizar el estado del header
      window.dispatchEvent(new CustomEvent('flux:notificaciones-leidas', { detail: { categoria: 'actividades' } }))
    }).catch(() => {})
  }, [])

  // Estado local de UI
  const [modalAbierto, setModalAbierto] = useState(false)
  const [actividadEditando, setActividadEditando] = useState<Actividad | null>(null)

  // Abrir modal de creación si viene ?crear=true desde el dashboard
  const vieneDeDashboardRef = useRef(false)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get('crear') === 'true') {
      window.history.replaceState({}, '', '/actividades')
      vieneDeDashboardRef.current = true
      setActividadEditando(null)
      setModalAbierto(true)
    }
  }, [])

  // Filtros server-side — restaurar desde URL si existen
  const [filtroTipo, setFiltroTipo] = useState(searchParams.get('tipo') || '')
  const [filtroEstado, setFiltroEstado] = useState<string[] | null>(() => {
    const v = searchParams.get('estado')
    return v ? v.split(',') : null
  })
  const [filtroPrioridad, setFiltroPrioridad] = useState(searchParams.get('prioridad') || '')
  const [filtroVista, setFiltroVista] = useState(searchParams.get('vista') || VISTA_DEFAULT)
  // Nuevos filtros
  const [filtroAsignados, setFiltroAsignados] = useState<string[]>(() => {
    const v = searchParams.get('asignado_a')
    return v ? v.split(',') : []
  })
  const [filtroSinAsignado, setFiltroSinAsignado] = useState(searchParams.get('sin_asignado') === 'true')
  const [filtroCreadoPor, setFiltroCreadoPor] = useState(searchParams.get('creado_por') || '')
  const [filtroVencimiento, setFiltroVencimiento] = useState(searchParams.get('fecha') || '')
  const [filtroContacto, setFiltroContacto] = useState(searchParams.get('contacto_id') || '')
  const [filtroOrden, setFiltroOrden] = useState(searchParams.get('orden_trabajo_id') || '')
  const [filtroPresupuesto, setFiltroPresupuesto] = useState(searchParams.get('presupuesto_id') || '')
  const [filtroCreadoRango, setFiltroCreadoRango] = useState(searchParams.get('creado_rango') || '')

  // Búsqueda con debounce + reset de página automático (incluye TODOS los filtros como deps)
  const { busqueda, setBusqueda, busquedaDebounced, pagina, setPagina } = useBusquedaDebounce(
    searchParams.get('q') || '',
    Number(searchParams.get('pagina')) || 1,
    [
      filtroTipo, filtroEstado, filtroPrioridad, filtroVista,
      filtroAsignados, filtroSinAsignado, filtroCreadoPor, filtroVencimiento,
      filtroContacto, filtroOrden, filtroPresupuesto, filtroCreadoRango,
    ],
  )

  // Sincronizar filtros → URL (replaceState para no contaminar historial)
  useEffect(() => {
    const params = new URLSearchParams()
    if (busquedaDebounced) params.set('q', busquedaDebounced)
    if (filtroTipo) params.set('tipo', filtroTipo)
    if (filtroEstado && filtroEstado.length > 0) params.set('estado', filtroEstado.join(','))
    if (filtroPrioridad) params.set('prioridad', filtroPrioridad)
    if (filtroVista && filtroVista !== VISTA_DEFAULT) params.set('vista', filtroVista)
    if (filtroAsignados.length > 0) params.set('asignado_a', filtroAsignados.join(','))
    if (filtroSinAsignado) params.set('sin_asignado', 'true')
    if (filtroCreadoPor) params.set('creado_por', filtroCreadoPor)
    if (filtroVencimiento) params.set('fecha', filtroVencimiento)
    if (filtroContacto) params.set('contacto_id', filtroContacto)
    if (filtroOrden) params.set('orden_trabajo_id', filtroOrden)
    if (filtroPresupuesto) params.set('presupuesto_id', filtroPresupuesto)
    if (filtroCreadoRango) params.set('creado_rango', filtroCreadoRango)
    if (pagina > 1) params.set('pagina', String(pagina))
    const qs = params.toString()
    const nuevaUrl = qs ? `/actividades?${qs}` : '/actividades'
    window.history.replaceState(null, '', nuevaUrl)
  }, [
    busquedaDebounced, filtroTipo, filtroEstado, filtroPrioridad, filtroVista,
    filtroAsignados, filtroSinAsignado, filtroCreadoPor, filtroVencimiento,
    filtroContacto, filtroOrden, filtroPresupuesto, filtroCreadoRango, pagina,
  ])

  // ═══════ Configuración (antes del listado para calcular filtros default) ═══════

  /** Configuración de tipos, estados y presets (cache largo) */
  const { datos: configData } = useConfig<{ tipos: TipoActividad[]; estados: EstadoActividad[]; config: Record<string, unknown> }>(
    'actividades-config',
    '/api/actividades/config',
    (json) => json as { tipos: TipoActividad[]; estados: EstadoActividad[]; config: Record<string, unknown> },
  )

  const tipos = configData?.tipos || []
  const estados = configData?.estados || []

  // Filtro efectivo de estado — por defecto vacío (muestra todas, sin filtrar por estado)
  const filtroEstadoActual = filtroEstado || []

  // Sin filtro de estado cuenta como default (primera carga)
  const estadoEsDefault = filtroEstadoActual.length === 0
  const sinFiltros =
    !busquedaDebounced &&
    !filtroTipo &&
    estadoEsDefault &&
    !filtroPrioridad &&
    filtroVista === VISTA_DEFAULT &&
    filtroAsignados.length === 0 &&
    !filtroSinAsignado &&
    !filtroCreadoPor &&
    !filtroVencimiento &&
    !filtroContacto &&
    !filtroOrden &&
    !filtroPresupuesto &&
    !filtroCreadoRango &&
    pagina === 1

  // ═══════ Datos con React Query ═══════

  /** Listado paginado de actividades */
  const { datos: actividades, total, cargando, recargar: recargarActividades } = useListado<Actividad>({
    clave: 'actividades',
    url: '/api/actividades',
    parametros: {
      busqueda: busquedaDebounced,
      tipo: filtroTipo || undefined,
      estado: filtroEstadoActual.length > 0 ? filtroEstadoActual.join(',') : undefined,
      prioridad: filtroPrioridad || undefined,
      vista: filtroVista || undefined,
      asignado_a: filtroAsignados.length > 0 ? filtroAsignados.join(',') : undefined,
      sin_asignado: filtroSinAsignado ? 'true' : undefined,
      creado_por: filtroCreadoPor || undefined,
      fecha: filtroVencimiento || undefined,
      contacto_id: filtroContacto || undefined,
      orden_trabajo_id: filtroOrden || undefined,
      presupuesto_id: filtroPresupuesto || undefined,
      creado_rango: filtroCreadoRango || undefined,
      pagina,
      por_pagina: POR_PAGINA,
    },
    extraerDatos: (json) => (json.actividades || []) as Actividad[],
    extraerTotal: (json) => (json.total || 0) as number,
    datosInicialesJson: sinFiltros ? datosInicialesJson : undefined,
  })
  const presetsPosposicion = (configData?.config?.presets_posposicion as { id: string; etiqueta: string; dias: number }[] | undefined)?.length
    ? (configData.config.presets_posposicion as { id: string; etiqueta: string; dias: number }[])
    : [
        { id: '1d', etiqueta: '1 día', dias: 1 },
        { id: '3d', etiqueta: '3 días', dias: 3 },
        { id: '1s', etiqueta: '1 semana', dias: 7 },
        { id: '2s', etiqueta: '2 semanas', dias: 14 },
      ]

  /** Miembros asignables de la empresa (excluye kioscos sin usuario_id). */
  const { data: miembros = [] } = useMiembrosAsignables()

  // Opciones de miembros para filtros (asignado a, creado por)
  const opcionesMiembros = useMemo(
    () => miembros.map(m => ({
      valor: m.usuario_id,
      etiqueta: `${m.nombre || ''} ${m.apellido || ''}`.trim() || 'Sin nombre',
    })),
    [miembros],
  )

  /** Contactos para el filtro "Vinculado a contacto" — limitamos a los más recientes */
  const { data: contactosOpcionesData } = useQuery({
    queryKey: ['actividades-filtros-contactos'],
    queryFn: () => fetch('/api/contactos?por_pagina=200').then(r => r.json()),
    staleTime: 5 * 60_000,
  })
  const opcionesContactos = useMemo(() => {
    const items = (contactosOpcionesData?.contactos || []) as { id: string; nombre: string; apellido: string | null }[]
    return items.map(c => ({
      valor: c.id,
      etiqueta: `${c.nombre}${c.apellido ? ` ${c.apellido}` : ''}`,
    }))
  }, [contactosOpcionesData])

  /** Órdenes de trabajo para el filtro */
  const { data: ordenesOpcionesData } = useQuery({
    queryKey: ['actividades-filtros-ordenes'],
    queryFn: () => fetch('/api/ordenes?por_pagina=200').then(r => r.json()),
    staleTime: 5 * 60_000,
  })
  const opcionesOrdenes = useMemo(() => {
    const items = (ordenesOpcionesData?.ordenes || []) as { id: string; codigo: string | null; titulo: string | null }[]
    return items.map(o => ({
      valor: o.id,
      etiqueta: `${o.codigo || ''} ${o.titulo || ''}`.trim() || 'Sin título',
    }))
  }, [ordenesOpcionesData])

  /** Presupuestos para el filtro */
  const { data: presupuestosOpcionesData } = useQuery({
    queryKey: ['actividades-filtros-presupuestos'],
    queryFn: () => fetch('/api/presupuestos?por_pagina=200').then(r => r.json()),
    staleTime: 5 * 60_000,
  })
  const opcionesPresupuestos = useMemo(() => {
    const items = (presupuestosOpcionesData?.presupuestos || []) as { id: string; numero: string | null; titulo: string | null; contacto_nombre?: string | null }[]
    return items.map(p => ({
      valor: p.id,
      etiqueta: `${p.numero || ''} ${p.titulo || p.contacto_nombre || ''}`.trim() || 'Sin título',
    }))
  }, [presupuestosOpcionesData])

  // Mapas memoizados
  const tiposPorId = useMemo(() => Object.fromEntries(tipos.map(t => [t.id, t])), [tipos])
  const estadosPorClave = useMemo(() => Object.fromEntries(estados.map(e => [e.clave, e])), [estados])

  // Abrir modal si viene ?actividad_id=UUID (desde notificación o recientes)
  const actividadIdParam = searchParams.get('actividad_id')
  const yaAbiertoRef = useRef<string | null>(null)
  const vieneDeDeepLinkRef = useRef(false)
  useEffect(() => {
    if (!actividadIdParam || actividadIdParam === yaAbiertoRef.current) return
    yaAbiertoRef.current = actividadIdParam
    vieneDeDeepLinkRef.current = true
    // Buscar en las actividades cargadas o fetch directo
    const encontrada = actividades.find(a => a.id === actividadIdParam)
    if (encontrada) {
      setActividadEditando(encontrada)
      setModalAbierto(true)
    } else {
      // Fetch directo si no está en la página actual
      fetch(`/api/actividades/${actividadIdParam}`)
        .then(r => r.ok ? r.json() : null)
        .then(data => {
          if (data) { setActividadEditando(data); setModalAbierto(true) }
        })
    }
    // Limpiar el param de la URL sin recargar
    router.replace('/actividades', { scroll: false })
  }, [actividadIdParam, actividades, router])

  // Acciones
  const crearActividad = async (datos: Record<string, unknown>) => {
    try {
      const res = await fetch('/api/actividades', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(datos),
      })
      if (!res.ok) throw new Error('Error al crear')
      const resultado = await res.json()
      mostrar('exito', 'Actividad creada')
      recargarActividades()
      return resultado // Devolver para que el modal pueda usar el ID
    } catch {
      mostrar('error', 'Error al crear la actividad')
    }
  }

  const editarActividad = async (datos: Record<string, unknown>) => {
    try {
      const { id, ...campos } = datos
      const res = await fetch(`/api/actividades/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(campos),
      })
      if (!res.ok) throw new Error('Error al editar')
      mostrar('exito', 'Actividad actualizada')
      recargarActividades()
    } catch {
      mostrar('error', 'Error al guardar la actividad')
    }
  }

  // Estado para sugerencia de siguiente actividad
  const [sugerenciaSiguiente, setSugerenciaSiguiente] = useState<{
    tipoActividad: TipoActividad
    vinculos: Vinculo[]
  } | null>(null)

  // ── Finalizadas hoy (completadas + canceladas del día) ──
  const [seccionHoyAbierta, setSeccionHoyAbierta] = useState(true)
  const { data: finalizadasHoyData, refetch: recargarFinalizadasHoy } = useQuery({
    queryKey: ['actividades-finalizadas-hoy', filtroVista],
    queryFn: async () => {
      const hoy = new Date()
      hoy.setHours(0, 0, 0, 0)
      const inicio = hoy.toISOString()
      const fin = new Date(hoy.getTime() + 86400000).toISOString()
      const res = await fetch(`/api/actividades?estado=completada,cancelada&vista=${filtroVista}&por_pagina=50&orden_campo=actualizado_en&orden_dir=desc&fecha_desde=${encodeURIComponent(inicio)}&fecha_hasta=${encodeURIComponent(fin)}`)
      if (!res.ok) return []
      const data = await res.json()
      return (data.actividades || []) as Actividad[]
    },
    staleTime: 30_000,
  })
  const finalizadasHoy = finalizadasHoyData || []

  const reactivarActividad = useCallback(async (id: string) => {
    try {
      const res = await fetch(`/api/actividades/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accion: 'reactivar' }),
      })
      if (!res.ok) throw new Error()
      mostrar('exito', 'Actividad reactivada')
      recargarActividades()
      recargarFinalizadasHoy()
    } catch {
      mostrar('error', 'Error al reactivar la actividad')
    }
  }, [recargarActividades, recargarFinalizadasHoy, mostrar])

  const completarActividad = async (id: string) => {
    try {
      const res = await fetch(`/api/actividades/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accion: 'completar' }),
      })
      if (!res.ok) throw new Error()
      const data = await res.json()
      mostrar('exito', 'Actividad completada')
      recargarActividades()
      recargarFinalizadasHoy()

      // Manejar encadenamiento
      if (data.siguiente) {
        if (data.siguiente.tipo === 'creada') {
          mostrar('info', `Se creó automáticamente: ${data.siguiente.actividad?.titulo || 'siguiente actividad'}`)
        } else if (data.siguiente.tipo === 'sugerir') {
          setSugerenciaSiguiente({
            tipoActividad: data.siguiente.tipo_actividad,
            vinculos: data.siguiente.vinculos || [],
          })
        }
      }
    } catch {
      mostrar('error', 'Error al completar la actividad')
    }
  }

  const posponerActividad = async (id: string, dias: number) => {
    try {
      const res = await fetch(`/api/actividades/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accion: 'posponer', dias }),
      })
      if (!res.ok) throw new Error()
      mostrar('info', `Actividad pospuesta ${dias} día${dias > 1 ? 's' : ''}`)
      recargarActividades()
    } catch {
      mostrar('error', 'Error al posponer la actividad')
    }
  }

  // ═══════ Acciones en lote ═══════
  const [confirmEliminarLote, setConfirmEliminarLote] = useState<Set<string> | null>(null)
  const [menuPosponerLote, setMenuPosponerLote] = useState<Set<string> | null>(null)
  const [posMenuPosponer, setPosMenuPosponer] = useState<{ x: number; top: number; bottom: number } | null>(null)

  const completarLote = useCallback(async (ids: Set<string>) => {
    try {
      await Promise.all([...ids].map(id =>
        fetch(`/api/actividades/${id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ accion: 'completar' }),
        })
      ))
      mostrar('exito', `${ids.size} actividad${ids.size > 1 ? 'es' : ''} completada${ids.size > 1 ? 's' : ''}`)
      recargarActividades()
    } catch { mostrar('error', 'Error al completar actividades') }
  }, [recargarActividades, mostrar])

  const posponerLote = useCallback(async (ids: Set<string>, dias: number) => {
    try {
      await Promise.all([...ids].map(id =>
        fetch(`/api/actividades/${id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ accion: 'posponer', dias }),
        })
      ))
      mostrar('info', `${ids.size} actividad${ids.size > 1 ? 'es' : ''} pospuesta${ids.size > 1 ? 's' : ''} ${dias} día${dias > 1 ? 's' : ''}`)
      setMenuPosponerLote(null)
      recargarActividades()
    } catch { mostrar('error', 'Error al posponer actividades') }
  }, [recargarActividades, mostrar])

  const eliminarLote = useCallback(async (ids: Set<string>) => {
    try {
      await Promise.all([...ids].map(id =>
        fetch(`/api/actividades/${id}`, { method: 'DELETE' })
      ))
      mostrar('exito', `${ids.size} actividad${ids.size > 1 ? 'es' : ''} eliminada${ids.size > 1 ? 's' : ''}`)
      setConfirmEliminarLote(null)
      recargarActividades()
    } catch { mostrar('error', 'Error al eliminar actividades') }
  }, [recargarActividades, mostrar])

  const accionesLote = useMemo((): AccionLote[] => {
    const acciones: AccionLote[] = []
    if (puedeCompletar) {
      acciones.push({
        id: 'completar',
        etiqueta: 'Completar',
        icono: <CheckCircle size={14} />,
        onClick: completarLote,
        grupo: 'edicion',
      })
    }
    if (puedeEditar) {
      acciones.push({
        id: 'posponer',
        etiqueta: 'Posponer',
        icono: <Clock size={14} />,
        onClick: (ids) => {
          // Buscar el botón de posponer en la barra para posicionar el popover
          const boton = document.querySelector('[data-accion-lote="posponer"]') as HTMLElement
          if (boton) {
            const rect = boton.getBoundingClientRect()
            setPosMenuPosponer({ x: rect.left + rect.width / 2, top: rect.top, bottom: rect.bottom })
          }
          setMenuPosponerLote(ids)
        },
        noLimpiarSeleccion: true,
        grupo: 'edicion',
      })
    }
    if (puedeEliminar) {
      acciones.push({
        id: 'eliminar',
        etiqueta: t('comun.eliminar'),
        icono: <Trash2 size={14} />,
        onClick: (ids) => setConfirmEliminarLote(ids),
        peligro: true,
        atajo: 'Supr',
        grupo: 'peligro',
      })
    }
    return acciones
  }, [completarLote, puedeCompletar, puedeEditar, puedeEliminar, t])

  /**
   * Acción inteligente por tipo. Despacha por `tipo.accion_destino` (configurable
   * por la empresa) en vez de hardcodear por `tipo.clave`. Si el tipo no tiene
   * acción destino, se abre el modal de edición default.
   */
  const ejecutarAccionTipo = (act: Actividad) => {
    const tipo = tiposPorId[act.tipo_id]
    if (!tipo) return
    const accion = tipo.accion_destino ? ACCIONES_TIPO_ACTIVIDAD[tipo.accion_destino] : null
    if (accion) {
      const contacto = (act.vinculos as Vinculo[])?.find(v => v.tipo === 'contacto')
      // Pasar siempre el origen si el tipo tiene algún evento de auto-completar
      // configurado: el backend decide cuándo cerrar la actividad ('al_crear',
      // 'al_enviar' o 'al_finalizar').
      const actOrigenId = tipo.evento_auto_completar ? act.id : undefined
      router.push(accion.ruta(contacto?.id, actOrigenId))
      return
    }
    // Sin acción destino: abrir el modal de edición.
    setActividadEditando(act)
    setModalAbierto(true)
  }

  /** Columnas de la tabla */
  const columnas: ColumnaDinamica<Actividad>[] = [
    {
      clave: 'titulo',
      etiqueta: 'Actividad',
      ancho: 320,
      ordenable: true,
      render: (fila) => {
        const tipo = tiposPorId[fila.tipo_id]
        const Icono = tipo ? obtenerIcono(tipo.icono) : null
        const completada = fila.estado_clave === 'completada' || fila.estado_clave === 'cancelada'
        const contacto = (fila.vinculos as Vinculo[])?.find(v => v.tipo === 'contacto')
        const cantSeguimientos = Array.isArray(fila.seguimientos) ? fila.seguimientos.length : 0
        return (
          <div className="flex items-center gap-2.5 min-w-0">
            {tipo && (
              <div
                className="w-7 h-7 rounded-card flex items-center justify-center shrink-0"
                style={{ backgroundColor: tipo.color + '15', color: tipo.color }}
              >
                {Icono && <Icono size={14} />}
              </div>
            )}
            <div className="min-w-0">
              <p className={`text-sm font-medium truncate flex items-center gap-1.5 ${completada ? 'line-through text-texto-terciario' : 'text-texto-primario'}`}>
                {fila.titulo}
                {cantSeguimientos > 0 && (
                  <span className="inline-flex items-center gap-0.5 text-xxs font-bold text-insignia-advertencia-texto bg-insignia-advertencia-fondo px-1.5 py-0.5 rounded-full shrink-0" title={`${cantSeguimientos} seguimiento${cantSeguimientos > 1 ? 's' : ''}`}>
                    🔥{cantSeguimientos}
                  </span>
                )}
              </p>
              {contacto && (
                <p className="text-xs text-texto-terciario truncate flex items-center gap-1">
                  <User size={10} /> {contacto.nombre}
                </p>
              )}
              {fila.descripcion && (
                <p className="text-xs text-texto-terciario/60 truncate">
                  {fila.descripcion}
                </p>
              )}
            </div>
          </div>
        )
      },
    },
    {
      clave: 'tipo_clave',
      etiqueta: 'Tipo',
      ancho: 160,
      ordenable: true,
      render: (fila) => {
        const tipo = tiposPorId[fila.tipo_id]
        if (!tipo) return null
        return (
          <div
            className="-mx-4 -my-2.5 px-3 py-2.5 flex items-center h-full"
            style={{ backgroundColor: tipo.color + '24', color: tipo.color }}
          >
            <EtiquetaTipoAdaptable completo={tipo.etiqueta} abreviado={tipo.abreviacion || ''} />
          </div>
        )
      },
    },
    {
      clave: 'prioridad',
      etiqueta: 'Prioridad',
      ancho: 90,
      ordenable: true,
      render: (fila) => {
        const p = COLORES_PRIORIDAD[fila.prioridad]
        if (!p) return null
        if (fila.prioridad === 'normal') return <span className="text-xs text-texto-terciario">{p.etiqueta}</span>
        return <Insignia color={p.color as 'info' | 'peligro'}>{p.etiqueta}</Insignia>
      },
    },
    {
      clave: 'asignados',
      etiqueta: 'Responsables',
      ancho: 160,
      ordenable: false,
      render: (fila) => {
        const lista = Array.isArray(fila.asignados) ? fila.asignados as { id: string; nombre: string }[] : []
        if (lista.length === 0) return <span className="text-xs text-texto-terciario/50">—</span>
        if (lista.length === 1) return <span className="text-xs text-texto-secundario">{lista[0].nombre}</span>
        return (
          <div className="flex items-center gap-1">
            <span className="text-xs text-texto-secundario">{lista[0].nombre}</span>
            <span className="text-[10px] text-texto-terciario bg-superficie-hover rounded-full px-1.5 py-0.5">+{lista.length - 1}</span>
          </div>
        )
      },
    },
    {
      clave: 'fecha_vencimiento',
      etiqueta: 'Vencimiento',
      ancho: 110,
      ordenable: true,
      render: (fila) => {
        if (!fila.fecha_vencimiento) return <span className="text-xs text-texto-terciario/50">—</span>
        const fecha = new Date(fila.fecha_vencimiento)
        const hoy = new Date(); hoy.setHours(0, 0, 0, 0)
        const vencida = fecha < hoy && fila.estado_clave !== 'completada' && fila.estado_clave !== 'cancelada'
        const esHoy = Math.abs(fecha.getTime() - hoy.getTime()) < 86400000
        return (
          <span className={`text-xs font-medium ${
            vencida ? 'text-insignia-peligro-texto' : esHoy ? 'text-insignia-advertencia-texto' : 'text-texto-terciario'
          }`}>
            {fechaCorta(fila.fecha_vencimiento, formato.locale)}
          </span>
        )
      },
    },
    {
      clave: 'estado_clave_badge',
      etiqueta: 'Estado',
      ancho: 100,
      ordenable: false,
      obtenerValor: (fila) => fila.estado_clave,
      render: (fila) => {
        const estado = estadosPorClave[fila.estado_clave]
        if (!estado) return null
        const IconoE = obtenerIcono(estado.icono)
        return (
          <span className="inline-flex items-center gap-1 text-xs font-medium" style={{ color: estado.color }}>
            {IconoE && <IconoE size={12} />}
            {estado.etiqueta}
          </span>
        )
      },
    },
    {
      clave: 'acciones',
      etiqueta: '',
      ancho: 110,
      render: (fila) => {
        const esPendiente = fila.estado_clave !== 'completada' && fila.estado_clave !== 'cancelada'
        const estado = estadosPorClave[fila.estado_clave]
        const tipo = tiposPorId[fila.tipo_id]
        const accionTipo = tipo?.accion_destino ? ACCIONES_TIPO_ACTIVIDAD[tipo.accion_destino] : null
        const tieneAccionTipo = esPendiente && accionTipo
        const IconoAccion = accionTipo?.icono ?? ClipboardList
        return (
          <div className="flex items-center gap-0.5 justify-end">
            {/* Acción inteligente según tipo — espacio fijo */}
            <div className="size-6 shrink-0 flex items-center justify-center">
              {tieneAccionTipo && (
                <Tooltip contenido={accionTipo.etiqueta}>
                  <Boton
                    variante="fantasma"
                    tamano="xs"
                    soloIcono
                    icono={<IconoAccion size={14} />}
                    onClick={(e) => { e.stopPropagation(); ejecutarAccionTipo(fila) }}
                    titulo={`Ir a ${tipo?.etiqueta?.toLowerCase()}`}
                  />
                </Tooltip>
              )}
            </div>
            {/* Completar / estado — siempre visible */}
            <Tooltip contenido={esPendiente ? 'Completar' : estado?.etiqueta || ''}>
              <button
                onClick={(e) => { e.stopPropagation(); if (esPendiente) completarActividad(fila.id) }}
                className={`size-6 rounded-boton flex items-center justify-center shrink-0 transition-colors ${
                  esPendiente
                    ? 'bg-transparent cursor-pointer hover:bg-insignia-exito-fondo hover:text-insignia-exito-texto text-texto-terciario'
                    : 'bg-transparent cursor-default'
                }`}
                style={!esPendiente && estado ? { color: estado.color } : undefined}
              >
                <CheckCircle size={14} />
              </button>
            </Tooltip>
            {/* Posponer con dropdown — espacio fijo */}
            <div className="size-6 shrink-0 flex items-center justify-center">
              {esPendiente && (
                <div className="relative group/posponer">
                  <Tooltip contenido="Posponer">
                    <Boton
                      variante="fantasma"
                      tamano="xs"
                      soloIcono
                      icono={<Clock size={14} />}
                      onClick={(e) => { e.stopPropagation(); posponerActividad(fila.id, presetsPosposicion[0]?.dias ?? 1) }}
                      titulo="Posponer"
                      className="hover:bg-insignia-advertencia-fondo hover:text-insignia-advertencia-texto"
                    />
                  </Tooltip>
                  <div className="absolute top-full right-0 mt-0.5 bg-superficie-elevada border border-borde-sutil rounded-card shadow-lg overflow-hidden z-50 hidden group-hover/posponer:block min-w-[120px]">
                    {presetsPosposicion.map(op => (
                      <button
                        key={op.id}
                        onClick={(e) => { e.stopPropagation(); posponerActividad(fila.id, op.dias) }}
                        className="w-full px-3 py-1.5 text-xs text-left text-texto-primario bg-transparent border-none cursor-pointer hover:bg-superficie-hover transition-colors"
                      >
                        {op.etiqueta}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )
      },
    },
    {
      clave: 'editado_por' as keyof Actividad, etiqueta: 'Auditoría', ancho: 44, icono: <History size={12} />,
      render: (fila) => (fila.editado_por || fila.creado_por) ? (
        <IndicadorEditado
          entidadId={fila.id}
          nombreCreador={fila.creado_por_nombre}
          fechaCreacion={fila.creado_en}
          nombreEditor={fila.editado_por_nombre}
          fechaEdicion={fila.actualizado_en}
          tablaAuditoria="auditoria_actividades"
          campoReferencia="actividad_id"
        />
      ) : null,
    },
  ]

  /** Render tarjeta para vista cards */
  const renderTarjeta = (fila: Actividad) => {
    const tipo = tiposPorId[fila.tipo_id]
    const estado = estadosPorClave[fila.estado_clave]
    const Icono = tipo ? obtenerIcono(tipo.icono) : null
    const completada = fila.estado_clave === 'completada' || fila.estado_clave === 'cancelada'
    const esPendiente = !completada
    const contacto = (fila.vinculos as Vinculo[])?.find(v => v.tipo === 'contacto')
    const vencida = fila.fecha_vencimiento && new Date(fila.fecha_vencimiento) < new Date() && esPendiente

    return (
      <div className="flex flex-col h-full">
        {/* Header: tipo + estado (pr-6 para dejar espacio al checkbox de selección) */}
        <div className="flex items-center justify-between mb-3 pr-6">
          <div className="flex items-center gap-2">
            {tipo && (
              <div
                className="w-7 h-7 rounded-card flex items-center justify-center shrink-0"
                style={{ backgroundColor: tipo.color + '15', color: tipo.color }}
              >
                {Icono && <Icono size={14} />}
              </div>
            )}
            <span className="text-xs font-medium px-2 py-0.5 rounded-full" style={{ backgroundColor: (tipo?.color || '#888') + '12', color: tipo?.color }}>
              {tipo?.etiqueta || fila.tipo_clave}
            </span>
          </div>
          {estado && (
            <span className="text-xxs font-medium" style={{ color: estado.color }}>
              {estado.etiqueta}
            </span>
          )}
        </div>

        {/* Título + badge seguimientos */}
        <p className={`text-sm font-medium mb-1 flex items-center gap-1.5 ${completada ? 'line-through text-texto-terciario' : 'text-texto-primario'}`}>
          <span className="truncate">{fila.titulo}</span>
          {Array.isArray(fila.seguimientos) && fila.seguimientos.length > 0 && (
            <span className="inline-flex items-center gap-0.5 text-xxs font-bold text-insignia-advertencia-texto bg-insignia-advertencia-fondo px-1.5 py-0.5 rounded-full shrink-0">
              🔥{fila.seguimientos.length}
            </span>
          )}
        </p>

        {/* Contacto vinculado */}
        {contacto && (
          <p className="text-xs text-texto-terciario mb-2 flex items-center gap-1">
            <User size={10} />
            {contacto.nombre}
          </p>
        )}

        {/* Spacer */}
        <div className="flex-1" />

        {/* Footer: responsable + fecha + prioridad + acciones */}
        <div className="pt-3 mt-auto border-t border-borde-sutil space-y-2">
          {/* Responsable */}
          {(() => {
            const listaAsig = Array.isArray(fila.asignados) ? fila.asignados as { id: string; nombre: string }[] : []
            if (listaAsig.length === 0) return null
            return (
              <div className="flex items-center gap-1">
                {listaAsig.slice(0, 3).map((a, i) => (
                  <div key={a.id} className="size-5 rounded-full bg-superficie-hover flex items-center justify-center text-xxs font-bold text-texto-terciario shrink-0" title={a.nombre} style={i > 0 ? { marginLeft: -4 } : undefined}>
                    {a.nombre.charAt(0).toUpperCase()}
                  </div>
                ))}
                <span className="text-xs text-texto-terciario ml-1">
                  {listaAsig.length === 1 ? listaAsig[0].nombre : `${listaAsig.length} personas`}
                </span>
              </div>
            )
          })()}

          {/* Fecha + prioridad + botones */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {fila.fecha_vencimiento && (
                <span className={`text-xs font-medium ${vencida ? 'text-insignia-peligro-texto' : 'text-texto-terciario'}`}>
                  {fechaCorta(fila.fecha_vencimiento, formato.locale)}
                </span>
              )}
              {fila.prioridad === 'alta' && <Insignia color="peligro">Alta</Insignia>}
              {fila.prioridad === 'baja' && <Insignia color="info">Baja</Insignia>}
            </div>

            {esPendiente && (() => {
              const accionTipoMobile = tipo?.accion_destino ? ACCIONES_TIPO_ACTIVIDAD[tipo.accion_destino] : null
              const IconoAccionMobile = accionTipoMobile?.icono ?? ClipboardList
              return (
              <div className="flex items-center gap-0.5">
                {accionTipoMobile && (
                  <Tooltip contenido={accionTipoMobile.etiqueta}>
                    <Boton
                      variante="fantasma"
                      tamano="xs"
                      soloIcono
                      icono={<IconoAccionMobile size={15} />}
                      onClick={(e) => { e.stopPropagation(); ejecutarAccionTipo(fila) }}
                      titulo={`Ir a ${tipo?.etiqueta?.toLowerCase()}`}
                    />
                  </Tooltip>
                )}
                <Boton
                  variante="fantasma"
                  tamano="xs"
                  soloIcono
                  icono={<CheckCircle size={15} />}
                  onClick={(e) => { e.stopPropagation(); completarActividad(fila.id) }}
                  titulo="Completar"
                  className="hover:bg-insignia-exito-fondo hover:text-insignia-exito-texto"
                />
                <div className="relative group/posponer">
                  <Boton
                    variante="fantasma"
                    tamano="xs"
                    soloIcono
                    icono={<Clock size={15} />}
                    onClick={(e) => { e.stopPropagation(); posponerActividad(fila.id, presetsPosposicion[0]?.dias ?? 1) }}
                    titulo="Posponer"
                    className="hover:bg-insignia-advertencia-fondo hover:text-insignia-advertencia-texto"
                  />
                  <div className="absolute bottom-full right-0 mb-0.5 bg-superficie-elevada border border-borde-sutil rounded-card shadow-lg overflow-hidden z-50 hidden group-hover/posponer:block min-w-[120px]">
                    {presetsPosposicion.map(op => (
                      <button
                        key={op.id}
                        onClick={(e) => { e.stopPropagation(); posponerActividad(fila.id, op.dias) }}
                        className="w-full px-3 py-1.5 text-xs text-left text-texto-primario bg-transparent border-none cursor-pointer hover:bg-superficie-hover transition-colors"
                      >
                        {op.etiqueta}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              )
            })()}
          </div>
        </div>
      </div>
    )
  }

  return (
    <PlantillaListado
      titulo="Actividades"
      icono={<ClipboardList size={20} />}
      accionPrincipal={puedeCrear ? {
        etiqueta: 'Nueva actividad',
        icono: <PlusCircle size={14} />,
        onClick: () => { setActividadEditando(null); setModalAbierto(true) },
      } : undefined}
      acciones={[
        { id: 'exportar', etiqueta: 'Exportar', icono: <Download size={14} />, onClick: () => {} },
      ]}
      mostrarConfiguracion
      onConfiguracion={() => router.push('/actividades/configuracion')}
    >
      <TablaDinamica
        columnas={columnas}
        columnasVisiblesDefault={['estado_clave', 'titulo', 'tipo_clave', 'prioridad', 'asignados', 'fecha_vencimiento', 'acciones']}
        datos={actividades}
        claveFila={(r) => r.id}
        totalRegistros={total}
        registrosPorPagina={POR_PAGINA}
        paginaExterna={pagina}
        onCambiarPagina={setPagina}
        vistas={['lista', 'tarjetas']}
        seleccionables
        accionesLote={accionesLote}
        busqueda={busqueda}
        onBusqueda={setBusqueda}
        placeholder="Buscar actividades..."
        filtros={configData ? [
          // ── Identidad ──
          {
            id: 'tipo', etiqueta: 'Tipo', tipo: 'seleccion-compacto' as const,
            valor: filtroTipo, onChange: (v) => setFiltroTipo(v as string),
            opciones: tipos.filter(t => t.activo).map(t => ({ valor: t.clave, etiqueta: t.etiqueta })),
            descripcion: 'Filtrá por categoría de actividad (llamada, reunión, tarea, visita, etc.).',
          },
          {
            id: 'creado_por', etiqueta: 'Creado por', tipo: 'seleccion-compacto' as const,
            valor: filtroCreadoPor, onChange: (v) => setFiltroCreadoPor(v as string),
            opciones: opcionesMiembros,
            descripcion: 'Mostrá solo las actividades creadas por el miembro elegido.',
          },
          // ── Asignación ──
          {
            id: 'asignado_a', etiqueta: 'Asignado a', tipo: 'multiple-compacto' as const,
            valor: filtroAsignados,
            onChange: (v) => setFiltroAsignados(Array.isArray(v) ? v : []),
            opciones: opcionesMiembros,
            descripcion: 'Actividades asignadas a uno o más miembros (cumple si al menos uno coincide).',
          },
          {
            id: 'sin_asignado', etiqueta: 'Sin asignar', tipo: 'pills' as const,
            valor: filtroSinAsignado ? 'true' : '',
            onChange: (v) => setFiltroSinAsignado(v === 'true'),
            opciones: [{ valor: 'true', etiqueta: 'Sí' }],
            descripcion: 'Actividades que no tienen ningún responsable asignado.',
          },
          {
            id: 'vista', etiqueta: 'Perspectiva', tipo: 'pills' as const,
            valor: filtroVista, onChange: (v) => setFiltroVista(v as string),
            opciones: [
              { valor: 'propias', etiqueta: 'Propias' },
              { valor: 'mias', etiqueta: 'Mías' },
              { valor: 'enviadas', etiqueta: 'Enviadas' },
            ],
            valorDefault: VISTA_DEFAULT,
            descripcion: 'Propias = creadas o asignadas a mí. Mías = solo asignadas a mí. Enviadas = solo creadas por mí.',
          },
          // ── Estado ──
          {
            id: 'estado', etiqueta: 'Estado', tipo: 'multiple-compacto' as const,
            valor: filtroEstadoActual, onChange: (v) => setFiltroEstado(Array.isArray(v) ? v : (v ? [v] : [])),
            opciones: estados.filter(e => e.activo).map(e => ({ valor: e.clave, etiqueta: e.etiqueta })),
            valorDefault: [],
            descripcion: 'Por defecto se muestran todos los estados. Elegí uno o más para filtrar.',
          },
          {
            id: 'prioridad', etiqueta: 'Prioridad', tipo: 'pills' as const,
            valor: filtroPrioridad, onChange: (v) => setFiltroPrioridad(v as string),
            opciones: [
              { valor: 'baja', etiqueta: 'Baja' },
              { valor: 'normal', etiqueta: 'Normal' },
              { valor: 'alta', etiqueta: 'Alta' },
            ],
            descripcion: 'Nivel de prioridad asignado a la actividad.',
          },
          // ── Vencimiento ──
          {
            id: 'vencimiento', etiqueta: 'Vencimiento', tipo: 'pills' as const,
            valor: filtroVencimiento, onChange: (v) => setFiltroVencimiento(v as string),
            opciones: [
              { valor: 'hoy', etiqueta: 'Hoy' },
              { valor: 'semana', etiqueta: 'Esta semana' },
              { valor: 'vencidas', etiqueta: 'Vencidas' },
              { valor: 'futuras', etiqueta: 'Futuras' },
              { valor: 'sin_fecha', etiqueta: 'Sin fecha' },
            ],
            descripcion: 'Filtrá por proximidad de la fecha de vencimiento.',
          },
          // ── Vínculos ──
          {
            id: 'contacto', etiqueta: 'Contacto', tipo: 'seleccion-compacto' as const,
            valor: filtroContacto, onChange: (v) => setFiltroContacto(v as string),
            opciones: opcionesContactos,
            descripcion: 'Actividades vinculadas al contacto elegido.',
          },
          {
            id: 'orden_trabajo', etiqueta: 'Orden de trabajo', tipo: 'seleccion-compacto' as const,
            valor: filtroOrden, onChange: (v) => setFiltroOrden(v as string),
            opciones: opcionesOrdenes,
            descripcion: 'Actividades vinculadas a la orden de trabajo elegida.',
          },
          {
            id: 'presupuesto', etiqueta: 'Presupuesto', tipo: 'seleccion-compacto' as const,
            valor: filtroPresupuesto, onChange: (v) => setFiltroPresupuesto(v as string),
            opciones: opcionesPresupuestos,
            descripcion: 'Actividades vinculadas al presupuesto elegido.',
          },
          // ── Fechas ──
          {
            id: 'creado_rango', etiqueta: 'Creado en', tipo: 'pills' as const,
            valor: filtroCreadoRango, onChange: (v) => setFiltroCreadoRango(v as string),
            opciones: [
              { valor: 'hoy', etiqueta: 'Hoy' },
              { valor: '7d', etiqueta: '7 días' },
              { valor: '30d', etiqueta: '30 días' },
              { valor: '90d', etiqueta: '90 días' },
              { valor: 'este_ano', etiqueta: 'Este año' },
            ],
            descripcion: 'Actividades creadas dentro del rango elegido.',
          },
        ] : []}
        gruposFiltros={[
          { id: 'identidad', etiqueta: 'Identidad', filtros: ['tipo', 'creado_por'] },
          { id: 'asignacion', etiqueta: 'Asignación', filtros: ['asignado_a', 'sin_asignado', 'vista'] },
          { id: 'estado', etiqueta: 'Estado', filtros: ['estado', 'prioridad'] },
          { id: 'vencimiento', etiqueta: 'Vencimiento', filtros: ['vencimiento'] },
          { id: 'vinculos', etiqueta: 'Vínculos', filtros: ['contacto', 'orden_trabajo', 'presupuesto'] },
          { id: 'fechas', etiqueta: 'Fechas', filtros: ['creado_rango'] },
        ]}
        onLimpiarFiltros={() => {
          setFiltroTipo('')
          setFiltroEstado(null)
          setFiltroPrioridad('')
          setFiltroVista(VISTA_DEFAULT)
          setFiltroAsignados([])
          setFiltroSinAsignado(false)
          setFiltroCreadoPor('')
          setFiltroVencimiento('')
          setFiltroContacto('')
          setFiltroOrden('')
          setFiltroPresupuesto('')
          setFiltroCreadoRango('')
        }}
        opcionesOrden={[
          { etiqueta: 'Más recientes', clave: 'creado_en', direccion: 'desc' },
          { etiqueta: 'Más antiguos', clave: 'creado_en', direccion: 'asc' },
          { etiqueta: 'Vencimiento ↑', clave: 'fecha_vencimiento', direccion: 'asc' },
          { etiqueta: 'Vencimiento ↓', clave: 'fecha_vencimiento', direccion: 'desc' },
          { etiqueta: 'Prioridad ↓', clave: 'prioridad', direccion: 'desc' },
          { etiqueta: 'Título A-Z', clave: 'titulo', direccion: 'asc' },
          { etiqueta: 'Título Z-A', clave: 'titulo', direccion: 'desc' },
        ]}
        idModulo="actividades"
        renderTarjeta={renderTarjeta}
        onClickFila={(fila) => {
          // Si es actividad tipo visita, intentar abrir ModalVisita con la visita vinculada
          if (fila.tipo_clave === 'visita') {
            fetch(`/api/visitas?actividad_id=${fila.id}`)
              .then(r => r.json())
              .then(data => {
                const visitas = data.visitas || []
                if (visitas.length > 0) {
                  modalVisitaHook.abrir(visitas[0])
                } else {
                  // Sin visita vinculada: abrir como actividad normal
                  setActividadEditando(fila)
                  setModalAbierto(true)
                }
              })
              .catch(() => {
                setActividadEditando(fila)
                setModalAbierto(true)
              })
            return
          }
          setActividadEditando(fila)
          setModalAbierto(true)
          // Registrar en historial de recientes (fire-and-forget)
          fetch('/api/dashboard/recientes', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              tipoEntidad: 'actividad',
              entidadId: fila.id,
              titulo: fila.titulo || 'Actividad',
              subtitulo: fila.estado_clave || undefined,
              accion: 'visto',
            }),
          }).catch(() => {})
        }}
        mostrarResumen
        estadoVacio={
          <EstadoVacio
            icono={<CalendarClock size={52} strokeWidth={1} />}
            titulo="Sin actividades"
            descripcion="Crea tu primera actividad para empezar a organizar el trabajo de tu equipo."
            accion={
              <Boton onClick={() => { setActividadEditando(null); setModalAbierto(true) }}>
                Crear primera actividad
              </Boton>
            }
          />
        }
      />

      {/* Sección: finalizadas hoy */}
      {finalizadasHoy.length > 0 && (
        <div className="mt-4 border border-borde-sutil rounded-card overflow-hidden">
          <button
            type="button"
            onClick={() => setSeccionHoyAbierta(!seccionHoyAbierta)}
            className="w-full flex items-center justify-between px-4 py-2.5 bg-white/[0.02] hover:bg-white/[0.04] transition-colors"
          >
            <span className="flex items-center gap-2 text-xs font-medium text-texto-terciario uppercase tracking-wider">
              <CheckCircle size={13} />
              Finalizadas hoy ({finalizadasHoy.length})
            </span>
            {seccionHoyAbierta ? <ChevronUp size={14} className="text-texto-terciario" /> : <ChevronDown size={14} className="text-texto-terciario" />}
          </button>
          {seccionHoyAbierta && (
            <div className="divide-y divide-white/[0.05]">
              {finalizadasHoy.map(a => {
                const tipo = tiposPorId[a.tipo_id]
                const estado = estadosPorClave[a.estado_clave]
                return (
                  <div key={a.id} className="flex items-center gap-3 px-4 py-2.5 hover:bg-white/[0.02] transition-colors">
                    <div className="flex-shrink-0">
                      {a.estado_clave === 'completada'
                        ? <CheckCircle size={15} className="text-insignia-exito" />
                        : <XCircle size={15} className="text-insignia-peligro" />
                      }
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-texto-secundario truncate">{a.titulo}</span>
                        {tipo && (
                          <Insignia color={(tipo.color || 'neutro') as 'exito' | 'peligro' | 'info' | 'advertencia' | 'neutro'} tamano="sm">
                            {tipo.etiqueta}
                          </Insignia>
                        )}
                        <Insignia color={a.estado_clave === 'completada' ? 'exito' : 'peligro'} tamano="sm">
                          {estado?.etiqueta || a.estado_clave}
                        </Insignia>
                      </div>
                      {a.vinculos?.length > 0 && (
                        <span className="text-xs text-texto-terciario truncate block">
                          {a.vinculos.map(v => v.nombre).join(', ')}
                        </span>
                      )}
                    </div>
                    <span className="text-xs text-texto-terciario flex-shrink-0">
                      {a.actualizado_en ? new Date(a.actualizado_en).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' }) : ''}
                    </span>
                    <button
                      type="button"
                      onClick={() => reactivarActividad(a.id)}
                      className="flex items-center gap-1.5 px-2.5 py-1 rounded-boton text-xs font-medium text-texto-terciario hover:text-texto-primario hover:bg-white/[0.06] transition-colors flex-shrink-0"
                      title="Reactivar actividad"
                    >
                      <RotateCcw size={12} />
                      Reactivar
                    </button>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      <ModalActividad
        abierto={modalAbierto}
        actividad={actividadEditando}
        tipos={tipos}
        estados={estados}
        miembros={miembros}
        presetsPosposicion={presetsPosposicion}
        onGuardar={actividadEditando ? editarActividad : crearActividad}
        onCompletar={async (id) => { await completarActividad(id); setModalAbierto(false); setActividadEditando(null) }}
        onPosponer={async (id, dias) => { await posponerActividad(id, dias); setModalAbierto(false); setActividadEditando(null) }}
        onCerrar={() => {
          setModalAbierto(false)
          setActividadEditando(null)
          if (vieneDeDashboardRef.current) {
            vieneDeDashboardRef.current = false
            router.push('/dashboard')
            return
          }
          // Si vino de deep link (recientes/notificación), recargar lista
          if (vieneDeDeepLinkRef.current) {
            vieneDeDeepLinkRef.current = false
            recargarActividades()
          }
        }}
        onCambiarAVisita={() => modalVisitaHook.abrir()}
      />

      {/* Modal de visita — abierto desde actividades tipo visita */}
      <ModalVisita
        abierto={modalVisitaHook.abierto}
        visita={modalVisitaHook.visitaEditando}
        miembros={modalVisitaHook.miembros}
        config={modalVisitaHook.config}
        onGuardar={async (datos) => { await modalVisitaHook.guardar(datos); recargarActividades() }}
        onCompletar={async (id) => { await modalVisitaHook.completarVisita(id); recargarActividades() }}
        onCancelar={async (id) => { await modalVisitaHook.cancelarVisita(id); recargarActividades() }}
        onCerrar={modalVisitaHook.cerrar}
      />

      {/* Confirmar eliminación en lote */}
      <ModalConfirmacion
        abierto={!!confirmEliminarLote}
        titulo="Eliminar actividades"
        descripcion={`¿Eliminar ${confirmEliminarLote?.size ?? 0} actividad${(confirmEliminarLote?.size ?? 0) > 1 ? 'es' : ''}? Se moverán a la papelera.`}
        etiquetaConfirmar={t('comun.eliminar')}
        tipo="peligro"
        onConfirmar={() => confirmEliminarLote && eliminarLote(confirmEliminarLote)}
        onCerrar={() => setConfirmEliminarLote(null)}
      />

      {/* Menú de posponer en lote — popover pegado al botón de la barra */}
      {menuPosponerLote && posMenuPosponer && (
        <>
          <div className="fixed inset-0 z-[var(--z-overlay)]" onClick={() => { setMenuPosponerLote(null); setPosMenuPosponer(null) }} />
          <div
            className="fixed z-[var(--z-popover)] bg-superficie-elevada border border-borde-sutil rounded-card p-1.5 min-w-[160px]"
            style={{
              left: posMenuPosponer.x,
              transform: 'translateX(-50%)',
              ...(posMenuPosponer.top > 220
                ? { top: posMenuPosponer.top - 8, transform: 'translate(-50%, -100%)' }
                : { top: posMenuPosponer.bottom + 8 }),
              boxShadow: 'var(--sombra-md)',
            }}
          >
            {presetsPosposicion.map(op => (
              <button
                key={op.id}
                onClick={() => { posponerLote(menuPosponerLote, op.dias); setPosMenuPosponer(null) }}
                className="w-full px-3 py-2 text-sm text-left text-texto-primario bg-transparent border-none cursor-pointer hover:bg-superficie-hover rounded-card transition-colors flex items-center gap-2"
              >
                <Clock size={14} className="text-texto-terciario" />
                {op.etiqueta}
              </button>
            ))}
          </div>
        </>
      )}
      {/* Sugerencia de siguiente actividad (encadenamiento) */}
      <ModalConfirmacion
        abierto={!!sugerenciaSiguiente}
        titulo="Crear siguiente actividad"
        descripcion={sugerenciaSiguiente ? `La actividad fue completada. ¿Querés crear una actividad de tipo "${sugerenciaSiguiente.tipoActividad.etiqueta}"?` : ''}
        etiquetaConfirmar="Crear actividad"
        tipo="info"
        onConfirmar={() => {
          if (sugerenciaSiguiente) {
            // Abrir modal con el tipo y vínculos precargados
            setActividadEditando(null)
            // Forzar tipo pre-seleccionado: se setea en el modal via vinculoInicial
            setModalAbierto(true)
          }
          setSugerenciaSiguiente(null)
        }}
        onCerrar={() => setSugerenciaSiguiente(null)}
      />
    </PlantillaListado>
  )
}
