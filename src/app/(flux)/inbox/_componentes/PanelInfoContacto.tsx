'use client'

import { useState, useMemo, useEffect, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Avatar } from '@/componentes/ui/Avatar'
import { Boton } from '@/componentes/ui/Boton'
import { Insignia } from '@/componentes/ui/Insignia'
import { Tooltip } from '@/componentes/ui/Tooltip'
import {
  X, Phone, Mail, Hash, MapPin, Building2, Briefcase,
  ExternalLink, FileText, Image, Play, ChevronDown, ChevronUp, ChevronLeft,
  Link2, Download, UserCheck, Trash2, Clock, ScanSearch, Sparkles,
  FileSpreadsheet, Users, RefreshCw, ArrowRight, Loader2,
  Pin, PinOff, Pencil, Check, Trash,
} from 'lucide-react'
import { IconoWhatsApp } from '@/componentes/iconos/IconoWhatsApp'
import { SelectorEtapa } from './SelectorEtapa'
import { useFormato } from '@/hooks/useFormato'
import { useTraduccion } from '@/lib/i18n'
import type { Conversacion, MensajeConAdjuntos } from '@/tipos/inbox'
import { DELAY_ACCION } from '@/lib/constantes/timeouts'

/**
 * Panel derecho colapsable — info del contacto enriquecida.
 * Muestra: datos de contacto, datos extraídos por IA, vinculaciones,
 * presupuestos, historial y galería de medios.
 */

interface PropiedadesPanelInfo {
  conversacion: Conversacion | null
  mensajes: MensajeConAdjuntos[]
  abierto: boolean
  onCerrar: () => void
  onAbrirVisor?: (url: string) => void
  esMovil?: boolean
}

interface DatosContacto {
  id: string
  nombre: string
  apellido: string | null
  correo: string | null
  telefono: string | null
  whatsapp: string | null
  cargo: string | null
  rubro: string | null
  avatar_url: string | null
  es_provisorio: boolean
  origen: string | null
  tipo_contacto?: { clave?: string; etiqueta: string; color: string; icono?: string }
  direccion_principal?: string | null
}

interface ConversacionHistorial {
  id: string
  estado: string
  tipo_canal: string
  creado_en: string
  ultimo_mensaje_texto: string | null
}

/** Fila de dato extraído con estado de edición */
interface FilaIA {
  clave: string
  etiqueta: string
  valor: string
  fijado: boolean
}

/** Datos extraídos por la IA de la conversación */
interface DatosExtraidosIA {
  nombre: string | null
  apellido: string | null
  telefono: string | null
  correo: string | null
  cargo: string | null
  rubro: string | null
  direccion: {
    calle: string | null
    numero: string | null
    barrio: string | null
    ciudad: string | null
    provincia: string | null
    codigo_postal: string | null
    texto_completo: string | null
  } | null
  tipo_trabajo: string | null
  empresa_nombre: string | null
  notas: string | null
  datos_extra: Record<string, string>
}

/** Vinculación para mostrar en el panel */
interface VinculacionPanel {
  id: string
  contacto: {
    id: string
    nombre: string
    apellido: string | null
    telefono: string | null
    correo: string | null
    codigo: string
    tipo_contacto: { clave: string; etiqueta: string; icono: string; color: string }
  }
  relacion: string
  puesto: string | null
}

/** Presupuesto resumido para el panel */
interface PresupuestoPanel {
  id: string
  numero: string
  estado: string
  total_final: number
  moneda: string
  fecha_emision: string
  contacto_nombre: string | null
}

/** Dirección del contacto */
interface DireccionPanel {
  id: string
  tipo: string
  calle: string | null
  numero: string | null
  barrio: string | null
  ciudad: string | null
  provincia: string | null
  texto: string | null
  es_principal: boolean
}

type TabMedia = 'fotos' | 'documentos' | 'enlaces'

// ─── Caché de datos IA en sessionStorage ───
const CACHE_PREFIX = 'flux_ia_panel_'

function guardarCacheIA(convId: string, filas: FilaIA[], cantEntrantes: number) {
  try {
    sessionStorage.setItem(`${CACHE_PREFIX}${convId}`, JSON.stringify({ filas, cantEntrantes, ts: Date.now() }))
  } catch { /* storage lleno, ignorar */ }
}

function leerCacheIA(convId: string): { filas: FilaIA[]; cantEntrantes: number } | null {
  try {
    const raw = sessionStorage.getItem(`${CACHE_PREFIX}${convId}`)
    if (!raw) return null
    const data = JSON.parse(raw) as { filas: FilaIA[]; cantEntrantes: number; ts: number }
    // Expirar después de 1 hora
    if (Date.now() - data.ts > 3600000) {
      sessionStorage.removeItem(`${CACHE_PREFIX}${convId}`)
      return null
    }
    return data
  } catch { return null }
}

function borrarCacheIA(convId: string) {
  try { sessionStorage.removeItem(`${CACHE_PREFIX}${convId}`) } catch {}
}

export function PanelInfoContacto({ conversacion, mensajes, abierto, onCerrar, onAbrirVisor, esMovil }: PropiedadesPanelInfo) {
  const formato = useFormato()
  const { t } = useTraduccion()
  const [contacto, setContacto] = useState<DatosContacto | null>(null)
  const [historial, setHistorial] = useState<ConversacionHistorial[]>([])
  const [cargandoHistorial, setCargandoHistorial] = useState(false)
  const [seccionesAbiertas, setSeccionesAbiertas] = useState<Set<string>>(new Set(['datos']))
  const [tabMedia, setTabMedia] = useState<TabMedia>('fotos')

  // Datos enriquecidos del panel
  const [vinculaciones, setVinculaciones] = useState<VinculacionPanel[]>([])
  const [presupuestos, setPresupuestos] = useState<PresupuestoPanel[]>([])
  const [direcciones, setDirecciones] = useState<DireccionPanel[]>([])

  // IA - extracción de datos
  const [datosIA, setDatosIA] = useState<DatosExtraidosIA | null>(null)
  const [escaneandoIA, setEscaneandoIA] = useState(false)
  const [yaEscaneo, setYaEscaneo] = useState(false)

  // Filas editables: las filas que el usuario puede editar/fijar
  const [filasIA, setFilasIA] = useState<FilaIA[]>([])
  const [editandoClave, setEditandoClave] = useState<string | null>(null)
  const [valorEditando, setValorEditando] = useState('')

  const toggleSeccion = useCallback((seccion: string) => {
    setSeccionesAbiertas(prev => {
      const nueva = new Set(prev)
      if (nueva.has(seccion)) nueva.delete(seccion)
      else nueva.add(seccion)
      return nueva
    })
  }, [])

  // Ref para evitar re-ejecuciones del escaneo IA
  const escaneandoRef = useRef(false)
  // Ref para trackear qué contacto_id ya se cargó
  const contactoCargadoRef = useRef<string | null>(null)
  // Cantidad de mensajes entrantes al momento del último escaneo
  const mensajesAlEscanearRef = useRef(0)

  // ─── Cargar todo al cambiar de conversación (una sola vez por contacto_id) ───
  useEffect(() => {
    const contactoId = conversacion?.contacto_id
    const convId = conversacion?.id

    // Si cambió el contacto, resetear todo
    if (contactoId !== contactoCargadoRef.current) {
      setContacto(null)
      setVinculaciones([])
      setPresupuestos([])
      setDirecciones([])
      setHistorial([])
      setEditandoClave(null)
      contactoCargadoRef.current = contactoId || null

      // Intentar restaurar datos IA del caché
      const cache = convId ? leerCacheIA(convId) : null
      if (cache) {
        setFilasIA(cache.filas)
        setYaEscaneo(true)
        setDatosIA({} as DatosExtraidosIA) // marcador no-nulo
        mensajesAlEscanearRef.current = cache.cantEntrantes
        setSeccionesAbiertas(prev => new Set([...prev, 'datos_ia']))
      } else {
        setDatosIA(null)
        setYaEscaneo(false)
        setFilasIA([])
      }
    }

    if (!contactoId) return

    let cancelado = false

    const cargarTodo = async () => {
      setCargandoHistorial(true)
      try {
        // Fetch contacto + datos enriquecidos + historial en paralelo
        const [resContacto, resPanel, resHistorial] = await Promise.all([
          fetch(`/api/contactos/${contactoId}`),
          fetch(`/api/contactos/${contactoId}/panel-inbox`),
          fetch(`/api/inbox/conversaciones?contacto_id=${contactoId}&por_pagina=10`),
        ])

        if (cancelado) return

        // Contacto
        if (!resContacto.ok) {
          // Contacto eliminado — desvincular
          await fetch(`/api/inbox/conversaciones/${convId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contacto_id: null }),
          }).catch(() => {})
          return
        }
        const dataContacto = await resContacto.json()
        if (cancelado) return
        if (dataContacto?.id) setContacto(dataContacto as DatosContacto)

        // Datos enriquecidos
        if (resPanel.ok) {
          const dataPanel = await resPanel.json()
          if (!cancelado) {
            setVinculaciones(dataPanel.vinculaciones || [])
            setPresupuestos(dataPanel.presupuestos || [])
            setDirecciones(dataPanel.direcciones || [])
          }
        }

        // Historial
        if (resHistorial.ok) {
          const dataHist = await resHistorial.json()
          if (!cancelado) {
            const convs = (dataHist.conversaciones || [])
              .filter((c: ConversacionHistorial) => c.id !== convId)
            setHistorial(convs as ConversacionHistorial[])
          }
        }

        // Auto-escanear si es provisorio y no hay caché
        const cache = convId ? leerCacheIA(convId) : null
        if (!cancelado && dataContacto?.es_provisorio && mensajes.length > 0 && !cache) {
          const entrantes = mensajes.filter(m => m.es_entrante).length
          ejecutarEscaneoIA(convId!, false, entrantes)
        }
      } catch (err) {
        console.error('Error al cargar panel:', err)
      } finally {
        if (!cancelado) setCargandoHistorial(false)
      }
    }

    cargarTodo()
    return () => { cancelado = true }
  // Solo se re-ejecuta cuando cambia el contacto_id o la conversacion_id
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversacion?.contacto_id, conversacion?.id])

  // ─── Escanear conversación con IA (función estable) ───
  const ejecutarEscaneoIA = useCallback(async (convId: string, forzarTodo: boolean, cantEntrantes?: number) => {
    if (escaneandoRef.current) return
    escaneandoRef.current = true
    setEscaneandoIA(true)
    try {
      const res = await fetch('/api/inbox/ia', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conversacion_id: convId, accion: 'extraer_datos' }),
      })
      if (res.ok) {
        const data = await res.json() as DatosExtraidosIA
        setDatosIA(data)
        setYaEscaneo(true)
        // Guardar snapshot de mensajes entrantes al momento del escaneo
        if (cantEntrantes !== undefined) mensajesAlEscanearRef.current = cantEntrantes

        const filasNuevas = construirFilasDesdeIA(data, t)

        const entrantesActual = cantEntrantes ?? mensajesAlEscanearRef.current

        setFilasIA(prev => {
          let resultado: FilaIA[]
          if (forzarTodo || prev.length === 0) {
            resultado = filasNuevas
          } else {
            // Merge: respetar campos fijados
            const fijadas = new Map(prev.filter(f => f.fijado).map(f => [f.clave, f]))
            resultado = []
            for (const fila of filasNuevas) {
              const fijada = fijadas.get(fila.clave)
              if (fijada) {
                resultado.push(fijada)
                fijadas.delete(fila.clave)
              } else {
                resultado.push(fila)
              }
            }
            for (const fijada of fijadas.values()) resultado.push(fijada)
          }
          // Guardar en caché
          guardarCacheIA(convId, resultado, entrantesActual)
          return resultado
        })

        setSeccionesAbiertas(prev => new Set([...prev, 'datos_ia']))
      }
    } catch (err) {
      console.error('Error escaneando con IA:', err)
    } finally {
      escaneandoRef.current = false
      setEscaneandoIA(false)
    }
  }, [])

  // Wrapper para llamar desde botones
  const escanearConIA = useCallback((forzarTodo = false) => {
    if (!conversacion?.id) return
    if (forzarTodo) borrarCacheIA(conversacion.id)
    ejecutarEscaneoIA(conversacion.id, forzarTodo)
  }, [conversacion?.id, ejecutarEscaneoIA])

  // Actualizar filas con persistencia automática en caché
  const actualizarFilasIA = useCallback((updater: (prev: FilaIA[]) => FilaIA[]) => {
    setFilasIA(prev => {
      const nuevas = updater(prev)
      if (conversacion?.id) guardarCacheIA(conversacion.id, nuevas, mensajesAlEscanearRef.current)
      return nuevas
    })
  }, [conversacion?.id])

  // ─── Re-escaneo automático cuando llegan mensajes nuevos del cliente ───
  const mensajesEntrantes = useMemo(() => mensajes.filter(m => m.es_entrante).length, [mensajes])

  useEffect(() => {
    // No hacer nada si nunca se escaneó o si no cambió la cantidad de entrantes
    if (!yaEscaneo || !conversacion?.id) return
    if (mensajesEntrantes <= mensajesAlEscanearRef.current) return

    // Hay mensajes nuevos del cliente desde el último escaneo — re-escanear respetando fijados
    // Pequeño delay para no escanear por cada mensaje en ráfaga
    const timeout = setTimeout(() => {
      ejecutarEscaneoIA(conversacion.id, false, mensajesEntrantes)
    }, DELAY_ACCION)

    return () => clearTimeout(timeout)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mensajesEntrantes])

  // ─── Acciones provisorio ───
  const [accionandoProvisorio, setAccionandoProvisorio] = useState(false)

  const aceptarProvisorio = async () => {
    if (!contacto?.id) return
    setAccionandoProvisorio(true)
    try {
      // Enviar datos extraídos/editados por IA al actualizar el contacto
      const datosActualizar: Record<string, unknown> = { es_provisorio: false }
      if (filasIA.length > 0) {
        const mapaFilas = new Map(filasIA.map(f => [f.clave, f.valor]))
        if (mapaFilas.get('nombre') && !contacto.nombre) datosActualizar.nombre = mapaFilas.get('nombre')
        if (mapaFilas.get('correo') && !contacto.correo) datosActualizar.correo = mapaFilas.get('correo')
        if (mapaFilas.get('cargo') && !contacto.cargo) datosActualizar.cargo = mapaFilas.get('cargo')
        if (mapaFilas.get('rubro') && !contacto.rubro) datosActualizar.rubro = mapaFilas.get('rubro')
      }

      const res = await fetch(`/api/contactos/${contacto.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(datosActualizar),
      })
      if (res.ok) {
        setContacto(prev => prev ? { ...prev, es_provisorio: false, ...datosActualizar } : prev)
      }
    } catch (err) {
      console.error('Error aceptando contacto:', err)
    } finally {
      setAccionandoProvisorio(false)
    }
  }

  const descartarProvisorio = async () => {
    if (!contacto?.id) return
    setAccionandoProvisorio(true)
    try {
      const res = await fetch(`/api/contactos/${contacto.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ en_papelera: true }),
      })
      if (res.ok) {
        setContacto(prev => prev ? { ...prev, es_provisorio: false } : prev)
      }
    } catch (err) {
      console.error('Error descartando contacto:', err)
    } finally {
      setAccionandoProvisorio(false)
    }
  }

  // ─── Medios organizados ───
  const medios = useMemo(() => {
    const fotos: { url: string; fecha: string; tipo: 'imagen' | 'video' }[] = []
    const documentos: { url: string; nombre: string; fecha: string; tamano: number | null; mime: string }[] = []
    const enlaces: { url: string; texto: string; fecha: string }[] = []

    for (const msg of mensajes) {
      if (msg.tipo_contenido === 'imagen') {
        for (const adj of msg.adjuntos) fotos.push({ url: adj.url, fecha: msg.creado_en, tipo: 'imagen' })
      }
      if (msg.tipo_contenido === 'video') {
        for (const adj of msg.adjuntos) fotos.push({ url: adj.url, fecha: msg.creado_en, tipo: 'video' })
      }
      if (msg.tipo_contenido === 'documento') {
        for (const adj of msg.adjuntos) documentos.push({ url: adj.url, nombre: adj.nombre_archivo, fecha: msg.creado_en, tamano: adj.tamano_bytes, mime: adj.tipo_mime })
      }
      if (msg.tipo_contenido === 'texto' && msg.texto) {
        const urlRegex = /https?:\/\/[^\s]+/g
        const urls = msg.texto.match(urlRegex)
        if (urls) {
          for (const url of urls) enlaces.push({ url, texto: msg.texto, fecha: msg.creado_en })
        }
      }
    }
    return { fotos, documentos, enlaces }
  }, [mensajes])

  const totalFotos = medios.fotos.length
  const totalDocs = medios.documentos.length
  const totalEnlaces = medios.enlaces.length

  // Dirección principal
  const direccionPrincipal = direcciones.find(d => d.es_principal) || direcciones[0] || null

  // Color de estado de presupuesto
  const colorEstadoPresupuesto: Record<string, 'exito' | 'advertencia' | 'info' | 'neutro' | 'peligro' | 'violeta'> = {
    borrador: 'neutro',
    enviado: 'info',
    confirmado_cliente: 'exito',
    orden_venta: 'exito',
    rechazado: 'peligro',
    vencido: 'advertencia',
    cancelado: 'neutro',
  }

  // ═══════════════════════════════════════════════════════════════
  // CONTENIDO DEL PANEL
  // ═══════════════════════════════════════════════════════════════

  const contenidoPanel = (
    <>
      {/* Header */}
      <div
        className="flex items-center justify-between p-3 sticky top-0 z-10"
        style={{ borderBottom: '1px solid var(--borde-sutil)', background: 'var(--superficie-tarjeta)' }}
      >
        {esMovil ? (
          <Boton variante="fantasma" tamano="sm" icono={<ChevronLeft size={20} />} onClick={onCerrar} className="min-h-[44px]">
            Volver
          </Boton>
        ) : (
          <span className="text-sm font-semibold" style={{ color: 'var(--texto-primario)' }}>
            Info del contacto
          </span>
        )}
        <div className="flex items-center gap-1">
          {/* Botón re-escanear IA */}
          {conversacion?.contacto_id && (
            <Tooltip contenido={yaEscaneo ? 'Re-escanear conversación' : 'Escanear con IA'}>
              <Boton
                variante="fantasma"
                tamano="xs"
                soloIcono
                titulo="Escanear con IA"
                icono={escaneandoIA ? <Loader2 size={14} className="animate-spin" /> : <ScanSearch size={14} />}
                onClick={() => escanearConIA()}
                disabled={escaneandoIA}
              />
            </Tooltip>
          )}
          {!esMovil && (
            <Boton variante="fantasma" tamano="xs" soloIcono titulo="Cerrar" icono={<X size={16} />} onClick={onCerrar} />
          )}
        </div>
      </div>

      {/* ═══ Sin contacto vinculado ═══ */}
      {!conversacion?.contacto_id ? (
        <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
          <div
            className="w-12 h-12 rounded-full flex items-center justify-center mb-3"
            style={{ background: 'var(--superficie-hover)' }}
          >
            <Link2 size={20} style={{ color: 'var(--texto-terciario)' }} />
          </div>
          <p className="text-sm" style={{ color: 'var(--texto-secundario)' }}>
            Sin contacto vinculado
          </p>
          <p className="text-xs mt-1 mb-4" style={{ color: 'var(--texto-terciario)' }}>
            Vinculá esta conversación a un contacto existente.
          </p>
          <Boton variante="secundario" tamano="sm">
            Vincular contacto
          </Boton>
        </div>
      ) : (
        <div className="p-3 space-y-1">
          {/* ═══ Avatar y nombre ═══ */}
          <div className="flex flex-col items-center text-center pt-2 pb-1">
            <Avatar nombre={conversacion.contacto_nombre || '?'} tamano="lg" />
            <h3 className="text-sm font-semibold mt-2" style={{ color: 'var(--texto-primario)' }}>
              {conversacion.contacto_nombre || 'Sin nombre'}
            </h3>
            {contacto?.cargo && (
              <p className="text-xs" style={{ color: 'var(--texto-secundario)' }}>{contacto.cargo}</p>
            )}
            <div className="flex items-center gap-1.5 mt-1">
              {contacto?.tipo_contacto && (
                <Insignia color={contacto.tipo_contacto.color as 'primario'} tamano="sm">
                  {contacto.tipo_contacto.etiqueta}
                </Insignia>
              )}
            </div>

            {/* Badge provisorio + acciones */}
            {contacto?.es_provisorio && (
              <div className="mt-2 w-full">
                <div
                  className="flex items-center justify-center gap-1.5 px-2 py-1 rounded-md mb-2"
                  style={{ background: 'var(--insignia-advertencia-fondo)', color: 'var(--insignia-advertencia-texto)' }}
                >
                  <Clock size={12} />
                  <span className="text-xs font-medium">Contacto provisorio</span>
                </div>
                <div className="flex items-center gap-2">
                  <Boton
                    variante="primario"
                    tamano="sm"
                    icono={<UserCheck size={14} />}
                    onClick={aceptarProvisorio}
                    disabled={accionandoProvisorio}
                    className="flex-1"
                  >
                    Aceptar
                  </Boton>
                  <Boton
                    variante="fantasma"
                    tamano="sm"
                    icono={<Trash2 size={14} />}
                    onClick={descartarProvisorio}
                    disabled={accionandoProvisorio}
                    className="flex-1 text-[var(--insignia-peligro)]"
                  >
                    Descartar
                  </Boton>
                </div>
              </div>
            )}
          </div>

          {/* ═══ Acciones rápidas ═══ */}
          <div className="flex items-center justify-center gap-2 pb-1">
            {conversacion.identificador_externo && (
              <Boton variante="secundario" tamano="sm" soloIcono icono={<IconoWhatsApp size={16} />} titulo="WhatsApp" />
            )}
            {contacto?.telefono && (
              <Boton variante="secundario" tamano="sm" soloIcono icono={<Phone size={16} />} titulo="Llamar" />
            )}
            {contacto?.correo && (
              <Boton variante="secundario" tamano="sm" soloIcono icono={<Mail size={16} />} titulo="Correo" />
            )}
            <Tooltip contenido="Ver contacto completo">
              <a
                href={`/contactos/${conversacion.contacto_id}`}
                className="p-2 rounded-lg transition-colors"
                style={{ background: 'var(--superficie-hover)', color: 'var(--texto-secundario)' }}
              >
                <ExternalLink size={16} />
              </a>
            </Tooltip>
          </div>

          {/* ═══ SECCIÓN: Datos extraídos por IA ═══ */}
          {filasIA.length > 0 && (
            <SeccionColapsable
              titulo="Datos extraídos"
              icono={<Sparkles size={12} style={{ color: 'var(--texto-marca)' }} />}
              abierta={seccionesAbiertas.has('datos_ia')}
              onToggle={() => toggleSeccion('datos_ia')}
              acento
            >
              <div
                className="rounded-lg overflow-hidden text-xs mt-1"
                style={{ border: '1px solid var(--borde-sutil)' }}
              >
                {filasIA.map((fila, i) => (
                  <div
                    key={fila.clave}
                    className="group flex items-start gap-1.5 px-2.5 py-1.5"
                    style={{
                      borderBottom: i < filasIA.length - 1 ? '1px solid var(--borde-sutil)' : 'none',
                      background: fila.fijado ? 'var(--superficie-hover)' : 'transparent',
                    }}
                  >
                    {/* Etiqueta */}
                    <span
                      className="flex-shrink-0 w-[80px] text-xxs font-medium truncate pt-0.5"
                      style={{ color: 'var(--texto-terciario)' }}
                    >
                      {fila.etiqueta}
                    </span>

                    {/* Valor — editable o lectura */}
                    {editandoClave === fila.clave ? (
                      <div className="flex-1 min-w-0 flex items-center gap-1">
                        <input
                          autoFocus
                          value={valorEditando}
                          onChange={(e) => setValorEditando(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              actualizarFilasIA(prev => prev.map(f =>
                                f.clave === fila.clave ? { ...f, valor: valorEditando, fijado: true } : f
                              ))
                              setEditandoClave(null)
                            }
                            if (e.key === 'Escape') setEditandoClave(null)
                          }}
                          className="flex-1 min-w-0 bg-transparent text-xs outline-none"
                          style={{
                            color: 'var(--texto-primario)',
                            borderBottom: '1px solid var(--texto-marca)',
                            padding: '0 0 1px 0',
                          }}
                        />
                        <button
                          onClick={() => {
                            actualizarFilasIA(prev => prev.map(f =>
                              f.clave === fila.clave ? { ...f, valor: valorEditando, fijado: true } : f
                            ))
                            setEditandoClave(null)
                          }}
                          className="p-0.5 rounded hover:opacity-80"
                          style={{ color: 'var(--texto-marca)' }}
                        >
                          <Check size={12} />
                        </button>
                      </div>
                    ) : (
                      <span
                        className="flex-1 min-w-0 cursor-pointer hover:opacity-80"
                        style={{ color: 'var(--texto-primario)' }}
                        onClick={() => {
                          setEditandoClave(fila.clave)
                          setValorEditando(fila.valor)
                        }}
                      >
                        {fila.valor}
                      </span>
                    )}

                    {/* Acciones: fijar / desfijar / eliminar */}
                    {editandoClave !== fila.clave && (
                      <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                        <Tooltip contenido={fila.fijado ? 'Desfijar (se actualiza al re-escanear)' : 'Fijar (no se pisa al re-escanear)'}>
                          <button
                            onClick={() => {
                              actualizarFilasIA(prev => prev.map(f =>
                                f.clave === fila.clave ? { ...f, fijado: !f.fijado } : f
                              ))
                            }}
                            className="p-0.5 rounded hover:opacity-80"
                            style={{ color: fila.fijado ? 'var(--texto-marca)' : 'var(--texto-terciario)' }}
                          >
                            {fila.fijado ? <Pin size={10} /> : <PinOff size={10} />}
                          </button>
                        </Tooltip>
                        <Tooltip contenido="Eliminar campo">
                          <button
                            onClick={() => {
                              actualizarFilasIA(prev => prev.filter(f => f.clave !== fila.clave))
                            }}
                            className="p-0.5 rounded hover:opacity-80"
                            style={{ color: 'var(--texto-terciario)' }}
                          >
                            <X size={10} />
                          </button>
                        </Tooltip>
                      </div>
                    )}

                    {/* Indicador fijado visible sin hover */}
                    {fila.fijado && editandoClave !== fila.clave && (
                      <Pin size={8} className="flex-shrink-0 mt-1 opacity-40" style={{ color: 'var(--texto-marca)' }} />
                    )}
                  </div>
                ))}
              </div>

              {/* Acciones de escaneo */}
              <div className="flex items-center justify-center gap-3 mt-2">
                <button
                  onClick={() => escanearConIA(false)}
                  disabled={escaneandoIA}
                  className="flex items-center gap-1.5 py-1 text-xxs rounded transition-colors hover:opacity-80 disabled:opacity-40"
                  style={{ color: 'var(--texto-terciario)' }}
                >
                  <RefreshCw size={10} className={escaneandoIA ? 'animate-spin' : ''} />
                  {escaneandoIA ? 'Escaneando...' : 'Re-escanear'}
                </button>
                {filasIA.some(f => f.fijado) && (
                  <button
                    onClick={() => {
                      setFilasIA([])
                      escanearConIA(true)
                    }}
                    disabled={escaneandoIA}
                    className="flex items-center gap-1.5 py-1 text-xxs rounded transition-colors hover:opacity-80 disabled:opacity-40"
                    style={{ color: 'var(--insignia-advertencia-texto, var(--texto-terciario))' }}
                  >
                    <Trash size={10} />
                    Escanear todo de nuevo
                  </button>
                )}
              </div>
            </SeccionColapsable>
          )}

          {/* ═══ SECCIÓN: Datos de contacto ═══ */}
          <SeccionColapsable
            titulo="Datos de contacto"
            abierta={seccionesAbiertas.has('datos')}
            onToggle={() => toggleSeccion('datos')}
          >
            <div className="space-y-2">
              {contacto?.correo && <DatoContacto icono={<Mail size={12} />} valor={contacto.correo} />}
              {contacto?.telefono && <DatoContacto icono={<Phone size={12} />} valor={contacto.telefono} />}
              {contacto?.whatsapp && contacto.whatsapp !== contacto.telefono && (
                <DatoContacto icono={<IconoWhatsApp size={12} />} valor={contacto.whatsapp} />
              )}
              {contacto?.rubro && <DatoContacto icono={<Building2 size={12} />} valor={contacto.rubro} />}
              {contacto?.cargo && <DatoContacto icono={<Briefcase size={12} />} valor={contacto.cargo} />}
              {/* Dirección principal */}
              {(direccionPrincipal?.texto || contacto?.direccion_principal) && (
                <DatoContacto
                  icono={<MapPin size={12} />}
                  valor={direccionPrincipal?.texto || contacto?.direccion_principal || ''}
                />
              )}
              {direccionPrincipal?.barrio && !direccionPrincipal?.texto && (
                <DatoContacto icono={<MapPin size={12} />} valor={`${direccionPrincipal.barrio}${direccionPrincipal.ciudad ? ', ' + direccionPrincipal.ciudad : ''}`} />
              )}
              {!contacto && (
                <p className="text-xs" style={{ color: 'var(--texto-terciario)' }}>Cargando datos...</p>
              )}
              {contacto && !contacto.correo && !contacto.telefono && !contacto.cargo && !contacto.rubro && !direccionPrincipal && (
                <p className="text-xs" style={{ color: 'var(--texto-terciario)' }}>Sin datos de contacto registrados.</p>
              )}
            </div>
          </SeccionColapsable>

          {/* ═══ SECCIÓN: Vinculaciones ═══ */}
          {vinculaciones.length > 0 && (
            <SeccionColapsable
              titulo={`Vinculaciones (${vinculaciones.length})`}
              icono={<Users size={12} />}
              abierta={seccionesAbiertas.has('vinculaciones')}
              onToggle={() => toggleSeccion('vinculaciones')}
            >
              <div className="space-y-1">
                {vinculaciones.map((v) => (
                  <a
                    key={v.id}
                    href={`/contactos/${v.contacto.id}`}
                    className="flex items-center gap-2 px-2 py-1.5 rounded transition-colors hover:opacity-80"
                    style={{ background: 'var(--superficie-hover)' }}
                  >
                    <Avatar nombre={`${v.contacto.nombre} ${v.contacto.apellido || ''}`} tamano="xs" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium truncate" style={{ color: 'var(--texto-primario)' }}>
                        {v.contacto.nombre} {v.contacto.apellido || ''}
                      </p>
                      <p className="text-xxs truncate" style={{ color: 'var(--texto-terciario)' }}>
                        {v.relacion}{v.puesto ? ` · ${v.puesto}` : ''}
                      </p>
                    </div>
                    <Insignia color={v.contacto.tipo_contacto?.color as 'neutro' || 'neutro'} tamano="sm">
                      {v.contacto.tipo_contacto?.etiqueta || 'Contacto'}
                    </Insignia>
                  </a>
                ))}
              </div>
            </SeccionColapsable>
          )}

          {/* ═══ SECCIÓN: Presupuestos ═══ */}
          {presupuestos.length > 0 && (
            <SeccionColapsable
              titulo={`Presupuestos (${presupuestos.length})`}
              icono={<FileSpreadsheet size={12} />}
              abierta={seccionesAbiertas.has('presupuestos')}
              onToggle={() => toggleSeccion('presupuestos')}
            >
              <div className="space-y-1">
                {presupuestos.map((p) => (
                  <a
                    key={p.id}
                    href={`/presupuestos/${p.id}`}
                    className="flex items-center gap-2 px-2 py-1.5 rounded transition-colors hover:opacity-80"
                    style={{ background: 'var(--superficie-hover)' }}
                  >
                    <FileSpreadsheet size={14} style={{ color: 'var(--texto-marca)' }} className="flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-medium" style={{ color: 'var(--texto-primario)' }}>
                          {p.numero}
                        </span>
                        <Insignia color={colorEstadoPresupuesto[p.estado] as 'neutro' || 'neutro'} tamano="sm">
                          {p.estado.replace(/_/g, ' ')}
                        </Insignia>
                      </div>
                      <p className="text-xxs" style={{ color: 'var(--texto-terciario)' }}>
                        {p.moneda} {Number(p.total_final).toLocaleString(formato.locale, { minimumFractionDigits: 2 })}
                        {' · '}
                        {formato.fecha(new Date(p.fecha_emision), { corta: true })}
                      </p>
                    </div>
                    <ArrowRight size={12} style={{ color: 'var(--texto-terciario)' }} />
                  </a>
                ))}
              </div>
            </SeccionColapsable>
          )}

          {/* ═══ SECCIÓN: Historial ═══ */}
          <SeccionColapsable
            titulo={`Historial${historial.length > 0 ? ` (${historial.length})` : ''}`}
            abierta={seccionesAbiertas.has('historial')}
            onToggle={() => toggleSeccion('historial')}
          >
            {cargandoHistorial ? (
              <p className="text-xs" style={{ color: 'var(--texto-terciario)' }}>Cargando historial...</p>
            ) : historial.length === 0 ? (
              <p className="text-xs" style={{ color: 'var(--texto-terciario)' }}>
                Sin conversaciones anteriores.
              </p>
            ) : (
              <div className="space-y-1">
                {historial.map((conv) => {
                  const iconoCanal = conv.tipo_canal === 'whatsapp'
                    ? <IconoWhatsApp size={12} style={{ color: 'var(--canal-whatsapp)' }} />
                    : conv.tipo_canal === 'correo'
                      ? <Mail size={12} style={{ color: 'var(--canal-correo)' }} />
                      : <Hash size={12} style={{ color: 'var(--canal-interno)' }} />

                  const colorEstado: Record<string, 'exito' | 'advertencia' | 'info' | 'neutro' | 'peligro'> = {
                    abierta: 'info',
                    pendiente: 'advertencia',
                    cerrada: 'neutro',
                    resuelta: 'exito',
                    archivada: 'neutro',
                  }

                  return (
                    <a
                      key={conv.id}
                      href={`/inbox?id=${conv.id}`}
                      className="flex items-start gap-2 px-2 py-1.5 rounded transition-colors hover:opacity-80"
                      style={{ background: 'var(--superficie-hover)' }}
                    >
                      <span className="mt-0.5 flex-shrink-0">{iconoCanal}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs truncate" style={{ color: 'var(--texto-primario)' }}>
                          {conv.ultimo_mensaje_texto || 'Sin mensajes'}
                        </p>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className="text-xxs" style={{ color: 'var(--texto-terciario)' }}>
                            {formato.fecha(new Date(conv.creado_en), { corta: true })}
                          </span>
                          <Insignia color={colorEstado[conv.estado] || 'neutro'} tamano="sm">
                            {conv.estado}
                          </Insignia>
                        </div>
                      </div>
                    </a>
                  )
                })}
              </div>
            )}
          </SeccionColapsable>
        </div>
      )}

      {/* ═══ Etapa de conversación (pipeline) ═══ */}
      {conversacion && conversacion.tipo_canal !== 'interno' && (
        <div className="px-4 py-3" style={{ borderBottom: '1px solid var(--borde-sutil)' }}>
          <SelectorEtapa
            conversacionId={conversacion.id}
            tipoCanal={conversacion.tipo_canal as 'whatsapp' | 'correo'}
            etapaActualId={conversacion.etapa_id || null}
            onCambio={() => {}}
          />
        </div>
      )}

      {/* ═══ Galería de Medios ═══ */}
      <div style={{ borderTop: '1px solid var(--borde-sutil)' }}>
        <div className="flex px-3 pt-2 gap-1">
          {[
            { clave: 'fotos' as TabMedia, etiqueta: 'Fotos', cantidad: totalFotos },
            { clave: 'documentos' as TabMedia, etiqueta: 'Docs', cantidad: totalDocs },
            { clave: 'enlaces' as TabMedia, etiqueta: 'Enlaces', cantidad: totalEnlaces },
          ].map(tab => (
            <Boton
              key={tab.clave}
              variante="fantasma"
              tamano="xs"
              onClick={() => setTabMedia(tab.clave)}
              className="flex-1 text-center"
              style={{
                background: tabMedia === tab.clave ? 'var(--superficie-hover)' : 'transparent',
                color: tabMedia === tab.clave ? 'var(--texto-primario)' : 'var(--texto-terciario)',
                fontWeight: tabMedia === tab.clave ? 600 : 400,
              }}
            >
              {tab.etiqueta} {tab.cantidad > 0 && <span className="opacity-60">({tab.cantidad})</span>}
            </Boton>
          ))}
        </div>

        <div className="p-3 min-h-[120px]">
          {tabMedia === 'fotos' && (
            totalFotos === 0 ? (
              <EstadoVacioMedia icono={<Image size={20} />} texto="Sin fotos ni videos" />
            ) : (
              <div className="grid grid-cols-3 gap-1 rounded-md overflow-hidden">
                {medios.fotos.map((media, i) => (
                  <Boton
                    key={`media-${i}`}
                    variante="fantasma"
                    tamano="sm"
                    onClick={() => onAbrirVisor?.(media.url)}
                    className="aspect-square overflow-hidden relative p-0"
                  >
                    {media.tipo === 'video' ? (
                      <>
                        <video src={media.url} preload="metadata" muted className="w-full h-full object-cover" />
                        <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                          <div className="w-7 h-7 rounded-full flex items-center justify-center bg-black/50">
                            <Play size={12} className="text-white ml-px" />
                          </div>
                        </div>
                      </>
                    ) : (
                      <img src={media.url} alt="" className="w-full h-full object-cover hover:opacity-80 transition-opacity cursor-pointer" />
                    )}
                  </Boton>
                ))}
              </div>
            )
          )}

          {tabMedia === 'documentos' && (
            totalDocs === 0 ? (
              <EstadoVacioMedia icono={<FileText size={20} />} texto="Sin documentos" />
            ) : (
              <div className="space-y-1">
                {medios.documentos.map((doc, i) => (
                  <a
                    key={`doc-${i}`}
                    href={doc.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 px-2 py-1.5 rounded transition-colors"
                    style={{ background: 'var(--superficie-hover)' }}
                  >
                    <FileText size={14} style={{ color: 'var(--texto-marca)' }} />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs truncate" style={{ color: 'var(--texto-primario)' }}>{doc.nombre}</p>
                      <p className="text-xxs" style={{ color: 'var(--texto-terciario)' }}>
                        {doc.tamano ? (doc.tamano > 1048576 ? `${(doc.tamano / 1048576).toFixed(1)} MB` : `${(doc.tamano / 1024).toFixed(0)} KB`) : ''}
                        {doc.tamano ? ' · ' : ''}
                        {formato.fecha(new Date(doc.fecha), { corta: true })}
                      </p>
                    </div>
                    <Download size={12} style={{ color: 'var(--texto-terciario)' }} />
                  </a>
                ))}
              </div>
            )
          )}

          {tabMedia === 'enlaces' && (
            totalEnlaces === 0 ? (
              <EstadoVacioMedia icono={<Link2 size={20} />} texto="Sin enlaces compartidos" />
            ) : (
              <div className="space-y-1">
                {medios.enlaces.map((enlace, i) => (
                  <a
                    key={`link-${i}`}
                    href={enlace.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-start gap-2 px-2 py-1.5 rounded transition-colors"
                    style={{ background: 'var(--superficie-hover)' }}
                  >
                    <ExternalLink size={12} className="mt-0.5 flex-shrink-0" style={{ color: 'var(--texto-marca)' }} />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs truncate" style={{ color: 'var(--texto-marca)' }}>
                        {enlace.url.replace(/^https?:\/\/(www\.)?/, '').split('/')[0]}
                      </p>
                      <p className="text-xxs truncate" style={{ color: 'var(--texto-terciario)' }}>
                        {enlace.texto.length > 60 ? enlace.texto.slice(0, 60) + '...' : enlace.texto}
                      </p>
                    </div>
                    <span className="text-xxs flex-shrink-0" style={{ color: 'var(--texto-terciario)' }}>
                      {formato.fecha(new Date(enlace.fecha), { corta: true })}
                    </span>
                  </a>
                ))}
              </div>
            )
          )}
        </div>
      </div>
    </>
  )

  // Móvil: vista completa
  if (esMovil) {
    return (
      <div className="h-full overflow-y-auto" style={{ background: 'var(--superficie-tarjeta)', overscrollBehaviorY: 'contain' }}>
        {contenidoPanel}
      </div>
    )
  }

  // Desktop: panel lateral animado
  return (
    <AnimatePresence>
      {abierto && (
        <motion.div
          initial={{ width: 0, opacity: 0 }}
          animate={{ width: 320, opacity: 1 }}
          exit={{ width: 0, opacity: 0 }}
          transition={{ duration: 0.2, ease: 'easeInOut' }}
          className="h-full overflow-hidden flex-shrink-0"
          style={{
            borderLeft: '1px solid var(--borde-sutil)',
            background: 'var(--superficie-tarjeta)',
          }}
        >
          <div className="h-full overflow-y-auto">
            {contenidoPanel}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

// ═══════════════════════════════════════════════════════════════
// COMPONENTES AUXILIARES
// ═══════════════════════════════════════════════════════════════

/** Estado vacío para tabs de media */
function EstadoVacioMedia({ icono, texto }: { icono: React.ReactNode; texto: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-6 text-center">
      <div
        className="w-10 h-10 rounded-full flex items-center justify-center mb-2"
        style={{ background: 'var(--superficie-hover)', color: 'var(--texto-terciario)' }}
      >
        {icono}
      </div>
      <p className="text-xs" style={{ color: 'var(--texto-terciario)' }}>{texto}</p>
    </div>
  )
}

/** Sección colapsable con soporte para ícono y acento visual */
function SeccionColapsable({
  titulo,
  icono,
  abierta,
  onToggle,
  children,
  acento,
}: {
  titulo: string
  icono?: React.ReactNode
  abierta: boolean
  onToggle: () => void
  children: React.ReactNode
  acento?: boolean
}) {
  return (
    <div style={{ borderTop: '1px solid var(--borde-sutil)' }}>
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-1.5 px-3 py-2 text-xs font-medium transition-colors hover:opacity-80"
        style={{
          color: acento ? 'var(--texto-marca)' : 'var(--texto-secundario)',
          background: acento && abierta ? 'var(--superficie-hover)' : 'transparent',
        }}
      >
        {icono}
        <span className="flex-1 text-left">{titulo}</span>
        {abierta ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
      </button>
      <AnimatePresence>
        {abierta && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="px-3 pt-1 pb-2">
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

/** Línea de dato de contacto con ícono */
function DatoContacto({ icono, valor }: { icono: React.ReactNode; valor: string }) {
  return (
    <div className="flex items-center gap-2">
      <span style={{ color: 'var(--texto-terciario)' }}>{icono}</span>
      <span className="text-xs truncate" style={{ color: 'var(--texto-secundario)' }}>{valor}</span>
    </div>
  )
}

/** Construye FilaIA[] desde los datos crudos de la IA (sin fijados) */
function construirFilasDesdeIA(datos: DatosExtraidosIA, t: (clave: string) => string): FilaIA[] {
  const filas: FilaIA[] = []
  const agregar = (clave: string, etiqueta: string, valor: string | null | undefined) => {
    if (valor) filas.push({ clave, etiqueta, valor, fijado: false })
  }
  agregar('nombre', t('comun.nombre'), datos.nombre ? `${datos.nombre}${datos.apellido ? ' ' + datos.apellido : ''}` : null)
  agregar('telefono', t('contactos.telefono'), datos.telefono)
  agregar('correo', t('contactos.correo'), datos.correo)
  agregar('empresa', t('empresa.titulo'), datos.empresa_nombre)
  agregar('cargo', t('comun.cargo'), datos.cargo)
  agregar('rubro', t('comun.rubro'), datos.rubro)
  agregar('tipo_trabajo', t('comun.trabajo'), datos.tipo_trabajo)
  // Dirección
  if (datos.direccion?.texto_completo) {
    agregar('direccion', t('contactos.direccion'), datos.direccion.texto_completo)
  } else {
    const partes = [datos.direccion?.barrio, datos.direccion?.ciudad, datos.direccion?.provincia].filter(Boolean)
    if (partes.length > 0) agregar('ubicacion', t('comun.ubicacion'), partes.join(', '))
  }
  agregar('notas', t('comun.notas'), datos.notas)
  // Datos extra dinámicos
  for (const [clave, valor] of Object.entries(datos.datos_extra || {})) {
    agregar(`extra_${clave}`, capitalizar(clave.replace(/_/g, ' ')), valor)
  }
  return filas
}

/** Verifica si la IA extrajo algún dato útil */
function tieneDatosExtraidos(datos: DatosExtraidosIA): boolean {
  return !!(
    datos.nombre || datos.apellido || datos.telefono || datos.correo ||
    datos.cargo || datos.rubro || datos.tipo_trabajo || datos.empresa_nombre ||
    datos.notas || datos.direccion?.texto_completo || datos.direccion?.barrio ||
    datos.direccion?.ciudad || (datos.datos_extra && Object.keys(datos.datos_extra).length > 0)
  )
}

/** Capitalizar primera letra */
function capitalizar(texto: string): string {
  return texto.charAt(0).toUpperCase() + texto.slice(1)
}
