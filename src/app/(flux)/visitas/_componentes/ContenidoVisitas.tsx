'use client'

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { useListado, useConfig } from '@/hooks/useListado'
import { useBusquedaDebounce } from '@/hooks/useBusquedaDebounce'
import { GuardPagina } from '@/componentes/entidad/GuardPagina'
import { PlantillaListado } from '@/componentes/entidad/PlantillaListado'
import { TablaDinamica } from '@/componentes/tablas/TablaDinamica'
import type { ColumnaDinamica } from '@/componentes/tablas/TablaDinamica'
import {
  PlusCircle, Download, MapPin, MapPinOff,
  CheckCircle, User, Trash2, History,
  CalendarClock, Route, List,
  RotateCcw, ChevronDown, ChevronUp, XCircle,
} from 'lucide-react'
import { Tabs } from '@/componentes/ui/Tabs'
import type { AccionLote } from '@/componentes/tablas/tipos-tabla'
import { ModalConfirmacion } from '@/componentes/ui/ModalConfirmacion'
import { EstadoVacio } from '@/componentes/feedback/EstadoVacio'
import { Boton } from '@/componentes/ui/Boton'
import { Insignia } from '@/componentes/ui/Insignia'
import { IndicadorEditado } from '@/componentes/ui/IndicadorEditado'
import { ModalVisita } from './ModalVisita'
import type { Visita, Miembro } from './ModalVisita'
import { ModalConfirmarVisita } from './ModalConfirmarVisita'
import PanelPlanificacion from './PanelPlanificacion'
import { crearClienteNavegador } from '@/lib/supabase/cliente'
import { useToast } from '@/componentes/feedback/Toast'
import { useRol } from '@/hooks/useRol'
import { useFormato } from '@/hooks/useFormato'
import { useTraduccion } from '@/lib/i18n'

/**
 * ContenidoVisitas — Client Component principal del módulo de visitas.
 * Tabla con filtros, búsqueda, acciones en lote y modal crear/editar.
 */

// Colores de estado según tokens CSS del proyecto
const COLORES_ESTADO: Record<string, { color: string; variable: string; etiqueta: string }> = {
  provisoria: { color: 'advertencia', variable: 'var(--insignia-advertencia)', etiqueta: 'A confirmar' },
  programada: { color: 'advertencia', variable: 'var(--estado-pendiente)', etiqueta: 'Programada' },
  en_camino: { color: 'exito', variable: 'var(--canal-whatsapp)', etiqueta: 'En camino' },
  en_sitio: { color: 'info', variable: 'var(--insignia-info)', etiqueta: 'En sitio' },
  completada: { color: 'exito', variable: 'var(--estado-completado)', etiqueta: 'Completada' },
  cancelada: { color: 'peligro', variable: 'var(--estado-error)', etiqueta: 'Cancelada' },
  reprogramada: { color: 'advertencia', variable: 'var(--insignia-advertencia)', etiqueta: 'Reprogramada' },
}

const COLORES_PRIORIDAD: Record<string, { color: string; etiqueta: string }> = {
  baja: { color: 'info', etiqueta: 'Baja' },
  normal: { color: 'neutro', etiqueta: 'Normal' },
  alta: { color: 'peligro', etiqueta: 'Alta' },
  urgente: { color: 'peligro', etiqueta: 'Urgente' },
}

/** Formato fecha relativa inteligente */
function fechaCorta(iso: string | null, locale: string): string {
  if (!iso) return 'Sin fecha'
  const fecha = new Date(iso)
  const hoy = new Date(); hoy.setHours(0, 0, 0, 0)
  const diff = Math.floor((fecha.getTime() - hoy.getTime()) / 86400000)

  if (diff === 0) return 'Hoy'
  if (diff === 1) return 'Mañana'
  if (diff === -1) return 'Ayer'
  if (diff >= 2 && diff <= 6) {
    return fecha.toLocaleDateString(locale, { weekday: 'long' }).replace(/^\w/, c => c.toUpperCase())
  }
  if (diff <= -2 && diff >= -6) {
    return fecha.toLocaleDateString(locale, { weekday: 'long' }).replace(/^\w/, c => c.toUpperCase())
  }
  return fecha.toLocaleDateString(locale, { day: '2-digit', month: 'short' })
}

const POR_PAGINA = 50
const ESTADOS_ACTIVOS = ['provisoria', 'programada', 'en_camino', 'en_sitio', 'reprogramada']

interface Props {
  datosInicialesJson?: Record<string, unknown>
  /** Si el usuario solo tiene visibilidad propia (viene de permisos del server) */
  soloPropio?: boolean
}

export default function ContenidoVisitas({ datosInicialesJson, soloPropio }: Props) {
  return (
    <GuardPagina modulo="visitas">
      <ContenidoVisitasInterno datosInicialesJson={datosInicialesJson} soloPropio={soloPropio} />
    </GuardPagina>
  )
}

function ContenidoVisitasInterno({ datosInicialesJson, soloPropio }: Props) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { mostrar } = useToast()
  const formato = useFormato()
  const { t } = useTraduccion()
  const { tienePermiso } = useRol()
  const puedeCrear = tienePermiso('visitas', 'crear')
  const puedeCompletar = tienePermiso('visitas', 'completar')
  const puedeEliminar = tienePermiso('visitas', 'eliminar')

  // Tab activo: listado o planificación
  const [vistaActiva, setVistaActiva] = useState<'listado' | 'planificacion'>('listado')

  // Estado UI
  const [modalAbierto, setModalAbierto] = useState(false)
  const [visitaEditando, setVisitaEditando] = useState<Visita | null>(null)
  // Modal confirmar visita provisoria (agente IA)
  const [visitaConfirmando, setVisitaConfirmando] = useState<Visita | null>(null)

  // Abrir modal si viene ?crear=true desde el dashboard o desde actividades
  const vieneDeDashboardRef = useRef(false)
  const actividadOrigenIdRef = useRef<string | null>(null)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    // Guardar actividad_origen_id si viene de una actividad con evento_auto_completar configurado
    if (params.get('actividad_origen_id')) {
      actividadOrigenIdRef.current = params.get('actividad_origen_id')
    }
    if (params.get('crear') === 'true' || params.get('contacto_id')) {
      window.history.replaceState({}, '', '/visitas')
      vieneDeDashboardRef.current = true
      setVisitaEditando(null)
      setModalAbierto(true)
    }
  }, [])

  // Admins ven todas las visitas por defecto; usuarios con permisos restringidos ven solo propias
  const vistaDefault = soloPropio ? 'propias' : 'todas'

  // Filtros — restaurar desde URL si existen
  const [filtroEstado, setFiltroEstado] = useState<string[]>(() => {
    const v = searchParams.get('estado')
    if (!v) return ESTADOS_ACTIVOS
    const fromUrl = v.split(',')
    // Migración automática: si la URL tiene los 4 estados activos "viejos" (sin provisoria),
    // asumir default nuevo y sumar provisoria. Si el usuario la quitó explícitamente no va a tener los 4.
    const viejosActivos = ['programada', 'en_camino', 'en_sitio', 'reprogramada']
    if (viejosActivos.every(e => fromUrl.includes(e)) && !fromUrl.includes('provisoria') && fromUrl.length === viejosActivos.length) {
      return ESTADOS_ACTIVOS
    }
    return fromUrl
  })
  const [filtroPrioridad, setFiltroPrioridad] = useState<string[]>(() => {
    const v = searchParams.get('prioridad')
    return v ? v.split(',') : []
  })
  const [filtroVista, setFiltroVista] = useState(searchParams.get('vista') || vistaDefault)
  // Nuevos
  const [filtroAsignados, setFiltroAsignados] = useState<string[]>(() => {
    const v = searchParams.get('asignado_a')
    return v ? v.split(',') : []
  })
  const [filtroSinAsignado, setFiltroSinAsignado] = useState(searchParams.get('sin_asignado') === 'true')
  const [filtroCreadoPor, setFiltroCreadoPor] = useState(searchParams.get('creado_por') || '')
  const [filtroTemperatura, setFiltroTemperatura] = useState<string[]>(() => {
    const v = searchParams.get('temperatura')
    return v ? v.split(',') : []
  })
  const [filtroFecha, setFiltroFecha] = useState(searchParams.get('fecha') || '')
  const [filtroContacto, setFiltroContacto] = useState(searchParams.get('contacto_id') || '')
  const [filtroActividad, setFiltroActividad] = useState(searchParams.get('actividad_id') || '')
  const [filtroCreadoRango, setFiltroCreadoRango] = useState(searchParams.get('creado_rango') || '')

  // Búsqueda con debounce + reset de página automático (incluye TODOS los filtros)
  const { busqueda, setBusqueda, busquedaDebounced, pagina, setPagina } = useBusquedaDebounce(
    searchParams.get('q') || '',
    Number(searchParams.get('pagina')) || 1,
    [
      filtroEstado, filtroPrioridad, filtroVista,
      filtroAsignados, filtroSinAsignado, filtroCreadoPor, filtroTemperatura,
      filtroFecha, filtroContacto, filtroActividad, filtroCreadoRango,
    ],
  )

  // Sincronizar filtros → URL
  useEffect(() => {
    const params = new URLSearchParams()
    if (busquedaDebounced) params.set('q', busquedaDebounced)
    if (filtroEstado.length > 0 && !(filtroEstado.length === ESTADOS_ACTIVOS.length && ESTADOS_ACTIVOS.every(e => filtroEstado.includes(e)))) {
      params.set('estado', filtroEstado.join(','))
    }
    if (filtroPrioridad.length > 0) params.set('prioridad', filtroPrioridad.join(','))
    if (filtroVista && filtroVista !== vistaDefault) params.set('vista', filtroVista)
    if (filtroAsignados.length > 0) params.set('asignado_a', filtroAsignados.join(','))
    if (filtroSinAsignado) params.set('sin_asignado', 'true')
    if (filtroCreadoPor) params.set('creado_por', filtroCreadoPor)
    if (filtroTemperatura.length > 0) params.set('temperatura', filtroTemperatura.join(','))
    if (filtroFecha) params.set('fecha', filtroFecha)
    if (filtroContacto) params.set('contacto_id', filtroContacto)
    if (filtroActividad) params.set('actividad_id', filtroActividad)
    if (filtroCreadoRango) params.set('creado_rango', filtroCreadoRango)
    if (pagina > 1) params.set('pagina', String(pagina))
    const qs = params.toString()
    window.history.replaceState(null, '', qs ? `/visitas?${qs}` : '/visitas')
  }, [
    busquedaDebounced, filtroEstado, filtroPrioridad, filtroVista,
    filtroAsignados, filtroSinAsignado, filtroCreadoPor, filtroTemperatura,
    filtroFecha, filtroContacto, filtroActividad, filtroCreadoRango,
    pagina, vistaDefault,
  ])

  // Config de visitas (cache largo)
  const { datos: configData } = useConfig<Record<string, unknown>>(
    'visitas-config',
    '/api/visitas/config',
    (json) => json as Record<string, unknown>,
  )

  // Solo usar datos iniciales cuando NO hay filtros activos (chequea TODOS)
  const estadoEsDefault = filtroEstado.length === ESTADOS_ACTIVOS.length &&
    ESTADOS_ACTIVOS.every(e => filtroEstado.includes(e))
  const sinFiltros =
    !busquedaDebounced &&
    estadoEsDefault &&
    filtroPrioridad.length === 0 &&
    filtroVista === vistaDefault &&
    filtroAsignados.length === 0 &&
    !filtroSinAsignado &&
    !filtroCreadoPor &&
    filtroTemperatura.length === 0 &&
    !filtroFecha &&
    !filtroContacto &&
    !filtroActividad &&
    !filtroCreadoRango &&
    pagina === 1


  // Datos con React Query
  const { datos: visitas, total, cargando, recargar: recargarVisitas } = useListado<Visita>({
    clave: 'visitas',
    url: '/api/visitas',
    parametros: {
      busqueda: busquedaDebounced,
      estado: filtroEstado.length > 0 ? filtroEstado.join(',') : undefined,
      prioridad: filtroPrioridad.length > 0 ? filtroPrioridad.join(',') : undefined,
      vista: filtroVista || undefined,
      asignado_a: filtroAsignados.length > 0 ? filtroAsignados.join(',') : undefined,
      sin_asignado: filtroSinAsignado ? 'true' : undefined,
      creado_por: filtroCreadoPor || undefined,
      temperatura: filtroTemperatura.length > 0 ? filtroTemperatura.join(',') : undefined,
      fecha: filtroFecha || undefined,
      contacto_id: filtroContacto || undefined,
      actividad_id: filtroActividad || undefined,
      creado_rango: filtroCreadoRango || undefined,
      pagina,
      por_pagina: POR_PAGINA,
    },
    extraerDatos: (json) => (json.visitas || []) as Visita[],
    extraerTotal: (json) => (json.total || 0) as number,
    datosInicialesJson: sinFiltros ? datosInicialesJson : undefined,
  })

  // Miembros visitadores — solo los que tienen permiso en módulo recorrido (cache largo)
  const { data: miembrosData } = useQuery({
    queryKey: ['miembros-visitadores'],
    queryFn: async () => {
      const supabase = crearClienteNavegador()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return []
      const empresaId = user.app_metadata?.empresa_activa_id
      if (!empresaId) return []
      const { data: mRes } = await supabase
        .from('miembros')
        .select('usuario_id, rol, permisos_custom')
        .eq('empresa_id', empresaId)
        .eq('activo', true)
      if (!mRes?.length) return []
      // Filtrar visitadores:
      // - Propietario: siempre puede ser visitador (tiene acceso total)
      // - Otros: solo si tienen ver_propio o registrar en recorrido en permisos_custom
      const permisosVisitador = ['ver_propio', 'registrar']
      const esVisitador = (m: typeof mRes[0]) => {
        if (m.rol === 'propietario') return true
        if (!m.permisos_custom) return false
        const permisos = m.permisos_custom as Record<string, string[]>
        return permisos.recorrido?.some((p: string) => permisosVisitador.includes(p)) ?? false
      }
      const visitadores = mRes.filter(esVisitador)
      if (!visitadores.length) return []
      const { data: perfiles } = await supabase.from('perfiles').select('id, nombre, apellido').in('id', visitadores.map(m => m.usuario_id))
      return (perfiles || []).map(p => ({ usuario_id: p.id, nombre: p.nombre, apellido: p.apellido }))
    },
    staleTime: 5 * 60_000,
  })
  const miembros = (miembrosData || []) as Miembro[]

  // Opciones de miembros para filtros (asignado a, creado por)
  const opcionesMiembros = useMemo(
    () => miembros.map(m => ({
      valor: m.usuario_id,
      etiqueta: `${m.nombre || ''} ${m.apellido || ''}`.trim() || 'Sin nombre',
    })),
    [miembros],
  )

  /** Contactos para filtro "Vinculado a contacto" */
  const { data: contactosOpcionesData } = useQuery({
    queryKey: ['visitas-filtros-contactos'],
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

  /** Actividades para filtro */
  const { data: actividadesOpcionesData } = useQuery({
    queryKey: ['visitas-filtros-actividades'],
    queryFn: () => fetch('/api/actividades?por_pagina=200').then(r => r.json()),
    staleTime: 5 * 60_000,
  })
  const opcionesActividades = useMemo(() => {
    const items = (actividadesOpcionesData?.actividades || []) as { id: string; titulo: string }[]
    return items.map(a => ({
      valor: a.id,
      etiqueta: a.titulo || 'Sin título',
    }))
  }, [actividadesOpcionesData])

  // Deep link: ?visita_id=UUID
  const visitaIdParam = searchParams.get('visita_id')
  const yaAbiertoRef = useRef<string | null>(null)
  const vieneDeDeepLinkRef = useRef(false)
  useEffect(() => {
    if (!visitaIdParam || visitaIdParam === yaAbiertoRef.current) return
    yaAbiertoRef.current = visitaIdParam
    vieneDeDeepLinkRef.current = true
    const encontrada = visitas.find(v => v.id === visitaIdParam)
    if (encontrada) {
      setVisitaEditando(encontrada)
      setModalAbierto(true)
    } else {
      fetch(`/api/visitas/${visitaIdParam}`)
        .then(r => r.ok ? r.json() : null)
        .then(data => {
          if (data) { setVisitaEditando(data); setModalAbierto(true) }
        })
    }
    router.replace('/visitas', { scroll: false })
  }, [visitaIdParam, visitas, router])

  // ── Finalizadas hoy (completadas + canceladas del día) ──
  const [seccionHoyAbierta, setSeccionHoyAbierta] = useState(true)
  const { data: finalizadasHoyData, refetch: recargarFinalizadasHoy } = useQuery({
    queryKey: ['visitas-finalizadas-hoy', filtroVista],
    queryFn: async () => {
      const hoy = new Date()
      hoy.setHours(0, 0, 0, 0)
      const inicio = hoy.toISOString()
      const fin = new Date(hoy.getTime() + 86400000).toISOString()
      const res = await fetch(`/api/visitas?estado=completada,cancelada&vista=${filtroVista}&por_pagina=50&orden_campo=actualizado_en&orden_dir=desc&fecha_desde=${encodeURIComponent(inicio)}&fecha_hasta=${encodeURIComponent(fin)}`)
      if (!res.ok) return []
      const data = await res.json()
      return (data.visitas || []) as Visita[]
    },
    staleTime: 30_000,
  })
  const finalizadasHoy = finalizadasHoyData || []

  const reactivarVisita = useCallback(async (id: string) => {
    try {
      const res = await fetch(`/api/visitas/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accion: 'reactivar' }),
      })
      if (!res.ok) throw new Error()
      mostrar('exito', 'Visita reactivada')
      recargarVisitas()
      recargarFinalizadasHoy()
    } catch {
      mostrar('error', 'Error al reactivar la visita')
    }
  }, [recargarVisitas, recargarFinalizadasHoy, mostrar])

  // ── Acciones ──

  const crearVisita = async (datos: Record<string, unknown>) => {
    try {
      // Incluir actividad_origen_id si viene de una actividad con evento_auto_completar configurado
      const payload = actividadOrigenIdRef.current
        ? { ...datos, actividad_origen_id: actividadOrigenIdRef.current }
        : datos
      const res = await fetch('/api/visitas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) throw new Error('Error al crear')
      const resultado = await res.json()
      // Limpiar ref después de usar
      actividadOrigenIdRef.current = null
      mostrar('exito', 'Visita programada')
      recargarVisitas()
      return resultado
    } catch {
      mostrar('error', 'Error al crear la visita')
    }
  }

  const editarVisita = async (datos: Record<string, unknown>) => {
    try {
      const { id, ...campos } = datos
      const res = await fetch(`/api/visitas/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(campos),
      })
      if (!res.ok) throw new Error('Error al editar')
      mostrar('exito', 'Visita actualizada')
      recargarVisitas()
    } catch {
      mostrar('error', 'Error al guardar la visita')
    }
  }

  const completarVisita = async (id: string) => {
    try {
      const res = await fetch(`/api/visitas/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accion: 'completar' }),
      })
      if (!res.ok) throw new Error()
      mostrar('exito', 'Visita completada')
      recargarVisitas()
      recargarFinalizadasHoy()
    } catch {
      mostrar('error', 'Error al completar la visita')
    }
  }

  const cancelarVisita = async (id: string) => {
    try {
      const res = await fetch(`/api/visitas/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accion: 'cancelar' }),
      })
      if (!res.ok) throw new Error()
      mostrar('info', 'Visita cancelada')
      recargarVisitas()
      recargarFinalizadasHoy()
    } catch {
      mostrar('error', 'Error al cancelar la visita')
    }
  }

  // Rechazar visita provisoria (estado provisoria → cancelada)
  const rechazarVisita = async (id: string) => {
    try {
      const res = await fetch(`/api/visitas/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accion: 'rechazar' }),
      })
      if (!res.ok) throw new Error()
      mostrar('info', 'Visita rechazada')
      recargarVisitas()
    } catch {
      mostrar('error', 'Error al rechazar la visita')
    }
  }

  // ── Acciones en lote ──
  const [confirmEliminarLote, setConfirmEliminarLote] = useState<Set<string> | null>(null)

  const completarLote = useCallback(async (ids: Set<string>) => {
    try {
      await Promise.all([...ids].map(id =>
        fetch(`/api/visitas/${id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ accion: 'completar' }),
        })
      ))
      mostrar('exito', `${ids.size} visita${ids.size > 1 ? 's' : ''} completada${ids.size > 1 ? 's' : ''}`)
      recargarVisitas()
    } catch { mostrar('error', 'Error al completar visitas') }
  }, [recargarVisitas, mostrar])

  const eliminarLote = useCallback(async (ids: Set<string>) => {
    try {
      await Promise.all([...ids].map(id =>
        fetch(`/api/visitas/${id}`, { method: 'DELETE' })
      ))
      mostrar('info', `${ids.size} visita${ids.size > 1 ? 's' : ''} eliminada${ids.size > 1 ? 's' : ''}`)
      setConfirmEliminarLote(null)
      recargarVisitas()
    } catch { mostrar('error', 'Error al eliminar visitas') }
  }, [recargarVisitas, mostrar])

  const accionesLote: AccionLote[] = useMemo(() => {
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
    if (puedeEliminar) {
      acciones.push({
        id: 'eliminar',
        etiqueta: 'Eliminar',
        icono: <Trash2 size={14} />,
        onClick: (ids) => setConfirmEliminarLote(ids),
        peligro: true,
        noLimpiarSeleccion: true,
        grupo: 'peligro',
      })
    }
    return acciones
  }, [completarLote, puedeCompletar, puedeEliminar])

  // ── Columnas ──
  const columnas: ColumnaDinamica<Visita>[] = useMemo(() => [
    {
      clave: 'contacto_nombre',
      etiqueta: t('visitas.contacto'),
      ancho: 200,
      ordenable: true,
      render: (fila) => (
        <div className="flex items-center gap-2 min-w-0">
          <User size={14} className="text-texto-terciario flex-shrink-0" />
          <span className="truncate text-texto-primario font-medium">{fila.contacto_nombre}</span>
        </div>
      ),
    },
    {
      clave: 'direccion_texto',
      etiqueta: t('visitas.direccion'),
      ancho: 220,
      render: (fila) => (
        <div className="flex items-center gap-2 min-w-0">
          <MapPin size={14} className="text-texto-terciario flex-shrink-0" />
          <span className="truncate text-texto-secundario text-sm">{fila.direccion_texto || '—'}</span>
        </div>
      ),
    },
    {
      clave: 'fecha_programada',
      etiqueta: t('visitas.fecha_programada'),
      ancho: 130,
      ordenable: true,
      render: (fila) => {
        const fecha = new Date(fila.fecha_programada)
        const hoy = new Date(); hoy.setHours(0, 0, 0, 0)
        const vencida = fecha < hoy && !['completada', 'cancelada'].includes(fila.estado)
        const esHoy = Math.abs(fecha.getTime() - hoy.getTime()) < 86400000

        return (
          <div className="flex flex-col">
            <span className={`text-sm ${vencida ? 'text-insignia-peligro' : esHoy ? 'text-insignia-advertencia' : 'text-texto-primario'}`}>
              {fechaCorta(fila.fecha_programada, formato.locale)}
            </span>
            <span className="text-[11px] text-texto-terciario">
              {fecha.toLocaleTimeString(formato.locale, { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>
        )
      },
    },
    {
      clave: 'estado',
      etiqueta: t('visitas.estado'),
      ancho: 120,
      ordenable: true,
      render: (fila) => {
        const estado = COLORES_ESTADO[fila.estado]
        if (!estado) return <span>—</span>
        return (
          <Insignia color={estado.color as 'exito' | 'peligro' | 'advertencia' | 'info'}>
            {t(`visitas.estados.${fila.estado}`)}
          </Insignia>
        )
      },
    },
    {
      clave: 'prioridad',
      etiqueta: t('visitas.prioridad'),
      ancho: 90,
      ordenable: true,
      render: (fila) => {
        const p = COLORES_PRIORIDAD[fila.prioridad]
        if (fila.prioridad === 'normal') return <span className="text-xs text-texto-terciario">{p?.etiqueta}</span>
        return <Insignia color={p?.color as 'info' | 'peligro'}>{p?.etiqueta}</Insignia>
      },
    },
    {
      clave: 'asignado_nombre',
      etiqueta: t('visitas.asignado'),
      ancho: 140,
      ordenable: true,
      render: (fila) => fila.asignado_nombre
        ? <span className="text-sm text-texto-secundario">{fila.asignado_nombre}</span>
        : <span className="text-sm text-texto-terciario">—</span>,
    },
    {
      clave: 'motivo',
      etiqueta: t('visitas.motivo'),
      ancho: 160,
      render: (fila) => (
        <span className="text-sm text-texto-secundario truncate">{fila.motivo || '—'}</span>
      ),
    },
    {
      clave: 'acciones',
      etiqueta: '',
      ancho: 120,
      render: (fila) => {
        const esProvisoria = fila.estado === 'provisoria'
        const esActiva = !['completada', 'cancelada', 'provisoria'].includes(fila.estado)
        return (
          <div className="flex items-center gap-1">
            {esProvisoria && (
              <>
                <button
                  onClick={(e) => { e.stopPropagation(); setVisitaConfirmando(fila) }}
                  className="p-1.5 rounded hover:bg-white/[0.06] text-texto-terciario hover:text-insignia-exito transition-colors"
                  title="Confirmar"
                >
                  <CheckCircle size={14} />
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); rechazarVisita(fila.id) }}
                  className="p-1.5 rounded hover:bg-white/[0.06] text-texto-terciario hover:text-insignia-peligro transition-colors"
                  title="Rechazar"
                >
                  <XCircle size={14} />
                </button>
              </>
            )}
            {esActiva && (
              <button
                onClick={(e) => { e.stopPropagation(); completarVisita(fila.id) }}
                className="p-1.5 rounded hover:bg-white/[0.06] text-texto-terciario hover:text-insignia-exito transition-colors"
                title="Completar"
              >
                <CheckCircle size={14} />
              </button>
            )}
          </div>
        )
      },
    },
    {
      clave: 'editado_por',
      etiqueta: 'Auditoría',
      ancho: 44,
      icono: <History size={12} />,
      render: (fila) => (
        <IndicadorEditado
          entidadId={fila.id}
          nombreCreador={fila.creado_por_nombre}
          fechaCreacion={fila.creado_en}
          nombreEditor={fila.editado_por_nombre}
          fechaEdicion={fila.actualizado_en}
        />
      ),
    },
  ], [t, formato.locale, completarVisita, rechazarVisita])

  // ── Render tarjeta (vista tarjetas) ──
  const renderTarjeta = useCallback((fila: Visita) => {
    const estado = COLORES_ESTADO[fila.estado]
    return (
      <div className="p-4 space-y-2">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <User size={14} className="text-texto-terciario" />
            <span className="font-medium text-texto-primario">{fila.contacto_nombre}</span>
          </div>
          {estado && (
            <Insignia color={estado.color as 'exito' | 'peligro' | 'advertencia' | 'info'}>
              {estado.etiqueta}
            </Insignia>
          )}
        </div>
        {fila.direccion_texto && (
          <div className="flex items-center gap-2 text-sm text-texto-secundario">
            <MapPin size={12} className="text-texto-terciario" />
            <span className="truncate">{fila.direccion_texto}</span>
          </div>
        )}
        <div className="flex items-center gap-3 text-xs text-texto-terciario">
          <span className="flex items-center gap-1">
            <CalendarClock size={12} />
            {fechaCorta(fila.fecha_programada, formato.locale)}
          </span>
          {fila.asignado_nombre && (
            <span className="flex items-center gap-1">
              <User size={12} />
              {fila.asignado_nombre}
            </span>
          )}
        </div>
        {fila.motivo && (
          <p className="text-sm text-texto-secundario truncate">{fila.motivo}</p>
        )}
        {fila.estado === 'provisoria' && (
          <div className="flex items-center gap-2 pt-2 border-t border-white/[0.06]">
            <button
              onClick={(e) => { e.stopPropagation(); setVisitaConfirmando(fila) }}
              className="flex items-center gap-1 px-2 py-1 rounded text-xs font-medium bg-insignia-exito/10 text-insignia-exito hover:bg-insignia-exito/20 transition-colors"
            >
              <CheckCircle size={12} /> Confirmar
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); rechazarVisita(fila.id) }}
              className="flex items-center gap-1 px-2 py-1 rounded text-xs font-medium text-texto-terciario hover:text-insignia-peligro hover:bg-insignia-peligro/10 transition-colors"
            >
              <XCircle size={12} /> Rechazar
            </button>
          </div>
        )}
      </div>
    )
  }, [formato.locale, rechazarVisita])

  return (
    <PlantillaListado
      titulo={t('visitas.titulo')}
      icono={<MapPin size={20} />}
      accionPrincipal={puedeCrear ? {
        etiqueta: t('visitas.nueva'),
        icono: <PlusCircle size={14} />,
        onClick: () => { setVisitaEditando(null); setModalAbierto(true) },
      } : undefined}
      acciones={[
        { id: 'exportar', etiqueta: t('comun.exportar'), icono: <Download size={14} />, onClick: () => {} },
      ]}
      mostrarConfiguracion
      onConfiguracion={() => router.push('/visitas/configuracion')}
    >
      {/* Tabs: Listado / Planificación */}
      <div className="flex items-center gap-2 mb-3">
        <Tabs
          tabs={[
            { clave: 'listado', etiqueta: t('visitas.listado'), icono: <List size={14} /> },
            { clave: 'planificacion', etiqueta: t('visitas.planificacion'), icono: <Route size={14} /> },
          ]}
          activo={vistaActiva}
          onChange={(clave) => setVistaActiva(clave as 'listado' | 'planificacion')}
          className="flex-1"
          layoutId="tabs-visitas"
        />
      </div>

      {vistaActiva === 'planificacion' ? (
        <PanelPlanificacion
          onAbrirVisita={(visitaId) => {
            // Buscar en las visitas ya cargadas o cargar por API
            const encontrada = visitas.find(v => v.id === visitaId)
            if (encontrada) {
              setVisitaEditando(encontrada)
              setModalAbierto(true)
            } else {
              fetch(`/api/visitas/${visitaId}`)
                .then(r => r.ok ? r.json() : null)
                .then(data => { if (data) { setVisitaEditando(data); setModalAbierto(true) } })
            }
          }}
          onConfirmarProvisoria={(visitaId) => {
            // Abrir el modal de confirmación (misma UX que en el listado)
            const encontrada = visitas.find(v => v.id === visitaId)
            if (encontrada) {
              setVisitaConfirmando(encontrada)
            } else {
              fetch(`/api/visitas/${visitaId}`)
                .then(r => r.ok ? r.json() : null)
                .then(data => { if (data) setVisitaConfirmando(data) })
            }
          }}
          onRechazarProvisoria={rechazarVisita}
        />
      ) : (
      <>
      <TablaDinamica
        columnas={columnas}
        columnasVisiblesDefault={['contacto_nombre', 'direccion_texto', 'fecha_programada', 'estado', 'prioridad', 'asignado_nombre', 'acciones']}
        datos={visitas}
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
        placeholder="Buscar visitas..."
        filtros={[
          // ── Identidad ──
          {
            id: 'creado_por', etiqueta: 'Creado por', tipo: 'seleccion-compacto' as const,
            valor: filtroCreadoPor, onChange: (v) => setFiltroCreadoPor(v as string),
            opciones: opcionesMiembros,
            descripcion: 'Mostrá solo las visitas creadas por el miembro elegido.',
          },
          {
            id: 'contacto', etiqueta: 'Contacto', tipo: 'seleccion-compacto' as const,
            valor: filtroContacto, onChange: (v) => setFiltroContacto(v as string),
            opciones: opcionesContactos,
            descripcion: 'Visitas asociadas al contacto elegido.',
          },
          // ── Asignación ──
          {
            id: 'asignado_a', etiqueta: 'Visitador', tipo: 'multiple-compacto' as const,
            valor: filtroAsignados,
            onChange: (v) => setFiltroAsignados(Array.isArray(v) ? v : []),
            opciones: opcionesMiembros,
            descripcion: 'Visitas asignadas a uno o más visitadores (cumple si al menos uno coincide).',
          },
          {
            id: 'sin_asignado', etiqueta: 'Sin asignar', tipo: 'pills' as const,
            valor: filtroSinAsignado ? 'true' : '',
            onChange: (v) => setFiltroSinAsignado(v === 'true'),
            opciones: [{ valor: 'true', etiqueta: 'Sí' }],
            descripcion: 'Visitas que no tienen ningún visitador asignado.',
          },
          {
            id: 'vista', etiqueta: 'Perspectiva', tipo: 'pills' as const,
            valor: filtroVista, onChange: (v) => setFiltroVista(v as string),
            opciones: [
              { valor: 'todas', etiqueta: 'Todas' },
              { valor: 'propias', etiqueta: 'Propias' },
              { valor: 'mias', etiqueta: 'Mías' },
              { valor: 'enviadas', etiqueta: 'Enviadas' },
            ],
            valorDefault: vistaDefault,
            descripcion: 'Propias = creadas o asignadas a mí. Mías = solo asignadas a mí. Enviadas = solo creadas por mí.',
          },
          // ── Estado ──
          {
            id: 'estado', etiqueta: 'Estado', tipo: 'multiple-compacto' as const,
            valor: filtroEstado,
            onChange: (v) => setFiltroEstado(Array.isArray(v) ? v : (v ? [v] : [])),
            opciones: [
              { valor: 'provisoria', etiqueta: t('visitas.estados.provisoria') },
              { valor: 'programada', etiqueta: t('visitas.estados.programada') },
              { valor: 'en_camino', etiqueta: t('visitas.estados.en_camino') },
              { valor: 'en_sitio', etiqueta: t('visitas.estados.en_sitio') },
              { valor: 'completada', etiqueta: t('visitas.estados.completada') },
              { valor: 'cancelada', etiqueta: t('visitas.estados.cancelada') },
              { valor: 'reprogramada', etiqueta: t('visitas.estados.reprogramada') },
            ],
            valorDefault: ESTADOS_ACTIVOS,
            descripcion: 'Por defecto se muestran las visitas activas (excluye completadas y canceladas).',
          },
          {
            id: 'prioridad', etiqueta: 'Prioridad', tipo: 'multiple-compacto' as const,
            valor: filtroPrioridad,
            onChange: (v) => setFiltroPrioridad(Array.isArray(v) ? v : (v ? [v] : [])),
            opciones: [
              { valor: 'baja', etiqueta: t('visitas.prioridades.baja') },
              { valor: 'normal', etiqueta: t('visitas.prioridades.normal') },
              { valor: 'alta', etiqueta: t('visitas.prioridades.alta') },
              { valor: 'urgente', etiqueta: t('visitas.prioridades.urgente') },
            ],
            descripcion: 'Nivel de prioridad de la visita.',
          },
          {
            id: 'temperatura', etiqueta: 'Temperatura', tipo: 'multiple-compacto' as const,
            valor: filtroTemperatura,
            onChange: (v) => setFiltroTemperatura(Array.isArray(v) ? v : (v ? [v] : [])),
            opciones: [
              { valor: 'frio', etiqueta: 'Frío' },
              { valor: 'tibio', etiqueta: 'Tibio' },
              { valor: 'caliente', etiqueta: 'Caliente' },
            ],
            descripcion: 'Factibilidad comercial percibida en la visita.',
          },
          // ── Fechas ──
          {
            id: 'fecha', etiqueta: 'Fecha programada', tipo: 'pills' as const,
            valor: filtroFecha, onChange: (v) => setFiltroFecha(v as string),
            opciones: [
              { valor: 'hoy', etiqueta: 'Hoy' },
              { valor: 'semana', etiqueta: 'Esta semana' },
              { valor: 'vencidas', etiqueta: 'Vencidas' },
              { valor: 'futuras', etiqueta: 'Futuras' },
            ],
            descripcion: 'Filtrá por proximidad de la fecha programada.',
          },
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
            descripcion: 'Visitas creadas dentro del rango elegido.',
          },
          // ── Vínculos ──
          {
            id: 'actividad', etiqueta: 'Actividad', tipo: 'seleccion-compacto' as const,
            valor: filtroActividad, onChange: (v) => setFiltroActividad(v as string),
            opciones: opcionesActividades,
            descripcion: 'Visitas vinculadas a la actividad elegida.',
          },
        ]}
        gruposFiltros={[
          { id: 'identidad', etiqueta: 'Identidad', filtros: ['creado_por', 'contacto'] },
          { id: 'asignacion', etiqueta: 'Asignación', filtros: ['asignado_a', 'sin_asignado', 'vista'] },
          { id: 'estado', etiqueta: 'Estado', filtros: ['estado', 'prioridad', 'temperatura'] },
          { id: 'fechas', etiqueta: 'Fechas', filtros: ['fecha', 'creado_rango'] },
          { id: 'vinculos', etiqueta: 'Vínculos', filtros: ['actividad'] },
        ]}
        onLimpiarFiltros={() => {
          setFiltroEstado(ESTADOS_ACTIVOS)
          setFiltroPrioridad([])
          setFiltroVista(vistaDefault)
          setFiltroAsignados([])
          setFiltroSinAsignado(false)
          setFiltroCreadoPor('')
          setFiltroTemperatura([])
          setFiltroFecha('')
          setFiltroContacto('')
          setFiltroActividad('')
          setFiltroCreadoRango('')
        }}
        opcionesOrden={[
          { etiqueta: 'Fecha ↑', clave: 'fecha_programada', direccion: 'asc' },
          { etiqueta: 'Fecha ↓', clave: 'fecha_programada', direccion: 'desc' },
          { etiqueta: 'Más recientes', clave: 'creado_en', direccion: 'desc' },
          { etiqueta: 'Más antiguos', clave: 'creado_en', direccion: 'asc' },
          { etiqueta: 'Contacto A-Z', clave: 'contacto_nombre', direccion: 'asc' },
          { etiqueta: 'Contacto Z-A', clave: 'contacto_nombre', direccion: 'desc' },
          { etiqueta: 'Prioridad ↓', clave: 'prioridad', direccion: 'desc' },
        ]}
        idModulo="visitas"
        renderTarjeta={renderTarjeta}
        onClickFila={(fila) => router.push(`/visitas/${fila.id}`)}
        mostrarResumen
        estadoVacio={
          <EstadoVacio
            icono={<MapPinOff size={52} strokeWidth={1} />}
            titulo={t('visitas.sin_visitas')}
            descripcion={t('visitas.sin_visitas_desc')}
            accion={
              <Boton onClick={() => { setVisitaEditando(null); setModalAbierto(true) }}>
                {t('visitas.nueva')}
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
              {finalizadasHoy.map(v => (
                <div key={v.id} className="flex items-center gap-3 px-4 py-2.5 hover:bg-white/[0.02] transition-colors">
                  <div className="flex-shrink-0">
                    {v.estado === 'completada'
                      ? <CheckCircle size={15} className="text-insignia-exito" />
                      : <XCircle size={15} className="text-insignia-peligro" />
                    }
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-texto-secundario truncate">{v.contacto_nombre}</span>
                      <Insignia color={v.estado === 'completada' ? 'exito' : 'peligro'} tamano="sm">
                        {v.estado === 'completada' ? 'Completada' : 'Cancelada'}
                      </Insignia>
                    </div>
                    {v.direccion_texto && (
                      <span className="text-xs text-texto-terciario truncate block">{v.direccion_texto}</span>
                    )}
                  </div>
                  <span className="text-xs text-texto-terciario flex-shrink-0">
                    {v.actualizado_en ? new Date(v.actualizado_en).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' }) : ''}
                  </span>
                  <button
                    type="button"
                    onClick={() => reactivarVisita(v.id)}
                    className="flex items-center gap-1.5 px-2.5 py-1 rounded-boton text-xs font-medium text-texto-terciario hover:text-texto-primario hover:bg-white/[0.06] transition-colors flex-shrink-0"
                    title="Reactivar visita"
                  >
                    <RotateCcw size={12} />
                    Reactivar
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
      </>
      )}

      {/* Modal confirmar visita provisoria (agente IA) */}
      <ModalConfirmarVisita
        visita={visitaConfirmando}
        abierto={!!visitaConfirmando}
        onCerrar={() => setVisitaConfirmando(null)}
        onConfirmado={() => { setVisitaConfirmando(null); recargarVisitas() }}
      />

      {/* Modal crear/editar */}
      <ModalVisita
        abierto={modalAbierto}
        visita={visitaEditando}
        miembros={miembros}
        config={configData as Record<string, unknown> | null}
        onGuardar={visitaEditando ? editarVisita : crearVisita}
        onCompletar={async (id) => { await completarVisita(id); setModalAbierto(false); setVisitaEditando(null) }}
        onCancelar={async (id) => { await cancelarVisita(id); setModalAbierto(false); setVisitaEditando(null) }}
        onConfirmarProvisoria={(id) => {
          // Cerramos el modal de edición y abrimos el de confirmación (con plantilla)
          const v = visitas.find(x => x.id === id) || visitaEditando
          setModalAbierto(false)
          setVisitaEditando(null)
          if (v) setVisitaConfirmando(v)
        }}
        onRechazarProvisoria={async (id) => { await rechazarVisita(id); setModalAbierto(false); setVisitaEditando(null) }}
        onCerrar={() => {
          setModalAbierto(false)
          setVisitaEditando(null)
          if (vieneDeDashboardRef.current) {
            vieneDeDashboardRef.current = false
            router.push('/dashboard')
          }
          if (vieneDeDeepLinkRef.current) {
            vieneDeDeepLinkRef.current = false
            recargarVisitas()
          }
        }}
      />

      {/* Modal confirmación eliminar lote */}
      {confirmEliminarLote && (
        <ModalConfirmacion
          abierto={!!confirmEliminarLote}
          titulo="Eliminar visitas"
          descripcion={`¿Eliminar ${confirmEliminarLote.size} visita${confirmEliminarLote.size > 1 ? 's' : ''}? Se moverán a la papelera.`}
          etiquetaConfirmar="Eliminar"
          tipo="peligro"
          onConfirmar={() => eliminarLote(confirmEliminarLote)}
          onCerrar={() => setConfirmEliminarLote(null)}
        />
      )}

      {/* Modal detalle visita archivada (solo lectura) */}
    </PlantillaListado>
  )
}
