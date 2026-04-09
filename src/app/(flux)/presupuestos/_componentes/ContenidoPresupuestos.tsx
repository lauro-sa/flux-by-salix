'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { useQueryClient } from '@tanstack/react-query'
import { useNavegacion } from '@/hooks/useNavegacion'
import { useListado } from '@/hooks/useListado'
import { useRol } from '@/hooks/useRol'
import { useFormato } from '@/hooks/useFormato'
import { useTraduccion } from '@/lib/i18n'
import { PlantillaListado } from '@/componentes/entidad/PlantillaListado'
import { TablaDinamica } from '@/componentes/tablas/TablaDinamica'
import type { ColumnaDinamica } from '@/componentes/tablas/TablaDinamica'
import {
  Plus, FileText, User, Hash, Calendar, DollarSign, Tag,
  Clock, CircleDot, FilePen, Trash2, X, FileDown, Copy, RefreshCw, History,
} from 'lucide-react'
import { EstadoVacio } from '@/componentes/feedback/EstadoVacio'
import { SkeletonTabla } from '@/componentes/feedback/SkeletonTabla'
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
}

const POR_PAGINA = 50

interface Props {
  datosInicialesJson?: Record<string, unknown>
}

export default function ContenidoPresupuestos({ datosInicialesJson }: Props) {
  const { t } = useTraduccion()
  const { tienePermiso } = useRol()
  const formato = useFormato()
  const router = useRouter()
  const searchParams = useSearchParams()
  const queryClient = useQueryClient()
  const contactoIdFiltro = searchParams.get('contacto_id')
  const origenUrl = searchParams.get('origen')
  const [busqueda, setBusqueda] = useState('')
  const [busquedaDebounced, setBusquedaDebounced] = useState('')
  const [pagina, setPagina] = useState(1)
  const [nombreFiltro, setNombreFiltro] = useState<string | null>(null)

  // Filtros server-side
  const [filtroEstado, setFiltroEstado] = useState('')
  const [filtroMoneda, setFiltroMoneda] = useState('')

  const pathname = usePathname()
  const { setMigajaDinamica } = useNavegacion()

  // Debounce de búsqueda (300ms)
  useEffect(() => {
    const timeout = setTimeout(() => setBusquedaDebounced(busqueda), 300)
    return () => clearTimeout(timeout)
  }, [busqueda])

  // Reset de página al cambiar filtros/búsqueda
  useEffect(() => { setPagina(1) }, [busquedaDebounced, filtroEstado, filtroMoneda])

  // Solo usar datos iniciales cuando no hay filtros activos (primera carga)
  const sinFiltros = !busquedaDebounced && !filtroEstado && !filtroMoneda && !contactoIdFiltro && pagina === 1

  const { datos: presupuestos, total, cargando, cargandoInicial, recargar } = useListado<FilaPresupuesto>({
    clave: 'presupuestos',
    url: '/api/presupuestos',
    parametros: {
      busqueda: busquedaDebounced,
      contacto_id: contactoIdFiltro || undefined,
      estado: filtroEstado || undefined,
      moneda: filtroMoneda || undefined,
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

  // Duplicar presupuestos en lote
  const duplicarLote = useCallback(async (ids: Set<string>) => {
    try {
      const resultados = await Promise.all(
        Array.from(ids).map(id =>
          fetch(`/api/presupuestos/${id}/duplicar`, { method: 'POST' }).then(r => r.json())
        )
      )
      const nuevos = resultados.filter(r => r.id)
      if (nuevos.length > 0) {
        mostrarToast('exito', `${nuevos.length} presupuesto${nuevos.length !== 1 ? 's' : ''} duplicado${nuevos.length !== 1 ? 's' : ''}`)
        queryClient.invalidateQueries({ queryKey: ['presupuestos'] })
      }
    } catch {
      mostrarToast('error', 'Error al duplicar presupuestos')
    }
  }, [mostrarToast, queryClient])

  // Exportar presupuestos seleccionados a CSV
  const exportarPresupuestosCSV = useCallback(async (ids: Set<string>) => {
    const seleccion = presupuestos.filter(p => ids.has(p.id))
    const cabeceras = ['Número', 'Estado', 'Cliente', 'Referencia', 'Moneda', 'Total', 'Fecha emisión', 'Fecha vencimiento']
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

  const COLUMNAS_VISIBLES_DEFAULT = ['numero', 'estado', 'contacto', 'contacto_identificacion', 'total_final', 'fecha_emision', 'fecha_vencimiento']

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
            id: 'duplicar',
            etiqueta: 'Duplicar',
            icono: <Copy size={14} />,
            onClick: duplicarLote,
            atajo: 'D',
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
          {
            id: 'estado', etiqueta: 'Estado', tipo: 'pills' as const,
            valor: filtroEstado, onChange: (v) => setFiltroEstado(v as string),
            opciones: Object.entries(ETIQUETAS_ESTADO).map(([valor, etiqueta]) => ({ valor, etiqueta })),
          },
          {
            id: 'moneda', etiqueta: 'Moneda', tipo: 'pills' as const,
            valor: filtroMoneda, onChange: (v) => setFiltroMoneda(v as string),
            opciones: [
              { valor: 'ARS', etiqueta: 'ARS' },
              { valor: 'USD', etiqueta: 'USD' },
              { valor: 'EUR', etiqueta: 'EUR' },
            ],
          },
        ]}
        onLimpiarFiltros={() => { setFiltroEstado(''); setFiltroMoneda('') }}
        idModulo="presupuestos"
        opcionesOrden={[
          { etiqueta: t('comun.mas_recientes'), clave: 'numero', direccion: 'desc' },
          { etiqueta: t('comun.mas_antiguos'), clave: 'numero', direccion: 'asc' },
          { etiqueta: t('documentos.cliente_az'), clave: 'contacto', direccion: 'asc' },
          { etiqueta: t('documentos.cliente_za'), clave: 'contacto', direccion: 'desc' },
          { etiqueta: t('documentos.total_mayor'), clave: 'total_final', direccion: 'desc' },
          { etiqueta: t('documentos.total_menor'), clave: 'total_final', direccion: 'asc' },
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
