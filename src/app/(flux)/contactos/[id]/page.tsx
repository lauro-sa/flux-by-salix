'use client'

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { useParams, useRouter, usePathname, useSearchParams } from 'next/navigation'
import { useNavegacion } from '@/hooks/useNavegacion'
import { GuardPagina } from '@/componentes/entidad/GuardPagina'
import { useTraduccion } from '@/lib/i18n'
import { DEBOUNCE_BUSQUEDA, DELAY_NOTIFICACION } from '@/lib/constantes/timeouts'
import {
  Mail, Globe, ChevronLeft,
  Building2, Building, User, Truck, UserPlus, BadgeCheck, Trash2, Plus, X,
  UserCheck, Clock, Link2, Search, Merge,
} from 'lucide-react'
import { Input } from '@/componentes/ui/Input'
import { Select } from '@/componentes/ui/Select'
import { Avatar } from '@/componentes/ui/Avatar'
import { Insignia, type ColorInsignia } from '@/componentes/ui/Insignia'
import { ModalAdaptable as Modal } from '@/componentes/ui/ModalAdaptable'
import { Boton } from '@/componentes/ui/Boton'
import { Checkbox } from '@/componentes/ui/Checkbox'
import { ModalConfirmacion } from '@/componentes/ui/ModalConfirmacion'
import { Cargador } from '@/componentes/ui/Cargador'
import { DireccionesContacto, type DireccionConTipo } from '../_componentes/DireccionesContacto'
import { TelefonosContacto } from '../_componentes/TelefonosContacto'
import { VinculacionesContacto } from '../_componentes/VinculacionesContacto'
import type { TelefonoNormalizado } from '@/lib/contacto-telefonos'
import { PanelChatter } from '@/componentes/entidad/PanelChatter'
import { ModalEnviarDocumento, type CanalCorreoEmpresa, type PlantillaCorreo, type DatosEnvioDocumento } from '@/componentes/entidad/ModalEnviarDocumento'
import { BannerContacto } from '../_componentes/BannerContacto'
import { ModalAceptarProvisorio } from '../_componentes/ModalAceptarProvisorio'
import { ModalFusionarContacto } from '../_componentes/ModalFusionarContacto'
import { BarraKPIs } from '../_componentes/BarraKPIs'
import { COLOR_TIPO_CONTACTO } from '@/lib/colores_entidad'
import { crearClienteNavegador } from '@/lib/supabase/cliente'
import { validarCamposContacto, sinErrores, type ErroresContacto } from '@/lib/validaciones'
import type { TipoContacto, CampoFiscalPais, TipoRelacion } from '@/tipos'
import { PAISES_DISPONIBLES } from '@/lib/paises'

// ─── Constantes ───

const TIPOS_PERSONA = ['persona', 'lead', 'equipo']

const ICONOS_TIPO: Record<string, typeof User> = {
  persona: User, empresa: Building2, edificio: Building,
  proveedor: Truck, lead: UserPlus, equipo: BadgeCheck,
}

const TIPOS_FALLBACK: TipoContacto[] = [
  { id: 'f-persona', empresa_id: '', clave: 'persona', etiqueta: 'Persona', icono: 'user', color: 'primario', puede_tener_hijos: false, es_predefinido: true, orden: 1, activo: true },
  { id: 'f-empresa', empresa_id: '', clave: 'empresa', etiqueta: 'Empresa', icono: 'building-2', color: 'info', puede_tener_hijos: true, es_predefinido: true, orden: 2, activo: true },
  { id: 'f-edificio', empresa_id: '', clave: 'edificio', etiqueta: 'Edificio', icono: 'building', color: 'cyan', puede_tener_hijos: true, es_predefinido: true, orden: 3, activo: true },
  { id: 'f-proveedor', empresa_id: '', clave: 'proveedor', etiqueta: 'Proveedor', icono: 'truck', color: 'naranja', puede_tener_hijos: true, es_predefinido: true, orden: 4, activo: true },
  { id: 'f-lead', empresa_id: '', clave: 'lead', etiqueta: 'Lead', icono: 'user-plus', color: 'advertencia', puede_tener_hijos: false, es_predefinido: true, orden: 5, activo: true },
]

interface VinculacionPendiente {
  vinculado_id: string
  nombre: string
  codigo: string
  tipo_clave: string
  tipo_etiqueta: string
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

// ─── Helpers ───

function combinarNombre(nombre: string, apellido: string | null): string {
  return [nombre, apellido].filter(Boolean).join(' ')
}

function separarNombreApellido(nombreCompleto: string, esPersona: boolean) {
  const limpio = nombreCompleto.trim()
  if (!esPersona || !limpio) return { nombre: limpio, apellido: '' }
  const partes = limpio.split(/\s+/)
  if (partes.length <= 1) return { nombre: limpio, apellido: '' }
  return { nombre: partes.slice(0, -1).join(' '), apellido: partes[partes.length - 1] }
}

// ═══════════════════════════════════════════════════════════════
// PÁGINA: /contactos/[id] — Detalle, edición y creación unificados
// ═══════════════════════════════════════════════════════════════

export default function PaginaContacto() {
  return (
    <GuardPagina modulo="contactos">
      <PaginaContactoInterno />
    </GuardPagina>
  )
}

function PaginaContactoInterno() {
  const { t } = useTraduccion()
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const pathname = usePathname()
  // contactoId: ID real del contacto (null mientras se está creando)
  const [contactoId, setContactoId] = useState<string | null>(params.id === 'nuevo' ? null : params.id)
  const esNuevo = contactoId === null
  const searchParams = useSearchParams()
  const { setMigajaDinamica } = useNavegacion()

  // Contacto de origen (cuando se navega desde una vinculación)
  const desdeId = searchParams.get('desde')
  const desdeNombre = searchParams.get('desde_nombre')

  // ─── Estado compartido ───
  const [nombreCompleto, setNombreCompleto] = useState('')
  const [codigo, setCodigo] = useState('')
  const [tipoContactoId, setTipoContactoId] = useState('')
  const [campos, setCampos] = useState<Record<string, string>>({})
  const [datosFiscales, setDatosFiscales] = useState<Record<string, string>>({})
  const [etiquetas, setEtiquetas] = useState<string[]>([])
  const [direcciones, setDirecciones] = useState<DireccionConTipo[]>([])
  // Lista de teléfonos del contacto (modelo nuevo). Se sincroniza con el backend en cada cambio
  // (ver guardarTelefonos más abajo).
  const [telefonos, setTelefonos] = useState<TelefonoNormalizado[]>([])
  // miembro_id del contacto si está vinculado a un miembro de la empresa.
  // Cuando es != null, los campos sincronizados (nombre/apellido/correo/teléfonos sync)
  // están bloqueados y se editan desde la sección Usuarios.
  const [miembroIdVinculado, setMiembroIdVinculado] = useState<string | null>(null)
  const [tiposContacto, setTiposContacto] = useState<TipoContacto[]>([])
  const [tiposRelacion, setTiposRelacion] = useState<TipoRelacion[]>([])
  const [puestosVinculacion, setPuestosVinculacion] = useState<{ id: string; etiqueta: string }[]>([])
  const [etiquetasConfig, setEtiquetasConfig] = useState<{ nombre: string; color: string }[]>([])
  const [rubrosConfig, setRubrosConfig] = useState<{ nombre: string }[]>([])
  const [camposFiscalesPais, setCamposFiscalesPais] = useState<CampoFiscalPais[]>([])
  const [paisesEmpresa, setPaisesEmpresa] = useState<string[]>([])
  const [paisContacto, setPaisContacto] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [errorGuardado, setErrorGuardado] = useState('')

  // ─── Estado solo edición ───
  const [vinculaciones, setVinculaciones] = useState<unknown[]>([])
  const [vinculacionesInversas, setVinculacionesInversas] = useState<unknown[]>([])
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const esNavegacion = searchParams.get('nav') === '1'
  const [cargando, setCargando] = useState(!esNuevo && !esNavegacion)
  const [actualizando, setActualizando] = useState(esNavegacion)
  const [modalEliminar, setModalEliminar] = useState(false)
  const [esProvisorio, setEsProvisorio] = useState(false)
  const [accionandoProvisorio, setAccionandoProvisorio] = useState(false)
  const [modalAceptarProvisorio, setModalAceptarProvisorio] = useState(false)
  const [modalFusionar, setModalFusionar] = useState(false)

  // ─── Estado solo creación ───
  const [errores, setErrores] = useState<ErroresContacto>({})
  const [duplicado, setDuplicado] = useState<{ id: string; nombre: string; codigo: string; mensaje: string } | null>(null)
  const [vinculacionesPendientes, setVinculacionesPendientes] = useState<VinculacionPendiente[]>([])
  const [modalVincular, setModalVincular] = useState(false)
  const [busquedaVinculo, setBusquedaVinculo] = useState('')
  const [resultadosVinculo, setResultadosVinculo] = useState<ContactoBusqueda[]>([])
  const [buscandoVinculo, setBuscandoVinculo] = useState(false)
  const creadoRef = useRef(false)

  // ─── Estado chatter — envío de correo ───
  const [modalCorreoAbierto, setModalCorreoAbierto] = useState(false)
  const [selectorDestinatariosAbierto, setSelectorDestinatariosAbierto] = useState(false)
  const [destinatariosIniciales, setDestinatariosIniciales] = useState<string[]>([])
  const [canalesCorreo, setCanalesCorreo] = useState<CanalCorreoEmpresa[]>([])
  const [plantillasCorreo, setPlantillasCorreo] = useState<PlantillaCorreo[]>([])
  const [enviandoCorreo, setEnviandoCorreo] = useState(false)

  // ─── Derivados ───
  const tipoActivo = tiposContacto.find(t => t.id === tipoContactoId)
  const claveTipo = tipoActivo?.clave || 'persona'
  const esPersona = TIPOS_PERSONA.includes(claveTipo)
  const esEdificio = claveTipo === 'edificio'
  const esEntidadSinContacto = ['edificio', 'empresa', 'proveedor'].includes(claveTipo)

  const camposIdentificacion = useMemo(
    () => camposFiscalesPais.filter(c => c.es_identificacion && c.aplica_a.includes(claveTipo) && (!paisContacto || c.pais === paisContacto)),
    [camposFiscalesPais, claveTipo, paisContacto]
  )
  const camposFiscalesFiltrados = useMemo(
    () => camposFiscalesPais.filter(c => !c.es_identificacion && c.aplica_a.includes(claveTipo) && (!paisContacto || c.pais === paisContacto)),
    [camposFiscalesPais, claveTipo, paisContacto]
  )

  // ═══════════════════════════════════════════════════════════════
  // EFECTOS
  // ═══════════════════════════════════════════════════════════════

  // Cargar tipos + config (compartido)
  useEffect(() => {
    Promise.all([
      fetch('/api/contactos/tipos').then(r => r.json()),
      fetch('/api/contactos/config').then(r => r.json()),
    ]).then(([tipos, config]) => {
      const tiposContactoArr = tipos.tipos_contacto?.length ? tipos.tipos_contacto : TIPOS_FALLBACK
      setTiposContacto(tiposContactoArr)
      if (tipos.tipos_relacion) setTiposRelacion(tipos.tipos_relacion)
      if (tipos.puestos_vinculacion) setPuestosVinculacion(tipos.puestos_vinculacion)
      if (tipos.campos_fiscales) setCamposFiscalesPais(tipos.campos_fiscales)
      if (tipos.paises?.length) {
        setPaisesEmpresa(tipos.paises)
        if (tipos.paises.length === 1) setPaisContacto(tipos.paises[0])
      }
      if (config.etiquetas) setEtiquetasConfig(config.etiquetas.filter((e: Record<string, unknown>) => e.activo !== false).map((e: Record<string, unknown>) => ({ nombre: e.nombre as string, color: (e.color as string) || 'neutro' })))
      if (config.rubros) setRubrosConfig(config.rubros.filter((r: Record<string, unknown>) => r.activo !== false).map((r: Record<string, unknown>) => ({ nombre: r.nombre as string })))

      // En modo creación: preseleccionar persona
      if (esNuevo) {
        const persona = tiposContactoArr.find((t: TipoContacto) => t.clave === 'persona')
        if (persona) {
          setTipoContactoId(persona.id)
          const paisInicial = tipos.paises?.length === 1 ? tipos.paises[0] : ''
          const primerIdent = (tipos.campos_fiscales || []).find((c: CampoFiscalPais) =>
            c.es_identificacion && c.aplica_a.includes('persona') && (!paisInicial || c.pais === paisInicial)
          )
          setCampos(prev => ({ ...prev, tipo_identificacion: primerIdent?.clave || '' }))
        }
      }
    }).catch(() => {
      if (esNuevo) {
        setTiposContacto(TIPOS_FALLBACK)
        const persona = TIPOS_FALLBACK.find(t => t.clave === 'persona')
        if (persona) setTipoContactoId(persona.id)
      }
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Cargar contacto existente (solo edición, no al crear in-place)
  useEffect(() => {
    if (esNuevo) return
    // Si el contacto acaba de crearse in-place, no recargar (ya tenemos los datos locales)
    if (creadoRef.current) return
    fetch(`/api/contactos/${contactoId}`)
      .then(r => r.json())
      .then(data => {
        if (!data.id) return
        const nc = combinarNombre(data.nombre || '', data.apellido)
        setNombreCompleto(nc)
        if (desdeId && desdeNombre) setMigajaDinamica(`/contactos/${desdeId}`, desdeNombre)
        setMigajaDinamica(pathname, nc || data.codigo || 'Detalle')
        setCodigo(data.codigo || '')
        setEsProvisorio(data.es_provisorio || false)
        setMiembroIdVinculado(data.miembro_id || null)
        setTipoContactoId(data.tipo_contacto_id || '')
        setAvatarUrl(data.avatar_url || null)
        setDatosFiscales(data.datos_fiscales || {})
        if (data.pais_fiscal) setPaisContacto(data.pais_fiscal)
        setEtiquetas(data.etiquetas || [])
        setTelefonos(
          (data.telefonos || []).map((t: Record<string, unknown>) => ({
            tipo: (t.tipo as TelefonoNormalizado['tipo']) || 'movil',
            valor: (t.valor as string) || '',
            es_whatsapp: !!t.es_whatsapp,
            es_principal: !!t.es_principal,
            etiqueta: (t.etiqueta as string | null) || null,
            orden: typeof t.orden === 'number' ? t.orden : 0,
          }))
        )
        setCampos({
          titulo: data.titulo || '', correo: data.correo || '',
          web: data.web || '', cargo: data.cargo || '', rubro: data.rubro || '',
          tipo_identificacion: data.tipo_identificacion || '',
          numero_identificacion: data.numero_identificacion || '',
          moneda: data.moneda || 'ARS', idioma: data.idioma || 'es',
          limite_credito: data.limite_credito?.toString() || '',
          plazo_pago_cliente: data.plazo_pago_cliente || '',
          plazo_pago_proveedor: data.plazo_pago_proveedor || '',
          notas: data.notas || '',
        })
        if (data.direcciones?.length) {
          setDirecciones(data.direcciones.map((d: Record<string, unknown>) => ({
            id: (d.id as string) || crypto.randomUUID(),
            tipo: (d.tipo as string) || 'principal',
            datos: {
              calle: (d.calle as string) || '', barrio: (d.barrio as string) || '',
              ciudad: (d.ciudad as string) || '', provincia: (d.provincia as string) || '',
              codigoPostal: (d.codigo_postal as string) || '', pais: (d.pais as string) || '',
              piso: (d.piso as string) || '', departamento: (d.departamento as string) || '',
              lat: (d.lat as number) || null, lng: (d.lng as number) || null,
              textoCompleto: (d.texto as string) || '',
            },
          })))
        }
        if (data.vinculaciones) setVinculaciones(data.vinculaciones)
        if (data.vinculaciones_inversas) setVinculacionesInversas(data.vinculaciones_inversas)
      })
      .catch(() => {})
      .finally(() => { setCargando(false); setActualizando(false) })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contactoId])

  // Búsqueda de contactos para vincular (solo creación)
  useEffect(() => {
    if (!esNuevo || !modalVincular || busquedaVinculo.length < 2) {
      setResultadosVinculo([])
      return
    }
    const timeout = setTimeout(async () => {
      setBuscandoVinculo(true)
      try {
        const res = await fetch(`/api/contactos?busqueda=${encodeURIComponent(busquedaVinculo)}&por_pagina=10`)
        const data = await res.json()
        const idsYa = new Set(vinculacionesPendientes.map(v => v.vinculado_id))
        setResultadosVinculo((data.contactos || []).filter((c: ContactoBusqueda) => !idsYa.has(c.id)))
      } catch { setResultadosVinculo([]) }
      finally { setBuscandoVinculo(false) }
    }, DEBOUNCE_BUSQUEDA)
    return () => clearTimeout(timeout)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [busquedaVinculo, modalVincular])

  // ═══════════════════════════════════════════════════════════════
  // ACCIONES — EDICIÓN (autoguardado PATCH)
  // ═══════════════════════════════════════════════════════════════

  const recargar = useCallback(() => {
    if (esNuevo) return
    fetch(`/api/contactos/${contactoId}`)
      .then(r => r.json())
      .then(data => {
        if (data.vinculaciones) setVinculaciones(data.vinculaciones)
        if (data.vinculaciones_inversas) setVinculacionesInversas(data.vinculaciones_inversas)
      })
      .catch(() => {})
  }, [contactoId, esNuevo])

  const aceptarProvisorio = useCallback(async () => {
    setAccionandoProvisorio(true)
    try {
      const res = await fetch(`/api/contactos/${contactoId}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ es_provisorio: false }),
      })
      if (res.ok) {
        const data = await res.json()
        setEsProvisorio(false)
        if (data.codigo) setCodigo(data.codigo)
      }
    } catch (err) { console.error('Error aceptando provisorio:', err) }
    finally { setAccionandoProvisorio(false) }
  }, [contactoId])

  const descartarProvisorio = useCallback(async () => {
    setAccionandoProvisorio(true)
    try {
      const res = await fetch(`/api/contactos/${contactoId}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ en_papelera: true }),
      })
      if (res.ok) {
        const desde = new URLSearchParams(window.location.search).get('desde')
        router.push(desde === 'dashboard' ? '/dashboard' : '/contactos')
      }
    } catch (err) { console.error('Error descartando provisorio:', err) }
    finally { setAccionandoProvisorio(false) }
  }, [contactoId, router])

  // Autoguardado genérico (solo edición)
  const guardar = useCallback(async (payload: Record<string, unknown>) => {
    if (esNuevo) return // En creación no se autoguarda
    setGuardando(true)
    setErrorGuardado('')
    try {
      const res = await fetch(`/api/contactos/${contactoId}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setErrorGuardado(data.error || 'Error al guardar')
        setTimeout(() => setErrorGuardado(''), DELAY_NOTIFICACION)
      }
    } catch {
      setErrorGuardado('Error de conexión')
      setTimeout(() => setErrorGuardado(''), DELAY_NOTIFICACION)
    } finally { setGuardando(false) }
  }, [contactoId, esNuevo])

  const guardarNombre = useCallback(() => {
    if (esNuevo) return
    const { nombre, apellido } = separarNombreApellido(nombreCompleto, esPersona)
    guardar({ nombre, apellido: apellido || null })
  }, [nombreCompleto, esPersona, guardar, esNuevo])

  const guardarCampo = useCallback((campo: string) => {
    if (esNuevo) return
    guardar({ [campo]: campos[campo] || null })
  }, [campos, guardar, esNuevo])

  const guardarSelect = useCallback((campo: string, valor: string) => {
    setCampos(prev => ({ ...prev, [campo]: valor }))
    if (!esNuevo) guardar({ [campo]: valor || null })
  }, [guardar, esNuevo])

  // Guardar lista de teléfonos al cambiar (autoguardado tipo lista — el backend hace reemplazo completo).
  // En creación: dispara intentarCrear cuando se cumple puedeGuardar (equivalente al onBlur del
  // teléfono que existía en la versión vieja con inputs separados). setTimeout 0 para esperar
  // a que setTelefonos se aplique antes de evaluar puedeGuardar.
  const guardarTelefonos = useCallback((nuevos: TelefonoNormalizado[]) => {
    setTelefonos(nuevos)
    if (esNuevo) {
      setTimeout(() => intentarCrearRef.current?.(), 0)
    } else {
      guardar({ telefonos: nuevos })
    }
  }, [guardar, esNuevo])

  const guardarFiscal = useCallback((clave: string, valor: string) => {
    setDatosFiscales(prev => {
      const nuevos = { ...prev, [clave]: valor }
      if (!esNuevo) guardar({ datos_fiscales: nuevos })
      return nuevos
    })
  }, [guardar, esNuevo])

  const subirFoto = useCallback(async (archivo: File) => {
    if (esNuevo) return
    const supabase = crearClienteNavegador()
    const extension = archivo.name.split('.').pop() || 'jpg'
    const ruta = `${contactoId}.${extension}`
    const { error: uploadError } = await supabase.storage.from('avatares-contactos').upload(ruta, archivo, { upsert: true })
    if (uploadError) { setErrorGuardado('Error al subir foto'); return }
    const { data } = supabase.storage.from('avatares-contactos').getPublicUrl(ruta)
    const url = data.publicUrl + '?t=' + Date.now()
    setAvatarUrl(url)
    guardar({ avatar_url: url })
  }, [contactoId, guardar, esNuevo])

  const moverAPapelera = async () => {
    await guardar({ en_papelera: true })
    router.push('/contactos')
  }

  // ═══════════════════════════════════════════════════════════════
  // ACCIONES — CREACIÓN (POST único)
  // ═══════════════════════════════════════════════════════════════

  // Cambiar tipo de contacto (solo creación — en edición lo maneja el BannerContacto)
  const cambiarTipo = useCallback((tipoId: string) => {
    const tipo = tiposContacto.find(t => t.id === tipoId)
    if (!tipo) return
    setTipoContactoId(tipoId)
    const primerIdent = camposFiscalesPais.find(c =>
      c.es_identificacion && c.aplica_a.includes(tipo.clave) && (!paisContacto || c.pais === paisContacto)
    )
    setCampos(prev => ({
      ...prev,
      tipo_identificacion: primerIdent?.clave || '',
      numero_identificacion: '',
      cargo: TIPOS_PERSONA.includes(tipo.clave) ? prev.cargo || '' : '',
      rubro: ['empresa', 'proveedor'].includes(tipo.clave) ? prev.rubro || '' : '',
    }))
    setDatosFiscales({})
  }, [tiposContacto, camposFiscalesPais, paisContacto])

  const cambiarPaisContactoNuevo = useCallback((nuevoPais: string) => {
    setPaisContacto(nuevoPais)
    const primerIdent = camposFiscalesPais.find(c =>
      c.es_identificacion && c.aplica_a.includes(claveTipo) && c.pais === nuevoPais
    )
    setCampos(prev => ({
      ...prev,
      tipo_identificacion: primerIdent?.clave || '',
      numero_identificacion: '',
    }))
    setDatosFiscales({})
  }, [camposFiscalesPais, claveTipo])

  // Validación y auto-crear (edificios/empresas/proveedores pueden tener solo nombre + dirección)
  const tieneNombre = nombreCompleto.trim().length > 0
  const tieneDireccion = direcciones.some(d => d.datos.calle.trim())
  const tieneTelefono = telefonos.length > 0
  const tieneDatoContacto = (esEntidadSinContacto && tieneDireccion) || !!(
    campos.correo?.trim() || tieneTelefono || tieneDireccion
  )
  const puedeGuardar = esNuevo && tieneNombre && tieneDatoContacto && !!tipoContactoId && !guardando

  const crearContactoFn = useCallback(async () => {
    if (guardando) return
    setGuardando(true)
    try {
      const { nombre, apellido } = separarNombreApellido(nombreCompleto, esPersona)
      const payload: Record<string, unknown> = {
        tipo_contacto_id: tipoContactoId,
        nombre, apellido: apellido || null,
        titulo: campos.titulo || null,
        correo: campos.correo || null,
        // Lista de teléfonos (modelo nuevo). El backend la procesa y sincroniza contactos.telefono/whatsapp.
        telefonos,
        web: campos.web || null,
        cargo: campos.cargo || null,
        rubro: campos.rubro || null,
        pais_fiscal: paisContacto || null,
        tipo_identificacion: campos.tipo_identificacion || null,
        numero_identificacion: campos.numero_identificacion || null,
        datos_fiscales: datosFiscales,
        moneda: campos.moneda || 'ARS', idioma: campos.idioma || 'es',
        limite_credito: campos.limite_credito ? parseFloat(campos.limite_credito) : null,
        plazo_pago_cliente: campos.plazo_pago_cliente || null,
        plazo_pago_proveedor: campos.plazo_pago_proveedor || null,
        etiquetas,
        notas: campos.notas || null,
      }
      if (direcciones.length > 0) {
        payload.direcciones = direcciones
          .filter(d => d.datos.calle || d.datos.ciudad)
          .map((d, i) => ({
            tipo: d.tipo,
            calle: d.datos.calle, barrio: d.datos.barrio,
            ciudad: d.datos.ciudad, provincia: d.datos.provincia,
            codigo_postal: d.datos.codigoPostal, pais: d.datos.pais,
            piso: d.datos.piso, departamento: d.datos.departamento,
            lat: d.datos.lat, lng: d.datos.lng,
            texto: d.datos.textoCompleto, es_principal: i === 0,
          }))
      }

      const res = await fetch('/api/contactos', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const nuevo = await res.json()

      if (res.ok && nuevo.id) {
        if (vinculacionesPendientes.length > 0) {
          await Promise.allSettled(
            vinculacionesPendientes.map(v =>
              fetch('/api/contactos/vinculaciones', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ contacto_id: nuevo.id, vinculado_id: v.vinculado_id, puesto: null, recibe_documentos: false }),
              })
            )
          )
        }
        // Transición in-place: actualizar estado sin recargar la página
        // para preservar datos que el usuario está completando
        setContactoId(nuevo.id)
        setCodigo(nuevo.codigo || '')
        setMigajaDinamica(`/contactos/${nuevo.id}`, nombreCompleto || nuevo.codigo || 'Detalle')
        window.history.replaceState(null, '', `/contactos/${nuevo.id}`)
        // Guardar direcciones pendientes si las hay
        if (direcciones.length > 0) {
          const dirsValidas = direcciones.filter(d => d.datos.calle || d.datos.ciudad)
          if (dirsValidas.length > 0) {
            fetch(`/api/contactos/${nuevo.id}/direcciones`, {
              method: 'PUT', headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ direcciones: dirsValidas.map((d, i) => ({
                tipo: d.tipo,
                calle: d.datos.calle, barrio: d.datos.barrio,
                ciudad: d.datos.ciudad, provincia: d.datos.provincia,
                codigo_postal: d.datos.codigoPostal, pais: d.datos.pais,
                piso: d.datos.piso, departamento: d.datos.departamento,
                lat: d.datos.lat, lng: d.datos.lng,
                texto: d.datos.textoCompleto, es_principal: i === 0,
              })) }),
            }).catch(() => {})
          }
        }
        return
      }

      if (res.status === 409 && nuevo.error === 'duplicado') {
        setDuplicado({ id: nuevo.duplicado.id, nombre: nuevo.duplicado.nombre, codigo: nuevo.duplicado.codigo, mensaje: nuevo.mensaje })
        creadoRef.current = false
        return
      }

      setErrorGuardado(nuevo.error || 'Error al crear el contacto')
      // Solo permitir reintento en errores de validación (400), no en 500/403
      if (res.status < 500 && res.status !== 403) creadoRef.current = false
    } catch {
      setErrorGuardado('Error de conexión')
    } finally { setGuardando(false) }
  }, [guardando, nombreCompleto, esPersona, tipoContactoId, campos, datosFiscales, paisContacto, etiquetas, direcciones, telefonos, vinculacionesPendientes, setMigajaDinamica])

  const intentarCrear = useCallback(() => {
    if (!puedeGuardar || creadoRef.current || guardando) return
    const errs = validarCamposContacto({
      correo: campos.correo || '',
      web: campos.web || '',
      tipo_identificacion: campos.tipo_identificacion || '',
      numero_identificacion: campos.numero_identificacion || '',
    })
    setErrores(errs)
    if (!sinErrores(errs)) return
    creadoRef.current = true
    crearContactoFn()
  }, [puedeGuardar, guardando, campos, crearContactoFn])

  // Ref al último intentarCrear para invocarlo desde callbacks (guardarTelefonos, etc.)
  // sin meterlo en deps y recrear esos callbacks a cada render.
  const intentarCrearRef = useRef(intentarCrear)
  useEffect(() => { intentarCrearRef.current = intentarCrear }, [intentarCrear])

  // ═══════════════════════════════════════════════════════════════
  // HANDLERS COMPARTIDOS
  // ═══════════════════════════════════════════════════════════════

  // onBlur de campos: en edición autoguarda, en creación intenta crear
  const onBlurCampo = useCallback((campo: string) => {
    if (esNuevo) intentarCrear()
    else guardarCampo(campo)
  }, [esNuevo, intentarCrear, guardarCampo])

  const onBlurNombre = useCallback(() => {
    if (esNuevo) intentarCrear()
    else guardarNombre()
  }, [esNuevo, intentarCrear, guardarNombre])

  // Direcciones
  const manejarDirecciones = useCallback((dirs: DireccionConTipo[]) => {
    setDirecciones(dirs)
    // Auto-nombre para edificios en creación
    if (esNuevo && esEdificio && dirs.length > 0 && dirs[0].datos.calle && !nombreCompleto) {
      setNombreCompleto(`Edif. ${dirs[0].datos.calle}`)
    }
    // Autoguardar direcciones en edición
    if (!esNuevo) {
      const dirsParaGuardar = dirs
        .filter(d => d.datos.calle || d.datos.ciudad)
        .map((d, i) => ({
          tipo: d.tipo,
          calle: d.datos.calle, barrio: d.datos.barrio,
          ciudad: d.datos.ciudad, provincia: d.datos.provincia,
          codigo_postal: d.datos.codigoPostal, pais: d.datos.pais,
          piso: d.datos.piso, departamento: d.datos.departamento,
          lat: d.datos.lat, lng: d.datos.lng,
          texto: d.datos.textoCompleto, es_principal: i === 0,
        }))
      fetch(`/api/contactos/${contactoId}/direcciones`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ direcciones: dirsParaGuardar }),
      }).catch(() => {})
    }
  }, [esNuevo, esEdificio, nombreCompleto, contactoId])

  // Auto-crear edificios/empresas/proveedores cuando se carga la dirección
  useEffect(() => {
    if (esNuevo && esEntidadSinContacto && puedeGuardar) {
      intentarCrear()
    }
  }, [esNuevo, esEntidadSinContacto, puedeGuardar, intentarCrear])

  // País fiscal
  const onCambiarPais = useCallback((valor: string) => {
    if (esNuevo) {
      cambiarPaisContactoNuevo(valor)
    } else {
      setPaisContacto(valor)
      guardar({ pais_fiscal: valor || null })
    }
  }, [esNuevo, cambiarPaisContactoNuevo, guardar])

  // ─── Cargar canales y plantillas de correo (para el chatter) ───
  // Solo en edición: si el contacto existe y tiene correo, habilitamos el botón
  useEffect(() => {
    if (esNuevo) return
    fetch('/api/correo/canales?modulo=contactos')
      .then(r => r.json())
      .then(data => {
        const canales = (data.canales || [])
          .filter((c: { activo: boolean }) => c.activo)
          .map((c: { id: string; nombre: string; config_conexion: Record<string, string>; es_principal?: boolean }) => ({
            id: c.id,
            nombre: c.nombre,
            email: c.config_conexion?.email || c.config_conexion?.usuario || c.nombre,
            predeterminado: !!c.es_principal,
          }))
        setCanalesCorreo(canales)
      })
      .catch(() => {})

    fetch('/api/correo/plantillas')
      .then(r => r.json())
      .then(data => {
        const pls = (data.plantillas || []).map((p: { id: string; nombre: string; asunto: string; contenido_html: string; canal_id?: string; creado_por?: string }) => ({
          id: p.id,
          nombre: p.nombre,
          asunto: p.asunto || '',
          contenido_html: p.contenido_html || '',
          canal_id: p.canal_id || null,
          creado_por: p.creado_por || '',
        }))
        setPlantillasCorreo(pls)
      })
      .catch(() => {})
  }, [esNuevo])

  // ─── Candidatos de destinatario para correo desde el chatter ───
  // Incluye al contacto actual (si tiene correo) y a todos los vinculados
  // en cualquier dirección que tengan correo. Útil para empresas/edificios
  // sin correo propio que delegan en personas vinculadas.
  const candidatosCorreo = useMemo(() => {
    const items: { id: string; nombre: string; correo: string; relacion: string | null }[] = []
    const vistos = new Set<string>()

    const agregar = (id: string, nombre: string, correo: string | null, relacion: string | null) => {
      if (!correo) return
      const clave = correo.toLowerCase()
      if (vistos.has(clave)) return
      vistos.add(clave)
      items.push({ id, nombre: nombre.trim() || correo, correo, relacion })
    }

    if (campos.correo && contactoId) {
      agregar(contactoId, nombreCompleto, campos.correo, null)
    }

    for (const v of mapearVinculaciones(vinculaciones)) {
      const nombreV = [v.nombre, v.apellido].filter(Boolean).join(' ')
      const rel = v.tipo_relacion_etiqueta || v.puesto || v.tipo_etiqueta
      agregar(v.vinculado_id, nombreV, v.correo, rel)
    }
    for (const v of mapearVinculacionesInversas(vinculacionesInversas)) {
      const nombreV = [v.nombre, v.apellido].filter(Boolean).join(' ')
      const rel = v.tipo_relacion_etiqueta || v.puesto || v.tipo_etiqueta
      agregar(v.vinculado_id, nombreV, v.correo, rel)
    }
    return items
  }, [campos.correo, contactoId, nombreCompleto, vinculaciones, vinculacionesInversas])

  // Al hacer clic en "Correo" del chatter:
  //   Si hay al menos un candidato (contacto o vinculado con correo), mostrar
  //   el selector para elegir destinatarios (+ campo libre para otro correo).
  //   Sin candidatos → abrir modal directo, el usuario escribe el correo.
  const abrirCorreoDesdeChatter = useCallback(() => {
    if (candidatosCorreo.length === 0) {
      setDestinatariosIniciales([])
      setModalCorreoAbierto(true)
    } else {
      setSelectorDestinatariosAbierto(true)
    }
  }, [candidatosCorreo])

  // ─── Enviar correo desde el chatter del contacto ───
  // POST a /api/inbox/correo/enviar con entidad_tipo='contacto' para que
  // el endpoint registre la entrada en el chatter automáticamente y
  // aplique threading (In-Reply-To/References) con el último correo de este contacto.
  const handleEnviarCorreo = useCallback(async (datos: DatosEnvioDocumento) => {
    if (!contactoId) return
    setEnviandoCorreo(true)
    try {
      const res = await fetch('/api/inbox/correo/enviar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          canal_id: datos.canal_id,
          correo_para: datos.correo_para,
          correo_cc: datos.correo_cc.length > 0 ? datos.correo_cc : undefined,
          correo_cco: datos.correo_cco.length > 0 ? datos.correo_cco : undefined,
          correo_asunto: datos.asunto,
          texto: datos.texto,
          html: datos.html,
          adjuntos_ids: datos.adjuntos_ids.length > 0 ? datos.adjuntos_ids : undefined,
          tipo: 'nuevo',
          programado_para: datos.programado_para,
          entidad_tipo: 'contacto',
          entidad_id: contactoId,
        }),
      })
      if (res.ok) {
        setModalCorreoAbierto(false)
        // El chatter se actualiza solo por realtime (suscripción a tabla chatter)
      }
    } finally {
      setEnviandoCorreo(false)
    }
  }, [contactoId])

  // ═══════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════

  if (cargando) return <Cargador tamano="pagina" />

  return (
    <div className="flex flex-col h-full overflow-auto">

      {/* ═══ CABECERO ═══ */}
      <div className="shrink-0 border-b border-borde-sutil">
        <div className="flex items-center justify-between px-4 sm:px-6 py-2">
          <div className="flex items-center gap-2 text-sm min-w-0">
            {guardando && <span className="text-xs text-texto-terciario animate-pulse">{esNuevo ? 'Creando contacto...' : t('contactos.guardando')}</span>}
            {errorGuardado && <span className="text-xs text-insignia-peligro">{errorGuardado}</span>}
          </div>
          {!esNuevo && (
            <Boton variante="fantasma" tamano="xs" icono={<Trash2 size={14} />} onClick={() => setModalEliminar(true)} className="text-texto-terciario hover:text-insignia-peligro hover:bg-insignia-peligro-fondo">
              <span className="hidden sm:inline">{t('comun.eliminar')}</span>
            </Boton>
          )}
        </div>

        {/* Creación: selector de tipo como pills / Edición: barra de KPIs */}
        {esNuevo ? (
          <div className="px-4 sm:px-6 pb-3 flex flex-col items-center">
            <div className="text-xs text-texto-terciario mb-1.5">Tipo de contacto</div>
            <div className="flex items-center gap-1.5 flex-wrap justify-center">
              {tiposContacto.filter(t => t.clave !== 'equipo').map(tipo => {
                const activo = tipo.id === tipoContactoId
                const Icono = ICONOS_TIPO[tipo.clave] || User
                const color = COLOR_TIPO_CONTACTO[tipo.clave] || 'neutro'
                return (
                  <button key={tipo.id} type="button" onClick={() => cambiarTipo(tipo.id)}
                    className={[
                      'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-all duration-150 border cursor-pointer focus-visible:outline-2 focus-visible:outline-texto-marca focus-visible:-outline-offset-2',
                      activo ? 'border-transparent' : 'bg-transparent text-texto-secundario border-borde-sutil hover:border-borde-fuerte hover:text-texto-primario',
                    ].join(' ')}
                    style={activo ? { backgroundColor: `var(--insignia-${color}-fondo)`, color: `var(--insignia-${color}-texto)`, borderColor: 'transparent' } : undefined}>
                    <Icono size={14} />{tipo.etiqueta}
                  </button>
                )
              })}
            </div>
          </div>
        ) : (
          <div className="px-4 sm:px-6 pb-3">
            <BarraKPIs contactoId={contactoId!} contactoNombre={nombreCompleto || 'Contacto'} />
          </div>
        )}
      </div>

      {/* ═══ CONTENIDO ═══ */}
      <div className={`flex-1 overflow-auto transition-opacity duration-150 ${actualizando ? 'opacity-40 pointer-events-none' : ''}`}>
        <div className="max-w-4xl mx-auto px-4 sm:px-8 lg:px-12 py-0 space-y-6">

          {/* Banner + Avatar + selector de tipo */}
          <BannerContacto
            nombre={nombreCompleto}
            codigo={codigo}
            avatarUrl={esNuevo ? null : avatarUrl}
            tipoActivo={tipoActivo || null}
            claveTipo={claveTipo}
            tiposContacto={tiposContacto}
            puedeEditar={!esNuevo}
            onCambiarTipo={esNuevo ? undefined : (tipoId) => {
              const tipo = tiposContacto.find(t => t.id === tipoId)
              setTipoContactoId(tipoId)
              const esNuevaPersona = tipo && TIPOS_PERSONA.includes(tipo.clave)
              const esNuevaEmpresa = tipo && ['empresa', 'proveedor'].includes(tipo.clave)
              const limpiar: Record<string, unknown> = { tipo_contacto_id: tipoId }
              if (!esNuevaPersona) { limpiar.cargo = null; setCampos(p => ({ ...p, cargo: '' })) }
              if (!esNuevaEmpresa) { limpiar.rubro = null; setCampos(p => ({ ...p, rubro: '' })) }
              guardar(limpiar)
            }}
            onSubirFoto={esNuevo ? undefined : subirFoto}
            acciones={esNuevo ? [] : [
              { id: 'fusionar', etiqueta: 'Fusionar con otro contacto', icono: <Merge size={14} />, onClick: () => setModalFusionar(true) },
              { id: 'eliminar', etiqueta: 'Eliminar contacto', icono: <Trash2 size={14} />, peligro: true, onClick: () => setModalEliminar(true) },
            ]}
          />

          {/* Banner provisorio (solo edición) */}
          {!esNuevo && esProvisorio && (
            <div className="flex items-center justify-between px-4 py-3 rounded-card"
              style={{ background: 'var(--insignia-advertencia-fondo)', border: '1px solid var(--insignia-advertencia)' }}>
              <div className="flex items-center gap-2">
                <Clock size={16} style={{ color: 'var(--insignia-advertencia)' }} />
                <div>
                  <p className="text-sm font-medium" style={{ color: 'var(--texto-primario)' }}>Contacto provisorio</p>
                  <p className="text-xs" style={{ color: 'var(--texto-secundario)' }}>Llegó por WhatsApp. Aceptalo para asignarle un código o descartalo.</p>
                </div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <Boton variante="exito" tamano="sm" icono={<UserCheck size={14} />} onClick={() => setModalAceptarProvisorio(true)} disabled={accionandoProvisorio}>Aceptar</Boton>
                <Boton variante="peligro" tamano="sm" icono={<Trash2 size={14} />} onClick={descartarProvisorio} disabled={accionandoProvisorio}>Descartar</Boton>
              </div>
            </div>
          )}

          {/* Nombre completo. Si el contacto está vinculado a un miembro, el nombre
              se edita desde la sección Usuarios y acá queda read-only. */}
          <div className="pl-1">
            <Input
              variante="plano"
              value={nombreCompleto}
              onChange={e => { if (!miembroIdVinculado) setNombreCompleto(e.target.value) }}
              onBlur={() => { if (!miembroIdVinculado) onBlurNombre() }}
              readOnly={!!miembroIdVinculado}
              placeholder={t('contactos.nombre_completo')}
              autoFocus={esNuevo}
              formato={esPersona ? 'nombre_persona' : 'nombre_empresa'}
              className={`[&_input]:text-2xl [&_input]:font-bold ${miembroIdVinculado ? '[&_input]:cursor-not-allowed' : ''}`}
              title={miembroIdVinculado ? 'El nombre se edita desde la sección Usuarios' : undefined}
            />
            {miembroIdVinculado && (
              <p className="text-[11px] text-texto-terciario mt-1 pl-0">
                Datos sincronizados con la cuenta del usuario.{' '}
                <a
                  href={`/configuracion/usuarios/${miembroIdVinculado}`}
                  className="text-texto-marca hover:underline"
                >
                  Editar en Usuarios →
                </a>
              </p>
            )}
          </div>

          {/* Contacto directo + puesto/etiquetas en 2 columnas (60/40) */}
          <section className="flex flex-col sm:flex-row gap-8">
            {/* Columna izquierda (60%): datos de comunicación */}
            <div className="flex-[3] min-w-0 space-y-2">
              <Input variante="plano" tipo="email" icono={<Mail size={16} />}
                value={campos.correo || ''}
                onChange={e => { if (miembroIdVinculado) return; setCampos(p => ({ ...p, correo: e.target.value })); if (esNuevo) setErrores(p => ({ ...p, correo: undefined })) }}
                onBlur={() => { if (!miembroIdVinculado) onBlurCampo('correo') }}
                readOnly={!!miembroIdVinculado}
                title={miembroIdVinculado ? 'El correo se edita desde la sección Usuarios' : undefined}
                placeholder={t('contactos.correo')} formato="email" error={esNuevo ? errores.correo : undefined} />

              {/* Lista de teléfonos: N por contacto, cada uno con tipo + flag WhatsApp + principal.
                  Las filas con origen='sync_*' se muestran con candado y no se pueden editar. */}
              <TelefonosContacto
                telefonos={telefonos}
                onChange={guardarTelefonos}
                miembroVinculado={miembroIdVinculado ? { nombre: nombreCompleto } : null}
              />

              {(claveTipo === 'empresa' || claveTipo === 'proveedor') && (
                <Input variante="plano" tipo="url" icono={<Globe size={16} />}
                  value={campos.web || ''} onChange={e => setCampos(p => ({ ...p, web: e.target.value }))}
                  onBlur={() => onBlurCampo('web')} placeholder="Sitio web" formato="url" />
              )}
            </div>

            {/* Columna derecha (40%): puesto/rubro + etiquetas */}
            <div className="flex-[2] min-w-0 space-y-3">
              {esPersona && (
                <SelectorConSugerencias
                  etiqueta={t('comun.cargo')}
                  valor={campos.cargo || ''}
                  opciones={puestosVinculacion.map(p => p.etiqueta)}
                  tipoConfig="puesto"
                  onChange={v => { setCampos(p => ({ ...p, cargo: v })); if (!esNuevo) guardar({ cargo: v || null }) }}
                  placeholder="Buscar o crear puesto..."
                />
              )}
              {(claveTipo === 'empresa' || claveTipo === 'proveedor') && (
                <SelectorConSugerencias
                  etiqueta={t('comun.rubro')}
                  valor={campos.rubro || ''}
                  opciones={rubrosConfig.map(r => r.nombre)}
                  tipoConfig="rubro"
                  onChange={v => { setCampos(p => ({ ...p, rubro: v })); if (!esNuevo) guardar({ rubro: v || null }) }}
                  placeholder="Buscar o crear rubro..."
                />
              )}
              <SelectorEtiquetas
                etiquetas={etiquetas}
                etiquetasConfig={etiquetasConfig}
                onAgregar={(nombre, color) => {
                  if (etiquetas.includes(nombre)) return
                  const nuevas = [...etiquetas, nombre]
                  setEtiquetas(nuevas)
                  if (!esNuevo) guardar({ etiquetas: nuevas })
                  if (!etiquetasConfig.some(e => e.nombre === nombre)) {
                    fetch('/api/contactos/config', {
                      method: 'POST', headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ tipo: 'etiqueta', nombre, color }),
                    }).then(() => setEtiquetasConfig(prev => [...prev, { nombre, color }]))
                  }
                }}
                onQuitar={nombre => {
                  const nuevas = etiquetas.filter(e => e !== nombre)
                  setEtiquetas(nuevas)
                  if (!esNuevo) guardar({ etiquetas: nuevas })
                }}
              />
            </div>
          </section>

          {/* Direcciones */}
          <section>
            <DireccionesContacto
              direcciones={direcciones}
              onChange={manejarDirecciones}
              paises={paisesEmpresa.length ? paisesEmpresa : undefined}
            />
          </section>

          {/* Grid de campos */}
          <section className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-3">
            {paisesEmpresa.length > 1 && (
              <Fila etiqueta={t('contactos.pais_fiscal')}>
                <Select variante="plano"
                  opciones={paisesEmpresa.map(c => {
                    const p = PAISES_DISPONIBLES.find(pd => pd.codigo === c)
                    return { valor: c, etiqueta: p ? `${p.bandera} ${p.nombre}` : c }
                  })}
                  valor={paisContacto}
                  onChange={onCambiarPais} />
              </Fila>
            )}
            {camposIdentificacion.length > 0 && (
              <Fila etiqueta={t('contactos.identificacion')}>
                <div className="flex items-center gap-2">
                  {camposIdentificacion.length > 1 ? (
                    <div className="w-28 shrink-0">
                      <Select variante="plano"
                        opciones={camposIdentificacion.map(c => ({ valor: c.clave, etiqueta: c.etiqueta }))}
                        valor={campos.tipo_identificacion || ''} onChange={v => guardarSelect('tipo_identificacion', v)} />
                    </div>
                  ) : (
                    <span className="text-xs font-medium text-texto-secundario shrink-0">{camposIdentificacion[0].etiqueta}</span>
                  )}
                  <Input variante="plano" value={campos.numero_identificacion || ''}
                    onChange={e => setCampos(p => ({ ...p, numero_identificacion: e.target.value }))}
                    onBlur={() => onBlurCampo('numero_identificacion')}
                    placeholder={camposIdentificacion.find(c => c.clave === campos.tipo_identificacion)?.mascara || camposIdentificacion[0]?.etiqueta || ''} />
                </div>
              </Fila>
            )}
            <Fila etiqueta={t('contactos.titulo_campo')}>
              <Select variante="plano" valor={campos.titulo || ''} onChange={v => guardarSelect('titulo', v)}
                opciones={[{ valor: '', etiqueta: '—' }, { valor: 'Sr.', etiqueta: 'Sr.' }, { valor: 'Sra.', etiqueta: 'Sra.' }, { valor: 'Dr.', etiqueta: 'Dr.' }, { valor: 'Dra.', etiqueta: 'Dra.' }, { valor: 'Ing.', etiqueta: 'Ing.' }, { valor: 'Lic.', etiqueta: 'Lic.' }, { valor: 'Arq.', etiqueta: 'Arq.' }, { valor: 'Cr.', etiqueta: 'Cr.' }]} />
            </Fila>
            <Fila etiqueta={t('comun.idioma')}>
              <Select variante="plano" valor={campos.idioma || 'es'} onChange={v => guardarSelect('idioma', v)}
                opciones={[{ valor: 'es', etiqueta: 'Español' }, { valor: 'en', etiqueta: 'English' }, { valor: 'pt', etiqueta: 'Português' }]} />
            </Fila>
            <Fila etiqueta={t('comun.moneda_label')}>
              <Select variante="plano" valor={campos.moneda || 'ARS'} onChange={v => guardarSelect('moneda', v)}
                opciones={[{ valor: 'ARS', etiqueta: 'Peso argentino (ARS)' }, { valor: 'USD', etiqueta: 'Dólar (USD)' }, { valor: 'EUR', etiqueta: 'Euro (EUR)' }, { valor: 'MXN', etiqueta: 'Peso mexicano (MXN)' }, { valor: 'COP', etiqueta: 'Peso colombiano (COP)' }]} />
            </Fila>
            <Fila etiqueta={t('contactos.limite_credito')}>
              <Input variante="plano" tipo="number" value={campos.limite_credito || ''}
                onChange={e => setCampos(p => ({ ...p, limite_credito: e.target.value }))}
                onBlur={() => onBlurCampo('limite_credito')} placeholder="0" />
            </Fila>
            <Fila etiqueta={t('contactos.plazo_cliente')}>
              <Select variante="plano" valor={campos.plazo_pago_cliente || ''} onChange={v => guardarSelect('plazo_pago_cliente', v)}
                opciones={[{ valor: '', etiqueta: '—' }, { valor: 'contado', etiqueta: 'Contado' }, { valor: '15_dias', etiqueta: '15 días' }, { valor: '30_dias', etiqueta: '30 días' }, { valor: '60_dias', etiqueta: '60 días' }, { valor: '90_dias', etiqueta: '90 días' }]} />
            </Fila>
            <Fila etiqueta={t('contactos.plazo_proveedor')}>
              <Select variante="plano" valor={campos.plazo_pago_proveedor || ''} onChange={v => guardarSelect('plazo_pago_proveedor', v)}
                opciones={[{ valor: '', etiqueta: '—' }, { valor: 'contado', etiqueta: 'Contado' }, { valor: '15_dias', etiqueta: '15 días' }, { valor: '30_dias', etiqueta: '30 días' }, { valor: '60_dias', etiqueta: '60 días' }, { valor: '90_dias', etiqueta: '90 días' }]} />
            </Fila>
          </section>

          {/* Fiscal dinámico */}
          {camposFiscalesFiltrados.length > 0 && (
            <section>
              <h3 className="text-xs font-semibold text-texto-terciario uppercase tracking-wider mb-3">{t('contactos.datos_fiscales')}</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-3">
                {camposFiscalesFiltrados.map(campo => (
                  <Fila key={campo.clave} etiqueta={campo.etiqueta}>
                    {campo.tipo_campo === 'select' && campo.opciones ? (
                      <Select variante="plano" valor={datosFiscales[campo.clave] || ''}
                        onChange={v => guardarFiscal(campo.clave, v)}
                        opciones={[{ valor: '', etiqueta: `${t('comun.seleccionar')}...` }, ...(campo.opciones as { valor: string; etiqueta: string }[])]} />
                    ) : (
                      <Input variante="plano" value={datosFiscales[campo.clave] || ''}
                        onChange={e => setDatosFiscales(p => ({ ...p, [campo.clave]: e.target.value }))}
                        onBlur={() => guardarFiscal(campo.clave, datosFiscales[campo.clave] || '')}
                        placeholder={campo.mascara || campo.etiqueta} />
                    )}
                  </Fila>
                ))}
              </div>
            </section>
          )}

          {/* Vinculaciones / Relaciones */}
          {esNuevo ? (
            <section>
              <div className="rounded-card border border-borde-sutil overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3 border-b border-borde-sutil" style={{ backgroundColor: 'var(--superficie-tarjeta)' }}>
                  <div className="flex items-center gap-2">
                    <Link2 size={15} className="text-texto-terciario" />
                    <h3 className="text-sm font-semibold text-texto-primario">{t('contactos.relaciones')}</h3>
                    {vinculacionesPendientes.length > 0 && (
                      <span className="text-xs text-texto-terciario">({vinculacionesPendientes.length})</span>
                    )}
                  </div>
                  <Boton variante="fantasma" tamano="xs" icono={<Plus size={13} />} onClick={() => setModalVincular(true)}>Vincular</Boton>
                </div>
                <div className="px-4 py-3" style={{ backgroundColor: 'var(--superficie-app)' }}>
                  {vinculacionesPendientes.length > 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {vinculacionesPendientes.map(v => (
                        <div key={v.vinculado_id} className="flex items-center gap-3 p-2.5 rounded-card border border-borde-sutil hover:border-borde-fuerte transition-colors">
                          <Avatar nombre={v.nombre} tamano="sm" />
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium text-texto-primario truncate">{v.nombre}</div>
                            <div className="text-xs text-texto-terciario">{v.tipo_etiqueta} · {v.codigo}</div>
                          </div>
                          <Boton variante="fantasma" tamano="xs" soloIcono titulo="Remover" icono={<X size={14} />} onClick={() => setVinculacionesPendientes(prev => prev.filter(vp => vp.vinculado_id !== v.vinculado_id))} className="text-texto-terciario hover:text-insignia-peligro" />
                        </div>
                      ))}
                    </div>
                  ) : (
                    <Boton variante="secundario" tamano="sm" anchoCompleto onClick={() => setModalVincular(true)} className="border-dashed">
                      Vincular con empresa, proveedor o persona...
                    </Boton>
                  )}
                </div>
              </div>
            </section>
          ) : (
            <VinculacionesContacto
              contactoId={contactoId!}
              nombreContacto={nombreCompleto}
              vinculaciones={mapearVinculaciones(vinculaciones)}
              vinculacionesInversas={mapearVinculacionesInversas(vinculacionesInversas)}
              tiposRelacion={tiposRelacion}
              puestosVinculacion={puestosVinculacion}
              etiquetasConfig={etiquetasConfig}
              rubrosConfig={rubrosConfig}
              onActualizar={recargar}
            />
          )}

          {/* Panel de actividad (Chatter) */}
          {!esNuevo && (
            <PanelChatter
              entidadTipo="contacto"
              entidadId={contactoId!}
              contactoPrincipal={{ id: contactoId!, nombre: nombreCompleto }}
              contacto={{
                id: contactoId!,
                nombre: nombreCompleto,
                correo: campos.correo || undefined,
                whatsapp: telefonos.find(t => t.es_whatsapp)?.valor || undefined,
                telefono: telefonos.find(t => t.es_principal)?.valor || undefined,
              }}
              modo="inferior"
              onAbrirCorreo={canalesCorreo.length > 0 ? abrirCorreoDesdeChatter : undefined}
            />
          )}


          {/* Indicadores de estado (solo creación) */}
          {esNuevo && !guardando && tieneNombre && !tieneDatoContacto && (
            <div className="flex items-center justify-center py-4">
              <span className="text-xs text-texto-terciario">
                Completá al menos un email, teléfono, WhatsApp o dirección para guardar
              </span>
            </div>
          )}

          <div className="h-8" />
        </div>
      </div>

      {/* Modal de vincular contacto (solo creación) */}
      {esNuevo && (
        <Modal abierto={modalVincular} onCerrar={() => { setModalVincular(false); setBusquedaVinculo(''); setResultadosVinculo([]) }} titulo="Vincular contacto">
          <div className="space-y-4">
            <Input value={busquedaVinculo} onChange={e => setBusquedaVinculo(e.target.value)}
              placeholder="Buscar por nombre, email, código..." icono={<Search size={16} />} autoFocus />
            <div className="max-h-72 overflow-y-auto space-y-0.5">
              {buscandoVinculo && (
                <div className="flex justify-center py-4"><span className="text-sm text-texto-terciario animate-pulse">Buscando...</span></div>
              )}
              {!buscandoVinculo && busquedaVinculo.length >= 2 && resultadosVinculo.length === 0 && (
                <div className="text-center py-4"><p className="text-sm text-texto-terciario">No se encontraron contactos.</p></div>
              )}
              {resultadosVinculo.map(c => (
                <button key={c.id} type="button"
                  onClick={() => {
                    setVinculacionesPendientes(prev => [...prev, {
                      vinculado_id: c.id,
                      nombre: [c.nombre, c.apellido].filter(Boolean).join(' '),
                      codigo: c.codigo,
                      tipo_clave: c.tipo_contacto?.clave || 'persona',
                      tipo_etiqueta: c.tipo_contacto?.etiqueta || 'Persona',
                    }])
                    setModalVincular(false); setBusquedaVinculo(''); setResultadosVinculo([])
                  }}
                  className="flex items-center gap-3 w-full text-left px-3 py-2.5 rounded-card hover:bg-superficie-hover bg-transparent border-none cursor-pointer transition-colors focus-visible:outline-2 focus-visible:outline-texto-marca focus-visible:-outline-offset-2">
                  <Avatar nombre={[c.nombre, c.apellido].filter(Boolean).join(' ')} tamano="sm" />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-texto-primario truncate">{c.nombre} {c.apellido}</div>
                    <div className="text-xs text-texto-terciario">{c.tipo_contacto?.etiqueta} · {c.codigo}{c.correo && ` · ${c.correo}`}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </Modal>
      )}

      {/* Modal de duplicado (solo creación) */}
      {esNuevo && duplicado && (
        <Modal abierto={!!duplicado} onCerrar={() => { setDuplicado(null); creadoRef.current = false }}>
          <div className="space-y-4 p-1">
            <h3 className="text-lg font-bold text-texto-primario">{t('contactos.duplicado_detectado')}</h3>
            <p className="text-sm text-texto-secundario">{duplicado.mensaje}</p>
            <div className="rounded-card border border-borde-sutil p-3 flex items-center gap-3">
              <div className="size-10 rounded-full bg-insignia-advertencia-fondo text-insignia-advertencia-texto flex items-center justify-center text-sm font-bold">
                {duplicado.nombre.slice(0, 2).toUpperCase()}
              </div>
              <div>
                <div className="font-medium text-texto-primario">{duplicado.nombre}</div>
                <div className="text-xs text-texto-terciario font-mono">{duplicado.codigo}</div>
              </div>
            </div>
            <div className="flex items-center gap-2 justify-end pt-2">
              <Boton onClick={() => { setDuplicado(null); creadoRef.current = false }}>{t('comun.cancelar')}</Boton>
              <Boton onClick={() => router.push(`/contactos/${duplicado.id}`)}>Ir al contacto existente</Boton>
              <Boton onClick={() => {
                setDuplicado(null); creadoRef.current = false
                setTimeout(() => { creadoRef.current = true; crearContactoFn() }, 100)
              }}>{t('contactos.crear_igual')}</Boton>
            </div>
          </div>
        </Modal>
      )}

      {/* Modal de confirmación eliminar (solo edición) */}
      {!esNuevo && (
        <ModalConfirmacion
          abierto={modalEliminar}
          onCerrar={() => setModalEliminar(false)}
          onConfirmar={() => { setModalEliminar(false); moverAPapelera() }}
          titulo="Eliminar contacto"
          descripcion={`¿Estás seguro de que querés eliminar a ${nombreCompleto || 'este contacto'}? Se moverá a la papelera.`}
          tipo="peligro"
          etiquetaConfirmar={t('comun.eliminar')}
        />
      )}

      {/* Modal aceptar provisorio: nuevo contacto o unificar con existente */}
      {!esNuevo && esProvisorio && (
        <ModalAceptarProvisorio
          abierto={modalAceptarProvisorio}
          onCerrar={() => setModalAceptarProvisorio(false)}
          contactoId={contactoId!}
          nombreContacto={nombreCompleto}
          onAceptarNuevo={(cod) => {
            setEsProvisorio(false)
            if (cod) setCodigo(cod)
          }}
        />
      )}

      {/* Modal fusionar: migra histórico al destino y elimina este contacto */}
      {!esNuevo && (
        <ModalFusionarContacto
          abierto={modalFusionar}
          onCerrar={() => setModalFusionar(false)}
          contactoId={contactoId!}
          nombreContacto={nombreCompleto}
          codigoContacto={codigo || undefined}
        />
      )}

      {/* Selector de destinatarios (empresa/contacto con vinculados) */}
      {!esNuevo && (
        <ModalSeleccionarDestinatarios
          abierto={selectorDestinatariosAbierto}
          onCerrar={() => setSelectorDestinatariosAbierto(false)}
          candidatos={candidatosCorreo}
          onConfirmar={(emails) => {
            setSelectorDestinatariosAbierto(false)
            setDestinatariosIniciales(emails)
            setModalCorreoAbierto(true)
          }}
        />
      )}

      {/* Modal de envío de correo desde el chatter del contacto */}
      {!esNuevo && (
        <ModalEnviarDocumento
          abierto={modalCorreoAbierto}
          onCerrar={() => setModalCorreoAbierto(false)}
          onEnviar={handleEnviarCorreo}
          canales={canalesCorreo}
          plantillas={plantillasCorreo}
          correosDestinatario={destinatariosIniciales}
          nombreDestinatario={nombreCompleto}
          contactoPrincipalId={contactoId}
          contactoPrincipalNombre={nombreCompleto}
          tipoDocumento="Correo"
          enviando={enviandoCorreo}
        />
      )}
    </div>
  )
}

// ─── Modal: seleccionar destinatarios entre candidatos ───
// Muestra el contacto actual + todos sus vinculados con correo como
// checkboxes, además de un campo libre para agregar cualquier otro correo.
function ModalSeleccionarDestinatarios({
  abierto,
  onCerrar,
  candidatos,
  onConfirmar,
}: {
  abierto: boolean
  onCerrar: () => void
  candidatos: { id: string; nombre: string; correo: string; relacion: string | null }[]
  onConfirmar: (emails: string[]) => void
}) {
  const [seleccionados, setSeleccionados] = useState<Set<string>>(new Set())
  const [extras, setExtras] = useState<string[]>([]) // correos libres agregados
  const [inputLibre, setInputLibre] = useState('')
  const [errorLibre, setErrorLibre] = useState('')

  useEffect(() => {
    if (abierto) {
      const inicial = new Set<string>()
      if (candidatos.length > 0) inicial.add(candidatos[0].correo)
      setSeleccionados(inicial)
      setExtras([])
      setInputLibre('')
      setErrorLibre('')
    }
  }, [abierto, candidatos])

  const toggle = (correo: string) => {
    setSeleccionados(prev => {
      const next = new Set(prev)
      if (next.has(correo)) next.delete(correo); else next.add(correo)
      return next
    })
  }

  const agregarLibre = () => {
    const valor = inputLibre.trim().toLowerCase()
    if (!valor) return
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(valor)) {
      setErrorLibre('Correo no válido')
      return
    }
    // Evitar duplicados con candidatos o extras existentes
    const yaEnCandidatos = candidatos.some(c => c.correo.toLowerCase() === valor)
    const yaEnExtras = extras.includes(valor)
    if (yaEnCandidatos) {
      setSeleccionados(prev => new Set(prev).add(candidatos.find(c => c.correo.toLowerCase() === valor)!.correo))
    } else if (!yaEnExtras) {
      setExtras(prev => [...prev, valor])
      setSeleccionados(prev => new Set(prev).add(valor))
    }
    setInputLibre('')
    setErrorLibre('')
  }

  const confirmar = () => {
    const emails: string[] = []
    for (const c of candidatos) if (seleccionados.has(c.correo)) emails.push(c.correo)
    for (const e of extras) if (seleccionados.has(e)) emails.push(e)
    if (emails.length > 0) onConfirmar(emails)
  }

  return (
    <Modal abierto={abierto} onCerrar={onCerrar} tamano="md">
      <div className="p-6 space-y-4">
        <div>
          <h3 className="text-base font-semibold text-texto-primario">Enviar correo a</h3>
          <p className="text-xs text-texto-terciario mt-0.5">
            Elegí uno o más destinatarios. Podés agregar otro correo si no está en la lista.
          </p>
        </div>

        <div className="flex flex-col gap-1 max-h-[40vh] overflow-y-auto">
          {candidatos.map(c => (
            <label
              key={c.id + c.correo}
              className="flex items-center gap-3 px-3 py-2 rounded-card border border-borde-sutil hover:bg-superficie-hover cursor-pointer transition-colors"
            >
              <Checkbox
                marcado={seleccionados.has(c.correo)}
                onChange={() => toggle(c.correo)}
              />
              <div className="flex-1 min-w-0">
                <div className="text-sm text-texto-primario truncate">{c.nombre}</div>
                <div className="text-xs text-texto-terciario truncate">{c.correo}</div>
              </div>
              {c.relacion && (
                <span className="text-xs text-texto-terciario shrink-0">{c.relacion}</span>
              )}
            </label>
          ))}

          {extras.map(e => (
            <label
              key={e}
              className="flex items-center gap-3 px-3 py-2 rounded-card border border-borde-sutil hover:bg-superficie-hover cursor-pointer transition-colors"
            >
              <Checkbox
                marcado={seleccionados.has(e)}
                onChange={() => toggle(e)}
              />
              <div className="flex-1 min-w-0">
                <div className="text-sm text-texto-primario truncate">{e}</div>
                <div className="text-xs text-texto-terciario">Correo agregado</div>
              </div>
              <button
                type="button"
                onClick={(ev) => {
                  ev.preventDefault()
                  setExtras(prev => prev.filter(x => x !== e))
                  setSeleccionados(prev => {
                    const next = new Set(prev)
                    next.delete(e)
                    return next
                  })
                }}
                className="text-texto-terciario hover:text-texto-primario text-xs shrink-0"
              >
                Quitar
              </button>
            </label>
          ))}
        </div>

        <div className="pt-2 border-t border-borde-sutil">
          <label className="block text-xs text-texto-terciario mb-1">Agregar otro correo</label>
          <div className="flex gap-2">
            <Input
              value={inputLibre}
              onChange={e => { setInputLibre(e.target.value); setErrorLibre('') }}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); agregarLibre() } }}
              placeholder="alguien@ejemplo.com"
              className="flex-1"
            />
            <Boton variante="secundario" tamano="sm" onClick={agregarLibre} disabled={!inputLibre.trim()}>
              Agregar
            </Boton>
          </div>
          {errorLibre && <div className="text-xs text-[var(--insignia-peligro)] mt-1">{errorLibre}</div>}
        </div>

        <div className="flex items-center justify-end gap-2 pt-2 border-t border-borde-sutil">
          <Boton variante="fantasma" tamano="sm" onClick={onCerrar}>Cancelar</Boton>
          <Boton
            variante="primario"
            tamano="sm"
            onClick={confirmar}
            disabled={seleccionados.size === 0}
          >
            Continuar ({seleccionados.size})
          </Boton>
        </div>
      </div>
    </Modal>
  )
}

// ═══════════════════════════════════════════════════════════════
// FUNCIONES AUXILIARES
// ═══════════════════════════════════════════════════════════════

function mapearVinculaciones(vinculaciones: unknown[]): {
  id: string; vinculado_id: string; nombre: string; apellido: string | null
  correo: string | null; telefono: string | null; codigo: string
  tipo_clave: string; tipo_etiqueta: string; tipo_color: string
  puesto: string | null; recibe_documentos: boolean
  tipo_relacion_id: string | null; tipo_relacion_etiqueta: string | null
}[] {
  return (vinculaciones || []).map((_v: unknown) => {
    const v = _v as Record<string, unknown>
    const vinculado = v.vinculado as Record<string, unknown> | null
    const tipoContacto = vinculado?.tipo_contacto as Record<string, unknown> | null
    const tipoRelacion = v.tipo_relacion as Record<string, unknown> | null
    return {
      id: v.id as string,
      vinculado_id: v.vinculado_id as string,
      nombre: (vinculado?.nombre as string) || '',
      apellido: (vinculado?.apellido as string) || null,
      correo: (vinculado?.correo as string) || null,
      telefono: (vinculado?.telefono as string) || null,
      codigo: (vinculado?.codigo as string) || '',
      tipo_clave: (tipoContacto?.clave as string) || 'persona',
      tipo_etiqueta: (tipoContacto?.etiqueta as string) || 'Persona',
      tipo_color: (tipoContacto?.color as string) || 'primario',
      puesto: (v.puesto as string) || null,
      recibe_documentos: (v.recibe_documentos as boolean) || false,
      tipo_relacion_id: (v.tipo_relacion_id as string) || null,
      tipo_relacion_etiqueta: (tipoRelacion?.etiqueta as string) || null,
    }
  })
}

function mapearVinculacionesInversas(vinculaciones: unknown[]): ReturnType<typeof mapearVinculaciones> {
  return (vinculaciones || []).map((_v: unknown) => {
    const v = _v as Record<string, unknown>
    const contacto = v.contacto as Record<string, unknown> | null
    const tipoContacto = contacto?.tipo_contacto as Record<string, unknown> | null
    const tipoRelacion = v.tipo_relacion as Record<string, unknown> | null
    return {
      id: v.id as string,
      vinculado_id: v.contacto_id as string,
      nombre: (contacto?.nombre as string) || '',
      apellido: (contacto?.apellido as string) || null,
      correo: (contacto?.correo as string) || null,
      telefono: (contacto?.telefono as string) || null,
      codigo: (contacto?.codigo as string) || '',
      tipo_clave: (tipoContacto?.clave as string) || 'persona',
      tipo_etiqueta: (tipoContacto?.etiqueta as string) || 'Persona',
      tipo_color: (tipoContacto?.color as string) || 'primario',
      puesto: (v.puesto as string) || null,
      recibe_documentos: (v.recibe_documentos as boolean) || false,
      tipo_relacion_id: (v.tipo_relacion_id as string) || null,
      tipo_relacion_etiqueta: tipoRelacion ? (tipoRelacion.etiqueta_inversa as string) || (tipoRelacion.etiqueta as string) : null,
    }
  })
}

function Fila({ etiqueta, children }: { etiqueta: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline gap-3">
      <label className="text-sm text-texto-terciario w-28 shrink-0 text-right">{etiqueta}</label>
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  )
}

// ─── Selector con sugerencias (para puesto y rubro) ───

const COLORES_ETIQUETA = [
  { valor: 'neutro', etiqueta: 'Gris' },
  { valor: 'primario', etiqueta: 'Índigo' },
  { valor: 'info', etiqueta: 'Azul' },
  { valor: 'exito', etiqueta: 'Verde' },
  { valor: 'advertencia', etiqueta: 'Ámbar' },
  { valor: 'peligro', etiqueta: 'Rojo' },
  { valor: 'rosa', etiqueta: 'Rosa' },
  { valor: 'cyan', etiqueta: 'Cyan' },
  { valor: 'violeta', etiqueta: 'Violeta' },
  { valor: 'naranja', etiqueta: 'Naranja' },
]

function SelectorConSugerencias({
  etiqueta,
  valor,
  opciones,
  tipoConfig,
  onChange,
  placeholder,
}: {
  etiqueta: string
  valor: string
  opciones: string[]
  tipoConfig?: string
  onChange: (v: string) => void
  placeholder: string
}) {
  const [abierto, setAbierto] = useState(false)
  const [texto, setTexto] = useState(valor)
  const [locales, setLocales] = useState(opciones)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => { setTexto(valor) }, [valor])
  useEffect(() => { setLocales(opciones) }, [opciones])

  useEffect(() => {
    if (!abierto) return
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setAbierto(false)
        if (texto !== valor) onChange(texto)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [abierto, texto, valor, onChange])

  const filtradas = texto
    ? locales.filter(o => o.toLowerCase().includes(texto.toLowerCase()) && o !== valor)
    : locales.filter(o => o !== valor)

  const existeExacto = locales.some(o => o.toLowerCase() === texto.toLowerCase().trim())
  const mostrarCrear = texto.trim() && !existeExacto && tipoConfig

  function seleccionar(v: string) {
    onChange(v)
    setTexto(v)
    setAbierto(false)
  }

  function crearYSeleccionar() {
    const nombre = texto.trim()
    if (!nombre || !tipoConfig) return
    fetch('/api/contactos/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tipo: tipoConfig, nombre }),
    }).catch(() => {})
    setLocales(prev => [...prev, nombre])
    seleccionar(nombre)
  }

  return (
    <div ref={ref} className="relative">
      <label className="text-xs font-semibold text-texto-terciario uppercase tracking-wider mb-1 block">{etiqueta}</label>
      <input
        type="text"
        value={texto}
        onChange={e => { setTexto(e.target.value); setAbierto(true) }}
        onFocus={() => setAbierto(true)}
        onKeyDown={e => {
          if (e.key === 'Enter') {
            if (mostrarCrear) crearYSeleccionar()
            else { onChange(texto); setAbierto(false); (e.target as HTMLInputElement).blur() }
          }
          if (e.key === 'Escape') { setTexto(valor); setAbierto(false) }
        }}
        placeholder={placeholder}
        className="w-full bg-transparent text-sm text-texto-primario placeholder:text-texto-placeholder outline-none py-1 transition-colors"
        style={{ borderBottom: '1px solid var(--borde-sutil)' }}
      />
      {abierto && (filtradas.length > 0 || mostrarCrear) && (
        <div
          className="absolute z-20 top-full left-0 right-0 mt-1 rounded-card border border-borde-sutil shadow-elevada max-h-40 overflow-y-auto"
          style={{ backgroundColor: 'var(--superficie-elevada)' }}
          onMouseDown={e => e.preventDefault()}
        >
          {filtradas.map(o => (
            <button key={o} type="button"
              onClick={() => seleccionar(o)}
              className="w-full text-left px-3 py-1.5 text-sm text-texto-primario hover:bg-superficie-hover bg-transparent border-none cursor-pointer transition-colors focus-visible:outline-2 focus-visible:outline-texto-marca focus-visible:-outline-offset-2">
              {o}
            </button>
          ))}
          {mostrarCrear && (
            <button type="button"
              onClick={crearYSeleccionar}
              className="flex items-center gap-1.5 w-full text-left px-3 py-2 text-sm text-texto-marca hover:bg-superficie-hover bg-transparent border-none cursor-pointer transition-colors border-t border-borde-sutil focus-visible:outline-2 focus-visible:outline-texto-marca focus-visible:-outline-offset-2">
              <Plus size={14} />
              Crear &quot;{texto.trim()}&quot;
            </button>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Selector de etiquetas con colores ───

function SelectorEtiquetas({
  etiquetas: asignadas,
  etiquetasConfig,
  onAgregar,
  onQuitar,
}: {
  etiquetas: string[]
  etiquetasConfig: { nombre: string; color: string }[]
  onAgregar: (nombre: string, color: string) => void
  onQuitar: (nombre: string) => void
}) {
  const { t } = useTraduccion()
  const [abierto, setAbierto] = useState(false)
  const [texto, setTexto] = useState('')
  const [colorNueva, setColorNueva] = useState('neutro')
  const [creando, setCreando] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!abierto) return
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setAbierto(false); setCreando(false); setTexto('')
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [abierto])

  const disponibles = etiquetasConfig
    .filter(e => !asignadas.includes(e.nombre))
    .filter(e => !texto || e.nombre.toLowerCase().includes(texto.toLowerCase()))

  const existeExacta = etiquetasConfig.some(e => e.nombre.toLowerCase() === texto.toLowerCase().trim())
  const yaAsignada = asignadas.some(e => e.toLowerCase() === texto.toLowerCase().trim())
  const mostrarCrear = texto.trim() && !existeExacta && !yaAsignada

  function obtenerColor(nombre: string): string {
    return etiquetasConfig.find(e => e.nombre === nombre)?.color || 'neutro'
  }

  function seleccionarExistente(nombre: string, color: string) {
    onAgregar(nombre, color)
    setTexto('')
    setAbierto(false)
    setCreando(false)
  }

  function iniciarCreacion() {
    setCreando(true)
  }

  function confirmarCreacion() {
    onAgregar(texto.trim(), colorNueva)
    setTexto('')
    setCreando(false)
    setAbierto(false)
    setColorNueva('neutro')
  }

  return (
    <div ref={ref} className="relative">
      <label className="text-xs font-semibold text-texto-terciario uppercase tracking-wider mb-1.5 block">Etiquetas</label>

      <div className="flex items-center gap-1.5 flex-wrap mb-1.5">
        {asignadas.map(e => (
          <Insignia key={e} color={obtenerColor(e) as ColorInsignia} removible onRemover={() => onQuitar(e)}>{e}</Insignia>
        ))}
      </div>

      <input
        type="text"
        value={texto}
        onChange={e => { setTexto(e.target.value); setAbierto(true); setCreando(false) }}
        onFocus={() => setAbierto(true)}
        onKeyDown={e => {
          if (e.key === 'Enter' && texto.trim()) {
            const existente = etiquetasConfig.find(et => et.nombre.toLowerCase() === texto.toLowerCase().trim())
            if (existente && !asignadas.includes(existente.nombre)) {
              seleccionarExistente(existente.nombre, existente.color)
            } else if (!yaAsignada) {
              iniciarCreacion()
            }
          }
          if (e.key === 'Escape') { setAbierto(false); setCreando(false); setTexto('') }
        }}
        placeholder="+ Agregar etiqueta"
        className="w-full bg-transparent text-xs text-texto-primario placeholder:text-texto-placeholder outline-none py-1 transition-colors"
        style={{ borderBottom: '1px solid var(--borde-sutil)' }}
      />

      {abierto && (disponibles.length > 0 || mostrarCrear || creando) && (
        <div
          className="absolute z-20 top-full left-0 right-0 mt-1 rounded-card border border-borde-sutil shadow-elevada max-h-48 overflow-y-auto"
          style={{ backgroundColor: 'var(--superficie-elevada)' }}
          onMouseDown={e => e.preventDefault()}
        >
          {!creando && disponibles.map(e => (
            <button key={e.nombre} type="button"
              onClick={() => seleccionarExistente(e.nombre, e.color)}
              className="flex items-center gap-2 w-full text-left px-3 py-1.5 text-sm hover:bg-superficie-hover bg-transparent border-none cursor-pointer transition-colors focus-visible:outline-2 focus-visible:outline-texto-marca focus-visible:-outline-offset-2">
              <span className="size-2.5 rounded-full shrink-0" style={{ backgroundColor: `var(--insignia-${e.color})` }} />
              <span className="text-texto-primario">{e.nombre}</span>
            </button>
          ))}

          {mostrarCrear && !creando && (
            <button type="button"
              onClick={iniciarCreacion}
              className="flex items-center gap-2 w-full text-left px-3 py-2 text-sm text-texto-marca hover:bg-superficie-hover bg-transparent border-none cursor-pointer transition-colors border-t border-borde-sutil focus-visible:outline-2 focus-visible:outline-texto-marca focus-visible:-outline-offset-2">
              <Plus size={14} />
              Crear &quot;{texto.trim()}&quot;
            </button>
          )}

          {creando && (
            <div className="p-3 space-y-2.5">
              <div className="text-xs text-texto-secundario font-medium">Elegí un color para &quot;{texto.trim()}&quot;</div>
              <div className="flex items-center gap-2 flex-wrap">
                {COLORES_ETIQUETA.map(c => (
                  <button key={c.valor} type="button"
                    onClick={() => setColorNueva(c.valor)}
                    className={`size-7 rounded-full border-2 transition-all cursor-pointer ${colorNueva === c.valor ? 'border-texto-marca scale-110 ring-2 ring-texto-marca/30' : 'border-transparent hover:scale-105'}`}
                    style={{ backgroundColor: `var(--insignia-${c.valor})` }}
                  />
                ))}
              </div>
              <div className="flex gap-2">
                <Boton variante="secundario" tamano="sm" onClick={() => setCreando(false)} className="flex-1">{t('comun.cancelar')}</Boton>
                <Boton variante="primario" tamano="sm" onClick={confirmarCreacion} className="flex-1">Crear</Boton>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
