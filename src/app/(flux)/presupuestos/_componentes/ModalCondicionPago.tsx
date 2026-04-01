'use client'

import { useState, useEffect } from 'react'
import { Plus, Trash2, Eye, Check } from 'lucide-react'
import { ModalAdaptable as Modal } from '@/componentes/ui/ModalAdaptable'
import { Boton } from '@/componentes/ui/Boton'
import { Select } from '@/componentes/ui/Select'
import type { CondicionPago } from '@/tipos/presupuesto'
import { useTraduccion } from '@/lib/i18n'

/**
 * ModalCondicionPago — Modal para crear/editar una condición de pago.
 * Usa el componente Modal base de Flux (header fijo, scroll en contenido, footer fijo).
 */

interface Hito {
  id: string
  descripcion: string
  porcentaje: number
  diasDesdeEmision: number
}

interface FormularioCondicion {
  label: string
  tipo: 'plazo_fijo' | 'hitos'
  diasVencimiento: string
  hitos: Hito[]
  notaPlanPago: string
}

const FORM_VACIO: FormularioCondicion = {
  label: '', tipo: 'plazo_fijo', diasVencimiento: '', hitos: [], notaPlanPago: '',
}

interface PropiedadesModal {
  abierto: boolean
  onCerrar: () => void
  onGuardar: (condicion: CondicionPago) => void
  condicionEditar?: CondicionPago | null
}

const fmtMonto = (v: number) => `$ ${v.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

export default function ModalCondicionPago({ abierto, onCerrar, onGuardar, condicionEditar }: PropiedadesModal) {
  const { t } = useTraduccion()
  const esEdicion = !!condicionEditar
  const [form, setForm] = useState<FormularioCondicion>({ ...FORM_VACIO })

  // Resetear cuando se abre
  useEffect(() => {
    if (!abierto) return
    if (condicionEditar) {
      setForm({
        label: condicionEditar.label,
        tipo: condicionEditar.tipo,
        diasVencimiento: String(condicionEditar.diasVencimiento || ''),
        hitos: (condicionEditar.hitos || []).map(h => ({ ...h })),
        notaPlanPago: condicionEditar.notaPlanPago || '',
      })
      setNombreManual(true)
    } else {
      setForm({ ...FORM_VACIO })
      setNombreManual(false)
    }
  }, [abierto, condicionEditar])

  const totalHitos = form.hitos.reduce((s, h) => s + h.porcentaje, 0)
  const hoy = new Date()
  const EJEMPLO_TOTAL = 1000
  const [nombreManual, setNombreManual] = useState(false)

  // Auto-generar nombre según lo que se va armando
  useEffect(() => {
    if (nombreManual || esEdicion) return
    let autoNombre = ''
    if (form.tipo === 'plazo_fijo') {
      const dias = parseInt(form.diasVencimiento) || 0
      if (dias === 0) autoNombre = 'Contado'
      else autoNombre = `${dias} días`
    } else if (form.hitos.length > 0) {
      autoNombre = form.hitos
        .map(h => `${h.porcentaje}% ${h.descripcion || ''}`.trim())
        .join(' + ')
    }
    if (autoNombre && autoNombre !== form.label) {
      setForm(p => ({ ...p, label: autoNombre }))
    }
  }, [form.tipo, form.diasVencimiento, form.hitos, nombreManual, esEdicion])

  const agregarHito = () => {
    if (totalHitos >= 100) return
    const restante = 100 - totalHitos
    setForm(p => ({
      ...p,
      hitos: [...p.hitos, {
        id: `h_${Date.now()}`,
        descripcion: p.hitos.length === 0 ? 'Adelanto' : 'Saldo',
        porcentaje: Math.min(restante, 50),
        diasDesdeEmision: 0,
      }],
    }))
  }

  const editarHito = (id: string, campo: string, valor: string | number) => {
    setForm(p => ({ ...p, hitos: p.hitos.map(h => h.id === id ? { ...h, [campo]: valor } : h) }))
  }

  const eliminarHito = (id: string) => {
    setForm(p => ({ ...p, hitos: p.hitos.filter(h => h.id !== id) }))
  }

  const puedeGuardar = form.label.trim() &&
    (form.tipo === 'plazo_fijo' || (form.hitos.length >= 1 && Math.abs(totalHitos - 100) <= 0.01))

  const guardar = () => {
    if (!puedeGuardar) return
    onGuardar({
      id: condicionEditar?.id || form.label.trim().toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, ''),
      label: form.label.trim(),
      tipo: form.tipo,
      diasVencimiento: form.tipo === 'plazo_fijo' ? (parseInt(form.diasVencimiento) || 0) : 0,
      hitos: form.tipo === 'hitos' ? form.hitos : [],
      notaPlanPago: form.notaPlanPago.trim(),
      predeterminado: condicionEditar?.predeterminado || false,
    })
    onCerrar()
  }

  const titulo = form.label.trim() || (esEdicion ? 'Editar condición de pago' : 'Nueva condición de pago')

  return (
    <Modal
      abierto={abierto}
      onCerrar={onCerrar}
      titulo={titulo}
      tamano="3xl"
      acciones={
        <>
          <button onClick={onCerrar} className="px-4 py-2 text-sm text-texto-secundario hover:bg-superficie-tarjeta rounded-lg transition-colors">
            Cancelar
          </button>
          <Boton onClick={guardar} disabled={!puedeGuardar}>
            {esEdicion ? 'Guardar cambios' : 'Agregar'}
          </Boton>
        </>
      }
    >
      <div className="grid grid-cols-1 md:grid-cols-[1fr_380px] gap-8">
        {/* ── Formulario ── */}
        <div className="space-y-5">
          {/* Nombre */}
          <div>
            <label className="text-xs text-texto-terciario font-medium block mb-1">Nombre</label>
            <input
              type="text"
              value={form.label}
              onChange={(e) => { setForm(p => ({ ...p, label: e.target.value })); setNombreManual(true) }}
              placeholder="Se genera automáticamente..."
              className="w-full bg-superficie-app border border-borde-sutil rounded-lg p-2.5 text-sm text-texto-primario placeholder:text-texto-placeholder outline-none focus:border-marca-500 transition-colors"
            />
            <p className="text-xs text-texto-terciario mt-1">
              {nombreManual ? 'Nombre personalizado' : 'Se genera automáticamente según la configuración'}
            </p>
          </div>

          {/* Tipo */}
          <Select
            etiqueta={t('documentos.tipo_condicion')}
            valor={form.tipo}
            onChange={(v) => setForm(p => ({ ...p, tipo: v as 'plazo_fijo' | 'hitos', hitos: v === 'plazo_fijo' ? [] : p.hitos }))}
            opciones={[
              { valor: 'plazo_fijo', etiqueta: 'Plazo fijo (días)' },
              { valor: 'hitos', etiqueta: 'Por hitos (porcentajes)' },
            ]}
          />
          <p className="text-xs text-texto-terciario -mt-3">
            {form.tipo === 'plazo_fijo'
              ? 'El total vence X días después de la fecha de emisión'
              : 'Divide el pago en cuotas con porcentaje y plazo individual'}
          </p>

          {/* Campos según tipo */}
          {form.tipo === 'plazo_fijo' ? (
            <div>
              <label className="text-xs text-texto-terciario font-medium block mb-1">Días de vencimiento</label>
              <input
                type="number" min="0" value={form.diasVencimiento}
                onChange={(e) => setForm(p => ({ ...p, diasVencimiento: e.target.value }))}
                placeholder="30"
                className="w-32 bg-superficie-app border border-borde-sutil rounded-lg p-2.5 text-sm text-texto-primario outline-none focus:border-marca-500 transition-colors"
              />
            </div>
          ) : (
            <>
              {/* Cuotas de pago */}
              <div>
                <p className="text-sm font-semibold text-texto-primario mb-0.5">Cuotas de pago</p>
                <p className="text-xs text-texto-terciario mb-4">Cada cuota define qué porcentaje del total se paga y a cuántos días de la emisión vence</p>

                {/* Encabezado de columnas */}
                {form.hitos.length > 0 && (
                  <div className="grid grid-cols-[1fr_90px_90px_28px] gap-3 px-3 mb-1.5">
                    <span className="text-xxs text-texto-terciario font-medium uppercase tracking-wider">Descripción</span>
                    <span className="text-xxs text-texto-terciario font-medium uppercase tracking-wider text-right">%</span>
                    <span className="text-xxs text-texto-terciario font-medium uppercase tracking-wider text-right">Días</span>
                    <span />
                  </div>
                )}

                <div className="space-y-2">
                  {form.hitos.map((h) => (
                    <div key={h.id} className="grid grid-cols-[1fr_90px_90px_28px] gap-3 items-center">
                      <input type="text" value={h.descripcion}
                        onChange={(e) => editarHito(h.id, 'descripcion', e.target.value)}
                        placeholder="Ej: Adelanto"
                        className="w-full bg-superficie-app border border-borde-sutil rounded-lg px-3 py-2 text-sm outline-none focus:border-marca-500 text-texto-primario" />
                      <input type="number" min="1" max="100" value={h.porcentaje}
                        onChange={(e) => editarHito(h.id, 'porcentaje', parseFloat(e.target.value) || 0)}
                        className="w-full bg-superficie-app border border-borde-sutil rounded-lg px-3 py-2 text-sm font-mono text-right outline-none focus:border-marca-500 text-texto-primario" />
                      <input type="number" min="0" value={h.diasDesdeEmision}
                        onChange={(e) => editarHito(h.id, 'diasDesdeEmision', parseInt(e.target.value) || 0)}
                        className="w-full bg-superficie-app border border-borde-sutil rounded-lg px-3 py-2 text-sm font-mono text-right outline-none focus:border-marca-500 text-texto-primario" />
                      <button onClick={() => eliminarHito(h.id)} className="flex items-center justify-center text-texto-terciario hover:text-estado-error transition-colors">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                </div>

                {/* Total */}
                {form.hitos.length > 0 && (
                  <div className="flex items-center gap-2 mt-3">
                    <span className="text-xs text-texto-secundario">Total:</span>
                    <span className={`text-sm font-bold ${totalHitos === 100 ? 'text-insignia-exito' : 'text-insignia-advertencia'}`}>
                      {totalHitos}%
                    </span>
                    {totalHitos === 100 && <Check size={14} className="text-insignia-exito" />}
                  </div>
                )}

                {/* Agregar cuota */}
                <button
                  onClick={agregarHito}
                  disabled={totalHitos >= 100}
                  className="w-full flex items-center justify-center gap-1.5 mt-3 px-3 py-2.5 rounded-lg border border-dashed border-borde-sutil text-sm text-texto-secundario hover:text-texto-primario hover:border-marca-500 transition-colors disabled:opacity-30"
                >
                  <Plus size={16} /> Agregar cuota
                </button>
              </div>

              {/* Nota adicional */}
              <div>
                <label className="text-xs text-texto-terciario font-medium block mb-1">Nota adicional</label>
                <input
                  type="text"
                  value={form.notaPlanPago}
                  onChange={(e) => setForm(p => ({ ...p, notaPlanPago: e.target.value }))}
                  placeholder="Ej: recargo 10% con tarjeta, solo transferencia..."
                  className="w-full bg-superficie-app border border-borde-sutil rounded-lg p-2.5 text-sm text-texto-primario placeholder:text-texto-placeholder outline-none focus:border-marca-500 transition-colors"
                />
                <p className="text-xs text-texto-terciario mt-1">Aparece debajo del plan de pagos en presupuestos, portal y PDF</p>
              </div>
            </>
          )}
        </div>

        {/* ── Vista previa ── */}
        <div className="bg-superficie-app/50 rounded-xl p-5 space-y-4 self-start sticky top-0">
          <div className="flex items-center gap-2">
            <Eye size={14} className="text-texto-terciario" />
            <span className="text-xs font-bold text-texto-terciario uppercase tracking-wider">Vista previa</span>
          </div>

          <div className="flex items-baseline gap-2 text-sm">
            <span className="text-texto-secundario">Ejemplo:</span>
            <span className="font-medium text-texto-primario">{fmtMonto(EJEMPLO_TOTAL)}</span>
            <span className="text-texto-terciario">el</span>
            <span className="font-medium text-texto-primario">{hoy.toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })}</span>
          </div>

          {form.tipo === 'plazo_fijo' ? (
            form.diasVencimiento !== '' ? (
              <div className="bg-superficie-app rounded-lg p-3">
                <p className="text-sm text-texto-primario">
                  Plazo <strong>#1</strong> de <strong>{fmtMonto(EJEMPLO_TOTAL)}</strong> a pagar antes del{' '}
                  <strong className="text-texto-marca">
                    {(() => {
                      const f = new Date(hoy)
                      f.setDate(f.getDate() + (parseInt(form.diasVencimiento) || 0))
                      return f.toLocaleDateString('es-AR')
                    })()}
                  </strong>
                </p>
              </div>
            ) : null
          ) : form.hitos.length > 0 ? (
            <div className="bg-superficie-app rounded-lg p-3 space-y-2">
              {form.hitos.map((h, i) => {
                const monto = (EJEMPLO_TOTAL * h.porcentaje) / 100
                const fechaVenc = new Date(hoy)
                fechaVenc.setDate(fechaVenc.getDate() + (h.diasDesdeEmision || 0))
                return (
                  <p key={h.id} className="text-sm text-texto-primario">
                    Plazo <strong>#{i + 1}</strong> de <strong>{fmtMonto(monto)}</strong> a pagar antes del{' '}
                    <strong className="text-texto-marca">{fechaVenc.toLocaleDateString('es-AR')}</strong>
                  </p>
                )
              })}
              {form.notaPlanPago && (
                <p className="text-xs text-texto-terciario italic pt-1 border-t border-borde-sutil mt-2">{form.notaPlanPago}</p>
              )}
            </div>
          ) : (
            <p className="text-xs text-texto-terciario italic">Agregá al menos un hito para ver la vista previa</p>
          )}
        </div>
      </div>
    </Modal>
  )
}
