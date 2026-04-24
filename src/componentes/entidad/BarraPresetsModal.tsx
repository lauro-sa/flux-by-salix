'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  MoreHorizontal, Plus, Pencil, Save, Star, Trash2, Check, ChevronDown, X,
} from 'lucide-react'
import { Popover } from '@/componentes/ui/Popover'
import { useToast } from '@/componentes/feedback/Toast'

/**
 * BarraPresetsModal — Selector compacto de presets para modales de creación.
 * Diseñado para ir en el footer izquierdo (slot `footerExtraIzquierda` del modal).
 * Un único botón trigger; al hacer click se despliega un popover con la lista
 * de presets, acciones por fila (renombrar, actualizar, favorito, eliminar) y
 * botón para crear nuevo.
 *
 * Componente genérico: cada módulo pasa su `endpoint` (ej: /api/visitas/presets,
 * /api/actividades/presets). Los `valores` son un blob JSON opaco que el
 * componente solo guarda/devuelve — cada módulo define su forma.
 *
 * Convención visual: se reutiliza el mismo tono de "plantillas guardadas" de
 * correos (insignia-advertencia / ámbar) para que todo lo que el usuario
 * guarda personalizado se reconozca de un vistazo.
 */

export interface PresetGuardado<V = unknown> {
  id: string
  nombre: string
  valores: V
  aplicar_al_abrir: boolean
  orden: number
}

interface PropiedadesBarraPresets<V = unknown> {
  /** Endpoint base: GET lista, POST crea, PATCH?id=X actualiza, DELETE?id=X borra */
  endpoint: string
  /** Snapshot de los valores actuales del form — se manda al crear/actualizar preset */
  valoresActuales: V
  /** Callback que hidrata el form con los valores del preset */
  onAplicar: (valores: V) => void
  /** Máximo de presets permitidos (UX — el servidor valida también) */
  maximo?: number
  /**
   * Alcance opcional: pares clave/valor que identifican un sub-conjunto de presets
   * (ej: `{ tipo_id: 'abc' }` para presets por tipo de actividad). Se manda como
   * query params en GET y dentro del body en POST. Al cambiar, se recargan los
   * presets del nuevo alcance y se limpia el activo.
   */
  scope?: Record<string, string | null | undefined>
  /**
   * Deshabilitar el trigger con un tooltip (ej: cuando el scope todavía no está
   * resuelto — "Elegí un tipo primero").
   */
  deshabilitado?: boolean
  /** Texto del trigger cuando está deshabilitado */
  textoDeshabilitado?: string
}

function BarraPresetsModal<V = unknown>({
  endpoint,
  valoresActuales,
  onAplicar,
  maximo = 3,
  scope,
  deshabilitado = false,
  textoDeshabilitado,
}: PropiedadesBarraPresets<V>) {
  const { mostrar } = useToast()

  const [presets, setPresets] = useState<PresetGuardado<V>[]>([])
  const [cargando, setCargando] = useState(true)
  const [activoId, setActivoId] = useState<string | null>(null)
  const [guardando, setGuardando] = useState(false)

  // Popover principal abierto / cerrado
  const [abierto, setAbierto] = useState(false)
  // Modos internos: lista (default), nuevo (input nombre), renombrar-ID, acciones-ID
  const [modoNuevo, setModoNuevo] = useState(false)
  const [renombrandoId, setRenombrandoId] = useState<string | null>(null)
  const [accionesAbiertasId, setAccionesAbiertasId] = useState<string | null>(null)
  const [nombreInput, setNombreInput] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  const autoAplicadoRef = useRef(false)

  // Serializar scope a query string estable para dependencias del effect
  const scopeQuery = scope
    ? Object.entries(scope)
        .filter(([, v]) => v !== undefined && v !== null && v !== '')
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
        .join('&')
    : ''

  const scopeTieneValor = !!scopeQuery
  const scopeRequerido = scope !== undefined && !scopeTieneValor

  // URL efectiva para GET (base + query del scope)
  const urlListar = scopeQuery
    ? `${endpoint}${endpoint.includes('?') ? '&' : '?'}${scopeQuery}`
    : endpoint

  // Cargar presets al montar y cuando cambia el scope; aplicar automático si corresponde
  useEffect(() => {
    // Si el componente recibe scope pero aún no tiene valor (tipo no elegido),
    // no listamos — dejamos el trigger deshabilitado.
    if (scopeRequerido) {
      setPresets([])
      setActivoId(null)
      setCargando(false)
      autoAplicadoRef.current = false
      return
    }
    let cancelado = false
    setCargando(true)
    // Al cambiar de scope, reseteamos el activo y permitimos re-aplicar auto del nuevo scope
    setActivoId(null)
    autoAplicadoRef.current = false
    fetch(urlListar)
      .then(r => r.json())
      .then(data => {
        if (cancelado) return
        const lista = (data?.presets || []) as PresetGuardado<V>[]
        setPresets(lista)
        setCargando(false)
        if (!autoAplicadoRef.current) {
          const auto = lista.find(p => p.aplicar_al_abrir)
          if (auto) {
            onAplicar(auto.valores)
            setActivoId(auto.id)
          }
          autoAplicadoRef.current = true
        }
      })
      .catch(() => { if (!cancelado) setCargando(false) })
    return () => { cancelado = true }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlListar, scopeRequerido])

  // Reset del modo interno al cerrar el popover
  useEffect(() => {
    if (!abierto) {
      setModoNuevo(false)
      setRenombrandoId(null)
      setAccionesAbiertasId(null)
      setNombreInput('')
    }
  }, [abierto])

  // Foco al abrir input (nuevo o renombrar)
  useEffect(() => {
    if ((modoNuevo || renombrandoId) && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [modoNuevo, renombrandoId])

  const aplicar = useCallback((preset: PresetGuardado<V>) => {
    onAplicar(preset.valores)
    setActivoId(preset.id)
    setAbierto(false)
  }, [onAplicar])

  const quitarSeleccion = useCallback(() => {
    setActivoId(null)
    setAbierto(false)
  }, [])

  const crearNuevo = useCallback(async () => {
    const nombre = nombreInput.trim()
    if (!nombre) return
    setGuardando(true)
    try {
      // Incluir scope en el body para que el servidor pueda asociar el preset
      // al alcance correspondiente (ej: tipo_id en actividades).
      const body: Record<string, unknown> = { nombre, valores: valoresActuales }
      if (scope) {
        for (const [k, v] of Object.entries(scope)) {
          if (v !== undefined && v !== null && v !== '') body[k] = v
        }
      }
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) {
        mostrar('error', data?.error || 'No se pudo guardar')
        return
      }
      setPresets(prev => [...prev, data])
      setActivoId(data.id)
      setModoNuevo(false)
      setNombreInput('')
      mostrar('exito', 'Preset guardado')
    } finally {
      setGuardando(false)
    }
  }, [endpoint, nombreInput, valoresActuales, mostrar])

  const renombrar = useCallback(async () => {
    if (!renombrandoId) return
    const nombre = nombreInput.trim()
    if (!nombre) return
    setGuardando(true)
    try {
      const res = await fetch(`${endpoint}?id=${renombrandoId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nombre }),
      })
      const data = await res.json()
      if (!res.ok) {
        mostrar('error', data?.error || 'No se pudo renombrar')
        return
      }
      setPresets(prev => prev.map(p => p.id === renombrandoId ? data : p))
      setRenombrandoId(null)
      setNombreInput('')
    } finally {
      setGuardando(false)
    }
  }, [endpoint, renombrandoId, nombreInput, mostrar])

  const actualizarConActuales = useCallback(async (id: string) => {
    setGuardando(true)
    try {
      const res = await fetch(`${endpoint}?id=${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ valores: valoresActuales }),
      })
      const data = await res.json()
      if (!res.ok) {
        mostrar('error', data?.error || 'No se pudo actualizar')
        return
      }
      setPresets(prev => prev.map(p => p.id === id ? data : p))
      setAccionesAbiertasId(null)
      mostrar('exito', 'Preset actualizado con los valores actuales')
    } finally {
      setGuardando(false)
    }
  }, [endpoint, valoresActuales, mostrar])

  const toggleAplicarAlAbrir = useCallback(async (preset: PresetGuardado<V>) => {
    setGuardando(true)
    try {
      const nuevo = !preset.aplicar_al_abrir
      const res = await fetch(`${endpoint}?id=${preset.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ aplicar_al_abrir: nuevo }),
      })
      const data = await res.json()
      if (!res.ok) {
        mostrar('error', data?.error || 'No se pudo actualizar')
        return
      }
      setPresets(prev => prev.map(p =>
        p.id === preset.id ? data : nuevo ? { ...p, aplicar_al_abrir: false } : p,
      ))
      setAccionesAbiertasId(null)
    } finally {
      setGuardando(false)
    }
  }, [endpoint, mostrar])

  const eliminar = useCallback(async (id: string) => {
    setGuardando(true)
    try {
      const res = await fetch(`${endpoint}?id=${id}`, { method: 'DELETE' })
      if (!res.ok) {
        mostrar('error', 'No se pudo eliminar')
        return
      }
      setPresets(prev => prev.filter(p => p.id !== id))
      if (activoId === id) setActivoId(null)
      setAccionesAbiertasId(null)
      mostrar('exito', 'Preset eliminado')
    } finally {
      setGuardando(false)
    }
  }, [endpoint, activoId, mostrar])

  // Trigger deshabilitado (scope pendiente o flag externo) — mostramos botón inerte con tooltip
  if (deshabilitado || scopeRequerido) {
    return (
      <button
        type="button"
        disabled
        title={textoDeshabilitado || 'No disponible todavía'}
        className="inline-flex items-center gap-1.5 h-8 px-2.5 rounded-boton text-xs font-medium border border-borde-sutil bg-superficie-tarjeta text-texto-terciario opacity-60 cursor-not-allowed max-w-[200px]"
      >
        <Star size={13} className="text-texto-terciario shrink-0" />
        <span className="truncate">{textoDeshabilitado || 'Predeterminados'}</span>
      </button>
    )
  }

  if (cargando) return null

  const presetActivo = presets.find(p => p.id === activoId) || null
  const puedeAgregar = presets.length < maximo
  const sinPresets = presets.length === 0

  // Color ámbar (insignia-advertencia) para el estado activo — mismo tono que
  // usan las plantillas guardadas de correo: todo lo "guardado por el usuario" comparte color.
  const claseTriggerActivo = presetActivo
    ? 'border border-insignia-advertencia/40 bg-insignia-advertencia-fondo text-insignia-advertencia-texto hover:brightness-110'
    : 'border border-borde-sutil bg-superficie-tarjeta text-texto-secundario hover:border-borde-fuerte hover:bg-superficie-hover'

  return (
    <Popover
      abierto={abierto}
      onCambio={setAbierto}
      ancho={320}
      alineacion="inicio"
      lado="arriba"
      offset={8}
      contenido={
        <div className="flex flex-col max-h-[60vh]">
          {/* Header del popover */}
          <div className="flex items-center justify-between px-3 py-2 border-b border-borde-sutil">
            <div className="flex items-center gap-1.5 text-[11px] font-medium text-texto-terciario uppercase tracking-wider">
              <Star size={11} className="text-insignia-advertencia" />
              <span>Predeterminados</span>
            </div>
            <span className="text-[10px] text-texto-terciario">
              {presets.length}/{maximo}
            </span>
          </div>

          {/* Modo crear nuevo — input inline */}
          {modoNuevo && (
            <div className="p-3 border-b border-borde-sutil bg-insignia-advertencia-fondo/40">
              <p className="text-xs text-texto-secundario mb-2">
                Guardá los valores actuales del formulario con un nombre.
              </p>
              <input
                ref={inputRef}
                type="text"
                value={nombreInput}
                onChange={(e) => setNombreInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') { e.preventDefault(); crearNuevo() }
                  if (e.key === 'Escape') { setModoNuevo(false); setNombreInput('') }
                }}
                maxLength={40}
                placeholder="Ej: Técnico Juan, Comercial..."
                className="w-full px-2.5 py-1.5 rounded-card border border-borde-sutil bg-superficie-app text-sm text-texto-primario placeholder:text-texto-terciario focus:outline-none focus:ring-1 focus:ring-insignia-advertencia/50"
              />
              <div className="flex items-center justify-end gap-1.5 mt-2">
                <button
                  type="button"
                  onClick={() => { setModoNuevo(false); setNombreInput('') }}
                  className="px-2.5 py-1 rounded-card text-xs text-texto-terciario hover:text-texto-primario hover:bg-superficie-hover"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={crearNuevo}
                  disabled={!nombreInput.trim() || guardando}
                  className="px-2.5 py-1 rounded-card text-xs bg-insignia-advertencia/20 border border-insignia-advertencia/50 text-insignia-advertencia-texto hover:bg-insignia-advertencia/30 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Guardar
                </button>
              </div>
            </div>
          )}

          {/* Lista de presets */}
          {!modoNuevo && (
            <div className="overflow-y-auto flex-1">
              {sinPresets ? (
                <div className="px-3 py-5 text-center">
                  <p className="text-xs text-texto-terciario">
                    Todavía no guardaste ningún predeterminado.
                  </p>
                </div>
              ) : (
                <ul className="py-1">
                  <AnimatePresence initial={false}>
                    {presets.map(p => {
                      const activo = activoId === p.id
                      const enRenombre = renombrandoId === p.id
                      const accionesVisibles = accionesAbiertasId === p.id

                      return (
                        <motion.li
                          key={p.id}
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0, height: 0 }}
                          transition={{ duration: 0.12 }}
                        >
                          {/* Fila principal */}
                          <div
                            className={`flex items-center gap-1 px-2 mx-1 rounded-boton group transition-colors ${
                              activo
                                ? 'bg-insignia-advertencia-fondo/60'
                                : 'hover:bg-superficie-hover'
                            }`}
                          >
                            {enRenombre ? (
                              <input
                                ref={inputRef}
                                type="text"
                                value={nombreInput}
                                onChange={(e) => setNombreInput(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') { e.preventDefault(); renombrar() }
                                  if (e.key === 'Escape') { setRenombrandoId(null); setNombreInput('') }
                                }}
                                onBlur={() => { if (nombreInput.trim()) renombrar(); else { setRenombrandoId(null); setNombreInput('') } }}
                                maxLength={40}
                                className="flex-1 my-1 px-2 py-1 rounded-boton border border-borde-sutil bg-superficie-app text-sm text-texto-primario focus:outline-none focus:ring-1 focus:ring-insignia-advertencia/50"
                              />
                            ) : (
                              <button
                                type="button"
                                onClick={() => aplicar(p)}
                                className="flex-1 min-w-0 flex items-center gap-2 py-2 text-sm text-left"
                              >
                                {p.aplicar_al_abrir && (
                                  <Star size={12} fill="currentColor" className="shrink-0 text-insignia-advertencia" />
                                )}
                                {!p.aplicar_al_abrir && activo && (
                                  <Check size={13} className="shrink-0 text-insignia-advertencia-texto" />
                                )}
                                {!p.aplicar_al_abrir && !activo && (
                                  <span className="size-3 shrink-0" />
                                )}
                                <span className={`truncate ${activo ? 'text-insignia-advertencia-texto font-medium' : 'text-texto-primario'}`}>
                                  {p.nombre}
                                </span>
                              </button>
                            )}

                            {!enRenombre && (
                              <button
                                type="button"
                                onClick={() => setAccionesAbiertasId(accionesVisibles ? null : p.id)}
                                className={`p-1.5 rounded-boton text-texto-terciario hover:text-texto-primario hover:bg-superficie-hover transition-opacity ${
                                  accionesVisibles ? 'bg-superficie-hover text-texto-primario' : 'opacity-0 group-hover:opacity-100'
                                }`}
                                title="Opciones"
                              >
                                <MoreHorizontal size={14} />
                              </button>
                            )}
                          </div>

                          {/* Acciones inline (accordion) */}
                          <AnimatePresence>
                            {accionesVisibles && (
                              <motion.div
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: 'auto' }}
                                exit={{ opacity: 0, height: 0 }}
                                transition={{ duration: 0.15 }}
                                className="overflow-hidden"
                              >
                                <div className="mx-2 mb-1 py-1 border-l-2 border-insignia-advertencia/30 pl-2">
                                  <AccionFila
                                    icono={<Pencil size={13} />}
                                    onClick={() => {
                                      setRenombrandoId(p.id)
                                      setNombreInput(p.nombre)
                                      setAccionesAbiertasId(null)
                                    }}
                                  >
                                    Renombrar
                                  </AccionFila>
                                  <AccionFila
                                    icono={<Save size={13} />}
                                    onClick={() => actualizarConActuales(p.id)}
                                    disabled={guardando}
                                  >
                                    Actualizar con valores actuales
                                  </AccionFila>
                                  <AccionFila
                                    icono={<Star size={13} fill={p.aplicar_al_abrir ? 'currentColor' : 'none'} className={p.aplicar_al_abrir ? 'text-insignia-advertencia' : ''} />}
                                    onClick={() => toggleAplicarAlAbrir(p)}
                                    disabled={guardando}
                                  >
                                    {p.aplicar_al_abrir ? 'No aplicar al abrir' : 'Aplicar al abrir modal'}
                                  </AccionFila>
                                  <AccionFila
                                    icono={<Trash2 size={13} />}
                                    onClick={() => eliminar(p.id)}
                                    disabled={guardando}
                                    peligro
                                  >
                                    Eliminar
                                  </AccionFila>
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </motion.li>
                      )
                    })}
                  </AnimatePresence>
                </ul>
              )}
            </div>
          )}

          {/* Footer del popover: acciones globales */}
          {!modoNuevo && (
            <div className="border-t border-borde-sutil p-1 flex items-center gap-1">
              {puedeAgregar && (
                <button
                  type="button"
                  onClick={() => { setModoNuevo(true); setNombreInput('') }}
                  className="flex-1 flex items-center gap-2 px-2.5 py-2 rounded-boton text-sm text-texto-secundario hover:bg-superficie-hover hover:text-texto-primario"
                >
                  <Plus size={14} />
                  {sinPresets ? 'Guardar actuales como preset' : 'Guardar como nuevo preset'}
                </button>
              )}
              {!puedeAgregar && (
                <span className="flex-1 px-2.5 py-2 text-xs text-texto-terciario">
                  Alcanzaste el máximo ({maximo}). Eliminá uno para crear otro.
                </span>
              )}
              {activoId && (
                <button
                  type="button"
                  onClick={quitarSeleccion}
                  className="px-2.5 py-2 rounded-boton text-xs text-texto-terciario hover:text-texto-primario hover:bg-superficie-hover"
                  title="Quita la selección actual (no borra el preset)"
                >
                  <X size={12} className="inline -mt-0.5 mr-0.5" />
                  Quitar
                </button>
              )}
            </div>
          )}
        </div>
      }
    >
      {/* Trigger del footer: compacto, muestra el preset activo si lo hay */}
      <button
        type="button"
        className={`inline-flex items-center gap-1.5 h-8 px-2.5 rounded-boton text-xs font-medium transition-colors max-w-[200px] ${claseTriggerActivo}`}
      >
        <Star
          size={13}
          className={presetActivo ? 'text-insignia-advertencia shrink-0' : 'text-texto-terciario shrink-0'}
          fill={presetActivo?.aplicar_al_abrir ? 'currentColor' : 'none'}
        />
        <span className="truncate">
          {presetActivo ? presetActivo.nombre : sinPresets ? 'Predeterminados' : 'Predeterminados'}
        </span>
        <ChevronDown size={12} className="shrink-0 opacity-60" />
      </button>
    </Popover>
  )
}

// ── Item de acciones inline ──
function AccionFila({
  icono,
  children,
  onClick,
  disabled,
  peligro,
}: {
  icono: React.ReactNode
  children: React.ReactNode
  onClick: () => void
  disabled?: boolean
  peligro?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`flex items-center gap-2 w-full px-2 py-1.5 rounded-boton text-xs text-left transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
        peligro
          ? 'text-insignia-peligro-texto hover:bg-insignia-peligro-fondo'
          : 'text-texto-secundario hover:bg-superficie-hover hover:text-texto-primario'
      }`}
    >
      <span className="shrink-0">{icono}</span>
      <span className="flex-1 truncate">{children}</span>
    </button>
  )
}

export { BarraPresetsModal }
