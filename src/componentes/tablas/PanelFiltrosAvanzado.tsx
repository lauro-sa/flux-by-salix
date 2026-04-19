'use client'

import { useState, useEffect, useMemo, useRef } from 'react'
import { motion } from 'framer-motion'
import { Reorder } from 'framer-motion'
import { X, Search, Keyboard, Star, Check } from 'lucide-react'
import { Boton } from '@/componentes/ui/Boton'
import { Input } from '@/componentes/ui/Input'
import { SelectorFecha } from '@/componentes/ui/SelectorFecha'
import { FilaVista, GuardarVistaInline } from '@/componentes/tablas/PanelFiltros'
import type { FiltroTabla, GrupoFiltros, DireccionOrden } from '@/componentes/tablas/tipos-tabla'
import type { VistaGuardada, ResultadoDetector } from '@/hooks/useVistasGuardadas'

/* ════════════════════════════════════════════
   PanelFiltrosAvanzado — Layout de 3 columnas
   (navegación | detalle | contexto) + footer

   Inspirado en command centers tipo Linear/Notion.

   Se activa automáticamente desde TablaDinamica cuando se pasa la prop
   `gruposFiltros`. Sin grupos, TablaDinamica usa su layout default
   (dos columnas, más simple). Ver CLAUDE.md sección "Filtros avanzados"
   para la guía de implementación en un módulo nuevo.

   Responsive:
   - Móvil  (< sm 640):  nav → detalle → contexto apilados
   - Tablet (sm - lg):   [nav | detalle] + contexto debajo
   - Desktop (≥ lg):     nav | detalle | contexto (3 columnas)
   ════════════════════════════════════════════ */

interface Props {
  filtros: FiltroTabla[]
  gruposFiltros: GrupoFiltros[]
  opcionesOrden?: { etiqueta: string; clave: string; direccion: DireccionOrden }[]
  ordenamiento: { clave: string; direccion: DireccionOrden }[]
  setOrdenamiento: (v: { clave: string; direccion: DireccionOrden }[]) => void

  // Vistas guardadas
  vistasGuardadas?: VistaGuardada[]
  detector?: ResultadoDetector
  onAplicarVista?: (id: string) => void
  onGuardarVista?: (nombre: string, icono?: string | null) => void
  onRenombrarVista?: (id: string, nombre: string) => void
  onCambiarIconoVista?: (id: string, icono: string | null) => void
  onMarcarPredefinida?: (id: string) => void
  onEliminarVista?: (id: string) => void
  onReordenarVistas?: (idsOrdenados: string[]) => void
  idModulo?: string

  // Meta
  numFiltrosActivos: number
  totalResultados?: number
  onLimpiarTodo: () => void
  onCerrar: () => void
}

export function PanelFiltrosAvanzado({
  filtros,
  gruposFiltros,
  opcionesOrden,
  ordenamiento,
  setOrdenamiento,
  vistasGuardadas,
  detector,
  onAplicarVista,
  onGuardarVista,
  onRenombrarVista,
  onCambiarIconoVista,
  onMarcarPredefinida,
  onEliminarVista,
  onReordenarVistas,
  idModulo,
  numFiltrosActivos,
  totalResultados,
  onLimpiarTodo,
  onCerrar,
}: Props) {
  const mapaFiltros = useMemo(() => new Map(filtros.map(f => [f.id, f])), [filtros])
  // Filtro seleccionado en la columna izquierda — por defecto el primero del primer grupo
  const primerFiltro = gruposFiltros[0]?.filtros[0] || filtros[0]?.id || ''
  const [filtroSelId, setFiltroSelId] = useState(primerFiltro)
  // Buscador de filtros en la columna izquierda
  const [busquedaFiltro, setBusquedaFiltro] = useState('')
  const [buscadorAbierto, setBuscadorAbierto] = useState(false)
  const inputBusquedaRef = useRef<HTMLInputElement>(null)

  // Detectar Mac vs Windows/Linux para mostrar atajos adecuados (⌘ vs Ctrl)
  const [esMac, setEsMac] = useState(false)
  useEffect(() => {
    if (typeof navigator === 'undefined') return
    const plataforma = navigator.platform || (navigator as unknown as { userAgentData?: { platform: string } }).userAgentData?.platform || ''
    setEsMac(/Mac|iPhone|iPod|iPad/.test(plataforma))
  }, [])
  const teclaCmd = esMac ? '⌘' : 'Ctrl'
  const teclaShift = esMac ? '⇧' : 'Shift'

  const filtroSel = mapaFiltros.get(filtroSelId)

  // Función auxiliar: ¿está activo este filtro? (compara contra valorDefault si existe)
  const estaActivo = (f: FiltroTabla): boolean => {
    // Si tiene valorDefault, comparar contra él
    if (f.valorDefault !== undefined) {
      if (Array.isArray(f.valor) && Array.isArray(f.valorDefault)) {
        if (f.valor.length !== f.valorDefault.length) return true
        return !f.valorDefault.every(d => (f.valor as string[]).includes(d))
      }
      return f.valor !== f.valorDefault
    }
    // Sin default: activo si tiene valor no vacío
    if (Array.isArray(f.valor)) return f.valor.length > 0
    return f.valor !== ''
  }

  // Conteo de valores seleccionados por filtro — solo cuenta si está realmente activo
  const conteoFiltro = (f: FiltroTabla): number => {
    if (!estaActivo(f)) return 0
    if (Array.isArray(f.valor)) return f.valor.length
    return f.valor ? 1 : 0
  }

  // Filtros activos (para columna derecha)
  const filtrosActivos = useMemo(() => filtros.filter(estaActivo), [filtros])

  // Atajos de teclado
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // ⌘F / Ctrl+F → abrir buscador de filtros
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'f') {
        e.preventDefault()
        setBuscadorAbierto(true)
        setTimeout(() => inputBusquedaRef.current?.focus(), 50)
      }
      // ⌘⇧X / Ctrl+Shift+X → limpiar todo
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === 'x') {
        e.preventDefault()
        onLimpiarTodo()
      }
      // Esc → cerrar (o cerrar buscador si está abierto)
      if (e.key === 'Escape') {
        if (buscadorAbierto) {
          setBuscadorAbierto(false)
          setBusquedaFiltro('')
        } else {
          onCerrar()
        }
      }
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [buscadorAbierto, onCerrar, onLimpiarTodo])

  // Filtrar grupos por búsqueda
  const busquedaNorm = busquedaFiltro.toLowerCase().trim()
  const gruposVisibles = gruposFiltros
    .map(g => ({
      ...g,
      filtrosVisibles: g.filtros
        .map(id => mapaFiltros.get(id))
        .filter((f): f is FiltroTabla => !!f)
        .filter(f => !busquedaNorm || f.etiqueta.toLowerCase().includes(busquedaNorm)),
    }))
    .filter(g => g.filtrosVisibles.length > 0)

  // Etiqueta resumida del valor activo (para el chip de filtros activos)
  const resumirValor = (f: FiltroTabla): string => {
    if (Array.isArray(f.valor)) {
      const n = f.valor.length
      if (n === 0) return '—'
      if (n === 1) {
        const op = f.opciones?.find(o => o.valor === f.valor[0])
        return op?.etiqueta || String(f.valor[0])
      }
      return `${n} seleccionados`
    }
    if (f.tipo === 'fecha') return String(f.valor)
    const op = f.opciones?.find(o => o.valor === f.valor)
    return op?.etiqueta || String(f.valor)
  }

  const vistasSistema = (vistasGuardadas || []).filter(v => v.es_sistema)
  const vistasPersonales = (vistasGuardadas || []).filter(v => !v.es_sistema)

  return (
    <motion.div
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -6 }}
      transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
      className="absolute top-full left-0 right-0 mt-1 bg-superficie-elevada border border-borde-sutil rounded-popover rounded-t-none! shadow-2xl z-50 overflow-hidden"
    >
      {/* ─── Header ─── */}
      <div className="px-4 py-2.5 border-b border-borde-sutil">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-texto-primario">Filtros</span>
            {numFiltrosActivos > 0 && (
              <>
                <span className="text-texto-terciario">·</span>
                <span className="inline-flex items-center rounded-full bg-texto-marca/15 text-texto-marca text-xxs font-semibold px-2 py-0.5">
                  {numFiltrosActivos} {numFiltrosActivos === 1 ? 'activo' : 'activos'}
                </span>
              </>
            )}
            {typeof totalResultados === 'number' && (
              <span className="text-xs text-texto-terciario ml-2">
                {totalResultados} {totalResultados === 1 ? 'resultado' : 'resultados'}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1">
            {numFiltrosActivos > 0 && (
              <Boton variante="fantasma" tamano="xs" onClick={onLimpiarTodo} className="text-texto-secundario">
                Limpiar
              </Boton>
            )}
            {/* Guardar vista — también aquí para acceso rápido desde el header */}
            {onGuardarVista && detector?.tipo !== 'default' && (
              <GuardarVistaInline onGuardar={onGuardarVista} />
            )}
          </div>
        </div>

        {/* Chips de filtros activos — flex-wrap (sin overflow, chips bajan a otra línea si no entran) */}
        {filtrosActivos.length > 0 && (
          <div className="flex flex-wrap items-center gap-1 mt-2">
            {filtrosActivos.map(f => (
              <span
                key={f.id}
                className="inline-flex items-center gap-1 pl-2 pr-0.5 py-0.5 rounded-full text-xxs font-medium bg-superficie-seleccionada text-texto-marca whitespace-nowrap shrink-0 border border-texto-marca/20"
              >
                <button
                  type="button"
                  onClick={() => setFiltroSelId(f.id)}
                  className="inline-flex items-center gap-1 bg-transparent border-none cursor-pointer text-current p-0"
                >
                  <span className="opacity-70">{f.etiqueta}:</span>
                  <span>{resumirValor(f)}</span>
                </button>
                <button
                  type="button"
                  onClick={() => f.onChange(Array.isArray(f.valor) ? [] : '')}
                  className="inline-flex items-center justify-center size-4 rounded-full hover:bg-texto-marca/15 cursor-pointer border-none bg-transparent text-current p-0 ml-0.5"
                  title="Quitar filtro"
                >
                  <X size={10} />
                </button>
              </span>
            ))}
          </div>
        )}
      </div>

      {/* ─── Cuerpo: 3 layouts según breakpoint ───
           < sm (móvil):      NAV apilado → DETALLE apilado → CONTEXTO apilado
           sm-lg (tablet):    [NAV | DETALLE]  → CONTEXTO (abajo, ancho total)
           ≥ lg (desktop):    NAV | DETALLE | CONTEXTO (3 columnas) */}
      <div className="flex flex-col lg:flex-row divide-y lg:divide-y-0 lg:divide-x divide-borde-sutil lg:max-h-[520px]">

        {/* Grupo Nav + Detalle — se comporta como una "fila" que se apila en móvil */}
        <div className="flex-1 min-w-0 flex flex-col sm:flex-row divide-y sm:divide-y-0 sm:divide-x divide-borde-sutil">

        {/* ═══ Columna 1: Navegación ═══ */}
        <div className="w-full sm:w-[180px] flex flex-col overflow-hidden shrink-0 max-h-[220px] sm:max-h-none">
          {/* Buscador de filtros (⌘F) */}
          <div className="p-2.5 border-b border-borde-sutil">
            {buscadorAbierto ? (
              <Input
                ref={inputBusquedaRef}
                tipo="search"
                value={busquedaFiltro}
                onChange={(e) => setBusquedaFiltro(e.target.value)}
                placeholder="Buscar filtro..."
                compacto
                formato={null}
                onBlur={() => { if (!busquedaFiltro) setBuscadorAbierto(false) }}
              />
            ) : (
              <button
                type="button"
                onClick={() => { setBuscadorAbierto(true); setTimeout(() => inputBusquedaRef.current?.focus(), 50) }}
                className="w-full flex items-center gap-2 px-2 py-1.5 rounded-boton text-xs text-texto-terciario hover:bg-superficie-hover cursor-pointer border-none bg-transparent transition-colors"
              >
                <Search size={12} />
                <span className="flex-1 text-left">Buscar filtro</span>
                <span className="text-xxs text-texto-terciario">{teclaCmd}F</span>
              </button>
            )}
          </div>

          {/* Lista de grupos + filtros — cada grupo como "tarjeta" con separador grueso */}
          <div className="flex-1 overflow-y-auto py-2">
            {gruposVisibles.map((grupo, idx) => (
              <div key={grupo.id}>
                {idx > 0 && <div className="h-px bg-borde-sutil mx-3 my-2" />}
                <div className="px-4 pt-2 pb-1.5 text-xxs font-bold text-texto-primario uppercase tracking-[0.08em]">
                  {grupo.etiqueta}
                </div>
                <div className="px-1.5 flex flex-col gap-px">
                  {grupo.filtrosVisibles.map(f => {
                    const activo = estaActivo(f)
                    const n = conteoFiltro(f)
                    const seleccionado = f.id === filtroSelId
                    return (
                      <button
                        key={f.id}
                        type="button"
                        onClick={() => setFiltroSelId(f.id)}
                        className={[
                          'group w-full flex items-center gap-2 pl-3 pr-2 py-1.5 rounded-boton text-sm text-left cursor-pointer transition-colors border-none relative',
                          seleccionado
                            ? 'bg-superficie-seleccionada text-texto-primario font-medium'
                            : 'bg-transparent text-texto-secundario hover:bg-superficie-hover',
                        ].join(' ')}
                      >
                        {seleccionado && (
                          <span className="absolute left-0 top-1.5 bottom-1.5 w-0.5 bg-texto-marca rounded-r-full" />
                        )}
                        <span className="flex-1 truncate">{f.etiqueta}</span>
                        {activo && n > 0 && (
                          <span className="inline-flex items-center justify-center rounded-full bg-texto-marca/15 text-texto-marca text-xxs font-semibold px-1.5 min-w-[18px] h-[18px]">
                            {n}
                          </span>
                        )}
                      </button>
                    )
                  })}
                </div>
              </div>
            ))}
            {gruposVisibles.length === 0 && (
              <p className="text-xs text-texto-terciario text-center py-4">Sin resultados</p>
            )}
          </div>
        </div>

        {/* ═══ Columna 2: Detalle del filtro seleccionado ═══ */}
        <div className="flex-1 flex flex-col overflow-hidden min-w-0 min-h-[240px] sm:min-h-0">
          {filtroSel ? (
            <>
              <div className="px-4 pt-3 pb-1.5">
                <h3 className="text-sm font-semibold text-texto-primario truncate">{filtroSel.etiqueta}</h3>
                {filtroSel.descripcion && (
                  <p className="text-[11px] leading-snug text-texto-terciario mt-0.5">{filtroSel.descripcion}</p>
                )}
              </div>
              <div className="flex-1 overflow-y-auto px-4 pb-3">
                <RenderDetalleFiltro filtro={filtroSel} />
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-xs text-texto-terciario">
              Seleccioná un filtro a la izquierda
            </div>
          )}
        </div>

        </div>
        {/* /Grupo Nav + Detalle */}

        {/* ═══ Columna 3: Contexto (vistas + orden + atajos) ═══
             En móvil y tablet: ancho completo abajo. En desktop: 200px a la derecha. */}
        <div className="w-full lg:w-[200px] flex flex-col overflow-y-auto shrink-0 p-2.5 gap-2.5">

          {/* Vistas guardadas — tarjeta (arriba de orden) */}
          {idModulo && (
            <div className="rounded-card bg-superficie-tarjeta border border-borde-sutil p-2.5">
              <div className="flex items-center gap-1.5 mb-2">
                <Star size={11} className="text-texto-terciario" />
                <span className="text-xxs font-bold text-texto-primario uppercase tracking-[0.08em]">
                  Vistas guardadas
                </span>
              </div>
              {(!vistasGuardadas || vistasGuardadas.length === 0) && (
                <p className="text-xs text-texto-terciario">Sin vistas</p>
              )}
              {vistasSistema.length > 0 && (
                <div className="flex flex-col gap-0.5 mb-2">
                  {vistasSistema.map(v => (
                    <FilaVista
                      key={v.id}
                      vista={v}
                      esActiva={detector?.vistaActiva?.id === v.id}
                      puedeArrastrar={false}
                      onAplicar={() => onAplicarVista?.(v.id)}
                    />
                  ))}
                </div>
              )}
              {vistasPersonales.length > 0 && onReordenarVistas && (
                <Reorder.Group
                  axis="y"
                  values={vistasPersonales}
                  onReorder={(nuevoOrden) => onReordenarVistas(nuevoOrden.map(v => v.id))}
                  className="flex flex-col gap-0.5"
                >
                  {vistasPersonales.map(v => (
                    <Reorder.Item key={v.id} value={v} className="list-none">
                      <FilaVista
                        vista={v}
                        esActiva={detector?.vistaActiva?.id === v.id}
                        puedeArrastrar
                        onAplicar={() => onAplicarVista?.(v.id)}
                        onRenombrar={onRenombrarVista ? (n) => onRenombrarVista(v.id, n) : undefined}
                        onCambiarIcono={onCambiarIconoVista ? (i) => onCambiarIconoVista(v.id, i) : undefined}
                        onMarcarPredefinida={onMarcarPredefinida ? () => onMarcarPredefinida(v.id) : undefined}
                        onEliminar={onEliminarVista ? () => onEliminarVista(v.id) : undefined}
                      />
                    </Reorder.Item>
                  ))}
                </Reorder.Group>
              )}
            </div>
          )}

          {/* Orden — tarjeta */}
          {opcionesOrden && opcionesOrden.length > 0 && (
            <div className="rounded-card bg-superficie-tarjeta border border-borde-sutil p-2.5">
              <span className="text-xxs font-bold text-texto-primario uppercase tracking-[0.08em] block mb-2">
                Orden
              </span>
              <div className="flex flex-col gap-0.5">
                {opcionesOrden.map(op => {
                  const activo = ordenamiento.length > 0 && ordenamiento[0].clave === op.clave && ordenamiento[0].direccion === op.direccion
                  return (
                    <button
                      key={`${op.clave}-${op.direccion}`}
                      type="button"
                      onClick={() => setOrdenamiento([{ clave: op.clave, direccion: op.direccion }])}
                      className={[
                        'flex items-center gap-2 px-2 py-1.5 rounded-boton text-xs text-left cursor-pointer border-none transition-colors',
                        activo ? 'bg-texto-marca/10 text-texto-marca font-medium' : 'bg-transparent text-texto-secundario hover:bg-superficie-hover',
                      ].join(' ')}
                    >
                      {activo ? <Check size={12} className="text-texto-marca" /> : <span className="size-3" />}
                      <span className="flex-1 truncate">{op.etiqueta}</span>
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {/* Atajos — tarjeta (solo desktop, sin sentido en mobile touch) */}
          <div className="hidden sm:flex rounded-card bg-superficie-tarjeta border border-borde-sutil p-2.5 mt-auto flex-col">
            <div className="flex items-center gap-1.5 mb-2">
              <Keyboard size={11} className="text-texto-terciario" />
              <span className="text-xxs font-bold text-texto-primario uppercase tracking-[0.08em]">
                Atajos
              </span>
            </div>
            <div className="flex flex-col gap-1.5 text-xs">
              <AtajoFila etiqueta="Buscar filtro" teclas={[teclaCmd, 'F']} />
              <AtajoFila etiqueta="Limpiar todo" teclas={[teclaCmd, teclaShift, 'X']} />
              <AtajoFila etiqueta="Cerrar" teclas={['Esc']} />
            </div>
          </div>
        </div>
      </div>

      {/* ─── Footer ─── */}
      <div className="flex items-center justify-between px-4 py-2 border-t border-borde-sutil bg-superficie-tarjeta/30">
        <span className="text-xs text-texto-terciario">
          Los cambios se aplican en tiempo real
        </span>
        <div className="flex items-center gap-2">
          {/* Guardar vista — se enciende cuando hay cambios sin guardar */}
          {onGuardarVista && detector?.tipo !== 'default' && (
            <GuardarVistaInline onGuardar={onGuardarVista} />
          )}
          <Boton variante="secundario" tamano="sm" onClick={onCerrar}>
            Cerrar
          </Boton>
        </div>
      </div>
    </motion.div>
  )
}

/* ════════════════════════════════════════════
   Sub-componente: Render del filtro en la columna central.
   Usa opciones "grandes" (más espacio que el SeccionFiltroPanel).
   ════════════════════════════════════════════ */
function RenderDetalleFiltro({ filtro }: { filtro: FiltroTabla }) {
  // Fecha
  if (filtro.tipo === 'fecha') {
    return (
      <div className="flex flex-col gap-2 max-w-xs">
        <SelectorFecha
          valor={typeof filtro.valor === 'string' ? filtro.valor : null}
          onChange={(v) => filtro.onChange(v || '')}
          limpiable
        />
      </div>
    )
  }

  if (!filtro.opciones || filtro.opciones.length === 0) {
    return <p className="text-sm text-texto-terciario">Sin opciones disponibles</p>
  }

  const esMultiple = filtro.tipo === 'multiple' || filtro.tipo === 'multiple-compacto'
  const valores = Array.isArray(filtro.valor) ? filtro.valor : []
  const valorSingle = typeof filtro.valor === 'string' ? filtro.valor : ''

  // Lista en columna única — opciones compactas tipo menú
  return (
    <div className="flex flex-col gap-px max-w-xs">
      {filtro.opciones.map(op => {
        const seleccionado = esMultiple ? valores.includes(op.valor) : valorSingle === op.valor
        return (
          <button
            key={op.valor}
            type="button"
            onClick={() => {
              if (esMultiple) {
                filtro.onChange(seleccionado ? valores.filter(v => v !== op.valor) : [...valores, op.valor])
              } else {
                filtro.onChange(valorSingle === op.valor ? '' : op.valor)
              }
            }}
            className={[
              'flex items-center gap-2.5 px-2.5 py-1.5 rounded-boton text-sm text-left cursor-pointer border-none transition-colors',
              'focus-visible:outline-2 focus-visible:outline-texto-marca focus-visible:-outline-offset-2',
              seleccionado
                ? 'bg-superficie-seleccionada text-texto-primario font-medium'
                : 'bg-transparent text-texto-secundario hover:bg-superficie-hover',
            ].join(' ')}
          >
            {esMultiple ? (
              <span
                className="inline-flex items-center justify-center size-4 rounded border shrink-0 transition-colors"
                style={seleccionado
                  ? { backgroundColor: 'var(--texto-marca)', borderColor: 'var(--texto-marca)' }
                  : { borderColor: 'var(--borde-fuerte)' }}
              >
                {seleccionado && <Check size={10} className="text-texto-inverso" />}
              </span>
            ) : (
              <span
                className="inline-flex items-center justify-center size-4 rounded-full border shrink-0 transition-colors"
                style={seleccionado
                  ? { borderColor: 'var(--texto-marca)' }
                  : { borderColor: 'var(--borde-fuerte)' }}
              >
                {seleccionado && <span className="size-2 rounded-full bg-texto-marca" />}
              </span>
            )}
            <span className="flex-1 truncate">{op.etiqueta}</span>
          </button>
        )
      })}
    </div>
  )
}

/* ── Helper: fila de atajo ── */
function AtajoFila({ etiqueta, teclas }: { etiqueta: string; teclas: string[] }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-texto-secundario truncate">{etiqueta}</span>
      <div className="flex items-center gap-0.5 shrink-0">
        {teclas.map((t, i) => (
          <kbd
            key={i}
            className="inline-flex items-center justify-center min-w-[22px] h-[22px] px-1 rounded border border-borde-sutil bg-superficie-tarjeta text-xxs font-mono text-texto-secundario"
          >
            {t}
          </kbd>
        ))}
      </div>
    </div>
  )
}
