'use client'

/**
 * VistaNomina — Pestaña de nómina dentro de Asistencias.
 * Selector de período, tabla de empleados con montos, adelantos, acciones.
 * Se usa en: ContenidoAsistencias.tsx (tab "Nómina")
 */

import { useState, useCallback, useMemo, useEffect } from 'react'
import { motion } from 'framer-motion'
import {
  ChevronLeft, ChevronRight, Users, Download, Send,
  Loader2, AlertTriangle, Banknote, Calendar,
} from 'lucide-react'
import { Boton } from '@/componentes/ui/Boton'
import { Insignia } from '@/componentes/ui/Insignia'
import { EstadoVacio } from '@/componentes/feedback/EstadoVacio'
import { ModalEnviarReciboNomina } from './ModalEnviarReciboNomina'
import { useFormato } from '@/hooks/useFormato'

// ─── Tipos ───

interface ResultadoNomina {
  miembro_id: string
  nombre: string
  correo: string
  telefono: string
  compensacion_tipo: string
  compensacion_monto: number
  compensacion_frecuencia?: string
  dias_laborales: number
  dias_trabajados: number
  dias_ausentes: number
  dias_tardanza: number
  horas_brutas: number
  horas_netas: number
  horas_almuerzo: number
  horas_particular: number
  horas_totales: number
  promedio_horas_diario: number
  dias_con_almuerzo: number
  dias_con_salida_particular: number
  descuenta_almuerzo: boolean
  duracion_almuerzo_config: number
  dias_feriados: number
  dias_trabajados_feriado: number
  monto_pagar: number
  monto_detalle: string
  descuento_adelanto: number
  cuotas_adelanto: number
  monto_neto: number
}

type TipoPeriodo = 'semana' | 'quincena' | 'mes'

// ─── Helpers de período ───

function calcularPeriodo(fecha: Date, tipo: TipoPeriodo): { desde: string; hasta: string; etiqueta: string } {
  const d = new Date(fecha)

  if (tipo === 'semana') {
    const dia = d.getDay()
    const lunes = new Date(d)
    lunes.setDate(d.getDate() - (dia === 0 ? 6 : dia - 1))
    const domingo = new Date(lunes)
    domingo.setDate(lunes.getDate() + 6)

    return {
      desde: lunes.toISOString().split('T')[0],
      hasta: domingo.toISOString().split('T')[0],
      etiqueta: `Semana ${lunes.getDate()}-${domingo.getDate()} de ${lunes.toLocaleDateString('es-AR', { month: 'long', year: 'numeric' })}`,
    }
  }

  if (tipo === 'quincena') {
    const dia = d.getDate()
    const mes = d.getMonth()
    const anio = d.getFullYear()

    if (dia <= 15) {
      return {
        desde: `${anio}-${String(mes + 1).padStart(2, '0')}-01`,
        hasta: `${anio}-${String(mes + 1).padStart(2, '0')}-15`,
        etiqueta: `Quincena 1-15 de ${d.toLocaleDateString('es-AR', { month: 'long', year: 'numeric' })}`,
      }
    } else {
      const ultimo = new Date(anio, mes + 1, 0).getDate()
      return {
        desde: `${anio}-${String(mes + 1).padStart(2, '0')}-16`,
        hasta: `${anio}-${String(mes + 1).padStart(2, '0')}-${ultimo}`,
        etiqueta: `Quincena 16-${ultimo} de ${d.toLocaleDateString('es-AR', { month: 'long', year: 'numeric' })}`,
      }
    }
  }

  // mes
  const mes = d.getMonth()
  const anio = d.getFullYear()
  const ultimo = new Date(anio, mes + 1, 0).getDate()
  return {
    desde: `${anio}-${String(mes + 1).padStart(2, '0')}-01`,
    hasta: `${anio}-${String(mes + 1).padStart(2, '0')}-${ultimo}`,
    etiqueta: d.toLocaleDateString('es-AR', { month: 'long', year: 'numeric' }).replace(/^\w/, c => c.toUpperCase()),
  }
}

function navegarPeriodo(fecha: Date, tipo: TipoPeriodo, dir: 'prev' | 'next'): Date {
  const d = new Date(fecha)
  const delta = dir === 'next' ? 1 : -1

  if (tipo === 'semana') d.setDate(d.getDate() + 7 * delta)
  else if (tipo === 'quincena') d.setDate(d.getDate() + 15 * delta)
  else d.setMonth(d.getMonth() + delta)

  return d
}

const fmtMonto = (n: number) =>
  `$${n.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`

const fmtHoras = (h: number) => {
  const hrs = Math.floor(h)
  const min = Math.round((h - hrs) * 60)
  return min > 0 ? `${hrs}h ${min}m` : `${hrs}h`
}

// ─── Componente ───

export function VistaNomina() {
  const { locale } = useFormato()

  const [tipoPeriodo, setTipoPeriodo] = useState<TipoPeriodo>('quincena')
  const [fechaRef, setFechaRef] = useState(new Date())
  const [cargando, setCargando] = useState(false)
  const [resultados, setResultados] = useState<ResultadoNomina[]>([])
  const [nombreEmpresa, setNombreEmpresa] = useState('')
  const [modalEnvio, setModalEnvio] = useState(false)

  const periodo = useMemo(() => calcularPeriodo(fechaRef, tipoPeriodo), [fechaRef, tipoPeriodo])

  // Cargar nómina
  const cargarNomina = useCallback(async () => {
    setCargando(true)
    try {
      const res = await fetch(`/api/asistencias/nomina?desde=${periodo.desde}&hasta=${periodo.hasta}`)
      const data = await res.json()
      setResultados(data.resultados || [])
      setNombreEmpresa(data.nombre_empresa || '')
    } catch { /* silenciar */ }
    setCargando(false)
  }, [periodo.desde, periodo.hasta])

  useEffect(() => { cargarNomina() }, [cargarNomina])

  // Totales
  const totalBruto = resultados.reduce((s, r) => s + r.monto_pagar, 0)
  const totalDescuento = resultados.reduce((s, r) => s + r.descuento_adelanto, 0)
  const totalNeto = resultados.reduce((s, r) => s + r.monto_neto, 0)
  const totalHoras = resultados.reduce((s, r) => s + r.horas_netas, 0)

  return (
    <div className="space-y-4 p-4 md:p-6">
      {/* ── Header: tipo de período + navegación ── */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          {(['semana', 'quincena', 'mes'] as TipoPeriodo[]).map(t => (
            <button
              key={t}
              onClick={() => setTipoPeriodo(t)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer border ${
                tipoPeriodo === t
                  ? 'bg-texto-marca/15 border-texto-marca/40 text-texto-marca'
                  : 'bg-white/[0.03] border-white/[0.06] text-texto-terciario hover:text-texto-secundario'
              }`}
            >
              {t === 'semana' ? 'Semana' : t === 'quincena' ? 'Quincena' : 'Mes'}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-3">
          <Boton variante="secundario" tamano="xs" soloIcono titulo="Anterior"
            icono={<ChevronLeft size={16} />}
            onClick={() => setFechaRef(navegarPeriodo(fechaRef, tipoPeriodo, 'prev'))}
          />
          <div className="text-center min-w-[200px]">
            <p className="text-sm font-semibold text-texto-primario">{periodo.etiqueta}</p>
            <p className="text-xxs text-texto-terciario">{periodo.desde} — {periodo.hasta}</p>
          </div>
          <Boton variante="secundario" tamano="xs" soloIcono titulo="Siguiente"
            icono={<ChevronRight size={16} />}
            onClick={() => setFechaRef(navegarPeriodo(fechaRef, tipoPeriodo, 'next'))}
          />
        </div>
      </div>

      {/* ── Resumen ── */}
      {!cargando && resultados.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="grid grid-cols-2 md:grid-cols-4 gap-3"
        >
          <div className="bg-superficie-tarjeta border border-borde-sutil rounded-xl p-4 text-center">
            <p className="text-2xl font-bold text-insignia-exito">{fmtMonto(totalNeto)}</p>
            <p className="text-xxs text-texto-terciario uppercase mt-1">Neto a pagar</p>
          </div>
          <div className="bg-superficie-tarjeta border border-borde-sutil rounded-xl p-4 text-center">
            <p className="text-2xl font-bold text-texto-primario">{fmtMonto(totalBruto)}</p>
            <p className="text-xxs text-texto-terciario uppercase mt-1">Bruto</p>
          </div>
          {totalDescuento > 0 && (
            <div className="bg-superficie-tarjeta border border-borde-sutil rounded-xl p-4 text-center">
              <p className="text-2xl font-bold text-insignia-advertencia">-{fmtMonto(totalDescuento)}</p>
              <p className="text-xxs text-texto-terciario uppercase mt-1">Adelantos</p>
            </div>
          )}
          <div className="bg-superficie-tarjeta border border-borde-sutil rounded-xl p-4 text-center">
            <p className="text-2xl font-bold text-texto-secundario">{fmtHoras(totalHoras)}</p>
            <p className="text-xxs text-texto-terciario uppercase mt-1">Horas totales</p>
          </div>
        </motion.div>
      )}

      {/* ── Acciones ── */}
      {!cargando && resultados.length > 0 && (
        <div className="flex items-center justify-between">
          <p className="text-xs text-texto-terciario">
            <Users size={12} className="inline mr-1" />
            {resultados.length} empleado{resultados.length !== 1 ? 's' : ''}
          </p>
          <div className="flex items-center gap-2">
            <Boton variante="secundario" tamano="sm" icono={<Download size={13} />}
              onClick={() => window.open(`/api/asistencias/exportar?desde=${periodo.desde}&hasta=${periodo.hasta}`, '_blank')}>
              Exportar
            </Boton>
            <Boton tamano="sm" icono={<Send size={13} />} onClick={() => setModalEnvio(true)}>
              Enviar recibos
            </Boton>
          </div>
        </div>
      )}

      {/* ── Tabla de empleados ── */}
      {cargando ? (
        <div className="flex items-center justify-center py-16 text-texto-terciario">
          <Loader2 size={20} className="animate-spin mr-2" />
          Calculando nómina...
        </div>
      ) : resultados.length === 0 ? (
        <EstadoVacio
          icono={<Banknote size={48} strokeWidth={1} />}
          titulo="Sin datos de nómina"
          descripcion="No hay empleados con compensación configurada para este período."
        />
      ) : (
        <div className="bg-superficie-tarjeta border border-borde-sutil rounded-xl overflow-hidden">
          {/* Header */}
          <div className="grid grid-cols-[1fr_80px_80px_100px_100px_100px] gap-2 px-4 py-2.5 border-b border-borde-sutil text-xxs text-texto-terciario uppercase tracking-wider font-semibold">
            <span>Empleado</span>
            <span className="text-right">Días</span>
            <span className="text-right">Horas</span>
            <span className="text-right">Bruto</span>
            <span className="text-right">Adelanto</span>
            <span className="text-right">Neto</span>
          </div>

          {/* Filas */}
          <div className="divide-y divide-borde-sutil">
            {resultados.map(r => (
              <div
                key={r.miembro_id}
                className="grid grid-cols-[1fr_80px_80px_100px_100px_100px] gap-2 px-4 py-3 items-center hover:bg-white/[0.02] transition-colors"
              >
                {/* Nombre */}
                <div>
                  <p className="text-sm font-medium text-texto-primario">{r.nombre}</p>
                  <p className="text-xxs text-texto-terciario">{r.monto_detalle}</p>
                </div>

                {/* Días */}
                <div className="text-right">
                  <p className="text-sm text-texto-primario">{r.dias_trabajados}/{r.dias_laborales}</p>
                  {r.dias_tardanza > 0 && (
                    <p className="text-xxs text-insignia-advertencia">{r.dias_tardanza} tard.</p>
                  )}
                </div>

                {/* Horas */}
                <p className="text-sm text-texto-secundario text-right">{fmtHoras(r.horas_netas)}</p>

                {/* Bruto */}
                <p className="text-sm font-medium text-texto-primario text-right">{fmtMonto(r.monto_pagar)}</p>

                {/* Adelanto */}
                <div className="text-right">
                  {r.descuento_adelanto > 0 ? (
                    <Insignia color="advertencia" tamano="sm">
                      -{fmtMonto(r.descuento_adelanto)}
                    </Insignia>
                  ) : (
                    <span className="text-xxs text-texto-terciario">—</span>
                  )}
                </div>

                {/* Neto */}
                <p className="text-sm font-bold text-insignia-exito text-right">{fmtMonto(r.monto_neto)}</p>
              </div>
            ))}
          </div>

          {/* Footer totales */}
          <div className="grid grid-cols-[1fr_80px_80px_100px_100px_100px] gap-2 px-4 py-3 border-t border-borde-sutil bg-white/[0.02]">
            <p className="text-sm font-semibold text-texto-primario">Total</p>
            <span />
            <p className="text-sm text-texto-secundario text-right">{fmtHoras(totalHoras)}</p>
            <p className="text-sm font-medium text-texto-primario text-right">{fmtMonto(totalBruto)}</p>
            <p className="text-sm text-insignia-advertencia text-right">
              {totalDescuento > 0 ? `-${fmtMonto(totalDescuento)}` : '—'}
            </p>
            <p className="text-sm font-bold text-insignia-exito text-right">{fmtMonto(totalNeto)}</p>
          </div>
        </div>
      )}

      {/* Modal envío de recibos */}
      <ModalEnviarReciboNomina
        abierto={modalEnvio}
        onCerrar={() => setModalEnvio(false)}
        resultados={resultados}
        etiquetaPeriodo={periodo.etiqueta}
        nombreEmpresa={nombreEmpresa}
      />
    </div>
  )
}
