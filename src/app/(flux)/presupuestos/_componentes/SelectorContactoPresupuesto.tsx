'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronUp, ChevronDown, ExternalLink, MapPin, Mail, Phone, X } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

/**
 * SelectorContactoPresupuesto — Buscador de contacto estilo plano.
 *
 * - Input minimalista con chevron
 * - Dropdown con sección "RECIENTES" al enfocar sin texto
 * - Resultados con: nombre + badge tipo + correo · teléfono
 * - "Sin correo" en advertencia si no tiene
 * - Al seleccionar, muestra ficha compacta con botón "ir al contacto"
 */

interface ContactoHijo {
  id: string
  nombre: string
  apellido: string | null
  correo: string | null
  telefono: string | null
}

interface ContactoResultado {
  id: string
  nombre: string
  apellido: string | null
  correo: string | null
  telefono: string | null
  codigo: string
  tipo_contacto: { clave: string; etiqueta: string } | null
  numero_identificacion: string | null
  condicion_iva: string | null
  datos_fiscales: Record<string, string> | null
  direcciones: { texto: string | null; es_principal: boolean }[]
  vinculaciones?: { puesto: string | null; vinculado: ContactoHijo }[]
}

interface ContactoSeleccionado {
  id: string
  nombre: string
  apellido: string | null
  correo: string | null
  telefono: string | null
  tipo_contacto: { clave: string; etiqueta: string } | null
  numero_identificacion: string | null
  condicion_iva: string | null
  direccion: string | null
}

interface PropiedadesSelectorContacto {
  contacto: ContactoSeleccionado | null
  onChange: (contacto: ContactoResultado | null) => void
  /** Cuando se selecciona un hijo vinculado: padre como cliente, hijo como dirigido a */
  onSeleccionarConDirigidoA?: (padre: ContactoResultado, hijoId: string) => void
  soloLectura?: boolean
  error?: boolean
}

export default function SelectorContactoPresupuesto({
  contacto,
  onChange,
  onSeleccionarConDirigidoA,
  soloLectura = false,
  error = false,
}: PropiedadesSelectorContacto) {
  const router = useRouter()
  const [busqueda, setBusqueda] = useState('')
  const [abierto, setAbierto] = useState(false)
  const [resultados, setResultados] = useState<ContactoResultado[]>([])
  const [recientes, setRecientes] = useState<ContactoResultado[]>([])
  const [buscando, setBuscando] = useState(false)
  const [expandido, setExpandido] = useState<string | null>(null)
  const refContenedor = useRef<HTMLDivElement>(null)
  const refInput = useRef<HTMLInputElement>(null)

  // Cargar recientes al montar (últimos 8 contactos)
  useEffect(() => {
    fetch('/api/contactos?por_pagina=8&orden_campo=actualizado_en&orden_dir=desc')
      .then(r => r.json())
      .then(data => setRecientes(data.contactos || []))
      .catch(() => {})
  }, [])

  // Buscar contactos con debounce
  useEffect(() => {
    if (!busqueda.trim()) {
      setResultados([])
      return
    }
    const timeout = setTimeout(async () => {
      setBuscando(true)
      try {
        const res = await fetch(`/api/contactos?busqueda=${encodeURIComponent(busqueda)}&por_pagina=10`)
        const data = await res.json()
        setResultados(data.contactos || [])
      } catch { /* silenciar */ } finally {
        setBuscando(false)
      }
    }, 300)
    return () => clearTimeout(timeout)
  }, [busqueda])

  // Cerrar al click afuera
  useEffect(() => {
    if (!abierto) return
    const cerrar = (e: MouseEvent) => {
      if (refContenedor.current && !refContenedor.current.contains(e.target as Node)) {
        setAbierto(false)
        setBusqueda('')
      }
    }
    document.addEventListener('mousedown', cerrar)
    return () => document.removeEventListener('mousedown', cerrar)
  }, [abierto])

  const seleccionar = useCallback((c: ContactoResultado) => {
    onChange(c)
    setAbierto(false)
    setBusqueda('')
  }, [onChange])

  const limpiar = useCallback(() => {
    onChange(null)
  }, [onChange])

  // Lista a mostrar: resultados de búsqueda o recientes
  const listaVisible = busqueda.trim() ? resultados : recientes
  const tituloLista = busqueda.trim() ? undefined : 'Recientes'

  // Si hay contacto seleccionado, mostrar ficha
  if (contacto) {
    return (
      <div className={`rounded-lg bg-superficie-app/50 px-3 py-3 ${error ? 'ring-2 ring-estado-error/50' : ''}`}>
        <div className="flex items-start justify-between">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-texto-primario">
                {contacto.nombre} {contacto.apellido || ''}
              </span>
              {contacto.tipo_contacto && (
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-superficie-tarjeta border border-borde-sutil text-texto-terciario">
                  {contacto.tipo_contacto.etiqueta}
                </span>
              )}
            </div>
            {contacto.numero_identificacion && (
              <p className="text-xs text-texto-secundario">
                {contacto.numero_identificacion}
                {contacto.condicion_iva && ` · ${contacto.condicion_iva.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}`}
              </p>
            )}
            {contacto.direccion && (
              <p className="text-xs text-texto-terciario flex items-center gap-1.5">
                <MapPin size={12} className="shrink-0" />
                {contacto.direccion}
              </p>
            )}
          </div>
          <div className="flex items-center gap-1 shrink-0">
            {!soloLectura && (
              <button
                onClick={limpiar}
                className="size-7 rounded flex items-center justify-center text-texto-terciario hover:text-estado-error hover:bg-estado-error/10 transition-colors"
                title="Cambiar cliente"
              >
                <X size={14} />
              </button>
            )}
            {contacto.id && (
              <button
                onClick={() => router.push(`/contactos/${contacto.id}`)}
                className="size-7 rounded flex items-center justify-center text-texto-terciario hover:text-texto-marca hover:bg-marca-500/10 transition-colors"
                title="Ver ficha del contacto"
              >
                <ExternalLink size={14} />
              </button>
            )}
          </div>
        </div>

        {/* Alerta si no tiene correo */}
        {!contacto.correo && (
          <div className="mt-2 flex items-start gap-2 p-2.5 rounded-lg bg-insignia-advertencia/10 border border-insignia-advertencia/20">
            <span className="text-insignia-advertencia text-sm shrink-0 mt-0.5">⚠</span>
            <p className="text-xs text-insignia-advertencia">
              Este contacto no tiene correo electrónico. No se podrán enviar documentos por email.
            </p>
          </div>
        )}
      </div>
    )
  }

  // Sin contacto — mostrar buscador
  if (soloLectura) {
    return <p className="text-sm text-texto-terciario py-2">Sin cliente asignado</p>
  }

  return (
    <div ref={refContenedor} className="relative">
      {/* Input de búsqueda — plano */}
      <div
        className={`flex items-center border-b transition-colors ${
          abierto ? 'border-marca-500' : error ? 'border-estado-error' : 'border-borde-sutil'
        }`}
      >
        <input
          ref={refInput}
          type="text"
          value={busqueda}
          onChange={(e) => { setBusqueda(e.target.value); setAbierto(true) }}
          onFocus={() => setAbierto(true)}
          placeholder="Escribí para encontrar un contacto..."
          className="flex-1 bg-transparent py-2.5 text-sm text-texto-primario placeholder:text-texto-terciario outline-none"
        />
        <button
          onClick={() => { setAbierto(!abierto); if (!abierto) refInput.current?.focus() }}
          className="p-1 text-texto-terciario"
        >
          {abierto ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>
      </div>

      {/* Dropdown de resultados */}
      <AnimatePresence>
        {abierto && listaVisible.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            className="absolute left-0 right-0 top-full mt-1 bg-superficie-elevada border border-borde-sutil rounded-lg shadow-xl z-40 max-h-[360px] overflow-y-auto"
          >
            {/* Título de sección */}
            {tituloLista && (
              <div className="px-4 pt-3 pb-1.5">
                <span className="text-[11px] font-bold text-texto-terciario uppercase tracking-wider">
                  {tituloLista}
                </span>
              </div>
            )}

            {/* Resultados */}
            <div className="py-1">
              {listaVisible.map(c => {
                const vinculacionesConPuesto = (c.vinculaciones || []).filter(v => v.vinculado)
                const tieneHijos = vinculacionesConPuesto.length > 0
                const estaExpandido = expandido === c.id

                return (
                  <div key={c.id}>
                    {/* Fila del contacto */}
                    <div className="flex items-center hover:bg-superficie-tarjeta transition-colors">
                      {/* Flechita expandible */}
                      {tieneHijos ? (
                        <button
                          onClick={(e) => { e.stopPropagation(); setExpandido(estaExpandido ? null : c.id) }}
                          className="px-2 py-3 text-texto-terciario hover:text-texto-primario transition-colors shrink-0"
                        >
                          <ChevronDown size={14} className={`transition-transform duration-200 ${estaExpandido ? 'rotate-180' : ''}`} />
                        </button>
                      ) : (
                        <div className="w-8 shrink-0" />
                      )}

                      {/* Contenido clickeable */}
                      <button
                        onClick={() => seleccionar(c)}
                        className="flex-1 text-left pr-4 py-3"
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-texto-primario">
                            {c.nombre} {c.apellido || ''}
                          </span>
                          {c.tipo_contacto && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-superficie-app border border-borde-sutil text-texto-terciario">
                              {c.tipo_contacto.etiqueta}
                            </span>
                          )}
                        </div>
                        <div className="mt-0.5">
                          <span className="text-xs text-texto-secundario">
                            {c.codigo && <span className="font-mono text-texto-terciario">{c.codigo}</span>}
                            {c.codigo && (c.correo || c.telefono) && '  ·  '}
                            {c.correo}
                            {c.correo && c.telefono && '  ·  '}
                            {c.telefono}
                          </span>
                          {!c.correo && (
                            <span className="text-xs text-insignia-advertencia ml-1">Sin correo</span>
                          )}
                        </div>
                      </button>
                    </div>

                    {/* Hijos expandidos */}
                    {estaExpandido && vinculacionesConPuesto.length > 0 && (
                      <div className="pl-8 border-l-2 border-borde-sutil/50 ml-4 mb-1">
                        {vinculacionesConPuesto.map(v => (
                          <button
                            key={v.vinculado.id}
                            onClick={() => {
                              if (onSeleccionarConDirigidoA) {
                                onSeleccionarConDirigidoA(c, v.vinculado.id)
                              } else {
                                seleccionar(c)
                              }
                              setAbierto(false)
                              setBusqueda('')
                            }}
                            className="w-full text-left px-3 py-2 hover:bg-superficie-tarjeta transition-colors rounded"
                          >
                            <div className="flex items-center gap-2">
                              <span className="text-sm text-texto-primario">
                                {v.vinculado.nombre} {v.vinculado.apellido || ''}
                              </span>
                              {v.puesto && (
                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-superficie-app border border-borde-sutil text-texto-terciario">
                                  {v.puesto}
                                </span>
                              )}
                            </div>
                            {(v.vinculado.correo || v.vinculado.telefono) && (
                              <div className="text-xs text-texto-terciario mt-0.5">
                                {v.vinculado.correo}
                                {v.vinculado.correo && v.vinculado.telefono && ' · '}
                                {v.vinculado.telefono}
                              </div>
                            )}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
