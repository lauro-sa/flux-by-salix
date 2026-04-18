'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useQueryClient } from '@tanstack/react-query'
import { useListado } from '@/hooks/useListado'
import { useTraduccion } from '@/lib/i18n'
import { useFormato } from '@/hooks/useFormato'
import { useBusquedaDebounce } from '@/hooks/useBusquedaDebounce'
import { PlantillaListado } from '@/componentes/entidad/PlantillaListado'
import { TablaDinamica } from '@/componentes/tablas/TablaDinamica'
import type { ColumnaDinamica } from '@/componentes/tablas/TablaDinamica'
import {
  PlusCircle, Package, PackageOpen, Wrench,
  Hash, Tag, DollarSign, Star, Ruler, ToggleLeft, Calendar,
  FileText, Barcode, Box,
  Trash2, TrendingUp, History,
} from 'lucide-react'
import { EstadoVacio } from '@/componentes/feedback/EstadoVacio'
import { Boton } from '@/componentes/ui/Boton'
import { Insignia, type ColorInsignia } from '@/componentes/ui/Insignia'
import { COLOR_TIPO_PRODUCTO } from '@/lib/colores_entidad'
import { IndicadorEditado } from '@/componentes/ui/IndicadorEditado'
import { useToast } from '@/componentes/feedback/Toast'
import { ModalProducto } from './ModalProducto'
import type { Producto, TipoProducto, ConfigProductos } from '@/tipos/producto'

/**
 * Contenido interactivo de productos — Client Component.
 * Recibe datosInicialesJson del Server Component para renderizar sin loading.
 * React Query (useListado) maneja cache, filtros, paginación y refetch.
 */

type FilaProducto = Pick<Producto,
  | 'id' | 'codigo' | 'nombre' | 'tipo' | 'categoria' | 'favorito'
  | 'referencia_interna' | 'codigo_barras' | 'precio_unitario' | 'moneda'
  | 'costo' | 'unidad' | 'descripcion' | 'descripcion_venta'
  | 'puede_venderse' | 'puede_comprarse' | 'activo'
  | 'creado_en' | 'actualizado_en' | 'imagen_url'
  | 'creado_por' | 'creado_por_nombre' | 'editado_por' | 'editado_por_nombre'
> & {
  /** Campos calculados por la API (views/generated columns) */
  veces_presupuestado: number
  veces_vendido: number
  origen: string
}

const POR_PAGINA = 50

interface Props {
  datosInicialesJson?: Record<string, unknown>
}

export default function ContenidoProductos({ datosInicialesJson }: Props) {
  const { t } = useTraduccion()
  const router = useRouter()
  const searchParams = useSearchParams()
  const formato = useFormato()
  const queryClient = useQueryClient()
  const { mostrar: mostrarToast } = useToast()

  // ---- Estado ----
  // Filtros server-side
  const [filtroTipo, setFiltroTipo] = useState('')
  const [filtroCategoria, setFiltroCategoria] = useState('')

  // Búsqueda con debounce + reset de página automático
  const { busqueda, setBusqueda, busquedaDebounced, pagina, setPagina } = useBusquedaDebounce('', 1, [filtroTipo, filtroCategoria])

  // Modal
  const [modalAbierto, setModalAbierto] = useState(false)
  const [productoEditar, setProductoEditar] = useState<Producto | null>(null)

  // Abrir modal de creación si viene ?crear=true desde el dashboard
  const vieneDeDashboardRef = useRef(false)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get('crear') === 'true') {
      window.history.replaceState({}, '', '/productos')
      vieneDeDashboardRef.current = true
      setProductoEditar(null)
      setModalAbierto(true)
    }
  }, [])

  // Config
  const [config, setConfig] = useState<ConfigProductos | null>(null)
  const [impuestos, setImpuestos] = useState<{ id: string; label: string; porcentaje: number }[]>([])
  const [categoriasDisponibles, setCategoriasDisponibles] = useState<{ valor: string; etiqueta: string }[]>([])

  // Solo usar datos iniciales cuando no hay filtros activos (primera carga)
  const sinFiltros = !busquedaDebounced && !filtroTipo && !filtroCategoria && pagina === 1

  // ---- useListado reemplaza fetch manual ----
  const { datos: productos, total, cargando, recargar: recargarProductos } = useListado<FilaProducto>({
    clave: 'productos',
    url: '/api/productos',
    parametros: {
      busqueda: busquedaDebounced,
      tipo: filtroTipo || undefined,
      categoria: filtroCategoria || undefined,
      pagina,
      por_pagina: POR_PAGINA,
    },
    extraerDatos: (json) => (json.productos || []) as FilaProducto[],
    extraerTotal: (json) => (json.total || 0) as number,
    datosInicialesJson: sinFiltros ? datosInicialesJson : undefined,
  })

  // ---- Cargar configuracion ----
  const configCargadaRef = useRef(false)
  useEffect(() => {
    if (configCargadaRef.current) return
    configCargadaRef.current = true

    // Config de productos
    fetch('/api/productos/config')
      .then(r => { if (!r.ok) throw new Error(); return r.json() })
      .then(data => {
        setConfig(data)
        const cats = (data.categorias || []) as { id: string; label: string }[]
        setCategoriasDisponibles(cats.map(c => ({ valor: c.id, etiqueta: c.label })))
      })
      .catch(() => mostrarToast('error', 'No se pudo cargar la configuración de productos'))

    // Impuestos (de config presupuestos)
    fetch('/api/presupuestos/config')
      .then(r => { if (!r.ok) throw new Error(); return r.json() })
      .then(data => {
        if (data.impuestos) {
          setImpuestos(data.impuestos.filter((i: { activo: boolean }) => i.activo))
        }
      })
      .catch(() => {})
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ---- Eliminar en lote ----
  const eliminarProductosLote = useCallback(async (ids: Set<string>) => {
    try {
      await Promise.all(
        Array.from(ids).map(id =>
          fetch(`/api/productos/${id}`, { method: 'DELETE' })
        )
      )
      queryClient.invalidateQueries({ queryKey: ['productos'] })
      mostrarToast('exito', `${ids.size} producto${ids.size !== 1 ? 's' : ''} enviado${ids.size !== 1 ? 's' : ''} a papelera`)
    } catch {
      mostrarToast('error', 'Error al eliminar productos')
    }
  }, [queryClient, mostrarToast])

  // ---- Helpers ----
  const formatoMonedaLocal = useCallback((valor: string | null, monedaCodigo?: string | null, mostrarCero = false) => {
    if (!valor && !mostrarCero) return null
    const num = Number(valor || 0)
    if (num === 0 && !mostrarCero) return null
    const codigoFinal = monedaCodigo || formato.codigoMoneda
    return new Intl.NumberFormat(formato.locale, {
      style: 'currency',
      currency: codigoFinal,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(num)
  }, [formato.locale, formato.codigoMoneda])

  // ---- Abrir desde ?producto_id= (recientes del dashboard) ----
  const productoIdParam = searchParams.get('producto_id')
  const yaAbiertoRef = useRef<string | null>(null)
  useEffect(() => {
    if (!productoIdParam || productoIdParam === yaAbiertoRef.current) return
    yaAbiertoRef.current = productoIdParam
    fetch(`/api/productos/${productoIdParam}`)
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data) {
          setProductoEditar(data)
          setModalAbierto(true)
        }
      })
      .catch(() => {})
    router.replace('/productos', { scroll: false })
  }, [productoIdParam, router])

  // ---- Abrir modal para edicion ----
  const abrirEdicion = useCallback(async (fila: FilaProducto) => {
    try {
      const res = await fetch(`/api/productos/${fila.id}`)
      if (!res.ok) return
      const producto = await res.json()
      setProductoEditar(producto)
      setModalAbierto(true)
    } catch {
      // silenciar
    }
  }, [])

  const abrirNuevo = useCallback(() => {
    setProductoEditar(null)
    setModalAbierto(true)
  }, [])

  const manejarGuardado = useCallback(() => {
    recargarProductos()
  }, [recargarProductos])

  // ---- Columnas visibles por defecto ----
  const COLUMNAS_VISIBLES_DEFAULT = ['codigo', 'nombre', 'categoria', 'precio_unitario', 'unidad', 'veces_presupuestado', 'veces_vendido']

  const I = 12
  const columnas: ColumnaDinamica<FilaProducto>[] = [
    /* -- Identidad -- */
    {
      clave: 'codigo', etiqueta: 'Codigo', ancho: 100, ordenable: true, grupo: 'Identidad', icono: <Hash size={I} />,
      render: (fila) => <span className="text-xs font-mono text-texto-terciario">{fila.codigo}</span>,
    },
    {
      clave: 'nombre', etiqueta: 'Nombre', ancho: 280, ordenable: true, grupo: 'Identidad', icono: <Package size={I} />,
      render: (fila) => {
        const color = COLOR_TIPO_PRODUCTO[fila.tipo] || 'neutro'
        return (
          <div className="flex items-center gap-2.5">
            <div className="size-8 rounded-card flex items-center justify-center shrink-0"
              style={{ backgroundColor: `var(--insignia-${color}-fondo)`, color: `var(--insignia-${color}-texto)` }}>
              {fila.tipo === 'servicio' ? <Wrench size={14} /> : <Package size={14} />}
            </div>
            <div className="min-w-0">
              <div className="font-medium text-texto-primario truncate flex items-center gap-1.5">
                {fila.nombre}
                {fila.favorito && <Star size={12} className="text-insignia-advertencia fill-insignia-advertencia shrink-0" />}
              </div>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="inline-flex items-center rounded-full px-1.5 py-px text-xxs font-medium whitespace-nowrap"
                  style={{ backgroundColor: `var(--insignia-${color}-fondo)`, color: `var(--insignia-${color}-texto)` }}>
                  {fila.tipo === 'servicio' ? 'Servicio' : 'Producto'}
                </span>
                {fila.referencia_interna && <span className="text-xs text-texto-terciario font-mono">{fila.referencia_interna}</span>}
                {fila.origen === 'asistente_salix' && (
                  <Insignia color={fila.editado_por ? 'neutro' : 'info'} tamano="sm">
                    {fila.editado_por ? 'IA · editado' : 'IA'}
                  </Insignia>
                )}
              </div>
            </div>
          </div>
        )
      },
    },
    {
      clave: 'tipo', etiqueta: 'Tipo', ancho: 110, ordenable: true, grupo: 'Identidad', icono: <Tag size={I} />,
      render: (fila) => (
        <Insignia color={(COLOR_TIPO_PRODUCTO[fila.tipo] || 'neutro') as ColorInsignia}>
          {fila.tipo === 'servicio' ? 'Servicio' : 'Producto'}
        </Insignia>
      ),
    },
    {
      clave: 'categoria', etiqueta: 'Categoria', ancho: 140, ordenable: true, grupo: 'Identidad', icono: <Tag size={I} />,
      render: (fila) => fila.categoria ? (
        <Insignia color="neutro">
          {categoriasDisponibles.find(c => c.valor === fila.categoria)?.etiqueta || fila.categoria}
        </Insignia>
      ) : null,
    },
    {
      clave: 'referencia_interna', etiqueta: 'Ref. interna', ancho: 120, grupo: 'Identidad', icono: <Barcode size={I} />,
      render: (fila) => fila.referencia_interna ? <span className="text-xs font-mono text-texto-terciario">{fila.referencia_interna}</span> : null,
    },

    /* -- Precios -- */
    {
      clave: 'precio_unitario', etiqueta: 'Precio venta', ancho: 130, ordenable: true, tipo: 'moneda', alineacion: 'right', grupo: 'Precios', icono: <DollarSign size={I} />,
      resumen: 'promedio',
      render: (fila) => {
        const v = formatoMonedaLocal(fila.precio_unitario, fila.moneda, true)
        return v ? <span className="font-mono text-texto-primario">{v}</span> : <span className="text-texto-terciario">—</span>
      },
    },
    {
      clave: 'costo', etiqueta: 'Costo', ancho: 120, ordenable: true, tipo: 'moneda', alineacion: 'right', grupo: 'Precios', icono: <DollarSign size={I} />,
      render: (fila) => {
        const v = formatoMonedaLocal(fila.costo, fila.moneda)
        return v ? <span className="font-mono text-texto-terciario">{v}</span> : <span className="text-texto-terciario">—</span>
      },
    },
    {
      clave: 'margen', etiqueta: 'Margen', ancho: 90, alineacion: 'right', grupo: 'Precios', icono: <DollarSign size={I} />,
      render: (fila) => {
        const p = parseFloat(fila.precio_unitario || '0')
        const c = parseFloat(fila.costo || '0')
        if (p <= 0 || c <= 0) return null
        const m = ((p - c) / p) * 100
        return (
          <span className={`font-mono text-xs font-bold ${m > 0 ? 'text-insignia-exito' : 'text-insignia-peligro'}`}>
            {m.toFixed(1)}%
          </span>
        )
      },
    },
    {
      clave: 'moneda', etiqueta: 'Moneda', ancho: 80, grupo: 'Precios', icono: <DollarSign size={I} />,
      render: (fila) => fila.moneda ? <span className="text-texto-terciario text-xs font-mono">{fila.moneda}</span> : null,
    },

    /* -- Detalles -- */
    {
      clave: 'unidad', etiqueta: 'Unidad', ancho: 100, grupo: 'Detalles', icono: <Ruler size={I} />,
      render: (fila) => <span className="text-texto-secundario text-xs">{fila.unidad}</span>,
    },
    {
      clave: 'descripcion_venta', etiqueta: 'Desc. venta', ancho: 200, grupo: 'Detalles', icono: <FileText size={I} />,
      render: (fila) => fila.descripcion_venta ? <span className="text-texto-terciario text-xs truncate">{fila.descripcion_venta.slice(0, 80)}</span> : null,
    },
    {
      clave: 'codigo_barras', etiqueta: 'Cod. barras', ancho: 130, grupo: 'Detalles', icono: <Barcode size={I} />,
      render: (fila) => fila.codigo_barras ? <span className="text-xs font-mono text-texto-terciario">{fila.codigo_barras}</span> : null,
    },

    /* -- Estado -- */
    {
      clave: 'activo', etiqueta: 'Estado', ancho: 100, grupo: 'Estado', icono: <ToggleLeft size={I} />,
      render: (fila) => (
        <Insignia color={fila.activo ? 'exito' : 'neutro'}>
          {fila.activo ? 'Activo' : 'Inactivo'}
        </Insignia>
      ),
    },
    {
      clave: 'puede_venderse', etiqueta: 'Vendible', ancho: 90, grupo: 'Estado', icono: <Box size={I} />,
      render: (fila) => (
        <Insignia color={fila.puede_venderse ? 'exito' : 'neutro'} tamano="sm">
          {fila.puede_venderse ? 'Si' : 'No'}
        </Insignia>
      ),
    },

    /* -- Uso -- */
    {
      clave: 'veces_presupuestado', etiqueta: 'Presupuestado', ancho: 110, ordenable: true, tipo: 'numero', alineacion: 'center', grupo: 'Uso', icono: <TrendingUp size={I} />,
      render: (fila) => {
        const v = fila.veces_presupuestado || 0
        return v > 0
          ? <span className="text-sm font-mono text-texto-primario">{v}</span>
          : <span className="text-texto-terciario">—</span>
      },
    },
    {
      clave: 'veces_vendido', etiqueta: 'Vendido', ancho: 100, ordenable: true, tipo: 'numero', alineacion: 'center', grupo: 'Uso', icono: <TrendingUp size={I} />,
      render: (fila) => {
        const v = fila.veces_vendido || 0
        return v > 0
          ? <Insignia color="exito">{v}</Insignia>
          : <span className="text-texto-terciario">—</span>
      },
    },

    /* -- Metadata -- */
    {
      clave: 'creado_en', etiqueta: 'Creacion', ancho: 120, ordenable: true, tipo: 'fecha', grupo: 'Metadata', icono: <Calendar size={I} />,
      render: (fila) => <span className="text-texto-terciario text-xs">{formato.fecha(fila.creado_en, { corta: true })}</span>,
    },
    {
      clave: 'editado_por' as keyof FilaProducto, etiqueta: 'Auditoría', ancho: 44, grupo: 'Metadata', icono: <History size={I} />,
      render: (fila) => (fila.editado_por || fila.creado_por) ? (
        <IndicadorEditado
          entidadId={fila.id}
          nombreCreador={fila.creado_por_nombre}
          fechaCreacion={fila.creado_en}
          nombreEditor={fila.editado_por_nombre}
          fechaEdicion={fila.actualizado_en}
          tablaAuditoria="auditoria_productos"
          campoReferencia="producto_id"
        />
      ) : null,
    },
  ]

  // ---- Renderizar tarjeta (compacta) ----
  const renderizarTarjeta = useCallback((fila: FilaProducto) => {
    const color = (COLOR_TIPO_PRODUCTO[fila.tipo] || 'neutro') as ColorInsignia
    const num = Number(fila.precio_unitario || 0)
    const codigoFinal = fila.moneda || formato.codigoMoneda
    const precioStr = new Intl.NumberFormat(formato.locale, {
      style: 'currency', currency: codigoFinal, minimumFractionDigits: 2, maximumFractionDigits: 2,
    }).format(num)

    return (
      <div className="px-2.5 py-2 pr-7 flex flex-col gap-1.5">
        <div className="flex items-center gap-2">
          <div className="size-7 rounded-boton flex items-center justify-center shrink-0"
            style={{ backgroundColor: `var(--insignia-${color}-fondo)`, color: `var(--insignia-${color}-texto)` }}>
            {fila.tipo === 'servicio' ? <Wrench size={13} /> : <Package size={13} />}
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-sm font-medium text-texto-primario truncate flex items-center gap-1">
              {fila.nombre}
              {fila.favorito && <Star size={10} className="text-insignia-advertencia fill-insignia-advertencia shrink-0" />}
            </div>
            <div className="text-[10px] text-texto-terciario font-mono leading-tight">{fila.codigo}</div>
          </div>
        </div>

        <div className="flex items-center justify-between pt-1 border-t border-borde-sutil">
          <span className="font-mono text-xs font-bold text-texto-primario">{precioStr}</span>
          <span className="text-[10px] text-texto-terciario">{fila.unidad}</span>
        </div>
      </div>
    )
  }, [formato.locale, formato.codigoMoneda])

  // ---- Agrupación por categoría ----
  const obtenerGrupoCategoria = useCallback((fila: FilaProducto) => {
    return fila.categoria || '__sin_categoria__'
  }, [])

  const obtenerEtiquetaGrupo = useCallback((clave: string) => {
    if (clave === '__sin_categoria__') return 'Sin categoría'
    return categoriasDisponibles.find(c => c.valor === clave)?.etiqueta || clave
  }, [categoriasDisponibles])

  return (
    <>
      <PlantillaListado
        titulo="Productos y Servicios"
        icono={<Package size={20} />}
        accionPrincipal={{
          etiqueta: 'Nuevo',
          icono: <PlusCircle size={14} />,
          onClick: abrirNuevo,
        }}
        acciones={[]}
        mostrarConfiguracion
        onConfiguracion={() => router.push('/productos/configuracion')}
      >
        <TablaDinamica
          columnas={columnas}
          datos={productos}
          claveFila={(r) => r.id}
          totalRegistros={total}
          registrosPorPagina={POR_PAGINA}
          paginaExterna={pagina}
          onCambiarPagina={setPagina}
          vistas={['lista', 'tarjetas']}
          seleccionables
          accionesLote={[
            {
              id: 'eliminar',
              etiqueta: t('comun.eliminar'),
              icono: <Trash2 size={14} />,
              onClick: eliminarProductosLote,
              peligro: true,
              atajo: 'Supr',
              grupo: 'peligro' as const,
            },
          ]}
          busqueda={busqueda}
          onBusqueda={setBusqueda}
          placeholder="Buscar por nombre, codigo, referencia, categoria..."
          filtros={[
            {
              id: 'tipo', etiqueta: 'Tipo', tipo: 'pills' as const,
              valor: filtroTipo, onChange: (v) => setFiltroTipo(v as string),
              opciones: [
                { valor: 'producto', etiqueta: 'Productos' },
                { valor: 'servicio', etiqueta: 'Servicios' },
              ],
            },
            {
              id: 'categoria', etiqueta: 'Categoria', tipo: 'seleccion' as const,
              valor: filtroCategoria, onChange: (v) => setFiltroCategoria(v as string),
              opciones: categoriasDisponibles,
            },
          ]}
          onLimpiarFiltros={() => { setFiltroTipo(''); setFiltroCategoria('') }}
          idModulo="productos"
          columnasVisiblesDefault={COLUMNAS_VISIBLES_DEFAULT}
          opcionesOrden={[
            { etiqueta: 'Mas recientes', clave: 'creado_en', direccion: 'desc' },
            { etiqueta: 'Mas antiguos', clave: 'creado_en', direccion: 'asc' },
            { etiqueta: 'Nombre A→Z', clave: 'nombre', direccion: 'asc' },
            { etiqueta: 'Nombre Z→A', clave: 'nombre', direccion: 'desc' },
            { etiqueta: 'Precio ↑', clave: 'precio_unitario', direccion: 'asc' },
            { etiqueta: 'Precio ↓', clave: 'precio_unitario', direccion: 'desc' },
            { etiqueta: 'Mas presupuestado', clave: 'veces_presupuestado', direccion: 'desc' },
            { etiqueta: 'Mas vendido', clave: 'veces_vendido', direccion: 'desc' },
          ]}
          onClickFila={(fila) => abrirEdicion(fila)}
          renderTarjeta={renderizarTarjeta}
          grupoTarjetas={obtenerGrupoCategoria}
          etiquetaGrupoTarjetas={obtenerEtiquetaGrupo}
          mostrarResumen
          estadoVacio={
            <EstadoVacio
              icono={<PackageOpen size={52} strokeWidth={1} />}
              titulo="Las estanterias estan vacias"
              descripcion="Carga tu primer producto o servicio. Sin productos no hay presupuestos."
              accion={
                <Boton onClick={abrirNuevo}>
                  <PlusCircle size={14} className="mr-1.5" />
                  Cargar primer producto
                </Boton>
              }
            />
          }
        />
      </PlantillaListado>

      {/* Modal de creacion/edicion */}
      <ModalProducto
        abierto={modalAbierto}
        onCerrar={() => {
          setModalAbierto(false); setProductoEditar(null)
          if (vieneDeDashboardRef.current) { vieneDeDashboardRef.current = false; router.push('/dashboard') }
        }}
        onGuardado={manejarGuardado}
        producto={productoEditar}
        config={config}
        impuestos={impuestos}
      />
    </>
  )
}
