'use client'

/**
 * VistaNomina — Pestaña de nómina dentro de Asistencias.
 * Selector de período, tabla de empleados con montos, adelantos, acciones.
 * Se usa en: ContenidoAsistencias.tsx (tab "Nómina")
 */

import { useState, useCallback, useMemo, useEffect, useRef, forwardRef, useImperativeHandle, type ReactNode } from 'react'
import { motion } from 'framer-motion'
import { Users, Loader2, Banknote } from 'lucide-react'
import { Boton } from '@/componentes/ui/Boton'
import { GrupoBotones } from '@/componentes/ui/GrupoBotones'
import { EstadoVacio } from '@/componentes/feedback/EstadoVacio'
import { CabezaloHero, HeroRango } from '@/componentes/entidad/CabezaloHero'
import { ModalEnviarReciboNomina } from './ModalEnviarReciboNomina'
import { ModalDetalleNomina } from './ModalDetalleNomina'

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
  saldo_anterior: number
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

// ─── Tipos del handle ───

export interface VistaNominaHandle {
  exportar: () => void
  enviarRecibos: () => void
}

// ─── Componente ───

interface VistaNominaProps {
  /** Slot opcional para renderizar los tabs entre el hero y los controles */
  slotTabs?: ReactNode
}

export const VistaNomina = forwardRef<VistaNominaHandle, VistaNominaProps>(function VistaNomina({ slotTabs }, ref) {
  const [tipoPeriodo, setTipoPeriodo] = useState<TipoPeriodo>('mes')
  const [fechaRef, setFechaRef] = useState(new Date())
  const [cargando, setCargando] = useState(false)
  const [resultados, setResultados] = useState<ResultadoNomina[]>([])
  const [nombreEmpresa, setNombreEmpresa] = useState('')
  const [modalEnvio, setModalEnvio] = useState(false)
  const [empleadoSeleccionado, setEmpleadoSeleccionado] = useState<ResultadoNomina | null>(null)

  const periodo = useMemo(() => calcularPeriodo(fechaRef, tipoPeriodo), [fechaRef, tipoPeriodo])

  // Fechas como Date para el hero editorial
  const desdeDate = useMemo(() => new Date(periodo.desde + 'T12:00:00'), [periodo.desde])
  const hastaDate = useMemo(() => new Date(periodo.hasta + 'T12:00:00'), [periodo.hasta])

  // ¿Estamos en el período actual? (para deshabilitar "Hoy")
  const enPeriodoActual = useMemo(() => {
    const hoy = calcularPeriodo(new Date(), tipoPeriodo)
    return hoy.desde === periodo.desde && hoy.hasta === periodo.hasta
  }, [tipoPeriodo, periodo.desde, periodo.hasta])

  // Exponer acciones al cabezal via ref
  useImperativeHandle(ref, () => ({
    exportar: () => window.open(`/api/asistencias/exportar?desde=${periodo.desde}&hasta=${periodo.hasta}`, '_blank'),
    enviarRecibos: () => setModalEnvio(true),
  }), [periodo.desde, periodo.hasta])

  // Cache de resultados por período
  const cacheRef = useRef<Map<string, { resultados: ResultadoNomina[]; nombreEmpresa: string }>>(new Map())
  const cacheKey = `${periodo.desde}_${periodo.hasta}`

  // Cargar nómina (con cache)
  const cargarNomina = useCallback(async () => {
    // Si ya tenemos cache para este período, usar directo
    const cached = cacheRef.current.get(cacheKey)
    if (cached) {
      setResultados(cached.resultados)
      setNombreEmpresa(cached.nombreEmpresa)
      return
    }

    setCargando(true)
    try {
      const res = await fetch(`/api/asistencias/nomina?desde=${periodo.desde}&hasta=${periodo.hasta}`)
      const data = await res.json()
      const r = data.resultados || []
      const n = data.nombre_empresa || ''
      setResultados(r)
      setNombreEmpresa(n)
      // Guardar en cache
      cacheRef.current.set(cacheKey, { resultados: r, nombreEmpresa: n })
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
    <div>
      <CabezaloHero
        titulo={<HeroRango desde={desdeDate} hasta={hastaDate} periodo={tipoPeriodo} />}
        onAnterior={() => setFechaRef(navegarPeriodo(fechaRef, tipoPeriodo, 'prev'))}
        onSiguiente={() => setFechaRef(navegarPeriodo(fechaRef, tipoPeriodo, 'next'))}
        onHoy={() => setFechaRef(new Date())}
        hoyDeshabilitado={enPeriodoActual}
        slotTabs={slotTabs}
        slotControles={
          <GrupoBotones>
            {(['mes', 'quincena', 'semana'] as TipoPeriodo[]).map(t => (
              <Boton
                key={t}
                variante="secundario"
                tamano="sm"
                onClick={() => setTipoPeriodo(t)}
                className={tipoPeriodo === t ? 'bg-superficie-hover text-texto-primario font-semibold' : 'text-texto-terciario'}
              >
                {t === 'semana' ? 'Semana' : t === 'quincena' ? 'Quincena' : 'Mes'}
              </Boton>
            ))}
          </GrupoBotones>
        }
      />

      {/* Contenido principal */}
      <div className="px-4 md:px-6 pb-4 md:pb-6 space-y-4">

      {/* ── Resumen ── */}
      {!cargando && resultados.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="grid grid-cols-2 md:grid-cols-4 gap-3"
        >
          <div className="bg-superficie-tarjeta border border-borde-sutil rounded-card p-4 text-center">
            <p className="text-2xl font-bold text-texto-primario">{fmtMonto(totalBruto)}</p>
            <p className="text-xxs text-texto-terciario uppercase mt-1">Costo empresa</p>
          </div>
          {totalDescuento > 0 && (
            <div className="bg-superficie-tarjeta border border-borde-sutil rounded-card p-4 text-center">
              <p className="text-2xl font-bold text-insignia-advertencia">-{fmtMonto(totalDescuento)}</p>
              <p className="text-xxs text-texto-terciario uppercase mt-1">Adelantos</p>
            </div>
          )}
          <div className="bg-superficie-tarjeta border border-borde-sutil rounded-card p-4 text-center">
            <p className="text-2xl font-bold text-insignia-exito">{fmtMonto(totalNeto)}</p>
            <p className="text-xxs text-texto-terciario uppercase mt-1">A transferir</p>
          </div>
          <div className="bg-superficie-tarjeta border border-borde-sutil rounded-card p-4 text-center">
            <p className="text-2xl font-bold text-texto-secundario">{fmtHoras(totalHoras)}</p>
            <p className="text-xxs text-texto-terciario uppercase mt-1">Horas totales</p>
          </div>
        </motion.div>
      )}

      {/* ── Contador empleados ── */}
      {!cargando && resultados.length > 0 && (
        <div className="flex items-center">
          <p className="text-xs text-texto-terciario">
            <Users size={12} className="inline mr-1" />
            {resultados.length} empleado{resultados.length !== 1 ? 's' : ''}
          </p>
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
        <div className="bg-superficie-tarjeta border border-borde-sutil rounded-card overflow-hidden">
          {/* Header */}
          <div className="grid grid-cols-[1fr_70px_80px_110px_100px_110px] gap-3 px-5 py-3 border-b border-white/[0.07]">
            <span className="text-[11px] font-semibold text-texto-terciario uppercase tracking-wider">Empleado</span>
            <span className="text-[11px] font-semibold text-texto-terciario uppercase tracking-wider text-center">Días</span>
            <span className="text-[11px] font-semibold text-texto-terciario uppercase tracking-wider text-right">Horas</span>
            <span className="text-[11px] font-semibold text-texto-terciario uppercase tracking-wider text-right">Bruto</span>
            <span className="text-[11px] font-semibold text-texto-terciario uppercase tracking-wider text-right">Adelanto</span>
            <span className="text-[11px] font-semibold text-texto-terciario uppercase tracking-wider text-right">Neto</span>
          </div>

          {/* Filas */}
          <div className="divide-y divide-white/[0.04]">
            {resultados.map(r => (
              <div
                key={r.miembro_id}
                onClick={() => setEmpleadoSeleccionado(r)}
                className="grid grid-cols-[1fr_70px_80px_110px_100px_110px] gap-3 px-5 py-3.5 items-center hover:bg-white/[0.03] transition-colors cursor-pointer group"
              >
                {/* Nombre */}
                <div>
                  <p className="text-[13px] font-semibold text-texto-primario group-hover:text-texto-marca transition-colors">{r.nombre}</p>
                  <p className="text-[11px] text-texto-terciario mt-0.5">{r.monto_detalle}</p>
                </div>

                {/* Días */}
                <div className="text-center">
                  <p className="text-[13px] font-medium text-texto-primario">
                    {r.dias_trabajados}<span className="text-texto-terciario font-normal">/{r.dias_laborales}</span>
                  </p>
                  {r.dias_tardanza > 0 && (
                    <p className="text-[10px] text-insignia-advertencia mt-0.5">{r.dias_tardanza} tard.</p>
                  )}
                </div>

                {/* Horas */}
                <p className="text-[13px] text-texto-terciario text-right">{fmtHoras(r.horas_netas)}</p>

                {/* Bruto */}
                <p className="text-[13px] text-texto-secundario text-right">{fmtMonto(r.monto_pagar)}</p>

                {/* Adelanto */}
                <div className="text-right">
                  {r.descuento_adelanto > 0 ? (
                    <span className="text-[12px] font-medium text-insignia-advertencia">-{fmtMonto(r.descuento_adelanto)}</span>
                  ) : (
                    <span className="text-[11px] text-texto-terciario/40">—</span>
                  )}
                </div>

                {/* Neto */}
                <p className="text-[14px] font-bold text-insignia-exito text-right">{fmtMonto(r.monto_neto)}</p>
              </div>
            ))}
          </div>

          {/* Footer totales */}
          <div className="grid grid-cols-[1fr_70px_80px_110px_100px_110px] gap-3 px-5 py-3.5 border-t border-white/[0.1] bg-white/[0.02]">
            <p className="text-[13px] font-bold text-texto-primario">Total</p>
            <span />
            <p className="text-[12px] text-texto-terciario text-right">{fmtHoras(totalHoras)}</p>
            <p className="text-[13px] font-semibold text-texto-primario text-right">{fmtMonto(totalBruto)}</p>
            <p className="text-[12px] font-medium text-insignia-advertencia text-right">
              {totalDescuento > 0 ? `-${fmtMonto(totalDescuento)}` : '—'}
            </p>
            <p className="text-[15px] font-bold text-insignia-exito text-right">{fmtMonto(totalNeto)}</p>
          </div>
        </div>
      )}
      </div>

      {/* Modal detalle de empleado */}
      <ModalDetalleNomina
        abierto={!!empleadoSeleccionado}
        onCerrar={() => setEmpleadoSeleccionado(null)}
        empleado={empleadoSeleccionado}
        periodo={periodo}
        nombreEmpresa={nombreEmpresa}
        onActualizado={() => { cacheRef.current.clear(); cargarNomina() }}
      />

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
})
