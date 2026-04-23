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

/** Contexto detectado desde la ruta (null si no hay entidad con acciones). */
type ContextoRuta =
  | { tipo: 'contacto'; id: string }
  | { tipo: 'presupuesto'; id: string }
  | null

const REGEX_UUID = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}'

/** Parsea el pathname y devuelve la entidad con acciones disponibles, si hay. */
export function parsearContextoRuta(pathname: string | null): ContextoRuta {
  if (!pathname) return null
  const mContacto = pathname.match(new RegExp(`^/contactos/(${REGEX_UUID})`, 'i'))
  if (mContacto) return { tipo: 'contacto', id: mContacto[1] }
  const mPresupuesto = pathname.match(new RegExp(`^/presupuestos/(${REGEX_UUID})`, 'i'))
  if (mPresupuesto) return { tipo: 'presupuesto', id: mPresupuesto[1] }
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

/* ────────────────────────────────────────────────
   Hook principal
   ──────────────────────────────────────────────── */

export function useAccionesRapidas() {
  const pathname = usePathname()
  const contexto = useMemo(() => parsearContextoRuta(pathname), [pathname])

  const [datos, setDatos] = useState<RespuestaContacto | RespuestaPresupuesto | null>(null)
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
          contexto.tipo === 'contacto'
            ? `/api/contactos/${contexto.id}`
            : `/api/presupuestos/${contexto.id}`
        const res = await fetch(url)
        if (!res.ok) throw new Error('No se pudo cargar el detalle')
        const json = await res.json()
        if (cancelado) return
        setDatos(json)

        // Si es presupuesto y tiene contacto vinculado, traemos el contacto
        // aparte para obtener teléfonos y direcciones vigentes.
        if (contexto.tipo === 'presupuesto' && json.contacto_id) {
          const resContacto = await fetch(`/api/contactos/${json.contacto_id}`)
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
      return construirAccionesContacto(datos as RespuestaContacto, { toast })
    }
    if (contexto.tipo === 'presupuesto') {
      return construirAccionesPresupuesto(
        datos as RespuestaPresupuesto,
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

  // WhatsApp — solo para móviles
  telefonos.filter(esMovil).forEach((tel, i) => {
    acciones.push({
      clave: `whatsapp-${i}`,
      etiqueta: 'WhatsApp',
      descripcion: tel.valor,
      icono: IconoWhatsApp,
      colorIcono: 'text-green-400',
      onEjecutar: () => ejecutarSync(accionWhatsApp(tel.valor), deps.toast),
    })
  })

  // Correo
  if (c.correo) {
    const correo = c.correo
    acciones.push({
      clave: 'correo',
      etiqueta: 'Enviar correo',
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

  telefonos.filter(esMovil).forEach((tel, i) => {
    acciones.push({
      clave: `whatsapp-${i}`,
      etiqueta: 'WhatsApp',
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
    acciones.push({
      clave: 'correo-contacto',
      etiqueta: 'Enviar correo',
      descripcion: `${correo} · ${nombreContacto}`,
      icono: Mail,
      colorIcono: 'text-sky-400',
      onEjecutar: () => ejecutarSync(accionCorreo(correo), deps.toast),
    })
  }

  // Correo del "dirigido a" si es distinto del principal
  if (p.atencion_correo && p.atencion_correo !== correoContacto) {
    const correo = p.atencion_correo
    acciones.push({
      clave: 'correo-atencion',
      etiqueta: 'Enviar correo',
      descripcion: `${correo} · ${p.atencion_nombre || 'Dirigido a'}`,
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
