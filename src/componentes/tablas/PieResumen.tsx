'use client'

import { useState, type ReactNode } from 'react'
import type { ColumnaDinamica, OpcionesVisuales, TipoCalculo } from '@/componentes/tablas/tipos-tabla'
import { obtenerValorCelda, calcularResumen, ANCHO_MINIMO_COLUMNA, ANCHO_DEFAULT_COLUMNA } from '@/componentes/tablas/tipos-tabla'

/* ════════════════════════════════════════════
   Sub-componente: Pie de tabla (calculador)
   ════════════════════════════════════════════ */

/** Ciclo de tipos de cálculo al hacer click */
const CICLO_CALCULO: TipoCalculo[] = ['conteo', 'suma', 'promedio', 'min', 'max', 'ninguno']

/** PieResumenFila — renderiza como <tr> para vivir dentro de <tfoot> */
export function PieResumenFila<T>({
  columnas,
  datos,
  columnasVisibles,
  columnasAncladas,
  anchoColumnas,
  seleccionables,
  opcionesVisuales,
  offsetAncladas,
}: {
  columnas: ColumnaDinamica<T>[]
  datos: T[]
  columnasVisibles: string[]
  columnasAncladas: string[]
  anchoColumnas: Record<string, number>
  seleccionables: boolean
  opcionesVisuales: OpcionesVisuales
  offsetAncladas: Record<string, number>
}) {
  const [overrides, setOverrides] = useState<Record<string, TipoCalculo>>({})

  const ciclarCalculo = (clave: string, tipoActual: TipoCalculo) => {
    const idx = CICLO_CALCULO.indexOf(tipoActual)
    const siguiente = CICLO_CALCULO[(idx + 1) % CICLO_CALCULO.length]
    setOverrides(prev => ({ ...prev, [clave]: siguiente }))
  }

  return (
    <tr className="border-t-2 border-borde-fuerte">
      {/* Celda del checkbox */}
      {seleccionables && <td className="w-10 min-w-10 px-2.5 py-2 sticky left-0 z-10" style={{ background: 'var(--superficie-anclada-alterna)' }} />}

      {columnasVisibles.map((clave) => {
        const col = columnas.find((c) => c.clave === clave)
        if (!col) return null
        const ancho = anchoColumnas[clave] || col.ancho || ANCHO_DEFAULT_COLUMNA
        const anclada = columnasAncladas.includes(clave)

        const tipoCalculo: TipoCalculo = overrides[clave]
          || col.resumen
          || (col.tipo === 'numero' || col.tipo === 'moneda' ? 'suma' : 'ninguno')

        let contenido: ReactNode = null
        if (tipoCalculo !== 'ninguno') {
          const valores = datos
            .map((fila) => {
              const v = obtenerValorCelda(fila, col)
              return typeof v === 'number' ? v : parseFloat(String(v))
            })
            .filter((v) => !isNaN(v))

          const etiquetaCalculo = tipoCalculo === 'conteo' ? 'Conteo'
            : tipoCalculo === 'suma' ? 'Suma'
            : tipoCalculo === 'promedio' ? 'Promedio'
            : tipoCalculo === 'min' ? 'Mínimo'
            : tipoCalculo === 'max' ? 'Máximo'
            : ''

          const valorCalculado = tipoCalculo === 'conteo'
            ? datos.length
            : calcularResumen(valores, tipoCalculo, col.tipo)

          contenido = (
            <div className="flex flex-col">
              <span className="text-xxs text-texto-terciario uppercase leading-tight">{etiquetaCalculo}</span>
              <span className="text-xs font-semibold text-texto-primario">{valorCalculado}</span>
            </div>
          )
        } else {
          contenido = <span className="text-xxs text-texto-terciario/40">—</span>
        }

        return (
          <td
            key={clave}
            onClick={() => ciclarCalculo(clave, tipoCalculo)}
            className={[
              'px-4 py-2 cursor-pointer hover:bg-superficie-hover/50 transition-colors select-none',
              anclada ? 'sticky z-10 border-r-2 border-r-borde-fuerte' : '',
              opcionesVisuales.bordesColumnas && !anclada ? 'border-r border-borde-sutil last:border-r-0' : '',
            ].join(' ')}
            style={{
              width: ancho,
              minWidth: col.anchoMinimo || ANCHO_MINIMO_COLUMNA,
              textAlign: col.alineacion || 'left',
              ...(anclada ? { left: offsetAncladas[clave], background: 'var(--superficie-anclada-alterna)' } : {}),
            }}
            title="Click para cambiar cálculo"
          >
            {contenido}
          </td>
        )
      })}
    </tr>
  )
}

/** PieResumen original — se mantiene por compatibilidad pero ya no se usa directamente */
export function PieResumen<T>({
  columnas,
  datos,
  columnasVisibles,
  columnasAncladas,
  anchoColumnas,
  seleccionables,
  opcionesVisuales,
}: {
  columnas: ColumnaDinamica<T>[]
  datos: T[]
  columnasVisibles: string[]
  columnasAncladas: string[]
  anchoColumnas: Record<string, number>
  seleccionables: boolean
  opcionesVisuales: OpcionesVisuales
}) {
  // Estado local: override de cálculo por columna (click para ciclar)
  const [overrides, setOverrides] = useState<Record<string, TipoCalculo>>({})

  const ciclarCalculo = (clave: string, tipoActual: TipoCalculo) => {
    const idx = CICLO_CALCULO.indexOf(tipoActual)
    const siguiente = CICLO_CALCULO[(idx + 1) % CICLO_CALCULO.length]
    setOverrides(prev => ({ ...prev, [clave]: siguiente }))
  }

  return (
    <div className="border-t-2 border-borde-fuerte bg-superficie-anclada">
      <div className="flex" style={{ minWidth: 'max-content' }}>
        {/* Espacio del checkbox */}
        {seleccionables && <div className="w-11 shrink-0 px-3 py-2" />}

        {/* Celdas — todas las columnas, con cálculo clickeable */}
        {columnasVisibles.map((clave) => {
          const col = columnas.find((c) => c.clave === clave)
          if (!col) return null
          const ancho = anchoColumnas[clave] || col.ancho || ANCHO_DEFAULT_COLUMNA
          const anclada = columnasAncladas.includes(clave)

          // Determinar tipo de cálculo: override > definido en columna > default
          const tipoCalculo: TipoCalculo = overrides[clave]
            || col.resumen
            || (col.tipo === 'numero' || col.tipo === 'moneda' ? 'suma' : 'ninguno')

          // Calcular
          let contenido: ReactNode = null
          if (tipoCalculo !== 'ninguno') {
            const valores = datos
              .map((fila) => {
                const v = obtenerValorCelda(fila, col)
                return typeof v === 'number' ? v : parseFloat(String(v))
              })
              .filter((v) => !isNaN(v))

            const etiquetaCalculo = tipoCalculo === 'conteo' ? 'Conteo'
              : tipoCalculo === 'suma' ? 'Suma'
              : tipoCalculo === 'promedio' ? 'Promedio'
              : tipoCalculo === 'min' ? 'Mínimo'
              : tipoCalculo === 'max' ? 'Máximo'
              : ''

            const valorCalculado = tipoCalculo === 'conteo'
              ? datos.length
              : calcularResumen(valores, tipoCalculo, col.tipo)

            contenido = (
              <div className="flex flex-col">
                <span className="text-xxs text-texto-terciario uppercase leading-tight">{etiquetaCalculo}</span>
                <span className="text-xs font-semibold text-texto-primario">{valorCalculado}</span>
              </div>
            )
          } else {
            contenido = (
              <span className="text-xxs text-texto-terciario/40 uppercase">—</span>
            )
          }

          return (
            <div
              key={clave}
              onClick={() => ciclarCalculo(clave, tipoCalculo)}
              className={[
                'px-4 py-2 shrink-0 cursor-pointer hover:bg-superficie-hover/50 transition-colors select-none',
                anclada ? 'sticky left-0 z-10 bg-superficie-anclada border-r-2 border-r-borde-fuerte' : '',
                opcionesVisuales.bordesColumnas ? 'border-r border-borde-sutil last:border-r-0' : '',
              ].join(' ')}
              style={{ width: ancho, minWidth: col.anchoMinimo || ANCHO_MINIMO_COLUMNA, textAlign: col.alineacion || 'left' }}
              title="Click para cambiar cálculo"
            >
              {contenido}
            </div>
          )
        })}
      </div>
    </div>
  )
}
