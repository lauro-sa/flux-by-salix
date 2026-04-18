'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Sparkles, Send, X, Check, Trash2, Pencil, Plus,
  Package, Wrench, Loader2, AlertCircle,
} from 'lucide-react'
import { Boton } from '@/componentes/ui/Boton'
import { Insignia } from '@/componentes/ui/Insignia'
import { TextArea } from '@/componentes/ui/TextArea'
import { COLOR_TIPO_PRODUCTO } from '@/lib/colores_entidad'

/**
 * PanelAsistenteIA — Panel lateral para describir el trabajo y recibir
 * líneas de presupuesto propuestas por la IA, matcheadas con el catálogo.
 *
 * Flujo:
 * 1. Usuario describe el trabajo en texto libre
 * 2. IA analiza, matchea con catálogo, devuelve líneas propuestas
 * 3. Cada línea se muestra con botones: aceptar, rechazar, editar
 * 4. Las líneas nuevas (no en catálogo) se marcan para crear el servicio
 * 5. Al confirmar, las líneas aceptadas se agregan al presupuesto
 */

export interface LineaPropuestaIA {
  producto_id: string | null
  codigo: string
  referencia_interna: string | null
  nombre: string
  descripcion_venta: string
  unidad: string
  impuesto_id: string | null
  es_nuevo: boolean
  categoria_sugerida: string | null
  /** Estado de la propuesta en la UI */
  estado?: 'pendiente' | 'aceptada' | 'rechazada'
  /** Si el usuario editó la descripción */
  descripcion_editada?: string
  /** Si el usuario quiere crear el servicio nuevo */
  crear_servicio?: boolean
}

export interface SugerenciaIA {
  producto_id: string | null
  codigo: string
  referencia_interna: string | null
  nombre: string
  descripcion_venta: string
  unidad: string
  impuesto_id: string | null
  razon: string
  para_linea: number
}

interface PropsPanelAsistenteIA {
  abierto: boolean
  onCerrar: () => void
  /** Callback cuando el usuario confirma las líneas aceptadas */
  onAplicarLineas: (lineas: LineaPropuestaIA[]) => void
  /** Callback para crear un servicio nuevo en el catálogo */
  onCrearServicio: (linea: LineaPropuestaIA) => Promise<{ codigo: string; id: string } | null>
}

export function PanelAsistenteIA({ abierto, onCerrar, onAplicarLineas, onCrearServicio }: PropsPanelAsistenteIA) {
  const [modoIA, setModoIA] = useState<'simple' | 'paquete' | 'detallado'>(() => {
    if (typeof window !== 'undefined') {
      return (localStorage.getItem('flux_asistente_modo') as 'simple' | 'paquete' | 'detallado') || 'detallado'
    }
    return 'detallado'
  })
  const [descripcion, setDescripcion] = useState('')
  const [lineas, setLineas] = useState<LineaPropuestaIA[]>([])
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState('')
  const [sugerencias, setSugerencias] = useState<SugerenciaIA[]>([])
  const [editandoIdx, setEditandoIdx] = useState<number | null>(null)
  const [creandoIdx, setCreandoIdx] = useState<number | null>(null)
  const [etapaCarga, setEtapaCarga] = useState(0)
  const etapaCargaRef = useRef<ReturnType<typeof setInterval>>(null)

  // ─── Enviar descripción a la IA ───
  const analizar = useCallback(async () => {
    if (!descripcion.trim()) return
    setCargando(true)
    setError('')
    setLineas([])
    setSugerencias([])
    setEtapaCarga(0)

    // Progreso simulado con mensajes que van cambiando
    let etapa = 0
    etapaCargaRef.current = setInterval(() => {
      etapa++
      if (etapa <= 5) setEtapaCarga(etapa)
    }, 2000)

    try {
      const res = await fetch('/api/presupuestos/asistente', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ descripcion: descripcion.trim(), modo: modoIA }),
      })

      if (!res.ok) {
        const err = await res.json()
        setError(err.error || 'Error al analizar')
        return
      }

      const data = await res.json()
      setLineas((data.lineas || []).map((l: LineaPropuestaIA) => ({
        ...l,
        estado: 'pendiente' as const,
        crear_servicio: l.es_nuevo,
      })))
      setSugerencias(data.sugerencias || [])
    } catch {
      setError('Error de conexión')
    } finally {
      setCargando(false)
      setEtapaCarga(0)
      if (etapaCargaRef.current) clearInterval(etapaCargaRef.current)
    }
  }, [descripcion, modoIA])

  // Re-analizar automáticamente al cambiar de modo (si ya hay descripción y ya se analizó antes)
  const prevModoRef = useRef(modoIA)
  useEffect(() => {
    if (prevModoRef.current === modoIA) return
    prevModoRef.current = modoIA
    if (descripcion.trim() && (lineas.length > 0 || cargando)) {
      analizar()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modoIA])

  // ─── Acciones sobre líneas ───
  const actualizarLinea = useCallback((idx: number, cambios: Partial<LineaPropuestaIA>) => {
    setLineas(prev => prev.map((l, i) => i === idx ? { ...l, ...cambios } : l))
  }, [])

  // Aplicar sugerencia: reemplaza la línea nueva por el servicio existente del catálogo
  const aplicarSugerencia = useCallback((sugerencia: SugerenciaIA) => {
    setLineas(prev => prev.map((l, i) => {
      if (i !== sugerencia.para_linea) return l
      return {
        ...l,
        producto_id: sugerencia.producto_id,
        codigo: sugerencia.codigo,
        referencia_interna: sugerencia.referencia_interna,
        nombre: sugerencia.nombre,
        unidad: sugerencia.unidad,
        impuesto_id: sugerencia.impuesto_id,
        es_nuevo: false,
        crear_servicio: false,
        estado: 'aceptada' as const,
      }
    }))
    // Quitar sugerencias para esa línea
    setSugerencias(prev => prev.filter(s => s.para_linea !== sugerencia.para_linea))
  }, [])

  const aceptarTodas = useCallback(() => {
    setLineas(prev => prev.map(l => l.estado !== 'rechazada' ? { ...l, estado: 'aceptada' as const } : l))
  }, [])

  const rechazarTodas = useCallback(() => {
    setLineas(prev => prev.map(l => ({ ...l, estado: 'rechazada' as const })))
  }, [])

  // ─── Crear servicio nuevo ───
  const crearServicioNuevo = useCallback(async (idx: number) => {
    const linea = lineas[idx]
    if (!linea.es_nuevo) return

    setCreandoIdx(idx)
    try {
      const resultado = await onCrearServicio(linea)
      if (resultado) {
        actualizarLinea(idx, {
          producto_id: resultado.id,
          codigo: resultado.codigo,
          es_nuevo: false,
          crear_servicio: false,
        })
      }
    } catch {
      // silenciar
    } finally {
      setCreandoIdx(null)
    }
  }, [lineas, onCrearServicio, actualizarLinea])

  // ─── Aplicar líneas aceptadas ───
  const aplicar = useCallback(() => {
    const aceptadas = lineas.filter(l => l.estado === 'aceptada')
    if (aceptadas.length === 0) return
    onAplicarLineas(aceptadas)
    setLineas([])
    setDescripcion('')
    onCerrar()
  }, [lineas, onAplicarLineas, onCerrar])

  const aceptadas = lineas.filter(l => l.estado === 'aceptada')
  const pendientes = lineas.filter(l => l.estado === 'pendiente')
  const nuevasSinCrear = lineas.filter(l => l.estado === 'aceptada' && l.es_nuevo && l.crear_servicio)

  return (
    <AnimatePresence>
      {abierto && (
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: 20 }}
          transition={{ duration: 0.2 }}
          className="fixed right-0 top-0 bottom-0 w-full sm:w-[480px] z-40 bg-superficie-elevada border-l border-borde-sutil shadow-elevada flex flex-col"
        >
          {/* ── Header ── */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-borde-sutil">
            <div className="flex items-center gap-2.5">
              <div className="size-8 rounded-card bg-texto-marca/10 flex items-center justify-center">
                <Sparkles size={16} className="text-texto-marca" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-texto-primario">Salix IA</h3>
                <p className="text-xxs text-texto-terciario">Describí el trabajo y armamos el presupuesto</p>
              </div>
            </div>
            <Boton variante="fantasma" tamano="sm" soloIcono titulo="Cerrar" icono={<X size={16} />} onClick={onCerrar} />
          </div>

          {/* ── Input de descripción ── */}
          <div className="px-5 py-4 border-b border-borde-sutil">
            <TextArea
              value={descripcion}
              onChange={e => setDescripcion(e.target.value)}
              placeholder="Describí el trabajo a presupuestar...&#10;&#10;Ej: Fui a un edificio en Palermo, portón curvo corredizo grande. Hay que cambiar los rolletes inferiores, reparar el carro superior, ajustar y nivelar. Traslado con andamios."
              rows={5}
              autoFocus
            />
            {/* Selector de modo */}
            <div className="flex items-center gap-1 p-0.5 rounded-card bg-superficie-app border border-borde-sutil mt-3">
              {([
                { id: 'simple' as const, label: 'Redactar' },
                { id: 'paquete' as const, label: 'Crear' },
                { id: 'detallado' as const, label: 'Desglosar' },
              ]).map(m => (
                <Boton
                  key={m.id}
                  variante="fantasma"
                  tamano="xs"
                  onClick={() => { setModoIA(m.id); localStorage.setItem('flux_asistente_modo', m.id) }}
                  className={`flex-1 text-center ${modoIA === m.id ? 'bg-superficie-elevada shadow-sm text-texto-primario' : 'text-texto-terciario'}`}
                >
                  {m.label}
                </Boton>
              ))}
            </div>
            <p className="text-xxs text-texto-terciario mt-1.5 text-center leading-relaxed">
              {modoIA === 'simple' && 'Redacta un párrafo profesional. No crea ni guarda nada en el catálogo.'}
              {modoIA === 'paquete' && 'Crea un servicio o producto con nombre y código propio. Queda guardado en el catálogo para reutilizar.'}
              {modoIA === 'detallado' && 'Identifica varios servicios y productos, matchea con el catálogo. Los nuevos se pueden crear y quedan guardados.'}
            </p>

            {/* Botón centrado → se transforma en barra de progreso */}
            <AnimatePresence mode="wait">
              {cargando ? (
                <motion.div
                  key="progreso"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ duration: 0.3 }}
                  className="mt-4"
                >
                  <div className="rounded-card bg-texto-marca/5 border border-texto-marca/20 p-5">
                    <div className="flex flex-col items-center text-center gap-3">
                      <motion.div
                        animate={{ rotate: [0, 360] }}
                        transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}
                        className="size-10 rounded-card bg-texto-marca/15 flex items-center justify-center"
                      >
                        <Sparkles size={20} className="text-texto-marca" />
                      </motion.div>
                      <div>
                        <motion.p
                          key={etapaCarga}
                          initial={{ opacity: 0, y: 5 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="text-sm font-semibold text-texto-primario"
                        >
                          {[
                            'Leyendo tu descripción...',
                            'Revisando el catálogo...',
                            'Identificando servicios...',
                            'Buscando coincidencias...',
                            'Redactando descripciones...',
                            'Casi listo...',
                          ][Math.min(etapaCarga, 5)]}
                        </motion.p>
                        <p className="text-xxs text-texto-terciario mt-1">
                          {modoIA === 'simple' && 'Generando un párrafo profesional'}
                          {modoIA === 'paquete' && 'Creando servicio reutilizable con nombre propio'}
                          {modoIA === 'detallado' && 'Desglosando en servicios individuales'}
                        </p>
                      </div>
                      <div className="w-full h-1.5 rounded-full bg-superficie-elevada overflow-hidden">
                        <motion.div
                          className="h-full rounded-full bg-texto-marca"
                          initial={{ width: '5%' }}
                          animate={{ width: `${Math.min(15 + etapaCarga * 16, 92)}%` }}
                          transition={{ duration: 1.5, ease: 'easeOut' }}
                        />
                      </div>
                    </div>
                  </div>
                </motion.div>
              ) : (
                <motion.div
                  key="boton"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ duration: 0.2 }}
                  className="mt-4"
                >
                  {lineas.length > 0 ? (
                    <div className="flex items-center justify-between">
                      <p className="text-xxs text-texto-terciario">
                        {aceptadas.length} de {lineas.length} líneas aceptadas
                      </p>
                      <Boton variante="secundario" tamano="sm" icono={<Sparkles size={14} />} onClick={analizar} disabled={!descripcion.trim()}>
                        Re-analizar
                      </Boton>
                    </div>
                  ) : (
                    <Boton
                      variante="secundario"
                      anchoCompleto
                      icono={<Sparkles size={18} />}
                      onClick={analizar}
                      disabled={!descripcion.trim()}
                      className="relative overflow-hidden border-texto-marca/30 bg-texto-marca/5 py-4"
                    >
                      <div className="flex flex-col items-center">
                        <span className="text-sm font-semibold text-texto-marca">Analizar con Salix IA</span>
                        <p className="text-xxs text-texto-terciario mt-1">
                          {modoIA === 'simple' && 'Redactar en un párrafo profesional'}
                          {modoIA === 'paquete' && 'Crear un servicio reutilizable'}
                          {modoIA === 'detallado' && 'Desglosar en servicios del catálogo'}
                        </p>
                      </div>
                    </Boton>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
            {error && (
              <div className="flex items-center gap-2 mt-2 text-xs text-insignia-peligro">
                <AlertCircle size={14} />
                {error}
              </div>
            )}
          </div>

          {/* ── Líneas propuestas ── */}
          <div className="flex-1 overflow-y-auto">
            {lineas.length > 0 && (
              <>
                {/* Acciones globales */}
                <div className="flex items-center justify-between px-5 py-3 border-b border-borde-sutil bg-superficie-app">
                  <span className="text-xs font-medium text-texto-secundario">
                    {lineas.length} líneas propuestas
                  </span>
                  <div className="flex gap-2">
                    <Boton variante="fantasma" tamano="xs" onClick={rechazarTodas}>
                      Rechazar todas
                    </Boton>
                    <Boton variante="secundario" tamano="xs" icono={<Check size={12} />} onClick={aceptarTodas}>
                      Aceptar todas
                    </Boton>
                  </div>
                </div>

                {/* Lista de líneas */}
                <div className="divide-y divide-borde-sutil">
                  {lineas.map((linea, idx) => {
                    const esRechazada = linea.estado === 'rechazada'
                    const esAceptada = linea.estado === 'aceptada'
                    const editando = editandoIdx === idx

                    return (
                      <motion.div
                        key={idx}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: esRechazada ? 0.4 : 1, y: 0 }}
                        className={`px-5 py-3 transition-colors ${
                          esAceptada ? 'bg-insignia-exito/5' :
                          esRechazada ? 'bg-superficie-app' :
                          'hover:bg-superficie-app/50'
                        }`}
                      >
                        {/* Fila 1: icono + nombre + badges */}
                        <div className="flex items-start gap-2.5">
                          <div
                            className="size-7 rounded-boton flex items-center justify-center shrink-0 mt-0.5"
                            style={{
                              backgroundColor: `var(--insignia-${linea.es_nuevo ? 'advertencia' : 'exito'}-fondo)`,
                              color: `var(--insignia-${linea.es_nuevo ? 'advertencia' : 'exito'}-texto)`,
                            }}
                          >
                            {linea.es_nuevo ? <Plus size={13} /> : <Wrench size={13} />}
                          </div>

                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium text-texto-primario truncate">{linea.nombre}</span>
                              {linea.referencia_interna && (
                                <span className="text-xxs font-mono text-texto-terciario shrink-0">{linea.referencia_interna}</span>
                              )}
                            </div>

                            <div className="flex items-center gap-1.5 mt-0.5">
                              {linea.es_nuevo ? (
                                <Insignia color="advertencia" tamano="sm">No existe — crear servicio</Insignia>
                              ) : (
                                <Insignia color="exito" tamano="sm">Ya existe en catálogo</Insignia>
                              )}
                              {linea.categoria_sugerida && (
                                <span className="text-xxs text-texto-terciario">{linea.categoria_sugerida}</span>
                              )}
                              {esAceptada && <Insignia color="info" tamano="sm">Aceptada</Insignia>}
                              {esRechazada && <Insignia color="neutro" tamano="sm">Rechazada</Insignia>}
                            </div>
                          </div>

                          {/* Botones de acción */}
                          <div className="flex items-center gap-1 shrink-0">
                            {!esRechazada && (
                              <>
                                <Boton
                                  variante="fantasma" tamano="xs" soloIcono
                                  titulo="Editar sugerencia"
                                  icono={<Pencil size={13} />}
                                  onClick={() => setEditandoIdx(editando ? null : idx)}
                                  className={editando ? 'text-texto-marca' : ''}
                                />
                                <Boton
                                  variante={esAceptada ? 'exito' : 'secundario'} tamano="xs" soloIcono
                                  titulo="Aceptar"
                                  icono={<Check size={13} />}
                                  onClick={() => actualizarLinea(idx, { estado: esAceptada ? 'pendiente' : 'aceptada' })}
                                />
                              </>
                            )}
                            <Boton
                              variante="fantasma" tamano="xs" soloIcono
                              titulo={esRechazada ? 'Restaurar' : 'Rechazar'}
                              icono={esRechazada ? <Plus size={13} /> : <Trash2 size={13} />}
                              onClick={() => actualizarLinea(idx, { estado: esRechazada ? 'pendiente' : 'rechazada' })}
                            />
                          </div>
                        </div>

                        {/* Descripción */}
                        {!esRechazada && (
                          <div className="mt-2 ml-9">
                            {editando ? (
                              <TextArea
                                value={linea.descripcion_editada ?? linea.descripcion_venta}
                                onChange={e => actualizarLinea(idx, { descripcion_editada: e.target.value })}
                                rows={3}
                                compacto
                              />
                            ) : (
                              <p className="text-xs text-texto-terciario leading-relaxed">
                                {linea.descripcion_editada || linea.descripcion_venta}
                              </p>
                            )}

                            {/* Botón crear servicio si es nuevo */}
                            {linea.es_nuevo && esAceptada && linea.crear_servicio && (
                              <Boton
                                variante="secundario"
                                tamano="xs"
                                icono={creandoIdx === idx ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />}
                                onClick={() => crearServicioNuevo(idx)}
                                disabled={creandoIdx !== null}
                                className="mt-2"
                              >
                                Crear servicio en catálogo
                              </Boton>
                            )}

                            {/* Sugerencias se muestran en sección separada abajo */}
                          </div>
                        )}
                      </motion.div>
                    )
                  })}
                </div>
              </>
            )}

            {/* ── Sección de sugerencias del catálogo ── */}
            {sugerencias.length > 0 && lineas.some(l => l.es_nuevo) && (
              <div className="border-t-2 border-texto-marca/20 bg-superficie-app/50">
                <div className="px-5 py-3">
                  <p className="text-xs font-semibold text-texto-secundario">Servicios similares en catálogo</p>
                  <p className="text-xxs text-texto-terciario mt-0.5">Si alguno corresponde, hacé clic para reemplazar el servicio nuevo.</p>
                </div>
                <div className="divide-y divide-borde-sutil">
                  {sugerencias.map((s, sIdx) => {
                    const lineaRelacionada = lineas[s.para_linea]
                    return (
                      <Boton
                        key={sIdx}
                        variante="fantasma"
                        tamano="sm"
                        onClick={() => aplicarSugerencia(s)}
                        className="w-full text-left px-5 py-3 h-auto group"
                      >
                        <div className="w-full">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2.5">
                              <span className="text-xs font-mono text-texto-marca bg-texto-marca/10 px-1.5 py-0.5 rounded">{s.referencia_interna}</span>
                              <span className="text-sm font-medium text-texto-primario">{s.nombre}</span>
                            </div>
                            <span className="text-xxs font-medium text-texto-marca opacity-0 group-hover:opacity-100 transition-opacity">Usar este →</span>
                          </div>
                          <div className="flex items-center gap-2 mt-1 ml-0.5">
                            <span className="text-xxs text-texto-terciario">{s.razon}</span>
                            {lineaRelacionada && (
                              <span className="text-xxs text-texto-terciario">· reemplaza a: <span className="font-medium">{lineaRelacionada.nombre}</span></span>
                            )}
                          </div>
                        </div>
                      </Boton>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Estado vacío */}
            {lineas.length === 0 && !cargando && (
              <div className="flex flex-col items-center justify-center h-full text-center px-8">
                <Sparkles size={40} className="text-texto-terciario/30 mb-4" />
                <p className="text-sm text-texto-terciario">
                  Describí el trabajo que tenés que presupuestar y la IA te arma las líneas automáticamente.
                </p>
              </div>
            )}
          </div>

          {/* ── Footer: aplicar ── */}
          {aceptadas.length > 0 && (
            <div className="px-5 py-4 border-t border-borde-sutil bg-superficie-app">
              {nuevasSinCrear.length > 0 && (
                <p className="text-xxs text-insignia-advertencia mb-2">
                  {nuevasSinCrear.length} servicio{nuevasSinCrear.length > 1 ? 's' : ''} nuevo{nuevasSinCrear.length > 1 ? 's' : ''} — podés crearlos o aplicarlos sin crear
                </p>
              )}
              <Boton
                anchoCompleto
                icono={<Check size={14} />}
                onClick={aplicar}
              >
                Aplicar {aceptadas.length} línea{aceptadas.length > 1 ? 's' : ''} al presupuesto
              </Boton>
            </div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  )
}
