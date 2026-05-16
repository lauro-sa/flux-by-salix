'use client'

/**
 * Modal para confirmar un pago de nómina con todos los datos reales:
 * método, fecha, cuenta destino, referencia, comprobante y notas.
 *
 * Reemplaza al modal inline básico que estaba en
 * `PaginaEditorNominaEmpleado` y que solo pedía monto + notas.
 *
 * Flujo:
 *   1. Al abrir, carga las cuentas bancarias/digitales del empleado
 *      desde `/api/miembros/{id}/info-bancaria`.
 *   2. Preselecciona método según las cuentas: si hay digital y/o
 *      banco, sugiere "transferencia" o "cuenta_digital"; sino,
 *      "efectivo".
 *   3. Si el método requiere cuenta destino, preselecciona la cuenta
 *      con `activa=true` más reciente. El operador puede cambiar.
 *   4. Subida de comprobante: el archivo se sube por separado a
 *      `/api/nominas/pagos/comprobante` (devuelve URL), después se
 *      pasa la URL al POST de confirmación de pago.
 *   5. Confirmación llama a `onConfirmar` con el payload completo.
 *
 * Usado en: `PaginaEditorNominaEmpleado`.
 */

import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Check, Wallet, Building2, Banknote, FileSignature, Upload,
  FileText, X as IconX, Loader2, Plus,
} from 'lucide-react'
import { ModalAdaptable as Modal } from '@/componentes/ui/ModalAdaptable'
import { Boton } from '@/componentes/ui/Boton'
import { Input } from '@/componentes/ui/Input'
import { InputMoneda } from '@/componentes/ui/InputMoneda'
import { SelectorFecha } from '@/componentes/ui/SelectorFecha'
import { useToast } from '@/componentes/feedback/Toast'
import type { InfoBancaria, MetodoPagoNomina } from '@/tipos/nominas'

interface Props {
  abierto: boolean
  onCerrar: () => void
  /**
   * ID del miembro al que se le paga. Se usa para cargar sus cuentas
   * bancarias y para el endpoint de creación del pago.
   */
  miembroId: string
  /**
   * Neto sugerido por el motor de cálculo, antes de cualquier ajuste
   * del operador. Se muestra como referencia y como prefill del monto.
   */
  netoSugerido: number
  /** Descuento por adelantos ya incluido en el neto. Solo informativo. */
  descuentoAdelanto?: number
  /**
   * Callback con los datos confirmados. El padre llama al endpoint
   * POST /api/nominas/pagos. El modal cierra solo si el padre lo
   * cierra explícitamente — así el padre puede mostrar errores y
   * dejar el modal abierto para reintentar.
   */
  onConfirmar: (datos: {
    monto_abonado: number
    metodo_pago: MetodoPagoNomina
    fecha_pago: string
    referencia: string | null
    info_bancaria_id: string | null
    comprobante_url: string | null
    notas: string | null
  }) => Promise<void> | void
  /** Si está confirmándose (deshabilita los inputs y botones). */
  confirmando?: boolean
}

const METODOS: Array<{ valor: MetodoPagoNomina; etiqueta: string; icono: React.ReactNode; descripcion: string }> = [
  { valor: 'efectivo',       etiqueta: 'Efectivo',         icono: <Banknote size={14} />,      descripcion: 'Pago en mano, sin destino bancario.' },
  { valor: 'transferencia',  etiqueta: 'Transferencia',    icono: <Building2 size={14} />,     descripcion: 'A una cuenta bancaria del empleado.' },
  { valor: 'cuenta_digital', etiqueta: 'Cuenta digital',   icono: <Wallet size={14} />,        descripcion: 'A una billetera virtual (MP, Brubank, etc).' },
  { valor: 'cheque',         etiqueta: 'Cheque',           icono: <FileSignature size={14} />, descripcion: 'Cheque al portador o nominal.' },
  { valor: 'otro',           etiqueta: 'Otro',             icono: <FileText size={14} />,      descripcion: 'Cualquier otro medio de pago.' },
]

const TAMANO_MAXIMO_MB = 10
const TIPOS_ACEPTADOS = 'application/pdf,image/jpeg,image/png,image/webp'

function hoyISO(): string {
  return new Date().toISOString().slice(0, 10)
}

function formatearMonto(v: number): string {
  return `$ ${v.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`
}

export function ModalConfirmarPagoNomina({
  abierto, onCerrar, miembroId, netoSugerido, descuentoAdelanto = 0, onConfirmar, confirmando = false,
}: Props) {
  const toast = useToast()
  const inputArchivo = useRef<HTMLInputElement>(null)

  // ─── Estado ───
  const [cuentas, setCuentas] = useState<InfoBancaria[]>([])
  const [cargandoCuentas, setCargandoCuentas] = useState(false)
  const [metodo, setMetodo] = useState<MetodoPagoNomina>('efectivo')
  const [cuentaId, setCuentaId] = useState<string | null>(null)
  const [monto, setMonto] = useState<string>('')
  const [fecha, setFecha] = useState<string>(hoyISO())
  const [referencia, setReferencia] = useState('')
  const [notas, setNotas] = useState('')
  const [comprobanteUrl, setComprobanteUrl] = useState<string | null>(null)
  const [comprobanteNombre, setComprobanteNombre] = useState<string | null>(null)
  const [subiendoComprobante, setSubiendoComprobante] = useState(false)

  // ─── Carga inicial: cuentas del empleado ───
  useEffect(() => {
    if (!abierto || !miembroId) return
    let cancelado = false
    setCargandoCuentas(true)
    fetch(`/api/miembros/${miembroId}/info-bancaria`)
      .then(r => r.json())
      .then(data => {
        if (cancelado) return
        const lista = (data.cuentas ?? []) as InfoBancaria[]
        setCuentas(lista)
        // Default: si hay alguna cuenta activa, sugerir transferencia o
        // cuenta_digital según el tipo más común. Sino, efectivo.
        const activas = lista.filter(c => c.activa)
        if (activas.length > 0) {
          const primera = activas[0]
          setMetodo(primera.tipo_pago === 'digital' ? 'cuenta_digital' : 'transferencia')
          setCuentaId(primera.id)
        } else {
          setMetodo('efectivo')
          setCuentaId(null)
        }
      })
      .catch(err => {
        console.error('[ModalConfirmarPagoNomina] error al cargar cuentas:', err)
      })
      .finally(() => {
        if (!cancelado) setCargandoCuentas(false)
      })
    return () => { cancelado = true }
  }, [abierto, miembroId])

  // ─── Reset al cerrar ───
  useEffect(() => {
    if (!abierto) {
      setMonto('')
      setReferencia('')
      setNotas('')
      setComprobanteUrl(null)
      setComprobanteNombre(null)
      setFecha(hoyISO())
    }
  }, [abierto])

  // Prefill del monto con el neto sugerido cada vez que abre.
  useEffect(() => {
    if (abierto && !monto) {
      setMonto(String(netoSugerido.toFixed(2)))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [abierto, netoSugerido])

  // Cuentas que aplican según el método elegido. Filtramos por el
  // tipo (banco para transferencia, digital para cuenta_digital).
  const cuentasFiltradas = useMemo(() => {
    if (metodo === 'transferencia') return cuentas.filter(c => c.tipo_pago === 'banco' && !c.eliminada)
    if (metodo === 'cuenta_digital') return cuentas.filter(c => c.tipo_pago === 'digital' && !c.eliminada)
    return []
  }, [metodo, cuentas])

  // Si cambia el método y la cuenta seleccionada no aplica más, limpiar.
  useEffect(() => {
    if (!cuentaId) return
    if (cuentasFiltradas.length === 0) {
      setCuentaId(null)
      return
    }
    if (!cuentasFiltradas.some(c => c.id === cuentaId)) {
      // Cuenta actual no aplica al nuevo método: preseleccionar la primera disponible.
      setCuentaId(cuentasFiltradas[0]?.id ?? null)
    }
  }, [metodo, cuentaId, cuentasFiltradas])

  const requiereCuenta = metodo === 'transferencia' || metodo === 'cuenta_digital'

  // ─── Subir comprobante ───
  const onSeleccionarArchivo = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > TAMANO_MAXIMO_MB * 1024 * 1024) {
      toast.mostrar('error', `El archivo supera ${TAMANO_MAXIMO_MB} MB`)
      return
    }

    setSubiendoComprobante(true)
    try {
      const fd = new FormData()
      fd.append('archivo', file)
      const res = await fetch('/api/nominas/pagos/comprobante', { method: 'POST', body: fd })
      const data = await res.json()
      if (!res.ok) {
        toast.mostrar('error', data.error || 'No se pudo subir el comprobante')
        return
      }
      setComprobanteUrl(data.url)
      setComprobanteNombre(file.name)
      toast.mostrar('exito', 'Comprobante subido')
    } catch (err) {
      console.error('[ModalConfirmarPagoNomina] error al subir:', err)
      toast.mostrar('error', 'Error de red al subir el comprobante')
    } finally {
      setSubiendoComprobante(false)
      // Limpiamos el value para que el mismo archivo pueda re-subirse si se quitó.
      if (inputArchivo.current) inputArchivo.current.value = ''
    }
  }

  const quitarComprobante = () => {
    setComprobanteUrl(null)
    setComprobanteNombre(null)
  }

  // ─── Confirmar ───
  const handleConfirmar = async () => {
    const montoNum = parseFloat(monto) || 0
    if (montoNum <= 0) {
      toast.mostrar('advertencia', 'Ingresá un monto válido')
      return
    }
    if (requiereCuenta && !cuentaId && cuentasFiltradas.length > 0) {
      toast.mostrar('advertencia', 'Elegí la cuenta destino')
      return
    }
    await onConfirmar({
      monto_abonado: montoNum,
      metodo_pago: metodo,
      fecha_pago: fecha,
      referencia: referencia.trim() || null,
      info_bancaria_id: requiereCuenta ? cuentaId : null,
      comprobante_url: comprobanteUrl,
      notas: notas.trim() || null,
    })
  }

  const montoNum = parseFloat(monto) || 0
  const diff = montoNum - netoSugerido
  const labelConfirmar = montoNum > 0 ? `Confirmar pago de ${formatearMonto(montoNum)}` : 'Confirmar pago'

  return (
    <Modal
      abierto={abierto}
      onCerrar={() => { if (!confirmando) onCerrar() }}
      titulo="Registrar pago"
      tamano="2xl"
      acciones={
        <div className="flex items-center justify-end gap-2 w-full">
          <Boton variante="fantasma" tamano="sm" onClick={onCerrar} disabled={confirmando}>
            Cancelar
          </Boton>
          <Boton
            tamano="sm"
            icono={<Check size={14} />}
            onClick={handleConfirmar}
            cargando={confirmando}
            disabled={!monto || montoNum <= 0 || subiendoComprobante}
          >
            {labelConfirmar}
          </Boton>
        </div>
      }
    >
      <div className="space-y-5">
        {/* ─── Resumen del cálculo ─── */}
        <section className="rounded-lg bg-superficie-elevada/40 border border-borde-sutil px-4 py-3 space-y-1.5">
          <div className="flex justify-between text-sm">
            <span className="text-texto-terciario">Neto sugerido</span>
            <span className="text-texto-primario font-medium tabular-nums">{formatearMonto(netoSugerido)}</span>
          </div>
          {descuentoAdelanto > 0 && (
            <div className="flex justify-between text-xs">
              <span className="text-texto-terciario">Incluye descuento adelanto</span>
              <span className="text-insignia-advertencia tabular-nums">-{formatearMonto(descuentoAdelanto)}</span>
            </div>
          )}
          {montoNum > 0 && Math.abs(diff) > 0.01 && (
            <div className="flex justify-between text-xs pt-1 border-t border-borde-sutil mt-1.5">
              <span className="text-texto-terciario">Diferencia</span>
              <span className={diff > 0 ? 'text-insignia-exito tabular-nums' : 'text-insignia-peligro tabular-nums'}>
                {diff > 0 ? '+' : ''}{formatearMonto(diff)}
                {diff > 0 ? ' (a favor del empleado)' : ' (queda debiendo)'}
              </span>
            </div>
          )}
        </section>

        {/* ─── Método de pago ─── */}
        <section>
          <p className="text-[11px] font-medium text-texto-terciario uppercase tracking-wider mb-2">Método de pago</p>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-1.5">
            {METODOS.map(m => {
              const activo = metodo === m.valor
              return (
                <button
                  key={m.valor}
                  type="button"
                  onClick={() => setMetodo(m.valor)}
                  disabled={confirmando}
                  title={m.descripcion}
                  className={`flex flex-col items-center gap-1.5 px-2 py-2.5 rounded-lg border text-xs transition-colors ${
                    activo
                      ? 'border-texto-marca/50 bg-texto-marca/10 text-texto-marca'
                      : 'border-borde-sutil bg-superficie-tarjeta text-texto-secundario hover:border-borde-fuerte'
                  }`}
                >
                  {m.icono}
                  <span className="font-medium">{m.etiqueta}</span>
                </button>
              )
            })}
          </div>
        </section>

        {/* ─── Cuenta destino (solo para transferencia / digital) ─── */}
        {requiereCuenta && (
          <section>
            <div className="flex items-baseline justify-between gap-2 mb-2">
              <p className="text-[11px] font-medium text-texto-terciario uppercase tracking-wider">
                Cuenta destino
              </p>
              {cargandoCuentas && <Loader2 size={12} className="animate-spin text-texto-terciario" />}
            </div>
            {cuentasFiltradas.length === 0 && !cargandoCuentas ? (
              <div className="rounded-lg border border-dashed border-borde-sutil px-4 py-3 text-xs text-texto-terciario">
                Este empleado no tiene cuentas {metodo === 'transferencia' ? 'bancarias' : 'digitales'} cargadas. Podés
                seguir registrando el pago y cargarle la cuenta más tarde desde su ficha.
              </div>
            ) : (
              <div className="space-y-1.5">
                {cuentasFiltradas.map(c => {
                  const seleccionada = cuentaId === c.id
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => setCuentaId(c.id)}
                      disabled={confirmando}
                      className={`w-full flex items-start gap-3 px-3 py-2.5 rounded-lg border text-left transition-colors ${
                        seleccionada
                          ? 'border-texto-marca/50 bg-texto-marca/10'
                          : 'border-borde-sutil bg-superficie-tarjeta hover:border-borde-fuerte'
                      }`}
                    >
                      <div className={`shrink-0 w-4 h-4 rounded-full border-2 mt-0.5 flex items-center justify-center ${
                        seleccionada ? 'border-texto-marca' : 'border-borde-fuerte'
                      }`}>
                        {seleccionada && <div className="w-2 h-2 rounded-full bg-texto-marca" />}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm text-texto-primario font-medium truncate">
                            {c.etiqueta || c.banco || (c.tipo_pago === 'digital' ? 'Billetera virtual' : 'Cuenta bancaria')}
                          </span>
                          {c.banco && c.etiqueta && (
                            <span className="text-[10px] text-texto-terciario uppercase tracking-wider">{c.banco}</span>
                          )}
                          {c.tipo_cuenta && (
                            <span className="text-[10px] text-texto-terciario uppercase tracking-wider">{c.tipo_cuenta}</span>
                          )}
                        </div>
                        {(c.alias || c.numero_cuenta) && (
                          <p className="text-xs text-texto-terciario mt-0.5 font-mono">
                            {c.alias || c.numero_cuenta}
                          </p>
                        )}
                        {c.titular_nombre && (
                          <p className="text-xs text-texto-terciario mt-0.5">Titular: {c.titular_nombre}</p>
                        )}
                      </div>
                    </button>
                  )
                })}
              </div>
            )}
          </section>
        )}

        {/* ─── Grid: monto + fecha ─── */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <InputMoneda
            etiqueta="Monto a pagar"
            value={monto}
            onChange={setMonto}
            moneda="ARS"
          />
          <SelectorFecha
            etiqueta="Fecha del pago"
            valor={fecha}
            onChange={v => setFecha(v ?? hoyISO())}
            limpiable={false}
            anioMin={2020}
            anioMax={new Date().getFullYear() + 1}
          />
        </div>

        {/* ─── Referencia (solo transferencia / digital / cheque) ─── */}
        {(metodo === 'transferencia' || metodo === 'cuenta_digital' || metodo === 'cheque') && (
          <Input
            tipo="text"
            etiqueta={
              metodo === 'cheque' ? 'Número de cheque (opcional)' : 'Número de operación / comprobante (opcional)'
            }
            value={referencia}
            onChange={e => setReferencia(e.target.value)}
            placeholder={metodo === 'cheque' ? 'Ej: 00012345' : 'Ej: 102938475610'}
          />
        )}

        {/* ─── Comprobante ─── */}
        <section>
          <p className="text-[11px] font-medium text-texto-terciario uppercase tracking-wider mb-2">
            Comprobante (opcional)
          </p>
          {comprobanteUrl ? (
            <div className="flex items-center gap-3 rounded-lg border border-borde-sutil bg-superficie-tarjeta px-3 py-2.5">
              <FileText size={16} className="text-texto-terciario shrink-0" />
              <a href={comprobanteUrl} target="_blank" rel="noopener noreferrer"
                 className="text-sm text-texto-marca hover:underline truncate flex-1">
                {comprobanteNombre || 'Comprobante'}
              </a>
              <button
                type="button"
                onClick={quitarComprobante}
                disabled={confirmando}
                className="shrink-0 text-texto-terciario hover:text-texto-primario p-1"
                title="Quitar comprobante"
              >
                <IconX size={14} />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => inputArchivo.current?.click()}
              disabled={subiendoComprobante || confirmando}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg border border-dashed border-borde-fuerte bg-superficie-tarjeta text-sm text-texto-secundario hover:border-texto-marca hover:text-texto-marca transition-colors disabled:opacity-50"
            >
              {subiendoComprobante
                ? <><Loader2 size={14} className="animate-spin" /> Subiendo...</>
                : <><Upload size={14} /> Subir PDF o imagen del comprobante</>}
            </button>
          )}
          <input
            ref={inputArchivo}
            type="file"
            accept={TIPOS_ACEPTADOS}
            onChange={onSeleccionarArchivo}
            className="hidden"
          />
          <p className="text-[10px] text-texto-terciario mt-1.5">
            PDF, JPG, PNG o WEBP. Máximo {TAMANO_MAXIMO_MB} MB. Recomendado para transferencias y cheques.
          </p>
        </section>

        {/* ─── Notas ─── */}
        <Input
          tipo="text"
          etiqueta="Notas (opcional)"
          value={notas}
          onChange={e => setNotas(e.target.value)}
          placeholder="Observaciones del pago..."
        />
      </div>
    </Modal>
  )
}
