'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useParams, useRouter } from 'next/navigation'
import {
  Mail, Phone, Globe, MessageCircle, ChevronLeft,
  Building2, User, Truck, UserPlus, BadgeCheck, Trash2, Plus,
} from 'lucide-react'
import { Input } from '@/componentes/ui/Input'
import { Select } from '@/componentes/ui/Select'
import { Insignia } from '@/componentes/ui/Insignia'
import { ModalConfirmacion } from '@/componentes/ui/ModalConfirmacion'
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

  // Cargar tipos
  useEffect(() => {
    fetch('/api/contactos/tipos')
      .then(r => r.json())
      .then(data => {
        if (data.tipos_contacto) setTiposContacto(data.tipos_contacto)
        if (data.tipos_relacion) setTiposRelacion(data.tipos_relacion)
        if (data.puestos_vinculacion) setPuestosVinculacion(data.puestos_vinculacion)
        if (data.campos_fiscales) setCamposFiscalesPais(data.campos_fiscales)
        if (data.paises?.length) {
          setPaisesEmpresa(data.paises)
          // Si hay un solo país, preseleccionarlo
          if (data.paises.length === 1) setPaisContacto(data.paises[0])
        }
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
        setNombreCompleto(combinarNombre(data.nombre || '', data.apellido))
        setCodigo(data.codigo || '')
        setTipoContactoId(data.tipo_contacto_id || '')
        setAvatarUrl(data.avatar_url || null)
        setDatosFiscales(data.datos_fiscales || {})
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
    return <div className="flex items-center justify-center h-full"><span className="text-texto-terciario text-sm">Cargando...</span></div>
  }

  return (
    <div className="flex flex-col h-full overflow-auto">

      {/* ═══ CABECERO ═══ */}
      <div className="shrink-0 border-b border-borde-sutil">
        <div className="flex items-center justify-between px-4 sm:px-6 py-2">
          <div className="flex items-center gap-2 text-sm min-w-0">
            <button type="button" onClick={() => router.push('/contactos')}
              className="flex items-center gap-1 text-texto-secundario hover:text-texto-primario bg-transparent border-none cursor-pointer transition-colors shrink-0">
              <ChevronLeft size={16} /><span>Contactos</span>
            </button>
            <span className="text-texto-terciario">/</span>
            <span className="font-medium text-texto-primario truncate max-w-48">{nombreCompleto || codigo}</span>
            {codigo && <span className="text-xs font-mono text-texto-terciario shrink-0">{codigo}</span>}
            {guardando && <span className="text-xs text-texto-terciario animate-pulse shrink-0">Guardando...</span>}
            {errorGuardado && <span className="text-xs text-insignia-peligro shrink-0">{errorGuardado}</span>}
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

          {/* Contacto directo */}
          <section className="space-y-2">
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
            {esPersona && (
              <Fila etiqueta="Cargo">
                <Input variante="plano" value={campos.cargo || ''} onChange={e => setCampos(p => ({ ...p, cargo: e.target.value }))}
                  onBlur={() => guardarCampo('cargo')} placeholder="Ej: Director de ventas" formato="nombre_persona" />
              </Fila>
            )}
            {(claveTipo === 'empresa' || claveTipo === 'proveedor') && (
              <Fila etiqueta="Rubro">
                <Input variante="plano" value={campos.rubro || ''} onChange={e => setCampos(p => ({ ...p, rubro: e.target.value }))}
                  onBlur={() => guardarCampo('rubro')} placeholder="Ej: Construcción" formato="nombre_empresa" />
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
            onActualizar={recargar}
          />

          {/* Etiquetas */}
          <section>
            <h3 className="text-xs font-semibold text-texto-terciario uppercase tracking-wider mb-3">Etiquetas</h3>
            <div className="flex items-center gap-2 flex-wrap">
              {etiquetas.map(e => (
                <Insignia key={e} color="neutro" removible onRemover={() => quitarEtiqueta(e)}>{e}</Insignia>
              ))}
              <div className="flex items-center gap-1">
                <input type="text" value={nuevaEtiqueta}
                  onChange={e => setNuevaEtiqueta(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); agregarEtiqueta() } }}
                  placeholder="Agregar etiqueta..."
                  className="bg-transparent border-none outline-none text-sm text-texto-primario placeholder:text-texto-terciario/50 w-36" />
                {nuevaEtiqueta.trim() && (
                  <button type="button" onClick={agregarEtiqueta}
                    className="text-texto-marca bg-transparent border-none cursor-pointer p-0">
                    <Plus size={14} />
                  </button>
                )}
              </div>
            </div>
          </section>

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
