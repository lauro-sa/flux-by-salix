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
  ClipboardCheck, Calendar, Coins, TrendingDown, CreditCard,
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
import { ModalEnviarReciboNomina } from '@/app/(flux)/asistencias/_componentes/ModalEnviarReciboNomina'
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

  // Adelanto nuevo
  const [mostrarFormAdelanto, setMostrarFormAdelanto] = useState(false)
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
    setMigajaDinamica(`/asistencias/nomina/${datosEmpleado.miembro_id}`, datosEmpleado.nombre)
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
      window.history.replaceState(null, '', `/asistencias/nomina/${datosEmpleado.miembro_id}${nuevoQuery}`)
    }

    try {
      const res = await fetch(`/api/asistencias/nomina?desde=${nuevo.desde}&hasta=${nuevo.hasta}&empleados=${datosEmpleado.miembro_id}`)
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
      const res = await fetch(`/api/asistencias/nomina?desde=${periodoActual.desde}&hasta=${periodoActual.hasta}&empleados=${datosEmpleado.miembro_id}`)
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
      window.history.replaceState(null, '', `/asistencias/nomina/${id}?desde=${periodoDestino.desde}&hasta=${periodoDestino.hasta}`)
    }

    try {
      const res = await fetch(`/api/asistencias/nomina?desde=${periodoDestino.desde}&hasta=${periodoDestino.hasta}&empleados=${id}`)
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

  const handleConfirmarPago = async () => {
    setPagando(true)
    const montoReal = parseFloat(montoAPagar) || emp.monto_neto

    const [{ data: user }, { data: miembroData }] = await Promise.all([
      supabase.auth.getUser(),
      supabase.from('miembros').select('empresa_id').eq('id', datosEmpleado.miembro_id).single(),
    ])

    const empresaId = (miembroData as Record<string, unknown>)?.empresa_id as string
    const userId = user.user?.id || ''

    const { data: perfil } = await supabase.from('perfiles').select('nombre, apellido').eq('id', userId).single()
    const nombreCreador = perfil ? `${(perfil as Record<string, unknown>).nombre} ${(perfil as Record<string, unknown>).apellido}` : 'Sistema'

    const { data: pagoInsertado } = await supabase.from('pagos_nomina').insert({
      empresa_id: empresaId,
      miembro_id: datosEmpleado.miembro_id,
      fecha_inicio_periodo: periodoActual.desde,
      fecha_fin_periodo: periodoActual.hasta,
      concepto: periodoActual.etiqueta,
      monto_sugerido: emp.monto_neto,
      monto_abonado: montoReal,
      dias_habiles: emp.dias_laborales,
      dias_trabajados: emp.dias_trabajados,
      dias_ausentes: emp.dias_ausentes,
      tardanzas: emp.dias_tardanza,
      notas: notasPago || null,
      creado_por: userId,
      creado_por_nombre: nombreCreador,
    }).select('id').single()

    if (pagoInsertado) {
      fetch('/api/adelantos/descontar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pago_nomina_id: (pagoInsertado as Record<string, unknown>).id,
          miembro_id: datosEmpleado.miembro_id,
          fecha_fin_periodo: periodoActual.hasta,
        }),
      }).catch(() => {})
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
    await fetch('/api/adelantos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        miembro_id: datosEmpleado.miembro_id,
        monto_total: monto,
        cuotas_totales: parseInt(adelantoCuotas) || 1,
        fecha_solicitud: new Date().toISOString().split('T')[0],
        fecha_inicio_descuento: adelantoFecha || new Date().toISOString().split('T')[0],
        frecuencia_descuento: frecuencia,
        notas: adelantoNotas || null,
      }),
    })

    await recargarDatos()
    setCreandoAdelanto(false)
    setMostrarFormAdelanto(false)
    setAdelantoMonto(''); setAdelantoCuotas('1'); setAdelantoNotas(''); setAdelantoFecha('')
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
    return adelantos.map(a => {
      const cuotas = (a.cuotas || []) as Record<string, unknown>[]
      const cuotaDelPeriodo = cuotas.find(c =>
        (c.fecha_programada as string) >= periodoActual.desde &&
        (c.fecha_programada as string) <= periodoActual.hasta
      )
      if (!cuotaDelPeriodo) return null
      return {
        numeroCuota: cuotaDelPeriodo.numero_cuota as number,
        cuotasTotales: a.cuotas_totales as number,
        monto: parseFloat(cuotaDelPeriodo.monto_cuota as string),
        notas: a.notas as string,
      }
    }).filter(Boolean) as { numeroCuota: number; cuotasTotales: number; monto: number; notas: string }[]
  }, [adelantos, periodoActual.desde, periodoActual.hasta])

  const pagoDelPeriodo = pagos.length > 0 ? pagos[0] : null
  const montoAbonadoPeriodo = pagoDelPeriodo ? parseFloat(pagoDelPeriodo.monto_abonado as string) : 0
  const hayPago = pagoDelPeriodo != null
  const diferenciaPago = hayPago ? montoAbonadoPeriodo - emp.monto_neto : 0

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
            onClick: () => { setMontoAPagar(String(emp.monto_neto)); setConfirmandoPago(true) },
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
              <TarjetaPanel
                titulo="Desglose del cálculo"
                icono={<TrendingDown size={13} />}
                accion={emp.compensacion_tipo === 'por_dia' && puedeEditarNomina && (
                  <Boton variante="fantasma" tamano="xs" icono={<Pencil size={11} />}
                    onClick={() => { setMontoAPagar(String(emp.monto_neto)); setConfirmandoPago(true) }}>
                    Ajustar manualmente
                  </Boton>
                )}
              >
                <div className="space-y-2.5 text-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-texto-primario">Horas netas trabajadas</p>
                      <p className="text-[11px] text-texto-terciario mt-0.5">
                        {emp.dias_trabajados} jornada{emp.dias_trabajados === 1 ? '' : 's'} registrada{emp.dias_trabajados === 1 ? '' : 's'}
                      </p>
                    </div>
                    <span className="text-texto-primario font-medium tabular-nums">
                      <NumeroAnimado claveAnim={animKey}>{fmtHoras(emp.horas_netas)}</NumeroAnimado>
                    </span>
                  </div>

                  <div className="flex items-start justify-between gap-3 pt-2 border-t border-white/[0.05]">
                    <div>
                      <p className="text-texto-primario">Bruto del período</p>
                      <p className="text-[11px] text-texto-terciario mt-0.5">{emp.monto_detalle}</p>
                    </div>
                    <span className="text-texto-primario font-semibold tabular-nums">
                      +<NumeroAnimado claveAnim={animKey}>{fmtMonto(emp.monto_pagar)}</NumeroAnimado>
                    </span>
                  </div>

                  {(emp.descuento_adelanto > 0 || emp.saldo_anterior !== 0) && (
                    <div className="flex items-start justify-between gap-3 pt-2 border-t border-white/[0.05]">
                      <div>
                        <p className="text-insignia-advertencia">Descuentos aplicados</p>
                        <p className="text-[11px] text-texto-terciario mt-0.5">
                          {[
                            emp.descuento_adelanto > 0 ? `${emp.cuotas_adelanto} adelanto${emp.cuotas_adelanto === 1 ? '' : 's'}` : null,
                            emp.saldo_anterior > 0 ? '1 saldo anterior' : null,
                          ].filter(Boolean).join(' · ')}
                        </p>
                      </div>
                      <span className="text-insignia-advertencia font-semibold tabular-nums">
                        −{fmtMonto(emp.descuento_adelanto + Math.max(0, emp.saldo_anterior))}
                      </span>
                    </div>
                  )}

                  <div className="flex items-start justify-between gap-3 pt-2 border-t border-white/[0.07]">
                    <div>
                      <p className="text-texto-primario font-semibold">Neto del período</p>
                      <p className="text-[11px] text-texto-terciario mt-0.5">
                        Asistencia del {pctAsistencia}% {emp.monto_neto < 0 ? '· se arrastra al próximo período' : ''}
                      </p>
                    </div>
                    <span className={`text-base font-bold tabular-nums ${emp.monto_neto < 0 ? 'text-insignia-advertencia' : 'text-insignia-exito'}`}>
                      <NumeroAnimado claveAnim={animKey}>{fmtMonto(emp.monto_neto)}</NumeroAnimado>
                    </span>
                  </div>
                </div>
              </TarjetaPanel>
            </div>

            {/* ═══════ COLUMNA DERECHA ═══════ */}
            <div className="space-y-4">

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

              {/* ─── DESCUENTOS DEL PERÍODO ─── */}
              <TarjetaPanel
                titulo="Descuentos del período"
                icono={<TrendingDown size={13} />}
                accion={!mostrarFormAdelanto ? (
                  <div className="flex items-center gap-3">
                    {(adelantos.length > 0 || emp.saldo_anterior !== 0) && (
                      <span className="text-[11px] text-texto-terciario">
                        {adelantos.length + (emp.saldo_anterior !== 0 ? 1 : 0)} activos
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
                  {adelantos.map(a => {
                    const aid = a.id as string
                    const cuotasT = a.cuotas_totales as number
                    const cuotasD = a.cuotas_descontadas as number
                    const saldo = parseFloat(a.saldo_pendiente as string)
                    const total = parseFloat(a.monto_total as string)
                    const progreso = cuotasT > 0 ? (cuotasD / cuotasT) * 100 : 0
                    const esEditando = editandoAdelanto === aid

                    const cuotas = (a.cuotas || []) as Record<string, unknown>[]
                    const cuotaDelPeriodo = cuotas.find(c =>
                      (c.fecha_programada as string) >= periodoActual.desde &&
                      (c.fecha_programada as string) <= periodoActual.hasta
                    )
                    const numeroCuotaPeriodo = cuotaDelPeriodo ? (cuotaDelPeriodo.numero_cuota as number) : null
                    const montoCuotaPeriodo = cuotaDelPeriodo ? parseFloat(cuotaDelPeriodo.monto_cuota as string) : 0
                    const esUltimaCuota = numeroCuotaPeriodo === cuotasT

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
                        <Receipt size={14} className="text-insignia-advertencia shrink-0 mt-0.5" />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2 flex-wrap">
                            <p className="text-sm font-medium text-texto-primario truncate">
                              {(a.notas as string) || `Adelanto ${fmtMonto(total)}`}
                            </p>
                            <span className="text-sm font-semibold text-texto-primario tabular-nums">
                              -{fmtMonto(montoCuotaPeriodo || total)}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 mt-1 flex-wrap">
                            {numeroCuotaPeriodo ? (
                              <Insignia color="advertencia" tamano="sm">
                                Cuota {numeroCuotaPeriodo}/{cuotasT}{esUltimaCuota ? ' · última' : ''}
                              </Insignia>
                            ) : (
                              <Insignia color="neutro" tamano="sm">{cuotasD}/{cuotasT} descontadas</Insignia>
                            )}
                            <span className="text-[11px] text-texto-terciario">
                              Entregado {fmtFecha(a.fecha_solicitud as string)}
                              {total > 0 ? ` · ${fmtMonto(total)} total` : ''}
                            </span>
                          </div>
                          {progreso > 0 && progreso < 100 && (
                            <div className="h-1 bg-superficie-hover rounded-full overflow-hidden mt-1.5">
                              <div className="h-full bg-insignia-advertencia rounded-full transition-all" style={{ width: `${progreso}%` }} />
                            </div>
                          )}
                          {cuotasT > 1 && (
                            <p className="text-[10px] text-texto-terciario mt-1 tabular-nums">
                              {fmtMonto(total - saldo)} / {fmtMonto(total)}
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

                {/* Formulario nuevo adelanto */}
                {mostrarFormAdelanto && (
                  <div className="space-y-2 p-3 rounded-card border border-white/[0.07] bg-white/[0.02] mt-2">
                    <InputMoneda value={adelantoMonto} onChange={setAdelantoMonto} moneda="ARS" placeholder="Monto" />
                    <div className="grid grid-cols-2 gap-2">
                      <select value={adelantoCuotas} onChange={e => setAdelantoCuotas(e.target.value)}
                        className="w-full text-xs bg-superficie-elevada border border-borde-sutil rounded-card px-2 py-1.5 text-texto-primario">
                        {Array.from({ length: 12 }, (_, i) => i + 1).map(n => (
                          <option key={n} value={n}>{n} cuota{n !== 1 ? 's' : ''}</option>
                        ))}
                      </select>
                      <SelectorFecha valor={adelantoFecha || null} onChange={v => setAdelantoFecha(v || '')} placeholder="Inicio" />
                    </div>
                    <Input tipo="text" value={adelantoNotas} onChange={e => setAdelantoNotas(e.target.value)} placeholder="Nota (opcional)" />
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
                      {emp.monto_neto < 0
                        ? 'El neto quedó en negativo, así que no se registra pago. El saldo se arrastra.'
                        : emp.monto_neto === 0
                          ? 'No hay monto a transferir. Podés cerrar el período sin pago.'
                          : 'Cuando confirmes el pago, aparecerá acá con todo el historial.'}
                    </p>
                    {emp.monto_neto < 0 && puedeEditarNomina && (
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
            <span className="text-texto-primario font-medium">{fmtMonto(emp.monto_neto)}</span>
          </div>
          {emp.descuento_adelanto > 0 && (
            <div className="flex justify-between text-sm">
              <span className="text-texto-terciario">Incluye descuento adelanto</span>
              <span className="text-insignia-advertencia">-{fmtMonto(emp.descuento_adelanto)}</span>
            </div>
          )}
          <InputMoneda
            etiqueta="Monto a pagar"
            value={montoAPagar}
            onChange={setMontoAPagar}
            moneda="ARS"
          />
          {parseFloat(montoAPagar) !== emp.monto_neto && parseFloat(montoAPagar) > 0 && (
            <div className="flex justify-between text-sm">
              <span className="text-texto-terciario">Diferencia</span>
              <span className={parseFloat(montoAPagar) > emp.monto_neto ? 'text-insignia-exito' : 'text-insignia-peligro'}>
                {parseFloat(montoAPagar) > emp.monto_neto ? '+' : ''}{fmtMonto(parseFloat(montoAPagar) - emp.monto_neto)}
                {parseFloat(montoAPagar) > emp.monto_neto ? ' (a favor del empleado)' : ' (queda debiendo)'}
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
        nombreEmpresa={nombreEmpresa}
      />
    </>
  )
}
