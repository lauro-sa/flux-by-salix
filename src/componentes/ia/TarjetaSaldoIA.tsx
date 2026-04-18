'use client'

/**
 * TarjetaSaldoIA — Saldo estimado del proveedor activo.
 * Soporta dos tipos de registro:
 *   - 'carga': recarga de crédito (se suma)
 *   - 'ajuste': "mi saldo real es X" (resetea la base)
 * Permite editar y eliminar registros.
 */

import { useState, useEffect, useCallback } from 'react'
import {
  Plus, Wallet, AlertTriangle, ExternalLink, Clock,
  ChevronDown, ChevronUp, Pencil, Trash2, RefreshCw, Check, X,
} from 'lucide-react'
import { Boton } from '@/componentes/ui/Boton'
import { useEmpresa } from '@/hooks/useEmpresa'
import { formatearCosto, ENLACES_FACTURACION } from '@/lib/ia/precios'

// ==================== TIPOS ====================

interface CargaCredito {
  id: string
  proveedor: string
  tipo: string
  monto: string
  nota: string
  creado_en: string
}

interface Props {
  proveedorActivo: string
  nombreProveedor: string
  costoEstimadoMes: number
}

type ModoFormulario = null | 'carga' | 'ajuste'

const UMBRAL_ALERTA = 0.20

// ==================== COMPONENTE PRINCIPAL ====================

export function TarjetaSaldoIA({ proveedorActivo, nombreProveedor, costoEstimadoMes }: Props) {
  const { empresa } = useEmpresa()
  const [cargas, setCargas] = useState<CargaCredito[]>([])
  const [saldoBase, setSaldoBase] = useState(0)
  const [descontarConsumo, setDescontarConsumo] = useState(true)
  const [cargando, setCargando] = useState(true)
  const [modoFormulario, setModoFormulario] = useState<ModoFormulario>(null)
  const [mostrarHistorial, setMostrarHistorial] = useState(false)
  const [editandoId, setEditandoId] = useState<string | null>(null)
  const [guardando, setGuardando] = useState(false)

  // Campos del formulario
  const [montoNuevo, setMontoNuevo] = useState('')
  const [notaNueva, setNotaNueva] = useState('')
  const [fechaNueva, setFechaNueva] = useState(() => hoy())

  // Campos de edición inline
  const [editMonto, setEditMonto] = useState('')
  const [editNota, setEditNota] = useState('')
  const [editFecha, setEditFecha] = useState('')

  const cargarCreditos = useCallback(async () => {
    if (!empresa) return
    try {
      const res = await fetch(`/api/ia/credito?proveedor=${proveedorActivo}`)
      if (res.ok) {
        const datos = await res.json()
        setCargas(datos.cargas || [])
        setSaldoBase(datos.saldo_base?.[proveedorActivo] || 0)
        setDescontarConsumo(datos.descontar_consumo?.[proveedorActivo] ?? true)
      }
    } catch {
      // Silenciar
    }
    setCargando(false)
  }, [empresa, proveedorActivo])

  useEffect(() => {
    setCargando(true)
    cargarCreditos()
  }, [cargarCreditos])

  // ==================== ACCIONES ====================

  const registrar = async (tipo: 'carga' | 'ajuste') => {
    const monto = parseFloat(montoNuevo)
    if (tipo === 'carga' && (!monto || monto <= 0)) return
    if (tipo === 'ajuste' && (monto === undefined || monto < 0 || isNaN(monto))) return

    setGuardando(true)
    try {
      const res = await fetch('/api/ia/credito', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          proveedor: proveedorActivo,
          tipo,
          monto,
          nota: notaNueva.trim() || (tipo === 'ajuste' ? 'Ajuste de saldo' : ''),
          fecha: fechaNueva,
        }),
      })
      if (res.ok) {
        resetFormulario()
        await cargarCreditos()
      }
    } catch { /* */ }
    setGuardando(false)
  }

  const editar = async (id: string) => {
    const monto = parseFloat(editMonto)
    if (isNaN(monto)) return

    setGuardando(true)
    try {
      const res = await fetch('/api/ia/credito', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, monto, nota: editNota, fecha: editFecha }),
      })
      if (res.ok) {
        setEditandoId(null)
        await cargarCreditos()
      }
    } catch { /* */ }
    setGuardando(false)
  }

  const eliminar = async (id: string) => {
    setGuardando(true)
    try {
      const res = await fetch('/api/ia/credito', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      })
      if (res.ok) await cargarCreditos()
    } catch { /* */ }
    setGuardando(false)
  }

  const iniciarEdicion = (c: CargaCredito) => {
    setEditandoId(c.id)
    setEditMonto(c.monto)
    setEditNota(c.nota || '')
    setEditFecha(new Date(c.creado_en).toISOString().split('T')[0])
  }

  const resetFormulario = () => {
    setModoFormulario(null)
    setMontoNuevo('')
    setNotaNueva('')
    setFechaNueva(hoy())
  }

  // ==================== CÁLCULOS ====================

  // Si el último registro es un ajuste, el saldo ya es real (no restar consumo).
  // Si hay cargas después del ajuste, sí restar consumo estimado.
  const consumoADescontar = descontarConsumo ? costoEstimadoMes : 0
  const saldoEstimado = saldoBase - consumoADescontar
  const porcentajeUsado = saldoBase > 0 ? (consumoADescontar / saldoBase) * 100 : 0
  const saldoBajo = saldoBase > 0 && (saldoEstimado / saldoBase) < UMBRAL_ALERTA
  const enlace = ENLACES_FACTURACION[proveedorActivo]
  const tieneRegistros = cargas.length > 0

  // ==================== RENDER ====================

  if (cargando) {
    return (
      <div className="bg-superficie-tarjeta border border-borde-sutil rounded-card p-5 animate-pulse">
        <div className="h-4 w-32 bg-superficie-hover rounded mb-3" />
        <div className="h-8 w-24 bg-superficie-hover rounded mb-2" />
        <div className="h-2 w-full bg-superficie-hover rounded" />
      </div>
    )
  }

  // Sin registros — estado inicial
  if (!tieneRegistros) {
    return (
      <div className="bg-superficie-tarjeta border border-borde-sutil rounded-card p-5">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-9 h-9 rounded-card bg-superficie-hover flex items-center justify-center shrink-0">
            <Wallet size={18} className="text-texto-terciario" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-texto-primario">Saldo de {nombreProveedor}</h3>
            <p className="text-xs text-texto-terciario">Registrá tu crédito o indicá tu saldo actual para hacer seguimiento.</p>
          </div>
        </div>

        {!modoFormulario ? (
          <div className="flex gap-2">
            <Boton variante="secundario" tamano="sm" icono={<Plus size={14} />} onClick={() => setModoFormulario('carga')}>
              Registrar recarga
            </Boton>
            <Boton variante="fantasma" tamano="sm" icono={<RefreshCw size={14} />} onClick={() => setModoFormulario('ajuste')}>
              Poner saldo actual
            </Boton>
          </div>
        ) : (
          <FormularioCarga
            modo={modoFormulario}
            montoNuevo={montoNuevo}
            setMontoNuevo={setMontoNuevo}
            notaNueva={notaNueva}
            setNotaNueva={setNotaNueva}
            fechaNueva={fechaNueva}
            setFechaNueva={setFechaNueva}
            guardando={guardando}
            onGuardar={() => registrar(modoFormulario)}
            onCancelar={resetFormulario}
          />
        )}

        {enlace && <EnlaceConsola enlace={enlace} />}
      </div>
    )
  }

  // Con registros — vista completa
  return (
    <div className={`bg-superficie-tarjeta border rounded-card p-5 ${
      saldoBajo ? 'border-insignia-advertencia/40' : 'border-borde-sutil'
    }`}>
      {/* Header con saldo */}
      <div className="flex items-start justify-between mb-4">
        <div>
          <p className="text-xs text-texto-terciario mb-1">Saldo estimado · {nombreProveedor}</p>
          <p className={`text-2xl font-bold ${
            saldoBajo ? 'text-insignia-advertencia' : 'text-texto-primario'
          }`}>
            {formatearCosto(Math.max(saldoEstimado, 0))}
          </p>
        </div>
        <div className="flex gap-1.5">
          <Boton
            variante="fantasma"
            tamano="xs"
            icono={<RefreshCw size={12} />}
            titulo="Ajustar saldo actual"
            onClick={() => setModoFormulario(modoFormulario === 'ajuste' ? null : 'ajuste')}
          >
            Ajustar
          </Boton>
          <Boton
            variante="secundario"
            tamano="xs"
            icono={<Plus size={12} />}
            onClick={() => setModoFormulario(modoFormulario === 'carga' ? null : 'carga')}
          >
            Cargar
          </Boton>
        </div>
      </div>

      {/* Barra de progreso */}
      <div className="mb-3">
        <div className="h-2.5 bg-superficie-hover rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${
              saldoBajo ? 'bg-insignia-advertencia' : 'bg-texto-marca'
            }`}
            style={{ width: `${Math.min(porcentajeUsado, 100)}%` }}
          />
        </div>
        <div className="flex justify-between mt-1.5 text-xs text-texto-terciario">
          <span>{descontarConsumo ? `Consumido: ${formatearCosto(costoEstimadoMes)}` : 'Saldo ajustado manualmente'}</span>
          <span>{descontarConsumo ? `Base: ${formatearCosto(saldoBase)}` : ''}</span>
        </div>
      </div>

      {/* Alerta saldo bajo */}
      {saldoBajo && (
        <div className="flex items-center gap-2 p-2.5 rounded-card bg-insignia-advertencia/10 mb-3">
          <AlertTriangle size={14} className="text-insignia-advertencia shrink-0" />
          <p className="text-xs text-insignia-advertencia">
            Tu crédito está por agotarse.{' '}
            {enlace && (
              <a href={enlace.url} target="_blank" rel="noopener noreferrer" className="underline font-medium">
                Recargá ahora
              </a>
            )}
          </p>
        </div>
      )}

      {/* Formulario de nueva carga o ajuste */}
      {modoFormulario && (
        <div className="mb-3">
          <FormularioCarga
            modo={modoFormulario}
            montoNuevo={montoNuevo}
            setMontoNuevo={setMontoNuevo}
            notaNueva={notaNueva}
            setNotaNueva={setNotaNueva}
            fechaNueva={fechaNueva}
            setFechaNueva={setFechaNueva}
            guardando={guardando}
            onGuardar={() => registrar(modoFormulario)}
            onCancelar={resetFormulario}
          />
        </div>
      )}

      {/* Historial */}
      <button
        onClick={() => setMostrarHistorial(!mostrarHistorial)}
        className="flex items-center gap-1.5 text-xs text-texto-terciario hover:text-texto-secundario transition-colors bg-transparent border-none cursor-pointer p-0"
      >
        <Clock size={12} />
        <span>Historial ({cargas.length})</span>
        {mostrarHistorial ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
      </button>

      {mostrarHistorial && cargas.length > 0 && (
        <div className="mt-2.5 space-y-1.5">
          {cargas.map(c => (
            <div key={c.id}>
              {editandoId === c.id ? (
                // Fila en modo edición
                <div className="p-2.5 rounded-card bg-superficie-hover/80 space-y-2">
                  <div className="flex gap-2">
                    <div className="flex items-center gap-1.5 flex-1 rounded-boton border border-borde-sutil bg-superficie-tarjeta px-2 py-1.5">
                      <span className="text-xs text-texto-terciario shrink-0">US$</span>
                      <input
                        type="number"
                        value={editMonto}
                        onChange={e => setEditMonto(e.target.value)}
                        step="0.01"
                        min="0"
                        className="flex-1 bg-transparent border-none outline-none text-xs text-texto-primario font-mono [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                        autoFocus
                      />
                    </div>
                    <input
                      type="date"
                      value={editFecha}
                      onChange={e => setEditFecha(e.target.value)}
                      className="rounded-boton border border-borde-sutil bg-superficie-tarjeta px-2 py-1.5 text-xs text-texto-primario outline-none [color-scheme:dark]"
                    />
                  </div>
                  <input
                    type="text"
                    value={editNota}
                    onChange={e => setEditNota(e.target.value)}
                    placeholder="Nota"
                    className="w-full rounded-boton border border-borde-sutil bg-superficie-tarjeta px-2 py-1.5 text-xs text-texto-primario placeholder:text-texto-placeholder outline-none"
                  />
                  <div className="flex gap-1.5 justify-end">
                    <Boton variante="fantasma" tamano="xs" icono={<X size={12} />} onClick={() => setEditandoId(null)}>
                      Cancelar
                    </Boton>
                    <Boton variante="primario" tamano="xs" icono={<Check size={12} />} onClick={() => editar(c.id)} disabled={guardando}>
                      Guardar
                    </Boton>
                  </div>
                </div>
              ) : (
                // Fila normal
                <div className="flex items-center justify-between p-2 rounded-card bg-superficie-hover/50 text-xs group">
                  <div className="flex items-center gap-2 min-w-0">
                    {c.tipo === 'ajuste' && (
                      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-insignia-info/10 text-insignia-info shrink-0">
                        Ajuste
                      </span>
                    )}
                    <span className="text-texto-terciario shrink-0">
                      {new Date(c.creado_en).toLocaleDateString('es-AR', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </span>
                    {c.nota && <span className="text-texto-terciario truncate">· {c.nota}</span>}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="font-medium text-texto-primario font-mono">
                      {c.tipo === 'ajuste' ? '=' : '+'}{formatearCosto(parseFloat(c.monto))}
                    </span>
                    {/* Botones editar/eliminar — visibles en hover */}
                    <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => iniciarEdicion(c)}
                        className="p-1 rounded hover:bg-superficie-hover text-texto-terciario hover:text-texto-primario transition-colors bg-transparent border-none cursor-pointer"
                        title="Editar"
                      >
                        <Pencil size={12} />
                      </button>
                      <button
                        onClick={() => eliminar(c.id)}
                        className="p-1 rounded hover:bg-insignia-peligro/10 text-texto-terciario hover:text-insignia-peligro transition-colors bg-transparent border-none cursor-pointer"
                        title="Eliminar"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Link a consola del proveedor */}
      {enlace && <EnlaceConsola enlace={enlace} className="mt-3" />}
    </div>
  )
}

// ==================== FORMULARIO ====================

function FormularioCarga({
  modo,
  montoNuevo,
  setMontoNuevo,
  notaNueva,
  setNotaNueva,
  fechaNueva,
  setFechaNueva,
  guardando,
  onGuardar,
  onCancelar,
}: {
  modo: 'carga' | 'ajuste'
  montoNuevo: string
  setMontoNuevo: (v: string) => void
  notaNueva: string
  setNotaNueva: (v: string) => void
  fechaNueva: string
  setFechaNueva: (v: string) => void
  guardando: boolean
  onGuardar: () => void
  onCancelar: () => void
}) {
  const esAjuste = modo === 'ajuste'

  return (
    <div className="p-3 rounded-card border border-borde-sutil bg-superficie-hover/30 space-y-2.5">
      <p className="text-xs font-medium text-texto-secundario">
        {esAjuste ? 'Ajustar saldo actual' : 'Registrar recarga de crédito'}
      </p>
      {esAjuste && (
        <p className="text-[11px] text-texto-terciario -mt-1">
          Indicá cuánto crédito tenés realmente ahora. Las cargas futuras se sumarán a este valor.
        </p>
      )}
      <div className="flex gap-2">
        <div className="flex items-center gap-1.5 flex-1 rounded-card border border-borde-sutil bg-superficie-tarjeta px-3 py-2">
          <span className="text-sm text-texto-terciario shrink-0">US$</span>
          <input
            type="number"
            value={montoNuevo}
            onChange={e => setMontoNuevo(e.target.value)}
            placeholder={esAjuste ? '9.67' : '10.00'}
            step="0.01"
            min="0"
            className="flex-1 bg-transparent border-none outline-none text-sm text-texto-primario font-mono placeholder:text-texto-placeholder [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
            autoFocus
          />
        </div>
        <input
          type="date"
          value={fechaNueva}
          onChange={e => setFechaNueva(e.target.value)}
          max={hoy()}
          className="rounded-card border border-borde-sutil bg-superficie-tarjeta px-3 py-2 text-sm text-texto-primario outline-none [color-scheme:dark]"
        />
      </div>
      <input
        type="text"
        value={notaNueva}
        onChange={e => setNotaNueva(e.target.value)}
        placeholder="Nota (opcional)"
        className="w-full rounded-card border border-borde-sutil bg-superficie-tarjeta px-3 py-2 text-sm text-texto-primario placeholder:text-texto-placeholder outline-none"
      />
      <div className="flex gap-2 justify-end">
        <Boton variante="fantasma" tamano="xs" onClick={onCancelar}>
          Cancelar
        </Boton>
        <Boton
          variante="primario"
          tamano="xs"
          onClick={onGuardar}
          disabled={guardando || !montoNuevo || (modo === 'carga' && parseFloat(montoNuevo) <= 0)}
        >
          {guardando ? 'Guardando...' : esAjuste ? 'Ajustar saldo' : 'Registrar'}
        </Boton>
      </div>
    </div>
  )
}

// ==================== ENLACE CONSOLA ====================

function EnlaceConsola({ enlace, className = '' }: { enlace: { url: string; etiqueta: string }; className?: string }) {
  return (
    <a
      href={enlace.url}
      target="_blank"
      rel="noopener noreferrer"
      className={`inline-flex items-center gap-1.5 text-xs text-texto-marca hover:underline no-underline ${className}`}
    >
      <ExternalLink size={12} />
      Ver saldo real en {enlace.etiqueta}
    </a>
  )
}

// ==================== UTILIDADES ====================

function hoy() {
  return new Date().toISOString().split('T')[0]
}
