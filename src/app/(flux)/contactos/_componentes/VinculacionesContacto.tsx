'use client'

import { useState, useCallback, useEffect, useLayoutEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Link2, Search, X, UserPlus, FileCheck, Phone, Mail, ExternalLink,
  ChevronRight, Plus, Building2, User, Truck,
  Smartphone, Briefcase, Home as HomeIcon,
} from 'lucide-react'
import { Avatar } from '@/componentes/ui/Avatar'
import { Input } from '@/componentes/ui/Input'
import { Checkbox } from '@/componentes/ui/Checkbox'
import { Insignia, type ColorInsignia } from '@/componentes/ui/Insignia'
import { Select } from '@/componentes/ui/Select'
import { ModalAdaptable as Modal } from '@/componentes/ui/ModalAdaptable'
import { Boton } from '@/componentes/ui/Boton'
import { ModalConfirmacion } from '@/componentes/ui/ModalConfirmacion'
import { IconoWhatsApp } from '@/componentes/iconos/IconoWhatsApp'
import { TextoTelefono } from '@/componentes/ui/TextoTelefono'
import { normalizarTelefono } from '@/lib/validaciones'
import { normalizarListaTelefonos } from '@/lib/contacto-telefonos'
import { COLOR_TIPO_CONTACTO } from '@/lib/colores_entidad'
import { useTraduccion } from '@/lib/i18n'
import { CargadorInline } from '@/componentes/ui/Cargador'
import { useToast } from '@/componentes/feedback/Toast'
import { DEBOUNCE_BUSQUEDA } from '@/lib/constantes/timeouts'

// ─── Tipos ───

interface VinculoUI {
  id: string
  vinculado_id: string
  nombre: string
  apellido: string | null
  correo: string | null
  telefono: string | null
  codigo: string
  tipo_clave: string
  tipo_etiqueta: string
  tipo_color: string
  puesto: string | null
  recibe_documentos: boolean
  tipo_relacion_id: string | null
  tipo_relacion_etiqueta: string | null
}

interface ContactoBusqueda {
  id: string
  nombre: string
  apellido: string | null
  correo: string | null
  telefono: string | null
  codigo: string
  tipo_contacto: { clave: string; etiqueta: string; color: string }
}

/** Hijo de un contenedor (viene del endpoint /hijos) */
interface HijoContenedor extends ContactoBusqueda {
  puesto_en_contenedor: string | null
}

interface TipoRelacion {
  id: string
  clave: string
  etiqueta: string
  etiqueta_inversa: string
}

interface PuestoVinculacion {
  id: string
  etiqueta: string
}

interface Props {
  contactoId: string
  nombreContacto?: string
  vinculaciones: VinculoUI[]
  vinculacionesInversas: VinculoUI[]
  tiposRelacion: TipoRelacion[]
  puestosVinculacion?: PuestoVinculacion[]
  etiquetasConfig?: { nombre: string; color: string }[]
  rubrosConfig?: { nombre: string }[]
  onActualizar: () => void
}

// Tipos de contacto que pueden tener hijos (contenedores)
const TIPOS_CONTENEDOR = ['empresa', 'edificio', 'proveedor']

/** Ícono que representa al teléfono según tipo. Móvil siempre se muestra como WhatsApp
 *  (convención AR). Reusado en el modal de edición rápida y en el de crear-y-vincular
 *  para consistencia con TelefonosContacto. */
function iconoParaTipoTelefono(tipo: string) {
  switch (tipo) {
    case 'movil': return <IconoWhatsApp size={14} />
    case 'fijo': return <Phone size={14} />
    case 'trabajo': return <Briefcase size={14} />
    case 'casa': return <HomeIcon size={14} />
    default: return <Phone size={14} />
  }
}

function colorIconoTipoTelefono(tipo: string): string {
  return tipo === 'movil' ? 'text-texto-marca' : 'text-texto-terciario'
}

// Tipos de contacto para creación inline
const TIPOS_CONTACTO_CREAR = [
  { clave: 'persona', etiqueta: 'Persona' },
  { clave: 'empresa', etiqueta: 'Empresa' },
  { clave: 'proveedor', etiqueta: 'Proveedor' },
]

/**
 * VinculacionesContacto — Sección de relaciones en el detalle de contacto.
 * Muestra dos secciones: "Contactos vinculados" (editables) y "Vinculado en" (read-only).
 * Incluye buscador jerárquico, modal de edición rápida, y crear contacto inline.
 */
export function VinculacionesContacto({
  contactoId,
  nombreContacto,
  vinculaciones,
  vinculacionesInversas,
  tiposRelacion,
  puestosVinculacion = [],
  etiquetasConfig = [],
  rubrosConfig = [],
  onActualizar,
}: Props) {
  const { t } = useTraduccion()
  const { mostrar } = useToast()
  // Puestos sugeridos: usar los de la BD, o fallback hardcodeado
  const puestosSugeridos = puestosVinculacion.length > 0
    ? puestosVinculacion.map(p => p.etiqueta)
    : ['Encargado', 'Propietario', 'Administrador', 'Técnico', 'Inquilino', 'Empleado', 'Gerente', 'Director']
  // ─── Estado del modal de vincular ───
  const [modalVincular, setModalVincular] = useState(false)
  const [busqueda, setBusqueda] = useState('')
  const [resultados, setResultados] = useState<ContactoBusqueda[]>([])
  const [hijosContenedor, setHijosContenedor] = useState<Record<string, HijoContenedor[]>>({})
  const [contenedoresExpandidos, setContenedoresExpandidos] = useState<Set<string>>(new Set())
  const [buscando, setBuscando] = useState(false)
  const [vinculando, setVinculando] = useState(false)

  // Paso 2 del modal vincular: configurar el vínculo
  const [seleccionado, setSeleccionado] = useState<ContactoBusqueda | null>(null)
  const [puesto, setPuesto] = useState('')
  const [tipoRelacionId, setTipoRelacionId] = useState('')
  const [recibeDocumentos, setRecibeDocumentos] = useState(false)
  const [bidireccional, setBidireccional] = useState(false)

  // ─── Estado del modal de edición rápida ───
  const [modalEdicion, setModalEdicion] = useState(false)
  // Incluye esEntrante para saber en qué dirección mandar el PATCH al endpoint.
  const [vinculoEditando, setVinculoEditando] = useState<(VinculoUI & { esEntrante: boolean }) | null>(null)
  const [edicionNombre, setEdicionNombre] = useState('')
  const [edicionCorreo, setEdicionCorreo] = useState('')
  // Edición rápida: UN teléfono principal con tipo. WhatsApp se deriva del tipo
  // (movil → WA implícito). Para edición completa de la lista, abrir la ficha.
  const [edicionTelefono, setEdicionTelefono] = useState('')
  const [edicionTipoTelefono, setEdicionTipoTelefono] = useState<string>('movil')
  const [edicionPuesto, setEdicionPuesto] = useState('')
  const [edicionRecibeDoc, setEdicionRecibeDoc] = useState(false)
  const [guardandoEdicion, setGuardandoEdicion] = useState(false)

  // ─── Estado de creación inline (dentro del mismo modal) ───
  const [modoCrear, setModoCrear] = useState(false)
  const [crearNombre, setCrearNombre] = useState('')
  const [crearTipoClave, setCrearTipoClave] = useState('persona')
  const [crearCorreo, setCrearCorreo] = useState('')
  const [crearTelefono, setCrearTelefono] = useState('')
  // Tipo del teléfono al crear (movil, fijo, trabajo, casa, otro). Default movil
  // (movil → WhatsApp implícito por convención AR).
  const [crearTipoTelefono, setCrearTipoTelefono] = useState<string>('movil')
  const [crearPuesto, setCrearPuesto] = useState('')
  const [crearCargo, setCrearCargo] = useState('')
  const [crearRubro, setCrearRubro] = useState('')
  const [crearTipoRelacionId, setCrearTipoRelacionId] = useState('')
  const [crearEtiquetas, setCrearEtiquetas] = useState<string[]>([])
  const [crearBidireccional, setCrearBidireccional] = useState(false)
  const [creando, setCreando] = useState(false)

  // ─── Recientes (se cargan al abrir el modal sin buscar) ───
  const [recientes, setRecientes] = useState<ContactoBusqueda[]>([])
  const [cargandoRecientes, setCargandoRecientes] = useState(false)

  // ─── Modal de confirmación para desvincular ───
  const [confirmarDesvincular, setConfirmarDesvincular] = useState<{
    vinculadoId: string
    esEntrante: boolean
    nombre: string
  } | null>(null)
  const [desvinculando, setDesvinculando] = useState(false)

  // IDs ya vinculados para filtrar en búsqueda
  const idsVinculados = new Set([
    contactoId,
    ...vinculaciones.map(v => v.vinculado_id),
    ...vinculacionesInversas.map(v => v.vinculado_id),
  ])

  // ═══════════════════════════════════════════════════════════════
  // CARGAR RECIENTES al abrir el modal
  // ═══════════════════════════════════════════════════════════════

  useEffect(() => {
    if (!modalVincular) return
    setCargandoRecientes(true)
    fetch('/api/contactos?por_pagina=10&orden_campo=creado_en&orden_dir=desc')
      .then(r => r.json())
      .then(data => {
        const contactos: ContactoBusqueda[] = (data.contactos || []).filter(
          (c: ContactoBusqueda) => !idsVinculados.has(c.id)
        )
        setRecientes(contactos)
      })
      .catch(() => setRecientes([]))
      .finally(() => setCargandoRecientes(false))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modalVincular])

  // ═══════════════════════════════════════════════════════════════
  // BÚSQUEDA JERÁRQUICA
  // ═══════════════════════════════════════════════════════════════

  useEffect(() => {
    if (!modalVincular || busqueda.length < 2) {
      setResultados([])
      setHijosContenedor({})
      setContenedoresExpandidos(new Set())
      return
    }

    const timeout = setTimeout(async () => {
      setBuscando(true)
      try {
        const res = await fetch(`/api/contactos?busqueda=${encodeURIComponent(busqueda)}&por_pagina=15`)
        const data = await res.json()
        const contactos: ContactoBusqueda[] = (data.contactos || []).filter(
          (c: ContactoBusqueda) => !idsVinculados.has(c.id)
        )
        setResultados(contactos)

        // Para contenedores (empresa/edificio/proveedor), buscar sus hijos
        const idsContenedores = contactos
          .filter(c => TIPOS_CONTENEDOR.includes(c.tipo_contacto?.clave))
          .map(c => c.id)

        if (idsContenedores.length > 0) {
          const resHijos = await fetch(`/api/contactos/vinculaciones/hijos?ids=${idsContenedores.join(',')}`)
          const dataHijos = await resHijos.json()
          setHijosContenedor(dataHijos.hijos || {})
          // Auto-expandir contenedores que tienen hijos
          const conHijos = new Set(
            idsContenedores.filter(id => (dataHijos.hijos?.[id] || []).length > 0)
          )
          setContenedoresExpandidos(conHijos)
        } else {
          setHijosContenedor({})
        }
      } catch {
        setResultados([])
      } finally {
        setBuscando(false)
      }
    }, DEBOUNCE_BUSQUEDA)

    return () => clearTimeout(timeout)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [busqueda, modalVincular])

  // ═══════════════════════════════════════════════════════════════
  // ACCIONES
  // ═══════════════════════════════════════════════════════════════

  /** Vincular un contacto existente (uni o bidireccional) */
  const vincular = useCallback(async () => {
    if (!seleccionado || vinculando) return
    setVinculando(true)
    try {
      // Crear vínculo A → B
      await fetch('/api/contactos/vinculaciones', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contacto_id: contactoId,
          vinculado_id: seleccionado.id,
          tipo_relacion_id: tipoRelacionId || null,
          puesto: puesto || null,
          recibe_documentos: recibeDocumentos,
        }),
      })

      // Si es bidireccional, crear también B → A
      if (bidireccional) {
        await fetch('/api/contactos/vinculaciones', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contacto_id: seleccionado.id,
            vinculado_id: contactoId,
            tipo_relacion_id: tipoRelacionId || null,
            puesto: null,
            recibe_documentos: false,
          }),
        })
      }

      cerrarModalVincular()
      onActualizar()
      mostrar('exito', 'Contacto vinculado correctamente')
    } catch {
      mostrar('error', 'Error al vincular el contacto')
    } finally { setVinculando(false) }
  }, [seleccionado, contactoId, tipoRelacionId, puesto, recibeDocumentos, bidireccional, vinculando, onActualizar])

  /** Desvincular un contacto respetando la dirección del vínculo.
   *  Si es entrante (el otro es el dueño), se mandan los IDs invertidos. */
  const desvincular = useCallback(async (otroId: string, esEntrante: boolean) => {
    const payload = esEntrante
      ? { contacto_id: otroId, vinculado_id: contactoId }
      : { contacto_id: contactoId, vinculado_id: otroId }
    setDesvinculando(true)
    try {
      await fetch('/api/contactos/vinculaciones', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      onActualizar()
      mostrar('exito', 'Vinculación eliminada')
      setConfirmarDesvincular(null)
    } catch {
      mostrar('error', 'Error al desvincular')
    } finally {
      setDesvinculando(false)
    }
  }, [contactoId, onActualizar, mostrar])

  /** Guardar cambios desde el modal de edición rápida */
  const guardarEdicion = useCallback(async () => {
    if (!vinculoEditando || guardandoEdicion) return
    setGuardandoEdicion(true)
    try {
      // Guardar datos del contacto (nombre, correo, teléfono principal con chip WA).
      // El backend usa la lista `telefonos` como reemplazo completo cuando viene presente,
      // así que solo la incluimos si el usuario tocó el campo de teléfono. Para no destruir
      // teléfonos secundarios cargados desde la ficha, comparamos con el valor original:
      // si no cambió, no mandamos `telefonos` y se preservan los otros teléfonos.
      const nombrePartes = edicionNombre.trim().split(/\s+/)
      const nombre = nombrePartes.slice(0, -1).join(' ') || edicionNombre.trim()
      const apellido = nombrePartes.length > 1 ? nombrePartes[nombrePartes.length - 1] : null

      const telefonoNorm = normalizarTelefono(edicionTelefono)
      const telefonoOriginalNorm = normalizarTelefono(vinculoEditando.telefono)
      const cambioTelefono = telefonoNorm !== telefonoOriginalNorm

      const payload: Record<string, unknown> = {
        nombre,
        apellido,
        correo: edicionCorreo || null,
      }
      if (cambioTelefono) {
        // Reemplazo completo de la lista. UX simple: 1 número con tipo elegido.
        // es_whatsapp se deriva del tipo (movil → true, resto → false).
        payload.telefonos = telefonoNorm
          ? normalizarListaTelefonos([
              {
                tipo: edicionTipoTelefono,
                valor: telefonoNorm,
                es_whatsapp: edicionTipoTelefono === 'movil',
                es_principal: true,
              },
            ])
          : []
      }

      await fetch(`/api/contactos/${vinculoEditando.vinculado_id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      // Guardar datos de la vinculación (puesto, recibe_documentos).
      // Mandamos los IDs en la dirección real del vínculo: si es entrante
      // (el otro es dueño de la fila), invertimos para acertarle al registro.
      const payloadVinc = vinculoEditando.esEntrante
        ? { contacto_id: vinculoEditando.vinculado_id, vinculado_id: contactoId }
        : { contacto_id: contactoId, vinculado_id: vinculoEditando.vinculado_id }
      await fetch('/api/contactos/vinculaciones', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...payloadVinc,
          puesto: edicionPuesto || null,
          recibe_documentos: edicionRecibeDoc,
        }),
      })

      setModalEdicion(false)
      setVinculoEditando(null)
      onActualizar()
      mostrar('exito', 'Contacto actualizado')
    } catch {
      mostrar('error', 'Error al guardar los cambios')
    } finally { setGuardandoEdicion(false) }
  }, [vinculoEditando, edicionNombre, edicionCorreo, edicionTelefono, edicionTipoTelefono, edicionPuesto, edicionRecibeDoc, contactoId, guardandoEdicion, onActualizar])

  /** Crear contacto nuevo y vincularlo en un solo paso */
  const crearYVincular = useCallback(async () => {
    if (!crearNombre.trim() || creando) return
    setCreando(true)
    try {
      // Crear el contacto
      const tieneDato = !!(crearCorreo.trim() || crearTelefono.trim())
      // Construir la lista canónica. es_whatsapp se deriva del tipo: movil → true, resto → false.
      const telefonosCrear = crearTelefono.trim()
        ? normalizarListaTelefonos([{
            tipo: crearTipoTelefono,
            valor: crearTelefono,
            es_whatsapp: crearTipoTelefono === 'movil',
            es_principal: true,
          }])
        : []
      const res = await fetch('/api/contactos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nombre: crearNombre.trim(),
          tipo_contacto_clave: crearTipoClave,
          correo: crearCorreo || null,
          telefonos: telefonosCrear,
          cargo: crearCargo || null,
          rubro: crearRubro || null,
          etiquetas: crearEtiquetas.length > 0 ? crearEtiquetas : [],
          es_provisorio: !tieneDato,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        console.error('Error al crear contacto:', data)
        // Si es duplicado, mostrar alerta
        if (data.error === 'duplicado') {
          mostrar('advertencia', data.mensaje || 'Ya existe un contacto con esos datos')
        } else {
          mostrar('error', data.error || 'Error al crear contacto')
        }
        return
      }
      if (!data.id) throw new Error('No se pudo crear')

      // Vincularlo A → B
      await fetch('/api/contactos/vinculaciones', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contacto_id: contactoId,
          vinculado_id: data.id,
          tipo_relacion_id: crearTipoRelacionId || null,
          puesto: crearPuesto || null,
          recibe_documentos: false,
        }),
      })

      // Si es bidireccional, crear también B → A
      if (crearBidireccional) {
        await fetch('/api/contactos/vinculaciones', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contacto_id: data.id,
            vinculado_id: contactoId,
            tipo_relacion_id: crearTipoRelacionId || null,
            puesto: null,
            recibe_documentos: false,
          }),
        })
      }

      cerrarModalVincular()
      onActualizar()
      mostrar('exito', 'Contacto creado y vinculado')
    } catch {
      mostrar('error', 'Error al crear el contacto')
    } finally { setCreando(false) }
  }, [crearNombre, crearTipoClave, crearCorreo, crearTelefono, crearTipoTelefono, crearPuesto, crearCargo, crearRubro, crearTipoRelacionId, crearEtiquetas, crearBidireccional, contactoId, creando, onActualizar])

  // ═══════════════════════════════════════════════════════════════
  // HELPERS
  // ═══════════════════════════════════════════════════════════════

  function cerrarModalVincular() {
    setModalVincular(false)
    setSeleccionado(null)
    setPuesto('')
    setTipoRelacionId('')
    setRecibeDocumentos(false)
    setBidireccional(false)
    setBusqueda('')
    setResultados([])
    setHijosContenedor({})
    setContenedoresExpandidos(new Set())
    setModoCrear(false)
    setCrearNombre('')
    setCrearTipoClave('persona')
    setCrearCorreo('')
    setCrearTelefono('')
    setCrearTipoTelefono('movil')
    setCrearPuesto('')
    setCrearCargo('')
    setCrearRubro('')
    setCrearTipoRelacionId('')
    setCrearEtiquetas([])
    setCrearBidireccional(false)
  }

  /** Abrir modal de edición rápida con los datos de un vínculo.
   *  esEntrante indica si el vínculo es X→yo (el otro es dueño del registro). */
  function abrirEdicion(vinculo: VinculoUI, esEntrante: boolean) {
    setVinculoEditando({ ...vinculo, esEntrante })
    setEdicionNombre([vinculo.nombre, vinculo.apellido].filter(Boolean).join(' '))
    setEdicionCorreo(vinculo.correo || '')
    setEdicionTelefono(vinculo.telefono || '')
    // Default tipo: 'movil' (la edición rápida no conoce el tipo real del registro
    // existente — para gestionar tipo de teléfonos secundarios, abrir la ficha).
    // Móvil implica WhatsApp por convención; si el usuario quiere fijo, lo cambia.
    setEdicionTipoTelefono('movil')
    setEdicionPuesto(vinculo.puesto || '')
    setEdicionRecibeDoc(vinculo.recibe_documentos)
    setModalEdicion(true)
  }

  /** Cambiar a modo creación inline con el texto buscado */
  function abrirCrearInline() {
    setCrearNombre(busqueda)
    setCrearTipoClave('persona')
    setCrearCorreo('')
    setCrearTelefono('')
    setCrearTipoTelefono('movil')
    setCrearPuesto('')
    setModoCrear(true)
  }

  /** Toggle expandir/colapsar un contenedor en la búsqueda */
  function toggleContenedor(id: string) {
    setContenedoresExpandidos(prev => {
      const nuevo = new Set(prev)
      if (nuevo.has(id)) nuevo.delete(id)
      else nuevo.add(id)
      return nuevo
    })
  }

  /** Seleccionar un contacto del buscador (va al paso 2) */
  function seleccionarContacto(c: ContactoBusqueda) {
    setSeleccionado(c)
  }

  const tieneVinculos = vinculaciones.length > 0 || vinculacionesInversas.length > 0
  const nombreDisplay = nombreContacto || 'este contacto'

  /**
   * Lista unificada de relaciones (salientes + entrantes) con un flag de
   * dirección. La UI no distingue dueño del vínculo — siempre se ve y edita
   * desde la ficha que lo esté mirando. El flag solo sirve para decidir en
   * qué dirección borrar el registro al desvincular.
   *
   * La etiqueta de relación (directa vs inversa) ya viene pre-calculada
   * desde el backend en `tipo_relacion_etiqueta`, así que se usa directo.
   */
  const relaciones = [
    ...vinculaciones.map(v => ({ ...v, esEntrante: false })),
    ...vinculacionesInversas.map(v => ({ ...v, esEntrante: true })),
  ]

  // ═══════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════

  return (
    <section>
      {/* ═══ Contenedor principal de Relaciones ═══ */}
      <div className="rounded-card border border-borde-sutil overflow-hidden">

        {/* Encabezado */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-borde-sutil" style={{ backgroundColor: 'var(--superficie-tarjeta)' }}>
          <div className="flex items-center gap-2">
            <Link2 size={15} className="text-texto-terciario" />
            <h3 className="text-sm font-semibold text-texto-primario">Relaciones</h3>
            {(vinculaciones.length + vinculacionesInversas.length) > 0 && (
              <span className="text-xs text-texto-terciario">({vinculaciones.length + vinculacionesInversas.length})</span>
            )}
          </div>
          <Boton variante="fantasma" tamano="xs" icono={<Plus size={13} />} onClick={() => setModalVincular(true)}>Vincular</Boton>
        </div>

        {/* Contenido */}
        <div className="px-4 py-3 space-y-4" style={{ backgroundColor: 'var(--superficie-app)' }}>

          {/* Lista unificada de relaciones.
              Unificamos salientes + entrantes en una sola sección: para el
              usuario es la misma relación sin importar quién la creó. La
              direccionalidad solo afecta al SQL (qué fila borrar) y a la
              etiqueta mostrada (directa vs inversa). */}
          {relaciones.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs text-texto-terciario">
                Contactos relacionados con {nombreDisplay}. Tocá para editar o desvincular.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {relaciones.map(v => (
                  <TarjetaVinculo
                    key={v.id}
                    vinculo={v}
                    etiquetaRelacion={v.tipo_relacion_etiqueta}
                    editable
                    onDesvincular={() => setConfirmarDesvincular({
                      vinculadoId: v.vinculado_id,
                      esEntrante: v.esEntrante,
                      nombre: [v.nombre, v.apellido].filter(Boolean).join(' '),
                    })}
                    onClick={() => abrirEdicion(v, v.esEntrante)}
                    origenId={contactoId}
                    origenNombre={nombreContacto}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Vacío */}
          {!tieneVinculos && (
            <Boton variante="secundario" tamano="sm" anchoCompleto onClick={() => setModalVincular(true)} className="border-dashed">
              Vincular con empresa, proveedor o persona...
            </Boton>
          )}
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════
          MODAL: Buscar y vincular contacto
         ═══════════════════════════════════════════════════════════ */}
      <Modal abierto={modalVincular} onCerrar={cerrarModalVincular} titulo={modoCrear ? 'Crear y vincular contacto' : 'Vincular contacto'}>
        <div className="space-y-4">

          {/* ═══ MODO CREAR: formulario inline dentro del mismo modal ═══ */}
          {modoCrear ? (
            <>
              <div className="grid grid-cols-2 gap-3">
                <Select
                  etiqueta={t('comun.tipo')}
                  opciones={TIPOS_CONTACTO_CREAR.map(tc => ({ valor: tc.clave, etiqueta: tc.etiqueta }))}
                  valor={crearTipoClave}
                  onChange={setCrearTipoClave}
                />
                <Input
                  etiqueta={t('comun.nombre')}
                  value={crearNombre}
                  onChange={e => setCrearNombre(e.target.value)}
                  formato={crearTipoClave === 'persona' ? 'nombre_persona' : 'nombre_empresa'}
                  autoFocus
                />
              </div>

              {/* ── Cargo (persona) o Rubro (empresa/proveedor) — del contacto ── */}
              {['persona', 'lead', 'equipo'].includes(crearTipoClave) && (
                <SelectorPuesto
                  valor={crearCargo}
                  onChange={setCrearCargo}
                  puestos={puestosSugeridos}
                  etiqueta={t('comun.cargo')}
                />
              )}
              {['empresa', 'proveedor'].includes(crearTipoClave) && (
                <SelectorPuesto
                  valor={crearRubro}
                  onChange={setCrearRubro}
                  puestos={rubrosConfig.map(r => r.nombre)}
                  etiqueta={t('comun.rubro')}
                />
              )}

              {/* ── Tipo de relación + Puesto/Rol — de la vinculación ── */}
              <SelectorRelacion
                valor={crearTipoRelacionId}
                onChange={setCrearTipoRelacionId}
                tiposRelacion={tiposRelacion}
              />
              <SelectorPuesto
                valor={crearPuesto}
                onChange={setCrearPuesto}
                puestos={puestosSugeridos}
              />

              <Input
                etiqueta={t('contactos.correo')}
                tipo="email"
                value={crearCorreo}
                onChange={e => setCrearCorreo(e.target.value)}
                formato="email"
              />

              {/* Teléfono: ícono refleja el tipo. Móvil → WhatsApp implícito. */}
              <div>
                <label className="text-xs font-semibold text-texto-terciario uppercase tracking-wider mb-1 block">
                  {t('contactos.telefono')}
                </label>
                <div className="flex items-center gap-2">
                  <div className={`shrink-0 inline-flex items-center justify-center w-8 h-8 ${colorIconoTipoTelefono(crearTipoTelefono)}`}>
                    {iconoParaTipoTelefono(crearTipoTelefono)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <Input
                      tipo="tel"
                      variante="plano"
                      value={crearTelefono}
                      onChange={e => setCrearTelefono(e.target.value)}
                      formato="telefono"
                      placeholder="Número"
                    />
                  </div>
                  <div className="w-28 shrink-0">
                    <Select
                      variante="plano"
                      opciones={[
                        { valor: 'movil', etiqueta: 'Móvil' },
                        { valor: 'fijo', etiqueta: 'Fijo' },
                        { valor: 'trabajo', etiqueta: 'Trabajo' },
                        { valor: 'casa', etiqueta: 'Casa' },
                        { valor: 'otro', etiqueta: 'Otro' },
                      ]}
                      valor={crearTipoTelefono}
                      onChange={setCrearTipoTelefono}
                      placeholder="Tipo"
                    />
                  </div>
                </div>
              </div>

              {/* Etiquetas */}
              {etiquetasConfig.length > 0 && (
                <div>
                  <label className="text-xs font-medium text-texto-secundario mb-1.5 block">Etiquetas</label>
                  <div className="flex flex-wrap gap-1.5">
                    {etiquetasConfig.map(e => {
                      const activa = crearEtiquetas.includes(e.nombre)
                      return (
                        <Boton
                          key={e.nombre}
                          variante={activa ? 'primario' : 'secundario'}
                          tamano="xs"
                          redondeado
                          onClick={() => setCrearEtiquetas(prev =>
                            activa ? prev.filter(n => n !== e.nombre) : [...prev, e.nombre]
                          )}
                        >
                          {e.nombre}
                        </Boton>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Opciones */}
              <div className="rounded-card border border-borde-sutil p-3 space-y-2">
                <Checkbox
                  marcado={crearBidireccional}
                  onChange={setCrearBidireccional}
                  etiqueta="Vincular en ambas direcciones"
                />
                <p className="text-xs text-texto-terciario ml-6">
                  {crearBidireccional
                    ? 'Ambos contactos se verán mutuamente en sus relaciones.'
                    : 'Solo este contacto verá el vínculo.'}
                </p>
              </div>

              <div className="flex justify-end gap-2 pt-1">
                <Boton variante="fantasma" onClick={() => setModoCrear(false)}>Volver</Boton>
                <Boton variante="primario" onClick={crearYVincular} cargando={creando} disabled={!crearNombre.trim()}>
                  Crear y vincular
                </Boton>
              </div>
            </>

          /* ═══ MODO CONFIGURAR: contacto seleccionado, configurar vínculo ═══ */
          ) : seleccionado ? (
            <>
              <div className="flex items-center gap-3 p-3 rounded-card border border-borde-sutil">
                <Avatar nombre={[seleccionado.nombre, seleccionado.apellido].filter(Boolean).join(' ')} tamano="md" />
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-texto-primario">
                    {seleccionado.nombre} {seleccionado.apellido}
                  </div>
                  <div className="text-xs text-texto-terciario">{seleccionado.correo || seleccionado.codigo}</div>
                </div>
                <Boton variante="fantasma" tamano="xs" soloIcono titulo="Quitar selección" icono={<X size={16} />} onClick={() => setSeleccionado(null)} />
              </div>

              {/* ── Puesto / Rol — prominente, justo después del contacto ── */}
              <SelectorPuesto
                valor={puesto}
                onChange={setPuesto}
                puestos={puestosSugeridos}
              />

              <SelectorRelacion
                valor={tipoRelacionId}
                onChange={setTipoRelacionId}
                tiposRelacion={tiposRelacion}
              />

              {/* Opciones */}
              <div className="space-y-2.5 rounded-card border border-borde-sutil p-3">
                <div>
                  <Checkbox
                    marcado={bidireccional}
                    onChange={setBidireccional}
                    etiqueta="Vincular en ambas direcciones"
                  />
                  <p className="text-xs text-texto-terciario mt-0.5 ml-6">
                    {bidireccional
                      ? 'Ambos contactos se verán mutuamente en sus relaciones.'
                      : 'Solo este contacto verá el vínculo.'}
                  </p>
                </div>
                <Checkbox
                  marcado={recibeDocumentos}
                  onChange={setRecibeDocumentos}
                  etiqueta="Recibe copias de documentos"
                  className="text-texto-secundario"
                />
              </div>

              <div className="flex justify-end gap-2 pt-1">
                <Boton variante="fantasma" onClick={() => { setSeleccionado(null); setBusqueda('') }}>{t('comun.cancelar')}</Boton>
                <Boton variante="primario" onClick={vincular} cargando={vinculando}>Vincular</Boton>
              </div>
            </>

          /* ═══ MODO BUSCAR: buscador + recientes ═══ */
          ) : (
            <>
              <Input
                value={busqueda}
                onChange={e => setBusqueda(e.target.value)}
                placeholder="Buscar por nombre, email, código..."
                icono={<Search size={16} />}
                iconoDerecho={
                  busqueda.trim().length >= 2 ? (
                    <Boton variante="fantasma" tamano="xs" icono={<Plus size={14} />} onClick={abrirCrearInline}>Crear</Boton>
                  ) : undefined
                }
                autoFocus
              />

              <div className="max-h-72 overflow-y-auto space-y-0.5">
                {buscando && (
                  <div className="flex justify-center py-4"><CargadorInline /></div>
                )}

                {/* Sin búsqueda activa: mostrar recientes */}
                {!buscando && busqueda.length < 2 && (
                  <>
                    {cargandoRecientes && (
                      <div className="flex justify-center py-4"><CargadorInline /></div>
                    )}
                    {!cargandoRecientes && recientes.length > 0 && (
                      <>
                        <div className="text-xxs text-texto-terciario uppercase tracking-wider px-3 py-1">Recientes</div>
                        {recientes.map(c => (
                          <div key={c.id} className="flex items-center">
                            <div className="w-6" />
                            <FilaBusqueda contacto={c} onSeleccionar={() => seleccionarContacto(c)} />
                          </div>
                        ))}
                      </>
                    )}
                  </>
                )}

                {/* Búsqueda sin resultados */}
                {!buscando && busqueda.length >= 2 && resultados.length === 0 && (
                  <div className="text-center py-4">
                    <p className="text-sm text-texto-terciario">
                      No se encontraron contactos. Usá <span className="text-texto-marca font-medium">+ Crear</span> para agregar uno nuevo.
                    </p>
                  </div>
                )}

                {/* Resultados de búsqueda jerárquicos */}
                {resultados.map(c => {
                  const esContenedor = TIPOS_CONTENEDOR.includes(c.tipo_contacto?.clave)
                  const hijos = hijosContenedor[c.id] || []
                  const expandido = contenedoresExpandidos.has(c.id)

                  return (
                    <div key={c.id}>
                      <div className="flex items-center">
                        {esContenedor && hijos.length > 0 ? (
                          <Boton
                            variante="fantasma"
                            tamano="xs"
                            soloIcono
                            icono={<ChevronRight size={14} className={`transition-transform ${expandido ? 'rotate-90' : ''}`} />}
                            onClick={() => toggleContenedor(c.id)}
                            titulo="Expandir"
                          />
                        ) : (
                          <div className="w-6" />
                        )}
                        <FilaBusqueda contacto={c} onSeleccionar={() => seleccionarContacto(c)} />
                      </div>

                      <AnimatePresence>
                        {esContenedor && expandido && hijos.length > 0 && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.15 }}
                            className="overflow-hidden"
                          >
                            {hijos.map(hijo => {
                              const yaVinculado = idsVinculados.has(hijo.id)
                              return (
                                <div key={hijo.id} className="flex items-center pl-8">
                                  <div className="w-4 border-l border-b border-borde-sutil h-4 mr-1 shrink-0" />
                                  <FilaBusqueda
                                    contacto={hijo}
                                    subtitulo={hijo.puesto_en_contenedor}
                                    deshabilitado={yaVinculado}
                                    onSeleccionar={() => {
                                      if (!yaVinculado) seleccionarContacto(hijo)
                                    }}
                                  />
                                </div>
                              )
                            })}
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  )
                })}

              </div>
            </>
          )}
        </div>
      </Modal>

      {/* ═══════════════════════════════════════════════════════════
          MODAL: Edición rápida de vinculado
         ═══════════════════════════════════════════════════════════ */}
      <Modal
        abierto={modalEdicion}
        onCerrar={() => { setModalEdicion(false); setVinculoEditando(null) }}
        titulo="Editar contacto vinculado"
        accionPrimaria={{
          etiqueta: 'Guardar',
          onClick: guardarEdicion,
          cargando: guardandoEdicion,
        }}
        accionPeligro={{
          etiqueta: 'Desvincular',
          onClick: () => {
            if (vinculoEditando) {
              // Cerramos el modal de edición y abrimos el de confirmación.
              setModalEdicion(false)
              setConfirmarDesvincular({
                vinculadoId: vinculoEditando.vinculado_id,
                esEntrante: false,
                nombre: [vinculoEditando.nombre, vinculoEditando.apellido].filter(Boolean).join(' '),
              })
              setVinculoEditando(null)
            }
          },
        }}
      >
        {vinculoEditando && (
          <div className="space-y-4">
            {/* Encabezado del vinculado */}
            <div className="flex items-center gap-3">
              <Avatar
                nombre={[vinculoEditando.nombre, vinculoEditando.apellido].filter(Boolean).join(' ')}
                tamano="lg"
              />
              <div>
                <Insignia color={(COLOR_TIPO_CONTACTO[vinculoEditando.tipo_clave] || 'neutro') as ColorInsignia}>
                  {vinculoEditando.tipo_etiqueta}
                </Insignia>
                <div className="text-xs text-texto-terciario mt-0.5">{vinculoEditando.codigo}</div>
              </div>
            </div>

            {/* Campos editables del contacto */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Input
                etiqueta={t('comun.nombre_completo')}
                value={edicionNombre}
                onChange={e => setEdicionNombre(e.target.value)}
                formato="nombre_persona"
              />
              <Input
                etiqueta={t('contactos.correo')}
                tipo="email"
                value={edicionCorreo}
                onChange={e => setEdicionCorreo(e.target.value)}
                formato="email"
              />
              <div>
                <label className="text-xs font-semibold text-texto-terciario uppercase tracking-wider mb-1 block">
                  {t('contactos.telefono')}
                </label>
                <div className="flex items-center gap-2">
                  {/* Ícono decorativo: refleja el tipo. Móvil = ícono WhatsApp (asume WA). */}
                  <div className={`shrink-0 inline-flex items-center justify-center w-8 h-8 ${colorIconoTipoTelefono(edicionTipoTelefono)}`}>
                    {iconoParaTipoTelefono(edicionTipoTelefono)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <Input
                      tipo="tel"
                      variante="plano"
                      value={edicionTelefono}
                      onChange={e => setEdicionTelefono(e.target.value)}
                      formato="telefono"
                      placeholder="Número"
                    />
                  </div>
                  <div className="w-28 shrink-0">
                    <Select
                      variante="plano"
                      opciones={[
                        { valor: 'movil', etiqueta: 'Móvil' },
                        { valor: 'fijo', etiqueta: 'Fijo' },
                        { valor: 'trabajo', etiqueta: 'Trabajo' },
                        { valor: 'casa', etiqueta: 'Casa' },
                        { valor: 'otro', etiqueta: 'Otro' },
                      ]}
                      valor={edicionTipoTelefono}
                      onChange={setEdicionTipoTelefono}
                      placeholder="Tipo"
                    />
                  </div>
                </div>
                <p className="text-[11px] text-texto-terciario mt-1">
                  Móvil asume WhatsApp. Para gestionar varios teléfonos, abrí la ficha completa.
                </p>
              </div>
            </div>

            {/* Campos de la vinculación */}
            <div className="border-t border-borde-sutil pt-3 space-y-3">
              <SelectorPuesto
                valor={edicionPuesto}
                onChange={setEdicionPuesto}
                puestos={puestosSugeridos}
                etiqueta={t('contactos.puesto_rol')}
              />

              <Checkbox
                marcado={edicionRecibeDoc}
                onChange={setEdicionRecibeDoc}
                etiqueta="Recibe copias de documentos"
                className="text-texto-secundario"
              />
            </div>

            {/* Link a ficha completa */}
            <a
              href={`/contactos/${vinculoEditando.vinculado_id}`}
              className="flex items-center gap-1.5 text-sm text-texto-marca hover:underline mt-2"
            >
              <ExternalLink size={14} />
              Ver ficha completa
            </a>
          </div>
        )}
      </Modal>

      {/* ═══ Confirmación al desvincular ═══ */}
      <ModalConfirmacion
        abierto={confirmarDesvincular !== null}
        onCerrar={() => setConfirmarDesvincular(null)}
        onConfirmar={() => {
          if (confirmarDesvincular) {
            desvincular(confirmarDesvincular.vinculadoId, confirmarDesvincular.esEntrante)
          }
        }}
        titulo="¿Desvincular contacto?"
        descripcion={
          confirmarDesvincular
            ? `Se va a eliminar la relación entre ${nombreDisplay} y ${confirmarDesvincular.nombre}. Los dos contactos siguen existiendo, solo se borra el vínculo.`
            : undefined
        }
        tipo="peligro"
        etiquetaConfirmar="Desvincular"
        cargando={desvinculando}
      />

    </section>
  )
}

// ═══════════════════════════════════════════════════════════════
// SUBCOMPONENTES
// ═══════════════════════════════════════════════════════════════

/**
 * SelectorPuesto — Selector dropdown de puesto/rol.
 * Muestra puestos configurados, filtra al escribir, y permite crear nuevos
 * que se guardan en la tabla puestos_contacto via /api/contactos/config.
 */
function SelectorPuesto({
  valor,
  onChange,
  puestos,
  etiqueta = 'Puesto / Rol',
}: {
  valor: string
  onChange: (v: string) => void
  puestos: string[]
  etiqueta?: string
}) {
  const [abierto, setAbierto] = useState(false)
  const [texto, setTexto] = useState(valor)
  const [puestosLocales, setPuestosLocales] = useState(puestos)
  const ref = useRef<HTMLDivElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const [posicion, setPosicion] = useState({ top: 0, left: 0, width: 0 })

  // Sincronizar puestos externos
  useEffect(() => { setPuestosLocales(puestos) }, [puestos])
  useEffect(() => { setTexto(valor) }, [valor])

  useLayoutEffect(() => {
    if (!abierto || !ref.current) return
    const rect = ref.current.getBoundingClientRect()
    setPosicion({ top: rect.bottom + 4, left: rect.left, width: rect.width })
  }, [abierto])

  // Cerrar al click fuera
  useEffect(() => {
    if (!abierto) return
    const handler = (e: MouseEvent) => {
      const target = e.target as Node
      if (ref.current?.contains(target)) return
      if (dropdownRef.current?.contains(target)) return
      setAbierto(false)
      if (texto !== valor) onChange(texto)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [abierto, texto, valor, onChange])

  useEffect(() => {
    if (!abierto) return
    const handler = () => {
      if (ref.current) {
        const rect = ref.current.getBoundingClientRect()
        setPosicion({ top: rect.bottom + 4, left: rect.left, width: rect.width })
      }
    }
    window.addEventListener('scroll', handler, true)
    window.addEventListener('resize', handler)
    return () => {
      window.removeEventListener('scroll', handler, true)
      window.removeEventListener('resize', handler)
    }
  }, [abierto])

  const filtrados = texto
    ? puestosLocales.filter(p => p.toLowerCase().includes(texto.toLowerCase()) && p !== valor)
    : puestosLocales.filter(p => p !== valor)

  const existeExacto = puestosLocales.some(p => p.toLowerCase() === texto.toLowerCase().trim())
  const mostrarCrear = texto.trim() && !existeExacto

  function seleccionar(p: string) {
    onChange(p)
    setTexto(p)
    setAbierto(false)
  }

  function crearYSeleccionar() {
    const nombre = texto.trim()
    if (!nombre) return
    // Guardar en config
    fetch('/api/contactos/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tipo: 'puesto', nombre }),
    }).catch(() => {})
    // Agregar localmente para que aparezca inmediatamente
    setPuestosLocales(prev => [...prev, nombre])
    seleccionar(nombre)
  }

  return (
    <div ref={ref} className="relative">
      <label className="text-xs font-semibold text-texto-terciario uppercase tracking-wider mb-1 block">{etiqueta}</label>
      <Input
        tipo="text"
        variante="plano"
        compacto
        value={texto}
        onChange={e => { setTexto(e.target.value); setAbierto(true) }}
        onFocus={() => setAbierto(true)}
        onKeyDown={e => {
          if (e.key === 'Enter') {
            if (mostrarCrear) crearYSeleccionar()
            else { onChange(texto); setAbierto(false) }
          }
          if (e.key === 'Escape') { setTexto(valor); setAbierto(false) }
        }}
        placeholder="Buscar o crear puesto..."
      />

      {typeof window !== 'undefined' && abierto && (filtrados.length > 0 || mostrarCrear) && createPortal(
        <div
          ref={dropdownRef}
          className="fixed rounded-card border border-borde-sutil shadow-elevada max-h-44 overflow-y-auto"
          style={{ backgroundColor: 'var(--superficie-elevada)', top: posicion.top, left: posicion.left, width: posicion.width, zIndex: 'var(--z-popover)' as unknown as number }}
          onMouseDown={e => e.preventDefault()}
        >
          {filtrados.map(p => (
            <button key={p} type="button"
              onClick={() => seleccionar(p)}
              className="w-full text-left px-3 py-1.5 text-sm text-texto-primario hover:bg-superficie-hover bg-transparent border-none cursor-pointer transition-colors">
              {p}
            </button>
          ))}
          {mostrarCrear && (
            <button type="button"
              onClick={crearYSeleccionar}
              className="flex items-center gap-1.5 w-full text-left px-3 py-2 text-sm text-texto-marca hover:bg-superficie-hover bg-transparent border-none cursor-pointer transition-colors border-t border-borde-sutil">
              <Plus size={14} />
              Crear &quot;{texto.trim()}&quot;
            </button>
          )}
        </div>,
        document.body
      )}

      {/* Valor seleccionado como pill (si hay) */}
      {valor && !abierto && (
        <div className="flex items-center gap-1 mt-1.5">
          <span className="px-2.5 py-0.5 text-xs rounded-boton font-medium text-white" style={{ backgroundColor: 'var(--texto-marca)' }}>
            {valor}
          </span>
          <Boton variante="fantasma" tamano="xs" soloIcono icono={<X size={12} />} onClick={() => { onChange(''); setTexto('') }} titulo="Quitar puesto" />
        </div>
      )}
    </div>
  )
}

/**
 * SelectorRelacion — Selector dropdown de tipo de relación.
 * Muestra los tipos configurados, filtra al escribir, permite crear nuevos
 * que se guardan en tipos_relacion via /api/contactos/config.
 */
function SelectorRelacion({
  valor,
  onChange,
  tiposRelacion,
}: {
  valor: string
  onChange: (v: string) => void
  tiposRelacion: TipoRelacion[]
}) {
  const [abierto, setAbierto] = useState(false)
  const [texto, setTexto] = useState('')
  const [locales, setLocales] = useState(tiposRelacion)
  const ref = useRef<HTMLDivElement>(null)
  const dropdownRelRef = useRef<HTMLDivElement>(null)
  const [posRel, setPosRel] = useState({ top: 0, left: 0, width: 0 })

  useEffect(() => { setLocales(tiposRelacion) }, [tiposRelacion])

  // Sincronizar texto con el valor seleccionado
  useEffect(() => {
    const sel = locales.find(t => t.id === valor)
    setTexto(sel ? sel.etiqueta : '')
  }, [valor, locales])

  useLayoutEffect(() => {
    if (!abierto || !ref.current) return
    const rect = ref.current.getBoundingClientRect()
    setPosRel({ top: rect.bottom + 4, left: rect.left, width: rect.width })
  }, [abierto])

  useEffect(() => {
    if (!abierto) return
    const handler = (e: MouseEvent) => {
      const target = e.target as Node
      if (ref.current?.contains(target)) return
      if (dropdownRelRef.current?.contains(target)) return
      setAbierto(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [abierto])

  useEffect(() => {
    if (!abierto) return
    const handler = () => {
      if (ref.current) {
        const rect = ref.current.getBoundingClientRect()
        setPosRel({ top: rect.bottom + 4, left: rect.left, width: rect.width })
      }
    }
    window.addEventListener('scroll', handler, true)
    window.addEventListener('resize', handler)
    return () => {
      window.removeEventListener('scroll', handler, true)
      window.removeEventListener('resize', handler)
    }
  }, [abierto])

  const filtrados = texto
    ? locales.filter(t => t.etiqueta.toLowerCase().includes(texto.toLowerCase()))
    : locales

  const existeExacto = locales.some(t => t.etiqueta.toLowerCase() === texto.toLowerCase().trim())
  const mostrarCrear = texto.trim() && !existeExacto

  function seleccionar(id: string) {
    onChange(id)
    setAbierto(false)
  }

  function limpiar() {
    onChange('')
    setTexto('')
  }

  async function crearYSeleccionar() {
    const nombre = texto.trim()
    if (!nombre) return
    try {
      const res = await fetch('/api/contactos/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tipo: 'relacion',
          nombre,
          etiqueta_inversa: nombre,
        }),
      })
      const data = await res.json()
      if (data.id) {
        const nuevo: TipoRelacion = {
          id: data.id,
          clave: nombre.toLowerCase().replace(/\s+/g, '_'),
          etiqueta: nombre,
          etiqueta_inversa: nombre,
        }
        setLocales(prev => [...prev, nuevo])
        seleccionar(data.id)
      }
    } catch { /* silenciar */ }
  }

  const seleccionado = locales.find(t => t.id === valor)

  return (
    <div ref={ref} className="relative">
      <label className="text-xs font-semibold text-texto-terciario uppercase tracking-wider mb-1 block">Tipo de relación</label>
      <Input
        tipo="text"
        variante="plano"
        compacto
        value={texto}
        onChange={e => { setTexto(e.target.value); setAbierto(true) }}
        onFocus={() => { setAbierto(true); if (seleccionado) setTexto('') }}
        onBlur={() => {
          // Restaurar texto si no se eligió nada
          if (!texto.trim() && seleccionado) {
            setTimeout(() => setTexto(seleccionado.etiqueta), 100)
          }
        }}
        onKeyDown={e => {
          if (e.key === 'Enter' && mostrarCrear) crearYSeleccionar()
          if (e.key === 'Escape') { setAbierto(false); setTexto(seleccionado?.etiqueta || '') }
        }}
        placeholder="Buscar o crear relación..."
      />

      {typeof window !== 'undefined' && abierto && (filtrados.length > 0 || mostrarCrear) && createPortal(
        <div
          ref={dropdownRelRef}
          className="fixed rounded-card border border-borde-sutil shadow-elevada max-h-44 overflow-y-auto"
          style={{ backgroundColor: 'var(--superficie-elevada)', top: posRel.top, left: posRel.left, width: posRel.width, zIndex: 'var(--z-popover)' as unknown as number }}
          onMouseDown={e => e.preventDefault()}
        >
          {/* Opción para limpiar */}
          {valor && (
            <button type="button"
              onClick={limpiar}
              className="w-full text-left px-3 py-1.5 text-sm text-texto-terciario hover:bg-superficie-hover bg-transparent border-none cursor-pointer transition-colors italic">
              Sin especificar
            </button>
          )}
          {filtrados.map(t => (
            <button key={t.id} type="button"
              onClick={() => seleccionar(t.id)}
              className={`w-full text-left px-3 py-1.5 text-sm hover:bg-superficie-hover bg-transparent border-none cursor-pointer transition-colors ${t.id === valor ? 'text-texto-marca font-medium' : 'text-texto-primario'}`}>
              {t.etiqueta}
            </button>
          ))}
          {mostrarCrear && (
            <button type="button"
              onClick={crearYSeleccionar}
              className="flex items-center gap-1.5 w-full text-left px-3 py-2 text-sm text-texto-marca hover:bg-superficie-hover bg-transparent border-none cursor-pointer transition-colors border-t border-borde-sutil">
              <Plus size={14} />
              Crear &quot;{texto.trim()}&quot;
            </button>
          )}
        </div>,
        document.body
      )}

      {/* Pill del valor seleccionado */}
      {seleccionado && !abierto && (
        <div className="flex items-center gap-1 mt-1.5">
          <span className="px-2.5 py-0.5 text-xs rounded-boton font-medium border border-borde-sutil text-texto-primario">
            {seleccionado.etiqueta}
          </span>
          <Boton variante="fantasma" tamano="xs" soloIcono icono={<X size={12} />} onClick={limpiar} titulo="Quitar relación" />
        </div>
      )}
    </div>
  )
}

/** Fila de resultado en el buscador jerárquico */
function FilaBusqueda({
  contacto,
  subtitulo,
  deshabilitado,
  onSeleccionar,
}: {
  contacto: ContactoBusqueda
  subtitulo?: string | null
  deshabilitado?: boolean
  onSeleccionar: () => void
}) {
  const nombre = [contacto.nombre, contacto.apellido].filter(Boolean).join(' ')
  const color = (COLOR_TIPO_CONTACTO[contacto.tipo_contacto?.clave] || 'neutro') as ColorInsignia

  return (
    <Boton
      variante="fantasma"
      tamano="sm"
      anchoCompleto
      onClick={onSeleccionar}
      disabled={deshabilitado}
      className={deshabilitado ? 'opacity-40' : ''}
    >
      <div className="flex items-center gap-3 w-full">
        <Avatar nombre={nombre} tamano="sm" />
        <div className="flex-1 min-w-0 text-left">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-texto-primario truncate">{nombre}</span>
            <Insignia color={color}>{contacto.tipo_contacto?.etiqueta}</Insignia>
          </div>
          <div className="text-xs text-texto-terciario truncate">
            {subtitulo || contacto.correo || contacto.telefono || contacto.codigo}
          </div>
        </div>
      </div>
    </Boton>
  )
}

/**
 * TarjetaVinculo — Tarjeta de contacto vinculado con jerarquía clara.
 *
 * Layout:
 *   [Avatar]  Nombre prominente              C-XXXX      [×]
 *             Tipo · Relación · Puesto
 *             icon tel · icon mail                       [Ver →]
 *
 * - Nombre como protagonista visual (semibold, texto primario).
 * - Metadata de clasificación (tipo/relación/puesto) en una línea secundaria.
 * - Datos de contacto (tel/mail) en una línea terciaria con iconos.
 * - Código visible arriba a la derecha (identificador único siempre a la vista).
 * - Botón × solo aparece al hover; dispara confirmación antes de borrar.
 */
function TarjetaVinculo({
  vinculo,
  etiquetaRelacion,
  onDesvincular,
  onClick,
  editable = false,
  origenId,
  origenNombre,
}: {
  vinculo: VinculoUI
  /** Frase de relación leída desde la perspectiva del contacto actual
   *  (etiqueta directa o inversa según la dirección). Ej: "Encargado/a de",
   *  "Tiene como encargado/a a", "Contacto de". */
  etiquetaRelacion?: string | null
  onDesvincular?: () => void
  onClick?: () => void
  editable?: boolean
  origenId?: string
  origenNombre?: string
}) {
  const nombre = [vinculo.nombre, vinculo.apellido].filter(Boolean).join(' ')
  const color = (COLOR_TIPO_CONTACTO[vinculo.tipo_clave] || 'neutro') as ColorInsignia

  return (
    <div
      onClick={editable ? onClick : undefined}
      className={`relative rounded-card border border-borde-sutil bg-superficie-tarjeta group transition-colors ${editable ? 'cursor-pointer hover:border-borde-fuerte hover:bg-superficie-hover/40' : ''}`}
    >
      <div className="flex items-start gap-3 p-3">
        {/* Avatar — ancla visual a la izquierda */}
        <Avatar nombre={nombre} tamano="sm" />

        {/* Contenido central — 3 líneas de jerarquía decreciente */}
        <div className="flex-1 min-w-0 space-y-1">
          {/* Línea 1: Nombre (protagonista) + flag recibe-documentos */}
          <div className="flex items-center gap-1.5 min-w-0 pr-14">
            <span className="text-sm font-semibold text-texto-primario truncate">{nombre}</span>
            {vinculo.recibe_documentos && (
              <span className="shrink-0" aria-label="Recibe documentos">
                <FileCheck size={12} className="text-insignia-exito" />
              </span>
            )}
          </div>

          {/* Línea 2: clasificación (tipo + relación + puesto) */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <Insignia color={color}>{vinculo.tipo_etiqueta}</Insignia>
            {etiquetaRelacion && (
              <>
                <span className="text-[11px] text-texto-terciario">·</span>
                <span className="text-xs text-texto-secundario">{etiquetaRelacion}</span>
              </>
            )}
            {vinculo.puesto && (
              <>
                <span className="text-[11px] text-texto-terciario">·</span>
                <span className="text-xs text-texto-terciario">{vinculo.puesto}</span>
              </>
            )}
          </div>

          {/* Línea 3: datos de contacto (inline si entran) */}
          {(vinculo.telefono || vinculo.correo) && (
            <div className="flex items-center gap-3 flex-wrap pt-0.5">
              {vinculo.telefono && (
                <span className="flex items-center gap-1 text-xs text-texto-terciario min-w-0">
                  <Phone size={11} className="shrink-0" />
                  <TextoTelefono valor={vinculo.telefono} className="truncate" />
                </span>
              )}
              {vinculo.correo && (
                <span className="flex items-center gap-1 text-xs text-texto-terciario min-w-0">
                  <Mail size={11} className="shrink-0" />
                  <span className="truncate">{vinculo.correo}</span>
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Esquina superior derecha: código (siempre visible) + botón desvincular (hover) */}
      <div className="absolute top-2.5 right-2.5 flex items-center gap-1">
        {vinculo.codigo && (
          <span className="text-[11px] font-medium text-texto-terciario tabular-nums">
            {vinculo.codigo}
          </span>
        )}
        {editable && onDesvincular && (
          <Boton
            variante="fantasma"
            tamano="xs"
            soloIcono
            titulo="Desvincular"
            icono={<X size={13} />}
            onClick={e => { e.stopPropagation(); onDesvincular() }}
            className="text-texto-terciario hover:text-insignia-peligro hover:bg-insignia-peligro-fondo opacity-0 group-hover:opacity-100"
          />
        )}
      </div>

      {/* Esquina inferior derecha: link "Ver" (aparece al hover) */}
      <a
        href={`/contactos/${vinculo.vinculado_id}${origenId ? `?desde=${origenId}&desde_nombre=${encodeURIComponent(origenNombre || '')}` : ''}`}
        onClick={e => e.stopPropagation()}
        className="absolute bottom-2 right-2.5 flex items-center gap-1 px-1.5 py-0.5 rounded-boton text-[11px] text-texto-marca hover:bg-superficie-hover transition-colors opacity-0 group-hover:opacity-100"
      >
        <ExternalLink size={10} />
        Ver
      </a>
    </div>
  )
}
