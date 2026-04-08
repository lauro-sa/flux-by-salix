'use client'

import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { ModalAdaptable as Modal } from '@/componentes/ui/ModalAdaptable'
import { Input } from '@/componentes/ui/Input'
import { Boton } from '@/componentes/ui/Boton'
import { Select } from '@/componentes/ui/Select'
import { TextArea } from '@/componentes/ui/TextArea'
import { SelectorFecha } from '@/componentes/ui/SelectorFecha'
import { obtenerIcono } from '@/componentes/ui/SelectorIcono'
import {
  Plus, Trash2, Search, X, Check, GripVertical,
  ChevronDown, User, Link2, CheckCircle, FileText,
  MapPin, Mail as MailIcon, Clock, ExternalLink,
  Calendar,
} from 'lucide-react'
import { useFormato } from '@/hooks/useFormato'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { crearClienteNavegador } from '@/lib/supabase/cliente'
import { SelectorCalendarioBloque } from './SelectorCalendarioBloque'
import type { TipoActividad } from '../configuracion/secciones/SeccionTipos'
import type { EstadoActividad } from '../configuracion/secciones/SeccionEstados'

/**
 * ModalActividad — Modal para crear o editar una actividad.
 * Campos condicionales según el tipo seleccionado.
 * Vinculación a contactos/documentos, checklist inline, responsable.
 */

interface Vinculo {
  tipo: string
  id: string
  nombre: string
}

interface ItemChecklist {
  id: string
  texto: string
  completado: boolean
  fecha?: string | null
}

interface Seguimiento {
  id: string
  nota: string
  registrado_por: string
  registrado_por_nombre: string
  fecha: string
}

interface Actividad {
  id: string
  titulo: string
  descripcion: string | null
  tipo_id: string
  tipo_clave: string
  estado_id: string
  estado_clave: string
  prioridad: string
  fecha_vencimiento: string | null
  asignado_a: string | null
  asignado_nombre: string | null
  checklist: ItemChecklist[]
  vinculos: Vinculo[]
  seguimientos?: Seguimiento[]
}

interface Miembro {
  usuario_id: string
  nombre: string
  apellido: string
}

/** Mapeo tipo → acción inteligente */
const ACCIONES_TIPO: Record<string, { etiqueta: string; icono: typeof FileText; ruta: (contactoId?: string) => string }> = {
  presupuestar: { etiqueta: 'Crear presupuesto', icono: FileText, ruta: (cId) => cId ? `/presupuestos/nuevo?contacto_id=${cId}&desde=/actividades` : '/presupuestos/nuevo?desde=/actividades' },
  visita: { etiqueta: 'Ir a visitas', icono: MapPin, ruta: (cId) => cId ? `/visitas?contacto_id=${cId}&desde=/actividades` : '/visitas?desde=/actividades' },
  correo: { etiqueta: 'Enviar correo', icono: MailIcon, ruta: (cId) => cId ? `/inbox?contacto_id=${cId}&desde=/actividades` : '/inbox?desde=/actividades' },
}

interface PresetPosposicion {
  id: string
  etiqueta: string
  dias: number
}

interface PropiedadesModal {
  abierto: boolean
  actividad?: Actividad | null
  tipos: TipoActividad[]
  estados: EstadoActividad[]
  miembros: Miembro[]
  presetsPosposicion?: PresetPosposicion[]
  vinculoInicial?: Vinculo | Vinculo[] | null
  onGuardar: (datos: Record<string, unknown>) => Promise<unknown>
  onCompletar?: (id: string) => Promise<void>
  onPosponer?: (id: string, dias: number) => Promise<void>
  onCerrar: () => void
}

function ModalActividad({
  abierto, actividad, tipos, estados, miembros, presetsPosposicion, vinculoInicial,
  onGuardar, onCompletar, onPosponer, onCerrar,
}: PropiedadesModal) {
  const router = useRouter()
  const esEdicion = !!actividad
  const tiposActivos = useMemo(() => tipos.filter(t => t.activo), [tipos])

  // Estado del formulario
  const [titulo, setTitulo] = useState('')
  const [descripcion, setDescripcion] = useState('')
  const [tipoId, setTipoId] = useState('')
  const [prioridad, setPrioridad] = useState('normal')
  const [fechaVencimiento, setFechaVencimiento] = useState('')
  const [asignadoA, setAsignadoA] = useState<string | null>(null)
  const [asignadoNombre, setAsignadoNombre] = useState<string | null>(null)
  const [checklist, setChecklist] = useState<ItemChecklist[]>([])
  const [vinculos, setVinculos] = useState<Vinculo[]>([])
  const [guardando, setGuardando] = useState(false)
  const [tituloManual, setTituloManual] = useState(false)

  // Tipo seleccionado (para campos condicionales)
  const tipoSeleccionado = tiposActivos.find(t => t.id === tipoId)

  // Auto-generar título: "Tipo a NombreContacto" (solo si no editó manualmente)
  const generarTituloAuto = useCallback((idTipo: string, vincs: Vinculo[]) => {
    const tipo = tiposActivos.find(t => t.id === idTipo)
    if (!tipo) return ''
    const contacto = vincs.find(v => v.tipo === 'contacto')
    if (contacto) return `${tipo.etiqueta} a ${contacto.nombre}`
    return tipo.etiqueta
  }, [tiposActivos])

  // Inicializar al abrir
  useEffect(() => {
    if (!abierto) return
    if (actividad) {
      setTitulo(actividad.titulo)
      setDescripcion(actividad.descripcion || '')
      setTipoId(actividad.tipo_id)
      setPrioridad(actividad.prioridad)
      setFechaVencimiento(actividad.fecha_vencimiento ? actividad.fecha_vencimiento.split('T')[0] : '')
      setAsignadoA(actividad.asignado_a)
      setAsignadoNombre(actividad.asignado_nombre)
      setChecklist(actividad.checklist || [])
      setVinculos(actividad.vinculos || [])
    } else {
      const vincsIniciales = vinculoInicial
        ? Array.isArray(vinculoInicial) ? vinculoInicial : [vinculoInicial]
        : []
      const primerTipoId = tiposActivos[0]?.id || ''
      setTipoId(primerTipoId)
      setDescripcion('')
      setPrioridad('normal')
      setFechaVencimiento('')
      setAsignadoA(null)
      setAsignadoNombre(null)
      setChecklist([])
      setVinculos(vincsIniciales)
      setTituloManual(false)

      // Auto-título inteligente
      setTitulo(generarTituloAuto(primerTipoId, vincsIniciales))

      // Auto-set fecha vencimiento según tipo
      if (tiposActivos[0]?.dias_vencimiento) {
        const fecha = new Date()
        fecha.setDate(fecha.getDate() + tiposActivos[0].dias_vencimiento)
        setFechaVencimiento(fecha.toISOString().split('T')[0])
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [abierto])

  // Al cambiar tipo, actualizar título + fecha vencimiento
  const manejarCambioTipo = (nuevoTipoId: string) => {
    setTipoId(nuevoTipoId)
    // Auto-título si no editó manualmente
    if (!tituloManual) {
      setTitulo(generarTituloAuto(nuevoTipoId, vinculos))
    }
    if (!esEdicion) {
      const tipo = tiposActivos.find(t => t.id === nuevoTipoId)
      if (tipo?.dias_vencimiento) {
        const fecha = new Date()
        fecha.setDate(fecha.getDate() + tipo.dias_vencimiento)
        setFechaVencimiento(fecha.toISOString().split('T')[0])
      } else {
        setFechaVencimiento('')
      }
    }
  }

  // Al cambiar vínculos, actualizar título auto si no editó manualmente
  const manejarCambioVinculos = (nuevos: Vinculo[]) => {
    setVinculos(nuevos)
    if (!tituloManual) {
      setTitulo(generarTituloAuto(tipoId, nuevos))
    }
  }

  // Estado para bloques de calendario inline (al crear con tipo campo_calendario)
  const tipoConCalendario = tipoSeleccionado && 'campo_calendario' in tipoSeleccionado && (tipoSeleccionado as TipoActividad & { campo_calendario?: boolean }).campo_calendario
  const [bloquesNuevos, setBloquesNuevos] = useState<{ fecha: string; horaInicio: string; horaFin: string }[]>([])
  // Estado del modal selector de calendario (mini-calendario semanal)
  const [selectorCalendarioAbierto, setSelectorCalendarioAbierto] = useState(false)

  // Guardar
  const manejarGuardar = async () => {
    if (!titulo.trim() || !tipoId) return
    setGuardando(true)
    try {
      const resultado = await onGuardar({
        ...(esEdicion ? { id: actividad!.id } : {}),
        titulo: titulo.trim(),
        descripcion: descripcion || null,
        tipo_id: tipoId,
        prioridad,
        fecha_vencimiento: fechaVencimiento ? new Date(fechaVencimiento + 'T12:00:00').toISOString() : null,
        asignado_a: asignadoA,
        asignado_nombre: asignadoNombre,
        checklist,
        vinculos,
      })

      // Si es creación con bloques de calendario, crearlos después de la actividad
      if (!esEdicion && tipoConCalendario && bloquesNuevos.length > 0 && resultado && typeof resultado === 'object' && 'id' in resultado) {
        const actividadId = (resultado as { id: string }).id
        const asignados = asignadoA && asignadoNombre
          ? [{ id: asignadoA, nombre: asignadoNombre }]
          : []

        // Crear todos los bloques en paralelo
        await Promise.all(bloquesNuevos.map(bloque =>
          fetch('/api/calendario', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              titulo: titulo.trim(),
              fecha_inicio: `${bloque.fecha}T${bloque.horaInicio}:00`,
              fecha_fin: `${bloque.fecha}T${bloque.horaFin}:00`,
              tipo_clave: 'tarea',
              actividad_id: actividadId,
              asignados,
              vinculos,
              estado: 'confirmado',
            }),
          })
        ))
      }

      onCerrar()
    } finally {
      setGuardando(false)
    }
  }

  // Si el selector de calendario está abierto, mostrar solo eso (no dos modales)
  if (selectorCalendarioAbierto) {
    return (
      <SelectorCalendarioBloque
        abierto
        bloques={bloquesNuevos}
        onCambiar={setBloquesNuevos}
        onCerrar={() => setSelectorCalendarioAbierto(false)}
        titulo={titulo || 'Nuevo evento'}
      />
    )
  }

  return (
    <Modal
      abierto={abierto}
      onCerrar={onCerrar}
      titulo={esEdicion ? 'Editar actividad' : 'Nueva actividad'}
      tamano="3xl"
      acciones={
        <>
          <Boton variante="secundario" tamano="sm" onClick={onCerrar}>Cancelar</Boton>
          <Boton tamano="sm" onClick={manejarGuardar} cargando={guardando} disabled={!titulo.trim() || !tipoId}>
            {esEdicion ? 'Guardar' : (tipoConCalendario && bloquesNuevos.length > 0 ? 'Crear y agendar' : 'Crear actividad')}
          </Boton>
        </>
      }
    >
      <div className="space-y-5">
        {/* ── Acciones rápidas (solo en edición, actividad pendiente) — ancho completo ── */}
        {esEdicion && actividad && actividad.estado_clave !== 'completada' && actividad.estado_clave !== 'cancelada' && (
          <div className="flex flex-wrap gap-2">
            {/* Botón Completar */}
            {onCompletar && (
              <Boton
                variante="exito"
                tamano="sm"
                redondeado
                icono={<CheckCircle size={15} />}
                onClick={async () => { await onCompletar(actividad.id); onCerrar() }}
              >
                Completar
              </Boton>
            )}
            {/* Botón Posponer */}
            {onPosponer && (
              <div className="relative group">
                <Boton
                  variante="advertencia"
                  tamano="sm"
                  redondeado
                  icono={<Clock size={15} />}
                >
                  Posponer
                </Boton>
                {/* Dropdown de opciones */}
                <div className="absolute top-full left-0 mt-1 bg-superficie-elevada border border-borde-sutil rounded-lg shadow-lg overflow-hidden z-50 hidden group-hover:block min-w-[140px]">
                  {(presetsPosposicion ?? [
                    { id: '1d', etiqueta: '1 día', dias: 1 },
                    { id: '3d', etiqueta: '3 días', dias: 3 },
                    { id: '1s', etiqueta: '1 semana', dias: 7 },
                    { id: '2s', etiqueta: '2 semanas', dias: 14 },
                  ]).map(op => (
                    <button
                      key={op.id}
                      onClick={async () => { await onPosponer(actividad.id, op.dias); onCerrar() }}
                      className="w-full px-3 py-2 text-sm text-left text-texto-primario bg-transparent border-none cursor-pointer hover:bg-superficie-hover transition-colors focus-visible:outline-2 focus-visible:outline-texto-marca focus-visible:-outline-offset-2"
                    >
                      {op.etiqueta}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {/* Botón acción inteligente según tipo */}
            {(() => {
              const tipoAct = tiposActivos.find(t => t.id === actividad.tipo_id)
              const accion = tipoAct ? ACCIONES_TIPO[tipoAct.clave] : null
              if (!accion) return null
              const contacto = (actividad.vinculos as Vinculo[])?.find(v => v.tipo === 'contacto')
              const IconoAccion = accion.icono
              return (
                <Boton
                  variante="fantasma"
                  tamano="sm"
                  redondeado
                  icono={<IconoAccion size={15} />}
                  onClick={() => { onCerrar(); router.push(accion.ruta(contacto?.id)) }}
                  className="bg-texto-marca/10 text-texto-marca hover:bg-texto-marca/15"
                >
                  {accion.etiqueta}
                </Boton>
              )
            })()}
          </div>
        )}

        {/* ── Layout 2 columnas (desktop) / 1 columna (mobile) ── */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
          {/* ── Columna izquierda (60%) — tipo, título, descripción, checklist ── */}
          <div className="md:col-span-3 space-y-4">
            {/* Selector de tipo (pills visuales) */}
            <div>
              <label className="text-sm font-medium text-texto-secundario block mb-2">Tipo</label>
              <div className="flex flex-wrap gap-1.5">
                {tiposActivos.map(tipo => {
                  const Icono = obtenerIcono(tipo.icono)
                  const sel = tipoId === tipo.id
                  return (
                    <button
                      key={tipo.id}
                      onClick={() => manejarCambioTipo(tipo.id)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-all cursor-pointer border focus-visible:outline-2 focus-visible:outline-texto-marca focus-visible:-outline-offset-2 ${
                        sel
                          ? 'border-transparent text-white'
                          : 'bg-superficie-hover text-texto-secundario border-transparent hover:text-texto-primario'
                      }`}
                      style={sel ? { backgroundColor: tipo.color } : undefined}
                    >
                      {Icono && <Icono size={14} />}
                      {tipo.etiqueta}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Título */}
            <Input
              tipo="text"
              etiqueta="Título"
              value={titulo}
              onChange={(e) => { setTitulo(e.target.value); setTituloManual(true) }}
              placeholder="¿Qué hay que hacer?"
            />

            {/* Descripción (condicional) */}
            {tipoSeleccionado?.campo_descripcion && (
              <TextArea
                etiqueta="Descripción"
                value={descripcion}
                onChange={(e) => setDescripcion(e.target.value)}
                placeholder="Detalles adicionales..."
                rows={4}
              />
            )}

            {/* Checklist (condicional) */}
            {tipoSeleccionado?.campo_checklist && (
              <SeccionChecklist checklist={checklist} onChange={setChecklist} />
            )}
          </div>

          {/* ── Columna derecha (40%) — responsable, prioridad, fecha, vínculos, bloques ── */}
          <div className="md:col-span-2 space-y-4 md:border-l md:border-borde-sutil md:pl-6">
            {/* Responsable */}
            {tipoSeleccionado?.campo_responsable && (
              <Select
                etiqueta="Responsable"
                valor={asignadoA || ''}
                onChange={(val) => {
                  setAsignadoA(val || null)
                  const m = miembros.find(m => m.usuario_id === val)
                  setAsignadoNombre(m ? `${m.nombre} ${m.apellido}`.trim() : null)
                }}
                placeholder="Sin asignar"
                opciones={miembros.map(m => ({
                  valor: m.usuario_id,
                  etiqueta: `${m.nombre} ${m.apellido}`.trim(),
                }))}
              />
            )}

            {/* Prioridad */}
            {tipoSeleccionado?.campo_prioridad && (
              <Select
                etiqueta="Prioridad"
                valor={prioridad}
                onChange={setPrioridad}
                opciones={[
                  { valor: 'baja', etiqueta: 'Baja' },
                  { valor: 'normal', etiqueta: 'Normal' },
                  { valor: 'alta', etiqueta: 'Alta' },
                ]}
              />
            )}

            {/* Fecha vencimiento */}
            {tipoSeleccionado?.campo_fecha && (
              <SelectorFecha
                valor={fechaVencimiento}
                onChange={(v) => setFechaVencimiento(v || '')}
                etiqueta="Vencimiento"
                limpiable
              />
            )}

            {/* Separador visual */}
            <div className="hidden md:block border-t border-borde-sutil" />

            {/* Vínculos */}
            <SeccionVinculos vinculos={vinculos} onChange={manejarCambioVinculos} onNavegar={(ruta) => { onCerrar(); router.push(ruta) }} />

            {/* Separador visual */}
            <div className="hidden md:block border-t border-borde-sutil" />

            {/* Bloques de calendario — edición: componente existente */}
            {esEdicion && actividad && (
              <SeccionBloquesCalendario
                actividadId={actividad.id}
                titulo={actividad.titulo}
                asignadoA={asignadoA}
                asignadoNombre={asignadoNombre}
                vinculos={vinculos}
              />
            )}

            {/* Bloques de calendario — creación: selector visual */}
            {!esEdicion && tipoConCalendario && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Calendar size={15} className="text-texto-terciario" />
                    <span className="text-sm font-medium text-texto-primario">Agendar en calendario</span>
                  </div>
                  <Boton variante="fantasma" tamano="xs" icono={<Calendar size={14} />} onClick={() => setSelectorCalendarioAbierto(true)}>
                    Abrir calendario
                  </Boton>
                </div>

                {bloquesNuevos.length === 0 ? (
                  <button
                    type="button"
                    onClick={() => setSelectorCalendarioAbierto(true)}
                    className="w-full p-3 rounded-lg border-2 border-dashed border-borde-sutil text-xs text-texto-terciario hover:border-texto-marca/30 hover:text-texto-marca transition-colors"
                  >
                    Hacé clic para abrir el calendario y seleccionar horarios
                  </button>
                ) : (
                  <div className="space-y-1">
                    {bloquesNuevos.map((bloque, i) => (
                      <div key={i} className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-superficie-hover/50 text-sm">
                        <span className="size-2 rounded-full bg-texto-marca shrink-0" />
                        <span className="text-texto-primario font-medium">{bloque.fecha}</span>
                        <span className="text-texto-terciario text-xs">
                          {bloque.horaInicio} – {bloque.horaFin}
                        </span>
                        <button
                          type="button"
                          onClick={() => setBloquesNuevos(prev => prev.filter((_, idx) => idx !== i))}
                          className="ml-auto text-texto-terciario hover:text-estado-error transition-colors"
                        >
                          <X size={13} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

              </div>
            )}
          </div>
        </div>

        {/* ── Seguimientos (solo edición) — ancho completo debajo del grid ── */}
        {esEdicion && (
          <SeccionSeguimientos
            seguimientos={(actividad?.seguimientos as Seguimiento[]) || []}
            actividadId={actividad!.id}
            onActualizar={(nuevos) => {
              if (actividad) {
                (actividad as Actividad).seguimientos = nuevos
              }
            }}
          />
        )}
      </div>
    </Modal>
  )
}

// ══════════════════════════════════════════════════
// Sección Vínculos — input siempre visible, dropdown flotante
// Tabs: Contacto, Documento, Visita
// ══════════════════════════════════════════════════

const TIPOS_VINCULO = [
  { clave: 'contacto', etiqueta: 'Contacto', icono: User, placeholder: 'Buscar contacto...' },
  { clave: 'documento', etiqueta: 'Documento', icono: Link2, placeholder: 'Buscar presupuesto, factura...' },
  { clave: 'visita', etiqueta: 'Visita', icono: Link2, placeholder: 'Buscar visita...' },
]

const ICONOS_VINCULO: Record<string, typeof User> = {
  contacto: User,
  documento: Link2,
  visita: Link2,
}

/** Ruta de navegación según tipo de vínculo */
const RUTAS_VINCULO: Record<string, (id: string) => string> = {
  contacto: (id) => `/contactos/${id}?desde=/actividades`,
  documento: (id) => `/presupuestos/${id}?desde=/actividades`,
  visita: (id) => `/visitas/${id}?desde=/actividades`,
}

function SeccionVinculos({ vinculos, onChange, onNavegar }: { vinculos: Vinculo[]; onChange: (v: Vinculo[]) => void; onNavegar?: (ruta: string) => void }) {
  const [foco, setFoco] = useState(false)
  const [tabActivo, setTabActivo] = useState('contacto')
  const [busqueda, setBusqueda] = useState('')
  const [resultados, setResultados] = useState<{ id: string; nombre: string; apellido?: string }[]>([])
  const [recientes, setRecientes] = useState<{ id: string; nombre: string; apellido?: string }[]>([])
  const [cargando, setCargando] = useState(false)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const contenedorRef = useRef<HTMLDivElement>(null)

  // Cerrar dropdown al hacer click fuera (con delay para no comer el click del destino)
  useEffect(() => {
    if (!foco) return
    const handler = (e: MouseEvent) => {
      if (contenedorRef.current && !contenedorRef.current.contains(e.target as Node)) {
        // Delay para que el click en el destino se procese primero
        requestAnimationFrame(() => setFoco(false))
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [foco])

  // Cargar recientes al abrir dropdown o cambiar tab
  useEffect(() => {
    if (!foco) return
    const cargarRecientes = async () => {
      setCargando(true)
      try {
        if (tabActivo === 'contacto') {
          const res = await fetch('/api/contactos?por_pagina=5&orden_campo=actualizado_en&orden_dir=desc')
          if (res.ok) {
            const data = await res.json()
            setRecientes(data.contactos || [])
          }
        } else if (tabActivo === 'documento') {
          const res = await fetch('/api/presupuestos?por_pagina=5')
          if (res.ok) {
            const data = await res.json()
            setRecientes((data.presupuestos || []).map((p: { id: string; numero: string; contacto_nombre?: string }) => ({
              id: p.id,
              nombre: p.numero,
              apellido: p.contacto_nombre || '',
            })))
          }
        } else {
          setRecientes([])
        }
      } catch (err) { console.error('Error en vínculos:', err) }
      finally { setCargando(false) }
    }
    cargarRecientes()
  }, [foco, tabActivo])

  // Buscar con debounce
  useEffect(() => {
    if (!busqueda.trim() || busqueda.length < 2) {
      setResultados([])
      return
    }
    clearTimeout(timeoutRef.current)
    timeoutRef.current = setTimeout(async () => {
      setCargando(true)
      try {
        if (tabActivo === 'contacto') {
          const res = await fetch(`/api/contactos?busqueda=${encodeURIComponent(busqueda)}&por_pagina=8`)
          if (res.ok) {
            const data = await res.json()
            setResultados(data.contactos || [])
          }
        } else if (tabActivo === 'documento') {
          const res = await fetch(`/api/presupuestos?busqueda=${encodeURIComponent(busqueda)}&por_pagina=8`)
          if (res.ok) {
            const data = await res.json()
            setResultados((data.presupuestos || []).map((p: { id: string; numero: string; contacto_nombre?: string }) => ({
              id: p.id,
              nombre: p.numero,
              apellido: p.contacto_nombre || '',
            })))
          }
        }
      } catch (err) { console.error('Error en vínculos:', err) }
      finally { setCargando(false) }
    }, 300)
    return () => clearTimeout(timeoutRef.current)
  }, [busqueda, tabActivo])

  const agregarVinculo = (item: { id: string; nombre: string; apellido?: string }) => {
    if (vinculos.some(v => v.id === item.id)) return
    onChange([...vinculos, {
      tipo: tabActivo,
      id: item.id,
      nombre: `${item.nombre}${item.apellido ? ' ' + item.apellido : ''}`.trim(),
    }])
    setBusqueda('')
  }

  const removerVinculo = (id: string) => {
    onChange(vinculos.filter(v => v.id !== id))
  }

  const listaVisible = busqueda.trim().length >= 2 ? resultados : recientes
  const esRecientes = busqueda.trim().length < 2

  return (
    <div ref={contenedorRef}>
      <label className="text-sm font-medium text-texto-secundario flex items-center gap-1.5 mb-2">
        <Link2 size={14} />
        Vincular a
      </label>

      {/* Badges de vínculos actuales */}
      {vinculos.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-2">
          {vinculos.map(v => {
            const IconoV = ICONOS_VINCULO[v.tipo] || Link2
            const rutaVinculo = RUTAS_VINCULO[v.tipo]
            return (
              <span
                key={v.id}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-superficie-hover text-texto-primario"
              >
                <IconoV size={11} className="text-texto-terciario" />
                {rutaVinculo ? (
                  <button
                    onClick={() => onNavegar?.(rutaVinculo(v.id))}
                    className="bg-transparent border-none cursor-pointer text-texto-primario hover:text-texto-marca transition-colors inline-flex items-center gap-1 p-0 text-xs font-medium"
                  >
                    {v.nombre}
                    <ExternalLink size={10} className="opacity-50" />
                  </button>
                ) : v.nombre}
                <Boton variante="fantasma" tamano="xs" soloIcono icono={<X size={10} />} onClick={() => removerVinculo(v.id)} titulo="Quitar vínculo" className="size-4" />
              </span>
            )
          })}
        </div>
      )}

      {/* Input de búsqueda — siempre visible */}
      <div className="relative">
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-borde-fuerte bg-superficie-tarjeta">
          <Search size={14} className="text-texto-terciario shrink-0" />
          <Input
            tipo="text"
            variante="plano"
            compacto
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            onFocus={() => setFoco(true)}
            placeholder={TIPOS_VINCULO.find(t => t.clave === tabActivo)?.placeholder || 'Buscar...'}
            className="flex-1"
          />
        </div>

        {/* Dropdown flotante — absolute, no empuja el modal */}
        <AnimatePresence>
          {foco && (
            <motion.div
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 4 }}
              transition={{ duration: 0.12 }}
              className="absolute z-50 left-0 right-0 top-full mt-1 bg-superficie-elevada border border-borde-sutil rounded-xl shadow-lg overflow-hidden"
            >
              {/* Tabs */}
              <div className="flex border-b border-borde-sutil">
                {TIPOS_VINCULO.map(tv => {
                  const Ic = tv.icono
                  const activo = tabActivo === tv.clave
                  return (
                    <button
                      key={tv.clave}
                      onClick={() => { setTabActivo(tv.clave); setBusqueda('') }}
                      className={`flex items-center gap-1.5 px-4 py-2 text-xs font-medium transition-colors cursor-pointer border-none focus-visible:outline-2 focus-visible:outline-texto-marca focus-visible:-outline-offset-2 ${
                        activo
                          ? 'text-texto-marca bg-texto-marca/5'
                          : 'text-texto-terciario bg-transparent hover:text-texto-secundario'
                      }`}
                    >
                      <Ic size={13} />
                      {tv.etiqueta}
                    </button>
                  )
                })}
              </div>

              {/* Lista */}
              <div className="max-h-52 overflow-y-auto">
                {esRecientes && listaVisible.length > 0 && (
                  <p className="px-4 py-1.5 text-xxs font-semibold text-texto-terciario uppercase tracking-wider">Recientes</p>
                )}
                {cargando && listaVisible.length === 0 ? (
                  <p className="text-xs text-texto-terciario text-center py-4">Buscando...</p>
                ) : listaVisible.length === 0 && busqueda.length >= 2 ? (
                  <p className="text-xs text-texto-terciario text-center py-4">Sin resultados</p>
                ) : listaVisible.length === 0 && esRecientes ? (
                  <p className="text-xs text-texto-terciario text-center py-4">Escribí para buscar</p>
                ) : (
                  listaVisible.map(item => {
                    const yaVinculado = vinculos.some(v => v.id === item.id)
                    return (
                      <button
                        key={item.id}
                        onClick={() => agregarVinculo(item)}
                        disabled={yaVinculado}
                        className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm text-left transition-colors border-none focus-visible:outline-2 focus-visible:outline-texto-marca focus-visible:-outline-offset-2 ${
                          yaVinculado
                            ? 'text-texto-terciario cursor-default bg-transparent'
                            : 'text-texto-primario cursor-pointer bg-transparent hover:bg-superficie-hover'
                        }`}
                      >
                        <User size={15} className="text-texto-terciario shrink-0" />
                        <span className="flex-1 truncate">
                          {item.nombre}{item.apellido ? ` ${item.apellido}` : ''}
                        </span>
                        {yaVinculado ? (
                          <Check size={14} className="text-texto-marca shrink-0" />
                        ) : (
                          <Plus size={14} className="text-texto-terciario shrink-0" />
                        )}
                      </button>
                    )
                  })
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════════
// Sección Checklist — lista de tareas inline
// ══════════════════════════════════════════════════

function SeccionChecklist({ checklist, onChange }: { checklist: ItemChecklist[]; onChange: (c: ItemChecklist[]) => void }) {
  const formato = useFormato()
  const [nuevoTexto, setNuevoTexto] = useState('')

  const agregar = () => {
    if (!nuevoTexto.trim()) return
    onChange([...checklist, { id: crypto.randomUUID(), texto: nuevoTexto.trim(), completado: false, fecha: null }])
    setNuevoTexto('')
  }

  const toggleItem = (id: string) => {
    onChange(checklist.map(item => item.id === id ? { ...item, completado: !item.completado } : item))
  }

  const eliminarItem = (id: string) => {
    onChange(checklist.filter(item => item.id !== id))
  }

  const editarItem = (id: string, campos: Partial<ItemChecklist>) => {
    onChange(checklist.map(item => item.id === id ? { ...item, ...campos } : item))
  }

  const completados = checklist.filter(i => i.completado).length

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <label className="text-sm font-medium text-texto-secundario">Checklist</label>
        {checklist.length > 0 && (
          <span className="text-xs text-texto-terciario">{completados}/{checklist.length}</span>
        )}
      </div>

      {/* Barra de progreso */}
      {checklist.length > 0 && (
        <div className="w-full h-1.5 rounded-full bg-superficie-hover mb-3 overflow-hidden">
          <motion.div
            className="h-full rounded-full bg-texto-marca"
            animate={{ width: `${(completados / checklist.length) * 100}%` }}
            transition={{ duration: 0.3 }}
          />
        </div>
      )}

      {/* Items */}
      <div className="space-y-0.5">
        {checklist.map(item => {
          const fechaVencida = item.fecha && new Date(item.fecha) < new Date() && !item.completado
          return (
            <div key={item.id} className="flex items-start gap-2 group py-1">
              <button
                onClick={() => toggleItem(item.id)}
                className={`size-5 rounded border-2 flex items-center justify-center shrink-0 cursor-pointer transition-colors mt-0.5 focus-visible:outline-2 focus-visible:outline-texto-marca focus-visible:-outline-offset-2 ${
                  item.completado
                    ? 'bg-texto-marca border-texto-marca'
                    : 'bg-transparent border-borde-fuerte hover:border-texto-marca'
                }`}
              >
                {item.completado && <Check size={12} className="text-white" />}
              </button>
              <div className="flex-1 min-w-0">
                <Input
                  tipo="text"
                  variante="plano"
                  compacto
                  value={item.texto}
                  onChange={(e) => editarItem(item.id, { texto: e.target.value })}
                  className={`w-full ${
                    item.completado ? 'text-texto-terciario line-through' : ''
                  }`}
                />
                {/* Fecha opcional */}
                <div className="flex items-center gap-1.5 mt-0.5">
                  {item.fecha ? (
                    <button
                      onClick={() => editarItem(item.id, { fecha: null })}
                      className={`text-xxs px-1.5 py-0.5 rounded flex items-center gap-1 cursor-pointer border-none transition-colors ${
                        fechaVencida
                          ? 'bg-insignia-peligro-fondo text-insignia-peligro-texto'
                          : item.completado
                            ? 'bg-superficie-hover text-texto-terciario'
                            : 'bg-superficie-hover text-texto-secundario hover:bg-superficie-activa'
                      }`}
                    >
                      <Clock size={9} />
                      {formato.fecha(item.fecha, { corta: true })}
                      <X size={8} className="ml-0.5" />
                    </button>
                  ) : (
                    <label className="opacity-0 group-hover:opacity-100 transition-opacity">
                      <input
                        type="date"
                        value=""
                        onChange={(e) => { if (e.target.value) editarItem(item.id, { fecha: e.target.value }) }}
                        className="sr-only"
                      />
                      <span className="text-xxs text-texto-terciario/60 hover:text-texto-terciario cursor-pointer flex items-center gap-0.5">
                        <Clock size={9} />
                        Fecha
                      </span>
                    </label>
                  )}
                </div>
              </div>
              <Boton
                variante="fantasma"
                tamano="xs"
                soloIcono
                icono={<X size={14} />}
                onClick={() => eliminarItem(item.id)}
                titulo="Eliminar item"
                className="opacity-0 group-hover:opacity-100 mt-0.5"
              />
            </div>
          )
        })}
      </div>

      {/* Agregar nuevo item */}
      <div className="flex items-center gap-2 mt-2">
        <Plus size={14} className="text-texto-terciario shrink-0" />
        <Input
          tipo="text"
          variante="plano"
          compacto
          value={nuevoTexto}
          onChange={(e) => setNuevoTexto(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && agregar()}
          placeholder="Agregar item..."
          className="flex-1"
        />
      </div>
    </div>
  )
}

/* ── Sección de bloques de calendario ── */
interface BloqueCalendario {
  id: string
  titulo: string
  fecha_inicio: string
  fecha_fin: string
  todo_el_dia: boolean
  color: string | null
  estado: string
}

function SeccionBloquesCalendario({
  actividadId,
  titulo,
  asignadoA,
  asignadoNombre,
  vinculos,
}: {
  actividadId: string
  titulo: string
  asignadoA: string | null
  asignadoNombre: string | null
  vinculos: Vinculo[]
}) {
  const [bloques, setBloques] = useState<BloqueCalendario[]>([])
  const [cargando, setCargando] = useState(true)
  const [creando, setCreando] = useState(false)
  const [mostrarFormulario, setMostrarFormulario] = useState(false)
  const [nuevaFechaInicio, setNuevaFechaInicio] = useState('')
  const [nuevaHoraInicio, setNuevaHoraInicio] = useState('08:00')
  const [nuevaHoraFin, setNuevaHoraFin] = useState('17:00')
  const formato = useFormato()

  // Cargar bloques vinculados a esta actividad
  useEffect(() => {
    const cargar = async () => {
      try {
        // Buscar eventos de calendario con actividad_id = esta actividad
        const desde = '2020-01-01'
        const hasta = '2030-12-31'
        const res = await fetch(`/api/calendario?desde=${desde}&hasta=${hasta}`)
        if (res.ok) {
          const datos = await res.json()
          const eventosActividad = (datos.eventos || []).filter(
            (e: BloqueCalendario & { actividad_id: string }) => e.actividad_id === actividadId
          )
          setBloques(eventosActividad)
        }
      } catch {
        // Silenciar
      } finally {
        setCargando(false)
      }
    }
    cargar()
  }, [actividadId])

  // Crear un bloque nuevo
  const crearBloque = async () => {
    if (!nuevaFechaInicio || !nuevaHoraInicio || !nuevaHoraFin) return
    setCreando(true)
    try {
      const fechaInicio = `${nuevaFechaInicio}T${nuevaHoraInicio}:00`
      const fechaFin = `${nuevaFechaInicio}T${nuevaHoraFin}:00`

      // Preparar asignados
      const asignados = asignadoA && asignadoNombre
        ? [{ id: asignadoA, nombre: asignadoNombre }]
        : []

      const res = await fetch('/api/calendario', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          titulo,
          fecha_inicio: fechaInicio,
          fecha_fin: fechaFin,
          tipo_clave: 'tarea',
          actividad_id: actividadId,
          asignados,
          vinculos,
          estado: 'confirmado',
        }),
      })

      if (res.ok) {
        const nuevo = await res.json()
        setBloques(prev => [...prev, nuevo])
        setMostrarFormulario(false)
        setNuevaFechaInicio('')
        setNuevaHoraInicio('08:00')
        setNuevaHoraFin('17:00')
      }
    } catch {
      // Silenciar
    } finally {
      setCreando(false)
    }
  }

  // Eliminar un bloque
  const eliminarBloque = async (id: string) => {
    try {
      const res = await fetch(`/api/calendario/${id}`, { method: 'DELETE' })
      if (res.ok) {
        setBloques(prev => prev.filter(b => b.id !== id))
      }
    } catch {
      // Silenciar
    }
  }

  // Calcular horas totales
  const horasTotales = bloques.reduce((acc, b) => {
    const inicio = new Date(b.fecha_inicio)
    const fin = new Date(b.fecha_fin)
    return acc + (fin.getTime() - inicio.getTime()) / (1000 * 60 * 60)
  }, 0)

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Calendar size={15} className="text-texto-terciario" />
          <span className="text-sm font-medium text-texto-primario">Bloques de calendario</span>
          {bloques.length > 0 && (
            <span className="text-xs text-texto-terciario">
              {bloques.length} bloque{bloques.length !== 1 ? 's' : ''} · {horasTotales.toFixed(1)} hs
            </span>
          )}
        </div>
        <Boton
          variante="fantasma"
          tamano="xs"
          icono={<Plus size={14} />}
          onClick={() => setMostrarFormulario(!mostrarFormulario)}
        >
          Agendar
        </Boton>
      </div>

      {/* Lista de bloques existentes */}
      {!cargando && bloques.length > 0 && (
        <div className="space-y-1">
          {bloques
            .sort((a, b) => new Date(a.fecha_inicio).getTime() - new Date(b.fecha_inicio).getTime())
            .map(bloque => {
              const inicio = new Date(bloque.fecha_inicio)
              const fin = new Date(bloque.fecha_fin)
              const duracionHs = (fin.getTime() - inicio.getTime()) / (1000 * 60 * 60)

              return (
                <div
                  key={bloque.id}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg bg-superficie-hover/50 group"
                >
                  <div
                    className="w-2 h-2 rounded-full shrink-0"
                    style={{ backgroundColor: bloque.color || '#F59E0B' }}
                  />
                  <span className="text-sm text-texto-primario font-medium">
                    {formato.fecha(bloque.fecha_inicio, { corta: true })}
                  </span>
                  <span className="text-xs text-texto-terciario">
                    {formato.hora(bloque.fecha_inicio)} – {formato.hora(bloque.fecha_fin)}
                  </span>
                  <span className="text-xs text-texto-terciario">
                    ({duracionHs.toFixed(1)} hs)
                  </span>
                  <button
                    className="ml-auto opacity-0 group-hover:opacity-100 transition-opacity text-texto-terciario hover:text-estado-error"
                    onClick={() => eliminarBloque(bloque.id)}
                  >
                    <X size={14} />
                  </button>
                </div>
              )
            })}
        </div>
      )}

      {cargando && (
        <p className="text-xs text-texto-terciario italic px-3">Cargando bloques...</p>
      )}

      {!cargando && bloques.length === 0 && !mostrarFormulario && (
        <p className="text-xs text-texto-terciario italic px-3">
          Sin bloques agendados. Usa "Agendar" para planificar cuándo se realizará este trabajo.
        </p>
      )}

      {/* Formulario inline para crear bloque */}
      <AnimatePresence>
        {mostrarFormulario && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="flex flex-col sm:flex-row gap-2 p-3 bg-superficie-hover/30 rounded-lg border border-borde-sutil">
              <SelectorFecha
                valor={nuevaFechaInicio}
                onChange={(v) => setNuevaFechaInicio(v || '')}
                etiqueta="Fecha"
              />
              <div className="flex gap-2 flex-1">
                <div className="flex-1">
                  <label className="text-xs text-texto-terciario mb-1 block">Desde</label>
                  <input
                    type="time"
                    value={nuevaHoraInicio}
                    onChange={(e) => setNuevaHoraInicio(e.target.value)}
                    className="w-full px-2 py-1.5 text-sm rounded-md border border-borde-sutil bg-superficie-tarjeta text-texto-primario"
                  />
                </div>
                <div className="flex-1">
                  <label className="text-xs text-texto-terciario mb-1 block">Hasta</label>
                  <input
                    type="time"
                    value={nuevaHoraFin}
                    onChange={(e) => setNuevaHoraFin(e.target.value)}
                    className="w-full px-2 py-1.5 text-sm rounded-md border border-borde-sutil bg-superficie-tarjeta text-texto-primario"
                  />
                </div>
              </div>
              <div className="flex items-end gap-2">
                <Boton
                  tamano="sm"
                  onClick={crearBloque}
                  cargando={creando}
                  disabled={!nuevaFechaInicio}
                >
                  Agregar
                </Boton>
                <Boton
                  variante="fantasma"
                  tamano="sm"
                  onClick={() => setMostrarFormulario(false)}
                >
                  <X size={14} />
                </Boton>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

/* ── Sección de seguimientos ── */
function SeccionSeguimientos({
  seguimientos,
  actividadId,
  onActualizar,
}: {
  seguimientos: Seguimiento[]
  actividadId: string
  onActualizar: (nuevos: Seguimiento[]) => void
}) {
  const formato = useFormato()
  const [nota, setNota] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [lista, setLista] = useState<Seguimiento[]>(seguimientos)
  const [abierto, setAbierto] = useState(false)

  const registrar = async () => {
    if (!nota.trim()) return
    setGuardando(true)
    try {
      const res = await fetch(`/api/actividades/${actividadId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accion: 'registrar_seguimiento', nota: nota.trim() }),
      })
      if (res.ok) {
        const data = await res.json()
        const nuevos = Array.isArray(data.seguimientos) ? data.seguimientos : []
        setLista(nuevos)
        onActualizar(nuevos)
        setNota('')
      }
    } finally { setGuardando(false) }
  }

  return (
    <div className="border-t border-borde-sutil pt-3 mt-1">
      <button
        onClick={() => setAbierto(!abierto)}
        className="flex items-center gap-2 text-sm font-medium text-texto-secundario bg-transparent border-none cursor-pointer hover:text-texto-primario transition-colors p-0 w-full"
      >
        <span className="flex items-center gap-1.5">
          🔥 Seguimientos
          {lista.length > 0 && (
            <span className="text-xs font-bold text-insignia-advertencia-texto bg-insignia-advertencia-fondo px-1.5 py-0.5 rounded-full">
              {lista.length}
            </span>
          )}
        </span>
        <ChevronDown size={14} className={`transition-transform ${abierto ? 'rotate-180' : ''}`} />
      </button>

      {abierto && (
        <div className="mt-2 space-y-2">
          {/* Timeline de seguimientos */}
          {lista.length > 0 && (
            <div className="space-y-1.5 max-h-[160px] overflow-y-auto">
              {[...lista].reverse().map((s) => (
                <div key={s.id} className="flex gap-2 text-xs py-1.5 px-2 rounded-lg bg-superficie-tarjeta">
                  <div className="shrink-0 mt-0.5">
                    <div className="size-5 rounded-full bg-insignia-advertencia-fondo flex items-center justify-center text-insignia-advertencia-texto text-xxs font-bold">
                      {s.registrado_por_nombre?.charAt(0)?.toUpperCase() || '?'}
                    </div>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-texto-primario">{s.nota}</p>
                    <p className="text-texto-terciario mt-0.5">
                      {s.registrado_por_nombre} · {formato.fecha(s.fecha, { corta: true, conHora: true })}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Input para nuevo seguimiento */}
          <div className="flex gap-2">
            <input
              value={nota}
              onChange={(e) => setNota(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); registrar() } }}
              placeholder="Ej: El cliente llamó preguntando..."
              className="flex-1 px-3 py-1.5 text-sm rounded-lg border border-borde-fuerte bg-superficie-tarjeta text-texto-primario placeholder:text-texto-terciario/50 outline-none focus:border-texto-marca transition-colors"
            />
            <Boton
              tamano="xs"
              onClick={registrar}
              cargando={guardando}
              disabled={!nota.trim()}
            >
              Registrar
            </Boton>
          </div>
        </div>
      )}
    </div>
  )
}

export { ModalActividad }
export type { Actividad, Miembro, Vinculo, Seguimiento, ItemChecklist }
