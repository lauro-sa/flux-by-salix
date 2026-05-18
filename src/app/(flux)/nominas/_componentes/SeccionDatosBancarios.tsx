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

import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import {
  Plus, Building2, Wallet, Pencil, Trash2, Loader2,
  User, Star,
} from 'lucide-react'
import { ModalAdaptable as Modal } from '@/componentes/ui/ModalAdaptable'
import { ModalConfirmacion } from '@/componentes/ui/ModalConfirmacion'
import { Boton } from '@/componentes/ui/Boton'
import { Input } from '@/componentes/ui/Input'
import { Interruptor } from '@/componentes/ui/Interruptor'
import { Tooltip } from '@/componentes/ui/Tooltip'
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
  /**
   * Modo embebido para la ficha de Usuarios: oculta el encabezado
   * propio (título + descripción) y el padding exterior, porque la
   * sección ya viene envuelta en su propio <section>+SeccionEncabezado
   * dentro de TabInformacion.
   */
  compacto?: boolean
}

export function SeccionDatosBancarios({ miembroId, puedeEditar, compacto = false }: Props) {
  const toast = useToast()
  const [cuentas, setCuentas] = useState<InfoBancaria[]>([])
  const [primeraCarga, setPrimeraCarga] = useState(true)
  const [editorAbierto, setEditorAbierto] = useState(false)
  const [cuentaEditando, setCuentaEditando] = useState<InfoBancaria | null>(null)
  const [confirmacionEliminar, setConfirmacionEliminar] = useState<InfoBancaria | null>(null)
  // Confirmación de cambio de cuenta predeterminada. Solo se abre
  // cuando ya hay una default vigente — si el miembro no tiene
  // ninguna marcada, el cambio se hace directo sin modal porque no
  // hay nada que "perder".
  const [confirmacionDefault, setConfirmacionDefault] = useState<{
    actual: InfoBancaria
    nueva: InfoBancaria
  } | null>(null)
  const [aplicandoCambioDefault, setAplicandoCambioDefault] = useState(false)
  // ID de la cuenta que acaba de ser marcada como predeterminada.
  // Se usa para resaltarla visualmente unos segundos y que el operador
  // identifique al toque cuál es la nueva default (sin tener que leer
  // el badge). Se limpia con un timer.
  const [idRecienMarcada, setIdRecienMarcada] = useState<string | null>(null)
  const timerHighlight = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => {
    return () => { if (timerHighlight.current) clearTimeout(timerHighlight.current) }
  }, [])

  const destacarTemporal = (id: string) => {
    if (timerHighlight.current) clearTimeout(timerHighlight.current)
    setIdRecienMarcada(id)
    // Coincide con la duración de la animación en CuentaFila (~1.2s).
    timerHighlight.current = setTimeout(() => setIdRecienMarcada(null), 1400)
  }

  // ─── Carga ───
  // `cache: 'no-store'` es crítico acá: después de marcar/desmarcar
  // predeterminada o togglear activa, llamamos cargar() para refrescar.
  // Sin no-store, el navegador puede servir la respuesta cacheada del
  // GET anterior y la UI queda mostrando el estado viejo (la cuenta
  // antigua sigue con la estrella llena aunque la BD ya cambió).
  const cargar = async () => {
    try {
      const res = await fetch(`/api/miembros/${miembroId}/info-bancaria`, {
        cache: 'no-store',
      })
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

  // PATCH puro al endpoint para marcar como predeterminada. Lo
  // separamos del UI flow para reusarlo desde el modal de confirmación
  // y desde el caso "no había default todavía" (sin modal).
  const aplicarMarcarPredeterminada = async (c: InfoBancaria) => {
    try {
      const res = await fetch(`/api/miembros/${miembroId}/info-bancaria/${c.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ predeterminada: true }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.mostrar('error', data.error || 'No se pudo marcar como predeterminada')
        return false
      }
      toast.mostrar('exito', 'Cuenta predeterminada actualizada')
      await cargar()
      // Disparamos el highlight DESPUÉS de cargar para que la fila
      // ya esté renderizada con la nueva posición y el destaque sea
      // sobre la fila correcta.
      destacarTemporal(c.id)
      return true
    } catch (err) {
      console.error('[SeccionDatosBancarios] aplicarMarcarPredeterminada:', err)
      toast.mostrar('error', 'Error de red')
      return false
    }
  }

  // Handler del click en la estrella. Decide si pedir confirmación
  // (cuando hay otra cuenta default vigente que se va a desmarcar)
  // o aplicar directo (cuando no hay ninguna default todavía).
  const marcarPredeterminada = async (c: InfoBancaria) => {
    if (c.predeterminada) return
    const actualDefault = cuentas.find(x => x.predeterminada && x.id !== c.id)
    if (actualDefault) {
      setConfirmacionDefault({ actual: actualDefault, nueva: c })
      return
    }
    await aplicarMarcarPredeterminada(c)
  }

  const confirmarCambioDefault = async () => {
    if (!confirmacionDefault) return
    setAplicandoCambioDefault(true)
    try {
      const ok = await aplicarMarcarPredeterminada(confirmacionDefault.nueva)
      if (ok) setConfirmacionDefault(null)
    } finally {
      setAplicandoCambioDefault(false)
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
    <div className={compacto ? 'space-y-3' : 'px-4 md:px-6 py-4 space-y-4'}>
      {/* ─── Header propio (solo en modo no compacto) ─── */}
      {!compacto && (
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
      )}

      {/* En modo compacto, el botón "Agregar" va arriba a la derecha alineado con
          el SeccionEncabezado del padre (que ya muestra el título). */}
      {compacto && puedeEditar && cuentas.length > 0 && (
        <div className="flex justify-end -mt-2">
          <Boton tamano="sm" variante="fantasma" icono={<Plus size={14} />} onClick={abrirNueva}>
            Agregar cuenta
          </Boton>
        </div>
      )}

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
              destacada={c.id === idRecienMarcada}
              puedeEditar={puedeEditar}
              onEditar={() => abrirEdicion(c)}
              onToggle={() => toggleActiva(c)}
              onMarcarPredeterminada={() => marcarPredeterminada(c)}
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
          otrasCuentas={cuentas.filter(x => x.id !== cuentaEditando?.id)}
          onCerrar={() => {
            setEditorAbierto(false)
            setCuentaEditando(null)
          }}
          onGuardado={async (cuentaGuardada) => {
            setEditorAbierto(false)
            setCuentaEditando(null)
            await cargar()
            // Si esta cuenta quedó como nueva predeterminada (ya sea
            // marcada en el editor o porque era la primera del miembro),
            // disparamos el destaque temporal igual que desde la estrella.
            if (cuentaGuardada?.predeterminada) {
              destacarTemporal(cuentaGuardada.id)
            }
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

      {/* ─── Confirmación de cambio de cuenta predeterminada ───
          Cuando ya existe una default vigente y el operador marca
          otra, mostramos un modal con la info completa de ambas
          cuentas para evitar errores. Si no había default previa, no
          se abre este modal (el cambio aplica directo). */}
      {confirmacionDefault && (
        <Modal
          abierto
          onCerrar={() => { if (!aplicandoCambioDefault) setConfirmacionDefault(null) }}
          titulo="Cambiar cuenta predeterminada"
          tamano="lg"
          accionSecundaria={{ etiqueta: 'Cancelar', onClick: () => setConfirmacionDefault(null) }}
          accionPrimaria={{
            etiqueta: 'Confirmar cambio',
            onClick: confirmarCambioDefault,
            cargando: aplicandoCambioDefault,
          }}
        >
          <div className="space-y-4">
            <p className="text-sm text-texto-secundario">
              Esta es la cuenta que se preselecciona al registrar pagos de nómina. Si confirmás, <b>la actual deja de ser la predeterminada</b> y pasa a serlo la nueva. Ninguna cuenta se elimina ni se desactiva.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_1fr] gap-3 items-stretch">
              <CuentaResumen titulo="Predeterminada actual" cuenta={confirmacionDefault.actual} variante="pierde" />
              <div className="hidden md:flex items-center justify-center text-texto-terciario">→</div>
              <CuentaResumen titulo="Nueva predeterminada" cuenta={confirmacionDefault.nueva} variante="gana" />
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}

// ════════════════════════════════════════════════════════════════
// CuentaResumen — tarjeta usada en el modal de cambio de default
// para mostrar la info clave de la cuenta saliente y la entrante.
// ════════════════════════════════════════════════════════════════

function CuentaResumen({
  titulo, cuenta, variante,
}: {
  titulo: string
  cuenta: InfoBancaria
  /** 'pierde' = la que deja de ser default. 'gana' = la nueva default. */
  variante: 'pierde' | 'gana'
}) {
  const esDigital = cuenta.tipo_pago === 'digital'
  const nombre = cuenta.etiqueta || cuenta.banco || (esDigital ? 'Billetera virtual' : 'Cuenta bancaria')
  const colorBorde = variante === 'gana' ? 'border-texto-marca/40 bg-texto-marca/[0.04]' : 'border-borde-sutil bg-superficie-tarjeta'

  return (
    <div className={`rounded-card border px-3.5 py-3 space-y-2 ${colorBorde}`}>
      <div className="flex items-center justify-between gap-2">
        <p className="text-[10px] uppercase tracking-wider text-texto-terciario">{titulo}</p>
        {variante === 'gana' && (
          <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-texto-marca/15 text-texto-marca uppercase tracking-wider">
            <Star size={9} className="fill-current" />
            Por defecto
          </span>
        )}
      </div>
      <div className="flex items-start gap-2.5">
        <div className={`shrink-0 size-9 rounded-lg flex items-center justify-center ${
          esDigital ? 'bg-canal-whatsapp/10 text-canal-whatsapp' : 'bg-texto-marca/10 text-texto-marca'
        }`}>
          {esDigital ? <Wallet size={16} /> : <Building2 size={16} />}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-texto-primario truncate">{nombre}</p>
          {cuenta.banco && cuenta.etiqueta && (
            <p className="text-[11px] text-texto-terciario uppercase tracking-wider">{cuenta.banco}</p>
          )}
        </div>
      </div>
      <div className="space-y-1 pt-1 border-t border-borde-sutil">
        {cuenta.tipo_cuenta && (
          <Dato etiqueta="Tipo" valor={cuenta.tipo_cuenta} />
        )}
        {cuenta.alias && (
          <Dato etiqueta="Alias" valor={cuenta.alias} mono />
        )}
        {cuenta.numero_cuenta && (
          <Dato etiqueta={esDigital ? 'CVU' : 'CBU'} valor={cuenta.numero_cuenta} mono />
        )}
        {cuenta.titular_nombre && (
          <Dato etiqueta="Titular" valor={[cuenta.titular_nombre, cuenta.titular_documento].filter(Boolean).join(' · ')} />
        )}
      </div>
    </div>
  )
}

function Dato({ etiqueta, valor, mono }: { etiqueta: string; valor: string; mono?: boolean }) {
  return (
    <p className="text-xs text-texto-secundario">
      <span className="text-texto-terciario uppercase tracking-wider text-[10px] mr-1.5">{etiqueta}</span>
      <span className={mono ? 'font-mono' : ''}>{valor}</span>
    </p>
  )
}

// ════════════════════════════════════════════════════════════════
// Fila de cuenta
// ════════════════════════════════════════════════════════════════

function CuentaFila({
  cuenta, destacada, puedeEditar, onEditar, onToggle, onMarcarPredeterminada, onEliminar,
}: {
  cuenta: InfoBancaria
  /** Si la fila se acaba de marcar como predeterminada, le damos un
      glow/pulso de ~3s para que el operador identifique al toque cuál
      es la nueva default. */
  destacada: boolean
  puedeEditar: boolean
  onEditar: () => void
  onToggle: () => void
  onMarcarPredeterminada: () => void
  onEliminar: () => void
}) {
  const esDigital = cuenta.tipo_pago === 'digital'
  const titulo = cuenta.etiqueta || cuenta.banco || (esDigital ? 'Billetera virtual' : 'Cuenta bancaria')

  // Animación de destaque cuando la cuenta acaba de marcarse como
  // predeterminada: halo violeta sutil que se expande y desvanece.
  // Dura ~1.2s — lo suficiente para que el ojo lo capture pero sin
  // demorar al operador. La reposición vertical la maneja `layout`.
  const animacion = destacada
    ? {
        boxShadow: [
          '0 0 0 0 rgba(124, 92, 255, 0)',
          '0 0 0 3px rgba(124, 92, 255, 0.2)',
          '0 0 0 0 rgba(124, 92, 255, 0)',
        ],
      }
    : { boxShadow: '0 0 0 0 rgba(124, 92, 255, 0)' }
  const transicion = destacada
    ? { duration: 1.2, ease: 'easeOut' as const, times: [0, 0.35, 1] }
    : { duration: 0.3 }

  return (
    <motion.article
      layout
      animate={animacion}
      transition={transicion}
      className={`rounded-card border px-4 py-3 ${
        !cuenta.activa
          ? 'border-borde-sutil bg-superficie-app/40 opacity-70'
          : cuenta.predeterminada
            ? 'border-texto-marca/40 bg-texto-marca/[0.04]'
            : 'border-borde-sutil bg-superficie-tarjeta'
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
            {cuenta.predeterminada && (
              <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-texto-marca/15 text-texto-marca uppercase tracking-wider">
                <Star size={10} className="fill-current" />
                Por defecto
              </span>
            )}
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

        {/* Acciones — orden: estrella (predeterminada) | interruptor
            (activa) | divisor | editar | eliminar. La estrella solo
            está habilitada cuando la cuenta está activa (no tiene
            sentido marcar como default una inactiva). */}
        {puedeEditar && (
          <div className="shrink-0 flex items-center gap-1.5">
            <Tooltip contenido={cuenta.predeterminada
              ? 'Esta es la cuenta por defecto al registrar pagos. Marcá otra para cambiarla.'
              : cuenta.activa
                ? 'Marcar como cuenta por defecto al registrar pagos.'
                : 'Activá la cuenta primero para poder marcarla como predeterminada.'}>
              <button
                type="button"
                onClick={onMarcarPredeterminada}
                disabled={!cuenta.activa || cuenta.predeterminada}
                aria-label="Marcar como predeterminada"
                className={`p-1.5 rounded transition-colors ${
                  cuenta.predeterminada
                    ? 'text-texto-marca cursor-default'
                    : cuenta.activa
                      ? 'text-texto-terciario hover:text-texto-marca hover:bg-superficie-elevada'
                      : 'text-texto-terciario/40 cursor-not-allowed'
                }`}
              >
                <Star size={14} className={cuenta.predeterminada ? 'fill-current' : ''} />
              </button>
            </Tooltip>
            <Tooltip contenido={cuenta.activa
              ? 'Activa: aparece como opción al registrar pagos. Tocá para desactivar.'
              : 'Inactiva: no aparece como opción al registrar pagos. Tocá para activar.'}>
              <Interruptor
                activo={cuenta.activa}
                onChange={onToggle}
                tamano="sm"
                titulo={cuenta.activa ? 'Desactivar cuenta' : 'Activar cuenta'}
              />
            </Tooltip>
            <div className="w-px h-4 bg-borde-sutil mx-1" />
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
    </motion.article>
  )
}

// ════════════════════════════════════════════════════════════════
// Editor de cuenta (modal de crear / editar)
// ════════════════════════════════════════════════════════════════

function EditorCuenta({
  miembroId, cuentaExistente, otrasCuentas, onCerrar, onGuardado,
}: {
  miembroId: string
  cuentaExistente: InfoBancaria | null
  /**
   * Resto de cuentas del miembro (excluyendo la que se está editando).
   * Sirve para mostrar el aviso inline de "esta reemplazará a X como
   * cuenta por defecto" cuando se marca la opción.
   */
  otrasCuentas: InfoBancaria[]
  onCerrar: () => void
  /**
   * Callback con la cuenta creada/actualizada. El padre usa el flag
   * `predeterminada` para disparar el highlight visual si corresponde.
   */
  onGuardado: (cuenta?: InfoBancaria) => Promise<void>
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
  // Solo permitimos marcar como predeterminada desde el editor cuando
  // es una cuenta nueva o se trata de cambiar una existente. El default
  // visible refleja el valor actual; el backend se encarga de desmarcar
  // cualquier otra del mismo miembro si esta se confirma como default.
  const [predeterminada, setPredeterminada] = useState(cuentaExistente?.predeterminada ?? false)
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
        // Solo enviamos `predeterminada` cuando el operador la marcó en
        // el editor. Desmarcarla desde acá no tiene sentido (para "sacar
        // default" hay que marcar OTRA como default desde el listado),
        // así que omitimos el campo si está en false durante una edición.
        ...(predeterminada || !esEdicion ? { predeterminada } : {}),
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
      // Pasamos la cuenta devuelta por el endpoint para que el padre
      // pueda destacarla si quedó como nueva predeterminada.
      await onGuardado(data.cuenta as InfoBancaria | undefined)
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
      accionSecundaria={{ etiqueta: 'Cancelar', onClick: onCerrar }}
      accionPrimaria={{
        etiqueta: esEdicion ? 'Guardar cambios' : 'Crear cuenta',
        onClick: guardar,
        cargando: guardando,
      }}
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

        {/* Activa + Predeterminada */}
        <div className="space-y-2.5 pt-1">
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

          <button
            type="button"
            onClick={() => activa && setPredeterminada(!predeterminada)}
            disabled={guardando || !activa}
            className={`flex items-center gap-2.5 text-sm ${
              activa ? 'text-texto-secundario hover:text-texto-primario' : 'text-texto-terciario/60 cursor-not-allowed'
            }`}
          >
            <span className={`shrink-0 w-5 h-5 rounded border flex items-center justify-center transition-colors ${
              predeterminada && activa
                ? 'bg-texto-marca border-texto-marca'
                : 'border-borde-fuerte bg-superficie-tarjeta'
            }`}>
              {predeterminada && activa && (
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              )}
            </span>
            <span>
              Marcar como cuenta por defecto al registrar pagos
              {cuentaExistente?.predeterminada && predeterminada && (
                <span className="ml-1.5 text-[10px] uppercase tracking-wider text-texto-marca">· actual</span>
              )}
            </span>
          </button>

          {/* Aviso inline: si el operador marcó "como default" desde el
              editor y ya hay OTRA cuenta default vigente, le mostramos
              cuál se va a desmarcar al guardar. Reemplaza al modal de
              confirmación del listado (que es estorboso en este flow
              porque el editor ya es un modal). */}
          {predeterminada && activa && (() => {
            const otraDefault = otrasCuentas.find(c => c.predeterminada && !c.eliminada)
            if (!otraDefault) return null
            const nombreOtra = otraDefault.etiqueta || otraDefault.banco || (otraDefault.tipo_pago === 'digital' ? 'Billetera virtual' : 'Cuenta bancaria')
            const datoOtra = otraDefault.alias || otraDefault.numero_cuenta || null
            return (
              <div className="flex items-start gap-2 rounded-md border border-insignia-advertencia/30 bg-insignia-advertencia/[0.06] px-3 py-2 text-xs text-texto-secundario">
                <Star size={13} className="shrink-0 mt-0.5 text-insignia-advertencia" />
                <div className="min-w-0">
                  Al guardar, <b className="text-texto-primario">{nombreOtra}</b>
                  {datoOtra && <span className="text-texto-terciario font-mono"> · {datoOtra}</span>}
                  {' '}deja de ser la cuenta por defecto y pasa a serlo esta.
                </div>
              </div>
            )
          })()}
        </div>
      </div>
    </Modal>
  )
}
