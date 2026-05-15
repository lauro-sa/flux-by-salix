'use client'

/**
 * PaginaEditorNominaEmpleado — Editor pantalla completa de nómina por empleado.
 * Reemplaza al ModalDetalleNomina manteniendo toda la funcionalidad.
 *
 * Layout:
 * - Cabecero: nombre + insignias de compensación + flechas entre empleados + Enviar recibo / Pagar
 * - Panel izq: navegador de período + stats + desglose + saldo
 * - Main: compensación (editable inline) + descuentos/adelantos + historial de pagos
 */

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import {
  Banknote, CalendarDays, Plus, X, Pencil, Trash2,
  Receipt, Send, Landmark, Check, ChevronLeft, ChevronRight,
  ClipboardCheck, Calendar, Coins, TrendingDown, CreditCard, Download,
  AlertTriangle, Sparkles, FileSignature, TrendingUp,
} from 'lucide-react'
import type {
  DetalleReciboCalculado,
  ConceptoAplicadoCalculado,
  MetricasAsistencia,
  ModalidadCalculo,
  RegimenContrato,
  ModoCalculoConcepto,
} from '@/tipos/nominas'
import { PlantillaEditor } from '@/componentes/entidad/PlantillaEditor'
import { CabezaloHero, HeroRango } from '@/componentes/entidad/CabezaloHero'
import { CabezaloPersona } from '@/componentes/entidad/CabezaloPersona'
import { BannerResumenCalculo, type TerminoFormula, type TonoBanner } from '@/componentes/entidad/BannerResumenCalculo'
import { CalendarioPeriodoMini, type DefinicionEstado } from '@/componentes/entidad/CalendarioPeriodoMini'
import { TarjetaPanel } from '@/componentes/entidad/TarjetaPanel'
import { ModalAdaptable as Modal } from '@/componentes/ui/ModalAdaptable'
import { Boton } from '@/componentes/ui/Boton'
import { GrupoBotones } from '@/componentes/ui/GrupoBotones'
import { InputMoneda } from '@/componentes/ui/InputMoneda'
import { Input } from '@/componentes/ui/Input'
import { Insignia } from '@/componentes/ui/Insignia'
import { SelectorFecha } from '@/componentes/ui/SelectorFecha'
import { ModalEnviarReciboNomina } from '@/app/(flux)/nominas/_componentes/ModalEnviarReciboNomina'
import { crearClienteNavegador } from '@/lib/supabase/cliente'
import { useFormato } from '@/hooks/useFormato'
import { useNavegacion } from '@/hooks/useNavegacion'
import { useRol } from '@/hooks/useRol'

// Catálogo de estados del mini-calendario de días (reutilizado en la tarjeta de Asistencia)
const ESTADOS_DIAS_NOMINA: DefinicionEstado[] = [
  { clave: 'completa',           etiqueta: 'Completa',  claseFondo: 'bg-insignia-exito' },
  { clave: 'media',              etiqueta: 'Media',     claseFondo: 'bg-insignia-advertencia' },
  { clave: 'parcial',            etiqueta: 'Parcial',   claseFondo: 'bg-insignia-info' },
  { clave: 'ausente',            etiqueta: 'Ausencia',  claseFondo: 'bg-insignia-peligro' },
  { clave: 'feriado_trabajado',  etiqueta: 'Feriado (vino)', claseFondo: 'bg-texto-marca' },
  { clave: 'feriado',            etiqueta: 'Feriado',   claseFondo: 'border-texto-marca/50', soloBorde: true, claseTexto: 'text-texto-terciario' },
  { clave: 'no_laboral',         etiqueta: 'No laboral',claseFondo: 'bg-superficie-hover', claseTexto: 'text-texto-terciario' },
]

// ─── Tipos ───

export type ClasificacionDiaNomina =
  | 'completa' | 'media' | 'parcial'
  | 'ausente' | 'feriado' | 'feriado_trabajado' | 'no_laboral'

export interface DiaDetalleNomina {
  fecha: string
  clasificacion: ClasificacionDiaNomina
}

export interface ResultadoNomina {
  miembro_id: string
  nombre: string
  correo: string
  telefono: string
  // Identidad del empleado (para el cabezal del detalle)
  puesto?: string | null
  fecha_ingreso?: string | null
  numero_empleado?: string | null
  foto_url?: string | null
  documento?: { tipo: string; numero: string } | null
  compensacion_tipo: string
  compensacion_monto: number
  compensacion_frecuencia?: string
  dias_laborales: number
  dias_trabajados: number
  dias_ausentes: number
  dias_tardanza: number
  horas_netas: number
  horas_totales: number
  promedio_horas_diario: number
  horas_brutas: number
  horas_almuerzo: number
  horas_particular: number
  dias_con_almuerzo: number
  dias_con_salida_particular: number
  descuenta_almuerzo: boolean
  duracion_almuerzo_config: number
  dias_feriados: number
  dias_trabajados_feriado: number
  dias_jornada_completa?: number
  dias_media_jornada?: number
  dias_presente_parcial?: number
  jornales_equivalentes?: number
  dias_detalle?: DiaDetalleNomina[]
  monto_pagar: number
  monto_detalle: string
  descuento_adelanto: number
  cuotas_adelanto: number
  saldo_anterior: number
  monto_neto: number
}

export interface EmpleadoLista {
  miembro_id: string
  nombre: string
  /** Frecuencia de compensación — determina qué tipo de período abrir al navegar */
  compensacion_frecuencia?: string
}

interface Props {
  empleadoInicial: ResultadoNomina
  periodoInicial: { desde: string; hasta: string; etiqueta: string }
  nombreEmpresa: string
  empleadosPeriodoInicial: EmpleadoLista[]
  rutaVolver: string
  textoVolver?: string
}

// ─── Formatos ───

const fmtMonto = (n: number) =>
  `$${n.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`

const fmtHoras = (h: number) => {
  const hrs = Math.floor(h)
  const min = Math.round((h - hrs) * 60)
  return min > 0 ? `${hrs}h ${min}m` : `${hrs}h`
}

// ─── Helpers de etiquetas del motor (PR 7c) ───

/** Etiqueta legible de la modalidad de cálculo del contrato. */
function etiquetaModalidad(m: ModalidadCalculo): string {
  switch (m) {
    case 'por_hora': return 'Por hora'
    case 'por_dia': return 'Por día'
    case 'fijo_semanal': return 'Fijo semanal'
    case 'fijo_quincenal': return 'Fijo quincenal'
    case 'fijo_mensual': return 'Fijo mensual'
  }
}

/** Sufijo del monto base según modalidad (ej "/día", "/hora", "/mes"). */
function sufijoModalidad(m: ModalidadCalculo): string {
  switch (m) {
    case 'por_hora': return '/hora'
    case 'por_dia': return '/día'
    case 'fijo_semanal': return '/semana'
    case 'fijo_quincenal': return '/quincena'
    case 'fijo_mensual': return '/mes'
  }
}

/** Etiqueta legible del régimen del contrato. */
function etiquetaRegimen(r: RegimenContrato): string {
  switch (r) {
    case 'informal': return 'Informal'
    case 'monotributo': return 'Monotributo'
    case 'relacion_dependencia': return 'Relación de dependencia'
  }
}

/** Describe cómo el motor calculó el monto base (días × valor, prorrateo, etc). */
function describirCalculoBase(d: DetalleReciboCalculado): string {
  const snap = d.contrato.snapshot
  if (!snap) return 'Sin contrato laboral cargado'
  const monto = snap.monto_base
  const a = d.asistencia
  switch (snap.modalidad_calculo) {
    case 'por_hora':
      return `${a.horas_netas.toFixed(2)} h × ${monto.toLocaleString('es-AR')}/h`
    case 'por_dia':
      return `${a.dias_trabajados} día${a.dias_trabajados === 1 ? '' : 's'} × ${monto.toLocaleString('es-AR')}/día`
    case 'fijo_semanal':
    case 'fijo_quincenal':
    case 'fijo_mensual': {
      const diasNaturales = snap.modalidad_calculo === 'fijo_semanal' ? 7
        : snap.modalidad_calculo === 'fijo_quincenal' ? 15
        : 30
      const factor = (a.dias_periodo / diasNaturales) * 100
      return `${monto.toLocaleString('es-AR')} prorrateado al ${factor.toFixed(0)}% del período`
    }
  }
}

// ─── Tipos y helpers de período ───

type TipoPeriodo = 'semana' | 'quincena' | 'mes'

/** Calcula desde/hasta/etiqueta a partir de una fecha de referencia y tipo */
function calcularPeriodo(
  fechaRef: Date,
  tipo: TipoPeriodo,
): { desde: string; hasta: string; etiqueta: string } {
  const d = new Date(fechaRef)
  const mes = d.getMonth()
  const anio = d.getFullYear()

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
    if (d.getDate() <= 15) {
      return {
        desde: `${anio}-${String(mes + 1).padStart(2, '0')}-01`,
        hasta: `${anio}-${String(mes + 1).padStart(2, '0')}-15`,
        etiqueta: `Quincena 1-15 de ${d.toLocaleDateString('es-AR', { month: 'long', year: 'numeric' })}`,
      }
    }
    const ultimoQ = new Date(anio, mes + 1, 0).getDate()
    return {
      desde: `${anio}-${String(mes + 1).padStart(2, '0')}-16`,
      hasta: `${anio}-${String(mes + 1).padStart(2, '0')}-${ultimoQ}`,
      etiqueta: `Quincena 16-${ultimoQ} de ${d.toLocaleDateString('es-AR', { month: 'long', year: 'numeric' })}`,
    }
  }

  // mes
  const ultimo = new Date(anio, mes + 1, 0).getDate()
  return {
    desde: `${anio}-${String(mes + 1).padStart(2, '0')}-01`,
    hasta: `${anio}-${String(mes + 1).padStart(2, '0')}-${ultimo}`,
    etiqueta: d.toLocaleDateString('es-AR', { month: 'long', year: 'numeric' }).replace(/^\w/, c => c.toUpperCase()),
  }
}

/** Avanza o retrocede la fecha de referencia según el tipo */
function navegarFecha(fecha: Date, tipo: TipoPeriodo, dir: 'prev' | 'next'): Date {
  const d = new Date(fecha)
  const delta = dir === 'next' ? 1 : -1
  if (tipo === 'semana') d.setDate(d.getDate() + 7 * delta)
  else if (tipo === 'quincena') {
    // Alterna entre Q1 y Q2 del mes correspondiente
    const esQ1 = d.getDate() <= 15
    if (dir === 'next') {
      if (esQ1) d.setDate(16)
      else d.setMonth(d.getMonth() + 1, 1)
    } else {
      if (esQ1) d.setMonth(d.getMonth() - 1, 16)
      else d.setDate(1)
    }
  } else d.setMonth(d.getMonth() + delta, 1)
  return d
}

/** Mapea la frecuencia de compensación del empleado al tipo de período natural */
function tipoPeriodoPorFrecuencia(freq?: string): TipoPeriodo {
  if (freq === 'semanal') return 'semana'
  if (freq === 'quincenal') return 'quincena'
  return 'mes' // 'mensual', 'eventual' o default
}

/** Deriva el tipo de período a partir de un rango de fechas */
function inferirTipoPeriodo(desde: string, hasta: string): TipoPeriodo {
  const d = new Date(desde + 'T12:00:00')
  const h = new Date(hasta + 'T12:00:00')
  const diasMs = 24 * 60 * 60 * 1000
  const duracion = Math.round((h.getTime() - d.getTime()) / diasMs) + 1
  if (duracion <= 8) return 'semana'
  if (duracion <= 16) return 'quincena'
  return 'mes'
}

/**
 * NumeroAnimado — envuelve un número/monto y hace fade-in + slide sutil cuando cambia.
 * Usa `claveAnim` como key para re-montar y disparar la animación ante cada cambio real.
 */
function NumeroAnimado({ claveAnim, children }: { claveAnim: string | number; children: ReactNode }) {
  return (
    <motion.span
      key={String(claveAnim)}
      initial={{ opacity: 0.2, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
      style={{ display: 'inline-block' }}
    >
      {children}
    </motion.span>
  )
}

// ─── Componente ───

export function PaginaEditorNominaEmpleado({
  empleadoInicial,
  periodoInicial,
  nombreEmpresa,
  empleadosPeriodoInicial,
  rutaVolver,
  textoVolver = 'Nómina',
}: Props) {
  const router = useRouter()
  const supabase = crearClienteNavegador()
  const { locale } = useFormato()
  const { setMigajaDinamica } = useNavegacion()
  // Permisos reactivos — si el admin los cambia en vivo, la UI se reajusta.
  const { tienePermiso } = useRol()
  const puedeEditarNomina = tienePermiso('nomina', 'editar')
  const puedeEnviarNomina = tienePermiso('nomina', 'enviar')

  /** Formatea fecha según config de la empresa */
  const fmtFecha = useCallback((fecha: string) => {
    const d = new Date(fecha + 'T12:00:00')
    return d.toLocaleDateString(locale, { day: '2-digit', month: 'short', year: 'numeric' })
  }, [locale])

  // Empleado activo (cambia al navegar entre empleados sin re-mount del page)
  const [datosEmpleado, setDatosEmpleado] = useState<ResultadoNomina>(empleadoInicial)
  const [empleadosPeriodo, setEmpleadosPeriodo] = useState<EmpleadoLista[]>(empleadosPeriodoInicial)
  const [periodoActual, setPeriodoActual] = useState(periodoInicial)
  const [tipoPeriodo, setTipoPeriodo] = useState<TipoPeriodo>(() => inferirTipoPeriodo(periodoInicial.desde, periodoInicial.hasta))
  const [fechaRef, setFechaRef] = useState(() => new Date(periodoInicial.desde + 'T12:00:00'))
  const [recalculando, setRecalculando] = useState(false)

  // Adelantos y pagos del período
  const [adelantos, setAdelantos] = useState<Record<string, unknown>[]>([])
  const [pagos, setPagos] = useState<Record<string, unknown>[]>([])

  // Compensación editable
  const [compTipo, setCompTipo] = useState(empleadoInicial.compensacion_tipo)
  const [compMonto, setCompMonto] = useState(String(empleadoInicial.compensacion_monto))
  const [compFrecuencia, setCompFrecuencia] = useState(empleadoInicial.compensacion_frecuencia || 'mensual')
  const [compDias, setCompDias] = useState(5)
  const [compEditando, setCompEditando] = useState(false)

  // Confirmación de pago (ahora en ModalAdaptable)
  const [confirmandoPago, setConfirmandoPago] = useState(false)
  const [montoAPagar, setMontoAPagar] = useState('')
  const [notasPago, setNotasPago] = useState('')
  const [pagando, setPagando] = useState(false)

  // Adelanto/descuento nuevo
  const [mostrarFormAdelanto, setMostrarFormAdelanto] = useState(false)
  const [adelantoTipo, setAdelantoTipo] = useState<'adelanto' | 'descuento'>('adelanto')
  const [adelantoMonto, setAdelantoMonto] = useState('')
  const [adelantoCuotas, setAdelantoCuotas] = useState('1')
  const [adelantoNotas, setAdelantoNotas] = useState('')
  const [adelantoFecha, setAdelantoFecha] = useState('')
  const [creandoAdelanto, setCreandoAdelanto] = useState(false)

  // Edición de pago
  const [editandoPago, setEditandoPago] = useState<string | null>(null)
  const [editMontoAbonado, setEditMontoAbonado] = useState('')

  // Edición de adelanto
  const [editandoAdelanto, setEditandoAdelanto] = useState<string | null>(null)
  const [editAdelantoMonto, setEditAdelantoMonto] = useState('')
  const [editAdelantoCuotas, setEditAdelantoCuotas] = useState('')
  const [editAdelantoNotas, setEditAdelantoNotas] = useState('')
  const [guardandoEditAdelanto, setGuardandoEditAdelanto] = useState(false)

  // Envío de recibo
  const [modalEnvio, setModalEnvio] = useState(false)

  // ─── Motor de cálculo (PR 7c) ───
  //
  // Mientras el endpoint legacy /api/nominas todavía alimenta el bloque
  // "Asistencia" y el saldo entre períodos, el desglose del recibo se
  // calcula con el motor: conceptos automáticos aplicados con su detalle
  // humano, sugerencias del contrato vigente y cuotas de adelanto.
  //
  // `detalleMotor` se recalcula al cambiar empleado o período. Si el motor
  // todavía no respondió, la tarjeta de desglose cae al cálculo legacy
  // (compatibilidad hacia atrás durante la carga inicial).
  const [detalleMotor, setDetalleMotor] = useState<DetalleReciboCalculado | null>(null)
  const [cargandoMotor, setCargandoMotor] = useState(false)

  /**
   * Conceptos que el operador agrega manualmente al recibo (haberes
   * extra, descuentos puntuales o sugeridos del contrato que cumplen
   * pero no son automáticos). Se mandan como `conceptos_extra` al pagar.
   * Si `concepto_id` está presente, sirve para ocultar ese sugerido de
   * la lista (ya fue aplicado).
   */
  type ConceptoExtra = {
    nombre: string
    tipo: 'haber' | 'descuento'
    monto: number
    detalle?: string | null
    concepto_id?: string
  }
  const [conceptosExtras, setConceptosExtras] = useState<ConceptoExtra[]>([])

  // Si el usuario pierde el permiso `nomina:editar` en vivo (ej. admin se lo
  // saca), cerramos cualquier formulario de edición abierto para que no pueda
  // completar la operación sin autorización. Reactivo gracias al contexto.
  useEffect(() => {
    if (puedeEditarNomina) return
    setCompEditando(false)
    setMostrarFormAdelanto(false)
    setEditandoAdelanto(null)
    setEditandoPago(null)
    setConfirmandoPago(false)
  }, [puedeEditarNomina])

  // Registrar migaja dinámica con nombre del empleado
  useEffect(() => {
    setMigajaDinamica(`/nominas/empleado/${datosEmpleado.miembro_id}`, datosEmpleado.nombre)
  }, [datosEmpleado.miembro_id, datosEmpleado.nombre, setMigajaDinamica])

  // Cargar días de trabajo del miembro (no viene en el resultado de nómina)
  useEffect(() => {
    supabase.from('miembros').select('dias_trabajo').eq('id', datosEmpleado.miembro_id).single()
      .then(({ data }) => {
        if (data) setCompDias((data as Record<string, unknown>).dias_trabajo as number || 5)
      })
  }, [datosEmpleado.miembro_id, supabase])

  // Cargar pagos y adelantos del período actual
  const cargarPagosYAdelantos = useCallback(async (miembroId: string, desde: string, hasta: string) => {
    const { data: pagosData } = await supabase
      .from('pagos_nomina')
      .select('id, concepto, monto_sugerido, monto_abonado, fecha_inicio_periodo, fecha_fin_periodo, creado_en, creado_por_nombre, notas')
      .eq('miembro_id', miembroId)
      .eq('eliminado', false)
      .lte('fecha_inicio_periodo', hasta)
      .gte('fecha_fin_periodo', desde)
      .order('creado_en', { ascending: false })
    setPagos(pagosData || [])

    const resAdel = await fetch(`/api/adelantos?miembro_id=${miembroId}`)
    const dataAdel = await resAdel.json()
    const todosAdelantos = (dataAdel.adelantos || []) as Record<string, unknown>[]
    const adelantosFiltrados = todosAdelantos.filter((a) => {
      if (a.estado === 'cancelado') return false
      const cuotas = (a.cuotas || []) as Record<string, unknown>[]
      return cuotas.some(c =>
        (c.fecha_programada as string) >= desde &&
        (c.fecha_programada as string) <= hasta
      )
    })
    setAdelantos(adelantosFiltrados)
  }, [supabase])

  // Carga inicial de pagos/adelantos (una sola vez, al montar). Las actualizaciones
  // posteriores las dispara `aplicarPeriodo` e `irAEmpleado` manualmente.
  useEffect(() => {
    cargarPagosYAdelantos(empleadoInicial.miembro_id, periodoInicial.desde, periodoInicial.hasta)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Carga el detalle del motor cada vez que cambia empleado o período.
  // Borramos `conceptosExtras` para evitar arrastrar manuales de otro
  // empleado/período (cada recibo es independiente).
  useEffect(() => {
    let cancelado = false
    setCargandoMotor(true)
    setConceptosExtras([])
    fetch('/api/nominas/calcular', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        miembro_id: datosEmpleado.miembro_id,
        periodo_inicio: periodoActual.desde,
        periodo_fin: periodoActual.hasta,
      }),
    })
      .then(r => r.json())
      .then(data => {
        if (cancelado) return
        setDetalleMotor((data?.detalle as DetalleReciboCalculado | null) ?? null)
      })
      .catch(() => { if (!cancelado) setDetalleMotor(null) })
      .finally(() => { if (!cancelado) setCargandoMotor(false) })
    return () => { cancelado = true }
  }, [datosEmpleado.miembro_id, periodoActual.desde, periodoActual.hasta])

  // Aplicar un nuevo período (llamado al navegar con ← Hoy → o al cambiar Semana/Quincena/Mes)
  const aplicarPeriodo = useCallback(async (nuevaFecha: Date, nuevoTipo: TipoPeriodo) => {
    const nuevo = calcularPeriodo(nuevaFecha, nuevoTipo)
    setFechaRef(nuevaFecha)
    setTipoPeriodo(nuevoTipo)
    setPeriodoActual(nuevo)
    setRecalculando(true)

    // Sync URL sin re-ejecutar el page.tsx (evita flash de "Cargando...")
    if (typeof window !== 'undefined') {
      const nuevoQuery = `?desde=${nuevo.desde}&hasta=${nuevo.hasta}`
      window.history.replaceState(null, '', `/nominas/empleado/${datosEmpleado.miembro_id}${nuevoQuery}`)
    }

    try {
      const res = await fetch(`/api/nominas?desde=${nuevo.desde}&hasta=${nuevo.hasta}&empleados=${datosEmpleado.miembro_id}`)
      const data = await res.json()
      const resultado = (data.resultados || []).find((r: ResultadoNomina) => r.miembro_id === datosEmpleado.miembro_id)
      if (resultado) setDatosEmpleado(resultado)
    } catch { /* silenciar */ }
    finally { setRecalculando(false) }

    cargarPagosYAdelantos(datosEmpleado.miembro_id, nuevo.desde, nuevo.hasta)
  }, [datosEmpleado.miembro_id, cargarPagosYAdelantos])

  // Recargar datos del período actual tras una acción (pagar, adelanto, etc.)
  const recargarDatos = useCallback(async () => {
    setRecalculando(true)
    try {
      const res = await fetch(`/api/nominas?desde=${periodoActual.desde}&hasta=${periodoActual.hasta}&empleados=${datosEmpleado.miembro_id}`)
      const data = await res.json()
      const resultado = (data.resultados || []).find((r: ResultadoNomina) => r.miembro_id === datosEmpleado.miembro_id)
      if (resultado) setDatosEmpleado(resultado)
    } catch { /* silenciar */ }
    finally { setRecalculando(false) }
    await cargarPagosYAdelantos(datosEmpleado.miembro_id, periodoActual.desde, periodoActual.hasta)
  }, [datosEmpleado.miembro_id, periodoActual.desde, periodoActual.hasta, cargarPagosYAdelantos])

  // ─── Navegación entre empleados ───

  const indiceEmpleado = empleadosPeriodo.findIndex(e => e.miembro_id === datosEmpleado.miembro_id)
  const empleadoPrev = indiceEmpleado > 0 ? empleadosPeriodo[indiceEmpleado - 1] : null
  const empleadoNext = indiceEmpleado >= 0 && indiceEmpleado < empleadosPeriodo.length - 1
    ? empleadosPeriodo[indiceEmpleado + 1]
    : null

  // Navegar a otro empleado sin re-montar el page (evita el loading.tsx de /asistencias)
  const irAEmpleado = useCallback(async (id: string) => {
    setRecalculando(true)

    // Si conocemos la frecuencia del nuevo empleado (de empleadosPeriodo), ajustamos
    // el período al tipo natural del empleado manteniendo la fecha de referencia.
    // Ej: de "quincena 16-30 abril" viendo a Juan (quincenal), al navegar a Pedro
    // (mensual) se abre "abril entero". Así cada empleado siempre se ve en su período.
    const empleadoMeta = empleadosPeriodo.find(e => e.miembro_id === id)
    const tipoPrefer = tipoPeriodoPorFrecuencia(empleadoMeta?.compensacion_frecuencia)
    const periodoDestino = tipoPrefer !== tipoPeriodo
      ? calcularPeriodo(fechaRef, tipoPrefer)
      : periodoActual

    // Si cambiamos de tipo, actualizamos estado local antes del fetch
    if (tipoPrefer !== tipoPeriodo) {
      setTipoPeriodo(tipoPrefer)
      setPeriodoActual(periodoDestino)
    }

    // Sync URL sin disparar loading.tsx ni re-ejecutar el page
    if (typeof window !== 'undefined') {
      window.history.replaceState(null, '', `/nominas/empleado/${id}?desde=${periodoDestino.desde}&hasta=${periodoDestino.hasta}`)
    }

    try {
      const res = await fetch(`/api/nominas?desde=${periodoDestino.desde}&hasta=${periodoDestino.hasta}&empleados=${id}`)
      const data = await res.json()
      const resultado = (data.resultados || []).find((r: ResultadoNomina) => r.miembro_id === id)
      if (resultado) {
        setDatosEmpleado(resultado)
        // Sincronizar compensación editable con el nuevo empleado
        setCompTipo(resultado.compensacion_tipo)
        setCompMonto(String(resultado.compensacion_monto))
        setCompFrecuencia(resultado.compensacion_frecuencia || 'mensual')
        // Reset de estados de UI transitorios
        setCompEditando(false)
        setConfirmandoPago(false)
        setMostrarFormAdelanto(false)
        setEditandoPago(null)
        setEditandoAdelanto(null)
        // días_trabajo se recarga automáticamente por el useEffect que observa datosEmpleado.miembro_id
      }
    } catch { /* silenciar */ }
    finally { setRecalculando(false) }

    cargarPagosYAdelantos(id, periodoDestino.desde, periodoDestino.hasta)
  }, [periodoActual, tipoPeriodo, fechaRef, empleadosPeriodo, cargarPagosYAdelantos])

  // ─── Guardar compensación + historial ───

  const guardarCompensacion = useCallback(async (campo: string, valor: unknown, valorAnterior?: unknown) => {
    const [, { data: user }, { data: miembroData }] = await Promise.all([
      supabase.from('miembros').update({ [campo]: valor }).eq('id', datosEmpleado.miembro_id),
      supabase.auth.getUser(),
      supabase.from('miembros').select('empresa_id').eq('id', datosEmpleado.miembro_id).single(),
    ])

    if (miembroData && user.user) {
      const { data: perfil } = await supabase.from('perfiles').select('nombre, apellido').eq('id', user.user.id).single()
      let porcentajeCambio: number | null = null
      if (campo === 'compensacion_monto' && valorAnterior && Number(valorAnterior) > 0) {
        porcentajeCambio = Math.round(((Number(valor) - Number(valorAnterior)) / Number(valorAnterior)) * 10000) / 100
      }
      supabase.from('historial_compensacion').insert({
        empresa_id: (miembroData as Record<string, unknown>).empresa_id,
        miembro_id: datosEmpleado.miembro_id,
        campo,
        valor_anterior: valorAnterior != null ? String(valorAnterior) : null,
        valor_nuevo: String(valor),
        porcentaje_cambio: porcentajeCambio,
        creado_por: user.user.id,
        creado_por_nombre: perfil ? `${(perfil as Record<string, unknown>).nombre} ${(perfil as Record<string, unknown>).apellido}` : 'Sistema',
      }).then(() => {})
    }
    recargarDatos()
  }, [datosEmpleado.miembro_id, supabase, recargarDatos])

  // ─── Confirmar pago ───
  //
  // Llama al endpoint nuevo POST /api/nominas/pagos que:
  //   1. Recalcula el recibo con el motor (autoritativo).
  //   2. Inserta pagos_nomina con contrato_id + contrato_snapshot.
  //   3. Inserta conceptos_aplicados_pago (snapshot inmutable de
  //      cada haber/descuento aplicado).
  //   4. Marca las cuotas de adelanto como descontadas.
  //
  // Antes la UI insertaba directo a pagos_nomina y llamaba aparte a
  // /api/adelantos/descontar, lo que dejaba los pagos sin snapshot del
  // contrato ni desglose de conceptos.

  const handleConfirmarPago = async () => {
    setPagando(true)
    // Si el motor ya respondió usamos su neto; sino caemos al legacy.
    const netoFuente = detalleMotor ? netoEfectivo : emp.monto_neto
    const montoReal = parseFloat(montoAPagar) || netoFuente

    try {
      const res = await fetch('/api/nominas/pagos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          miembro_id: datosEmpleado.miembro_id,
          periodo_inicio: periodoActual.desde,
          periodo_fin: periodoActual.hasta,
          monto_abonado: montoReal,
          concepto: periodoActual.etiqueta,
          notas: notasPago || null,
          conceptos_extra: conceptosExtras.length > 0
            ? conceptosExtras.map(e => ({
                nombre: e.nombre,
                tipo: e.tipo,
                monto: e.monto,
                detalle: e.detalle ?? null,
              }))
            : undefined,
        }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        console.error('[PaginaEditorNominaEmpleado] error al grabar pago:', data)
      }
    } catch (err) {
      console.error('[PaginaEditorNominaEmpleado] error de red al grabar pago:', err)
    }

    await recargarDatos()
    setPagando(false)
    setConfirmandoPago(false)
    setMontoAPagar('')
    setNotasPago('')
  }

  // Editar / eliminar pago — registra auditoría de editor
  const handleEditarPago = async (pagoId: string) => {
    const monto = parseFloat(editMontoAbonado)
    if (!monto || monto <= 0) return
    const { data: user } = await supabase.auth.getUser()
    const userId = user.user?.id || null
    let nombreEditor: string | null = null
    if (userId) {
      const { data: perfil } = await supabase.from('perfiles').select('nombre, apellido').eq('id', userId).single()
      nombreEditor = perfil ? `${(perfil as Record<string, unknown>).nombre} ${(perfil as Record<string, unknown>).apellido}` : null
    }
    await supabase.from('pagos_nomina').update({
      monto_abonado: monto,
      editado_por: userId,
      editado_por_nombre: nombreEditor,
      editado_en: new Date().toISOString(),
    }).eq('id', pagoId)
    setEditandoPago(null)
    await recargarDatos()
  }

  // Descargar el PDF del recibo: pide al backend que lo genere (Puppeteer)
  // y abre la URL firmada en una pestaña nueva para ver/descargar.
  const handleDescargarPdf = async (pagoId: string) => {
    try {
      const res = await fetch(`/api/nominas/pagos/${pagoId}/pdf`, { method: 'GET' })
      const data = await res.json()
      if (!res.ok || !data.url) {
        console.error('[PaginaEditorNominaEmpleado] error PDF:', data)
        return
      }
      window.open(data.url, '_blank')
    } catch (err) {
      console.error('[PaginaEditorNominaEmpleado] error de red al pedir PDF:', err)
    }
  }

  const handleEliminarPago = async (pagoId: string) => {
    const { data: user } = await supabase.auth.getUser()
    const userId = user.user?.id || null
    let nombreEliminador: string | null = null
    if (userId) {
      const { data: perfil } = await supabase.from('perfiles').select('nombre, apellido').eq('id', userId).single()
      nombreEliminador = perfil ? `${(perfil as Record<string, unknown>).nombre} ${(perfil as Record<string, unknown>).apellido}` : null
    }
    await supabase.from('pagos_nomina').update({
      eliminado: true,
      eliminado_en: new Date().toISOString(),
      eliminado_por: userId,
      eliminado_por_nombre: nombreEliminador,
    }).eq('id', pagoId)
    await recargarDatos()
  }

  // Crear / editar / cancelar adelantos
  const handleCrearAdelanto = async () => {
    const monto = parseFloat(adelantoMonto)
    if (!monto || monto <= 0) return
    setCreandoAdelanto(true)

    const frecuencia = compFrecuencia === 'eventual' ? 'mensual' : compFrecuencia
    // La fecha del campo es la fecha real del adelanto/descuento: define cuándo ocurrió
    // y desde dónde se descuenta (con 1 cuota cae en ese mismo período).
    const fechaAdelanto = adelantoFecha || new Date().toISOString().split('T')[0]
    // Los descuentos puntuales son siempre de 1 cuota (no se entregó dinero al empleado).
    const cuotasTotales = adelantoTipo === 'descuento' ? 1 : (parseInt(adelantoCuotas) || 1)
    await fetch('/api/adelantos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        miembro_id: datosEmpleado.miembro_id,
        tipo: adelantoTipo,
        monto_total: monto,
        cuotas_totales: cuotasTotales,
        fecha_solicitud: fechaAdelanto,
        fecha_inicio_descuento: fechaAdelanto,
        frecuencia_descuento: frecuencia,
        notas: adelantoNotas || null,
      }),
    })

    await recargarDatos()
    setCreandoAdelanto(false)
    setMostrarFormAdelanto(false)
    setAdelantoTipo('adelanto'); setAdelantoMonto(''); setAdelantoCuotas('1'); setAdelantoNotas(''); setAdelantoFecha('')
  }

  const handleEditarAdelanto = async (id: string) => {
    setGuardandoEditAdelanto(true)
    await fetch(`/api/adelantos/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        monto_total: parseFloat(editAdelantoMonto) || undefined,
        cuotas_totales: parseInt(editAdelantoCuotas) || undefined,
        notas: editAdelantoNotas,
      }),
    })
    await recargarDatos()
    setGuardandoEditAdelanto(false)
    setEditandoAdelanto(null)
  }

  const handleCancelarAdelanto = async (id: string) => {
    await fetch(`/api/adelantos/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ estado: 'cancelado' }),
    })
    setAdelantos(prev => prev.filter(a => a.id !== id))
  }

  // ─── Cálculos derivados ───

  const emp = datosEmpleado
  const diasAHorario = Math.max(0, emp.dias_trabajados - emp.dias_tardanza)
  const pctAsistencia = emp.dias_laborales > 0
    ? Math.round((emp.dias_trabajados / emp.dias_laborales) * 100) : 0
  const proyeccionMensual = compTipo === 'por_dia'
    ? (parseFloat(compMonto) || 0) * compDias * 4.33
    : parseFloat(compMonto) || 0

  const cuotasInfoPeriodo = useMemo(() => {
    const items = adelantos.map(a => {
      const cuotas = (a.cuotas || []) as Record<string, unknown>[]
      const cuotaDelPeriodo = cuotas.find(c =>
        (c.fecha_programada as string) >= periodoActual.desde &&
        (c.fecha_programada as string) <= periodoActual.hasta
      )
      if (!cuotaDelPeriodo) return null
      return {
        tipo: ((a.tipo as string) || 'adelanto') as 'adelanto' | 'descuento',
        numeroCuota: cuotaDelPeriodo.numero_cuota as number,
        cuotasTotales: a.cuotas_totales as number,
        monto: parseFloat(cuotaDelPeriodo.monto_cuota as string),
        notas: a.notas as string,
        fechaSolicitud: a.fecha_solicitud as string,
      }
    }).filter(Boolean) as { tipo: 'adelanto' | 'descuento'; numeroCuota: number; cuotasTotales: number; monto: number; notas: string; fechaSolicitud: string }[]
    // Orden cronológico ascendente: más viejo arriba, más reciente abajo.
    return items.sort((a, b) => a.fechaSolicitud.localeCompare(b.fechaSolicitud))
  }, [adelantos, periodoActual.desde, periodoActual.hasta])

  // Mismo orden cronológico ascendente para la lista visible de adelantos.
  const adelantosOrdenados = useMemo(() => {
    return [...adelantos].sort((a, b) => {
      const fa = (a.fecha_solicitud as string) || ''
      const fb = (b.fecha_solicitud as string) || ''
      return fa.localeCompare(fb)
    })
  }, [adelantos])

  // ─── Totales del motor (combinando aplicados + manuales + adelantos + saldo) ───
  //
  // Cuando el motor todavía no respondió, `detalleMotor` es null y el desglose
  // cae al modelo legacy (emp.monto_*). Cuando responde, todos los totales que
  // se muestran y el modal de pago salen del motor.
  const extrasHaberes = useMemo(
    () => conceptosExtras.filter(e => e.tipo === 'haber').reduce((s, e) => s + e.monto, 0),
    [conceptosExtras],
  )
  const extrasDescuentos = useMemo(
    () => conceptosExtras.filter(e => e.tipo === 'descuento').reduce((s, e) => s + e.monto, 0),
    [conceptosExtras],
  )

  /** Subtotal de haberes mostrado en el desglose: base + automáticos + extras. */
  const haberesTotales = useMemo(() => {
    if (!detalleMotor) return emp.monto_pagar
    return detalleMotor.subtotal_haberes + extrasHaberes
  }, [detalleMotor, emp.monto_pagar, extrasHaberes])

  /**
   * Subtotal de descuentos: del motor (conceptos descuento + adelantos) +
   * extras manuales descuento + saldo anterior si es positivo (favor del
   * empleado del período pasado, se descuenta este período).
   */
  const descuentosTotales = useMemo(() => {
    if (!detalleMotor) return emp.descuento_adelanto + Math.max(0, emp.saldo_anterior)
    return detalleMotor.subtotal_descuentos + extrasDescuentos + Math.max(0, emp.saldo_anterior)
  }, [detalleMotor, emp.descuento_adelanto, emp.saldo_anterior, extrasDescuentos])

  /**
   * Neto efectivo: si hay motor lo usamos como fuente; sino el legacy.
   * El saldo en contra del período anterior (negativo) se suma al neto.
   */
  const netoEfectivo = useMemo(() => {
    if (!detalleMotor) return emp.monto_neto
    const baseConSaldo = haberesTotales - descuentosTotales
    // saldo_anterior < 0 = el empleado quedó debiendo del período pasado
    // → se suma a este período.
    return baseConSaldo + (emp.saldo_anterior < 0 ? Math.abs(emp.saldo_anterior) : 0)
  }, [detalleMotor, emp.monto_neto, emp.saldo_anterior, haberesTotales, descuentosTotales])

  const pagoDelPeriodo = pagos.length > 0 ? pagos[0] : null
  const montoAbonadoPeriodo = pagoDelPeriodo ? parseFloat(pagoDelPeriodo.monto_abonado as string) : 0
  const hayPago = pagoDelPeriodo != null
  const diferenciaPago = hayPago ? montoAbonadoPeriodo - netoEfectivo : 0

  // ─── Sugeridos visibles (los que el operador todavía no aplicó) ───
  const sugeridosDisponibles = useMemo<ConceptoAplicadoCalculado[]>(() => {
    if (!detalleMotor) return []
    const yaAplicados = new Set(
      conceptosExtras.map(e => e.concepto_id).filter((id): id is string => !!id),
    )
    return detalleMotor.conceptos_sugeridos.filter(s => !yaAplicados.has(s.concepto_id))
  }, [detalleMotor, conceptosExtras])

  /**
   * Calcula el monto que tendría un concepto sugerido si se aplicara
   * manualmente. Espeja `calcularMontoConcepto` del motor — duplicado
   * para no arrastrar el módulo del servidor al bundle del cliente.
   */
  const calcularMontoSugerido = useCallback(
    (modo: ModoCalculoConcepto, valor: number | null, base: number, asistencia: MetricasAsistencia): number => {
      if (valor === null) return 0
      if (modo === 'monto_fijo') return valor
      if (modo === 'porcentaje_basico') return Math.round(base * (valor / 100) * 100) / 100
      if (modo === 'por_dia') return valor * asistencia.dias_trabajados
      if (modo === 'por_evento') return valor
      return 0
    },
    [],
  )

  /** Aplica un sugerido al recibo: lo agrega a `conceptosExtras`. */
  const aplicarSugerido = useCallback((s: ConceptoAplicadoCalculado) => {
    if (!detalleMotor) return
    const monto = calcularMontoSugerido(
      s.modo_calculo,
      s.valor,
      detalleMotor.monto_base_calculado,
      detalleMotor.asistencia,
    )
    setConceptosExtras(prev => [
      ...prev,
      {
        nombre: s.nombre,
        tipo: s.tipo,
        monto,
        detalle: s.detalle,
        concepto_id: s.concepto_id,
      },
    ])
  }, [detalleMotor, calcularMontoSugerido])

  const quitarExtra = useCallback((idx: number) => {
    setConceptosExtras(prev => prev.filter((_, i) => i !== idx))
  }, [])

  // Clave común para re-disparar la animación de los números en cada cambio de
  // período o empleado (aunque el valor visible sea el mismo).
  const animKey = `${datosEmpleado.miembro_id}-${periodoActual.desde}-${periodoActual.hasta}`

  // ─── Render ───

  // Insignias del cabecero (navegación entre empleados + tipo de compensación)
  const insigniasCabecero = (
    <div className="flex items-center gap-2">
      {empleadosPeriodo.length > 1 && (
        <div className="flex items-center gap-1 mr-1">
          <Boton
            variante="fantasma"
            tamano="xs"
            soloIcono
            icono={<ChevronLeft size={14} />}
            onClick={() => empleadoPrev && irAEmpleado(empleadoPrev.miembro_id)}
            disabled={!empleadoPrev}
            titulo={empleadoPrev ? `Anterior: ${empleadoPrev.nombre}` : 'Sin empleado anterior'}
          />
          <span className="text-xxs text-texto-terciario tabular-nums">
            {indiceEmpleado + 1}/{empleadosPeriodo.length}
          </span>
          <Boton
            variante="fantasma"
            tamano="xs"
            soloIcono
            icono={<ChevronRight size={14} />}
            onClick={() => empleadoNext && irAEmpleado(empleadoNext.miembro_id)}
            disabled={!empleadoNext}
            titulo={empleadoNext ? `Siguiente: ${empleadoNext.nombre}` : 'Sin empleado siguiente'}
          />
        </div>
      )}
      <Insignia color={compTipo === 'por_dia' ? 'info' : compTipo === 'por_hora' ? 'cyan' : 'primario'}>
        {compTipo === 'por_dia' ? 'Por día' : compTipo === 'por_hora' ? 'Por hora' : 'Sueldo fijo'}
      </Insignia>
      <Insignia color="neutro">
        {compFrecuencia === 'semanal' ? 'Semanal' : compFrecuencia === 'quincenal' ? 'Quincenal' : 'Mensual'}
      </Insignia>
    </div>
  )

  // ─── Banner editorial (hero) ───

  const desdeDate = useMemo(() => new Date(periodoActual.desde + 'T12:00:00'), [periodoActual.desde])
  const hastaDate = useMemo(() => new Date(periodoActual.hasta + 'T12:00:00'), [periodoActual.hasta])

  const enPeriodoActual = useMemo(() => {
    const hoy = calcularPeriodo(new Date(), tipoPeriodo)
    return hoy.desde === periodoActual.desde && hoy.hasta === periodoActual.hasta
  }, [tipoPeriodo, periodoActual.desde, periodoActual.hasta])

  const banner = (
    <CabezaloHero
      titulo={<HeroRango desde={desdeDate} hasta={hastaDate} periodo={tipoPeriodo} />}
      onAnterior={() => aplicarPeriodo(navegarFecha(fechaRef, tipoPeriodo, 'prev'), tipoPeriodo)}
      onSiguiente={() => aplicarPeriodo(navegarFecha(fechaRef, tipoPeriodo, 'next'), tipoPeriodo)}
      onHoy={() => aplicarPeriodo(new Date(), tipoPeriodo)}
      hoyDeshabilitado={enPeriodoActual}
      slotControles={
        <GrupoBotones>
          {(['mes', 'quincena', 'semana'] as TipoPeriodo[]).map(t => (
            <Boton
              key={t}
              variante="secundario"
              tamano="sm"
              onClick={() => aplicarPeriodo(fechaRef, t)}
              className={tipoPeriodo === t ? 'bg-superficie-hover text-texto-primario font-semibold' : 'text-texto-terciario'}
            >
              {t === 'semana' ? 'Semana' : t === 'quincena' ? 'Quincena' : 'Mes'}
            </Boton>
          ))}
        </GrupoBotones>
      }
    />
  )

  // ─── Derivados para el nuevo layout ───

  /** Mapa fecha → clasificación para alimentar el mini-calendario */
  const mapaDiasEstado = useMemo(() => {
    const mapa: Record<string, string> = {}
    for (const d of (emp.dias_detalle || [])) mapa[d.fecha] = d.clasificacion
    return mapa
  }, [emp.dias_detalle])

  /** Metadatos del cabezal de persona (puesto, fecha de ingreso, documento) */
  const metadatosEmpleado = useMemo(() => {
    const items: { id: string; etiqueta: string; valor: string }[] = []
    if (emp.fecha_ingreso) {
      const d = new Date(emp.fecha_ingreso)
      items.push({
        id: 'ingreso',
        etiqueta: 'Desde',
        valor: d.toLocaleDateString(locale, { day: '2-digit', month: 'short', year: 'numeric' }),
      })
    }
    if (emp.documento?.numero) {
      items.push({
        id: 'doc',
        etiqueta: emp.documento.tipo || 'DOC',
        valor: emp.documento.numero,
      })
    }
    if (emp.numero_empleado) {
      items.push({ id: 'legajo', etiqueta: 'Legajo', valor: emp.numero_empleado })
    }
    return items
  }, [emp.fecha_ingreso, emp.documento, emp.numero_empleado, locale])

  /** Tono y mensajes del banner superior según la situación del período */
  const bannerEstado: {
    tono: TonoBanner
    etiqueta: string
    subtitulo: string
    titulo: string
    descripcion: ReactNode
  } = (() => {
    if (hayPago) {
      return {
        tono: 'exito',
        etiqueta: 'Pagado',
        subtitulo: 'Período cerrado',
        titulo: `Se pagó ${fmtMonto(montoAbonadoPeriodo)}`,
        descripcion: diferenciaPago === 0
          ? 'El monto coincide con el neto sugerido del período.'
          : diferenciaPago > 0
            ? <>Se pagó <strong className="text-texto-primario">{fmtMonto(diferenciaPago)}</strong> de más. Se descuenta en el próximo período.</>
            : <>Quedó debiendo <strong className="text-texto-primario">{fmtMonto(Math.abs(diferenciaPago))}</strong>. Se suma al próximo período.</>,
      }
    }
    if (netoEfectivo < 0) {
      return {
        tono: 'advertencia',
        etiqueta: 'A favor de la empresa',
        subtitulo: 'Pendiente de cierre',
        titulo: 'Este período no corresponde pago',
        descripcion: <>El empleado quedó <strong className="text-insignia-advertencia">{fmtMonto(Math.abs(netoEfectivo))}</strong> en contra. Podés arrastrar el saldo al próximo período o cancelarlo con trabajo extra.</>,
      }
    }
    if (netoEfectivo === 0) {
      return {
        tono: 'info',
        etiqueta: 'Sin saldo',
        subtitulo: 'Pendiente de cierre',
        titulo: 'No hay monto a transferir',
        descripcion: 'Los descuentos igualan al bruto. No se registra pago pero el período queda cerrado.',
      }
    }
    return {
      tono: 'neutro',
      etiqueta: 'Pendiente',
      subtitulo: 'Sin pago registrado',
      titulo: `Corresponde pagar ${fmtMonto(netoEfectivo)}`,
      descripcion: 'Confirmá la información de la derecha y registrá el pago cuando esté listo.',
    }
  })()

  /**
   * Términos de la fórmula. Si el motor respondió usamos sus subtotales
   * para reflejar el desglose real (haberes − descuentos − saldo). Si
   * todavía no respondió, cae al modelo legacy.
   */
  const formulaCalculo: TerminoFormula[] = (() => {
    if (detalleMotor) {
      const terminos: TerminoFormula[] = [
        { etiqueta: 'Haberes', valor: fmtMonto(haberesTotales) },
      ]
      const descuentosMotorYExtras = detalleMotor.subtotal_descuentos + extrasDescuentos
      if (descuentosMotorYExtras > 0) {
        terminos.push({ etiqueta: 'Descuentos', valor: fmtMonto(descuentosMotorYExtras), operador: '−', tono: 'advertencia' })
      }
      if (emp.saldo_anterior > 0) {
        terminos.push({ etiqueta: 'Saldo ant.', valor: fmtMonto(emp.saldo_anterior), operador: '−', tono: 'info' })
      } else if (emp.saldo_anterior < 0) {
        terminos.push({ etiqueta: 'Saldo ant.', valor: fmtMonto(Math.abs(emp.saldo_anterior)), operador: '+', tono: 'peligro' })
      }
      terminos.push({
        etiqueta: 'Neto',
        valor: fmtMonto(netoEfectivo),
        operador: '=',
        tono: netoEfectivo < 0 ? 'advertencia' : netoEfectivo === 0 ? 'neutro' : 'exito',
        esResultado: true,
      })
      return terminos
    }
    // Fallback legacy mientras el motor no respondió.
    const terminos: TerminoFormula[] = [
      { etiqueta: 'Bruto', valor: fmtMonto(emp.monto_pagar) },
    ]
    if (emp.descuento_adelanto > 0) {
      terminos.push({ etiqueta: 'Adelanto', valor: fmtMonto(emp.descuento_adelanto), operador: '−', tono: 'advertencia' })
    }
    if (emp.saldo_anterior > 0) {
      terminos.push({ etiqueta: 'Saldo ant.', valor: fmtMonto(emp.saldo_anterior), operador: '−', tono: 'info' })
    } else if (emp.saldo_anterior < 0) {
      terminos.push({ etiqueta: 'Saldo ant.', valor: fmtMonto(Math.abs(emp.saldo_anterior)), operador: '+', tono: 'peligro' })
    }
    terminos.push({
      etiqueta: 'Neto',
      valor: fmtMonto(emp.monto_neto),
      operador: '=',
      tono: emp.monto_neto < 0 ? 'advertencia' : emp.monto_neto === 0 ? 'neutro' : 'exito',
      esResultado: true,
    })
    return terminos
  })()

  return (
    <>
      <PlantillaEditor
        titulo={datosEmpleado.nombre}
        insignias={insigniasCabecero}
        volverTexto={textoVolver}
        onVolver={() => router.push(rutaVolver)}
        acciones={[
          // Enviar recibo: requiere nomina:enviar. Sin ese permiso (p. ej. un
          // empleado viendo su propio recibo), el botón desaparece.
          ...(puedeEnviarNomina ? [{
            id: 'enviar-recibo',
            etiqueta: 'Enviar recibo',
            icono: <Send size={13} />,
            variante: 'secundario' as const,
            onClick: () => setModalEnvio(true),
          }] : []),
          // Registrar pago: requiere nomina:editar. Modifica pagos_nomina.
          ...(puedeEditarNomina ? [{
            id: 'pagar',
            etiqueta: 'Registrar pago',
            icono: <Banknote size={14} />,
            variante: 'primario' as const,
            onClick: () => { setMontoAPagar(String(netoEfectivo)); setConfirmandoPago(true) },
          }] : []),
        ]}
        banner={banner}
      >
        <div className="max-w-6xl mx-auto space-y-5">

          {/* ── CABEZAL DEL EMPLEADO ── */}
          <CabezaloPersona
            etiquetaTipo="Empleado"
            nombre={datosEmpleado.nombre}
            foto={emp.foto_url}
            subtitulo={emp.puesto || undefined}
            badge={<Insignia color="exito" tamano="sm">● Activo</Insignia>}
            metadatos={metadatosEmpleado}
          />

          {/* ── BANNER RESUMEN DE CÁLCULO ── */}
          <BannerResumenCalculo
            tono={bannerEstado.tono}
            etiquetaEstado={bannerEstado.etiqueta}
            subEstado={bannerEstado.subtitulo}
            titulo={bannerEstado.titulo}
            descripcion={bannerEstado.descripcion}
            formula={formulaCalculo}
          />

          {/* ── GRID 2 COLUMNAS ── */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

            {/* ═══════ COLUMNA IZQUIERDA ═══════ */}
            <div className="space-y-4">

              {/* ─── ASISTENCIA (con mini-calendario) ─── */}
              <TarjetaPanel
                titulo="Asistencia"
                subtitulo="del período"
                icono={<ClipboardCheck size={13} />}
                accion={recalculando ? (
                  <div className="size-3 border-2 border-texto-marca/30 border-t-texto-marca rounded-full animate-spin" />
                ) : undefined}
              >
                <div className="grid grid-cols-4 gap-3 text-center mb-4">
                  <div>
                    <p className="text-xl font-bold text-texto-primario tabular-nums">
                      <NumeroAnimado claveAnim={animKey}>
                        {emp.dias_trabajados}<span className="text-sm font-normal text-texto-terciario">/{emp.dias_laborales}</span>
                      </NumeroAnimado>
                    </p>
                    <p className="text-[10px] text-texto-terciario uppercase mt-1">Trabajados</p>
                  </div>
                  <div>
                    <p className="text-xl font-bold text-insignia-exito tabular-nums">
                      <NumeroAnimado claveAnim={animKey}>{diasAHorario}</NumeroAnimado>
                    </p>
                    <p className="text-[10px] text-texto-terciario uppercase mt-1">A horario</p>
                  </div>
                  <div>
                    <p className={`text-xl font-bold tabular-nums ${emp.dias_tardanza > 0 ? 'text-insignia-advertencia' : 'text-texto-terciario'}`}>
                      <NumeroAnimado claveAnim={animKey}>{emp.dias_tardanza}</NumeroAnimado>
                    </p>
                    <p className="text-[10px] text-texto-terciario uppercase mt-1">Tardanzas</p>
                  </div>
                  <div>
                    <p className={`text-xl font-bold tabular-nums ${emp.dias_ausentes > 0 ? 'text-insignia-peligro' : 'text-texto-terciario'}`}>
                      <NumeroAnimado claveAnim={animKey}>{emp.dias_ausentes}</NumeroAnimado>
                    </p>
                    <p className="text-[10px] text-texto-terciario uppercase mt-1">Ausencias</p>
                  </div>
                </div>

                {/* Mini-calendario del período */}
                {(emp.dias_detalle && emp.dias_detalle.length > 0) && (
                  <CalendarioPeriodoMini
                    desde={periodoActual.desde}
                    hasta={periodoActual.hasta}
                    diasEstado={mapaDiasEstado}
                    estados={ESTADOS_DIAS_NOMINA}
                  />
                )}
              </TarjetaPanel>

              {/* ─── JORNADAS (sólo para jornaleros) ─── */}
              {compTipo === 'por_dia' && (
                <TarjetaPanel
                  titulo="Jornadas"
                  icono={<Calendar size={13} />}
                  accion={typeof emp.jornales_equivalentes === 'number' ? (
                    <span className="text-[11px] text-texto-secundario">
                      Equivalen a <span className="font-semibold text-texto-primario tabular-nums">{emp.jornales_equivalentes}</span> jornal{emp.jornales_equivalentes === 1 ? '' : 'es'}
                    </span>
                  ) : undefined}
                >
                  <div className="grid grid-cols-3 gap-3 text-center">
                    <div>
                      <p className="text-2xl font-bold text-insignia-exito tabular-nums">
                        <NumeroAnimado claveAnim={animKey}>{emp.dias_jornada_completa ?? 0}</NumeroAnimado>
                      </p>
                      <p className="text-[11px] text-texto-terciario mt-0.5">Completas</p>
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-insignia-advertencia tabular-nums">
                        <NumeroAnimado claveAnim={animKey}>{emp.dias_media_jornada ?? 0}</NumeroAnimado>
                      </p>
                      <p className="text-[11px] text-texto-terciario mt-0.5">Medias</p>
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-insignia-info tabular-nums">
                        <NumeroAnimado claveAnim={animKey}>{emp.dias_presente_parcial ?? 0}</NumeroAnimado>
                      </p>
                      <p className="text-[11px] text-texto-terciario mt-0.5">Parciales</p>
                    </div>
                  </div>
                </TarjetaPanel>
              )}

              {/* ─── DESGLOSE DEL CÁLCULO ─── */}
              {/*
                Desglose principal del recibo. Cuando el motor respondió
                usamos su desglose autoritativo (monto base + conceptos
                automáticos + adelantos). Mientras carga, mostramos un
                fallback al modelo legacy para que la UI no parpadee.
              */}
              <TarjetaPanel
                titulo="Desglose del cálculo"
                icono={<TrendingDown size={13} />}
                accion={cargandoMotor ? (
                  <div className="size-3 border-2 border-texto-marca/30 border-t-texto-marca rounded-full animate-spin" />
                ) : emp.compensacion_tipo === 'por_dia' && puedeEditarNomina ? (
                  <Boton variante="fantasma" tamano="xs" icono={<Pencil size={11} />}
                    onClick={() => { setMontoAPagar(String(netoEfectivo)); setConfirmandoPago(true) }}>
                    Ajustar manualmente
                  </Boton>
                ) : undefined}
              >
                {detalleMotor ? (
                  <div className="space-y-3">

                    {/* Advertencias del motor (ej. "Sin contrato cargado") */}
                    {detalleMotor.advertencias.length > 0 && (
                      <div className="rounded-card border border-insignia-advertencia/30 bg-insignia-advertencia/10 p-2.5 space-y-1">
                        {detalleMotor.advertencias.map((adv, i) => (
                          <p key={i} className="text-[11px] text-insignia-advertencia flex items-start gap-1.5">
                            <AlertTriangle size={11} className="shrink-0 mt-0.5" />
                            <span>{adv}</span>
                          </p>
                        ))}
                      </div>
                    )}

                    {/* MONTO BASE — protagonista */}
                    <div className="pb-3 border-b border-white/[0.07]">
                      <p className="text-[11px] text-texto-terciario uppercase tracking-wider">Monto base</p>
                      <p className="text-3xl font-bold tabular-nums mt-1 text-texto-primario">
                        <NumeroAnimado claveAnim={animKey}>{fmtMonto(detalleMotor.monto_base_calculado)}</NumeroAnimado>
                      </p>
                      <p className="text-[11px] text-texto-terciario mt-1">
                        {describirCalculoBase(detalleMotor)}
                      </p>
                    </div>

                    {/* CONCEPTOS AUTOMÁTICOS APLICADOS */}
                    {detalleMotor.conceptos_aplicados.length > 0 && (
                      <div className="space-y-1.5">
                        <p className="text-[11px] text-texto-terciario uppercase tracking-wider">
                          Conceptos automáticos · {detalleMotor.conceptos_aplicados.length}
                        </p>
                        {detalleMotor.conceptos_aplicados.map(c => (
                          <div key={c.concepto_id} className="flex items-start justify-between gap-3 text-sm py-1">
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-1.5">
                                {c.tipo === 'haber' ? (
                                  <TrendingUp size={11} className="text-insignia-exito shrink-0" />
                                ) : (
                                  <TrendingDown size={11} className="text-insignia-advertencia shrink-0" />
                                )}
                                <p className="text-texto-primario truncate">{c.nombre}</p>
                              </div>
                              {c.detalle && (
                                <p className="text-[11px] text-texto-terciario mt-0.5 ml-4">{c.detalle}</p>
                              )}
                            </div>
                            <span className={`font-medium tabular-nums shrink-0 ${c.tipo === 'haber' ? 'text-insignia-exito' : 'text-insignia-advertencia'}`}>
                              {c.tipo === 'haber' ? '+' : '−'}{fmtMonto(c.monto)}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* CONCEPTOS MANUALES (aplicados desde sugeridos o agregados libres) */}
                    {conceptosExtras.length > 0 && (
                      <div className="space-y-1.5 pt-2 border-t border-white/[0.05]">
                        <p className="text-[11px] text-texto-terciario uppercase tracking-wider">
                          Aplicados manualmente · {conceptosExtras.length}
                        </p>
                        {conceptosExtras.map((c, i) => (
                          <div key={i} className="flex items-start justify-between gap-3 text-sm py-1 group">
                            <div className="min-w-0 flex-1 flex items-start gap-1.5">
                              {puedeEditarNomina && (
                                <button
                                  type="button"
                                  onClick={() => quitarExtra(i)}
                                  title="Quitar concepto"
                                  className="text-texto-terciario hover:text-insignia-peligro mt-0.5 shrink-0 opacity-60 group-hover:opacity-100 transition-opacity"
                                >
                                  <X size={11} />
                                </button>
                              )}
                              <div className="min-w-0">
                                <p className="text-texto-primario truncate">{c.nombre}</p>
                                {c.detalle && (
                                  <p className="text-[11px] text-texto-terciario mt-0.5">{c.detalle}</p>
                                )}
                              </div>
                            </div>
                            <span className={`font-medium tabular-nums shrink-0 ${c.tipo === 'haber' ? 'text-insignia-exito' : 'text-insignia-advertencia'}`}>
                              {c.tipo === 'haber' ? '+' : '−'}{fmtMonto(c.monto)}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* ADELANTOS DESCONTADOS (cuotas vencidas) */}
                    {detalleMotor.adelantos_aplicados.length > 0 && (
                      <div className="space-y-1.5 pt-2 border-t border-white/[0.05]">
                        <p className="text-[11px] text-texto-terciario uppercase tracking-wider">
                          Adelantos descontados · {detalleMotor.adelantos_aplicados.length}
                        </p>
                        {detalleMotor.adelantos_aplicados.map(a => (
                          <div key={a.cuota_id} className="flex items-start justify-between gap-3 text-sm py-1">
                            <div className="min-w-0 flex items-center gap-1.5">
                              <Receipt size={11} className="text-insignia-advertencia shrink-0" />
                              <p className="text-texto-primario truncate">
                                Cuota {a.numero_cuota}
                                {a.fecha_programada < periodoActual.desde && (
                                  <span className="ml-1.5 inline-flex items-center px-1 py-0.5 rounded bg-insignia-peligro/15 text-insignia-peligro text-[9px] font-medium uppercase tracking-wide">
                                    Atrasada
                                  </span>
                                )}
                                <span className="text-texto-terciario text-[11px] ml-1.5">{fmtFecha(a.fecha_programada)}</span>
                              </p>
                            </div>
                            <span className="font-medium tabular-nums shrink-0 text-insignia-advertencia">
                              −{fmtMonto(a.monto)}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* SALDO PERÍODO ANTERIOR (de la lógica inter-períodos del legacy) */}
                    {emp.saldo_anterior !== 0 && (
                      <div className="pt-2 border-t border-white/[0.05] flex items-start justify-between gap-3 text-sm py-1">
                        <div className="min-w-0">
                          <p className={emp.saldo_anterior > 0 ? 'text-insignia-info' : 'text-insignia-peligro'}>
                            {emp.saldo_anterior > 0 ? 'A favor del período anterior' : 'Quedó debiendo el período anterior'}
                          </p>
                          <p className="text-[11px] text-texto-terciario mt-0.5">
                            {emp.saldo_anterior > 0 ? 'Se descuenta este período' : 'Se suma a este período'}
                          </p>
                        </div>
                        <span className={`font-medium tabular-nums shrink-0 ${emp.saldo_anterior > 0 ? 'text-insignia-info' : 'text-insignia-peligro'}`}>
                          {emp.saldo_anterior > 0 ? '−' : '+'}{fmtMonto(Math.abs(emp.saldo_anterior))}
                        </span>
                      </div>
                    )}

                    {/* SUBTOTALES */}
                    <div className="pt-3 border-t border-white/[0.07] space-y-1 text-xs text-texto-terciario">
                      <div className="flex justify-between">
                        <span>Subtotal haberes</span>
                        <span className="tabular-nums">{fmtMonto(haberesTotales)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Subtotal descuentos</span>
                        <span className="tabular-nums">−{fmtMonto(descuentosTotales)}</span>
                      </div>
                    </div>

                    {/* NETO — resultado final */}
                    <div className="flex items-start justify-between gap-3 pt-3 border-t border-white/[0.07]">
                      <div>
                        <p className="text-texto-primario font-semibold">Neto a transferir</p>
                        <p className="text-[11px] text-texto-terciario mt-0.5">
                          Asistencia del {pctAsistencia}%{netoEfectivo < 0 ? ' · se arrastra al próximo período' : ''}
                        </p>
                      </div>
                      <span className={`text-xl font-bold tabular-nums ${netoEfectivo < 0 ? 'text-insignia-advertencia' : 'text-insignia-exito'}`}>
                        <NumeroAnimado claveAnim={animKey}>{fmtMonto(netoEfectivo)}</NumeroAnimado>
                      </span>
                    </div>
                  </div>
                ) : (
                  // Fallback legacy: mientras el motor no respondió, mostramos
                  // el desglose viejo (basado en `emp.monto_pagar`).
                  <div className="space-y-3">
                    <div className="pb-3 border-b border-white/[0.07]">
                      <p className="text-[11px] text-texto-terciario uppercase tracking-wider">Bruto del período</p>
                      <p className="text-3xl font-bold tabular-nums mt-1 text-texto-primario">
                        <NumeroAnimado claveAnim={animKey}>{fmtMonto(emp.monto_pagar)}</NumeroAnimado>
                      </p>
                      <p className="text-[11px] text-texto-terciario mt-1">
                        {emp.monto_detalle}
                        {emp.horas_netas > 0 ? ` · ${fmtHoras(emp.horas_netas)} trabajadas` : ''}
                      </p>
                    </div>

                    <div className="space-y-2 text-sm">
                      {(emp.descuento_adelanto > 0 || emp.saldo_anterior > 0) && (
                        <div className="space-y-1.5">
                          <div className="flex items-start justify-between gap-3">
                            <p className="text-insignia-advertencia">Descuentos del período</p>
                            <span className="text-insignia-advertencia font-medium tabular-nums">
                              −{fmtMonto(emp.descuento_adelanto + Math.max(0, emp.saldo_anterior))}
                            </span>
                          </div>
                          <div className="space-y-1 ml-1.5 pl-2 border-l border-insignia-advertencia/20">
                            {emp.saldo_anterior > 0 && (
                              <div className="flex items-start justify-between gap-3 text-[11px]">
                                <p className="text-texto-terciario">A favor del período anterior</p>
                                <span className="text-texto-secundario tabular-nums shrink-0">
                                  −{fmtMonto(emp.saldo_anterior)}
                                </span>
                              </div>
                            )}
                            {cuotasInfoPeriodo.map((c, idx) => (
                              <div key={idx} className="flex items-start justify-between gap-3 text-[11px]">
                                <p className="text-texto-terciario truncate flex items-center gap-1.5">
                                  {c.tipo === 'descuento' && (
                                    <span className="inline-flex items-center px-1 py-0.5 rounded bg-insignia-peligro/15 text-insignia-peligro text-[9px] font-medium uppercase tracking-wide shrink-0">
                                      Descuento
                                    </span>
                                  )}
                                  <span className="truncate">
                                    {c.notas || (c.tipo === 'descuento' ? `Descuento ${idx + 1}` : `Adelanto ${idx + 1}`)}
                                    {c.tipo === 'adelanto' && c.cuotasTotales > 1 ? ` · cuota ${c.numeroCuota}/${c.cuotasTotales}` : ''}
                                    {c.fechaSolicitud ? ` · ${fmtFecha(c.fechaSolicitud)}` : ''}
                                  </span>
                                </p>
                                <span className="text-texto-secundario tabular-nums shrink-0">
                                  −{fmtMonto(c.monto)}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {emp.saldo_anterior < 0 && (
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-insignia-peligro">Quedó debiendo el período anterior</p>
                            <p className="text-[11px] text-texto-terciario mt-0.5">Se suma a este período</p>
                          </div>
                          <span className="text-insignia-peligro font-medium tabular-nums">
                            +{fmtMonto(Math.abs(emp.saldo_anterior))}
                          </span>
                        </div>
                      )}
                    </div>

                    <div className="flex items-start justify-between gap-3 pt-3 border-t border-white/[0.07]">
                      <div>
                        <p className="text-texto-primario font-semibold">Neto a transferir</p>
                        <p className="text-[11px] text-texto-terciario mt-0.5">
                          Asistencia del {pctAsistencia}%{emp.monto_neto < 0 ? ' · se arrastra al próximo período' : ''}
                        </p>
                      </div>
                      <span className={`text-xl font-bold tabular-nums ${emp.monto_neto < 0 ? 'text-insignia-advertencia' : 'text-insignia-exito'}`}>
                        <NumeroAnimado claveAnim={animKey}>{fmtMonto(emp.monto_neto)}</NumeroAnimado>
                      </span>
                    </div>
                  </div>
                )}
              </TarjetaPanel>
            </div>

            {/* ═══════ COLUMNA DERECHA ═══════ */}
            <div className="space-y-4">

              {/* ─── CONTRATO VIGENTE (PR 7c) ─── */}
              {/*
                Muestra el snapshot del contrato vigente en el período como
                contexto del cálculo: modalidad, monto base, frecuencia y
                régimen. Si no hay contrato, salimos sin renderizar — el
                banner de advertencias del desglose ya avisa.
              */}
              {detalleMotor?.contrato.snapshot && (
                <TarjetaPanel
                  titulo="Contrato vigente"
                  subtitulo="contexto del cálculo"
                  icono={<FileSignature size={13} />}
                >
                  <div className="space-y-1.5 text-sm">
                    <div className="flex justify-between gap-3">
                      <span className="text-texto-terciario">Modalidad</span>
                      <span className="text-texto-primario font-medium">
                        {etiquetaModalidad(detalleMotor.contrato.snapshot.modalidad_calculo)}
                      </span>
                    </div>
                    <div className="flex justify-between gap-3">
                      <span className="text-texto-terciario">Monto base</span>
                      <span className="text-texto-primario font-medium tabular-nums">
                        {fmtMonto(detalleMotor.contrato.snapshot.monto_base)}
                        <span className="text-[11px] text-texto-terciario ml-1">
                          {sufijoModalidad(detalleMotor.contrato.snapshot.modalidad_calculo)}
                        </span>
                      </span>
                    </div>
                    <div className="flex justify-between gap-3">
                      <span className="text-texto-terciario">Frecuencia de pago</span>
                      <span className="text-texto-primario">
                        {detalleMotor.contrato.snapshot.frecuencia_pago.charAt(0).toUpperCase() +
                          detalleMotor.contrato.snapshot.frecuencia_pago.slice(1)}
                      </span>
                    </div>
                    <div className="flex justify-between gap-3">
                      <span className="text-texto-terciario">Régimen</span>
                      <span className="text-texto-primario">
                        {etiquetaRegimen(detalleMotor.contrato.snapshot.regimen)}
                      </span>
                    </div>
                    {detalleMotor.contrato.snapshot.sector && (
                      <div className="flex justify-between gap-3">
                        <span className="text-texto-terciario">Sector</span>
                        <span className="text-texto-primario">{detalleMotor.contrato.snapshot.sector.nombre}</span>
                      </div>
                    )}
                    {detalleMotor.contrato.snapshot.turno && (
                      <div className="flex justify-between gap-3">
                        <span className="text-texto-terciario">Turno</span>
                        <span className="text-texto-primario">{detalleMotor.contrato.snapshot.turno.nombre}</span>
                      </div>
                    )}
                    <div className="flex justify-between gap-3 pt-1.5 border-t border-white/[0.05]">
                      <span className="text-texto-terciario">Desde</span>
                      <span className="text-texto-primario">{fmtFecha(detalleMotor.contrato.snapshot.fecha_inicio)}</span>
                    </div>
                    {detalleMotor.contrato.snapshot.fecha_fin && (
                      <div className="flex justify-between gap-3">
                        <span className="text-texto-terciario">Hasta</span>
                        <span className="text-texto-primario">{fmtFecha(detalleMotor.contrato.snapshot.fecha_fin)}</span>
                      </div>
                    )}
                  </div>
                </TarjetaPanel>
              )}

              {/* ─── CONCEPTOS SUGERIDOS (PR 7c) ─── */}
              {/*
                Conceptos del contrato que NO se aplicaron automáticamente
                (eran manuales, o la condición no se cumplió). El operador
                puede aplicarlos al recibo con un click. Al aplicar, se
                agregan a `conceptosExtras` y desaparecen de esta lista.
              */}
              {sugeridosDisponibles.length > 0 && (
                <TarjetaPanel
                  titulo="Conceptos sugeridos"
                  subtitulo="del contrato vigente"
                  icono={<Sparkles size={13} />}
                  accion={
                    <span className="text-[11px] text-texto-terciario">
                      {sugeridosDisponibles.length} disponible{sugeridosDisponibles.length === 1 ? '' : 's'}
                    </span>
                  }
                >
                  <div className="space-y-1.5">
                    {sugeridosDisponibles.map(s => (
                      <div
                        key={s.concepto_id}
                        className="flex items-start gap-2 py-2 px-2.5 rounded-card border border-white/[0.05] hover:border-white/[0.1] transition-colors"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            {s.tipo === 'haber' ? (
                              <TrendingUp size={11} className="text-insignia-exito shrink-0" />
                            ) : (
                              <TrendingDown size={11} className="text-insignia-advertencia shrink-0" />
                            )}
                            <p className="text-sm text-texto-primario truncate">{s.nombre}</p>
                            <Insignia
                              color={s.tipo === 'haber' ? 'exito' : 'peligro'}
                              tamano="sm"
                            >
                              {s.tipo === 'haber' ? 'Haber' : 'Descuento'}
                            </Insignia>
                          </div>
                          {s.detalle && (
                            <p className="text-[11px] text-texto-terciario mt-0.5 ml-4">{s.detalle}</p>
                          )}
                        </div>
                        {puedeEditarNomina && (
                          <Boton
                            variante="fantasma"
                            tamano="xs"
                            icono={<Plus size={11} />}
                            onClick={() => aplicarSugerido(s)}
                            titulo="Aplicar al recibo"
                          >
                            Aplicar
                          </Boton>
                        )}
                      </div>
                    ))}
                  </div>
                </TarjetaPanel>
              )}

              {/* ─── COMPENSACIÓN BASE ─── */}
              <TarjetaPanel
                titulo="Compensación base"
                icono={<Coins size={13} />}
                accion={!compEditando && puedeEditarNomina ? (
                  <Boton variante="fantasma" tamano="xs" icono={<Pencil size={11} />} onClick={() => setCompEditando(true)}>Editar</Boton>
                ) : undefined}
              >
                {!compEditando ? (
                  <div>
                    {(parseFloat(compMonto) || 0) > 0 ? (
                      <>
                        <p className="text-3xl font-bold text-texto-primario tabular-nums">
                          <NumeroAnimado claveAnim={animKey}>
                            {compTipo === 'fijo' ? fmtMonto(parseFloat(compMonto)) : (
                              <>{fmtMonto(proyeccionMensual)}<span className="text-base font-normal text-texto-terciario">/mes</span></>
                            )}
                          </NumeroAnimado>
                        </p>
                        {compTipo !== 'fijo' && (
                          <p className="text-xs text-texto-terciario mt-1">
                            {fmtMonto(parseFloat(compMonto))} / {compTipo === 'por_hora' ? 'hora' : 'día'} · {compDias} días/sem × 4,33 sem
                          </p>
                        )}
                        <div className="flex items-center gap-2 mt-3 flex-wrap">
                          <Insignia color="neutro" tamano="sm">
                            {compDias === 7 ? '7/7' : compDias === 6 ? 'L-S' : compDias === 5 ? 'L-V' : `${compDias} días`}
                          </Insignia>
                          <Insignia color="neutro" tamano="sm">
                            {compFrecuencia === 'semanal' ? 'Semanal' : compFrecuencia === 'quincenal' ? 'Quincenal' : 'Mensual'}
                          </Insignia>
                          <Insignia color={compTipo === 'por_dia' ? 'info' : compTipo === 'por_hora' ? 'cyan' : 'primario'} tamano="sm">
                            {compTipo === 'por_dia' ? 'Por día' : compTipo === 'por_hora' ? 'Por hora' : 'Sueldo fijo'}
                          </Insignia>
                        </div>
                      </>
                    ) : (
                      <p className="text-sm text-texto-terciario">Sin monto configurado</p>
                    )}
                  </div>
                ) : (
                  <div className="space-y-5">
                    {/* Tipo de pago */}
                    <div>
                      <p className="text-xs text-texto-terciario uppercase tracking-wide font-semibold mb-3">¿Cómo se le paga?</p>
                      <div className="grid grid-cols-2 gap-3">
                        {[
                          { valor: 'por_dia', titulo: 'Cobra por día', desc: 'Gana un monto por cada día que trabaja.', icono: <CalendarDays size={20} /> },
                          { valor: 'fijo', titulo: 'Sueldo fijo', desc: 'Cobra un monto fijo por período completo.', icono: <Landmark size={20} /> },
                        ].map(op => (
                          <button key={op.valor}
                            onClick={() => { const prev = compTipo; setCompTipo(op.valor); guardarCompensacion('compensacion_tipo', op.valor, prev) }}
                            className={`flex items-start gap-3 p-3 rounded-card border text-left cursor-pointer transition-all ${
                              compTipo === op.valor
                                ? 'border-texto-marca bg-texto-marca/5'
                                : 'border-white/[0.06] bg-white/[0.02] hover:border-white/[0.12]'
                            }`}
                          >
                            <div className={`size-10 rounded-card flex items-center justify-center shrink-0 ${
                              compTipo === op.valor ? 'bg-texto-marca/15 text-texto-marca' : 'bg-superficie-hover text-texto-terciario'
                            }`}>
                              {op.icono}
                            </div>
                            <div>
                              <p className={`text-sm font-semibold ${compTipo === op.valor ? 'text-texto-marca' : 'text-texto-primario'}`}>
                                {op.titulo}
                              </p>
                              <p className="text-xs text-texto-terciario mt-0.5">{op.desc}</p>
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Monto */}
                    <div>
                      <p className="text-xs text-texto-terciario uppercase tracking-wide font-semibold mb-3">
                        {compTipo === 'por_dia' ? '¿Cuánto gana por día trabajado?' : '¿Cuánto gana por período completo?'}
                      </p>
                      <InputMoneda value={compMonto} onChange={setCompMonto} moneda="ARS" placeholder="40.000" />
                      {compTipo !== 'fijo' && (parseFloat(compMonto) || 0) > 0 && (
                        <p className="text-xs text-texto-terciario mt-2">
                          Proyección mensual: <span className="text-insignia-exito font-medium">{fmtMonto(proyeccionMensual)}</span>
                        </p>
                      )}
                    </div>

                    {/* Frecuencia */}
                    <div>
                      <p className="text-xs text-texto-terciario uppercase tracking-wide font-semibold mb-3">¿Cada cuánto cobra?</p>
                      <div className="flex gap-2 flex-wrap">
                        {[
                          { valor: 'semanal', etiqueta: 'Semanal' },
                          { valor: 'quincenal', etiqueta: 'Quincenal' },
                          { valor: 'mensual', etiqueta: 'Mensual' },
                        ].map(f => (
                          <Boton key={f.valor}
                            variante={compFrecuencia === f.valor ? 'primario' : 'secundario'}
                            tamano="sm"
                            onClick={() => { const prev = compFrecuencia; setCompFrecuencia(f.valor); guardarCompensacion('compensacion_frecuencia', f.valor, prev) }}
                            className={compFrecuencia === f.valor ? '!border-texto-marca !bg-texto-marca/10 !text-texto-marca' : ''}
                          >{f.etiqueta}</Boton>
                        ))}
                      </div>
                    </div>

                    {/* Días por semana */}
                    <div>
                      <p className="text-xs text-texto-terciario uppercase tracking-wide font-semibold mb-3">Días por semana</p>
                      <div className="flex gap-2 flex-wrap">
                        {[
                          { valor: 5, etiqueta: 'L-V' },
                          { valor: 6, etiqueta: 'L-S' },
                          { valor: 7, etiqueta: '7/7' },
                        ].map(d => (
                          <Boton key={d.valor}
                            variante={compDias === d.valor ? 'primario' : 'secundario'}
                            tamano="sm"
                            onClick={() => { const prev = compDias; setCompDias(d.valor); guardarCompensacion('dias_trabajo', d.valor, prev) }}
                            className={compDias === d.valor ? '!border-texto-marca !bg-texto-marca/10 !text-texto-marca' : ''}
                          >{d.etiqueta}</Boton>
                        ))}
                      </div>
                    </div>

                    <Boton variante="primario" tamano="sm" onClick={() => {
                      const montoNuevo = parseFloat(compMonto) || 0
                      if (montoNuevo !== datosEmpleado.compensacion_monto) {
                        guardarCompensacion('compensacion_monto', montoNuevo, datosEmpleado.compensacion_monto)
                      }
                      setCompEditando(false)
                    }}>Listo</Boton>
                  </div>
                )}
              </TarjetaPanel>

              {/* ─── ADELANTOS DEL PERÍODO ─── */}
              <TarjetaPanel
                titulo="Adelantos del período"
                icono={<TrendingDown size={13} />}
                accion={!mostrarFormAdelanto ? (
                  <div className="flex items-center gap-3">
                    {(adelantos.length > 0 || emp.saldo_anterior !== 0) && (
                      <span className="text-[11px] text-texto-terciario">
                        {[
                          adelantos.length > 0 ? `${adelantos.length} adelanto${adelantos.length === 1 ? '' : 's'}` : null,
                          emp.saldo_anterior !== 0 ? '1 ajuste' : null,
                        ].filter(Boolean).join(' · ')}
                      </span>
                    )}
                    {puedeEditarNomina && (
                      <Boton variante="fantasma" tamano="xs" icono={<Plus size={11} />}
                        onClick={() => setMostrarFormAdelanto(true)}>Nuevo adelanto</Boton>
                    )}
                  </div>
                ) : undefined}
              >
                {/* Saldo a favor del período anterior */}
                {emp.saldo_anterior > 0 && (
                  <div className="flex items-center gap-3 py-2.5 px-3 rounded-card bg-insignia-info/10 border border-insignia-info/20 mb-2">
                    <Send size={14} className="text-insignia-info shrink-0" />
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-insignia-info">A favor período anterior</span>
                        <Insignia color="info" tamano="sm">Automático</Insignia>
                      </div>
                      <p className="text-[11px] text-texto-terciario mt-0.5">Se pagó de más, se descuenta este período</p>
                    </div>
                    <span className="text-sm font-bold text-insignia-info tabular-nums">-{fmtMonto(emp.saldo_anterior)}</span>
                  </div>
                )}

                {emp.saldo_anterior < 0 && (
                  <div className="flex items-center gap-3 py-2.5 px-3 rounded-card bg-insignia-peligro/10 border border-insignia-peligro/20 mb-2">
                    <Send size={14} className="text-insignia-peligro shrink-0" />
                    <div className="flex-1">
                      <span className="text-sm font-medium text-insignia-peligro">Debe del período anterior</span>
                      <p className="text-[11px] text-texto-terciario mt-0.5">Se pagó de menos, se suma a este período</p>
                    </div>
                    <span className="text-sm font-bold text-insignia-peligro tabular-nums">+{fmtMonto(Math.abs(emp.saldo_anterior))}</span>
                  </div>
                )}

                {adelantos.length === 0 && !mostrarFormAdelanto && emp.saldo_anterior === 0 && (
                  <p className="text-xs text-texto-terciario py-3 text-center">Sin descuentos en este período</p>
                )}

                <div className="space-y-2">
                  {adelantosOrdenados.map(a => {
                    const aid = a.id as string
                    const tipoItem = ((a.tipo as string) || 'adelanto') as 'adelanto' | 'descuento'
                    const esDescuento = tipoItem === 'descuento'
                    const cuotasT = a.cuotas_totales as number
                    const cuotasD = a.cuotas_descontadas as number
                    const saldo = parseFloat(a.saldo_pendiente as string)
                    const total = parseFloat(a.monto_total as string)
                    const esEditando = editandoAdelanto === aid

                    const cuotas = (a.cuotas || []) as Record<string, unknown>[]
                    const cuotaDelPeriodo = cuotas.find(c =>
                      (c.fecha_programada as string) >= periodoActual.desde &&
                      (c.fecha_programada as string) <= periodoActual.hasta
                    )
                    const numeroCuotaPeriodo = cuotaDelPeriodo ? (cuotaDelPeriodo.numero_cuota as number) : null
                    const montoCuotaPeriodo = cuotaDelPeriodo ? parseFloat(cuotaDelPeriodo.monto_cuota as string) : 0
                    const esUltimaCuota = numeroCuotaPeriodo === cuotasT

                    // Progreso de la barra: segmento sólido = cuotas ya descontadas en períodos pasados;
                    // segmento más claro = cuota que se va a descontar en este período (proyección).
                    const progresoPrevio = cuotasT > 0 ? (cuotasD / cuotasT) * 100 : 0
                    const progresoProyectado = cuotasT > 0
                      ? ((cuotasD + (numeroCuotaPeriodo ? 1 : 0)) / cuotasT) * 100
                      : 0

                    if (esEditando) {
                      return (
                        <div key={aid} className="space-y-2 p-3 rounded-card border border-texto-marca/30 bg-texto-marca/5">
                          <InputMoneda value={editAdelantoMonto} onChange={setEditAdelantoMonto} moneda="ARS" etiqueta="Monto" />
                          <div>
                            <label className="text-xs text-texto-terciario mb-1 block">Cuotas totales</label>
                            <select value={editAdelantoCuotas} onChange={e => setEditAdelantoCuotas(e.target.value)}
                              className="w-full text-xs bg-superficie-elevada border border-borde-sutil rounded-card px-2 py-1.5 text-texto-primario">
                              {Array.from({ length: 12 }, (_, i) => i + 1).filter(n => n >= cuotasD).map(n => (
                                <option key={n} value={n}>{n} cuota{n !== 1 ? 's' : ''}{n === cuotasD ? ' (mínimo, ya descontadas)' : ''}</option>
                              ))}
                            </select>
                          </div>
                          <Input tipo="text" value={editAdelantoNotas} onChange={e => setEditAdelantoNotas(e.target.value)} placeholder="Notas" />
                          <div className="flex gap-2">
                            <Boton tamano="xs" onClick={() => handleEditarAdelanto(aid)} cargando={guardandoEditAdelanto}>Guardar</Boton>
                            <Boton variante="fantasma" tamano="xs" onClick={() => setEditandoAdelanto(null)}>Cancelar</Boton>
                          </div>
                        </div>
                      )
                    }

                    return (
                      <div key={aid} className="flex items-start gap-3 py-2.5 px-3 rounded-card border border-white/[0.05] hover:border-white/[0.1] transition-colors">
                        <Receipt size={14} className={`shrink-0 mt-0.5 ${esDescuento ? 'text-insignia-peligro' : 'text-insignia-advertencia'}`} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2 flex-wrap">
                            <p className="text-sm font-medium text-texto-primario truncate">
                              {(a.notas as string) || (esDescuento ? `Descuento ${fmtMonto(total)}` : `Adelanto ${fmtMonto(total)}`)}
                            </p>
                            <span className="text-sm font-semibold text-texto-primario tabular-nums">
                              -{fmtMonto(montoCuotaPeriodo || total)}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 mt-1 flex-wrap">
                            {esDescuento ? (
                              <Insignia color="peligro" tamano="sm">Descuento</Insignia>
                            ) : numeroCuotaPeriodo ? (
                              <Insignia color="advertencia" tamano="sm">
                                Cuota {numeroCuotaPeriodo}/{cuotasT}{esUltimaCuota ? ' · última' : ''}
                              </Insignia>
                            ) : (
                              <Insignia color="neutro" tamano="sm">{cuotasD}/{cuotasT} descontadas</Insignia>
                            )}
                            <span className="text-[11px] text-texto-terciario">
                              {esDescuento ? 'Aplicado' : 'Entregado'} {fmtFecha(a.fecha_solicitud as string)}
                              {!esDescuento && total > 0 ? ` · ${fmtMonto(total)} total` : ''}
                            </span>
                          </div>
                          {cuotasT > 1 && (
                            <div className="h-1 bg-superficie-hover rounded-full overflow-hidden mt-1.5 relative">
                              {/* Segmento sólido: cuotas ya descontadas en períodos pasados */}
                              {progresoPrevio > 0 && (
                                <div
                                  className="absolute inset-y-0 left-0 bg-insignia-advertencia transition-all"
                                  style={{ width: `${progresoPrevio}%` }}
                                />
                              )}
                              {/* Segmento semi-transparente: cuota a descontar en este período */}
                              {progresoProyectado > progresoPrevio && (
                                <div
                                  className="absolute inset-y-0 bg-insignia-advertencia/40 transition-all"
                                  style={{ left: `${progresoPrevio}%`, width: `${progresoProyectado - progresoPrevio}%` }}
                                />
                              )}
                            </div>
                          )}
                          {cuotasT > 1 && (
                            <p className="text-[10px] text-texto-terciario mt-1 tabular-nums">
                              {fmtMonto(total - saldo)} / {fmtMonto(total)}
                              {numeroCuotaPeriodo ? (
                                <span className="text-insignia-advertencia"> · este período +{fmtMonto(montoCuotaPeriodo)}</span>
                              ) : null}
                            </p>
                          )}
                        </div>
                        {puedeEditarNomina && (
                          <div className="flex items-center gap-0.5 shrink-0">
                            <Boton variante="fantasma" tamano="xs" soloIcono titulo="Editar"
                              icono={<Pencil size={11} />} onClick={() => {
                                setEditandoAdelanto(aid)
                                setEditAdelantoMonto(String(total))
                                setEditAdelantoCuotas(String(cuotasT))
                                setEditAdelantoNotas((a.notas as string) || '')
                              }} />
                            <Boton variante="fantasma" tamano="xs" soloIcono titulo="Cancelar adelanto"
                              icono={<X size={12} />} onClick={() => handleCancelarAdelanto(aid)} />
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>

                {/* Formulario nuevo adelanto/descuento */}
                {mostrarFormAdelanto && (
                  <div className="space-y-2 p-3 rounded-card border border-white/[0.07] bg-white/[0.02] mt-2">
                    {/* Toggle tipo: adelanto (dinero entregado) vs descuento (multa/daño/falta) */}
                    <div className="grid grid-cols-2 gap-1 p-0.5 rounded-card bg-superficie-elevada border border-borde-sutil">
                      <button
                        type="button"
                        onClick={() => setAdelantoTipo('adelanto')}
                        className={`text-xs py-1.5 rounded transition-colors ${
                          adelantoTipo === 'adelanto'
                            ? 'bg-texto-marca/15 text-texto-marca font-medium'
                            : 'text-texto-terciario hover:text-texto-secundario'
                        }`}
                      >
                        Adelanto
                      </button>
                      <button
                        type="button"
                        onClick={() => setAdelantoTipo('descuento')}
                        className={`text-xs py-1.5 rounded transition-colors ${
                          adelantoTipo === 'descuento'
                            ? 'bg-insignia-peligro/15 text-insignia-peligro font-medium'
                            : 'text-texto-terciario hover:text-texto-secundario'
                        }`}
                      >
                        Descuento
                      </button>
                    </div>
                    <InputMoneda value={adelantoMonto} onChange={setAdelantoMonto} moneda="ARS" placeholder="Monto" />
                    <div className="grid grid-cols-2 gap-2">
                      {/* Las cuotas solo aplican a adelantos. Descuentos siempre son 1 cuota. */}
                      {adelantoTipo === 'adelanto' ? (
                        <select value={adelantoCuotas} onChange={e => setAdelantoCuotas(e.target.value)}
                          className="w-full text-xs bg-superficie-elevada border border-borde-sutil rounded-card px-2 py-1.5 text-texto-primario">
                          {Array.from({ length: 12 }, (_, i) => i + 1).map(n => (
                            <option key={n} value={n}>{n} cuota{n !== 1 ? 's' : ''}</option>
                          ))}
                        </select>
                      ) : (
                        <div className="text-[11px] text-texto-terciario flex items-center px-2 py-1.5 rounded-card bg-superficie-elevada/50 border border-borde-sutil">
                          Único · 1 cuota
                        </div>
                      )}
                      <SelectorFecha
                        valor={adelantoFecha || null}
                        onChange={v => setAdelantoFecha(v || '')}
                        placeholder={adelantoTipo === 'adelanto' ? 'Fecha del adelanto' : 'Fecha del descuento'}
                      />
                    </div>
                    <Input
                      tipo="text"
                      value={adelantoNotas}
                      onChange={e => setAdelantoNotas(e.target.value)}
                      placeholder={adelantoTipo === 'adelanto' ? 'Nota (opcional)' : 'Motivo del descuento'}
                    />
                    <div className="flex gap-2">
                      <Boton tamano="xs" onClick={handleCrearAdelanto} cargando={creandoAdelanto}
                        disabled={!adelantoMonto || parseFloat(adelantoMonto) <= 0}>Registrar</Boton>
                      <Boton variante="fantasma" tamano="xs" onClick={() => setMostrarFormAdelanto(false)}>Cancelar</Boton>
                    </div>
                  </div>
                )}
              </TarjetaPanel>

              {/* ─── PAGOS DEL PERÍODO ─── */}
              <TarjetaPanel
                titulo="Pagos del período"
                icono={<CreditCard size={13} />}
                accion={pagos.length > 0 ? (
                  <span className="text-[11px] text-texto-terciario">
                    {pagos.length} registrado{pagos.length === 1 ? '' : 's'}
                  </span>
                ) : undefined}
              >
                {pagos.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-6 text-center">
                    <div className="size-10 rounded-full bg-superficie-elevada flex items-center justify-center mb-2">
                      <CreditCard size={18} className="text-texto-terciario" />
                    </div>
                    <p className="text-sm text-texto-primario font-medium">Sin pagos registrados</p>
                    <p className="text-xs text-texto-terciario mt-1 max-w-xs">
                      {netoEfectivo < 0
                        ? 'El neto quedó en negativo, así que no se registra pago. El saldo se arrastra.'
                        : netoEfectivo === 0
                          ? 'No hay monto a transferir. Podés cerrar el período sin pago.'
                          : 'Cuando confirmes el pago, aparecerá acá con todo el historial.'}
                    </p>
                    {netoEfectivo < 0 && puedeEditarNomina && (
                      <Boton variante="secundario" tamano="sm" className="mt-3"
                        onClick={() => { setMontoAPagar('0'); setConfirmandoPago(true) }}>
                        Cerrar sin pago
                      </Boton>
                    )}
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    {pagos.map(p => {
                      const pagoId = p.id as string
                      const montoAbonado = p.monto_abonado as number
                      const montoSugerido = p.monto_sugerido as number
                      const esEditando = editandoPago === pagoId

                      return (
                        <div key={pagoId} className="flex items-center gap-3 py-2 px-3 rounded-card border border-white/[0.05] hover:border-white/[0.1] transition-colors">
                          <Receipt size={14} className="text-insignia-exito shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-texto-secundario truncate">{p.concepto as string}</p>
                            <p className="text-[11px] text-texto-terciario">
                              {new Date(p.creado_en as string).toLocaleDateString(locale, { day: '2-digit', month: 'short', year: 'numeric' })}
                              {p.creado_por_nombre ? <> · {String(p.creado_por_nombre)}</> : null}
                            </p>
                            {p.notas ? <p className="text-[11px] text-texto-terciario truncate mt-0.5">{String(p.notas)}</p> : null}
                          </div>

                          {esEditando ? (
                            <div className="flex items-center gap-1.5">
                              <InputMoneda value={editMontoAbonado} onChange={setEditMontoAbonado} moneda="ARS" />
                              <Boton variante="fantasma" tamano="xs" soloIcono titulo="Guardar"
                                icono={<Check size={12} />} onClick={() => handleEditarPago(pagoId)} />
                              <Boton variante="fantasma" tamano="xs" soloIcono titulo="Cancelar"
                                icono={<X size={12} />} onClick={() => setEditandoPago(null)} />
                            </div>
                          ) : (
                            <div className="flex items-center gap-2">
                              <div className="text-right">
                                <span className="text-sm font-semibold text-insignia-exito tabular-nums">{fmtMonto(montoAbonado)}</span>
                                {montoSugerido && montoAbonado !== montoSugerido && (
                                  <p className={`text-[10px] ${montoAbonado > montoSugerido ? 'text-insignia-info' : 'text-insignia-peligro'}`}>
                                    {montoAbonado > montoSugerido
                                      ? `+${fmtMonto(montoAbonado - montoSugerido)} a favor`
                                      : `${fmtMonto(montoAbonado - montoSugerido)} debe`
                                    }
                                  </p>
                                )}
                              </div>
                              <Boton variante="fantasma" tamano="xs" soloIcono titulo="Descargar recibo PDF"
                                icono={<Download size={11} />}
                                onClick={() => handleDescargarPdf(pagoId)} />
                              {puedeEditarNomina && (
                                <>
                                  <Boton variante="fantasma" tamano="xs" soloIcono titulo="Editar monto"
                                    icono={<Pencil size={11} />}
                                    onClick={() => { setEditandoPago(pagoId); setEditMontoAbonado(String(montoAbonado)) }} />
                                  <Boton variante="fantasma" tamano="xs" soloIcono titulo="Eliminar pago"
                                    icono={<Trash2 size={11} />}
                                    onClick={() => handleEliminarPago(pagoId)} />
                                </>
                              )}
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
              </TarjetaPanel>
            </div>
          </div>
        </div>
      </PlantillaEditor>

      {/* Modal de confirmación de pago */}
      <Modal
        abierto={confirmandoPago}
        onCerrar={() => { if (!pagando) setConfirmandoPago(false) }}
        titulo="Confirmar pago"
        tamano="md"
        acciones={
          <div className="flex items-center justify-end gap-2 w-full">
            <Boton variante="fantasma" tamano="sm" onClick={() => setConfirmandoPago(false)} disabled={pagando}>Cancelar</Boton>
            <Boton tamano="sm" icono={<Check size={14} />} onClick={handleConfirmarPago} cargando={pagando}
              disabled={!montoAPagar || parseFloat(montoAPagar) <= 0}>
              Confirmar pago de {montoAPagar ? fmtMonto(parseFloat(montoAPagar)) : '...'}
            </Boton>
          </div>
        }
      >
        <div className="space-y-3">
          <div className="flex justify-between text-sm">
            <span className="text-texto-terciario">Neto sugerido</span>
            <span className="text-texto-primario font-medium">{fmtMonto(netoEfectivo)}</span>
          </div>
          {detalleMotor && detalleMotor.subtotal_descuentos + extrasDescuentos > 0 && (
            <div className="flex justify-between text-sm">
              <span className="text-texto-terciario">Incluye descuentos</span>
              <span className="text-insignia-advertencia">-{fmtMonto(detalleMotor.subtotal_descuentos + extrasDescuentos)}</span>
            </div>
          )}
          {!detalleMotor && emp.descuento_adelanto > 0 && (
            <div className="flex justify-between text-sm">
              <span className="text-texto-terciario">Incluye descuento adelanto</span>
              <span className="text-insignia-advertencia">-{fmtMonto(emp.descuento_adelanto)}</span>
            </div>
          )}
          {conceptosExtras.length > 0 && (
            <div className="flex justify-between text-sm">
              <span className="text-texto-terciario">Conceptos manuales</span>
              <span className="text-texto-primario">{conceptosExtras.length}</span>
            </div>
          )}
          <InputMoneda
            etiqueta="Monto a pagar"
            value={montoAPagar}
            onChange={setMontoAPagar}
            moneda="ARS"
          />
          {parseFloat(montoAPagar) !== netoEfectivo && parseFloat(montoAPagar) > 0 && (
            <div className="flex justify-between text-sm">
              <span className="text-texto-terciario">Diferencia</span>
              <span className={parseFloat(montoAPagar) > netoEfectivo ? 'text-insignia-exito' : 'text-insignia-peligro'}>
                {parseFloat(montoAPagar) > netoEfectivo ? '+' : ''}{fmtMonto(parseFloat(montoAPagar) - netoEfectivo)}
                {parseFloat(montoAPagar) > netoEfectivo ? ' (a favor del empleado)' : ' (queda debiendo)'}
              </span>
            </div>
          )}
          <Input
            tipo="text"
            etiqueta="Notas (opcional)"
            value={notasPago}
            onChange={e => setNotasPago(e.target.value)}
            placeholder="Observaciones del pago..."
          />
        </div>
      </Modal>

      {/* Modal de envío de recibo */}
      <ModalEnviarReciboNomina
        abierto={modalEnvio}
        onCerrar={() => setModalEnvio(false)}
        resultados={[datosEmpleado]}
        etiquetaPeriodo={periodoActual.etiqueta}
        periodoDesde={periodoActual.desde}
        periodoHasta={periodoActual.hasta}
        nombreEmpresa={nombreEmpresa}
      />
    </>
  )
}
