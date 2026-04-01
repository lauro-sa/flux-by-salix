'use client'

import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { ModalAdaptable as Modal } from '@/componentes/ui/ModalAdaptable'
import { Input } from '@/componentes/ui/Input'
import { Boton } from '@/componentes/ui/Boton'
import { Select } from '@/componentes/ui/Select'
import { SelectorFecha } from '@/componentes/ui/SelectorFecha'
import { obtenerIcono } from '@/componentes/ui/SelectorIcono'
import {
  Plus, Trash2, Search, X, Check, GripVertical,
  ChevronDown, User, Link2, CheckCircle, FileText,
  MapPin, Mail as MailIcon, Clock,
} from 'lucide-react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { crearClienteNavegador } from '@/lib/supabase/cliente'
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

interface PropiedadesModal {
  abierto: boolean
  actividad?: Actividad | null
  tipos: TipoActividad[]
  estados: EstadoActividad[]
  miembros: Miembro[]
  vinculoInicial?: Vinculo | null
  onGuardar: (datos: Record<string, unknown>) => Promise<void>
  onCompletar?: (id: string) => Promise<void>
  onPosponer?: (id: string, dias: number) => Promise<void>
  onCerrar: () => void
}

function ModalActividad({
  abierto, actividad, tipos, estados, miembros, vinculoInicial,
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
      const vincsIniciales = vinculoInicial ? [vinculoInicial] : []
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

  // Guardar
  const manejarGuardar = async () => {
    if (!titulo.trim() || !tipoId) return
    setGuardando(true)
    try {
      await onGuardar({
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
      onCerrar()
    } finally {
      setGuardando(false)
    }
  }

  return (
    <Modal
      abierto={abierto}
      onCerrar={onCerrar}
      titulo={esEdicion ? 'Editar actividad' : 'Nueva actividad'}
      tamano="lg"
      acciones={
        <>
          <Boton variante="secundario" tamano="sm" onClick={onCerrar}>Cancelar</Boton>
          <Boton tamano="sm" onClick={manejarGuardar} cargando={guardando} disabled={!titulo.trim() || !tipoId}>
            {esEdicion ? 'Guardar' : 'Crear actividad'}
          </Boton>
        </>
      }
    >
      <div className="space-y-5">
        {/* ── Acciones rápidas (solo en edición, actividad pendiente) ── */}
        {esEdicion && actividad && actividad.estado_clave !== 'completada' && actividad.estado_clave !== 'cancelada' && (
          <div className="flex flex-wrap gap-2">
            {/* Botón Completar */}
            {onCompletar && (
              <button
                onClick={async () => { await onCompletar(actividad.id); onCerrar() }}
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-sm font-medium bg-insignia-exito-fondo text-insignia-exito-texto border-none cursor-pointer hover:brightness-95 transition-all"
              >
                <CheckCircle size={15} />
                Completar
              </button>
            )}
            {/* Botón Posponer */}
            {onPosponer && (
              <div className="relative group">
                <button
                  className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-sm font-medium bg-insignia-advertencia-fondo text-insignia-advertencia-texto border-none cursor-pointer hover:brightness-95 transition-all"
                >
                  <Clock size={15} />
                  Posponer
                </button>
                {/* Dropdown de opciones */}
                <div className="absolute top-full left-0 mt-1 bg-superficie-elevada border border-borde-sutil rounded-lg shadow-lg overflow-hidden z-50 hidden group-hover:block min-w-[140px]">
                  {[
                    { etiqueta: '1 día', dias: 1 },
                    { etiqueta: '3 días', dias: 3 },
                    { etiqueta: '1 semana', dias: 7 },
                    { etiqueta: '2 semanas', dias: 14 },
                  ].map(op => (
                    <button
                      key={op.dias}
                      onClick={async () => { await onPosponer(actividad.id, op.dias); onCerrar() }}
                      className="w-full px-3 py-2 text-sm text-left text-texto-primario bg-transparent border-none cursor-pointer hover:bg-superficie-hover transition-colors"
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
                <button
                  onClick={() => { onCerrar(); router.push(accion.ruta(contacto?.id)) }}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-sm font-medium bg-texto-marca/10 text-texto-marca border-none cursor-pointer hover:bg-texto-marca/15 transition-all"
                >
                  <IconoAccion size={15} />
                  {accion.etiqueta}
                </button>
              )
            })()}
          </div>
        )}

        {/* ── Selector de tipo (pills visuales) ── */}
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
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-all cursor-pointer border ${
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

        {/* ── Vínculos ── */}
        <SeccionVinculos vinculos={vinculos} onChange={manejarCambioVinculos} />

        {/* ── Título ── */}
        <Input
          tipo="text"
          etiqueta="Título"
          value={titulo}
          onChange={(e) => { setTitulo(e.target.value); setTituloManual(true) }}
          placeholder="¿Qué hay que hacer?"
        />

        {/* ── Descripción (condicional) ── */}
        {tipoSeleccionado?.campo_descripcion && (
          <div>
            <label className="text-sm font-medium text-texto-secundario block mb-1">Descripción</label>
            <textarea
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              placeholder="Detalles adicionales..."
              rows={3}
              className="w-full px-3 py-2 text-sm rounded-lg border border-borde-fuerte bg-superficie-tarjeta text-texto-primario placeholder:text-texto-placeholder outline-none focus:border-texto-marca resize-none"
            />
          </div>
        )}

        {/* ── Fila: Fecha + Prioridad + Responsable ── */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {/* Fecha vencimiento */}
          {tipoSeleccionado?.campo_fecha && (
            <SelectorFecha
              valor={fechaVencimiento}
              onChange={(v) => setFechaVencimiento(v || '')}
              etiqueta="Vencimiento"
              limpiable
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
        </div>

        {/* ── Checklist (condicional) ── */}
        {tipoSeleccionado?.campo_checklist && (
          <SeccionChecklist checklist={checklist} onChange={setChecklist} />
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

function SeccionVinculos({ vinculos, onChange }: { vinculos: Vinculo[]; onChange: (v: Vinculo[]) => void }) {
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
            return (
              <span
                key={v.id}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-superficie-hover text-texto-primario"
              >
                <IconoV size={11} className="text-texto-terciario" />
                {v.nombre}
                <button
                  onClick={() => removerVinculo(v.id)}
                  className="inline-flex items-center justify-center size-4 rounded-full bg-transparent text-texto-terciario cursor-pointer border-none hover:text-texto-primario"
                >
                  <X size={10} />
                </button>
              </span>
            )
          })}
        </div>
      )}

      {/* Input de búsqueda — siempre visible */}
      <div className="relative">
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-borde-fuerte bg-superficie-tarjeta">
          <Search size={14} className="text-texto-terciario shrink-0" />
          <input
            type="text"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            onFocus={() => setFoco(true)}
            placeholder={TIPOS_VINCULO.find(t => t.clave === tabActivo)?.placeholder || 'Buscar...'}
            className="flex-1 bg-transparent border-none outline-none text-sm text-texto-primario placeholder:text-texto-placeholder"
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
                      className={`flex items-center gap-1.5 px-4 py-2 text-xs font-medium transition-colors cursor-pointer border-none ${
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
                        className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm text-left transition-colors border-none ${
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
                className={`size-5 rounded border-2 flex items-center justify-center shrink-0 cursor-pointer transition-colors mt-0.5 ${
                  item.completado
                    ? 'bg-texto-marca border-texto-marca'
                    : 'bg-transparent border-borde-fuerte hover:border-texto-marca'
                }`}
              >
                {item.completado && <Check size={12} className="text-white" />}
              </button>
              <div className="flex-1 min-w-0">
                <input
                  type="text"
                  value={item.texto}
                  onChange={(e) => editarItem(item.id, { texto: e.target.value })}
                  className={`w-full bg-transparent border-none outline-none text-sm ${
                    item.completado ? 'text-texto-terciario line-through' : 'text-texto-primario'
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
                      {new Date(item.fecha).toLocaleDateString('es-AR', { day: '2-digit', month: 'short' })}
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
              <button
                onClick={() => eliminarItem(item.id)}
                className="opacity-0 group-hover:opacity-100 text-texto-terciario cursor-pointer bg-transparent border-none hover:text-insignia-peligro-texto transition-opacity mt-0.5"
              >
                <X size={14} />
              </button>
            </div>
          )
        })}
      </div>

      {/* Agregar nuevo item */}
      <div className="flex items-center gap-2 mt-2">
        <Plus size={14} className="text-texto-terciario shrink-0" />
        <input
          type="text"
          value={nuevoTexto}
          onChange={(e) => setNuevoTexto(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && agregar()}
          placeholder="Agregar item..."
          className="flex-1 bg-transparent border-none outline-none text-sm text-texto-primario placeholder:text-texto-placeholder py-1"
        />
      </div>
    </div>
  )
}

export { ModalActividad }
export type { Actividad, Vinculo, ItemChecklist, Miembro }
