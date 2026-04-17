'use client'

/**
 * ModalDetalleNomina — Modal completo de gestión de nómina por empleado.
 * Compensación editable, resumen del período, adelantos, historial, pagar.
 * Se usa en: VistaNomina.tsx (al clickear un empleado)
 */

import { useState, useEffect, useCallback } from 'react'
import { ModalAdaptable as Modal } from '@/componentes/ui/ModalAdaptable'
import { Boton } from '@/componentes/ui/Boton'
import { InputMoneda } from '@/componentes/ui/InputMoneda'
import { Input } from '@/componentes/ui/Input'
import { Insignia } from '@/componentes/ui/Insignia'
import { SelectorFecha } from '@/componentes/ui/SelectorFecha'
import { EstadoVacio } from '@/componentes/feedback/EstadoVacio'
import { ModalEnviarReciboNomina } from './ModalEnviarReciboNomina'
import { crearClienteNavegador } from '@/lib/supabase/cliente'
import {
  Banknote, CalendarDays, Plus, X, Loader2,
  Receipt, ChevronDown, Send, Landmark,
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
  monto_neto: number
}

interface Props {
  abierto: boolean
  onCerrar: () => void
  empleado: ResultadoNomina | null
  periodo: { desde: string; hasta: string; etiqueta: string }
  nombreEmpresa: string
  onActualizado: () => void // recargar tabla
}

// ─── Helpers ───

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

  // Estado
  const [adelantos, setAdelantos] = useState<Record<string, unknown>[]>([])
  const [pagos, setPagos] = useState<Record<string, unknown>[]>([])
  const [cargando, setCargando] = useState(false)
  const [pagando, setPagando] = useState(false)
  const [modalEnvio, setModalEnvio] = useState(false)

  // Compensación editable
  const [compTipo, setCompTipo] = useState('')
  const [compMonto, setCompMonto] = useState('')
  const [compFrecuencia, setCompFrecuencia] = useState('')
  const [compDias, setCompDias] = useState(5)
  const [compEditando, setCompEditando] = useState(false)

  // Adelanto nuevo
  const [mostrarFormAdelanto, setMostrarFormAdelanto] = useState(false)
  const [adelantoMonto, setAdelantoMonto] = useState('')
  const [adelantoCuotas, setAdelantoCuotas] = useState('1')
  const [adelantoNotas, setAdelantoNotas] = useState('')
  const [adelantoFecha, setAdelantoFecha] = useState('')
  const [creandoAdelanto, setCreandoAdelanto] = useState(false)

  // Cargar datos al abrir
  useEffect(() => {
    if (!abierto || !empleado) return
    setCargando(true)

    // Compensación
    setCompTipo(empleado.compensacion_tipo)
    setCompMonto(String(empleado.compensacion_monto))
    setCompFrecuencia(empleado.compensacion_frecuencia || 'mensual')
    setCompEditando(false)
    setMostrarFormAdelanto(false)

    // Cargar adelantos
    fetch(`/api/adelantos?miembro_id=${empleado.miembro_id}`)
      .then(r => r.json())
      .then(d => setAdelantos((d.adelantos || []).filter((a: Record<string, unknown>) => a.estado === 'activo')))
      .catch(() => {})

    // Cargar pagos recientes
    supabase
      .from('pagos_nomina')
      .select('id, concepto, monto_abonado, fecha_inicio_periodo, fecha_fin_periodo, creado_en')
      .eq('miembro_id', empleado.miembro_id)
      .order('creado_en', { ascending: false })
      .limit(5)
      .then(({ data }) => setPagos(data || []))

    // Cargar dias_trabajo del miembro
    supabase
      .from('miembros')
      .select('dias_trabajo')
      .eq('id', empleado.miembro_id)
      .single()
      .then(({ data }) => {
        if (data) setCompDias((data as Record<string, unknown>).dias_trabajo as number || 5)
      })

    setCargando(false)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [abierto, empleado?.miembro_id])

  // Guardar compensación
  const guardarCompensacion = useCallback(async (campo: string, valor: unknown) => {
    if (!empleado) return
    await supabase.from('miembros').update({ [campo]: valor }).eq('id', empleado.miembro_id)
    onActualizado()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [empleado?.miembro_id, onActualizado])

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

    // Recargar adelantos
    const res = await fetch(`/api/adelantos?miembro_id=${empleado.miembro_id}`)
    const data = await res.json()
    setAdelantos((data.adelantos || []).filter((a: Record<string, unknown>) => a.estado === 'activo'))

    setCreandoAdelanto(false)
    setMostrarFormAdelanto(false)
    setAdelantoMonto(''); setAdelantoCuotas('1'); setAdelantoNotas(''); setAdelantoFecha('')
    onActualizado()
  }

  // Cancelar adelanto
  const handleCancelarAdelanto = async (id: string) => {
    await fetch(`/api/adelantos/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ estado: 'cancelado' }),
    })
    setAdelantos(prev => prev.filter(a => a.id !== id))
    onActualizado()
  }

  // Registrar pago
  const handlePagar = async () => {
    if (!empleado) return
    setPagando(true)

    const { data: perfil } = await supabase.from('perfiles').select('nombre, apellido').limit(1).single()
    const nombreCreador = perfil ? `${perfil.nombre} ${perfil.apellido}` : 'Sistema'
    const { data: empresa } = await supabase.from('miembros').select('empresa_id').eq('id', empleado.miembro_id).single()
    const empresaId = (empresa as Record<string, unknown>)?.empresa_id as string

    const { data: pagoInsertado } = await supabase.from('pagos_nomina').insert({
      empresa_id: empresaId,
      miembro_id: empleado.miembro_id,
      fecha_inicio_periodo: periodo.desde,
      fecha_fin_periodo: periodo.hasta,
      concepto: periodo.etiqueta,
      monto_sugerido: empleado.monto_pagar,
      monto_abonado: empleado.monto_neto,
      dias_habiles: empleado.dias_laborales,
      dias_trabajados: empleado.dias_trabajados,
      dias_ausentes: empleado.dias_ausentes,
      tardanzas: empleado.dias_tardanza,
      creado_por: (await supabase.auth.getUser()).data.user?.id,
      creado_por_nombre: nombreCreador,
    }).select('id').single()

    // Descontar cuotas de adelantos
    if (pagoInsertado) {
      await fetch('/api/adelantos/descontar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pago_nomina_id: (pagoInsertado as Record<string, unknown>).id,
          miembro_id: empleado.miembro_id,
          fecha_fin_periodo: periodo.hasta,
        }),
      }).catch(() => {})
    }

    // Recargar
    const { data: pagosNuevos } = await supabase
      .from('pagos_nomina')
      .select('id, concepto, monto_abonado, fecha_inicio_periodo, fecha_fin_periodo, creado_en')
      .eq('miembro_id', empleado.miembro_id)
      .order('creado_en', { ascending: false })
      .limit(5)
    setPagos(pagosNuevos || [])

    const resAdel = await fetch(`/api/adelantos?miembro_id=${empleado.miembro_id}`)
    const dataAdel = await resAdel.json()
    setAdelantos((dataAdel.adelantos || []).filter((a: Record<string, unknown>) => a.estado === 'activo'))

    setPagando(false)
    onActualizado()
  }

  if (!empleado) return null

  const diasAHorario = Math.max(0, empleado.dias_trabajados - empleado.dias_tardanza)
  const pctAsistencia = empleado.dias_laborales > 0
    ? Math.round((empleado.dias_trabajados / empleado.dias_laborales) * 100)
    : 0

  return (
    <>
      <Modal
        abierto={abierto}
        onCerrar={onCerrar}
        titulo={`${empleado.nombre} — ${periodo.etiqueta}`}
        tamano="4xl"
        sinPadding
        acciones={
          <div className="flex items-center justify-between w-full">
            <Boton variante="fantasma" tamano="sm" onClick={onCerrar}>Cerrar</Boton>
            <div className="flex items-center gap-2">
              <Boton variante="secundario" tamano="sm" icono={<Send size={13} />}
                onClick={() => setModalEnvio(true)}>
                Enviar recibo
              </Boton>
              <Boton tamano="sm" icono={<Banknote size={14} />}
                onClick={handlePagar} cargando={pagando}>
                Pagar {fmtMonto(empleado.monto_neto)}
              </Boton>
            </div>
          </div>
        }
      >
        <div className="divide-y divide-white/[0.07]">

          {/* ── COMPENSACIÓN ── */}
          <div className="px-6 py-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-[11px] font-medium text-texto-terciario uppercase tracking-wider">Compensación</p>
              {!compEditando && (
                <Boton variante="fantasma" tamano="xs" onClick={() => setCompEditando(true)}>Editar</Boton>
              )}
            </div>

            {!compEditando ? (
              <div className="flex items-center gap-2 flex-wrap">
                <Insignia color={compTipo === 'por_dia' ? 'info' : 'primario'}>
                  {compTipo === 'por_dia' ? 'Por día' : compTipo === 'por_hora' ? 'Por hora' : 'Sueldo fijo'}
                </Insignia>
                <Insignia color="neutro">
                  {compFrecuencia === 'semanal' ? 'Semanal' : compFrecuencia === 'quincenal' ? 'Quincenal' : 'Mensual'}
                </Insignia>
                <Insignia color="neutro">
                  {compDias === 7 ? '7/7' : compDias === 6 ? 'L-S' : compDias === 5 ? 'L-V' : `${compDias} días`}
                </Insignia>
                <span className="text-sm font-semibold text-texto-primario ml-2">
                  {fmtMonto(parseFloat(compMonto) || 0)}
                  {compTipo !== 'fijo' && <span className="text-texto-terciario font-normal">/{compTipo === 'por_hora' ? 'hora' : 'día'}</span>}
                </span>
              </div>
            ) : (
              <div className="space-y-3">
                {/* Tipo */}
                <div className="flex gap-2">
                  {[
                    { valor: 'por_dia', etiqueta: 'Por día', icono: <CalendarDays size={14} /> },
                    { valor: 'fijo', etiqueta: 'Sueldo fijo', icono: <Landmark size={14} /> },
                  ].map(op => (
                    <button key={op.valor}
                      onClick={() => { setCompTipo(op.valor); guardarCompensacion('compensacion_tipo', op.valor) }}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border cursor-pointer transition-all ${
                        compTipo === op.valor
                          ? 'bg-texto-marca/15 border-texto-marca/40 text-texto-marca'
                          : 'bg-white/[0.03] border-white/[0.06] text-texto-terciario'
                      }`}
                    >{op.icono}{op.etiqueta}</button>
                  ))}
                </div>

                {/* Monto + Frecuencia */}
                <div className="grid grid-cols-2 gap-3">
                  <InputMoneda
                    etiqueta={compTipo === 'fijo' ? 'Sueldo' : 'Monto por día'}
                    value={compMonto}
                    onChange={(v) => { setCompMonto(v); guardarCompensacion('compensacion_monto', parseFloat(v) || 0) }}
                    moneda="ARS"
                  />
                  <div>
                    <label className="text-xs font-medium text-texto-secundario mb-1 block">Frecuencia</label>
                    <select
                      value={compFrecuencia}
                      onChange={e => { setCompFrecuencia(e.target.value); guardarCompensacion('compensacion_frecuencia', e.target.value) }}
                      className="w-full text-sm bg-superficie-elevada border border-borde-sutil rounded-lg px-3 py-2 text-texto-primario"
                    >
                      <option value="semanal">Semanal</option>
                      <option value="quincenal">Quincenal</option>
                      <option value="mensual">Mensual</option>
                    </select>
                  </div>
                </div>

                {/* Días por semana */}
                <div className="flex items-center gap-2">
                  <span className="text-xs text-texto-terciario">Días/semana:</span>
                  {[5, 6, 7].map(d => (
                    <button key={d}
                      onClick={() => { setCompDias(d); guardarCompensacion('dias_trabajo', d) }}
                      className={`px-2.5 py-1 rounded text-xs font-medium border cursor-pointer ${
                        compDias === d
                          ? 'bg-texto-marca/15 border-texto-marca/40 text-texto-marca'
                          : 'bg-white/[0.03] border-white/[0.06] text-texto-terciario'
                      }`}
                    >{d === 5 ? 'L-V' : d === 6 ? 'L-S' : '7/7'}</button>
                  ))}
                  <Boton variante="fantasma" tamano="xs" onClick={() => setCompEditando(false)} className="ml-auto">Listo</Boton>
                </div>
              </div>
            )}
          </div>

          {/* ── PERÍODO + ADELANTOS (grid 2 col) ── */}
          <div className="grid grid-cols-1 md:grid-cols-[1fr_1px_1fr]">
            {/* Izquierda: Resumen período */}
            <div className="px-6 py-4 space-y-3">
              <p className="text-[11px] font-medium text-texto-terciario uppercase tracking-wider">Período actual</p>

              <div className="grid grid-cols-3 gap-3 text-center">
                <div>
                  <p className="text-xl font-bold text-texto-primario">{empleado.dias_trabajados}<span className="text-sm font-normal text-texto-terciario">/{empleado.dias_laborales}</span></p>
                  <p className="text-xxs text-texto-terciario">Trabajados</p>
                </div>
                <div>
                  <p className="text-xl font-bold text-insignia-exito">{diasAHorario}</p>
                  <p className="text-xxs text-texto-terciario">A horario</p>
                </div>
                <div>
                  <p className="text-xl font-bold text-insignia-advertencia">{empleado.dias_tardanza}</p>
                  <p className="text-xxs text-texto-terciario">Tardanzas</p>
                </div>
              </div>

              {empleado.dias_ausentes > 0 && (
                <p className="text-xs text-insignia-peligro">{empleado.dias_ausentes} ausencia{empleado.dias_ausentes !== 1 ? 's' : ''}</p>
              )}

              <div className="border-t border-white/[0.07] pt-3 space-y-1.5">
                <div className="flex justify-between text-sm">
                  <span className="text-texto-terciario">Horas netas</span>
                  <span className="text-texto-primario">{fmtHoras(empleado.horas_netas)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-texto-terciario">Bruto</span>
                  <span className="text-texto-primario font-medium">{fmtMonto(empleado.monto_pagar)}</span>
                </div>
                {empleado.descuento_adelanto > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-insignia-advertencia">Adelanto</span>
                    <span className="text-insignia-advertencia">-{fmtMonto(empleado.descuento_adelanto)}</span>
                  </div>
                )}
                <div className="flex justify-between text-sm border-t border-white/[0.07] pt-1.5">
                  <span className="text-texto-primario font-semibold">Neto a pagar</span>
                  <span className="text-insignia-exito font-bold text-base">{fmtMonto(empleado.monto_neto)}</span>
                </div>
              </div>

              <p className="text-xxs text-texto-terciario">{empleado.monto_detalle} · {pctAsistencia}% asistencia</p>
            </div>

            {/* Divisor */}
            <div className="hidden md:block bg-white/[0.07]" />

            {/* Derecha: Adelantos */}
            <div className="px-6 py-4 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-[11px] font-medium text-texto-terciario uppercase tracking-wider">Adelantos</p>
                {!mostrarFormAdelanto && (
                  <Boton variante="fantasma" tamano="xs" icono={<Plus size={12} />}
                    onClick={() => setMostrarFormAdelanto(true)}>
                    Nuevo
                  </Boton>
                )}
              </div>

              {/* Lista de adelantos activos */}
              {adelantos.length === 0 && !mostrarFormAdelanto && (
                <p className="text-xs text-texto-terciario py-2">Sin adelantos activos</p>
              )}

              {adelantos.map(a => {
                const cuotasT = a.cuotas_totales as number
                const cuotasD = a.cuotas_descontadas as number
                const saldo = parseFloat(a.saldo_pendiente as string)
                const total = parseFloat(a.monto_total as string)
                const progreso = cuotasT > 0 ? (cuotasD / cuotasT) * 100 : 0

                return (
                  <div key={a.id as string} className="flex items-center gap-3 py-2 border-b border-white/[0.05] last:border-0">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-texto-primario">{fmtMonto(total)}</span>
                        <Insignia color="advertencia" tamano="sm">{cuotasD}/{cuotasT}</Insignia>
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <div className="flex-1 h-1 bg-superficie-hover rounded-full overflow-hidden max-w-[80px]">
                          <div className="h-full bg-insignia-advertencia rounded-full" style={{ width: `${progreso}%` }} />
                        </div>
                        <span className="text-xxs text-texto-terciario">Saldo: {fmtMonto(saldo)}</span>
                      </div>
                    </div>
                    <Boton variante="fantasma" tamano="xs" soloIcono titulo="Cancelar"
                      icono={<X size={12} />} onClick={() => handleCancelarAdelanto(a.id as string)} />
                  </div>
                )
              })}

              {/* Formulario nuevo adelanto */}
              {mostrarFormAdelanto && (
                <div className="space-y-2 p-3 rounded-lg border border-white/[0.07] bg-white/[0.02]">
                  <InputMoneda value={adelantoMonto} onChange={setAdelantoMonto} moneda="ARS" placeholder="Monto" />
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <select value={adelantoCuotas} onChange={e => setAdelantoCuotas(e.target.value)}
                        className="w-full text-xs bg-superficie-elevada border border-borde-sutil rounded-lg px-2 py-1.5 text-texto-primario">
                        {Array.from({ length: 12 }, (_, i) => i + 1).map(n => (
                          <option key={n} value={n}>{n} cuota{n !== 1 ? 's' : ''}</option>
                        ))}
                      </select>
                    </div>
                    <SelectorFecha valor={adelantoFecha || null} onChange={v => setAdelantoFecha(v || '')} placeholder="Inicio" />
                  </div>
                  <Input tipo="text" value={adelantoNotas} onChange={e => setAdelantoNotas(e.target.value)} placeholder="Nota (opcional)" />
                  <div className="flex gap-2">
                    <Boton tamano="xs" onClick={handleCrearAdelanto} cargando={creandoAdelanto}
                      disabled={!adelantoMonto || parseFloat(adelantoMonto) <= 0}>
                      Registrar
                    </Boton>
                    <Boton variante="fantasma" tamano="xs" onClick={() => setMostrarFormAdelanto(false)}>Cancelar</Boton>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* ── HISTORIAL ── */}
          <div className="px-6 py-4">
            <p className="text-[11px] font-medium text-texto-terciario uppercase tracking-wider mb-3">Últimos pagos</p>
            {pagos.length === 0 ? (
              <p className="text-xs text-texto-terciario">Sin pagos registrados</p>
            ) : (
              <div className="space-y-1.5">
                {pagos.map(p => (
                  <div key={p.id as string} className="flex items-center justify-between py-1.5">
                    <div className="flex items-center gap-2">
                      <Receipt size={13} className="text-texto-terciario" />
                      <span className="text-sm text-texto-secundario">{p.concepto as string}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-semibold text-insignia-exito">
                        {fmtMonto(p.monto_abonado as number)}
                      </span>
                      <span className="text-xxs text-texto-terciario">
                        {new Date(p.creado_en as string).toLocaleDateString('es-AR', { day: '2-digit', month: 'short' })}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </Modal>

      {/* Modal envío recibo (1 empleado) */}
      <ModalEnviarReciboNomina
        abierto={modalEnvio}
        onCerrar={() => setModalEnvio(false)}
        resultados={empleado ? [empleado] : []}
        etiquetaPeriodo={periodo.etiqueta}
        nombreEmpresa={nombreEmpresa}
      />
    </>
  )
}
