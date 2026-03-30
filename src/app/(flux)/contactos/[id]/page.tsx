'use client'

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { useParams, useRouter, usePathname, useSearchParams } from 'next/navigation'
import { useNavegacion } from '@/hooks/useNavegacion'
import { useTraduccion } from '@/lib/i18n'
import {
  Mail, Phone, Globe, MessageCircle, ChevronLeft,
  Building2, Building, User, Truck, UserPlus, BadgeCheck, Trash2, Plus, X,
  UserCheck, Clock, Link2, Search,
} from 'lucide-react'
import { Input } from '@/componentes/ui/Input'
import { Select } from '@/componentes/ui/Select'
import { Avatar } from '@/componentes/ui/Avatar'
import { Insignia, type ColorInsignia } from '@/componentes/ui/Insignia'
import { Modal } from '@/componentes/ui/Modal'
import { Boton } from '@/componentes/ui/Boton'
import { ModalConfirmacion } from '@/componentes/ui/ModalConfirmacion'
import { Cargador } from '@/componentes/ui/Cargador'
import { DireccionesContacto, type DireccionConTipo } from '../_componentes/DireccionesContacto'
import { VinculacionesContacto } from '../_componentes/VinculacionesContacto'
import { BannerContacto } from '../_componentes/BannerContacto'
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
  const { t } = useTraduccion()
  const { id } = useParams<{ id: string }>()
  const esNuevo = id === 'nuevo'
  const router = useRouter()
  const pathname = usePathname()
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

  // ─── Estado solo creación ───
  const [errores, setErrores] = useState<ErroresContacto>({})
  const [duplicado, setDuplicado] = useState<{ id: string; nombre: string; codigo: string; mensaje: string } | null>(null)
  const [vinculacionesPendientes, setVinculacionesPendientes] = useState<VinculacionPendiente[]>([])
  const [modalVincular, setModalVincular] = useState(false)
  const [busquedaVinculo, setBusquedaVinculo] = useState('')
  const [resultadosVinculo, setResultadosVinculo] = useState<ContactoBusqueda[]>([])
  const [buscandoVinculo, setBuscandoVinculo] = useState(false)
  const creadoRef = useRef(false)

  // ─── Derivados ───
  const tipoActivo = tiposContacto.find(t => t.id === tipoContactoId)
  const claveTipo = tipoActivo?.clave || 'persona'
  const esPersona = TIPOS_PERSONA.includes(claveTipo)
  const esEdificio = claveTipo === 'edificio'

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

  // Cargar contacto existente (solo edición)
  useEffect(() => {
    if (esNuevo) return
    fetch(`/api/contactos/${id}`)
      .then(r => r.json())
      .then(data => {
        if (!data.id) return
        const nc = combinarNombre(data.nombre || '', data.apellido)
        setNombreCompleto(nc)
        if (desdeId && desdeNombre) setMigajaDinamica(`/contactos/${desdeId}`, desdeNombre)
        setMigajaDinamica(pathname, nc || data.codigo || 'Detalle')
        setCodigo(data.codigo || '')
        setEsProvisorio(data.es_provisorio || false)
        setTipoContactoId(data.tipo_contacto_id || '')
        setAvatarUrl(data.avatar_url || null)
        setDatosFiscales(data.datos_fiscales || {})
        if (data.pais_fiscal) setPaisContacto(data.pais_fiscal)
        setEtiquetas(data.etiquetas || [])
        setCampos({
          titulo: data.titulo || '', correo: data.correo || '',
          telefono: data.telefono || '', whatsapp: data.whatsapp || '',
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
  }, [id])

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
    }, 300)
    return () => clearTimeout(timeout)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [busquedaVinculo, modalVincular])

  // ═══════════════════════════════════════════════════════════════
  // ACCIONES — EDICIÓN (autoguardado PATCH)
  // ═══════════════════════════════════════════════════════════════

  const recargar = useCallback(() => {
    if (esNuevo) return
    fetch(`/api/contactos/${id}`)
      .then(r => r.json())
      .then(data => {
        if (data.vinculaciones) setVinculaciones(data.vinculaciones)
        if (data.vinculaciones_inversas) setVinculacionesInversas(data.vinculaciones_inversas)
      })
      .catch(() => {})
  }, [id, esNuevo])

  const aceptarProvisorio = useCallback(async () => {
    setAccionandoProvisorio(true)
    try {
      const res = await fetch(`/api/contactos/${id}`, {
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
  }, [id])

  const descartarProvisorio = useCallback(async () => {
    setAccionandoProvisorio(true)
    try {
      const res = await fetch(`/api/contactos/${id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ en_papelera: true }),
      })
      if (res.ok) router.push('/contactos')
    } catch (err) { console.error('Error descartando provisorio:', err) }
    finally { setAccionandoProvisorio(false) }
  }, [id, router])

  // Autoguardado genérico (solo edición)
  const guardar = useCallback(async (payload: Record<string, unknown>) => {
    if (esNuevo) return // En creación no se autoguarda
    setGuardando(true)
    setErrorGuardado('')
    try {
      const res = await fetch(`/api/contactos/${id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setErrorGuardado(data.error || 'Error al guardar')
        setTimeout(() => setErrorGuardado(''), 5000)
      }
    } catch {
      setErrorGuardado('Error de conexión')
      setTimeout(() => setErrorGuardado(''), 5000)
    } finally { setGuardando(false) }
  }, [id, esNuevo])

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
    const ruta = `${id}.${extension}`
    const { error: uploadError } = await supabase.storage.from('avatares-contactos').upload(ruta, archivo, { upsert: true })
    if (uploadError) { setErrorGuardado('Error al subir foto'); return }
    const { data } = supabase.storage.from('avatares-contactos').getPublicUrl(ruta)
    const url = data.publicUrl + '?t=' + Date.now()
    setAvatarUrl(url)
    guardar({ avatar_url: url })
  }, [id, guardar, esNuevo])

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

  // Validación y auto-crear
  const tieneNombre = nombreCompleto.trim().length > 0
  const tieneDatoContacto = !!(
    campos.correo?.trim() || campos.telefono?.trim() || campos.whatsapp?.trim() ||
    direcciones.some(d => d.datos.calle.trim())
  )
  const puedeGuardar = esNuevo && tieneNombre && tieneDatoContacto && !!tipoContactoId && !guardando

  const intentarCrear = useCallback(() => {
    if (!puedeGuardar || creadoRef.current || guardando) return
    const errs = validarCamposContacto({
      correo: campos.correo || '',
      telefono: campos.telefono || '',
      whatsapp: campos.whatsapp || '',
      web: campos.web || '',
      tipo_identificacion: campos.tipo_identificacion || '',
      numero_identificacion: campos.numero_identificacion || '',
    })
    setErrores(errs)
    if (!sinErrores(errs)) return
    creadoRef.current = true
    crearContactoFn()
  }, [puedeGuardar, guardando, campos])

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
        telefono: campos.telefono || null,
        whatsapp: campos.whatsapp || null,
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
        router.replace(`/contactos/${nuevo.id}`)
        return
      }

      if (res.status === 409 && nuevo.error === 'duplicado') {
        setDuplicado({ id: nuevo.duplicado.id, nombre: nuevo.duplicado.nombre, codigo: nuevo.duplicado.codigo, mensaje: nuevo.mensaje })
        creadoRef.current = false
        return
      }

      setErrorGuardado(nuevo.error || 'Error al crear el contacto')
      creadoRef.current = false
    } catch {
      setErrorGuardado('Error de conexión')
      creadoRef.current = false
    } finally { setGuardando(false) }
  }, [guardando, nombreCompleto, esPersona, tipoContactoId, campos, datosFiscales, paisContacto, etiquetas, direcciones, vinculacionesPendientes, router])

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
      fetch(`/api/contactos/${id}/direcciones`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ direcciones: dirsParaGuardar }),
      }).catch(() => {})
    }
  }, [esNuevo, esEdificio, nombreCompleto, id])

  // País fiscal
  const onCambiarPais = useCallback((valor: string) => {
    if (esNuevo) {
      cambiarPaisContactoNuevo(valor)
    } else {
      setPaisContacto(valor)
      guardar({ pais_fiscal: valor || null })
    }
  }, [esNuevo, cambiarPaisContactoNuevo, guardar])

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
            <button type="button" onClick={() => setModalEliminar(true)}
              className="flex items-center gap-1.5 px-2 py-1 rounded-md text-xs text-texto-terciario hover:text-insignia-peligro hover:bg-insignia-peligro-fondo bg-transparent border-none cursor-pointer transition-colors shrink-0">
              <Trash2 size={14} /><span className="hidden sm:inline">{t('comun.eliminar')}</span>
            </button>
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
                      'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-all duration-150 border cursor-pointer',
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
            <BarraKPIs contactoId={id} />
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
              { id: 'eliminar', etiqueta: 'Eliminar contacto', icono: <Trash2 size={14} />, peligro: true, onClick: () => setModalEliminar(true) },
            ]}
          />

          {/* Banner provisorio (solo edición) */}
          {!esNuevo && esProvisorio && (
            <div className="flex items-center justify-between px-4 py-3 rounded-lg"
              style={{ background: 'var(--insignia-advertencia-fondo)', border: '1px solid var(--insignia-advertencia)' }}>
              <div className="flex items-center gap-2">
                <Clock size={16} style={{ color: 'var(--insignia-advertencia)' }} />
                <div>
                  <p className="text-sm font-medium" style={{ color: 'var(--texto-primario)' }}>Contacto provisorio</p>
                  <p className="text-xs" style={{ color: 'var(--texto-secundario)' }}>Llegó por WhatsApp. Aceptalo para asignarle un código o descartalo.</p>
                </div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <button onClick={aceptarProvisorio} disabled={accionandoProvisorio}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors text-white"
                  style={{ background: 'var(--insignia-exito)' }}>
                  <UserCheck size={14} />Aceptar
                </button>
                <button onClick={descartarProvisorio} disabled={accionandoProvisorio}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors"
                  style={{ color: 'var(--insignia-peligro)', background: 'var(--superficie-hover)' }}>
                  <Trash2 size={14} />Descartar
                </button>
              </div>
            </div>
          )}

          {/* Nombre completo */}
          <div className="pl-1">
            <Input
              variante="plano"
              value={nombreCompleto}
              onChange={e => setNombreCompleto(e.target.value)}
              onBlur={onBlurNombre}
              placeholder={t('contactos.nombre_completo')}
              autoFocus={esNuevo}
              formato={esPersona ? 'nombre_persona' : 'nombre_empresa'}
              className="[&_input]:text-2xl [&_input]:font-bold"
            />
          </div>

          {/* Contacto directo + puesto/etiquetas en 2 columnas (60/40) */}
          <section className="flex flex-col sm:flex-row gap-8">
            {/* Columna izquierda (60%): datos de comunicación */}
            <div className="flex-[3] min-w-0 space-y-2">
              <Input variante="plano" tipo="email" icono={<Mail size={16} />}
                value={campos.correo || ''}
                onChange={e => { setCampos(p => ({ ...p, correo: e.target.value })); if (esNuevo) setErrores(p => ({ ...p, correo: undefined })) }}
                onBlur={() => onBlurCampo('correo')} placeholder={t('contactos.correo')} formato="email" error={esNuevo ? errores.correo : undefined} />
              <Input variante="plano" tipo="tel" icono={<MessageCircle size={16} />}
                value={campos.whatsapp || ''}
                onChange={e => { setCampos(p => ({ ...p, whatsapp: e.target.value })); if (esNuevo) setErrores(p => ({ ...p, whatsapp: undefined })) }}
                onBlur={() => onBlurCampo('whatsapp')} placeholder={t('contactos.whatsapp')} formato="telefono" error={esNuevo ? errores.whatsapp : undefined} />
              <Input variante="plano" tipo="tel" icono={<Phone size={16} />}
                value={campos.telefono || ''}
                onChange={e => { setCampos(p => ({ ...p, telefono: e.target.value })); if (esNuevo) setErrores(p => ({ ...p, telefono: undefined })) }}
                onBlur={() => onBlurCampo('telefono')} placeholder={t('contactos.telefono')} formato="telefono" error={esNuevo ? errores.telefono : undefined} />
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
              <div className="rounded-xl border border-borde-sutil overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3 border-b border-borde-sutil" style={{ backgroundColor: 'var(--superficie-tarjeta)' }}>
                  <div className="flex items-center gap-2">
                    <Link2 size={15} className="text-texto-terciario" />
                    <h3 className="text-sm font-semibold text-texto-primario">{t('contactos.relaciones')}</h3>
                    {vinculacionesPendientes.length > 0 && (
                      <span className="text-xs text-texto-terciario">({vinculacionesPendientes.length})</span>
                    )}
                  </div>
                  <button type="button" onClick={() => setModalVincular(true)}
                    className="flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium text-texto-marca hover:bg-superficie-hover bg-transparent border-none cursor-pointer transition-colors">
                    <Plus size={13} /><span>Vincular</span>
                  </button>
                </div>
                <div className="px-4 py-3" style={{ backgroundColor: 'var(--superficie-app)' }}>
                  {vinculacionesPendientes.length > 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {vinculacionesPendientes.map(v => (
                        <div key={v.vinculado_id} className="flex items-center gap-3 p-2.5 rounded-lg border border-borde-sutil hover:border-borde-fuerte transition-colors">
                          <Avatar nombre={v.nombre} tamano="sm" />
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium text-texto-primario truncate">{v.nombre}</div>
                            <div className="text-xs text-texto-terciario">{v.tipo_etiqueta} · {v.codigo}</div>
                          </div>
                          <button type="button" onClick={() => setVinculacionesPendientes(prev => prev.filter(vp => vp.vinculado_id !== v.vinculado_id))}
                            className="text-texto-terciario hover:text-insignia-peligro bg-transparent border-none cursor-pointer p-1 transition-colors">
                            <X size={14} />
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <button type="button" onClick={() => setModalVincular(true)}
                      className="w-full py-4 text-sm text-texto-terciario hover:text-texto-marca bg-transparent border border-dashed border-borde-sutil rounded-lg cursor-pointer transition-colors hover:border-borde-fuerte">
                      Vincular con empresa, proveedor o persona...
                    </button>
                  )}
                </div>
              </div>
            </section>
          ) : (
            <VinculacionesContacto
              contactoId={id}
              nombreContacto={nombreCompleto}
              vinculaciones={mapearVinculaciones(vinculaciones)}
              vinculacionesInversas={mapearVinculacionesInversas(vinculacionesInversas)}
              tiposRelacion={tiposRelacion}
              puestosVinculacion={puestosVinculacion}
              onActualizar={recargar}
            />
          )}

          {/* Notas */}
          <section>
            <h3 className="text-xs font-semibold text-texto-terciario uppercase tracking-wider mb-3">Notas</h3>
            <textarea value={campos.notas || ''} onChange={e => setCampos(p => ({ ...p, notas: e.target.value }))}
              placeholder="Notas internas sobre este contacto..."
              rows={3}
              className="w-full bg-transparent outline-none text-sm text-texto-primario placeholder:text-texto-terciario/40 resize-y rounded-lg p-3 transition-colors"
              style={{ border: '1px solid var(--borde-sutil)' }}
              onFocus={e => { e.currentTarget.style.borderColor = 'var(--borde-foco)' }}
              onBlur={e => { e.currentTarget.style.borderColor = 'var(--borde-sutil)'; onBlurCampo('notas') }}
            />
          </section>

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
                  className="flex items-center gap-3 w-full text-left px-3 py-2.5 rounded-lg hover:bg-superficie-hover bg-transparent border-none cursor-pointer transition-colors">
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
            <div className="rounded-lg border border-borde-sutil p-3 flex items-center gap-3">
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
    </div>
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
        className="w-full bg-transparent text-sm text-texto-primario placeholder:text-texto-terciario/50 outline-none py-1 transition-colors"
        style={{ borderBottom: '1px solid var(--borde-sutil)' }}
      />
      {abierto && (filtradas.length > 0 || mostrarCrear) && (
        <div
          className="absolute z-20 top-full left-0 right-0 mt-1 rounded-lg border border-borde-sutil shadow-elevada max-h-40 overflow-y-auto"
          style={{ backgroundColor: 'var(--superficie-elevada)' }}
          onMouseDown={e => e.preventDefault()}
        >
          {filtradas.map(o => (
            <button key={o} type="button"
              onClick={() => seleccionar(o)}
              className="w-full text-left px-3 py-1.5 text-sm text-texto-primario hover:bg-superficie-hover bg-transparent border-none cursor-pointer transition-colors">
              {o}
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
        className="w-full bg-transparent text-xs text-texto-primario placeholder:text-texto-terciario/50 outline-none py-1 transition-colors"
        style={{ borderBottom: '1px solid var(--borde-sutil)' }}
      />

      {abierto && (disponibles.length > 0 || mostrarCrear || creando) && (
        <div
          className="absolute z-20 top-full left-0 right-0 mt-1 rounded-lg border border-borde-sutil shadow-elevada max-h-48 overflow-y-auto"
          style={{ backgroundColor: 'var(--superficie-elevada)' }}
          onMouseDown={e => e.preventDefault()}
        >
          {!creando && disponibles.map(e => (
            <button key={e.nombre} type="button"
              onClick={() => seleccionarExistente(e.nombre, e.color)}
              className="flex items-center gap-2 w-full text-left px-3 py-1.5 text-sm hover:bg-superficie-hover bg-transparent border-none cursor-pointer transition-colors">
              <span className="size-2.5 rounded-full shrink-0" style={{ backgroundColor: `var(--insignia-${e.color})` }} />
              <span className="text-texto-primario">{e.nombre}</span>
            </button>
          ))}

          {mostrarCrear && !creando && (
            <button type="button"
              onClick={iniciarCreacion}
              className="flex items-center gap-2 w-full text-left px-3 py-2 text-sm text-texto-marca hover:bg-superficie-hover bg-transparent border-none cursor-pointer transition-colors border-t border-borde-sutil">
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
                <button type="button" onClick={() => setCreando(false)}
                  className="flex-1 px-3 py-1.5 rounded-md text-sm text-texto-secundario border border-borde-sutil bg-transparent cursor-pointer hover:bg-superficie-hover transition-colors">
                  Cancelar
                </button>
                <button type="button" onClick={confirmarCreacion}
                  className="flex-1 px-3 py-1.5 rounded-md text-sm font-medium text-white border-none cursor-pointer transition-colors"
                  style={{ backgroundColor: 'var(--texto-marca)' }}>
                  Crear
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
