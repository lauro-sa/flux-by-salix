'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { useQueryClient, useQuery } from '@tanstack/react-query'
import { useNavegacion } from '@/hooks/useNavegacion'
import { useListado } from '@/hooks/useListado'
import { useRol } from '@/hooks/useRol'
import { useFormato } from '@/hooks/useFormato'
import { useBusquedaDebounce } from '@/hooks/useBusquedaDebounce'
import { GuardPagina } from '@/componentes/entidad/GuardPagina'
import { useTraduccion } from '@/lib/i18n'
import { PlantillaListado } from '@/componentes/entidad/PlantillaListado'
import { TablaDinamica } from '@/componentes/tablas/TablaDinamica'
import type { ColumnaDinamica } from '@/componentes/tablas/TablaDinamica'
import {
  Plus, FileText, User, Hash, Calendar, DollarSign, Tag,
  Clock, CircleDot, FilePen, Trash2, X, FileDown, RefreshCw, History, CreditCard, Check,
} from 'lucide-react'
import { EstadoVacio } from '@/componentes/feedback/EstadoVacio'
import { useToast } from '@/componentes/feedback/Toast'
import { Boton } from '@/componentes/ui/Boton'
import { Insignia } from '@/componentes/ui/Insignia'
import { COLOR_ESTADO_DOCUMENTO } from '@/lib/colores_entidad'
import { IndicadorEditado } from '@/componentes/ui/IndicadorEditado'
import { ETIQUETAS_ESTADO, type EstadoPresupuesto } from '@/tipos/presupuesto'

/**
 * Contenido interactivo de presupuestos — Client Component.
 * Recibe datosInicialesJson del Server Component para renderizar sin loading.
 * React Query toma el control para filtros, paginación y refetch.
 */

interface FilaPresupuesto {
  id: string
  numero: string
  estado: EstadoPresupuesto
  referencia: string | null
  contacto_id: string | null
  contacto_nombre: string | null
  contacto_apellido: string | null
  contacto_tipo: string | null
  contacto_correo: string | null
  contacto_telefono: string | null
  contacto_identificacion: string | null
  contacto_condicion_iva: string | null
  contacto_direccion: string | null
  atencion_contacto_id: string | null
  atencion_nombre: string | null
  atencion_correo: string | null
  atencion_cargo: string | null
  moneda: string
  condicion_pago_label: string | null
  fecha_emision: string
  fecha_vencimiento: string | null
  dias_vencimiento: number
  estado_cambiado_en: string
  subtotal_neto: string
  total_impuestos: string
  descuento_global: string
  total_final: string
  origen_documento_numero: string | null
  creado_por: string
  creado_por_nombre: string | null
  creado_en: string
  editado_por: string | null
  editado_por_nombre: string | null
  actualizado_en: string
  notas_html: string | null
  /** Resumen de pagos para la columna "Pagos" del listado. */
  resumen_pagos?: {
    /** Estados de las cuotas en orden (vacío si presupuesto sin cuotas). */
    cuotas: string[]
    /** Cantidad de pagos no-adicionales cargados. */
    cantidad_pagos: number
    /** Total cobrado en moneda del presupuesto (no incluye adicionales). */
    total_cobrado: number
  }
}

const POR_PAGINA = 50

interface Props {
  datosInicialesJson?: Record<string, unknown>
}

export default function ContenidoPresupuestos({ datosInicialesJson }: Props) {
  return (
    <GuardPagina modulo="presupuestos">
      <ContenidoPresupuestosInterno datosInicialesJson={datosInicialesJson} />
    </GuardPagina>
  )
}

function ContenidoPresupuestosInterno({ datosInicialesJson }: Props) {
  const { t } = useTraduccion()
  const { tienePermiso } = useRol()
  const formato = useFormato()
  const router = useRouter()
  const searchParams = useSearchParams()
  const queryClient = useQueryClient()
  const contactoIdFiltro = searchParams.get('contacto_id')
  const origenUrl = searchParams.get('origen')

  // Filtros server-side — restaurar desde URL
  const [filtroEstado, setFiltroEstado] = useState<string[]>(() => {
    const v = searchParams.get('estado')
    return v ? v.split(',') : []
  })
  const [filtroTipoContacto, setFiltroTipoContacto] = useState<string[]>(() => {
    const v = searchParams.get('tipo_contacto')
    return v ? v.split(',') : []
  })
  const [filtroEnOrdenVenta, setFiltroEnOrdenVenta] = useState(searchParams.get('en_orden_venta') || '')
  const [filtroVencido, setFiltroVencido] = useState(searchParams.get('vencido') || '')
  const [filtroConDescuento, setFiltroConDescuento] = useState(searchParams.get('con_descuento') || '')
  const [filtroConObservaciones, setFiltroConObservaciones] = useState(searchParams.get('con_observaciones') || '')
  const [filtroMontoRango, setFiltroMontoRango] = useState(searchParams.get('monto_rango') || '')
  const [filtroAnio, setFiltroAnio] = useState(searchParams.get('anio') || '')
  const [filtroCreadoPor, setFiltroCreadoPor] = useState(searchParams.get('creado_por') || '')

  // Mapeo del preset de monto a min/max
  const { montoMin, montoMax } = (() => {
    switch (filtroMontoRango) {
      case 'low': return { montoMin: undefined, montoMax: '10000' }
      case 'mid': return { montoMin: '10000', montoMax: '100000' }
      case 'high': return { montoMin: '100000', montoMax: '1000000' }
      case 'top': return { montoMin: '1000000', montoMax: undefined }
      default: return { montoMin: undefined, montoMax: undefined }
    }
  })()

  // Búsqueda con debounce + reset de página automático
  const { busqueda, setBusqueda, busquedaDebounced, pagina, setPagina } = useBusquedaDebounce(
    searchParams.get('q') || '',
    Number(searchParams.get('pagina')) || 1,
    [
      filtroEstado, filtroTipoContacto, filtroEnOrdenVenta, filtroVencido,
      filtroConDescuento, filtroConObservaciones, filtroMontoRango,
      filtroAnio, filtroCreadoPor,
    ],
    true,
  )

  const [nombreFiltro, setNombreFiltro] = useState<string | null>(null)

  const pathname = usePathname()
  const { setMigajaDinamica } = useNavegacion()

  // Sincronizar filtros activos → URL (sin recargar, solo reemplaza)
  useEffect(() => {
    const params = new URLSearchParams()
    if (busquedaDebounced) params.set('q', busquedaDebounced)
    if (filtroEstado.length > 0) params.set('estado', filtroEstado.join(','))
    if (filtroTipoContacto.length > 0) params.set('tipo_contacto', filtroTipoContacto.join(','))
    if (filtroEnOrdenVenta) params.set('en_orden_venta', filtroEnOrdenVenta)
    if (filtroVencido) params.set('vencido', filtroVencido)
    if (filtroConDescuento) params.set('con_descuento', filtroConDescuento)
    if (filtroConObservaciones) params.set('con_observaciones', filtroConObservaciones)
    if (filtroMontoRango) params.set('monto_rango', filtroMontoRango)
    if (filtroAnio) params.set('anio', filtroAnio)
    if (filtroCreadoPor) params.set('creado_por', filtroCreadoPor)
    if (pagina > 1) params.set('pagina', String(pagina))
    if (contactoIdFiltro) params.set('contacto_id', contactoIdFiltro)
    if (origenUrl) params.set('origen', origenUrl)
    const qs = params.toString()
    const nuevaUrl = qs ? `${pathname}?${qs}` : pathname
    window.history.replaceState(null, '', nuevaUrl)
  }, [
    busquedaDebounced, filtroEstado, filtroTipoContacto, filtroEnOrdenVenta, filtroVencido,
    filtroConDescuento, filtroConObservaciones, filtroMontoRango, filtroAnio, filtroCreadoPor,
    pagina, contactoIdFiltro, origenUrl, pathname,
  ])

  // Solo usar datos iniciales cuando NO hay filtros activos
  const sinFiltros =
    !busquedaDebounced &&
    filtroEstado.length === 0 &&
    filtroTipoContacto.length === 0 &&
    !filtroEnOrdenVenta &&
    !filtroVencido &&
    !filtroConDescuento &&
    !filtroConObservaciones &&
    !filtroMontoRango &&
    !filtroAnio &&
    !filtroCreadoPor &&
    !contactoIdFiltro &&
    pagina === 1

  const { datos: presupuestos, total, cargando, cargandoInicial, recargar } = useListado<FilaPresupuesto>({
    clave: 'presupuestos',
    url: '/api/presupuestos',
    parametros: {
      busqueda: busquedaDebounced,
      contacto_id: contactoIdFiltro || undefined,
      estado: filtroEstado.length > 0 ? filtroEstado.join(',') : undefined,
      tipo_contacto: filtroTipoContacto.length > 0 ? filtroTipoContacto.join(',') : undefined,
      en_orden_venta: filtroEnOrdenVenta || undefined,
      vencido: filtroVencido || undefined,
      con_descuento: filtroConDescuento || undefined,
      con_observaciones: filtroConObservaciones || undefined,
      monto_min: montoMin,
      monto_max: montoMax,
      anio: filtroAnio || undefined,
      creado_por: filtroCreadoPor || undefined,
      pagina,
      por_pagina: POR_PAGINA,
    },
    extraerDatos: (json) => (json.presupuestos || []) as FilaPresupuesto[],
    extraerTotal: (json) => (json.total || 0) as number,
    datosInicialesJson: sinFiltros ? datosInicialesJson : undefined,
  })

  // Resolver nombre del contacto filtrado + migaja
  useEffect(() => {
    if (!contactoIdFiltro) { setNombreFiltro(null); return }
    fetch(`/api/contactos/${contactoIdFiltro}`)
      .then(r => r.json())
      .then(d => {
        const nombre = d.nombre ? `${d.nombre}${d.apellido ? ` ${d.apellido}` : ''}` : null
        setNombreFiltro(nombre)
        if (nombre && origenUrl) {
          setMigajaDinamica(origenUrl, nombre)
        }
      })
      .catch(() => {})
  }, [contactoIdFiltro, origenUrl, setMigajaDinamica])

  const { mostrar: mostrarToast } = useToast()

  // ── Cargar opciones para los filtros (cache largo) ──

  /** Tipos de contacto de la empresa para el filtro "Tipo de contacto" */
  const { data: tiposContactoData } = useQuery({
    queryKey: ['presupuestos-filtros-tipos-contacto'],
    queryFn: () => fetch('/api/contactos/tipos').then(r => r.json()),
    staleTime: 5 * 60_000,
  })
  const opcionesTiposContacto = useMemo(() => {
    const items = (tiposContactoData?.tipos_contacto || []) as { clave: string; etiqueta: string }[]
    return items.map(t => ({ valor: t.clave, etiqueta: t.etiqueta }))
  }, [tiposContactoData])

  /** Miembros para el filtro "Creado por" */
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

  /** Años disponibles — los últimos 5 años + el actual */
  const opcionesAnios = useMemo(() => {
    const actual = new Date().getFullYear()
    const anios: { valor: string; etiqueta: string }[] = []
    for (let i = 0; i <= 5; i++) {
      const a = actual - i
      anios.push({ valor: String(a), etiqueta: String(a) })
    }
    return anios
  }, [])

  // Enviar a papelera en lote
  const enviarAPapeleraLote = useCallback(async (ids: Set<string>) => {
    try {
      await Promise.all(
        Array.from(ids).map(id =>
          fetch(`/api/presupuestos/${id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ en_papelera: true }),
          })
        )
      )
      queryClient.invalidateQueries({ queryKey: ['presupuestos'] })
      mostrarToast('exito', `${ids.size} presupuesto${ids.size !== 1 ? 's' : ''} enviado${ids.size !== 1 ? 's' : ''} a papelera`)
    } catch (err) {
      console.error('Error al enviar a papelera:', err)
      mostrarToast('error', 'Error al enviar a papelera')
    }
  }, [mostrarToast, queryClient])

  // Cambiar estado en lote
  const cambiarEstadoLote = useCallback(async (ids: Set<string>) => {
    const estado = window.prompt('Nuevo estado (borrador, enviado, aceptado, rechazado, vencido):')
    if (!estado?.trim()) return
    const estadosValidos = ['borrador', 'enviado', 'aceptado', 'rechazado', 'vencido']
    if (!estadosValidos.includes(estado.trim())) {
      mostrarToast('error', `Estado inválido. Opciones: ${estadosValidos.join(', ')}`)
      return
    }
    try {
      await Promise.all(
        Array.from(ids).map(id =>
          fetch(`/api/presupuestos/${id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ estado: estado.trim() }),
          })
        )
      )
      queryClient.invalidateQueries({ queryKey: ['presupuestos'] })
      mostrarToast('exito', `Estado cambiado a "${estado.trim()}" en ${ids.size} presupuesto${ids.size !== 1 ? 's' : ''}`)
    } catch {
      mostrarToast('error', 'Error al cambiar estado')
    }
  }, [mostrarToast, queryClient])

  // Exportar presupuestos seleccionados a CSV
  const exportarPresupuestosCSV = useCallback(async (ids: Set<string>) => {
    const seleccion = presupuestos.filter(p => ids.has(p.id))
    const cabeceras = [
      t('documentos.numero'), t('documentos.estado'), t('documentos.cliente'),
      t('comun.referencia'), t('documentos.moneda'), t('documentos.total'),
      t('documentos.fecha_emision'), t('documentos.fecha_vencimiento'),
    ]
    const filas = seleccion.map(p => [
      p.numero,
      ETIQUETAS_ESTADO[p.estado] || p.estado,
      p.contacto_nombre ? `${p.contacto_nombre}${p.contacto_apellido ? ` ${p.contacto_apellido}` : ''}` : '',
      p.referencia || '',
      p.moneda,
      p.total_final,
      p.fecha_emision,
      p.fecha_vencimiento || '',
    ])
    const csv = [cabeceras, ...filas].map(f => f.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n')
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `presupuestos_${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
    mostrarToast('exito', `${ids.size} presupuesto${ids.size !== 1 ? 's' : ''} exportado${ids.size !== 1 ? 's' : ''}`)
  }, [presupuestos, mostrarToast])

  // Helpers de formato
  const formatoIdentificacion = (num: string) => {
    const limpio = num.replace(/\D/g, '')
    if (limpio.length === 11) {
      return { tipo: 'CUIT', formateado: `${limpio.slice(0, 2)}-${limpio.slice(2, 10)}-${limpio.slice(10)}` }
    }
    if (limpio.length >= 7 && limpio.length <= 8) {
      return { tipo: 'DNI', formateado: formato.numero(Number(limpio)) }
    }
    return { tipo: '', formateado: num }
  }
  const formatoFecha = (iso: string) => {
    const fecha = new Date(iso)
    const esEsteAno = fecha.getFullYear() === new Date().getFullYear()
    if (esEsteAno) return formato.fecha(fecha, { corta: true })
    return formato.fecha(fecha)
  }
  const formatoMonedaDoc = (valor: string, monedaDoc: string) => {
    const num = parseFloat(valor || '0')
    return new Intl.NumberFormat(formato.locale, {
      style: 'currency',
      currency: monedaDoc || formato.codigoMoneda,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(num)
  }

  const COLUMNAS_VISIBLES_DEFAULT = ['numero', 'estado', 'contacto', 'contacto_identificacion', 'total_final', 'pagos', 'fecha_emision', 'fecha_vencimiento']

  const I = 12
  const columnas: ColumnaDinamica<FilaPresupuesto>[] = [

    /* ── Identidad ── */
    {
      clave: 'numero', etiqueta: t('documentos.numero'), ancho: 120, ordenable: true, grupo: 'Identidad', icono: <Hash size={I} />,
      render: (fila) => (
        <span className="font-mono text-sm text-texto-primario font-medium">{fila.numero}</span>
      ),
    },
    {
      clave: 'estado', etiqueta: t('documentos.estado'), ancho: 130, ordenable: true, grupo: 'Identidad', icono: <CircleDot size={I} />,
      opcionesFiltro: Object.entries(ETIQUETAS_ESTADO).map(([valor, etiqueta]) => ({ valor, etiqueta })),
      render: (fila) => (
        <Insignia color={COLOR_ESTADO_DOCUMENTO[fila.estado] || 'neutro'}>
          {ETIQUETAS_ESTADO[fila.estado] || fila.estado}
        </Insignia>
      ),
    },
    {
      clave: 'referencia', etiqueta: t('comun.referencia'), ancho: 150, ordenable: true, grupo: 'Identidad', icono: <Tag size={I} />,
      render: (fila) => fila.referencia
        ? <span className="text-sm text-texto-secundario">{fila.referencia}</span>
        : null,
    },

    /* ── Cliente ── */
    {
      clave: 'contacto', etiqueta: t('documentos.cliente'), ancho: 220, grupo: t('documentos.cliente'), icono: <User size={I} />,
      render: (fila) => {
        if (!fila.contacto_nombre) return <span className="text-texto-terciario text-xs">Sin asignar</span>
        const nombre = `${fila.contacto_nombre}${fila.contacto_apellido ? ` ${fila.contacto_apellido}` : ''}`
        return (
          <div className="min-w-0">
            <div className="text-sm text-texto-primario truncate">{nombre}</div>
            {fila.atencion_nombre && <div className="text-xs text-texto-terciario truncate">At. {fila.atencion_nombre}</div>}
          </div>
        )
      },
    },
    {
      clave: 'contacto_correo', etiqueta: t('documentos.email_cliente'), ancho: 200, grupo: t('documentos.cliente'), icono: <User size={I} />,
      render: (fila) => fila.contacto_correo
        ? <span className="text-xs text-texto-secundario truncate">{fila.contacto_correo}</span>
        : null,
    },
    {
      clave: 'contacto_telefono', etiqueta: t('documentos.telefono_cliente'), ancho: 140, grupo: t('documentos.cliente'), icono: <User size={I} />,
      render: (fila) => fila.contacto_telefono
        ? <span className="text-xs text-texto-secundario">{fila.contacto_telefono}</span>
        : null,
    },
    {
      clave: 'contacto_identificacion', etiqueta: t('documentos.cuit_dni'), ancho: 160, grupo: t('documentos.cliente'), icono: <Hash size={I} />,
      render: (fila) => {
        if (!fila.contacto_identificacion) return null
        const { tipo } = formatoIdentificacion(fila.contacto_identificacion)
        return (
          <div className="min-w-0">
            <div className="font-mono text-xs text-texto-secundario">{fila.contacto_identificacion}</div>
            {tipo && <div className="text-xxs text-texto-terciario">{tipo}</div>}
          </div>
        )
      },
    },
    {
      clave: 'contacto_condicion_iva', etiqueta: t('documentos.condicion_iva_cliente'), ancho: 140, grupo: t('documentos.cliente'), icono: <FileText size={I} />,
      render: (fila) => fila.contacto_condicion_iva
        ? <span className="text-xs text-texto-secundario">{fila.contacto_condicion_iva}</span>
        : null,
    },
    {
      clave: 'contacto_direccion', etiqueta: t('documentos.direccion_cliente'), ancho: 200, grupo: t('documentos.cliente'), icono: <User size={I} />,
      render: (fila) => fila.contacto_direccion
        ? <span className="text-xs text-texto-secundario truncate">{fila.contacto_direccion}</span>
        : null,
    },
    {
      clave: 'atencion_nombre', etiqueta: t('documentos.dirigido_a'), ancho: 160, grupo: t('documentos.cliente'), icono: <User size={I} />,
      render: (fila) => {
        if (!fila.atencion_nombre) return null
        return (
          <div className="min-w-0">
            <div className="text-xs text-texto-secundario truncate">{fila.atencion_nombre}</div>
            {fila.atencion_cargo && <div className="text-xs text-texto-terciario truncate">{fila.atencion_cargo}</div>}
          </div>
        )
      },
    },

    /* ── Montos ── */
    {
      clave: 'total_final', etiqueta: t('documentos.total'), ancho: 150, ordenable: true, tipo: 'moneda', grupo: 'Montos', icono: <DollarSign size={I} />,
      alineacion: 'right', resumen: 'suma',
      obtenerValor: (fila) => parseFloat(fila.total_final || '0'),
      render: (fila) => (
        <span className="font-mono text-sm font-medium text-texto-primario">
          {formatoMonedaDoc(fila.total_final, fila.moneda)}
        </span>
      ),
    },
    {
      // Columna visual de "Pagos": dots por cuota cobrada / parcial / pendiente.
      // Para presupuestos sin cuotas (plazo fijo, contado) muestra 1 solo dot
      // que refleja si el total cobrado cubre el total final.
      clave: 'pagos', etiqueta: 'Pagos', ancho: 150, grupo: 'Montos', icono: <CreditCard size={I} />,
      render: (fila) => (
        <IndicadorPagos
          resumen={fila.resumen_pagos}
          totalFinal={parseFloat(fila.total_final || '0')}
          moneda={fila.moneda}
          estado={fila.estado}
        />
      ),
    },
    {
      clave: 'moneda', etiqueta: t('documentos.moneda'), ancho: 80, grupo: 'Montos', icono: <DollarSign size={I} />,
      opcionesFiltro: [
        { valor: 'ARS', etiqueta: 'ARS' },
        { valor: 'USD', etiqueta: 'USD' },
        { valor: 'EUR', etiqueta: 'EUR' },
      ],
      render: (fila) => <span className="font-mono text-xs text-texto-terciario">{fila.moneda}</span>,
    },
    {
      clave: 'subtotal_neto', etiqueta: t('documentos.subtotal'), ancho: 140, tipo: 'moneda', grupo: 'Montos', icono: <DollarSign size={I} />,
      alineacion: 'right', resumen: 'suma',
      obtenerValor: (fila) => parseFloat(fila.subtotal_neto || '0'),
      render: (fila) => (
        <span className="font-mono text-xs text-texto-secundario">
          {formatoMonedaDoc(fila.subtotal_neto, fila.moneda)}
        </span>
      ),
    },
    {
      clave: 'total_impuestos', etiqueta: t('documentos.impuesto'), ancho: 130, tipo: 'moneda', grupo: 'Montos', icono: <DollarSign size={I} />,
      alineacion: 'right', resumen: 'suma',
      obtenerValor: (fila) => parseFloat(fila.total_impuestos || '0'),
      render: (fila) => (
        <span className="font-mono text-xs text-texto-secundario">
          {formatoMonedaDoc(fila.total_impuestos, fila.moneda)}
        </span>
      ),
    },
    {
      clave: 'descuento_global', etiqueta: `${t('documentos.descuento')} %`, ancho: 110, tipo: 'numero', grupo: 'Montos', icono: <DollarSign size={I} />,
      alineacion: 'right',
      render: (fila) => {
        const desc = parseFloat(fila.descuento_global || '0')
        return desc > 0 ? <span className="text-xs text-texto-secundario">{desc}%</span> : null
      },
    },

    /* ── Fechas ── */
    {
      clave: 'fecha_emision', etiqueta: t('documentos.emision'), ancho: 130, ordenable: true, tipo: 'fecha', grupo: t('comun.fechas'), icono: <Calendar size={I} />,
      render: (fila) => <span className="text-sm text-texto-secundario">{formatoFecha(fila.fecha_emision)}</span>,
    },
    {
      clave: 'fecha_vencimiento', etiqueta: t('documentos.fecha_vencimiento'), ancho: 130, ordenable: true, tipo: 'fecha', grupo: t('comun.fechas'), icono: <Clock size={I} />,
      render: (fila) => {
        if (!fila.fecha_vencimiento) return null
        const vencido = new Date(fila.fecha_vencimiento) < new Date() && fila.estado === 'enviado'
        return (
          <span className={`text-sm ${vencido ? 'text-estado-error font-medium' : 'text-texto-secundario'}`}>
            {formatoFecha(fila.fecha_vencimiento)}
          </span>
        )
      },
    },
    {
      clave: 'dias_vencimiento', etiqueta: t('documentos.plazo_dias'), ancho: 100, tipo: 'numero', grupo: t('comun.fechas'), icono: <Clock size={I} />,
      render: (fila) => <span className="text-xs text-texto-terciario">{fila.dias_vencimiento}d</span>,
    },
    {
      // Cuándo el presupuesto pasó al estado actual (aceptado, completado, etc.)
      clave: 'estado_cambiado_en', etiqueta: 'Cambió de estado', ancho: 140, ordenable: true, tipo: 'fecha', grupo: t('comun.fechas'), icono: <RefreshCw size={I} />,
      render: (fila) => <span className="text-xs text-texto-secundario">{formatoFecha(fila.estado_cambiado_en)}</span>,
    },

    /* ── Pago ── */
    {
      clave: 'condicion_pago', etiqueta: t('documentos.condiciones_pago'), ancho: 180, grupo: t('comun.pago_grupo'), icono: <FileText size={I} />,
      render: (fila) => fila.condicion_pago_label
        ? <span className="text-sm text-texto-secundario">{fila.condicion_pago_label}</span>
        : null,
    },

    /* ── Origen ── */
    {
      clave: 'origen_documento_numero', etiqueta: t('documentos.doc_origen'), ancho: 130, grupo: t('comun.origen'), icono: <FileText size={I} />,
      render: (fila) => fila.origen_documento_numero
        ? <span className="font-mono text-xs text-texto-secundario">{fila.origen_documento_numero}</span>
        : null,
    },

    /* ── Auditoría ── */
    {
      clave: 'creado_por_nombre', etiqueta: t('comun.creado_por'), ancho: 150, grupo: t('comun.auditoria_grupo'), icono: <User size={I} />,
      render: (fila) => fila.creado_por_nombre
        ? <span className="text-sm text-texto-secundario">{fila.creado_por_nombre}</span>
        : null,
    },
    {
      clave: 'creado_en', etiqueta: t('comun.creacion'), ancho: 130, ordenable: true, tipo: 'fecha', grupo: t('comun.auditoria_grupo'), icono: <Calendar size={I} />,
      render: (fila) => <span className="text-xs text-texto-terciario">{formatoFecha(fila.creado_en)}</span>,
    },
    {
      clave: 'editado_por' as keyof FilaPresupuesto, etiqueta: 'Auditoría', ancho: 44, grupo: t('comun.auditoria_grupo'), icono: <History size={I} />,
      render: (fila) => (fila.editado_por || fila.creado_por) ? (
        <IndicadorEditado
          entidadId={fila.id}
          nombreCreador={fila.creado_por_nombre}
          fechaCreacion={fila.creado_en}
          nombreEditor={fila.editado_por_nombre}
          fechaEdicion={fila.actualizado_en}
          tablaAuditoria="auditoria_presupuestos"
          campoReferencia="presupuesto_id"
        />
      ) : null,
    },
  ]

  return (
    <PlantillaListado
      titulo={t('navegacion.presupuestos')}
      icono={<FileText size={20} />}
      accionPrincipal={tienePermiso('presupuestos', 'crear') ? { etiqueta: t('documentos.nuevo_presupuesto'), icono: <Plus size={14} />, onClick: () => router.push('/presupuestos/nuevo') } : undefined}
      acciones={[
        { id: 'exportar', etiqueta: 'Exportar', icono: <FileDown size={14} />, onClick: () => {} },
      ]}
      mostrarConfiguracion
      onConfiguracion={() => router.push('/presupuestos/configuracion')}
    >
      <TablaDinamica<FilaPresupuesto>
        chipFiltro={contactoIdFiltro && nombreFiltro ? (
          <Boton
            variante="secundario"
            tamano="xs"
            redondeado
            iconoDerecho={<X size={10} className="text-texto-terciario" />}
            onClick={() => router.replace('/presupuestos')}
            className="shrink-0"
          >
            {nombreFiltro}
          </Boton>
        ) : undefined}
        columnas={columnas}
        columnasVisiblesDefault={COLUMNAS_VISIBLES_DEFAULT}
        datos={presupuestos}
        claveFila={(r) => r.id}
        totalRegistros={total}
        registrosPorPagina={POR_PAGINA}
        paginaExterna={pagina}
        onCambiarPagina={setPagina}
        vistas={['lista', 'tarjetas']}
        renderTarjeta={(fila) => {
          const nombre = fila.contacto_nombre
            ? `${fila.contacto_nombre}${fila.contacto_apellido ? ` ${fila.contacto_apellido}` : ''}`
            : null
          const vencido = fila.fecha_vencimiento && new Date(fila.fecha_vencimiento) < new Date() && fila.estado === 'enviado'
          return (
            <div className="p-4 flex flex-col gap-3">
              <div className="flex items-center justify-between gap-2">
                <span className="font-mono text-sm font-bold text-texto-primario">{fila.numero}</span>
                <Insignia color={COLOR_ESTADO_DOCUMENTO[fila.estado] || 'neutro'} tamano="sm">
                  {ETIQUETAS_ESTADO[fila.estado] || fila.estado}
                </Insignia>
              </div>
              <div className="space-y-0.5">
                {nombre && <div className="text-sm text-texto-primario truncate">{nombre}</div>}
                {fila.atencion_nombre && <div className="text-xs text-texto-terciario truncate">At. {fila.atencion_nombre}</div>}
                {!nombre && !fila.atencion_nombre && <div className="text-xs text-texto-terciario">Sin cliente</div>}
              </div>
              {fila.referencia && <div className="text-xs text-texto-terciario truncate">{fila.referencia}</div>}
              <div className="border-t border-borde-sutil pt-2.5 flex items-center justify-between gap-2">
                <span className="font-mono text-sm font-semibold text-texto-primario">
                  {formatoMonedaDoc(fila.total_final, fila.moneda)}
                </span>
                <span className={`text-xs ${vencido ? 'text-estado-error font-medium' : 'text-texto-terciario'}`}>
                  {formatoFecha(fila.fecha_emision)}
                </span>
              </div>
            </div>
          )
        }}
        seleccionables
        accionesLote={[
          {
            id: 'estado',
            etiqueta: 'Estado',
            icono: <RefreshCw size={14} />,
            onClick: cambiarEstadoLote,
            atajo: 'S',
            grupo: 'edicion' as const,
          },
          {
            id: 'exportar',
            etiqueta: 'Exportar',
            icono: <FileDown size={14} />,
            onClick: exportarPresupuestosCSV,
            grupo: 'exportar' as const,
          },
          ...(tienePermiso('presupuestos', 'eliminar') ? [{
            id: 'papelera',
            etiqueta: t('comun.eliminar'),
            icono: <Trash2 size={14} />,
            onClick: enviarAPapeleraLote,
            peligro: true,
            atajo: 'Supr',
            grupo: 'peligro' as const,
          }] : []),
        ]}
        busqueda={busqueda}
        onBusqueda={setBusqueda}
        placeholder="Buscar presupuestos..."
        filtros={[
          // ── Identidad ──
          {
            id: 'estado', etiqueta: 'Estado', tipo: 'multiple-compacto' as const,
            valor: filtroEstado,
            onChange: (v) => setFiltroEstado(Array.isArray(v) ? v : (v ? [v] : [])),
            opciones: Object.entries(ETIQUETAS_ESTADO).map(([valor, etiqueta]) => ({ valor, etiqueta })),
            descripcion: 'Filtrá por uno o más estados del presupuesto.',
          },
          {
            id: 'tipo_contacto', etiqueta: 'Tipo de cliente', tipo: 'multiple-compacto' as const,
            valor: filtroTipoContacto,
            onChange: (v) => setFiltroTipoContacto(Array.isArray(v) ? v : (v ? [v] : [])),
            opciones: opcionesTiposContacto,
            descripcion: 'Filtrá presupuestos según el tipo del contacto vinculado (persona, empresa, edificio, etc.).',
          },
          {
            id: 'creado_por', etiqueta: 'Creado por', tipo: 'seleccion-compacto' as const,
            valor: filtroCreadoPor, onChange: (v) => setFiltroCreadoPor(v as string),
            opciones: opcionesMiembros,
            descripcion: 'Mostrá solo los presupuestos creados por el miembro elegido.',
          },
          // ── Comercial ──
          {
            id: 'en_orden_venta', etiqueta: 'En orden de venta', tipo: 'pills' as const,
            valor: filtroEnOrdenVenta, onChange: (v) => setFiltroEnOrdenVenta(v as string),
            opciones: [
              { valor: 'true', etiqueta: 'Sí' },
              { valor: 'false', etiqueta: 'No' },
            ],
            descripcion: 'Presupuestos que ya fueron aceptados y convertidos a orden de venta.',
          },
          {
            id: 'vencido', etiqueta: 'Vencido', tipo: 'pills' as const,
            valor: filtroVencido, onChange: (v) => setFiltroVencido(v as string),
            opciones: [
              { valor: 'true', etiqueta: 'Sí' },
              { valor: 'false', etiqueta: 'No' },
            ],
            descripcion: 'Presupuestos enviados cuya fecha de vencimiento ya pasó (sin aceptar ni cancelar).',
          },
          {
            id: 'con_descuento', etiqueta: 'Con descuento', tipo: 'pills' as const,
            valor: filtroConDescuento, onChange: (v) => setFiltroConDescuento(v as string),
            opciones: [
              { valor: 'true', etiqueta: 'Sí' },
              { valor: 'false', etiqueta: 'No' },
            ],
            descripcion: 'Presupuestos que tienen aplicado un descuento global.',
          },
          // ── Montos ──
          {
            id: 'monto_rango', etiqueta: 'Rango de total', tipo: 'pills' as const,
            valor: filtroMontoRango, onChange: (v) => setFiltroMontoRango(v as string),
            opciones: [
              { valor: 'low', etiqueta: '< $10k' },
              { valor: 'mid', etiqueta: '$10k–$100k' },
              { valor: 'high', etiqueta: '$100k–$1M' },
              { valor: 'top', etiqueta: '> $1M' },
            ],
            descripcion: 'Filtrá por rango de monto total del presupuesto.',
          },
          // ── Período ──
          {
            id: 'anio', etiqueta: 'Año', tipo: 'seleccion-compacto' as const,
            valor: filtroAnio, onChange: (v) => setFiltroAnio(v as string),
            opciones: opcionesAnios,
            descripcion: 'Presupuestos emitidos durante el año seleccionado.',
          },
          // ── Otros ──
          {
            id: 'con_observaciones', etiqueta: 'Con observaciones', tipo: 'pills' as const,
            valor: filtroConObservaciones, onChange: (v) => setFiltroConObservaciones(v as string),
            opciones: [
              { valor: 'true', etiqueta: 'Sí' },
              { valor: 'false', etiqueta: 'No' },
            ],
            descripcion: 'Presupuestos que tienen notas u observaciones cargadas.',
          },
        ]}
        gruposFiltros={[
          { id: 'identidad', etiqueta: 'Identidad', filtros: ['estado', 'tipo_contacto', 'creado_por'] },
          { id: 'comercial', etiqueta: 'Comercial', filtros: ['en_orden_venta', 'vencido', 'con_descuento'] },
          { id: 'montos', etiqueta: 'Montos', filtros: ['monto_rango'] },
          { id: 'periodo', etiqueta: 'Período', filtros: ['anio'] },
          { id: 'otros', etiqueta: 'Otros', filtros: ['con_observaciones'] },
        ]}
        onLimpiarFiltros={() => {
          setFiltroEstado([])
          setFiltroTipoContacto([])
          setFiltroEnOrdenVenta('')
          setFiltroVencido('')
          setFiltroConDescuento('')
          setFiltroConObservaciones('')
          setFiltroMontoRango('')
          setFiltroAnio('')
          setFiltroCreadoPor('')
        }}
        idModulo="presupuestos"
        opcionesOrden={[
          { etiqueta: t('comun.mas_recientes'), clave: 'numero', direccion: 'desc' },
          { etiqueta: t('comun.mas_antiguos'), clave: 'numero', direccion: 'asc' },
          { etiqueta: t('documentos.cliente_az'), clave: 'contacto_nombre', direccion: 'asc' },
          { etiqueta: t('documentos.cliente_za'), clave: 'contacto_nombre', direccion: 'desc' },
          { etiqueta: t('documentos.total_mayor'), clave: 'total_final', direccion: 'desc' },
          { etiqueta: t('documentos.total_menor'), clave: 'total_final', direccion: 'asc' },
          { etiqueta: 'Por vencer (más próximos)', clave: 'fecha_vencimiento', direccion: 'asc' },
          // Ordena por la fecha en que el presupuesto pasó al estado actual.
          // Útil al filtrar por "Orden de Venta" + "Completado": un presupuesto
          // creado hace meses pero recién aceptado/cobrado aparece primero.
          { etiqueta: 'Cambio de estado reciente', clave: 'estado_cambiado_en', direccion: 'desc' },
        ]}
        onClickFila={(fila) => router.push(`/presupuestos/${fila.id}`)}
        mostrarResumen
        estadoVacio={
          <EstadoVacio
            icono={<FilePen size={52} strokeWidth={1} />}
            titulo="Sin presupuestos todavía"
            descripcion="Armá tu primer presupuesto y empezá a cerrar negocios."
            accion={
              <Boton onClick={() => router.push('/presupuestos/nuevo')}>
                <Plus size={16} />
                Crear primer presupuesto
              </Boton>
            }
          />
        }
      />
    </PlantillaListado>
  )
}

// ─── Indicador visual de pagos para la columna del listado ───────────────
// Anillo de progreso (donut) que muestra el % cobrado del presupuesto, +
// label compacto al lado: cuotas cobradas / pendientes y cantidad de pagos.
//
// Tonos:
//   verde  → cobrado completo (100%)
//   ámbar  → parcial (>0% y <100%)
//   gris   → pendiente (0%)
//
// Tooltip nativo con desglose completo.
function IndicadorPagos({
  resumen,
  totalFinal,
  moneda,
  estado,
}: {
  resumen?: {
    cuotas: string[]
    cantidad_pagos: number
    total_cobrado: number
  }
  totalFinal: number
  moneda: string
  estado?: EstadoPresupuesto
}) {
  // Solo tiene sentido mostrar el progreso de pagos cuando el presupuesto
  // ya fue aceptado por el cliente (confirmado / orden de venta / completado).
  // En borrador / enviado / rechazado / vencido / cancelado el cobro no
  // aplica, así que devolvemos un placeholder discreto.
  const ESTADOS_CON_COBRO: EstadoPresupuesto[] = ['confirmado_cliente', 'orden_venta', 'completado']
  if (!estado || !ESTADOS_CON_COBRO.includes(estado)) {
    return <span className="text-xxs text-texto-terciario">—</span>
  }

  if (!resumen) {
    return <span className="text-xxs text-texto-terciario">—</span>
  }

  const { cuotas, cantidad_pagos, total_cobrado } = resumen
  const fmt = (n: number) =>
    new Intl.NumberFormat('es-AR', { maximumFractionDigits: 0 }).format(n)

  const sufijoPagos = cantidad_pagos > 0
    ? `${cantidad_pagos} pago${cantidad_pagos !== 1 ? 's' : ''}`
    : null

  // El donut refleja proporción de cuotas pagadas (no de monto), así que
  // "1 de 2" siempre da la mitad del círculo. Para presupuestos sin cuotas
  // (plazo fijo / contado) no hay proporción de cuotas → caemos al cobrado
  // sobre total como aproximación.
  const cubierto = totalFinal > 0 && total_cobrado + 0.01 >= totalFinal
  let porcentaje: number
  if (cuotas.length > 0) {
    const cobradas = cuotas.filter((e) => e === 'cobrada').length
    const parciales = cuotas.filter((e) => e === 'parcial').length
    // Cada cuota pesa 1/N. Las parciales cuentan como 1/2.
    porcentaje = Math.round(((cobradas + parciales * 0.5) / cuotas.length) * 100)
  } else {
    porcentaje = totalFinal > 0
      ? Math.min(100, Math.round((total_cobrado / totalFinal) * 100))
      : 0
  }
  const tono: 'completo' | 'parcial' | 'pendiente' =
    cubierto ? 'completo' : porcentaje > 0 ? 'parcial' : 'pendiente'

  // Construir labels (línea 1 + línea 2)
  let linea1: string
  let linea2: string | null
  let colorTexto: string

  if (cuotas.length === 0) {
    // Sin cuotas materializadas (plazo fijo / contado)
    if (cubierto) {
      linea1 = 'Cobrado'
      colorTexto = 'text-insignia-exito'
    } else if (porcentaje > 0) {
      linea1 = `${porcentaje}%`
      colorTexto = 'text-insignia-advertencia'
    } else {
      linea1 = 'Pendiente'
      colorTexto = 'text-texto-terciario'
    }
    linea2 = sufijoPagos
  } else {
    const cobradas = cuotas.filter((e) => e === 'cobrada').length
    if (cubierto) {
      linea1 = `${cuotas.length} cuota${cuotas.length !== 1 ? 's' : ''}`
      colorTexto = 'text-insignia-exito'
    } else if (cobradas > 0 || porcentaje > 0) {
      linea1 = `${cobradas} de ${cuotas.length}`
      colorTexto = 'text-insignia-advertencia'
    } else {
      linea1 = `0 de ${cuotas.length}`
      colorTexto = 'text-texto-terciario'
    }
    linea2 = sufijoPagos
  }

  // Tooltip
  const partes: string[] = []
  if (cuotas.length > 0) {
    const cobradas = cuotas.filter((e) => e === 'cobrada').length
    const parciales = cuotas.filter((e) => e === 'parcial').length
    const pendientes = cuotas.length - cobradas - parciales
    partes.push(`${cuotas.length} cuotas`)
    if (cobradas > 0) partes.push(`${cobradas} cobrada${cobradas !== 1 ? 's' : ''}`)
    if (parciales > 0) partes.push(`${parciales} parcial${parciales !== 1 ? 'es' : ''}`)
    if (pendientes > 0) partes.push(`${pendientes} pendiente${pendientes !== 1 ? 's' : ''}`)
  } else {
    if (cubierto) partes.push('Cobrado completo')
    else if (porcentaje > 0) partes.push(`Cobrado ${fmt(total_cobrado)} ${moneda} de ${fmt(totalFinal)} ${moneda}`)
    else partes.push('Sin pagos cargados')
  }
  if (cantidad_pagos > 0) partes.push(`${cantidad_pagos} pago${cantidad_pagos !== 1 ? 's' : ''} cargado${cantidad_pagos !== 1 ? 's' : ''}`)
  const tooltip = partes.join(' · ')

  return (
    <div className="flex items-center gap-2 min-w-0" title={tooltip}>
      <AnilloPagos porcentaje={porcentaje} tono={tono} />
      <div className="flex flex-col leading-tight min-w-0">
        <span className={`text-xs font-medium tabular-nums ${colorTexto}`}>
          {linea1}
        </span>
        {linea2 && (
          <span className="text-xxs text-texto-terciario tabular-nums">
            {linea2}
          </span>
        )}
      </div>
    </div>
  )
}

// ─── Anillo SVG de progreso (donut) para mostrar % cobrado ──────────────
// 28×28px. Track gris fino + arco coloreado proporcional al %. Cuando
// está completo (100%), muestra un check sólido en el centro.
function AnilloPagos({
  porcentaje,
  tono,
}: {
  porcentaje: number
  tono: 'completo' | 'parcial' | 'pendiente'
}) {
  const size = 26
  const strokeWidth = 3
  const radius = (size - strokeWidth) / 2
  const circ = 2 * Math.PI * radius
  const dash = (porcentaje / 100) * circ

  const colorClase =
    tono === 'completo' ? 'text-insignia-exito'
    : tono === 'parcial' ? 'text-insignia-advertencia'
    : 'text-texto-terciario'

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className={colorClase}>
        {/* Track de fondo (anillo gris fino) */}
        <circle
          cx={size / 2} cy={size / 2} r={radius}
          stroke="currentColor"
          strokeWidth={strokeWidth}
          fill="none"
          opacity={tono === 'pendiente' ? 0.35 : 0.18}
        />
        {/* Arco de progreso (coloreado) */}
        {porcentaje > 0 && (
          <circle
            cx={size / 2} cy={size / 2} r={radius}
            stroke="currentColor"
            strokeWidth={strokeWidth}
            fill="none"
            strokeDasharray={`${dash} ${circ}`}
            strokeLinecap="round"
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
          />
        )}
      </svg>
      {tono === 'completo' && (
        <Check
          className="absolute inset-0 m-auto size-3 text-insignia-exito"
          strokeWidth={3}
        />
      )}
    </div>
  )
}
