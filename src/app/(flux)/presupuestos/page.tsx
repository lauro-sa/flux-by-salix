'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { useNavegacion } from '@/hooks/useNavegacion'
import { PlantillaListado } from '@/componentes/entidad/PlantillaListado'
import { TablaDinamica } from '@/componentes/tablas/TablaDinamica'
import type { ColumnaDinamica } from '@/componentes/tablas/TablaDinamica'
import {
  Plus, FileText, User, Hash, Calendar, DollarSign, Tag,
  Clock, CircleDot, FilePen, Trash2, X,
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
  referencia: string | null
  /* Cliente */
  contacto_id: string | null
  contacto_nombre: string | null
  contacto_apellido: string | null
  contacto_tipo: string | null
  contacto_correo: string | null
  contacto_telefono: string | null
  contacto_identificacion: string | null
  contacto_condicion_iva: string | null
  contacto_direccion: string | null
  /* Dirigido a */
  atencion_contacto_id: string | null
  atencion_nombre: string | null
  atencion_correo: string | null
  atencion_cargo: string | null
  /* Moneda y pago */
  moneda: string
  condicion_pago_label: string | null
  /* Fechas */
  fecha_emision: string
  fecha_vencimiento: string | null
  dias_vencimiento: number
  /* Montos */
  subtotal_neto: string
  total_impuestos: string
  descuento_global: string
  total_final: string
  /* Origen */
  origen_documento_numero: string | null
  /* Auditoría */
  creado_por: string
  creado_por_nombre: string | null
  creado_en: string
  actualizado_en: string
  notas_html: string | null
}

const POR_PAGINA = 50

// Símbolos de moneda
const SIMBOLO_MONEDA: Record<string, string> = {
  ARS: '$', USD: 'US$', EUR: '€',
}

export default function PaginaPresupuestos() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const contactoIdFiltro = searchParams.get('contacto_id')
  const origenUrl = searchParams.get('origen')
  const [busqueda, setBusqueda] = useState('')
  const [presupuestos, setPresupuestos] = useState<FilaPresupuesto[]>([])
  const [cargando, setCargando] = useState(true)
  const [total, setTotal] = useState(0)
  const [pagina, setPagina] = useState(1)
  const [nombreFiltro, setNombreFiltro] = useState<string | null>(null)

  const busquedaRef = useRef(busqueda)
  busquedaRef.current = busqueda

  const pathname = usePathname()
  const { setMigajaDinamica } = useNavegacion()

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
      if (contactoIdFiltro) params.set('contacto_id', contactoIdFiltro)
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
  }, [contactoIdFiltro])

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
  const formatoIdentificacion = (num: string) => {
    const limpio = num.replace(/\D/g, '')
    if (limpio.length === 11) {
      // CUIT: XX-XXXXXXXX-X
      return { tipo: 'CUIT', formateado: `${limpio.slice(0, 2)}-${limpio.slice(2, 10)}-${limpio.slice(10)}` }
    }
    if (limpio.length >= 7 && limpio.length <= 8) {
      // DNI: XX.XXX.XXX
      return { tipo: 'DNI', formateado: Number(limpio).toLocaleString('es-AR') }
    }
    return { tipo: '', formateado: num }
  }
  const formatoFecha = (iso: string) => new Date(iso).toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: 'numeric' })
  const formatoMoneda = (valor: string, moneda: string) => {
    const num = parseFloat(valor || '0')
    const simbolo = SIMBOLO_MONEDA[moneda] || '$'
    return `${simbolo} ${num.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  }

  /* ── Columnas de la tabla ──
     Orden: número+estado → cliente → montos → fechas → pago → auditoría
     Visibles por defecto: número, estado, cliente, total, emisión, vencimiento, referencia */
  const COLUMNAS_VISIBLES_DEFAULT = ['numero', 'estado', 'contacto', 'contacto_identificacion', 'total_final', 'fecha_emision', 'fecha_vencimiento']

  const I = 12
  const columnas: ColumnaDinamica<FilaPresupuesto>[] = [

    /* ── Identidad ── */
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
      clave: 'referencia', etiqueta: 'Referencia', ancho: 150, ordenable: true, grupo: 'Identidad', icono: <Tag size={I} />,
      render: (fila) => fila.referencia
        ? <span className="text-sm text-texto-secundario">{fila.referencia}</span>
        : null,
    },

    /* ── Cliente ── */
    {
      clave: 'contacto', etiqueta: 'Cliente', ancho: 220, grupo: 'Cliente', icono: <User size={I} />,
      render: (fila) => {
        if (!fila.contacto_nombre) return <span className="text-texto-terciario text-xs">Sin asignar</span>
        const nombre = `${fila.contacto_nombre}${fila.contacto_apellido ? ` ${fila.contacto_apellido}` : ''}`
        return (
          <div className="min-w-0">
            <div className="text-sm text-texto-primario truncate">{nombre}</div>
            {fila.atencion_nombre && <div className="text-[11px] text-texto-terciario truncate">At. {fila.atencion_nombre}</div>}
          </div>
        )
      },
    },
    {
      clave: 'contacto_correo', etiqueta: 'Email cliente', ancho: 200, grupo: 'Cliente', icono: <User size={I} />,
      render: (fila) => fila.contacto_correo
        ? <span className="text-xs text-texto-secundario truncate">{fila.contacto_correo}</span>
        : null,
    },
    {
      clave: 'contacto_telefono', etiqueta: 'Teléfono cliente', ancho: 140, grupo: 'Cliente', icono: <User size={I} />,
      render: (fila) => fila.contacto_telefono
        ? <span className="text-xs text-texto-secundario">{fila.contacto_telefono}</span>
        : null,
    },
    {
      clave: 'contacto_identificacion', etiqueta: 'CUIT/DNI', ancho: 160, grupo: 'Cliente', icono: <Hash size={I} />,
      render: (fila) => {
        if (!fila.contacto_identificacion) return null
        const { tipo } = formatoIdentificacion(fila.contacto_identificacion)
        return (
          <div className="min-w-0">
            <div className="font-mono text-xs text-texto-secundario">{fila.contacto_identificacion}</div>
            {tipo && <div className="text-[10px] text-texto-terciario">{tipo}</div>}
          </div>
        )
      },
    },
    {
      clave: 'contacto_condicion_iva', etiqueta: 'Cond. IVA', ancho: 140, grupo: 'Cliente', icono: <FileText size={I} />,
      render: (fila) => fila.contacto_condicion_iva
        ? <span className="text-xs text-texto-secundario">{fila.contacto_condicion_iva}</span>
        : null,
    },
    {
      clave: 'contacto_direccion', etiqueta: 'Dirección cliente', ancho: 200, grupo: 'Cliente', icono: <User size={I} />,
      render: (fila) => fila.contacto_direccion
        ? <span className="text-xs text-texto-secundario truncate">{fila.contacto_direccion}</span>
        : null,
    },
    {
      clave: 'atencion_nombre', etiqueta: 'Dirigido a', ancho: 160, grupo: 'Cliente', icono: <User size={I} />,
      render: (fila) => {
        if (!fila.atencion_nombre) return null
        return (
          <div className="min-w-0">
            <div className="text-xs text-texto-secundario truncate">{fila.atencion_nombre}</div>
            {fila.atencion_cargo && <div className="text-[11px] text-texto-terciario truncate">{fila.atencion_cargo}</div>}
          </div>
        )
      },
    },

    /* ── Montos ── */
    {
      clave: 'total_final', etiqueta: 'Total', ancho: 150, ordenable: true, tipo: 'moneda', grupo: 'Montos', icono: <DollarSign size={I} />,
      alineacion: 'right', resumen: 'suma',
      obtenerValor: (fila) => parseFloat(fila.total_final || '0'),
      render: (fila) => (
        <span className="font-mono text-sm font-medium text-texto-primario">
          {formatoMoneda(fila.total_final, fila.moneda)}
        </span>
      ),
    },
    {
      clave: 'moneda', etiqueta: 'Moneda', ancho: 80, grupo: 'Montos', icono: <DollarSign size={I} />,
      filtrable: true,
      opcionesFiltro: [
        { valor: 'ARS', etiqueta: 'ARS' },
        { valor: 'USD', etiqueta: 'USD' },
        { valor: 'EUR', etiqueta: 'EUR' },
      ],
      render: (fila) => <span className="font-mono text-xs text-texto-terciario">{fila.moneda}</span>,
    },
    {
      clave: 'subtotal_neto', etiqueta: 'Subtotal', ancho: 140, tipo: 'moneda', grupo: 'Montos', icono: <DollarSign size={I} />,
      alineacion: 'right', resumen: 'suma',
      obtenerValor: (fila) => parseFloat(fila.subtotal_neto || '0'),
      render: (fila) => (
        <span className="font-mono text-xs text-texto-secundario">
          {formatoMoneda(fila.subtotal_neto, fila.moneda)}
        </span>
      ),
    },
    {
      clave: 'total_impuestos', etiqueta: 'Impuestos', ancho: 130, tipo: 'moneda', grupo: 'Montos', icono: <DollarSign size={I} />,
      alineacion: 'right', resumen: 'suma',
      obtenerValor: (fila) => parseFloat(fila.total_impuestos || '0'),
      render: (fila) => (
        <span className="font-mono text-xs text-texto-secundario">
          {formatoMoneda(fila.total_impuestos, fila.moneda)}
        </span>
      ),
    },
    {
      clave: 'descuento_global', etiqueta: 'Descuento %', ancho: 110, tipo: 'numero', grupo: 'Montos', icono: <DollarSign size={I} />,
      alineacion: 'right',
      render: (fila) => {
        const desc = parseFloat(fila.descuento_global || '0')
        return desc > 0 ? <span className="text-xs text-texto-secundario">{desc}%</span> : null
      },
    },

    /* ── Fechas ── */
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
      clave: 'dias_vencimiento', etiqueta: 'Plazo (días)', ancho: 100, tipo: 'numero', grupo: 'Fechas', icono: <Clock size={I} />,
      render: (fila) => <span className="text-xs text-texto-terciario">{fila.dias_vencimiento}d</span>,
    },

    /* ── Pago ── */
    {
      clave: 'condicion_pago', etiqueta: 'Condición de pago', ancho: 180, grupo: 'Pago', icono: <FileText size={I} />,
      render: (fila) => fila.condicion_pago_label
        ? <span className="text-sm text-texto-secundario">{fila.condicion_pago_label}</span>
        : null,
    },

    /* ── Origen ── */
    {
      clave: 'origen_documento_numero', etiqueta: 'Doc. origen', ancho: 130, grupo: 'Origen', icono: <FileText size={I} />,
      render: (fila) => fila.origen_documento_numero
        ? <span className="font-mono text-xs text-texto-secundario">{fila.origen_documento_numero}</span>
        : null,
    },

    /* ── Auditoría ── */
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
        chipFiltro={contactoIdFiltro && nombreFiltro ? (
          <button
            type="button"
            onClick={() => router.replace('/presupuestos')}
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-superficie-elevada text-texto-primario border border-borde-sutil hover:border-borde-fuerte transition-colors cursor-pointer shrink-0"
          >
            {nombreFiltro}
            <X size={10} className="text-texto-terciario" />
          </button>
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
              {/* ── Número + Estado ── */}
              <div className="flex items-center justify-between gap-2">
                <span className="font-mono text-sm font-bold text-texto-primario">{fila.numero}</span>
                <Insignia color={COLOR_ESTADO_DOCUMENTO[fila.estado] || 'neutro'} tamano="sm">
                  {ETIQUETAS_ESTADO[fila.estado] || fila.estado}
                </Insignia>
              </div>

              {/* ── Cliente + Dirigido a ── */}
              <div className="space-y-0.5">
                {nombre && <div className="text-sm text-texto-primario truncate">{nombre}</div>}
                {fila.atencion_nombre && <div className="text-[11px] text-texto-terciario truncate">At. {fila.atencion_nombre}</div>}
                {!nombre && !fila.atencion_nombre && <div className="text-xs text-texto-terciario">Sin cliente</div>}
              </div>

              {/* ── Referencia ── */}
              {fila.referencia && <div className="text-xs text-texto-terciario truncate">{fila.referencia}</div>}

              {/* ── Detalle ── */}
              <div className="border-t border-borde-sutil pt-2.5 flex items-center justify-between gap-2">
                <span className="font-mono text-sm font-semibold text-texto-primario">
                  {formatoMoneda(fila.total_final, fila.moneda)}
                </span>
                <span className={`text-[11px] ${vencido ? 'text-estado-error font-medium' : 'text-texto-terciario'}`}>
                  {formatoFecha(fila.fecha_emision)}
                </span>
              </div>
            </div>
          )
        }}
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
