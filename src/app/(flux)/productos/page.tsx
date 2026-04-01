'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useTraduccion } from '@/lib/i18n'
import { PlantillaListado } from '@/componentes/entidad/PlantillaListado'
import { TablaDinamica } from '@/componentes/tablas/TablaDinamica'
import type { ColumnaDinamica } from '@/componentes/tablas/TablaDinamica'
import {
  PlusCircle, Download, Upload, Package, PackageOpen, Wrench,
  Hash, Tag, DollarSign, Star, Ruler, ToggleLeft, Calendar,
  FileText, StickyNote, Barcode, Box,
  Trash2, TrendingUp,
} from 'lucide-react'
import { EstadoVacio } from '@/componentes/feedback/EstadoVacio'
import { Boton } from '@/componentes/ui/Boton'
import { Insignia, type ColorInsignia } from '@/componentes/ui/Insignia'
import { COLOR_TIPO_PRODUCTO } from '@/lib/colores_entidad'
import { ModalProducto } from './_componentes/ModalProducto'
import type { Producto, TipoProducto, ConfigProductos } from '@/tipos/producto'

/**
 * Página principal de Productos y Servicios.
 * Tabla dinámica con búsqueda full-text, filtros server-side,
 * selección múltiple, acciones en lote, y modal de creación/edición.
 */

interface FilaProducto {
  id: string
  codigo: string
  nombre: string
  tipo: TipoProducto
  categoria: string | null
  favorito: boolean
  referencia_interna: string | null
  codigo_barras: string | null
  precio_unitario: string | null
  moneda: string | null
  costo: string | null
  unidad: string
  descripcion: string | null
  descripcion_venta: string | null
  puede_venderse: boolean
  puede_comprarse: boolean
  activo: boolean
  creado_en: string
  actualizado_en: string
  imagen_url: string | null
  veces_presupuestado: number
  veces_vendido: number
  origen: string
  editado_por: string | null
}

const POR_PAGINA = 50

export default function PaginaProductos() {
  const { t } = useTraduccion()
  const router = useRouter()

  // ─── Estado ───
  const [busqueda, setBusqueda] = useState('')
  const [productos, setProductos] = useState<FilaProducto[]>([])
  const [cargando, setCargando] = useState(true)
  const [total, setTotal] = useState(0)
  const [pagina, setPagina] = useState(1)

  // Filtros server-side
  const [filtroTipo, setFiltroTipo] = useState('')
  const [filtroCategoria, setFiltroCategoria] = useState('')
  const filtrosRef = useRef({ tipo: '', categoria: '' })
  filtrosRef.current = { tipo: filtroTipo, categoria: filtroCategoria }

  // Ref para búsqueda estable
  const busquedaRef = useRef(busqueda)
  busquedaRef.current = busqueda

  const fetchIdRef = useRef(0)

  // Modal
  const [modalAbierto, setModalAbierto] = useState(false)
  const [productoEditar, setProductoEditar] = useState<Producto | null>(null)

  // Config
  const [config, setConfig] = useState<ConfigProductos | null>(null)
  const [impuestos, setImpuestos] = useState<{ id: string; label: string; porcentaje: number }[]>([])
  const [categoriasDisponibles, setCategoriasDisponibles] = useState<{ valor: string; etiqueta: string }[]>([])

  // ─── Cargar configuración ───
  const configCargadaRef = useRef(false)
  useEffect(() => {
    if (configCargadaRef.current) return
    configCargadaRef.current = true

    // Config de productos
    fetch('/api/productos/config')
      .then(r => r.json())
      .then(data => {
        setConfig(data)
        const cats = (data.categorias || []) as { id: string; label: string }[]
        setCategoriasDisponibles(cats.map(c => ({ valor: c.id, etiqueta: c.label })))
      })
      .catch(() => {})

    // Impuestos (de config presupuestos)
    fetch('/api/presupuestos/config')
      .then(r => r.json())
      .then(data => {
        if (data.impuestos) {
          setImpuestos(data.impuestos.filter((i: { activo: boolean }) => i.activo))
        }
      })
      .catch(() => {})
  }, [])

  // ─── Fetch productos ───
  const fetchProductos = useCallback(async (p: number) => {
    const id = ++fetchIdRef.current
    setCargando(true)
    try {
      const params = new URLSearchParams()
      const b = busquedaRef.current
      if (b) params.set('busqueda', b)
      if (filtrosRef.current.tipo) params.set('tipo', filtrosRef.current.tipo)
      if (filtrosRef.current.categoria) params.set('categoria', filtrosRef.current.categoria)
      params.set('pagina', String(p))
      params.set('por_pagina', String(POR_PAGINA))

      const res = await fetch(`/api/productos?${params}`)
      const data = await res.json()

      if (data.productos && fetchIdRef.current === id) {
        setProductos(data.productos)
        setTotal(data.total)
      }
    } catch {
      // silenciar
    } finally {
      if (fetchIdRef.current === id) setCargando(false)
    }
  }, [])

  // ─── Eliminar en lote ───
  const eliminarProductosLote = useCallback(async (ids: Set<string>) => {
    try {
      await Promise.all(
        Array.from(ids).map(id =>
          fetch(`/api/productos/${id}`, { method: 'DELETE' })
        )
      )
      setProductos(prev => prev.filter(p => !ids.has(p.id)))
      setTotal(prev => prev - ids.size)
    } catch (err) {
      console.error('Error al eliminar productos:', err)
    }
  }, [])

  // ─── Efectos de carga ───
  const cargaInicialRef = useRef(false)
  useEffect(() => {
    if (cargaInicialRef.current) return
    cargaInicialRef.current = true
    fetchProductos(1)
  }, [fetchProductos])

  useEffect(() => {
    if (!cargaInicialRef.current) return
    fetchProductos(pagina)
  }, [pagina, fetchProductos])

  // Re-fetch al cambiar filtros
  const montadoRef = useRef(false)
  useEffect(() => {
    if (!montadoRef.current) return
    if (pagina === 1) fetchProductos(1)
    else setPagina(1)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtroTipo, filtroCategoria])

  // Debounce búsqueda
  useEffect(() => {
    if (!montadoRef.current) { montadoRef.current = true; return }
    const timeout = setTimeout(() => {
      if (pagina === 1) fetchProductos(1)
      else setPagina(1)
    }, 300)
    return () => clearTimeout(timeout)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [busqueda])

  // ─── Helpers ───
  const SIMBOLO_MONEDA: Record<string, string> = {
    ARS: '$', USD: 'US$', EUR: '€', BRL: 'R$', CLP: 'CL$', COP: 'COL$', MXN: 'MX$', UYU: '$U', PEN: 'S/',
  }

  const formatoMoneda = (valor: string | null, monedaCodigo?: string | null, mostrarCero = false) => {
    if (!valor && !mostrarCero) return null
    const num = Number(valor || 0)
    if (num === 0 && !mostrarCero) return null
    const simbolo = monedaCodigo ? (SIMBOLO_MONEDA[monedaCodigo] || monedaCodigo) : '$'
    return `${simbolo} ${num.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  }
  const formatoFecha = (iso: string) => new Date(iso).toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: 'numeric' })

  // ─── Abrir modal para edición ───
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
    fetchProductos(pagina)
  }, [fetchProductos, pagina])

  // ─── Columnas visibles por defecto ───
  const COLUMNAS_VISIBLES_DEFAULT = ['codigo', 'nombre', 'categoria', 'precio_unitario', 'unidad', 'veces_presupuestado', 'veces_vendido']

  const I = 12
  const columnas: ColumnaDinamica<FilaProducto>[] = [
    /* ── Identidad ── */
    {
      clave: 'codigo', etiqueta: 'Código', ancho: 100, ordenable: true, grupo: 'Identidad', icono: <Hash size={I} />,
      render: (fila) => <span className="text-xs font-mono text-texto-terciario">{fila.codigo}</span>,
    },
    {
      clave: 'nombre', etiqueta: 'Nombre', ancho: 280, ordenable: true, grupo: 'Identidad', icono: <Package size={I} />,
      render: (fila) => {
        const color = COLOR_TIPO_PRODUCTO[fila.tipo] || 'neutro'
        return (
          <div className="flex items-center gap-2.5">
            <div className="size-8 rounded-lg flex items-center justify-center shrink-0"
              style={{ backgroundColor: `var(--insignia-${color}-fondo)`, color: `var(--insignia-${color}-texto)` }}>
              {fila.tipo === 'servicio' ? <Wrench size={14} /> : <Package size={14} />}
            </div>
            <div className="min-w-0">
              <div className="font-medium text-texto-primario truncate flex items-center gap-1.5">
                {fila.nombre}
                {fila.favorito && <Star size={12} className="text-yellow-500 fill-yellow-500 shrink-0" />}
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
      clave: 'categoria', etiqueta: 'Categoría', ancho: 140, ordenable: true, grupo: 'Identidad', icono: <Tag size={I} />,
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

    /* ── Precios ── */
    {
      clave: 'precio_unitario', etiqueta: 'Precio venta', ancho: 130, ordenable: true, tipo: 'moneda', alineacion: 'right', grupo: 'Precios', icono: <DollarSign size={I} />,
      resumen: 'promedio',
      render: (fila) => {
        const v = formatoMoneda(fila.precio_unitario, fila.moneda, true)
        return v ? <span className="font-mono text-texto-primario">{v}</span> : <span className="text-texto-terciario">—</span>
      },
    },
    {
      clave: 'costo', etiqueta: 'Costo', ancho: 120, ordenable: true, tipo: 'moneda', alineacion: 'right', grupo: 'Precios', icono: <DollarSign size={I} />,
      render: (fila) => {
        const v = formatoMoneda(fila.costo, fila.moneda)
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
          <span className={`font-mono text-xs font-bold ${m > 0 ? 'text-green-600' : 'text-red-500'}`}>
            {m.toFixed(1)}%
          </span>
        )
      },
    },
    {
      clave: 'moneda', etiqueta: 'Moneda', ancho: 80, grupo: 'Precios', icono: <DollarSign size={I} />,
      render: (fila) => fila.moneda ? <span className="text-texto-terciario text-xs font-mono">{fila.moneda}</span> : null,
    },

    /* ── Detalles ── */
    {
      clave: 'unidad', etiqueta: 'Unidad', ancho: 100, grupo: 'Detalles', icono: <Ruler size={I} />,
      render: (fila) => <span className="text-texto-secundario text-xs">{fila.unidad}</span>,
    },
    {
      clave: 'descripcion_venta', etiqueta: 'Desc. venta', ancho: 200, grupo: 'Detalles', icono: <FileText size={I} />,
      render: (fila) => fila.descripcion_venta ? <span className="text-texto-terciario text-xs truncate">{fila.descripcion_venta.slice(0, 80)}</span> : null,
    },
    {
      clave: 'codigo_barras', etiqueta: 'Cód. barras', ancho: 130, grupo: 'Detalles', icono: <Barcode size={I} />,
      render: (fila) => fila.codigo_barras ? <span className="text-xs font-mono text-texto-terciario">{fila.codigo_barras}</span> : null,
    },

    /* ── Estado ── */
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
          {fila.puede_venderse ? 'Sí' : 'No'}
        </Insignia>
      ),
    },

    /* ── Uso ── */
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

    /* ── Metadata ── */
    {
      clave: 'creado_en', etiqueta: 'Creación', ancho: 120, ordenable: true, tipo: 'fecha', grupo: 'Metadata', icono: <Calendar size={I} />,
      render: (fila) => <span className="text-texto-terciario text-xs">{formatoFecha(fila.creado_en)}</span>,
    },
  ]

  // ─── Renderizar tarjeta ───
  const renderizarTarjeta = (fila: FilaProducto) => {
    const color = (COLOR_TIPO_PRODUCTO[fila.tipo] || 'neutro') as ColorInsignia
    const precioStr = formatoMoneda(fila.precio_unitario, fila.moneda, true)

    return (
      <div className="p-4 flex flex-col gap-3">
        <div className="flex items-center gap-2.5">
          <div className="size-10 rounded-lg flex items-center justify-center shrink-0"
            style={{ backgroundColor: `var(--insignia-${color}-fondo)`, color: `var(--insignia-${color}-texto)` }}>
            {fila.tipo === 'servicio' ? <Wrench size={18} /> : <Package size={18} />}
          </div>
          <div className="min-w-0 flex-1">
            <div className="font-medium text-texto-primario truncate flex items-center gap-1.5">
              {fila.nombre}
              {fila.favorito && <Star size={12} className="text-yellow-500 fill-yellow-500 shrink-0" />}
            </div>
            <div className="text-xs text-texto-terciario font-mono">{fila.codigo}</div>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Insignia color={color} tamano="sm">{fila.tipo === 'servicio' ? 'Servicio' : 'Producto'}</Insignia>
          {fila.categoria && (
            <Insignia color="neutro" tamano="sm">
              {categoriasDisponibles.find(c => c.valor === fila.categoria)?.etiqueta || fila.categoria}
            </Insignia>
          )}
        </div>

        <div className="border-t border-borde-sutil pt-2.5 flex justify-between items-center">
          <span className="font-mono font-bold text-texto-primario">{precioStr}</span>
          <span className="text-xs text-texto-terciario">{fila.unidad}</span>
        </div>
      </div>
    )
  }

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
        acciones={[
          { id: 'importar', etiqueta: t('comun.importar'), icono: <Upload size={14} />, onClick: () => {} },
          { id: 'exportar', etiqueta: t('comun.exportar'), icono: <Download size={14} />, onClick: () => {} },
        ]}
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
            },
          ]}
          busqueda={busqueda}
          onBusqueda={setBusqueda}
          placeholder="Buscar por nombre, código, referencia, categoría..."
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
              id: 'categoria', etiqueta: 'Categoría', tipo: 'seleccion' as const,
              valor: filtroCategoria, onChange: (v) => setFiltroCategoria(v as string),
              opciones: categoriasDisponibles,
            },
          ]}
          onLimpiarFiltros={() => { setFiltroTipo(''); setFiltroCategoria('') }}
          idModulo="productos"
          columnasVisiblesDefault={COLUMNAS_VISIBLES_DEFAULT}
          opcionesOrden={[
            { etiqueta: 'Más recientes', clave: 'creado_en', direccion: 'desc' },
            { etiqueta: 'Más antiguos', clave: 'creado_en', direccion: 'asc' },
            { etiqueta: 'Nombre A→Z', clave: 'nombre', direccion: 'asc' },
            { etiqueta: 'Nombre Z→A', clave: 'nombre', direccion: 'desc' },
            { etiqueta: 'Precio ↑', clave: 'precio_unitario', direccion: 'asc' },
            { etiqueta: 'Precio ↓', clave: 'precio_unitario', direccion: 'desc' },
            { etiqueta: 'Más presupuestado', clave: 'veces_presupuestado', direccion: 'desc' },
            { etiqueta: 'Más vendido', clave: 'veces_vendido', direccion: 'desc' },
          ]}
          onClickFila={(fila) => abrirEdicion(fila)}
          renderTarjeta={renderizarTarjeta}
          mostrarResumen
          estadoVacio={
            <EstadoVacio
              icono={<PackageOpen size={52} strokeWidth={1} />}
              titulo="Las estanterías están vacías"
              descripcion="Cargá tu primer producto o servicio. Sin productos no hay presupuestos."
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

      {/* Modal de creación/edición */}
      <ModalProducto
        abierto={modalAbierto}
        onCerrar={() => { setModalAbierto(false); setProductoEditar(null) }}
        onGuardado={manejarGuardado}
        producto={productoEditar}
        config={config}
        impuestos={impuestos}
      />
    </>
  )
}
