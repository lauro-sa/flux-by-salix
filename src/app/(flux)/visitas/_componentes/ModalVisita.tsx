'use client'

import { useState, useEffect, useCallback } from 'react'
import { ModalAdaptable as Modal } from '@/componentes/ui/ModalAdaptable'
import { Input } from '@/componentes/ui/Input'
import { Boton } from '@/componentes/ui/Boton'
import { Select } from '@/componentes/ui/Select'
import { TextArea } from '@/componentes/ui/TextArea'
import { SelectorFecha } from '@/componentes/ui/SelectorFecha'
import { SelectorHora } from '@/componentes/ui/SelectorHora'
import {
  Plus, Trash2, X, Check, MapPin, Clock,
  CheckCircle, Navigation, User, PenLine,
} from 'lucide-react'
import { useFormato } from '@/hooks/useFormato'
import { crearClienteNavegador } from '@/lib/supabase/cliente'
import { useTraduccion } from '@/lib/i18n'
import { SelectorContacto, type ContactoResultado, type ContactoSeleccionado } from '@/componentes/entidad/SelectorContacto'
import { SeccionDirecciones } from './SeccionDirecciones'

/**
 * ModalVisita — Modal para crear o editar una visita.
 * Campos: contacto, dirección, asignado, fecha/hora, motivo, prioridad, checklist, notas.
 */

// ── Tipos centralizados — re-exportados para compatibilidad ──
import type {
  Visita,
  MiembroVisitador as Miembro,
  ConfigVisitas,
  ItemChecklist,
} from '@/tipos/visita'

export type { Visita, Miembro, ConfigVisitas, ItemChecklist }

interface PropiedadesModal {
  abierto: boolean
  visita?: Visita | null
  miembros: Miembro[]
  config?: ConfigVisitas | null
  onGuardar: (datos: Record<string, unknown>) => Promise<unknown>
  onCompletar?: (id: string) => Promise<void>
  onCancelar?: (id: string) => Promise<void>
  onCerrar: () => void
}

// ── Tipos internos ──

interface Direccion {
  id: string
  texto: string | null
  tipo: string | null
  es_principal: boolean
  lat: number | null
  lng: number | null
  total_visitas: number
  ultima_visita: string | null
}

interface ContactoVinculado {
  id: string
  vinculado_id: string
  nombre: string
  apellido: string | null
  telefono: string | null
  puesto: string | null
  tipo_clave: string | null
}

function ModalVisita({
  abierto,
  visita,
  miembros,
  config,
  onGuardar,
  onCompletar,
  onCancelar,
  onCerrar,
}: PropiedadesModal) {
  const formato = useFormato()
  const { t } = useTraduccion()
  const esEdicion = !!visita

  // ── Estado del formulario ──
  const [contactoId, setContactoId] = useState('')
  const [contactoNombre, setContactoNombre] = useState('')
  const [direccionId, setDireccionId] = useState<string | null>(null)
  const [direccionTexto, setDireccionTexto] = useState('')
  const [direccionLat, setDireccionLat] = useState<number | null>(null)
  const [direccionLng, setDireccionLng] = useState<number | null>(null)
  const [asignadoA, setAsignadoA] = useState<string | null>(null)
  const [asignadoNombre, setAsignadoNombre] = useState<string | null>(null)
  const [fechaProgramada, setFechaProgramada] = useState('')
  const [horaProgramada, setHoraProgramada] = useState('')
  const [duracionEstimada, setDuracionEstimada] = useState(30)
  const [motivo, setMotivo] = useState('')
  const [prioridad, setPrioridad] = useState('normal')
  const [checklist, setChecklist] = useState<ItemChecklist[]>([])
  const [notas, setNotas] = useState('')
  const [recibeNombre, setRecibeNombre] = useState('')
  const [recibeTelefono, setRecibeTelefono] = useState('')
  const [recibeContactoId, setRecibeContactoId] = useState<string | null>(null)
  const [recibeModoManual, setRecibeModoManual] = useState(false)
  const [recibeContactoSeleccionado, setRecibeContactoSeleccionado] = useState<ContactoSeleccionado | null>(null)
  const [guardando, setGuardando] = useState(false)

  // ── Contactos vinculados al contacto de la visita ──
  const [vinculados, setVinculados] = useState<ContactoVinculado[]>([])
  const [cargandoVinculados, setCargandoVinculados] = useState(false)

  // ── Estado del contacto seleccionado para SelectorContacto ──
  const [contactoSeleccionado, setContactoSeleccionado] = useState<ContactoSeleccionado | null>(null)

  // ── Direcciones del contacto seleccionado ──
  const [direcciones, setDirecciones] = useState<Direccion[]>([])
  const [cargandoDirecciones, setCargandoDirecciones] = useState(false)

  // ── Inicializar campos ──
  useEffect(() => {
    if (!abierto) return
    if (visita) {
      setContactoId(visita.contacto_id)
      setContactoNombre(visita.contacto_nombre)
      setContactoSeleccionado({
        id: visita.contacto_id,
        nombre: visita.contacto_nombre,
        apellido: null,
        correo: null,
        telefono: null,
        tipo_contacto: null,
        numero_identificacion: null,
        condicion_iva: null,
        direccion: visita.direccion_texto,
      })
      setDireccionId(visita.direccion_id)
      setDireccionTexto(visita.direccion_texto || '')
      setDireccionLat(visita.direccion_lat)
      setDireccionLng(visita.direccion_lng)
      setAsignadoA(visita.asignado_a)
      setAsignadoNombre(visita.asignado_nombre)
      const fecha = new Date(visita.fecha_programada)
      setFechaProgramada(fecha.toISOString().split('T')[0])
      setHoraProgramada(fecha.toTimeString().slice(0, 5))
      setDuracionEstimada(visita.duracion_estimada_min || 30)
      setMotivo(visita.motivo || '')
      setPrioridad(visita.prioridad || 'normal')
      setChecklist(visita.checklist || [])
      setNotas(visita.notas || '')
      setRecibeNombre(visita.recibe_nombre || '')
      setRecibeTelefono(visita.recibe_telefono || '')
      setRecibeContactoId(visita.recibe_contacto_id || null)
      setRecibeModoManual(!visita.recibe_contacto_id && !!(visita.recibe_nombre || visita.recibe_telefono))
      // Si tiene recibe_contacto_id, montar el contacto seleccionado para el SelectorContacto
      if (visita.recibe_contacto_id && visita.recibe_nombre) {
        setRecibeContactoSeleccionado({
          id: visita.recibe_contacto_id,
          nombre: visita.recibe_nombre,
          apellido: null,
          correo: null,
          telefono: visita.recibe_telefono,
          tipo_contacto: null,
          numero_identificacion: null,
          condicion_iva: null,
          direccion: null,
        })
      } else {
        setRecibeContactoSeleccionado(null)
      }
    } else {
      // Modo creación — limpiar todo
      setContactoId('')
      setContactoNombre('')
      setContactoSeleccionado(null)
      setDireccionId(null)
      setDireccionTexto('')
      setDireccionLat(null)
      setDireccionLng(null)
      setAsignadoA(null)
      setAsignadoNombre(null)
      const manana = new Date()
      manana.setDate(manana.getDate() + 1)
      setFechaProgramada(manana.toISOString().split('T')[0])
      setHoraProgramada('09:00')
      setDuracionEstimada(config?.duracion_estimada_default || 30)
      setMotivo('')
      setPrioridad('normal')
      setChecklist(config?.checklist_predeterminado || [])
      setNotas('')
      setRecibeNombre('')
      setRecibeTelefono('')
      setRecibeContactoId(null)
      setRecibeModoManual(false)
      setRecibeContactoSeleccionado(null)
    }
  }, [abierto, visita, config])

  // ── Manejar selección de contacto desde SelectorContacto ──
  const manejarSeleccionContacto = useCallback((c: ContactoResultado | null) => {
    if (!c) {
      setContactoId('')
      setContactoNombre('')
      setContactoSeleccionado(null)
      setDireccionId(null)
      setDireccionTexto('')
      setDireccionLat(null)
      setDireccionLng(null)
      setDirecciones([])
      setVinculados([])
      limpiarReceptor()
      return
    }
    setContactoId(c.id)
    const nombre = `${c.nombre}${c.apellido ? ` ${c.apellido}` : ''}`.trim()
    setContactoNombre(nombre)
    setContactoSeleccionado({
      id: c.id,
      nombre: c.nombre,
      apellido: c.apellido,
      correo: c.correo,
      telefono: c.telefono,
      whatsapp: c.whatsapp,
      tipo_contacto: c.tipo_contacto,
      numero_identificacion: c.numero_identificacion,
      condicion_iva: c.condicion_iva,
      direccion: c.direcciones?.[0]?.texto || null,
      direcciones: c.direcciones,
    })
    // Reset dirección para que se auto-seleccione con el useEffect
    setDireccionId(null)
    setDireccionTexto('')
    setDireccionLat(null)
    setDireccionLng(null)
  }, [])

  // ── Cargar direcciones del contacto seleccionado ──
  useEffect(() => {
    if (!contactoId) {
      setDirecciones([])
      return
    }
    setCargandoDirecciones(true)
    const supabase = crearClienteNavegador()
    supabase
      .from('contacto_direcciones')
      .select('id, texto, tipo, es_principal, lat, lng, total_visitas, ultima_visita')
      .eq('contacto_id', contactoId)
      .order('es_principal', { ascending: false })
      .then(({ data }) => {
        setDirecciones(data || [])
        // Auto-seleccionar la primera si no hay selección
        if (data?.length && !direccionId) {
          const primera = data[0]
          setDireccionId(primera.id)
          setDireccionTexto(primera.texto || '')
          setDireccionLat(primera.lat)
          setDireccionLng(primera.lng)
        }
        setCargandoDirecciones(false)
      })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contactoId])

  // ── Cargar contactos vinculados al contacto seleccionado ──
  useEffect(() => {
    if (!contactoId) {
      setVinculados([])
      return
    }
    setCargandoVinculados(true)
    const supabase = crearClienteNavegador()
    // Buscar vinculaciones donde este contacto es el dueño
    supabase
      .from('contacto_vinculaciones')
      .select(`
        id,
        vinculado_id,
        puesto,
        contacto_vinculado:contactos!contacto_vinculaciones_vinculado_id_fkey (
          nombre, apellido, telefono,
          tipo_contacto:tipos_contacto ( clave )
        )
      `)
      .eq('contacto_id', contactoId)
      .then(({ data }) => {
        if (data) {
          const mapeados: ContactoVinculado[] = data
            .filter((v: Record<string, unknown>) => v.contacto_vinculado)
            .map((v: Record<string, unknown>) => {
              const cv = v.contacto_vinculado as Record<string, unknown>
              const tipo = cv.tipo_contacto as Record<string, unknown> | null
              return {
                id: v.id as string,
                vinculado_id: v.vinculado_id as string,
                nombre: cv.nombre as string,
                apellido: (cv.apellido as string) || null,
                telefono: (cv.telefono as string) || null,
                puesto: (v.puesto as string) || null,
                tipo_clave: tipo?.clave as string || null,
              }
            })
          setVinculados(mapeados)
        } else {
          setVinculados([])
        }
        setCargandoVinculados(false)
      })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contactoId])

  // ── Manejar selección de contacto como receptor ──
  const manejarSeleccionReceptor = useCallback((c: ContactoResultado | null) => {
    if (!c) {
      setRecibeContactoId(null)
      setRecibeNombre('')
      setRecibeTelefono('')
      setRecibeContactoSeleccionado(null)
      return
    }
    const nombre = `${c.nombre}${c.apellido ? ` ${c.apellido}` : ''}`.trim()
    setRecibeContactoId(c.id)
    setRecibeNombre(nombre)
    setRecibeTelefono(c.telefono || '')
    setRecibeContactoSeleccionado({
      id: c.id,
      nombre: c.nombre,
      apellido: c.apellido,
      correo: c.correo,
      telefono: c.telefono,
      tipo_contacto: c.tipo_contacto,
      numero_identificacion: null,
      condicion_iva: null,
      direccion: null,
    })
    setRecibeModoManual(false)
  }, [])

  // Seleccionar vinculado directamente (sin pasar por SelectorContacto)
  const seleccionarReceptorVinculado = (v: ContactoVinculado) => {
    const nombre = `${v.nombre}${v.apellido ? ` ${v.apellido}` : ''}`.trim()
    setRecibeContactoId(v.vinculado_id)
    setRecibeNombre(nombre)
    setRecibeTelefono(v.telefono || '')
    setRecibeContactoSeleccionado({
      id: v.vinculado_id,
      nombre: v.nombre,
      apellido: v.apellido,
      correo: null,
      telefono: v.telefono,
      tipo_contacto: null,
      numero_identificacion: null,
      condicion_iva: null,
      direccion: null,
    })
    setRecibeModoManual(false)
  }

  const limpiarReceptor = () => {
    setRecibeContactoId(null)
    setRecibeNombre('')
    setRecibeTelefono('')
    setRecibeContactoSeleccionado(null)
    setRecibeModoManual(false)
  }

  // ── Seleccionar dirección ──
  const seleccionarDireccion = (dir: Direccion) => {
    setDireccionId(dir.id)
    setDireccionTexto(dir.texto || '')
    setDireccionLat(dir.lat)
    setDireccionLng(dir.lng)
  }

  // ── Checklist ──
  const agregarItemChecklist = () => {
    setChecklist(prev => [...prev, { id: crypto.randomUUID(), texto: '', completado: false }])
  }
  const actualizarItemChecklist = (id: string, texto: string) => {
    setChecklist(prev => prev.map(item => item.id === id ? { ...item, texto } : item))
  }
  const toggleItemChecklist = (id: string) => {
    setChecklist(prev => prev.map(item => item.id === id ? { ...item, completado: !item.completado } : item))
  }
  const eliminarItemChecklist = (id: string) => {
    setChecklist(prev => prev.filter(item => item.id !== id))
  }

  // ── Guardar ──
  const manejarGuardar = async () => {
    if (!contactoId || !fechaProgramada) return
    setGuardando(true)
    try {
      const fechaCompleta = new Date(`${fechaProgramada}T${horaProgramada || '09:00'}:00`).toISOString()
      await onGuardar({
        ...(esEdicion ? { id: visita!.id } : {}),
        contacto_id: contactoId,
        contacto_nombre: contactoNombre,
        direccion_id: direccionId,
        direccion_texto: direccionTexto || null,
        direccion_lat: direccionLat,
        direccion_lng: direccionLng,
        asignado_a: asignadoA,
        asignado_nombre: asignadoNombre,
        fecha_programada: fechaCompleta,
        duracion_estimada_min: duracionEstimada,
        motivo: motivo || null,
        prioridad,
        checklist: checklist.filter(c => c.texto.trim()),
        notas: notas || null,
        recibe_nombre: recibeNombre || null,
        recibe_telefono: recibeTelefono || null,
        recibe_contacto_id: recibeContactoId || null,
      })
      onCerrar()
    } finally {
      setGuardando(false)
    }
  }

  const esActiva = visita && !['completada', 'cancelada'].includes(visita.estado)

  return (
    <Modal
      abierto={abierto}
      onCerrar={onCerrar}
      titulo={esEdicion ? `Visita — ${contactoNombre}` : t('visitas.nueva')}
      tamano="5xl"
      sinPadding
      alturaMovil="completo"
      acciones={
        <div className="flex items-center gap-2 px-6 py-3">
          <Boton variante="fantasma" onClick={onCerrar}>
            {t('comun.cancelar')}
          </Boton>
          <Boton
            onClick={manejarGuardar}
            cargando={guardando}
            disabled={!contactoId || !fechaProgramada}
          >
            {esEdicion ? t('comun.guardar') : t('visitas.nueva')}
          </Boton>
        </div>
      }
    >
      {/* Acciones rápidas en edición */}
      {esEdicion && visita && esActiva && (
        <div className="flex flex-wrap gap-2 px-7 py-3 border-b border-white/[0.07]">
          {onCompletar && (
            <Boton
              variante="fantasma"
              tamano="sm"
              onClick={() => { onCompletar(visita.id); onCerrar() }}
            >
              <CheckCircle size={14} className="mr-1.5" />
              {t('visitas.completar')}
            </Boton>
          )}
          {onCancelar && (
            <Boton
              variante="fantasma"
              tamano="sm"
              onClick={() => { onCancelar(visita.id); onCerrar() }}
            >
              <X size={14} className="mr-1.5" />
              {t('visitas.cancelar_visita')}
            </Boton>
          )}
        </div>
      )}

      {/* Grid 2 columnas */}
      <div className="grid grid-cols-1 md:grid-cols-[1fr_1px_1fr] gap-0 border-y border-white/[0.07] overflow-y-auto max-h-[calc(100dvh-200px)]">
        {/* ── COLUMNA IZQUIERDA ── */}
        <div className="space-y-0">
          {/* Contacto — SelectorContacto reutilizable */}
          <div className="px-6 py-4 border-b border-white/[0.07]">
            <label className="text-[11px] font-medium text-texto-terciario uppercase tracking-wider mb-2 block">
              {t('visitas.contacto')}
            </label>
            <SelectorContacto
              contacto={contactoSeleccionado}
              onChange={manejarSeleccionContacto}
              sinAlertaCorreo
              sinDatosFiscales
              soloLectura={esEdicion}
              placeholder={t('visitas.buscar_contacto') + '...'}
            />
          </div>

          {/* Dirección — con contadores de visitas */}
          {contactoId && (
            <div className="px-6 py-4 border-b border-white/[0.07]">
              <label className="text-[11px] font-medium text-texto-terciario uppercase tracking-wider mb-2 block">
                {t('visitas.direccion')}
              </label>
              <SeccionDirecciones
                direcciones={direcciones}
                direccionId={direccionId}
                cargando={cargandoDirecciones}
                onSeleccionar={seleccionarDireccion}
              />
            </div>
          )}

          {/* Motivo */}
          <div className="px-6 py-4 border-b border-white/[0.07]">
            <label className="text-[11px] font-medium text-texto-terciario uppercase tracking-wider mb-2 block">
              {t('visitas.motivo')}
            </label>
            {config?.motivos_predefinidos && config.motivos_predefinidos.length > 0 ? (
              <Select
                valor={motivo}
                onChange={setMotivo}
                opciones={[
                  { valor: '', etiqueta: t('visitas.seleccionar_motivo') },
                  ...config.motivos_predefinidos.map(m => ({ valor: m, etiqueta: m })),
                  { valor: '__otro', etiqueta: t('visitas.otro_texto_libre') },
                ]}
                placeholder={t('visitas.seleccionar_motivo')}
              />
            ) : (
              <Input
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
                placeholder="Ej: visita comercial, soporte técnico..."
              />
            )}
            {motivo === '__otro' && (
              <Input
                value=""
                onChange={(e) => setMotivo(e.target.value)}
                placeholder={t('visitas.escribir_motivo')}
                className="mt-2"
              />
            )}
          </div>

          {/* Recibe — quien recibe al visitador (opcional) */}
          {contactoId && (
            <div className="px-6 py-4 border-b border-white/[0.07]">
              <label className="text-[11px] font-medium text-texto-terciario uppercase tracking-wider mb-2 block">
                {t('visitas.recibe_opcional')}
              </label>
              <p className="text-xs text-texto-terciario mb-3">{t('visitas.recibe_desc')}</p>

              {recibeModoManual ? (
                /* ── Modo manual: inputs libres ── */
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <Input
                      value={recibeNombre}
                      onChange={(e) => { setRecibeNombre(e.target.value); setRecibeContactoId(null); setRecibeContactoSeleccionado(null) }}
                      placeholder="Nombre"
                    />
                    <Input
                      value={recibeTelefono}
                      onChange={(e) => { setRecibeTelefono(e.target.value); setRecibeContactoId(null); setRecibeContactoSeleccionado(null) }}
                      placeholder="Teléfono"
                    />
                  </div>
                  <button
                    onClick={() => { limpiarReceptor() }}
                    className="text-xs text-texto-marca hover:text-texto-marca/80 transition-colors flex items-center gap-1"
                  >
                    <User size={12} />
                    {t('visitas.buscar_contacto')}
                  </button>
                </div>
              ) : (
                /* ── Modo buscador: vinculados + SelectorContacto ── */
                <div className="space-y-3">
                  {/* Sugerencias rápidas: contactos vinculados */}
                  {!recibeContactoSeleccionado && vinculados.length > 0 && !cargandoVinculados && (
                    <div>
                      <span className="text-[10px] font-medium text-texto-terciario uppercase tracking-wider">{t('visitas.vinculados')}</span>
                      <div className="flex flex-wrap gap-1.5 mt-1.5">
                        {vinculados.map(v => {
                          const nombre = `${v.nombre}${v.apellido ? ` ${v.apellido}` : ''}`.trim()
                          return (
                            <button
                              key={v.id}
                              onClick={() => seleccionarReceptorVinculado(v)}
                              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-white/[0.06] bg-white/[0.03] text-xs text-texto-secundario hover:bg-white/[0.06] hover:border-texto-marca/30 transition-colors"
                            >
                              <User size={11} className="text-texto-terciario" />
                              <span>{nombre}</span>
                              {v.puesto && (
                                <span className="text-xxs text-texto-terciario">· {v.puesto}</span>
                              )}
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  )}

                  {/* SelectorContacto para buscar cualquier contacto */}
                  <SelectorContacto
                    contacto={recibeContactoSeleccionado}
                    onChange={manejarSeleccionReceptor}
                    sinAlertaCorreo
                    sinDatosFiscales
                    placeholder={t('visitas.buscar_contacto_recibe')}
                  />

                  {/* Opción cargar a mano */}
                  {!recibeContactoSeleccionado && (
                    <button
                      onClick={() => { limpiarReceptor(); setRecibeModoManual(true) }}
                      className="text-xs text-texto-terciario hover:text-texto-secundario transition-colors flex items-center gap-1"
                    >
                      <PenLine size={12} />
                      {t('visitas.cargar_a_mano')}
                    </button>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Notas */}
          <div className="px-6 py-4">
            <label className="text-[11px] font-medium text-texto-terciario uppercase tracking-wider mb-2 block">
              {t('visitas.notas')}
            </label>
            <TextArea
              value={notas}
              onChange={(e) => setNotas(e.target.value)}
              placeholder="Notas adicionales..."
              rows={3}
            />
          </div>
        </div>

        {/* DIVISOR */}
        <div className="hidden md:block bg-white/[0.07]" />

        {/* ── COLUMNA DERECHA ── */}
        <div className="space-y-0 md:min-w-[280px]">
          {/* Asignado a */}
          <div className="px-6 py-4 border-b border-white/[0.07]">
            <label className="text-[11px] font-medium text-texto-terciario uppercase tracking-wider mb-2 block">
              {t('visitas.asignado')}
            </label>
            <Select
              valor={asignadoA || ''}
              onChange={(v) => {
                setAsignadoA(v || null)
                const m = miembros.find(m => m.usuario_id === v)
                setAsignadoNombre(m ? `${m.nombre} ${m.apellido}`.trim() : null)
              }}
              opciones={[
                { valor: '', etiqueta: t('visitas.sin_asignar_select') },
                ...miembros.map(m => ({
                  valor: m.usuario_id,
                  etiqueta: `${m.nombre} ${m.apellido}`.trim(),
                })),
              ]}
              placeholder="Seleccionar responsable"
            />
          </div>

          {/* Fecha + Hora + Duración */}
          <div className="px-6 py-4 border-b border-white/[0.07]">
            <label className="text-[11px] font-medium text-texto-terciario uppercase tracking-wider mb-2 block">
              {t('visitas.fecha_programada')}
            </label>
            <div className="grid grid-cols-2 gap-3">
              <SelectorFecha
                valor={fechaProgramada}
                onChange={(v) => setFechaProgramada(v || '')}
              />
              <SelectorHora
                valor={horaProgramada}
                onChange={(v) => setHoraProgramada(v || '')}
              />
            </div>
            <div className="mt-3">
              <label className="text-[11px] font-medium text-texto-terciario uppercase tracking-wider mb-1.5 block">
                {t('visitas.duracion_estimada')} (min)
              </label>
              <div className="flex items-center gap-2">
                <Clock size={14} className="text-texto-terciario" />
                <input
                  type="number"
                  value={duracionEstimada}
                  onChange={(e) => setDuracionEstimada(parseInt(e.target.value) || 30)}
                  min={5}
                  max={480}
                  className="w-20 px-2 py-1.5 rounded-lg border border-white/[0.06] bg-white/[0.03] text-sm text-texto-primario text-center focus:outline-none focus:ring-1 focus:ring-texto-marca/40"
                />
                <span className="text-xs text-texto-terciario">{t('visitas.minutos')}</span>
              </div>
            </div>
          </div>

          {/* Prioridad */}
          <div className="px-6 py-4 border-b border-white/[0.07]">
            <label className="text-[11px] font-medium text-texto-terciario uppercase tracking-wider mb-2 block">
              {t('visitas.prioridad')}
            </label>
            <div className="flex gap-1.5">
              {(['baja', 'normal', 'alta', 'urgente'] as const).map(p => (
                <button
                  key={p}
                  onClick={() => setPrioridad(p)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                    prioridad === p
                      ? p === 'urgente'
                        ? 'bg-insignia-peligro/15 border-insignia-peligro/40 text-insignia-peligro'
                        : p === 'alta'
                        ? 'bg-insignia-advertencia/15 border-insignia-advertencia/40 text-insignia-advertencia'
                        : 'bg-texto-marca/15 border-texto-marca/40 text-texto-marca'
                      : 'border-borde-sutil text-texto-terciario hover:bg-white/[0.04]'
                  }`}
                >
                  {t(`visitas.prioridades.${p}`)}
                </button>
              ))}
            </div>
          </div>

          {/* Checklist */}
          <div className="px-6 py-4">
            <div className="flex items-center justify-between mb-2">
              <label className="text-[11px] font-medium text-texto-terciario uppercase tracking-wider">
                {t('visitas.checklist')}
              </label>
              <button onClick={agregarItemChecklist} className="text-texto-marca hover:text-texto-marca/80">
                <Plus size={14} />
              </button>
            </div>
            {checklist.length > 0 ? (
              <div className="space-y-1">
                {checklist.map(item => (
                  <div key={item.id} className="flex items-center gap-2 group">
                    <button
                      onClick={() => toggleItemChecklist(item.id)}
                      className={`size-4 rounded border flex items-center justify-center flex-shrink-0 ${
                        item.completado
                          ? 'bg-texto-marca border-texto-marca'
                          : 'border-borde-fuerte hover:border-texto-marca/50'
                      }`}
                    >
                      {item.completado && <Check size={10} className="text-white" />}
                    </button>
                    <input
                      type="text"
                      value={item.texto}
                      onChange={(e) => actualizarItemChecklist(item.id, e.target.value)}
                      placeholder={t('visitas.nuevo_item')}
                      className={`flex-1 text-sm bg-transparent border-none outline-none ${
                        item.completado ? 'line-through text-texto-terciario' : 'text-texto-primario'
                      }`}
                    />
                    <button
                      onClick={() => eliminarItemChecklist(item.id)}
                      className="opacity-0 group-hover:opacity-100 text-texto-terciario hover:text-insignia-peligro transition-opacity"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-texto-terciario">{t('visitas.sin_items')}</p>
            )}
          </div>
        </div>
      </div>
    </Modal>
  )
}

export { ModalVisita }
