'use client'

/**
 * VistaNomina — Vista principal del módulo Nóminas.
 * Selector de período + tabla de empleados con montos, adelantos y acciones.
 * Se usa en: src/app/(flux)/nominas/page.tsx y (temporal, hasta PR 4b)
 * en src/app/(flux)/asistencias/_componentes/ContenidoAsistencias.tsx
 * como tab "Nómina".
 */

import { useState, useCallback, useMemo, useEffect, useRef, forwardRef, useImperativeHandle, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { Users, Loader2, Banknote, Mail, CircleDot, Lock, AlertTriangle, CheckCircle2 } from 'lucide-react'
import { IconoWhatsApp } from '@/componentes/iconos/IconoWhatsApp'
import { Boton } from '@/componentes/ui/Boton'
import { GrupoBotones } from '@/componentes/ui/GrupoBotones'
import { EstadoVacio } from '@/componentes/feedback/EstadoVacio'
import { CabezaloHero, HeroRango } from '@/componentes/entidad/CabezaloHero'
import { ModalEnviarReciboNomina } from './ModalEnviarReciboNomina'
import { KpiHeroAccionPrincipal } from './KpiHeroAccionPrincipal'
import { KpisSoporteNomina } from './KpisSoporteNomina'
import {
  BarraFiltrosNomina,
  aplicarFiltros,
  contarPorEstado,
  type FiltroEstado,
  type FiltroAdelanto,
} from './BarraFiltrosNomina'
import { CardEmpleadoNomina } from './CardEmpleadoNomina'
import { ModalPagarBulk, type EmpleadoPagable } from './ModalPagarBulk'
import { ModalVerRecibo } from './ModalVerRecibo'
import { ModalAdjuntarComprobante } from './ModalAdjuntarComprobante'
import { useToast } from '@/componentes/feedback/Toast'
import { ModalConfirmacion } from '@/componentes/ui/ModalConfirmacion'

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
  dias_jornada_completa?: number
  dias_media_jornada?: number
  dias_presente_parcial?: number
  jornales_equivalentes?: number
  monto_pagar: number
  monto_detalle: string
  descuento_adelanto: number
  cuotas_adelanto: number
  saldo_anterior: number
  monto_neto: number
  /** Flag del backend: el último contrato del miembro terminó antes del período. */
  contrato_terminado_antes?: boolean
  /** Flag del backend: el primer contrato del miembro arranca después del fin del período. */
  contrato_no_iniciado?: boolean
  /** Timestamp ISO del último envío exitoso del recibo por correo. NULL = nunca enviado. */
  recibo_correo_enviado_en?: string | null
  /** Dirección de correo a la que se envió el último recibo. */
  recibo_correo_enviado_a?: string | null
  /** Timestamp ISO del último envío exitoso del recibo por WhatsApp. */
  recibo_whatsapp_enviado_en?: string | null
  /** Teléfono al que se envió el último recibo por WhatsApp. */
  recibo_whatsapp_enviado_a?: string | null
  /** Estado de la liquidación del empleado (sql/105). 'borrador' es virtual cuando aún no se liquidó. */
  estado_liquidacion?: 'borrador' | 'liquidado' | 'enviado' | 'pagado'
  liquidado_en?: string | null
  enviado_en?: string | null
  pagado_en?: string | null
  pago_nomina_id?: string | null
  /** URL del comprobante del pago, si ya se adjuntó. Habilita el ícono
   *  "Comprobante adjunto" en la card. */
  comprobante_url?: string | null
}

/**
 * Estado de la liquidación del período completo (sql/104).
 * Se devuelve junto a los resultados del endpoint /api/nominas.
 */
interface EstadoPeriodo {
  estado: 'abierto' | 'cerrado' | string
  abierto_en: string | null
  cerrado_en: string | null
  cerrado_por_nombre: string | null
}

type TipoPeriodo = 'semana' | 'quincena' | 'mes'

// ─── Cabezal: estado del período ───
// Modos visuales:
//   - 'al-dia':   período abierto, todo OK. Chip neutro.
//   - 'pendiente': período en curso, faltan acciones. Chip info azul.
//   - 'cerca-cierre': ≤2 días del fin del período. Chip advertencia.
//   - 'vencido':  pasó la fecha de fin y sigue abierto. Chip peligro saturado.
//   - 'cerrado':  período cerrado formalmente. Chip exito con lock.
type ModoEstadoPeriodo = 'al-dia' | 'pendiente' | 'cerca-cierre' | 'vencido' | 'cerrado'

interface InfoEstadoPeriodo {
  modo: ModoEstadoPeriodo
  etiqueta: string
  microcopy: string
  Icono: typeof CircleDot
  colorClase: string
}

/**
 * Calcula qué chip mostrar según el estado del período y los días
 * restantes hasta el cierre programado.
 */
function calcularInfoEstadoPeriodo(
  estadoPeriodo: EstadoPeriodo | null,
  fechaFinPeriodo: Date,
): InfoEstadoPeriodo {
  const estado = estadoPeriodo?.estado ?? 'abierto'

  if (estado === 'cerrado') {
    const cerradoEn = estadoPeriodo?.cerrado_en
      ? new Date(estadoPeriodo.cerrado_en).toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })
      : null
    return {
      modo: 'cerrado',
      etiqueta: 'CERRADO',
      microcopy: cerradoEn ? `Cerrado el ${cerradoEn}` : 'Período cerrado',
      Icono: Lock,
      colorClase: 'text-insignia-exito',
    }
  }

  // Calcular días restantes hasta el fin del período.
  const hoy = new Date()
  hoy.setHours(0, 0, 0, 0)
  const fin = new Date(fechaFinPeriodo)
  fin.setHours(0, 0, 0, 0)
  const msPorDia = 1000 * 60 * 60 * 24
  const diasRestantes = Math.round((fin.getTime() - hoy.getTime()) / msPorDia)

  if (diasRestantes < 0) {
    // Vencido sin cerrar.
    return {
      modo: 'vencido',
      etiqueta: 'VENCIDO',
      microcopy: `Cerrar ahora · venció hace ${Math.abs(diasRestantes)} día${Math.abs(diasRestantes) === 1 ? '' : 's'}`,
      Icono: AlertTriangle,
      colorClase: 'text-insignia-peligro',
    }
  }
  if (diasRestantes === 0) {
    return {
      modo: 'cerca-cierre',
      etiqueta: 'EN CURSO',
      microcopy: 'Cierra HOY',
      Icono: AlertTriangle,
      colorClase: 'text-insignia-advertencia',
    }
  }
  if (diasRestantes === 1) {
    return {
      modo: 'cerca-cierre',
      etiqueta: 'EN CURSO',
      microcopy: 'Cierra MAÑANA',
      Icono: AlertTriangle,
      colorClase: 'text-insignia-advertencia',
    }
  }
  if (diasRestantes <= 2) {
    return {
      modo: 'cerca-cierre',
      etiqueta: 'EN CURSO',
      microcopy: `Cierra en ${diasRestantes} días`,
      Icono: AlertTriangle,
      colorClase: 'text-insignia-advertencia',
    }
  }

  const fechaCierre = fin.toLocaleDateString('es-AR', { weekday: 'short', day: 'numeric', month: 'short' })
  return {
    modo: 'pendiente',
    etiqueta: 'EN CURSO',
    microcopy: `Cierra ${fechaCierre} · faltan ${diasRestantes} días`,
    Icono: CircleDot,
    colorClase: 'text-insignia-info',
  }
}

/**
 * Chip compacto que se muestra arriba del HeroRango del cabezal.
 * Variante celebratoria cuando el período está cerrado.
 */
function ChipEstadoPeriodo({ info }: { info: InfoEstadoPeriodo }) {
  const { Icono, etiqueta, microcopy, colorClase, modo } = info
  return (
    <div className={`inline-flex items-center gap-2 text-[11px] font-medium uppercase tracking-wider ${colorClase}`}>
      {modo === 'cerrado' ? (
        <CheckCircle2 size={12} />
      ) : (
        <Icono size={12} className={modo === 'pendiente' ? 'animate-pulse' : ''} />
      )}
      <span>{etiqueta}</span>
      <span className="text-texto-terciario font-normal normal-case tracking-normal">·</span>
      <span className="text-texto-secundario font-normal normal-case tracking-normal">{microcopy}</span>
    </div>
  )
}

// ─── Helpers de período ───

/** Mapea la frecuencia de compensación del empleado al tipo de período natural */
function tipoPeriodoPorFrecuencia(freq?: string): TipoPeriodo {
  if (freq === 'semanal') return 'semana'
  if (freq === 'quincenal') return 'quincena'
  return 'mes' // 'mensual', 'eventual' o default
}

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
  const router = useRouter()
  const [tipoPeriodo, setTipoPeriodo] = useState<TipoPeriodo>('mes')
  const [fechaRef, setFechaRef] = useState(new Date())
  const [cargando, setCargando] = useState(false)
  const [resultados, setResultados] = useState<ResultadoNomina[]>([])
  const [nombreEmpresa, setNombreEmpresa] = useState('')
  const [estadoPeriodo, setEstadoPeriodo] = useState<EstadoPeriodo | null>(null)
  const [envioObligatorio, setEnvioObligatorio] = useState(false)
  const [modalEnvio, setModalEnvio] = useState(false)

  // ── Filtros / búsqueda / vista compacta ──
  const [busqueda, setBusqueda] = useState('')
  const [filtroEstado, setFiltroEstado] = useState<FiltroEstado>('todos')
  const [filtroAdelanto, setFiltroAdelanto] = useState<FiltroAdelanto>('todos')
  const [vistaCompacta, setVistaCompacta] = useState(false)

  // ── Acciones en lote ──
  const toast = useToast()
  const [accionEnCurso, setAccionEnCurso] = useState<null | 'liquidar' | 'cerrar'>(null)
  const [confirmarCierre, setConfirmarCierre] = useState(false)
  const [empleadosPagables, setEmpleadosPagables] = useState<EmpleadoPagable[] | null>(null)
  // ── Modal "Ver recibo" abierto desde las cards del dashboard ──
  // Permite ver el PDF de un pago grabado sin navegar al detalle.
  const [verReciboCtx, setVerReciboCtx] = useState<{
    miembroId: string
    pagoId: string | null
  } | null>(null)
  // ── Modal "Adjuntar comprobante" abierto desde la card de un pagado ──
  const [adjuntarCtx, setAdjuntarCtx] = useState<{
    pagoId: string
    nombre: string
    monto: number
    comprobanteUrl: string | null
  } | null>(null)

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
  const cacheRef = useRef<Map<string, {
    resultados: ResultadoNomina[]
    nombreEmpresa: string
    estadoPeriodo: EstadoPeriodo | null
    envioObligatorio: boolean
  }>>(new Map())
  const cacheKey = `${periodo.desde}_${periodo.hasta}`

  // Cargar nómina (con cache)
  const cargarNomina = useCallback(async () => {
    // Si ya tenemos cache para este período, usar directo
    const cached = cacheRef.current.get(cacheKey)
    if (cached) {
      setResultados(cached.resultados)
      setNombreEmpresa(cached.nombreEmpresa)
      setEstadoPeriodo(cached.estadoPeriodo)
      setEnvioObligatorio(cached.envioObligatorio)
      return
    }

    setCargando(true)
    try {
      const res = await fetch(`/api/nominas?desde=${periodo.desde}&hasta=${periodo.hasta}`)
      const data = await res.json()
      const r = data.resultados || []
      const n = data.nombre_empresa || ''
      const ep = (data.estado_periodo as EstadoPeriodo | null) ?? null
      const eo = !!data.envio_obligatorio
      setResultados(r)
      setNombreEmpresa(n)
      setEstadoPeriodo(ep)
      setEnvioObligatorio(eo)
      // Guardar en cache
      cacheRef.current.set(cacheKey, { resultados: r, nombreEmpresa: n, estadoPeriodo: ep, envioObligatorio: eo })
    } catch { /* silenciar */ }
    setCargando(false)
  }, [periodo.desde, periodo.hasta])

  useEffect(() => { cargarNomina() }, [cargarNomina])

  // ── Forzar refresco invalidando la cache del período activo. ──
  // Se llama después de transiciones bulk para que la UI refleje el
  // nuevo estado_liquidacion de cada empleado sin esperar al usuario.
  const refrescarPeriodo = useCallback(async () => {
    cacheRef.current.delete(cacheKey)
    await cargarNomina()
  }, [cacheKey, cargarNomina])

  // ── Acciones en lote ──
  // El hero dispara estas según el modo activo (liquidar/enviar/pagar/cerrar).
  // Cada una es batch sobre N empleados; mostramos resumen con éxitos/fallos.

  const handleLiquidarBulk = useCallback(async (miembrosIds: string[]) => {
    if (miembrosIds.length === 0) return
    setAccionEnCurso('liquidar')
    try {
      const res = await fetch('/api/nominas/liquidar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          periodo_inicio: periodo.desde,
          periodo_fin: periodo.hasta,
          miembros_ids: miembrosIds,
        }),
      })
      const data = await res.json()
      const exitosos = (data.resultados ?? []).filter((r: { ok: boolean }) => r.ok).length
      const fallidos = miembrosIds.length - exitosos
      if (fallidos === 0) {
        toast.mostrar('exito', `${exitosos} liquidacion${exitosos === 1 ? '' : 'es'} congelada${exitosos === 1 ? '' : 's'}`)
      } else if (exitosos > 0) {
        toast.mostrar('advertencia', `${exitosos} liquidadas, ${fallidos} fallaron`)
      } else {
        toast.mostrar('error', 'Ninguna liquidación se pudo completar')
      }
      await refrescarPeriodo()
    } catch {
      toast.mostrar('error', 'Error de red al liquidar')
    } finally {
      setAccionEnCurso(null)
    }
  }, [periodo.desde, periodo.hasta, refrescarPeriodo, toast])

  const handleEnviarBulk = useCallback((miembrosIds: string[]) => {
    // El envío masivo se hace desde el modal de envío existente, que ya
    // soporta enviar a múltiples empleados con la plantilla configurada.
    // No usamos /marcar-enviado directo porque ese endpoint solo cambia
    // el estado — el envío real (WhatsApp/correo) lo hace el modal.
    if (miembrosIds.length === 0) {
      toast.mostrar('advertencia', 'No hay recibos para enviar')
      return
    }
    setModalEnvio(true)
  }, [toast])

  const handlePagarBulk = useCallback((miembrosIds: string[]) => {
    if (miembrosIds.length === 0) {
      toast.mostrar('advertencia', 'No hay pagos pendientes')
      return
    }
    // Construir lista de pagables con monto del cálculo actual y la cuenta
    // destino predeterminada que ya viene en el listado. ModalPagarBulk
    // hace el batch de POST /api/nominas/pagos con datos por fila.
    const pagables: EmpleadoPagable[] = miembrosIds
      .map(id => resultados.find(r => r.miembro_id === id))
      .filter((r): r is typeof resultados[number] => !!r)
      .map(r => ({
        miembro_id: r.miembro_id,
        nombre: r.nombre,
        monto_neto: r.monto_neto,
        cuenta_destino: (r as ResultadoNomina & { cuenta_destino?: EmpleadoPagable['cuenta_destino'] }).cuenta_destino ?? null,
      }))
    setEmpleadosPagables(pagables)
  }, [resultados, toast])

  const handleCerrarPeriodo = useCallback(async () => {
    setAccionEnCurso('cerrar')
    try {
      const res = await fetch('/api/nominas/cerrar-periodo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          periodo_inicio: periodo.desde,
          periodo_fin: periodo.hasta,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        const detalle = data.code === 'pendientes'
          ? `Faltan ${data.pendientes?.length ?? 0} empleados por pagar`
          : data.error || 'No se pudo cerrar'
        toast.mostrar('error', detalle)
        return
      }
      toast.mostrar('exito', 'Período cerrado')
      setConfirmarCierre(false)
      await refrescarPeriodo()
    } catch {
      toast.mostrar('error', 'Error de red al cerrar')
    } finally {
      setAccionEnCurso(null)
    }
  }, [periodo.desde, periodo.hasta, refrescarPeriodo, toast])

  // Filtrado en cliente (memoizado para no recalcular en cada render).
  const resultadosFiltrados = useMemo(
    () => aplicarFiltros(resultados, { busqueda, filtroEstado, filtroAdelanto }),
    [resultados, busqueda, filtroEstado, filtroAdelanto],
  )
  const conteoEstados = useMemo(() => contarPorEstado(resultados), [resultados])

  // Totales — siempre sobre la lista FILTRADA para que cierre con la
  // tabla visible. Si el usuario quita filtros, vuelve al total real.
  const totalBruto = resultadosFiltrados.reduce((s, r) => s + r.monto_pagar, 0)
  const totalDescuento = resultadosFiltrados.reduce((s, r) => s + r.descuento_adelanto, 0)
  const totalNeto = resultadosFiltrados.reduce((s, r) => s + r.monto_neto, 0)
  const totalHoras = resultadosFiltrados.reduce((s, r) => s + r.horas_netas, 0)

  // Info del estado del período para el chip arriba del hero.
  const infoEstadoPeriodo = useMemo(
    () => calcularInfoEstadoPeriodo(estadoPeriodo, hastaDate),
    [estadoPeriodo, hastaDate],
  )

  // ── Blob de fondo dinámico ──
  // Gradient radial detrás de todo el contenido. Color = modo visual del
  // chip de estado, suave (10% opacidad). Convierte el fondo en señal,
  // no en decoración fija (Vision OS vibe).
  const colorBlob = useMemo(() => {
    switch (infoEstadoPeriodo.modo) {
      case 'vencido':       return 'rgba(239, 68, 68, 0.12)'    // rojo apagado
      case 'cerca-cierre':  return 'rgba(245, 158, 11, 0.12)'   // ámbar
      case 'pendiente':     return 'rgba(245, 158, 11, 0.10)'   // ámbar suave
      case 'cerrado':       return 'rgba(34, 197, 94, 0.10)'    // verde
      case 'al-dia':        return 'rgba(34, 197, 94, 0.10)'    // verde
      default:              return 'rgba(148, 163, 184, 0.06)'  // neutro
    }
  }, [infoEstadoPeriodo.modo])

  return (
    <div className="relative">
      {/* Blob radial de fondo. Transición suave al cambiar de modo. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 transition-[background] duration-700"
        style={{
          background: `radial-gradient(circle at 88% 12%, ${colorBlob}, transparent 50%)`,
        }}
      />
      <CabezaloHero
        titulo={
          <div className="flex flex-col gap-1.5">
            <ChipEstadoPeriodo info={infoEstadoPeriodo} />
            <HeroRango desde={desdeDate} hasta={hastaDate} periodo={tipoPeriodo} />
          </div>
        }
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

      {/* ── KPI Hero: acción principal del período ── */}
      {!cargando && resultados.length > 0 && (
        <KpiHeroAccionPrincipal
          resultados={resultados}
          estadoPeriodo={estadoPeriodo?.estado ?? 'abierto'}
          envioObligatorio={envioObligatorio}
          onLiquidar={handleLiquidarBulk}
          onEnviar={handleEnviarBulk}
          onPagar={handlePagarBulk}
          onCerrarPeriodo={() => setConfirmarCierre(true)}
        />
      )}

      {/* ── KPIs soporte (Costo / Adelantos / Progreso) ── */}
      {!cargando && resultados.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <KpisSoporteNomina resultados={resultados} />
        </motion.div>
      )}

      {/* ── Barra de filtros + búsqueda + vista compacta ── */}
      {!cargando && resultados.length > 0 && (
        <BarraFiltrosNomina
          busqueda={busqueda}
          onBusquedaChange={setBusqueda}
          filtroEstado={filtroEstado}
          onFiltroEstadoChange={setFiltroEstado}
          filtroAdelanto={filtroAdelanto}
          onFiltroAdelantoChange={setFiltroAdelanto}
          vistaCompacta={vistaCompacta}
          onVistaCompactaToggle={() => setVistaCompacta(v => !v)}
          totalResultados={resultados.length}
          conteo={conteoEstados}
        />
      )}

      {/* ── Contador empleados (después de filtros: refleja el resultado) ── */}
      {!cargando && resultados.length > 0 && (
        <div className="flex items-center">
          <p className="text-xs text-texto-terciario">
            <Users size={12} className="inline mr-1" />
            {resultadosFiltrados.length} de {resultados.length} empleado{resultados.length !== 1 ? 's' : ''}
            {resultadosFiltrados.length !== resultados.length && (
              <span className="ml-1 text-texto-terciario/70">· filtrado</span>
            )}
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
        <div className="space-y-2">
          {resultadosFiltrados.map(r => (
            <CardEmpleadoNomina
              key={r.miembro_id}
              resultado={r}
              compacta={vistaCompacta}
              onClick={() => {
                const tipoEmpleado = tipoPeriodoPorFrecuencia(r.compensacion_frecuencia)
                const p = calcularPeriodo(new Date(), tipoEmpleado)
                router.push(`/nominas/empleado/${r.miembro_id}?desde=${p.desde}&hasta=${p.hasta}`)
              }}
              onVerRecibo={(pagoId) => {
                setVerReciboCtx({ miembroId: r.miembro_id, pagoId })
              }}
              onAdjuntarComprobante={(pagoId) => {
                setAdjuntarCtx({
                  pagoId,
                  nombre: r.nombre,
                  monto: r.monto_neto,
                  comprobanteUrl: r.comprobante_url ?? null,
                })
              }}
            />
          ))}

          {/* Footer totales — se mantiene como bloque al pie. */}
          <div className="grid grid-cols-[1fr_auto] gap-3 px-4 py-3 rounded-2xl bg-white/[0.02] border border-white/[0.05] mt-3">
            <div className="text-sm font-semibold text-texto-primario">
              Total · {resultadosFiltrados.length} empleado{resultadosFiltrados.length !== 1 ? 's' : ''} · {fmtHoras(totalHoras)}
            </div>
            <div className="text-right text-sm">
              <span className="text-texto-secundario tabular-nums">{fmtMonto(totalBruto)}</span>
              {totalDescuento > 0 && (
                <span className="ml-3 text-insignia-advertencia tabular-nums">−{fmtMonto(totalDescuento)}</span>
              )}
              <span className="ml-3 text-base font-bold text-insignia-exito tabular-nums">{fmtMonto(totalNeto)}</span>
            </div>
          </div>
        </div>
      )}

      </div>

      {/* Modal envío de recibos */}
      <ModalEnviarReciboNomina
        abierto={modalEnvio}
        onCerrar={() => setModalEnvio(false)}
        resultados={resultados}
        etiquetaPeriodo={periodo.etiqueta}
        periodoDesde={periodo.desde}
        periodoHasta={periodo.hasta}
        nombreEmpresa={nombreEmpresa}
      />

      {/* Confirmación de cierre de período. Solo aparece cuando el operador
          clickea "Cerrar período" en el hero (modo 'cerrar', todos pagados). */}
      <ModalConfirmacion
        abierto={confirmarCierre}
        onCerrar={() => setConfirmarCierre(false)}
        onConfirmar={handleCerrarPeriodo}
        titulo="Cerrar período"
        descripcion={`Vas a cerrar formalmente el período ${periodo.etiqueta}. No se podrán editar liquidaciones de empleados de este período hasta reabrirlo (que requiere motivo). ¿Confirmás?`}
        tipo="peligro"
        etiquetaConfirmar="Cerrar período"
        cargando={accionEnCurso === 'cerrar'}
      />

      {/* Modal de pago en lote — se abre desde el CTA 'Pagar (N)' del hero. */}
      <ModalPagarBulk
        abierto={!!empleadosPagables}
        onCerrar={() => setEmpleadosPagables(null)}
        empleados={empleadosPagables ?? []}
        periodoInicio={periodo.desde}
        periodoFin={periodo.hasta}
        onFinalizado={refrescarPeriodo}
      />

      {/* Modal "Ver recibo" abierto desde las cards (empleados pagados).
          Permite ver el PDF del pago real sin navegar al detalle. */}
      <ModalVerRecibo
        abierto={!!verReciboCtx}
        onCerrar={() => setVerReciboCtx(null)}
        miembroId={verReciboCtx?.miembroId ?? ''}
        periodoInicio={periodo.desde}
        periodoFin={periodo.hasta}
        pagoId={verReciboCtx?.pagoId ?? null}
      />

      {/* Modal "Adjuntar comprobante" — abierto desde la card del pagado.
          Sube archivo y patchea el pago. Refresca el período al guardar. */}
      <ModalAdjuntarComprobante
        abierto={!!adjuntarCtx}
        onCerrar={() => setAdjuntarCtx(null)}
        pagoId={adjuntarCtx?.pagoId ?? null}
        nombreEmpleado={adjuntarCtx?.nombre ?? ''}
        montoAbonado={adjuntarCtx?.monto ?? 0}
        comprobanteActualUrl={adjuntarCtx?.comprobanteUrl ?? null}
        onGuardado={refrescarPeriodo}
      />
    </div>
  )
})
