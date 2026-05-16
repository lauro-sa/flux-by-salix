'use client'

/**
 * Gestión de cuentas bancarias y digitales del empleado.
 *
 * Listado de las cuentas activas (no eliminadas) con CRUD inline:
 *   • Agregar cuenta nueva (banco o digital).
 *   • Editar etiqueta, alias, número, titular.
 *   • Activar/desactivar (controla la preselección en el pago).
 *   • Eliminar (soft-delete: no se borra de BD, los pagos históricos
 *     siguen apuntando a la fila).
 *
 * Se usa en la ficha del empleado de nómina como tab "Cuentas".
 */

import { useEffect, useState } from 'react'
import {
  Plus, Building2, Wallet, Pencil, Trash2, ToggleLeft, ToggleRight, Loader2,
  Check, User,
} from 'lucide-react'
import { ModalAdaptable as Modal } from '@/componentes/ui/ModalAdaptable'
import { ModalConfirmacion } from '@/componentes/ui/ModalConfirmacion'
import { Boton } from '@/componentes/ui/Boton'
import { Input } from '@/componentes/ui/Input'
import { EstadoVacio } from '@/componentes/feedback/EstadoVacio'
import { useToast } from '@/componentes/feedback/Toast'
import type { InfoBancaria } from '@/tipos/nominas'

interface Props {
  miembroId: string
  /**
   * Si el operador puede modificar las cuentas. Si es false, la
   * sección es read-only (el empleado viendo su propia ficha sin
   * permiso de edición, por ejemplo).
   */
  puedeEditar: boolean
}

export function SeccionDatosBancarios({ miembroId, puedeEditar }: Props) {
  const toast = useToast()
  const [cuentas, setCuentas] = useState<InfoBancaria[]>([])
  const [primeraCarga, setPrimeraCarga] = useState(true)
  const [editorAbierto, setEditorAbierto] = useState(false)
  const [cuentaEditando, setCuentaEditando] = useState<InfoBancaria | null>(null)
  const [confirmacionEliminar, setConfirmacionEliminar] = useState<InfoBancaria | null>(null)

  // ─── Carga ───
  const cargar = async () => {
    try {
      const res = await fetch(`/api/miembros/${miembroId}/info-bancaria`)
      const data = await res.json()
      if (!res.ok) {
        toast.mostrar('error', data.error || 'No se pudieron cargar las cuentas')
        return
      }
      setCuentas((data.cuentas ?? []) as InfoBancaria[])
    } catch (err) {
      console.error('[SeccionDatosBancarios] error:', err)
      toast.mostrar('error', 'Error de red al cargar cuentas')
    } finally {
      setPrimeraCarga(false)
    }
  }

  useEffect(() => {
    cargar()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [miembroId])

  // ─── Acciones ───
  const abrirNueva = () => {
    setCuentaEditando(null)
    setEditorAbierto(true)
  }

  const abrirEdicion = (c: InfoBancaria) => {
    setCuentaEditando(c)
    setEditorAbierto(true)
  }

  const toggleActiva = async (c: InfoBancaria) => {
    try {
      const res = await fetch(`/api/miembros/${miembroId}/info-bancaria/${c.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ activa: !c.activa }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.mostrar('error', data.error || 'No se pudo actualizar')
        return
      }
      await cargar()
    } catch (err) {
      console.error('[SeccionDatosBancarios] toggleActiva:', err)
      toast.mostrar('error', 'Error de red')
    }
  }

  const eliminar = async () => {
    if (!confirmacionEliminar) return
    try {
      const res = await fetch(`/api/miembros/${miembroId}/info-bancaria/${confirmacionEliminar.id}`, {
        method: 'DELETE',
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast.mostrar('error', data.error || 'No se pudo eliminar')
        return
      }
      toast.mostrar('exito', 'Cuenta eliminada')
      setConfirmacionEliminar(null)
      await cargar()
    } catch (err) {
      console.error('[SeccionDatosBancarios] eliminar:', err)
      toast.mostrar('error', 'Error de red')
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
      {/* ─── Header ─── */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-texto-primario">Cuentas para pagos</h2>
          <p className="text-xs text-texto-terciario mt-0.5">
            Bancarias y billeteras virtuales del empleado. Se usan al registrar el pago de la liquidación.
          </p>
        </div>
        {puedeEditar && (
          <Boton tamano="sm" icono={<Plus size={14} />} onClick={abrirNueva}>
            Agregar cuenta
          </Boton>
        )}
      </div>

      {/* ─── Listado ─── */}
      {cuentas.length === 0 ? (
        <EstadoVacio
          icono={<Wallet size={40} strokeWidth={1.5} />}
          titulo="Sin cuentas cargadas"
          descripcion="Cargá las cuentas bancarias o digitales del empleado para poder seleccionarlas al registrar pagos."
          accion={puedeEditar ? (
            <Boton tamano="sm" icono={<Plus size={14} />} onClick={abrirNueva}>
              Agregar primera cuenta
            </Boton>
          ) : undefined}
        />
      ) : (
        <div className="space-y-2">
          {cuentas.map(c => (
            <CuentaFila
              key={c.id}
              cuenta={c}
              puedeEditar={puedeEditar}
              onEditar={() => abrirEdicion(c)}
              onToggle={() => toggleActiva(c)}
              onEliminar={() => setConfirmacionEliminar(c)}
            />
          ))}
        </div>
      )}

      {/* ─── Modal crear/editar ─── */}
      {editorAbierto && (
        <EditorCuenta
          miembroId={miembroId}
          cuentaExistente={cuentaEditando}
          onCerrar={() => {
            setEditorAbierto(false)
            setCuentaEditando(null)
          }}
          onGuardado={async () => {
            setEditorAbierto(false)
            setCuentaEditando(null)
            await cargar()
          }}
        />
      )}

      {/* ─── Modal eliminación ─── */}
      <ModalConfirmacion
        abierto={!!confirmacionEliminar}
        onCerrar={() => setConfirmacionEliminar(null)}
        onConfirmar={eliminar}
        titulo="Eliminar cuenta"
        descripcion={
          confirmacionEliminar
            ? `Vas a eliminar "${confirmacionEliminar.etiqueta || confirmacionEliminar.banco || 'esta cuenta'}". Los pagos históricos que la usaron como destino siguen apuntándole, pero ya no aparece al registrar pagos nuevos.`
            : undefined
        }
        tipo="peligro"
        etiquetaConfirmar="Eliminar"
      />
    </div>
  )
}

// ════════════════════════════════════════════════════════════════
// Fila de cuenta
// ════════════════════════════════════════════════════════════════

function CuentaFila({
  cuenta, puedeEditar, onEditar, onToggle, onEliminar,
}: {
  cuenta: InfoBancaria
  puedeEditar: boolean
  onEditar: () => void
  onToggle: () => void
  onEliminar: () => void
}) {
  const esDigital = cuenta.tipo_pago === 'digital'
  const titulo = cuenta.etiqueta || cuenta.banco || (esDigital ? 'Billetera virtual' : 'Cuenta bancaria')

  return (
    <article className={`rounded-card border px-4 py-3 ${
      cuenta.activa
        ? 'border-borde-sutil bg-superficie-tarjeta'
        : 'border-borde-sutil bg-superficie-app/40 opacity-70'
    }`}>
      <div className="flex items-start gap-3">
        {/* Ícono según tipo */}
        <div className={`shrink-0 size-10 rounded-lg flex items-center justify-center ${
          esDigital ? 'bg-canal-whatsapp/10 text-canal-whatsapp' : 'bg-texto-marca/10 text-texto-marca'
        }`}>
          {esDigital ? <Wallet size={18} /> : <Building2 size={18} />}
        </div>

        {/* Datos principales */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm text-texto-primario font-medium truncate">{titulo}</span>
            {cuenta.banco && cuenta.etiqueta && (
              <span className="text-[10px] text-texto-terciario uppercase tracking-wider">{cuenta.banco}</span>
            )}
            {cuenta.tipo_cuenta && (
              <span className="text-[10px] text-texto-terciario uppercase tracking-wider">{cuenta.tipo_cuenta}</span>
            )}
            {!cuenta.activa && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-texto-terciario/15 text-texto-terciario uppercase tracking-wider">
                Inactiva
              </span>
            )}
          </div>
          <div className="mt-1 space-y-0.5">
            {cuenta.alias && (
              <p className="text-xs text-texto-secundario font-mono">
                <span className="text-texto-terciario uppercase tracking-wider text-[10px] mr-1.5">Alias</span>
                {cuenta.alias}
              </p>
            )}
            {cuenta.numero_cuenta && (
              <p className="text-xs text-texto-secundario font-mono">
                <span className="text-texto-terciario uppercase tracking-wider text-[10px] mr-1.5">
                  {esDigital ? 'CVU' : 'CBU'}
                </span>
                {cuenta.numero_cuenta}
              </p>
            )}
            {cuenta.titular_nombre && (
              <p className="text-xs text-texto-terciario flex items-center gap-1.5">
                <User size={11} />
                Titular: {cuenta.titular_nombre}
                {cuenta.titular_documento && <span className="text-texto-terciario/70">· {cuenta.titular_documento}</span>}
              </p>
            )}
          </div>
        </div>

        {/* Acciones */}
        {puedeEditar && (
          <div className="shrink-0 flex items-center gap-0.5">
            <button
              type="button"
              onClick={onToggle}
              title={cuenta.activa ? 'Desactivar' : 'Activar'}
              className="p-1.5 rounded text-texto-terciario hover:text-texto-primario hover:bg-superficie-elevada"
            >
              {cuenta.activa ? <ToggleRight size={16} /> : <ToggleLeft size={16} />}
            </button>
            <button
              type="button"
              onClick={onEditar}
              title="Editar"
              className="p-1.5 rounded text-texto-terciario hover:text-texto-primario hover:bg-superficie-elevada"
            >
              <Pencil size={14} />
            </button>
            <button
              type="button"
              onClick={onEliminar}
              title="Eliminar"
              className="p-1.5 rounded text-texto-terciario hover:text-insignia-peligro hover:bg-superficie-elevada"
            >
              <Trash2 size={14} />
            </button>
          </div>
        )}
      </div>
    </article>
  )
}

// ════════════════════════════════════════════════════════════════
// Editor de cuenta (modal de crear / editar)
// ════════════════════════════════════════════════════════════════

function EditorCuenta({
  miembroId, cuentaExistente, onCerrar, onGuardado,
}: {
  miembroId: string
  cuentaExistente: InfoBancaria | null
  onCerrar: () => void
  onGuardado: () => Promise<void>
}) {
  const toast = useToast()
  const esEdicion = !!cuentaExistente

  const [tipoPago, setTipoPago] = useState<'banco' | 'digital'>(cuentaExistente?.tipo_pago ?? 'banco')
  const [etiqueta, setEtiqueta] = useState(cuentaExistente?.etiqueta ?? '')
  const [banco, setBanco] = useState(cuentaExistente?.banco ?? '')
  const [tipoCuenta, setTipoCuenta] = useState(cuentaExistente?.tipo_cuenta ?? '')
  const [numeroCuenta, setNumeroCuenta] = useState(cuentaExistente?.numero_cuenta ?? '')
  const [alias, setAlias] = useState(cuentaExistente?.alias ?? '')
  const [titularNombre, setTitularNombre] = useState(cuentaExistente?.titular_nombre ?? '')
  const [titularDocumento, setTitularDocumento] = useState(cuentaExistente?.titular_documento ?? '')
  const [activa, setActiva] = useState(cuentaExistente?.activa ?? true)
  const [guardando, setGuardando] = useState(false)

  const guardar = async () => {
    setGuardando(true)
    try {
      const payload = {
        tipo_pago: tipoPago,
        etiqueta: etiqueta.trim() || null,
        banco: banco.trim() || null,
        tipo_cuenta: tipoCuenta.trim() || null,
        numero_cuenta: numeroCuenta.trim() || null,
        alias: alias.trim() || null,
        titular_nombre: titularNombre.trim() || null,
        titular_documento: titularDocumento.trim() || null,
        activa,
      }

      const res = esEdicion
        ? await fetch(`/api/miembros/${miembroId}/info-bancaria/${cuentaExistente!.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          })
        : await fetch(`/api/miembros/${miembroId}/info-bancaria`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          })

      const data = await res.json()
      if (!res.ok) {
        toast.mostrar('error', data.error || 'No se pudo guardar')
        return
      }
      toast.mostrar('exito', esEdicion ? 'Cuenta actualizada' : 'Cuenta creada')
      await onGuardado()
    } catch (err) {
      console.error('[EditorCuenta] error:', err)
      toast.mostrar('error', 'Error de red')
    } finally {
      setGuardando(false)
    }
  }

  return (
    <Modal
      abierto
      onCerrar={() => { if (!guardando) onCerrar() }}
      titulo={esEdicion ? 'Editar cuenta' : 'Agregar cuenta'}
      tamano="lg"
      acciones={
        <div className="flex items-center justify-end gap-2 w-full">
          <Boton variante="fantasma" tamano="sm" onClick={onCerrar} disabled={guardando}>Cancelar</Boton>
          <Boton tamano="sm" icono={<Check size={14} />} onClick={guardar} cargando={guardando}>
            {esEdicion ? 'Guardar cambios' : 'Crear cuenta'}
          </Boton>
        </div>
      }
    >
      <div className="space-y-4">
        {/* Tipo de pago */}
        <div>
          <p className="text-[11px] font-medium text-texto-terciario uppercase tracking-wider mb-2">Tipo</p>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setTipoPago('banco')}
              disabled={guardando}
              className={`flex items-center gap-2 px-3 py-2.5 rounded-lg border text-sm transition-colors ${
                tipoPago === 'banco'
                  ? 'border-texto-marca/50 bg-texto-marca/10 text-texto-marca'
                  : 'border-borde-sutil bg-superficie-tarjeta text-texto-secundario hover:border-borde-fuerte'
              }`}
            >
              <Building2 size={14} />
              <span>Cuenta bancaria</span>
            </button>
            <button
              type="button"
              onClick={() => setTipoPago('digital')}
              disabled={guardando}
              className={`flex items-center gap-2 px-3 py-2.5 rounded-lg border text-sm transition-colors ${
                tipoPago === 'digital'
                  ? 'border-texto-marca/50 bg-texto-marca/10 text-texto-marca'
                  : 'border-borde-sutil bg-superficie-tarjeta text-texto-secundario hover:border-borde-fuerte'
              }`}
            >
              <Wallet size={14} />
              <span>Billetera virtual</span>
            </button>
          </div>
        </div>

        {/* Etiqueta + banco */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Input
            tipo="text"
            etiqueta="Etiqueta (opcional)"
            value={etiqueta}
            onChange={e => setEtiqueta(e.target.value)}
            placeholder="Ej: Cuenta sueldo"
          />
          <Input
            tipo="text"
            etiqueta={tipoPago === 'banco' ? 'Banco' : 'Billetera (Mercado Pago, Brubank, etc.)'}
            value={banco}
            onChange={e => setBanco(e.target.value)}
            placeholder={tipoPago === 'banco' ? 'Ej: Galicia' : 'Ej: Mercado Pago'}
          />
        </div>

        {/* Tipo de cuenta + número */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {tipoPago === 'banco' && (
            <Input
              tipo="text"
              etiqueta="Tipo de cuenta"
              value={tipoCuenta}
              onChange={e => setTipoCuenta(e.target.value)}
              placeholder="Ahorro / Corriente / Sueldo"
            />
          )}
          <Input
            tipo="text"
            etiqueta={tipoPago === 'banco' ? 'CBU' : 'CVU / Número'}
            value={numeroCuenta}
            onChange={e => setNumeroCuenta(e.target.value)}
            placeholder={tipoPago === 'banco' ? '22 dígitos' : 'CVU del proveedor'}
          />
        </div>

        {/* Alias */}
        <Input
          tipo="text"
          etiqueta="Alias"
          value={alias}
          onChange={e => setAlias(e.target.value)}
          placeholder="mi.alias.cbu"
        />

        {/* Titular */}
        <div>
          <p className="text-[11px] font-medium text-texto-terciario uppercase tracking-wider mb-2">
            Titular (si no es el empleado)
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Input
              tipo="text"
              etiqueta="Nombre del titular"
              value={titularNombre}
              onChange={e => setTitularNombre(e.target.value)}
              placeholder="Ej: María Pérez"
            />
            <Input
              tipo="text"
              etiqueta="Documento"
              value={titularDocumento}
              onChange={e => setTitularDocumento(e.target.value)}
              placeholder="DNI o CUIT"
            />
          </div>
        </div>

        {/* Activa */}
        <button
          type="button"
          onClick={() => setActiva(!activa)}
          disabled={guardando}
          className="flex items-center gap-2.5 text-sm text-texto-secundario hover:text-texto-primario"
        >
          <span className={`shrink-0 w-5 h-5 rounded border flex items-center justify-center transition-colors ${
            activa
              ? 'bg-texto-marca border-texto-marca'
              : 'border-borde-fuerte bg-superficie-tarjeta'
          }`}>
            {activa && (
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            )}
          </span>
          <span>Cuenta activa (aparece como opción al registrar pagos)</span>
        </button>
      </div>
    </Modal>
  )
}
