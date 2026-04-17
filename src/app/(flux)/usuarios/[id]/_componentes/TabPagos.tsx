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

      {/* ── COMPENSACION — solo lectura ── */}
      <div ref={compensacionRef}>
        <Tarjeta titulo={t('usuarios.compensacion')} acciones={puedeEditar ? <Boton variante="fantasma" tamano="xs" icono={<Pencil size={13} />} onClick={() => window.location.href = '/asistencias'}>Editar en Nómina</Boton> : undefined}>
              <motion.div
                key="resumen"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.12 }}
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
        </Tarjeta>
      </div>

      {/* ── PERÍODO ACTUAL ── */}
      <Tarjeta titulo={`Período actual — ${periodoActual.etiqueta}`}>
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
          <Boton variante="fantasma" tamano="xs" icono={<Plus size={14} />} onClick={() => window.location.href = '/asistencias'}>
            Ir a Nómina
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

      {/* Modal de liquidación eliminado — ahora se gestiona desde Asistencias → Nómina */}
    </div>
  )
}
