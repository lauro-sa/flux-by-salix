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
  CheckCircle, Navigation,
} from 'lucide-react'
import { useFormato } from '@/hooks/useFormato'
import { crearClienteNavegador } from '@/lib/supabase/cliente'
import { useTraduccion } from '@/lib/i18n'
import { SelectorContacto, type ContactoResultado, type ContactoSeleccionado } from '@/componentes/entidad/SelectorContacto'

/**
 * ModalVisita — Modal para crear o editar una visita.
 * Campos: contacto, dirección, asignado, fecha/hora, motivo, prioridad, checklist, notas.
 */

// ── Tipos exportados ──

export interface ItemChecklist {
  id: string
  texto: string
  completado: boolean
}

export interface Visita {
  id: string
  contacto_id: string
  contacto_nombre: string
  direccion_id: string | null
  direccion_texto: string | null
  direccion_lat: number | null
  direccion_lng: number | null
  asignado_a: string | null
  asignado_nombre: string | null
  fecha_programada: string
  fecha_inicio: string | null
  fecha_llegada: string | null
  fecha_completada: string | null
  duracion_estimada_min: number
  duracion_real_min: number | null
  estado: string
  motivo: string | null
  resultado: string | null
  notas: string | null
  prioridad: string
  checklist: ItemChecklist[]
  registro_lat: number | null
  registro_lng: number | null
  registro_precision_m: number | null
  actividad_id: string | null
  vinculos: { tipo: string; id: string; nombre: string }[]
  recibe_nombre: string | null
  recibe_telefono: string | null
  recibe_contacto_id: string | null
  en_papelera: boolean
  creado_por: string | null
  creado_por_nombre: string | null
  editado_por: string | null
  editado_por_nombre: string | null
  creado_en: string | null
  actualizado_en: string | null
}

export interface Miembro {
  usuario_id: string
  nombre: string
  apellido: string
}

interface ConfigVisitas {
  checklist_predeterminado?: ItemChecklist[]
  motivos_predefinidos?: string[]
  resultados_predefinidos?: string[]
  duracion_estimada_default?: number
}

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
  const [guardando, setGuardando] = useState(false)

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
              Completar
            </Boton>
          )}
          {onCancelar && (
            <Boton
              variante="fantasma"
              tamano="sm"
              onClick={() => { onCancelar(visita.id); onCerrar() }}
            >
              <X size={14} className="mr-1.5" />
              Cancelar visita
            </Boton>
          )}
        </div>
      )}

      {/* Grid 2 columnas */}
      <div className="grid grid-cols-1 md:grid-cols-[1fr_1px_1fr] gap-0 border-y border-white/[0.07] overflow-y-auto max-h-[calc(100vh-200px)]">
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
              placeholder="Buscar contacto..."
            />
          </div>

          {/* Dirección — con contadores de visitas */}
          {contactoId && (
            <div className="px-6 py-4 border-b border-white/[0.07]">
              <label className="text-[11px] font-medium text-texto-terciario uppercase tracking-wider mb-2 block">
                {t('visitas.direccion')}
              </label>
              {direcciones.length > 0 ? (
                <div className="space-y-1.5">
                  {direcciones.map(dir => {
                    const esSeleccionada = dir.id === direccionId
                    const tieneGps = dir.lat && dir.lng
                    return (
                      <button
                        key={dir.id}
                        onClick={() => seleccionarDireccion(dir)}
                        className={`w-full text-left px-3 py-2.5 rounded-lg border text-sm transition-colors ${
                          esSeleccionada
                            ? 'border-texto-marca/40 bg-texto-marca/10 text-texto-primario'
                            : 'border-white/[0.06] bg-white/[0.03] text-texto-secundario hover:bg-white/[0.06]'
                        }`}
                      >
                        <div className="flex items-start gap-2">
                          <MapPin size={14} className={`mt-0.5 shrink-0 ${esSeleccionada ? 'text-texto-marca' : 'text-texto-terciario'}`} />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="truncate">{dir.texto || 'Sin dirección'}</span>
                              {dir.tipo && (
                                <span className="text-xxs px-1.5 py-0.5 rounded bg-superficie-tarjeta border border-borde-sutil text-texto-terciario shrink-0">
                                  {dir.tipo === 'principal' ? 'Principal' : dir.tipo === 'fiscal' ? 'Fiscal' : dir.tipo === 'entrega' ? 'Entrega' : dir.tipo}
                                </span>
                              )}
                            </div>
                            {/* Contadores de visitas */}
                            <div className="flex items-center gap-3 mt-1">
                              {dir.total_visitas > 0 && (
                                <span className="text-xs text-texto-terciario">
                                  {dir.total_visitas} {dir.total_visitas === 1 ? 'visita' : 'visitas'}
                                </span>
                              )}
                              {dir.ultima_visita && (
                                <span className="text-xs text-texto-terciario">
                                  Última: {formato.fechaRelativa(dir.ultima_visita)}
                                </span>
                              )}
                              {dir.total_visitas === 0 && (
                                <span className="text-xs text-texto-terciario italic">Sin visitas previas</span>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            {tieneGps && (
                              <Navigation size={12} className="text-texto-terciario" />
                            )}
                            {esSeleccionada && <Check size={14} className="text-texto-marca" />}
                          </div>
                        </div>
                      </button>
                    )
                  })}
                </div>
              ) : cargandoDirecciones ? (
                <p className="text-sm text-texto-terciario">Cargando...</p>
              ) : (
                <p className="text-sm text-texto-terciario">Este contacto no tiene direcciones cargadas</p>
              )}
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
                  { valor: '', etiqueta: 'Seleccionar motivo...' },
                  ...config.motivos_predefinidos.map(m => ({ valor: m, etiqueta: m })),
                  { valor: '__otro', etiqueta: 'Otro (texto libre)' },
                ]}
                placeholder="Seleccionar motivo"
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
                placeholder="Escribir motivo..."
                className="mt-2"
              />
            )}
          </div>

          {/* Recibe — quien recibe al visitador (opcional) */}
          <div className="px-6 py-4 border-t border-borde-sutil">
            <label className="text-[11px] font-medium text-texto-terciario uppercase tracking-wider mb-2 block">
              Recibe (opcional)
            </label>
            <p className="text-xs text-texto-terciario mb-3">Si quien recibe es diferente al contacto principal</p>
            <div className="grid grid-cols-2 gap-3">
              <Input
                value={recibeNombre}
                onChange={(e) => setRecibeNombre(e.target.value)}
                placeholder="Nombre"
              />
              <Input
                value={recibeTelefono}
                onChange={(e) => setRecibeTelefono(e.target.value)}
                placeholder="Teléfono"
              />
            </div>
          </div>

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
        <div className="space-y-0">
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
                { valor: '', etiqueta: 'Sin asignar' },
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
                <span className="text-xs text-texto-terciario">minutos</span>
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
                        ? 'bg-red-500/15 border-red-500/40 text-red-400'
                        : p === 'alta'
                        ? 'bg-orange-500/15 border-orange-500/40 text-orange-400'
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
                      placeholder="Nuevo item..."
                      className={`flex-1 text-sm bg-transparent border-none outline-none ${
                        item.completado ? 'line-through text-texto-terciario' : 'text-texto-primario'
                      }`}
                    />
                    <button
                      onClick={() => eliminarItemChecklist(item.id)}
                      className="opacity-0 group-hover:opacity-100 text-texto-terciario hover:text-red-400 transition-opacity"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-texto-terciario">Sin items. Presioná + para agregar.</p>
            )}
          </div>
        </div>
      </div>
    </Modal>
  )
}

export { ModalVisita }
