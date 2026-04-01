'use client'

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { PlantillaListado } from '@/componentes/entidad/PlantillaListado'
import { TablaDinamica } from '@/componentes/tablas/TablaDinamica'
import type { ColumnaDinamica } from '@/componentes/tablas/TablaDinamica'
import {
  PlusCircle, Download, ClipboardList, CalendarClock,
  CheckCircle, Clock, User, FileText, MapPin,
} from 'lucide-react'
import { EstadoVacio } from '@/componentes/feedback/EstadoVacio'
import { Boton } from '@/componentes/ui/Boton'
import { Insignia } from '@/componentes/ui/Insignia'
import { obtenerIcono } from '@/componentes/ui/SelectorIcono'
import { ModalActividad } from './_componentes/ModalActividad'
import type { Actividad, Miembro, Vinculo } from './_componentes/ModalActividad'
import type { TipoActividad } from './configuracion/secciones/SeccionTipos'
import type { EstadoActividad } from './configuracion/secciones/SeccionEstados'
import { crearClienteNavegador } from '@/lib/supabase/cliente'
import { useToast } from '@/componentes/feedback/Toast'

/**
 * Página principal de Actividades.
 * Tabla con columnas bien dimensionadas, vista tarjetas con acciones rápidas,
 * acción inteligente por tipo (presupuestar → crear presupuesto).
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
function fechaCorta(iso: string | null): string {
  if (!iso) return 'Sin fecha'
  const fecha = new Date(iso)
  const hoy = new Date(); hoy.setHours(0, 0, 0, 0)
  const diff = Math.floor((fecha.getTime() - hoy.getTime()) / 86400000)

  if (diff === 0) return 'Hoy'
  if (diff === 1) return 'Mañana'
  if (diff === -1) return 'Ayer'

  // 2-6 días (pasado o futuro) → nombre del día
  if (diff >= 2 && diff <= 6) {
    return fecha.toLocaleDateString('es-AR', { weekday: 'long' }).replace(/^\w/, c => c.toUpperCase())
  }
  if (diff <= -2 && diff >= -6) {
    return fecha.toLocaleDateString('es-AR', { weekday: 'long' }).replace(/^\w/, c => c.toUpperCase())
  }

  // +7 días → fecha corta
  return fecha.toLocaleDateString('es-AR', { day: '2-digit', month: 'short' })
}

const POR_PAGINA = 50

export default function PaginaActividades() {
  const router = useRouter()
  const [busqueda, setBusqueda] = useState('')
  const [actividades, setActividades] = useState<Actividad[]>([])
  const [tipos, setTipos] = useState<TipoActividad[]>([])
  const [estados, setEstados] = useState<EstadoActividad[]>([])
  const [miembros, setMiembros] = useState<Miembro[]>([])
  const [cargando, setCargando] = useState(true)
  const [total, setTotal] = useState(0)
  const [pagina, setPagina] = useState(1)
  const [modalAbierto, setModalAbierto] = useState(false)
  const [actividadEditando, setActividadEditando] = useState<Actividad | null>(null)

  // Filtros server-side
  const [filtroTipo, setFiltroTipo] = useState('')
  const [filtroEstado, setFiltroEstado] = useState('')
  const [filtroPrioridad, setFiltroPrioridad] = useState('')
  const filtrosRef = useRef({ tipo: '', estado: '', prioridad: '' })
  filtrosRef.current = { tipo: filtroTipo, estado: filtroEstado, prioridad: filtroPrioridad }

  const busquedaRef = useRef(busqueda)
  busquedaRef.current = busqueda

  // Contador de fetch para descartar respuestas obsoletas (race condition)
  const fetchIdRef = useRef(0)

  // Mapas memoizados
  const tiposPorId = useMemo(() => Object.fromEntries(tipos.map(t => [t.id, t])), [tipos])
  const estadosPorClave = useMemo(() => Object.fromEntries(estados.map(e => [e.clave, e])), [estados])

  const cargarConfig = useCallback(async () => {
    try {
      const [configRes, miembrosData] = await Promise.all([
        fetch('/api/actividades/config').then(r => r.json()),
        (async () => {
          const supabase = crearClienteNavegador()
          const { data: { user } } = await supabase.auth.getUser()
          if (!user) return []
          const empresaId = user.app_metadata?.empresa_activa_id
          if (!empresaId) return []
          const { data: mRes } = await supabase.from('miembros').select('usuario_id').eq('empresa_id', empresaId).eq('activo', true)
          if (!mRes?.length) return []
          const { data: perfiles } = await supabase.from('perfiles').select('id, nombre, apellido').in('id', mRes.map(m => m.usuario_id))
          return (perfiles || []).map(p => ({ usuario_id: p.id, nombre: p.nombre, apellido: p.apellido }))
        })(),
      ])
      setTipos(configRes.tipos || [])
      setEstados(configRes.estados || [])
      setMiembros(miembrosData)
    } catch (err) { console.error('Error en actividades:', err) }
  }, [])

  // Fetch de actividades con protección contra race conditions
  const cargarActividades = useCallback(async (p: number) => {
    const id = ++fetchIdRef.current
    setCargando(true)
    try {
      const params = new URLSearchParams()
      const b = busquedaRef.current
      if (b) params.set('busqueda', b)
      if (filtrosRef.current.tipo) params.set('tipo', filtrosRef.current.tipo)
      if (filtrosRef.current.estado) params.set('estado', filtrosRef.current.estado)
      if (filtrosRef.current.prioridad) params.set('prioridad', filtrosRef.current.prioridad)
      params.set('pagina', String(p))
      params.set('por_pagina', String(POR_PAGINA))

      const res = await fetch(`/api/actividades?${params}`)
      if (res.ok && fetchIdRef.current === id) {
        const data = await res.json()
        setActividades(data.actividades || [])
        setTotal(data.total || 0)
      }
    } catch (err) { console.error('Error en actividades:', err) }
    finally { if (fetchIdRef.current === id) setCargando(false) }
  }, [])

  // Cargar config al montar
  useEffect(() => { cargarConfig() }, [cargarConfig])

  // Cargar al cambiar página
  useEffect(() => {
    cargarActividades(pagina)
  }, [pagina, cargarActividades])

  // Re-fetch al cambiar filtros (reset a página 1)
  useEffect(() => {
    if (!montadoRef.current) return
    if (pagina === 1) cargarActividades(1)
    else setPagina(1)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtroTipo, filtroEstado, filtroPrioridad])

  // Recargar al cambiar búsqueda (con debounce, reseteando a página 1)
  const montadoRef = useRef(false)
  useEffect(() => {
    if (!montadoRef.current) { montadoRef.current = true; return }
    const timeout = setTimeout(() => {
      if (pagina === 1) {
        cargarActividades(1)
      } else {
        setPagina(1)
      }
    }, 300)
    return () => clearTimeout(timeout)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [busqueda])

  // Acciones
  const crearActividad = async (datos: Record<string, unknown>) => {
    const res = await fetch('/api/actividades', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(datos),
    })
    if (!res.ok) throw new Error('Error al crear')
    cargarActividades(pagina)
  }

  const editarActividad = async (datos: Record<string, unknown>) => {
    const { id, ...campos } = datos
    const res = await fetch(`/api/actividades/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(campos),
    })
    if (!res.ok) throw new Error('Error al editar')
    cargarActividades(pagina)
  }

  const completarActividad = async (id: string) => {
    await fetch(`/api/actividades/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accion: 'completar' }),
    })
    cargarActividades(pagina)
  }

  const posponerActividad = async (id: string, dias: number) => {
    await fetch(`/api/actividades/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accion: 'posponer', dias }),
    })
    cargarActividades(pagina)
  }

  /** Acción inteligente por tipo — presupuestar abre /presupuestos/nuevo con contacto */
  const ejecutarAccionTipo = (act: Actividad) => {
    const tipo = tiposPorId[act.tipo_id]
    if (!tipo) return
    const contacto = (act.vinculos as Vinculo[])?.find(v => v.tipo === 'contacto')

    switch (tipo.clave) {
      case 'presupuestar':
        if (contacto) {
          router.push(`/presupuestos/nuevo?contacto_id=${contacto.id}&desde=/actividades`)
        } else {
          router.push('/presupuestos/nuevo?desde=/actividades')
        }
        return
      case 'visita':
        if (contacto) {
          router.push(`/visitas?contacto_id=${contacto.id}&desde=/actividades`)
        }
        return
      case 'correo':
        if (contacto) {
          router.push(`/inbox?contacto_id=${contacto.id}&desde=/actividades`)
        }
        return
    }
    // Default: abrir modal de edición
    setActividadEditando(act)
    setModalAbierto(true)
  }

  /** Columnas de la tabla */
  const columnas: ColumnaDinamica<Actividad>[] = [
    {
      clave: 'estado_clave',
      etiqueta: '',
      ancho: 36,
      render: (fila) => {
        const esPendiente = fila.estado_clave !== 'completada' && fila.estado_clave !== 'cancelada'
        const estado = estadosPorClave[fila.estado_clave]
        return (
          <button
            onClick={(e) => { e.stopPropagation(); if (esPendiente) completarActividad(fila.id) }}
            className={`size-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${
              esPendiente
                ? 'border-borde-fuerte bg-transparent cursor-pointer hover:border-insignia-exito hover:bg-insignia-exito-fondo'
                : 'border-transparent cursor-default'
            }`}
            style={!esPendiente && estado ? { backgroundColor: estado.color + '20', color: estado.color } : undefined}
            title={esPendiente ? 'Completar' : estado?.etiqueta}
          >
            {!esPendiente && <CheckCircle size={12} />}
          </button>
        )
      },
    },
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
        return (
          <div className="flex items-center gap-2.5 min-w-0">
            {tipo && (
              <div
                className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
                style={{ backgroundColor: tipo.color + '15', color: tipo.color }}
              >
                {Icono && <Icono size={14} />}
              </div>
            )}
            <div className="min-w-0">
              <p className={`text-sm font-medium truncate ${completada ? 'line-through text-texto-terciario' : 'text-texto-primario'}`}>
                {fila.titulo}
              </p>
              {contacto && (
                <p className="text-xs text-texto-terciario truncate flex items-center gap-1">
                  <User size={10} />
                  {contacto.nombre}
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
      ancho: 110,
      ordenable: true,
      render: (fila) => {
        const tipo = tiposPorId[fila.tipo_id]
        return tipo ? (
          <span className="text-xs font-medium px-2 py-0.5 rounded-full" style={{ backgroundColor: tipo.color + '12', color: tipo.color }}>
            {tipo.etiqueta}
          </span>
        ) : null
      },
    },
    {
      clave: 'prioridad',
      etiqueta: 'Prioridad',
      ancho: 90,
      ordenable: true,
      render: (fila) => {
        if (fila.prioridad === 'normal') return null
        const p = COLORES_PRIORIDAD[fila.prioridad]
        return p ? <Insignia color={p.color as 'info' | 'peligro'}>{p.etiqueta}</Insignia> : null
      },
    },
    {
      clave: 'asignado_nombre',
      etiqueta: 'Responsable',
      ancho: 140,
      ordenable: true,
      render: (fila) => fila.asignado_nombre ? (
        <span className="text-xs text-texto-secundario">{fila.asignado_nombre}</span>
      ) : <span className="text-xs text-texto-terciario/50">—</span>,
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
            {fechaCorta(fila.fecha_vencimiento)}
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
      ancho: 80,
      render: (fila) => {
        const esPendiente = fila.estado_clave !== 'completada' && fila.estado_clave !== 'cancelada'
        const tipo = tiposPorId[fila.tipo_id]
        const tieneAccionTipo = tipo && ['presupuestar', 'visita', 'correo'].includes(tipo.clave)
        return (
          <div className="flex items-center gap-0.5 justify-end">
            {esPendiente && tieneAccionTipo && (
              <button
                onClick={(e) => { e.stopPropagation(); ejecutarAccionTipo(fila) }}
                className="size-7 rounded-md flex items-center justify-center bg-transparent border-none text-texto-terciario cursor-pointer hover:bg-texto-marca/10 hover:text-texto-marca transition-colors"
                title={`Ir a ${tipo?.etiqueta?.toLowerCase()}`}
              >
                {tipo?.clave === 'presupuestar' ? <FileText size={14} /> : tipo?.clave === 'visita' ? <MapPin size={14} /> : <ClipboardList size={14} />}
              </button>
            )}
            {esPendiente && (
              <button
                onClick={(e) => { e.stopPropagation(); posponerActividad(fila.id, 1) }}
                className="size-7 rounded-md flex items-center justify-center bg-transparent border-none text-texto-terciario cursor-pointer hover:bg-insignia-advertencia-fondo hover:text-insignia-advertencia-texto transition-colors"
                title="Posponer 1 día"
              >
                <Clock size={14} />
              </button>
            )}
          </div>
        )
      },
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
                className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
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

        {/* Título */}
        <p className={`text-sm font-medium mb-1 ${completada ? 'line-through text-texto-terciario' : 'text-texto-primario'}`}>
          {fila.titulo}
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
          {fila.asignado_nombre && (
            <div className="flex items-center gap-1.5">
              <div className="size-5 rounded-full bg-superficie-hover flex items-center justify-center text-xxs font-bold text-texto-terciario shrink-0">
                {fila.asignado_nombre.charAt(0).toUpperCase()}
              </div>
              <span className="text-xs text-texto-terciario">{fila.asignado_nombre}</span>
            </div>
          )}

          {/* Fecha + prioridad + botones */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {fila.fecha_vencimiento && (
                <span className={`text-xs font-medium ${vencida ? 'text-insignia-peligro-texto' : 'text-texto-terciario'}`}>
                  {fechaCorta(fila.fecha_vencimiento)}
                </span>
              )}
              {fila.prioridad === 'alta' && <Insignia color="peligro">Alta</Insignia>}
              {fila.prioridad === 'baja' && <Insignia color="info">Baja</Insignia>}
            </div>

            {esPendiente && (
              <div className="flex items-center gap-0.5">
                <button
                  onClick={(e) => { e.stopPropagation(); completarActividad(fila.id) }}
                  className="size-7 rounded-md flex items-center justify-center bg-transparent border-none text-texto-terciario cursor-pointer hover:bg-insignia-exito-fondo hover:text-insignia-exito-texto transition-colors"
                  title="Completar"
                >
                  <CheckCircle size={15} />
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); posponerActividad(fila.id, 1) }}
                  className="size-7 rounded-md flex items-center justify-center bg-transparent border-none text-texto-terciario cursor-pointer hover:bg-insignia-advertencia-fondo hover:text-insignia-advertencia-texto transition-colors"
                  title="Posponer 1 día"
                >
                  <Clock size={15} />
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    )
  }

  return (
    <PlantillaListado
      titulo="Actividades"
      icono={<ClipboardList size={20} />}
      accionPrincipal={{
        etiqueta: 'Nueva actividad',
        icono: <PlusCircle size={14} />,
        onClick: () => { setActividadEditando(null); setModalAbierto(true) },
      }}
      acciones={[
        { id: 'exportar', etiqueta: 'Exportar', icono: <Download size={14} />, onClick: () => {} },
      ]}
      mostrarConfiguracion
      onConfiguracion={() => router.push('/actividades/configuracion')}
    >
      <TablaDinamica
        columnas={columnas}
        columnasVisiblesDefault={['estado_clave', 'titulo', 'tipo_clave', 'prioridad', 'asignado_nombre', 'fecha_vencimiento', 'acciones']}
        datos={actividades}
        claveFila={(r) => r.id}
        totalRegistros={total}
        registrosPorPagina={POR_PAGINA}
        paginaExterna={pagina}
        onCambiarPagina={setPagina}
        vistas={['lista', 'tarjetas']}
        seleccionables
        busqueda={busqueda}
        onBusqueda={setBusqueda}
        placeholder="Buscar actividades..."
        filtros={[
          {
            id: 'tipo', etiqueta: 'Tipo', tipo: 'pills' as const,
            valor: filtroTipo, onChange: (v) => setFiltroTipo(v as string),
            opciones: tipos.filter(t => t.activo).map(t => ({ valor: t.clave, etiqueta: t.etiqueta })),
          },
          {
            id: 'estado', etiqueta: 'Estado', tipo: 'pills' as const,
            valor: filtroEstado, onChange: (v) => setFiltroEstado(v as string),
            opciones: estados.filter(e => e.activo).map(e => ({ valor: e.clave, etiqueta: e.etiqueta })),
          },
          {
            id: 'prioridad', etiqueta: 'Prioridad', tipo: 'pills' as const,
            valor: filtroPrioridad, onChange: (v) => setFiltroPrioridad(v as string),
            opciones: [
              { valor: 'baja', etiqueta: 'Baja' },
              { valor: 'normal', etiqueta: 'Normal' },
              { valor: 'alta', etiqueta: 'Alta' },
            ],
          },
        ]}
        onLimpiarFiltros={() => { setFiltroTipo(''); setFiltroEstado(''); setFiltroPrioridad('') }}
        opcionesOrden={[
          { etiqueta: 'Más recientes', clave: 'creado_en', direccion: 'desc' },
          { etiqueta: 'Más antiguos', clave: 'creado_en', direccion: 'asc' },
          { etiqueta: 'Vencimiento ↑', clave: 'fecha_vencimiento', direccion: 'asc' },
          { etiqueta: 'Vencimiento ↓', clave: 'fecha_vencimiento', direccion: 'desc' },
          { etiqueta: 'Título A-Z', clave: 'titulo', direccion: 'asc' },
          { etiqueta: 'Título Z-A', clave: 'titulo', direccion: 'desc' },
        ]}
        idModulo="actividades"
        renderTarjeta={renderTarjeta}
        onClickFila={(fila) => { setActividadEditando(fila); setModalAbierto(true) }}
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

      <ModalActividad
        abierto={modalAbierto}
        actividad={actividadEditando}
        tipos={tipos}
        estados={estados}
        miembros={miembros}
        onGuardar={actividadEditando ? editarActividad : crearActividad}
        onCompletar={async (id) => { await completarActividad(id); setModalAbierto(false); setActividadEditando(null) }}
        onPosponer={async (id, dias) => { await posponerActividad(id, dias); setModalAbierto(false); setActividadEditando(null) }}
        onCerrar={() => { setModalAbierto(false); setActividadEditando(null) }}
      />
    </PlantillaListado>
  )
}
