'use client'

import { useState, useEffect, useLayoutEffect, useCallback, useRef, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { ModalAdaptable as Modal } from '@/componentes/ui/ModalAdaptable'
import { Input } from '@/componentes/ui/Input'
import { Boton } from '@/componentes/ui/Boton'
import { Select } from '@/componentes/ui/Select'
import { TextArea } from '@/componentes/ui/TextArea'
import { SelectorFecha } from '@/componentes/ui/SelectorFecha'
import { SelectorHora } from '@/componentes/ui/SelectorHora'
import { obtenerIcono } from '@/componentes/ui/SelectorIcono'
import {
  Plus, Trash2, Search, X, Check, GripVertical,
  ChevronDown, User, Link2, CheckCircle, FileText,
  MapPin, Mail as MailIcon, Clock,
  Calendar, Wrench,
} from 'lucide-react'
import { PildoraEntidad } from '@/componentes/ui/PildoraEntidad'
import { useFormato } from '@/hooks/useFormato'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { crearClienteNavegador } from '@/lib/supabase/cliente'
import { SelectorCalendarioBloque } from './SelectorCalendarioBloque'
import type { TipoActividad } from '../configuracion/_tipos'
import type { EstadoActividad } from '../configuracion/secciones/SeccionEstados'
import { useTraduccion } from '@/lib/i18n'
import { DEBOUNCE_BUSQUEDA } from '@/lib/constantes/timeouts'
import { BarraPresetsModal } from '@/componentes/entidad/BarraPresetsModal'

// Forma del blob de valores guardados en un preset de actividad.
// Cada campo es opcional y solo se aplica si el tipo activo tiene el campo_X correspondiente.
interface ValoresPresetActividad {
  asignados?: { id: string; nombre: string }[]
  prioridad?: string
  descripcion?: string
  checklist?: { id: string; texto: string; completado: boolean }[]
}

/** Convierte fecha YYYY-MM-DD + hora HH:MM a ISO string respetando timezone local del navegador */
function fechaLocalAISO(fecha: string, hora: string): string {
  const [anio, mes, dia] = fecha.split('-').map(Number)
  const [h, m] = hora.split(':').map(Number)
  return new Date(anio, mes - 1, dia, h, m, 0).toISOString()
}

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
  asignados: { id: string; nombre: string }[]
  asignados_ids: string[]
  checklist: ItemChecklist[]
  vinculos: Vinculo[]
  seguimientos?: Seguimiento[]
  creado_por: string | null
  creado_por_nombre: string | null
  creado_en: string | null
  editado_por: string | null
  editado_por_nombre: string | null
  actualizado_en: string | null
}

interface Miembro {
  usuario_id: string
  nombre: string
  apellido: string
}

/** Mapeo tipo → acción inteligente */
const ACCIONES_TIPO: Record<string, { etiqueta: string; icono: typeof FileText; ruta: (contactoId?: string, actividadOrigenId?: string) => string }> = {
  presupuestar: { etiqueta: 'Crear presupuesto', icono: FileText, ruta: (cId, aId) => { const params = new URLSearchParams({ desde: '/actividades' }); if (cId) params.set('contacto_id', cId); if (aId) params.set('actividad_origen_id', aId); return `/presupuestos/nuevo?${params}` } },
  visita: { etiqueta: 'Ir a visitas', icono: MapPin, ruta: (cId, aId) => { const params = new URLSearchParams({ desde: '/actividades' }); if (cId) params.set('contacto_id', cId); if (aId) params.set('actividad_origen_id', aId); return `/visitas?${params}` } },
  correo: { etiqueta: 'Enviar correo', icono: MailIcon, ruta: (cId, aId) => { const params = new URLSearchParams({ desde: '/actividades' }); if (cId) params.set('contacto_id', cId); if (aId) params.set('actividad_origen_id', aId); return `/inbox?${params}` } },
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
  /** Clave del módulo desde donde se abre (ej: 'presupuestos', 'contactos'). Filtra tipos por modulos_disponibles. */
  modulo?: string
  onGuardar: (datos: Record<string, unknown>) => Promise<unknown>
  onCompletar?: (id: string) => Promise<void>
  onPosponer?: (id: string, dias: number) => Promise<void>
  onCerrar: () => void
  /** Callback para redirigir a ModalVisita cuando se selecciona tipo "visita" en creación */
  onCambiarAVisita?: (contacto?: { id: string; nombre: string }) => void
}

function ModalActividad({
  abierto, actividad, tipos, estados, miembros, presetsPosposicion, vinculoInicial,
  modulo, onGuardar, onCompletar, onPosponer, onCerrar, onCambiarAVisita,
}: PropiedadesModal) {
  const router = useRouter()
  const { t } = useTraduccion()
  const esEdicion = !!actividad
  // Filtrar tipos: solo activos + disponibles para el módulo actual (si se especifica)
  // modulos_disponibles usa plural (ej: "presupuestos"), entidadTipo puede ser singular (ej: "presupuesto")
  const tiposActivos = useMemo(() => tipos.filter(t => {
    if (!t.activo) return false
    if (modulo && t.modulos_disponibles?.length > 0) {
      const moduloPlural = modulo.endsWith('s') ? modulo : modulo + 's'
      if (!t.modulos_disponibles.includes(modulo) && !t.modulos_disponibles.includes(moduloPlural)) return false
    }
    return true
  }), [tipos, modulo])

  // Estado del formulario
  const [titulo, setTitulo] = useState('')
  const [descripcion, setDescripcion] = useState('')
  const [tipoId, setTipoId] = useState('')
  const [prioridad, setPrioridad] = useState('normal')
  const [fechaVencimiento, setFechaVencimiento] = useState('')
  const [asignados, setAsignados] = useState<{ id: string; nombre: string }[]>([])
  const [checklist, setChecklist] = useState<ItemChecklist[]>([])
  const [vinculos, setVinculos] = useState<Vinculo[]>([])
  const [guardando, setGuardando] = useState(false)
  const [tituloManual, setTituloManual] = useState(false)
  const [tiposExpandidos, setTiposExpandidos] = useState(false)
  const refTipos = useRef<HTMLDivElement>(null)

  // Cerrar selector de tipos al hacer click fuera
  useEffect(() => {
    if (!tiposExpandidos) return
    const handler = (e: MouseEvent) => {
      if (refTipos.current && !refTipos.current.contains(e.target as Node)) {
        setTiposExpandidos(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [tiposExpandidos])
  // Contador para forzar recarga de SeccionBloquesCalendario después de crear bloques
  const [recargaBloques, setRecargaBloques] = useState(0)

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
      setAsignados(Array.isArray(actividad.asignados) ? actividad.asignados : [])
      setChecklist(actividad.checklist || [])
      setVinculos(actividad.vinculos || [])
      setBloquesNuevos([])
      setTiposExpandidos(false)
    } else {
      const vincsIniciales = vinculoInicial
        ? Array.isArray(vinculoInicial) ? vinculoInicial : [vinculoInicial]
        : []
      const primerTipoId = tiposActivos[0]?.id || ''
      setTipoId(primerTipoId)
      setDescripcion('')
      setPrioridad('normal')
      setFechaVencimiento('')
      setAsignados([])
      setChecklist([])
      setVinculos(vincsIniciales)
      setTituloManual(false)
      setBloquesNuevos([])
      setTiposExpandidos(true)

      // Auto-título inteligente: resumen predeterminado > auto-generado
      const primerTipo = tiposActivos[0]
      if (primerTipo?.resumen_predeterminado) {
        const contacto = vincsIniciales.find(v => v.tipo === 'contacto')
        setTitulo(primerTipo.resumen_predeterminado.replace('{contacto}', contacto?.nombre || ''))
      } else {
        setTitulo(generarTituloAuto(primerTipoId, vincsIniciales))
      }

      // Nota predeterminada
      if (primerTipo?.nota_predeterminada) {
        setDescripcion(primerTipo.nota_predeterminada)
      }

      // Usuario predeterminado
      if (primerTipo?.usuario_predeterminado) {
        const m = miembros.find(m => m.usuario_id === primerTipo.usuario_predeterminado)
        if (m) setAsignados([{ id: m.usuario_id, nombre: `${m.nombre} ${m.apellido}`.trim() }])
      }

      // Auto-set fecha vencimiento según tipo
      if (primerTipo?.dias_vencimiento) {
        const fecha = new Date()
        fecha.setDate(fecha.getDate() + primerTipo.dias_vencimiento)
        setFechaVencimiento(fecha.toISOString().split('T')[0])
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [abierto])

  // Al cambiar tipo, actualizar título + fecha vencimiento + limpiar campos condicionales
  const manejarCambioTipo = (nuevoTipoId: string) => {
    // Si es creación y selecciona tipo "visita", redirigir al ModalVisita
    const tipoNuevo = tiposActivos.find(t => t.id === nuevoTipoId)
    if (!esEdicion && tipoNuevo?.clave === 'visita' && onCambiarAVisita) {
      const contacto = vinculos.find(v => v.tipo === 'contacto')
      onCerrar()
      onCambiarAVisita(contacto ? { id: contacto.id, nombre: contacto.nombre } : undefined)
      return
    }

    setTipoId(nuevoTipoId)
    // Auto-título si no editó manualmente
    if (!tituloManual) {
      setTitulo(generarTituloAuto(nuevoTipoId, vinculos))
    }

    const tipo = tipoNuevo

    // Limpiar campos que el nuevo tipo no usa (evita datos fantasma)
    if (tipo) {
      if (!tipo.campo_descripcion) setDescripcion('')
      else if (!esEdicion && tipo.nota_predeterminada) setDescripcion(tipo.nota_predeterminada)
      if (!tipo.campo_responsable) { setAsignados([]) }
      else if (!esEdicion && tipo.usuario_predeterminado) {
        const m = miembros.find(m => m.usuario_id === tipo.usuario_predeterminado)
        if (m) setAsignados([{ id: m.usuario_id, nombre: `${m.nombre} ${m.apellido}`.trim() }])
      }
      if (!tipo.campo_prioridad) setPrioridad('normal')
      if (!tipo.campo_checklist) setChecklist([])
      if (!tipo.campo_fecha) setFechaVencimiento('')
    }

    if (!esEdicion) {
      // Resumen predeterminado al cambiar tipo
      if (!tituloManual && tipo?.resumen_predeterminado) {
        const contacto = vinculos.find(v => v.tipo === 'contacto')
        setTitulo(tipo.resumen_predeterminado.replace('{contacto}', contacto?.nombre || ''))
      }
      if (tipo?.dias_vencimiento && tipo.campo_fecha) {
        const fecha = new Date()
        fecha.setDate(fecha.getDate() + tipo.dias_vencimiento)
        setFechaVencimiento(fecha.toISOString().split('T')[0])
      } else if (!tipo?.campo_fecha) {
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

  // ── Preset: snapshot de valores actuales para guardar como preset ──
  const valoresPresetActividad: ValoresPresetActividad = {
    asignados,
    prioridad,
    descripcion,
    checklist,
  }

  // ── Aplicar un preset al formulario (respeta los campos habilitados del tipo activo) ──
  const aplicarPresetActividad = useCallback((valores: ValoresPresetActividad) => {
    const tipo = tipoSeleccionado
    if (!tipo) return
    if (tipo.campo_responsable && Array.isArray(valores.asignados)) {
      setAsignados(valores.asignados)
    }
    if (tipo.campo_prioridad && typeof valores.prioridad === 'string') {
      setPrioridad(valores.prioridad)
    }
    if (tipo.campo_descripcion && typeof valores.descripcion === 'string') {
      setDescripcion(valores.descripcion)
    }
    if (tipo.campo_checklist && Array.isArray(valores.checklist)) {
      // Regenerar IDs para evitar colisiones; reset completado a false en creación
      setChecklist(valores.checklist.map(item => ({
        id: crypto.randomUUID(),
        texto: item.texto,
        completado: false,
      })))
    }
  }, [tipoSeleccionado])

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
        fecha_vencimiento: fechaVencimiento
          ? new Date(fechaVencimiento + 'T12:00:00').toISOString()
          : (bloquesNuevos.length > 0 ? new Date(bloquesNuevos[0].fecha + 'T12:00:00').toISOString() : null),
        asignados,
        asignados_ids: asignados.map(a => a.id),
        checklist,
        vinculos,
      })

      // Si es creación con bloques de calendario, crearlos después de la actividad
      if (!esEdicion && tipoConCalendario && bloquesNuevos.length > 0 && resultado && typeof resultado === 'object' && 'id' in resultado) {
        const actividadId = (resultado as { id: string }).id
        // Crear todos los bloques en paralelo — si alguno falla, los demás se crean igual
        const resultadosBloques = await Promise.allSettled(bloquesNuevos.map(bloque =>
          fetch('/api/calendario', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              titulo: titulo.trim(),
              fecha_inicio: fechaLocalAISO(bloque.fecha, bloque.horaInicio),
              fecha_fin: fechaLocalAISO(bloque.fecha, bloque.horaFin),
              tipo_clave: 'tarea',
              actividad_id: actividadId,
              asignados,
              vinculos,
              estado: 'confirmado',
            }),
          })
        ))
        const fallos = resultadosBloques.filter(r => r.status === 'rejected')
        if (fallos.length > 0) {
          console.error(`Error al crear ${fallos.length} bloque(s) de calendario:`, fallos)
        }
      }

      onCerrar()
    } finally {
      setGuardando(false)
    }
  }

  return (
    <>
    {/* Selector fullscreen: reemplaza todo cuando está abierto */}
    {selectorCalendarioAbierto && (
      <SelectorCalendarioBloque
        abierto
        bloques={bloquesNuevos}
        onCambiar={async (nuevos) => {
          if (esEdicion && actividad) {
            // En edición: crear los bloques nuevos directamente via API
            const resultados = await Promise.allSettled(nuevos.map(bloque =>
              fetch('/api/calendario', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  titulo: titulo || actividad.titulo,
                  fecha_inicio: fechaLocalAISO(bloque.fecha, bloque.horaInicio),
                  fecha_fin: fechaLocalAISO(bloque.fecha, bloque.horaFin),
                  tipo_clave: 'tarea',
                  actividad_id: actividad.id,
                  asignados,
                  vinculos,
                  estado: 'confirmado',
                }),
              })
            ))
            const fallos = resultados.filter(r => r.status === 'rejected')
            if (fallos.length > 0) console.error(`Error al crear ${fallos.length} bloque(s):`, fallos)
            // Si no tiene fecha de vencimiento, usar la fecha del primer bloque
            if (!fechaVencimiento && nuevos.length > 0) {
              const fechaBloque = nuevos[0].fecha
              setFechaVencimiento(fechaBloque)
              onGuardar({
                id: actividad.id,
                fecha_vencimiento: new Date(fechaBloque + 'T12:00:00').toISOString(),
              }).catch(() => {})
            }
            // Forzar recarga de SeccionBloquesCalendario
            setBloquesNuevos([])
            setRecargaBloques(c => c + 1)
          } else {
            // En creación: guardar para crear después al confirmar
            setBloquesNuevos(nuevos)
          }
          setSelectorCalendarioAbierto(false)
        }}
        onCerrar={() => setSelectorCalendarioAbierto(false)}
        titulo={titulo || 'Nuevo evento'}
      />
    )}

    <Modal
      abierto={abierto && !selectorCalendarioAbierto}
      onCerrar={onCerrar}
      titulo={esEdicion ? 'Editar actividad' : 'Nueva actividad'}
      tamano="5xl"
      sinPadding
      accionPrimaria={{
        etiqueta: esEdicion ? t('comun.guardar') : (tipoConCalendario && bloquesNuevos.length > 0 ? `${t('comun.crear')} y agendar` : `${t('comun.crear')} actividad`),
        onClick: manejarGuardar,
        cargando: guardando,
        disabled: !titulo.trim() || !tipoId,
      }}
      accionSecundaria={{
        etiqueta: t('comun.cancelar'),
        onClick: onCerrar,
      }}
      footerExtraIzquierda={!esEdicion ? (
        <BarraPresetsModal<ValoresPresetActividad>
          endpoint="/api/actividades/presets"
          scope={{ tipo_id: tipoId }}
          valoresActuales={valoresPresetActividad}
          onAplicar={aplicarPresetActividad}
          textoDeshabilitado="Elegí un tipo"
        />
      ) : undefined}
    >
      {/* ── Acciones rápidas (solo en edición, actividad pendiente) ── */}
      {esEdicion && actividad && actividad.estado_clave !== 'completada' && actividad.estado_clave !== 'cancelada' && (
        <div className="flex flex-wrap gap-2 px-7 py-3 border-b border-white/[0.07]">
          {onCompletar && (
            <Boton variante="exito" tamano="sm" redondeado icono={<CheckCircle size={15} />}
              onClick={async () => { await onCompletar(actividad.id); onCerrar() }}>
              Completar
            </Boton>
          )}
          {onPosponer && (
            <div className="relative group">
              <Boton variante="advertencia" tamano="sm" redondeado icono={<Clock size={15} />}>Posponer</Boton>
              <div className="absolute top-full left-0 mt-1 bg-superficie-elevada border border-borde-sutil rounded-card shadow-lg overflow-hidden z-50 hidden group-hover:block min-w-[140px]">
                {(presetsPosposicion ?? [
                  { id: '1d', etiqueta: '1 día', dias: 1 },
                  { id: '3d', etiqueta: '3 días', dias: 3 },
                  { id: '1s', etiqueta: '1 semana', dias: 7 },
                  { id: '2s', etiqueta: '2 semanas', dias: 14 },
                ]).map(op => (
                  <button key={op.id}
                    onClick={async () => { await onPosponer(actividad.id, op.dias); onCerrar() }}
                    className="w-full px-3 py-2 text-sm text-left text-texto-primario bg-transparent border-none cursor-pointer hover:bg-superficie-hover transition-colors">
                    {op.etiqueta}
                  </button>
                ))}
              </div>
            </div>
          )}
          {(() => {
            const tipoAct = tiposActivos.find(t => t.id === actividad.tipo_id)
            const accion = tipoAct ? ACCIONES_TIPO[tipoAct.clave] : null
            if (!accion || !tipoAct) return null
            const contacto = (actividad.vinculos as Vinculo[])?.find(v => v.tipo === 'contacto')
            const IconoAccion = accion.icono
            const actOrigenId = tipoAct.auto_completar ? actividad.id : undefined
            return (
              <Boton variante="fantasma" tamano="sm" redondeado icono={<IconoAccion size={15} />}
                onClick={() => { onCerrar(); router.push(accion.ruta(contacto?.id, actOrigenId)) }}
                className="bg-texto-marca/10 text-texto-marca hover:bg-texto-marca/15">
                {accion.etiqueta}
              </Boton>
            )
          })()}
        </div>
      )}

      {/* ══ Grid 2 columnas con divisor 1px ══ */}
      <div className="grid grid-cols-1 md:grid-cols-[1fr_1px_1fr] gap-0 border-y border-white/[0.07]">

        {/* ── COL IZQUIERDA — tipo, título, descripción, checklist ── */}
        <div className="space-y-0">
          {/* Tipo — colapsado muestra solo el seleccionado, expandido muestra todos */}
          <div className="p-6">
            <div className="flex items-center justify-between mb-2.5">
              <p className="text-[11px] font-medium text-texto-terciario uppercase tracking-wider">Tipo</p>
              {tipoSeleccionado && !tiposExpandidos && (
                <button
                  onClick={() => setTiposExpandidos(true)}
                  className="text-xxs text-texto-terciario hover:text-texto-marca bg-transparent border-none cursor-pointer transition-colors"
                >
                  Cambiar
                </button>
              )}
            </div>

            {/* Tipo seleccionado — pill solo */}
            {tipoSeleccionado && !tiposExpandidos && (() => {
              const IconoSel = obtenerIcono(tipoSeleccionado.icono)
              return (
                <button
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-card text-xs font-medium border-transparent text-white shadow-sm cursor-pointer border hover:opacity-85 transition-opacity"
                  style={{ backgroundColor: tipoSeleccionado.color }}
                  onClick={() => setTiposExpandidos(true)}
                >
                  {IconoSel && <IconoSel size={13} />}
                  {tipoSeleccionado.etiqueta}
                </button>
              )
            })()}

            {/* Todos los tipos — expandidos, se cierra con click fuera */}
            {tiposExpandidos && (
              <div className="flex flex-wrap gap-1.5" ref={refTipos}>
                {tiposActivos.map(tipo => {
                  const Icono = obtenerIcono(tipo.icono)
                  const sel = tipoId === tipo.id
                  return (
                    <button key={tipo.id} onClick={() => { manejarCambioTipo(tipo.id); setTiposExpandidos(false) }}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-card text-xs font-medium transition-all cursor-pointer border ${
                        sel ? 'border-transparent text-white shadow-sm' : 'bg-white/[0.03] text-texto-terciario border-white/[0.06] hover:text-texto-secundario hover:border-white/[0.12]'
                      }`}
                      style={sel ? { backgroundColor: tipo.color } : undefined}>
                      {Icono && <Icono size={13} />}
                      {tipo.etiqueta}
                    </button>
                  )
                })}
              </div>
            )}
          </div>

          {/* Título */}
          <div className="p-6">
            <p className="text-[11px] font-medium text-texto-terciario uppercase tracking-wider mb-2.5">Título</p>
            <Input tipo="text" value={titulo}
              onChange={(e) => { setTitulo(e.target.value); setTituloManual(true) }}
              placeholder="Título de la actividad..." />
          </div>

          {/* Descripción */}
          {tipoSeleccionado?.campo_descripcion && (
            <div className="p-6">
              <p className="text-[11px] font-medium text-texto-terciario uppercase tracking-wider mb-2.5">Descripción</p>
              <TextArea value={descripcion}
                onChange={(e) => setDescripcion(e.target.value)}
                placeholder="Detalles adicionales..." rows={4} />
            </div>
          )}

          {/* Checklist */}
          {tipoSeleccionado?.campo_checklist && (
            <div className="p-6">
              <SeccionChecklist checklist={checklist} onChange={setChecklist} />
            </div>
          )}

          {/* Seguimientos (solo edición) */}
          {esEdicion && (
            <div className="p-6">
              <SeccionSeguimientos
                seguimientos={(actividad?.seguimientos as Seguimiento[]) || []}
                actividadId={actividad!.id}
                onActualizar={(nuevos) => {
                  if (actividad) { (actividad as Actividad).seguimientos = nuevos }
                }}
              />
            </div>
          )}
        </div>

        {/* Divisor vertical */}
        <div className="hidden md:block bg-white/[0.07]" />

        {/* ── COL DERECHA — metadata y vínculos ── */}
        <div className="space-y-0">
          {/* Responsables (multi-select con chips) */}
          {tipoSeleccionado?.campo_responsable && (
            <div className="p-6">
              <p className="text-[11px] font-medium text-texto-terciario uppercase tracking-wider mb-2.5">
                Responsable{asignados.length > 1 ? 's' : ''}
              </p>
              {/* Chips de asignados */}
              {asignados.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {asignados.map(a => (
                    <PildoraEntidad
                      key={a.id}
                      nombre={a.nombre}
                      avatar={a.nombre}
                      onRemover={() => setAsignados(prev => prev.filter(x => x.id !== a.id))}
                    />
                  ))}
                </div>
              )}
              {/* Selector para agregar más */}
              <Select valor=""
                onChange={(val) => {
                  if (!val || asignados.some(a => a.id === val)) return
                  const m = miembros.find(m => m.usuario_id === val)
                  if (m) setAsignados(prev => [...prev, { id: m.usuario_id, nombre: `${m.nombre} ${m.apellido}`.trim() }])
                }}
                placeholder={asignados.length === 0 ? 'Sin asignar' : 'Agregar responsable...'}
                opciones={miembros
                  .filter(m => !asignados.some(a => a.id === m.usuario_id))
                  .map(m => ({ valor: m.usuario_id, etiqueta: `${m.nombre} ${m.apellido}`.trim() }))} />
            </div>
          )}

          {/* Prioridad + Fecha */}
          {(tipoSeleccionado?.campo_prioridad || tipoSeleccionado?.campo_fecha) && (
            <div className="p-6">
              <div className={`grid gap-3 ${tipoSeleccionado?.campo_prioridad && tipoSeleccionado?.campo_fecha ? 'grid-cols-2' : 'grid-cols-1'}`}>
                {tipoSeleccionado?.campo_prioridad && (
                  <div>
                    <p className="text-[11px] font-medium text-texto-terciario uppercase tracking-wider mb-2.5">Prioridad</p>
                    <Select valor={prioridad} onChange={setPrioridad}
                      opciones={[
                        { valor: 'baja', etiqueta: 'Baja' },
                        { valor: 'normal', etiqueta: 'Normal' },
                        { valor: 'alta', etiqueta: 'Alta' },
                      ]} />
                  </div>
                )}
                {tipoSeleccionado?.campo_fecha && (
                  <div className="min-w-0">
                    <p className="text-[11px] font-medium text-texto-terciario uppercase tracking-wider mb-2.5">Vencimiento</p>
                    <SelectorFecha valor={fechaVencimiento} onChange={(v) => setFechaVencimiento(v || '')} limpiable />
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Vínculos */}
          <div className="p-6">
            <SeccionVinculos vinculos={vinculos} onChange={manejarCambioVinculos} onNavegar={(ruta) => { onCerrar(); router.push(ruta) }} />
          </div>

          {/* Bloques de calendario — edición */}
          {esEdicion && actividad && (
            <div className="p-6">
              <SeccionBloquesCalendario actividadId={actividad.id} titulo={actividad.titulo}
                asignados={asignados} vinculos={vinculos} recarga={recargaBloques}
                onAbrirCalendario={() => setSelectorCalendarioAbierto(true)} />
            </div>
          )}

          {/* Bloques de calendario — creación */}
          {!esEdicion && tipoConCalendario && (
            <div className="p-6">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Calendar size={14} className="text-texto-terciario" />
                  <span className="text-xs font-medium text-texto-secundario">Agendar en calendario</span>
                </div>
                <button type="button" onClick={() => setSelectorCalendarioAbierto(true)}
                  className="text-xxs text-texto-marca font-medium bg-transparent border-none cursor-pointer hover:underline">
                  Abrir calendario
                </button>
              </div>
              {bloquesNuevos.length === 0 ? (
                <button type="button" onClick={() => setSelectorCalendarioAbierto(true)}
                  className="w-full py-4 px-3 rounded-card border border-dashed border-white/[0.08] text-xs text-texto-terciario hover:border-texto-marca/30 hover:text-texto-marca transition-colors bg-transparent cursor-pointer">
                  Sin bloques — tocá para abrir el calendario
                </button>
              ) : (
                <div className="space-y-1">
                  {bloquesNuevos.map((bloque, i) => (
                    <div key={i} className="flex items-center gap-2 px-2.5 py-1.5 rounded-card bg-white/[0.03] text-xs">
                      <span className="size-1.5 rounded-full bg-texto-marca shrink-0" />
                      <span className="text-texto-primario font-medium">{bloque.fecha}</span>
                      <span className="text-texto-terciario">{bloque.horaInicio} – {bloque.horaFin}</span>
                      <button type="button" onClick={() => setBloquesNuevos(prev => prev.filter((_, idx) => idx !== i))}
                        className="ml-auto text-texto-terciario hover:text-estado-error transition-colors">
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

    </Modal>
    </>
  )
}

// ══════════════════════════════════════════════════
// Sección Vínculos — input siempre visible, dropdown flotante
// Tabs: Contacto, Documento, Visita
// ══════════════════════════════════════════════════

const TIPOS_VINCULO = [
  { clave: 'contacto', etiqueta: 'Contacto', icono: User, placeholder: 'Buscar contacto...' },
  { clave: 'documento', etiqueta: 'Documento', icono: FileText, placeholder: 'Buscar presupuesto, factura...' },
  { clave: 'orden', etiqueta: 'Orden', icono: Wrench, placeholder: 'Buscar orden de trabajo...' },
]

const ICONOS_VINCULO: Record<string, typeof User> = {
  contacto: User,
  documento: FileText,
  presupuesto: FileText,
  factura: FileText,
  orden: Wrench,
  informe: FileText,
  visita: MapPin,
}

/** Ruta de navegación según tipo de vínculo */
const RUTAS_VINCULO: Record<string, (id: string) => string> = {
  contacto: (id) => `/contactos/${id}?desde=/actividades`,
  documento: (id) => `/presupuestos/${id}?desde=/actividades`,
  presupuesto: (id) => `/presupuestos/${id}?desde=/actividades`,
  factura: (id) => `/presupuestos/${id}?desde=/actividades`,
  orden: (id) => `/ordenes/${id}?desde=/actividades`,
  informe: (id) => `/presupuestos/${id}?desde=/actividades`,
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
  const inputWrapperRef = useRef<HTMLDivElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const [posicion, setPosicion] = useState({ top: 0, left: 0, width: 0 })

  // Calcular posición del dropdown relativa al viewport
  useLayoutEffect(() => {
    if (!foco || !inputWrapperRef.current) return
    const rect = inputWrapperRef.current.getBoundingClientRect()
    setPosicion({ top: rect.bottom + 4, left: rect.left, width: rect.width })
  }, [foco])

  // Cerrar dropdown al hacer click fuera
  useEffect(() => {
    if (!foco) return
    const handler = (e: MouseEvent) => {
      const target = e.target as Node
      if (contenedorRef.current?.contains(target)) return
      if (dropdownRef.current?.contains(target)) return
      requestAnimationFrame(() => setFoco(false))
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [foco])

  // Reposicionar al hacer scroll o resize
  useEffect(() => {
    if (!foco) return
    const handler = () => {
      if (inputWrapperRef.current) {
        const rect = inputWrapperRef.current.getBoundingClientRect()
        setPosicion({ top: rect.bottom + 4, left: rect.left, width: rect.width })
      }
    }
    window.addEventListener('scroll', handler, true)
    window.addEventListener('resize', handler)
    return () => {
      window.removeEventListener('scroll', handler, true)
      window.removeEventListener('resize', handler)
    }
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
        } else if (tabActivo === 'orden') {
          const res = await fetch('/api/ordenes?por_pagina=5')
          if (res.ok) {
            const data = await res.json()
            setRecientes((data.ordenes || []).map((o: { id: string; numero: string; titulo?: string }) => ({
              id: o.id,
              nombre: o.numero,
              apellido: o.titulo || '',
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
        } else if (tabActivo === 'orden') {
          const res = await fetch(`/api/ordenes?busqueda=${encodeURIComponent(busqueda)}&por_pagina=8`)
          if (res.ok) {
            const data = await res.json()
            setResultados((data.ordenes || []).map((o: { id: string; numero: string; titulo?: string }) => ({
              id: o.id,
              nombre: o.numero,
              apellido: o.titulo || '',
            })))
          }
        }
      } catch (err) { console.error('Error en vínculos:', err) }
      finally { setCargando(false) }
    }, DEBOUNCE_BUSQUEDA)
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
      <label className="text-xs font-medium text-texto-terciario flex items-center gap-1.5 mb-2">
        <Link2 size={12} />
        Vincular a
      </label>

      {/* Badges de vínculos actuales */}
      {vinculos.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-2">
          {vinculos.map(v => {
            const IconoV = ICONOS_VINCULO[v.tipo] || Link2
            const rutaVinculo = RUTAS_VINCULO[v.tipo]
            return (
              <PildoraEntidad
                key={v.id}
                nombre={v.nombre}
                icono={<IconoV size={11} />}
                onNavegar={rutaVinculo ? () => onNavegar?.(rutaVinculo(v.id)) : undefined}
                onRemover={() => removerVinculo(v.id)}
                compacto
              />
            )
          })}
        </div>
      )}

      {/* Input de búsqueda — siempre visible */}
      <div className="relative" ref={inputWrapperRef}>
        <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-boton border border-borde-sutil bg-superficie-tarjeta">
          <Search size={13} className="text-texto-terciario/50 shrink-0" />
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

        {/* Dropdown flotante — portal para evitar clipping en modales */}
        {typeof window !== 'undefined' && createPortal(
        <AnimatePresence>
          {foco && (
            <motion.div
              ref={dropdownRef}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 4 }}
              transition={{ duration: 0.12 }}
              className="fixed bg-superficie-elevada border border-borde-sutil rounded-card shadow-lg overflow-hidden"
              style={{
                top: posicion.top,
                left: posicion.left,
                width: posicion.width,
                zIndex: 'var(--z-popover)' as unknown as number,
              }}
            >
              {/* Tabs */}
              <div className="flex gap-0.5 p-1.5 border-b border-borde-sutil">
                {TIPOS_VINCULO.map(tv => {
                  const Ic = tv.icono
                  const activo = tabActivo === tv.clave
                  return (
                    <button
                      key={tv.clave}
                      onClick={() => { setTabActivo(tv.clave); setBusqueda('') }}
                      className={`flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-boton text-xxs font-medium transition-colors cursor-pointer border-none focus-visible:outline-2 focus-visible:outline-texto-marca focus-visible:-outline-offset-2 ${
                        activo
                          ? 'text-texto-marca bg-texto-marca/8'
                          : 'text-texto-terciario bg-transparent hover:text-texto-secundario hover:bg-superficie-hover'
                      }`}
                    >
                      <Ic size={12} />
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
                {(cargando && listaVisible.length === 0 ? (
                  <p className="text-xs text-texto-terciario text-center py-4">Buscando...</p>
                ) : listaVisible.length === 0 && busqueda.length >= 2 ? (
                  <p className="text-xs text-texto-terciario text-center py-4">Sin resultados</p>
                ) : listaVisible.length === 0 && esRecientes ? (
                  <p className="text-xs text-texto-terciario text-center py-4">Escribí para buscar</p>
                ) : (
                  listaVisible.map(item => {
                    const yaVinculado = vinculos.some(v => v.id === item.id)
                    const IconoTab = ICONOS_VINCULO[tabActivo] || User
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
                        <IconoTab size={15} className="text-texto-terciario shrink-0" />
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
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>,
        document.body
        )}
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
  asignados: asignadosProp,
  vinculos,
  recarga = 0,
  onAbrirCalendario,
}: {
  actividadId: string
  titulo: string
  asignados: { id: string; nombre: string }[]
  vinculos: Vinculo[]
  recarga?: number
  onAbrirCalendario?: () => void
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
        const res = await fetch(`/api/calendario?actividad_id=${actividadId}`)
        if (res.ok) {
          const datos = await res.json()
          setBloques(datos.eventos || [])
        }
      } catch {
        // Silenciar
      } finally {
        setCargando(false)
      }
    }
    cargar()
  }, [actividadId, recarga])

  // Crear un bloque nuevo
  const crearBloque = async () => {
    if (!nuevaFechaInicio || !nuevaHoraInicio || !nuevaHoraFin) return
    setCreando(true)
    try {
      const fechaInicio = fechaLocalAISO(nuevaFechaInicio, nuevaHoraInicio)
      const fechaFin = fechaLocalAISO(nuevaFechaInicio, nuevaHoraFin)

      const res = await fetch('/api/calendario', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          titulo,
          fecha_inicio: fechaInicio,
          fecha_fin: fechaFin,
          tipo_clave: 'tarea',
          actividad_id: actividadId,
          asignados: asignadosProp,
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
    <div className="space-y-3">
      {/* Encabezado */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Calendar size={14} className="text-texto-terciario" />
          <span className="text-xs font-medium text-texto-secundario">Bloques de calendario</span>
          {bloques.length > 0 && (
            <span className="text-xxs text-texto-terciario">
              {bloques.length} bloque{bloques.length !== 1 ? 's' : ''} · {horasTotales.toFixed(1)} hs
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {onAbrirCalendario && (
            <button type="button" onClick={onAbrirCalendario}
              className="text-xxs text-texto-marca font-medium bg-transparent border-none cursor-pointer hover:underline">
              Abrir calendario
            </button>
          )}
          <Boton
            variante="fantasma"
            tamano="xs"
            icono={<Plus size={14} />}
            onClick={() => setMostrarFormulario(!mostrarFormulario)}
          >
            Agendar
          </Boton>
        </div>
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
                  className="flex items-center gap-2 px-2.5 py-1.5 rounded-card bg-white/[0.03] group"
                >
                  <div
                    className="size-1.5 rounded-full shrink-0"
                    style={{ backgroundColor: bloque.color || '#F59E0B' }}
                  />
                  <span className="text-xs text-texto-primario font-medium">
                    {formato.fecha(bloque.fecha_inicio, { corta: true })}
                  </span>
                  <span className="text-xxs text-texto-terciario">
                    {formato.hora(bloque.fecha_inicio)} – {formato.hora(bloque.fecha_fin)}
                  </span>
                  <span className="text-xxs text-texto-terciario">
                    ({duracionHs.toFixed(1)} hs)
                  </span>
                  <button
                    className="ml-auto opacity-0 group-hover:opacity-100 transition-opacity text-texto-terciario hover:text-estado-error bg-transparent border-none cursor-pointer"
                    onClick={() => eliminarBloque(bloque.id)}
                  >
                    <X size={13} />
                  </button>
                </div>
              )
            })}
        </div>
      )}

      {cargando && (
        <p className="text-xxs text-texto-terciario italic">Cargando bloques...</p>
      )}

      {/* Estado vacío */}
      {!cargando && bloques.length === 0 && !mostrarFormulario && (
        <button type="button" onClick={onAbrirCalendario || (() => setMostrarFormulario(true))}
          className="w-full py-4 px-3 rounded-card border border-dashed border-white/[0.08] text-xs text-texto-terciario hover:border-texto-marca/30 hover:text-texto-marca transition-colors bg-transparent cursor-pointer">
          Sin bloques — tocá para agendar
        </button>
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
            <div className="flex flex-col sm:flex-row gap-2 p-3 bg-superficie-hover/30 rounded-card border border-borde-sutil">
              <SelectorFecha
                valor={nuevaFechaInicio}
                onChange={(v) => setNuevaFechaInicio(v || '')}
                etiqueta="Fecha"
              />
              <div className="flex gap-2 flex-1">
                <div className="flex-1">
                  <SelectorHora
                    etiqueta="Desde"
                    valor={nuevaHoraInicio}
                    onChange={(v) => setNuevaHoraInicio(v || '')}
                  />
                </div>
                <div className="flex-1">
                  <SelectorHora
                    etiqueta="Hasta"
                    valor={nuevaHoraFin}
                    onChange={(v) => setNuevaHoraFin(v || '')}
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
                <div key={s.id} className="flex gap-2 text-xs py-1.5 px-2 rounded-card bg-superficie-tarjeta">
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
            <Input
              value={nota}
              onChange={(e) => setNota(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); registrar() } }}
              placeholder="Ej: El cliente llamó preguntando..."
              compacto
              formato={null}
              className="flex-1"
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
