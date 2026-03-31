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

// Anchos por columna — flex para producto, fijo para numéricos
const ANCHO_COLUMNA: Record<string, string> = {
  producto: 'flex-1 min-w-[120px]',
  descripcion: 'hidden',
  cantidad: 'w-[60px] shrink-0',
  unidad: 'w-[70px] shrink-0',
  precio_unitario: 'w-[100px] shrink-0',
  descuento: 'w-[60px] shrink-0',
  impuesto: 'w-[100px] shrink-0',
  subtotal: 'w-[110px] shrink-0',
}

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
    <div className="w-full min-w-0 overflow-x-auto">
      {/* ─── Barra superior: config columnas ─── */}
      <div className="flex items-center justify-between mb-2 px-1">
        <span className="text-xs text-texto-terciario font-medium uppercase tracking-wide">
          Líneas del presupuesto
        </span>
        {!soloLectura && (
          <div className="relative" ref={menuColRef}>
            <button
              onClick={() => setMenuColumnasAbierto(!menuColumnasAbierto)}
              className="flex items-center gap-1 text-xs text-texto-terciario hover:text-texto-secundario transition-colors p-1 rounded"
              title="Configurar columnas"
            >
              <Settings2 size={14} />
              Columnas
            </button>

            <AnimatePresence>
              {menuColumnasAbierto && (
                <motion.div
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  className="absolute right-0 top-full mt-1 bg-superficie-elevada border border-borde-sutil rounded-lg shadow-lg py-1 z-20 min-w-[200px]"
                >
                  {COLUMNAS_LINEA_DISPONIBLES.map((col) => {
                    const visible = columnasVisibles.includes(col.id)
                    return (
                      <button
                        key={col.id}
                        onClick={() => {
                          if (col.requerida) return
                          const nuevas = visible
                            ? columnasVisibles.filter(c => c !== col.id)
                            : [...columnasVisibles, col.id]
                          onCambiarColumnas(nuevas)
                        }}
                        disabled={col.requerida}
                        className={`w-full flex items-center gap-2 px-3 py-1.5 text-sm text-left transition-colors ${
                          col.requerida ? 'opacity-50 cursor-not-allowed' : 'hover:bg-superficie-tarjeta'
                        }`}
                      >
                        {visible ? <Eye size={14} className="text-texto-marca" /> : <EyeOff size={14} className="text-texto-terciario" />}
                        {col.label}
                      </button>
                    )
                  })}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}
      </div>

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

      {/* ─── Botones agregar línea (inline) ─── */}
      {!soloLectura && (
        <div className="flex items-center gap-1 mt-3 pt-3 border-t border-borde-sutil">
          {(['producto', 'seccion', 'nota', 'descuento'] as TipoLinea[]).map((tipo, idx) => (
            <span key={tipo} className="flex items-center">
              {idx > 0 && <span className="text-texto-terciario/40 mx-1.5">|</span>}
              <button
                onClick={() => onAgregarLinea(tipo)}
                className="text-sm text-texto-marca hover:underline transition-colors"
              >
                {tipo === 'producto' ? 'Agregar producto' : ETIQUETA_TIPO[tipo]}
              </button>
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
          <button
            onClick={(e) => { e.stopPropagation(); onEliminar(linea.id) }}
            className="w-8 flex items-center justify-center text-texto-terciario hover:text-estado-error opacity-0 group-hover:opacity-100 transition-all shrink-0"
          >
            <Trash2 size={14} />
          </button>
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
            <textarea
              value={linea.descripcion_detalle || ''}
              placeholder="Detalle adicional (opcional)"
              onChange={(e) => onEditar(linea.id, 'descripcion_detalle', e.target.value)}
              rows={linea.descripcion_detalle ? Math.min(Math.ceil((linea.descripcion_detalle.length || 0) / 60), 6) : 1}
              className="w-full max-w-lg bg-transparent outline-none text-xs text-texto-secundario placeholder:text-texto-terciario/40 resize-none leading-relaxed"
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
      className={`w-full bg-transparent border-0 outline-none text-sm placeholder:text-texto-terciario/50 focus:bg-superficie-tarjeta focus:rounded px-1 py-0.5 -mx-1 transition-colors ${className}`}
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
        className="w-full bg-transparent border-0 outline-none text-sm font-mono text-right placeholder:text-texto-terciario/50 focus:bg-superficie-tarjeta focus:rounded px-1 py-0.5 -mx-1 transition-colors [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
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
