'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { useRouter } from 'next/navigation'
import { ChevronUp, ChevronDown, ExternalLink, Mail, Phone, X, Copy, Check } from 'lucide-react'
import { Boton } from '@/componentes/ui/Boton'
import { formatearParaMostrar } from '@/componentes/ui/TextoTelefono'
import { motion, AnimatePresence } from 'framer-motion'
import { DEBOUNCE_BUSQUEDA } from '@/lib/constantes/timeouts'

/**
 * Parte un texto de dirección en dos líneas para jerarquía visual:
 * la calle (lo más útil para reconocer al cliente) queda como protagonista,
 * y el resto (localidad/CP/ciudad/país) abajo en tamaño menor.
 *
 * Heurística: la primera coma separa calle del resto. Funciona para el
 * formato canónico que arma la app ("Calle 1234, Ciudad, Provincia, País").
 * Si no hay coma, todo va como línea principal.
 */
function partirDireccion(texto: string): { principal: string; secundaria: string } {
  const idx = texto.indexOf(',')
  if (idx < 0) return { principal: texto.trim(), secundaria: '' }
  return {
    principal: texto.slice(0, idx).trim(),
    secundaria: texto.slice(idx + 1).trim(),
  }
}

/**
 * Botoncito de copiar al portapapeles. Pensado para vivir al final de una
 * fila con hover bg: el botón aparece más visible al pasar el mouse por la
 * fila (group/fila) y muestra "Copiar" inline. El texto principal de la
 * fila sigue siendo seleccionable porque el botón no se superpone.
 */
function BotonCopiar({ valor }: { valor: string }) {
  const [copiado, setCopiado] = useState(false)
  const copiar = (e: React.MouseEvent) => {
    e.stopPropagation()
    navigator.clipboard.writeText(valor)
    setCopiado(true)
    setTimeout(() => setCopiado(false), 1500)
  }
  // Feedback verde + label "Copiado" durante 1.5s. El label se hace visible
  // siempre que esté copiado (no depende del hover) para que el usuario vea
  // el efecto incluso si ya sacó el mouse del botón al hacer click.
  // Ancho mínimo reservado para que el botón mida lo mismo con o sin el
  // label "Copiar" visible. Sin esto, al aparecer el texto en hover, el
  // botón crece y "mueve" los elementos vecinos (montos, direcciones).
  const claseBase = 'ml-auto shrink-0 inline-flex items-center justify-end gap-1 min-w-[5rem] px-1.5 py-0 rounded transition-colors'
  const claseEstado = copiado
    ? 'text-insignia-exito bg-insignia-exito/15'
    : 'text-texto-terciario hover:text-texto-primario hover:bg-superficie-tarjeta'

  return (
    <button
      type="button"
      onClick={copiar}
      className={`${claseBase} ${claseEstado}`}
      title={copiado ? 'Copiado' : 'Copiar'}
    >
      {/* Texto a la izquierda del ícono: así el ícono queda anclado a la
          derecha y no se mueve cuando aparece/desaparece el label en hover. */}
      <span className={`text-xxs ${copiado ? 'inline' : 'hidden group-hover/fila:inline'}`}>
        {copiado ? 'Copiado' : 'Copiar'}
      </span>
      {copiado ? <Check size={11} /> : <Copy size={11} />}
    </button>
  )
}

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
  onCambiarDireccion?: (direccionId: string, texto: string) => void
  /** ID de la dirección elegida (override del principal por defecto) */
  direccionIdSeleccionada?: string | null
  soloLectura?: boolean
  error?: boolean
  /** Foco automático al montar (ej. al crear presupuesto nuevo) */
  autoFocus?: boolean
  /** Hay vinculaciones con correo disponibles (para mejorar mensaje de alerta) */
  hayVinculacionesConCorreo?: boolean
  /** Query string `?desde=...&desde_nombre=...` para que la página destino del
   *  contacto arme su breadcrumb apuntando al presupuesto de origen. */
  qsDesde?: string
  /** Oculta el botón ↗ "Ver ficha" interno cuando el padre lo renderiza
   *  afuera del card (junto a la etiqueta de sección, por ejemplo). Así
   *  la columna derecha del card queda solo con metadatos + copiar. */
  ocultarBotonIrAContacto?: boolean
}

export default function SelectorContactoPresupuesto({
  contacto,
  onChange,
  onSeleccionarConDirigidoA,
  onCambiarDireccion,
  direccionIdSeleccionada,
  soloLectura = false,
  error = false,
  autoFocus = false,
  hayVinculacionesConCorreo = false,
  qsDesde = '',
  ocultarBotonIrAContacto = false,
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

  // Direcciones disponibles. Si hay una seleccionada explícitamente (ej. snapshot
  // del presupuesto guardado), tiene prioridad sobre la principal.
  const direcciones = contacto?.direcciones?.filter(d => d.texto) || []
  const direccionActual = (direccionIdSeleccionada
    ? direcciones.find(d => d.id === direccionIdSeleccionada)
    : null) || direcciones.find(d => d.es_principal) || direcciones[0] || null

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
    const direccionPartida = direccionTexto ? partirDireccion(direccionTexto) : null
    // Mostrar separador entre dirección y contacto solo si ambos bloques existen.
    const tieneContactoBajo = !!contacto.correo || !!telefonoMostrar
    const mostrarSeparadorBajoDireccion = !!direccionPartida && tieneContactoBajo

    return (
      <div className={`rounded-card bg-superficie-app/50 px-3 py-3 ${error ? 'ring-2 ring-estado-error/50' : ''}`}>
        {/* Bloque identidad: nombre a la izquierda, badge de tipo + acciones a
            la derecha en la misma línea. Esto deja al nombre como el dato
            protagonista (sin chips mezclados) y agrupa todos los elementos
            "auxiliares" del header en un solo cluster a la derecha. */}
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm font-semibold text-texto-primario truncate min-w-0 flex-1">
            {contacto.nombre} {contacto.apellido || ''}
          </span>
          <div className="flex items-center gap-1.5 shrink-0">
            {contacto.tipo_contacto && (
              <span className="text-xxs px-1.5 py-0.5 rounded bg-superficie-tarjeta border border-borde-sutil text-texto-terciario">
                {contacto.tipo_contacto.etiqueta}
              </span>
            )}
            {!soloLectura && (
              <Boton variante="fantasma" tamano="xs" soloIcono icono={<X size={14} />} onClick={limpiar} titulo="Cambiar cliente" className="text-texto-terciario hover:text-estado-error hover:bg-estado-error/10" />
            )}
            {contacto.id && !ocultarBotonIrAContacto && (
              <Boton variante="fantasma" tamano="xs" soloIcono icono={<ExternalLink size={14} />} onClick={() => router.push(`/contactos/${contacto.id}${qsDesde}`)} titulo="Ver ficha del contacto" />
            )}
          </div>
        </div>
        {contacto.numero_identificacion && (
          <div className="group/fila flex items-center gap-1.5 text-xxs text-texto-terciario mt-1.5 -mx-1.5 px-1.5 py-1 rounded hover:bg-superficie-hover/40 transition-colors">
            <span className="select-text">{contacto.numero_identificacion}</span>
            {contacto.condicion_iva && (
              <span className="text-texto-terciario/70 select-text">
                · {contacto.condicion_iva.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
              </span>
            )}
            <BotonCopiar valor={contacto.numero_identificacion.replace(/-/g, '')} />
          </div>
        )}

        {/* Bloque dirección: protagonista del bloque inferior. La calle se
            destaca en tamaño normal; localidad/CP/país van en línea
            secundaria más chica, según jerarquía pedida.
            Toda la región es group/fila: el botón Copiar la dirección
            completa aparece en hover, alineado bajo el badge de tipo.
            Padding y separación entre filas calibrados para que el bloque
            respire sin sentirse comprimido, pero sin que el hover lo
            "infle" — mantiene la misma altura con y sin hover. */}
        {direccionPartida && direccionTexto && (
          <div className="group/fila mt-3 -mx-1.5 px-1.5 py-1.5 rounded hover:bg-superficie-hover/40 transition-colors">
            <div className="flex items-center gap-2">
              <p className="text-sm text-texto-primario flex-1 min-w-0 select-text">
                {direccionPartida.principal}
              </p>
              {direccionTipo && (
                <span className="text-xxs px-1.5 py-0.5 rounded bg-superficie-tarjeta border border-borde-sutil text-texto-terciario shrink-0">
                  {direccionTipo}
                </span>
              )}
              {direcciones.length > 1 && !soloLectura && (
                <select
                  className="text-xxs bg-superficie-tarjeta border border-borde-sutil rounded px-1 py-0.5 text-texto-secundario cursor-pointer outline-none shrink-0"
                  value={direccionActual?.id || ''}
                  onChange={(e) => {
                    const dir = direcciones.find(d => d.id === e.target.value)
                    if (dir && onCambiarDireccion) onCambiarDireccion(dir.id || '', dir.texto || '')
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
            <div className="flex items-center justify-between gap-2 mt-2">
              <p className="text-xxs text-texto-terciario flex-1 min-w-0 select-text">
                {direccionPartida.secundaria}
              </p>
              <BotonCopiar valor={direccionTexto} />
            </div>
          </div>
        )}

        {/* Separador sutil entre dirección y datos de contacto */}
        {mostrarSeparadorBajoDireccion && (
          <div className="mt-3 border-t border-borde-sutil/50" />
        )}

        {/* Bloque contacto: correo + teléfono. Datos secundarios pero útiles.
            Cada fila tiene hover bg para invitar al copiado; el texto sigue
            siendo seleccionable (no hay pointer-events:none en el span). */}
        {tieneContactoBajo && (
          <div className="space-y-0.5 mt-3">
            {contacto.correo && (
              <div className="group/fila flex items-center gap-1.5 text-xxs text-texto-terciario -mx-1.5 px-1.5 py-1 rounded hover:bg-superficie-hover/40 transition-colors">
                <Mail size={11} className="shrink-0" />
                <span className="truncate flex-1 select-text">{contacto.correo}</span>
                <BotonCopiar valor={contacto.correo} />
              </div>
            )}
            {telefonoMostrar && (
              <div className="group/fila flex items-center gap-1.5 text-xxs text-texto-terciario -mx-1.5 px-1.5 py-1 rounded hover:bg-superficie-hover/40 transition-colors">
                <Phone size={11} className="shrink-0" />
                <span className="flex-1 select-text">{formatearParaMostrar(telefonoMostrar)}</span>
                <BotonCopiar valor={telefonoMostrar} />
              </div>
            )}
          </div>
        )}

        {/* Alerta si no tiene correo */}
        {!contacto.correo && (
          <div className="mt-2.5 flex items-start gap-2 p-2.5 rounded-card bg-insignia-advertencia/10 border border-insignia-advertencia/20">
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
              className="bg-superficie-elevada border border-borde-sutil rounded-card shadow-lg z-[var(--z-popover)] max-h-[360px] overflow-y-auto"
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
                            {formatearParaMostrar(c.telefono)}
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
                                  {formatearParaMostrar(v.vinculado.telefono)}
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
