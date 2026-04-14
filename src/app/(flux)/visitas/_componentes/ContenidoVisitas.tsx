'use client'

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { useListado, useConfig } from '@/hooks/useListado'
import { useBusquedaDebounce } from '@/hooks/useBusquedaDebounce'
import { PlantillaListado } from '@/componentes/entidad/PlantillaListado'
import { TablaDinamica } from '@/componentes/tablas/TablaDinamica'
import type { ColumnaDinamica } from '@/componentes/tablas/TablaDinamica'
import {
  PlusCircle, Download, MapPin, MapPinOff,
  CheckCircle, Clock, User, Trash2, History,
  Navigation, Eye, CalendarClock, AlertTriangle, Route, List, Archive,
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
import PanelPlanificacion from './PanelPlanificacion'
import { ModalDetalleVisita, type DatosVisitaDetalle } from '@/componentes/entidad/_panel_chatter/ModalDetalleVisita'
import { crearClienteNavegador } from '@/lib/supabase/cliente'
import { useToast } from '@/componentes/feedback/Toast'
import { useFormato } from '@/hooks/useFormato'
import { useTraduccion } from '@/lib/i18n'

/**
 * ContenidoVisitas — Client Component principal del módulo de visitas.
 * Tabla con filtros, búsqueda, acciones en lote y modal crear/editar.
 */

// Colores de estado según tokens CSS del proyecto
const COLORES_ESTADO: Record<string, { color: string; variable: string; etiqueta: string }> = {
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
const VISTA_DEFAULT = 'propias'
const ESTADOS_ACTIVOS = ['programada', 'en_camino', 'en_sitio', 'reprogramada']

interface Props {
  datosInicialesJson?: Record<string, unknown>
}

export default function ContenidoVisitas({ datosInicialesJson }: Props) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { mostrar } = useToast()
  const formato = useFormato()
  const { t } = useTraduccion()

  // Tab activo: listado o planificación
  const [vistaActiva, setVistaActiva] = useState<'listado' | 'planificacion'>('listado')

  // Estado UI
  const [modalAbierto, setModalAbierto] = useState(false)
  const [visitaEditando, setVisitaEditando] = useState<Visita | null>(null)
  const [mostrarArchivadas, setMostrarArchivadas] = useState(false)
  const [visitaArchivedaDetalle, setVisitaArchivedaDetalle] = useState<Visita | null>(null)

  // Abrir modal si viene ?crear=true desde el dashboard
  const vieneDeDashboardRef = useRef(false)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get('crear') === 'true') {
      window.history.replaceState({}, '', '/visitas')
      vieneDeDashboardRef.current = true
      setVisitaEditando(null)
      setModalAbierto(true)
    }
  }, [])

  // Filtros
  const [filtroEstado, setFiltroEstado] = useState<string[]>(ESTADOS_ACTIVOS)
  const [filtroPrioridad, setFiltroPrioridad] = useState('')
  const [filtroVista, setFiltroVista] = useState(VISTA_DEFAULT)

  // Búsqueda con debounce + reset de página automático
  const { busqueda, setBusqueda, busquedaDebounced, pagina, setPagina } = useBusquedaDebounce('', 1, [filtroEstado, filtroPrioridad, filtroVista, mostrarArchivadas])

  // Config de visitas (cache largo)
  const { datos: configData } = useConfig<Record<string, unknown>>(
    'visitas-config',
    '/api/visitas/config',
    (json) => json as Record<string, unknown>,
  )

  // Solo usar datos iniciales cuando no hay filtros activos
  const estadoEsDefault = filtroEstado.length === ESTADOS_ACTIVOS.length &&
    ESTADOS_ACTIVOS.every(e => filtroEstado.includes(e))
  const sinFiltros = !busquedaDebounced && estadoEsDefault && !filtroPrioridad && filtroVista === VISTA_DEFAULT && pagina === 1

  // Datos con React Query
  const { datos: visitas, total, cargando, recargar: recargarVisitas } = useListado<Visita>({
    clave: 'visitas',
    url: '/api/visitas',
    parametros: {
      busqueda: busquedaDebounced,
      estado: mostrarArchivadas ? 'completada' : (filtroEstado.length > 0 ? filtroEstado.join(',') : undefined),
      prioridad: filtroPrioridad || undefined,
      vista: filtroVista || undefined,
      archivadas: mostrarArchivadas ? 'true' : undefined,
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
      const res = await fetch('/api/visitas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(datos),
      })
      if (!res.ok) throw new Error('Error al crear')
      const resultado = await res.json()
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

  const accionesLote: AccionLote[] = useMemo(() => [
    {
      id: 'completar',
      etiqueta: 'Completar',
      icono: <CheckCircle size={14} />,
      onClick: completarLote,
      grupo: 'edicion',
    },
    {
      id: 'eliminar',
      etiqueta: 'Eliminar',
      icono: <Trash2 size={14} />,
      onClick: (ids) => setConfirmEliminarLote(ids),
      peligro: true,
      noLimpiarSeleccion: true,
      grupo: 'peligro',
    },
  ], [completarLote])

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
      ancho: 80,
      render: (fila) => {
        const esActiva = !['completada', 'cancelada'].includes(fila.estado)
        return (
          <div className="flex items-center gap-1">
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
  ], [t, formato.locale, completarVisita])

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
      </div>
    )
  }, [formato.locale])

  return (
    <PlantillaListado
      titulo={t('visitas.titulo')}
      icono={<MapPin size={20} />}
      accionPrincipal={{
        etiqueta: t('visitas.nueva'),
        icono: <PlusCircle size={14} />,
        onClick: () => { setVisitaEditando(null); setModalAbierto(true) },
      }}
      acciones={[
        { id: 'exportar', etiqueta: t('comun.exportar'), icono: <Download size={14} />, onClick: () => {} },
      ]}
      mostrarConfiguracion
      onConfiguracion={() => router.push('/visitas/configuracion')}
    >
      {/* Tabs: Listado / Planificación + toggle archivadas */}
      <div className="flex items-center gap-2 mb-3">
        <Tabs
          tabs={[
            { clave: 'listado', etiqueta: t('visitas.listado'), icono: <List size={14} /> },
            { clave: 'planificacion', etiqueta: t('visitas.planificacion'), icono: <Route size={14} /> },
          ]}
          activo={vistaActiva}
          onChange={(clave) => { setVistaActiva(clave as 'listado' | 'planificacion'); if (mostrarArchivadas) setMostrarArchivadas(false) }}
          className="flex-1"
          layoutId="tabs-visitas"
        />
        <button
          onClick={() => {
            setMostrarArchivadas(!mostrarArchivadas)
            if (!mostrarArchivadas) setVistaActiva('listado')
          }}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
            mostrarArchivadas
              ? 'bg-texto-marca/15 text-texto-marca border border-texto-marca/30'
              : 'bg-superficie-hover text-texto-terciario hover:text-texto-secundario border border-borde-sutil'
          }`}
          title="Ver visitas archivadas"
        >
          <Archive size={14} />
          Archivadas
        </button>
      </div>

      {vistaActiva === 'planificacion' ? (
        <PanelPlanificacion onAbrirVisita={(visitaId) => {
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
        }} />
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
          {
            id: 'estado',
            etiqueta: 'Estado',
            tipo: 'multiple',
            valor: filtroEstado,
            onChange: (v) => setFiltroEstado(v as string[]),
            opciones: [
              { valor: 'programada', etiqueta: t('visitas.estados.programada') },
              { valor: 'en_camino', etiqueta: t('visitas.estados.en_camino') },
              { valor: 'en_sitio', etiqueta: t('visitas.estados.en_sitio') },
              { valor: 'completada', etiqueta: t('visitas.estados.completada') },
              { valor: 'cancelada', etiqueta: t('visitas.estados.cancelada') },
              { valor: 'reprogramada', etiqueta: t('visitas.estados.reprogramada') },
            ],
            valorDefault: ESTADOS_ACTIVOS,
          },
          {
            id: 'prioridad',
            etiqueta: 'Prioridad',
            tipo: 'pills',
            valor: filtroPrioridad,
            onChange: (v) => setFiltroPrioridad(v as string),
            opciones: [
              { valor: 'baja', etiqueta: t('visitas.prioridades.baja') },
              { valor: 'normal', etiqueta: t('visitas.prioridades.normal') },
              { valor: 'alta', etiqueta: t('visitas.prioridades.alta') },
              { valor: 'urgente', etiqueta: t('visitas.prioridades.urgente') },
            ],
          },
        ]}
        onLimpiarFiltros={() => {
          setFiltroEstado(ESTADOS_ACTIVOS)
          setFiltroPrioridad('')
          setFiltroVista(VISTA_DEFAULT)
        }}
        opcionesOrden={[
          { etiqueta: 'Fecha ↑', clave: 'fecha_programada', direccion: 'asc' },
          { etiqueta: 'Fecha ↓', clave: 'fecha_programada', direccion: 'desc' },
          { etiqueta: 'Contacto A-Z', clave: 'contacto_nombre', direccion: 'asc' },
          { etiqueta: 'Prioridad', clave: 'prioridad', direccion: 'desc' },
        ]}
        idModulo="visitas"
        renderTarjeta={renderTarjeta}
        onClickFila={(fila) => {
          if (mostrarArchivadas) {
            setVisitaArchivedaDetalle(fila)
          } else {
            setVisitaEditando(fila)
            setModalAbierto(true)
          }
        }}
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
      {!mostrarArchivadas && finalizadasHoy.length > 0 && (
        <div className="mt-4 border border-borde-sutil rounded-lg overflow-hidden">
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
                    className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium text-texto-terciario hover:text-texto-primario hover:bg-white/[0.06] transition-colors flex-shrink-0"
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

      {/* Modal crear/editar */}
      <ModalVisita
        abierto={modalAbierto}
        visita={visitaEditando}
        miembros={miembros}
        config={configData as Record<string, unknown> | null}
        onGuardar={visitaEditando ? editarVisita : crearVisita}
        onCompletar={async (id) => { await completarVisita(id); setModalAbierto(false); setVisitaEditando(null) }}
        onCancelar={async (id) => { await cancelarVisita(id); setModalAbierto(false); setVisitaEditando(null) }}
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
      {visitaArchivedaDetalle && (
        <ModalDetalleVisita
          abierto={!!visitaArchivedaDetalle}
          onCerrar={() => setVisitaArchivedaDetalle(null)}
          datosVisita={{
            resultado: visitaArchivedaDetalle.resultado,
            notas: visitaArchivedaDetalle.notas,
            temperatura: visitaArchivedaDetalle.temperatura,
            checklist: visitaArchivedaDetalle.checklist,
            direccion_texto: visitaArchivedaDetalle.direccion_texto,
            duracion_real_min: visitaArchivedaDetalle.duracion_real_min,
            duracion_estimada_min: visitaArchivedaDetalle.duracion_estimada_min,
            fecha_completada: visitaArchivedaDetalle.fecha_completada,
            fecha_programada: visitaArchivedaDetalle.fecha_programada,
            motivo: visitaArchivedaDetalle.motivo,
            contacto_nombre: visitaArchivedaDetalle.contacto_nombre,
            contacto_id: visitaArchivedaDetalle.contacto_id,
            asignado_nombre: visitaArchivedaDetalle.asignado_nombre,
            editado_por_nombre: visitaArchivedaDetalle.editado_por_nombre,
            registro_lat: visitaArchivedaDetalle.registro_lat,
            registro_lng: visitaArchivedaDetalle.registro_lng,
            registro_precision_m: visitaArchivedaDetalle.registro_precision_m,
            prioridad: visitaArchivedaDetalle.prioridad,
            recibe_nombre: visitaArchivedaDetalle.recibe_nombre,
            recibe_telefono: visitaArchivedaDetalle.recibe_telefono,
          }}
        />
      )}
    </PlantillaListado>
  )
}
