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
  sector_id: string | null
  turno_id: string | null
}

interface FilaEmpleado {
  miembro_id: string
  nombre: string
  apellido: string
  numero_empleado: number | null
  contrato: ContratoResumen | null
  sector: { id: string; nombre: string; color: string } | null
  turno: { id: string; nombre: string } | null
}

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

  useEffect(() => {
    let cancelado = false
    setCargando(true)
    fetch('/api/nominas/empleados')
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
  }, [])

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

  if (empleados.length === 0) {
    return (
      <EstadoVacio
        icono={<Users size={48} strokeWidth={1.5} />}
        titulo="Sin empleados todavía"
        descripcion="Cuando agregues miembros con compensación a la empresa, van a aparecer acá con su contrato laboral vigente."
      />
    )
  }

  return (
    <div className="px-4 md:px-6 py-4 space-y-3">
      <div className="max-w-md">
        <Input
          placeholder="Buscar por nombre o N° de empleado..."
          value={busqueda}
          onChange={e => setBusqueda(e.target.value)}
        />
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
              className="w-full grid grid-cols-[1fr_120px_120px_120px_24px] gap-3 items-center px-4 py-3 hover:bg-superficie-elevada/30 transition-colors text-left border-b border-borde-sutil last:border-b-0"
            >
              {/* Empleado */}
              <div className="min-w-0">
                <div className="text-sm font-medium text-texto-primario truncate">
                  {e.nombre} {e.apellido}
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
