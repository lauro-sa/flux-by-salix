'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { FileText, ArrowRight, ChevronDown } from 'lucide-react'
import { Insignia } from '@/componentes/ui/Insignia'

/**
 * WidgetDetalleMes — Lista detallada de presupuestos cerrados del mes actual.
 * Muestra número, cliente, estado y monto de cada orden/confirmado.
 * Permite filtrar por estado (todos / órdenes / confirmados).
 */

interface ItemDetalle {
  id: string
  numero: string
  estado: string
  contacto_nombre: string | null
  contacto_apellido: string | null
  total: number
  fecha: string
}

interface Props {
  items: ItemDetalle[]
  formatoMoneda: (n: number) => string
}

const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']

const COLOR_ESTADO: Record<string, 'info' | 'exito'> = {
  confirmado_cliente: 'info',
  orden_venta: 'exito',
}

const ETIQUETA_ESTADO: Record<string, string> = {
  confirmado_cliente: 'Confirmado',
  orden_venta: 'Orden de venta',
}

function fmtFecha(iso: string): string {
  const d = new Date(iso)
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`
}

export function WidgetDetalleMes({ items, formatoMoneda }: Props) {
  const router = useRouter()
  const [filtro, setFiltro] = useState<'todos' | 'orden_venta' | 'confirmado_cliente'>('todos')
  const [expandido, setExpandido] = useState(false)

  const hoy = new Date()
  const mesNombre = MESES[hoy.getMonth()]

  const filtrados = useMemo(() => {
    if (filtro === 'todos') return items
    return items.filter(i => i.estado === filtro)
  }, [items, filtro])

  const totales = useMemo(() => {
    return filtrados.reduce((acc, i) => ({ cantidad: acc.cantidad + 1, monto: acc.monto + i.total }), { cantidad: 0, monto: 0 })
  }, [filtrados])

  const visibles = expandido ? filtrados : filtrados.slice(0, 6)
  const hayMas = filtrados.length > 6

  const contadorOrdenes = items.filter(i => i.estado === 'orden_venta').length
  const contadorConfirmados = items.filter(i => i.estado === 'confirmado_cliente').length

  if (items.length === 0) {
    return (
      <div className="bg-superficie-tarjeta border border-borde-sutil rounded-card p-4 sm:p-5">
        <div className="flex items-center gap-2 mb-3">
          <FileText size={15} className="text-texto-terciario" />
          <h3 className="text-sm font-semibold text-texto-primario">Detalle de {mesNombre}</h3>
        </div>
        <p className="text-xs text-texto-terciario text-center py-6">
          Este mes todavía no hay presupuestos cerrados ni órdenes.
        </p>
      </div>
    )
  }

  return (
    <div className="bg-superficie-tarjeta border border-borde-sutil rounded-card p-4 sm:p-5">
      {/* Header: título + filtro + ver todo */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <FileText size={15} className="text-texto-terciario" />
            <h3 className="text-sm font-semibold text-texto-primario">Detalle de {mesNombre}</h3>
          </div>
          <p className="text-xxs text-texto-terciario mt-1">
            <span className="tabular-nums font-medium text-texto-secundario">{totales.cantidad}</span>{' '}
            {totales.cantidad === 1 ? 'presupuesto' : 'presupuestos'} ·{' '}
            <span className="tabular-nums font-medium text-texto-secundario">{formatoMoneda(totales.monto)}</span>
          </p>
        </div>
        <button
          onClick={() => router.push('/presupuestos?estado=orden_venta,confirmado_cliente')}
          className="text-xxs text-texto-terciario hover:text-texto-secundario flex items-center gap-1 transition-colors shrink-0 mt-1"
        >
          Ver todo <ArrowRight size={10} />
        </button>
      </div>

      {/* Filtro por estado */}
      <div className="flex items-center gap-1 mb-3">
        <button
          onClick={() => setFiltro('todos')}
          className={`px-2 py-0.5 text-xxs rounded-boton transition-colors ${filtro === 'todos' ? 'bg-superficie-hover text-texto-primario font-medium' : 'text-texto-terciario hover:text-texto-secundario'}`}
        >
          Todos ({items.length})
        </button>
        {contadorOrdenes > 0 && (
          <button
            onClick={() => setFiltro('orden_venta')}
            className={`px-2 py-0.5 text-xxs rounded-boton transition-colors ${filtro === 'orden_venta' ? 'bg-superficie-hover text-texto-primario font-medium' : 'text-texto-terciario hover:text-texto-secundario'}`}
          >
            Órdenes ({contadorOrdenes})
          </button>
        )}
        {contadorConfirmados > 0 && (
          <button
            onClick={() => setFiltro('confirmado_cliente')}
            className={`px-2 py-0.5 text-xxs rounded-boton transition-colors ${filtro === 'confirmado_cliente' ? 'bg-superficie-hover text-texto-primario font-medium' : 'text-texto-terciario hover:text-texto-secundario'}`}
          >
            Confirmados ({contadorConfirmados})
          </button>
        )}
      </div>

      {/* Lista */}
      <div className="space-y-0.5">
        <AnimatePresence initial={false}>
          {visibles.map((item, i) => (
            <motion.div
              key={item.id}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.02, duration: 0.2 }}
              onClick={() => router.push(`/presupuestos/${item.id}`)}
              className="flex items-center gap-2 py-1.5 px-1.5 rounded-boton hover:bg-superficie-hover/60 cursor-pointer transition-colors group"
              role="button"
              tabIndex={0}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); router.push(`/presupuestos/${item.id}`) } }}
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-xs font-medium text-texto-primario group-hover:text-texto-marca transition-colors">
                    {item.numero}
                  </span>
                  <Insignia color={COLOR_ESTADO[item.estado] || 'neutro'}>
                    {ETIQUETA_ESTADO[item.estado] || item.estado}
                  </Insignia>
                  <span className="text-xxs text-texto-terciario truncate">
                    · {[item.contacto_nombre, item.contacto_apellido].filter(Boolean).join(' ') || 'Sin contacto'}
                  </span>
                </div>
              </div>
              <div className="text-right shrink-0 flex items-center gap-3">
                <span className="text-xxs text-texto-terciario whitespace-nowrap tabular-nums">{fmtFecha(item.fecha)}</span>
                <span className="text-sm font-semibold text-texto-primario tabular-nums whitespace-nowrap">
                  {formatoMoneda(item.total)}
                </span>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Toggle expandir */}
      {hayMas && (
        <button
          onClick={() => setExpandido(e => !e)}
          className="mt-2 w-full flex items-center justify-center gap-1 text-xxs text-texto-terciario hover:text-texto-secundario py-1.5 rounded-boton hover:bg-superficie-hover/40 transition-colors"
        >
          <ChevronDown size={12} className={`transition-transform ${expandido ? 'rotate-180' : ''}`} />
          {expandido ? 'Ver menos' : `Ver ${filtrados.length - 6} más`}
        </button>
      )}
    </div>
  )
}
