'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import { motion, AnimatePresence, Reorder } from 'framer-motion'
import {
  Trash2, GripVertical, Package, Type,
  StickyNote, Percent, Settings2, Eye, EyeOff,
  RotateCcw, Upload,
} from 'lucide-react'
import type { LineaPresupuesto, TipoLinea, Impuesto, UnidadMedida } from '@/tipos/presupuesto'
import { COLUMNAS_LINEA_DISPONIBLES } from '@/tipos/presupuesto'
import { BuscadorProducto } from '@/componentes/entidad/BuscadorProducto'
import { Boton } from '@/componentes/ui/Boton'
import { Select } from '@/componentes/ui/Select'
import { OpcionMenu } from '@/componentes/ui/OpcionMenu'
import { TextArea } from '@/componentes/ui/TextArea'
import { EstadoVacio } from '@/componentes/feedback/EstadoVacio'
import { useFormato } from '@/hooks/useFormato'

/**
 * TablaLineas — Editor de líneas del presupuesto.
 * Soporta 4 tipos de línea: producto, sección, nota, descuento.
 * Columnas configurables (mostrar/ocultar).
 * Drag & drop para reordenar.
 * Se usa en: página de nuevo presupuesto y detalle/edición.
 */

/** Convierte HTML (ej. <p>Línea 1</p><p>Línea 2</p>) a texto plano con saltos de línea */
function htmlATextoPlano(html: string): string {
  if (!html || !html.includes('<')) return html
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>\s*<p[^>]*>/gi, '\n')
    .replace(/<\/?[^>]+(>|$)/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .trim()
}

// ─── Tipos ───

/** Datos originales del catálogo para detectar cambios en nombre/descripción */
export interface OriginalCatalogo {
  producto_id: string
  nombre: string
  descripcion_venta: string | null
}

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
  /** ID de la última línea recién agregada para auto-focus */
  lineaRecienAgregada?: string | null
  /** Originales del catálogo por lineaId — para detectar cambios en nombre/descripción */
  originalesCatalogo?: Map<string, OriginalCatalogo>
  /** Callback para actualizar el catálogo con los datos editados de la línea */
  onActualizarCatalogo?: (lineaId: string) => Promise<void>
  /** Callback para revertir la línea a los valores originales del catálogo */
  onRevertirCatalogo?: (lineaId: string) => void
  /** Si el usuario tiene permiso de editar productos */
  puedeEditarProductos?: boolean
  /** Si el presupuesto ya fue guardado (tiene ID en BD) */
  presupuestoGuardado?: boolean
  /** Notificar al padre cuando se selecciona un producto del catálogo (para almacenar originales) */
  onProductoSeleccionado?: (lineaId: string, producto: { id: string; nombre: string; descripcion_venta: string | null }) => void
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
  producto: 'flex-1 min-w-[80px] sm:min-w-[120px]',
  descripcion: 'hidden',
  cantidad: 'min-w-[45px] sm:min-w-[55px] shrink-0',
  unidad: 'min-w-[50px] sm:min-w-[65px] shrink-0',
  precio_unitario: 'min-w-[80px] sm:min-w-[130px] shrink-0',
  descuento: 'min-w-[45px] sm:min-w-[55px] shrink-0',
  impuesto: 'min-w-[65px] sm:min-w-[95px] shrink-0',
  subtotal: 'min-w-[90px] sm:min-w-[145px] shrink-0',
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
  lineaRecienAgregada,
  originalesCatalogo,
  onActualizarCatalogo,
  onRevertirCatalogo,
  puedeEditarProductos = false,
  presupuestoGuardado = false,
  onProductoSeleccionado,
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

  const formatoHook = useFormato()
  // Formatear número como moneda del documento
  const fmt = useCallback((valor: string) => {
    const num = parseFloat(valor || '0')
    return new Intl.NumberFormat(formatoHook.locale, {
      style: 'currency',
      currency: moneda || formatoHook.codigoMoneda,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(num)
  }, [moneda, formatoHook.locale, formatoHook.codigoMoneda])

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
                  className="absolute right-0 top-full mt-1 bg-superficie-elevada border border-borde-sutil rounded-card shadow-lg py-2 z-20 min-w-[220px]"
                >
                  {/* Columnas visibles — reordenables */}
                  <div className="px-3 pb-1 mb-1 border-b border-borde-sutil">
                    <span className="text-xxs text-texto-terciario uppercase tracking-wider">Visibles</span>
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
                          className="flex items-center gap-2 px-2 py-1.5 text-sm rounded-boton cursor-grab active:cursor-grabbing hover:bg-superficie-tarjeta"
                        >
                          {!col.requerida && <GripVertical size={12} className="text-texto-terciario shrink-0" />}
                          {col.requerida && <div className="w-3 shrink-0" />}
                          <span className="flex-1 text-texto-primario">{col.label}</span>
                          {!col.requerida && (
                            <Boton variante="fantasma" tamano="xs" soloIcono titulo="Ocultar columna" icono={<EyeOff size={12} />} onClick={() => onCambiarColumnas(columnasVisibles.filter(c => c !== colId))} className="text-texto-terciario hover:text-insignia-peligro" />
                          )}
                        </Reorder.Item>
                      )
                    })}
                  </Reorder.Group>

                  {/* Columnas ocultas */}
                  {COLUMNAS_LINEA_DISPONIBLES.filter(c => !columnasVisibles.includes(c.id) && !c.requerida).length > 0 && (
                    <>
                      <div className="px-3 pt-2 pb-1 mt-1 border-t border-borde-sutil">
                        <span className="text-xxs text-texto-terciario uppercase tracking-wider">Ocultas</span>
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
            <div key={col} className={`${ANCHO_COLUMNA[col] || 'w-[100px]'} px-1 ${col === 'producto' ? '' : 'text-center'}`}>
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
                  autoFocus={linea.id === lineaRecienAgregada}
                />
              ) : linea.tipo_linea === 'nota' ? (
                <FilaNota
                  linea={linea}
                  soloLectura={soloLectura}
                  onEditar={onEditarLinea}
                  onEliminar={onEliminarLinea}
                  autoFocus={linea.id === lineaRecienAgregada}
                />
              ) : linea.tipo_linea === 'descuento' ? (
                <FilaDescuento
                  linea={linea}
                  soloLectura={soloLectura}
                  simboloMoneda={simboloMoneda}
                  onEditar={onEditarLinea}
                  onEliminar={onEliminarLinea}
                  autoFocus={linea.id === lineaRecienAgregada}
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
                  autoFocus={linea.id === lineaRecienAgregada}
                  originalCatalogo={originalesCatalogo?.get(linea.id)}
                  onActualizarCatalogo={onActualizarCatalogo}
                  onRevertirCatalogo={onRevertirCatalogo}
                  puedeEditarProductos={puedeEditarProductos}
                  presupuestoGuardado={presupuestoGuardado}
                  onProductoSeleccionadoPadre={onProductoSeleccionado}
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
        <EstadoVacio titulo="Sin líneas" descripcion="Agregá productos, servicios o texto libre." />
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
  autoFocus,
  originalCatalogo,
  onActualizarCatalogo,
  onRevertirCatalogo,
  puedeEditarProductos,
  presupuestoGuardado,
  onProductoSeleccionadoPadre,
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
  autoFocus?: boolean
  originalCatalogo?: OriginalCatalogo
  onActualizarCatalogo?: (lineaId: string) => Promise<void>
  onRevertirCatalogo?: (lineaId: string) => void
  puedeEditarProductos?: boolean
  presupuestoGuardado?: boolean
  onProductoSeleccionadoPadre?: (lineaId: string, producto: { id: string; nombre: string; descripcion_venta: string | null }) => void
}) {
  const [actualizandoCatalogo, setActualizandoCatalogo] = useState(false)

  // Detectar si nombre o descripción difieren del catálogo
  const cambiosCatalogo = originalCatalogo ? {
    nombre: (linea.descripcion || '') !== originalCatalogo.nombre,
    descripcion: htmlATextoPlano(linea.descripcion_detalle || '') !== htmlATextoPlano(originalCatalogo.descripcion_venta || ''),
  } : null
  const tieneCambiosCatalogo = cambiosCatalogo && (cambiosCatalogo.nombre || cambiosCatalogo.descripcion)
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
          <div key={col} className={`${ANCHO_COLUMNA[col] || 'w-[100px]'} px-1 ${col !== 'producto' && col !== 'descripcion' ? 'text-center' : ''}`}>
            {col === 'producto' && (
              <BuscadorProducto
                valor={linea.descripcion || ''}
                codigo={linea.codigo_producto || ''}
                soloLectura={soloLectura}
                autoFocus={autoFocus}
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
                  // Almacenar originales del catálogo para detectar cambios
                  onProductoSeleccionadoPadre?.(linea.id, {
                    id: producto.id,
                    nombre: producto.nombre,
                    descripcion_venta: producto.descripcion_venta,
                  })
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
                className="text-center"
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
                className="text-center"
                esMoneda
                onChange={(v) => onEditar(linea.id, 'precio_unitario', v)}
              />
            )}
            {col === 'descuento' && (
              <CampoNumero
                valor={linea.descuento}
                soloLectura={soloLectura}
                className="text-center"
                sufijo="%"
                onChange={(v) => onEditar(linea.id, 'descuento', v)}
              />
            )}
            {col === 'impuesto' && (
              <CampoSelect
                valor={linea.impuesto_label || ''}
                opciones={impuestos.filter(i => i.activo).map(i => ({ valor: i.label, etiqueta: i.label }))}
                soloLectura={soloLectura}
                onChange={(v) => {
                  const imp = impuestos.find(i => i.label === v)
                  onEditar(linea.id, 'impuesto_porcentaje', imp ? String(imp.porcentaje) : '0')
                  onEditar(linea.id, 'impuesto_label', v || '')
                }}
              />
            )}
            {col === 'subtotal' && (
              <div className="text-center font-mono text-sm text-texto-marca font-medium">
                {fmt(linea.subtotal)}
              </div>
            )}
          </div>
        ))}

        {!soloLectura && (
          <Boton variante="fantasma" tamano="xs" soloIcono titulo="Eliminar línea" icono={<Trash2 size={14} />} onClick={(e) => { e.stopPropagation(); onEliminar(linea.id) }} className="w-8 text-texto-terciario hover:text-estado-error opacity-0 group-hover:opacity-100" />
        )}
      </div>

      {/* Descripción detallada debajo (solo si tiene contenido o está activa) */}
      {(activa || linea.descripcion_detalle) && (
        <div className={`pb-2 ${!soloLectura ? 'pl-8' : 'pl-2'} pr-10`}>
          {soloLectura ? (
            linea.descripcion_detalle && (
              <div
                className="text-xs text-texto-secundario leading-relaxed max-w-lg [&_p]:mb-1 [&_p:last-child]:mb-0"
                dangerouslySetInnerHTML={{ __html: linea.descripcion_detalle }}
              />
            )
          ) : (
            <TextArea
              value={htmlATextoPlano(linea.descripcion_detalle || '')}
              placeholder="Detalle adicional (opcional)"
              onChange={(e) => onEditar(linea.id, 'descripcion_detalle', e.target.value)}
              rows={linea.descripcion_detalle ? Math.min(Math.ceil((htmlATextoPlano(linea.descripcion_detalle).length || 0) / 60), 6) : 1}
              variante="transparente"
              compacto
              className="max-w-lg leading-relaxed"
            />
          )}
        </div>
      )}

      {/* ─── Barra de cambios vs catálogo ─── */}
      {!soloLectura && tieneCambiosCatalogo && puedeEditarProductos && (
        <div className={`flex items-center gap-2 pb-2 ${!soloLectura ? 'pl-8' : 'pl-2'} pr-10`}>
          <div className="flex items-center gap-1.5 text-xxs text-texto-terciario bg-superficie-app/80 border border-borde-sutil/50 rounded-card px-2.5 py-1.5">
            <span className="text-insignia-advertencia">Editado vs catálogo</span>
            <span className="text-texto-terciario/40">|</span>
            {presupuestoGuardado && onActualizarCatalogo && (
              <button
                type="button"
                disabled={actualizandoCatalogo}
                onClick={async (e) => {
                  e.stopPropagation()
                  setActualizandoCatalogo(true)
                  try { await onActualizarCatalogo(linea.id) } finally { setActualizandoCatalogo(false) }
                }}
                className="flex items-center gap-1 text-texto-marca hover:text-texto-primario transition-colors disabled:opacity-50"
              >
                <Upload size={11} />
                {actualizandoCatalogo ? 'Guardando...' : 'Actualizar catálogo'}
              </button>
            )}
            {!presupuestoGuardado && (
              <span className="text-texto-terciario/60 italic">Guardá el presupuesto para actualizar el catálogo</span>
            )}
            {onRevertirCatalogo && (
              <>
                <span className="text-texto-terciario/40">|</span>
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); onRevertirCatalogo(linea.id) }}
                  className="flex items-center gap-1 text-texto-terciario hover:text-texto-primario transition-colors"
                >
                  <RotateCcw size={11} />
                  Revertir
                </button>
              </>
            )}
          </div>
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
  autoFocus,
}: {
  linea: LineaPresupuesto
  soloLectura: boolean
  onEditar: (id: string, campo: string, valor: string) => void
  onEliminar: (id: string) => void
  autoFocus?: boolean
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
          autoFocus={autoFocus}
          className="font-semibold text-sm text-texto-secundario"
          onChange={(v) => onEditar(linea.id, 'descripcion', v)}
        />
      </div>
      {!soloLectura && (
        <Boton variante="fantasma" tamano="xs" soloIcono titulo="Eliminar sección" icono={<Trash2 size={14} />} onClick={() => onEliminar(linea.id)} className="w-8 opacity-0 group-hover:opacity-100" />
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
  autoFocus,
}: {
  linea: LineaPresupuesto
  soloLectura: boolean
  onEditar: (id: string, campo: string, valor: string) => void
  onEliminar: (id: string) => void
  autoFocus?: boolean
}) {
  return (
    <div className="flex items-start gap-1 px-1 py-2">
      {!soloLectura && (
        <div className="w-6 flex items-center justify-center cursor-grab opacity-0 group-hover:opacity-50 transition-opacity mt-0.5">
          <GripVertical size={14} />
        </div>
      )}
      <div className="flex-1 flex items-start gap-2">
        <StickyNote size={14} className="text-texto-terciario shrink-0 mt-1" />
        {soloLectura ? (
          <p className="text-sm text-texto-secundario italic whitespace-pre-wrap">{linea.descripcion || ''}</p>
        ) : (
          <CampoTextoNota
            valor={linea.descripcion || ''}
            placeholder="Nota o comentario..."
            autoFocus={autoFocus}
            onChange={(v) => onEditar(linea.id, 'descripcion', v)}
          />
        )}
      </div>
      {!soloLectura && (
        <Boton variante="fantasma" tamano="xs" soloIcono titulo="Eliminar nota" icono={<Trash2 size={14} />} onClick={() => onEliminar(linea.id)} className="w-8 opacity-0 group-hover:opacity-100" />
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
  autoFocus,
}: {
  linea: LineaPresupuesto
  soloLectura: boolean
  simboloMoneda: string
  onEditar: (id: string, campo: string, valor: string) => void
  onEliminar: (id: string) => void
  autoFocus?: boolean
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
          autoFocus={autoFocus}
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
        <Boton variante="fantasma" tamano="xs" soloIcono titulo="Eliminar descuento" icono={<Trash2 size={14} />} onClick={() => onEliminar(linea.id)} className="w-8 opacity-0 group-hover:opacity-100" />
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
  autoFocus,
  onChange,
}: {
  valor: string
  placeholder?: string
  soloLectura: boolean
  className?: string
  autoFocus?: boolean
  onChange: (valor: string) => void
}) {
  const [local, setLocal] = useState(valor)
  const ref = useRef<HTMLInputElement>(null)

  // Sincronizar con prop
  useEffect(() => { setLocal(valor) }, [valor])

  // Auto-focus al montar
  useEffect(() => {
    if (autoFocus && ref.current) {
      requestAnimationFrame(() => {
        ref.current?.focus()
        ref.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
      })
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

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

function CampoTextoNota({
  valor,
  placeholder,
  autoFocus,
  onChange,
}: {
  valor: string
  placeholder?: string
  autoFocus?: boolean
  onChange: (valor: string) => void
}) {
  const [local, setLocal] = useState(valor)
  const ref = useRef<HTMLTextAreaElement>(null)

  useEffect(() => { setLocal(valor) }, [valor])

  // Auto-focus al montar
  useEffect(() => {
    if (autoFocus && ref.current) {
      requestAnimationFrame(() => {
        ref.current?.focus()
        ref.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
      })
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Auto-resize del textarea
  useEffect(() => {
    if (ref.current) {
      ref.current.style.height = 'auto'
      ref.current.style.height = `${ref.current.scrollHeight}px`
    }
  }, [local])

  return (
    <textarea
      ref={ref}
      value={local}
      placeholder={placeholder}
      onChange={(e) => setLocal(e.target.value)}
      onBlur={() => { if (local !== valor) onChange(local) }}
      rows={1}
      className="w-full bg-transparent border-0 outline-none text-sm text-texto-secundario italic placeholder:text-texto-placeholder focus:bg-superficie-tarjeta focus:rounded px-1 py-0.5 -mx-1 transition-colors resize-none overflow-hidden"
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
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { setLocal(valor) }, [valor])

  const formatoNum = useFormato()
  const formatear = (v: string) => {
    const num = parseFloat(v)
    if (isNaN(num) || num === 0) return v
    return formatoNum.numero(num, 2)
  }

  if (soloLectura) {
    const mostrar = esMoneda ? formatear(valor) : valor
    return <span className={`text-sm font-mono ${className}`}>{mostrar}{sufijo}</span>
  }

  const valorMostrar = esMoneda && !enfocado ? formatear(local) : local

  return (
    <div className={`flex items-center ${className}`}>
      <input
        ref={inputRef}
        type={enfocado ? 'text' : (esMoneda ? 'text' : 'number')}
        inputMode="decimal"
        step="any"
        value={valorMostrar}
        onChange={(e) => setLocal(e.target.value)}
        onFocus={() => {
          setEnfocado(true)
          requestAnimationFrame(() => {
            try { inputRef.current?.select() } catch { /* algunos navegadores no soportan select en number */ }
          })
        }}
        onBlur={() => {
          setEnfocado(false)
          if (local !== valor) onChange(local)
        }}
        className="w-full bg-transparent border-0 outline-none text-sm font-mono text-center placeholder:text-texto-placeholder focus:bg-superficie-tarjeta focus:rounded px-1 py-0.5 -mx-1 transition-colors [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
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
    <Select
      valor={valor}
      onChange={onChange}
      opciones={[{ valor: '', etiqueta: '—' }, ...opciones]}
      variante="plano"
      className="w-full text-sm"
    />
  )
}

export { TablaLineas, type PropiedadesTablaLineas }
