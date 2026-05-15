'use client'

/**
 * VistaEmpleados — Listado de empleados con su contrato vigente.
 *
 * Pensada para la pestaña "Empleados" de /nominas (PR 5 del plan).
 * Click en una fila navega a la ficha laboral
 * (`/nominas/empleado/[miembro_id]`).
 *
 * Por ahora soporta búsqueda por nombre y filtros básicos por
 * modalidad y régimen (los más demandados). Sector y turno se
 * filtrarán cuando se sume el patrón estándar de filtros avanzados.
 */

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Users, ChevronRight, Loader2 } from 'lucide-react'
import { Input } from '@/componentes/ui/Input'
import { Insignia } from '@/componentes/ui/Insignia'
import { EstadoVacio } from '@/componentes/feedback/EstadoVacio'

interface ContratoResumen {
  id: string
  miembro_id: string
  modalidad_calculo: string
  monto_base: number
  frecuencia_pago: string
  regimen: string
  condicion: string
  fecha_inicio: string
  fecha_fin: string | null
  vigente: boolean
  sector_id: string | null
  turno_id: string | null
}

interface FilaEmpleado {
  miembro_id: string
  nombre: string
  apellido: string
  numero_empleado: number | null
  contrato: ContratoResumen | null
  terminado: boolean
  sector: { id: string; nombre: string; color: string } | null
  turno: { id: string; nombre: string } | null
}

type FiltroEstado = 'activos' | 'terminados' | 'todos'

const ETIQUETAS_MODALIDAD: Record<string, string> = {
  por_hora: 'Por hora',
  por_dia: 'Por día',
  fijo_semanal: 'Fijo semanal',
  fijo_quincenal: 'Fijo quincenal',
  fijo_mensual: 'Fijo mensual',
}

function formatearMonto(v: number) {
  return `$ ${v.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

/** Normaliza para búsqueda: minúsculas + sin acentos. */
function normalizar(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
}

export function VistaEmpleados() {
  const router = useRouter()
  const [empleados, setEmpleados] = useState<FilaEmpleado[]>([])
  const [cargando, setCargando] = useState(true)
  const [busqueda, setBusqueda] = useState('')
  const [estado, setEstado] = useState<FiltroEstado>('activos')

  useEffect(() => {
    let cancelado = false
    setCargando(true)
    fetch(`/api/nominas/empleados?estado=${estado}`)
      .then(r => r.json())
      .then((data) => {
        if (cancelado) return
        setEmpleados((data.empleados ?? []) as FilaEmpleado[])
      })
      .catch(err => {
        console.error('[VistaEmpleados] error', err)
      })
      .finally(() => { if (!cancelado) setCargando(false) })
    return () => { cancelado = true }
  }, [estado])

  const filtrados = useMemo(() => {
    if (!busqueda.trim()) return empleados
    const q = normalizar(busqueda)
    return empleados.filter(e => {
      const nombreCompleto = normalizar(`${e.nombre} ${e.apellido}`)
      return nombreCompleto.includes(q) || String(e.numero_empleado ?? '').includes(q)
    })
  }, [empleados, busqueda])

  if (cargando) {
    return (
      <div className="flex items-center justify-center py-16 text-texto-terciario">
        <Loader2 size={20} className="animate-spin" />
      </div>
    )
  }

  // Segmented Activos/Terminados/Todos siempre visible (incluso si la
  // lista actual quedó vacía por el filtro) para que el usuario pueda
  // cambiar de subconjunto sin recargar.
  const segmented = (
    <div className="inline-flex p-0.5 rounded-boton bg-superficie-elevada border border-borde-sutil">
      {([
        { v: 'activos' as const, et: 'Activos' },
        { v: 'terminados' as const, et: 'Terminados' },
        { v: 'todos' as const, et: 'Todos' },
      ]).map(o => {
        const activo = estado === o.v
        return (
          <button
            key={o.v}
            type="button"
            onClick={() => setEstado(o.v)}
            className={`h-7 px-3 text-xs font-medium rounded-[5px] transition-colors ${
              activo
                ? 'bg-texto-marca/15 text-texto-marca'
                : 'text-texto-terciario hover:text-texto-primario'
            }`}
          >
            {o.et}
          </button>
        )
      })}
    </div>
  )

  if (empleados.length === 0) {
    return (
      <div className="px-4 md:px-6 py-4 space-y-3">
        <div className="flex items-center gap-3 flex-wrap">{segmented}</div>
        <EstadoVacio
          icono={<Users size={48} strokeWidth={1.5} />}
          titulo={
            estado === 'activos' ? 'Sin empleados activos' :
            estado === 'terminados' ? 'Sin empleados terminados' :
            'Sin empleados todavía'
          }
          descripcion={
            estado === 'activos'
              ? 'No hay empleados con contrato vigente. Cargá un contrato a un miembro para verlo acá.'
              : estado === 'terminados'
                ? 'Cuando termines el contrato de un empleado, va a aparecer en esta vista.'
                : 'Cuando agregues miembros con compensación a la empresa, van a aparecer acá con su contrato laboral vigente.'
          }
        />
      </div>
    )
  }

  return (
    <div className="px-4 md:px-6 py-4 space-y-3">
      <div className="flex items-center gap-3 flex-wrap">
        {segmented}
        <div className="max-w-md flex-1 min-w-[220px]">
          <Input
            placeholder="Buscar por nombre o N° de empleado..."
            value={busqueda}
            onChange={e => setBusqueda(e.target.value)}
          />
        </div>
      </div>

      <div className="rounded-card border border-borde-sutil overflow-hidden">
        {/* Header */}
        <div className="grid grid-cols-[1fr_120px_120px_120px_24px] gap-3 px-4 py-2.5 bg-superficie-elevada/50 border-b border-borde-sutil text-[11px] font-medium text-texto-terciario uppercase tracking-wider">
          <div>Empleado</div>
          <div>Modalidad</div>
          <div className="text-right">Monto base</div>
          <div>Sector / Turno</div>
          <div></div>
        </div>

        {filtrados.length === 0 ? (
          <div className="py-8 text-center text-sm text-texto-terciario">
            No hay empleados que coincidan con la búsqueda.
          </div>
        ) : (
          filtrados.map(e => (
            <button
              key={e.miembro_id}
              type="button"
              onClick={() => router.push(`/nominas/empleado/${e.miembro_id}`)}
              className={`w-full grid grid-cols-[1fr_120px_120px_120px_24px] gap-3 items-center px-4 py-3 hover:bg-superficie-elevada/30 transition-colors text-left border-b border-borde-sutil last:border-b-0 ${
                e.terminado ? 'opacity-65' : ''
              }`}
            >
              {/* Empleado */}
              <div className="min-w-0">
                <div className="text-sm font-medium text-texto-primario truncate flex items-center gap-2">
                  <span className="truncate">{e.nombre} {e.apellido}</span>
                  {e.terminado && (
                    <Insignia color="peligro" tamano="sm">Terminado</Insignia>
                  )}
                </div>
                {e.numero_empleado !== null && (
                  <div className="text-xs text-texto-terciario">N° {e.numero_empleado}</div>
                )}
              </div>

              {/* Modalidad */}
              <div className="text-xs text-texto-secundario">
                {e.contrato
                  ? ETIQUETAS_MODALIDAD[e.contrato.modalidad_calculo] ?? e.contrato.modalidad_calculo
                  : <span className="text-texto-terciario italic">Sin contrato</span>}
              </div>

              {/* Monto base */}
              <div className="text-sm font-mono text-texto-primario text-right tabular-nums">
                {e.contrato ? formatearMonto(e.contrato.monto_base) : '—'}
              </div>

              {/* Sector / Turno */}
              <div className="text-xs text-texto-secundario truncate">
                <div className="flex items-center gap-1.5">
                  {e.sector?.color && (
                    <span
                      className="inline-block w-2 h-2 rounded-full shrink-0"
                      style={{ background: e.sector.color }}
                    />
                  )}
                  <span className="truncate">{e.sector?.nombre ?? '—'}</span>
                </div>
                <div className="truncate text-texto-terciario">{e.turno?.nombre ?? '—'}</div>
              </div>

              {/* Chevron */}
              <ChevronRight size={14} className="text-texto-terciario justify-self-end" />
            </button>
          ))
        )}
      </div>
    </div>
  )
}
