'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import { motion, AnimatePresence, Reorder } from 'framer-motion'
import {
  Trash2, GripVertical, Package, Type,
  StickyNote, Percent, Settings2, Eye, EyeOff,
} from 'lucide-react'
import type { LineaPresupuesto, TipoLinea, Impuesto, UnidadMedida } from '@/tipos/presupuesto'
import { COLUMNAS_LINEA_DISPONIBLES } from '@/tipos/presupuesto'
import { BuscadorProducto } from '@/componentes/entidad/BuscadorProducto'
import { Boton } from '@/componentes/ui/Boton'
import { OpcionMenu } from '@/componentes/ui/OpcionMenu'
import { TextArea } from '@/componentes/ui/TextArea'

/**
 * TablaLineas — Editor de líneas del presupuesto.
 * Soporta 4 tipos de línea: producto, sección, nota, descuento.
 * Columnas configurables (mostrar/ocultar).
 * Drag & drop para reordenar.
 * Se usa en: página de nuevo presupuesto y detalle/edición.
 */

// ─── Tipos ───

interface PropiedadesTablaLineas {
  lineas: LineaPresupuesto[]
  columnasVisibles: string[]
  impuestos: Impuesto[]
  unidades: UnidadMedida[]
  moneda: string
  simboloMoneda: string
  soloLectura?: boolean
  onAgregarLinea: (tipo: TipoLinea) => void
  onEditarLinea: (id: string, campo: string, valor: string) => void
  onEliminarLinea: (id: string) => void
  onReordenar: (ids: string[]) => void
  onCambiarColumnas: (columnas: string[]) => void
}

// Iconos por tipo de línea
const ICONO_TIPO: Record<TipoLinea, typeof Package> = {
  producto: Package,
  seccion: Type,
  nota: StickyNote,
  descuento: Percent,
}

const ETIQUETA_TIPO: Record<TipoLinea, string> = {
  producto: 'Producto / Servicio',
  seccion: 'Sección',
  nota: 'Nota',
  descuento: 'Descuento',
}

// Anchos por columna — flex para producto, min-width para numéricos
const ANCHO_COLUMNA: Record<string, string> = {
  producto: 'flex-1 min-w-[120px]',
  descripcion: 'hidden',
  cantidad: 'min-w-[55px] shrink-0',
  unidad: 'min-w-[65px] shrink-0',
  precio_unitario: 'min-w-[130px] shrink-0',
  descuento: 'min-w-[55px] shrink-0',
  impuesto: 'min-w-[95px] shrink-0',
  subtotal: 'min-w-[145px] shrink-0',
}

// Etiquetas del header de la tabla (pueden diferir del popover para mejor contexto)
const ETIQUETA_COLUMNA: Record<string, string> = {
  producto: 'Producto',
  descripcion: '',
  cantidad: 'Cant.',
  unidad: 'U. Medida',
  precio_unitario: 'Precio unit.',
  descuento: '% Bonif.',
  impuesto: 'Impuestos',
  subtotal: 'Importe',
}

function TablaLineas({
  lineas,
  columnasVisibles,
  impuestos,
  unidades,
  moneda,
  simboloMoneda,
  soloLectura = false,
  onAgregarLinea,
  onEditarLinea,
  onEliminarLinea,
  onReordenar,
  onCambiarColumnas,
}: PropiedadesTablaLineas) {
  const [menuColumnasAbierto, setMenuColumnasAbierto] = useState(false)
  const [lineaActiva, setLineaActiva] = useState<string | null>(null)
  const menuColRef = useRef<HTMLDivElement>(null)

  // Cerrar menú columnas al hacer click afuera
  useEffect(() => {
    const cerrar = (e: MouseEvent) => {
      if (menuColRef.current && !menuColRef.current.contains(e.target as Node)) setMenuColumnasAbierto(false)
    }
    document.addEventListener('mousedown', cerrar)
    return () => document.removeEventListener('mousedown', cerrar)
  }, [])

  // Formatear número como moneda
  const fmt = useCallback((valor: string) => {
    const num = parseFloat(valor || '0')
    return `${simboloMoneda} ${num.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  }, [simboloMoneda])

  // IDs para reordenar
  const idsLineas = lineas.map(l => l.id)

  return (
    <div className="w-full min-w-0">
      {/* ─── Barra superior: config columnas ─── */}
      <div className="flex items-center justify-between mb-2 px-1 relative z-30">
        <span className="text-xs text-texto-terciario font-medium uppercase tracking-wide">
          Líneas del presupuesto
        </span>
        {!soloLectura && (
          <div className="relative" ref={menuColRef}>
            <Boton variante="fantasma" tamano="xs" icono={<Settings2 size={14} />} onClick={() => setMenuColumnasAbierto(!menuColumnasAbierto)} titulo="Configurar columnas">
              Columnas
            </Boton>

            <AnimatePresence>
              {menuColumnasAbierto && (
                <motion.div
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  className="absolute right-0 top-full mt-1 bg-superficie-elevada border border-borde-sutil rounded-lg shadow-lg py-2 z-20 min-w-[220px]"
                >
                  {/* Columnas visibles — reordenables */}
                  <div className="px-3 pb-1 mb-1 border-b border-borde-sutil">
                    <span className="text-[10px] text-texto-terciario uppercase tracking-wider">Visibles</span>
                  </div>
                  <Reorder.Group
                    axis="y"
                    values={columnasVisibles}
                    onReorder={onCambiarColumnas}
                    className="px-1"
                  >
                    {columnasVisibles.map((colId) => {
                      const col = COLUMNAS_LINEA_DISPONIBLES.find(c => c.id === colId)
                      if (!col) return null
                      return (
                        <Reorder.Item
                          key={colId}
                          value={colId}
                          className="flex items-center gap-2 px-2 py-1.5 text-sm rounded-md cursor-grab active:cursor-grabbing hover:bg-superficie-tarjeta"
                        >
                          {!col.requerida && <GripVertical size={12} className="text-texto-terciario shrink-0" />}
                          {col.requerida && <div className="w-3 shrink-0" />}
                          <span className="flex-1 text-texto-primario">{col.label}</span>
                          {!col.requerida && (
                            <Boton variante="fantasma" tamano="xs" soloIcono icono={<EyeOff size={12} />} onClick={() => onCambiarColumnas(columnasVisibles.filter(c => c !== colId))} className="text-texto-terciario hover:text-insignia-peligro" />
                          )}
                        </Reorder.Item>
                      )
                    })}
                  </Reorder.Group>

                  {/* Columnas ocultas */}
                  {COLUMNAS_LINEA_DISPONIBLES.filter(c => !columnasVisibles.includes(c.id) && !c.requerida).length > 0 && (
                    <>
                      <div className="px-3 pt-2 pb-1 mt-1 border-t border-borde-sutil">
                        <span className="text-[10px] text-texto-terciario uppercase tracking-wider">Ocultas</span>
                      </div>
                      {COLUMNAS_LINEA_DISPONIBLES.filter(c => !columnasVisibles.includes(c.id) && !c.requerida).map((col) => (
                        <OpcionMenu key={col.id} icono={<Eye size={12} />} onClick={() => onCambiarColumnas([...columnasVisibles, col.id])}>
                          {col.label}
                        </OpcionMenu>
                      ))}
                    </>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}
      </div>

      <div className="overflow-x-auto">
      {/* ─── Encabezado de columnas ─── */}
      <div className="flex items-center gap-1 px-1 py-2 border-b-2 border-borde-sutil text-xs text-texto-terciario font-medium uppercase tracking-wider">
        {!soloLectura && <div className="w-6" />}
        {columnasVisibles.map(col => {
          if (!ETIQUETA_COLUMNA[col]) return <div key={col} className={ANCHO_COLUMNA[col] || 'w-[100px]'} />
          return (
            <div key={col} className={`${ANCHO_COLUMNA[col] || 'w-[100px]'} px-1 ${['subtotal', 'precio_unitario', 'cantidad', 'descuento'].includes(col) ? 'text-right' : ''}`}>
              {ETIQUETA_COLUMNA[col]}
            </div>
          )
        })}
        {!soloLectura && <div className="w-8" />}
      </div>

      {/* ─── Líneas ─── */}
      <Reorder.Group
        axis="y"
        values={idsLineas}
        onReorder={onReordenar}
        className="divide-y divide-borde-sutil"
      >
        <AnimatePresence initial={false}>
          {lineas.map((linea) => (
            <Reorder.Item
              key={linea.id}
              value={linea.id}
              dragListener={!soloLectura}
              className="group"
            >
              {linea.tipo_linea === 'seccion' ? (
                <FilaSeccion
                  linea={linea}
                  soloLectura={soloLectura}
                  onEditar={onEditarLinea}
                  onEliminar={onEliminarLinea}
                />
              ) : linea.tipo_linea === 'nota' ? (
                <FilaNota
                  linea={linea}
                  soloLectura={soloLectura}
                  onEditar={onEditarLinea}
                  onEliminar={onEliminarLinea}
                />
              ) : linea.tipo_linea === 'descuento' ? (
                <FilaDescuento
                  linea={linea}
                  soloLectura={soloLectura}
                  simboloMoneda={simboloMoneda}
                  onEditar={onEditarLinea}
                  onEliminar={onEliminarLinea}
                />
              ) : (
                <FilaProducto
                  linea={linea}
                  columnasVisibles={columnasVisibles}
                  impuestos={impuestos}
                  unidades={unidades}
                  soloLectura={soloLectura}
                  fmt={fmt}
                  onEditar={onEditarLinea}
                  onEliminar={onEliminarLinea}
                  activa={lineaActiva === linea.id}
                  onActivar={() => setLineaActiva(linea.id)}
                />
              )}
            </Reorder.Item>
          ))}
        </AnimatePresence>
      </Reorder.Group>
      </div>

      {/* ─── Botones agregar línea (inline) ─── */}
      {!soloLectura && (
        <div className="flex items-center gap-1 mt-3 pt-3 border-t border-borde-sutil">
          {(['producto', 'seccion', 'nota', 'descuento'] as TipoLinea[]).map((tipo, idx) => (
            <span key={tipo} className="flex items-center">
              {idx > 0 && <span className="text-texto-terciario/40 mx-1.5">|</span>}
              <Boton variante="fantasma" tamano="xs" onClick={() => onAgregarLinea(tipo)}>
                {tipo === 'producto' ? 'Agregar producto' : ETIQUETA_TIPO[tipo]}
              </Boton>
            </span>
          ))}
        </div>
      )}

      {/* ─── Sin líneas ─── */}
      {lineas.length === 0 && (
        <div className="py-8 text-center text-texto-terciario text-sm">
          Sin líneas. Agregá productos, servicios o texto libre.
        </div>
      )}
    </div>
  )
}

// ─── Fila de producto/servicio ───

function FilaProducto({
  linea,
  columnasVisibles,
  impuestos,
  unidades,
  soloLectura,
  fmt,
  onEditar,
  onEliminar,
  activa,
  onActivar,
}: {
  linea: LineaPresupuesto
  columnasVisibles: string[]
  impuestos: Impuesto[]
  unidades: UnidadMedida[]
  soloLectura: boolean
  fmt: (v: string) => string
  onEditar: (id: string, campo: string, valor: string) => void
  onEliminar: (id: string) => void
  activa: boolean
  onActivar: () => void
}) {
  return (
    <div
      className={`transition-colors border-b border-borde-sutil/50 ${activa ? 'bg-superficie-tarjeta/80' : 'hover:bg-superficie-tarjeta/30'}`}
      onClick={onActivar}
    >
      {/* Fila principal: columnas */}
      <div className="flex items-center gap-1 px-1 py-2">
        {!soloLectura && (
          <div className="w-6 flex items-center justify-center cursor-grab opacity-0 group-hover:opacity-50 transition-opacity shrink-0">
            <GripVertical size={14} />
          </div>
        )}

        {columnasVisibles.map(col => (
          <div key={col} className={`${ANCHO_COLUMNA[col] || 'w-[100px]'} px-1`}>
            {col === 'producto' && (
              <BuscadorProducto
                valor={linea.descripcion || ''}
                codigo={linea.codigo_producto || ''}
                soloLectura={soloLectura}
                onChange={(v) => onEditar(linea.id, 'descripcion', v)}
                onSeleccionar={(producto) => {
                  onEditar(linea.id, 'codigo_producto', producto.codigo)
                  onEditar(linea.id, 'descripcion', producto.nombre)
                  if (producto.precio_unitario) onEditar(linea.id, 'precio_unitario', producto.precio_unitario)
                  if (producto.unidad) onEditar(linea.id, 'unidad', producto.unidad)
                  if (producto.descripcion_venta) onEditar(linea.id, 'descripcion_detalle', producto.descripcion_venta)
                  if (producto.impuesto_id) {
                    const imp = impuestos.find(i => i.id === producto.impuesto_id)
                    if (imp) {
                      onEditar(linea.id, 'impuesto_porcentaje', String(imp.porcentaje))
                      onEditar(linea.id, 'impuesto_label', imp.label)
                    }
                  }
                }}
              />
            )}
            {col === 'descripcion' && (
              <div />
            )}
            {col === 'cantidad' && (
              <CampoNumero
                valor={linea.cantidad}
                soloLectura={soloLectura}
                className="text-right"
                onChange={(v) => onEditar(linea.id, 'cantidad', v)}
              />
            )}
            {col === 'unidad' && (
              <CampoSelect
                valor={linea.unidad || ''}
                opciones={unidades.map(u => ({ valor: u.abreviatura, etiqueta: u.abreviatura }))}
                soloLectura={soloLectura}
                onChange={(v) => onEditar(linea.id, 'unidad', v)}
              />
            )}
            {col === 'precio_unitario' && (
              <CampoNumero
                valor={linea.precio_unitario}
                soloLectura={soloLectura}
                className="text-right"
                esMoneda
                onChange={(v) => onEditar(linea.id, 'precio_unitario', v)}
              />
            )}
            {col === 'descuento' && (
              <CampoNumero
                valor={linea.descuento}
                soloLectura={soloLectura}
                className="text-right"
                sufijo="%"
                onChange={(v) => onEditar(linea.id, 'descuento', v)}
              />
            )}
            {col === 'impuesto' && (
              <CampoSelect
                valor={linea.impuesto_porcentaje || '0'}
                opciones={impuestos.filter(i => i.activo).map(i => ({ valor: String(i.porcentaje), etiqueta: i.label }))}
                soloLectura={soloLectura}
                onChange={(v) => {
                  const imp = impuestos.find(i => String(i.porcentaje) === v)
                  onEditar(linea.id, 'impuesto_porcentaje', v)
                  if (imp) onEditar(linea.id, 'impuesto_label', imp.label)
                }}
              />
            )}
            {col === 'subtotal' && (
              <div className="text-right font-mono text-sm text-texto-marca font-medium pr-1">
                {fmt(linea.subtotal)}
              </div>
            )}
          </div>
        ))}

        {!soloLectura && (
          <Boton variante="fantasma" tamano="xs" soloIcono icono={<Trash2 size={14} />} onClick={(e) => { e.stopPropagation(); onEliminar(linea.id) }} className="w-8 text-texto-terciario hover:text-estado-error opacity-0 group-hover:opacity-100" />
        )}
      </div>

      {/* Descripción detallada debajo (solo si tiene contenido o está activa) */}
      {(activa || linea.descripcion_detalle) && (
        <div className={`pb-2 ${!soloLectura ? 'pl-8' : 'pl-2'} pr-10`}>
          {soloLectura ? (
            linea.descripcion_detalle && (
              <p className="text-xs text-texto-secundario leading-relaxed whitespace-pre-wrap max-w-lg">
                {linea.descripcion_detalle}
              </p>
            )
          ) : (
            <TextArea
              value={linea.descripcion_detalle || ''}
              placeholder="Detalle adicional (opcional)"
              onChange={(e) => onEditar(linea.id, 'descripcion_detalle', e.target.value)}
              rows={linea.descripcion_detalle ? Math.min(Math.ceil((linea.descripcion_detalle.length || 0) / 60), 6) : 1}
              variante="transparente"
              compacto
              className="max-w-lg leading-relaxed"
            />
          )}
        </div>
      )}
    </div>
  )
}

// ─── Fila de sección (separador visual) ───

function FilaSeccion({
  linea,
  soloLectura,
  onEditar,
  onEliminar,
}: {
  linea: LineaPresupuesto
  soloLectura: boolean
  onEditar: (id: string, campo: string, valor: string) => void
  onEliminar: (id: string) => void
}) {
  return (
    <div className="flex items-center gap-1 px-1 py-2 bg-superficie-app/50">
      {!soloLectura && (
        <div className="w-6 flex items-center justify-center cursor-grab opacity-0 group-hover:opacity-50 transition-opacity">
          <GripVertical size={14} />
        </div>
      )}
      <div className="flex-1 flex items-center gap-2">
        <Type size={14} className="text-texto-terciario shrink-0" />
        <CampoTexto
          valor={linea.descripcion || ''}
          placeholder="Título de sección"
          soloLectura={soloLectura}
          className="font-semibold text-sm uppercase tracking-wide text-texto-secundario"
          onChange={(v) => onEditar(linea.id, 'descripcion', v)}
        />
      </div>
      {!soloLectura && (
        <button
          onClick={() => onEliminar(linea.id)}
          className="w-8 flex items-center justify-center text-texto-terciario hover:text-estado-error opacity-0 group-hover:opacity-100 transition-all"
        >
          <Trash2 size={14} />
        </button>
      )}
    </div>
  )
}

// ─── Fila de nota (texto libre) ───

function FilaNota({
  linea,
  soloLectura,
  onEditar,
  onEliminar,
}: {
  linea: LineaPresupuesto
  soloLectura: boolean
  onEditar: (id: string, campo: string, valor: string) => void
  onEliminar: (id: string) => void
}) {
  return (
    <div className="flex items-center gap-1 px-1 py-2">
      {!soloLectura && (
        <div className="w-6 flex items-center justify-center cursor-grab opacity-0 group-hover:opacity-50 transition-opacity">
          <GripVertical size={14} />
        </div>
      )}
      <div className="flex-1 flex items-center gap-2">
        <StickyNote size={14} className="text-texto-terciario shrink-0" />
        <CampoTexto
          valor={linea.descripcion || ''}
          placeholder="Nota o comentario..."
          soloLectura={soloLectura}
          className="text-sm text-texto-secundario italic"
          onChange={(v) => onEditar(linea.id, 'descripcion', v)}
        />
      </div>
      {!soloLectura && (
        <button
          onClick={() => onEliminar(linea.id)}
          className="w-8 flex items-center justify-center text-texto-terciario hover:text-estado-error opacity-0 group-hover:opacity-100 transition-all"
        >
          <Trash2 size={14} />
        </button>
      )}
    </div>
  )
}

// ─── Fila de descuento (monto fijo) ───

function FilaDescuento({
  linea,
  soloLectura,
  simboloMoneda,
  onEditar,
  onEliminar,
}: {
  linea: LineaPresupuesto
  soloLectura: boolean
  simboloMoneda: string
  onEditar: (id: string, campo: string, valor: string) => void
  onEliminar: (id: string) => void
}) {
  return (
    <div className="flex items-center gap-1 px-1 py-2">
      {!soloLectura && (
        <div className="w-6 flex items-center justify-center cursor-grab opacity-0 group-hover:opacity-50 transition-opacity">
          <GripVertical size={14} />
        </div>
      )}
      <div className="flex-1 flex items-center gap-2">
        <Percent size={14} className="text-estado-error shrink-0" />
        <CampoTexto
          valor={linea.descripcion || ''}
          placeholder="Motivo del descuento"
          soloLectura={soloLectura}
          className="text-sm text-estado-error"
          onChange={(v) => onEditar(linea.id, 'descripcion', v)}
        />
      </div>
      <div className="w-[120px] flex items-center gap-1 justify-end">
        <span className="text-xs text-texto-terciario">{simboloMoneda}</span>
        <CampoNumero
          valor={linea.monto ? String(Math.abs(parseFloat(linea.monto))) : '0'}
          soloLectura={soloLectura}
          className="text-right text-estado-error"
          esMoneda
          onChange={(v) => onEditar(linea.id, 'monto', `-${v}`)}
        />
      </div>
      {!soloLectura && (
        <button
          onClick={() => onEliminar(linea.id)}
          className="w-8 flex items-center justify-center text-texto-terciario hover:text-estado-error opacity-0 group-hover:opacity-100 transition-all"
        >
          <Trash2 size={14} />
        </button>
      )}
    </div>
  )
}

// ─── Campos inline editables ───

function CampoTexto({
  valor,
  placeholder,
  soloLectura,
  className = '',
  onChange,
}: {
  valor: string
  placeholder?: string
  soloLectura: boolean
  className?: string
  onChange: (valor: string) => void
}) {
  const [local, setLocal] = useState(valor)
  const ref = useRef<HTMLInputElement>(null)

  // Sincronizar con prop
  useEffect(() => { setLocal(valor) }, [valor])

  if (soloLectura) {
    return <span className={`text-sm ${className}`}>{valor || ''}</span>
  }

  return (
    <input
      ref={ref}
      type="text"
      value={local}
      placeholder={placeholder}
      onChange={(e) => setLocal(e.target.value)}
      onBlur={() => { if (local !== valor) onChange(local) }}
      className={`w-full bg-transparent border-0 outline-none text-sm placeholder:text-texto-placeholder focus:bg-superficie-tarjeta focus:rounded px-1 py-0.5 -mx-1 transition-colors ${className}`}
    />
  )
}

function CampoNumero({
  valor,
  soloLectura,
  className = '',
  sufijo,
  esMoneda,
  onChange,
}: {
  valor: string
  soloLectura: boolean
  className?: string
  sufijo?: string
  /** Si true, muestra el valor formateado ($ 150.000,00) cuando no está enfocado */
  esMoneda?: boolean
  onChange: (valor: string) => void
}) {
  const [local, setLocal] = useState(valor)
  const [enfocado, setEnfocado] = useState(false)

  useEffect(() => { setLocal(valor) }, [valor])

  const formatear = (v: string) => {
    const num = parseFloat(v)
    if (isNaN(num) || num === 0) return v
    return num.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  }

  if (soloLectura) {
    const mostrar = esMoneda ? formatear(valor) : valor
    return <span className={`text-sm font-mono ${className}`}>{mostrar}{sufijo}</span>
  }

  const valorMostrar = esMoneda && !enfocado ? formatear(local) : local

  return (
    <div className={`flex items-center ${className}`}>
      <input
        type={enfocado ? 'number' : (esMoneda ? 'text' : 'number')}
        step="any"
        value={valorMostrar}
        onChange={(e) => setLocal(e.target.value)}
        onFocus={() => setEnfocado(true)}
        onBlur={() => {
          setEnfocado(false)
          if (local !== valor) onChange(local)
        }}
        className="w-full bg-transparent border-0 outline-none text-sm font-mono text-right placeholder:text-texto-placeholder focus:bg-superficie-tarjeta focus:rounded px-1 py-0.5 -mx-1 transition-colors [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
      />
      {sufijo && <span className="text-xs text-texto-terciario ml-0.5">{sufijo}</span>}
    </div>
  )
}

function CampoSelect({
  valor,
  opciones,
  soloLectura,
  onChange,
}: {
  valor: string
  opciones: { valor: string; etiqueta: string }[]
  soloLectura: boolean
  onChange: (valor: string) => void
}) {
  if (soloLectura) {
    const opcion = opciones.find(o => o.valor === valor)
    return <span className="text-sm">{opcion?.etiqueta || valor}</span>
  }

  return (
    <select
      value={valor}
      onChange={(e) => onChange(e.target.value)}
      className="w-full bg-transparent border-0 outline-none text-sm cursor-pointer focus:bg-superficie-tarjeta focus:rounded px-0.5 py-0.5 transition-colors text-texto-primario"
    >
      <option value="">—</option>
      {opciones.map((op, i) => (
        <option key={`${op.valor}-${i}`} value={op.valor}>{op.etiqueta}</option>
      ))}
    </select>
  )
}

export { TablaLineas, type PropiedadesTablaLineas }
