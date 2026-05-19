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
  Receipt, Send, Landmark, Check, ChevronLeft, ChevronRight, Eye,
  ClipboardCheck, Calendar, Coins, TrendingDown, CreditCard, Download,
  Ban,
} from 'lucide-react'
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
import { ModalConfirmarPagoNomina } from '@/app/(flux)/nominas/_componentes/ModalConfirmarPagoNomina'
import { ModalNuevoMovimientoNomina } from '@/app/(flux)/nominas/_componentes/ModalNuevoMovimientoNomina'
import { ModalEditarCompensacion } from '@/app/(flux)/nominas/_componentes/ModalEditarCompensacion'
import { MenuAjusteConcepto } from '@/app/(flux)/nominas/_componentes/MenuAjusteConcepto'
import { ModalVerRecibo } from '@/app/(flux)/nominas/_componentes/ModalVerRecibo'
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
  /**
   * Horas netas trabajadas ese día (descontando almuerzo y salidas
   * particulares). Solo se completa para días con fichaje real
   * (`completa`, `media`, `parcial`, `feriado_trabajado`). Días sin
   * fichaje (`ausente`, `feriado` no trabajado, `no_laboral`) lo
   * dejan en `null`. Se usa para el tooltip del mini-calendario.
   */
  horas_netas?: number | null
}

/** Concepto aplicado a la liquidación de un miembro en un período. */
export interface ConceptoAplicadoRecibo {
  concepto_id: string
  nombre: string
  tipo: 'haber' | 'descuento'
  modo_calculo: string
  valor: number | null
  monto: number
  automatico: boolean
  detalle: string | null
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
  /**
   * Conceptos del contrato aplicados al recibo (premios, antigüedad,
   * descuentos automáticos, etc). El motor los evalúa según la condición
   * configurada del concepto y los devuelve listos para sumar al bruto
   * (tipo='haber') o restar (tipo='descuento').
   */
  conceptos_aplicados?: ConceptoAplicadoRecibo[]
  total_haberes?: number
  total_descuentos_conceptos?: number
  descuento_adelanto: number
  cuotas_adelanto: number
  /**
   * Bonos / pagos extra one-off del período (sql/092). SUMAN al neto.
   * Vienen del mismo `adelantos_nomina` con tipo='bono'.
   */
  bonos_periodo?: number
  cuotas_bonos?: number
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
  /**
   * Si true, oculta los elementos que vienen de la versión "pantalla
   * completa" del editor y son redundantes cuando se renderiza embebido
   * dentro de la ficha del empleado (tab Liquidaciones):
   *   - Botón "Volver a Nóminas"
   *   - Paginador entre empleados ("2/5 < >")
   *   - Título "Nombre del empleado" (ya está en el header de la ficha)
   * El banner del período, las cards de asistencia/desglose/adelantos
   * y las acciones de pago siguen visibles.
   */
  embed?: boolean
}

// ─── Formatos ───

const fmtMonto = (n: number) =>
  `$${n.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`

const fmtHoras = (h: number) => {
  const hrs = Math.floor(h)
  const min = Math.round((h - hrs) * 60)
  return min > 0 ? `${hrs}h ${min}m` : `${hrs}h`
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
  embed = false,
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
  /**
   * Ajustes puntuales de conceptos para este período (override,
   * excluir o agregar) — ver sql/095 y `MenuAjusteConcepto`. Se
   * cargan junto con los datos del período y se re-fetchean cada vez
   * que el operador toca el menú •••.
   */
  type AjustePeriodoUI = {
    id: string
    concepto_id: string
    tipo_ajuste: 'override' | 'excluir' | 'agregar'
    monto_override: number | null
    motivo: string | null
  }
  const [ajustesPeriodo, setAjustesPeriodo] = useState<AjustePeriodoUI[]>([])
  /**
   * Detalle del recibo recalculado por el motor unificado
   * (`/api/nominas/calcular`). El endpoint del listado `/api/nominas`
   * no respeta `ajustes_concepto_periodo` todavía, así que para que
   * el desglose refleje los overrides/exclusiones/agregados al toque,
   * pedimos un cálculo dedicado. Si está presente, sobreescribe
   * `emp.conceptos_aplicados` y `emp.monto_neto`. Incluye también
   * `conceptos_sugeridos` para mostrar los excluidos manualmente.
   */
  type DetalleMotorUI = {
    conceptos_aplicados: Array<{
      concepto_id: string
      nombre: string
      tipo: 'haber' | 'descuento'
      monto: number
      detalle: string | null
    }>
    conceptos_sugeridos: Array<{
      concepto_id: string
      nombre: string
      tipo: 'haber' | 'descuento'
      monto: number
      detalle: string | null
    }>
    neto: number
  }
  const [detalleMotor, setDetalleMotor] = useState<DetalleMotorUI | null>(null)

  // Último contrato del miembro: si está terminado, mostramos banner
  // persistente arriba del recibo. Se carga al cambiar de empleado.
  const [contratoTerminado, setContratoTerminado] = useState<{ fecha_fin: string } | null>(null)

  // Compensación: estado local sincronizado con BD. La edición ahora vive
  // en ModalEditarCompensacion, que solo persiste al confirmar.
  const [compTipo, setCompTipo] = useState(empleadoInicial.compensacion_tipo)
  const [compMonto, setCompMonto] = useState(String(empleadoInicial.compensacion_monto))
  const [compFrecuencia, setCompFrecuencia] = useState(empleadoInicial.compensacion_frecuencia || 'mensual')
  const [compDias, setCompDias] = useState(5)
  const [modalCompensacionAbierto, setModalCompensacionAbierto] = useState(false)

  // Confirmación de pago (ahora en ModalAdaptable)
  const [confirmandoPago, setConfirmandoPago] = useState(false)
  // (Los inputs de monto y notas viven ahora dentro de
  // `ModalConfirmarPagoNomina`, que también maneja método, fecha,
  // cuenta destino, referencia y comprobante.)
  const [pagando, setPagando] = useState(false)

  // Modal de nuevo movimiento (adelanto/descuento/bono).
  // El formulario completo vive en ModalNuevoMovimientoNomina y se reutiliza
  // también desde el tab "Adelantos" de la ficha del empleado.
  const [modalNuevoMovimientoAbierto, setModalNuevoMovimientoAbierto] = useState(false)

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
  /** Modal "Ver recibo" — preview del PDF embebido con acciones. */
  const [modalVerRecibo, setModalVerRecibo] = useState(false)

  // Si el usuario pierde el permiso `nomina:editar` en vivo (ej. admin se lo
  // saca), cerramos cualquier formulario de edición abierto para que no pueda
  // completar la operación sin autorización. Reactivo gracias al contexto.
  useEffect(() => {
    if (puedeEditarNomina) return
    setModalCompensacionAbierto(false)
    setModalNuevoMovimientoAbierto(false)
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

  // Verificar si el último contrato del miembro está terminado para
  // mostrar el banner persistente. Pide solo el más reciente.
  useEffect(() => {
    let cancelado = false
    supabase
      .from('contratos_laborales')
      .select('vigente, fecha_fin')
      .eq('miembro_id', datosEmpleado.miembro_id)
      .order('fecha_inicio', { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(({ data }) => {
        if (cancelado) return
        if (data && !data.vigente && data.fecha_fin) {
          setContratoTerminado({ fecha_fin: data.fecha_fin as string })
        } else {
          setContratoTerminado(null)
        }
      })
    return () => { cancelado = true }
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
  /**
   * Recarga solo los ajustes puntuales del período desde la API. Se
   * usa después de crear/eliminar un ajuste para refrescar el
   * indicador del menú •••. El recálculo del recibo lo dispara aparte
   * `recargarDatos`.
   */
  const recargarAjustes = useCallback(async () => {
    try {
      const url = `/api/nominas/ajustes-periodo?miembro_id=${datosEmpleado.miembro_id}&desde=${periodoActual.desde}&hasta=${periodoActual.hasta}`
      const res = await fetch(url)
      const data = await res.json()
      if (res.ok) {
        setAjustesPeriodo((data.ajustes ?? []).map((a: Record<string, unknown>) => ({
          id: a.id as string,
          concepto_id: a.concepto_id as string,
          tipo_ajuste: a.tipo_ajuste as 'override' | 'excluir' | 'agregar',
          monto_override: a.monto_override === null ? null : Number(a.monto_override),
          motivo: (a.motivo as string | null) ?? null,
        })))
      }
    } catch { /* silenciar */ }
  }, [datosEmpleado.miembro_id, periodoActual.desde, periodoActual.hasta])

  /**
   * Llama al motor unificado `/api/nominas/calcular` para obtener el
   * detalle del recibo con TODOS los ajustes aplicados (overrides,
   * exclusiones, conceptos agregados). El listado `/api/nominas`
   * todavía no respeta los ajustes — este endpoint sí. Lo usamos para
   * sobreescribir `conceptos_aplicados` y `monto_neto` en el desglose.
   */
  const recalcularConMotor = useCallback(async () => {
    try {
      const res = await fetch('/api/nominas/calcular', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          miembro_id: datosEmpleado.miembro_id,
          periodo_inicio: periodoActual.desde,
          periodo_fin: periodoActual.hasta,
        }),
      })
      if (!res.ok) { setDetalleMotor(null); return }
      const data = await res.json()
      const d = data.detalle as Record<string, unknown> | null
      if (!d) { setDetalleMotor(null); return }
      setDetalleMotor({
        conceptos_aplicados: ((d.conceptos_aplicados as Array<Record<string, unknown>>) ?? []).map(c => ({
          concepto_id: c.concepto_id as string,
          nombre: c.nombre as string,
          tipo: c.tipo as 'haber' | 'descuento',
          monto: Number(c.monto),
          detalle: (c.detalle as string | null) ?? null,
        })),
        conceptos_sugeridos: ((d.conceptos_sugeridos as Array<Record<string, unknown>>) ?? []).map(c => ({
          concepto_id: c.concepto_id as string,
          nombre: c.nombre as string,
          tipo: c.tipo as 'haber' | 'descuento',
          monto: Number(c.monto),
          detalle: (c.detalle as string | null) ?? null,
        })),
        neto: Number(d.neto),
      })
    } catch { setDetalleMotor(null) }
  }, [datosEmpleado.miembro_id, periodoActual.desde, periodoActual.hasta])

  const recargarDatos = useCallback(async () => {
    setRecalculando(true)
    try {
      const res = await fetch(`/api/nominas?desde=${periodoActual.desde}&hasta=${periodoActual.hasta}&empleados=${datosEmpleado.miembro_id}`)
      const data = await res.json()
      const resultado = (data.resultados || []).find((r: ResultadoNomina) => r.miembro_id === datosEmpleado.miembro_id)
      if (resultado) setDatosEmpleado(resultado)
    } catch { /* silenciar */ }
    finally { setRecalculando(false) }
    await Promise.all([
      cargarPagosYAdelantos(datosEmpleado.miembro_id, periodoActual.desde, periodoActual.hasta),
      recargarAjustes(),
      recalcularConMotor(),
    ])
  }, [datosEmpleado.miembro_id, periodoActual.desde, periodoActual.hasta, cargarPagosYAdelantos, recargarAjustes, recalcularConMotor])

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
        setModalCompensacionAbierto(false)
        setConfirmandoPago(false)
        setModalNuevoMovimientoAbierto(false)
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

  /**
   * Confirma un pago de nómina con los datos completos del nuevo
   * modal `ModalConfirmarPagoNomina`: método, fecha, cuenta destino,
   * referencia, comprobante y notas. El monto y los campos vienen
   * desde el modal, que arma el payload final.
   */
  const handleConfirmarPago = async (datos: {
    monto_abonado: number
    metodo_pago: 'efectivo' | 'transferencia' | 'cuenta_digital' | 'cheque' | 'otro'
    fecha_pago: string
    referencia: string | null
    info_bancaria_id: string | null
    comprobante_url: string | null
    notas: string | null
  }) => {
    setPagando(true)
    try {
      const res = await fetch('/api/nominas/pagos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          miembro_id: datosEmpleado.miembro_id,
          periodo_inicio: periodoActual.desde,
          periodo_fin: periodoActual.hasta,
          concepto: periodoActual.etiqueta,
          ...datos,
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
  // (la creación vive ahora en ModalNuevoMovimientoNomina, que pega
  // contra /api/adelantos por sí solo y nos avisa con onCreado para
  // recargar los datos del período.)

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
        tipo: ((a.tipo as string) || 'adelanto') as 'adelanto' | 'descuento' | 'bono',
        numeroCuota: cuotaDelPeriodo.numero_cuota as number,
        cuotasTotales: a.cuotas_totales as number,
        monto: parseFloat(cuotaDelPeriodo.monto_cuota as string),
        notas: a.notas as string,
        fechaSolicitud: a.fecha_solicitud as string,
      }
    }).filter(Boolean) as { tipo: 'adelanto' | 'descuento' | 'bono'; numeroCuota: number; cuotasTotales: number; monto: number; notas: string; fechaSolicitud: string }[]
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

  const pagoDelPeriodo = pagos.length > 0 ? pagos[0] : null
  const montoAbonadoPeriodo = pagoDelPeriodo ? parseFloat(pagoDelPeriodo.monto_abonado as string) : 0
  const hayPago = pagoDelPeriodo != null
  const diferenciaPago = hayPago ? montoAbonadoPeriodo - emp.monto_neto : 0

  // Clave común para re-disparar la animación de los números en cada cambio de
  // período o empleado (aunque el valor visible sea el mismo).
  const animKey = `${datosEmpleado.miembro_id}-${periodoActual.desde}-${periodoActual.hasta}`

  // ─── Render ───

  // Insignias del cabecero. En modo embed (dentro de la ficha del
  // empleado) ocultamos el paginador inter-empleados: la ficha ya
  // identifica de quién estamos viendo el recibo, navegar a otro
  // empleado se hace desde el listado de Nóminas, no desde acá.
  const insigniasCabecero = (
    <div className="flex items-center gap-2">
      {!embed && empleadosPeriodo.length > 1 && (
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

  /** Mapa fecha → horas netas trabajadas, para el tooltip del mini-calendario. */
  const mapaHorasPorDia = useMemo(() => {
    const mapa: Record<string, number | null | undefined> = {}
    for (const d of (emp.dias_detalle || [])) mapa[d.fecha] = d.horas_netas
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
    if (emp.monto_neto < 0) {
      return {
        tono: 'advertencia',
        etiqueta: 'A favor de la empresa',
        subtitulo: 'Pendiente de cierre',
        titulo: 'Este período no corresponde pago',
        descripcion: <>El empleado quedó <strong className="text-insignia-advertencia">{fmtMonto(Math.abs(emp.monto_neto))}</strong> en contra. Podés arrastrar el saldo al próximo período o cancelarlo con trabajo extra.</>,
      }
    }
    if (emp.monto_neto === 0) {
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
      titulo: `Corresponde pagar ${fmtMonto(emp.monto_neto)}`,
      descripcion: 'Confirmá la información de la derecha y registrá el pago cuando esté listo.',
    }
  })()

  /** Términos de la fórmula: Bruto − Adelanto − Saldo ant. = Neto */
  const formulaCalculo: TerminoFormula[] = (() => {
    const terminos: TerminoFormula[] = [
      { etiqueta: 'Bruto', valor: fmtMonto(emp.monto_pagar) },
    ]
    if (emp.descuento_adelanto > 0) {
      terminos.push({ etiqueta: 'Adelanto', valor: fmtMonto(emp.descuento_adelanto), operador: '−', tono: 'advertencia' })
    }
    if (emp.saldo_anterior > 0) {
      // Positivo = pagó de más antes → se descuenta
      terminos.push({ etiqueta: 'Saldo ant.', valor: fmtMonto(emp.saldo_anterior), operador: '−', tono: 'info' })
    } else if (emp.saldo_anterior < 0) {
      // Negativo = debe del anterior → se suma
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

  // Acciones (Enviar recibo / Registrar pago). Se usan en ambos modos:
  // como `acciones` de `PlantillaEditor` cuando es pantalla completa, o
  // renderizadas inline arriba del banner cuando es embed.
  const accionesPago = [
    // "Ver recibo" siempre primero: el usuario puede previsualizar el
    // PDF antes de enviar o pagar. Incluye Regenerar/Descargar/Enviar/
    // Pagar como acciones del modal — es el flujo unificado de
    // liquidación.
    {
      id: 'ver-recibo',
      etiqueta: 'Ver recibo',
      icono: <Eye size={14} />,
      variante: 'secundario' as const,
      onClick: () => setModalVerRecibo(true),
    },
    ...(puedeEnviarNomina ? [{
      id: 'enviar-recibo',
      etiqueta: 'Enviar recibo',
      icono: <Send size={13} />,
      variante: 'secundario' as const,
      onClick: () => setModalEnvio(true),
    }] : []),
    ...(puedeEditarNomina ? [{
      id: 'pagar',
      etiqueta: 'Registrar pago',
      icono: <Banknote size={14} />,
      variante: 'primario' as const,
      onClick: () => setConfirmandoPago(true),
    }] : []),
  ]

  // Contenido principal (banner cálculo + cards). Es el mismo para los
  // dos modos. Lo que cambia es el wrapper: en pantalla completa lo
  // envuelve `PlantillaEditor` con título/migajas/acciones; en embed
  // se renderiza directo bajo el header de la ficha del empleado, sin
  // duplicar identidad ni acciones.
  const contenidoPrincipal = (
    <div className="max-w-6xl mx-auto space-y-5">

      {/* ── BANNER PERSISTENTE: contrato terminado ── */}
      {contratoTerminado && (
        <div className="rounded-card border border-insignia-peligro/30 bg-insignia-peligro/10 px-4 py-3 flex items-start gap-3">
          <Ban size={16} className="text-insignia-peligro shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-insignia-peligro">
              Contrato terminado el {contratoTerminado.fecha_fin}
            </p>
            <p className="text-xs text-texto-secundario mt-0.5">
              El empleado ya no tiene contrato vigente. Podés revisar este recibo histórico o liquidar un período retroactivo, pero ya no se generan más liquidaciones automáticamente.
            </p>
          </div>
        </div>
      )}

      {/* ── CABEZAL DEL EMPLEADO ──
          Solo se renderiza en modo pantalla completa. En modo embed, la
          ficha del empleado (header de la página) ya muestra foto, nombre,
          puesto y metadatos, así que ocultamos este cabezal para no
          duplicar la identidad. */}
      {!embed && (
        <CabezaloPersona
          etiquetaTipo="Empleado"
          nombre={datosEmpleado.nombre}
          foto={emp.foto_url}
          subtitulo={emp.puesto || undefined}
          badge={<Insignia color="exito" tamano="sm">● Activo</Insignia>}
          metadatos={metadatosEmpleado}
        />
      )}

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

                {/* ─── Horas del período ───
                    Total + promedio diario. El color del promedio
                    refleja si está fuera del rango "normal" para
                    detectar sobreesfuerzo de un vistazo:
                      ≤ 9h    → texto secundario (normal)
                      9-11h   → advertencia (largo)
                      > 11h   → peligro (muy largo, considerar bono)
                    Solo se muestra si el empleado trabajó al menos un
                    día en el período (evita "0h promedio: 0h" en
                    períodos sin actividad). */}
                {emp.dias_trabajados > 0 && emp.horas_netas > 0 && (
                  <div className="mb-4 rounded-lg border border-borde-sutil bg-superficie-elevada/40 px-3 py-2.5">
                    <p className="text-[10px] font-medium uppercase tracking-wider text-texto-terciario mb-1.5">
                      Horas del período
                    </p>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <p className="text-base font-semibold text-texto-primario tabular-nums leading-tight">
                          {fmtHoras(emp.horas_netas)}
                        </p>
                        <p className="text-[11px] text-texto-terciario mt-0.5">
                          Total trabajado
                        </p>
                      </div>
                      <div>
                        {(() => {
                          const prom = emp.promedio_horas_diario
                          const colorPromedio = prom > 11
                            ? 'text-insignia-peligro'
                            : prom > 9
                              ? 'text-insignia-advertencia'
                              : 'text-texto-primario'
                          return (
                            <>
                              <p className={`text-base font-semibold tabular-nums leading-tight ${colorPromedio}`}>
                                {fmtHoras(prom)}
                                {prom > 11 && (
                                  <span className="ml-1.5 text-[10px] font-medium uppercase tracking-wider">
                                    muy alto
                                  </span>
                                )}
                                {prom > 9 && prom <= 11 && (
                                  <span className="ml-1.5 text-[10px] font-medium uppercase tracking-wider">
                                    alto
                                  </span>
                                )}
                              </p>
                              <p className="text-[11px] text-texto-terciario mt-0.5">
                                Promedio diario
                              </p>
                            </>
                          )
                        })()}
                      </div>
                    </div>
                  </div>
                )}

                {/* Mini-calendario del período: cada celda muestra el
                    estado del día con color y, al hover, un tooltip con
                    "DD MMM — Estado · Xh Ym" para detectar de un
                    vistazo días con jornadas largas y decidir si
                    corresponde un bono extra. */}
                {(emp.dias_detalle && emp.dias_detalle.length > 0) && (
                  <CalendarioPeriodoMini
                    desde={periodoActual.desde}
                    hasta={periodoActual.hasta}
                    diasEstado={mapaDiasEstado}
                    horasPorDia={mapaHorasPorDia}
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

              {/* ─── DESGLOSE DEL CÁLCULO (recibo) ───
                  Solo lectura: los ajustes del período (override, excluir,
                  agregar, +Bono/+Adelanto, +Concepto del catálogo) se hacen
                  desde la card "Ajustes del período" y desde el menú "···"
                  de cada concepto. El botón "Registrar pago" del cabezal
                  cubre el forzado manual del monto a transferir. */}
              <TarjetaPanel
                titulo="Desglose del cálculo"
                icono={<TrendingDown size={13} />}
              >
                {(() => {
                  // Si tenemos el detalle del motor unificado (con ajustes
                  // de período aplicados), lo usamos. Sino fallback al
                  // listado `/api/nominas` que no respeta ajustes.
                  const conceptosFuente = detalleMotor?.conceptos_aplicados ?? emp.conceptos_aplicados ?? []
                  const haberes = conceptosFuente.filter(c => c.tipo === 'haber')
                  const descuentosConceptos = conceptosFuente.filter(c => c.tipo === 'descuento')
                  const sugeridosMotor = detalleMotor?.conceptos_sugeridos ?? []
                  // Helper para encontrar el ajuste vigente de un concepto.
                  const ajusteDe = (conceptoId: string) =>
                    ajustesPeriodo.find(a => a.concepto_id === conceptoId) ?? null
                  const totalHaberes = emp.total_haberes ?? 0
                  const totalDescuentosConceptos = emp.total_descuentos_conceptos ?? 0
                  const totalBonos = emp.bonos_periodo ?? 0
                  // Cuotas del período separadas por signo: las que
                  // restan (adelanto/descuento) van a la sección
                  // Descuentos; los bonos van a Haberes.
                  const cuotasDescuentoPeriodo = cuotasInfoPeriodo.filter(c => c.tipo !== 'bono')
                  const bonosPeriodo = cuotasInfoPeriodo.filter(c => c.tipo === 'bono')
                  const subtotalHaberes = emp.monto_pagar + totalHaberes + totalBonos
                  const saldoEnContra = emp.saldo_anterior < 0 ? Math.abs(emp.saldo_anterior) : 0
                  const saldoAFavor = emp.saldo_anterior > 0 ? emp.saldo_anterior : 0
                  const totalDescuentos = totalDescuentosConceptos + emp.descuento_adelanto + saldoAFavor

                  return (
                    <div className="divide-y divide-white/[0.06]">
                      {/* ───── HABERES ───── */}
                      <section className="pb-4">
                        <header className="flex items-center justify-between mb-3">
                          <p className="text-[11px] font-medium text-insignia-exito uppercase tracking-wider">
                            Haberes
                          </p>
                          <span className="text-[11px] text-texto-terciario">
                            {1 + haberes.length + bonosPeriodo.length} {(1 + haberes.length + bonosPeriodo.length) === 1 ? 'concepto' : 'conceptos'}
                          </span>
                        </header>

                        <div className="space-y-2">
                          {/* Sueldo base */}
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="text-sm text-texto-primario">Sueldo base</p>
                              <p className="text-[11px] text-texto-terciario truncate">
                                {emp.monto_detalle}
                                {emp.horas_netas > 0 ? ` · ${fmtHoras(emp.horas_netas)} trabajadas` : ''}
                              </p>
                            </div>
                            <span className="text-sm tabular-nums text-texto-primario font-medium shrink-0">
                              {fmtMonto(emp.monto_pagar)}
                            </span>
                          </div>

                          {/* Conceptos haber del contrato */}
                          {haberes.map(c => {
                            const ajuste = ajusteDe(c.concepto_id)
                            return (
                              <div key={c.concepto_id} className="flex items-start justify-between gap-3 group">
                                <div className="min-w-0 flex-1">
                                  <p className="text-sm text-texto-primario flex items-center gap-1.5">
                                    {c.nombre}
                                    {ajuste?.tipo_ajuste === 'override' && (
                                      <Insignia color="info" tamano="sm">Ajustado</Insignia>
                                    )}
                                    {ajuste?.tipo_ajuste === 'agregar' && (
                                      <Insignia color="info" tamano="sm">Solo este período</Insignia>
                                    )}
                                  </p>
                                  {c.detalle && (
                                    <p className="text-[11px] text-texto-terciario truncate">{c.detalle}</p>
                                  )}
                                </div>
                                <span className="text-sm tabular-nums text-insignia-exito font-medium shrink-0">
                                  +{fmtMonto(c.monto)}
                                </span>
                                {puedeEditarNomina && (
                                  <MenuAjusteConcepto
                                    miembroId={datosEmpleado.miembro_id}
                                    conceptoId={c.concepto_id}
                                    conceptoNombre={c.nombre}
                                    periodoInicio={periodoActual.desde}
                                    periodoFin={periodoActual.hasta}
                                    montoCalculado={c.monto}
                                    ajusteActual={ajuste}
                                    onCambio={recargarDatos}
                                  />
                                )}
                              </div>
                            )
                          })}

                          {/* Bonos / pagos extra del período */}
                          {bonosPeriodo.map((b, idx) => (
                            <div key={`bono-${idx}`} className="flex items-start justify-between gap-3">
                              <div className="min-w-0 flex-1">
                                <p className="text-sm text-texto-primario flex items-center gap-1.5">
                                  Bono extra
                                </p>
                                <p className="text-[11px] text-texto-terciario truncate">
                                  {b.notas || (b.fechaSolicitud ? fmtFecha(b.fechaSolicitud) : '')}
                                </p>
                              </div>
                              <span className="text-sm tabular-nums text-insignia-exito font-medium shrink-0">
                                +{fmtMonto(b.monto)}
                              </span>
                            </div>
                          ))}

                          {/* Saldo en contra del período anterior (se suma al bruto) */}
                          {saldoEnContra > 0 && (
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <p className="text-sm text-insignia-peligro">Saldo período anterior</p>
                                <p className="text-[11px] text-texto-terciario">Se cobró de menos antes</p>
                              </div>
                              <span className="text-sm tabular-nums text-insignia-peligro font-medium shrink-0">
                                +{fmtMonto(saldoEnContra)}
                              </span>
                            </div>
                          )}
                        </div>

                        <div className="mt-3 pt-2 border-t border-dashed border-white/[0.08] flex items-center justify-between">
                          <p className="text-[11px] text-texto-terciario uppercase tracking-wider">
                            Total haberes
                          </p>
                          <span className="text-sm font-semibold tabular-nums text-texto-primario">
                            {fmtMonto(subtotalHaberes + saldoEnContra)}
                          </span>
                        </div>
                      </section>

                      {/* ───── DESCUENTOS ───── */}
                      {totalDescuentos > 0 && (
                        <section className="py-4">
                          <header className="flex items-center justify-between mb-3">
                            <p className="text-[11px] font-medium text-insignia-advertencia uppercase tracking-wider">
                              Descuentos
                            </p>
                            <span className="text-[11px] text-texto-terciario">
                              {descuentosConceptos.length + cuotasDescuentoPeriodo.length + (saldoAFavor > 0 ? 1 : 0)} {(descuentosConceptos.length + cuotasDescuentoPeriodo.length + (saldoAFavor > 0 ? 1 : 0)) === 1 ? 'concepto' : 'conceptos'}
                            </span>
                          </header>

                          <div className="space-y-2">
                            {/* Conceptos descuento del contrato */}
                            {descuentosConceptos.map(c => {
                              const ajuste = ajusteDe(c.concepto_id)
                              return (
                                <div key={c.concepto_id} className="flex items-start justify-between gap-3 group">
                                  <div className="min-w-0 flex-1">
                                    <p className="text-sm text-texto-primario flex items-center gap-1.5">
                                      {c.nombre}
                                      {ajuste?.tipo_ajuste === 'override' && (
                                        <Insignia color="info" tamano="sm">Ajustado</Insignia>
                                      )}
                                      {ajuste?.tipo_ajuste === 'agregar' && (
                                        <Insignia color="info" tamano="sm">Solo este período</Insignia>
                                      )}
                                    </p>
                                    {c.detalle && (
                                      <p className="text-[11px] text-texto-terciario truncate">{c.detalle}</p>
                                    )}
                                  </div>
                                  <span className="text-sm tabular-nums text-insignia-advertencia font-medium shrink-0">
                                    −{fmtMonto(c.monto)}
                                  </span>
                                  {puedeEditarNomina && (
                                    <MenuAjusteConcepto
                                      miembroId={datosEmpleado.miembro_id}
                                      conceptoId={c.concepto_id}
                                      conceptoNombre={c.nombre}
                                      periodoInicio={periodoActual.desde}
                                      periodoFin={periodoActual.hasta}
                                      montoCalculado={c.monto}
                                      ajusteActual={ajuste}
                                      onCambio={recargarDatos}
                                    />
                                  )}
                                </div>
                              )
                            })}

                            {/* Saldo a favor del período anterior (se descuenta del bruto) */}
                            {saldoAFavor > 0 && (
                              <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                  <p className="text-sm text-texto-primario">A favor del período anterior</p>
                                  <p className="text-[11px] text-texto-terciario">Se cobró de más antes</p>
                                </div>
                                <span className="text-sm tabular-nums text-insignia-advertencia font-medium shrink-0">
                                  −{fmtMonto(saldoAFavor)}
                                </span>
                              </div>
                            )}

                            {/* Adelantos y descuentos puntuales del período (los bonos
                                ya se mostraron arriba como haberes). */}
                            {cuotasDescuentoPeriodo.map((c, idx) => (
                              <div key={`cuota-${idx}`} className="flex items-start justify-between gap-3">
                                <div className="min-w-0 flex-1">
                                  <p className="text-sm text-texto-primario flex items-center gap-1.5">
                                    {c.tipo === 'descuento' ? 'Descuento manual' : 'Adelanto'}
                                    {c.tipo === 'adelanto' && c.cuotasTotales > 1 && (
                                      <span className="text-[10px] text-texto-terciario">cuota {c.numeroCuota}/{c.cuotasTotales}</span>
                                    )}
                                  </p>
                                  <p className="text-[11px] text-texto-terciario truncate">
                                    {c.notas || (c.fechaSolicitud ? fmtFecha(c.fechaSolicitud) : '')}
                                  </p>
                                </div>
                                <span className="text-sm tabular-nums text-insignia-advertencia font-medium shrink-0">
                                  −{fmtMonto(c.monto)}
                                </span>
                              </div>
                            ))}
                          </div>

                          <div className="mt-3 pt-2 border-t border-dashed border-white/[0.08] flex items-center justify-between">
                            <p className="text-[11px] text-texto-terciario uppercase tracking-wider">
                              Total descuentos
                            </p>
                            <span className="text-sm font-semibold tabular-nums text-insignia-advertencia">
                              −{fmtMonto(totalDescuentos)}
                            </span>
                          </div>
                        </section>
                      )}

                      {/* ───── NO APLICADOS / SUGERIDOS ─────
                          Conceptos del contrato que el motor evaluó pero
                          no aplicó: el operador los excluyó manualmente,
                          no cumplieron la condición (ej. presentismo
                          con ausencias), o son conceptos manuales sin
                          haber sido agregados. El operador puede
                          restaurar los excluidos desde el menú •••. */}
                      {sugeridosMotor.length > 0 && (
                        <section className="py-4 border-t border-dashed border-white/[0.08]">
                          <header className="flex items-center justify-between mb-3">
                            <p className="text-[11px] font-medium text-texto-terciario uppercase tracking-wider">
                              No aplicados este período
                            </p>
                            <span className="text-[11px] text-texto-terciario">
                              {sugeridosMotor.length}
                            </span>
                          </header>
                          <div className="space-y-2">
                            {sugeridosMotor.map(c => {
                              const ajuste = ajusteDe(c.concepto_id)
                              const esExcluido = ajuste?.tipo_ajuste === 'excluir'
                              return (
                                <div key={c.concepto_id} className="flex items-start justify-between gap-3 opacity-70">
                                  <div className="min-w-0 flex-1">
                                    <p className="text-sm text-texto-secundario flex items-center gap-1.5">
                                      <span className="line-through">{c.nombre}</span>
                                      {esExcluido && (
                                        <Insignia color="advertencia" tamano="sm">Excluido</Insignia>
                                      )}
                                    </p>
                                    {c.detalle && (
                                      <p className="text-[11px] text-texto-terciario truncate">{c.detalle}</p>
                                    )}
                                  </div>
                                  {puedeEditarNomina && esExcluido && (
                                    <MenuAjusteConcepto
                                      miembroId={datosEmpleado.miembro_id}
                                      conceptoId={c.concepto_id}
                                      conceptoNombre={c.nombre}
                                      periodoInicio={periodoActual.desde}
                                      periodoFin={periodoActual.hasta}
                                      montoCalculado={0}
                                      ajusteActual={ajuste}
                                      onCambio={recargarDatos}
                                    />
                                  )}
                                </div>
                              )
                            })}
                          </div>
                        </section>
                      )}

                      {/* ───── NETO ───── */}
                      <section className="pt-4">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-base text-texto-primario font-semibold">Neto a transferir</p>
                            <p className="text-[11px] text-texto-terciario mt-0.5">
                              Asistencia del {pctAsistencia}%{emp.monto_neto < 0 ? ' · se arrastra al próximo período' : ''}
                            </p>
                          </div>
                          <span className={`text-2xl font-bold tabular-nums ${emp.monto_neto < 0 ? 'text-insignia-advertencia' : 'text-insignia-exito'}`}>
                            <NumeroAnimado claveAnim={animKey}>{fmtMonto(emp.monto_neto)}</NumeroAnimado>
                          </span>
                        </div>
                      </section>
                    </div>
                  )
                })()}
              </TarjetaPanel>
            </div>

            {/* ═══════ COLUMNA DERECHA ═══════ */}
            <div className="space-y-4">

              {/* ─── COMPENSACIÓN BASE ───
                  Solo lectura: una cifra principal clara (monto del
                  contrato), proyección mensual como secundario, y los 3
                  atributos (tipo/frecuencia/días) en chips con jerarquía
                  visual. La edición se abre en ModalEditarCompensacion. */}
              <TarjetaPanel
                titulo="Compensación base"
                icono={<Coins size={13} />}
                accion={puedeEditarNomina ? (
                  <Boton variante="fantasma" tamano="xs" icono={<Pencil size={11} />}
                    onClick={() => setModalCompensacionAbierto(true)}>
                    Editar
                  </Boton>
                ) : undefined}
              >
                {(parseFloat(compMonto) || 0) > 0 ? (
                  <div className="space-y-3.5">
                    {/* Tipo de pago como chip superior (Apple Card vibe) */}
                    <div>
                      <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[10px] font-medium uppercase tracking-wider ${
                        compTipo === 'fijo'
                          ? 'bg-texto-marca/15 text-texto-marca'
                          : 'bg-insignia-info/15 text-insignia-info'
                      }`}>
                        {compTipo === 'fijo' ? <Landmark size={10} /> : <CalendarDays size={10} />}
                        {compTipo === 'fijo' ? 'Sueldo fijo' : compTipo === 'por_hora' ? 'Por hora' : 'Por día'}
                      </span>
                    </div>

                    {/* Cifra principal = proyección mensual (lo que se
                        llevaría al mes completo). Es la respuesta a "¿cuánto
                        gana este empleado?". Para sueldo fijo mensual coincide
                        con el monto del contrato. La cifra base (jornal / monto
                        del período) va abajo como secundaria. */}
                    <div>
                      <p className="text-3xl font-bold text-texto-primario tabular-nums leading-none">
                        <NumeroAnimado claveAnim={animKey}>
                          {fmtMonto(proyeccionMensual)}
                        </NumeroAnimado>
                        <span className="text-base font-normal text-texto-terciario ml-1">/mes</span>
                      </p>
                      <p className="text-[11px] text-texto-terciario mt-1.5 tabular-nums">
                        {compTipo === 'fijo' ? (
                          compFrecuencia === 'mensual' ? (
                            <span className="text-texto-terciario/70">Sueldo fijo mensual</span>
                          ) : (
                            <>
                              <span className="text-texto-secundario font-medium">{fmtMonto(parseFloat(compMonto))}</span>
                              <span className="text-texto-terciario/70"> / {compFrecuencia === 'semanal' ? 'semana' : 'quincena'}</span>
                            </>
                          )
                        ) : (
                          <>
                            <span className="text-texto-secundario font-medium">{fmtMonto(parseFloat(compMonto))}</span>
                            <span className="text-texto-terciario/70"> / {compTipo === 'por_hora' ? 'hora' : 'día'} · {compDias} días/sem × 4,33</span>
                          </>
                        )}
                      </p>
                    </div>

                    {/* Atributos secundarios — agrupados con separadores
                        sutiles, no como pills sueltas. */}
                    <div className="flex items-center gap-2.5 text-[11px] text-texto-terciario pt-2.5 border-t border-white/[0.04]">
                      <span className="inline-flex items-center gap-1">
                        <span className="text-texto-terciario/70 uppercase tracking-wider text-[10px]">Cobra</span>
                        <span className="text-texto-secundario font-medium">
                          {compFrecuencia === 'semanal' ? 'semanal'
                            : compFrecuencia === 'quincenal' ? 'quincenal'
                            : 'mensual'}
                        </span>
                      </span>
                      <span className="text-texto-terciario/30">·</span>
                      <span className="inline-flex items-center gap-1">
                        <span className="text-texto-terciario/70 uppercase tracking-wider text-[10px]">Trabaja</span>
                        <span className="text-texto-secundario font-medium">
                          {compDias === 5 ? 'L–V' : compDias === 6 ? 'L–S' : '7/7'}
                        </span>
                      </span>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => puedeEditarNomina && setModalCompensacionAbierto(true)}
                    disabled={!puedeEditarNomina}
                    className="w-full text-center py-6 text-sm text-texto-terciario hover:text-texto-marca disabled:cursor-default transition-colors"
                  >
                    Sin compensación configurada
                    {puedeEditarNomina && <span className="block text-[11px] mt-1 text-texto-marca">Configurar →</span>}
                  </button>
                )}
              </TarjetaPanel>

              {/* ─── AJUSTES DEL PERÍODO ───
                  Movimientos one-off del recibo que no son parte del
                  contrato (ese vive aparte): adelantos a descontar en
                  cuotas, descuentos puntuales (multas, daños), y
                  bonos / pagos extra. La tabla en BD se llama
                  `adelantos_nomina` (legado), pero la UX los muestra
                  agrupados como "ajustes del período" para reflejar
                  cómo lo manejan las empresas reales. */}
              <TarjetaPanel
                titulo="Ajustes del período"
                icono={<TrendingDown size={13} />}
                accion={
                  <div className="flex items-center gap-3">
                    {(adelantos.length > 0 || emp.saldo_anterior !== 0) && (
                      <span className="text-[11px] text-texto-terciario">
                        {[
                          adelantos.length > 0 ? `${adelantos.length} ajuste${adelantos.length === 1 ? '' : 's'}` : null,
                          emp.saldo_anterior !== 0 ? '1 saldo previo' : null,
                        ].filter(Boolean).join(' · ')}
                      </span>
                    )}
                    {puedeEditarNomina && (
                      <Boton variante="fantasma" tamano="xs" icono={<Plus size={11} />}
                        onClick={() => setModalNuevoMovimientoAbierto(true)}>
                        Nuevo ajuste
                      </Boton>
                    )}
                  </div>
                }
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

                {adelantos.length === 0 && emp.saldo_anterior === 0 && (
                  <p className="text-xs text-texto-terciario py-3 text-center">Sin ajustes en este período</p>
                )}

                <div className="space-y-2">
                  {adelantosOrdenados.map(a => {
                    const aid = a.id as string
                    const tipoItem = ((a.tipo as string) || 'adelanto') as 'adelanto' | 'descuento' | 'bono'
                    const esDescuento = tipoItem === 'descuento'
                    const esBono = tipoItem === 'bono'
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

                    // Color del icono y título por defecto según tipo:
                    //   descuento → peligro (rojo, resta)
                    //   bono      → éxito  (verde, suma)
                    //   adelanto  → advertencia (naranja, resta en cuotas)
                    const claseIcono = esDescuento ? 'text-insignia-peligro'
                      : esBono ? 'text-insignia-exito'
                      : 'text-insignia-advertencia'
                    const tituloPorDefecto = esBono ? `Bono ${fmtMonto(total)}`
                      : esDescuento ? `Descuento ${fmtMonto(total)}`
                      : `Adelanto ${fmtMonto(total)}`
                    // Signo en el monto: bono SUMA al neto (+), el resto resta (−).
                    const signo = esBono ? '+' : '-'

                    return (
                      <div key={aid} className="flex items-start gap-3 py-2.5 px-3 rounded-card border border-white/[0.05] hover:border-white/[0.1] transition-colors">
                        <Receipt size={14} className={`shrink-0 mt-0.5 ${claseIcono}`} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2 flex-wrap">
                            <p className="text-sm font-medium text-texto-primario truncate">
                              {(a.notas as string) || tituloPorDefecto}
                            </p>
                            <span className={`text-sm font-semibold tabular-nums ${esBono ? 'text-insignia-exito' : 'text-texto-primario'}`}>
                              {signo}{fmtMonto(montoCuotaPeriodo || total)}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 mt-1 flex-wrap">
                            {esBono ? (
                              <Insignia color="exito" tamano="sm">Bono</Insignia>
                            ) : esDescuento ? (
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

                {/* Toda la creación de ajustes (adelanto / descuento /
                    bono / concepto del catálogo) vive en
                    ModalNuevoMovimientoNomina al pie del componente. */}
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
                      {emp.monto_neto < 0
                        ? 'El neto quedó en negativo, así que no se registra pago. El saldo se arrastra.'
                        : emp.monto_neto === 0
                          ? 'No hay monto a transferir. Podés cerrar el período sin pago.'
                          : 'Cuando confirmes el pago, aparecerá acá con todo el historial.'}
                    </p>
                    {emp.monto_neto < 0 && puedeEditarNomina && (
                      <Boton variante="secundario" tamano="sm" className="mt-3"
                        onClick={() => setConfirmandoPago(true)}>
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
  )

  return (
    <>
      {embed ? (
        // ─── Modo embed: dentro de la ficha del empleado ───
        // Cabezal en dos columnas dentro de la misma franja:
        //   IZQUIERDA: acciones primarias del período (Ver/Enviar/Pagar).
        //   DERECHA:   hero del período (1 — 15 MAYO · estado) + cluster
        //              de controles (‹ Hoy › y Mes/Quincena/Semana)
        //              alineados a la derecha y agrupados verticalmente.
        // Así toda la información del período "convive" como un solo
        // bloque coherente en vez de fragmentarse en filas separadas.
        <div className="px-4 md:px-6 py-4 space-y-5">
          <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
            {/* ── Acciones primarias (izquierda) ── */}
            {accionesPago.length > 0 ? (
              <GrupoBotones>
                {accionesPago.map(a => (
                  <Boton key={a.id} variante={a.variante} tamano="sm" icono={a.icono} onClick={a.onClick}>
                    {a.etiqueta}
                  </Boton>
                ))}
              </GrupoBotones>
            ) : <span />}

            {/* ── Cluster período (derecha): hero + navegación + selector ── */}
            <div className="flex flex-col items-stretch md:items-end gap-2.5">
              <HeroRango
                desde={desdeDate}
                hasta={hastaDate}
                periodo={tipoPeriodo}
                subtitulo={
                  <span className="flex items-center justify-end gap-2 flex-wrap">
                    <span>
                      {hastaDate.getFullYear()}
                      {tipoPeriodo === 'quincena' && <> · Quincena {desdeDate.getDate() <= 15 ? 1 : 2}</>}
                      {tipoPeriodo === 'semana' && <> · Semana</>}
                    </span>
                    <span
                      className={`inline-flex items-center gap-1 font-semibold ${
                        bannerEstado.tono === 'exito'
                          ? 'text-insignia-exito'
                          : bannerEstado.tono === 'advertencia'
                            ? 'text-insignia-advertencia'
                            : bannerEstado.tono === 'peligro'
                              ? 'text-insignia-peligro'
                              : 'text-texto-terciario'
                      }`}
                    >
                      <span className="size-1.5 rounded-full bg-current" />
                      {bannerEstado.etiqueta}
                    </span>
                  </span>
                }
              />

              {/* Toolbar de controles: navegador ‹ Hoy › y selector de tipo
                  de período, juntos en una sola fila para que el cluster
                  quede compacto. */}
              <div className="flex items-center justify-end gap-2 flex-wrap">
                <GrupoBotones>
                  <button
                    type="button"
                    onClick={() => aplicarPeriodo(navegarFecha(fechaRef, tipoPeriodo, 'prev'), tipoPeriodo)}
                    title="Período anterior"
                    className="size-8 flex items-center justify-center rounded-boton border border-borde-sutil text-texto-secundario hover:bg-superficie-hover hover:text-texto-primario transition-colors"
                  >
                    <ChevronLeft size={16} />
                  </button>
                  <button
                    type="button"
                    onClick={() => aplicarPeriodo(new Date(), tipoPeriodo)}
                    disabled={enPeriodoActual}
                    title="Volver al período actual"
                    className={`h-8 px-3 rounded-boton border text-sm font-medium transition-colors ${
                      enPeriodoActual
                        ? 'border-borde-sutil text-texto-terciario/50 cursor-default'
                        : 'border-texto-marca/40 text-texto-marca hover:bg-texto-marca/10'
                    }`}
                  >
                    Hoy
                  </button>
                  <button
                    type="button"
                    onClick={() => aplicarPeriodo(navegarFecha(fechaRef, tipoPeriodo, 'next'), tipoPeriodo)}
                    title="Período siguiente"
                    className="size-8 flex items-center justify-center rounded-boton border border-borde-sutil text-texto-secundario hover:bg-superficie-hover hover:text-texto-primario transition-colors"
                  >
                    <ChevronRight size={16} />
                  </button>
                </GrupoBotones>

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
              </div>
            </div>
          </div>
          {contenidoPrincipal}
        </div>
      ) : (
        // ─── Modo pantalla completa ───
        <PlantillaEditor
          titulo={datosEmpleado.nombre}
          insignias={insigniasCabecero}
          volverTexto={textoVolver}
          onVolver={() => router.push(rutaVolver)}
          acciones={accionesPago}
          banner={banner}
        >
          {contenidoPrincipal}
        </PlantillaEditor>
      )}

      {/* Modal de confirmación de pago: método, fecha, cuenta
          destino, referencia, comprobante y notas. */}
      <ModalConfirmarPagoNomina
        abierto={confirmandoPago}
        onCerrar={() => { if (!pagando) setConfirmandoPago(false) }}
        miembroId={datosEmpleado.miembro_id}
        netoSugerido={emp.monto_neto}
        descuentoAdelanto={emp.descuento_adelanto}
        confirmando={pagando}
        onConfirmar={handleConfirmarPago}
      />

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

      {/* Modal "Nuevo movimiento" — adelanto/descuento/bono one-off.
          Mismo componente que el tab "Adelantos" de la ficha, así un
          solo flujo guía la creación en cualquiera de los dos lugares.
          fechaInicial = inicio del período abierto para que la cuota
          caiga adentro sin que el operador tenga que ajustarla. */}
      <ModalNuevoMovimientoNomina
        abierto={modalNuevoMovimientoAbierto}
        onCerrar={() => setModalNuevoMovimientoAbierto(false)}
        miembroId={datosEmpleado.miembro_id}
        fechaInicial={periodoActual.desde}
        periodoInicio={periodoActual.desde}
        periodoFin={periodoActual.hasta}
        conceptosEnContratoIds={new Set([
          ...(emp.conceptos_aplicados ?? []).map(c => c.concepto_id),
          ...(detalleMotor?.conceptos_aplicados ?? []).map(c => c.concepto_id),
          ...(detalleMotor?.conceptos_sugeridos ?? []).map(c => c.concepto_id),
        ])}
        onCreado={recargarDatos}
      />

      {/* Modal de edición de compensación base — reemplaza al editor
          inline. Solo persiste al confirmar (no autoguardado por campo
          como antes). El callback dispara guardarCompensacion por cada
          campo modificado, manteniendo el historial granular. */}
      <ModalEditarCompensacion
        abierto={modalCompensacionAbierto}
        onCerrar={() => setModalCompensacionAbierto(false)}
        valoresIniciales={{
          tipo: (compTipo === 'fijo' ? 'fijo' : 'por_dia') as 'fijo' | 'por_dia',
          monto: parseFloat(compMonto) || 0,
          frecuencia: (compFrecuencia as 'semanal' | 'quincenal' | 'mensual'),
          dias: (compDias as 5 | 6 | 7),
        }}
        onGuardar={async (nueva, cambios) => {
          // Optimista en cliente para que la card refleje al instante.
          if (cambios.tipo !== undefined) setCompTipo(nueva.tipo)
          if (cambios.monto !== undefined) setCompMonto(String(nueva.monto))
          if (cambios.frecuencia !== undefined) setCompFrecuencia(nueva.frecuencia)
          if (cambios.dias !== undefined) setCompDias(nueva.dias)
          // Persistir y registrar historial por cada campo cambiado.
          const tareas: Promise<unknown>[] = []
          if (cambios.tipo !== undefined) {
            tareas.push(Promise.resolve(guardarCompensacion('compensacion_tipo', nueva.tipo, compTipo)))
          }
          if (cambios.monto !== undefined) {
            tareas.push(Promise.resolve(guardarCompensacion('compensacion_monto', nueva.monto, parseFloat(compMonto) || 0)))
          }
          if (cambios.frecuencia !== undefined) {
            tareas.push(Promise.resolve(guardarCompensacion('compensacion_frecuencia', nueva.frecuencia, compFrecuencia)))
          }
          if (cambios.dias !== undefined) {
            tareas.push(Promise.resolve(guardarCompensacion('dias_trabajo', nueva.dias, compDias)))
          }
          await Promise.all(tareas)
        }}
      />

      {/* Modal "Ver recibo" — preview del PDF + acciones unificadas.
          Si ya hay pago grabado del período, usa el PDF definitivo;
          sino genera un borrador con los datos calculados en vivo. */}
      <ModalVerRecibo
        abierto={modalVerRecibo}
        onCerrar={() => setModalVerRecibo(false)}
        miembroId={datosEmpleado.miembro_id}
        periodoInicio={periodoActual.desde}
        periodoFin={periodoActual.hasta}
        pagoId={(pagoDelPeriodo?.id as string) ?? null}
        onEnviar={() => {
          setModalVerRecibo(false)
          if (puedeEnviarNomina) setModalEnvio(true)
        }}
        onRegistrarPago={puedeEditarNomina ? () => {
          setModalVerRecibo(false)
          setConfirmandoPago(true)
        } : undefined}
      />
    </>
  )
}
