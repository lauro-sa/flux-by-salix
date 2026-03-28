'use client'

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { useParams, useRouter, usePathname, useSearchParams } from 'next/navigation'
import { useNavegacion } from '@/hooks/useNavegacion'
import {
  Mail, Phone, Globe, MessageCircle, ChevronLeft,
  Building2, User, Truck, UserPlus, BadgeCheck, Trash2, Plus,
  UserCheck, Clock,
} from 'lucide-react'
import { Input } from '@/componentes/ui/Input'
import { Select } from '@/componentes/ui/Select'
import { Insignia, type ColorInsignia } from '@/componentes/ui/Insignia'
import { ModalConfirmacion } from '@/componentes/ui/ModalConfirmacion'
import { Cargador } from '@/componentes/ui/Cargador'
import { DireccionesContacto, type DireccionConTipo } from '../_componentes/DireccionesContacto'
import { VinculacionesContacto } from '../_componentes/VinculacionesContacto'
import { BannerContacto } from '../_componentes/BannerContacto'
import { COLOR_TIPO_CONTACTO } from '@/lib/colores_entidad'
import { crearClienteNavegador } from '@/lib/supabase/cliente'
import type { TipoContacto, CampoFiscalPais, TipoRelacion } from '@/tipos'
import { PAISES_DISPONIBLES } from '@/lib/paises'

const TIPOS_PERSONA = ['persona', 'lead', 'equipo']

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
// PÁGINA: /contactos/[id] — Detalle con edición inline y autoguardado
// ═══════════════════════════════════════════════════════════════

export default function PaginaContactoDetalle() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const { setMigajaDinamica } = useNavegacion()

  // Contacto de origen (cuando se navega desde una vinculación)
  const desdeId = searchParams.get('desde')
  const desdeNombre = searchParams.get('desde_nombre')

  const [nombreCompleto, setNombreCompleto] = useState('')
  const [codigo, setCodigo] = useState('')
  const [tipoContactoId, setTipoContactoId] = useState('')
  const [campos, setCampos] = useState<Record<string, string>>({})
  const [datosFiscales, setDatosFiscales] = useState<Record<string, string>>({})
  const [etiquetas, setEtiquetas] = useState<string[]>([])
  const [nuevaEtiqueta, setNuevaEtiqueta] = useState('')
  const [direcciones, setDirecciones] = useState<DireccionConTipo[]>([])
  const [tiposContacto, setTiposContacto] = useState<TipoContacto[]>([])
  const [tiposRelacion, setTiposRelacion] = useState<TipoRelacion[]>([])
  const [puestosVinculacion, setPuestosVinculacion] = useState<{ id: string; etiqueta: string }[]>([])
  const [etiquetasConfig, setEtiquetasConfig] = useState<{ nombre: string; color: string }[]>([])
  const [rubrosConfig, setRubrosConfig] = useState<{ nombre: string }[]>([])
  const [vinculaciones, setVinculaciones] = useState<unknown[]>([])
  const [vinculacionesInversas, setVinculacionesInversas] = useState<unknown[]>([])
  const [camposFiscalesPais, setCamposFiscalesPais] = useState<CampoFiscalPais[]>([])
  const [paisesEmpresa, setPaisesEmpresa] = useState<string[]>([])
  const [paisContacto, setPaisContacto] = useState('')
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const [cargando, setCargando] = useState(true)
  const [guardando, setGuardando] = useState(false)
  const [errorGuardado, setErrorGuardado] = useState('')
  const [modalEliminar, setModalEliminar] = useState(false)
  const [esProvisorio, setEsProvisorio] = useState(false)
  const [accionandoProvisorio, setAccionandoProvisorio] = useState(false)

  const tipoActivo = tiposContacto.find(t => t.id === tipoContactoId)
  const claveTipo = tipoActivo?.clave || 'persona'
  const esPersona = TIPOS_PERSONA.includes(claveTipo)

  // Separar campos de identificación (dinámicos por país) de datos fiscales
  const camposIdentificacion = useMemo(
    () => camposFiscalesPais.filter(c => c.es_identificacion && c.aplica_a.includes(claveTipo) && (!paisContacto || c.pais === paisContacto)),
    [camposFiscalesPais, claveTipo, paisContacto]
  )
  const camposFiscalesFiltrados = useMemo(
    () => camposFiscalesPais.filter(c => !c.es_identificacion && c.aplica_a.includes(claveTipo) && (!paisContacto || c.pais === paisContacto)),
    [camposFiscalesPais, claveTipo, paisContacto]
  )

  // Cargar tipos + config
  useEffect(() => {
    Promise.all([
      fetch('/api/contactos/tipos').then(r => r.json()),
      fetch('/api/contactos/config').then(r => r.json()),
    ]).then(([tipos, config]) => {
        if (tipos.tipos_contacto) setTiposContacto(tipos.tipos_contacto)
        if (tipos.tipos_relacion) setTiposRelacion(tipos.tipos_relacion)
        if (tipos.puestos_vinculacion) setPuestosVinculacion(tipos.puestos_vinculacion)
        if (tipos.campos_fiscales) setCamposFiscalesPais(tipos.campos_fiscales)
        if (tipos.paises?.length) {
          setPaisesEmpresa(tipos.paises)
          if (tipos.paises.length === 1) setPaisContacto(tipos.paises[0])
        }
        if (config.etiquetas) setEtiquetasConfig(config.etiquetas.filter((e: Record<string, unknown>) => e.activo !== false).map((e: Record<string, unknown>) => ({ nombre: e.nombre as string, color: (e.color as string) || 'neutro' })))
        if (config.rubros) setRubrosConfig(config.rubros.filter((r: Record<string, unknown>) => r.activo !== false).map((r: Record<string, unknown>) => ({ nombre: r.nombre as string })))
      })
      .catch(() => {})
  }, [])

  // Cargar contacto
  useEffect(() => {
    setCargando(true)
    fetch(`/api/contactos/${id}`)
      .then(r => r.json())
      .then(data => {
        if (!data.id) return
        const nc = combinarNombre(data.nombre || '', data.apellido)
        setNombreCompleto(nc)
        // Registrar migaja del contacto de origen si venimos de una vinculación
        if (desdeId && desdeNombre) {
          setMigajaDinamica(`/contactos/${desdeId}`, desdeNombre)
        }
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
        // Direcciones
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
        // Vinculaciones
        if (data.vinculaciones) setVinculaciones(data.vinculaciones)
        if (data.vinculaciones_inversas) setVinculacionesInversas(data.vinculaciones_inversas)
      })
      .catch(() => {})
      .finally(() => setCargando(false))
  }, [id])

  // Recargar datos (después de vincular/desvincular)
  const recargar = useCallback(() => {
    fetch(`/api/contactos/${id}`)
      .then(r => r.json())
      .then(data => {
        if (data.vinculaciones) setVinculaciones(data.vinculaciones)
        if (data.vinculaciones_inversas) setVinculacionesInversas(data.vinculaciones_inversas)
      })
      .catch(() => {})
  }, [id])

  // Aceptar contacto provisorio → contacto real con código secuencial
  const aceptarProvisorio = useCallback(async () => {
    setAccionandoProvisorio(true)
    try {
      const res = await fetch(`/api/contactos/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ es_provisorio: false }),
      })
      if (res.ok) {
        const data = await res.json()
        setEsProvisorio(false)
        if (data.codigo) setCodigo(data.codigo)
      }
    } catch (err) {
      console.error('Error aceptando provisorio:', err)
    } finally {
      setAccionandoProvisorio(false)
    }
  }, [id])

  // Descartar provisorio → papelera
  const descartarProvisorio = useCallback(async () => {
    setAccionandoProvisorio(true)
    try {
      const res = await fetch(`/api/contactos/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ en_papelera: true }),
      })
      if (res.ok) router.push('/contactos')
    } catch (err) {
      console.error('Error descartando provisorio:', err)
    } finally {
      setAccionandoProvisorio(false)
    }
  }, [id, router])

  // Autoguardado genérico
  const guardar = useCallback(async (payload: Record<string, unknown>) => {
    setGuardando(true)
    setErrorGuardado('')
    try {
      const res = await fetch(`/api/contactos/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
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
    }
    finally { setGuardando(false) }
  }, [id])

  const guardarNombre = useCallback(() => {
    const { nombre, apellido } = separarNombreApellido(nombreCompleto, esPersona)
    guardar({ nombre, apellido: apellido || null })
  }, [nombreCompleto, esPersona, guardar])

  const guardarCampo = useCallback((campo: string) => {
    guardar({ [campo]: campos[campo] || null })
  }, [campos, guardar])

  const guardarSelect = useCallback((campo: string, valor: string) => {
    setCampos(prev => ({ ...prev, [campo]: valor }))
    guardar({ [campo]: valor || null })
  }, [guardar])

  const guardarFiscal = useCallback((clave: string, valor: string) => {
    setDatosFiscales(prev => {
      const nuevos = { ...prev, [clave]: valor }
      guardar({ datos_fiscales: nuevos })
      return nuevos
    })
  }, [guardar])

  // Etiquetas
  const agregarEtiqueta = useCallback(() => {
    const limpia = nuevaEtiqueta.trim()
    if (!limpia || etiquetas.includes(limpia)) return
    const nuevas = [...etiquetas, limpia]
    setEtiquetas(nuevas)
    setNuevaEtiqueta('')
    guardar({ etiquetas: nuevas })
  }, [nuevaEtiqueta, etiquetas, guardar])

  const quitarEtiqueta = useCallback((etiqueta: string) => {
    const nuevas = etiquetas.filter(e => e !== etiqueta)
    setEtiquetas(nuevas)
    guardar({ etiquetas: nuevas })
  }, [etiquetas, guardar])

  // Subir foto de perfil
  const subirFoto = useCallback(async (archivo: File) => {
    const supabase = crearClienteNavegador()
    const extension = archivo.name.split('.').pop() || 'jpg'
    const ruta = `${id}.${extension}`

    // Subir al bucket
    const { error: uploadError } = await supabase.storage
      .from('avatares-contactos')
      .upload(ruta, archivo, { upsert: true })

    if (uploadError) { setErrorGuardado('Error al subir foto'); return }

    // Obtener URL pública
    const { data } = supabase.storage.from('avatares-contactos').getPublicUrl(ruta)
    const url = data.publicUrl + '?t=' + Date.now() // cache bust

    setAvatarUrl(url)
    guardar({ avatar_url: url })
  }, [id, guardar])

  const moverAPapelera = async () => {
    await guardar({ en_papelera: true })
    router.push('/contactos')
  }

  if (cargando) {
    return <Cargador tamano="pagina" />
  }

  return (
    <div className="flex flex-col h-full overflow-auto">

      {/* ═══ CABECERO ═══ */}
      <div className="shrink-0 border-b border-borde-sutil">
        <div className="flex items-center justify-between px-4 sm:px-6 py-2">
          <div className="flex items-center gap-2 text-sm min-w-0">
            {guardando && <span className="text-xs text-texto-terciario animate-pulse">Guardando...</span>}
            {errorGuardado && <span className="text-xs text-insignia-peligro">{errorGuardado}</span>}
          </div>
          <button type="button" onClick={() => setModalEliminar(true)}
            className="flex items-center gap-1.5 px-2 py-1 rounded-md text-xs text-texto-terciario hover:text-insignia-peligro hover:bg-insignia-peligro-fondo bg-transparent border-none cursor-pointer transition-colors shrink-0">
            <Trash2 size={14} /><span className="hidden sm:inline">Eliminar</span>
          </button>
        </div>
      </div>

      {/* ═══ CONTENIDO ═══ */}
      <div className="flex-1 overflow-auto">
        <div className="max-w-4xl mx-auto px-4 sm:px-8 lg:px-12 py-0 space-y-6">

          {/* Banner + Avatar glass + selector de tipo */}
          <BannerContacto
            nombre={nombreCompleto}
            codigo={codigo}
            avatarUrl={avatarUrl}
            tipoActivo={tipoActivo || null}
            claveTipo={claveTipo}
            tiposContacto={tiposContacto}
            puedeEditar={true}
            onCambiarTipo={(tipoId) => {
              const tipo = tiposContacto.find(t => t.id === tipoId)
              setTipoContactoId(tipoId)
              // Limpiar campos irrelevantes para el nuevo tipo
              const esNuevaPersona = tipo && ['persona', 'lead', 'equipo'].includes(tipo.clave)
              const esNuevaEmpresa = tipo && ['empresa', 'proveedor'].includes(tipo.clave)
              const limpiar: Record<string, unknown> = { tipo_contacto_id: tipoId }
              if (!esNuevaPersona) { limpiar.cargo = null; setCampos(p => ({ ...p, cargo: '' })) }
              if (!esNuevaEmpresa) { limpiar.rubro = null; setCampos(p => ({ ...p, rubro: '' })) }
              guardar(limpiar)
            }}
            onSubirFoto={subirFoto}
            acciones={[
              { id: 'eliminar', etiqueta: 'Eliminar contacto', icono: <Trash2 size={14} />, peligro: true, onClick: () => setModalEliminar(true) },
            ]}
          />

          {/* Banner provisorio — aceptar o descartar */}
          {esProvisorio && (
            <div
              className="flex items-center justify-between px-4 py-3 rounded-lg"
              style={{
                background: 'var(--insignia-advertencia-fondo)',
                border: '1px solid var(--insignia-advertencia)',
              }}
            >
              <div className="flex items-center gap-2">
                <Clock size={16} style={{ color: 'var(--insignia-advertencia)' }} />
                <div>
                  <p className="text-sm font-medium" style={{ color: 'var(--texto-primario)' }}>
                    Contacto provisorio
                  </p>
                  <p className="text-xs" style={{ color: 'var(--texto-secundario)' }}>
                    Llegó por WhatsApp. Aceptalo para asignarle un código o descartalo.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <button
                  onClick={aceptarProvisorio}
                  disabled={accionandoProvisorio}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors text-white"
                  style={{ background: 'var(--insignia-exito)' }}
                >
                  <UserCheck size={14} />
                  Aceptar
                </button>
                <button
                  onClick={descartarProvisorio}
                  disabled={accionandoProvisorio}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors"
                  style={{ color: 'var(--insignia-peligro)', background: 'var(--superficie-hover)' }}
                >
                  <Trash2 size={14} />
                  Descartar
                </button>
              </div>
            </div>
          )}

          {/* Nombre completo con auto-corrección */}
          <div className="pl-1">
            <Input
              variante="plano"
              value={nombreCompleto}
              onChange={e => setNombreCompleto(e.target.value)}
              onBlur={guardarNombre}
              placeholder="Nombre completo"
              formato={esPersona ? 'nombre_persona' : 'nombre_empresa'}
              className="[&_input]:text-2xl [&_input]:font-bold"
            />
          </div>

          {/* Contacto directo + etiquetas/cargo en 2 columnas (60/40) */}
          <section className="flex flex-col sm:flex-row gap-8">
            {/* Columna izquierda (60%): datos de comunicación */}
            <div className="flex-[3] min-w-0 space-y-2">
              <Input variante="plano" tipo="email" icono={<Mail size={16} />}
                value={campos.correo || ''} onChange={e => setCampos(p => ({ ...p, correo: e.target.value }))}
                onBlur={() => guardarCampo('correo')} placeholder="Email" formato="email" />
              <Input variante="plano" tipo="tel" icono={<MessageCircle size={16} />}
                value={campos.whatsapp || ''} onChange={e => setCampos(p => ({ ...p, whatsapp: e.target.value }))}
                onBlur={() => guardarCampo('whatsapp')} placeholder="WhatsApp" formato="telefono" />
              <Input variante="plano" tipo="tel" icono={<Phone size={16} />}
                value={campos.telefono || ''} onChange={e => setCampos(p => ({ ...p, telefono: e.target.value }))}
                onBlur={() => guardarCampo('telefono')} placeholder="Teléfono" formato="telefono" />
              {(claveTipo === 'empresa' || claveTipo === 'proveedor') && (
                <Input variante="plano" tipo="url" icono={<Globe size={16} />}
                  value={campos.web || ''} onChange={e => setCampos(p => ({ ...p, web: e.target.value }))}
                  onBlur={() => guardarCampo('web')} placeholder="Sitio web" formato="url" />
              )}
            </div>

            {/* Columna derecha (40%): cargo/rubro + etiquetas */}
            <div className="flex-[2] min-w-0 space-y-3">
              {/* Puesto (persona) — selector con puestos configurados */}
              {esPersona && (
                <SelectorConSugerencias
                  etiqueta="Puesto"
                  valor={campos.cargo || ''}
                  opciones={puestosVinculacion.map(p => p.etiqueta)}
                  tipoConfig="puesto"
                  onChange={v => { setCampos(p => ({ ...p, cargo: v })); guardar({ cargo: v || null }) }}
                  placeholder="Buscar o crear puesto..."
                />
              )}

              {/* Rubro (empresa/proveedor) — selector con rubros configurados */}
              {(claveTipo === 'empresa' || claveTipo === 'proveedor') && (
                <SelectorConSugerencias
                  etiqueta="Rubro"
                  valor={campos.rubro || ''}
                  opciones={rubrosConfig.map(r => r.nombre)}
                  tipoConfig="rubro"
                  onChange={v => { setCampos(p => ({ ...p, rubro: v })); guardar({ rubro: v || null }) }}
                  placeholder="Buscar o crear rubro..."
                />
              )}

              {/* Etiquetas — selector con colores */}
              <SelectorEtiquetas
                etiquetas={etiquetas}
                etiquetasConfig={etiquetasConfig}
                onAgregar={(nombre, color) => {
                  if (etiquetas.includes(nombre)) return
                  const nuevas = [...etiquetas, nombre]
                  setEtiquetas(nuevas)
                  guardar({ etiquetas: nuevas })
                  // Si es nueva (no está en config), crearla en config
                  if (!etiquetasConfig.some(e => e.nombre === nombre)) {
                    fetch('/api/contactos/config', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ tipo: 'etiqueta', nombre, color }),
                    }).then(() => {
                      setEtiquetasConfig(prev => [...prev, { nombre, color }])
                    })
                  }
                }}
                onQuitar={nombre => {
                  const nuevas = etiquetas.filter(e => e !== nombre)
                  setEtiquetas(nuevas)
                  guardar({ etiquetas: nuevas })
                }}
              />
            </div>
          </section>

          {/* Direcciones (múltiples, con tipo) */}
          <section>
            <DireccionesContacto
              direcciones={direcciones}
              onChange={(dirs) => {
                setDirecciones(dirs)
                // Guardar direcciones en BD (debounce implícito — se guarda al cambiar)
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
                  method: 'PUT',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ direcciones: dirsParaGuardar }),
                }).catch(() => {})
              }}
              paises={paisesEmpresa.length ? paisesEmpresa : undefined}
            />
          </section>

          {/* Grid de campos */}
          <section className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-3">
            {/* País fiscal — solo si la empresa opera en más de un país */}
            {paisesEmpresa.length > 1 && (
              <Fila etiqueta="País fiscal">
                <Select variante="plano"
                  opciones={paisesEmpresa.map(c => {
                    const p = PAISES_DISPONIBLES.find(pd => pd.codigo === c)
                    return { valor: c, etiqueta: p ? `${p.bandera} ${p.nombre}` : c }
                  })}
                  valor={paisContacto}
                  onChange={v => {
                    setPaisContacto(v)
                    guardar({ pais_fiscal: v || null })
                  }} />
              </Fila>
            )}
            {/* Identificación — dinámico por país */}
            {camposIdentificacion.length > 0 && (
              <Fila etiqueta="Identificación">
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
                    onBlur={() => guardarCampo('numero_identificacion')}
                    placeholder={camposIdentificacion.find(c => c.clave === campos.tipo_identificacion)?.mascara || camposIdentificacion[0]?.etiqueta || ''} />
                </div>
              </Fila>
            )}
            <Fila etiqueta="Título">
              <Select variante="plano" valor={campos.titulo || ''} onChange={v => guardarSelect('titulo', v)}
                opciones={[{ valor: '', etiqueta: '—' }, { valor: 'Sr.', etiqueta: 'Sr.' }, { valor: 'Sra.', etiqueta: 'Sra.' }, { valor: 'Dr.', etiqueta: 'Dr.' }, { valor: 'Dra.', etiqueta: 'Dra.' }, { valor: 'Ing.', etiqueta: 'Ing.' }, { valor: 'Lic.', etiqueta: 'Lic.' }, { valor: 'Arq.', etiqueta: 'Arq.' }, { valor: 'Cr.', etiqueta: 'Cr.' }]} />
            </Fila>
            <Fila etiqueta="Idioma">
              <Select variante="plano" valor={campos.idioma || 'es'} onChange={v => guardarSelect('idioma', v)}
                opciones={[{ valor: 'es', etiqueta: 'Español' }, { valor: 'en', etiqueta: 'English' }, { valor: 'pt', etiqueta: 'Português' }]} />
            </Fila>
            <Fila etiqueta="Moneda">
              <Select variante="plano" valor={campos.moneda || 'ARS'} onChange={v => guardarSelect('moneda', v)}
                opciones={[{ valor: 'ARS', etiqueta: 'Peso argentino (ARS)' }, { valor: 'USD', etiqueta: 'Dólar (USD)' }, { valor: 'EUR', etiqueta: 'Euro (EUR)' }, { valor: 'MXN', etiqueta: 'Peso mexicano (MXN)' }, { valor: 'COP', etiqueta: 'Peso colombiano (COP)' }]} />
            </Fila>
            <Fila etiqueta="Límite crédito">
              <Input variante="plano" tipo="number" value={campos.limite_credito || ''}
                onChange={e => setCampos(p => ({ ...p, limite_credito: e.target.value }))}
                onBlur={() => guardarCampo('limite_credito')} placeholder="0" />
            </Fila>
            <Fila etiqueta="Plazo cliente">
              <Select variante="plano" valor={campos.plazo_pago_cliente || ''} onChange={v => guardarSelect('plazo_pago_cliente', v)}
                opciones={[{ valor: '', etiqueta: '—' }, { valor: 'contado', etiqueta: 'Contado' }, { valor: '15_dias', etiqueta: '15 días' }, { valor: '30_dias', etiqueta: '30 días' }, { valor: '60_dias', etiqueta: '60 días' }, { valor: '90_dias', etiqueta: '90 días' }]} />
            </Fila>
            <Fila etiqueta="Plazo proveedor">
              <Select variante="plano" valor={campos.plazo_pago_proveedor || ''} onChange={v => guardarSelect('plazo_pago_proveedor', v)}
                opciones={[{ valor: '', etiqueta: '—' }, { valor: 'contado', etiqueta: 'Contado' }, { valor: '15_dias', etiqueta: '15 días' }, { valor: '30_dias', etiqueta: '30 días' }, { valor: '60_dias', etiqueta: '60 días' }, { valor: '90_dias', etiqueta: '90 días' }]} />
            </Fila>
          </section>

          {/* Fiscal dinámico */}
          {camposFiscalesFiltrados.length > 0 && (
            <section>
              <h3 className="text-xs font-semibold text-texto-terciario uppercase tracking-wider mb-3">Datos fiscales</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-3">
                {camposFiscalesFiltrados.map(campo => (
                  <Fila key={campo.clave} etiqueta={campo.etiqueta}>
                    {campo.tipo_campo === 'select' && campo.opciones ? (
                      <Select variante="plano" valor={datosFiscales[campo.clave] || ''}
                        onChange={v => guardarFiscal(campo.clave, v)}
                        opciones={[{ valor: '', etiqueta: 'Seleccionar...' }, ...(campo.opciones as { valor: string; etiqueta: string }[])]} />
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
          <VinculacionesContacto
            contactoId={id}
            nombreContacto={nombreCompleto}
            vinculaciones={mapearVinculaciones(vinculaciones)}
            vinculacionesInversas={mapearVinculacionesInversas(vinculacionesInversas)}
            tiposRelacion={tiposRelacion}
            puestosVinculacion={puestosVinculacion}
            onActualizar={recargar}
          />


          {/* Notas */}
          <section>
            <h3 className="text-xs font-semibold text-texto-terciario uppercase tracking-wider mb-3">Notas</h3>
            <textarea value={campos.notas || ''} onChange={e => setCampos(p => ({ ...p, notas: e.target.value }))}
              onBlur={() => guardarCampo('notas')}
              placeholder="Notas internas sobre este contacto..."
              rows={3}
              className="w-full bg-transparent outline-none text-sm text-texto-primario placeholder:text-texto-terciario/40 resize-y rounded-lg p-3 transition-colors"
              style={{ border: '1px solid var(--borde-sutil)' }}
              onFocus={e => { e.currentTarget.style.borderColor = 'var(--borde-foco)' }}
            />
          </section>

          <div className="h-8" />
        </div>
      </div>

      {/* Modal de confirmación para eliminar */}
      <ModalConfirmacion
        abierto={modalEliminar}
        onCerrar={() => setModalEliminar(false)}
        onConfirmar={() => { setModalEliminar(false); moverAPapelera() }}
        titulo="Eliminar contacto"
        descripcion={`¿Estás seguro de que querés eliminar a ${nombreCompleto || 'este contacto'}? Se moverá a la papelera.`}
        tipo="peligro"
        etiquetaConfirmar="Eliminar"
      />
    </div>
  )
}

// Mapear vinculaciones de la API al formato del componente
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

// ─── Selector con sugerencias (para cargo y rubro) ───

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
      <label className="text-[11px] font-semibold text-texto-terciario uppercase tracking-wider mb-1 block">{etiqueta}</label>
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
      <label className="text-[11px] font-semibold text-texto-terciario uppercase tracking-wider mb-1.5 block">Etiquetas</label>

      {/* Etiquetas asignadas */}
      <div className="flex items-center gap-1.5 flex-wrap mb-1.5">
        {asignadas.map(e => (
          <Insignia key={e} color={obtenerColor(e) as ColorInsignia} removible onRemover={() => onQuitar(e)}>{e}</Insignia>
        ))}
      </div>

      {/* Input para buscar/crear */}
      <input
        type="text"
        value={texto}
        onChange={e => { setTexto(e.target.value); setAbierto(true); setCreando(false) }}
        onFocus={() => setAbierto(true)}
        onKeyDown={e => {
          if (e.key === 'Enter' && texto.trim()) {
            // Si existe exacta, agregarla; si no, iniciar creación
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

      {/* Dropdown */}
      {abierto && (disponibles.length > 0 || mostrarCrear || creando) && (
        <div
          className="absolute z-20 top-full left-0 right-0 mt-1 rounded-lg border border-borde-sutil shadow-elevada max-h-48 overflow-y-auto"
          style={{ backgroundColor: 'var(--superficie-elevada)' }}
          onMouseDown={e => e.preventDefault()}
        >
          {/* Etiquetas existentes disponibles */}
          {!creando && disponibles.map(e => (
            <button key={e.nombre} type="button"
              onClick={() => seleccionarExistente(e.nombre, e.color)}
              className="flex items-center gap-2 w-full text-left px-3 py-1.5 text-sm hover:bg-superficie-hover bg-transparent border-none cursor-pointer transition-colors">
              <span className="size-2.5 rounded-full shrink-0" style={{ backgroundColor: `var(--insignia-${e.color})` }} />
              <span className="text-texto-primario">{e.nombre}</span>
            </button>
          ))}

          {/* Botón crear nueva */}
          {mostrarCrear && !creando && (
            <button type="button"
              onClick={iniciarCreacion}
              className="flex items-center gap-2 w-full text-left px-3 py-2 text-sm text-texto-marca hover:bg-superficie-hover bg-transparent border-none cursor-pointer transition-colors border-t border-borde-sutil">
              <Plus size={14} />
              Crear &quot;{texto.trim()}&quot;
            </button>
          )}

          {/* Selector de color para nueva etiqueta */}
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
