'use client'

import { useMemo } from 'react'
import { motion, Reorder } from 'framer-motion'
import {
  X, Check, Pin, PinOff, RotateCcw,
  GripVertical, AlignLeft, AlignCenter, AlignRight, StretchHorizontal, Minus,
} from 'lucide-react'
import type { ColumnaDinamica, OpcionesVisuales } from '@/componentes/tablas/tipos-tabla'

/* ════════════════════════════════════════════
   Sub-componente: Contenido de fila de columna
   ════════════════════════════════════════════ */

/** Contenido interno de una fila de columna (checkbox, icono, nombre, pin, alineación) */
function ContenidoFilaColumna<T>({ clave, mapaColumnas, columnasVisibles, columnasAncladas, alineacionColumnas,
  onToggleColumna, onToggleAnclar, onCambiarAlineacion, arrastrable = false }: {
  clave: string
  mapaColumnas: Map<string, ColumnaDinamica<T>>
  columnasVisibles: string[]
  columnasAncladas: string[]
  alineacionColumnas: Record<string, 'left' | 'center' | 'right'>
  onToggleColumna: (clave: string) => void
  onToggleAnclar: (clave: string) => void
  onCambiarAlineacion: (clave: string, al: 'left' | 'center' | 'right') => void
  arrastrable?: boolean
}) {
  const col = mapaColumnas.get(clave)
  if (!col) return null
  const visible = columnasVisibles.includes(clave)
  const anclada = columnasAncladas.includes(clave)
  const alineacion = alineacionColumnas[clave] || col.alineacion || 'left'

  const contenido = (
    <>
      {arrastrable && <GripVertical size={14} className="text-texto-terciario opacity-40 shrink-0" />}
      <button type="button" onClick={() => onToggleColumna(clave)}
        className="shrink-0 size-5 inline-flex items-center justify-center rounded border border-borde-sutil cursor-pointer bg-transparent transition-colors"
        style={visible ? { backgroundColor: 'var(--texto-marca)', borderColor: 'var(--texto-marca)' } : {}}>
        {visible && <Check size={10} className="text-texto-inverso" />}
      </button>
      {col.icono && <span className={`shrink-0 ${visible ? 'text-texto-terciario' : 'text-texto-terciario/40'}`}>{col.icono}</span>}
      <span className={`flex-1 text-sm truncate ${visible ? 'text-texto-primario' : 'text-texto-terciario line-through'}`}>
        {col.etiqueta}
      </span>
      {visible && (
        <>
          <button type="button" onClick={() => onToggleAnclar(clave)}
            className={`shrink-0 size-6 inline-flex items-center justify-center rounded cursor-pointer border-none bg-transparent transition-colors ${
              anclada ? 'text-texto-marca' : 'text-texto-terciario'
            }`} title={anclada ? 'Desanclar' : 'Anclar columna'}>
            {anclada ? <PinOff size={12} /> : <Pin size={12} />}
          </button>
          <div className="shrink-0 flex items-center rounded-md border border-borde-sutil overflow-hidden">
            {([
              { val: 'left' as const, icono: <AlignLeft size={10} />, titulo: 'Izquierda' },
              { val: 'center' as const, icono: <AlignCenter size={10} />, titulo: 'Centro' },
              { val: 'right' as const, icono: <AlignRight size={10} />, titulo: 'Derecha' },
            ]).map(({ val, icono, titulo }) => (
              <button key={val} type="button" onClick={() => onCambiarAlineacion(clave, val)}
                className={`size-6 inline-flex items-center justify-center cursor-pointer border-none transition-colors ${
                  alineacion === val ? 'bg-texto-marca text-texto-inverso' : 'bg-transparent text-texto-terciario hover:bg-superficie-hover'
                }`} title={titulo}>
                {icono}
              </button>
            ))}
          </div>
        </>
      )}
    </>
  )

  if (arrastrable) {
    return (
      <Reorder.Item value={clave}
        className="flex items-center gap-1.5 px-2 py-1.5 rounded-md hover:bg-superficie-hover cursor-grab active:cursor-grabbing">
        {contenido}
      </Reorder.Item>
    )
  }

  return (
    <div className="flex items-center gap-1.5 px-2 py-1.5 rounded-md hover:bg-superficie-hover">
      {contenido}
    </div>
  )
}

/* ════════════════════════════════════════════
   Sub-componente: Panel de columnas (sidebar derecho)
   ════════════════════════════════════════════ */

export interface PropsPanelColumnas<T> {
  columnas: ColumnaDinamica<T>[]
  columnasVisibles: string[]
  ordenColumnas: string[]
  columnasAncladas: string[]
  alineacionColumnas: Record<string, 'left' | 'center' | 'right'>
  opcionesVisuales: OpcionesVisuales
  onToggleColumna: (clave: string) => void
  onReordenar: (nuevo: string[]) => void
  onToggleAnclar: (clave: string) => void
  onCambiarAlineacion: (clave: string, alineacion: 'left' | 'center' | 'right') => void
  onMostrarTodas: () => void
  onOcultarTodas: () => void
  onAlinearTodas: (alineacion: 'left' | 'center' | 'right') => void
  onCambiarOpcionVisual: (opcion: keyof OpcionesVisuales) => void
  onRestablecer: () => void
  onAjustarAnchosAuto: () => void
  onCerrar: () => void
}

export function PanelColumnas<T>({
  columnas,
  columnasVisibles,
  ordenColumnas,
  columnasAncladas,
  alineacionColumnas,
  opcionesVisuales,
  onToggleColumna,
  onReordenar,
  onToggleAnclar,
  onCambiarAlineacion,
  onMostrarTodas,
  onOcultarTodas,
  onAlinearTodas,
  onCambiarOpcionVisual,
  onRestablecer,
  onAjustarAnchosAuto,
  onCerrar,
}: PropsPanelColumnas<T>) {
  /* Mapa para buscar rápido */
  const mapaColumnas = useMemo(() => {
    const m = new Map<string, ColumnaDinamica<T>>()
    columnas.forEach((c) => m.set(c.clave, c))
    return m
  }, [columnas])

  /* Agrupar columnas por grupo (mantener orden del usuario dentro de cada grupo) */
  const gruposOrdenados = useMemo(() => {
    const grupos: { nombre: string; claves: string[] }[] = []
    const grupoMap = new Map<string, string[]>()
    const orden: string[] = [] // orden de aparición de grupos

    for (const clave of ordenColumnas) {
      const col = mapaColumnas.get(clave)
      if (!col) continue
      const grupo = col.grupo || ''
      if (!grupoMap.has(grupo)) {
        grupoMap.set(grupo, [])
        orden.push(grupo)
      }
      grupoMap.get(grupo)!.push(clave)
    }

    for (const nombre of orden) {
      grupos.push({ nombre, claves: grupoMap.get(nombre)! })
    }
    return grupos
  }, [ordenColumnas, mapaColumnas])

  const tieneGrupos = gruposOrdenados.some(g => g.nombre !== '')

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
      transition={{ type: 'spring', duration: 0.25 }}
      className="fixed top-0 right-0 h-full w-[320px] bg-superficie-app border-l border-borde-sutil shadow-2xl z-50 overflow-hidden flex flex-col"
    >
      <div className="flex items-center justify-between px-4 py-3 border-b border-borde-sutil shrink-0">
        <span className="text-sm font-semibold text-texto-primario">Configurar columnas</span>
        <button
          type="button"
          onClick={onCerrar}
          className="size-7 inline-flex items-center justify-center rounded-md hover:bg-superficie-hover cursor-pointer border-none bg-transparent text-texto-terciario"
        >
          <X size={16} />
        </button>
      </div>

      {/* Acciones masivas: seleccionar todas + alinear todas */}
      <div className="flex items-center gap-2 px-4 py-2 border-b border-borde-sutil shrink-0">
        {/* Toggle todas */}
        {(() => {
          const todasVisibles = ordenColumnas.every(c => columnasVisibles.includes(c))
          const algunaVisible = ordenColumnas.some(c => columnasVisibles.includes(c))
          return (
            <button type="button"
              onClick={todasVisibles ? onOcultarTodas : onMostrarTodas}
              className="shrink-0 size-5 inline-flex items-center justify-center rounded border border-borde-sutil cursor-pointer bg-transparent transition-colors"
              style={todasVisibles ? { backgroundColor: 'var(--texto-marca)', borderColor: 'var(--texto-marca)' }
                : algunaVisible ? { borderColor: 'var(--texto-marca)' } : {}}
              title={todasVisibles ? 'Ocultar todas' : 'Mostrar todas'}
            >
              {todasVisibles && <Check size={10} className="text-texto-inverso" />}
              {!todasVisibles && algunaVisible && <Minus size={8} className="text-texto-marca" />}
            </button>
          )
        })()}
        <span className="text-xs text-texto-secundario flex-1">
          {columnasVisibles.length} de {ordenColumnas.length}
        </span>

        {/* Alinear todas */}
        <div className="shrink-0 flex items-center rounded-md border border-borde-sutil overflow-hidden">
          {([
            { val: 'left' as const, icono: <AlignLeft size={10} />, titulo: 'Todas a la izquierda' },
            { val: 'center' as const, icono: <AlignCenter size={10} />, titulo: 'Todas al centro' },
            { val: 'right' as const, icono: <AlignRight size={10} />, titulo: 'Todas a la derecha' },
          ]).map(({ val, icono, titulo }) => (
            <button key={val} type="button"
              onClick={() => onAlinearTodas(val)}
              className="size-6 inline-flex items-center justify-center cursor-pointer border-none bg-transparent text-texto-terciario hover:bg-superficie-hover transition-colors"
              title={titulo}>
              {icono}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-1">
        {/* Columnas VISIBLES — reordenables libremente sin grupos */}
        {ordenColumnas.filter(c => columnasVisibles.includes(c)).length > 0 && (
          <>
          <div className="px-2 pb-1">
            <span className="text-xxs font-semibold text-texto-terciario uppercase tracking-wider">Columnas visibles</span>
          </div>
          <Reorder.Group axis="y" values={ordenColumnas} onReorder={onReordenar} className="flex flex-col gap-0.5">
            {ordenColumnas.filter(c => columnasVisibles.includes(c)).map((clave) => (
              <ContenidoFilaColumna key={clave} clave={clave} mapaColumnas={mapaColumnas} columnasVisibles={columnasVisibles}
                columnasAncladas={columnasAncladas} alineacionColumnas={alineacionColumnas}
                onToggleColumna={onToggleColumna} onToggleAnclar={onToggleAnclar} onCambiarAlineacion={onCambiarAlineacion} arrastrable />
            ))}
          </Reorder.Group>
          </>
        )}

        {/* Columnas OCULTAS — agrupadas por sección para encontrarlas fácil */}
        {(() => {
          const ocultas = ordenColumnas.filter(c => !columnasVisibles.includes(c))
          if (ocultas.length === 0) return null

          // Agrupar ocultas por grupo
          const gruposOcultos: { nombre: string; claves: string[] }[] = []
          const mapaGrupos = new Map<string, string[]>()
          const ordenGrupos: string[] = []
          for (const clave of ocultas) {
            const col = mapaColumnas.get(clave)
            if (!col) continue
            const grupo = col.grupo || 'Otras'
            if (!mapaGrupos.has(grupo)) { mapaGrupos.set(grupo, []); ordenGrupos.push(grupo) }
            mapaGrupos.get(grupo)!.push(clave)
          }
          for (const nombre of ordenGrupos) gruposOcultos.push({ nombre, claves: mapaGrupos.get(nombre)! })

          return (
            <div className="mt-3 pt-3 border-t border-borde-sutil flex flex-col gap-0.5">
              <div className="px-2 pb-1">
                <span className="text-xxs font-semibold text-texto-terciario uppercase tracking-wider">Disponibles</span>
              </div>
              {gruposOcultos.map((grupo) => (
                <div key={grupo.nombre}>
                  {tieneGrupos && (
                    <div className="px-2 pt-2 pb-0.5">
                      <span className="text-xxs text-texto-terciario/60 uppercase tracking-wider">{grupo.nombre}</span>
                    </div>
                  )}
                  {grupo.claves.map((clave) => (
                    <ContenidoFilaColumna key={clave} clave={clave} mapaColumnas={mapaColumnas} columnasVisibles={columnasVisibles}
                      columnasAncladas={columnasAncladas} alineacionColumnas={alineacionColumnas}
                      onToggleColumna={onToggleColumna} onToggleAnclar={onToggleAnclar} onCambiarAlineacion={onCambiarAlineacion} />
                  ))}
                </div>
              ))}
            </div>
          )
        })()}
      </div>

      {/* Separador */}
      <div className="border-t border-borde-sutil" />

      {/* Opciones visuales */}
      <div className="p-3 flex flex-col gap-2">
        <span className="text-xs font-semibold text-texto-terciario uppercase tracking-wider">Opciones visuales</span>

        {([
          { clave: 'mostrarDivisores' as const, etiqueta: 'Divisores entre filas' },
          { clave: 'filasAlternas' as const, etiqueta: 'Filas alternas' },
          { clave: 'bordesColumnas' as const, etiqueta: 'Bordes de columnas' },
        ]).map((op) => (
          <div
            key={op.clave}
            onClick={() => onCambiarOpcionVisual(op.clave)}
            className="flex items-center gap-2 cursor-pointer select-none py-0.5"
          >
            <div
              className="shrink-0 size-5 inline-flex items-center justify-center rounded border border-borde-sutil transition-colors"
              style={opcionesVisuales[op.clave] ? { backgroundColor: 'var(--texto-marca)', borderColor: 'var(--texto-marca)' } : {}}
            >
              {opcionesVisuales[op.clave] && <Check size={10} className="text-texto-inverso" />}
            </div>
            <span className="text-sm text-texto-primario">{op.etiqueta}</span>
          </div>
        ))}
      </div>

      {/* Acciones — fijas abajo del sidebar */}
      <div className="shrink-0 border-t border-borde-sutil p-3 flex flex-col gap-1">
        <button
          type="button"
          onClick={onAjustarAnchosAuto}
          className="flex items-center gap-2 px-2 py-1.5 text-sm text-texto-primario rounded hover:bg-superficie-hover cursor-pointer border-none bg-transparent w-full text-left transition-colors"
        >
          <StretchHorizontal size={14} className="text-texto-terciario" />
          Ajustar anchos automático
        </button>
        <button
          type="button"
          onClick={onRestablecer}
          className="flex items-center gap-2 px-2 py-1.5 text-sm text-insignia-peligro-texto rounded hover:bg-insignia-peligro-fondo cursor-pointer border-none bg-transparent w-full text-left transition-colors"
        >
          <RotateCcw size={14} />
          Restablecer columnas
        </button>
      </div>
    </motion.div>
  )
}
