'use client'

/**
 * MatrizCategoria — Tabla de permisos para una categoria de modulos.
 * Filas = modulos, columnas = acciones, celdas = checkboxes.
 * Se usa en: SeccionPermisos (una instancia por categoria).
 */

import { useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { Boton } from '@/componentes/ui/Boton'
import { Insignia } from '@/componentes/ui/Insignia'
import { CeldaPermiso } from './CeldaPermiso'
import type { Modulo, Accion, PermisosMapa } from '@/tipos'
import {
  ACCIONES_POR_MODULO,
  ETIQUETAS_MODULO,
  ETIQUETAS_ACCION,
} from '@/tipos'

interface PropiedadesMatrizCategoria {
  categoriaKey: string
  nombre: string
  modulos: Modulo[]
  permisos: PermisosMapa
  onToggleAccion: (modulo: Modulo, accion: Accion) => void
  onTodoModulo: (modulo: Modulo) => void
  onNadaModulo: (modulo: Modulo) => void
  onPresetCategoria: (categoriaKey: string, tipo: 'todo' | 'lectura' | 'nada') => void
  onToggleColumna: (modulos: Modulo[], accion: Accion) => void
}

export function MatrizCategoria({
  categoriaKey,
  nombre,
  modulos,
  permisos,
  onToggleAccion,
  onTodoModulo,
  onNadaModulo,
  onPresetCategoria,
  onToggleColumna,
}: PropiedadesMatrizCategoria) {
  const [abierta, setAbierta] = useState(categoriaKey === 'operacional')

  // Columnas: union de todas las acciones de los modulos de esta categoria
  const columnas = useMemo(() => {
    const set = new Set<Accion>()
    for (const modulo of modulos) {
      for (const accion of ACCIONES_POR_MODULO[modulo]) {
        set.add(accion)
      }
    }
    // Ordenar en un orden logico consistente
    const orden: Accion[] = ['ver', 'ver_propio', 'ver_todos', 'crear', 'editar', 'eliminar', 'completar', 'completar_etapa', 'enviar', 'invitar', 'aprobar', 'marcar', 'autoasignar', 'coordinar']
    return orden.filter(a => set.has(a))
  }, [modulos])

  // Contar activos en esta categoria
  const totalCategoria = modulos.reduce((sum, m) => sum + ACCIONES_POR_MODULO[m].length, 0)
  const activosCategoria = modulos.reduce((sum, m) => sum + (permisos[m] || []).length, 0)

  // Estado de cada columna: cuantos modulos de esta categoria tienen esa accion activa
  const estadoColumnas = useMemo(() => {
    const estado: Record<string, { activos: number; posibles: number }> = {}
    for (const accion of columnas) {
      let activos = 0
      let posibles = 0
      for (const modulo of modulos) {
        if (ACCIONES_POR_MODULO[modulo].includes(accion)) {
          posibles++
          if ((permisos[modulo] || []).includes(accion)) activos++
        }
      }
      estado[accion] = { activos, posibles }
    }
    return estado
  }, [columnas, modulos, permisos])

  return (
    <div className="rounded-lg border border-borde-sutil overflow-hidden">
      {/* Cabecera de categoria */}
      <button
        type="button"
        onClick={() => setAbierta(!abierta)}
        className="flex items-center justify-between w-full px-4 py-3 bg-superficie-tarjeta border-none cursor-pointer text-left"
      >
        <div className="flex items-center gap-2">
          {abierta ? <ChevronDown size={16} className="text-texto-terciario" /> : <ChevronRight size={16} className="text-texto-terciario" />}
          <span className="text-sm font-semibold text-texto-primario">{nombre}</span>
          <Insignia color={activosCategoria === totalCategoria ? 'exito' : activosCategoria > 0 ? 'advertencia' : 'neutro'} tamano="sm">
            {activosCategoria}/{totalCategoria}
          </Insignia>
        </div>
        {/* Presets de categoria */}
        <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
          <Boton variante="fantasma" tamano="xs" onClick={() => onPresetCategoria(categoriaKey, 'todo')}>Todo</Boton>
          <Boton variante="fantasma" tamano="xs" onClick={() => onPresetCategoria(categoriaKey, 'lectura')}>Lectura</Boton>
          <Boton variante="fantasma" tamano="xs" onClick={() => onPresetCategoria(categoriaKey, 'nada')}>Nada</Boton>
        </div>
      </button>

      {/* Matriz */}
      <AnimatePresence>
        {abierta && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="overflow-hidden"
          >
            <div className="border-t border-borde-sutil overflow-x-auto">
              <table className="w-full text-xs">
                {/* Cabecera de columnas (acciones) */}
                <thead>
                  <tr className="bg-superficie-app">
                    <th className="text-left px-3 py-2 font-medium text-texto-terciario whitespace-nowrap sticky left-0 bg-superficie-app z-10 min-w-[140px]">
                      Modulo
                    </th>
                    {columnas.map((accion) => {
                      const col = estadoColumnas[accion]
                      const todosActivos = col && col.activos === col.posibles
                      const algunoActivo = col && col.activos > 0

                      return (
                        <th key={accion} className="px-1 py-1 text-center whitespace-nowrap min-w-[60px]">
                          <button
                            type="button"
                            onClick={() => onToggleColumna(modulos, accion)}
                            className="flex flex-col items-center gap-0.5 w-full bg-transparent border-none cursor-pointer p-1 rounded hover:bg-superficie-hover transition-colors group"
                            title={`${todosActivos ? 'Desmarcar' : 'Marcar'} "${ETIQUETAS_ACCION[accion]}" en todos los modulos`}
                          >
                            <span className="text-xxs leading-tight font-medium text-texto-terciario group-hover:text-texto-primario transition-colors">
                              {ETIQUETAS_ACCION[accion]}
                            </span>
                            {/* Barra de progreso de la columna */}
                            <div className="w-5 h-1 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--borde-sutil)' }}>
                              <div
                                className="h-full rounded-full transition-all duration-200"
                                style={{
                                  width: col ? `${(col.activos / col.posibles) * 100}%` : '0%',
                                  backgroundColor: todosActivos ? 'var(--insignia-exito)' : algunoActivo ? 'var(--insignia-advertencia)' : 'transparent',
                                }}
                              />
                            </div>
                          </button>
                        </th>
                      )
                    })}
                    <th className="px-2 py-2 font-medium text-texto-terciario text-center whitespace-nowrap min-w-[80px]">
                      <span className="text-xxs">Rapido</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {modulos.map((modulo) => {
                    const accionesPosibles = ACCIONES_POR_MODULO[modulo]
                    const accionesActivas = permisos[modulo] || []
                    const todoActivo = accionesActivas.length === accionesPosibles.length
                    const parcial = accionesActivas.length > 0 && !todoActivo

                    // Indicador de color en la fila
                    const colorIndicador = todoActivo
                      ? 'bg-insignia-exito'
                      : parcial
                        ? 'bg-insignia-advertencia'
                        : 'bg-borde-fuerte/40'

                    return (
                      <tr key={modulo} className="border-t border-borde-sutil hover:bg-superficie-hover/50 transition-colors">
                        <td className="px-3 py-1.5 sticky left-0 bg-superficie-tarjeta z-10">
                          <div className="flex items-center gap-2">
                            <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${colorIndicador}`} />
                            <span className="font-medium text-texto-primario whitespace-nowrap">{ETIQUETAS_MODULO[modulo]}</span>
                          </div>
                        </td>
                        {columnas.map((accion) => {
                          const disponible = accionesPosibles.includes(accion)
                          const activo = accionesActivas.includes(accion)
                          return (
                            <CeldaPermiso
                              key={accion}
                              activo={activo}
                              disponible={disponible}
                              onChange={() => onToggleAccion(modulo, accion)}
                            />
                          )
                        })}
                        {/* Botones rapidos por fila */}
                        <td className="px-2 py-1.5 text-center">
                          <div className="flex items-center justify-center gap-1">
                            <button
                              type="button"
                              onClick={() => onTodoModulo(modulo)}
                              className={[
                                'px-1.5 py-0.5 rounded text-xxs font-medium border-none cursor-pointer transition-colors',
                                todoActivo
                                  ? 'bg-insignia-exito/20 text-insignia-exito'
                                  : 'bg-superficie-hover text-texto-terciario hover:text-texto-primario',
                              ].join(' ')}
                            >
                              Todo
                            </button>
                            <button
                              type="button"
                              onClick={() => onNadaModulo(modulo)}
                              className={[
                                'px-1.5 py-0.5 rounded text-xxs font-medium border-none cursor-pointer transition-colors',
                                accionesActivas.length === 0
                                  ? 'bg-insignia-peligro/20 text-insignia-peligro'
                                  : 'bg-superficie-hover text-texto-terciario hover:text-texto-primario',
                              ].join(' ')}
                            >
                              Nada
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
