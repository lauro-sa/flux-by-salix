'use client'

/**
 * Mini-resumen de métricas para el TabResumen del perfil.
 * Muestra 4 KPIs del mes actual con un link al tab "Métricas" completo.
 *
 * Datos: GET /api/miembros/[id]/metricas (mismo endpoint, solo se usan los del mes actual).
 */

import { useEffect, useState } from 'react'
import { MapPin, FileText, Wrench, Wallet, ChevronRight, Loader2 } from 'lucide-react'
import { Tarjeta } from '@/componentes/ui/Tarjeta'
import { Boton } from '@/componentes/ui/Boton'
import { useFormato } from '@/hooks/useFormato'
import type { TabPerfil } from './constantes'

interface MetricasMini {
  sin_cuenta: boolean
  visitas?: { mes_actual: { total: number } }
  presupuestos?: { mes_actual: { total: number; monto: number } }
  ordenes?: { mes_actual: { total: number; horas: number } }
  pagos?: { mes_actual: { total: number; monto: number } }
}

export function ResumenMetricasMini({ miembroId, setTab }: { miembroId: string; setTab: (t: TabPerfil) => void }) {
  const fmt = useFormato()
  const [metricas, setMetricas] = useState<MetricasMini | null>(null)
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    setCargando(true)
    fetch(`/api/miembros/${miembroId}/metricas?meses=1`)
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(setMetricas)
      .catch(() => setMetricas(null))
      .finally(() => setCargando(false))
  }, [miembroId])

  if (cargando) {
    return (
      <Tarjeta titulo="Actividad este mes">
        <div className="flex items-center justify-center py-6">
          <Loader2 size={18} className="animate-spin text-texto-terciario" />
        </div>
      </Tarjeta>
    )
  }

  if (!metricas || metricas.sin_cuenta) return null

  const v = metricas.visitas?.mes_actual.total ?? 0
  const p = metricas.presupuestos?.mes_actual.total ?? 0
  const pMonto = metricas.presupuestos?.mes_actual.monto ?? 0
  const o = metricas.ordenes?.mes_actual.total ?? 0
  const oHoras = metricas.ordenes?.mes_actual.horas ?? 0
  const cobrado = metricas.pagos?.mes_actual.monto ?? 0

  return (
    <Tarjeta
      titulo="Actividad este mes"
      acciones={
        <Boton
          variante="fantasma"
          tamano="xs"
          onClick={() => setTab('metricas')}
          iconoDerecho={<ChevronRight size={14} />}
        >
          Ver detalle
        </Boton>
      }
    >
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <ItemMini icono={<MapPin size={14} />} etiqueta="Visitas" valor={v} sub="asignadas" />
        <ItemMini icono={<FileText size={14} />} etiqueta="Presupuestos" valor={p} sub={pMonto > 0 ? fmt.moneda(pMonto) : 'sin emitir'} />
        <ItemMini icono={<Wrench size={14} />} etiqueta="Órdenes" valor={o} sub={`${oHoras} hs`} />
        <ItemMini icono={<Wallet size={14} />} etiqueta="Cobrado" valor={cobrado > 0 ? fmt.moneda(cobrado) : '—'} sub="este mes" esTexto />
      </div>
    </Tarjeta>
  )
}

function ItemMini({ icono, etiqueta, valor, sub, esTexto }: {
  icono: React.ReactNode
  etiqueta: string
  valor: number | string
  sub: string
  esTexto?: boolean
}) {
  return (
    <div className="flex items-center gap-3 p-2.5 rounded-card bg-superficie-app/60 border border-borde-sutil/50">
      <div className="size-8 rounded-card bg-superficie-tarjeta flex items-center justify-center text-texto-secundario shrink-0">
        {icono}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[11px] text-texto-terciario uppercase tracking-wide font-medium truncate">{etiqueta}</p>
        <p className={`font-bold text-texto-primario tabular-nums ${esTexto ? 'text-sm' : 'text-lg leading-tight'}`}>
          {typeof valor === 'number' ? valor.toLocaleString('es-AR') : valor}
        </p>
        <p className="text-[11px] text-texto-terciario/80 truncate">{sub}</p>
      </div>
    </div>
  )
}
