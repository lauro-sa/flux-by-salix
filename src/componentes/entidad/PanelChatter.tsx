'use client'

/**
 * PanelChatter — Panel completo de actividad vinculado a cualquier entidad.
 * Inspirado en Odoo: barra de acciones (correo, WhatsApp, nota, actividad),
 * timeline unificada con filtros, sección de adjuntos, modales integrados.
 *
 * Self-contained para WhatsApp y Actividades (maneja modales internamente).
 * Correo usa callback (onAbrirCorreo) porque ModalEnviarDocumento necesita
 * configuración compleja que solo el padre tiene.
 *
 * Funciona para: presupuestos, facturas, órdenes, contactos, etc.
 * Se usa en: EditorPresupuesto, y cualquier módulo de documentos.
 */

import { useState, useEffect, useRef, useCallback, useMemo, useId } from 'react'
import {
  MessageSquare, Send, Loader2, Reply, Search,
  ChevronDown, ChevronUp, X, MoreVertical, Paperclip,
  PanelRightClose, PanelRightOpen, Check,
} from 'lucide-react'
import { AnimatePresence, motion } from 'framer-motion'
import { Boton } from '@/componentes/ui/Boton'
import { TextArea } from '@/componentes/ui/TextArea'
import { ModalActividad } from '@/app/(flux)/actividades/_componentes/ModalActividad'
import { crearClienteNavegador } from '@/lib/supabase/cliente'
import type { EntradaChatter, FiltroChatter } from '@/tipos/chatter'
import { Popover } from '@/componentes/ui/Popover'
import {
  BarraAcciones, EntradaTimeline, EditorNota,
  SeccionAdjuntos, ModalWhatsAppChatter, useConfigActividades,
} from './_panel_chatter'
import type { PropsPanelChatter } from './_panel_chatter/tipos'
import type { AdjuntoConOrigen } from './_panel_chatter/SeccionAdjuntos'

// ─── Definición de filtros ───
const FILTROS: { clave: FiltroChatter; etiqueta: string }[] = [
  { clave: 'todo', etiqueta: 'Todo' },
  { clave: 'correos', etiqueta: 'Correos' },
  { clave: 'whatsapp', etiqueta: 'WhatsApp' },
  { clave: 'notas', etiqueta: 'Notas' },
  { clave: 'sistema', etiqueta: 'Sistema' },
]

export function PanelChatter({
  entidadTipo,
  entidadId,
  contacto,
  tipoDocumento,
  datosDocumento,
  onAbrirCorreo,
  adjuntosDocumento = [],
  modo = 'inferior',
  seccion,
  sinLateral = [],
  onCambiarSinLateral,
  className = '',
}: PropsPanelChatter) {
  // ─── Estado principal ───
  const [entradas, setEntradas] = useState<EntradaChatter[]>([])
  const [cargando, setCargando] = useState(true)
  const [filtro, setFiltro] = useState<FiltroChatter>('todo')
  const [mensaje, setMensaje] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [modoNota, setModoNota] = useState(false)
  const [modoRespuestaPortal, setModoRespuestaPortal] = useState(false)
  const [busqueda, setBusqueda] = useState('')
  const [mostrarBusqueda, setMostrarBusqueda] = useState(false)
  const [colapsado, setColapsado] = useState(false)

  // ─── Estado de modales internos ───
  const [modalWhatsApp, setModalWhatsApp] = useState(false)
  const [modalActividad, setModalActividad] = useState(false)
  const [menuAbierto, setMenuAbierto] = useState(false)
  const [adjuntosExpandidos, setAdjuntosExpandidos] = useState(false)

  // ─── Config de actividades (lazy load) ───
  const { datos: configActividades, cargando: cargandoConfig, cargar: cargarConfig } = useConfigActividades()

  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  // ─── Cargar entradas ───
  const cargar = useCallback(async () => {
    try {
      const res = await fetch(`/api/chatter?entidad_tipo=${entidadTipo}&entidad_id=${entidadId}`)
      if (res.ok) {
        const data = await res.json()
        setEntradas(data.entradas || [])
      }
    } catch { /* silencioso */ }
    setCargando(false)
  }, [entidadTipo, entidadId])

  useEffect(() => {
    if (entidadId) cargar()
  }, [entidadId, cargar])

  // ─── Realtime: escuchar cambios en la tabla chatter para esta entidad ───
  useEffect(() => {
    if (!entidadId) return

    const supabase = crearClienteNavegador()
    const canal = supabase
      .channel(`chatter-${entidadTipo}-${entidadId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'chatter',
        filter: `entidad_id=eq.${entidadId}`,
      }, () => {
        // Recargar todas las entradas cuando hay cualquier cambio (INSERT o UPDATE)
        cargar()
      })
      .subscribe()

    return () => {
      supabase.removeChannel(canal)
    }
  }, [entidadId, entidadTipo, cargar])

  // ─── Filtrar entradas (más nuevas primero) ───
  const entradasFiltradas = useMemo(() => {
    let resultado = [...entradas].reverse()

    switch (filtro) {
      case 'correos':
        resultado = resultado.filter(e => e.tipo === 'correo' || e.metadata?.accion === 'correo_enviado' || e.metadata?.accion === 'correo_recibido')
        break
      case 'whatsapp':
        resultado = resultado.filter(e => e.tipo === 'whatsapp' || e.metadata?.accion === 'whatsapp_enviado')
        break
      case 'notas':
        resultado = resultado.filter(e => e.tipo === 'nota_interna' || e.tipo === 'mensaje')
        break
      case 'sistema':
        resultado = resultado.filter(e => e.tipo === 'sistema')
        break
    }

    if (busqueda.trim()) {
      const termino = busqueda.toLowerCase()
      resultado = resultado.filter(e =>
        e.contenido.toLowerCase().includes(termino) ||
        e.autor_nombre.toLowerCase().includes(termino) ||
        e.metadata?.correo_asunto?.toLowerCase().includes(termino)
      )
    }

    return resultado
  }, [entradas, filtro, busqueda])

  // ─── Contadores por filtro ───
  const contadores = useMemo(() => {
    const c: Record<FiltroChatter, number> = { todo: 0, correos: 0, whatsapp: 0, notas: 0, sistema: 0 }
    for (const e of entradas) {
      c.todo++
      if (e.tipo === 'correo' || e.metadata?.accion === 'correo_enviado' || e.metadata?.accion === 'correo_recibido') c.correos++
      if (e.tipo === 'whatsapp' || e.metadata?.accion === 'whatsapp_enviado') c.whatsapp++
      if (e.tipo === 'nota_interna' || e.tipo === 'mensaje') c.notas++
      if (e.tipo === 'sistema') c.sistema++
    }
    return c
  }, [entradas])

  // ─── Recolectar adjuntos de todas las entradas ───
  const adjuntosChatter = useMemo<AdjuntoConOrigen[]>(() => {
    const resultado: AdjuntoConOrigen[] = []
    for (const e of entradas) {
      if (e.adjuntos?.length) {
        for (const adj of e.adjuntos) {
          resultado.push({
            ...adj,
            origen: e.autor_nombre,
          })
        }
      }
    }
    return resultado
  }, [entradas])

  // ─── Enviar mensaje rápido ───
  const enviarMensaje = async () => {
    const texto = mensaje.trim()
    if (!texto || enviando) return

    setEnviando(true)
    try {
      if (modoRespuestaPortal && entidadTipo === 'presupuesto') {
        const res = await fetch(`/api/presupuestos/${entidadId}/mensajes-portal`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ contenido: texto }),
        })
        if (res.ok) {
          setMensaje('')
          setModoRespuestaPortal(false)
          await fetch('/api/chatter', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              entidad_tipo: entidadTipo,
              entidad_id: entidadId,
              tipo: 'mensaje',
              contenido: texto,
              metadata: { portal: true },
            }),
          })
          await cargar()
        }
      } else {
        const res = await fetch('/api/chatter', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            entidad_tipo: entidadTipo,
            entidad_id: entidadId,
            tipo: 'mensaje',
            contenido: texto,
          }),
        })
        if (res.ok) {
          setMensaje('')
          await cargar()
        }
      }
    } catch { /* silencioso */ }
    setEnviando(false)
    inputRef.current?.focus()
  }

  // ─── Confirmar/rechazar comprobante ───
  const accionComprobante = async (_entradaId: string, comprobanteId: string, accion: 'confirmar' | 'rechazar') => {
    try {
      const res = await fetch(`/api/presupuestos/${entidadId}/comprobantes`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ comprobante_id: comprobanteId, accion }),
      })
      if (res.ok) await cargar()
    } catch { /* silencioso */ }
  }

  // ─── Abrir modal de actividad (lazy load config) ───
  const abrirActividad = useCallback(async () => {
    await cargarConfig()
    setModalActividad(true)
  }, [cargarConfig])

  // ─── Crear actividad desde el chatter ───
  const crearActividad = async (datos: Record<string, unknown>) => {
    const res = await fetch('/api/actividades', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(datos),
    })
    if (!res.ok) throw new Error('Error al crear actividad')

    // Registrar en chatter
    const actividad = await res.json()
    await fetch('/api/chatter', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        entidad_tipo: entidadTipo,
        entidad_id: entidadId,
        tipo: 'sistema',
        contenido: `Creó actividad: ${actividad.titulo || datos.titulo || 'Sin título'}`,
        metadata: {
          accion: 'actividad_creada',
          actividad_id: actividad.id,
          titulo: actividad.titulo || datos.titulo,
        },
      }),
    })

    setModalActividad(false)
    await cargar()
  }

  // Detectar mensajes del portal
  const hayMensajesPortal = entradas.some(e => e.metadata?.portal && e.autor_id === 'portal')

  // Vínculo inicial para el modal de actividad
  const vinculoInicialActividad = useMemo(() => {
    if (!contacto?.id || !contacto?.nombre) return null
    return {
      tipo: 'contacto',
      id: contacto.id,
      nombre: contacto.nombre,
    }
  }, [contacto?.id, contacto?.nombre])

  // WhatsApp siempre habilitado — el modal valida si hay número/conversación
  const tieneWhatsApp = true

  const esLateral = modo === 'lateral'
  const totalAdjuntos = adjuntosChatter.length + adjuntosDocumento.length

  return (
    <>
      <div className={`flex flex-col bg-superficie-tarjeta border border-borde-sutil rounded-xl overflow-hidden ${
        esLateral ? 'h-full' : ''
      } ${className}`}>
        {/* ─── Header ─── */}
        <div className="px-3 py-2 border-b border-borde-sutil flex items-center gap-2">
          <div className="flex items-center gap-1.5 min-w-0">
            <MessageSquare size={14} className="text-texto-secundario shrink-0" />
            <span className="text-sm font-semibold text-texto-primario">Actividad</span>
            {entradas.length > 0 && (
              <span className="text-[10px] text-texto-terciario bg-superficie-hover px-1.5 py-0.5 rounded-full">
                {entradas.length}
              </span>
            )}
          </div>

          <div className="flex-1" />

          <div className="flex items-center gap-0.5">
            {/* Adjuntos (ícono + badge) */}
            {totalAdjuntos > 0 && (
              <button
                onClick={() => {
                  if (colapsado) setColapsado(false)
                  setAdjuntosExpandidos(!adjuntosExpandidos)
                }}
                className={`relative p-1.5 rounded-md transition-colors ${
                  adjuntosExpandidos ? 'bg-texto-marca/10 text-texto-marca' : 'text-texto-terciario hover:text-texto-secundario hover:bg-superficie-hover'
                }`}
                title={`${totalAdjuntos} adjunto${totalAdjuntos > 1 ? 's' : ''}`}
              >
                <Paperclip size={14} />
                <span className="absolute -top-0.5 -right-0.5 text-[8px] font-bold bg-texto-marca text-blanco size-3.5 rounded-full flex items-center justify-center">
                  {totalAdjuntos}
                </span>
              </button>
            )}

            {/* Buscar */}
            <button
              onClick={() => {
                if (colapsado) setColapsado(false)
                setMostrarBusqueda(!mostrarBusqueda)
                if (mostrarBusqueda) setBusqueda('')
              }}
              className={`p-1.5 rounded-md transition-colors ${
                mostrarBusqueda ? 'bg-texto-marca/10 text-texto-marca' : 'text-texto-terciario hover:text-texto-secundario hover:bg-superficie-hover'
              }`}
              title="Buscar en actividad"
            >
              <Search size={14} />
            </button>

            {/* Menú tres puntos */}
            <Popover
              alineacion="fin"
              ancho={240}
              contenido={
                <MenuChatter
                  colapsado={colapsado}
                  onColapsar={() => { setColapsado(!colapsado); setMenuAbierto(false) }}
                  seccion={seccion}
                  sinLateral={sinLateral}
                  onCambiarSinLateral={onCambiarSinLateral}
                  onCerrar={() => setMenuAbierto(false)}
                />
              }
              abierto={menuAbierto}
              onCambio={setMenuAbierto}
            >
              <button
                className="p-1.5 rounded-md text-texto-terciario hover:text-texto-secundario hover:bg-superficie-hover transition-colors"
                title="Opciones"
              >
                <MoreVertical size={14} />
              </button>
            </Popover>
          </div>
        </div>

        {/* ─── Contenido colapsable ─── */}
        <AnimatePresence initial={false}>
          {!colapsado && (
            <motion.div
              initial={{ height: 0 }}
              animate={{ height: 'auto' }}
              exit={{ height: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              {/* ─── Barra de acciones ─── */}
              <BarraAcciones
                onCorreo={onAbrirCorreo}
                onWhatsApp={() => setModalWhatsApp(true)}
                onNota={() => setModoNota(!modoNota)}
                onActividad={abrirActividad}
                tieneCorreo={!!onAbrirCorreo}
                tieneWhatsApp={tieneWhatsApp}
                tieneActividad={true}
              />

              {/* ─── Búsqueda ─── */}
              <AnimatePresence>
                {mostrarBusqueda && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.15 }}
                    className="overflow-hidden"
                  >
                    <div className="px-3 py-2 border-b border-borde-sutil">
                      <div className="flex items-center gap-2 bg-superficie-app rounded-lg px-2.5 py-1.5 border border-borde-sutil focus-within:border-texto-marca/40 transition-colors">
                        <Search size={13} className="text-texto-terciario shrink-0" />
                        <input
                          type="text"
                          value={busqueda}
                          onChange={e => setBusqueda(e.target.value)}
                          placeholder="Buscar en actividad..."
                          className="flex-1 text-xs bg-transparent outline-none text-texto-primario placeholder:text-texto-terciario"
                          autoFocus
                        />
                        {busqueda && (
                          <button onClick={() => setBusqueda('')} className="text-texto-terciario hover:text-texto-secundario">
                            <X size={12} />
                          </button>
                        )}
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* ─── Filtros ─── */}
              <div className="flex gap-0.5 px-3 py-1.5 border-b border-borde-sutil overflow-x-auto scrollbar-none">
                {FILTROS.map(f => {
                  const esActivo = filtro === f.clave
                  const count = contadores[f.clave]
                  return (
                    <button
                      key={f.clave}
                      onClick={() => setFiltro(f.clave)}
                      className={`flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium transition-colors shrink-0 ${
                        esActivo
                          ? 'bg-texto-marca/10 text-texto-marca'
                          : 'text-texto-terciario hover:text-texto-secundario hover:bg-superficie-hover'
                      }`}
                    >
                      {f.etiqueta}
                      {count > 0 && (
                        <span className={`text-[9px] px-1 py-px rounded-full ${
                          esActivo ? 'bg-texto-marca/20 text-texto-marca' : 'bg-superficie-hover text-texto-terciario'
                        }`}>
                          {count}
                        </span>
                      )}
                    </button>
                  )
                })}
              </div>

              {/* ─── Sección de adjuntos (controlada desde header) ─── */}
              {adjuntosExpandidos && (
                <SeccionAdjuntos
                  adjuntos={adjuntosChatter}
                  adjuntosDocumento={adjuntosDocumento}
                  forzarExpandido
                />
              )}

              {/* ─── Editor de nota rica ─── */}
              <AnimatePresence>
                {modoNota && (
                  <div className="px-3 pt-3 pb-1">
                    <EditorNota
                      entidadTipo={entidadTipo}
                      entidadId={entidadId}
                      onEnviado={() => {
                        setModoNota(false)
                        cargar()
                      }}
                      onCancelar={() => setModoNota(false)}
                    />
                  </div>
                )}
              </AnimatePresence>

              {/* ─── Timeline ─── */}
              <div
                ref={scrollRef}
                className={`flex-1 overflow-y-auto px-3 py-2 space-y-0.5 min-h-[100px] ${
                  esLateral ? '' : 'max-h-[450px]'
                }`}
              >
                {cargando ? (
                  <div className="flex items-center justify-center h-20 text-texto-terciario">
                    <Loader2 size={18} className="animate-spin" />
                  </div>
                ) : entradasFiltradas.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-20 text-texto-terciario text-xs">
                    <MessageSquare size={20} className="mb-1 opacity-40" />
                    {busqueda ? 'Sin resultados' : filtro !== 'todo' ? `Sin ${FILTROS.find(f => f.clave === filtro)?.etiqueta.toLowerCase()}` : 'Sin actividad'}
                  </div>
                ) : (
                  entradasFiltradas.map(entrada => (
                    <EntradaTimeline
                      key={entrada.id}
                      entrada={entrada}
                      entidadTipo={entidadTipo}
                      entidadId={entidadId}
                      onAccionComprobante={accionComprobante}
                      onRecargar={cargar}
                    />
                  ))
                )}
              </div>

              {/* ─── Input rápido ─── */}
              <div className="px-3 py-2.5 border-t border-borde-sutil">
                {entidadTipo === 'presupuesto' && hayMensajesPortal && (
                  <button
                    onClick={() => {
                      setModoRespuestaPortal(!modoRespuestaPortal)
                      inputRef.current?.focus()
                    }}
                    className={`flex items-center gap-1 text-xs mb-2 transition-colors rounded ${
                      modoRespuestaPortal
                        ? 'text-texto-marca font-medium'
                        : 'text-texto-terciario hover:text-texto-secundario'
                    }`}
                  >
                    <Reply size={12} />
                    {modoRespuestaPortal ? 'Respondiendo al cliente (portal)' : 'Responder al cliente'}
                  </button>
                )}

                <div className="flex gap-2 items-end">
                  <TextArea
                    ref={inputRef}
                    value={mensaje}
                    onChange={e => setMensaje(e.target.value)}
                    enviarConEnter
                    onEnviar={enviarMensaje}
                    placeholder={modoRespuestaPortal
                      ? 'Mensaje para el cliente (visible en portal)...'
                      : 'Escribí un mensaje rápido...'
                    }
                    rows={1}
                  />
                  <Boton
                    variante="primario"
                    tamano="sm"
                    soloIcono
                    titulo="Enviar"
                    icono={<Send size={16} />}
                    onClick={enviarMensaje}
                    disabled={!mensaje.trim() || enviando}
                    cargando={enviando}
                  />
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ─── Modal WhatsApp (self-contained) ─── */}
      <ModalWhatsAppChatter
        abierto={modalWhatsApp}
        onCerrar={() => setModalWhatsApp(false)}
        contacto={contacto}
        entidadTipo={entidadTipo}
        entidadId={entidadId}
        tipoDocumento={tipoDocumento}
        datosDocumento={datosDocumento}
        onEnviado={cargar}
      />

      {/* ─── Modal Actividad (self-contained) ─── */}
      {configActividades && (
        <ModalActividad
          abierto={modalActividad}
          tipos={configActividades.tipos as never[]}
          estados={configActividades.estados as never[]}
          miembros={configActividades.miembros}
          vinculoInicial={vinculoInicialActividad}
          onGuardar={crearActividad}
          onCerrar={() => setModalActividad(false)}
        />
      )}
    </>
  )
}

// ─── Etiquetas de secciones para el menú ───
const ETIQUETAS_SECCION: Record<string, string> = {
  presupuestos: 'Presupuestos',
  facturas: 'Facturas',
  ordenes: 'Órdenes',
  contactos: 'Contactos',
  productos: 'Productos',
  actividades: 'Actividades',
  visitas: 'Visitas',
}

// ─── Menú de opciones del chatter ───
function MenuChatter({
  colapsado,
  onColapsar,
  seccion,
  sinLateral,
  onCambiarSinLateral,
  onCerrar,
}: {
  colapsado: boolean
  onColapsar: () => void
  seccion?: string
  sinLateral: string[]
  onCambiarSinLateral?: (sinLateral: string[]) => void
  onCerrar: () => void
}) {
  const globalDesactivado = sinLateral.includes('*')
  const seccionDesactivada = seccion ? sinLateral.includes(seccion) : false
  const etiquetaSeccion = seccion ? (ETIQUETAS_SECCION[seccion] || seccion) : ''

  const toggleSeccion = () => {
    if (!onCambiarSinLateral || !seccion) return
    if (seccionDesactivada) {
      // Reactivar esta sección
      onCambiarSinLateral(sinLateral.filter(s => s !== seccion))
    } else {
      // Desactivar esta sección (quitar global si estaba)
      onCambiarSinLateral([...sinLateral.filter(s => s !== '*'), seccion])
    }
    onCerrar()
  }

  const toggleGlobal = () => {
    if (!onCambiarSinLateral) return
    if (globalDesactivado) {
      // Reactivar todas
      onCambiarSinLateral([])
    } else {
      // Desactivar todas
      onCambiarSinLateral(['*'])
    }
    onCerrar()
  }

  const btnClase = 'w-full flex items-center gap-2.5 px-3 py-2 text-[13px] text-texto-primario hover:bg-superficie-hover transition-colors text-left'

  return (
    <div className="py-1">
      {/* Colapsar / Expandir */}
      <button onClick={onColapsar} className={btnClase}>
        {colapsado ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
        {colapsado ? 'Expandir panel' : 'Colapsar panel'}
      </button>

      {/* Opciones de lateral (solo si hay callback) */}
      {onCambiarSinLateral && (
        <>
          <div className="h-px bg-borde-sutil mx-2 my-1" />
          <p className="px-3 py-1.5 text-[10px] font-semibold text-texto-terciario uppercase tracking-wider">
            Panel lateral
          </p>

          {/* Solo en esta sección */}
          {seccion && (
            <button onClick={toggleSeccion} className={btnClase}>
              <span className="size-4 flex items-center justify-center shrink-0">
                {(seccionDesactivada || globalDesactivado) && <Check size={13} className="text-texto-marca" />}
              </span>
              <span>No anclar en {etiquetaSeccion}</span>
            </button>
          )}

          {/* En todas las secciones */}
          <button onClick={toggleGlobal} className={btnClase}>
            <span className="size-4 flex items-center justify-center shrink-0">
              {globalDesactivado && <Check size={13} className="text-texto-marca" />}
            </span>
            <span>No anclar en ninguna sección</span>
          </button>
        </>
      )}
    </div>
  )
}
