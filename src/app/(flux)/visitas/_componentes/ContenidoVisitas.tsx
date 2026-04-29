'use client'

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { useListado, useConfig } from '@/hooks/useListado'
import { useFiltrosUrl } from '@/hooks/useFiltrosUrl'
import { GuardPagina } from '@/componentes/entidad/GuardPagina'
import { PlantillaListado } from '@/componentes/entidad/PlantillaListado'
import { TablaDinamica } from '@/componentes/tablas/TablaDinamica'
import type { ColumnaDinamica } from '@/componentes/tablas/TablaDinamica'
import {
  PlusCircle, Download, MapPin, MapPinOff,
  CheckCircle, User, Trash2, History,
  CalendarClock, Route, List, Phone,
  RotateCcw, ChevronDown, ChevronUp, XCircle,
} from 'lucide-react'
import { IconoWhatsApp } from '@/componentes/iconos/IconoWhatsApp'
import { Tabs } from '@/componentes/ui/Tabs'
import type { AccionLote } from '@/componentes/tablas/tipos-tabla'
import { PieAccionesTarjeta, type AccionTarjeta } from '@/componentes/tablas/PieAccionesTarjeta'
import { LineaInfoTarjeta } from '@/componentes/tablas/LineaInfoTarjeta'
import { ModalConfirmacion } from '@/componentes/ui/ModalConfirmacion'
import { EstadoVacio } from '@/componentes/feedback/EstadoVacio'
import { Boton } from '@/componentes/ui/Boton'
import { Insignia } from '@/componentes/ui/Insignia'
import { IndicadorEditado } from '@/componentes/ui/IndicadorEditado'
import { ModalVisita } from './ModalVisita'
import type { Visita, Miembro } from './ModalVisita'
import { ModalConfirmarVisita } from './ModalConfirmarVisita'
import PanelPlanificacion from './PanelPlanificacion'
import { useToast } from '@/componentes/feedback/Toast'
import { useRol } from '@/hooks/useRol'
import { useFormato } from '@/hooks/useFormato'
import { useTraduccion } from '@/lib/i18n'
import { useMiembrosAsignables } from '@/hooks/useMiembrosAsignables'

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

  // Filtros con sync bidireccional URL ↔ estado (ver useFiltrosUrl).
  // Mantiene los filtros al volver de un detalle por migajas o botón atrás.
  const filtros = useFiltrosUrl({
    pathname: '/visitas',
    campos: {
      estado: {
        defecto: ESTADOS_ACTIVOS as string[],
        // Migración: URLs viejas con los 4 estados activos sin "provisoria"
        // se asumen como default nuevo (sumarle provisoria).
        parser: (raw: string | null): string[] => {
          if (!raw) return ESTADOS_ACTIVOS
          const fromUrl = raw.split(',').filter(Boolean)
          const viejosActivos = ['programada', 'en_camino', 'en_sitio', 'reprogramada']
          if (
            viejosActivos.every(e => fromUrl.includes(e))
            && !fromUrl.includes('provisoria')
            && fromUrl.length === viejosActivos.length
          ) {
            return ESTADOS_ACTIVOS
          }
          return fromUrl
        },
      },
      prioridad: { defecto: [] as string[] },
      vista: { defecto: vistaDefault },
      asignado_a: { defecto: [] as string[] },
      sin_asignado: { defecto: false },
      creado_por: { defecto: '' },
      temperatura: { defecto: [] as string[] },
      fecha: { defecto: '' },
      contacto_id: { defecto: '' },
      actividad_id: { defecto: '' },
      creado_rango: { defecto: '' },
    },
    busqueda: { claveUrl: 'q' },
    pagina: { defecto: 1 },
  })

  // Aliases para compatibilidad con el resto del componente.
  const f = filtros.valores
  const filtroEstado = f.estado
  const filtroPrioridad = f.prioridad
  const filtroVista = f.vista
  const filtroAsignados = f.asignado_a
  const filtroSinAsignado = f.sin_asignado
  const filtroCreadoPor = f.creado_por
  const filtroTemperatura = f.temperatura
  const filtroFecha = f.fecha
  const filtroContacto = f.contacto_id
  const filtroActividad = f.actividad_id
  const filtroCreadoRango = f.creado_rango
  const setFiltroEstado = (v: string[]) => filtros.set('estado', v)
  const setFiltroPrioridad = (v: string[]) => filtros.set('prioridad', v)
  const setFiltroVista = (v: string) => filtros.set('vista', v)
  const setFiltroAsignados = (v: string[]) => filtros.set('asignado_a', v)
  const setFiltroSinAsignado = (v: boolean) => filtros.set('sin_asignado', v)
  const setFiltroCreadoPor = (v: string) => filtros.set('creado_por', v)
  const setFiltroTemperatura = (v: string[]) => filtros.set('temperatura', v)
  const setFiltroFecha = (v: string) => filtros.set('fecha', v)
  const setFiltroContacto = (v: string) => filtros.set('contacto_id', v)
  const setFiltroActividad = (v: string) => filtros.set('actividad_id', v)
  const setFiltroCreadoRango = (v: string) => filtros.set('creado_rango', v)
  const busqueda = filtros.busquedaInput
  const setBusqueda = filtros.setBusquedaInput
  const busquedaDebounced = filtros.busquedaActiva
  const pagina = filtros.pagina
  const setPagina = filtros.setPagina

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

  // Miembros visitadores: filtrado local sobre la lista global de asignables.
  // - Propietario: siempre es visitador (tiene acceso total)
  // - Otros: solo si tienen ver_propio o registrar en módulo recorrido
  const { data: miembrosTodos = [] } = useMiembrosAsignables()
  const miembros = useMemo<Miembro[]>(() => {
    const permisosVisitador = ['ver_propio', 'registrar']
    return miembrosTodos
      .filter(m => {
        if (m.rol === 'propietario') return true
        const permisos = m.permisos_custom?.recorrido
        return permisos?.some(p => permisosVisitador.includes(p)) ?? false
      })
      .map(m => ({ usuario_id: m.usuario_id, nombre: m.nombre, apellido: m.apellido }))
  }, [miembrosTodos])

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
  const finalizadasHoy = useMemo(() => finalizadasHoyData || [], [finalizadasHoyData])

  // Lo que efectivamente se muestra en el listado: las visitas que devuelve la
  // API según los filtros activos + las finalizadas hoy mezcladas automáticamente
  // (deduplicadas por id). Pensado para que el visitador entre y vea su día
  // entero (lo pendiente + lo que ya hizo) sin tener que filtrar a mano.
  // Si el usuario filtró explícitamente por completada/cancelada, no agregamos
  // las de hoy de nuevo (ya vienen en `visitas`).
  const visitasMostradas = useMemo(() => {
    const filtroIncluyeFinalizadas = filtroEstado.includes('completada') || filtroEstado.includes('cancelada')
    if (filtroIncluyeFinalizadas || finalizadasHoy.length === 0) return visitas
    const idsExistentes = new Set(visitas.map(v => v.id))
    const extras = finalizadasHoy.filter(v => !idsExistentes.has(v.id))
    if (extras.length === 0) return visitas
    return [...visitas, ...extras]
  }, [visitas, finalizadasHoy, filtroEstado])

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
        // Hora real (si la visita ya empezó) primero. Si no empezó pero tiene hora
        // específica programada, mostramos la programada. Si no, "—" (solo día).
        const horaReal = fila.fecha_inicio || fila.fecha_llegada
        // Usar formato.hora() que respeta la config 24h/12h de la empresa, en vez
        // de toLocaleTimeString que sigue el locale del navegador (puede mostrar AM/PM
        // aunque la empresa esté configurada en 24h).
        const mostrarHora = horaReal
          ? formato.hora(horaReal)
          : fila.tiene_hora_especifica
            ? formato.hora(fila.fecha_programada)
            : null

        return (
          <div className="flex flex-col">
            <span className={`text-sm ${vencida ? 'text-insignia-peligro' : esHoy ? 'text-insignia-advertencia' : 'text-texto-primario'}`}>
              {fechaCorta(fila.fecha_programada, formato.locale)}
            </span>
            {mostrarHora ? (
              <span className="text-[11px] text-texto-terciario">
                {mostrarHora}{horaReal ? ' (real)' : ''}
              </span>
            ) : (
              <span className="text-[11px] text-texto-terciario opacity-60">Sin hora</span>
            )}
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

    // Footer mobile: usamos el teléfono de la persona que recibe en sitio
    // (recibe_telefono) — es el contacto útil para coordinar la visita
    // mientras el visitador está en camino.
    const numeroLlamar = (fila.recibe_telefono || '').replace(/[^+\d]/g, '')
    const numeroWa = (fila.recibe_telefono || '').replace(/[^\d]/g, '')

    // Para Maps preferimos lat/lng (abre en modo navegación con dirigirse a)
    // y caemos a search por dirección textual cuando no hay coordenadas.
    const tieneCoords = fila.direccion_lat != null && fila.direccion_lng != null
    const urlMapa = tieneCoords
      ? `https://www.google.com/maps/dir/?api=1&destination=${fila.direccion_lat},${fila.direccion_lng}&travelmode=driving`
      : (fila.direccion_texto ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(fila.direccion_texto)}` : null)

    const esProvisoria = fila.estado === 'provisoria'

    return (
      <div className="flex flex-col">
        <div className="p-4 flex flex-col gap-3">
          {/* ── Cabecera: chip de estado (con su color) + checkbox de selección
                que la tabla coloca absoluto arriba-derecha (pr-7 reserva espacio). */}
          <div className="flex items-start justify-between gap-2 pr-7">
            {estado && (
              <Insignia
                color={estado.color as 'exito' | 'peligro' | 'advertencia' | 'info' | 'neutro'}
                tamano="sm"
              >
                {estado.etiqueta}
              </Insignia>
            )}
            {fila.prioridad === 'urgente' && <Insignia color="peligro" tamano="sm">Urgente</Insignia>}
            {fila.prioridad === 'alta' && <Insignia color="peligro" tamano="sm" variante="outline">Alta</Insignia>}
          </div>

          {/* ── Identidad de la visita: contacto + motivo ── */}
          <div className="flex flex-col gap-1">
            <p className="text-base font-medium text-texto-primario leading-snug">
              {fila.contacto_nombre}
            </p>
            {fila.motivo && (
              <p className="text-sm text-texto-secundario leading-snug">
                {fila.motivo}
              </p>
            )}
          </div>

          {/* ── Meta: fecha + dirección + asignado + receptor en sitio ── */}
          <div className="border-t border-borde-sutil pt-3 flex flex-col gap-2">
            <LineaInfoTarjeta icono={<CalendarClock size={13} />}>
              {fechaCorta(fila.fecha_programada, formato.locale)}
            </LineaInfoTarjeta>
            {fila.direccion_texto && (
              <LineaInfoTarjeta icono={<MapPin size={13} />} alineacion="start">
                {fila.direccion_texto}
              </LineaInfoTarjeta>
            )}
            {fila.asignado_nombre && (
              <LineaInfoTarjeta icono={<User size={13} />} truncar>
                {fila.asignado_nombre}
              </LineaInfoTarjeta>
            )}
            {fila.recibe_nombre && (
              <LineaInfoTarjeta icono={<Phone size={13} />} truncar>
                {fila.recibe_nombre}
              </LineaInfoTarjeta>
            )}
          </div>

          {/* ── Banner provisoria: requiere acción del usuario antes de operar ── */}
          {esProvisoria && (
            <div className="flex items-center gap-2 pt-1 border-t border-borde-sutil">
              <button
                onClick={(e) => { e.stopPropagation(); setVisitaConfirmando(fila) }}
                className="flex-1 flex items-center justify-center gap-1.5 px-2 py-2 rounded-card text-xs font-medium bg-insignia-exito-fondo text-insignia-exito-texto hover:opacity-90 transition-opacity border-0 cursor-pointer"
              >
                <CheckCircle size={14} /> Confirmar
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); rechazarVisita(fila.id) }}
                className="flex-1 flex items-center justify-center gap-1.5 px-2 py-2 rounded-card text-xs font-medium text-texto-terciario hover:text-insignia-peligro-texto hover:bg-insignia-peligro-fondo transition-colors border border-borde-sutil bg-transparent cursor-pointer"
              >
                <XCircle size={14} /> Rechazar
              </button>
            </div>
          )}
        </div>

        {/* ── Footer mobile: llamar al receptor / WhatsApp / navegar al sitio ──
            Slots siempre visibles para mantener layout consistente. Si la
            visita no tiene receptor o no tiene dirección, los slots quedan
            apagados — útil porque las visitas suelen tener todos los datos. */}
        <div className="sm:hidden">
          <PieAccionesTarjeta acciones={[
            {
              id: 'llamar',
              icono: <Phone size={16} className="shrink-0" />,
              etiqueta: 'Llamar',
              href: numeroLlamar ? `tel:${numeroLlamar}` : undefined,
              deshabilitado: !numeroLlamar,
            },
            {
              id: 'whatsapp',
              icono: <IconoWhatsApp size={16} className="shrink-0" />,
              etiqueta: 'WhatsApp',
              href: numeroWa ? `https://wa.me/${numeroWa}` : undefined,
              target: '_blank',
              color: 'var(--canal-whatsapp)',
              deshabilitado: !numeroWa,
            },
            {
              id: 'navegar',
              icono: <MapPin size={16} className="shrink-0" />,
              etiqueta: 'Navegar',
              href: urlMapa || undefined,
              target: '_blank',
              deshabilitado: !urlMapa,
            },
          ] satisfies AccionTarjeta[]} />
        </div>
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
        datos={visitasMostradas}
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
        onLimpiarFiltros={filtros.limpiar}
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
        gridTarjetas="grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6"
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
