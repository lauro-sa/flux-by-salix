'use client'

import { useState, useEffect, useCallback, useMemo, useRef, type ChangeEvent } from 'react'
import { useRouter } from 'next/navigation'
import {
  Mail, Phone, Globe, MessageCircle, ChevronLeft,
  Building2, Building, User, Truck, UserPlus, BadgeCheck, Plus, X, Tag,
} from 'lucide-react'
import { Input } from '@/componentes/ui/Input'
import { Select } from '@/componentes/ui/Select'
import { Avatar } from '@/componentes/ui/Avatar'
import { Insignia, type ColorInsignia } from '@/componentes/ui/Insignia'
import { SelectCreable } from '@/componentes/ui/SelectCreable'
import { Modal } from '@/componentes/ui/Modal'
import { Boton } from '@/componentes/ui/Boton'
import { DireccionesContacto, type DireccionConTipo } from '../_componentes/DireccionesContacto'
import { BannerContacto } from '../_componentes/BannerContacto'
import { COLOR_TIPO_CONTACTO } from '@/lib/colores_entidad'
import { validarCamposContacto, sinErrores, type ErroresContacto } from '@/lib/validaciones'
import type { TipoContacto, CampoFiscalPais } from '@/tipos'
import { PAISES_DISPONIBLES } from '@/lib/paises'

// ─── Constantes ───

const ICONOS_TIPO: Record<string, typeof User> = {
  persona: User, empresa: Building2, edificio: Building,
  proveedor: Truck, lead: UserPlus, equipo: BadgeCheck,
}

const TIPOS_PERSONA = ['persona', 'lead', 'equipo']

/** Tipos predefinidos como fallback si la API no responde (sin BD) */
const TIPOS_FALLBACK: TipoContacto[] = [
  { id: 'f-persona', empresa_id: '', clave: 'persona', etiqueta: 'Persona', icono: 'user', color: 'primario', puede_tener_hijos: false, es_predefinido: true, orden: 1, activo: true },
  { id: 'f-empresa', empresa_id: '', clave: 'empresa', etiqueta: 'Empresa', icono: 'building-2', color: 'info', puede_tener_hijos: true, es_predefinido: true, orden: 2, activo: true },
  { id: 'f-edificio', empresa_id: '', clave: 'edificio', etiqueta: 'Edificio', icono: 'building', color: 'cyan', puede_tener_hijos: true, es_predefinido: true, orden: 3, activo: true },
  { id: 'f-proveedor', empresa_id: '', clave: 'proveedor', etiqueta: 'Proveedor', icono: 'truck', color: 'naranja', puede_tener_hijos: true, es_predefinido: true, orden: 4, activo: true },
  { id: 'f-lead', empresa_id: '', clave: 'lead', etiqueta: 'Lead', icono: 'user-plus', color: 'advertencia', puede_tener_hijos: false, es_predefinido: true, orden: 5, activo: true },
]

/** Colores base para el banner degradado por tipo */
const COLORES_BANNER: Record<string, string> = {
  persona: 'var(--insignia-primario)',   // índigo
  empresa: 'var(--insignia-info)',       // azul
  edificio: 'var(--insignia-advertencia)', // ámbar/dorado
  proveedor: 'var(--insignia-naranja)',  // naranja
  lead: 'var(--insignia-cyan)',          // cyan
  equipo: 'var(--insignia-exito)',       // verde
}

// ─── Helpers ───

function separarNombreApellido(nombreCompleto: string, esPersona: boolean) {
  const limpio = nombreCompleto.trim()
  if (!esPersona || !limpio) return { nombre: limpio, apellido: '' }
  const partes = limpio.split(/\s+/)
  if (partes.length <= 1) return { nombre: limpio, apellido: '' }
  return { nombre: partes.slice(0, -1).join(' '), apellido: partes[partes.length - 1] }
}

// ─── Tipos ───

interface DatosFormulario {
  tipo_contacto_id: string
  nombre_completo: string
  titulo: string
  correo: string
  telefono: string
  whatsapp: string
  web: string
  cargo: string
  rubro: string
  tipo_identificacion: string
  numero_identificacion: string
  datos_fiscales: Record<string, string>
  moneda: string
  idioma: string
  limite_credito: string
  plazo_pago_cliente: string
  plazo_pago_proveedor: string
  etiquetas: string[]
  notas: string
}

// ═══════════════════════════════════════════════════════════════
// PÁGINA: /contactos/nuevo
// ═══════════════════════════════════════════════════════════════

export default function PaginaNuevoContacto() {
  const router = useRouter()

  const [datos, setDatos] = useState<DatosFormulario>({
    tipo_contacto_id: '', nombre_completo: '', titulo: '',
    correo: '', telefono: '', whatsapp: '', web: '',
    cargo: '', rubro: '', tipo_identificacion: '', numero_identificacion: '',
    datos_fiscales: {}, moneda: 'ARS', idioma: 'es', limite_credito: '',
    plazo_pago_cliente: '', plazo_pago_proveedor: '', etiquetas: [], notas: '',
  })
  const [direcciones, setDirecciones] = useState<DireccionConTipo[]>([])
  const [nuevaEtiqueta, setNuevaEtiqueta] = useState('')
  const [tiposContacto, setTiposContacto] = useState<TipoContacto[]>([])
  const [camposFiscales, setCamposFiscales] = useState<CampoFiscalPais[]>([])
  const [paisesEmpresa, setPaisesEmpresa] = useState<string[]>([])
  const [paisContacto, setPaisContacto] = useState('')
  const [rubrosConfig, setRubrosConfig] = useState<{ valor: string; etiqueta: string }[]>([])
  const [etiquetasConfig, setEtiquetasConfig] = useState<{ valor: string; etiqueta: string; color?: string }[]>([])
  const [guardando, setGuardando] = useState(false)
  const [errores, setErrores] = useState<ErroresContacto>({})
  const [errorGlobal, setErrorGlobal] = useState('')
  const [duplicado, setDuplicado] = useState<{ id: string; nombre: string; codigo: string; mensaje: string } | null>(null)

  const tipoActivo = tiposContacto.find(t => t.id === datos.tipo_contacto_id)
  const claveTipo = tipoActivo?.clave || 'persona'
  const esPersona = TIPOS_PERSONA.includes(claveTipo)
  const esEdificio = claveTipo === 'edificio'
  const colorBanner = COLORES_BANNER[claveTipo] || COLORES_BANNER.persona

  // Separar campos de identificación (dinámicos por país) de datos fiscales
  // Filtrar por país del contacto y tipo de contacto
  const camposIdentificacion = useMemo(
    () => camposFiscales.filter(c => c.es_identificacion && c.aplica_a.includes(claveTipo) && (!paisContacto || c.pais === paisContacto)),
    [camposFiscales, claveTipo, paisContacto]
  )
  const camposFiscalesFiltrados = useMemo(
    () => camposFiscales.filter(c => !c.es_identificacion && c.aplica_a.includes(claveTipo) && (!paisContacto || c.pais === paisContacto)),
    [camposFiscales, claveTipo, paisContacto]
  )

  // Cargar tipos al montar (con fallback si no hay BD)
  useEffect(() => {
    fetch('/api/contactos/tipos')
      .then(r => r.json())
      .then(data => {
        const tipos = data.tipos_contacto?.length ? data.tipos_contacto : TIPOS_FALLBACK
        const campos: CampoFiscalPais[] = data.campos_fiscales || []
        setTiposContacto(tipos)
        if (campos.length) setCamposFiscales(campos)
        const paises: string[] = data.paises || []
        if (paises.length) setPaisesEmpresa(paises)
        // Si hay un solo país, preseleccionarlo automáticamente
        const paisInicial = paises.length === 1 ? paises[0] : ''
        if (paisInicial) setPaisContacto(paisInicial)

        // Preseleccionar persona + primer tipo de identificación disponible del país
        const persona = tipos.find((t: TipoContacto) => t.clave === 'persona')
        if (persona) {
          const primerIdent = campos.find((c: CampoFiscalPais) =>
            c.es_identificacion && c.aplica_a.includes('persona') && (!paisInicial || c.pais === paisInicial)
          )
          setDatos(prev => ({
            ...prev,
            tipo_contacto_id: persona.id,
            tipo_identificacion: primerIdent?.clave || '',
          }))
        }
      })
      .catch(() => {
        setTiposContacto(TIPOS_FALLBACK)
        const persona = TIPOS_FALLBACK.find(t => t.clave === 'persona')
        if (persona) setDatos(prev => ({ ...prev, tipo_contacto_id: persona.id }))
      })
  }, [])

  // Cargar rubros y etiquetas configurados
  useEffect(() => {
    fetch('/api/contactos/config')
      .then(r => r.json())
      .then(data => {
        if (data.rubros) setRubrosConfig(data.rubros.filter((r: Record<string, unknown>) => r.activo !== false).map((r: Record<string, unknown>) => ({ valor: r.nombre as string, etiqueta: r.nombre as string })))
        if (data.etiquetas) setEtiquetasConfig(data.etiquetas.filter((e: Record<string, unknown>) => (e.activa ?? e.activo) !== false).map((e: Record<string, unknown>) => ({ valor: e.nombre as string, etiqueta: e.nombre as string, color: e.color as string })))
      })
      .catch(() => {})
  }, [])

  // Actualizar campo genérico
  const act = useCallback((campo: keyof DatosFormulario, valor: string) => {
    setDatos(prev => ({ ...prev, [campo]: valor }))
  }, [])

  // Cambiar tipo: resetear campos irrelevantes y tipo identificación
  const cambiarTipo = useCallback((tipoId: string) => {
    const tipo = tiposContacto.find(t => t.id === tipoId)
    if (!tipo) return
    // Primer tipo de identificación disponible para este tipo de contacto y país
    const primerIdent = camposFiscales.find(c =>
      c.es_identificacion && c.aplica_a.includes(tipo.clave) && (!paisContacto || c.pais === paisContacto)
    )
    setDatos(prev => ({
      ...prev,
      tipo_contacto_id: tipoId,
      tipo_identificacion: primerIdent?.clave || '',
      numero_identificacion: '', // limpiar número al cambiar tipo
      datos_fiscales: {}, // limpiar datos fiscales al cambiar tipo
      cargo: TIPOS_PERSONA.includes(tipo.clave) ? prev.cargo : '',
      rubro: ['empresa', 'proveedor'].includes(tipo.clave) ? prev.rubro : '',
    }))
  }, [tiposContacto, camposFiscales, paisContacto])

  // Al cambiar el país del contacto, actualizar identificación y limpiar fiscales
  const cambiarPaisContacto = useCallback((nuevoPais: string) => {
    setPaisContacto(nuevoPais)
    const primerIdent = camposFiscales.find(c =>
      c.es_identificacion && c.aplica_a.includes(claveTipo) && c.pais === nuevoPais
    )
    setDatos(prev => ({
      ...prev,
      tipo_identificacion: primerIdent?.clave || '',
      numero_identificacion: '',
      datos_fiscales: {},
    }))
  }, [camposFiscales, claveTipo])

  // Cuando cambian las direcciones — auto-nombre para edificios
  const manejarDirecciones = useCallback((dirs: DireccionConTipo[]) => {
    setDirecciones(dirs)
    // Auto-nombre para edificios: "Edif. Av. Rivadavia 1234"
    if (esEdificio && dirs.length > 0 && dirs[0].datos.calle && !datos.nombre_completo) {
      setDatos(prev => ({
        ...prev,
        nombre_completo: `Edif. ${dirs[0].datos.calle}`,
      }))
    }
  }, [esEdificio, datos.nombre_completo])

  // Agregar etiqueta
  const agregarEtiqueta = useCallback(() => {
    const limpia = nuevaEtiqueta.trim()
    if (!limpia || datos.etiquetas.includes(limpia)) return
    setDatos(prev => ({ ...prev, etiquetas: [...prev.etiquetas, limpia] }))
    setNuevaEtiqueta('')
  }, [nuevaEtiqueta, datos.etiquetas])

  const quitarEtiqueta = useCallback((etiqueta: string) => {
    setDatos(prev => ({ ...prev, etiquetas: prev.etiquetas.filter(e => e !== etiqueta) }))
  }, [])

  // Validación: nombre + al menos un dato de contacto
  const tieneNombre = datos.nombre_completo.trim().length > 0
  const tieneDatoContacto = !!(
    datos.correo.trim() ||
    datos.telefono.trim() ||
    datos.whatsapp.trim() ||
    direcciones.some(d => d.datos.calle.trim())
  )
  const puedeGuardar = tieneNombre && tieneDatoContacto && !!datos.tipo_contacto_id && !guardando
  const creadoRef = useRef(false)

  // Auto-crear al salir de un campo cuando se cumplen los requisitos
  const intentarCrear = useCallback(() => {
    if (!puedeGuardar || creadoRef.current || guardando) return

    // Validar formatos antes de crear
    const errs = validarCamposContacto({
      correo: datos.correo,
      telefono: datos.telefono,
      whatsapp: datos.whatsapp,
      web: datos.web,
      tipo_identificacion: datos.tipo_identificacion,
      numero_identificacion: datos.numero_identificacion,
    })
    setErrores(errs)
    if (!sinErrores(errs)) return

    creadoRef.current = true
    crearContactoFn()
  }, [puedeGuardar, guardando, datos])

  // Crear contacto
  const crearContactoFn = useCallback(async () => {
    if (guardando) return
    setGuardando(true)
    try {
      const { nombre, apellido } = separarNombreApellido(datos.nombre_completo, esPersona)
      const payload: Record<string, unknown> = {
        tipo_contacto_id: datos.tipo_contacto_id,
        nombre, apellido: apellido || null,
        titulo: datos.titulo || null,
        correo: datos.correo || null,
        telefono: datos.telefono || null,
        whatsapp: datos.whatsapp || null,
        web: datos.web || null,
        cargo: datos.cargo || null,
        rubro: datos.rubro || null,
        tipo_identificacion: datos.tipo_identificacion || null,
        numero_identificacion: datos.numero_identificacion || null,
        datos_fiscales: datos.datos_fiscales,
        moneda: datos.moneda, idioma: datos.idioma,
        limite_credito: datos.limite_credito ? parseFloat(datos.limite_credito) : null,
        plazo_pago_cliente: datos.plazo_pago_cliente || null,
        plazo_pago_proveedor: datos.plazo_pago_proveedor || null,
        etiquetas: datos.etiquetas,
        notas: datos.notas || null,
      }
      // Direcciones
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
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const nuevo = await res.json()

      if (res.ok && nuevo.id) {
        router.replace(`/contactos/${nuevo.id}`)
        return
      }

      // Manejar duplicado
      if (res.status === 409 && nuevo.error === 'duplicado') {
        setDuplicado({ id: nuevo.duplicado.id, nombre: nuevo.duplicado.nombre, codigo: nuevo.duplicado.codigo, mensaje: nuevo.mensaje })
        creadoRef.current = false
        return
      }

      // Otro error
      setErrorGlobal(nuevo.error || 'Error al crear el contacto')
      creadoRef.current = false
    } catch {
      setErrorGlobal('Error de conexión')
      creadoRef.current = false
    }
    finally { setGuardando(false) }
  }, [datos, direcciones, esPersona, guardando, router])

  // Países para el buscador de direcciones
  const paisesDir = paisesEmpresa.length ? paisesEmpresa : undefined

  return (
    <div className="flex flex-col h-full overflow-auto">

      {/* ═══ CABECERO ═══ */}
      <div className="shrink-0 border-b border-borde-sutil">
        <div className="flex items-center gap-2 px-4 sm:px-6 py-2 text-sm">
          <button type="button" onClick={() => router.push('/contactos')}
            className="flex items-center gap-1 text-texto-secundario hover:text-texto-primario bg-transparent border-none cursor-pointer transition-colors">
            <ChevronLeft size={16} /><span>Contactos</span>
          </button>
          <span className="text-texto-terciario">/</span>
          <span className="font-medium text-texto-primario">Nuevo contacto</span>
        </div>

        {/* Selector de tipo como pills (solo en creación) */}
        <div className="px-4 sm:px-6 pb-3">
          <div className="text-xs text-texto-terciario mb-1.5">Tipo de contacto</div>
          <div className="flex items-center gap-1.5 flex-wrap">
            {tiposContacto.filter(t => t.clave !== 'equipo').map(tipo => {
              const activo = tipo.id === datos.tipo_contacto_id
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
      </div>

      {/* ═══ CONTENIDO ═══ */}
      <div className="flex-1 overflow-auto">
        <div className="max-w-4xl mx-auto px-4 sm:px-8 lg:px-12 py-0 space-y-6">

          {/* ── Banner de color + Avatar glass ── */}
          <BannerContacto
            nombre={datos.nombre_completo}
            codigo={null}
            tipoActivo={tipoActivo || null}
            claveTipo={claveTipo}
            tiposContacto={tiposContacto}
            puedeEditar={false}
          />

          {/* ── Nombre completo (un solo campo con auto-corrección) ── */}
          <div className="pl-1">
            <Input
              variante="plano"
              value={datos.nombre_completo}
              onChange={e => act('nombre_completo', e.target.value)}
              onBlur={intentarCrear}
              placeholder="Nombre completo"
              autoFocus
              formato={esPersona ? 'nombre_persona' : 'nombre_empresa'}
              className="[&_input]:text-2xl [&_input]:font-bold"
            />
          </div>

          {/* ── Contacto directo (con iconos + auto-corrección) ── */}
          <section className="space-y-2">
            <Input variante="plano" tipo="email" icono={<Mail size={16} />}
              value={datos.correo} onChange={e => { act('correo', e.target.value); setErrores(p => ({ ...p, correo: undefined })) }}
              onBlur={intentarCrear}
              placeholder="Email" formato="email" error={errores.correo} />
            <Input variante="plano" tipo="tel" icono={<MessageCircle size={16} />}
              value={datos.whatsapp} onChange={e => { act('whatsapp', e.target.value); setErrores(p => ({ ...p, whatsapp: undefined })) }}
              onBlur={intentarCrear}
              placeholder="WhatsApp" formato="telefono" error={errores.whatsapp} />
            <Input variante="plano" tipo="tel" icono={<Phone size={16} />}
              value={datos.telefono} onChange={e => { act('telefono', e.target.value); setErrores(p => ({ ...p, telefono: undefined })) }}
              onBlur={intentarCrear}
              placeholder="Teléfono" formato="telefono" error={errores.telefono} />
            {(claveTipo === 'empresa' || claveTipo === 'proveedor') && (
              <Input variante="plano" tipo="url" icono={<Globe size={16} />}
                value={datos.web} onChange={e => act('web', e.target.value)}
                placeholder="Sitio web" formato="url" />
            )}
          </section>

          {/* ── Direcciones (múltiples, con tipo) ── */}
          <section>
            <DireccionesContacto
              direcciones={direcciones}
              onChange={manejarDirecciones}
              paises={paisesDir}
            />
          </section>

          {/* ── Grid de campos (2 columnas, planos) ── */}
          <section className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-3">
            {esPersona && (
              <Fila etiqueta="Cargo">
                <Input variante="plano" value={datos.cargo} onChange={e => act('cargo', e.target.value)}
                  placeholder="Ej: Director de ventas" formato="nombre_persona" />
              </Fila>
            )}
            {(claveTipo === 'empresa' || claveTipo === 'proveedor') && (
              <Fila etiqueta="Rubro">
                <SelectCreable variante="plano"
                  opciones={rubrosConfig}
                  valor={datos.rubro}
                  onChange={v => act('rubro', v)}
                  placeholder="Seleccionar rubro..."
                  textoCrear="Crear rubro"
                  onCrear={async (nombre) => {
                    const res = await fetch('/api/contactos/config', {
                      method: 'POST', headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ tipo: 'rubro', nombre }),
                    })
                    if (res.ok) {
                      setRubrosConfig(prev => [...prev, { valor: nombre, etiqueta: nombre }])
                      return true
                    }
                    return false
                  }}
                />
              </Fila>
            )}

            {/* País del contacto — solo si la empresa opera en más de un país */}
            {paisesEmpresa.length > 1 && (
              <Fila etiqueta="País fiscal">
                <Select variante="plano"
                  opciones={paisesEmpresa.map(c => {
                    const p = PAISES_DISPONIBLES.find(pd => pd.codigo === c)
                    return { valor: c, etiqueta: p ? `${p.bandera} ${p.nombre}` : c }
                  })}
                  valor={paisContacto}
                  onChange={cambiarPaisContacto} />
              </Fila>
            )}

            {/* Identificación — selector dinámico por país + número */}
            {camposIdentificacion.length > 0 && (
              <Fila etiqueta="Identificación">
                <div className="flex items-center gap-2">
                  {camposIdentificacion.length > 1 && (
                    <div className="w-28 shrink-0">
                      <Select variante="plano"
                        opciones={camposIdentificacion.map(c => ({ valor: c.clave, etiqueta: c.etiqueta }))}
                        valor={datos.tipo_identificacion}
                        onChange={v => act('tipo_identificacion', v)} />
                    </div>
                  )}
                  {camposIdentificacion.length === 1 && (
                    <span className="text-xs font-medium text-texto-secundario shrink-0">{camposIdentificacion[0].etiqueta}</span>
                  )}
                  <Input variante="plano" value={datos.numero_identificacion}
                    onChange={e => act('numero_identificacion', e.target.value)}
                    placeholder={camposIdentificacion.find(c => c.clave === datos.tipo_identificacion)?.mascara || camposIdentificacion[0]?.etiqueta || ''} />
                </div>
              </Fila>
            )}

            <Fila etiqueta="Título">
              <Select variante="plano" valor={datos.titulo} onChange={v => act('titulo', v)}
                opciones={[{ valor: '', etiqueta: '—' }, { valor: 'Sr.', etiqueta: 'Sr.' }, { valor: 'Sra.', etiqueta: 'Sra.' }, { valor: 'Dr.', etiqueta: 'Dr.' }, { valor: 'Dra.', etiqueta: 'Dra.' }, { valor: 'Ing.', etiqueta: 'Ing.' }, { valor: 'Lic.', etiqueta: 'Lic.' }, { valor: 'Arq.', etiqueta: 'Arq.' }, { valor: 'Cr.', etiqueta: 'Cr.' }]} />
            </Fila>
            <Fila etiqueta="Idioma">
              <Select variante="plano" valor={datos.idioma} onChange={v => act('idioma', v)}
                opciones={[{ valor: 'es', etiqueta: 'Español' }, { valor: 'en', etiqueta: 'English' }, { valor: 'pt', etiqueta: 'Português' }]} />
            </Fila>
            <Fila etiqueta="Moneda">
              <Select variante="plano" valor={datos.moneda} onChange={v => act('moneda', v)}
                opciones={[{ valor: 'ARS', etiqueta: 'Peso argentino (ARS)' }, { valor: 'USD', etiqueta: 'Dólar (USD)' }, { valor: 'EUR', etiqueta: 'Euro (EUR)' }, { valor: 'MXN', etiqueta: 'Peso mexicano (MXN)' }, { valor: 'COP', etiqueta: 'Peso colombiano (COP)' }]} />
            </Fila>
            <Fila etiqueta="Límite crédito">
              <Input variante="plano" tipo="number" value={datos.limite_credito}
                onChange={e => act('limite_credito', e.target.value)} placeholder="0" />
            </Fila>
            <Fila etiqueta="Plazo cliente">
              <Select variante="plano" valor={datos.plazo_pago_cliente} onChange={v => act('plazo_pago_cliente', v)}
                opciones={[{ valor: '', etiqueta: '—' }, { valor: 'contado', etiqueta: 'Contado' }, { valor: '15_dias', etiqueta: '15 días' }, { valor: '30_dias', etiqueta: '30 días' }, { valor: '60_dias', etiqueta: '60 días' }, { valor: '90_dias', etiqueta: '90 días' }]} />
            </Fila>
            <Fila etiqueta="Plazo proveedor">
              <Select variante="plano" valor={datos.plazo_pago_proveedor} onChange={v => act('plazo_pago_proveedor', v)}
                opciones={[{ valor: '', etiqueta: '—' }, { valor: 'contado', etiqueta: 'Contado' }, { valor: '15_dias', etiqueta: '15 días' }, { valor: '30_dias', etiqueta: '30 días' }, { valor: '60_dias', etiqueta: '60 días' }, { valor: '90_dias', etiqueta: '90 días' }]} />
            </Fila>
          </section>

          {/* ── Datos fiscales dinámicos ── */}
          {camposFiscalesFiltrados.length > 0 && (
            <section>
              <h3 className="text-xs font-semibold text-texto-terciario uppercase tracking-wider mb-3">Datos fiscales</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-3">
                {camposFiscalesFiltrados.map(campo => (
                  <Fila key={campo.clave} etiqueta={campo.etiqueta}>
                    {campo.tipo_campo === 'select' && campo.opciones ? (
                      <Select variante="plano"
                        valor={datos.datos_fiscales[campo.clave] || ''}
                        onChange={v => setDatos(prev => ({ ...prev, datos_fiscales: { ...prev.datos_fiscales, [campo.clave]: v } }))}
                        opciones={[{ valor: '', etiqueta: 'Seleccionar...' }, ...(campo.opciones as { valor: string; etiqueta: string }[])]} />
                    ) : (
                      <Input variante="plano"
                        value={datos.datos_fiscales[campo.clave] || ''}
                        onChange={e => setDatos(prev => ({ ...prev, datos_fiscales: { ...prev.datos_fiscales, [campo.clave]: e.target.value } }))}
                        placeholder={campo.mascara || campo.etiqueta} />
                    )}
                  </Fila>
                ))}
              </div>
            </section>
          )}

          {/* ── Etiquetas ── */}
          <section>
            <h3 className="text-xs font-semibold text-texto-terciario uppercase tracking-wider mb-3">Etiquetas</h3>
            <div className="flex items-center gap-2 flex-wrap">
              {/* Etiquetas asignadas */}
              {datos.etiquetas.map(e => {
                const cfg = etiquetasConfig.find(ec => ec.valor === e)
                return (
                  <Insignia key={e} color={(cfg?.color || 'neutro') as ColorInsignia} removible onRemover={() => quitarEtiqueta(e)}>{e}</Insignia>
                )
              })}
              {/* Etiquetas disponibles (no asignadas) */}
              {etiquetasConfig.filter(ec => !datos.etiquetas.includes(ec.valor)).map(ec => (
                <button key={ec.valor} type="button"
                  onClick={() => setDatos(prev => ({ ...prev, etiquetas: [...prev.etiquetas, ec.valor] }))}
                  className="px-2 py-0.5 text-xs rounded-full border border-dashed border-borde-sutil text-texto-terciario hover:text-texto-secundario hover:border-borde-fuerte bg-transparent cursor-pointer transition-colors">
                  + {ec.etiqueta}
                </button>
              ))}
              {/* Input para crear nueva */}
              <div className="flex items-center gap-1">
                <input type="text" value={nuevaEtiqueta}
                  onChange={e => setNuevaEtiqueta(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      if (nuevaEtiqueta.trim()) {
                        // Crear en config + agregar al contacto
                        fetch('/api/contactos/config', {
                          method: 'POST', headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ tipo: 'etiqueta', nombre: nuevaEtiqueta.trim(), color: 'neutro' }),
                        }).then(() => {
                          setEtiquetasConfig(prev => [...prev, { valor: nuevaEtiqueta.trim(), etiqueta: nuevaEtiqueta.trim(), color: 'neutro' }])
                        }).catch(() => {})
                        agregarEtiqueta()
                      }
                    }
                  }}
                  placeholder="Nueva etiqueta..."
                  className="bg-transparent border-none outline-none text-sm text-texto-primario placeholder:text-texto-terciario/50 w-32"
                />
                {nuevaEtiqueta.trim() && (
                  <button type="button" onClick={() => {
                    fetch('/api/contactos/config', {
                      method: 'POST', headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ tipo: 'etiqueta', nombre: nuevaEtiqueta.trim(), color: 'neutro' }),
                    }).then(() => {
                      setEtiquetasConfig(prev => [...prev, { valor: nuevaEtiqueta.trim(), etiqueta: nuevaEtiqueta.trim(), color: 'neutro' }])
                    }).catch(() => {})
                    agregarEtiqueta()
                  }}
                    className="text-texto-marca bg-transparent border-none cursor-pointer p-0">
                    <Plus size={14} />
                  </button>
                )}
              </div>
            </div>
          </section>

          {/* ── Notas ── */}
          <section>
            <h3 className="text-xs font-semibold text-texto-terciario uppercase tracking-wider mb-3">Notas</h3>
            <textarea value={datos.notas} onChange={e => act('notas', e.target.value)}
              placeholder="Notas internas sobre este contacto..."
              rows={3}
              className="w-full bg-transparent outline-none text-sm text-texto-primario placeholder:text-texto-terciario/40 resize-y rounded-lg p-3 transition-colors"
              style={{ border: '1px solid var(--borde-sutil)' }}
              onFocus={e => { e.currentTarget.style.borderColor = 'var(--borde-foco)' }}
              onBlur={e => { e.currentTarget.style.borderColor = 'var(--borde-sutil)' }}
            />
          </section>

          {/* ── Indicador de estado ── */}
          {guardando && (
            <div className="flex items-center justify-center py-4">
              <span className="text-sm text-texto-terciario animate-pulse">Creando contacto...</span>
            </div>
          )}
          {!guardando && tieneNombre && !tieneDatoContacto && (
            <div className="flex items-center justify-center py-4">
              <span className="text-xs text-texto-terciario">
                Completá al menos un email, teléfono, WhatsApp o dirección para guardar
              </span>
            </div>
          )}

          {/* Error global */}
          {errorGlobal && (
            <div className="flex items-center justify-center py-3">
              <span className="text-sm text-insignia-peligro">{errorGlobal}</span>
            </div>
          )}
        </div>
      </div>

      {/* Modal de duplicado */}
      {duplicado && (
        <Modal abierto={!!duplicado} onCerrar={() => { setDuplicado(null); creadoRef.current = false }}>
          <div className="space-y-4 p-1">
            <h3 className="text-lg font-bold text-texto-primario">Contacto duplicado</h3>
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
              <Boton onClick={() => { setDuplicado(null); creadoRef.current = false }}>
                Cancelar
              </Boton>
              <Boton onClick={() => router.push(`/contactos/${duplicado.id}`)}>
                Ir al contacto existente
              </Boton>
              <Boton onClick={() => {
                setDuplicado(null)
                // Reintentar con ignorar_duplicados
                const datosConIgnorar = { ...datos, ignorar_duplicados: true }
                setDatos(prev => ({ ...prev })) // force re-render
                creadoRef.current = false
                // Re-trigger con flag
                setTimeout(() => {
                  creadoRef.current = true
                  crearContactoFn()
                }, 100)
              }}>
                Crear de todas formas
              </Boton>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}

// ─── Componente auxiliar: fila etiqueta + campo ───

function Fila({ etiqueta, children }: { etiqueta: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline gap-3">
      <label className="text-sm text-texto-terciario w-28 shrink-0 text-right">{etiqueta}</label>
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  )
}
