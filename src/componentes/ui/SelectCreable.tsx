'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronDown, Check, Plus, Pencil, Trash2, X } from 'lucide-react'
import { useTema } from '@/hooks/useTema'

interface Opcion {
  valor: string
  etiqueta: string
  color?: string
}

interface PropiedadesSelectCreable {
  /** Opciones existentes */
  opciones: Opcion[]
  /** Valor actual */
  valor?: string
  /** Placeholder */
  placeholder?: string
  /** Etiqueta del campo */
  etiqueta?: string
  /** Callback al seleccionar */
  onChange: (valor: string) => void
  /** Callback al crear nuevo. Retorna true/false, o un string con el valor formateado a usar */
  onCrear?: (nombre: string) => Promise<boolean | string>
  /** Callback al editar (valor actual, nuevo nombre). Retorna el nombre final o false */
  onEditar?: (valor: string, nuevoNombre: string) => Promise<false | string>
  /** Callback al eliminar. Retorna true si se eliminó */
  onEliminar?: (valor: string) => Promise<boolean>
  /** Variante visual */
  variante?: 'default' | 'plano'
  /** Texto del botón crear (ej: "Crear etiqueta", "Crear rubro") */
  textoCrear?: string
  className?: string
}

/**
 * SelectCreable — Dropdown que permite buscar entre opciones existentes
 * o crear una nueva si no existe. Combina select + input + botón crear.
 * Opcionalmente permite editar y eliminar opciones con onEditar/onEliminar.
 */
export function SelectCreable({
  opciones,
  valor,
  placeholder = 'Seleccionar...',
  etiqueta,
  onChange,
  onCrear,
  onEditar,
  onEliminar,
  variante = 'default',
  textoCrear = 'Crear nuevo',
  className = '',
}: PropiedadesSelectCreable) {
  const { efecto } = useTema()
  const esCristal = efecto !== 'solido'
  const [abierto, setAbierto] = useState(false)
  const [busqueda, setBusqueda] = useState('')
  const [creando, setCreando] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const refInput = useRef<HTMLInputElement>(null)

  // Estado para edición inline
  const [editandoValor, setEditandoValor] = useState<string | null>(null)
  const [textoEdicion, setTextoEdicion] = useState('')
  const [guardandoEdicion, setGuardandoEdicion] = useState(false)
  const refInputEdicion = useRef<HTMLInputElement>(null)

  const seleccionada = opciones.find(o => o.valor === valor)

  // Filtrar opciones por búsqueda
  const filtradas = busqueda.trim()
    ? opciones.filter(o => o.etiqueta.toLowerCase().includes(busqueda.toLowerCase()))
    : opciones

  // ¿El texto buscado no existe como opción?
  const puedeCrear = onCrear && busqueda.trim() && !opciones.some(o => o.etiqueta.toLowerCase() === busqueda.toLowerCase().trim())

  // Cerrar al click fuera
  useEffect(() => {
    if (!abierto) return
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) { setAbierto(false); setBusqueda(''); setEditandoValor(null) }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [abierto])

  // Focus input al abrir
  useEffect(() => {
    if (abierto && !editandoValor) setTimeout(() => refInput.current?.focus(), 50)
  }, [abierto, editandoValor])

  // Focus input edición al activar
  useEffect(() => {
    if (editandoValor) setTimeout(() => refInputEdicion.current?.focus(), 50)
  }, [editandoValor])

  const crearNuevo = useCallback(async () => {
    if (!onCrear || !busqueda.trim() || creando) return
    setCreando(true)
    const resultado = await onCrear(busqueda.trim())
    if (resultado) {
      // Si onCrear devuelve string, usarlo como valor (nombre formateado por el servidor)
      const valorFinal = typeof resultado === 'string' ? resultado : busqueda.trim()
      onChange(valorFinal)
      setAbierto(false)
      setBusqueda('')
    }
    setCreando(false)
  }, [onCrear, busqueda, creando, onChange])

  const confirmarEdicion = useCallback(async () => {
    if (!onEditar || !editandoValor || !textoEdicion.trim() || guardandoEdicion) return
    setGuardandoEdicion(true)
    const resultado = await onEditar(editandoValor, textoEdicion.trim())
    if (resultado) {
      // Si la opción editada es la seleccionada, actualizar el valor
      if (editandoValor === valor) onChange(resultado)
    }
    setEditandoValor(null)
    setTextoEdicion('')
    setGuardandoEdicion(false)
  }, [onEditar, editandoValor, textoEdicion, guardandoEdicion, valor, onChange])

  const eliminarOpcion = useCallback(async (valorOpcion: string) => {
    if (!onEliminar) return
    const ok = await onEliminar(valorOpcion)
    if (ok && valorOpcion === valor) onChange('')
  }, [onEliminar, valor, onChange])

  const esPlano = variante === 'plano'

  return (
    <div ref={ref} className={`flex flex-col w-full ${className}`}>
      {etiqueta && (
        <label className="text-sm font-medium mb-1 text-texto-secundario">{etiqueta}</label>
      )}
      <div className="relative">
        <button type="button" onClick={() => setAbierto(!abierto)}
          className={[
            'flex items-center justify-between gap-2 text-sm cursor-pointer transition-all duration-150 w-full text-left outline-none',
            esPlano
              ? `bg-transparent border-0 border-b px-0 py-1 rounded-none ${abierto ? 'border-borde-foco' : 'border-borde-sutil'}`
              : `px-3 py-2 rounded-md border bg-superficie-tarjeta ${abierto ? 'border-borde-foco shadow-foco' : 'border-borde-fuerte'}`,
          ].join(' ')}>
          <span className={seleccionada ? 'text-texto-primario' : 'text-texto-terciario'}>
            {seleccionada?.etiqueta || placeholder}
          </span>
          <ChevronDown size={14} className={`shrink-0 text-texto-terciario transition-transform duration-150 ${abierto ? 'rotate-180' : ''}`} />
        </button>

        <AnimatePresence>
          {abierto && (
            <motion.div
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.12 }}
              className="absolute top-full left-0 right-0 mt-1 border border-borde-sutil rounded-md shadow-lg z-50 overflow-hidden"
              style={esCristal ? {
                backgroundColor: 'var(--superficie-flotante)',
                backdropFilter: 'blur(32px) saturate(1.5)',
                WebkitBackdropFilter: 'blur(32px) saturate(1.5)',
              } : {
                backgroundColor: 'var(--superficie-elevada)',
              }}>

              {/* Buscador */}
              <div className="px-2 py-1.5 border-b border-borde-sutil">
                <input ref={refInput} type="text" value={busqueda}
                  onChange={e => setBusqueda(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && puedeCrear) crearNuevo()
                    if (e.key === 'Escape') { setAbierto(false); setBusqueda('') }
                  }}
                  placeholder="Buscar o crear..."
                  className="w-full bg-transparent border-none outline-none text-sm text-texto-primario placeholder:text-texto-placeholder" />
              </div>

              {/* Opciones */}
              <div className="max-h-48 overflow-y-auto">
                {filtradas.map(opcion => {
                  // Modo edición inline
                  if (editandoValor === opcion.valor) {
                    return (
                      <div key={opcion.valor} className="flex items-center gap-1.5 px-2 py-1.5">
                        <input
                          ref={refInputEdicion}
                          type="text"
                          value={textoEdicion}
                          onChange={e => setTextoEdicion(e.target.value)}
                          onKeyDown={e => {
                            if (e.key === 'Enter') confirmarEdicion()
                            if (e.key === 'Escape') { setEditandoValor(null); setTextoEdicion('') }
                          }}
                          disabled={guardandoEdicion}
                          className="flex-1 bg-superficie-tarjeta border border-borde-foco rounded px-2 py-1 text-sm text-texto-primario outline-none"
                        />
                        <button type="button" onClick={confirmarEdicion} disabled={guardandoEdicion}
                          className="size-7 flex items-center justify-center rounded hover:bg-superficie-hover cursor-pointer border-none bg-transparent text-insignia-exito shrink-0">
                          <Check size={14} />
                        </button>
                        <button type="button" onClick={() => { setEditandoValor(null); setTextoEdicion('') }}
                          className="size-7 flex items-center justify-center rounded hover:bg-superficie-hover cursor-pointer border-none bg-transparent text-texto-terciario shrink-0">
                          <X size={14} />
                        </button>
                      </div>
                    )
                  }

                  return (
                    <div key={opcion.valor} className={[
                      'group flex items-center gap-2 w-full px-3 py-1.5 text-sm transition-colors duration-100',
                      opcion.valor === valor ? 'bg-superficie-seleccionada text-texto-marca font-medium' : 'bg-transparent text-texto-primario hover:bg-superficie-hover',
                    ].join(' ')}>
                      {opcion.color && (
                        <span className="size-3 rounded-full shrink-0" style={{ backgroundColor: `var(--insignia-${opcion.color})` }} />
                      )}
                      <button type="button"
                        onClick={() => { onChange(opcion.valor); setAbierto(false); setBusqueda('') }}
                        className="flex-1 text-left border-none bg-transparent cursor-pointer p-0 text-inherit font-inherit">
                        {opcion.etiqueta}
                      </button>

                      {/* Acciones: editar / eliminar — solo visible en hover */}
                      {(onEditar || onEliminar) && (
                        <span className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                          {onEditar && (
                            <button type="button"
                              onClick={(e) => { e.stopPropagation(); setEditandoValor(opcion.valor); setTextoEdicion(opcion.etiqueta) }}
                              className="size-6 flex items-center justify-center rounded hover:bg-superficie-hover cursor-pointer border-none bg-transparent text-texto-terciario hover:text-texto-secundario">
                              <Pencil size={12} />
                            </button>
                          )}
                          {onEliminar && (
                            <button type="button"
                              onClick={(e) => { e.stopPropagation(); eliminarOpcion(opcion.valor) }}
                              className="size-6 flex items-center justify-center rounded hover:bg-superficie-hover cursor-pointer border-none bg-transparent text-texto-terciario hover:text-insignia-peligro">
                              <Trash2 size={12} />
                            </button>
                          )}
                        </span>
                      )}

                      {opcion.valor === valor && !(onEditar || onEliminar) && <Check size={14} className="text-texto-marca shrink-0" />}
                    </div>
                  )
                })}

                {filtradas.length === 0 && !puedeCrear && (
                  <div className="px-3 py-3 text-sm text-texto-terciario text-center">Sin resultados</div>
                )}
              </div>

              {/* Botón crear nuevo */}
              {puedeCrear && (
                <button type="button" onClick={crearNuevo} disabled={creando}
                  className="flex items-center gap-2 w-full px-3 py-2 text-sm text-texto-marca font-medium border-t border-borde-sutil bg-transparent hover:bg-superficie-hover cursor-pointer transition-colors border-x-0 border-b-0">
                  <Plus size={14} />
                  <span>{creando ? 'Creando...' : `${textoCrear} "${busqueda.trim()}"`}</span>
                </button>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}

export type { Opcion as OpcionCreable }
