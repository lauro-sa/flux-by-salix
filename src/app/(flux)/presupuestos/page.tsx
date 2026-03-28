'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { PlantillaListado } from '@/componentes/entidad/PlantillaListado'
import { TablaDinamica } from '@/componentes/tablas/TablaDinamica'
import type { ColumnaDinamica } from '@/componentes/tablas/TablaDinamica'
import {
  Plus, FileText, User, Hash, Calendar, DollarSign, Tag,
  Clock, CircleDot, FilePen, Trash2,
} from 'lucide-react'
import { EstadoVacio } from '@/componentes/feedback/EstadoVacio'
import { Boton } from '@/componentes/ui/Boton'
import { Insignia } from '@/componentes/ui/Insignia'
import { COLOR_ESTADO_DOCUMENTO } from '@/lib/colores_entidad'
import { ETIQUETAS_ESTADO, type EstadoPresupuesto } from '@/tipos/presupuesto'

// Tipo para las filas de la tabla
interface FilaPresupuesto {
  id: string
  numero: string
  estado: EstadoPresupuesto
  contacto_id: string | null
  contacto_nombre: string | null
  contacto_apellido: string | null
  contacto_tipo: string | null
  contacto_correo: string | null
  contacto_telefono: string | null
  contacto_identificacion: string | null
  referencia: string | null
  moneda: string
  fecha_emision: string
  fecha_vencimiento: string | null
  dias_vencimiento: number
  subtotal_neto: string
  total_impuestos: string
  total_final: string
  descuento_global: string
  condicion_pago_label: string | null
  notas_html: string | null
  creado_por: string
  creado_por_nombre: string | null
  creado_en: string
  actualizado_en: string
}

const POR_PAGINA = 50

// Símbolos de moneda
const SIMBOLO_MONEDA: Record<string, string> = {
  ARS: '$', USD: 'US$', EUR: '€',
}

export default function PaginaPresupuestos() {
  const router = useRouter()
  const [busqueda, setBusqueda] = useState('')
  const [presupuestos, setPresupuestos] = useState<FilaPresupuesto[]>([])
  const [cargando, setCargando] = useState(true)
  const [total, setTotal] = useState(0)
  const [pagina, setPagina] = useState(1)

  const busquedaRef = useRef(busqueda)
  busquedaRef.current = busqueda

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
      setPresupuestos(prev => prev.filter(p => !ids.has(p.id)))
      setTotal(prev => prev - ids.size)
    } catch (err) {
      console.error('Error al enviar a papelera:', err)
    }
  }, [])

  // Fetch de presupuestos
  const fetchPresupuestos = useCallback(async (p: number) => {
    setCargando(true)
    try {
      const params = new URLSearchParams()
      const b = busquedaRef.current
      if (b) params.set('busqueda', b)
      params.set('pagina', String(p))
      params.set('por_pagina', String(POR_PAGINA))

      const res = await fetch(`/api/presupuestos?${params}`)
      const data = await res.json()

      if (data.presupuestos) {
        setPresupuestos(data.presupuestos)
        setTotal(data.total)
      }
    } catch {
      // silenciar
    } finally {
      setCargando(false)
    }
  }, [])

  // Cargar al montar
  const cargaInicialRef = useRef(false)
  useEffect(() => {
    if (cargaInicialRef.current) return
    cargaInicialRef.current = true
    fetchPresupuestos(1)
  }, [fetchPresupuestos])

  // Cargar al cambiar página
  useEffect(() => {
    if (!cargaInicialRef.current) return
    fetchPresupuestos(pagina)
  }, [pagina, fetchPresupuestos])

  // Recargar al cambiar búsqueda (debounce 300ms)
  const montadoRef = useRef(false)
  useEffect(() => {
    if (!montadoRef.current) { montadoRef.current = true; return }
    const timeout = setTimeout(() => {
      if (pagina === 1) {
        fetchPresupuestos(1)
      } else {
        setPagina(1)
      }
    }, 300)
    return () => clearTimeout(timeout)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [busqueda])

  // Helpers de formato
  const formatoFecha = (iso: string) => new Date(iso).toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: 'numeric' })
  const formatoMoneda = (valor: string, moneda: string) => {
    const num = parseFloat(valor || '0')
    const simbolo = SIMBOLO_MONEDA[moneda] || '$'
    return `${simbolo} ${num.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  }

  // Columnas de la tabla
  const I = 12
  const columnas: ColumnaDinamica<FilaPresupuesto>[] = [
    {
      clave: 'numero', etiqueta: 'Número', ancho: 120, ordenable: true, grupo: 'Identidad', icono: <Hash size={I} />,
      render: (fila) => (
        <span className="font-mono text-sm text-texto-primario font-medium">{fila.numero}</span>
      ),
    },
    {
      clave: 'estado', etiqueta: 'Estado', ancho: 130, ordenable: true, grupo: 'Identidad', icono: <CircleDot size={I} />,
      filtrable: true, tipoFiltro: 'multiple',
      opcionesFiltro: Object.entries(ETIQUETAS_ESTADO).map(([valor, etiqueta]) => ({ valor, etiqueta })),
      render: (fila) => (
        <Insignia color={COLOR_ESTADO_DOCUMENTO[fila.estado] || 'neutro'}>
          {ETIQUETAS_ESTADO[fila.estado] || fila.estado}
        </Insignia>
      ),
    },
    {
      clave: 'contacto', etiqueta: 'Cliente', ancho: 220, grupo: 'Cliente', icono: <User size={I} />,
      render: (fila) => {
        if (!fila.contacto_nombre) return <span className="text-texto-terciario text-xs">Sin asignar</span>
        const nombre = `${fila.contacto_nombre}${fila.contacto_apellido ? ` ${fila.contacto_apellido}` : ''}`
        return (
          <div className="min-w-0">
            <div className="text-sm text-texto-primario truncate">{nombre}</div>
            {fila.contacto_correo && <div className="text-xs text-texto-terciario truncate">{fila.contacto_correo}</div>}
          </div>
        )
      },
    },
    {
      clave: 'referencia', etiqueta: 'Referencia', ancho: 150, ordenable: true, grupo: 'Identidad', icono: <Tag size={I} />,
      render: (fila) => fila.referencia
        ? <span className="text-sm text-texto-secundario">{fila.referencia}</span>
        : null,
    },
    {
      clave: 'fecha_emision', etiqueta: 'Emisión', ancho: 130, ordenable: true, tipo: 'fecha', grupo: 'Fechas', icono: <Calendar size={I} />,
      render: (fila) => <span className="text-sm text-texto-secundario">{formatoFecha(fila.fecha_emision)}</span>,
    },
    {
      clave: 'fecha_vencimiento', etiqueta: 'Vencimiento', ancho: 130, ordenable: true, tipo: 'fecha', grupo: 'Fechas', icono: <Clock size={I} />,
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
      clave: 'total_final', etiqueta: 'Total', ancho: 150, ordenable: true, tipo: 'moneda', grupo: 'Montos', icono: <DollarSign size={I} />,
      alineacion: 'right',
      resumen: 'suma',
      obtenerValor: (fila) => parseFloat(fila.total_final || '0'),
      render: (fila) => (
        <span className="font-mono text-sm font-medium text-texto-primario">
          {formatoMoneda(fila.total_final, fila.moneda)}
        </span>
      ),
    },
    {
      clave: 'moneda', etiqueta: 'Moneda', ancho: 80, grupo: 'Montos', icono: <DollarSign size={I} />,
      render: (fila) => <span className="font-mono text-xs text-texto-terciario">{fila.moneda}</span>,
    },
    {
      clave: 'subtotal_neto', etiqueta: 'Subtotal', ancho: 140, tipo: 'moneda', grupo: 'Montos', icono: <DollarSign size={I} />,
      alineacion: 'right',
      render: (fila) => (
        <span className="font-mono text-xs text-texto-secundario">
          {formatoMoneda(fila.subtotal_neto, fila.moneda)}
        </span>
      ),
    },
    {
      clave: 'total_impuestos', etiqueta: 'Impuestos', ancho: 130, tipo: 'moneda', grupo: 'Montos', icono: <DollarSign size={I} />,
      alineacion: 'right',
      render: (fila) => (
        <span className="font-mono text-xs text-texto-secundario">
          {formatoMoneda(fila.total_impuestos, fila.moneda)}
        </span>
      ),
    },
    {
      clave: 'condicion_pago', etiqueta: 'Condición de pago', ancho: 180, grupo: 'Pago', icono: <FileText size={I} />,
      render: (fila) => fila.condicion_pago_label
        ? <span className="text-sm text-texto-secundario">{fila.condicion_pago_label}</span>
        : null,
    },
    {
      clave: 'contacto_identificacion', etiqueta: 'CUIT/DNI', ancho: 140, grupo: 'Cliente', icono: <Hash size={I} />,
      render: (fila) => fila.contacto_identificacion
        ? <span className="font-mono text-xs text-texto-secundario">{fila.contacto_identificacion}</span>
        : null,
    },
    {
      clave: 'contacto_telefono', etiqueta: 'Teléfono cliente', ancho: 140, grupo: 'Cliente', icono: <User size={I} />,
      render: (fila) => fila.contacto_telefono
        ? <span className="text-xs text-texto-secundario">{fila.contacto_telefono}</span>
        : null,
    },
    {
      clave: 'creado_por_nombre', etiqueta: 'Creado por', ancho: 150, grupo: 'Auditoría', icono: <User size={I} />,
      render: (fila) => fila.creado_por_nombre
        ? <span className="text-sm text-texto-secundario">{fila.creado_por_nombre}</span>
        : null,
    },
    {
      clave: 'creado_en', etiqueta: 'Creado', ancho: 130, ordenable: true, tipo: 'fecha', grupo: 'Auditoría', icono: <Calendar size={I} />,
      render: (fila) => <span className="text-xs text-texto-terciario">{formatoFecha(fila.creado_en)}</span>,
    },
  ]

  return (
    <PlantillaListado
      titulo="Presupuestos"
      icono={<FileText size={20} />}
      accionPrincipal={{ etiqueta: 'Nuevo presupuesto', icono: <Plus size={14} />, onClick: () => router.push('/presupuestos/nuevo') }}
      mostrarConfiguracion
      onConfiguracion={() => router.push('/presupuestos/configuracion')}
    >
      <TablaDinamica<FilaPresupuesto>
        columnas={columnas}
        datos={presupuestos}
        claveFila={(r) => r.id}
        totalRegistros={total}
        registrosPorPagina={POR_PAGINA}
        paginaExterna={pagina}
        onCambiarPagina={setPagina}
        vistas={['lista']}
        seleccionables
        accionesLote={[
          {
            id: 'papelera',
            etiqueta: 'Eliminar',
            icono: <Trash2 size={14} />,
            onClick: enviarAPapeleraLote,
            peligro: true,
          },
        ]}
        busqueda={busqueda}
        onBusqueda={setBusqueda}
        placeholder="Buscar presupuestos..."
        idModulo="presupuestos"
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
