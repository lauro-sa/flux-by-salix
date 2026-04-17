'use client'

/**
 * ModalDetalleNomina — Modal completo de gestión de nómina por empleado.
 * Compensación editable (misma UI que TabPagos), resumen del período,
 * adelantos, historial editable, paso de confirmación para pagar.
 * Se usa en: VistaNomina.tsx (al clickear un empleado)
 */

import { useState, useEffect, useCallback } from 'react'
import { ModalAdaptable as Modal } from '@/componentes/ui/ModalAdaptable'
import { Boton } from '@/componentes/ui/Boton'
import { InputMoneda } from '@/componentes/ui/InputMoneda'
import { Input } from '@/componentes/ui/Input'
import { Insignia } from '@/componentes/ui/Insignia'
import { SelectorFecha } from '@/componentes/ui/SelectorFecha'
import { ModalEnviarReciboNomina } from './ModalEnviarReciboNomina'
import { crearClienteNavegador } from '@/lib/supabase/cliente'
import { useFormato } from '@/hooks/useFormato'
import {
  Banknote, CalendarDays, Plus, X, Pencil, Trash2,
  Receipt, Send, Landmark, Check, ChevronLeft, ChevronRight,
} from 'lucide-react'

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
  monto_pagar: number
  monto_detalle: string
  descuento_adelanto: number
  cuotas_adelanto: number
  saldo_anterior: number
  monto_neto: number
}

interface Props {
  abierto: boolean
  onCerrar: () => void
  empleado: ResultadoNomina | null
  periodo: { desde: string; hasta: string; etiqueta: string }
  nombreEmpresa: string
  onActualizado: () => void
}

const fmtMonto = (n: number) =>
  `$${n.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`

const fmtHoras = (h: number) => {
  const hrs = Math.floor(h)
  const min = Math.round((h - hrs) * 60)
  return min > 0 ? `${hrs}h ${min}m` : `${hrs}h`
}

// ─── Componente ───

export function ModalDetalleNomina({ abierto, onCerrar, empleado, periodo, nombreEmpresa, onActualizado }: Props) {
  const supabase = crearClienteNavegador()
  const { locale } = useFormato()

  /** Formatea fecha según config de la empresa */
  const fmtFecha = (fecha: string) => {
    const d = new Date(fecha + 'T12:00:00')
    return d.toLocaleDateString(locale, { day: '2-digit', month: 'short', year: 'numeric' })
  }

  // Período interno (navegable dentro del modal)
  const [periodoInterno, setPeriodoInterno] = useState(periodo)
  const [datosEmpleado, setDatosEmpleado] = useState<ResultadoNomina | null>(empleado)
  const [recalculando, setRecalculando] = useState(false)

  // Estado
  const [adelantos, setAdelantos] = useState<Record<string, unknown>[]>([])
  const [pagos, setPagos] = useState<Record<string, unknown>[]>([])
  const [pagando, setPagando] = useState(false)
  const [modalEnvio, setModalEnvio] = useState(false)

  // Compensación editable
  const [compTipo, setCompTipo] = useState('')
  const [compMonto, setCompMonto] = useState('')
  const [compFrecuencia, setCompFrecuencia] = useState('')
  const [compDias, setCompDias] = useState(5)
  const [compEditando, setCompEditando] = useState(false)

  // Paso de confirmación de pago
  const [confirmandoPago, setConfirmandoPago] = useState(false)
  const [montoAPagar, setMontoAPagar] = useState('')
  const [notasPago, setNotasPago] = useState('')

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

  // Sincronizar período y datos al abrir
  useEffect(() => {
    if (!abierto || !empleado) return
    setPeriodoInterno(periodo)
    setDatosEmpleado(empleado)

    setCompTipo(empleado.compensacion_tipo)
    setCompMonto(String(empleado.compensacion_monto))
    setCompFrecuencia(empleado.compensacion_frecuencia || 'mensual')
    setCompEditando(false)
    setMostrarFormAdelanto(false)
    setConfirmandoPago(false)
    setEditandoPago(null)

    // Cargar pagos y adelantos filtrados por período
    cargarPagosYAdelantos(empleado.miembro_id, periodo.desde, periodo.hasta)

    // Cargar dias_trabajo
    supabase.from('miembros').select('dias_trabajo').eq('id', empleado.miembro_id).single()
      .then(({ data }) => { if (data) setCompDias((data as Record<string, unknown>).dias_trabajo as number || 5) })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [abierto, empleado?.miembro_id])

  // Navegar a otro período y recalcular nómina
  const navegarPeriodo = useCallback(async (dir: 'prev' | 'next') => {
    if (!empleado) return
    setRecalculando(true)

    // Detectar tipo de período por duración
    const duracion = (new Date(periodoInterno.hasta + 'T12:00:00').getTime() - new Date(periodoInterno.desde + 'T12:00:00').getTime()) / 86400000
    const diaInicio = parseInt(periodoInterno.desde.split('-')[2])

    let desde: string, hasta: string, etiqueta: string

    if (duracion <= 8) {
      // Semana
      const d = new Date(periodoInterno.desde + 'T12:00:00')
      d.setDate(d.getDate() + (dir === 'next' ? 7 : -7))
      const dia = d.getDay()
      const lunes = new Date(d); lunes.setDate(d.getDate() - (dia === 0 ? 6 : dia - 1))
      const domingo = new Date(lunes); domingo.setDate(lunes.getDate() + 6)
      desde = lunes.toISOString().split('T')[0]
      hasta = domingo.toISOString().split('T')[0]
      etiqueta = `Semana ${lunes.getDate()}-${domingo.getDate()} de ${lunes.toLocaleDateString('es-AR', { month: 'long', year: 'numeric' })}`
    } else if (duracion <= 16) {
      // Quincena — navegar por mitades de mes
      let mes = parseInt(periodoInterno.desde.split('-')[1]) - 1
      let anio = parseInt(periodoInterno.desde.split('-')[0])
      const esQ1 = diaInicio <= 15

      if (dir === 'next') {
        if (esQ1) {
          // Q1 → Q2 del mismo mes
        } else {
          // Q2 → Q1 del mes siguiente
          mes++
          if (mes > 11) { mes = 0; anio++ }
        }
      } else {
        if (esQ1) {
          // Q1 → Q2 del mes anterior
          mes--
          if (mes < 0) { mes = 11; anio-- }
        }
        // Q2 → Q1 del mismo mes (no cambia mes)
      }

      const nuevaQ1 = dir === 'next' ? !esQ1 : !esQ1
      if (nuevaQ1) {
        desde = `${anio}-${String(mes + 1).padStart(2, '0')}-01`
        hasta = `${anio}-${String(mes + 1).padStart(2, '0')}-15`
        const d = new Date(anio, mes, 1)
        etiqueta = `Quincena 1-15 de ${d.toLocaleDateString('es-AR', { month: 'long', year: 'numeric' })}`
      } else {
        const ultimo = new Date(anio, mes + 1, 0).getDate()
        desde = `${anio}-${String(mes + 1).padStart(2, '0')}-16`
        hasta = `${anio}-${String(mes + 1).padStart(2, '0')}-${ultimo}`
        const d = new Date(anio, mes, 16)
        etiqueta = `Quincena 16-${ultimo} de ${d.toLocaleDateString('es-AR', { month: 'long', year: 'numeric' })}`
      }
    } else {
      // Mes
      const d = new Date(periodoInterno.desde + 'T12:00:00')
      d.setMonth(d.getMonth() + (dir === 'next' ? 1 : -1))
      const mes = d.getMonth()
      const anio = d.getFullYear()
      const ultimo = new Date(anio, mes + 1, 0).getDate()
      desde = `${anio}-${String(mes + 1).padStart(2, '0')}-01`
      hasta = `${anio}-${String(mes + 1).padStart(2, '0')}-${ultimo}`
      etiqueta = d.toLocaleDateString('es-AR', { month: 'long', year: 'numeric' }).replace(/^\w/, c => c.toUpperCase())
    }

    const nuevoPeriodo = { desde, hasta, etiqueta }
    setPeriodoInterno(nuevoPeriodo)
    setRecalculando(true)

    // Cargar datos en background sin bloquear la UI
    fetch(`/api/asistencias/nomina?desde=${desde}&hasta=${hasta}&empleados=${empleado.miembro_id}`)
      .then(r => r.json())
      .then(data => {
        const resultado = (data.resultados || []).find((r: ResultadoNomina) => r.miembro_id === empleado.miembro_id)
        if (resultado) setDatosEmpleado(resultado)
      })
      .catch(() => {})
      .finally(() => setRecalculando(false))

    cargarPagosYAdelantos(empleado.miembro_id, desde, hasta)
  }, [empleado, periodoInterno])

  // Cargar pagos y adelantos filtrados por período
  const cargarPagosYAdelantos = useCallback(async (miembroId: string, desde: string, hasta: string) => {
    // Pagos: solo los que corresponden a este período
    const { data: pagosData } = await supabase
      .from('pagos_nomina')
      .select('id, concepto, monto_sugerido, monto_abonado, fecha_inicio_periodo, fecha_fin_periodo, creado_en, creado_por_nombre, notas')
      .eq('miembro_id', miembroId)
      .eq('eliminado', false)
      .lte('fecha_inicio_periodo', hasta)
      .gte('fecha_fin_periodo', desde)
      .order('creado_en', { ascending: false })
    setPagos(pagosData || [])

    // Adelantos: solo cuotas que caen en este período
    const resAdel = await fetch(`/api/adelantos?miembro_id=${miembroId}`)
    const dataAdel = await resAdel.json()
    const todosAdelantos = (dataAdel.adelantos || []) as Record<string, unknown>[]

    // Filtrar: mostrar adelantos que tienen al menos una cuota en este rango
    const adelantosFiltrados = todosAdelantos.filter((a: Record<string, unknown>) => {
      if (a.estado === 'cancelado') return false
      const cuotas = (a.cuotas || []) as Record<string, unknown>[]
      return cuotas.some(c =>
        (c.fecha_programada as string) >= desde &&
        (c.fecha_programada as string) <= hasta
      )
    })
    setAdelantos(adelantosFiltrados)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Recargar datos del período actual
  const recargarDatos = useCallback(async () => {
    if (!empleado) return
    await cargarPagosYAdelantos(empleado.miembro_id, periodoInterno.desde, periodoInterno.hasta)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [empleado?.miembro_id, periodoInterno.desde, periodoInterno.hasta, cargarPagosYAdelantos])

  // Guardar compensación + historial
  const guardarCompensacion = useCallback(async (campo: string, valor: unknown, valorAnterior?: unknown) => {
    if (!empleado) return
    await supabase.from('miembros').update({ [campo]: valor }).eq('id', empleado.miembro_id)

    // Registrar en historial
    const { data: user } = await supabase.auth.getUser()
    const { data: perfil } = await supabase.from('perfiles').select('nombre, apellido').eq('id', user.user?.id || '').single()
    const { data: miembroData } = await supabase.from('miembros').select('empresa_id').eq('id', empleado.miembro_id).single()

    if (miembroData && user.user) {
      let porcentajeCambio: number | null = null
      if (campo === 'compensacion_monto' && valorAnterior && Number(valorAnterior) > 0) {
        porcentajeCambio = Math.round(((Number(valor) - Number(valorAnterior)) / Number(valorAnterior)) * 10000) / 100
      }
      await supabase.from('historial_compensacion').insert({
        empresa_id: (miembroData as Record<string, unknown>).empresa_id,
        miembro_id: empleado.miembro_id,
        campo,
        valor_anterior: valorAnterior != null ? String(valorAnterior) : null,
        valor_nuevo: String(valor),
        porcentaje_cambio: porcentajeCambio,
        creado_por: user.user.id,
        creado_por_nombre: perfil ? `${(perfil as Record<string, unknown>).nombre} ${(perfil as Record<string, unknown>).apellido}` : 'Sistema',
      })
    }
    onActualizado()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [empleado?.miembro_id, onActualizado])

  // Confirmar pago
  const handleConfirmarPago = async () => {
    if (!empleado) return
    setPagando(true)

    const { data: user } = await supabase.auth.getUser()
    const { data: perfil } = await supabase.from('perfiles').select('nombre, apellido').eq('id', user.user?.id || '').single()
    const nombreCreador = perfil ? `${(perfil as Record<string, unknown>).nombre} ${(perfil as Record<string, unknown>).apellido}` : 'Sistema'
    const { data: miembroData } = await supabase.from('miembros').select('empresa_id').eq('id', empleado.miembro_id).single()
    const empresaId = (miembroData as Record<string, unknown>)?.empresa_id as string

    const montoReal = parseFloat(montoAPagar) || emp.monto_neto

    const { data: pagoInsertado } = await supabase.from('pagos_nomina').insert({
      empresa_id: empresaId,
      miembro_id: empleado.miembro_id,
      fecha_inicio_periodo: periodoInterno.desde,
      fecha_fin_periodo: periodoInterno.hasta,
      concepto: periodoInterno.etiqueta,
      monto_sugerido: emp.monto_neto,
      monto_abonado: montoReal,
      dias_habiles: emp.dias_laborales,
      dias_trabajados: emp.dias_trabajados,
      dias_ausentes: emp.dias_ausentes,
      tardanzas: emp.dias_tardanza,
      notas: notasPago || null,
      creado_por: user.user?.id,
      creado_por_nombre: nombreCreador,
    }).select('id').single()

    if (pagoInsertado) {
      await fetch('/api/adelantos/descontar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pago_nomina_id: (pagoInsertado as Record<string, unknown>).id,
          miembro_id: empleado.miembro_id,
          fecha_fin_periodo: periodoInterno.hasta,
        }),
      }).catch(() => {})
    }

    await recargarDatos()
    setPagando(false)
    setConfirmandoPago(false)
    setMontoAPagar('')
    setNotasPago('')
    onActualizado()
  }

  // Editar monto de un pago existente
  const handleEditarPago = async (pagoId: string) => {
    const monto = parseFloat(editMontoAbonado)
    if (!monto || monto <= 0) return
    await supabase.from('pagos_nomina').update({ monto_abonado: monto }).eq('id', pagoId)
    setEditandoPago(null)
    await recargarDatos()
  }

  // Eliminar pago
  const handleEliminarPago = async (pagoId: string) => {
    await supabase.from('pagos_nomina').update({ eliminado: true, eliminado_en: new Date().toISOString() }).eq('id', pagoId)
    await recargarDatos()
    onActualizado()
  }

  // Crear adelanto
  const handleCrearAdelanto = async () => {
    if (!empleado) return
    const monto = parseFloat(adelantoMonto)
    if (!monto || monto <= 0) return
    setCreandoAdelanto(true)

    const frecuencia = compFrecuencia === 'eventual' ? 'mensual' : compFrecuencia
    await fetch('/api/adelantos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        miembro_id: empleado.miembro_id,
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
    onActualizado()
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
    onActualizado()
  }

  const handleCancelarAdelanto = async (id: string) => {
    await fetch(`/api/adelantos/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ estado: 'cancelado' }),
    })
    setAdelantos(prev => prev.filter(a => a.id !== id))
    onActualizado()
  }

  if (!empleado || !datosEmpleado) return null

  const emp = datosEmpleado // datos del período actual (puede ser diferente al período externo)
  const diasAHorario = Math.max(0, emp.dias_trabajados - emp.dias_tardanza)
  const pctAsistencia = emp.dias_laborales > 0
    ? Math.round((emp.dias_trabajados / emp.dias_laborales) * 100) : 0
  const proyeccionMensual = compTipo === 'por_dia'
    ? (parseFloat(compMonto) || 0) * compDias * 4.33
    : parseFloat(compMonto) || 0

  return (
    <>
      <Modal
        abierto={abierto}
        onCerrar={onCerrar}
        titulo={empleado.nombre}
        tamano="5xl"
        sinPadding
        acciones={
          confirmandoPago ? undefined : (
            <div className="flex items-center justify-between w-full">
              <Boton variante="fantasma" tamano="sm" onClick={onCerrar}>Cerrar</Boton>
              <div className="flex items-center gap-2">
                <Boton variante="secundario" tamano="sm" icono={<Send size={13} />}
                  onClick={() => setModalEnvio(true)}>
                  Enviar recibo
                </Boton>
                <Boton tamano="sm" icono={<Banknote size={14} />}
                  onClick={() => { setMontoAPagar(String(emp.monto_neto)); setConfirmandoPago(true) }}>
                  Pagar
                </Boton>
              </div>
            </div>
          )
        }
      >
        <div className="divide-y divide-white/[0.07]">

          {/* ── NAVEGACIÓN DE PERÍODO ── */}
          <div className="flex items-center justify-between px-6 py-3 bg-white/[0.02]">
            <button
              onClick={() => navegarPeriodo('prev')}
              className="size-10 flex items-center justify-center rounded-lg border border-borde-sutil hover:bg-white/[0.05] transition-colors cursor-pointer shrink-0"
              title="Período anterior"
            >
              <ChevronLeft size={22} className="text-texto-secundario" />
            </button>
            <div className="text-center flex-1">
              <p className="text-sm font-semibold text-texto-primario">{periodoInterno.etiqueta}</p>
              <div className="flex items-center justify-center gap-2">
                <p className="text-xxs text-texto-terciario">{fmtFecha(periodoInterno.desde)} — {fmtFecha(periodoInterno.hasta)}</p>
                {(periodoInterno.desde !== periodo.desde || periodoInterno.hasta !== periodo.hasta) && (
                  <button
                    onClick={() => { setPeriodoInterno(periodo); setDatosEmpleado(empleado); cargarPagosYAdelantos(empleado!.miembro_id, periodo.desde, periodo.hasta) }}
                    className="text-xxs text-texto-marca hover:underline cursor-pointer"
                  >
                    Ir a hoy
                  </button>
                )}
              </div>
            </div>
            <button
              onClick={() => navegarPeriodo('next')}
              className="size-10 flex items-center justify-center rounded-lg border border-borde-sutil hover:bg-white/[0.05] transition-colors cursor-pointer shrink-0"
              title="Período siguiente"
            >
              <ChevronRight size={22} className="text-texto-secundario" />
            </button>
          </div>

          {/* ── PASO DE CONFIRMACIÓN DE PAGO ── */}
          {confirmandoPago && (
            <div className="px-6 py-5 bg-insignia-exito/5">
              <p className="text-[11px] font-medium text-insignia-exito uppercase tracking-wider mb-4">Confirmar pago</p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                </div>
                <div>
                  <Input
                    tipo="text"
                    etiqueta="Notas (opcional)"
                    value={notasPago}
                    onChange={e => setNotasPago(e.target.value)}
                    placeholder="Observaciones del pago..."
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 mt-4">
                <Boton tamano="sm" icono={<Check size={14} />} onClick={handleConfirmarPago} cargando={pagando}
                  disabled={!montoAPagar || parseFloat(montoAPagar) <= 0}>
                  Confirmar pago de {montoAPagar ? fmtMonto(parseFloat(montoAPagar)) : '...'}
                </Boton>
                <Boton variante="fantasma" tamano="sm" onClick={() => setConfirmandoPago(false)}>Cancelar</Boton>
              </div>
            </div>
          )}

          {/* ── COMPENSACIÓN ── */}
          <div className="px-6 py-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-[11px] font-medium text-texto-terciario uppercase tracking-wider">Compensación</p>
              {!compEditando && (
                <Boton variante="fantasma" tamano="xs" icono={<Pencil size={12} />} onClick={() => setCompEditando(true)}>Editar</Boton>
              )}
            </div>

            {!compEditando ? (
              /* ── Resumen compacto ── */
              <div>
                <div className="flex items-center gap-2 flex-wrap mb-2">
                  <Insignia color={compTipo === 'por_dia' ? 'info' : compTipo === 'por_hora' ? 'cyan' : 'primario'}>
                    {compTipo === 'por_dia' ? 'Cobra por día' : compTipo === 'por_hora' ? 'Cobra por hora' : 'Sueldo fijo'}
                  </Insignia>
                  <Insignia color="neutro">
                    {compFrecuencia === 'semanal' ? 'Semanal' : compFrecuencia === 'quincenal' ? 'Quincenal' : 'Mensual'}
                  </Insignia>
                  <Insignia color="neutro">
                    {compDias === 7 ? '7/7' : compDias === 6 ? 'L-S' : compDias === 5 ? 'L-V' : `${compDias} días`}
                  </Insignia>
                </div>
                {(parseFloat(compMonto) || 0) > 0 ? (
                  <div>
                    <p className="text-3xl font-bold text-texto-primario">
                      {compTipo === 'fijo' ? fmtMonto(parseFloat(compMonto)) : (
                        <>{fmtMonto(proyeccionMensual)}<span className="text-base font-normal text-texto-terciario">/mes</span></>
                      )}
                    </p>
                    {compTipo !== 'fijo' && (
                      <p className="text-xs text-texto-terciario mt-1">
                        {fmtMonto(parseFloat(compMonto))}/{compTipo === 'por_hora' ? 'hora' : 'día'} · {compDias} días/sem × 4.33 sem
                      </p>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-texto-terciario">Sin monto configurado</p>
                )}
              </div>
            ) : (
              /* ── Edición completa (estilo TabPagos original) ── */
              <div className="space-y-5">
                {/* Tipo de pago — cards grandes */}
                <div>
                  <p className="text-xs text-texto-terciario uppercase tracking-wide font-semibold mb-3">¿Cómo se le paga?</p>
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { valor: 'por_dia', titulo: 'Cobra por día', desc: 'Gana un monto por cada día que trabaja. El total depende de cuántos días asista.', icono: <CalendarDays size={20} /> },
                      { valor: 'fijo', titulo: 'Sueldo fijo', desc: 'Cobra un monto fijo por período completo, sin importar los días que asista.', icono: <Landmark size={20} /> },
                    ].map(op => (
                      <button key={op.valor}
                        onClick={() => { const prev = compTipo; setCompTipo(op.valor); guardarCompensacion('compensacion_tipo', op.valor, prev) }}
                        className={`flex items-start gap-3 p-3 rounded-xl border text-left cursor-pointer transition-all ${
                          compTipo === op.valor
                            ? 'border-texto-marca bg-texto-marca/5'
                            : 'border-white/[0.06] bg-white/[0.02] hover:border-white/[0.12]'
                        }`}
                      >
                        <div className={`size-10 rounded-lg flex items-center justify-center shrink-0 ${
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
                  <div className="max-w-sm">
                    <InputMoneda value={compMonto} onChange={setCompMonto} moneda="ARS" placeholder="40.000" />
                  </div>
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
                      { valor: 5, etiqueta: 'L-V', sub: 'Lunes a Viernes' },
                      { valor: 6, etiqueta: 'L-S', sub: 'Lunes a Sábado' },
                      { valor: 7, etiqueta: '7/7', sub: 'Todos los días' },
                    ].map(d => (
                      <Boton key={d.valor}
                        variante={compDias === d.valor ? 'primario' : 'secundario'}
                        tamano="sm"
                        onClick={() => { const prev = compDias; setCompDias(d.valor); guardarCompensacion('dias_trabajo', d.valor, prev) }}
                        className={`min-w-[80px] ${compDias === d.valor ? '!border-texto-marca !bg-texto-marca/10 !text-texto-marca' : ''}`}
                      >
                        <div className="flex flex-col items-center">
                          <span className="text-sm font-bold">{d.etiqueta}</span>
                          <span className="text-xxs text-texto-terciario mt-0.5">{d.sub}</span>
                        </div>
                      </Boton>
                    ))}
                  </div>
                </div>

                <Boton variante="fantasma" tamano="sm" onClick={() => {
                  const montoNuevo = parseFloat(compMonto) || 0
                  if (montoNuevo !== empleado.compensacion_monto) {
                    guardarCompensacion('compensacion_monto', montoNuevo, empleado.compensacion_monto)
                  }
                  setCompEditando(false)
                }}>Listo</Boton>
              </div>
            )}
          </div>

          {/* ── PERÍODO + ADELANTOS (grid 2 col) ── */}
          <div className="grid grid-cols-1 md:grid-cols-[1fr_1px_1fr]">
            {/* Izquierda: Resumen período */}
            <div className="px-6 py-4 space-y-3">
              <div className="flex items-center gap-2">
                <p className="text-[11px] font-medium text-texto-terciario uppercase tracking-wider">Período</p>
                {recalculando && <div className="size-3 border-2 border-texto-marca/30 border-t-texto-marca rounded-full animate-spin" />}
              </div>

              <div className="grid grid-cols-3 gap-3 text-center">
                <div>
                  <p className="text-xl font-bold text-texto-primario">{emp.dias_trabajados}<span className="text-sm font-normal text-texto-terciario">/{emp.dias_laborales}</span></p>
                  <p className="text-xxs text-texto-terciario">Trabajados</p>
                </div>
                <div>
                  <p className="text-xl font-bold text-insignia-exito">{diasAHorario}</p>
                  <p className="text-xxs text-texto-terciario">A horario</p>
                </div>
                <div>
                  <p className="text-xl font-bold text-insignia-advertencia">{emp.dias_tardanza}</p>
                  <p className="text-xxs text-texto-terciario">Tardanzas</p>
                </div>
              </div>

              {emp.dias_ausentes > 0 && (
                <p className="text-xs text-insignia-peligro">{emp.dias_ausentes} ausencia{emp.dias_ausentes !== 1 ? 's' : ''}</p>
              )}

              {(() => {
                // Calcular si hay un pago en este período para mostrar desglose completo
                const pagoDelPeriodo = pagos.length > 0 ? pagos[0] : null
                const montoAbonado = pagoDelPeriodo ? parseFloat(pagoDelPeriodo.monto_abonado as string) : 0
                const hayPago = pagoDelPeriodo != null
                const diferenciaPago = hayPago ? montoAbonado - emp.monto_neto : 0

                return (
                  <div className="border-t border-white/[0.07] pt-3 space-y-1.5">
                    <div className="flex justify-between text-sm">
                      <span className="text-texto-terciario">Horas netas</span>
                      <span className="text-texto-primario">{fmtHoras(emp.horas_netas)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-texto-terciario">Bruto</span>
                      <span className="text-texto-primario font-medium">{fmtMonto(emp.monto_pagar)}</span>
                    </div>
                    {emp.descuento_adelanto > 0 && (
                      <div className="flex justify-between text-sm">
                        <span className="text-insignia-advertencia">Adelanto</span>
                        <span className="text-insignia-advertencia">-{fmtMonto(emp.descuento_adelanto)}</span>
                      </div>
                    )}
                    {emp.saldo_anterior !== 0 && (
                      <div className="flex justify-between text-sm">
                        <span className={emp.saldo_anterior > 0 ? 'text-insignia-info' : 'text-insignia-peligro'}>
                          {emp.saldo_anterior > 0 ? 'A favor (período ant.)' : 'Debe (período ant.)'}
                        </span>
                        <span className={emp.saldo_anterior > 0 ? 'text-insignia-info' : 'text-insignia-peligro'}>
                          {emp.saldo_anterior > 0 ? '-' : '+'}{fmtMonto(Math.abs(emp.saldo_anterior))}
                        </span>
                      </div>
                    )}
                    <div className="flex justify-between text-sm border-t border-white/[0.07] pt-1.5">
                      <span className="text-texto-primario font-semibold">Neto a pagar</span>
                      <span className="text-insignia-exito font-bold text-base">{fmtMonto(emp.monto_neto)}</span>
                    </div>

                    {/* Si ya hay un pago, mostrar qué se pagó y la diferencia */}
                    {hayPago && (
                      <>
                        <div className="flex justify-between text-sm border-t border-white/[0.07] pt-1.5 mt-1.5">
                          <span className="text-texto-terciario">Se pagó</span>
                          <span className="text-texto-primario font-semibold">{fmtMonto(montoAbonado)}</span>
                        </div>
                        {diferenciaPago !== 0 && (
                          <div className="flex justify-between text-sm">
                            <span className={diferenciaPago > 0 ? 'text-insignia-info' : 'text-insignia-peligro'}>
                              {diferenciaPago > 0 ? 'A favor del empleado' : 'Quedó debiendo'}
                            </span>
                            <span className={`font-semibold ${diferenciaPago > 0 ? 'text-insignia-info' : 'text-insignia-peligro'}`}>
                              {diferenciaPago > 0 ? '+' : ''}{fmtMonto(diferenciaPago)}
                            </span>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )
              })()}

              <p className="text-xxs text-texto-terciario">{emp.monto_detalle} · {pctAsistencia}% asistencia</p>
            </div>

            {/* Divisor */}
            <div className="hidden md:block bg-white/[0.07]" />

            {/* Derecha: Adelantos y descuentos */}
            <div className="px-6 py-4 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-[11px] font-medium text-texto-terciario uppercase tracking-wider">Descuentos</p>
                {!mostrarFormAdelanto && (
                  <Boton variante="fantasma" tamano="xs" icono={<Plus size={12} />}
                    onClick={() => setMostrarFormAdelanto(true)}>Nuevo adelanto</Boton>
                )}
              </div>

              {/* Saldo a favor del período anterior */}
              {emp.saldo_anterior > 0 && (
                <div className="flex items-center gap-3 py-2 px-3 rounded-lg bg-insignia-info/10 border border-insignia-info/20">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-insignia-info">A favor período anterior</span>
                    </div>
                    <p className="text-xxs text-texto-terciario mt-0.5">Se pagó de más, se descuenta este período</p>
                  </div>
                  <span className="text-sm font-bold text-insignia-info">-{fmtMonto(emp.saldo_anterior)}</span>
                </div>
              )}

              {/* Saldo en contra del período anterior */}
              {emp.saldo_anterior < 0 && (
                <div className="flex items-center gap-3 py-2 px-3 rounded-lg bg-insignia-peligro/10 border border-insignia-peligro/20">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-insignia-peligro">Debe del período anterior</span>
                    </div>
                    <p className="text-xxs text-texto-terciario mt-0.5">Se pagó de menos, se suma a este período</p>
                  </div>
                  <span className="text-sm font-bold text-insignia-peligro">+{fmtMonto(Math.abs(emp.saldo_anterior))}</span>
                </div>
              )}

              {adelantos.length === 0 && !mostrarFormAdelanto && emp.saldo_anterior === 0 && (
                <p className="text-xs text-texto-terciario py-2">Sin descuentos en este período</p>
              )}

              {adelantos.map(a => {
                const aid = a.id as string
                const cuotasT = a.cuotas_totales as number
                const cuotasD = a.cuotas_descontadas as number
                const saldo = parseFloat(a.saldo_pendiente as string)
                const total = parseFloat(a.monto_total as string)
                const progreso = cuotasT > 0 ? (cuotasD / cuotasT) * 100 : 0
                const esEditando = editandoAdelanto === aid

                // Encontrar la cuota específica de ESTE período
                const cuotas = (a.cuotas || []) as Record<string, unknown>[]
                const cuotaDelPeriodo = cuotas.find(c =>
                  (c.fecha_programada as string) >= periodoInterno.desde &&
                  (c.fecha_programada as string) <= periodoInterno.hasta
                )
                const numeroCuotaPeriodo = cuotaDelPeriodo ? (cuotaDelPeriodo.numero_cuota as number) : null
                const montoCuotaPeriodo = cuotaDelPeriodo ? parseFloat(cuotaDelPeriodo.monto_cuota as string) : 0

                if (esEditando) {
                  return (
                    <div key={aid} className="space-y-2 p-3 rounded-lg border border-texto-marca/30 bg-texto-marca/5">
                      <InputMoneda value={editAdelantoMonto} onChange={setEditAdelantoMonto} moneda="ARS" etiqueta="Monto" />
                      <div>
                        <label className="text-xs text-texto-terciario mb-1 block">Cuotas totales</label>
                        <select value={editAdelantoCuotas} onChange={e => setEditAdelantoCuotas(e.target.value)}
                          className="w-full text-xs bg-superficie-elevada border border-borde-sutil rounded-lg px-2 py-1.5 text-texto-primario">
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
                  <div key={aid} className="flex items-center gap-3 py-2 border-b border-white/[0.05] last:border-0">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-texto-primario">{fmtMonto(montoCuotaPeriodo || total)}</span>
                        {numeroCuotaPeriodo ? (
                          <Insignia color="advertencia" tamano="sm">Cuota {numeroCuotaPeriodo}/{cuotasT}</Insignia>
                        ) : (
                          <Insignia color="neutro" tamano="sm">{cuotasD}/{cuotasT} pagadas</Insignia>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <div className="flex-1 h-1 bg-superficie-hover rounded-full overflow-hidden max-w-[80px]">
                          <div className="h-full bg-insignia-advertencia rounded-full" style={{ width: `${progreso}%` }} />
                        </div>
                        <span className="text-xxs text-texto-terciario">
                          Total: {fmtMonto(total)} · Saldo: {fmtMonto(saldo)}
                        </span>
                      </div>
                      {(a.notas as string) ? <p className="text-xxs text-texto-terciario mt-0.5">{String(a.notas)}</p> : null}
                    </div>
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
                )
              })}

              {/* Formulario nuevo adelanto */}
              {mostrarFormAdelanto && (
                <div className="space-y-2 p-3 rounded-lg border border-white/[0.07] bg-white/[0.02]">
                  <InputMoneda value={adelantoMonto} onChange={setAdelantoMonto} moneda="ARS" placeholder="Monto" />
                  <div className="grid grid-cols-2 gap-2">
                    <select value={adelantoCuotas} onChange={e => setAdelantoCuotas(e.target.value)}
                      className="w-full text-xs bg-superficie-elevada border border-borde-sutil rounded-lg px-2 py-1.5 text-texto-primario">
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
            </div>
          </div>

          {/* ── HISTORIAL DE PAGOS (editable) ── */}
          <div className="px-6 py-4">
            <p className="text-[11px] font-medium text-texto-terciario uppercase tracking-wider mb-3">Pagos del período</p>
            {pagos.length === 0 ? (
              <p className="text-xs text-texto-terciario">Sin pagos registrados en este período</p>
            ) : (
              <div className="space-y-1.5">
                {pagos.map(p => {
                  const pagoId = p.id as string
                  const montoAbonado = p.monto_abonado as number
                  const montoSugerido = p.monto_sugerido as number
                  const esEditando = editandoPago === pagoId

                  return (
                    <div key={pagoId} className="flex items-center gap-3 py-2 border-b border-white/[0.05] last:border-0">
                      <Receipt size={13} className="text-texto-terciario shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-texto-secundario truncate">{p.concepto as string}</p>
                        <p className="text-xxs text-texto-terciario">
                          {new Date(p.creado_en as string).toLocaleDateString(locale, { day: '2-digit', month: 'short', year: 'numeric' })}
                          {p.creado_por_nombre ? <> · {String(p.creado_por_nombre)}</> : null}
                        </p>
                        {p.notas ? <p className="text-xxs text-texto-terciario truncate mt-0.5">{String(p.notas)}</p> : null}
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
                            <span className="text-sm font-semibold text-insignia-exito">{fmtMonto(montoAbonado)}</span>
                            {montoSugerido && montoAbonado !== montoSugerido && (
                              <p className={`text-xxs ${montoAbonado > montoSugerido ? 'text-insignia-info' : 'text-insignia-peligro'}`}>
                                {montoAbonado > montoSugerido
                                  ? `+${fmtMonto(montoAbonado - montoSugerido)} a favor → se descuenta`
                                  : `${fmtMonto(montoAbonado - montoSugerido)} quedó debiendo`
                                }
                              </p>
                            )}
                          </div>
                          <Boton variante="fantasma" tamano="xs" soloIcono titulo="Editar monto"
                            icono={<Pencil size={11} />}
                            onClick={() => { setEditandoPago(pagoId); setEditMontoAbonado(String(montoAbonado)) }} />
                          <Boton variante="fantasma" tamano="xs" soloIcono titulo="Eliminar pago"
                            icono={<Trash2 size={11} />}
                            onClick={() => handleEliminarPago(pagoId)} />
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </Modal>

      <ModalEnviarReciboNomina
        abierto={modalEnvio}
        onCerrar={() => setModalEnvio(false)}
        resultados={datosEmpleado ? [datosEmpleado] : []}
        etiquetaPeriodo={periodoInterno.etiqueta}
        nombreEmpresa={nombreEmpresa}
      />
    </>
  )
}
