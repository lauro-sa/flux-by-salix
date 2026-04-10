'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import {
  Package, Wrench, Star, StarOff, Save,
  FileText, DollarSign, Scale, MessageSquare,
  Plus, Trash2, BarChart3, Info,
} from 'lucide-react'
import { ModalAdaptable as Modal } from '@/componentes/ui/ModalAdaptable'
import { Tabs } from '@/componentes/ui/Tabs'
import { Boton } from '@/componentes/ui/Boton'
import { Input } from '@/componentes/ui/Input'
import { Select } from '@/componentes/ui/Select'
import { SelectCreable } from '@/componentes/ui/SelectCreable'
import { Interruptor } from '@/componentes/ui/Interruptor'
import { Insignia } from '@/componentes/ui/Insignia'
import dynamic from 'next/dynamic'
const EditorTexto = dynamic(() => import('@/componentes/ui/EditorTexto').then(m => m.EditorTexto), { ssr: false })
import { InputMoneda } from '@/componentes/ui/InputMoneda'
import { PanelChatter } from '@/componentes/entidad/PanelChatter'
import { COLOR_TIPO_PRODUCTO } from '@/lib/colores_entidad'
import { useFormato } from '@/hooks/useFormato'
import { useTraduccion } from '@/lib/i18n'
import type { Producto, TipoProducto, ConfigProductos, DesgloseCosto } from '@/tipos/producto'

/**
 * Modal de creación/edición de producto o servicio.
 * 5 tabs: General, Descripción, Costos, Inventario (solo productos), Actividad (solo edición).
 * Default: tipo = 'servicio' (el sistema está orientado a servicios).
 * Layout General estilo Odoo: dos columnas con etiquetas de sección.
 */

interface PropsModalProducto {
  abierto: boolean
  onCerrar: () => void
  onGuardado: (producto: Producto) => void
  producto?: Producto | null
  config: ConfigProductos | null
  impuestos?: { id: string; label: string; porcentaje: number }[]
}

export function ModalProducto({ abierto, onCerrar, onGuardado, producto, config, impuestos = [] }: PropsModalProducto) {
  const formato = useFormato()
  const { t } = useTraduccion()
  const esEdicion = !!producto

  // ─── Estado del formulario ───
  const [nombre, setNombre] = useState('')
  const [tipo, setTipo] = useState<TipoProducto>('servicio')
  const [categoria, setCategoria] = useState('')
  const [referenciaInterna, setReferenciaInterna] = useState('')
  const [codigoBarras, setCodigoBarras] = useState('')
  const [precioUnitario, setPrecioUnitario] = useState('')
  const [moneda, setMoneda] = useState('')
  const [costo, setCosto] = useState('')
  const [impuestoId, setImpuestoId] = useState('iva21')
  const [impuestoCompraId, setImpuestoCompraId] = useState('')
  const [unidad, setUnidad] = useState('unidad')
  const [descripcion, setDescripcion] = useState('')
  const [descripcionVenta, setDescripcionVenta] = useState('')
  const [notasInternas, setNotasInternas] = useState('')
  const [peso, setPeso] = useState('')
  const [volumen, setVolumen] = useState('')
  const [puedeVenderse, setPuedeVenderse] = useState(true)
  const [puedeComprarse, setPuedeComprarse] = useState(false)
  const [favorito, setFavorito] = useState(false)
  const [desgloseCostos, setDesgloseCostos] = useState<DesgloseCosto[]>([])

  const [tabActivo, setTabActivo] = useState('general')
  const [guardando, setGuardando] = useState(false)

  // ─── Cargar datos en edición / reset en creación ───
  useEffect(() => {
    if (!abierto) return
    if (producto) {
      setNombre(producto.nombre)
      setTipo(producto.tipo)
      setCategoria(producto.categoria || '')
      setReferenciaInterna(producto.referencia_interna || '')
      setCodigoBarras(producto.codigo_barras || '')
      setPrecioUnitario(producto.precio_unitario || '')
      setMoneda(producto.moneda || '')
      setCosto(producto.costo || '')
      setImpuestoId(producto.impuesto_id || 'iva21')
      setImpuestoCompraId(producto.impuesto_compra_id || '')
      setUnidad(producto.unidad || 'unidad')
      setDescripcion(producto.descripcion || '')
      setDescripcionVenta(producto.descripcion_venta || '')
      setNotasInternas(producto.notas_internas || '')
      setPeso(producto.peso || '')
      setVolumen(producto.volumen || '')
      setPuedeVenderse(producto.puede_venderse)
      setPuedeComprarse(producto.puede_comprarse)
      setFavorito(producto.favorito)
      setDesgloseCostos(producto.desglose_costos || [])
    } else {
      // Defaults para nuevo — tipo servicio por defecto
      setNombre('')
      setTipo('servicio')
      setCategoria('')
      setReferenciaInterna('')
      setCodigoBarras('')
      setPrecioUnitario('')
      setMoneda('')
      setCosto('')
      setImpuestoId('iva21')
      setImpuestoCompraId('')
      setUnidad('unidad')
      setDescripcion('')
      setDescripcionVenta('')
      setNotasInternas('')
      setPeso('')
      setVolumen('')
      setPuedeVenderse(true)
      setPuedeComprarse(false)
      setFavorito(false)
      setDesgloseCostos([])
    }
    setTabActivo('general')
  }, [producto, abierto])

  // Al cambiar tipo, limpiar campos exclusivos de producto
  const cambiarTipo = useCallback((nuevoTipo: TipoProducto) => {
    setTipo(nuevoTipo)
    if (nuevoTipo !== 'producto') {
      setPeso('')
      setVolumen('')
      setCodigoBarras('')
    }
  }, [])

  // ─── Opciones para selects ───
  const opcionesCategorias = useMemo(() =>
    ((config?.categorias || []) as { id: string; label: string }[]).map(c => ({ valor: c.id, etiqueta: c.label }))
  , [config])

  const opcionesUnidades = useMemo(() =>
    ((config?.unidades || []) as { id: string; label: string; abreviatura: string }[]).map(u => ({
      valor: u.id,
      etiqueta: `${u.label} (${u.abreviatura})`,
    }))
  , [config])

  const opcionesImpuestos = useMemo(() =>
    [{ valor: '', etiqueta: 'Sin impuesto' }, ...impuestos.map(i => ({ valor: i.id, etiqueta: i.label }))]
  , [impuestos])

  const categoriasCosto = useMemo(() =>
    [{ valor: '', etiqueta: 'Sin categoría' }, ...((config?.categorias_costo || []) as { id: string; label: string }[]).map(c => ({
      valor: c.id,
      etiqueta: c.label,
    }))]
  , [config])

  // ─── Cálculos automáticos ───
  const tieneDesglose = desgloseCostos.length > 0
  const costoDesglose = desgloseCostos.reduce((acc, item) => acc + (item.monto || 0), 0)
  const costoEfectivo = tieneDesglose ? costoDesglose : (parseFloat(costo) || 0)

  const precio = parseFloat(precioUnitario) || 0
  const impuestoSeleccionado = impuestos.find(i => i.id === impuestoId)
  const tasaImpuesto = impuestoSeleccionado?.porcentaje || 0
  const precioConImpuesto = precio > 0 ? precio * (1 + tasaImpuesto / 100) : 0

  let margenDisplay = '—'
  let margenPositivo = true
  if (precio > 0 && costoEfectivo > 0) {
    const margen = ((precio - costoEfectivo) / precio) * 100
    margenDisplay = `${margen.toFixed(1)}%`
    margenPositivo = margen >= 0
  }

  // ─── Guardar ───
  const manejarGuardar = useCallback(async () => {
    if (!nombre.trim()) return
    setGuardando(true)

    try {
      const datos = {
        nombre: nombre.trim(),
        tipo,
        categoria: categoria || null,
        referencia_interna: referenciaInterna || null,
        codigo_barras: tipo === 'producto' ? (codigoBarras || null) : null,
        precio_unitario: precioUnitario || null,
        moneda: moneda || null,
        costo: tieneDesglose ? String(costoDesglose) : (costo || null),
        desglose_costos: desgloseCostos.filter(item => item.monto > 0),
        impuesto_id: impuestoId || null,
        impuesto_compra_id: impuestoCompraId || null,
        unidad,
        descripcion: descripcion || null,
        descripcion_venta: descripcionVenta || null,
        notas_internas: notasInternas || null,
        peso: tipo === 'producto' ? (peso || null) : null,
        volumen: tipo === 'producto' ? (volumen || null) : null,
        puede_venderse: puedeVenderse,
        puede_comprarse: puedeComprarse,
        ...(esEdicion && { favorito }),
      }

      const url = esEdicion ? `/api/productos/${producto!.id}` : '/api/productos'
      const method = esEdicion ? 'PATCH' : 'POST'

      const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(datos) })
      if (!res.ok) return

      const resultado = await res.json()
      onGuardado(resultado)
      onCerrar()
    } catch (err) {
      console.error('Error al guardar:', err)
    } finally {
      setGuardando(false)
    }
  }, [nombre, tipo, categoria, referenciaInterna, codigoBarras, precioUnitario, moneda, costo, costoDesglose, tieneDesglose, desgloseCostos, impuestoId, impuestoCompraId, unidad, descripcion, descripcionVenta, notasInternas, peso, volumen, puedeVenderse, puedeComprarse, favorito, esEdicion, producto, onGuardado, onCerrar])

  // ─── Desglose de costos ───
  const agregarLineaCosto = useCallback(() => {
    setDesgloseCostos(prev => [...prev, { id: crypto.randomUUID(), categoria_id: '', descripcion: '', monto: 0 }])
  }, [])

  const actualizarLineaCosto = useCallback((id: string, campo: string, valor: string | number) => {
    setDesgloseCostos(prev => prev.map(item => item.id === id ? { ...item, [campo]: valor } : item))
  }, [])

  const eliminarLineaCosto = useCallback((id: string) => {
    setDesgloseCostos(prev => prev.filter(item => item.id !== id))
  }, [])

  // ─── Tabs dinámicos ───
  const tabs = useMemo(() => {
    const lista = [
      { clave: 'general', etiqueta: 'General', icono: <Package size={14} /> },
      { clave: 'descripcion', etiqueta: 'Descripción', icono: <FileText size={14} /> },
      { clave: 'costos', etiqueta: 'Costos', icono: <DollarSign size={14} /> },
    ]
    if (tipo === 'producto') {
      lista.push({ clave: 'inventario', etiqueta: 'Inventario', icono: <Scale size={14} /> })
    }
    if (esEdicion) {
      lista.push({ clave: 'actividad', etiqueta: 'Actividad', icono: <MessageSquare size={14} /> })
    }
    return lista
  }, [tipo, esEdicion])

  // Si el tab activo desaparece (ej: inventario al cambiar a servicio), volver a general
  useEffect(() => {
    if (!tabs.find(t => t.clave === tabActivo)) setTabActivo('general')
  }, [tabs, tabActivo])

  const etiquetaTipo = tipo === 'servicio' ? 'servicio' : 'producto'

  return (
    <Modal abierto={abierto} onCerrar={onCerrar} titulo="" tamano="5xl" sinPadding>
      <div className="flex flex-col">

        {/* ═══════ HEADER — nombre inline, tipo toggle, favorito ═══════ */}
        <div className="px-6 pt-4 pb-4 border-b border-white/[0.07]">
          <div className="flex gap-4">
            {/* Izquierda: estrella + nombre + tipo + toggles */}
            <div className="flex-1 min-w-0">
              {/* Fila 1: estrella + nombre grande inline */}
              <div className="flex items-center gap-2">
                <Boton
                  variante="fantasma"
                  tamano="sm"
                  soloIcono
                  titulo="Favorito"
                  icono={favorito ? <Star size={20} className="text-insignia-advertencia fill-insignia-advertencia" /> : <StarOff size={20} />}
                  onClick={() => setFavorito(!favorito)}
                />
                <Input
                  value={nombre}
                  onChange={e => setNombre(e.target.value)}
                  placeholder={`Nombre del ${etiquetaTipo}`}
                  formato={null}
                  variante="plano"
                  className="flex-1 text-xl font-bold"
                  autoFocus
                />
              </div>

              {/* Fila 2: tipo toggle + puede venderse/comprarse */}
              <div className="flex items-center gap-4 mt-3 ml-10 flex-wrap">
                {/* Toggle tipo */}
                <div className="flex items-center rounded-lg overflow-hidden border border-borde-sutil">
                  {(['servicio', 'producto'] as TipoProducto[]).map(t => {
                    const activo = tipo === t
                    const color = COLOR_TIPO_PRODUCTO[t]
                    return (
                      <Boton
                        key={t}
                        variante="fantasma"
                        tamano="xs"
                        icono={t === 'servicio' ? <Wrench size={14} /> : <Package size={14} />}
                        onClick={() => cambiarTipo(t)}
                        className={!activo ? 'text-texto-terciario' : ''}
                        style={activo ? { backgroundColor: `var(--insignia-${color}-fondo)`, color: `var(--insignia-${color}-texto)` } : undefined}
                      >
                        {t === 'servicio' ? 'Servicio' : 'Producto'}
                      </Boton>
                    )
                  })}
                </div>

                <div className="w-px h-4 bg-white/[0.07]" />

                <Interruptor activo={puedeVenderse} onChange={setPuedeVenderse} etiqueta="Puede venderse" />
                <Interruptor activo={puedeComprarse} onChange={setPuedeComprarse} etiqueta="Puede comprarse" />
              </div>
            </div>

            {/* Derecha: código + acciones */}
            <div className="shrink-0 flex flex-col items-end gap-2">
              <div className="flex items-center gap-2">
                {esEdicion && (
                  <span className="text-xs font-mono text-texto-terciario bg-superficie-app px-2 py-1 rounded-md">
                    {producto!.codigo}
                  </span>
                )}
                <Boton variante="secundario" tamano="sm" onClick={onCerrar} disabled={guardando}>
                  {t('comun.cancelar')}
                </Boton>
                <Boton
                  tamano="sm"
                  icono={<Save size={14} />}
                  onClick={manejarGuardar}
                  cargando={guardando}
                  disabled={!nombre.trim()}
                >
                  {esEdicion ? t('comun.guardar') : t('comun.crear')}
                </Boton>
              </div>
            </div>
          </div>
        </div>

        {/* ═══════ TABS ═══════ */}
        <div className="px-6 pt-4 border-b border-white/[0.07]">
          <Tabs tabs={tabs} activo={tabActivo} onChange={setTabActivo} />
        </div>

        {/* ═══════ CONTENIDO — min-h fijo para que no salte ═══════ */}
        <div className="overflow-y-auto" style={{ minHeight: '460px', maxHeight: 'calc(100dvh - 280px)' }}>

          {/* ════════════════ TAB GENERAL — layout 2 columnas con divisor ════════════════ */}
          {tabActivo === 'general' && (
            <div>
              <div className="grid grid-cols-1 md:grid-cols-[1fr_1px_1fr] gap-0">
                {/* Columna izquierda — Información */}
                <div className="p-6 space-y-4">
                  <p className="text-[11px] font-medium text-texto-terciario uppercase tracking-wider">Información</p>

                  <SelectCreable
                    etiqueta="Categoría"
                    opciones={opcionesCategorias}
                    valor={categoria}
                    onChange={setCategoria}
                    placeholder="Seleccionar categoría..."
                    textoCrear="Crear categoría"
                  />

                  <Input
                    etiqueta="Referencia"
                    value={referenciaInterna}
                    onChange={e => setReferenciaInterna(e.target.value)}
                    placeholder={tipo === 'servicio' ? 'Código interno' : 'SKU, código interno'}
                    formato={null}
                  />

                  {tipo === 'producto' && (
                    <Input
                      etiqueta="Código de barras"
                      value={codigoBarras}
                      onChange={e => setCodigoBarras(e.target.value)}
                      placeholder="EAN / UPC"
                      formato={null}
                    />
                  )}
                </div>

                {/* Divisor vertical */}
                <div className="hidden md:block bg-white/[0.07]" />

                {/* Columna derecha — Precios */}
                <div className="p-6 space-y-4">
                  <p className="text-[11px] font-medium text-texto-terciario uppercase tracking-wider">Precios</p>

                  <InputMoneda
                    etiqueta="Precio venta"
                    value={precioUnitario}
                    onChange={setPrecioUnitario}
                    moneda={moneda || 'ARS'}
                  />

                  <div className="grid grid-cols-2 gap-3">
                    <Select
                      etiqueta="Moneda"
                      opciones={[{ valor: '', etiqueta: '$ (empresa)' }, { valor: 'ARS', etiqueta: '$ ARS' }, { valor: 'USD', etiqueta: 'US$ USD' }, { valor: 'EUR', etiqueta: '€ EUR' }]}
                      valor={moneda}
                      onChange={setMoneda}
                    />
                    <Select
                      etiqueta="Unidad"
                      opciones={opcionesUnidades}
                      valor={unidad}
                      onChange={setUnidad}
                    />
                  </div>

                  <div>
                    <Select
                      etiqueta="Imp. ventas"
                      opciones={opcionesImpuestos}
                      valor={impuestoId}
                      onChange={setImpuestoId}
                    />
                    {precioConImpuesto > 0 && (
                      <p className="text-xs text-texto-terciario mt-1">
                        = {formato.numero(precioConImpuesto, 2)} imp. incluidos
                      </p>
                    )}
                  </div>

                  <div className="border-t border-white/[0.07]" />

                  <InputMoneda
                    etiqueta={tieneDesglose ? 'Costo (calc.)' : 'Costo'}
                    value={tieneDesglose ? String(costoDesglose) : costo}
                    onChange={tieneDesglose ? () => {} : setCosto}
                    moneda={moneda || 'ARS'}
                    disabled={tieneDesglose}
                    ayuda={tieneDesglose ? 'Calculado desde tab Costos' : undefined}
                  />

                  <Select
                    etiqueta="Imp. compra"
                    opciones={opcionesImpuestos}
                    valor={impuestoCompraId}
                    onChange={setImpuestoCompraId}
                  />

                  {/* Margen */}
                  <div className="flex items-center justify-between py-2 px-3 rounded-lg border border-white/[0.06] bg-white/[0.03]">
                    <span className="text-[11px] font-medium text-texto-terciario uppercase tracking-wider">Margen</span>
                    <span className={`text-sm font-bold ${precio > 0 && costoEfectivo > 0 ? (margenPositivo ? 'text-insignia-exito' : 'text-insignia-peligro') : 'text-texto-terciario'}`}>
                      {margenDisplay}
                    </span>
                  </div>
                </div>
              </div>

              {/* Nota informativa */}
              <div className="flex items-start gap-2.5 px-6 py-4 border-t border-white/[0.07]">
                <Info size={14} className="text-texto-terciario shrink-0 mt-0.5" />
                <p className="text-xs leading-relaxed text-texto-terciario">
                  Las categorías, prefijos de código, unidades de medida y categorías de costo se gestionan
                  desde <span className="font-semibold text-texto-secundario">Configuración</span> en la página de Productos.
                  Los impuestos y monedas se configuran desde <span className="font-semibold text-texto-secundario">Configuración</span> en Presupuestos.
                </p>
              </div>
            </div>
          )}

          {/* ════════════════ TAB DESCRIPCIÓN — editores rich text ════════════════ */}
          {tabActivo === 'descripcion' && (
            <div className="space-y-6 p-6 max-w-3xl">
              <div>
                <label className="text-xs font-semibold text-texto-secundario mb-2 flex items-center gap-1.5">
                  <FileText size={14} className="text-texto-terciario" />
                  Descripción interna
                </label>
                <div className="rounded-xl border border-borde-sutil overflow-hidden">
                  <EditorTexto
                    contenido={descripcion}
                    onChange={setDescripcion}
                    placeholder="Descripción para uso interno del equipo..."
                    alturaMinima={120}
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-texto-secundario mb-2 flex items-center gap-1.5">
                  <FileText size={14} className="text-texto-terciario" />
                  Descripción para cotización
                </label>
                <div className="rounded-xl border border-borde-sutil overflow-hidden">
                  <EditorTexto
                    contenido={descripcionVenta}
                    onChange={setDescripcionVenta}
                    placeholder="Texto que aparecerá en presupuestos y facturas..."
                    alturaMinima={120}
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-texto-secundario mb-2 flex items-center gap-1.5">
                  <FileText size={14} className="text-texto-terciario" />
                  Notas internas
                </label>
                <div className="rounded-xl border border-borde-sutil overflow-hidden">
                  <EditorTexto
                    contenido={notasInternas}
                    onChange={setNotasInternas}
                    placeholder="Notas privadas, no visibles para clientes..."
                    alturaMinima={80}
                  />
                </div>
              </div>
            </div>
          )}

          {/* ════════════════ TAB COSTOS ════════════════ */}
          {tabActivo === 'costos' && (
            <div className="space-y-6 p-6">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-semibold text-texto-primario">Desglose de costos</h4>
                  <p className="text-xs text-texto-terciario mt-0.5">Detallá materiales, mano de obra, etc. El costo total se calcula automáticamente.</p>
                </div>
                <Boton variante="secundario" tamano="sm" icono={<Plus size={14} />} onClick={agregarLineaCosto}>
                  Agregar línea
                </Boton>
              </div>

              {desgloseCostos.length > 0 ? (
                <div className="rounded-xl border border-borde-sutil overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-superficie-app border-b border-borde-sutil">
                        <th className="px-4 py-2.5 text-left text-xs font-medium text-texto-terciario">Categoría</th>
                        <th className="px-4 py-2.5 text-left text-xs font-medium text-texto-terciario">Descripción</th>
                        <th className="px-4 py-2.5 text-right text-xs font-medium text-texto-terciario w-36">Monto</th>
                        <th className="w-12" />
                      </tr>
                    </thead>
                    <tbody>
                      {desgloseCostos.map((item) => (
                        <tr key={item.id} className="border-b border-borde-sutil last:border-0 group">
                          <td className="px-4 py-2">
                            <Select
                              opciones={categoriasCosto}
                              valor={item.categoria_id}
                              onChange={(v) => actualizarLineaCosto(item.id, 'categoria_id', v)}
                            />
                          </td>
                          <td className="px-4 py-2">
                            <Input
                              value={item.descripcion}
                              onChange={e => actualizarLineaCosto(item.id, 'descripcion', e.target.value)}
                              placeholder="Descripción..."
                              formato={null}
                              compacto
                            />
                          </td>
                          <td className="px-4 py-2">
                            <Input
                              tipo="number"
                              value={item.monto ? String(item.monto) : ''}
                              onChange={e => actualizarLineaCosto(item.id, 'monto', parseFloat(e.target.value) || 0)}
                              placeholder="0.00"
                              step="0.01"
                              min="0"
                              formato={null}
                              compacto
                            />
                          </td>
                          <td className="px-2 py-2">
                            <Boton
                              variante="fantasma"
                              tamano="xs"
                              soloIcono
                              titulo="Eliminar línea"
                              icono={<Trash2 size={14} />}
                              onClick={() => eliminarLineaCosto(item.id)}
                              className="opacity-0 group-hover:opacity-100 transition-opacity"
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="bg-superficie-app">
                        <td colSpan={2} className="px-4 py-3 text-right text-sm font-medium text-texto-secundario">
                          Total costo
                        </td>
                        <td className="px-4 py-3 text-right font-mono font-bold text-texto-primario">
                          {formato.numero(costoDesglose, 2)}
                        </td>
                        <td />
                      </tr>
                    </tfoot>
                  </table>
                </div>
              ) : (
                <div className="rounded-xl border border-dashed border-borde-sutil p-10 text-center text-texto-terciario">
                  <BarChart3 size={36} className="mx-auto mb-3 opacity-30" />
                  <p className="text-sm font-medium">Sin desglose de costos</p>
                  <p className="text-xs mt-1">Si no detallás costos acá, podés cargar el costo unitario manualmente en el tab General.</p>
                </div>
              )}

              {/* Resumen margen */}
              {precio > 0 && costoEfectivo > 0 && (
                <div className="rounded-xl border border-borde-sutil p-5 bg-superficie-app">
                  <div className="grid grid-cols-3 gap-3 sm:gap-6 text-center">
                    <div>
                      <p className="text-xs text-texto-terciario mb-1">Precio venta</p>
                      <p className="font-mono font-bold text-texto-primario text-lg">
                        {formato.numero(precio, 2)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-texto-terciario mb-1">Costo total</p>
                      <p className="font-mono font-bold text-texto-primario text-lg">
                        {formato.numero(costoEfectivo, 2)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-texto-terciario mb-1">Margen</p>
                      <p className="text-lg">
                        <Insignia color={margenPositivo ? 'exito' : 'peligro'}>
                          {margenDisplay}
                        </Insignia>
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ════════════════ TAB INVENTARIO (solo productos) ════════════════ */}
          {tabActivo === 'inventario' && tipo === 'producto' && (
            <div className="space-y-6 p-6">
              <p className="text-sm text-texto-terciario">Datos logísticos del producto físico.</p>
              <div className="grid grid-cols-2 gap-5 max-w-md">
                <Input
                  etiqueta="Peso (kg)"
                  tipo="number"
                  value={peso}
                  onChange={e => setPeso(e.target.value)}
                  placeholder="0.00"
                  step="0.01"
                  min="0"
                  formato={null}
                />
                <Input
                  etiqueta="Volumen (m³)"
                  tipo="number"
                  value={volumen}
                  onChange={e => setVolumen(e.target.value)}
                  placeholder="0.000"
                  step="0.001"
                  min="0"
                  formato={null}
                />
              </div>
            </div>
          )}

          {/* ════════════════ TAB ACTIVIDAD (solo edición) ════════════════ */}
          {tabActivo === 'actividad' && esEdicion && (
            <div className="p-6" style={{ minHeight: '350px' }}>
              <PanelChatter
                entidadTipo="producto"
                entidadId={producto!.id}
              />
            </div>
          )}
        </div>
      </div>
    </Modal>
  )
}
