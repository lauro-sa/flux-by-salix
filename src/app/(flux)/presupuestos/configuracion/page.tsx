'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import {
  Plus, Trash2, GripVertical, Receipt, DollarSign,
  Ruler, Clock, Hash, FileText, RotateCcw, Package,
} from 'lucide-react'
import { Reorder } from 'framer-motion'
import ModalCondicionPago from '../_componentes/ModalCondicionPago'
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

  // Modal condición de pago
  const [modalCondicionAbierto, setModalCondicionAbierto] = useState(false)
  const [condicionEditando, setCondicionEditando] = useState<CondicionPago | null>(null)

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
  const [reinicio, setReinicio] = useState<'nunca' | 'anual' | 'mensual'>('nunca')
  const [componentesNum, setComponentesNum] = useState<{ tipo: string; valor?: string; formato?: string }[]>([
    { tipo: 'prefijo' },
    { tipo: 'separador', valor: '-' },
    { tipo: 'secuencial' },
  ])

  const secciones: SeccionConfig[] = [
    { id: 'impuestos', etiqueta: 'Impuestos', icono: <Receipt size={16} />, grupo: 'Financiero' },
    { id: 'monedas', etiqueta: 'Monedas', icono: <DollarSign size={16} />, grupo: 'Financiero' },
    { id: 'unidades', etiqueta: 'Unidades de medida', icono: <Ruler size={16} />, grupo: 'Financiero' },
    { id: 'condiciones', etiqueta: 'Condiciones de pago', icono: <Clock size={16} />, grupo: 'Financiero' },
    { id: 'numeracion', etiqueta: 'Numeración', icono: <Hash size={16} />, grupo: 'Documento' },
    { id: 'textos', etiqueta: 'Textos por defecto', icono: <FileText size={16} />, grupo: 'Documento' },
    { id: 'modulo', etiqueta: 'Módulo', icono: <Package size={16} />, grupo: 'Sistema' },
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
  const guardarNumeracion = (campos?: Record<string, unknown>) => {
    autoguardar({ secuencia: { prefijo, digitos, siguiente, reinicio, componentes: componentesNum, ...campos } })
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
          <h3 className="text-lg font-semibold text-texto-primario">Impuestos</h3>
          <p className="text-sm text-texto-terciario mt-1 mb-5">Impuestos disponibles al crear líneas de presupuesto.</p>
          <div className="space-y-2">
            {impuestos.map((imp, idx) => (
              <div key={imp.id} className="flex items-center gap-3 p-3 bg-superficie-app rounded-lg">
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
          <h3 className="text-lg font-semibold text-texto-primario">Monedas</h3>
          <p className="text-sm text-texto-terciario mt-1 mb-5">Monedas disponibles para presupuestos.</p>
          <div className="space-y-2">
            {monedas.map((mon, idx) => (
              <div key={mon.id} className="flex items-center gap-3 p-3 bg-superficie-app rounded-lg">
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
          <h3 className="text-lg font-semibold text-texto-primario">Unidades de medida</h3>
          <p className="text-sm text-texto-terciario mt-1 mb-5">Unidades disponibles para las líneas del presupuesto.</p>
          <div className="space-y-2">
            {unidades.map((uni, idx) => (
              <div key={uni.id} className="flex items-center gap-3 p-3 bg-superficie-app rounded-lg">
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

      {/* ─── CONDICIONES DE PAGO (drag & drop + modal + restablecer) ─── */}
      {seccionActiva === 'condiciones' && (
        <div>
          <div className="flex items-center justify-between mb-1">
            <h3 className="text-lg font-semibold text-texto-primario">Condiciones de pago</h3>
            <button
              onClick={() => guardarCondiciones(CONDICIONES_PAGO_DEFAULT)}
              className="flex items-center gap-1 text-xs text-texto-terciario hover:text-texto-marca transition-colors"
              title="Restablecer condiciones por defecto"
            >
              <RotateCcw size={13} />
              Restablecer
            </button>
          </div>
          <p className="text-sm text-texto-terciario mt-1 mb-5">Arrastrá para reordenar. Hacé clic para editar.</p>

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
                <div
                  className="flex items-center justify-between p-3 bg-superficie-app rounded-lg group cursor-pointer hover:bg-superficie-app/80 transition-colors"
                  onClick={() => { setCondicionEditando(cond); setModalCondicionAbierto(true) }}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <div
                      className="cursor-grab opacity-30 group-hover:opacity-60 transition-opacity shrink-0"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <GripVertical size={14} />
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        guardarCondiciones(condicionesPago.map((c, i) => ({ ...c, predeterminado: i === idx })))
                      }}
                      className={`size-4 rounded-full border-2 shrink-0 transition-colors ${
                        cond.predeterminado ? 'border-marca-500 bg-marca-500' : 'border-borde-sutil'
                      }`}
                    />
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-texto-primario truncate">{cond.label}</span>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded shrink-0 ${
                          cond.tipo === 'hitos'
                            ? 'bg-marca-500/10 text-texto-marca'
                            : 'bg-superficie-tarjeta text-texto-terciario'
                        }`}>
                          {cond.tipo === 'hitos' ? 'Hitos' : 'Plazo'}
                        </span>
                      </div>
                      <span className="text-xs text-texto-secundario block">
                        {cond.tipo === 'hitos'
                          ? (cond.hitos || []).map(h => `${h.porcentaje}% ${h.descripcion}`).join(' + ')
                          : `${cond.diasVencimiento} días`}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={(e) => { e.stopPropagation(); guardarCondiciones(condicionesPago.filter((_, i) => i !== idx)) }}
                      className="p-1 text-texto-terciario hover:text-estado-error transition-colors"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              </Reorder.Item>
            ))}
          </Reorder.Group>

          <button
            onClick={() => { setCondicionEditando(null); setModalCondicionAbierto(true) }}
            className="w-full flex items-center justify-center gap-1.5 mt-3 px-3 py-2.5 rounded-lg border border-dashed border-borde-sutil text-sm text-texto-secundario hover:text-texto-primario hover:border-marca-500 transition-colors"
          >
            <Plus size={16} /> Agregar condición
          </button>

          {/* Modal crear/editar condición — key fuerza remount al cambiar de condición */}
          <ModalCondicionPago
            key={condicionEditando?.id || 'nueva'}
            abierto={modalCondicionAbierto}
            onCerrar={() => { setModalCondicionAbierto(false); setCondicionEditando(null) }}
            condicionEditar={condicionEditando}
            onGuardar={(condicion) => {
              if (condicionEditando) {
                guardarCondiciones(condicionesPago.map(c => c.id === condicionEditando.id ? { ...condicion, predeterminado: c.predeterminado } : c))
              } else {
                if (condicionesPago.some(c => c.id === condicion.id)) {
                  condicion.id = `${condicion.id}_${Date.now()}`
                }
                guardarCondiciones([...condicionesPago, condicion])
              }
            }}
          />
        </div>
      )}

      {/* ─── NUMERACIÓN ─── */}
      {seccionActiva === 'numeracion' && (() => {
        // Generar preview del número
        const hoy = new Date()
        const previewPartes = componentesNum.map(c => {
          if (c.tipo === 'prefijo') return prefijo || 'P'
          if (c.tipo === 'separador') return c.valor || '-'
          if (c.tipo === 'secuencial') return String(siguiente).padStart(digitos, '0')
          if (c.tipo === 'anio') return c.formato === 'largo' ? String(hoy.getFullYear()) : String(hoy.getFullYear()).slice(-2)
          if (c.tipo === 'mes') return String(hoy.getMonth() + 1).padStart(2, '0')
          if (c.tipo === 'dia') return String(hoy.getDate()).padStart(2, '0')
          return ''
        })
        const previewNumero = previewPartes.join('')

        // Qué componentes de fecha ya están
        const tieneAnio = componentesNum.some(c => c.tipo === 'anio')
        const tieneMes = componentesNum.some(c => c.tipo === 'mes')
        const tieneDia = componentesNum.some(c => c.tipo === 'dia')

        const COLORES_BLOQUE: Record<string, string> = {
          prefijo: 'bg-marca-500/15 text-texto-marca border-marca-500/30',
          secuencial: 'bg-marca-500/15 text-texto-marca border-marca-500/30',
          anio: 'bg-insignia-advertencia/15 text-insignia-advertencia border-insignia-advertencia/30',
          mes: 'bg-insignia-exito/15 text-insignia-exito border-insignia-exito/30',
          dia: 'bg-[#8b5cf6]/15 text-[#8b5cf6] border-[#8b5cf6]/30',
          separador: 'bg-superficie-app text-texto-terciario border-borde-sutil',
        }

        const ETIQUETA_BLOQUE: Record<string, string> = {
          prefijo: 'prefijo', secuencial: 'nº', anio: 'año', mes: 'mes', dia: 'día', separador: 'sep',
        }

        const moverComponente = (idx: number, dir: number) => {
          const nuevos = [...componentesNum]
          const dest = idx + dir
          if (dest < 0 || dest >= nuevos.length) return
          ;[nuevos[idx], nuevos[dest]] = [nuevos[dest], nuevos[idx]]
          setComponentesNum(nuevos)
          guardarNumeracion({ componentes: nuevos })
        }

        const quitarComponente = (idx: number) => {
          const nuevos = componentesNum.filter((_, i) => i !== idx)
          setComponentesNum(nuevos)
          guardarNumeracion({ componentes: nuevos })
        }

        const agregarComponente = (tipo: string) => {
          const nuevos = [...componentesNum]
          const idxSec = nuevos.findIndex(c => c.tipo === 'secuencial')
          const pos = idxSec >= 0 ? idxSec : nuevos.length
          // Auto-agregar separador si el anterior no es separador
          if (pos > 0 && nuevos[pos - 1]?.tipo !== 'separador') {
            nuevos.splice(pos, 0, { tipo: 'separador', valor: '-' })
          }
          const nuevoComp = tipo === 'anio' ? { tipo: 'anio', formato: 'corto' } : tipo === 'separador' ? { tipo: 'separador', valor: '-' } : { tipo }
          const insertPos = nuevos.findIndex(c => c.tipo === 'secuencial')
          nuevos.splice(insertPos >= 0 ? insertPos : nuevos.length, 0, nuevoComp)
          setComponentesNum(nuevos)
          guardarNumeracion({ componentes: nuevos })
        }

        return (
          <div>
            <div className="flex items-center justify-between mb-1">
              <h3 className="text-lg font-semibold text-texto-primario">Numeración</h3>
              <button
                onClick={() => {
                  setPrefijo('P'); setDigitos(4); setSiguiente(1); setReinicio('nunca')
                  const defComp = [{ tipo: 'prefijo' }, { tipo: 'separador', valor: '-' }, { tipo: 'secuencial' }]
                  setComponentesNum(defComp)
                  guardarNumeracion({ prefijo: 'P', digitos: 4, siguiente: 1, reinicio: 'nunca', componentes: defComp })
                }}
                className="flex items-center gap-1 text-xs text-texto-terciario hover:text-texto-marca transition-colors"
              >
                <RotateCcw size={13} /> Restablecer
              </button>
            </div>
            <p className="text-sm text-texto-terciario mb-6">Configurá el formato del número de presupuesto</p>

            <div className="space-y-6">
              {/* Vista previa */}
              <div>
                <span className="text-xs text-texto-terciario font-medium block mb-1">Vista previa</span>
                <div className="text-2xl font-mono font-semibold text-texto-primario px-5 py-3 rounded-xl bg-superficie-app inline-block">
                  {previewNumero}
                </div>
              </div>

              {/* Prefijo */}
              <div>
                <label className="text-xs text-texto-terciario font-medium block mb-1">Prefijo</label>
                <input type="text" value={prefijo}
                  onChange={(e) => setPrefijo(e.target.value)}
                  onBlur={() => guardarNumeracion({ prefijo })}
                  placeholder="Ej: P, PRES..."
                  className="w-40 bg-superficie-app border border-borde-sutil rounded-lg p-2.5 text-sm font-mono outline-none focus:border-marca-500" />
              </div>

              {/* Constructor de bloques */}
              <div className="p-4 rounded-xl border border-borde-sutil space-y-3">
                <div>
                  <span className="text-xs text-texto-terciario font-medium block">Estructura del número</span>
                  <p className="text-[11px] text-texto-terciario mt-0.5">Movés, quitás o agregás bloques. Los separadores son editables.</p>
                </div>

                {/* Bloques */}
                <div className="flex flex-wrap items-center gap-2.5 py-4 px-4 rounded-xl bg-superficie-app/50 min-h-[64px]">
                  {componentesNum.map((comp, i) => {
                    const esFijo = comp.tipo === 'prefijo' || comp.tipo === 'secuencial'
                    const color = COLORES_BLOQUE[comp.tipo] || COLORES_BLOQUE.separador
                    const puedeIzq = !esFijo && i > 0
                    const puedeDer = !esFijo && i < componentesNum.length - 1

                    if (comp.tipo === 'separador') {
                      return (
                        <div key={`sep-${i}`} className={`inline-flex items-center gap-1.5 h-10 px-2.5 rounded-lg border ${color}`}>
                          {puedeIzq && (
                            <button onClick={() => moverComponente(i, -1)} className="text-texto-terciario/40 hover:text-texto-secundario transition-colors text-sm">‹</button>
                          )}
                          <input
                            type="text" value={comp.valor ?? '-'} maxLength={3}
                            onChange={(e) => {
                              const n = [...componentesNum]; n[i] = { ...comp, valor: e.target.value }; setComponentesNum(n)
                            }}
                            onBlur={() => guardarNumeracion({ componentes: componentesNum })}
                            className="w-5 text-center text-base font-mono bg-transparent outline-none"
                          />
                          <span className="text-[10px] opacity-40 uppercase">sep</span>
                          {puedeDer && (
                            <button onClick={() => moverComponente(i, 1)} className="text-texto-terciario/40 hover:text-texto-secundario transition-colors text-sm">›</button>
                          )}
                          <button onClick={() => quitarComponente(i)} className="text-texto-terciario/30 hover:text-estado-error transition-colors text-sm ml-0.5">×</button>
                        </div>
                      )
                    }

                    let valor = ''
                    if (comp.tipo === 'prefijo') valor = prefijo || 'P'
                    else if (comp.tipo === 'secuencial') valor = String(1).padStart(digitos, '0')
                    else if (comp.tipo === 'anio') valor = comp.formato === 'largo' ? String(hoy.getFullYear()) : String(hoy.getFullYear()).slice(-2)
                    else if (comp.tipo === 'mes') valor = String(hoy.getMonth() + 1).padStart(2, '0')
                    else if (comp.tipo === 'dia') valor = String(hoy.getDate()).padStart(2, '0')

                    return (
                      <div key={`${comp.tipo}-${i}`} className={`inline-flex items-center gap-1.5 h-10 px-3 rounded-lg border ${color}`}>
                        {puedeIzq && (
                          <button onClick={() => moverComponente(i, -1)} className="text-current opacity-30 hover:opacity-80 transition-opacity text-sm">‹</button>
                        )}
                        <span className="font-mono font-bold text-base">{valor}</span>
                        <span className="text-[10px] opacity-40 uppercase">{ETIQUETA_BLOQUE[comp.tipo]}</span>
                        {comp.tipo === 'anio' && (
                          <button
                            onClick={() => {
                              const n = [...componentesNum]; n[i] = { ...comp, formato: comp.formato === 'largo' ? 'corto' : 'largo' }; setComponentesNum(n)
                              guardarNumeracion({ componentes: n })
                            }}
                            className="text-current opacity-40 hover:opacity-80 transition-opacity"
                            title={comp.formato === 'largo' ? 'Cambiar a 2 dígitos' : 'Cambiar a 4 dígitos'}
                          >⇄</button>
                        )}
                        {puedeDer && (
                          <button onClick={() => moverComponente(i, 1)} className="text-current opacity-30 hover:opacity-80 transition-opacity text-sm">›</button>
                        )}
                        {!esFijo && (
                          <button onClick={() => quitarComponente(i)} className="text-current opacity-30 hover:opacity-80 hover:text-estado-error transition-all text-sm ml-0.5">×</button>
                        )}
                      </div>
                    )
                  })}
                </div>

                {/* Agregar bloques */}
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs text-texto-terciario">Agregar:</span>
                  {[
                    { tipo: 'separador', label: 'Separador', visible: true },
                    { tipo: 'anio', label: 'Año', visible: !tieneAnio },
                    { tipo: 'mes', label: 'Mes', visible: !tieneMes },
                    { tipo: 'dia', label: 'Día', visible: !tieneDia },
                  ].filter(a => a.visible).map(a => (
                    <button
                      key={a.tipo}
                      onClick={() => agregarComponente(a.tipo)}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-dashed border-borde-sutil text-xs font-medium text-texto-secundario hover:bg-superficie-app hover:border-marca-500/40 transition-colors"
                    >
                      <Plus size={12} /> {a.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Dígitos */}
              <div>
                <label className="text-xs text-texto-terciario font-medium block mb-1">Dígitos del secuencial</label>
                <p className="text-[11px] text-texto-terciario mb-2">Cantidad de dígitos con ceros a la izquierda</p>
                <div className="flex gap-1.5">
                  {[3, 4, 5, 6].map(d => (
                    <button
                      key={d}
                      onClick={() => { setDigitos(d); guardarNumeracion({ digitos: d }) }}
                      className={`flex-1 max-w-[100px] py-2.5 rounded-lg text-xs font-medium transition-colors border ${
                        digitos === d
                          ? 'bg-marca-500/10 text-texto-marca border-marca-500/30'
                          : 'text-texto-secundario border-borde-sutil hover:bg-superficie-app'
                      }`}
                    >
                      {d} ({String(1).padStart(d, '0')})
                    </button>
                  ))}
                </div>
              </div>

              {/* Reinicio */}
              <div>
                <label className="text-xs text-texto-terciario font-medium block mb-1">Reinicio del secuencial</label>
                <p className="text-[11px] text-texto-terciario mb-2">Cuándo vuelve a empezar la numeración desde 1</p>
                <div className="flex gap-1.5">
                  {([
                    { value: 'nunca' as const, label: 'Nunca' },
                    { value: 'anual' as const, label: 'Cada año' },
                    { value: 'mensual' as const, label: 'Cada mes' },
                  ]).map(op => (
                    <button
                      key={op.value}
                      onClick={() => { setReinicio(op.value); guardarNumeracion({ reinicio: op.value }) }}
                      className={`flex-1 max-w-[120px] py-2.5 rounded-lg text-xs font-medium transition-colors border ${
                        reinicio === op.value
                          ? 'bg-marca-500/10 text-texto-marca border-marca-500/30'
                          : 'text-texto-secundario border-borde-sutil hover:bg-superficie-app'
                      }`}
                    >
                      {op.label}
                    </button>
                  ))}
                </div>
                {reinicio !== 'nunca' && (
                  <p className="text-[11px] text-texto-terciario flex items-center gap-1.5 mt-2">
                    ℹ {reinicio === 'anual' ? 'El secuencial vuelve a 0001 cada 1 de enero.' : 'El secuencial vuelve a 0001 cada primer día del mes.'}
                  </p>
                )}
              </div>

              {/* Próximo número */}
              <div className="p-4 rounded-xl border border-borde-sutil">
                <label className="text-xs text-texto-terciario font-medium block mb-1">Próximo número</label>
                <p className="text-[11px] text-texto-terciario mb-2">El siguiente número secuencial que se asignará</p>
                <div className="flex items-center gap-3">
                  <input type="number" value={siguiente} min={1}
                    onChange={(e) => setSiguiente(parseInt(e.target.value) || 1)}
                    onBlur={() => guardarNumeracion({ siguiente })}
                    className="w-28 bg-superficie-app border border-borde-sutil rounded-lg p-2.5 text-sm font-mono text-right outline-none focus:border-marca-500" />
                  <span className="text-xs text-texto-terciario">→ generará <strong className="font-mono text-texto-primario">{previewNumero}</strong></span>
                </div>
              </div>
            </div>
          </div>
        )
      })()}

      {/* ─── TEXTOS DEFAULT ─── */}
      {seccionActiva === 'textos' && (
        <div>
          <h3 className="text-lg font-semibold text-texto-primario">Textos por defecto</h3>
          <p className="text-sm text-texto-terciario mt-1 mb-5">Se cargan automáticamente al crear un presupuesto nuevo.</p>
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

      {/* ─── MÓDULO ─── */}
      {seccionActiva === 'modulo' && (
        <div>
          <h3 className="text-lg font-semibold text-texto-primario">Módulo de Presupuestos</h3>
          <p className="text-sm text-texto-terciario mb-6">Gestión del módulo dentro de tu empresa</p>

          <div className="space-y-6">
            {/* Estado del módulo */}
            <div className="p-5 rounded-xl border border-borde-sutil">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="size-10 rounded-lg bg-marca-500/10 flex items-center justify-center">
                    <Package size={20} className="text-texto-marca" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-texto-primario">Presupuestos</p>
                    <p className="text-xs text-texto-terciario">Cotizaciones comerciales con líneas, impuestos y condiciones de pago</p>
                  </div>
                </div>
                <span className="text-xs px-2.5 py-1 rounded-full bg-insignia-exito/10 text-insignia-exito font-medium">
                  Activo
                </span>
              </div>
            </div>

            {/* Info */}
            <div className="p-4 rounded-xl bg-superficie-app space-y-3">
              <p className="text-xs text-texto-secundario">
                <strong>Categoría:</strong> Finanzas
              </p>
              <p className="text-xs text-texto-secundario">
                <strong>Dependencias:</strong> Contactos
              </p>
              <p className="text-xs text-texto-terciario">
                Al desactivar este módulo se oculta del menú lateral y las rutas dejan de ser accesibles.
                Los datos no se eliminan — al reactivar, todo vuelve a estar disponible.
              </p>
            </div>

            {/* Botón desactivar */}
            <div className="pt-4 border-t border-borde-sutil">
              <button
                className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm text-estado-error border border-estado-error/20 hover:bg-estado-error/10 transition-colors"
                onClick={() => {
                  // TODO: Implementar desactivación de módulo
                  // Marcar modulo como inactivo en BD, ocultar del sidebar
                }}
              >
                <Package size={15} />
                Desactivar módulo
              </button>
              <p className="text-[11px] text-texto-terciario mt-2">
                Esta acción no elimina datos. Podés reactivar el módulo en cualquier momento.
              </p>
            </div>
          </div>
        </div>
      )}
    </PlantillaConfiguracion>
  )
}
