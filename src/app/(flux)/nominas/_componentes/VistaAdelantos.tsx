'use client'

/**
 * VistaAdelantos — Tab "Adelantos" del módulo Nóminas.
 *
 * Listado global de todos los adelantos de la empresa con filtros,
 * crear/editar/cancelar/reasignar y vista detallada de cuotas.
 *
 * Antes esta tab era un placeholder; ahora reemplaza por completo
 * la gestión que vivía dispersa en la ficha de cada empleado, sin
 * romper esa ficha (sigue funcionando para acciones individuales).
 *
 * Ver PLAN_MODULO_NOMINAS.md.
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Boton } from '@/componentes/ui/Boton'
import { Input } from '@/componentes/ui/Input'
import { Select } from '@/componentes/ui/Select'
import { InputMoneda } from '@/componentes/ui/InputMoneda'
import { SelectorFecha } from '@/componentes/ui/SelectorFecha'
import { Modal } from '@/componentes/ui/Modal'
import { Insignia } from '@/componentes/ui/Insignia'
import { EstadoVacio } from '@/componentes/feedback/EstadoVacio'
import { useToast } from '@/componentes/feedback/Toast'
import { useRol } from '@/hooks/useRol'
import { useFormato } from '@/hooks/useFormato'
import {
  Wallet, Plus, Pencil, Trash2, ArrowRightLeft, Loader2, ChevronRight, ChevronDown,
} from 'lucide-react'

// ════════════════════════════════════════════════════════════════
// Tipos
// ════════════════════════════════════════════════════════════════

interface Cuota {
  id: string
  numero_cuota: number
  monto_cuota: string | number
  fecha_programada: string
  fecha_descontada: string | null
  estado: 'pendiente' | 'descontada' | 'cancelada'
  pago_nomina_id: string | null
}

interface Adelanto {
  id: string
  miembro_id: string
  tipo: 'adelanto' | 'descuento'
  monto_total: string | number
  cuotas_totales: number
  cuotas_descontadas: number
  saldo_pendiente: string | number
  frecuencia_descuento: 'semanal' | 'quincenal' | 'mensual'
  fecha_solicitud: string
  fecha_inicio_descuento: string
  estado: 'activo' | 'pagado' | 'cancelado'
  notas: string | null
  creado_por_nombre: string
  creado_en: string
  cuotas: Cuota[]
}

interface EmpleadoMini {
  miembro_id: string
  nombre: string
  apellido: string
}

// ════════════════════════════════════════════════════════════════
// Componente principal
// ════════════════════════════════════════════════════════════════

export function VistaAdelantos() {
  const toast = useToast()
  const { tienePermiso } = useRol()
  const { moneda } = useFormato()
  const puedeEditar = tienePermiso('nomina', 'editar')

  // Datos
  const [adelantos, setAdelantos] = useState<Adelanto[]>([])
  const [empleados, setEmpleados] = useState<EmpleadoMini[]>([])
  const [cargando, setCargando] = useState(true)

  // Filtros
  const [filtroMiembro, setFiltroMiembro] = useState('')
  const [filtroEstado, setFiltroEstado] = useState<'' | 'activo' | 'pagado' | 'cancelado'>('')
  const [filtroTipo, setFiltroTipo] = useState<'' | 'adelanto' | 'descuento'>('')
  const [filtroFrecuencia, setFiltroFrecuencia] = useState('')
  const [filtroDesde, setFiltroDesde] = useState('')
  const [filtroHasta, setFiltroHasta] = useState('')

  // Editor
  const [editorAbierto, setEditorAbierto] = useState(false)
  const [editando, setEditando] = useState<Adelanto | null>(null)
  const [reasignando, setReasignando] = useState<Adelanto | null>(null)
  const [detalleId, setDetalleId] = useState<string | null>(null)

  // ─── Cargas ───
  const cargarAdelantos = useCallback(async () => {
    setCargando(true)
    try {
      const params = new URLSearchParams()
      if (filtroMiembro) params.set('miembro_id', filtroMiembro)
      if (filtroEstado) params.set('estado', filtroEstado)
      if (filtroTipo) params.set('tipo', filtroTipo)
      if (filtroFrecuencia) params.set('frecuencia', filtroFrecuencia)
      if (filtroDesde) params.set('desde', filtroDesde)
      if (filtroHasta) params.set('hasta', filtroHasta)

      const res = await fetch(`/api/adelantos?${params.toString()}`)
      const data = await res.json()
      setAdelantos((data.adelantos ?? []) as Adelanto[])
    } catch (err) {
      console.error('[VistaAdelantos] error:', err)
      toast.mostrar('error', 'No se pudieron cargar los adelantos')
    } finally {
      setCargando(false)
    }
  }, [filtroMiembro, filtroEstado, filtroTipo, filtroFrecuencia, filtroDesde, filtroHasta, toast])

  // Cargar empleados una sola vez para los filtros y el reasignar.
  useEffect(() => {
    let cancelado = false
    const cargar = async () => {
      try {
        const res = await fetch('/api/nominas/empleados')
        const data = await res.json()
        if (cancelado) return
        const lista = ((data.empleados ?? []) as Array<{ miembro_id: string; nombre: string; apellido: string }>)
          .map(e => ({ miembro_id: e.miembro_id, nombre: e.nombre, apellido: e.apellido }))
        setEmpleados(lista)
      } catch {
        // sin empleados; los filtros muestran "Todos"
      }
    }
    cargar()
    return () => { cancelado = true }
  }, [])

  useEffect(() => { cargarAdelantos() }, [cargarAdelantos])

  // Mapa para mostrar nombre rápido en la tabla
  const mapaEmpleados = useMemo(
    () => new Map(empleados.map(e => [e.miembro_id, `${e.nombre} ${e.apellido}`.trim()])),
    [empleados],
  )

  // ─── Acciones ───

  const cancelar = async (a: Adelanto) => {
    if (!confirm(`¿Cancelar este ${a.tipo}? Las cuotas pendientes se anulan y no se descuentan más.`)) return
    try {
      const res = await fetch(`/api/adelantos/${a.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ estado: 'cancelado' }),
      })
      if (!res.ok) {
        const data = await res.json()
        return toast.mostrar('error', data.error || 'No se pudo cancelar')
      }
      toast.mostrar('exito', 'Adelanto cancelado')
      cargarAdelantos()
    } catch {
      toast.mostrar('error', 'Error de red')
    }
  }

  // ─── Estadísticas del listado ───
  const stats = useMemo(() => {
    const activos = adelantos.filter(a => a.estado === 'activo')
    const totalPendiente = activos.reduce((s, a) => s + Number(a.saldo_pendiente), 0)
    return {
      total: adelantos.length,
      activos: activos.length,
      totalPendiente,
    }
  }, [adelantos])

  return (
    <div className="px-4 md:px-6 py-4 space-y-4">
      {/* Header con totales + CTA */}
      <div className="flex flex-wrap items-center gap-3 justify-between">
        <div className="space-y-0.5">
          <h2 className="text-base font-semibold text-texto-primario">Adelantos y descuentos</h2>
          <p className="text-xs text-texto-terciario">
            {stats.activos} activo{stats.activos === 1 ? '' : 's'} · saldo pendiente total {moneda(stats.totalPendiente)}
          </p>
        </div>
        {puedeEditar && (
          <Boton
            icono={<Plus size={14} />}
            onClick={() => { setEditando(null); setEditorAbierto(true) }}
          >
            Nuevo adelanto
          </Boton>
        )}
      </div>

      {/* Filtros compactos */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-2.5 items-end">
        <Select
          etiqueta="Empleado"
          valor={filtroMiembro}
          opciones={[
            { valor: '', etiqueta: 'Todos' },
            ...empleados.map(e => ({ valor: e.miembro_id, etiqueta: `${e.nombre} ${e.apellido}`.trim() })),
          ]}
          onChange={setFiltroMiembro}
        />
        <Select
          etiqueta="Estado"
          valor={filtroEstado}
          opciones={[
            { valor: '', etiqueta: 'Todos' },
            { valor: 'activo', etiqueta: 'Activo' },
            { valor: 'pagado', etiqueta: 'Pagado' },
            { valor: 'cancelado', etiqueta: 'Cancelado' },
          ]}
          onChange={v => setFiltroEstado(v as typeof filtroEstado)}
        />
        <Select
          etiqueta="Tipo"
          valor={filtroTipo}
          opciones={[
            { valor: '', etiqueta: 'Todos' },
            { valor: 'adelanto', etiqueta: 'Adelanto' },
            { valor: 'descuento', etiqueta: 'Descuento' },
          ]}
          onChange={v => setFiltroTipo(v as typeof filtroTipo)}
        />
        <Select
          etiqueta="Frecuencia"
          valor={filtroFrecuencia}
          opciones={[
            { valor: '', etiqueta: 'Todas' },
            { valor: 'semanal', etiqueta: 'Semanal' },
            { valor: 'quincenal', etiqueta: 'Quincenal' },
            { valor: 'mensual', etiqueta: 'Mensual' },
          ]}
          onChange={setFiltroFrecuencia}
        />
        <SelectorFecha etiqueta="Desde" valor={filtroDesde} onChange={(v) => setFiltroDesde(v || '')} />
        <SelectorFecha etiqueta="Hasta" valor={filtroHasta} onChange={(v) => setFiltroHasta(v || '')} />
      </div>

      {/* Listado */}
      {cargando ? (
        <div className="flex items-center justify-center py-16 text-texto-terciario">
          <Loader2 size={20} className="animate-spin" />
        </div>
      ) : adelantos.length === 0 ? (
        <EstadoVacio
          icono={<Wallet size={48} strokeWidth={1.5} />}
          titulo="No hay adelantos que coincidan"
          descripcion={puedeEditar
            ? 'Cargá el primer adelanto o descuento — se va a descontar automáticamente en los próximos recibos.'
            : 'No hay adelantos cargados para los filtros actuales.'}
          accion={puedeEditar ? (
            <Boton icono={<Plus size={14} />} onClick={() => { setEditando(null); setEditorAbierto(true) }}>
              Nuevo adelanto
            </Boton>
          ) : undefined}
        />
      ) : (
        <div className="rounded-card border border-borde-sutil overflow-hidden">
          <div className="grid grid-cols-[20px_1fr_90px_100px_120px_110px_120px_100px] gap-3 px-3 py-2.5 bg-superficie-elevada/50 border-b border-borde-sutil text-[11px] font-medium text-texto-terciario uppercase tracking-wider">
            <div></div>
            <div>Empleado</div>
            <div>Tipo</div>
            <div className="text-right">Monto total</div>
            <div className="text-right">Saldo</div>
            <div>Estado</div>
            <div>Frecuencia</div>
            <div className="text-right">Acciones</div>
          </div>

          {adelantos.map(a => {
            const nombre = mapaEmpleados.get(a.miembro_id) ?? '—'
            const expandido = detalleId === a.id
            const colorEstado = a.estado === 'activo' ? 'info' : a.estado === 'pagado' ? 'exito' : 'neutro'
            return (
              <div key={a.id} className="border-b border-borde-sutil last:border-b-0">
                <div className="grid grid-cols-[20px_1fr_90px_100px_120px_110px_120px_100px] gap-3 items-center px-3 py-3 hover:bg-superficie-elevada/30 transition-colors">
                  <button
                    type="button"
                    onClick={() => setDetalleId(expandido ? null : a.id)}
                    className="text-texto-terciario hover:text-texto-primario"
                    aria-label={expandido ? 'Colapsar' : 'Expandir'}
                  >
                    {expandido ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                  </button>
                  <div className="min-w-0">
                    <p className="text-sm text-texto-primario truncate">{nombre}</p>
                    {a.notas && <p className="text-[11px] text-texto-terciario truncate">{a.notas}</p>}
                  </div>
                  <div>
                    <Insignia color={a.tipo === 'adelanto' ? 'info' : 'peligro'}>
                      {a.tipo === 'adelanto' ? 'Adelanto' : 'Descuento'}
                    </Insignia>
                  </div>
                  <div className="text-right text-sm tabular-nums text-texto-primario">{moneda(Number(a.monto_total))}</div>
                  <div className="text-right text-sm tabular-nums text-texto-secundario">
                    {moneda(Number(a.saldo_pendiente))}
                    <div className="text-[10px] text-texto-terciario">{a.cuotas_descontadas}/{a.cuotas_totales} cuotas</div>
                  </div>
                  <div>
                    <Insignia color={colorEstado}>
                      {a.estado === 'activo' ? 'Activo' : a.estado === 'pagado' ? 'Pagado' : 'Cancelado'}
                    </Insignia>
                  </div>
                  <div className="text-xs text-texto-secundario capitalize">{a.frecuencia_descuento}</div>
                  <div className="flex items-center justify-end gap-0.5">
                    {puedeEditar && a.estado === 'activo' && (
                      <>
                        <button
                          type="button"
                          title="Reasignar a otro empleado"
                          className="p-1.5 rounded hover:bg-superficie-elevada text-texto-terciario hover:text-texto-primario disabled:opacity-40 disabled:cursor-not-allowed"
                          onClick={() => setReasignando(a)}
                          disabled={a.cuotas_descontadas > 0}
                        >
                          <ArrowRightLeft size={13} />
                        </button>
                        <button
                          type="button"
                          title="Editar"
                          className="p-1.5 rounded hover:bg-superficie-elevada text-texto-terciario hover:text-texto-primario"
                          onClick={() => { setEditando(a); setEditorAbierto(true) }}
                        >
                          <Pencil size={13} />
                        </button>
                        <button
                          type="button"
                          title="Cancelar"
                          className="p-1.5 rounded hover:bg-superficie-elevada text-texto-terciario hover:text-insignia-peligro"
                          onClick={() => cancelar(a)}
                        >
                          <Trash2 size={13} />
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {/* Detalle expandido: lista de cuotas */}
                {expandido && (
                  <div className="px-3 py-3 bg-superficie-elevada/20 border-t border-borde-sutil">
                    <div className="text-[11px] text-texto-terciario uppercase tracking-wider mb-2">Cuotas</div>
                    <div className="grid grid-cols-[60px_1fr_120px_140px_100px] gap-3 text-xs text-texto-terciario pb-1">
                      <div>#</div>
                      <div>Programada</div>
                      <div className="text-right">Monto</div>
                      <div>Descontada</div>
                      <div>Estado</div>
                    </div>
                    {a.cuotas.map(c => (
                      <div key={c.id} className="grid grid-cols-[60px_1fr_120px_140px_100px] gap-3 items-center py-1.5 border-t border-borde-sutil/50 text-xs">
                        <div className="text-texto-secundario">{c.numero_cuota}</div>
                        <div className="text-texto-secundario">{c.fecha_programada}</div>
                        <div className="text-right tabular-nums text-texto-primario">{moneda(Number(c.monto_cuota))}</div>
                        <div className="text-texto-terciario">{c.fecha_descontada ?? '—'}</div>
                        <div>
                          <Insignia color={c.estado === 'descontada' ? 'exito' : c.estado === 'cancelada' ? 'neutro' : 'info'}>
                            {c.estado === 'descontada' ? 'Descontada' : c.estado === 'cancelada' ? 'Cancelada' : 'Pendiente'}
                          </Insignia>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Modal crear/editar */}
      <ModalCrearEditarAdelanto
        abierto={editorAbierto}
        adelanto={editando}
        empleados={empleados}
        onCerrar={() => { setEditorAbierto(false); setEditando(null) }}
        onGuardado={() => { setEditorAbierto(false); setEditando(null); cargarAdelantos() }}
      />

      {/* Modal reasignar */}
      <ModalReasignar
        adelanto={reasignando}
        empleados={empleados}
        onCerrar={() => setReasignando(null)}
        onListo={() => { setReasignando(null); cargarAdelantos() }}
      />
    </div>
  )
}

// ════════════════════════════════════════════════════════════════
// Modal crear / editar
// ════════════════════════════════════════════════════════════════

function ModalCrearEditarAdelanto({
  abierto, adelanto, empleados, onCerrar, onGuardado,
}: {
  abierto: boolean
  adelanto: Adelanto | null
  empleados: EmpleadoMini[]
  onCerrar: () => void
  onGuardado: () => void
}) {
  const toast = useToast()
  const esEdicion = !!adelanto

  // Defaults para "hoy".
  const hoyIso = () => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  }

  const [miembroId, setMiembroId] = useState('')
  const [tipo, setTipo] = useState<'adelanto' | 'descuento'>('adelanto')
  const [monto, setMonto] = useState('0')
  const [cuotas, setCuotas] = useState('1')
  const [frecuencia, setFrecuencia] = useState<'semanal' | 'quincenal' | 'mensual'>('mensual')
  const [fecha, setFecha] = useState(hoyIso())
  const [notas, setNotas] = useState('')
  const [guardando, setGuardando] = useState(false)

  // Prefill al abrir.
  useEffect(() => {
    if (!abierto) return
    if (adelanto) {
      setMiembroId(adelanto.miembro_id)
      setTipo(adelanto.tipo)
      setMonto(String(adelanto.monto_total))
      setCuotas(String(adelanto.cuotas_totales))
      setFrecuencia(adelanto.frecuencia_descuento)
      setFecha(adelanto.fecha_inicio_descuento)
      setNotas(adelanto.notas ?? '')
    } else {
      setMiembroId('')
      setTipo('adelanto')
      setMonto('0')
      setCuotas('1')
      setFrecuencia('mensual')
      setFecha(hoyIso())
      setNotas('')
    }
  }, [abierto, adelanto])

  const guardar = async () => {
    const montoNum = Number(monto)
    const cuotasNum = Number(cuotas)
    if (!miembroId) return toast.mostrar('error', 'Seleccioná un empleado')
    if (!Number.isFinite(montoNum) || montoNum <= 0) return toast.mostrar('error', 'Monto inválido')
    if (!Number.isFinite(cuotasNum) || cuotasNum < 1) return toast.mostrar('error', 'Cantidad de cuotas inválida')
    setGuardando(true)
    try {
      if (esEdicion && adelanto) {
        const res = await fetch(`/api/adelantos/${adelanto.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            monto_total: montoNum,
            cuotas_totales: cuotasNum,
            notas: notas || null,
          }),
        })
        if (!res.ok) {
          const data = await res.json()
          return toast.mostrar('error', data.error || 'No se pudo guardar')
        }
        toast.mostrar('exito', 'Adelanto actualizado')
      } else {
        const res = await fetch('/api/adelantos', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            miembro_id: miembroId,
            tipo,
            monto_total: montoNum,
            cuotas_totales: cuotasNum,
            frecuencia_descuento: frecuencia,
            fecha_solicitud: fecha,
            fecha_inicio_descuento: fecha,
            notas: notas || null,
          }),
        })
        if (!res.ok) {
          const data = await res.json()
          return toast.mostrar('error', data.error || 'No se pudo crear')
        }
        toast.mostrar('exito', 'Adelanto creado')
      }
      onGuardado()
    } catch {
      toast.mostrar('error', 'Error de red')
    } finally {
      setGuardando(false)
    }
  }

  return (
    <Modal
      abierto={abierto}
      onCerrar={onCerrar}
      titulo={esEdicion ? 'Editar adelanto' : 'Nuevo adelanto / descuento'}
      tamano="md"
      accionPrimaria={{ etiqueta: 'Guardar', onClick: guardar, cargando: guardando }}
      accionSecundaria={{ etiqueta: 'Cancelar', onClick: onCerrar }}
    >
      <div className="space-y-3">
        <Select
          etiqueta="Empleado"
          valor={miembroId}
          opciones={[
            { valor: '', etiqueta: 'Seleccionar empleado' },
            ...empleados.map(e => ({ valor: e.miembro_id, etiqueta: `${e.nombre} ${e.apellido}`.trim() })),
          ]}
          onChange={setMiembroId}
          // El empleado no se puede cambiar al editar — para mover usar "Reasignar".
          // (El Select acepta deshabilitarlo cambiando opciones a 1.)
        />
        {!esEdicion && (
          <Select
            etiqueta="Tipo"
            valor={tipo}
            opciones={[
              { valor: 'adelanto', etiqueta: 'Adelanto (le diste plata)' },
              { valor: 'descuento', etiqueta: 'Descuento (le sacás plata)' },
            ]}
            onChange={(v) => setTipo(v as 'adelanto' | 'descuento')}
          />
        )}
        <div className="grid grid-cols-2 gap-3">
          <InputMoneda etiqueta="Monto total" value={monto} onChange={setMonto} />
          <Input etiqueta="Cuotas" value={cuotas} onChange={e => setCuotas(e.target.value)} />
        </div>
        {!esEdicion && (
          <div className="grid grid-cols-2 gap-3">
            <Select
              etiqueta="Frecuencia"
              valor={frecuencia}
              opciones={[
                { valor: 'semanal', etiqueta: 'Semanal' },
                { valor: 'quincenal', etiqueta: 'Quincenal' },
                { valor: 'mensual', etiqueta: 'Mensual' },
              ]}
              onChange={(v) => setFrecuencia(v as 'semanal' | 'quincenal' | 'mensual')}
            />
            <SelectorFecha
              etiqueta="Fecha de inicio"
              valor={fecha}
              onChange={(v) => setFecha(v || hoyIso())}
            />
          </div>
        )}
        <div>
          <label className="block text-sm text-texto-secundario mb-1.5">Notas</label>
          <textarea
            value={notas}
            onChange={e => setNotas(e.target.value)}
            rows={2}
            className="w-full rounded-md bg-superficie-tarjeta border border-borde-sutil px-3 py-2 text-sm text-texto-primario placeholder:text-texto-terciario focus:outline-none focus:border-texto-marca/50 resize-none"
            placeholder="Detalles del adelanto / descuento"
          />
        </div>
      </div>
    </Modal>
  )
}

// ════════════════════════════════════════════════════════════════
// Modal reasignar
// ════════════════════════════════════════════════════════════════

function ModalReasignar({
  adelanto, empleados, onCerrar, onListo,
}: {
  adelanto: Adelanto | null
  empleados: EmpleadoMini[]
  onCerrar: () => void
  onListo: () => void
}) {
  const toast = useToast()
  const [nuevoMiembroId, setNuevoMiembroId] = useState('')
  const [procesando, setProcesando] = useState(false)

  useEffect(() => {
    setNuevoMiembroId('')
  }, [adelanto?.id])

  if (!adelanto) return null

  const reasignar = async () => {
    if (!nuevoMiembroId) return toast.mostrar('error', 'Elegí un empleado destino')
    if (nuevoMiembroId === adelanto.miembro_id) return toast.mostrar('error', 'Es el mismo empleado')
    setProcesando(true)
    try {
      const res = await fetch(`/api/adelantos/${adelanto.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reasignar_a_miembro_id: nuevoMiembroId }),
      })
      if (!res.ok) {
        const data = await res.json()
        return toast.mostrar('error', data.error || 'No se pudo reasignar')
      }
      toast.mostrar('exito', 'Adelanto reasignado')
      onListo()
    } catch {
      toast.mostrar('error', 'Error de red')
    } finally {
      setProcesando(false)
    }
  }

  return (
    <Modal
      abierto={!!adelanto}
      onCerrar={onCerrar}
      titulo="Reasignar a otro empleado"
      tamano="md"
      accionPrimaria={{ etiqueta: 'Reasignar', onClick: reasignar, cargando: procesando }}
      accionSecundaria={{ etiqueta: 'Cancelar', onClick: onCerrar }}
    >
      <div className="space-y-3">
        <p className="text-sm text-texto-secundario">
          Mueve este adelanto + sus cuotas pendientes a otro empleado. Solo funciona si todavía no se descontaron cuotas.
        </p>
        <Select
          etiqueta="Empleado destino"
          valor={nuevoMiembroId}
          opciones={[
            { valor: '', etiqueta: 'Seleccionar empleado' },
            ...empleados
              .filter(e => e.miembro_id !== adelanto.miembro_id)
              .map(e => ({ valor: e.miembro_id, etiqueta: `${e.nombre} ${e.apellido}`.trim() })),
          ]}
          onChange={setNuevoMiembroId}
        />
      </div>
    </Modal>
  )
}
