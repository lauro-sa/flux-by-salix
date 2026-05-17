'use client'

/**
 * Tab "Adelantos" de la ficha del empleado.
 *
 * Reemplaza el `EstadoVacio` "en construcción" que estaba ahí. Lista
 * todos los adelantos / bonos / descuentos one-off del miembro (tabla
 * `adelantos_nomina`), con CRUD básico:
 *
 *   • Listado con filtros (Activos / Pagados / Cancelados / Todos).
 *   • Crear un movimiento nuevo (mismo form que el del editor de
 *     liquidación: tipo + monto + cuotas + fecha + motivo).
 *   • Cancelar un adelanto activo (no toca las cuotas ya descontadas).
 *
 * Para el día a día, el operador típicamente carga los adelantos
 * desde el editor de la liquidación (donde aparecen en "Ajustes del
 * período"). Esta tab es para ver el HISTORIAL completo del empleado
 * y crear adelantos sueltos sin contexto de un período específico.
 */

import { useEffect, useMemo, useState } from 'react'
import {
  Wallet, Plus, X as IconX, TrendingDown, TrendingUp, Loader2, Banknote, Ban,
} from 'lucide-react'
import { Boton } from '@/componentes/ui/Boton'
import { Input } from '@/componentes/ui/Input'
import { InputMoneda } from '@/componentes/ui/InputMoneda'
import { SelectorFecha } from '@/componentes/ui/SelectorFecha'
import { Insignia } from '@/componentes/ui/Insignia'
import { EstadoVacio } from '@/componentes/feedback/EstadoVacio'
import { useToast } from '@/componentes/feedback/Toast'
import { ModalConfirmacion } from '@/componentes/ui/ModalConfirmacion'

interface Props {
  miembroId: string
  puedeEditar: boolean
}

type TipoMovimiento = 'adelanto' | 'descuento' | 'bono'
type EstadoMovimiento = 'pendiente' | 'activo' | 'pagado' | 'cancelado'

interface AdelantoUI {
  id: string
  tipo: TipoMovimiento
  monto_total: number
  cuotas_totales: number
  cuotas_descontadas: number
  saldo_pendiente: number
  fecha_solicitud: string
  notas: string | null
  estado: EstadoMovimiento
  creado_por_nombre: string | null
  creado_en: string
}

type FiltroVista = 'activos' | 'pagados' | 'cancelados' | 'todos'

function fmtMonto(v: number): string {
  return `$ ${v.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`
}

function fmtFecha(iso: string): string {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number)
  if (!y || !m || !d) return iso
  const dt = new Date(y, m - 1, d)
  return dt.toLocaleDateString('es-AR', { day: 'numeric', month: 'short', year: 'numeric' })
}

export function SeccionAdelantosEmpleado({ miembroId, puedeEditar }: Props) {
  const toast = useToast()
  const [primeraCarga, setPrimeraCarga] = useState(true)
  const [adelantos, setAdelantos] = useState<AdelantoUI[]>([])
  const [filtro, setFiltro] = useState<FiltroVista>('activos')
  const [mostrarForm, setMostrarForm] = useState(false)
  const [confirmacionCancelar, setConfirmacionCancelar] = useState<AdelantoUI | null>(null)

  // ─── Form crear movimiento ───
  const [tipo, setTipo] = useState<TipoMovimiento>('adelanto')
  const [monto, setMonto] = useState('')
  const [cuotas, setCuotas] = useState('1')
  const [fechaSolicitud, setFechaSolicitud] = useState(() => new Date().toISOString().slice(0, 10))
  const [notas, setNotas] = useState('')
  const [creando, setCreando] = useState(false)
  const [cancelando, setCancelando] = useState(false)

  const cargar = async () => {
    try {
      const res = await fetch(`/api/adelantos?miembro_id=${miembroId}`)
      const data = await res.json()
      if (!res.ok) {
        toast.mostrar('error', data.error || 'No se pudieron cargar los adelantos')
        return
      }
      setAdelantos(((data.adelantos ?? []) as Array<Record<string, unknown>>).map(a => ({
        id: a.id as string,
        tipo: ((a.tipo as string) || 'adelanto') as TipoMovimiento,
        monto_total: Number(a.monto_total),
        cuotas_totales: Number(a.cuotas_totales),
        cuotas_descontadas: Number(a.cuotas_descontadas ?? 0),
        saldo_pendiente: Number(a.saldo_pendiente ?? 0),
        fecha_solicitud: (a.fecha_solicitud as string) ?? (a.creado_en as string).slice(0, 10),
        notas: (a.notas as string | null) ?? null,
        estado: (a.estado as EstadoMovimiento) || 'activo',
        creado_por_nombre: (a.creado_por_nombre as string | null) ?? null,
        creado_en: a.creado_en as string,
      })))
    } catch (err) {
      console.error('[SeccionAdelantosEmpleado] error:', err)
      toast.mostrar('error', 'Error de red')
    } finally {
      setPrimeraCarga(false)
    }
  }

  useEffect(() => {
    cargar()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [miembroId])

  const visibles = useMemo(() => {
    if (filtro === 'todos') return adelantos
    if (filtro === 'activos') return adelantos.filter(a => a.estado === 'activo' || a.estado === 'pendiente')
    if (filtro === 'pagados') return adelantos.filter(a => a.estado === 'pagado')
    return adelantos.filter(a => a.estado === 'cancelado')
  }, [adelantos, filtro])

  const conteoActivos = adelantos.filter(a => a.estado === 'activo' || a.estado === 'pendiente').length
  const conteoPagados = adelantos.filter(a => a.estado === 'pagado').length
  const conteoCancelados = adelantos.filter(a => a.estado === 'cancelado').length

  // Totales agregados (solo de los visibles del filtro 'activos').
  const totalAdeudado = adelantos
    .filter(a => (a.estado === 'activo' || a.estado === 'pendiente') && a.tipo === 'adelanto')
    .reduce((s, a) => s + a.saldo_pendiente, 0)

  // ─── Crear ───
  const resetForm = () => {
    setTipo('adelanto')
    setMonto('')
    setCuotas('1')
    setFechaSolicitud(new Date().toISOString().slice(0, 10))
    setNotas('')
  }

  const crear = async () => {
    const montoNum = parseFloat(monto)
    if (!Number.isFinite(montoNum) || montoNum <= 0) {
      toast.mostrar('advertencia', 'Ingresá un monto válido')
      return
    }
    setCreando(true)
    try {
      const res = await fetch('/api/adelantos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          miembro_id: miembroId,
          tipo,
          monto_total: montoNum,
          // Los bonos y descuentos siempre son one-off.
          cuotas_totales: tipo === 'adelanto' ? Math.max(1, parseInt(cuotas) || 1) : 1,
          fecha_solicitud: fechaSolicitud,
          notas: notas.trim() || null,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.mostrar('error', data.error || 'No se pudo crear el movimiento')
        return
      }
      toast.mostrar('exito', tipo === 'bono' ? 'Bono registrado' : tipo === 'descuento' ? 'Descuento registrado' : 'Adelanto registrado')
      resetForm()
      setMostrarForm(false)
      await cargar()
    } finally {
      setCreando(false)
    }
  }

  // ─── Cancelar ───
  const cancelar = async () => {
    if (!confirmacionCancelar) return
    setCancelando(true)
    try {
      const res = await fetch(`/api/adelantos/${confirmacionCancelar.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ estado: 'cancelado' }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast.mostrar('error', data.error || 'No se pudo cancelar')
        return
      }
      toast.mostrar('exito', 'Movimiento cancelado')
      setConfirmacionCancelar(null)
      await cargar()
    } finally {
      setCancelando(false)
    }
  }

  // ─── Render ───
  if (primeraCarga) {
    return (
      <div className="flex items-center justify-center py-16 text-texto-terciario">
        <Loader2 size={20} className="animate-spin" />
      </div>
    )
  }

  return (
    <div className="px-4 md:px-6 py-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-lg font-semibold text-texto-primario">Adelantos y movimientos</h2>
          <p className="text-xs text-texto-terciario mt-0.5">
            Historial completo del empleado: adelantos, bonos extra y descuentos puntuales.
          </p>
        </div>
        {puedeEditar && !mostrarForm && (
          <Boton tamano="sm" icono={<Plus size={14} />} onClick={() => setMostrarForm(true)}>
            Nuevo movimiento
          </Boton>
        )}
      </div>

      {/* Resumen */}
      {totalAdeudado > 0 && (
        <div className="rounded-card border border-insignia-advertencia/30 bg-insignia-advertencia/5 px-4 py-3 flex items-start gap-3">
          <Wallet size={16} className="text-insignia-advertencia shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-insignia-advertencia">
              Adeuda {fmtMonto(totalAdeudado)} en adelantos pendientes
            </p>
            <p className="text-[11px] text-texto-terciario mt-0.5">
              Se descuenta automáticamente en las próximas liquidaciones según las cuotas.
            </p>
          </div>
        </div>
      )}

      {/* Form crear */}
      {mostrarForm && (
        <FormularioNuevoMovimiento
          tipo={tipo}
          setTipo={setTipo}
          monto={monto}
          setMonto={setMonto}
          cuotas={cuotas}
          setCuotas={setCuotas}
          fechaSolicitud={fechaSolicitud}
          setFechaSolicitud={setFechaSolicitud}
          notas={notas}
          setNotas={setNotas}
          creando={creando}
          onCancelar={() => { setMostrarForm(false); resetForm() }}
          onCrear={crear}
        />
      )}

      {/* Filtros */}
      <div className="flex items-center gap-1.5 flex-wrap">
        <FiltroPill activo={filtro === 'activos'} onClick={() => setFiltro('activos')}>
          Activos ({conteoActivos})
        </FiltroPill>
        <FiltroPill activo={filtro === 'pagados'} onClick={() => setFiltro('pagados')}>
          Pagados ({conteoPagados})
        </FiltroPill>
        <FiltroPill activo={filtro === 'cancelados'} onClick={() => setFiltro('cancelados')}>
          Cancelados ({conteoCancelados})
        </FiltroPill>
        <FiltroPill activo={filtro === 'todos'} onClick={() => setFiltro('todos')}>
          Todos ({adelantos.length})
        </FiltroPill>
      </div>

      {/* Listado */}
      {visibles.length === 0 ? (
        <EstadoVacio
          icono={<Wallet size={40} strokeWidth={1.5} />}
          titulo={
            filtro === 'activos' ? 'Sin movimientos activos'
            : filtro === 'pagados' ? 'Sin movimientos pagados'
            : filtro === 'cancelados' ? 'Sin movimientos cancelados'
            : 'Sin movimientos cargados'
          }
          descripcion={
            filtro === 'activos'
              ? 'Cuando registres un adelanto, bono o descuento aparecerá acá.'
              : 'No hay registros que coincidan con este filtro.'
          }
          accion={puedeEditar && filtro === 'activos' ? (
            <Boton tamano="sm" icono={<Plus size={14} />} onClick={() => setMostrarForm(true)}>
              Registrar movimiento
            </Boton>
          ) : undefined}
        />
      ) : (
        <div className="space-y-2">
          {visibles.map(a => (
            <FilaMovimiento
              key={a.id}
              adelanto={a}
              puedeEditar={puedeEditar}
              onCancelar={() => setConfirmacionCancelar(a)}
            />
          ))}
        </div>
      )}

      {/* Confirmación cancelar */}
      <ModalConfirmacion
        abierto={!!confirmacionCancelar}
        onCerrar={() => setConfirmacionCancelar(null)}
        onConfirmar={cancelar}
        titulo="Cancelar movimiento"
        descripcion={
          confirmacionCancelar
            ? `Vas a cancelar el ${confirmacionCancelar.tipo} de ${fmtMonto(confirmacionCancelar.monto_total)}. Las cuotas ya descontadas en pagos anteriores se mantienen — solo dejan de aplicarse las pendientes.`
            : undefined
        }
        tipo="peligro"
        etiquetaConfirmar="Cancelar"
        cargando={cancelando}
      />
    </div>
  )
}

// ════════════════════════════════════════════════════════════════
// Sub-componentes
// ════════════════════════════════════════════════════════════════

function FiltroPill({
  activo, onClick, children,
}: { activo: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
        activo
          ? 'bg-texto-marca/15 border-texto-marca/40 text-texto-marca'
          : 'border-borde-sutil text-texto-terciario hover:text-texto-primario'
      }`}
    >
      {children}
    </button>
  )
}

function FilaMovimiento({
  adelanto, puedeEditar, onCancelar,
}: {
  adelanto: AdelantoUI
  puedeEditar: boolean
  onCancelar: () => void
}) {
  const esBono = adelanto.tipo === 'bono'
  const esDescuento = adelanto.tipo === 'descuento'
  const esAdelanto = adelanto.tipo === 'adelanto'

  const icono = esBono ? <TrendingUp size={16} className="text-insignia-exito" />
    : esDescuento ? <TrendingDown size={16} className="text-insignia-peligro" />
    : <Banknote size={16} className="text-insignia-advertencia" />

  const tituloTipo = esBono ? 'Bono' : esDescuento ? 'Descuento' : 'Adelanto'

  const colorEstado = adelanto.estado === 'pagado' ? 'exito'
    : adelanto.estado === 'cancelado' ? 'neutro'
    : adelanto.estado === 'activo' ? 'advertencia'
    : 'info'

  const etiquetaEstado = adelanto.estado === 'pagado' ? 'Pagado'
    : adelanto.estado === 'cancelado' ? 'Cancelado'
    : adelanto.estado === 'activo' ? 'Activo'
    : 'Pendiente'

  return (
    <article className={`rounded-card border border-borde-sutil bg-superficie-tarjeta px-4 py-3 ${
      adelanto.estado === 'cancelado' ? 'opacity-60' : ''
    }`}>
      <div className="flex items-start gap-3">
        <div className={`shrink-0 size-9 rounded-lg flex items-center justify-center ${
          esBono ? 'bg-insignia-exito/10' : esDescuento ? 'bg-insignia-peligro/10' : 'bg-insignia-advertencia/10'
        }`}>
          {icono}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm text-texto-primario font-medium">{tituloTipo}</span>
            <Insignia color={colorEstado} tamano="sm">{etiquetaEstado}</Insignia>
            {esAdelanto && adelanto.cuotas_totales > 1 && (
              <span className="text-[11px] text-texto-terciario">
                Cuota {adelanto.cuotas_descontadas} de {adelanto.cuotas_totales}
              </span>
            )}
          </div>
          {adelanto.notas && (
            <p className="text-xs text-texto-secundario mt-0.5 truncate">{adelanto.notas}</p>
          )}
          <p className="text-[11px] text-texto-terciario mt-0.5">
            {fmtFecha(adelanto.fecha_solicitud)}
            {adelanto.creado_por_nombre && ` · ${adelanto.creado_por_nombre}`}
          </p>
        </div>
        <div className="shrink-0 text-right">
          <p className={`text-sm font-semibold tabular-nums ${
            esBono ? 'text-insignia-exito' : 'text-texto-primario'
          }`}>
            {esBono ? '+' : esDescuento ? '−' : ''}{fmtMonto(adelanto.monto_total)}
          </p>
          {esAdelanto && adelanto.saldo_pendiente > 0 && (
            <p className="text-[11px] text-texto-terciario mt-0.5">
              Saldo: {fmtMonto(adelanto.saldo_pendiente)}
            </p>
          )}
          {puedeEditar && (adelanto.estado === 'activo' || adelanto.estado === 'pendiente') && (
            <button
              type="button"
              onClick={onCancelar}
              className="mt-1 text-[11px] text-texto-terciario hover:text-insignia-peligro inline-flex items-center gap-1"
              title="Cancelar movimiento"
            >
              <Ban size={11} /> Cancelar
            </button>
          )}
        </div>
      </div>
    </article>
  )
}

function FormularioNuevoMovimiento({
  tipo, setTipo, monto, setMonto, cuotas, setCuotas, fechaSolicitud, setFechaSolicitud,
  notas, setNotas, creando, onCancelar, onCrear,
}: {
  tipo: TipoMovimiento
  setTipo: (t: TipoMovimiento) => void
  monto: string
  setMonto: (v: string) => void
  cuotas: string
  setCuotas: (v: string) => void
  fechaSolicitud: string
  setFechaSolicitud: (v: string) => void
  notas: string
  setNotas: (v: string) => void
  creando: boolean
  onCancelar: () => void
  onCrear: () => void
}) {
  return (
    <div className="rounded-card border border-borde-sutil bg-superficie-tarjeta p-4 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-medium uppercase tracking-wider text-texto-terciario">
          Nuevo movimiento
        </p>
        <button
          type="button"
          onClick={onCancelar}
          className="text-texto-terciario hover:text-texto-primario p-0.5"
          aria-label="Cerrar"
        >
          <IconX size={14} />
        </button>
      </div>

      {/* Tipo */}
      <div className="grid grid-cols-3 gap-1 p-0.5 rounded-card bg-superficie-elevada border border-borde-sutil">
        <TipoToggle activo={tipo === 'adelanto'} color="advertencia" onClick={() => setTipo('adelanto')}>
          Adelanto
        </TipoToggle>
        <TipoToggle activo={tipo === 'descuento'} color="peligro" onClick={() => setTipo('descuento')}>
          Descuento
        </TipoToggle>
        <TipoToggle activo={tipo === 'bono'} color="exito" onClick={() => setTipo('bono')}>
          Bono
        </TipoToggle>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <InputMoneda value={monto} onChange={setMonto} moneda="ARS" placeholder="Monto" />
        <SelectorFecha
          valor={fechaSolicitud}
          onChange={v => setFechaSolicitud(v || new Date().toISOString().slice(0, 10))}
          limpiable={false}
        />
      </div>

      {tipo === 'adelanto' && (
        <div>
          <label className="block text-xs text-texto-secundario mb-1">Cuotas</label>
          <select
            value={cuotas}
            onChange={e => setCuotas(e.target.value)}
            className="w-full text-sm bg-superficie-elevada border border-borde-sutil rounded-card px-2 py-1.5 text-texto-primario"
          >
            {Array.from({ length: 12 }, (_, i) => i + 1).map(n => (
              <option key={n} value={n}>{n} cuota{n !== 1 ? 's' : ''}</option>
            ))}
          </select>
        </div>
      )}

      <Input
        tipo="text"
        value={notas}
        onChange={e => setNotas(e.target.value)}
        placeholder={
          tipo === 'adelanto' ? 'Motivo del adelanto (opcional)'
          : tipo === 'bono' ? 'Motivo del bono (ej: sobreesfuerzo)'
          : 'Motivo del descuento (ej: rotura herramienta)'
        }
      />

      <div className="flex justify-end gap-2 pt-1">
        <Boton variante="fantasma" tamano="sm" onClick={onCancelar} disabled={creando}>
          Cancelar
        </Boton>
        <Boton tamano="sm" onClick={onCrear} cargando={creando}
          disabled={!monto || parseFloat(monto) <= 0}>
          Registrar
        </Boton>
      </div>
    </div>
  )
}

function TipoToggle({
  activo, color, onClick, children,
}: {
  activo: boolean
  color: 'advertencia' | 'peligro' | 'exito'
  onClick: () => void
  children: React.ReactNode
}) {
  const colorActivo =
    color === 'advertencia' ? 'bg-insignia-advertencia/15 text-insignia-advertencia'
    : color === 'peligro' ? 'bg-insignia-peligro/15 text-insignia-peligro'
    : 'bg-insignia-exito/15 text-insignia-exito'

  return (
    <button
      type="button"
      onClick={onClick}
      className={`text-xs py-1.5 rounded transition-colors font-medium ${
        activo ? colorActivo : 'text-texto-terciario hover:text-texto-secundario'
      }`}
    >
      {children}
    </button>
  )
}
