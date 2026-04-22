'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { useQueryClient, useQuery } from '@tanstack/react-query'
import { useListado } from '@/hooks/useListado'
import { useRol } from '@/hooks/useRol'
import { useFormato } from '@/hooks/useFormato'
import { useBusquedaDebounce } from '@/hooks/useBusquedaDebounce'
import { GuardPagina } from '@/componentes/entidad/GuardPagina'
import { useTraduccion } from '@/lib/i18n'
import { PlantillaListado } from '@/componentes/entidad/PlantillaListado'
import { TablaDinamica } from '@/componentes/tablas/TablaDinamica'
import type { ColumnaDinamica } from '@/componentes/tablas/TablaDinamica'
import { PlusCircle, Download, Wrench, Hammer, Trash2 } from 'lucide-react'
import { EstadoVacio } from '@/componentes/feedback/EstadoVacio'
import { Boton } from '@/componentes/ui/Boton'
// Insignia no se usa — los badges de estado/prioridad se renderizan con <span> y clases dinámicas
import { useToast } from '@/componentes/feedback/Toast'
import {
  ETIQUETAS_ESTADO_OT, COLORES_ESTADO_OT, ETIQUETAS_PRIORIDAD_OT, COLORES_PRIORIDAD_OT,
  type EstadoOrdenTrabajo, type PrioridadOrdenTrabajo,
} from '@/tipos/orden-trabajo'

/**
 * ContenidoOrdenes — Listado interactivo de órdenes de trabajo.
 * Reutiliza PlantillaListado + TablaDinamica con datos reales desde la API.
 */

interface FilaOrden {
  id: string
  numero: string
  estado: EstadoOrdenTrabajo
  prioridad: PrioridadOrdenTrabajo
  titulo: string
  descripcion: string | null
  contacto_id: string | null
  contacto_nombre: string | null
  contacto_telefono: string | null
  contacto_direccion: string | null
  presupuesto_id: string | null
  presupuesto_numero: string | null
  asignado_a: string | null
  asignado_nombre: string | null
  publicada: boolean
  fecha_inicio: string | null
  fecha_fin_estimada: string | null
  fecha_fin_real: string | null
  creado_por: string
  creado_por_nombre: string | null
  creado_en: string
  actualizado_en: string
}

const POR_PAGINA = 50

export default function ContenidoOrdenes() {
  return (
    <GuardPagina modulo="ordenes_trabajo">
      <ContenidoOrdenesInterno />
    </GuardPagina>
  )
}

function ContenidoOrdenesInterno() {
  const { t } = useTraduccion()
  const { tienePermiso } = useRol()
  const formato = useFormato()
  const router = useRouter()
  const searchParams = useSearchParams()
  const pathname = usePathname()
  const queryClient = useQueryClient()
  const { mostrar: mostrarToast } = useToast()

  // Filtros — restaurar desde URL
  const [filtroEstado, setFiltroEstado] = useState<string[]>(() => {
    const v = searchParams.get('estado')
    return v ? v.split(',') : []
  })
  const [filtroPrioridad, setFiltroPrioridad] = useState<string[]>(() => {
    const v = searchParams.get('prioridad')
    return v ? v.split(',') : []
  })
  const [filtroTipoContacto, setFiltroTipoContacto] = useState<string[]>(() => {
    const v = searchParams.get('tipo_contacto')
    return v ? v.split(',') : []
  })
  const [filtroAsignados, setFiltroAsignados] = useState<string[]>(() => {
    const v = searchParams.get('asignado_a')
    return v ? v.split(',') : []
  })
  const [filtroSinAsignar, setFiltroSinAsignar] = useState(searchParams.get('sin_asignar') === 'true')
  const [filtroCreadoPor, setFiltroCreadoPor] = useState(searchParams.get('creado_por') || '')
  const [filtroConPresupuesto, setFiltroConPresupuesto] = useState(searchParams.get('con_presupuesto') || '')
  const [filtroVencida, setFiltroVencida] = useState(searchParams.get('vencida') || '')
  const [filtroPublicada, setFiltroPublicada] = useState(searchParams.get('publicada') || '')
  const [filtroFecha, setFiltroFecha] = useState(searchParams.get('fecha') || '')
  const [filtroAnio, setFiltroAnio] = useState(searchParams.get('anio') || '')

  const { busqueda, setBusqueda, busquedaDebounced, pagina, setPagina } = useBusquedaDebounce(
    searchParams.get('q') || '',
    Number(searchParams.get('pagina')) || 1,
    [
      filtroEstado, filtroPrioridad, filtroTipoContacto,
      filtroAsignados, filtroSinAsignar, filtroCreadoPor,
      filtroConPresupuesto, filtroVencida, filtroPublicada,
      filtroFecha, filtroAnio,
    ],
    true,
  )

  // Sincronizar filtros → URL
  useEffect(() => {
    const params = new URLSearchParams()
    if (busquedaDebounced) params.set('q', busquedaDebounced)
    if (filtroEstado.length > 0) params.set('estado', filtroEstado.join(','))
    if (filtroPrioridad.length > 0) params.set('prioridad', filtroPrioridad.join(','))
    if (filtroTipoContacto.length > 0) params.set('tipo_contacto', filtroTipoContacto.join(','))
    if (filtroAsignados.length > 0) params.set('asignado_a', filtroAsignados.join(','))
    if (filtroSinAsignar) params.set('sin_asignar', 'true')
    if (filtroCreadoPor) params.set('creado_por', filtroCreadoPor)
    if (filtroConPresupuesto) params.set('con_presupuesto', filtroConPresupuesto)
    if (filtroVencida) params.set('vencida', filtroVencida)
    if (filtroPublicada) params.set('publicada', filtroPublicada)
    if (filtroFecha) params.set('fecha', filtroFecha)
    if (filtroAnio) params.set('anio', filtroAnio)
    if (pagina > 1) params.set('pagina', String(pagina))
    const qs = params.toString()
    window.history.replaceState(null, '', qs ? `${pathname}?${qs}` : pathname)
  }, [
    busquedaDebounced, filtroEstado, filtroPrioridad, filtroTipoContacto,
    filtroAsignados, filtroSinAsignar, filtroCreadoPor,
    filtroConPresupuesto, filtroVencida, filtroPublicada,
    filtroFecha, filtroAnio, pagina, pathname,
  ])

  const { datos: ordenes, total, cargando, cargandoInicial } = useListado<FilaOrden>({
    clave: 'ordenes',
    url: '/api/ordenes',
    parametros: {
      busqueda: busquedaDebounced,
      estado: filtroEstado.length > 0 ? filtroEstado.join(',') : undefined,
      prioridad: filtroPrioridad.length > 0 ? filtroPrioridad.join(',') : undefined,
      tipo_contacto: filtroTipoContacto.length > 0 ? filtroTipoContacto.join(',') : undefined,
      asignado_a: filtroAsignados.length > 0 ? filtroAsignados.join(',') : undefined,
      sin_asignar: filtroSinAsignar ? 'true' : undefined,
      creado_por: filtroCreadoPor || undefined,
      con_presupuesto: filtroConPresupuesto || undefined,
      vencida: filtroVencida || undefined,
      publicada: filtroPublicada || undefined,
      fecha: filtroFecha || undefined,
      anio: filtroAnio || undefined,
      pagina,
      por_pagina: POR_PAGINA,
    },
    extraerDatos: (json) => (json.ordenes || []) as FilaOrden[],
    extraerTotal: (json) => (json.total || 0) as number,
  })

  // ── Cargar opciones para los filtros ──

  /** Tipos de contacto para el filtro "Tipo de cliente" */
  const { data: tiposContactoData } = useQuery({
    queryKey: ['ordenes-filtros-tipos-contacto'],
    queryFn: () => fetch('/api/contactos/tipos').then(r => r.json()),
    staleTime: 5 * 60_000,
  })
  const opcionesTiposContacto = useMemo(() => {
    const items = (tiposContactoData?.tipos_contacto || []) as { clave: string; etiqueta: string }[]
    return items.map(t => ({ valor: t.clave, etiqueta: t.etiqueta }))
  }, [tiposContactoData])

  /** Miembros para "Asignado" y "Creado por" */
  const { data: miembrosData } = useQuery({
    queryKey: ['miembros-empresa'],
    queryFn: () => fetch('/api/miembros').then(r => r.json()),
    staleTime: 5 * 60_000,
  })
  const opcionesMiembros = useMemo(() => {
    const items = (miembrosData?.miembros || []) as { usuario_id: string; nombre: string | null; apellido: string | null }[]
    return items.map(m => ({
      valor: m.usuario_id,
      etiqueta: `${m.nombre || ''} ${m.apellido || ''}`.trim() || 'Sin nombre',
    }))
  }, [miembrosData])

  /** Años disponibles — los últimos 6 años */
  const opcionesAnios = useMemo(() => {
    const actual = new Date().getFullYear()
    return Array.from({ length: 6 }, (_, i) => {
      const a = actual - i
      return { valor: String(a), etiqueta: String(a) }
    })
  }, [])

  // Enviar a papelera en lote
  const enviarAPapeleraLote = useCallback(async (ids: Set<string>) => {
    try {
      await Promise.all(
        Array.from(ids).map(id =>
          fetch(`/api/ordenes/${id}`, { method: 'DELETE' })
        )
      )
      queryClient.invalidateQueries({ queryKey: ['ordenes'] })
      mostrarToast('exito', `${ids.size} orden${ids.size !== 1 ? 'es' : ''} enviada${ids.size !== 1 ? 's' : ''} a papelera`)
    } catch {
      mostrarToast('error', 'Error al enviar a papelera')
    }
  }, [mostrarToast, queryClient])

  // ── Columnas ──

  const columnas: ColumnaDinamica<FilaOrden>[] = [
    {
      clave: 'numero',
      etiqueta: t('ordenes.numero'),
      ancho: 120,
      ordenable: true,
      render: (fila) => (
        <span className="font-medium text-texto-primario">{fila.numero}</span>
      ),
    },
    {
      clave: 'titulo',
      etiqueta: t('ordenes.titulo_campo'),
      ancho: 250,
      ordenable: true,
      render: (fila) => (
        <span className="text-texto-primario line-clamp-2 whitespace-normal leading-snug">{fila.titulo}</span>
      ),
    },
    {
      clave: 'contacto_nombre',
      etiqueta: t('ordenes.cliente'),
      ancho: 180,
      ordenable: true,
      render: (fila) => (
        <span className="text-texto-secundario">{fila.contacto_nombre || '—'}</span>
      ),
    },
    {
      clave: 'estado',
      etiqueta: t('comun.estado'),
      ancho: 130,
      ordenable: true,
      filtrable: true,
      opcionesFiltro: Object.entries(ETIQUETAS_ESTADO_OT).map(([valor, etiqueta]) => ({ valor, etiqueta })),
      render: (fila) => {
        const colores = COLORES_ESTADO_OT[fila.estado]
        return (
          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${colores.fondo} ${colores.texto}`}>
            {ETIQUETAS_ESTADO_OT[fila.estado]}
          </span>
        )
      },
    },
    {
      clave: 'prioridad',
      etiqueta: 'Prioridad',
      ancho: 110,
      ordenable: true,
      filtrable: true,
      opcionesFiltro: Object.entries(ETIQUETAS_PRIORIDAD_OT).map(([valor, etiqueta]) => ({ valor, etiqueta })),
      render: (fila) => {
        const colores = COLORES_PRIORIDAD_OT[fila.prioridad]
        return (
          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${colores.fondo} ${colores.texto}`}>
            {ETIQUETAS_PRIORIDAD_OT[fila.prioridad]}
          </span>
        )
      },
    },
    {
      clave: 'presupuesto_numero',
      etiqueta: t('ordenes.presupuesto_origen'),
      ancho: 130,
      render: (fila) => fila.presupuesto_numero ? (
        <span className="text-texto-terciario">{fila.presupuesto_numero}</span>
      ) : <span className="text-texto-terciario">—</span>,
    },
    {
      clave: 'asignado_nombre',
      etiqueta: t('ordenes.asignado'),
      ancho: 160,
      ordenable: true,
      render: (fila) => (
        <span className="text-texto-secundario">{fila.asignado_nombre || '—'}</span>
      ),
    },
    {
      clave: 'publicada',
      etiqueta: 'Publicada',
      ancho: 110,
      filtrable: true,
      opcionesFiltro: [
        { valor: 'true', etiqueta: 'Publicadas' },
        { valor: 'false', etiqueta: 'Sin publicar' },
      ],
      render: (fila) => {
        // Estados terminales: la publicación ya fue consumida, se muestra apagada
        const terminada = fila.estado === 'completada' || fila.estado === 'cancelada'
        if (!fila.publicada) {
          return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-insignia-naranja-fondo text-insignia-naranja-texto">Sin publicar</span>
        }
        if (terminada) {
          return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-superficie-hover/60 text-texto-terciario">Publicada</span>
        }
        return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-insignia-exito-fondo text-insignia-exito-texto">Publicada</span>
      },
    },
    {
      clave: 'creado_en',
      etiqueta: t('ordenes.fecha'),
      ancho: 130,
      ordenable: true,
      render: (fila) => (
        <span className="text-texto-terciario text-xs">
          {formato.fecha(fila.creado_en, { corta: true })}
        </span>
      ),
    },
  ]

  // ── Render tarjeta ──

  const renderTarjeta = (fila: FilaOrden) => {
    const coloresEstado = COLORES_ESTADO_OT[fila.estado]
    const coloresPrioridad = COLORES_PRIORIDAD_OT[fila.prioridad]
    return (
      <div className="p-4 space-y-2">
        <div className="flex items-center justify-between">
          <span className="font-medium text-texto-primario text-sm">{fila.numero}</span>
          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${coloresEstado.fondo} ${coloresEstado.texto}`}>
            {ETIQUETAS_ESTADO_OT[fila.estado]}
          </span>
        </div>
        <p className="text-sm text-texto-primario truncate">{fila.titulo}</p>
        {fila.contacto_nombre && (
          <p className="text-xs text-texto-terciario">{fila.contacto_nombre}</p>
        )}
        <div className="flex items-center justify-between">
          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${coloresPrioridad.fondo} ${coloresPrioridad.texto}`}>
            {ETIQUETAS_PRIORIDAD_OT[fila.prioridad]}
          </span>
          {fila.asignado_nombre && (
            <span className="text-xs text-texto-terciario">{fila.asignado_nombre}</span>
          )}
        </div>
      </div>
    )
  }

  return (
    <PlantillaListado
      titulo={t('ordenes.titulo')}
      icono={<Wrench size={20} />}
      accionPrincipal={
        tienePermiso('ordenes_trabajo', 'crear')
          ? { etiqueta: t('ordenes.nueva'), icono: <PlusCircle size={14} />, onClick: () => router.push('/ordenes/nuevo') }
          : undefined
      }
      acciones={[
        { id: 'exportar', etiqueta: t('comun.exportar'), icono: <Download size={14} />, onClick: () => {} },
      ]}
      mostrarConfiguracion
      onConfiguracion={() => router.push('/ordenes/configuracion')}
    >
      <TablaDinamica
        columnas={columnas}
        datos={ordenes}
        claveFila={(r) => r.id}
        vistas={['lista', 'tarjetas']}
        renderTarjeta={renderTarjeta}
        seleccionables
        busqueda={busqueda}
        onBusqueda={setBusqueda}
        placeholder="Buscar por número, título, cliente, dirección..."
        idModulo="ordenes"
        totalRegistros={total}
        registrosPorPagina={POR_PAGINA}
        paginaExterna={pagina}
        onCambiarPagina={setPagina}
        filtros={[
          // ── Identidad ──
          {
            id: 'estado', etiqueta: 'Estado', tipo: 'multiple-compacto' as const,
            valor: filtroEstado,
            onChange: (v) => setFiltroEstado(Array.isArray(v) ? v : (v ? [v] : [])),
            opciones: Object.entries(ETIQUETAS_ESTADO_OT).map(([valor, etiqueta]) => ({ valor, etiqueta })),
            descripcion: 'Filtrá por uno o más estados de la orden de trabajo.',
          },
          {
            id: 'prioridad', etiqueta: 'Prioridad', tipo: 'multiple-compacto' as const,
            valor: filtroPrioridad,
            onChange: (v) => setFiltroPrioridad(Array.isArray(v) ? v : (v ? [v] : [])),
            opciones: Object.entries(ETIQUETAS_PRIORIDAD_OT).map(([valor, etiqueta]) => ({ valor, etiqueta })),
            descripcion: 'Nivel de prioridad asignado a la orden.',
          },
          {
            id: 'tipo_contacto', etiqueta: 'Tipo de cliente', tipo: 'multiple-compacto' as const,
            valor: filtroTipoContacto,
            onChange: (v) => setFiltroTipoContacto(Array.isArray(v) ? v : (v ? [v] : [])),
            opciones: opcionesTiposContacto,
            descripcion: 'Órdenes según el tipo del contacto vinculado (persona, empresa, edificio, etc.).',
          },
          // ── Asignación ──
          {
            id: 'asignado_a', etiqueta: 'Asignado a', tipo: 'multiple-compacto' as const,
            valor: filtroAsignados,
            onChange: (v) => setFiltroAsignados(Array.isArray(v) ? v : []),
            opciones: opcionesMiembros,
            descripcion: 'Órdenes asignadas a uno o más miembros (cumple si al menos uno coincide).',
          },
          {
            id: 'sin_asignar', etiqueta: 'Sin asignar', tipo: 'pills' as const,
            valor: filtroSinAsignar ? 'true' : '',
            onChange: (v) => setFiltroSinAsignar(v === 'true'),
            opciones: [{ valor: 'true', etiqueta: 'Sí' }],
            descripcion: 'Órdenes que no tienen ningún miembro asignado todavía.',
          },
          {
            id: 'creado_por', etiqueta: 'Creado por', tipo: 'seleccion-compacto' as const,
            valor: filtroCreadoPor, onChange: (v) => setFiltroCreadoPor(v as string),
            opciones: opcionesMiembros,
            descripcion: 'Mostrá solo las órdenes creadas por el miembro elegido.',
          },
          // ── Comercial ──
          {
            id: 'con_presupuesto', etiqueta: 'Con presupuesto', tipo: 'pills' as const,
            valor: filtroConPresupuesto, onChange: (v) => setFiltroConPresupuesto(v as string),
            opciones: [
              { valor: 'true', etiqueta: 'Sí' },
              { valor: 'false', etiqueta: 'No' },
            ],
            descripcion: 'Órdenes generadas a partir de un presupuesto vs creadas manualmente.',
          },
          {
            id: 'vencida', etiqueta: 'Vencida', tipo: 'pills' as const,
            valor: filtroVencida, onChange: (v) => setFiltroVencida(v as string),
            opciones: [
              { valor: 'true', etiqueta: 'Sí' },
              { valor: 'false', etiqueta: 'No' },
            ],
            descripcion: 'Órdenes con fecha estimada de fin pasada y aún no completadas ni canceladas.',
          },
          {
            id: 'publicada', etiqueta: 'Publicada', tipo: 'pills' as const,
            valor: filtroPublicada, onChange: (v) => setFiltroPublicada(v as string),
            opciones: [
              { valor: 'true', etiqueta: 'Sí' },
              { valor: 'false', etiqueta: 'No (borrador)' },
            ],
            descripcion: 'Órdenes ya publicadas (visibles para los asignados) vs borradores internos.',
          },
          // ── Período ──
          {
            id: 'fecha', etiqueta: 'Fecha programada', tipo: 'pills' as const,
            valor: filtroFecha, onChange: (v) => setFiltroFecha(v as string),
            opciones: [
              { valor: 'hoy', etiqueta: 'Hoy' },
              { valor: 'semana', etiqueta: 'Esta semana' },
              { valor: 'vencidas', etiqueta: 'Vencidas' },
              { valor: 'futuras', etiqueta: 'Futuras' },
            ],
            descripcion: 'Filtrá por proximidad de la fecha de inicio o vencimiento.',
          },
          {
            id: 'anio', etiqueta: 'Año', tipo: 'seleccion-compacto' as const,
            valor: filtroAnio, onChange: (v) => setFiltroAnio(v as string),
            opciones: opcionesAnios,
            descripcion: 'Órdenes creadas durante el año seleccionado.',
          },
        ]}
        gruposFiltros={[
          { id: 'identidad', etiqueta: 'Identidad', filtros: ['estado', 'prioridad', 'tipo_contacto'] },
          { id: 'asignacion', etiqueta: 'Asignación', filtros: ['asignado_a', 'sin_asignar', 'creado_por'] },
          { id: 'comercial', etiqueta: 'Comercial', filtros: ['con_presupuesto', 'vencida', 'publicada'] },
          { id: 'periodo', etiqueta: 'Período', filtros: ['fecha', 'anio'] },
        ]}
        onLimpiarFiltros={() => {
          setFiltroEstado([])
          setFiltroPrioridad([])
          setFiltroTipoContacto([])
          setFiltroAsignados([])
          setFiltroSinAsignar(false)
          setFiltroCreadoPor('')
          setFiltroConPresupuesto('')
          setFiltroVencida('')
          setFiltroPublicada('')
          setFiltroFecha('')
          setFiltroAnio('')
        }}
        opcionesOrden={[
          { etiqueta: 'Más recientes', clave: 'creado_en', direccion: 'desc' },
          { etiqueta: 'Más antiguos', clave: 'creado_en', direccion: 'asc' },
          { etiqueta: 'N° ↑', clave: 'numero', direccion: 'asc' },
          { etiqueta: 'N° ↓', clave: 'numero', direccion: 'desc' },
          { etiqueta: 'Cliente A-Z', clave: 'contacto_nombre', direccion: 'asc' },
          { etiqueta: 'Cliente Z-A', clave: 'contacto_nombre', direccion: 'desc' },
          { etiqueta: 'Próximas a vencer', clave: 'fecha_fin_estimada', direccion: 'asc' },
          { etiqueta: 'Recién iniciadas', clave: 'fecha_inicio', direccion: 'desc' },
        ]}
        accionesLote={[
          {
            id: 'eliminar',
            etiqueta: 'Enviar a papelera',
            icono: <Trash2 size={14} />,
            onClick: enviarAPapeleraLote,
            peligro: true,
          },
        ]}
        onClickFila={(fila) => router.push(`/ordenes/${fila.id}`)}
        estadoVacio={
          <EstadoVacio
            icono={<Hammer size={52} strokeWidth={1} />}
            titulo={t('ordenes.sin_ordenes')}
            descripcion={t('ordenes.sin_ordenes_desc')}
            accion={
              tienePermiso('ordenes_trabajo', 'crear') ? (
                <Boton onClick={() => router.push('/ordenes/nuevo')}>Crear primera orden</Boton>
              ) : undefined
            }
          />
        }
      />
    </PlantillaListado>
  )
}
