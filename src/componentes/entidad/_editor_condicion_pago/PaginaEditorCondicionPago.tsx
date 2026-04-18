'use client'

/**
 * PaginaEditorCondicionPago — Editor pantalla completa de una condición de pago.
 * Las condiciones viven en un array JSON dentro de presupuestos_config.condiciones_pago
 * (no tienen tabla propia), así que al guardar reconstruye el array entero.
 *
 * Layout:
 * - Panel izq: tipo + configuración (plazo/hitos) + nota + vista previa con ejemplo
 * - Main: nombre + tabla de hitos (si corresponde) o días de vencimiento
 */

import { useEffect, useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Save, Trash2, Check } from 'lucide-react'
import { PlantillaEditor } from '@/componentes/entidad/PlantillaEditor'
import { Input } from '@/componentes/ui/Input'
import { Select } from '@/componentes/ui/Select'
import { useToast } from '@/componentes/feedback/Toast'
import { useTraduccion } from '@/lib/i18n'
import { useFormato } from '@/hooks/useFormato'
import type { CondicionPago, HitoPago } from '@/tipos/presupuesto'

interface Props {
  /** Condición a editar (null = nueva) */
  condicion: CondicionPago | null
  /** Array completo actual — se usa para reconstruir al guardar */
  condicionesActuales: CondicionPago[]
  /** Ruta a la que volver */
  rutaVolver: string
  /** Texto del botón volver */
  textoVolver?: string
}

const FORM_VACIO = {
  label: '',
  tipo: 'plazo_fijo' as const,
  diasVencimiento: '',
  hitos: [] as HitoPago[],
  notaPlanPago: '',
}

export function PaginaEditorCondicionPago({
  condicion,
  condicionesActuales,
  rutaVolver,
  textoVolver = 'Condiciones de pago',
}: Props) {
  const router = useRouter()
  const { t } = useTraduccion()
  const formato = useFormato()
  const { mostrar } = useToast()
  const esEdicion = !!condicion

  const fmtMonto = (v: number) => formato.moneda(v)
  const EJEMPLO_TOTAL = 1000
  const hoy = new Date()

  const [nombre, setNombre] = useState(condicion?.label || '')
  const [tipo, setTipo] = useState<'plazo_fijo' | 'hitos'>(condicion?.tipo || 'plazo_fijo')
  const [diasVencimiento, setDiasVencimiento] = useState(
    condicion?.diasVencimiento !== undefined ? String(condicion.diasVencimiento) : '',
  )
  const [hitos, setHitos] = useState<HitoPago[]>(condicion?.hitos?.map(h => ({ ...h })) || [])
  const [notaPlanPago, setNotaPlanPago] = useState(condicion?.notaPlanPago || '')
  const [nombreManual, setNombreManual] = useState(esEdicion)
  const [guardando, setGuardando] = useState(false)

  const totalHitos = hitos.reduce((s, h) => s + h.porcentaje, 0)

  // ─── Auto-generar nombre ───
  useEffect(() => {
    if (nombreManual || esEdicion) return
    let autoNombre = ''
    if (tipo === 'plazo_fijo') {
      const dias = parseInt(diasVencimiento) || 0
      autoNombre = dias === 0 ? 'Contado' : `${dias} días`
    } else if (hitos.length > 0) {
      autoNombre = hitos.map(h => `${h.porcentaje}% ${h.descripcion || ''}`.trim()).join(' + ')
    }
    if (autoNombre && autoNombre !== nombre) setNombre(autoNombre)
  }, [tipo, diasVencimiento, hitos, nombreManual, esEdicion, nombre])

  // ─── Helpers ───
  const agregarHito = () => {
    if (totalHitos >= 100) return
    const restante = 100 - totalHitos
    setHitos(prev => [...prev, {
      id: `h_${Date.now()}_${prev.length}`,
      descripcion: prev.length === 0 ? 'Adelanto' : 'Saldo',
      porcentaje: Math.min(restante, 50),
      diasDesdeEmision: 0,
    }])
  }

  const editarHito = (id: string, campo: string, valor: string | number) => {
    setHitos(prev => prev.map(h => h.id === id ? { ...h, [campo]: valor } : h))
  }

  const eliminarHito = (id: string) => setHitos(prev => prev.filter(h => h.id !== id))

  const puedeGuardar = nombre.trim() !== '' && (
    tipo === 'plazo_fijo' || (hitos.length >= 1 && Math.abs(totalHitos - 100) <= 0.01)
  )

  // ─── Guardar ───
  const handleGuardar = async () => {
    if (!puedeGuardar) return
    setGuardando(true)
    try {
      const nuevaCondicion: CondicionPago = {
        id: condicion?.id || nombre.trim().toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, ''),
        label: nombre.trim(),
        tipo,
        diasVencimiento: tipo === 'plazo_fijo' ? (parseInt(diasVencimiento) || 0) : 0,
        hitos: tipo === 'hitos' ? hitos : [],
        notaPlanPago: notaPlanPago.trim(),
        predeterminado: condicion?.predeterminado || false,
        activo: condicion?.activo !== false,
      }

      // Reconstruir array: reemplazar si existe, agregar si es nueva
      const nuevas = esEdicion && condicion
        ? condicionesActuales.map(c => c.id === condicion.id ? nuevaCondicion : c)
        : [...condicionesActuales, nuevaCondicion]

      const res = await fetch('/api/presupuestos/config', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ condiciones_pago: nuevas }),
      })
      if (!res.ok) throw new Error('Error al guardar')

      mostrar('exito', esEdicion ? 'Condición actualizada' : 'Condición creada')
      router.push(rutaVolver)
    } catch {
      mostrar('error', 'Error al guardar la condición')
    } finally {
      setGuardando(false)
    }
  }

  // ─── Acciones del cabecero ───
  const acciones = [
    {
      id: 'guardar',
      etiqueta: esEdicion ? 'Guardar' : 'Crear condición',
      icono: <Save size={14} />,
      onClick: handleGuardar,
      variante: 'primario' as const,
      cargando: guardando,
      deshabilitado: !puedeGuardar,
    },
  ]

  // ─── Vista previa ───
  const preview = useMemo(() => {
    if (tipo === 'plazo_fijo') {
      const dias = parseInt(diasVencimiento) || 0
      const f = new Date(hoy)
      f.setDate(f.getDate() + dias)
      return {
        tipo: 'plazo' as const,
        fecha: formato.fecha(f, { corta: true }),
        monto: fmtMonto(EJEMPLO_TOTAL),
      }
    }
    return {
      tipo: 'hitos' as const,
      items: hitos.map((h, i) => {
        const monto = (EJEMPLO_TOTAL * h.porcentaje) / 100
        const fechaVenc = new Date(hoy)
        fechaVenc.setDate(fechaVenc.getDate() + (h.diasDesdeEmision || 0))
        return {
          n: i + 1,
          descripcion: h.descripcion,
          monto: fmtMonto(monto),
          fecha: formato.fecha(fechaVenc, { corta: true }),
        }
      }),
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tipo, diasVencimiento, hitos])

  // ─── Panel izq: config + vista previa ───
  const panelConfig = (
    <div className="space-y-5">
      {/* Tipo */}
      <div className="space-y-2">
        <label className="text-[11px] font-medium text-texto-terciario uppercase tracking-wider block">
          Tipo de condición
        </label>
        <Select
          valor={tipo}
          onChange={(v) => {
            const nuevoTipo = v as 'plazo_fijo' | 'hitos'
            setTipo(nuevoTipo)
            if (nuevoTipo === 'plazo_fijo') setHitos([])
          }}
          opciones={[
            { valor: 'plazo_fijo', etiqueta: 'Plazo fijo (días)' },
            { valor: 'hitos', etiqueta: 'Por hitos (porcentajes)' },
          ]}
        />
        <p className="text-[11px] text-texto-terciario">
          {tipo === 'plazo_fijo'
            ? 'El total vence X días después de la fecha de emisión.'
            : 'Divide el pago en cuotas con porcentaje y plazo individual.'}
        </p>
      </div>

      {/* Nota interna (solo si hitos) */}
      {tipo === 'hitos' && (
        <div className="space-y-2">
          <label className="text-[11px] font-medium text-texto-terciario uppercase tracking-wider block">
            Nota interna
          </label>
          <Input
            value={notaPlanPago}
            onChange={(e) => setNotaPlanPago(e.target.value)}
            placeholder="Ej: recargo 10% tarjeta, solo transferencia..."
            formato={null}
          />
        </div>
      )}

      {/* Vista previa */}
      <div className="space-y-2 pt-3 border-t border-borde-sutil">
        <label className="text-[11px] font-medium text-texto-terciario uppercase tracking-wider block">
          Vista previa
        </label>
        <div className="rounded-card border border-white/[0.06] bg-white/[0.02] p-3 space-y-3">
          <p className="text-sm font-medium text-texto-primario">{nombre || '...'}</p>
          <div className="border-t border-white/[0.06]" />

          {preview.tipo === 'plazo' && diasVencimiento !== '' && (
            <div>
              <p className="text-[10px] text-texto-terciario uppercase tracking-wider mb-1">
                Ejemplo para {preview.monto}
              </p>
              <p className="text-xl font-medium text-texto-primario">{preview.monto}</p>
              <p className="text-xs text-texto-terciario mt-1">
                Vence el <span className="text-texto-marca font-medium">{preview.fecha}</span>
              </p>
            </div>
          )}

          {preview.tipo === 'hitos' && preview.items.length > 0 && (
            <div className="space-y-2">
              <p className="text-[10px] text-texto-terciario uppercase tracking-wider">
                Ejemplo para {fmtMonto(EJEMPLO_TOTAL)}
              </p>
              {preview.items.map((it) => (
                <div key={it.n} className="flex items-baseline justify-between">
                  <span className="text-xs text-texto-secundario">
                    #{it.n} {it.descripcion}
                  </span>
                  <div className="text-right">
                    <span className="text-sm font-medium text-texto-primario">{it.monto}</span>
                    <p className="text-[10px] text-texto-terciario">
                      <span className="text-texto-marca">{it.fecha}</span>
                    </p>
                  </div>
                </div>
              ))}
              {notaPlanPago && (
                <p className="text-[11px] text-texto-terciario italic pt-2 border-t border-white/[0.06]">
                  {notaPlanPago}
                </p>
              )}
            </div>
          )}

          {preview.tipo === 'hitos' && preview.items.length === 0 && (
            <p className="text-xs text-texto-terciario italic">Agregá cuotas para ver la vista previa</p>
          )}
        </div>
      </div>
    </div>
  )

  return (
    <PlantillaEditor
      titulo={esEdicion ? (nombre || condicion?.label || 'Editar condición de pago') : 'Nueva condición de pago'}
      subtitulo="Condición de pago — aparece en el selector al crear presupuestos"
      volverTexto={textoVolver}
      onVolver={() => router.push(rutaVolver)}
      acciones={acciones}
      panelConfig={panelConfig}
    >
      {/* ═══ NOMBRE ═══ */}
      <div className="space-y-3 pb-4 border-b border-borde-sutil">
        <div className="space-y-1">
          <label className="text-[11px] font-medium text-texto-terciario uppercase tracking-wider block">
            Nombre
          </label>
          <Input
            value={nombre}
            onChange={(e) => { setNombre(e.target.value); setNombreManual(true) }}
            placeholder="Se genera automáticamente..."
            formato={null}
            disabled={!nombreManual && !esEdicion}
            className="!text-base !font-semibold"
          />
          <p className="text-[11px] text-texto-terciario">
            {nombreManual ? 'Editado manualmente' : 'Se genera según la configuración elegida'}
          </p>
        </div>
      </div>

      {/* ═══ CAMPOS SEGÚN TIPO ═══ */}
      <div className="pt-4">
        {tipo === 'plazo_fijo' ? (
          <div className="space-y-2">
            <label className="text-[11px] font-medium text-texto-terciario uppercase tracking-wider block">
              Días de vencimiento
            </label>
            <Input
              tipo="number"
              min="0"
              value={diasVencimiento}
              onChange={(e) => setDiasVencimiento(e.target.value)}
              placeholder="30"
            />
            <p className="text-[11px] text-texto-terciario">
              0 días = contado. Se cuenta desde la fecha de emisión del presupuesto.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-medium text-texto-terciario uppercase tracking-wider">
                Cuotas de pago
              </label>
              <span className={`text-xs font-medium ${totalHitos === 100 ? 'text-insignia-exito' : 'text-insignia-advertencia'}`}>
                Total: {totalHitos}%
                {totalHitos === 100 && <Check size={12} className="inline ml-1" />}
              </span>
            </div>

            {/* Tabla de hitos */}
            <div className="rounded-card border border-white/[0.08] overflow-hidden">
              <div className="grid grid-cols-[1fr_90px_90px_40px] bg-white/[0.03] border-b border-white/[0.07]">
                <span className="px-3 py-2 text-[10px] font-medium text-texto-terciario uppercase tracking-wider">Descripción</span>
                <span className="px-3 py-2 text-[10px] font-medium text-texto-terciario uppercase tracking-wider text-right">%</span>
                <span className="px-3 py-2 text-[10px] font-medium text-texto-terciario uppercase tracking-wider text-right">Días</span>
                <span />
              </div>

              {hitos.map((h) => (
                <div key={h.id} className="grid grid-cols-[1fr_90px_90px_40px] border-b border-white/[0.06] last:border-b-0 items-center group hover:bg-white/[0.02] transition-colors">
                  <div className="px-2 py-1.5">
                    <Input
                      compacto
                      value={h.descripcion}
                      onChange={(e) => editarHito(h.id, 'descripcion', e.target.value)}
                      placeholder="Descripción..."
                      formato={null}
                    />
                  </div>
                  <div className="px-2 py-1.5">
                    <Input
                      compacto
                      tipo="number"
                      min="1"
                      max="100"
                      value={h.porcentaje}
                      onChange={(e) => editarHito(h.id, 'porcentaje', parseFloat(e.target.value) || 0)}
                      className="font-mono text-right"
                    />
                  </div>
                  <div className="px-2 py-1.5">
                    <Input
                      compacto
                      tipo="number"
                      min="0"
                      value={h.diasDesdeEmision}
                      onChange={(e) => editarHito(h.id, 'diasDesdeEmision', parseInt(e.target.value) || 0)}
                      className="font-mono text-right"
                    />
                  </div>
                  <div className="flex justify-center">
                    <button
                      onClick={() => eliminarHito(h.id)}
                      className="size-6 rounded-boton flex items-center justify-center bg-transparent border-none cursor-pointer text-texto-terciario/40 hover:text-insignia-peligro hover:bg-insignia-peligro/10 transition-colors opacity-0 group-hover:opacity-100"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>
              ))}

              {hitos.length === 0 && (
                <div className="px-3 py-6 text-center">
                  <p className="text-xs text-texto-terciario">Sin cuotas. Agregá una para empezar.</p>
                </div>
              )}
            </div>

            {/* Agregar cuota */}
            <button
              onClick={agregarHito}
              disabled={totalHitos >= 100}
              className="w-full flex items-center justify-center gap-1.5 py-2 rounded-card border border-dashed border-texto-marca/25 bg-transparent text-xs text-texto-marca/70 cursor-pointer hover:bg-texto-marca/5 hover:border-texto-marca/40 hover:text-texto-marca transition-all disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <Plus size={13} />
              Agregar cuota
            </button>

            {totalHitos !== 100 && hitos.length > 0 && (
              <p className="text-[11px] text-insignia-advertencia">
                El total debe sumar 100% para poder guardar (actualmente {totalHitos}%).
              </p>
            )}
          </div>
        )}
      </div>
    </PlantillaEditor>
  )
}
