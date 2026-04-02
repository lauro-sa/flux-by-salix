'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { Check, X } from 'lucide-react'
import type { Filtro, PillGrupo, Plantilla } from './tipos'

/* ─── Props ─── */

interface PropiedadesPanelFiltros {
  filtros: Filtro[]
  pillsGrupos?: PillGrupo[]
  plantillas?: Plantilla[]
  plantillaActivaId?: string
  onAplicarPlantilla?: (id: string) => void
  onGuardarNuevaPlantilla?: (nombre: string) => void
  onEliminarPlantilla?: (id: string) => void
}

/**
 * PanelFiltros — Panel desplegable con filtros, grupos de pills y vistas guardadas.
 * Se usa en: BarraBusqueda, cuando el usuario abre el panel de filtros avanzados.
 */
function PanelFiltros({
  filtros,
  pillsGrupos,
  plantillas,
  plantillaActivaId,
  onAplicarPlantilla,
  onGuardarNuevaPlantilla,
  onEliminarPlantilla,
}: PropiedadesPanelFiltros) {
  const [nombreNueva, setNombreNueva] = useState('')
  const [creandoVista, setCreandoVista] = useState(false)
  const [busquedaOpciones, setBusquedaOpciones] = useState<Record<string, string>>({})

  return (
    <motion.div
      initial={{ opacity: 0, scaleY: 0.95 }}
      animate={{ opacity: 1, scaleY: 1 }}
      exit={{ opacity: 0, scaleY: 0.95 }}
      transition={{ type: 'spring', duration: 0.35 }}
      style={{ transformOrigin: 'top' }}
      className="absolute top-full left-0 right-0 mt-2 bg-superficie-elevada border border-borde-sutil rounded-lg shadow-lg z-50 overflow-hidden"
    >
      <div className="max-h-[420px] overflow-y-auto p-3 flex flex-col gap-3">
        {/* Sección 1: Pills principales */}
        {pillsGrupos && pillsGrupos.length > 0 && (
          <div className="flex flex-col gap-2">
            <span className="text-xs font-semibold text-texto-terciario uppercase tracking-wider">Grupos</span>
            {pillsGrupos.map((grupo) => (
              <div key={grupo.id} className="flex flex-col gap-1.5">
                <span className="text-sm font-medium text-texto-secundario">{grupo.etiqueta}</span>
                <div className="flex flex-wrap gap-1.5">
                  {grupo.opciones.map((op) => (
                    <button
                      key={op.id}
                      type="button"
                      onClick={() => grupo.onChange(op.id === grupo.activo ? grupo.opciones[0].id : op.id)}
                      className={[
                        'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-sm font-medium border cursor-pointer transition-all duration-150',
                        op.id === grupo.activo
                          ? 'bg-insignia-primario-fondo text-insignia-primario-texto border-texto-marca'
                          : 'bg-superficie-tarjeta text-texto-secundario border-borde-sutil hover:border-borde-fuerte',
                      ].join(' ')}
                    >
                      {op.icono}
                      {op.etiqueta}
                      {op.conteo !== undefined && (
                        <span className="text-xxs opacity-60">({op.conteo})</span>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Sección 2: Filtros secundarios */}
        {filtros.length > 0 && (
          <div className="flex flex-col gap-2">
            {(pillsGrupos && pillsGrupos.length > 0) && (
              <div className="border-t border-borde-sutil" />
            )}
            <span className="text-xs font-semibold text-texto-terciario uppercase tracking-wider">Filtros</span>
            {filtros.map((filtro) => (
              <div key={filtro.id} className="flex flex-col gap-1.5">
                <span className="text-sm font-medium text-texto-secundario flex items-center gap-1.5">
                  {filtro.icono && <span className="shrink-0">{filtro.icono}</span>}
                  {filtro.etiqueta}
                </span>

                {/* Filtro tipo selección */}
                {filtro.tipo === 'seleccion' && filtro.opciones && (
                  <div className="flex flex-col">
                    {filtro.opciones.length > 8 && (
                      <input
                        type="text"
                        value={busquedaOpciones[filtro.id] || ''}
                        onChange={(e) => setBusquedaOpciones({ ...busquedaOpciones, [filtro.id]: e.target.value })}
                        placeholder="Buscar..."
                        className="mb-1 px-2 py-1 rounded border border-borde-sutil bg-superficie-tarjeta text-xs text-texto-primario placeholder:text-texto-placeholder outline-none focus:border-borde-foco"
                      />
                    )}
                    <div className="max-h-40 overflow-y-auto flex flex-col">
                      {filtro.opciones
                        .filter((op) => {
                          const bq = busquedaOpciones[filtro.id]?.toLowerCase()
                          return !bq || op.etiqueta.toLowerCase().includes(bq)
                        })
                        .map((op) => (
                          <button
                            key={op.valor}
                            type="button"
                            onClick={() => filtro.onChange(op.valor === filtro.valor ? '' : op.valor)}
                            className={[
                              'flex items-center gap-2 px-2 py-1.5 text-sm text-left rounded cursor-pointer transition-colors duration-100 border-none',
                              op.valor === filtro.valor
                                ? 'bg-superficie-seleccionada text-texto-marca font-medium'
                                : 'bg-transparent text-texto-primario hover:bg-superficie-hover',
                            ].join(' ')}
                          >
                            <span className="flex-1">{op.etiqueta}</span>
                            {op.valor === filtro.valor && <Check size={14} />}
                          </button>
                        ))}
                    </div>
                  </div>
                )}

                {/* Filtro tipo múltiple */}
                {filtro.tipo === 'multiple' && filtro.opciones && (
                  <div className="flex flex-col">
                    {Array.isArray(filtro.valor) && filtro.valor.length > 0 && (
                      <button
                        type="button"
                        onClick={() => filtro.onChange([])}
                        className="self-start text-xs text-insignia-peligro-texto bg-insignia-peligro-fondo px-2 py-0.5 rounded-full mb-1 cursor-pointer border-none font-medium"
                      >
                        Limpiar ({(filtro.valor as string[]).length})
                      </button>
                    )}
                    {filtro.opciones.length > 8 && (
                      <input
                        type="text"
                        value={busquedaOpciones[filtro.id] || ''}
                        onChange={(e) => setBusquedaOpciones({ ...busquedaOpciones, [filtro.id]: e.target.value })}
                        placeholder="Buscar..."
                        className="mb-1 px-2 py-1 rounded border border-borde-sutil bg-superficie-tarjeta text-xs text-texto-primario placeholder:text-texto-placeholder outline-none focus:border-borde-foco"
                      />
                    )}
                    <div className="max-h-40 overflow-y-auto flex flex-col">
                      {filtro.opciones
                        .filter((op) => {
                          const bq = busquedaOpciones[filtro.id]?.toLowerCase()
                          return !bq || op.etiqueta.toLowerCase().includes(bq)
                        })
                        .map((op) => {
                          const seleccionado = Array.isArray(filtro.valor) && filtro.valor.includes(op.valor)
                          return (
                            <button
                              key={op.valor}
                              type="button"
                              onClick={() => {
                                const actual = Array.isArray(filtro.valor) ? filtro.valor : []
                                filtro.onChange(
                                  seleccionado
                                    ? actual.filter((v) => v !== op.valor)
                                    : [...actual, op.valor]
                                )
                              }}
                              className="flex items-center gap-2 px-2 py-1.5 text-sm text-left rounded cursor-pointer transition-colors duration-100 border-none bg-transparent text-texto-primario hover:bg-superficie-hover"
                            >
                              <span className={[
                                'inline-flex items-center justify-center size-4 rounded border transition-colors',
                                seleccionado
                                  ? 'bg-texto-marca border-texto-marca text-texto-inverso'
                                  : 'border-borde-fuerte bg-superficie-tarjeta',
                              ].join(' ')}>
                                {seleccionado && <Check size={10} />}
                              </span>
                              <span className="flex-1">{op.etiqueta}</span>
                            </button>
                          )
                        })}
                    </div>
                  </div>
                )}

                {/* Filtro tipo fecha */}
                {filtro.tipo === 'fecha' && (
                  <div className="flex items-center gap-2">
                    <input
                      type="date"
                      value={typeof filtro.valor === 'string' ? filtro.valor : ''}
                      onChange={(e) => filtro.onChange(e.target.value)}
                      className="flex-1 px-2 py-1.5 rounded border border-borde-sutil bg-superficie-tarjeta text-xs text-texto-primario outline-none focus:border-borde-foco"
                    />
                    {filtro.valor && (
                      <button
                        type="button"
                        onClick={() => filtro.onChange('')}
                        className="size-6 inline-flex items-center justify-center rounded hover:bg-superficie-hover cursor-pointer border-none bg-transparent text-texto-terciario"
                      >
                        <X size={14} />
                      </button>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Sección 3: Favoritos / Plantillas */}
        {plantillas && plantillas.length > 0 && (
          <div className="flex flex-col gap-2">
            <div className="border-t border-borde-sutil" />
            <span className="text-xs font-semibold text-texto-terciario uppercase tracking-wider">Vistas guardadas</span>
            {plantillas.map((p) => (
              <div
                key={p.id}
                className="group flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer hover:bg-superficie-hover transition-colors"
                onClick={() => onAplicarPlantilla?.(p.id)}
              >
                <span className={[
                  'flex-1 text-sm',
                  p.id === plantillaActivaId ? 'font-semibold text-texto-marca' : 'text-texto-primario',
                ].join(' ')}>
                  {p.nombre}
                </span>
                {p.id === plantillaActivaId && <Check size={14} />}
                {!p.predefinida && (
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); onEliminarPlantilla?.(p.id) }}
                    className="opacity-0 group-hover:opacity-100 size-5 inline-flex items-center justify-center rounded hover:bg-insignia-peligro-fondo cursor-pointer border-none bg-transparent text-texto-terciario hover:text-insignia-peligro-texto transition-all"
                  >
                    <X size={12} />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Guardar nueva vista */}
        {onGuardarNuevaPlantilla && (
          <div className="flex flex-col gap-1.5">
            {!creandoVista ? (
              <button
                type="button"
                onClick={() => setCreandoVista(true)}
                className="text-sm text-texto-marca font-medium cursor-pointer border-none bg-transparent p-0 text-left hover:underline"
              >
                + Guardar vista actual
              </button>
            ) : (
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  autoFocus
                  value={nombreNueva}
                  onChange={(e) => setNombreNueva(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && nombreNueva.trim()) {
                      onGuardarNuevaPlantilla(nombreNueva.trim())
                      setNombreNueva('')
                      setCreandoVista(false)
                    }
                    if (e.key === 'Escape') {
                      setNombreNueva('')
                      setCreandoVista(false)
                    }
                  }}
                  placeholder="Nombre de la vista..."
                  className="flex-1 px-2 py-1 rounded border border-borde-foco bg-superficie-tarjeta text-xs text-texto-primario placeholder:text-texto-placeholder outline-none"
                />
                <button
                  type="button"
                  disabled={!nombreNueva.trim()}
                  onClick={() => {
                    if (nombreNueva.trim()) {
                      onGuardarNuevaPlantilla(nombreNueva.trim())
                      setNombreNueva('')
                      setCreandoVista(false)
                    }
                  }}
                  className="text-sm font-medium text-texto-marca cursor-pointer border-none bg-transparent disabled:opacity-40"
                >
                  Guardar
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </motion.div>
  )
}

export { PanelFiltros }
