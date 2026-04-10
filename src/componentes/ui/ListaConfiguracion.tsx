'use client'

import { type ReactNode, useState, useCallback } from 'react'
import { Reorder, AnimatePresence, motion } from 'framer-motion'
import {
  GripVertical,
  Plus,
  RotateCcw,
  Pencil,
  Trash2,
  Search,
} from 'lucide-react'
import { Boton } from './Boton'
import { Interruptor } from './Interruptor'
import { Checkbox } from './Checkbox'
import { useTraduccion } from '@/lib/i18n'

// ─── Tipos ──────────────────────────────────────────────────────────

/** Badge que se muestra junto al nombre del item */
interface BadgeItem {
  texto: string
  color?: 'exito' | 'peligro' | 'advertencia' | 'info' | 'primario' | 'neutro' | 'violeta' | 'naranja'
}

/** Tag que se muestra debajo del contenido */
interface TagItem {
  texto: string
  variante?: 'marca' | 'neutro'
}

/** Item genérico de la lista */
interface ItemLista {
  id: string
  nombre: string
  subtitulo?: string
  preview?: string
  icono?: ReactNode
  color?: string
  badges?: BadgeItem[]
  tags?: TagItem[]
  activo?: boolean
  predeterminado?: boolean
  esPredefinido?: boolean
  grupo?: string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  datos?: Record<string, any>
}

/** Grupo de items con header */
interface GrupoLista {
  clave: string
  etiqueta: string
  descripcion?: string
}

/** Filtro con contador */
interface FiltroLista {
  clave: string
  etiqueta: string
  contador?: number
}

/** Botón de acción del header */
interface AccionLista {
  tipo: 'primario' | 'secundario' | 'fantasma'
  etiqueta?: string
  icono?: ReactNode
  soloIcono?: boolean
  titulo?: string
  onClick: () => void
}

/** Controles disponibles por fila */
type TipoControles =
  | 'toggle-editar'           // Interruptor + botón editar
  | 'editar-borrar'           // Botón editar + botón borrar
  | 'toggle-editar-borrar'    // Interruptor + editar + borrar
  | 'default-activo-borrar'   // Radio default + checkbox activo + borrar
  | 'solo-borrar'             // Solo botón borrar

interface PropiedadesListaConfiguracion {
  /** Titulo del panel */
  titulo: string
  /** Descripcion debajo del titulo */
  descripcion?: string
  /** Items a renderizar */
  items: ItemLista[]
  /** Tipo de controles por fila */
  controles?: TipoControles
  /** Botones del header (nueva plantilla, sincronizar, etc.) */
  acciones?: AccionLista[]
  /** Filtros tipo tabs con contadores */
  filtros?: FiltroLista[]
  /** Filtro activo */
  filtroActivo?: string
  /** Callback al cambiar filtro */
  onCambioFiltro?: (clave: string) => void
  /** Mostrar buscador */
  buscador?: boolean
  /** Placeholder del buscador */
  placeholderBuscador?: string
  /** Texto actual del buscador */
  textoBuscador?: string
  /** Callback al buscar */
  onBuscar?: (texto: string) => void
  /** Grupos para agrupar items */
  grupos?: GrupoLista[]
  /** Habilitar drag-and-drop */
  ordenable?: boolean
  /** Callback al reordenar */
  onReordenar?: (idsOrdenados: string[]) => void
  /** Callback al cambiar toggle activo */
  onToggleActivo?: (item: ItemLista) => void
  /** Callback al seleccionar como predeterminado */
  onTogglePredeterminado?: (item: ItemLista) => void
  /** Callback al editar item */
  onEditar?: (item: ItemLista) => void
  /** Callback al eliminar item */
  onEliminar?: (item: ItemLista) => void
  /** Mostrar botón restablecer */
  restaurable?: boolean
  /** Callback al restablecer */
  onRestaurar?: () => void
  /** Texto custom del botón restablecer (default: "Restablecer") */
  textoRestablecer?: string
  /** Icono custom del botón restablecer */
  iconoRestablecer?: ReactNode
  /** Texto del botón agregar en el footer */
  textoAgregar?: string
  /** Callback al agregar item */
  onAgregar?: () => void
  /** Nombre del radio group para predeterminado */
  nombreRadio?: string
  /** Render custom del contenido de cada fila (reemplaza el default) */
  renderContenido?: (item: ItemLista) => ReactNode
  /** Render custom de controles extra (se agregan antes de los controles standard) */
  renderControlesExtra?: (item: ItemLista) => ReactNode
  /** Clase extra del contenedor */
  className?: string
}

// ─── Clases de badges ───────────────────────────────────────────────

const clasesBadge: Record<string, string> = {
  exito:       'bg-insignia-exito/15 border-insignia-exito/30 text-insignia-exito',
  peligro:     'bg-insignia-peligro/15 border-insignia-peligro/30 text-insignia-peligro',
  advertencia: 'bg-insignia-advertencia/15 border-insignia-advertencia/30 text-insignia-advertencia',
  info:        'bg-insignia-info/15 border-insignia-info/30 text-insignia-info',
  primario:    'bg-texto-marca/15 border-texto-marca/30 text-texto-marca',
  violeta:     'bg-texto-marca/15 border-texto-marca/30 text-texto-marca',
  naranja:     'bg-insignia-advertencia/15 border-insignia-advertencia/30 text-insignia-advertencia',
  neutro:      'bg-white/7 border-white/10 text-texto-terciario',
}

// ─── Componente principal ───────────────────────────────────────────

function ListaConfiguracion({
  titulo,
  descripcion,
  items,
  controles = 'toggle-editar',
  acciones,
  filtros,
  filtroActivo,
  onCambioFiltro,
  buscador,
  placeholderBuscador = 'Buscar...',
  textoBuscador = '',
  onBuscar,
  grupos,
  ordenable = true,
  onReordenar,
  onToggleActivo,
  onTogglePredeterminado,
  onEditar,
  onEliminar,
  renderContenido,
  renderControlesExtra,
  restaurable,
  onRestaurar,
  textoRestablecer,
  iconoRestablecer,
  textoAgregar,
  onAgregar,
  nombreRadio,
  className = '',
}: PropiedadesListaConfiguracion) {
  const { t } = useTraduccion()

  // ─── Estado interno del buscador (si no es controlado) ──────────
  const [busquedaInterna, setBusquedaInterna] = useState('')
  const busqueda = textoBuscador || busquedaInterna
  const manejarBusqueda = useCallback((texto: string) => {
    if (onBuscar) onBuscar(texto)
    else setBusquedaInterna(texto)
  }, [onBuscar])

  // ─── Render de una fila ─────────────────────────────────────────
  const renderFila = (item: ItemLista) => {
    const contenidoFila = (
      <div className="flex items-center gap-2.5 px-5 py-3 transition-colors hover:bg-white/[0.02] group cursor-default">
        {/* Drag handle */}
        {ordenable && (
          <div
            className="text-texto-terciario/40 cursor-grab active:cursor-grabbing shrink-0 touch-none opacity-0 group-hover:opacity-100 transition-opacity"
            onClick={(e) => e.stopPropagation()}
          >
            <GripVertical size={14} />
          </div>
        )}

        {/* Icono del item (solo si no hay renderContenido custom) */}
        {!renderContenido && item.icono && (
          typeof item.icono === 'string' ? (
            <div
              className="size-8 rounded-lg flex items-center justify-center shrink-0 text-base"
              style={item.color ? { backgroundColor: item.color + '18' } : undefined}
            >
              {item.icono}
            </div>
          ) : (
            <div
              className="size-8 rounded-lg flex items-center justify-center shrink-0"
              style={item.color ? { backgroundColor: item.color + '18', color: item.color } : undefined}
            >
              {item.icono}
            </div>
          )
        )}

        {/* Color dot (si tiene color pero no icono, y no hay renderContenido) */}
        {!renderContenido && item.color && !item.icono && (
          <div
            className="size-2.5 rounded-full shrink-0"
            style={{ backgroundColor: item.color }}
          />
        )}

        {/* Contenido */}
        <div
          className={`flex-1 min-w-0 ${onEditar ? 'cursor-pointer' : ''}`}
          onClick={onEditar ? () => onEditar(item) : undefined}
        >
          {renderContenido ? renderContenido(item) : (
            <>
              {/* Titulo + badges */}
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className={`text-sm font-medium truncate ${item.activo === false ? 'text-texto-terciario line-through' : 'text-texto-primario'}`}>
                  {item.nombre}
                </span>
                {item.badges?.map((b, i) => (
                  <span
                    key={i}
                    className={`inline-flex px-1.5 py-0.5 rounded text-[10px] font-medium border ${clasesBadge[b.color || 'neutro']}`}
                  >
                    {b.texto}
                  </span>
                ))}
              </div>

              {/* Subtitulo */}
              {item.subtitulo && (
                <span className="text-[11px] text-texto-terciario block truncate font-mono">
                  {item.subtitulo}
                </span>
              )}

              {/* Preview */}
              {item.preview && (
                <span className="text-[11px] text-texto-terciario/70 block truncate">
                  {item.preview}
                </span>
              )}

              {/* Tags */}
              {item.tags && item.tags.length > 0 && (
                <div className="flex gap-1 flex-wrap mt-1">
                  {item.tags.map((t, i) => (
                    <span
                      key={i}
                      className={`px-1.5 py-0.5 rounded text-[10px] border ${
                        t.variante === 'neutro'
                          ? 'bg-white/5 border-white/10 text-texto-terciario'
                          : 'bg-texto-marca/12 border-texto-marca/25 text-texto-marca/75'
                      }`}
                    >
                      {t.texto}
                    </span>
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        {/* Controles extra custom */}
        {renderControlesExtra?.(item)}

        {/* Controles standard */}
        <div className="flex items-center gap-1.5 shrink-0">
          {renderControles(item)}
        </div>
      </div>
    )

    // Si es ordenable, envolver en Reorder.Item
    if (ordenable) {
      return (
        <Reorder.Item
          key={item.id}
          value={item.id}
          whileDrag={{
            scale: 1.01,
            boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
            zIndex: 10,
          }}
        >
          {contenidoFila}
        </Reorder.Item>
      )
    }

    return <div key={item.id}>{contenidoFila}</div>
  }

  // ─── Botones reutilizables (definidos una sola vez) ─────────────
  const botonToggle = (item: ItemLista) => (
    <Interruptor activo={item.activo !== false} onChange={() => onToggleActivo?.(item)} />
  )

  const botonEditar = (item: ItemLista) => onEditar ? (
    <Boton variante="fantasma" tamano="xs" soloIcono icono={<Pencil size={13} />} onClick={() => onEditar(item)} titulo={t('comun.editar')} />
  ) : null

  const botonEliminar = (item: ItemLista) => onEliminar ? (
    <Boton variante="fantasma" tamano="xs" soloIcono icono={<Trash2 size={13} />} onClick={() => onEliminar(item)} titulo={t('comun.eliminar')}
      className="text-texto-terciario hover:text-insignia-peligro opacity-0 group-hover:opacity-100 transition-opacity" />
  ) : null

  const radioDefault = (item: ItemLista) => (
    <label className="flex items-center gap-1.5 cursor-pointer text-[11px] text-texto-terciario shrink-0">
      <input type="radio" name={nombreRadio || `default_${titulo}`} checked={!!item.predeterminado}
        onChange={() => onTogglePredeterminado?.(item)} style={{ accentColor: 'var(--texto-marca)' }} className="size-3.5 cursor-pointer" />
      {t('comun.por_defecto')}
    </label>
  )

  const checkActivo = (item: ItemLista) => (
    <Checkbox marcado={item.activo !== false} onChange={() => onToggleActivo?.(item)} etiqueta={t('comun.activo')} className="text-[11px] text-texto-terciario" />
  )

  // ─── Render de controles según tipo ─────────────────────────────
  const renderControles = (item: ItemLista) => {
    switch (controles) {
      case 'toggle-editar':
        return <>{botonToggle(item)}{botonEditar(item)}{botonEliminar(item)}</>
      case 'editar-borrar':
        return <>{botonEditar(item)}{botonEliminar(item)}</>
      case 'toggle-editar-borrar':
        return <>{botonToggle(item)}{botonEditar(item)}{botonEliminar(item)}</>
      case 'default-activo-borrar':
        return <>{radioDefault(item)}{checkActivo(item)}{botonEliminar(item)}</>
      case 'solo-borrar':
        return <>{botonEliminar(item)}</>
      default:
        return null
    }
  }

  // ─── Render de items (con o sin grupos) ─────────────────────────
  const renderItems = () => {
    if (grupos && grupos.length > 0) {
      return (
        <>
          {grupos.map((grupo) => {
            const itemsGrupo = items.filter(i => i.grupo === grupo.clave)
            if (itemsGrupo.length === 0) return null

            return (
              <div key={grupo.clave}>
                {/* Header del grupo */}
                <div className="px-5 py-1.5 flex items-center gap-2 bg-superficie-hover/40">
                  <span className="text-[10px] font-medium text-texto-terciario/60 uppercase tracking-wider">
                    {grupo.etiqueta}
                  </span>
                  {grupo.descripcion && (
                    <span className="text-[10px] text-texto-terciario/40">
                      — {grupo.descripcion}
                    </span>
                  )}
                </div>

                {/* Items del grupo — cada grupo tiene su propio Reorder.Group */}
                {ordenable ? (
                  <Reorder.Group
                    axis="y"
                    values={itemsGrupo.map(i => i.id)}
                    onReorder={(nuevosIds) => {
                      // Reconstruir el orden completo respetando los grupos
                      const otrosItems = items.filter(i => i.grupo !== grupo.clave)
                      const itemsReordenados = nuevosIds
                        .map(id => itemsGrupo.find(i => i.id === id)!)
                        .filter(Boolean)
                      const todosOrdenados = [...otrosItems, ...itemsReordenados]
                      onReordenar?.(todosOrdenados.map(i => i.id))
                    }}
                    className="divide-y divide-white/[0.035]"
                  >
                    <AnimatePresence initial={false}>
                      {itemsGrupo.map(renderFila)}
                    </AnimatePresence>
                  </Reorder.Group>
                ) : (
                  itemsGrupo.map(renderFila)
                )}
              </div>
            )
          })}
        </>
      )
    }

    // Sin grupos
    if (ordenable) {
      return (
        <Reorder.Group
          axis="y"
          values={items.map(i => i.id)}
          onReorder={(nuevosIds) => onReordenar?.(nuevosIds)}
          className="divide-y divide-white/[0.035]"
        >
          <AnimatePresence initial={false}>
            {items.map(renderFila)}
          </AnimatePresence>
        </Reorder.Group>
      )
    }

    return <>{items.map(renderFila)}</>
  }

  // ─── Render principal ───────────────────────────────────────────
  return (
    <div className={`bg-superficie-tarjeta border border-borde-sutil rounded-xl overflow-hidden ${className}`}>

      {/* ─── Header ──────────────────────────────────────────── */}
      <div className="px-5 pt-4 pb-3 border-b border-white/[0.08]">
        <div className="flex items-start justify-between gap-3">
          {/* Izquierda: título + descripción */}
          <div className="min-w-0">
            <h3 className="text-sm font-medium text-texto-primario">{titulo}</h3>
            {descripcion && (
              <p className="text-[11px] text-texto-terciario/70 mt-0.5 leading-relaxed">{descripcion}</p>
            )}
          </div>

          {/* Derecha: acciones apiladas en columna */}
          <div className="flex flex-col items-end gap-1.5 shrink-0">
            {restaurable && (
              <button
                onClick={onRestaurar}
                className="flex items-center gap-1 text-[11px] text-texto-terciario/40 hover:text-texto-terciario bg-transparent border-none cursor-pointer transition-colors"
              >
                {iconoRestablecer || <RotateCcw size={11} />}
                {textoRestablecer || t('comun.restablecer')}
              </button>
            )}
            {acciones?.map((accion, i) => (
              <Boton
                key={i}
                variante={accion.soloIcono ? 'secundario' : accion.tipo === 'fantasma' ? 'fantasma' : accion.tipo === 'primario' ? 'primario' : 'secundario'}
                tamano="sm"
                icono={accion.icono}
                soloIcono={accion.soloIcono}
                titulo={accion.titulo}
                onClick={accion.onClick}
                className={accion.soloIcono ? 'border-white/[0.15] text-texto-secundario hover:bg-texto-marca/10 hover:border-texto-marca/40 hover:text-texto-marca' : ''}
              >
                {accion.soloIcono ? undefined : accion.etiqueta}
              </Boton>
            ))}
          </div>
        </div>
      </div>

      {/* ─── Barra de filtros + buscador ─────────────────────── */}
      {(filtros || buscador) && (
        <div className="px-5 py-2.5 border-b border-white/[0.07] flex items-center gap-2.5">
          {/* Filtros tipo tabs */}
          {filtros && (
            <div className="flex gap-1">
              {filtros.map((f) => (
                <button
                  key={f.clave}
                  onClick={() => onCambioFiltro?.(f.clave)}
                  className={`px-2.5 py-1 rounded-md text-[11px] border transition-all cursor-pointer ${
                    filtroActivo === f.clave
                      ? 'bg-texto-marca/15 border-texto-marca/40 text-texto-marca'
                      : 'border-transparent text-texto-terciario hover:text-texto-secundario'
                  }`}
                >
                  {f.etiqueta}
                  {f.contador !== undefined && (
                    <span className="ml-1 opacity-50">{f.contador}</span>
                  )}
                </button>
              ))}
            </div>
          )}

          {/* Buscador */}
          {buscador && (
            <div className="flex items-center gap-1.5 bg-white/[0.04] border border-white/[0.1] rounded-lg px-2.5 py-1.5 ml-auto">
              <Search size={12} className="text-texto-terciario/60 shrink-0" />
              <input
                type="text"
                placeholder={placeholderBuscador}
                value={busqueda}
                onChange={(e) => manejarBusqueda(e.target.value)}
                className="bg-transparent border-none outline-none text-xs text-texto-secundario w-32 placeholder:text-texto-terciario/40"
              />
            </div>
          )}
        </div>
      )}

      {/* ─── Lista de items ──────────────────────────────────── */}
      <div>
        {items.length === 0 ? (
          <div className="px-5 py-8 text-center">
            <p className="text-sm text-texto-terciario/60">{t('comun.sin_elementos')}</p>
          </div>
        ) : (
          renderItems()
        )}
      </div>

      {/* ─── Footer ──────────────────────────────────────────── */}
      {textoAgregar && onAgregar && (
        <div className="px-5 py-3 border-t border-white/[0.07]">
          <button
            onClick={onAgregar}
            className="flex items-center gap-1.5 text-xs text-texto-marca/60 hover:text-texto-marca bg-transparent border-none cursor-pointer transition-colors"
          >
            <Plus size={13} />
            {textoAgregar}
          </button>
        </div>
      )}
    </div>
  )
}

// ─── Exports ──────────────────────────────────────────────────────

export {
  ListaConfiguracion,
  type PropiedadesListaConfiguracion,
  type ItemLista,
  type GrupoLista,
  type FiltroLista,
  type AccionLista,
  type BadgeItem,
  type TagItem,
  type TipoControles,
}
