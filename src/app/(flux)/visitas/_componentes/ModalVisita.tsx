'use client'

import { useState, useEffect, useCallback } from 'react'
import { ModalAdaptable as Modal } from '@/componentes/ui/ModalAdaptable'
import { ModalConfirmacion } from '@/componentes/ui/ModalConfirmacion'
import { Input } from '@/componentes/ui/Input'
import { Boton } from '@/componentes/ui/Boton'
import { Select } from '@/componentes/ui/Select'
import { TextArea } from '@/componentes/ui/TextArea'
import { SelectorFecha } from '@/componentes/ui/SelectorFecha'
import { SelectorHora } from '@/componentes/ui/SelectorHora'
import {
  Plus, Trash2, X, Check, Clock,
  CheckCircle, User, PenLine, Sparkles, XCircle,
  MessageCircle, AlertTriangle,
} from 'lucide-react'
import { useFormato } from '@/hooks/useFormato'
import { crearClienteNavegador } from '@/lib/supabase/cliente'
import { useTraduccion } from '@/lib/i18n'
import { SelectorContacto, type ContactoResultado, type ContactoSeleccionado } from '@/componentes/entidad/SelectorContacto'
import { BarraPresetsModal } from '@/componentes/entidad/BarraPresetsModal'
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

// Forma del blob de valores guardados en un preset del modal de visita.
// Solo incluye campos que tiene sentido preseleccionar (no contacto ni fecha).
interface ValoresPresetVisita {
  asignado_a?: string | null
  asignado_nombre?: string | null
  hora?: string
  duracion_estimada_min?: number
  motivo?: string
  prioridad?: string
  checklist?: ItemChecklist[]
  notas?: string
}

interface PropiedadesModal {
  abierto: boolean
  visita?: Visita | null
  miembros: Miembro[]
  config?: ConfigVisitas | null
  /** Contacto a precargar al crear (ej: cliente del presupuesto/orden desde su chatter).
   *  Se ignora si `visita` viene seteada (modo edición). */
  contactoInicial?: { id: string; nombre: string; apellido?: string | null } | null
  onGuardar: (datos: Record<string, unknown>) => Promise<unknown>
  onCompletar?: (id: string) => Promise<void>
  onCancelar?: (id: string) => Promise<void>
  /** Si está seteado y la visita está en estado "provisoria", muestra el botón Confirmar (abre el modal de plantilla) */
  onConfirmarProvisoria?: (id: string) => void
  /** Si está seteado y la visita está en estado "provisoria", muestra el botón Rechazar */
  onRechazarProvisoria?: (id: string) => void
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
  // Si tiene al menos un teléfono móvil con flag WhatsApp en contacto_telefonos.
  // Lo usamos para autoseleccionar y para pintar el indicador en el chip.
  tiene_whatsapp: boolean
  // Número WA principal (es_whatsapp + es_principal). Cae al primer WA si no hay principal.
  whatsapp_principal: string | null
}

function ModalVisita({
  abierto,
  visita,
  miembros,
  config,
  contactoInicial,
  onGuardar,
  onCompletar,
  onCancelar,
  onConfirmarProvisoria,
  onRechazarProvisoria,
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

  // ── WhatsApp del contacto principal (si existe móvil flagueado en contacto_telefonos) ──
  // Cuando el contacto principal es persona, suele tener WA y la sección "Recibe" no es
  // crítica. Cuando es edificio/empresa, casi nunca tiene → hay que insistir con elegir un vinculado.
  const [contactoPrincipalTieneWA, setContactoPrincipalTieneWA] = useState<boolean>(false)

  // Flag para gestionar el flujo de "guardar sin canal de aviso" (mostrar confirm antes de guardar)
  const [confirmarSinCanalAbierto, setConfirmarSinCanalAbierto] = useState(false)
  // Marca para autoselección — se ejecuta solo en modo creación al cargar vinculados.
  const [autoseleccionDone, setAutoseleccionDone] = useState(false)

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
      // Si la visita NO tiene hora específica (programada solo por día), dejamos el
      // input vacío para que el usuario decida si pone hora o no. Si sí la tiene,
      // pre-llenamos con la guardada.
      setHoraProgramada(visita.tiene_hora_especifica ? fecha.toTimeString().slice(0, 5) : '')
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
      // Modo creación — precargar contacto si viene desde otro contexto (chatter), o limpiar
      if (contactoInicial) {
        const nombreCompleto = `${contactoInicial.nombre}${contactoInicial.apellido ? ` ${contactoInicial.apellido}` : ''}`.trim()
        setContactoId(contactoInicial.id)
        setContactoNombre(nombreCompleto)
        setContactoSeleccionado({
          id: contactoInicial.id,
          nombre: contactoInicial.nombre,
          apellido: contactoInicial.apellido ?? null,
          correo: null,
          telefono: null,
          tipo_contacto: null,
          numero_identificacion: null,
          condicion_iva: null,
          direccion: null,
        })
      } else {
        setContactoId('')
        setContactoNombre('')
        setContactoSeleccionado(null)
      }
      setDireccionId(null)
      setDireccionTexto('')
      setDireccionLat(null)
      setDireccionLng(null)
      setAsignadoA(null)
      setAsignadoNombre(null)
      const manana = new Date()
      manana.setDate(manana.getDate() + 1)
      setFechaProgramada(manana.toISOString().split('T')[0])
      // Hora vacía por default: la mayoría de empresas no programa hora exacta y nos
      // evitamos contaminar reportes con un "09:00" fantasma. Si el usuario quiere una
      // hora puntual la tipea; si no, la visita queda como "sin hora específica".
      setHoraProgramada('')
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
  }, [abierto, visita, config, contactoInicial])

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

  // ── Cargar contactos vinculados + flags de WhatsApp ──
  // En la misma carga resolvemos qué contactos (principal y vinculados) tienen un teléfono
  // móvil con flag WhatsApp en contacto_telefonos. Esa es la fuente real para los avisos:
  // si nadie en el set tiene WA, los modales del recorrido fallarían en runtime.
  useEffect(() => {
    if (!contactoId) {
      setVinculados([])
      setContactoPrincipalTieneWA(false)
      setAutoseleccionDone(false)
      return
    }
    setAutoseleccionDone(false)
    setCargandoVinculados(true)
    const supabase = crearClienteNavegador()
    // 1. Vinculaciones donde este contacto es el dueño
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
      .then(async ({ data }) => {
        const vinculadosBase: ContactoVinculado[] = (data || [])
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
              tiene_whatsapp: false,
              whatsapp_principal: null,
            }
          })

        // 2. Cargar todos los teléfonos WA (es_whatsapp = true) del contacto principal
        //    + de los vinculados, en una sola query
        const idsConsulta = [contactoId, ...vinculadosBase.map(v => v.vinculado_id)]
        const { data: telefonos } = await supabase
          .from('contacto_telefonos')
          .select('contacto_id, valor, es_principal')
          .in('contacto_id', idsConsulta)
          .eq('es_whatsapp', true)
          .order('es_principal', { ascending: false })

        // 3. Indexar por contacto_id (primero principal, fallback al primero)
        const waPorId = new Map<string, string>()
        for (const tel of telefonos || []) {
          if (!waPorId.has(tel.contacto_id)) {
            waPorId.set(tel.contacto_id, tel.valor)
          }
        }

        // 4. Hidratar flags
        const mapeados = vinculadosBase.map(v => ({
          ...v,
          tiene_whatsapp: waPorId.has(v.vinculado_id),
          whatsapp_principal: waPorId.get(v.vinculado_id) || null,
        }))

        setVinculados(mapeados)
        setContactoPrincipalTieneWA(waPorId.has(contactoId))
        setCargandoVinculados(false)
      })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contactoId])

  // ── Flags derivados para la lógica de avisos por WhatsApp ──
  // Avisos por WhatsApp habilitados a nivel empresa (config). Si está apagado,
  // toda la sección "Recibe" se oculta (no agrega valor).
  const avisosActivos = config?.enviar_avisos_whatsapp === true
  // Hay un canal de aviso utilizable: receptor con teléfono cargado a mano,
  // contacto vinculado con WA, o contacto principal con WA.
  const tieneReceptorElegido = !!(recibeContactoSeleccionado || (recibeModoManual && recibeTelefono))
  const algunVinculadoTieneWA = vinculados.some(v => v.tiene_whatsapp)
  const hayCanalDisponible = tieneReceptorElegido || algunVinculadoTieneWA || contactoPrincipalTieneWA
  // Mostrar banner cuando: avisos activos, hay canal posible (vinculados/principal con WA)
  // pero el usuario aún no fijó receptor. Le insiste a que clickee el chip.
  const mostrarBannerFaltaReceptor = avisosActivos && !cargandoVinculados && !tieneReceptorElegido && (algunVinculadoTieneWA || contactoPrincipalTieneWA)
  // Mostrar banner severo cuando: avisos activos, no hay receptor, y NADIE
  // (ni vinculados ni principal) tiene un móvil cargado. La visita se va a guardar
  // pero los avisos van a fallar — pedimos cargar a mano o agregar móvil al contacto.
  const mostrarBannerSinCanal = avisosActivos && !cargandoVinculados && !tieneReceptorElegido && !algunVinculadoTieneWA && !contactoPrincipalTieneWA

  // ── Autoselección: si hay un único vinculado con WhatsApp y aún no se eligió receptor,
  // lo fijamos automáticamente al cargar (solo en modo creación, una vez por contacto).
  useEffect(() => {
    if (!avisosActivos) return
    if (esEdicion) return
    if (autoseleccionDone) return
    if (cargandoVinculados) return
    if (recibeContactoId || recibeModoManual) return
    const conWA = vinculados.filter(v => v.tiene_whatsapp)
    if (conWA.length === 1) {
      const v = conWA[0]
      const nombre = `${v.nombre}${v.apellido ? ` ${v.apellido}` : ''}`.trim()
      setRecibeContactoId(v.vinculado_id)
      setRecibeNombre(nombre)
      setRecibeTelefono(v.whatsapp_principal || v.telefono || '')
      setRecibeContactoSeleccionado({
        id: v.vinculado_id,
        nombre: v.nombre,
        apellido: v.apellido,
        correo: null,
        telefono: v.whatsapp_principal || v.telefono,
        tipo_contacto: null,
        numero_identificacion: null,
        condicion_iva: null,
        direccion: null,
      })
    }
    setAutoseleccionDone(true)
  }, [avisosActivos, esEdicion, autoseleccionDone, cargandoVinculados, vinculados, recibeContactoId, recibeModoManual])

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

  // Seleccionar vinculado directamente (sin pasar por SelectorContacto).
  // Prefiere el teléfono WA principal si existe; cae al teléfono legacy si no.
  const seleccionarReceptorVinculado = (v: ContactoVinculado) => {
    const nombre = `${v.nombre}${v.apellido ? ` ${v.apellido}` : ''}`.trim()
    const tel = v.whatsapp_principal || v.telefono || ''
    setRecibeContactoId(v.vinculado_id)
    setRecibeNombre(nombre)
    setRecibeTelefono(tel)
    setRecibeContactoSeleccionado({
      id: v.vinculado_id,
      nombre: v.nombre,
      apellido: v.apellido,
      correo: null,
      telefono: tel || null,
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

  // ── Snapshot de los valores actuales para guardar como preset ──
  const valoresPreset: ValoresPresetVisita = {
    asignado_a: asignadoA,
    asignado_nombre: asignadoNombre,
    hora: horaProgramada,
    duracion_estimada_min: duracionEstimada,
    motivo,
    prioridad,
    checklist,
    notas,
  }

  // ── Aplicar un preset al formulario (hidrata los campos pertinentes) ──
  const aplicarPreset = useCallback((valores: ValoresPresetVisita) => {
    if (valores.asignado_a !== undefined) setAsignadoA(valores.asignado_a ?? null)
    if (valores.asignado_nombre !== undefined) setAsignadoNombre(valores.asignado_nombre ?? null)
    if (typeof valores.hora === 'string') setHoraProgramada(valores.hora)
    if (typeof valores.duracion_estimada_min === 'number') setDuracionEstimada(valores.duracion_estimada_min)
    if (typeof valores.motivo === 'string') setMotivo(valores.motivo)
    if (typeof valores.prioridad === 'string') setPrioridad(valores.prioridad)
    if (Array.isArray(valores.checklist)) {
      // Regenerar IDs para evitar colisiones con items existentes
      setChecklist(valores.checklist.map(item => ({
        id: crypto.randomUUID(),
        texto: item.texto,
        completado: false,
      })))
    }
    if (typeof valores.notas === 'string') setNotas(valores.notas)
  }, [])

  // ── Guardar ──
  // Si los avisos están activos y la visita no tiene ningún canal de aviso disponible
  // (ni receptor cargado, ni vinculados con WA, ni contacto principal con WA), pedimos
  // confirmación explícita antes de guardar — porque al iniciar el recorrido los modales
  // de aviso van a fallar y eso es trabajo perdido para quien arma el recorrido.
  const ejecutarGuardado = async () => {
    if (!contactoId || !fechaProgramada) return
    setGuardando(true)
    try {
      // Hora específica: true solo si el usuario tipeó una hora. Si quedó vacía,
      // guardamos un placeholder de medianoche (00:00) y marcamos el flag en false
      // para que la UI muestre "sin hora específica" en lugar del 00:00.
      const tieneHora = !!horaProgramada
      const [_a, _m, _d] = fechaProgramada.split('-').map(Number)
      const [_h, _mn] = tieneHora ? horaProgramada.split(':').map(Number) : [0, 0]
      const fechaCompleta = new Date(_a, _m - 1, _d, _h, _mn, 0).toISOString()
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
        tiene_hora_especifica: tieneHora,
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

  // Wrapper: si vamos a guardar y no hay canal disponible y los avisos están activos,
  // mostramos el confirm modal en vez de proceder. El usuario elige guardar igualmente
  // o volver al modal a cargar un teléfono / vinculado con WA.
  const manejarGuardar = async () => {
    if (!contactoId || !fechaProgramada) return
    if (avisosActivos && !hayCanalDisponible) {
      setConfirmarSinCanalAbierto(true)
      return
    }
    await ejecutarGuardado()
  }

  const esProvisoria = visita?.estado === 'provisoria'
  const esActiva = visita && !['completada', 'cancelada', 'provisoria'].includes(visita.estado)

  return (
    <>
    <Modal
      abierto={abierto}
      onCerrar={onCerrar}
      titulo={esEdicion ? `Visita — ${contactoNombre}` : t('visitas.nueva')}
      tamano="5xl"
      sinPadding
      alturaMovil="completo"
      accionPrimaria={{
        etiqueta: esEdicion ? t('comun.guardar') : t('visitas.nueva'),
        onClick: manejarGuardar,
        cargando: guardando,
        disabled: !contactoId || !fechaProgramada,
      }}
      accionSecundaria={{
        etiqueta: t('comun.cancelar'),
        onClick: onCerrar,
      }}
      footerExtraIzquierda={!esEdicion ? (
        <BarraPresetsModal<ValoresPresetVisita>
          endpoint="/api/visitas/presets"
          valoresActuales={valoresPreset}
          onAplicar={aplicarPreset}
        />
      ) : undefined}
    >
      {/* Banner prominente — visita provisoria creada por el agente IA */}
      {esEdicion && visita && esProvisoria && (
        <div
          className="px-7 py-4 border-b flex flex-col md:flex-row md:items-center gap-3"
          style={{
            background: 'var(--insignia-advertencia-fondo)',
            borderBottomColor: 'var(--insignia-advertencia-borde, var(--borde-sutil))',
            borderLeftWidth: 4,
            borderLeftStyle: 'solid',
            borderLeftColor: 'var(--insignia-advertencia)',
          }}
        >
          <div className="flex items-start gap-2.5 flex-1 min-w-0">
            <Sparkles
              size={18}
              className="shrink-0 mt-0.5"
              style={{ color: 'var(--insignia-advertencia-texto)' }}
            />
            <div className="min-w-0">
              <div className="text-sm font-semibold" style={{ color: 'var(--insignia-advertencia-texto)' }}>
                Visita pendiente de confirmación
              </div>
              <div className="text-xs mt-0.5" style={{ color: 'var(--insignia-advertencia-texto)', opacity: 0.85 }}>
                Creada automáticamente por el agente IA desde WhatsApp. Revisá los datos y confirmala al cliente.
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {onRechazarProvisoria && (
              <Boton
                variante="fantasma"
                tamano="sm"
                onClick={() => { onRechazarProvisoria(visita.id); onCerrar() }}
              >
                <XCircle size={14} className="mr-1.5" />
                Rechazar
              </Boton>
            )}
            {onConfirmarProvisoria && (
              <Boton
                variante="exito"
                tamano="sm"
                onClick={() => { onConfirmarProvisoria(visita.id); onCerrar() }}
              >
                <CheckCircle size={14} className="mr-1.5" />
                Confirmar visita
              </Boton>
            )}
          </div>
        </div>
      )}

      {/* Acciones rápidas en edición — activa: completar/cancelar */}
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
      <div className="grid grid-cols-1 md:grid-cols-[1.2fr_1px_1fr] gap-0 border-y border-white/[0.07] overflow-y-auto max-h-[calc(100dvh-200px)]">
        {/* ── COLUMNA IZQUIERDA ── */}
        <div className="space-y-0 min-w-0">
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

          {/* Quién recibe la visita — siempre visible cuando hay contacto seleccionado.
              Cuando los avisos por WhatsApp están activos en config, el copy y los banners
              se enfocan en "aviso automático". Cuando están off, sigue siendo información
              operativa útil para el visitador (saber a quién buscar y a qué número llamar
              manualmente al llegar). Ubicada después de Dirección porque es contexto previo
              al recorrido. */}
          {contactoId && (
            <div className="px-6 py-4 border-b border-white/[0.07]">
              <div className="flex items-center gap-2 mb-1">
                {avisosActivos ? (
                  <MessageCircle size={13} className="text-canal-whatsapp" />
                ) : (
                  <User size={13} className="text-texto-terciario" />
                )}
                <label className="text-[11px] font-medium text-texto-terciario uppercase tracking-wider">
                  {avisosActivos ? t('visitas.recibe_aviso_titulo') : t('visitas.recibe_visita_titulo')}
                </label>
              </div>
              <p className="text-xs text-texto-terciario mb-3 leading-relaxed">
                {avisosActivos ? t('visitas.recibe_aviso_desc') : t('visitas.recibe_visita_desc')}
              </p>

              {/* Banner ámbar: hay vinculados o contacto principal con WA, pero el usuario aún no fijó receptor */}
              {mostrarBannerFaltaReceptor && (
                <div
                  className="flex items-start gap-2 mb-3 px-3 py-2.5 rounded-card border-l-2"
                  style={{
                    background: 'var(--insignia-advertencia-fondo)',
                    borderLeftColor: 'var(--insignia-advertencia)',
                  }}
                >
                  <AlertTriangle size={14} className="shrink-0 mt-0.5" style={{ color: 'var(--insignia-advertencia-texto)' }} />
                  <div className="min-w-0">
                    <p className="text-xs font-semibold leading-tight" style={{ color: 'var(--insignia-advertencia-texto)' }}>
                      {t('visitas.recibe_falta_titulo')}
                    </p>
                    <p className="text-[11px] mt-0.5 leading-snug" style={{ color: 'var(--insignia-advertencia-texto)', opacity: 0.85 }}>
                      {t('visitas.recibe_falta_desc')}
                    </p>
                  </div>
                </div>
              )}

              {/* Banner severo: nadie tiene WA cargado — sugerir cargar a mano o agregar móvil */}
              {mostrarBannerSinCanal && (
                <div
                  className="flex items-start gap-2 mb-3 px-3 py-2.5 rounded-card border-l-2"
                  style={{
                    background: 'var(--insignia-peligro-fondo)',
                    borderLeftColor: 'var(--insignia-peligro)',
                  }}
                >
                  <AlertTriangle size={14} className="shrink-0 mt-0.5" style={{ color: 'var(--insignia-peligro)' }} />
                  <div className="min-w-0">
                    <p className="text-xs font-semibold leading-tight" style={{ color: 'var(--insignia-peligro)' }}>
                      {t('visitas.sin_canal_aviso_titulo')}
                    </p>
                    <p className="text-[11px] mt-0.5 leading-snug text-texto-secundario">
                      {t('visitas.sin_canal_aviso_desc')}
                    </p>
                  </div>
                </div>
              )}

              {/* Receptor ya seleccionado de un contacto existente — pill compacto.
                  Solo se muestra cuando el receptor vino de un vinculado o búsqueda
                  (recibeContactoSeleccionado != null). El modo manual mantiene sus inputs
                  abiertos mientras el usuario tipea para que pueda completar nombre + teléfono.
                  Ícono cambia según si los avisos por WhatsApp están activos: WA verde
                  cuando sí, persona cuando no (evita sugerir aviso automático que no va a llegar). */}
              {recibeContactoSeleccionado ? (
                <div className="space-y-2">
                  <div className="inline-flex items-center gap-2 px-3 py-2 rounded-card border border-texto-marca/40 bg-texto-marca/10">
                    {avisosActivos ? (
                      <MessageCircle size={13} className="text-texto-marca shrink-0" />
                    ) : (
                      <User size={13} className="text-texto-marca shrink-0" />
                    )}
                    <div className="min-w-0">
                      <span className="text-sm font-medium text-texto-primario">
                        {recibeNombre}
                      </span>
                      {recibeTelefono && (
                        <span className="text-xs text-texto-terciario ml-2">
                          {recibeTelefono}
                        </span>
                      )}
                    </div>
                    <button
                      onClick={limpiarReceptor}
                      className="text-texto-terciario hover:text-estado-error transition-colors shrink-0"
                      aria-label={t('comun.cancelar')}
                    >
                      <X size={14} />
                    </button>
                  </div>
                </div>
              ) : recibeModoManual ? (
                /* ── Modo manual: inputs libres con auto-formato.
                    Nombre: capitalización tipo "Juan Pérez". Teléfono: formato AR/internacional
                    con preview "Se guardará como +54 9 11 1234-5678". ── */
                <div className="space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <Input
                      value={recibeNombre}
                      onChange={(e) => setRecibeNombre(e.target.value)}
                      placeholder="Nombre"
                      formato="nombre_persona"
                    />
                    <Input
                      tipo="tel"
                      value={recibeTelefono}
                      onChange={(e) => setRecibeTelefono(e.target.value)}
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
                /* ── Modo buscador: empty state + vinculados clickeables + SelectorContacto ── */
                <div className="space-y-3">
                  {/* Empty state explícito: comunica que NO hay receptor elegido todavía
                      y le dice al usuario qué hacer. Tinte de advertencia sutil (borde
                      punteado + ícono + título en color advertencia, fondo apenas teñido)
                      para que se note que falta un paso, sin saturar visualmente. */}
                  <div className="rounded-card border border-dashed border-insignia-advertencia/40 bg-insignia-advertencia/[0.04] px-3 py-2.5">
                    <div className="flex items-center gap-1.5">
                      <AlertTriangle size={13} className="text-insignia-advertencia" />
                      <span className="text-xs font-medium text-insignia-advertencia">
                        {t('visitas.recibe_vacio_titulo')}
                      </span>
                    </div>
                    <p className="text-[11px] text-texto-terciario mt-0.5 leading-snug">
                      {t('visitas.recibe_vacio_desc')}
                    </p>
                  </div>

                  {/* Sugerencias rápidas: contactos vinculados como botones explícitos para elegir.
                      Cada chip lleva ícono "+" para comunicar acción de agregar; los que tienen
                      WhatsApp llevan badge verde adicional al final del nombre. */}
                  {vinculados.length > 0 && !cargandoVinculados && (
                    <div>
                      <span className="text-[10px] font-medium text-texto-terciario uppercase tracking-wider">
                        {t('visitas.recibe_tocar_para_elegir')}
                      </span>
                      <div className="flex flex-wrap gap-1.5 mt-1.5">
                        {[...vinculados]
                          .sort((a, b) => Number(b.tiene_whatsapp) - Number(a.tiene_whatsapp))
                          .map(v => {
                            const nombre = `${v.nombre}${v.apellido ? ` ${v.apellido}` : ''}`.trim()
                            return (
                              <button
                                key={v.id}
                                onClick={() => seleccionarReceptorVinculado(v)}
                                title={v.tiene_whatsapp ? t('visitas.tiene_whatsapp') : t('visitas.sin_whatsapp')}
                                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-card border border-borde-sutil bg-white/[0.03] text-xs text-texto-secundario hover:bg-texto-marca/10 hover:border-texto-marca/40 hover:text-texto-primario transition-colors"
                              >
                                <Plus size={11} className="text-texto-marca" />
                                <span>{nombre}</span>
                                {v.puesto && (
                                  <span className="text-xxs text-texto-terciario">· {v.puesto}</span>
                                )}
                                {v.tiene_whatsapp && (
                                  <MessageCircle size={11} className="text-canal-whatsapp ml-0.5" />
                                )}
                              </button>
                            )
                          })}
                      </div>
                    </div>
                  )}

                  {/* SelectorContacto para buscar cualquier contacto */}
                  <SelectorContacto
                    contacto={null}
                    onChange={manejarSeleccionReceptor}
                    sinAlertaCorreo
                    sinDatosFiscales
                    placeholder={t('visitas.buscar_contacto_recibe')}
                  />

                  {/* Opción cargar a mano */}
                  <button
                    onClick={() => { limpiarReceptor(); setRecibeModoManual(true) }}
                    className="text-xs text-texto-terciario hover:text-texto-secundario transition-colors flex items-center gap-1"
                  >
                    <PenLine size={12} />
                    {t('visitas.cargar_a_mano')}
                  </button>
                </div>
              )}
            </div>
          )}

        </div>

        {/* DIVISOR */}
        <div className="hidden md:block bg-white/[0.07]" />

        {/* ── COLUMNA DERECHA ── */}
        <div className="space-y-0 min-w-0">
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
                placeholder="Hora opcional"
              />
            </div>
            {!horaProgramada && (
              <p className="text-[11px] text-texto-terciario mt-1.5 leading-snug">
                Sin hora específica — la visita queda programada para el día. La hora real
                queda registrada cuando el visitador la inicia.
              </p>
            )}
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
                  className="w-20 px-2 py-1.5 rounded-card border border-white/[0.06] bg-white/[0.03] text-sm text-texto-primario text-center focus:outline-none focus:ring-1 focus:ring-texto-marca/40"
                />
                <span className="text-xs text-texto-terciario">{t('visitas.minutos')}</span>
              </div>
            </div>
          </div>

          {/* Motivo + Prioridad — unificados en una sola sección porque conceptualmente
              son la "naturaleza" de la visita: qué se va a hacer y con qué urgencia.
              Las píldoras de prioridad son compactas para que no compitan con el motivo. */}
          <div className="px-6 py-4 border-b border-white/[0.07] space-y-3">
            <div>
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

            {/* Prioridad inline: label chico + píldoras compactas en la misma fila */}
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[10px] font-medium text-texto-terciario uppercase tracking-wider">
                {t('visitas.prioridad')}
              </span>
              <div className="flex gap-1">
                {(['baja', 'normal', 'alta', 'urgente'] as const).map(p => (
                  <button
                    key={p}
                    onClick={() => setPrioridad(p)}
                    className={`px-2 py-0.5 rounded-card text-[11px] font-medium border transition-colors ${
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
          </div>

          {/* Checklist */}
          <div className="px-6 py-4 border-b border-white/[0.07]">
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
      </div>
    </Modal>

    {/* Confirmación al guardar cuando avisos están activos pero no hay canal disponible.
        Permite al usuario continuar guardando aún sabiendo que los avisos no se enviarán
        (ej: cliente ya avisado por otro medio), o volver a cargar un teléfono. */}
    <ModalConfirmacion
      abierto={confirmarSinCanalAbierto}
      onCerrar={() => setConfirmarSinCanalAbierto(false)}
      onConfirmar={async () => {
        setConfirmarSinCanalAbierto(false)
        await ejecutarGuardado()
      }}
      titulo={t('visitas.confirmar_sin_canal_titulo')}
      descripcion={t('visitas.confirmar_sin_canal_desc')}
      tipo="advertencia"
      etiquetaConfirmar={t('visitas.guardar_igualmente')}
      cargando={guardando}
    />
    </>
  )
}

export { ModalVisita }
