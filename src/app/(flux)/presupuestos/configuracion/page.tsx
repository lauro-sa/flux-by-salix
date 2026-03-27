'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import {
  Plus, Trash2, GripVertical, Receipt, DollarSign,
  Ruler, Clock, Hash, FileText, RotateCcw,
} from 'lucide-react'
import { Reorder } from 'framer-motion'
import { PlantillaConfiguracion } from '@/componentes/entidad/PlantillaConfiguracion'
import type { SeccionConfig } from '@/componentes/entidad/PlantillaConfiguracion'
import type { Impuesto, Moneda, UnidadMedida, CondicionPago } from '@/tipos/presupuesto'

/**
 * Página de configuración de presupuestos.
 * Usa PlantillaConfiguracion para layout consistente.
 * Autoguardado al cambiar cualquier campo.
 * Drag & drop en condiciones de pago para reordenar.
 */

// Condiciones de pago por defecto (para restablecer)
const CONDICIONES_PAGO_DEFAULT: CondicionPago[] = [
  { id: 'contado', label: 'Contado', tipo: 'plazo_fijo', diasVencimiento: 0, hitos: [], notaPlanPago: '', predeterminado: false },
  { id: 'pago_anticipado', label: '100% Pago anticipado', tipo: 'plazo_fijo', diasVencimiento: 0, hitos: [], notaPlanPago: '', predeterminado: false },
  { id: '7dias', label: '100% a 7 días de facturación', tipo: 'plazo_fijo', diasVencimiento: 7, hitos: [], notaPlanPago: '', predeterminado: false },
  { id: '15dias', label: '15 días', tipo: 'plazo_fijo', diasVencimiento: 15, hitos: [], notaPlanPago: '', predeterminado: false },
  { id: '30dias', label: '30 días', tipo: 'plazo_fijo', diasVencimiento: 30, hitos: [], notaPlanPago: '', predeterminado: true },
  { id: '60dias', label: '60 días', tipo: 'plazo_fijo', diasVencimiento: 60, hitos: [], notaPlanPago: '', predeterminado: false },
  { id: '50_50', label: '50% adelanto + 50% al finalizar', tipo: 'hitos', diasVencimiento: 0, hitos: [
    { id: 'h1', porcentaje: 50, descripcion: 'Adelanto', diasDesdeEmision: 0 },
    { id: 'h2', porcentaje: 50, descripcion: 'Al finalizar', diasDesdeEmision: 0 },
  ], notaPlanPago: '', predeterminado: false },
  { id: '60_40', label: '60% adelanto + 40% al finalizar', tipo: 'hitos', diasVencimiento: 0, hitos: [
    { id: 'h1', porcentaje: 60, descripcion: 'Adelanto', diasDesdeEmision: 0 },
    { id: 'h2', porcentaje: 40, descripcion: 'Al finalizar', diasDesdeEmision: 0 },
  ], notaPlanPago: '', predeterminado: false },
  { id: '75_25', label: '75% adelanto + 25% al finalizar', tipo: 'hitos', diasVencimiento: 0, hitos: [
    { id: 'h1', porcentaje: 75, descripcion: 'Adelanto', diasDesdeEmision: 0 },
    { id: 'h2', porcentaje: 25, descripcion: 'Al finalizar', diasDesdeEmision: 0 },
  ], notaPlanPago: '', predeterminado: false },
]

export default function PaginaConfigPresupuestos() {
  const router = useRouter()
  const [cargando, setCargando] = useState(true)
  const [seccionActiva, setSeccionActiva] = useState('impuestos')
  const autoguardadoRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Datos
  const [impuestos, setImpuestos] = useState<Impuesto[]>([])
  const [monedas, setMonedas] = useState<Moneda[]>([])
  const [monedaPredeterminada, setMonedaPredeterminada] = useState('ARS')
  const [unidades, setUnidades] = useState<UnidadMedida[]>([])
  const [condicionesPago, setCondicionesPago] = useState<CondicionPago[]>([])
  const [diasVencimiento, setDiasVencimiento] = useState(30)
  const [condicionesDefault, setCondicionesDefault] = useState('')
  const [notasDefault, setNotasDefault] = useState('')
  const [prefijo, setPrefijo] = useState('P')
  const [digitos, setDigitos] = useState(4)
  const [siguiente, setSiguiente] = useState(1)

  const secciones: SeccionConfig[] = [
    { id: 'impuestos', etiqueta: 'Impuestos', icono: <Receipt size={16} />, grupo: 'Financiero' },
    { id: 'monedas', etiqueta: 'Monedas', icono: <DollarSign size={16} />, grupo: 'Financiero' },
    { id: 'unidades', etiqueta: 'Unidades de medida', icono: <Ruler size={16} />, grupo: 'Financiero' },
    { id: 'condiciones', etiqueta: 'Condiciones de pago', icono: <Clock size={16} />, grupo: 'Financiero' },
    { id: 'numeracion', etiqueta: 'Numeración', icono: <Hash size={16} />, grupo: 'Documento' },
    { id: 'textos', etiqueta: 'Textos por defecto', icono: <FileText size={16} />, grupo: 'Documento' },
  ]

  // Cargar config
  useEffect(() => {
    fetch('/api/presupuestos/config')
      .then(r => r.json())
      .then(data => {
        setImpuestos((data.impuestos as Impuesto[]) || [])
        setMonedas((data.monedas as Moneda[]) || [])
        setMonedaPredeterminada(data.moneda_predeterminada || 'ARS')
        setUnidades((data.unidades as UnidadMedida[]) || [])
        setCondicionesPago((data.condiciones_pago as CondicionPago[]) || [])
        setDiasVencimiento(data.dias_vencimiento_predeterminado || 30)
        setCondicionesDefault(data.condiciones_predeterminadas || '')
        setNotasDefault(data.notas_predeterminadas || '')
        if (data.secuencia) {
          setPrefijo(data.secuencia.prefijo || 'P')
          setDigitos(data.secuencia.digitos || 4)
          setSiguiente(data.secuencia.siguiente || 1)
        }
        setCargando(false)
      })
      .catch(() => setCargando(false))
  }, [])

  // Autoguardar (debounce 800ms)
  const autoguardar = useCallback((camposExtra?: Record<string, unknown>) => {
    if (autoguardadoRef.current) clearTimeout(autoguardadoRef.current)
    autoguardadoRef.current = setTimeout(async () => {
      await fetch('/api/presupuestos/config', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(camposExtra),
      })
    }, 800)
  }, [])

  // Helpers para autoguardar al cambiar cada campo
  const guardarImpuestos = (nuevos: Impuesto[]) => { setImpuestos(nuevos); autoguardar({ impuestos: nuevos }) }
  const guardarMonedas = (nuevas: Moneda[], monDefault?: string) => {
    setMonedas(nuevas)
    const campos: Record<string, unknown> = { monedas: nuevas }
    if (monDefault !== undefined) { setMonedaPredeterminada(monDefault); campos.moneda_predeterminada = monDefault }
    autoguardar(campos)
  }
  const guardarUnidades = (nuevas: UnidadMedida[]) => { setUnidades(nuevas); autoguardar({ unidades: nuevas }) }
  const guardarCondiciones = (nuevas: CondicionPago[]) => { setCondicionesPago(nuevas); autoguardar({ condiciones_pago: nuevas }) }
  const guardarNumeracion = (p: string, d: number, s: number) => {
    setPrefijo(p); setDigitos(d); setSiguiente(s)
    autoguardar({ secuencia: { prefijo: p, digitos: d, siguiente: s } })
  }
  const guardarTextos = (campo: string, valor: string | number) => {
    if (campo === 'notas') { setNotasDefault(valor as string); autoguardar({ notas_predeterminadas: valor || null }) }
    if (campo === 'condiciones') { setCondicionesDefault(valor as string); autoguardar({ condiciones_predeterminadas: valor || null }) }
    if (campo === 'dias') { setDiasVencimiento(valor as number); autoguardar({ dias_vencimiento_predeterminado: valor }) }
  }

  if (cargando) {
    return <div className="flex items-center justify-center h-64 text-texto-terciario text-sm">Cargando configuración...</div>
  }

  return (
    <PlantillaConfiguracion
      titulo="Configuración de presupuestos"
      secciones={secciones}
      seccionActiva={seccionActiva}
      onCambiarSeccion={setSeccionActiva}
    >
      {/* ─── IMPUESTOS ─── */}
      {seccionActiva === 'impuestos' && (
        <div>
          <h2 className="text-base font-semibold text-texto-primario mb-1">Impuestos</h2>
          <p className="text-sm text-texto-terciario mb-4">Impuestos disponibles al crear líneas de presupuesto.</p>
          <div className="space-y-2">
            {impuestos.map((imp, idx) => (
              <div key={imp.id} className="flex items-center gap-2 p-2 bg-superficie-app rounded-lg">
                <input
                  type="text" value={imp.label}
                  onChange={(e) => { const n = [...impuestos]; n[idx] = { ...imp, label: e.target.value }; setImpuestos(n) }}
                  onBlur={() => guardarImpuestos(impuestos)}
                  className="flex-1 bg-transparent border-0 outline-none text-sm text-texto-primario"
                />
                <input
                  type="number" value={imp.porcentaje}
                  onChange={(e) => { const n = [...impuestos]; n[idx] = { ...imp, porcentaje: parseFloat(e.target.value) || 0 }; setImpuestos(n) }}
                  onBlur={() => guardarImpuestos(impuestos)}
                  className="w-20 bg-transparent border border-borde-sutil rounded px-2 py-1 text-sm text-right font-mono outline-none"
                />
                <span className="text-xs text-texto-terciario">%</span>
                <label className="flex items-center gap-1 text-xs text-texto-terciario cursor-pointer">
                  <input type="checkbox" checked={imp.activo}
                    onChange={(e) => { const n = [...impuestos]; n[idx] = { ...imp, activo: e.target.checked }; guardarImpuestos(n) }}
                    className="rounded" />
                  Activo
                </label>
                <button onClick={() => guardarImpuestos(impuestos.filter((_, i) => i !== idx))} className="p-1 text-texto-terciario hover:text-estado-error">
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
            <button
              onClick={() => guardarImpuestos([...impuestos, { id: `imp-${Date.now()}`, label: 'Nuevo impuesto', porcentaje: 0, activo: true }])}
              className="flex items-center gap-1 text-sm text-texto-marca hover:underline"
            >
              <Plus size={14} /> Agregar impuesto
            </button>
          </div>
        </div>
      )}

      {/* ─── MONEDAS ─── */}
      {seccionActiva === 'monedas' && (
        <div>
          <h2 className="text-base font-semibold text-texto-primario mb-1">Monedas</h2>
          <p className="text-sm text-texto-terciario mb-4">Monedas disponibles para presupuestos.</p>
          <div className="space-y-2">
            {monedas.map((mon, idx) => (
              <div key={mon.id} className="flex items-center gap-2 p-2 bg-superficie-app rounded-lg">
                <input type="text" value={mon.id}
                  onChange={(e) => { const n = [...monedas]; n[idx] = { ...mon, id: e.target.value.toUpperCase() }; setMonedas(n) }}
                  onBlur={() => guardarMonedas(monedas)}
                  className="w-16 bg-transparent border border-borde-sutil rounded px-2 py-1 text-sm font-mono outline-none" />
                <input type="text" value={mon.simbolo}
                  onChange={(e) => { const n = [...monedas]; n[idx] = { ...mon, simbolo: e.target.value }; setMonedas(n) }}
                  onBlur={() => guardarMonedas(monedas)}
                  className="w-12 bg-transparent border border-borde-sutil rounded px-2 py-1 text-sm text-center outline-none" />
                <input type="text" value={mon.label}
                  onChange={(e) => { const n = [...monedas]; n[idx] = { ...mon, label: e.target.value }; setMonedas(n) }}
                  onBlur={() => guardarMonedas(monedas)}
                  className="flex-1 bg-transparent border-0 outline-none text-sm text-texto-primario" />
                <label className="flex items-center gap-1 text-xs text-texto-terciario cursor-pointer">
                  <input type="radio" name="moneda_default" checked={monedaPredeterminada === mon.id}
                    onChange={() => guardarMonedas(monedas, mon.id)} />
                  Default
                </label>
                <label className="flex items-center gap-1 text-xs text-texto-terciario cursor-pointer">
                  <input type="checkbox" checked={mon.activo}
                    onChange={(e) => { const n = [...monedas]; n[idx] = { ...mon, activo: e.target.checked }; guardarMonedas(n) }}
                    className="rounded" />
                  Activo
                </label>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ─── UNIDADES ─── */}
      {seccionActiva === 'unidades' && (
        <div>
          <h2 className="text-base font-semibold text-texto-primario mb-1">Unidades de medida</h2>
          <p className="text-sm text-texto-terciario mb-4">Unidades disponibles para las líneas del presupuesto.</p>
          <div className="space-y-2">
            {unidades.map((uni, idx) => (
              <div key={uni.id} className="flex items-center gap-2 p-2 bg-superficie-app rounded-lg">
                <input type="text" value={uni.abreviatura}
                  onChange={(e) => { const n = [...unidades]; n[idx] = { ...uni, abreviatura: e.target.value }; setUnidades(n) }}
                  onBlur={() => guardarUnidades(unidades)}
                  className="w-16 bg-transparent border border-borde-sutil rounded px-2 py-1 text-sm font-mono outline-none" />
                <input type="text" value={uni.label}
                  onChange={(e) => { const n = [...unidades]; n[idx] = { ...uni, label: e.target.value }; setUnidades(n) }}
                  onBlur={() => guardarUnidades(unidades)}
                  className="flex-1 bg-transparent border-0 outline-none text-sm text-texto-primario" />
                <button onClick={() => guardarUnidades(unidades.filter((_, i) => i !== idx))} className="p-1 text-texto-terciario hover:text-estado-error">
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
            <button
              onClick={() => guardarUnidades([...unidades, { id: `u-${Date.now()}`, label: 'Nueva unidad', abreviatura: '' }])}
              className="flex items-center gap-1 text-sm text-texto-marca hover:underline"
            >
              <Plus size={14} /> Agregar unidad
            </button>
          </div>
        </div>
      )}

      {/* ─── CONDICIONES DE PAGO (con drag & drop + restablecer) ─── */}
      {seccionActiva === 'condiciones' && (
        <div>
          <div className="flex items-center justify-between mb-1">
            <h2 className="text-base font-semibold text-texto-primario">Condiciones de pago</h2>
            <button
              onClick={() => guardarCondiciones(CONDICIONES_PAGO_DEFAULT)}
              className="flex items-center gap-1 text-xs text-texto-terciario hover:text-texto-marca transition-colors"
              title="Restablecer condiciones por defecto"
            >
              <RotateCcw size={13} />
              Restablecer
            </button>
          </div>
          <p className="text-sm text-texto-terciario mb-4">Arrastrá para reordenar. El orden se refleja en el selector del presupuesto.</p>

          <Reorder.Group
            axis="y"
            values={condicionesPago.map(c => c.id)}
            onReorder={(nuevosIds) => {
              const mapa = new Map(condicionesPago.map(c => [c.id, c]))
              const reordenadas = nuevosIds.map(id => mapa.get(id)!).filter(Boolean)
              guardarCondiciones(reordenadas)
            }}
            className="space-y-2"
          >
            {condicionesPago.map((cond, idx) => (
              <Reorder.Item key={cond.id} value={cond.id}>
                <div className="p-3 bg-superficie-app rounded-lg space-y-2 group">
                  <div className="flex items-center gap-2">
                    <div className="cursor-grab opacity-30 group-hover:opacity-60 transition-opacity">
                      <GripVertical size={14} />
                    </div>
                    <input
                      type="text" value={cond.label}
                      onChange={(e) => { const n = [...condicionesPago]; n[idx] = { ...cond, label: e.target.value }; setCondicionesPago(n) }}
                      onBlur={() => guardarCondiciones(condicionesPago)}
                      className="flex-1 bg-transparent border-0 outline-none text-sm font-medium text-texto-primario"
                    />
                    <select value={cond.tipo}
                      onChange={(e) => { const n = [...condicionesPago]; n[idx] = { ...cond, tipo: e.target.value as 'plazo_fijo' | 'hitos' }; guardarCondiciones(n) }}
                      className="bg-transparent border border-borde-sutil rounded px-2 py-1 text-xs outline-none text-texto-primario">
                      <option value="plazo_fijo">Plazo fijo</option>
                      <option value="hitos">Por hitos</option>
                    </select>
                    <label className="flex items-center gap-1 text-xs text-texto-terciario cursor-pointer">
                      <input type="radio" name="cond_default" checked={cond.predeterminado}
                        onChange={() => guardarCondiciones(condicionesPago.map((c, i) => ({ ...c, predeterminado: i === idx })))} />
                      Default
                    </label>
                    <button onClick={() => guardarCondiciones(condicionesPago.filter((_, i) => i !== idx))}
                      className="p-1 text-texto-terciario hover:text-estado-error">
                      <Trash2 size={14} />
                    </button>
                  </div>
                  {cond.tipo === 'plazo_fijo' && (
                    <div className="flex items-center gap-2 text-xs pl-6">
                      <span className="text-texto-terciario">Días:</span>
                      <input type="number" value={cond.diasVencimiento}
                        onChange={(e) => { const n = [...condicionesPago]; n[idx] = { ...cond, diasVencimiento: parseInt(e.target.value) || 0 }; setCondicionesPago(n) }}
                        onBlur={() => guardarCondiciones(condicionesPago)}
                        className="w-16 bg-transparent border border-borde-sutil rounded px-2 py-1 text-right font-mono outline-none" />
                    </div>
                  )}
                  {cond.tipo === 'hitos' && (
                    <div className="pl-6 space-y-1">
                      {(cond.hitos || []).map((h, hi) => (
                        <div key={h.id} className="flex items-center gap-2 text-xs">
                          <input type="text" value={h.descripcion}
                            onChange={(e) => {
                              const n = [...condicionesPago]
                              const hitos = [...(cond.hitos || [])]
                              hitos[hi] = { ...h, descripcion: e.target.value }
                              n[idx] = { ...cond, hitos }
                              setCondicionesPago(n)
                            }}
                            onBlur={() => guardarCondiciones(condicionesPago)}
                            className="flex-1 bg-transparent border-b border-borde-sutil outline-none text-texto-primario py-0.5" />
                          <input type="number" value={h.porcentaje}
                            onChange={(e) => {
                              const n = [...condicionesPago]
                              const hitos = [...(cond.hitos || [])]
                              hitos[hi] = { ...h, porcentaje: parseFloat(e.target.value) || 0 }
                              n[idx] = { ...cond, hitos }
                              setCondicionesPago(n)
                            }}
                            onBlur={() => guardarCondiciones(condicionesPago)}
                            className="w-14 bg-transparent border border-borde-sutil rounded px-1 py-0.5 text-right font-mono outline-none" />
                          <span className="text-texto-terciario">%</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </Reorder.Item>
            ))}
          </Reorder.Group>

          <button
            onClick={() => guardarCondiciones([...condicionesPago, {
              id: `cond-${Date.now()}`, label: 'Nueva condición', tipo: 'plazo_fijo',
              diasVencimiento: 0, hitos: [], notaPlanPago: '', predeterminado: false,
            }])}
            className="flex items-center gap-1 text-sm text-texto-marca hover:underline mt-3"
          >
            <Plus size={14} /> Agregar condición
          </button>
        </div>
      )}

      {/* ─── NUMERACIÓN ─── */}
      {seccionActiva === 'numeracion' && (
        <div>
          <h2 className="text-base font-semibold text-texto-primario mb-1">Numeración</h2>
          <p className="text-sm text-texto-terciario mb-4">Formato del número de presupuesto.</p>
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="text-xs text-texto-terciario mb-1 block">Prefijo</label>
                <input type="text" value={prefijo}
                  onChange={(e) => setPrefijo(e.target.value.toUpperCase())}
                  onBlur={() => guardarNumeracion(prefijo, digitos, siguiente)}
                  className="w-full bg-superficie-app border border-borde-sutil rounded-lg p-2.5 text-sm font-mono outline-none" />
              </div>
              <div>
                <label className="text-xs text-texto-terciario mb-1 block">Dígitos</label>
                <input type="number" value={digitos} min={1} max={8}
                  onChange={(e) => setDigitos(parseInt(e.target.value) || 4)}
                  onBlur={() => guardarNumeracion(prefijo, digitos, siguiente)}
                  className="w-full bg-superficie-app border border-borde-sutil rounded-lg p-2.5 text-sm font-mono outline-none" />
              </div>
              <div>
                <label className="text-xs text-texto-terciario mb-1 block">Siguiente</label>
                <input type="number" value={siguiente} min={1}
                  onChange={(e) => setSiguiente(parseInt(e.target.value) || 1)}
                  onBlur={() => guardarNumeracion(prefijo, digitos, siguiente)}
                  className="w-full bg-superficie-app border border-borde-sutil rounded-lg p-2.5 text-sm font-mono outline-none" />
              </div>
            </div>
            <div className="p-3 bg-superficie-app rounded-lg">
              <span className="text-xs text-texto-terciario">Vista previa: </span>
              <span className="font-mono font-semibold text-texto-primario">
                {prefijo}-{String(siguiente).padStart(digitos, '0')}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* ─── TEXTOS DEFAULT ─── */}
      {seccionActiva === 'textos' && (
        <div>
          <h2 className="text-base font-semibold text-texto-primario mb-1">Textos por defecto</h2>
          <p className="text-sm text-texto-terciario mb-4">Se cargan automáticamente al crear un presupuesto nuevo.</p>
          <div className="space-y-4">
            <div>
              <label className="text-xs text-texto-terciario font-medium mb-1 block">Notas por defecto</label>
              <textarea value={notasDefault}
                onChange={(e) => setNotasDefault(e.target.value)}
                onBlur={() => guardarTextos('notas', notasDefault)}
                placeholder="Ej: Válido por 30 días..." rows={3}
                className="w-full bg-superficie-app border border-borde-sutil rounded-lg p-3 text-sm text-texto-primario placeholder:text-texto-terciario outline-none focus:border-marca-500 resize-none" />
            </div>
            <div>
              <label className="text-xs text-texto-terciario font-medium mb-1 block">Condiciones por defecto</label>
              <textarea value={condicionesDefault}
                onChange={(e) => setCondicionesDefault(e.target.value)}
                onBlur={() => guardarTextos('condiciones', condicionesDefault)}
                placeholder="Ej: Sujeto a disponibilidad..." rows={3}
                className="w-full bg-superficie-app border border-borde-sutil rounded-lg p-3 text-sm text-texto-primario placeholder:text-texto-terciario outline-none focus:border-marca-500 resize-none" />
            </div>
            <div>
              <label className="text-xs text-texto-terciario font-medium mb-1 block">Días de validez por defecto</label>
              <input type="number" value={diasVencimiento}
                onChange={(e) => setDiasVencimiento(parseInt(e.target.value) || 30)}
                onBlur={() => guardarTextos('dias', diasVencimiento)}
                className="w-24 bg-superficie-app border border-borde-sutil rounded-lg p-2.5 text-sm font-mono outline-none" />
            </div>
          </div>
        </div>
      )}
    </PlantillaConfiguracion>
  )
}
