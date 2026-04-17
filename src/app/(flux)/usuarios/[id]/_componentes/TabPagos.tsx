'use client'

/**
 * Tab Pagos — compensación (acordeón editable), período actual,
 * historial de pagos y modal de liquidación.
 */

import { useState, useRef, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Calendar, CalendarDays,
  ChevronLeft, DollarSign,
  Plus, ChevronRight, ChevronDown,
  Pencil, Receipt, Banknote,
  Landmark, FileText, FileUp,
  X, Trash2,
} from 'lucide-react'
import { Input } from '@/componentes/ui/Input'
import { InputMoneda } from '@/componentes/ui/InputMoneda'
import { Boton } from '@/componentes/ui/Boton'
import { Insignia } from '@/componentes/ui/Insignia'
import { Tarjeta } from '@/componentes/ui/Tarjeta'
import { EstadoVacio } from '@/componentes/feedback/EstadoVacio'
import { ModalAdaptable as Modal } from '@/componentes/ui/ModalAdaptable'
import { SelectorFecha } from '@/componentes/ui/SelectorFecha'
import type { Miembro, Perfil, CompensacionTipo, CompensacionFrecuencia } from '@/tipos'
import {
  ETIQUETA_FRECUENCIA,
  navegarPeriodo, obtenerPeriodo,
  type Periodo,
} from './constantes'

interface PropsTabPagos {
  miembro: Miembro
  perfil: Perfil
  puedeEditar: boolean
  esPropietario: boolean
  esAdmin: boolean
  /* Compensación */
  compensacionTipo: string
  compensacionMonto: number
  compensacionFrecuencia: string
  diasTrabajo: number
  proyeccionMensual: number
  proyeccionPorFrecuencia: number
  montoPagar: number
  /* Stats del período activo */
  statsPeriodo: { habiles: number; trabajados: number; ausentes: number; tardanzas: number }
  /* Período */
  periodoActual: Periodo
  /* Pagos */
  pagos: Record<string, unknown>[]
  cargandoPagos: boolean
  /* Asistencias del período */
  cargandoAsistencias: boolean
  /* Setters */
  setMiembro: React.Dispatch<React.SetStateAction<Miembro | null>>
  guardarMiembroInmediato: (datos: Record<string, unknown>) => void
  /* Callbacks */
  cargarPagos: () => void
  cargarAsistenciasPeriodo: (inicio: Date, fin: Date) => void
  eliminarPago: (pagoId: string) => void
  registrarPago: (datos: {
    concepto: string
    monto: string
    notas: string
    comprobante: File | null
    periodo: Periodo
  }) => Promise<void>
  /* Adelantos */
  adelantos: Record<string, unknown>[]
  cargandoAdelantos: boolean
  crearAdelanto: (datos: {
    monto_total: number
    cuotas_totales: number
    notas: string
    fecha_inicio_descuento: string
  }) => Promise<void>
  cancelarAdelanto: (adelantoId: string) => Promise<void>
  /* Formatter */
  fmt: {
    fecha: (v: string | Date, opts?: Record<string, unknown>) => string
    moneda: (v: number) => string
    locale: string
  }
  t: (key: string) => string
}

export function TabPagos({
  miembro, perfil, puedeEditar, esPropietario, esAdmin,
  compensacionTipo, compensacionMonto, compensacionFrecuencia,
  diasTrabajo, proyeccionMensual, proyeccionPorFrecuencia, montoPagar,
  statsPeriodo,
  periodoActual,
  pagos, cargandoPagos,
  cargandoAsistencias,
  setMiembro, guardarMiembroInmediato,
  cargarPagos, cargarAsistenciasPeriodo, eliminarPago, registrarPago,
  adelantos, cargandoAdelantos, crearAdelanto, cancelarAdelanto,
  fmt, t,
}: PropsTabPagos) {
  /* ── Estado local: modal adelanto ── */
  const [modalAdelanto, setModalAdelanto] = useState(false)
  const [guardandoAdelanto, setGuardandoAdelanto] = useState(false)
  const [adelantoMonto, setAdelantoMonto] = useState('')
  const [adelantoCuotas, setAdelantoCuotas] = useState('1')
  const [adelantoNotas, setAdelantoNotas] = useState('')
  const [adelantoFechaInicio, setAdelantoFechaInicio] = useState('')

  const adelantosActivos = adelantos.filter(a => (a.estado as string) === 'activo')

  const handleCrearAdelanto = async () => {
    const monto = parseFloat(adelantoMonto)
    if (!monto || monto <= 0) return
    setGuardandoAdelanto(true)
    await crearAdelanto({
      monto_total: monto,
      cuotas_totales: parseInt(adelantoCuotas) || 1,
      notas: adelantoNotas,
      fecha_inicio_descuento: adelantoFechaInicio || new Date().toISOString().split('T')[0],
    })
    setGuardandoAdelanto(false)
    setModalAdelanto(false)
    setAdelantoMonto(''); setAdelantoCuotas('1'); setAdelantoNotas(''); setAdelantoFechaInicio('')
  }

  /* ── Estado local: acordeón compensación ── */
  const [compensacionAbierta, setCompensacionAbierta] = useState(false)
  const compensacionRef = useRef<HTMLDivElement>(null)

  /* ── Estado local: modal liquidación ── */
  const [modalLiquidacion, setModalLiquidacion] = useState(false)
  const [guardandoPago, setGuardandoPago] = useState(false)
  const [liqConcepto, setLiqConcepto] = useState('')
  const [liqMonto, setLiqMonto] = useState('')
  const [liqNotas, setLiqNotas] = useState('')
  const [periodoModal, setPeriodoModal] = useState<Periodo | null>(null)
  const [rangoPersonalizado, setRangoPersonalizado] = useState(false)
  const [rangoInicio, setRangoInicio] = useState('')
  const [rangoFin, setRangoFin] = useState('')
  const [archivoComprobante, setArchivoComprobante] = useState<File | null>(null)
  const [subiendoComprobante, setSubiendoComprobante] = useState(false)
  const inputComprobanteRef = useRef<HTMLInputElement>(null)

  /* Cerrar compensación al hacer click afuera */
  useEffect(() => {
    if (!compensacionAbierta) return
    const handler = (e: MouseEvent) => {
      if (compensacionRef.current && !compensacionRef.current.contains(e.target as Node)) {
        setCompensacionAbierta(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [compensacionAbierta])

  /* Cargar asistencias al abrir modal o cambiar período */
  useEffect(() => {
    if (modalLiquidacion && periodoModal) {
      cargarAsistenciasPeriodo(periodoModal.inicio, periodoModal.fin)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modalLiquidacion, periodoModal])

  /* Inicializar modal al abrir */
  const hoy = new Date()
  useEffect(() => {
    if (modalLiquidacion && !periodoModal) {
      const periodo = obtenerPeriodo(hoy, compensacionFrecuencia, fmt.locale)
      setPeriodoModal(periodo)
      setLiqConcepto(periodo.etiqueta)
      setLiqMonto(String(montoPagar))
    }
  }, [modalLiquidacion]) // eslint-disable-line react-hooks/exhaustive-deps

  /* Actualizar concepto al navegar períodos */
  useEffect(() => {
    if (periodoModal) {
      setLiqConcepto(periodoModal.etiqueta)
    }
  }, [periodoModal])

  /* Actualizar monto al cambiar montoPagar */
  useEffect(() => {
    if (modalLiquidacion) {
      setLiqMonto(String(montoPagar))
    }
  }, [montoPagar, modalLiquidacion])

  /** Genera etiqueta descriptiva para un rango y aplica como período del modal */
  const aplicarRangoCustom = useCallback((inicioStr: string, finStr: string) => {
    const inicio = new Date(inicioStr + 'T00:00:00')
    const fin = new Date(finStr + 'T00:00:00')
    if (inicio > fin) return

    const dInicio = inicio.getDate()
    const dFin = fin.getDate()
    const mesInicio = inicio.toLocaleDateString(fmt.locale, { month: 'long' })
    const mesFin = fin.toLocaleDateString(fmt.locale, { month: 'long' })
    const anioFin = fin.getFullYear()
    const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

    let etiqueta: string
    if (inicio.getMonth() === fin.getMonth() && inicio.getFullYear() === fin.getFullYear()) {
      etiqueta = `${dInicio} al ${dFin} de ${cap(mesFin)} ${anioFin}`
    } else {
      etiqueta = `${dInicio} de ${cap(mesInicio)} al ${dFin} de ${cap(mesFin)} ${anioFin}`
    }

    setPeriodoModal({ inicio, fin, etiqueta })
    setLiqConcepto(etiqueta)
  }, [fmt.locale])

  /* Handler para registrar pago */
  const handleRegistrarPago = async () => {
    if (!periodoModal) return
    setGuardandoPago(true)
    setSubiendoComprobante(!!archivoComprobante)
    try {
      await registrarPago({
        concepto: liqConcepto,
        monto: liqMonto,
        notas: liqNotas,
        comprobante: archivoComprobante,
        periodo: periodoModal,
      })
      setModalLiquidacion(false)
      setLiqConcepto(''); setLiqMonto(''); setLiqNotas('')
      setArchivoComprobante(null); setPeriodoModal(null)
      setRangoPersonalizado(false)
    } finally {
      setGuardandoPago(false)
      setSubiendoComprobante(false)
    }
  }

  const cerrarModal = () => {
    setModalLiquidacion(false)
    setLiqConcepto(''); setLiqMonto(''); setLiqNotas('')
    setArchivoComprobante(null); setPeriodoModal(null)
    setRangoPersonalizado(false)
  }

  return (
    <div className="space-y-6">

      {/* ── COMPENSACION -- acordeón: click para expandir, click afuera para cerrar ── */}
      <div ref={compensacionRef}>
        <Tarjeta titulo={t('usuarios.compensacion')} acciones={puedeEditar && !compensacionAbierta ? <Boton variante="fantasma" tamano="xs" icono={<Pencil size={13} />} onClick={() => setCompensacionAbierta(true)}>Editar</Boton> : undefined}>
          <AnimatePresence mode="wait">
            {!compensacionAbierta ? (
              /* ── RESUMEN COMPACTO ── */
              <motion.div
                key="resumen"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.12 }}
                onClick={() => puedeEditar && setCompensacionAbierta(true)}
                className={puedeEditar ? 'cursor-pointer' : ''}
              >
                <div className="flex items-center gap-2 flex-wrap mb-3">
                  <Insignia color={compensacionTipo === 'por_dia' ? 'info' : compensacionTipo === 'por_hora' ? 'cyan' : 'primario'}>
                    {compensacionTipo === 'por_dia' ? 'Cobra por día' : compensacionTipo === 'por_hora' ? 'Cobra por hora' : 'Sueldo fijo'}
                  </Insignia>
                  <Insignia color="neutro">{
                    compensacionFrecuencia === 'semanal' ? 'Semanal' :
                    compensacionFrecuencia === 'quincenal' ? 'Quincenal' :
                    compensacionFrecuencia === 'eventual' ? 'Eventual' : 'Mensual'
                  }</Insignia>
                  <Insignia color="neutro">
                    {diasTrabajo === 7 ? '7/7' : diasTrabajo === 6 ? 'L-S' : diasTrabajo === 5 ? 'L-V' : `${diasTrabajo} días`}
                  </Insignia>
                </div>

                {compensacionMonto > 0 ? (
                  <div>
                    <p className="text-xs text-texto-terciario uppercase tracking-wide">
                      {compensacionTipo === 'fijo' ? 'Sueldo mensual' : `${fmt.moneda(compensacionMonto)}/${compensacionTipo === 'por_hora' ? 'hora' : 'día'}`}
                    </p>
                    <p className="text-4xl font-bold text-texto-primario mt-1">
                      {compensacionTipo === 'fijo' ? fmt.moneda(compensacionMonto) : <>{fmt.moneda(proyeccionMensual)}<span className="text-lg font-normal text-texto-terciario">/mes</span></>}
                    </p>

                    {compensacionTipo !== 'fijo' && (
                      <div className="flex items-center gap-4 mt-2 text-sm text-texto-terciario">
                        {compensacionFrecuencia !== 'mensual' && compensacionFrecuencia !== 'eventual' && (
                          <span>
                            ~{fmt.moneda(proyeccionPorFrecuencia)}
                            <span className="text-texto-terciario/60">/{compensacionFrecuencia === 'quincenal' ? 'quincena' : 'semana'}</span>
                          </span>
                        )}
                        <span className="text-texto-terciario/40">·</span>
                        <span className="text-texto-terciario/60">
                          {diasTrabajo} días/sem × 4.33 sem
                        </span>
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-texto-terciario">Sin monto configurado</p>
                )}
              </motion.div>
            ) : (
              /* ── EXPANDIDO — edición ── */
              <motion.div
                key="edicion"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.12 }}
                className="space-y-6"
              >
                {/* Tipo */}
                <div>
                  <p className="text-xs text-texto-terciario uppercase tracking-wide font-semibold mb-3">¿Cómo se le paga a esta persona?</p>
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { valor: 'por_dia', titulo: 'Cobra por día', desc: 'Gana un monto por cada día que trabaja. El total depende de cuántos días asista.', icono: <CalendarDays size={20} /> },
                      { valor: 'fijo', titulo: 'Sueldo fijo', desc: 'Cobra un monto fijo por período completo, sin importar los días que asista.', icono: <Landmark size={20} /> },
                    ].map(opcion => (
                      <Boton
                        key={opcion.valor}
                        variante={compensacionTipo === opcion.valor ? 'primario' : 'secundario'}
                        onClick={() => {
                          setMiembro(p => p ? { ...p, compensacion_tipo: opcion.valor as CompensacionTipo } : null)
                          guardarMiembroInmediato({ compensacion_tipo: opcion.valor })
                        }}
                        className={`!justify-start !text-left ${
                          compensacionTipo === opcion.valor
                            ? '!border-texto-marca !bg-texto-marca/5'
                            : ''
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <div className={`size-10 rounded-lg flex items-center justify-center shrink-0 ${
                            compensacionTipo === opcion.valor ? 'bg-texto-marca/15 text-texto-marca' : 'bg-superficie-hover text-texto-terciario'
                          }`}>
                            {opcion.icono}
                          </div>
                          <div>
                            <p className={`text-sm font-semibold ${compensacionTipo === opcion.valor ? 'text-texto-marca' : 'text-texto-primario'}`}>
                              {opcion.titulo}
                            </p>
                            <p className="text-xs text-texto-terciario mt-0.5">{opcion.desc}</p>
                          </div>
                        </div>
                      </Boton>
                    ))}
                  </div>
                </div>

                {/* Monto */}
                <div>
                  <p className="text-xs text-texto-terciario uppercase tracking-wide font-semibold mb-3">
                    {compensacionTipo === 'por_dia' ? '¿Cuánto gana por día trabajado?' : '¿Cuánto gana por período completo?'}
                  </p>
                  <div className="max-w-sm">
                    <InputMoneda
                      value={String(miembro?.compensacion_monto || '')}
                      onChange={(v) => {
                        setMiembro(p => p ? { ...p, compensacion_monto: parseFloat(v) || null } : null)
                        guardarMiembroInmediato({ compensacion_monto: parseFloat(v) || null })
                      }}
                      moneda="ARS"
                      placeholder="40.000"
                    />
                  </div>
                  {compensacionTipo !== 'fijo' && compensacionMonto > 0 && (
                    <p className="text-xs text-texto-terciario mt-2">
                      Proyección mensual: <span className="text-insignia-exito font-medium">{fmt.moneda(proyeccionMensual)}</span>
                      <span className="ml-1">({diasTrabajo} días/sem × 4.33 semanas)</span>
                    </p>
                  )}
                </div>

                {/* Frecuencia */}
                <div>
                  <p className="text-xs text-texto-terciario uppercase tracking-wide font-semibold mb-3">¿Cada cuánto cobra esta persona?</p>
                  <div className="flex gap-2 flex-wrap">
                    {[
                      { valor: 'semanal', etiqueta: 'Semanal', icono: <Calendar size={14} /> },
                      { valor: 'quincenal', etiqueta: 'Quincenal', icono: <CalendarDays size={14} /> },
                      { valor: 'mensual', etiqueta: 'Mensual', icono: <CalendarDays size={14} /> },
                      { valor: 'eventual', etiqueta: 'Eventual', icono: <CalendarDays size={14} /> },
                    ].map(f => (
                      <Boton
                        key={f.valor}
                        variante={compensacionFrecuencia === f.valor ? 'primario' : 'secundario'}
                        tamano="sm"
                        icono={f.icono}
                        onClick={() => {
                          setMiembro(p => p ? { ...p, compensacion_frecuencia: f.valor as CompensacionFrecuencia } : null)
                          guardarMiembroInmediato({ compensacion_frecuencia: f.valor })
                        }}
                        className={
                          compensacionFrecuencia === f.valor
                            ? '!border-texto-marca !bg-texto-marca/10 !text-texto-marca'
                            : ''
                        }
                      >
                        {f.etiqueta}
                      </Boton>
                    ))}
                  </div>
                  {compensacionTipo !== 'fijo' && compensacionMonto > 0 && (
                    <div className="mt-3 p-3 bg-superficie-hover/50 rounded-lg">
                      <p className="text-sm text-texto-secundario">
                        Cobro {ETIQUETA_FRECUENCIA[compensacionFrecuencia] || 'mensual'} estimado:{' '}
                        <span className="text-insignia-exito font-bold text-base">{fmt.moneda(proyeccionPorFrecuencia)}</span>
                      </p>
                      {compensacionFrecuencia !== 'mensual' && (
                        <p className="text-xs text-texto-terciario mt-1">
                          Proyección mensual: {fmt.moneda(proyeccionMensual)}
                        </p>
                      )}
                    </div>
                  )}
                </div>

                {/* Días por semana */}
                <div>
                  <p className="text-xs text-texto-terciario uppercase tracking-wide font-semibold mb-3">¿Cuántos días por semana trabaja esta persona?</p>
                  <div className="flex gap-2 flex-wrap">
                    {[
                      { valor: 1, etiqueta: '1', sub: '1 día' },
                      { valor: 2, etiqueta: '2', sub: '2 días' },
                      { valor: 3, etiqueta: '3', sub: '3 días' },
                      { valor: 4, etiqueta: '4', sub: '4 días' },
                      { valor: 5, etiqueta: 'L-V', sub: 'Lunes a Viernes' },
                      { valor: 6, etiqueta: 'L-S', sub: 'Lunes a Sábado' },
                      { valor: 7, etiqueta: '7/7', sub: 'Todos los días' },
                    ].map(d => (
                      <Boton
                        key={d.valor}
                        variante={diasTrabajo === d.valor ? 'primario' : 'secundario'}
                        tamano="sm"
                        onClick={() => {
                          setMiembro(p => p ? { ...p, dias_trabajo: d.valor } : null)
                          guardarMiembroInmediato({ dias_trabajo: d.valor })
                        }}
                        className={`min-w-[60px] ${
                          diasTrabajo === d.valor
                            ? '!border-texto-marca !bg-texto-marca/10 !text-texto-marca'
                            : ''
                        }`}
                      >
                        <div className="flex flex-col items-center">
                          <span className="text-sm font-bold">{d.etiqueta}</span>
                          <span className="text-xxs text-texto-terciario mt-0.5">{d.sub}</span>
                        </div>
                      </Boton>
                    ))}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </Tarjeta>
      </div>

      {/* ── PERÍODO ACTUAL ── */}
      <Tarjeta
        titulo={`Período actual — ${periodoActual.etiqueta}`}
        acciones={puedeEditar ? (
          <Boton
            variante="primario"
            tamano="sm"
            icono={<Banknote size={15} />}
            onClick={() => setModalLiquidacion(true)}
          >
            Pagar
          </Boton>
        ) : undefined}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-6">
            <div className="text-center">
              <p className="text-2xl font-bold text-texto-primario">
                {statsPeriodo.trabajados}<span className="text-sm font-normal text-texto-terciario">/{statsPeriodo.habiles}</span>
              </p>
              <p className="text-xs text-texto-terciario uppercase">Trabajados</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-insignia-peligro">{statsPeriodo.ausentes}</p>
              <p className="text-xs text-texto-terciario uppercase">Ausencias</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-insignia-advertencia">{statsPeriodo.tardanzas}</p>
              <p className="text-xs text-texto-terciario uppercase">Tardanzas</p>
            </div>
          </div>

          <div className="text-right">
            <p className="text-xs text-texto-terciario">A pagar</p>
            <p className="text-2xl font-bold text-insignia-exito">{fmt.moneda(montoPagar)}</p>
            {compensacionTipo === 'por_dia' && (
              <p className="text-xs text-texto-terciario">{fmt.moneda(compensacionMonto)} × {statsPeriodo.trabajados} días</p>
            )}
          </div>
        </div>
      </Tarjeta>

      {/* ── ADELANTOS ACTIVOS ── */}
      <Tarjeta
        titulo={`Adelantos${adelantosActivos.length > 0 ? ` (${adelantosActivos.length})` : ''}`}
        acciones={puedeEditar ? (
          <Boton variante="fantasma" tamano="xs" icono={<Plus size={14} />} onClick={() => setModalAdelanto(true)}>
            Registrar adelanto
          </Boton>
        ) : undefined}
      >
        {cargandoAdelantos ? (
          <div className="py-4 text-center text-sm text-texto-terciario">Cargando...</div>
        ) : adelantosActivos.length === 0 ? (
          <EstadoVacio icono={<DollarSign />} titulo="Sin adelantos activos" descripcion="No hay adelantos pendientes de descuento." />
        ) : (
          <div className="divide-y divide-borde-sutil">
            {adelantosActivos.map((a) => {
              const cuotasTotal = a.cuotas_totales as number
              const cuotasDescontadas = a.cuotas_descontadas as number
              const saldo = parseFloat(a.saldo_pendiente as string)
              const montoTotal = parseFloat(a.monto_total as string)
              const progreso = cuotasTotal > 0 ? (cuotasDescontadas / cuotasTotal) * 100 : 0

              return (
                <div key={a.id as string} className="flex items-center gap-4 py-3">
                  <div className="size-10 rounded-lg bg-insignia-advertencia/10 flex items-center justify-center shrink-0">
                    <Banknote size={16} className="text-insignia-advertencia" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-texto-primario">
                        {fmt.moneda(montoTotal)}
                      </p>
                      <Insignia color="advertencia" tamano="sm">
                        {cuotasDescontadas}/{cuotasTotal} cuota{cuotasTotal !== 1 ? 's' : ''}
                      </Insignia>
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <div className="flex-1 h-1.5 bg-superficie-hover rounded-full overflow-hidden max-w-[120px]">
                        <div
                          className="h-full bg-insignia-advertencia rounded-full transition-all"
                          style={{ width: `${progreso}%` }}
                        />
                      </div>
                      <p className="text-xs text-texto-terciario">
                        Saldo: {fmt.moneda(saldo)}
                      </p>
                    </div>
                    {(a.notas as string) ? (
                      <p className="text-xs text-texto-terciario mt-0.5 truncate">{String(a.notas)}</p>
                    ) : null}
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-xs text-texto-terciario">
                      {fmt.fecha(a.fecha_solicitud as string)}
                    </p>
                  </div>
                  {(esPropietario || esAdmin) && (
                    <Boton
                      variante="fantasma"
                      tamano="xs"
                      soloIcono
                      titulo="Cancelar adelanto"
                      icono={<X size={13} />}
                      onClick={() => cancelarAdelanto(a.id as string)}
                    />
                  )}
                </div>
              )
            })}
          </div>
        )}
      </Tarjeta>

      {/* ── MODAL REGISTRAR ADELANTO ── */}
      <Modal
        abierto={modalAdelanto}
        onCerrar={() => setModalAdelanto(false)}
        titulo="Registrar Adelanto"
        tamano="md"
        acciones={
          <div className="flex items-center gap-3">
            <Boton
              variante="primario"
              icono={<Banknote size={16} />}
              cargando={guardandoAdelanto}
              onClick={handleCrearAdelanto}
              disabled={!adelantoMonto || parseFloat(adelantoMonto) <= 0}
            >
              Registrar
            </Boton>
            <Boton variante="fantasma" onClick={() => setModalAdelanto(false)}>Cancelar</Boton>
          </div>
        }
      >
        <div className="space-y-4">
          <InputMoneda
            etiqueta="Monto del adelanto"
            value={adelantoMonto}
            onChange={setAdelantoMonto}
            moneda="ARS"
            placeholder="50.000"
          />

          <div>
            <label className="text-sm font-medium text-texto-secundario mb-1 block">Cuotas de descuento</label>
            <select
              value={adelantoCuotas}
              onChange={e => setAdelantoCuotas(e.target.value)}
              className="w-full text-sm bg-superficie-elevada border border-borde-sutil rounded-lg px-3 py-2 text-texto-primario"
            >
              {Array.from({ length: 12 }, (_, i) => i + 1).map(n => (
                <option key={n} value={n}>
                  {n} cuota{n !== 1 ? 's' : ''}
                  {parseFloat(adelantoMonto) > 0 && ` — ${fmt.moneda(parseFloat(adelantoMonto) / n)} c/u`}
                </option>
              ))}
            </select>
            <p className="text-xs text-texto-terciario mt-1">
              Se descontará {compensacionFrecuencia === 'semanal' ? 'cada semana' : compensacionFrecuencia === 'quincenal' ? 'cada quincena' : 'cada mes'}
            </p>
          </div>

          <SelectorFecha
            etiqueta="Inicio del descuento"
            valor={adelantoFechaInicio || null}
            onChange={(v) => setAdelantoFechaInicio(v || '')}
            placeholder="Fecha desde la cual se empieza a descontar"
          />

          <Input
            tipo="text"
            etiqueta="Notas (opcional)"
            value={adelantoNotas}
            onChange={e => setAdelantoNotas(e.target.value)}
            placeholder="Motivo del adelanto..."
          />

          {parseFloat(adelantoMonto) > 0 && parseInt(adelantoCuotas) > 0 && (
            <div className="bg-superficie-hover/50 rounded-lg border border-borde-sutil p-3">
              <p className="text-xs text-texto-terciario uppercase tracking-wide font-semibold mb-2">Resumen</p>
              <div className="flex items-center justify-between">
                <span className="text-sm text-texto-secundario">Adelanto total</span>
                <span className="text-sm font-bold text-texto-primario">{fmt.moneda(parseFloat(adelantoMonto))}</span>
              </div>
              <div className="flex items-center justify-between mt-1">
                <span className="text-sm text-texto-secundario">Cuota ({compensacionFrecuencia})</span>
                <span className="text-sm font-bold text-insignia-advertencia">
                  -{fmt.moneda(parseFloat(adelantoMonto) / parseInt(adelantoCuotas))}
                </span>
              </div>
            </div>
          )}
        </div>
      </Modal>

      {/* ── HISTORIAL DE PAGOS ── */}
      <Tarjeta
        titulo="Historial de pagos"
        acciones={puedeEditar ? (
          <Boton variante="fantasma" tamano="xs" icono={<Plus size={14} />} onClick={() => setModalLiquidacion(true)}>
            Registrar pago
          </Boton>
        ) : undefined}
      >
        {cargandoPagos ? (
          <div className="py-8 text-center text-sm text-texto-terciario">Cargando pagos...</div>
        ) : pagos.length === 0 ? (
          <EstadoVacio icono={<Banknote />} titulo="No hay pagos registrados" descripcion="No hay pagos registrados para este usuario." />
        ) : (
          <div className="divide-y divide-borde-sutil">
            {pagos.map((pago) => (
              <div key={pago.id as string} className="flex items-center gap-4 py-3">
                <div className="size-10 rounded-lg bg-insignia-exito-fondo flex items-center justify-center shrink-0">
                  <Receipt size={16} className="text-insignia-exito-texto" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-texto-primario truncate">{pago.concepto as string}</p>
                  <p className="text-xs text-texto-terciario">
                    {fmt.fecha(pago.fecha_inicio_periodo as string, { corta: true })}
                    {' — '}
                    {fmt.fecha(pago.fecha_fin_periodo as string)}
                    {(pago.dias_trabajados as number) > 0 && (
                      <span className="ml-2">· {pago.dias_trabajados as number} días trabajados</span>
                    )}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-bold text-insignia-exito">{fmt.moneda(pago.monto_abonado as number)}</p>
                  {(pago.monto_sugerido as number) && (pago.monto_abonado as number) !== (pago.monto_sugerido as number) && (
                    <p className="text-xxs text-texto-terciario line-through">{fmt.moneda(pago.monto_sugerido as number)}</p>
                  )}
                </div>
                <div className="text-right shrink-0">
                  <p className="text-xs text-texto-terciario">
                    {fmt.fecha(pago.creado_en as string, { corta: true })}
                  </p>
                  <p className="text-xxs text-texto-terciario">{pago.creado_por_nombre as string}</p>
                </div>
                {(esPropietario || esAdmin) && (
                  <Boton
                    variante="fantasma"
                    tamano="xs"
                    soloIcono
                    titulo="Eliminar"
                    icono={<Trash2 size={13} />}
                    onClick={() => eliminarPago(pago.id as string)}
                  />
                )}
              </div>
            ))}
          </div>
        )}
      </Tarjeta>

      {/* ── MODAL REGISTRAR LIQUIDACION ── */}
      <Modal
        abierto={modalLiquidacion}
        onCerrar={cerrarModal}
        titulo="Registrar Liquidación"
        tamano="lg"
        acciones={
          <div className="flex items-center gap-3 w-full">
            <Boton
              variante="primario"
              icono={<Banknote size={16} />}
              cargando={guardandoPago || subiendoComprobante}
              onClick={handleRegistrarPago}
            >
              Registrar Pago
            </Boton>
            <Boton variante="fantasma" onClick={cerrarModal}>
              Cancelar
            </Boton>
          </div>
        }
      >
        <div className="space-y-6">
          {/* ── Navegador de período ── */}
          <div>
            <p className="text-xs text-texto-terciario uppercase tracking-wide font-semibold mb-2">Período a liquidar</p>
            <div className="bg-superficie-hover/50 rounded-xl border border-borde-sutil p-4">
              <div className="flex items-center justify-between">
                <Boton
                  variante="secundario"
                  tamano="sm"
                  soloIcono
                  titulo="Período anterior"
                  icono={<ChevronLeft size={18} />}
                  onClick={() => periodoModal && setPeriodoModal(navegarPeriodo(periodoModal, 'anterior', compensacionFrecuencia, fmt.locale))}
                />

                <div className="text-center">
                  <p className="text-base font-bold text-texto-primario">{periodoModal?.etiqueta}</p>
                  <p className="text-xs text-texto-terciario mt-0.5">
                    {periodoModal && `${fmt.fecha(periodoModal.inicio)} — ${fmt.fecha(periodoModal.fin)}`}
                  </p>
                </div>

                <Boton
                  variante="secundario"
                  tamano="sm"
                  soloIcono
                  titulo="Período siguiente"
                  icono={<ChevronRight size={18} />}
                  onClick={() => periodoModal && setPeriodoModal(navegarPeriodo(periodoModal, 'siguiente', compensacionFrecuencia, fmt.locale))}
                />
              </div>

              {/* Rango personalizado */}
              <Boton
                variante="fantasma"
                tamano="xs"
                icono={<ChevronDown size={12} className={`transition-transform ${rangoPersonalizado ? 'rotate-180' : ''}`} />}
                onClick={() => setRangoPersonalizado(p => !p)}
                className="mt-3 mx-auto"
              >
                Elegir rango personalizado
              </Boton>

              <AnimatePresence>
                {rangoPersonalizado && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.15 }}
                    className="overflow-hidden"
                  >
                    <div className="grid grid-cols-2 gap-3 mt-3 pt-3 border-t border-borde-sutil">
                      <SelectorFecha
                        etiqueta="Desde"
                        valor={rangoInicio || null}
                        onChange={(v) => {
                          const nuevo = v || ''
                          setRangoInicio(nuevo)
                          if (nuevo && rangoFin) aplicarRangoCustom(nuevo, rangoFin)
                        }}
                        placeholder="Fecha inicio"
                      />
                      <SelectorFecha
                        etiqueta="Hasta"
                        valor={rangoFin || null}
                        onChange={(v) => {
                          const nuevo = v || ''
                          setRangoFin(nuevo)
                          if (rangoInicio && nuevo) aplicarRangoCustom(rangoInicio, nuevo)
                        }}
                        placeholder="Fecha fin"
                      />
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* ── Resumen del período ── */}
          <div className="bg-superficie-hover/50 rounded-xl border border-borde-sutil p-4">
            <div className="flex items-center gap-2 mb-4">
              <div className="size-6 rounded bg-texto-marca/15 flex items-center justify-center">
                <CalendarDays size={13} className="text-texto-marca" />
              </div>
              <p className="text-xs text-texto-terciario uppercase tracking-wide font-bold">Resumen del período</p>
            </div>

            {cargandoAsistencias ? (
              <div className="py-4 text-center text-sm text-texto-terciario">Calculando...</div>
            ) : (
              <>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center mb-4">
                  <div>
                    <p className="text-2xl font-black text-texto-primario">{statsPeriodo.habiles}</p>
                    <div className="h-px bg-borde-sutil my-1.5" />
                    <p className="text-xxs text-texto-terciario uppercase font-semibold">Hábiles</p>
                  </div>
                  <div>
                    <p className="text-2xl font-black text-insignia-exito">{statsPeriodo.trabajados}</p>
                    <div className="h-px bg-insignia-exito/30 my-1.5" />
                    <p className="text-xxs text-texto-terciario uppercase font-semibold">Trabajados</p>
                  </div>
                  <div>
                    <p className="text-2xl font-black text-insignia-peligro">{statsPeriodo.ausentes}</p>
                    <div className="h-px bg-insignia-peligro/30 my-1.5" />
                    <p className="text-xxs text-texto-terciario uppercase font-semibold">Ausencias</p>
                  </div>
                  <div>
                    <p className="text-2xl font-black text-insignia-advertencia">{statsPeriodo.tardanzas}</p>
                    <div className="h-px bg-insignia-advertencia/30 my-1.5" />
                    <p className="text-xxs text-texto-terciario uppercase font-semibold">Tardanzas</p>
                  </div>
                </div>

                <div className="border-t border-borde-sutil pt-3 flex items-center justify-between">
                  <div>
                    <p className="text-xxs text-texto-terciario uppercase font-semibold">Monto sugerido</p>
                    <p className="text-xs text-texto-terciario">
                      {compensacionTipo === 'por_dia'
                        ? `${fmt.moneda(compensacionMonto)} × ${statsPeriodo.trabajados} días`
                        : compensacionTipo === 'por_hora'
                          ? `${fmt.moneda(compensacionMonto)}/h × 8h × ${statsPeriodo.trabajados} días`
                          : 'Sueldo fijo'
                      }
                    </p>
                  </div>
                  <p className="text-2xl font-black text-insignia-exito">{fmt.moneda(montoPagar)}</p>
                </div>
              </>
            )}
          </div>

          {/* ── Concepto y Monto en grilla ── */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              tipo="text"
              etiqueta="Concepto"
              value={liqConcepto}
              onChange={(e) => setLiqConcepto(e.target.value)}
              placeholder={periodoModal?.etiqueta || ''}
            />
            <Input
              tipo="number"
              etiqueta="Monto a pagar"
              value={liqMonto}
              onChange={(e) => setLiqMonto(e.target.value)}
              icono={<DollarSign size={15} />}
              formato={null}
              placeholder={String(montoPagar)}
            />
          </div>

          {/* ── Comprobante con upload real ── */}
          <div>
            <label className="text-sm font-medium text-texto-secundario mb-1 block">Comprobante (opcional)</label>
            <input
              ref={inputComprobanteRef}
              type="file"
              accept=".pdf,.jpg,.jpeg,.png"
              className="hidden"
              onChange={(e) => {
                const archivo = e.target.files?.[0]
                if (archivo) setArchivoComprobante(archivo)
              }}
            />
            {archivoComprobante ? (
              <div className="flex items-center gap-3 p-3 rounded-lg border border-borde-sutil bg-superficie-hover/30">
                <div className="size-10 rounded-lg bg-insignia-exito-fondo flex items-center justify-center shrink-0">
                  <FileText size={16} className="text-insignia-exito-texto" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-texto-primario truncate">{archivoComprobante.name}</p>
                  <p className="text-xxs text-texto-terciario">{(archivoComprobante.size / 1024).toFixed(0)} KB</p>
                </div>
                <Boton
                  variante="fantasma"
                  tamano="xs"
                  soloIcono
                  titulo="Eliminar archivo"
                  icono={<X size={14} />}
                  onClick={() => { setArchivoComprobante(null); if (inputComprobanteRef.current) inputComprobanteRef.current.value = '' }}
                />
              </div>
            ) : (
              <div
                role="button"
                tabIndex={0}
                aria-label="Subir comprobante de pago"
                onClick={() => inputComprobanteRef.current?.click()}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') inputComprobanteRef.current?.click() }}
                className="border-2 border-dashed border-borde-fuerte rounded-xl p-6 flex flex-col items-center justify-center gap-2 hover:bg-superficie-hover/30 hover:border-texto-marca/30 transition-all cursor-pointer focus-visible:outline-2 focus-visible:outline-texto-marca focus-visible:-outline-offset-2"
              >
                <FileUp size={20} className="text-texto-terciario" />
                <span className="text-sm font-medium text-texto-secundario">Subir recibo o comprobante</span>
                <span className="text-xxs text-texto-terciario/60">PDF, JPG o PNG</span>
              </div>
            )}
          </div>
        </div>

      </Modal>
    </div>
  )
}
