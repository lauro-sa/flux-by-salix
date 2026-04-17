'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { useRouter } from 'next/navigation'
import { ChevronUp, ChevronDown, ExternalLink, MapPin, Mail, Phone, X } from 'lucide-react'
import { Boton } from '@/componentes/ui/Boton'
import { motion, AnimatePresence } from 'framer-motion'
import { DEBOUNCE_BUSQUEDA } from '@/lib/constantes/timeouts'

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
  whatsapp?: string | null
  codigo: string
  tipo_contacto: { clave: string; etiqueta: string } | null
  numero_identificacion: string | null
  condicion_iva: string | null
  datos_fiscales: Record<string, string> | null
  direcciones: { id?: string; texto: string | null; tipo?: string; es_principal: boolean }[]
  vinculaciones?: { puesto: string | null; vinculado: ContactoHijo }[]
}

interface DireccionFicha {
  id?: string
  texto: string | null
  tipo?: string
  es_principal: boolean
}

interface ContactoSeleccionado {
  id: string
  nombre: string
  apellido: string | null
  correo: string | null
  telefono: string | null
  whatsapp?: string | null
  tipo_contacto: { clave: string; etiqueta: string } | null
  numero_identificacion: string | null
  condicion_iva: string | null
  direccion: string | null
  direcciones?: DireccionFicha[]
}

interface PropiedadesSelectorContacto {
  contacto: ContactoSeleccionado | null
  onChange: (contacto: ContactoResultado | null) => void
  /** Cuando se selecciona un hijo vinculado: padre como cliente, hijo como dirigido a */
  onSeleccionarConDirigidoA?: (padre: ContactoResultado, hijoId: string) => void
  /** Cuando el usuario cambia la dirección seleccionada */
  onCambiarDireccion?: (direccionId: string) => void
  soloLectura?: boolean
  error?: boolean
  /** Foco automático al montar (ej. al crear presupuesto nuevo) */
  autoFocus?: boolean
  /** Hay vinculaciones con correo disponibles (para mejorar mensaje de alerta) */
  hayVinculacionesConCorreo?: boolean
}

export default function SelectorContactoPresupuesto({
  contacto,
  onChange,
  onSeleccionarConDirigidoA,
  onCambiarDireccion,
  soloLectura = false,
  error = false,
  autoFocus = false,
  hayVinculacionesConCorreo = false,
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
  const [posDropdown, setPosDropdown] = useState<{ top: number; left: number; width: number } | null>(null)

  // Auto-focus al montar (ej. presupuesto nuevo sin contacto)
  useEffect(() => {
    if (autoFocus && !contacto && refInput.current) {
      requestAnimationFrame(() => refInput.current?.focus())
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

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
    }, DEBOUNCE_BUSQUEDA)
    return () => clearTimeout(timeout)
  }, [busqueda])

  // Calcular posición del dropdown (portal)
  useEffect(() => {
    if (!abierto || !refContenedor.current) {
      setPosDropdown(null)
      return
    }
    const calcular = () => {
      const rect = refContenedor.current?.getBoundingClientRect()
      if (!rect) return
      setPosDropdown({ top: rect.bottom + 4, left: rect.left, width: rect.width })
    }
    calcular()
    window.addEventListener('scroll', calcular, true)
    window.addEventListener('resize', calcular)
    return () => {
      window.removeEventListener('scroll', calcular, true)
      window.removeEventListener('resize', calcular)
    }
  }, [abierto])

  // Cerrar al click afuera
  useEffect(() => {
    if (!abierto) return
    const cerrar = (e: MouseEvent) => {
      if (refContenedor.current && !refContenedor.current.contains(e.target as Node)) {
        const portal = document.getElementById('selector-contacto-presupuesto-portal')
        if (portal && portal.contains(e.target as Node)) return
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

  // Teléfono a mostrar: prioridad WhatsApp > teléfono fijo
  const telefonoMostrar = contacto?.whatsapp || contacto?.telefono || null
  const esTelefonoWhatsapp = !!contacto?.whatsapp

  // Direcciones disponibles
  const direcciones = contacto?.direcciones?.filter(d => d.texto) || []
  const direccionActual = direcciones.find(d => d.es_principal) || direcciones[0] || null

  // Etiquetas de tipo de dirección
  const etiquetaTipoDireccion = (tipo?: string) => {
    const etiquetas: Record<string, string> = { principal: 'Principal', fiscal: 'Fiscal', entrega: 'Entrega', otra: 'Otra' }
    return tipo ? etiquetas[tipo] || tipo : null
  }

  // Si hay contacto seleccionado, mostrar ficha
  if (contacto) {
    // Si no hay direcciones pero sí hay contacto.direccion (fallback modo editar)
    const direccionTexto = direccionActual?.texto || contacto.direccion
    const direccionTipo = direccionActual ? etiquetaTipoDireccion(direccionActual.tipo) : null

    return (
      <div className={`rounded-lg bg-superficie-app/50 px-3 py-3 ${error ? 'ring-2 ring-estado-error/50' : ''}`}>
        <div className="flex items-start justify-between">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-texto-primario">
                {contacto.nombre} {contacto.apellido || ''}
              </span>
              {contacto.tipo_contacto && (
                <span className="text-xxs px-1.5 py-0.5 rounded bg-superficie-tarjeta border border-borde-sutil text-texto-terciario">
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
            {direccionTexto && (
              <div className="flex items-start gap-1.5">
                <MapPin size={12} className="shrink-0 mt-0.5 text-texto-terciario" />
                <div className="flex items-center gap-2">
                  <p className="text-xs text-texto-terciario">{direccionTexto}</p>
                  {direccionTipo && (
                    <span className="text-xxs px-1.5 py-0.5 rounded bg-superficie-tarjeta border border-borde-sutil text-texto-terciario shrink-0">
                      {direccionTipo}
                    </span>
                  )}
                  {direcciones.length > 1 && !soloLectura && (
                    <select
                      className="text-xxs bg-superficie-tarjeta border border-borde-sutil rounded px-1 py-0.5 text-texto-secundario cursor-pointer outline-none"
                      value={direccionActual?.id || ''}
                      onChange={(e) => {
                        const dir = direcciones.find(d => d.id === e.target.value)
                        if (dir && onCambiarDireccion) onCambiarDireccion(dir.id || '')
                      }}
                    >
                      {direcciones.map((d, i) => (
                        <option key={d.id || i} value={d.id || ''}>
                          {etiquetaTipoDireccion(d.tipo) || `Dirección ${i + 1}`}{d.es_principal ? ' (principal)' : ''}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              </div>
            )}
            {contacto.correo && (
              <p className="text-xs text-texto-terciario flex items-center gap-1.5">
                <Mail size={12} className="shrink-0" />
                {contacto.correo}
              </p>
            )}
            {telefonoMostrar && (
              <p className="text-xs text-texto-terciario flex items-center gap-1.5">
                <Phone size={12} className="shrink-0" />
                {telefonoMostrar}
              </p>
            )}
          </div>
          <div className="flex items-center gap-1 shrink-0">
            {!soloLectura && (
              <Boton variante="fantasma" tamano="xs" soloIcono icono={<X size={14} />} onClick={limpiar} titulo="Cambiar cliente" className="text-texto-terciario hover:text-estado-error hover:bg-estado-error/10" />
            )}
            {contacto.id && (
              <Boton variante="fantasma" tamano="xs" soloIcono icono={<ExternalLink size={14} />} onClick={() => router.push(`/contactos/${contacto.id}`)} titulo="Ver ficha del contacto" />
            )}
          </div>
        </div>

        {/* Alerta si no tiene correo */}
        {!contacto.correo && (
          <div className="mt-2 flex items-start gap-2 p-2.5 rounded-lg bg-insignia-advertencia/10 border border-insignia-advertencia/20">
            <span className="text-insignia-advertencia text-sm shrink-0 mt-0.5">⚠</span>
            <p className="text-xs text-insignia-advertencia">
              {hayVinculacionesConCorreo
                ? 'Este contacto no tiene correo electrónico. Seleccioná un contacto en "Dirigido a" para poder enviar por email.'
                : 'Este contacto no tiene correo electrónico. No se podrán enviar documentos por email.'
              }
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
          className="flex-1 bg-transparent py-2.5 text-sm text-texto-primario placeholder:text-texto-placeholder outline-none"
        />
        <Boton
          variante="fantasma"
          tamano="xs"
          soloIcono
          icono={abierto ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          titulo={abierto ? 'Cerrar' : 'Abrir'}
          onClick={() => { setAbierto(!abierto); if (!abierto) refInput.current?.focus() }}
          className="p-1"
        />
      </div>

      {/* Dropdown — portal para salir del overflow del contenedor */}
      {typeof document !== 'undefined' && createPortal(
        <AnimatePresence>
          {abierto && listaVisible.length > 0 && posDropdown && (
            <motion.div
              id="selector-contacto-presupuesto-portal"
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              style={{ position: 'fixed', top: posDropdown.top, left: posDropdown.left, width: posDropdown.width }}
              className="bg-superficie-elevada border border-borde-sutil rounded-lg shadow-lg z-[var(--z-popover)] max-h-[360px] overflow-y-auto"
            >
              {tituloLista && (
                <div className="px-4 pt-3 pb-1.5">
                  <span className="text-xs font-bold text-texto-terciario uppercase tracking-wider">
                    {tituloLista}
                  </span>
                </div>
              )}

              <div className="py-1">
                {listaVisible.map(c => {
                  const vinculacionesConPuesto = (c.vinculaciones || []).filter(v => v.vinculado)
                  const tieneHijos = vinculacionesConPuesto.length > 0
                  const estaExpandido = expandido === c.id

                  return (
                    <div key={c.id}>
                      <button
                        onClick={() => seleccionar(c)}
                        className="w-full text-left px-4 py-2.5 hover:bg-superficie-tarjeta transition-colors"
                      >
                        <div className="flex items-center gap-2">
                          {tieneHijos && (
                            <span
                              role="button"
                              onClick={(e) => { e.stopPropagation(); setExpandido(estaExpandido ? null : c.id) }}
                              className="text-texto-terciario hover:text-texto-secundario shrink-0 -ml-0.5"
                            >
                              <ChevronDown size={14} className={`transition-transform duration-200 ${estaExpandido ? 'rotate-180' : ''}`} />
                            </span>
                          )}
                          <span className="text-sm font-semibold text-texto-primario">
                            {c.nombre} {c.apellido || ''}
                          </span>
                          {c.tipo_contacto && (
                            <span className="text-xxs px-1.5 py-0.5 rounded bg-superficie-app border border-borde-sutil text-texto-terciario shrink-0">
                              {c.tipo_contacto.etiqueta}
                            </span>
                          )}
                        </div>
                        <div className="mt-0.5">
                          <span className="text-xs text-texto-secundario">
                            {c.codigo && <span className="font-mono text-texto-terciario">{c.codigo}</span>}
                            {c.codigo && (c.correo || c.telefono) && ' · '}
                            {c.correo}
                            {c.correo && c.telefono && ' · '}
                            {c.telefono}
                          </span>
                          {!c.correo && (
                            <span className="text-xs text-insignia-advertencia ml-1">Sin correo</span>
                          )}
                        </div>
                      </button>

                      {estaExpandido && vinculacionesConPuesto.length > 0 && (
                        <div className="ml-6 border-l-2 border-borde-sutil/40">
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
                              className="w-full text-left pl-4 pr-4 py-2 hover:bg-superficie-tarjeta transition-colors"
                            >
                              <div className="flex items-center gap-2">
                                <span className="text-sm text-texto-primario">
                                  {v.vinculado.nombre} {v.vinculado.apellido || ''}
                                </span>
                                {v.puesto && (
                                  <span className="text-xxs px-1.5 py-0.5 rounded bg-superficie-app border border-borde-sutil text-texto-terciario">
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
        </AnimatePresence>,
        document.body
      )}
    </div>
  )
}
