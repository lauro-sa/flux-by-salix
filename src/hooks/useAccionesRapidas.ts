'use client'

/**
 * useAccionesRapidas — detecta la ruta actual y expone una lista de acciones
 * rápidas contextuales a la entidad visible (contacto, presupuesto, etc.).
 *
 * Las acciones se renderizan dentro del panel de Salix IA. Cada acción es un
 * objeto autocontenedor con su onEjecutar ya preparado, que internamente usa
 * los helpers de `lib/plataforma` para adaptarse a móvil / PC (llamar, WhatsApp,
 * correo, Google Maps).
 *
 * El fetch a los endpoints de detalle solo ocurre cuando `habilitado=true`,
 * así no desperdicia bandwidth si el usuario nunca abre el panel.
 */

import { useEffect, useMemo, useState, type ComponentType } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import type { LucideProps } from 'lucide-react'
import { Phone, Mail, MapPin, UserRound, FileText, Copy } from 'lucide-react'
import { useToast } from '@/componentes/feedback/Toast'
import {
  accionLlamar,
  accionWhatsApp,
  accionCorreo,
  accionCopiarCorreo,
  accionNavegar,
  esDispositivoTactil,
} from '@/lib/plataforma'

import { IconoWhatsApp } from '@/componentes/marca/IconoWhatsApp'

type IconoLucide = ComponentType<LucideProps>

/** Categoría a la que pertenece una acción, usada para agrupar en el render. */
export type GrupoAccion = 'navegacion' | 'llamar' | 'whatsapp' | 'correo' | 'direccion'

export type AccionRapida = {
  clave: string
  etiqueta: string
  /** Texto secundario (número, correo, nombre del destinatario) */
  descripcion?: string
  icono: IconoLucide
  /** Clase Tailwind para el color del icono (ej: 'text-emerald-400') */
  colorIcono: string
  onEjecutar: () => void | Promise<void>
}

/**
 * Infiere el grupo de una acción desde el prefijo de su clave. Los constructores
 * siguen la convención `<grupo>-<id>` (ej. `llamar-0`, `correo-flux-contacto`),
 * así evitamos repetir el campo `grupo` en cada push.
 */
export function inferirGrupo(clave: string): GrupoAccion {
  if (clave.startsWith('llamar')) return 'llamar'
  if (clave.startsWith('whatsapp')) return 'whatsapp'
  if (clave.startsWith('correo')) return 'correo'
  if (clave.startsWith('navegar')) return 'direccion'
  return 'navegacion' // ir-*, ver-*
}

/** Contexto detectado desde la ruta (null si no hay entidad con acciones). */
type ContextoRuta =
  | { tipo: 'contacto'; id: string }
  | { tipo: 'presupuesto'; id: string }
  | { tipo: 'orden'; id: string }
  | { tipo: 'visita'; id: string }
  | null

const REGEX_UUID = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}'

/** Parsea el pathname y devuelve la entidad con acciones disponibles, si hay. */
export function parsearContextoRuta(pathname: string | null): ContextoRuta {
  if (!pathname) return null
  const mContacto = pathname.match(new RegExp(`^/contactos/(${REGEX_UUID})`, 'i'))
  if (mContacto) return { tipo: 'contacto', id: mContacto[1] }
  const mPresupuesto = pathname.match(new RegExp(`^/presupuestos/(${REGEX_UUID})`, 'i'))
  if (mPresupuesto) return { tipo: 'presupuesto', id: mPresupuesto[1] }
  const mOrden = pathname.match(new RegExp(`^/ordenes/(${REGEX_UUID})`, 'i'))
  if (mOrden) return { tipo: 'orden', id: mOrden[1] }
  const mVisita = pathname.match(new RegExp(`^/visitas/(${REGEX_UUID})`, 'i'))
  if (mVisita) return { tipo: 'visita', id: mVisita[1] }
  return null
}

/** ¿La ruta actual puede tener acciones rápidas? (sin hacer fetch) */
export function rutaTieneAccionesPotenciales(pathname: string | null): boolean {
  return parsearContextoRuta(pathname) !== null
}

/* ────────────────────────────────────────────────
   Tipos mínimos de respuesta de los endpoints
   ──────────────────────────────────────────────── */

type TelefonoContacto = {
  /** Valor normalizado (usa `valor` en la BD; legacy usa `telefono`) */
  valor: string
  tipo: string | null
  es_whatsapp?: boolean
  es_principal?: boolean
  etiqueta?: string | null
}

type DireccionContacto = {
  texto: string | null
  tipo?: string
  calle?: string | null
  numero?: string | null
  ciudad?: string | null
  provincia?: string | null
  pais?: string | null
  codigo_postal?: string | null
  es_principal: boolean
}

/** Reconstruye un texto de dirección navegable si no viene pre-formateado. */
function textoDireccion(d: DireccionContacto): string | null {
  if (d.texto?.trim()) return d.texto.trim()
  const partes = [
    [d.calle, d.numero].filter(Boolean).join(' '),
    d.ciudad,
    d.provincia,
    d.pais,
  ].filter((p): p is string => !!p && p.trim().length > 0)
  return partes.length > 0 ? partes.join(', ') : null
}

type RespuestaContacto = {
  id: string
  nombre: string | null
  apellido: string | null
  correo: string | null
  telefono: string | null
  whatsapp: string | null
  telefonos?: TelefonoContacto[]
  direcciones?: DireccionContacto[]
}

type RespuestaPresupuesto = {
  id: string
  numero: number | string
  contacto_id: string | null
  contacto_nombre: string | null
  contacto_apellido: string | null
  contacto_correo: string | null
  contacto_telefono: string | null
  contacto_direccion: string | null
  atencion_contacto_id: string | null
  atencion_nombre: string | null
  atencion_correo: string | null
  orden_trabajo: { id: string; numero: number | string } | null
}

/** Respuesta de /api/ordenes/[id] — wrapper con `orden` adentro. */
type RespuestaOrden = {
  orden: {
    id: string
    numero: number | string
    titulo: string | null
    contacto_id: string | null
    contacto_nombre: string | null
    contacto_telefono: string | null
    contacto_correo: string | null
    contacto_direccion: string | null
    atencion_contacto_id: string | null
    atencion_nombre: string | null
    atencion_telefono: string | null
    atencion_correo: string | null
    presupuesto_id: string | null
    presupuesto_numero: number | string | null
  }
}

/** Respuesta de /api/visitas/[id] — objeto plano. */
type RespuestaVisita = {
  id: string
  contacto_id: string | null
  contacto_nombre: string | null
  direccion_texto: string | null
  direccion_lat: number | null
  direccion_lng: number | null
  recibe_nombre: string | null
  recibe_telefono: string | null
  recibe_contacto_id: string | null
  actividad_id: string | null
}

/* ────────────────────────────────────────────────
   Hook principal
   ──────────────────────────────────────────────── */

export function useAccionesRapidas() {
  const pathname = usePathname()
  const contexto = useMemo(() => parsearContextoRuta(pathname), [pathname])

  const [datos, setDatos] = useState<
    RespuestaContacto | RespuestaPresupuesto | RespuestaOrden | RespuestaVisita | null
  >(null)
  // Para presupuestos: contacto vinculado cargado aparte — así obtenemos los
  // teléfonos y direcciones vigentes (no el snapshot guardado en el presupuesto,
  // que puede estar stale o vacío si se creó antes del refactor de teléfonos).
  const [contactoVinculado, setContactoVinculado] = useState<RespuestaContacto | null>(null)
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const router = useRouter()
  const toast = useToast()

  // Fetch apenas cambia la ruta a una con contexto: así las acciones ya están
  // listas cuando el usuario abre el panel. No se dispara si la ruta actual
  // no es una vista con acciones (ej. /calendario, /dashboard).
  useEffect(() => {
    if (!contexto) {
      setDatos(null)
      setContactoVinculado(null)
      return
    }
    let cancelado = false
    const cargar = async () => {
      setCargando(true)
      setError(null)
      try {
        const url =
          contexto.tipo === 'contacto' ? `/api/contactos/${contexto.id}`
          : contexto.tipo === 'presupuesto' ? `/api/presupuestos/${contexto.id}`
          : contexto.tipo === 'orden' ? `/api/ordenes/${contexto.id}`
          : `/api/visitas/${contexto.id}`
        const res = await fetch(url)
        if (!res.ok) throw new Error('No se pudo cargar el detalle')
        const json = await res.json()
        if (cancelado) return
        setDatos(json)

        // Extraer contacto_id vinculado según el tipo de entidad, para
        // traer teléfonos y direcciones vigentes del contacto.
        let contactoIdVinculado: string | null = null
        if (contexto.tipo === 'presupuesto') contactoIdVinculado = json.contacto_id
        else if (contexto.tipo === 'orden') contactoIdVinculado = json.orden?.contacto_id || null
        else if (contexto.tipo === 'visita') contactoIdVinculado = json.contacto_id

        if (contactoIdVinculado) {
          const resContacto = await fetch(`/api/contactos/${contactoIdVinculado}`)
          if (resContacto.ok && !cancelado) {
            setContactoVinculado(await resContacto.json())
          }
        } else {
          setContactoVinculado(null)
        }
      } catch (err) {
        if (!cancelado) setError(err instanceof Error ? err.message : 'Error')
      } finally {
        if (!cancelado) setCargando(false)
      }
    }
    cargar()
    return () => {
      cancelado = true
    }
  }, [contexto])

  const acciones = useMemo<AccionRapida[]>(() => {
    if (!contexto || !datos) return []
    if (contexto.tipo === 'contacto') {
      return construirAccionesContacto(datos as RespuestaContacto, { toast, router })
    }
    if (contexto.tipo === 'presupuesto') {
      return construirAccionesPresupuesto(
        datos as RespuestaPresupuesto,
        contactoVinculado,
        { toast, router },
      )
    }
    if (contexto.tipo === 'orden') {
      return construirAccionesOrden(
        (datos as RespuestaOrden).orden,
        contactoVinculado,
        { toast, router },
      )
    }
    if (contexto.tipo === 'visita') {
      return construirAccionesVisita(
        datos as RespuestaVisita,
        contactoVinculado,
        { toast, router },
      )
    }
    return []
  }, [contexto, datos, contactoVinculado, toast, router])

  return { acciones, cargando, error, hayContexto: contexto !== null }
}

/* ────────────────────────────────────────────────
   Constructores de acciones por tipo de entidad
   ──────────────────────────────────────────────── */

type Deps = {
  toast: ReturnType<typeof useToast>
  router?: ReturnType<typeof useRouter>
}

/** Ejecuta la acción asíncrona y muestra el toast adecuado. */
async function ejecutarConFeedback(
  fn: () => ReturnType<typeof accionLlamar>,
  toast: Deps['toast'],
) {
  const resultado = await fn()
  if (resultado.tipo === 'error') toast.mostrar('error', resultado.mensaje)
  else if (resultado.tipo === 'exito') toast.mostrar('exito', resultado.mensaje)
  // 'info' no muestra toast (evita ruido al abrir tel:/wa.me/mailto/maps)
}

function ejecutarSync(
  resultado: ReturnType<typeof accionWhatsApp>,
  toast: Deps['toast'],
) {
  if (resultado.tipo === 'error') toast.mostrar('error', resultado.mensaje)
  else if (resultado.tipo === 'exito') toast.mostrar('exito', resultado.mensaje)
}

function nombreCompleto(
  nombre: string | null | undefined,
  apellido?: string | null,
): string {
  return [nombre, apellido].filter(Boolean).join(' ') || 'Contacto'
}

function etiquetaTelefono(tipo: string | null | undefined): string {
  if (!tipo) return ''
  const t = tipo.toLowerCase()
  if (t === 'movil' || t === 'móvil' || t === 'mobile') return 'móvil'
  if (t === 'fijo' || t === 'casa' || t === 'home') return 'fijo'
  if (t === 'trabajo' || t === 'oficina' || t === 'work') return 'trabajo'
  return t
}

/** Construye la lista de teléfonos desde el contacto (soporta legacy y lista nueva). */
function listarTelefonos(c: RespuestaContacto): TelefonoContacto[] {
  if (c.telefonos && c.telefonos.length > 0) return c.telefonos
  // Legacy: columnas telefono + whatsapp en la tabla contactos
  const lista: TelefonoContacto[] = []
  if (c.telefono) lista.push({ valor: c.telefono, tipo: null, es_principal: true })
  if (c.whatsapp && c.whatsapp !== c.telefono) {
    lista.push({ valor: c.whatsapp, tipo: 'movil', es_whatsapp: true, es_principal: false })
  }
  return lista
}

/** ¿Este teléfono se considera móvil/WhatsApp? */
function esMovil(tel: TelefonoContacto): boolean {
  if (tel.es_whatsapp) return true
  const t = (tel.tipo || '').toLowerCase()
  return t === 'movil' || t === 'móvil' || t === 'mobile' || t === 'whatsapp'
}

/** Acciones rápidas para la vista de detalle de un contacto. */
function construirAccionesContacto(c: RespuestaContacto, deps: Deps): AccionRapida[] {
  const acciones: AccionRapida[] = []
  const tactil = esDispositivoTactil()
  const router = deps.router
  const telefonos = listarTelefonos(c)
  const direcciones = (c.direcciones || [])
    .map((d) => ({ dir: d, texto: textoDireccion(d) }))
    .filter((x): x is { dir: DireccionContacto; texto: string } => x.texto !== null)

  // Llamar — uno por teléfono
  telefonos.forEach((tel, i) => {
    const etiqTipo = etiquetaTelefono(tel.tipo)
    acciones.push({
      clave: `llamar-${i}`,
      etiqueta: tactil ? 'Llamar' : 'Copiar número',
      descripcion: `${tel.valor}${etiqTipo ? ` · ${etiqTipo}` : ''}`,
      icono: tactil ? Phone : Copy,
      colorIcono: 'text-emerald-400',
      onEjecutar: () => ejecutarConFeedback(() => accionLlamar(tel.valor), deps.toast),
    })
  })

  // WhatsApp en Flux — abre (o crea) la conversación en el inbox interno.
  // Aparece una sola vez por contacto, si hay al menos un teléfono móvil.
  const hayMovil = telefonos.some(esMovil)
  if (hayMovil && router) {
    const contactoId = c.id
    acciones.push({
      clave: 'whatsapp-flux',
      etiqueta: 'Abrir chat en Flux',
      descripcion: 'Inbox interno de Flux',
      icono: IconoWhatsApp,
      colorIcono: 'text-emerald-500',
      onEjecutar: () => router.push(`/whatsapp?contacto_id=${contactoId}`),
    })
  }

  // WhatsApp externo — uno por cada móvil, dispara la app del dispositivo / Web.
  telefonos.filter(esMovil).forEach((tel, i) => {
    acciones.push({
      clave: `whatsapp-externo-${i}`,
      etiqueta: 'Abrir en WhatsApp',
      descripcion: tel.valor,
      icono: IconoWhatsApp,
      colorIcono: 'text-green-400',
      onEjecutar: () => ejecutarSync(accionWhatsApp(tel.valor), deps.toast),
    })
  })

  // Correo
  if (c.correo) {
    const correo = c.correo

    // Redactar en Flux — abre el compositor interno de correo con destinatario precargado
    if (router) {
      acciones.push({
        clave: 'correo-flux',
        etiqueta: 'Redactar en Flux',
        descripcion: `${correo} · Inbox interno`,
        icono: Mail,
        colorIcono: 'text-sky-500',
        onEjecutar: () =>
          router.push(`/inbox?nuevo=1&para=${encodeURIComponent(correo)}&tab=correo`),
      })
    }

    // Abrir en cliente externo (mailto:)
    acciones.push({
      clave: 'correo',
      etiqueta: 'Abrir en cliente de correo',
      descripcion: correo,
      icono: Mail,
      colorIcono: 'text-sky-400',
      onEjecutar: () => ejecutarSync(accionCorreo(correo), deps.toast),
    })

    // En PC es útil ofrecer "copiar correo" por si no hay cliente configurado.
    if (!tactil) {
      acciones.push({
        clave: 'correo-copiar',
        etiqueta: 'Copiar correo',
        descripcion: correo,
        icono: Copy,
        colorIcono: 'text-sky-400/70',
        onEjecutar: () => ejecutarConFeedback(() => accionCopiarCorreo(correo), deps.toast),
      })
    }
  }

  // Direcciones — una por cada con texto navegable
  direcciones.forEach(({ dir, texto }, i) => {
    const etiqTipo = dir.tipo ? ` · ${dir.tipo}` : dir.es_principal ? ' · principal' : ''
    acciones.push({
      clave: `navegar-${i}`,
      etiqueta: 'Navegar',
      descripcion: `${texto}${etiqTipo}`,
      icono: MapPin,
      colorIcono: 'text-rose-400',
      onEjecutar: () => ejecutarSync(accionNavegar(texto), deps.toast),
    })
  })

  return acciones
}

/** Acciones rápidas para la vista de detalle de un presupuesto. */
function construirAccionesPresupuesto(
  p: RespuestaPresupuesto,
  contactoVivo: RespuestaContacto | null,
  deps: Deps,
): AccionRapida[] {
  const acciones: AccionRapida[] = []
  const tactil = esDispositivoTactil()
  const router = deps.router
  const nombreContacto = nombreCompleto(p.contacto_nombre, p.contacto_apellido)

  // Ir al contacto
  if (p.contacto_id && router) {
    const contactoId = p.contacto_id
    acciones.push({
      clave: 'ir-contacto',
      etiqueta: 'Ir al contacto',
      descripcion: nombreContacto,
      icono: UserRound,
      colorIcono: 'text-indigo-400',
      onEjecutar: () => router.push(`/contactos/${contactoId}`),
    })
  }

  // Ir al "dirigido a"
  if (p.atencion_contacto_id && router) {
    const atencionId = p.atencion_contacto_id
    acciones.push({
      clave: 'ir-atencion',
      etiqueta: 'Ir al dirigido a',
      descripcion: p.atencion_nombre || 'Persona vinculada',
      icono: UserRound,
      colorIcono: 'text-indigo-400/80',
      onEjecutar: () => router.push(`/contactos/${atencionId}`),
    })
  }

  // Ver orden de trabajo vinculada
  if (p.orden_trabajo && router) {
    const ot = p.orden_trabajo
    acciones.push({
      clave: 'ver-ot',
      etiqueta: 'Ver orden de trabajo',
      descripcion: `OT #${ot.numero}`,
      icono: FileText,
      colorIcono: 'text-amber-400',
      onEjecutar: () => router.push(`/ordenes/${ot.id}`),
    })
  }

  // Teléfonos: preferimos los del contacto vivo (tabla contacto_telefonos).
  // Si no están, caemos al snapshot del presupuesto (contacto_telefono).
  const telefonos: TelefonoContacto[] = contactoVivo
    ? listarTelefonos(contactoVivo)
    : p.contacto_telefono
      ? [{ valor: p.contacto_telefono, tipo: null, es_principal: true }]
      : []

  telefonos.forEach((tel, i) => {
    const etiqTipo = etiquetaTelefono(tel.tipo)
    const sufijo = `${etiqTipo ? ` · ${etiqTipo}` : ''} · ${nombreContacto}`
    acciones.push({
      clave: `llamar-${i}`,
      etiqueta: tactil ? 'Llamar' : 'Copiar número',
      descripcion: `${tel.valor}${sufijo}`,
      icono: tactil ? Phone : Copy,
      colorIcono: 'text-emerald-400',
      onEjecutar: () => ejecutarConFeedback(() => accionLlamar(tel.valor), deps.toast),
    })
  })

  // WhatsApp en Flux — abre (o crea) la conversación en el inbox interno.
  const hayMovil = telefonos.some(esMovil)
  if (hayMovil && router && p.contacto_id) {
    const contactoId = p.contacto_id
    acciones.push({
      clave: 'whatsapp-flux',
      etiqueta: 'Abrir chat en Flux',
      descripcion: `Inbox interno · ${nombreContacto}`,
      icono: IconoWhatsApp,
      colorIcono: 'text-emerald-500',
      onEjecutar: () => router.push(`/whatsapp?contacto_id=${contactoId}`),
    })
  }

  // WhatsApp externo — uno por cada móvil.
  telefonos.filter(esMovil).forEach((tel, i) => {
    acciones.push({
      clave: `whatsapp-externo-${i}`,
      etiqueta: 'Abrir en WhatsApp',
      descripcion: `${tel.valor} · ${nombreContacto}`,
      icono: IconoWhatsApp,
      colorIcono: 'text-green-400',
      onEjecutar: () => ejecutarSync(accionWhatsApp(tel.valor), deps.toast),
    })
  })

  // Correo del contacto principal (preferimos el vivo, snapshot como fallback)
  const correoContacto = contactoVivo?.correo || p.contacto_correo
  if (correoContacto) {
    const correo = correoContacto
    if (router) {
      acciones.push({
        clave: 'correo-flux-contacto',
        etiqueta: 'Redactar en Flux',
        descripcion: `${correo} · ${nombreContacto} · Inbox interno`,
        icono: Mail,
        colorIcono: 'text-sky-500',
        onEjecutar: () =>
          router.push(`/inbox?nuevo=1&para=${encodeURIComponent(correo)}&tab=correo`),
      })
    }
    acciones.push({
      clave: 'correo-contacto',
      etiqueta: 'Abrir en cliente de correo',
      descripcion: `${correo} · ${nombreContacto}`,
      icono: Mail,
      colorIcono: 'text-sky-400',
      onEjecutar: () => ejecutarSync(accionCorreo(correo), deps.toast),
    })
  }

  // Correo del "dirigido a" si es distinto del principal
  if (p.atencion_correo && p.atencion_correo !== correoContacto) {
    const correo = p.atencion_correo
    const nombreAtencion = p.atencion_nombre || 'Dirigido a'
    if (router) {
      acciones.push({
        clave: 'correo-flux-atencion',
        etiqueta: 'Redactar en Flux',
        descripcion: `${correo} · ${nombreAtencion} · Inbox interno`,
        icono: Mail,
        colorIcono: 'text-sky-500/80',
        onEjecutar: () =>
          router.push(`/inbox?nuevo=1&para=${encodeURIComponent(correo)}&tab=correo`),
      })
    }
    acciones.push({
      clave: 'correo-atencion',
      etiqueta: 'Abrir en cliente de correo',
      descripcion: `${correo} · ${nombreAtencion}`,
      icono: Mail,
      colorIcono: 'text-sky-400/80',
      onEjecutar: () => ejecutarSync(accionCorreo(correo), deps.toast),
    })
  }

  // Direcciones: preferimos las del contacto vivo (estructuradas con texto
  // completo). Si no hay, caemos al snapshot plano del presupuesto.
  const direccionesVivas = contactoVivo
    ? (contactoVivo.direcciones || [])
        .map((d) => ({ dir: d, texto: textoDireccion(d) }))
        .filter((x): x is { dir: DireccionContacto; texto: string } => x.texto !== null)
    : []

  if (direccionesVivas.length > 0) {
    direccionesVivas.forEach(({ dir, texto }, i) => {
      const etiqTipo = dir.tipo ? ` · ${dir.tipo}` : dir.es_principal ? ' · principal' : ''
      acciones.push({
        clave: `navegar-${i}`,
        etiqueta: 'Navegar a dirección',
        descripcion: `${texto}${etiqTipo}`,
        icono: MapPin,
        colorIcono: 'text-rose-400',
        onEjecutar: () => ejecutarSync(accionNavegar(texto), deps.toast),
      })
    })
  } else if (p.contacto_direccion) {
    const dir = p.contacto_direccion
    acciones.push({
      clave: 'navegar',
      etiqueta: 'Navegar a dirección',
      descripcion: dir,
      icono: MapPin,
      colorIcono: 'text-rose-400',
      onEjecutar: () => ejecutarSync(accionNavegar(dir), deps.toast),
    })
  }

  return acciones
}

/* ────────────────────────────────────────────────
   Acciones para órdenes de trabajo y visitas
   ──────────────────────────────────────────────── */

/** Acciones rápidas para el detalle de una orden de trabajo. */
function construirAccionesOrden(
  o: RespuestaOrden['orden'],
  contactoVivo: RespuestaContacto | null,
  deps: Deps,
): AccionRapida[] {
  const acciones: AccionRapida[] = []
  const tactil = esDispositivoTactil()
  const router = deps.router
  const nombreContacto = o.contacto_nombre || 'Contacto'

  // Ir al contacto
  if (o.contacto_id && router) {
    const contactoId = o.contacto_id
    acciones.push({
      clave: 'ir-contacto',
      etiqueta: 'Ir al contacto',
      descripcion: nombreContacto,
      icono: UserRound,
      colorIcono: 'text-indigo-400',
      onEjecutar: () => router.push(`/contactos/${contactoId}`),
    })
  }

  // Ir al "dirigido a" (atención / recepción)
  if (o.atencion_contacto_id && router) {
    const atencionId = o.atencion_contacto_id
    acciones.push({
      clave: 'ir-atencion',
      etiqueta: 'Ir a persona de contacto',
      descripcion: o.atencion_nombre || 'Persona de contacto',
      icono: UserRound,
      colorIcono: 'text-indigo-400/80',
      onEjecutar: () => router.push(`/contactos/${atencionId}`),
    })
  }

  // Ver presupuesto origen
  if (o.presupuesto_id && router) {
    const presId = o.presupuesto_id
    acciones.push({
      clave: 'ver-presupuesto',
      etiqueta: 'Ver presupuesto origen',
      descripcion: o.presupuesto_numero ? `Pres #${o.presupuesto_numero}` : 'Presupuesto vinculado',
      icono: FileText,
      colorIcono: 'text-amber-400',
      onEjecutar: () => router.push(`/presupuestos/${presId}`),
    })
  }

  // Teléfonos: preferimos los del contacto vivo (tabla contacto_telefonos).
  const telefonos: TelefonoContacto[] = contactoVivo
    ? listarTelefonos(contactoVivo)
    : o.contacto_telefono
      ? [{ valor: o.contacto_telefono, tipo: null, es_principal: true }]
      : []

  telefonos.forEach((tel, i) => {
    const etiqTipo = etiquetaTelefono(tel.tipo)
    acciones.push({
      clave: `llamar-${i}`,
      etiqueta: tactil ? 'Llamar' : 'Copiar número',
      descripcion: `${tel.valor}${etiqTipo ? ` · ${etiqTipo}` : ''} · ${nombreContacto}`,
      icono: tactil ? Phone : Copy,
      colorIcono: 'text-emerald-400',
      onEjecutar: () => ejecutarConFeedback(() => accionLlamar(tel.valor), deps.toast),
    })
  })

  // Teléfono de "atención" si es distinto (persona que recibe el servicio)
  if (o.atencion_telefono && o.atencion_telefono !== o.contacto_telefono) {
    const tel = o.atencion_telefono
    acciones.push({
      clave: 'llamar-atencion',
      etiqueta: tactil ? 'Llamar a recepción' : 'Copiar número de recepción',
      descripcion: `${tel} · ${o.atencion_nombre || 'Persona de contacto'}`,
      icono: tactil ? Phone : Copy,
      colorIcono: 'text-emerald-400/80',
      onEjecutar: () => ejecutarConFeedback(() => accionLlamar(tel), deps.toast),
    })
  }

  // WhatsApp en Flux
  const hayMovil = telefonos.some(esMovil)
  if (hayMovil && router && o.contacto_id) {
    const contactoId = o.contacto_id
    acciones.push({
      clave: 'whatsapp-flux',
      etiqueta: 'Abrir chat en Flux',
      descripcion: `Inbox interno · ${nombreContacto}`,
      icono: IconoWhatsApp,
      colorIcono: 'text-emerald-500',
      onEjecutar: () => router.push(`/whatsapp?contacto_id=${contactoId}`),
    })
  }

  telefonos.filter(esMovil).forEach((tel, i) => {
    acciones.push({
      clave: `whatsapp-externo-${i}`,
      etiqueta: 'Abrir en WhatsApp',
      descripcion: `${tel.valor} · ${nombreContacto}`,
      icono: IconoWhatsApp,
      colorIcono: 'text-green-400',
      onEjecutar: () => ejecutarSync(accionWhatsApp(tel.valor), deps.toast),
    })
  })

  // Correo del contacto
  const correoContacto = contactoVivo?.correo || o.contacto_correo
  if (correoContacto) {
    const correo = correoContacto
    if (router) {
      acciones.push({
        clave: 'correo-flux-contacto',
        etiqueta: 'Redactar en Flux',
        descripcion: `${correo} · ${nombreContacto} · Inbox interno`,
        icono: Mail,
        colorIcono: 'text-sky-500',
        onEjecutar: () =>
          router.push(`/inbox?nuevo=1&para=${encodeURIComponent(correo)}&tab=correo`),
      })
    }
    acciones.push({
      clave: 'correo-contacto',
      etiqueta: 'Abrir en cliente de correo',
      descripcion: `${correo} · ${nombreContacto}`,
      icono: Mail,
      colorIcono: 'text-sky-400',
      onEjecutar: () => ejecutarSync(accionCorreo(correo), deps.toast),
    })
  }

  // Correo de atención si es distinto
  if (o.atencion_correo && o.atencion_correo !== correoContacto) {
    const correo = o.atencion_correo
    acciones.push({
      clave: 'correo-atencion',
      etiqueta: 'Abrir en cliente de correo',
      descripcion: `${correo} · ${o.atencion_nombre || 'Recepción'}`,
      icono: Mail,
      colorIcono: 'text-sky-400/80',
      onEjecutar: () => ejecutarSync(accionCorreo(correo), deps.toast),
    })
  }

  // Direcciones: del contacto vivo primero, snapshot como fallback
  const direccionesVivas = contactoVivo
    ? (contactoVivo.direcciones || [])
        .map((d) => ({ dir: d, texto: textoDireccion(d) }))
        .filter((x): x is { dir: DireccionContacto; texto: string } => x.texto !== null)
    : []

  if (direccionesVivas.length > 0) {
    direccionesVivas.forEach(({ dir, texto }, i) => {
      const etiqTipo = dir.tipo ? ` · ${dir.tipo}` : dir.es_principal ? ' · principal' : ''
      acciones.push({
        clave: `navegar-${i}`,
        etiqueta: 'Navegar a dirección',
        descripcion: `${texto}${etiqTipo}`,
        icono: MapPin,
        colorIcono: 'text-rose-400',
        onEjecutar: () => ejecutarSync(accionNavegar(texto), deps.toast),
      })
    })
  } else if (o.contacto_direccion) {
    const dir = o.contacto_direccion
    acciones.push({
      clave: 'navegar',
      etiqueta: 'Navegar a dirección',
      descripcion: dir,
      icono: MapPin,
      colorIcono: 'text-rose-400',
      onEjecutar: () => ejecutarSync(accionNavegar(dir), deps.toast),
    })
  }

  return acciones
}

/**
 * Acciones rápidas para el detalle de una visita.
 * A diferencia de otras entidades, la visita tiene su propia dirección
 * (distinta a la del contacto) y puede tener un "recibe" específico.
 */
function construirAccionesVisita(
  v: RespuestaVisita,
  contactoVivo: RespuestaContacto | null,
  deps: Deps,
): AccionRapida[] {
  const acciones: AccionRapida[] = []
  const tactil = esDispositivoTactil()
  const router = deps.router
  const nombreContacto = v.contacto_nombre || 'Contacto'

  // Ir al contacto
  if (v.contacto_id && router) {
    const contactoId = v.contacto_id
    acciones.push({
      clave: 'ir-contacto',
      etiqueta: 'Ir al contacto',
      descripcion: nombreContacto,
      icono: UserRound,
      colorIcono: 'text-indigo-400',
      onEjecutar: () => router.push(`/contactos/${contactoId}`),
    })
  }

  // Ir a "recibe" si es un contacto distinto (persona que recibe al visitador)
  if (v.recibe_contacto_id && v.recibe_contacto_id !== v.contacto_id && router) {
    const recibeId = v.recibe_contacto_id
    acciones.push({
      clave: 'ir-recibe',
      etiqueta: 'Ir a persona que recibe',
      descripcion: v.recibe_nombre || 'Persona que recibe',
      icono: UserRound,
      colorIcono: 'text-indigo-400/80',
      onEjecutar: () => router.push(`/contactos/${recibeId}`),
    })
  }

  // Teléfonos del contacto (vivo, vienen de contacto_telefonos)
  const telefonos: TelefonoContacto[] = contactoVivo ? listarTelefonos(contactoVivo) : []
  telefonos.forEach((tel, i) => {
    const etiqTipo = etiquetaTelefono(tel.tipo)
    acciones.push({
      clave: `llamar-${i}`,
      etiqueta: tactil ? 'Llamar' : 'Copiar número',
      descripcion: `${tel.valor}${etiqTipo ? ` · ${etiqTipo}` : ''} · ${nombreContacto}`,
      icono: tactil ? Phone : Copy,
      colorIcono: 'text-emerald-400',
      onEjecutar: () => ejecutarConFeedback(() => accionLlamar(tel.valor), deps.toast),
    })
  })

  // Teléfono de "recibe" si es distinto — útil al llegar al domicilio
  const telsContacto = telefonos.map((t) => t.valor)
  if (v.recibe_telefono && !telsContacto.includes(v.recibe_telefono)) {
    const tel = v.recibe_telefono
    acciones.push({
      clave: 'llamar-recibe',
      etiqueta: tactil ? 'Llamar a quien recibe' : 'Copiar número de quien recibe',
      descripcion: `${tel} · ${v.recibe_nombre || 'Persona que recibe'}`,
      icono: tactil ? Phone : Copy,
      colorIcono: 'text-emerald-400/80',
      onEjecutar: () => ejecutarConFeedback(() => accionLlamar(tel), deps.toast),
    })
  }

  // WhatsApp
  const hayMovil = telefonos.some(esMovil)
  if (hayMovil && router && v.contacto_id) {
    const contactoId = v.contacto_id
    acciones.push({
      clave: 'whatsapp-flux',
      etiqueta: 'Abrir chat en Flux',
      descripcion: `Inbox interno · ${nombreContacto}`,
      icono: IconoWhatsApp,
      colorIcono: 'text-emerald-500',
      onEjecutar: () => router.push(`/whatsapp?contacto_id=${contactoId}`),
    })
  }
  telefonos.filter(esMovil).forEach((tel, i) => {
    acciones.push({
      clave: `whatsapp-externo-${i}`,
      etiqueta: 'Abrir en WhatsApp',
      descripcion: `${tel.valor} · ${nombreContacto}`,
      icono: IconoWhatsApp,
      colorIcono: 'text-green-400',
      onEjecutar: () => ejecutarSync(accionWhatsApp(tel.valor), deps.toast),
    })
  })

  // Correo del contacto vivo (la visita no guarda correo snapshot)
  if (contactoVivo?.correo) {
    const correo = contactoVivo.correo
    if (router) {
      acciones.push({
        clave: 'correo-flux-contacto',
        etiqueta: 'Redactar en Flux',
        descripcion: `${correo} · ${nombreContacto} · Inbox interno`,
        icono: Mail,
        colorIcono: 'text-sky-500',
        onEjecutar: () =>
          router.push(`/inbox?nuevo=1&para=${encodeURIComponent(correo)}&tab=correo`),
      })
    }
    acciones.push({
      clave: 'correo-contacto',
      etiqueta: 'Abrir en cliente de correo',
      descripcion: `${correo} · ${nombreContacto}`,
      icono: Mail,
      colorIcono: 'text-sky-400',
      onEjecutar: () => ejecutarSync(accionCorreo(correo), deps.toast),
    })
  }

  // Dirección PROPIA de la visita (no la del contacto). Preferimos lat/lng si hay,
  // si no el texto. Google Maps soporta "query=lat,lng" o texto.
  if (v.direccion_lat != null && v.direccion_lng != null) {
    const query = `${v.direccion_lat},${v.direccion_lng}`
    const textoDescr = v.direccion_texto || query
    acciones.push({
      clave: 'navegar-visita',
      etiqueta: 'Navegar a dirección de la visita',
      descripcion: textoDescr,
      icono: MapPin,
      colorIcono: 'text-rose-500',
      onEjecutar: () => ejecutarSync(accionNavegar(query), deps.toast),
    })
  } else if (v.direccion_texto) {
    const dir = v.direccion_texto
    acciones.push({
      clave: 'navegar-visita',
      etiqueta: 'Navegar a dirección de la visita',
      descripcion: dir,
      icono: MapPin,
      colorIcono: 'text-rose-500',
      onEjecutar: () => ejecutarSync(accionNavegar(dir), deps.toast),
    })
  }

  return acciones
}
