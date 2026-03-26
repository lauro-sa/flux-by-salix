'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Link2, Search, X, UserPlus, FileCheck, Phone, Mail, ExternalLink,
  ChevronRight, Plus, Building2, User, Truck,
} from 'lucide-react'
import { Avatar } from '@/componentes/ui/Avatar'
import { Input } from '@/componentes/ui/Input'
import { Insignia, type ColorInsignia } from '@/componentes/ui/Insignia'
import { Select } from '@/componentes/ui/Select'
import { Modal } from '@/componentes/ui/Modal'
import { Boton } from '@/componentes/ui/Boton'
import { COLOR_TIPO_CONTACTO } from '@/lib/colores_entidad'

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

interface Props {
  contactoId: string
  nombreContacto?: string
  vinculaciones: VinculoUI[]
  vinculacionesInversas: VinculoUI[]
  tiposRelacion: TipoRelacion[]
  onActualizar: () => void
}

// Puestos predefinidos para sugerir
const PUESTOS_SUGERIDOS = [
  'Encargado', 'Propietario', 'Administrador', 'Técnico', 'Inquilino',
  'Empleado', 'Gerente', 'Director', 'Mantenimiento', 'Socio', 'Otro',
]

// Tipos de contacto que pueden tener hijos (contenedores)
const TIPOS_CONTENEDOR = ['empresa', 'edificio', 'proveedor']

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
  onActualizar,
}: Props) {
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
  const [vinculoEditando, setVinculoEditando] = useState<VinculoUI | null>(null)
  const [edicionNombre, setEdicionNombre] = useState('')
  const [edicionCorreo, setEdicionCorreo] = useState('')
  const [edicionTelefono, setEdicionTelefono] = useState('')
  const [edicionWhatsapp, setEdicionWhatsapp] = useState('')
  const [edicionPuesto, setEdicionPuesto] = useState('')
  const [edicionRecibeDoc, setEdicionRecibeDoc] = useState(false)
  const [guardandoEdicion, setGuardandoEdicion] = useState(false)

  // ─── Estado de creación inline (dentro del mismo modal) ───
  const [modoCrear, setModoCrear] = useState(false)
  const [crearNombre, setCrearNombre] = useState('')
  const [crearTipoClave, setCrearTipoClave] = useState('persona')
  const [crearCorreo, setCrearCorreo] = useState('')
  const [crearTelefono, setCrearTelefono] = useState('')
  const [crearPuesto, setCrearPuesto] = useState('')
  const [creando, setCreando] = useState(false)

  // ─── Recientes (se cargan al abrir el modal sin buscar) ───
  const [recientes, setRecientes] = useState<ContactoBusqueda[]>([])
  const [cargandoRecientes, setCargandoRecientes] = useState(false)

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
    }, 300)

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
    } catch { /* silenciar */ }
    finally { setVinculando(false) }
  }, [seleccionado, contactoId, tipoRelacionId, puesto, recibeDocumentos, bidireccional, vinculando, onActualizar])

  /** Desvincular un contacto */
  const desvincular = useCallback(async (vinculadoId: string) => {
    await fetch('/api/contactos/vinculaciones', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contacto_id: contactoId, vinculado_id: vinculadoId }),
    })
    onActualizar()
  }, [contactoId, onActualizar])

  /** Guardar cambios desde el modal de edición rápida */
  const guardarEdicion = useCallback(async () => {
    if (!vinculoEditando || guardandoEdicion) return
    setGuardandoEdicion(true)
    try {
      // Guardar datos del contacto (nombre, correo, teléfono, whatsapp)
      const nombrePartes = edicionNombre.trim().split(/\s+/)
      const nombre = nombrePartes.slice(0, -1).join(' ') || edicionNombre.trim()
      const apellido = nombrePartes.length > 1 ? nombrePartes[nombrePartes.length - 1] : null

      await fetch(`/api/contactos/${vinculoEditando.vinculado_id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nombre,
          apellido,
          correo: edicionCorreo || null,
          telefono: edicionTelefono || null,
          whatsapp: edicionWhatsapp || null,
        }),
      })

      // Guardar datos de la vinculación (puesto, recibe_documentos)
      await fetch('/api/contactos/vinculaciones', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contacto_id: contactoId,
          vinculado_id: vinculoEditando.vinculado_id,
          puesto: edicionPuesto || null,
          recibe_documentos: edicionRecibeDoc,
        }),
      })

      setModalEdicion(false)
      setVinculoEditando(null)
      onActualizar()
    } catch { /* silenciar */ }
    finally { setGuardandoEdicion(false) }
  }, [vinculoEditando, edicionNombre, edicionCorreo, edicionTelefono, edicionWhatsapp, edicionPuesto, edicionRecibeDoc, contactoId, guardandoEdicion, onActualizar])

  /** Crear contacto nuevo y vincularlo en un solo paso */
  const crearYVincular = useCallback(async () => {
    if (!crearNombre.trim() || creando) return
    setCreando(true)
    try {
      // Crear el contacto
      const tieneDato = !!(crearCorreo.trim() || crearTelefono.trim())
      const res = await fetch('/api/contactos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nombre: crearNombre.trim(),
          tipo_contacto_clave: crearTipoClave,
          correo: crearCorreo || null,
          telefono: crearTelefono || null,
          es_provisorio: !tieneDato,
        }),
      })
      const data = await res.json()
      if (!data.id) throw new Error('No se pudo crear')

      // Vincularlo
      await fetch('/api/contactos/vinculaciones', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contacto_id: contactoId,
          vinculado_id: data.id,
          puesto: crearPuesto || null,
          recibe_documentos: false,
        }),
      })

      cerrarModalVincular()
      onActualizar()
    } catch { /* silenciar */ }
    finally { setCreando(false) }
  }, [crearNombre, crearTipoClave, crearCorreo, crearTelefono, crearPuesto, contactoId, creando, onActualizar])

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
    setCrearPuesto('')
  }

  /** Abrir modal de edición rápida con los datos de un vínculo */
  function abrirEdicion(vinculo: VinculoUI) {
    setVinculoEditando(vinculo)
    setEdicionNombre([vinculo.nombre, vinculo.apellido].filter(Boolean).join(' '))
    setEdicionCorreo(vinculo.correo || '')
    setEdicionTelefono(vinculo.telefono || '')
    setEdicionWhatsapp('')
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

  // ═══════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════

  return (
    <section>
      {/* ═══ Contenedor principal de Relaciones ═══ */}
      <div className="rounded-xl border border-borde-sutil overflow-hidden">

        {/* Encabezado */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-borde-sutil" style={{ backgroundColor: 'var(--superficie-tarjeta)' }}>
          <div className="flex items-center gap-2">
            <Link2 size={15} className="text-texto-terciario" />
            <h3 className="text-sm font-semibold text-texto-primario">Relaciones</h3>
            {(vinculaciones.length + vinculacionesInversas.length) > 0 && (
              <span className="text-xs text-texto-terciario">({vinculaciones.length + vinculacionesInversas.length})</span>
            )}
          </div>
          <button type="button" onClick={() => setModalVincular(true)}
            className="flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium text-texto-marca hover:bg-superficie-hover bg-transparent border-none cursor-pointer transition-colors">
            <Plus size={13} />
            <span>Vincular</span>
          </button>
        </div>

        {/* Contenido */}
        <div className="px-4 py-3 space-y-4" style={{ backgroundColor: 'var(--superficie-app)' }}>

          {/* Vinculados directos */}
          {vinculaciones.length > 0 && (
            <div className="space-y-2">
              <div>
                <div className="text-[11px] font-semibold text-texto-terciario uppercase tracking-wider">
                  Contactos vinculados
                </div>
                <p className="text-[11px] text-texto-terciario mt-0.5">
                  Vinculados a {nombreDisplay}. Tocá para editar o desvincular.
                </p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {vinculaciones.map(v => (
                  <TarjetaVinculo
                    key={v.id}
                    vinculo={v}
                    editable
                    onDesvincular={() => desvincular(v.vinculado_id)}
                    onClick={() => abrirEdicion(v)}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Separador entre secciones */}
          {vinculaciones.length > 0 && vinculacionesInversas.length > 0 && (
            <div className="border-t border-borde-sutil" />
          )}

          {/* Vinculaciones inversas */}
          {vinculacionesInversas.length > 0 && (
            <div className="space-y-2">
              <div>
                <div className="text-[11px] font-semibold text-texto-terciario uppercase tracking-wider">
                  Vinculado en
                </div>
                <p className="text-[11px] text-texto-terciario mt-0.5">
                  Donde {nombreDisplay} aparece como vinculado. Para desvincular, entrá al contacto de origen.
                </p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {vinculacionesInversas.map(v => (
                  <TarjetaVinculo key={v.id} vinculo={v} editable={false} />
                ))}
              </div>
            </div>
          )}

          {/* Vacío */}
          {!tieneVinculos && (
            <button type="button" onClick={() => setModalVincular(true)}
              className="w-full py-4 text-sm text-texto-terciario hover:text-texto-marca bg-transparent border border-dashed border-borde-sutil rounded-lg cursor-pointer transition-colors hover:border-borde-fuerte">
              Vincular con empresa, proveedor o persona...
            </button>
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
              <Select
                etiqueta="Tipo de contacto"
                opciones={TIPOS_CONTACTO_CREAR.map(t => ({ valor: t.clave, etiqueta: t.etiqueta }))}
                valor={crearTipoClave}
                onChange={setCrearTipoClave}
              />

              <Input
                etiqueta="Nombre"
                value={crearNombre}
                onChange={e => setCrearNombre(e.target.value)}
                formato={crearTipoClave === 'persona' ? 'nombre_persona' : 'nombre_empresa'}
                autoFocus
              />

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Input
                  etiqueta="Correo"
                  tipo="email"
                  value={crearCorreo}
                  onChange={e => setCrearCorreo(e.target.value)}
                  formato="email"
                />
                <Input
                  etiqueta="Teléfono"
                  tipo="tel"
                  value={crearTelefono}
                  onChange={e => setCrearTelefono(e.target.value)}
                  formato="telefono"
                />
              </div>

              <div>
                <label className="text-sm font-medium text-texto-secundario mb-1 block">Puesto / Rol</label>
                <Input
                  value={crearPuesto}
                  onChange={e => setCrearPuesto(e.target.value)}
                  placeholder="Ej: Encargado, Técnico..."
                  formato="nombre_persona"
                />
                <div className="flex items-center gap-1 flex-wrap mt-1.5">
                  {PUESTOS_SUGERIDOS.slice(0, 6).map(p => (
                    <button key={p} type="button" onClick={() => setCrearPuesto(p)}
                      className={`px-2 py-0.5 text-xs rounded-md border transition-colors cursor-pointer ${crearPuesto === p ? 'bg-superficie-seleccionada text-texto-marca border-transparent' : 'bg-transparent text-texto-terciario border-borde-sutil hover:text-texto-secundario'}`}>
                      {p}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Boton variante="fantasma" onClick={() => setModoCrear(false)}>Volver</Boton>
                <Boton variante="primario" onClick={crearYVincular} cargando={creando} disabled={!crearNombre.trim()}>
                  Crear y vincular
                </Boton>
              </div>
            </>

          /* ═══ MODO CONFIGURAR: contacto seleccionado, configurar vínculo ═══ */
          ) : seleccionado ? (
            <>
              <div className="flex items-center gap-3 p-3 rounded-lg border border-borde-sutil">
                <Avatar nombre={[seleccionado.nombre, seleccionado.apellido].filter(Boolean).join(' ')} tamano="md" />
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-texto-primario">
                    {seleccionado.nombre} {seleccionado.apellido}
                  </div>
                  <div className="text-xs text-texto-terciario">{seleccionado.correo || seleccionado.codigo}</div>
                </div>
                <button type="button" onClick={() => setSeleccionado(null)}
                  className="text-texto-terciario hover:text-texto-primario bg-transparent border-none cursor-pointer">
                  <X size={16} />
                </button>
              </div>

              {tiposRelacion.length > 0 && (
                <Select
                  etiqueta="Tipo de relación"
                  opciones={[
                    { valor: '', etiqueta: 'Sin especificar' },
                    ...tiposRelacion.map(t => ({ valor: t.id, etiqueta: t.etiqueta })),
                  ]}
                  valor={tipoRelacionId}
                  onChange={setTipoRelacionId}
                />
              )}

              <div>
                <label className="text-sm font-medium text-texto-secundario mb-1 block">Puesto / Rol</label>
                <Input
                  value={puesto}
                  onChange={e => setPuesto(e.target.value)}
                  placeholder="Ej: Encargado, Técnico, Gerente..."
                  formato="nombre_persona"
                />
                <div className="flex items-center gap-1 flex-wrap mt-1.5">
                  {PUESTOS_SUGERIDOS.slice(0, 6).map(p => (
                    <button key={p} type="button" onClick={() => setPuesto(p)}
                      className={`px-2 py-0.5 text-xs rounded-md border transition-colors cursor-pointer ${puesto === p ? 'bg-superficie-seleccionada text-texto-marca border-transparent' : 'bg-transparent text-texto-terciario border-borde-sutil hover:text-texto-secundario'}`}>
                      {p}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2.5 rounded-lg border border-borde-sutil p-3">
                <label className="flex items-center gap-2.5 cursor-pointer">
                  <input type="checkbox" checked={bidireccional} onChange={e => setBidireccional(e.target.checked)}
                    className="rounded size-4 accent-texto-marca" />
                  <div>
                    <span className="text-sm text-texto-primario font-medium">Vincular en ambas direcciones</span>
                    <p className="text-[11px] text-texto-terciario mt-0.5">
                      {bidireccional
                        ? 'Ambos contactos se verán mutuamente en sus relaciones.'
                        : 'Solo este contacto verá el vínculo. El otro lo verá en "Vinculado en" (solo lectura).'}
                    </p>
                  </div>
                </label>
                <label className="flex items-center gap-2.5 cursor-pointer">
                  <input type="checkbox" checked={recibeDocumentos} onChange={e => setRecibeDocumentos(e.target.checked)}
                    className="rounded size-4 accent-texto-marca" />
                  <span className="text-sm text-texto-secundario">Recibe copias de documentos</span>
                </label>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Boton variante="fantasma" onClick={() => { setSeleccionado(null); setBusqueda('') }}>Cancelar</Boton>
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
                    <button
                      type="button"
                      onClick={abrirCrearInline}
                      className="flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-medium text-texto-marca bg-transparent border-none cursor-pointer hover:bg-superficie-hover transition-colors whitespace-nowrap"
                    >
                      <Plus size={14} />
                      Crear
                    </button>
                  ) : undefined
                }
                autoFocus
              />

              <div className="max-h-72 overflow-y-auto space-y-0.5">
                {buscando && (
                  <div className="text-sm text-texto-terciario text-center py-4">Buscando...</div>
                )}

                {/* Sin búsqueda activa: mostrar recientes */}
                {!buscando && busqueda.length < 2 && (
                  <>
                    {cargandoRecientes && (
                      <div className="text-sm text-texto-terciario text-center py-4">Cargando...</div>
                    )}
                    {!cargandoRecientes && recientes.length > 0 && (
                      <>
                        <div className="text-[10px] text-texto-terciario uppercase tracking-wider px-3 py-1">Recientes</div>
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
                          <button type="button" onClick={() => toggleContenedor(c.id)}
                            className="p-1 bg-transparent border-none cursor-pointer text-texto-terciario hover:text-texto-primario transition-colors shrink-0">
                            <ChevronRight size={14} className={`transition-transform ${expandido ? 'rotate-90' : ''}`} />
                          </button>
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
        acciones={
          <>
            <Boton variante="peligro" tamano="sm"
              onClick={() => {
                if (vinculoEditando) {
                  desvincular(vinculoEditando.vinculado_id)
                  setModalEdicion(false)
                  setVinculoEditando(null)
                }
              }}>
              Desvincular
            </Boton>
            <Boton variante="primario" tamano="sm" onClick={guardarEdicion} cargando={guardandoEdicion}>
              Guardar
            </Boton>
          </>
        }
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
                etiqueta="Nombre completo"
                value={edicionNombre}
                onChange={e => setEdicionNombre(e.target.value)}
                formato="nombre_persona"
              />
              <Input
                etiqueta="Correo"
                tipo="email"
                value={edicionCorreo}
                onChange={e => setEdicionCorreo(e.target.value)}
                formato="email"
              />
              <Input
                etiqueta="Teléfono"
                tipo="tel"
                value={edicionTelefono}
                onChange={e => setEdicionTelefono(e.target.value)}
                formato="telefono"
              />
              <Input
                etiqueta="WhatsApp"
                tipo="tel"
                value={edicionWhatsapp}
                onChange={e => setEdicionWhatsapp(e.target.value)}
                formato="telefono"
              />
            </div>

            {/* Campos de la vinculación */}
            <div className="border-t border-borde-sutil pt-3 space-y-3">
              <div>
                <label className="text-sm font-medium text-texto-secundario mb-1 block">Puesto / Rol en este contacto</label>
                <Input
                  value={edicionPuesto}
                  onChange={e => setEdicionPuesto(e.target.value)}
                  placeholder="Ej: Encargado, Técnico..."
                  formato="nombre_persona"
                />
                <div className="flex items-center gap-1 flex-wrap mt-1.5">
                  {PUESTOS_SUGERIDOS.slice(0, 6).map(p => (
                    <button key={p} type="button" onClick={() => setEdicionPuesto(p)}
                      className={`px-2 py-0.5 text-xs rounded-md border transition-colors cursor-pointer ${edicionPuesto === p ? 'bg-superficie-seleccionada text-texto-marca border-transparent' : 'bg-transparent text-texto-terciario border-borde-sutil hover:text-texto-secundario'}`}>
                      {p}
                    </button>
                  ))}
                </div>
              </div>

              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={edicionRecibeDoc} onChange={e => setEdicionRecibeDoc(e.target.checked)}
                  className="rounded" />
                <span className="text-sm text-texto-secundario">Recibe copias de documentos</span>
              </label>
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

    </section>
  )
}

// ═══════════════════════════════════════════════════════════════
// SUBCOMPONENTES
// ═══════════════════════════════════════════════════════════════

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
    <button
      type="button"
      onClick={onSeleccionar}
      disabled={deshabilitado}
      className={`flex items-center gap-3 w-full px-3 py-2 rounded-lg text-left bg-transparent border-none transition-colors ${deshabilitado ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer hover:bg-superficie-hover'}`}
    >
      <Avatar nombre={nombre} tamano="sm" />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-texto-primario truncate">{nombre}</span>
          <Insignia color={color}>{contacto.tipo_contacto?.etiqueta}</Insignia>
        </div>
        <div className="text-xs text-texto-terciario truncate">
          {subtitulo || contacto.correo || contacto.telefono || contacto.codigo}
        </div>
      </div>
    </button>
  )
}

/**
 * TarjetaVinculo — Tarjeta compacta de contacto vinculado.
 * Layout vertical: nombre + badges arriba, teléfono y correo abajo en columna.
 * Ancho limitado para que quepan 2 por fila en desktop.
 */
function TarjetaVinculo({
  vinculo,
  onDesvincular,
  onClick,
  editable = false,
}: {
  vinculo: VinculoUI
  onDesvincular?: () => void
  onClick?: () => void
  editable?: boolean
}) {
  const nombre = [vinculo.nombre, vinculo.apellido].filter(Boolean).join(' ')
  const color = (COLOR_TIPO_CONTACTO[vinculo.tipo_clave] || 'neutro') as ColorInsignia

  return (
    <div
      onClick={editable ? onClick : undefined}
      className={`relative p-3 rounded-lg border border-borde-sutil group transition-colors ${editable ? 'cursor-pointer hover:border-borde-fuerte hover:bg-superficie-hover/50' : ''}`}
    >
      {/* Botón desvincular (esquina superior derecha) */}
      {editable && onDesvincular && (
        <button
          type="button"
          onClick={e => { e.stopPropagation(); onDesvincular() }}
          className="absolute top-2 right-2 p-1 rounded-md text-texto-terciario hover:text-insignia-peligro hover:bg-insignia-peligro-fondo bg-transparent border-none cursor-pointer transition-colors opacity-0 group-hover:opacity-100"
        >
          <X size={13} />
        </button>
      )}

      {/* Fila: avatar + nombre + badges */}
      <div className="flex items-center gap-2.5 mb-2">
        <Avatar nombre={nombre} tamano="sm" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-sm font-medium text-texto-primario truncate">{nombre}</span>
            {vinculo.recibe_documentos && (
              <span className="shrink-0" aria-label="Recibe documentos"><FileCheck size={12} className="text-insignia-exito" /></span>
            )}
          </div>
          <div className="flex items-center gap-1.5 mt-0.5">
            <Insignia color={color}>{vinculo.tipo_etiqueta}</Insignia>
            {vinculo.puesto && (
              <span className="text-[11px] text-texto-terciario bg-superficie-hover px-1.5 py-0.5 rounded">
                {vinculo.puesto}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Datos de contacto en columna */}
      <div className="space-y-0.5 pl-10">
        {vinculo.telefono && (
          <div className="flex items-center gap-1.5 text-xs text-texto-terciario">
            <Phone size={11} className="shrink-0" /> <span className="truncate">{vinculo.telefono}</span>
          </div>
        )}
        {vinculo.correo && (
          <div className="flex items-center gap-1.5 text-xs text-texto-terciario">
            <Mail size={11} className="shrink-0" /> <span className="truncate">{vinculo.correo}</span>
          </div>
        )}
        {!vinculo.telefono && !vinculo.correo && (
          <div className="text-xs text-texto-terciario">{vinculo.codigo}</div>
        )}
      </div>
    </div>
  )
}
