'use client'

import { useState, useEffect } from 'react'
import { Plus, Trash2, Eye, Check } from 'lucide-react'
import { ModalAdaptable as Modal } from '@/componentes/ui/ModalAdaptable'
import { Boton } from '@/componentes/ui/Boton'
import { Input } from '@/componentes/ui/Input'
import { Select } from '@/componentes/ui/Select'
import type { CondicionPago } from '@/tipos/presupuesto'
import { useTraduccion } from '@/lib/i18n'
import { useFormato } from '@/hooks/useFormato'

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

export default function ModalCondicionPago({ abierto, onCerrar, onGuardar, condicionEditar }: PropiedadesModal) {
  const { t } = useTraduccion()
  const formato = useFormato()
  const fmtMonto = (v: number) => formato.moneda(v)
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
      titulo={esEdicion ? 'Editar condición de pago' : 'Nueva condición de pago'}
      tamano="4xl"
      sinPadding
      acciones={
        <>
          <Boton variante="fantasma" onClick={onCerrar}>Cancelar</Boton>
          <Boton onClick={guardar} disabled={!puedeGuardar}>
            {esEdicion ? 'Guardar cambios' : 'Agregar'}
          </Boton>
        </>
      }
    >
      {/* ══ Grid 2 columnas con divisor 1px ══ */}
      <div className="grid grid-cols-1 md:grid-cols-[1fr_1px_260px] gap-0 border-y border-white/[0.07]">

        {/* ── COL IZQUIERDA — formulario ── */}
        <div className="p-6 space-y-4">
          {/* Nombre */}
          <div>
            <p className="text-[11px] text-texto-terciario mb-1.5">Nombre</p>
            <Input value={form.label}
              onChange={(e) => { setForm(p => ({ ...p, label: e.target.value })); setNombreManual(true) }}
              placeholder="Se genera automáticamente..." formato={null} disabled={!nombreManual && !esEdicion} />
            <p className="text-[11px] text-texto-terciario mt-1">Se genera según la configuración elegida</p>
          </div>

          <div className="border-t border-white/[0.07]" />

          {/* Tipo */}
          <div>
            <p className="text-[11px] text-texto-terciario mb-1.5">Tipo de condición</p>
            <Select valor={form.tipo}
              onChange={(v) => setForm(p => ({ ...p, tipo: v as 'plazo_fijo' | 'hitos', hitos: v === 'plazo_fijo' ? [] : p.hitos }))}
              opciones={[
                { valor: 'plazo_fijo', etiqueta: 'Plazo fijo (días)' },
                { valor: 'hitos', etiqueta: 'Por hitos (porcentajes)' },
              ]} />
            <div className="flex items-start gap-2 mt-2 px-3 py-2 rounded-lg border border-white/[0.06] bg-white/[0.02]">
              <span className="text-[11px] text-texto-terciario leading-relaxed">
                {form.tipo === 'plazo_fijo'
                  ? 'El total vence X días después de la fecha de emisión.'
                  : 'Divide el pago en cuotas con porcentaje y plazo individual.'}
              </span>
            </div>
          </div>

          {/* Campos según tipo */}
          {form.tipo === 'plazo_fijo' ? (
            <div>
              <p className="text-[11px] text-texto-terciario mb-1.5">Días de vencimiento</p>
              <Input tipo="number" min="0" value={form.diasVencimiento}
                onChange={(e) => setForm(p => ({ ...p, diasVencimiento: e.target.value }))}
                placeholder="30" />
            </div>
          ) : (
            <>
              <div>
                <p className="text-[11px] font-medium text-texto-terciario uppercase tracking-wider mb-2.5">Cuotas de pago</p>

                {form.hitos.length > 0 && (
                  <div className="grid grid-cols-[1fr_80px_80px_28px] gap-2 px-2 mb-1.5">
                    <span className="text-[10px] text-texto-terciario uppercase tracking-wider">Descripción</span>
                    <span className="text-[10px] text-texto-terciario uppercase tracking-wider text-right">%</span>
                    <span className="text-[10px] text-texto-terciario uppercase tracking-wider text-right">Días</span>
                    <span />
                  </div>
                )}

                <div className="space-y-1.5">
                  {form.hitos.map((h) => (
                    <div key={h.id} className="grid grid-cols-[1fr_80px_80px_28px] gap-2 items-center">
                      <Input compacto value={h.descripcion}
                        onChange={(e) => editarHito(h.id, 'descripcion', e.target.value)}
                        placeholder="Ej: Adelanto" formato={null} />
                      <Input compacto tipo="number" min="1" max="100" value={h.porcentaje}
                        onChange={(e) => editarHito(h.id, 'porcentaje', parseFloat(e.target.value) || 0)}
                        className="font-mono text-right" />
                      <Input compacto tipo="number" min="0" value={h.diasDesdeEmision}
                        onChange={(e) => editarHito(h.id, 'diasDesdeEmision', parseInt(e.target.value) || 0)}
                        className="font-mono text-right" />
                      <Boton variante="fantasma" tamano="xs" soloIcono titulo="Eliminar"
                        icono={<Trash2 size={13} />} onClick={() => eliminarHito(h.id)}
                        className="text-texto-terciario hover:text-estado-error" />
                    </div>
                  ))}
                </div>

                {form.hitos.length > 0 && (
                  <div className="flex items-center gap-2 mt-2">
                    <span className="text-xs text-texto-secundario">Total:</span>
                    <span className={`text-sm font-bold ${totalHitos === 100 ? 'text-insignia-exito' : 'text-insignia-advertencia'}`}>
                      {totalHitos}%
                    </span>
                    {totalHitos === 100 && <Check size={14} className="text-insignia-exito" />}
                  </div>
                )}

                <Boton variante="secundario" tamano="sm" anchoCompleto icono={<Plus size={14} />}
                  onClick={agregarHito} disabled={totalHitos >= 100} className="mt-2 border-dashed">
                  Agregar cuota
                </Boton>
              </div>

              <Input value={form.notaPlanPago}
                onChange={(e) => setForm(p => ({ ...p, notaPlanPago: e.target.value }))}
                placeholder="Nota: recargo 10% tarjeta, solo transferencia..."
                formato={null} />
            </>
          )}
        </div>

        {/* Divisor vertical */}
        <div className="hidden md:block bg-white/[0.07]" />

        {/* ── COL DERECHA — vista previa ── */}
        <div className="p-6">
          <p className="text-[11px] font-medium text-texto-terciario uppercase tracking-wider mb-3">Vista previa</p>

          <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-4 space-y-3">
            <p className="text-sm font-medium text-texto-primario">{form.label || '...'}</p>

            <div className="border-t border-white/[0.06]" />

            {form.tipo === 'plazo_fijo' && form.diasVencimiento !== '' && (
              <div>
                <p className="text-[10px] text-texto-terciario uppercase tracking-wider mb-1">Ejemplo para {fmtMonto(EJEMPLO_TOTAL)}</p>
                <p className="text-xl font-medium text-texto-primario">{fmtMonto(EJEMPLO_TOTAL)}</p>
                <p className="text-xs text-texto-terciario mt-1">
                  Vence el{' '}
                  <span className="text-texto-marca font-medium">
                    {(() => {
                      const f = new Date(hoy)
                      f.setDate(f.getDate() + (parseInt(form.diasVencimiento) || 0))
                      return formato.fecha(f, { corta: true })
                    })()}
                  </span>
                </p>
              </div>
            )}

            {form.tipo === 'hitos' && form.hitos.length > 0 && (
              <div className="space-y-2">
                <p className="text-[10px] text-texto-terciario uppercase tracking-wider">Ejemplo para {fmtMonto(EJEMPLO_TOTAL)}</p>
                {form.hitos.map((h, i) => {
                  const monto = (EJEMPLO_TOTAL * h.porcentaje) / 100
                  const fechaVenc = new Date(hoy)
                  fechaVenc.setDate(fechaVenc.getDate() + (h.diasDesdeEmision || 0))
                  return (
                    <div key={h.id} className="flex items-baseline justify-between">
                      <span className="text-xs text-texto-secundario">#{i + 1} {h.descripcion}</span>
                      <div className="text-right">
                        <span className="text-sm font-medium text-texto-primario">{fmtMonto(monto)}</span>
                        <p className="text-[10px] text-texto-terciario">
                          <span className="text-texto-marca">{formato.fecha(fechaVenc, { corta: true })}</span>
                        </p>
                      </div>
                    </div>
                  )
                })}
                {form.notaPlanPago && (
                  <p className="text-[11px] text-texto-terciario italic pt-2 border-t border-white/[0.06]">{form.notaPlanPago}</p>
                )}
              </div>
            )}

            {form.tipo === 'hitos' && form.hitos.length === 0 && (
              <p className="text-xs text-texto-terciario italic">Agregá cuotas para ver la vista previa</p>
            )}
          </div>
        </div>
      </div>
    </Modal>
  )
}
