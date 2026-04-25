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
import { Phone, Mail, MapPin, UserRound, FileText, Copy, Globe } from 'lucide-react'
import { useToast } from '@/componentes/feedback/Toast'
import {
  accionLlamar,
  accionWhatsApp,
  accionCorreo,
  accionCopiarCorreo,
  accionNavegar,
  esDispositivoTactil,
  copiarAlPortapapeles,
  normalizarTelefono,
} from '@/lib/plataforma'

import { IconoWhatsApp } from '@/componentes/marca/IconoWhatsApp'

type IconoLucide = ComponentType<LucideProps>

/** Categoría a la que pertenece una acción, usada para agrupar en el render. */
export type GrupoAccion = 'navegacion' | 'llamar' | 'whatsapp' | 'correo' | 'direccion'

export type SubAccion = {
  clave: string
  /** Etiqueta corta del botón (ej. "En Flux", "Externo") */
  etiqueta: string
  icono?: IconoLucide
  colorIcono?: string
  onEjecutar: () => void | Promise<void>
}

export type AccionRapida = {
  clave: string
  etiqueta: string
  /** Texto secundario (número, correo, nombre del destinatario) */
  descripcion?: string
  icono: IconoLucide
  /** Clase Tailwind para el color del icono (ej: 'text-emerald-400') */
  colorIcono: string
  /** Acción simple. Se ignora si hay `subacciones`. */
  onEjecutar?: () => void | Promise<void>
  /**
   * Si hay 2+ subacciones, el item se renderiza como card dual: header con
   * icono/título/descripción arriba y un grid de botones igual ancho abajo.
   * Útil para WhatsApp (Flux / externo) y correo (Flux / cliente externo).
   */
  subacciones?: SubAccion[]
  /**
   * Si está presente, el header del card dual es clickeable y dispara esta
   * callback. Convención: tocar el dato lo copia al portapapeles. Aparece
   * un mini icono de copiar sutil para señalar que es clickeable.
   */
  onCopiar?: () => void | Promise<void>
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
  | { tipo: 'usuario'; id: string }
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
  const mUsuario = pathname.match(new RegExp(`^/usuarios/(${REGEX_UUID})`, 'i'))
  if (mUsuario) return { tipo: 'usuario', id: mUsuario[1] }
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

/**
 * Respuesta de /api/miembros/[id] — datos accionables del compañero del equipo
 * (sin información sensible: solo nombre + correos + teléfonos).
 */
type RespuestaUsuario = {
  id: string
  nombre: string | null
  apellido: string | null
  /** Correo personal (login) */
  correo: string | null
  /** Correo corporativo */
  correo_empresa: string | null
  /** Teléfono personal */
  telefono: string | null
  /** Teléfono empresa */
  telefono_empresa: string | null
}

/* ────────────────────────────────────────────────
   Hook principal
   ──────────────────────────────────────────────── */

export function useAccionesRapidas() {
  const pathname = usePathname()
  const contexto = useMemo(() => parsearContextoRuta(pathname), [pathname])

  const [datos, setDatos] = useState<
    | RespuestaContacto
    | RespuestaPresupuesto
    | RespuestaOrden
    | RespuestaVisita
    | RespuestaUsuario
    | null
  >(null)
  // Para presupuestos/órdenes/visitas: contacto principal cargado aparte para
  // obtener teléfonos y direcciones vigentes (no el snapshot guardado, que puede
  // estar stale o incompleto).
  const [contactoVinculado, setContactoVinculado] = useState<RespuestaContacto | null>(null)
  // Contacto secundario cuando existe "dirigido a" / "atención" / "recibe"
  // distinto al principal. Permite ofrecer llamar/WhatsApp/correo a esa persona
  // aunque el contacto principal no tenga datos (ej. cliente=empresa sin tel).
  const [atencionVinculada, setAtencionVinculada] = useState<RespuestaContacto | null>(null)
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
      setAtencionVinculada(null)
      return
    }
    // AbortController para cancelar fetches al cambiar de ruta. Necesario
    // además del flag `cancelado` porque sin signal los requests siguen
    // en vuelo ocupando red — y el contacto secundario podría llegar
    // tarde y querer setear estado del contexto anterior.
    const ctrl = new AbortController()
    const cargar = async () => {
      setCargando(true)
      setError(null)
      try {
        const url =
          contexto.tipo === 'contacto' ? `/api/contactos/${contexto.id}`
          : contexto.tipo === 'presupuesto' ? `/api/presupuestos/${contexto.id}`
          : contexto.tipo === 'orden' ? `/api/ordenes/${contexto.id}`
          : contexto.tipo === 'visita' ? `/api/visitas/${contexto.id}`
          : `/api/miembros/${contexto.id}`
        const res = await fetch(url, { signal: ctrl.signal })
        if (!res.ok) throw new Error('No se pudo cargar el detalle')
        const json = await res.json()
        if (ctrl.signal.aborted) return
        setDatos(json)

        // Extraer IDs de contactos vinculados según el tipo de entidad, para
        // traer teléfonos/correos/direcciones vigentes. Algunos registros tienen
        // un "dirigido a" / "atención" / "recibe" distinto al principal — lo
        // cargamos aparte porque el snapshot del presupuesto/orden no incluye
        // la lista completa de teléfonos de esa persona.
        let contactoIdVinculado: string | null = null
        let atencionIdVinculado: string | null = null
        if (contexto.tipo === 'presupuesto') {
          contactoIdVinculado = json.contacto_id
          atencionIdVinculado = json.atencion_contacto_id
        } else if (contexto.tipo === 'orden') {
          contactoIdVinculado = json.orden?.contacto_id || null
          atencionIdVinculado = json.orden?.atencion_contacto_id || null
        } else if (contexto.tipo === 'visita') {
          contactoIdVinculado = json.contacto_id
          atencionIdVinculado = json.recibe_contacto_id
        }

        // Fetch en paralelo de ambos contactos (si existen y son distintos)
        const cargarContacto = async (id: string | null): Promise<RespuestaContacto | null> => {
          if (!id) return null
          try {
            const r = await fetch(`/api/contactos/${id}`, { signal: ctrl.signal })
            return r.ok ? ((await r.json()) as RespuestaContacto) : null
          } catch {
            return null
          }
        }
        const atencionId =
          atencionIdVinculado && atencionIdVinculado !== contactoIdVinculado
            ? atencionIdVinculado
            : null
        const [contactoData, atencionData] = await Promise.all([
          cargarContacto(contactoIdVinculado),
          cargarContacto(atencionId),
        ])
        if (ctrl.signal.aborted) return
        setContactoVinculado(contactoData)
        setAtencionVinculada(atencionData)
      } catch (err) {
        // Errores de abort no son errores reales — solo el efecto se rearmó
        if (err instanceof DOMException && err.name === 'AbortError') return
        if (!ctrl.signal.aborted) setError(err instanceof Error ? err.message : 'Error')
      } finally {
        if (!ctrl.signal.aborted) setCargando(false)
      }
    }
    cargar()
    return () => {
      ctrl.abort()
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
        atencionVinculada,
        { toast, router },
      )
    }
    if (contexto.tipo === 'orden') {
      return construirAccionesOrden(
        (datos as RespuestaOrden).orden,
        contactoVinculado,
        atencionVinculada,
        { toast, router },
      )
    }
    if (contexto.tipo === 'visita') {
      return construirAccionesVisita(
        datos as RespuestaVisita,
        contactoVinculado,
        atencionVinculada,
        { toast, router },
      )
    }
    if (contexto.tipo === 'usuario') {
      return construirAccionesUsuario(datos as RespuestaUsuario, { toast, router })
    }
    return []
  }, [contexto, datos, contactoVinculado, atencionVinculada, toast, router])

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
  fallback = 'Contacto',
): string {
  return [nombre, apellido].filter(Boolean).join(' ') || fallback
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

/* ────────────────────────────────────────────────
   Helpers de fusión: cuando un mismo destinatario tiene tanto opción
   "Flux" como "externo" (WhatsApp y correo), las combinamos en un único
   item dual con dos botones lado a lado en vez de duplicar filas.
   ──────────────────────────────────────────────── */

/**
 * Construye la acción rápida de WhatsApp para un destinatario.
 * - Si hay móvil y contacto_id → dual (En Flux / En WhatsApp). El header
 *   copia el número al portapapeles.
 * - Si solo hay móvil (sin contacto_id) → solo externo.
 * - Si solo hay contacto_id (sin móvil) → solo Flux.
 * - Si no hay ninguno → null.
 */
function accionWhatsAppDual(opciones: {
  claveBase: string
  contactoId: string | null
  numeroMovil: string | null
  nombre: string
  colorBase?: string
  deps: Deps
}): AccionRapida | null {
  const { claveBase, contactoId, numeroMovil, nombre, colorBase = 'text-green-400', deps } = opciones
  const router = deps.router
  const puedeFlux = !!(contactoId && router)
  const puedeExterno = !!numeroMovil
  if (!puedeFlux && !puedeExterno) return null

  const descripcion = numeroMovil ? `${numeroMovil} · ${nombre}` : nombre

  // Solo Flux (sin móvil para copiar/abrir wa.me)
  if (puedeFlux && !puedeExterno) {
    const id = contactoId!
    return {
      clave: `whatsapp-${claveBase}`,
      etiqueta: 'WhatsApp',
      descripcion: `Inbox interno · ${nombre}`,
      icono: IconoWhatsApp,
      colorIcono: colorBase,
      onEjecutar: () => router!.push(`/whatsapp?contacto_id=${id}`),
    }
  }

  // Solo externo (móvil sin contacto en sistema): toda la card abre wa.me;
  // el header copia el número.
  if (!puedeFlux && puedeExterno) {
    const num = numeroMovil!
    return {
      clave: `whatsapp-${claveBase}`,
      etiqueta: 'WhatsApp',
      descripcion,
      icono: IconoWhatsApp,
      colorIcono: colorBase,
      onEjecutar: () => ejecutarSync(accionWhatsApp(num), deps.toast),
    }
  }

  // Dual: 2 botones simétricos abajo + header clickeable para copiar el número.
  const id = contactoId!
  const num = numeroMovil!
  return {
    clave: `whatsapp-${claveBase}`,
    etiqueta: 'WhatsApp',
    descripcion,
    icono: IconoWhatsApp,
    colorIcono: colorBase,
    // Copiar SIEMPRE: en móvil no queremos disparar tel:, solo el portapapeles.
    onCopiar: async () => {
      const limpio = normalizarTelefono(num)
      const ok = await copiarAlPortapapeles(`+${limpio}`)
      deps.toast.mostrar(ok ? 'exito' : 'error', ok ? `Número copiado: +${limpio}` : 'No se pudo copiar')
    },
    subacciones: [
      {
        clave: 'flux',
        etiqueta: 'En Flux',
        icono: IconoWhatsApp,
        colorIcono: 'text-emerald-400',
        onEjecutar: () => router!.push(`/whatsapp?contacto_id=${id}`),
      },
      {
        clave: 'externo',
        etiqueta: 'En WhatsApp',
        icono: Globe,
        colorIcono: 'text-texto-terciario',
        onEjecutar: () => ejecutarSync(accionWhatsApp(num), deps.toast),
      },
    ],
  }
}

/**
 * Construye la acción rápida de correo para un destinatario.
 * Devuelve un card dual con [En Flux] + [En cliente] (si hay router) o solo
 * "En cliente" si no hay. El header del card copia el correo al portapapeles
 * — así no necesitamos un 3er botón rompiendo la simetría visual.
 */
function accionCorreoDual(opciones: {
  claveBase: string
  correo: string
  nombre: string
  colorBase?: string
  deps: Deps
}): AccionRapida {
  const { claveBase, correo, nombre, colorBase = 'text-sky-400', deps } = opciones
  const router = deps.router

  const subacciones: SubAccion[] = []
  if (router) {
    subacciones.push({
      clave: 'flux',
      etiqueta: 'En Flux',
      icono: Mail,
      colorIcono: 'text-sky-400',
      onEjecutar: () => router.push(`/inbox?nuevo=1&para=${encodeURIComponent(correo)}&tab=correo`),
    })
  }
  subacciones.push({
    clave: 'externo',
    etiqueta: 'En cliente',
    icono: Globe,
    colorIcono: 'text-texto-terciario',
    onEjecutar: () => ejecutarSync(accionCorreo(correo), deps.toast),
  })

  return {
    clave: `correo-${claveBase}`,
    etiqueta: 'Correo',
    descripcion: `${correo} · ${nombre}`,
    icono: Mail,
    colorIcono: colorBase,
    onCopiar: () => ejecutarConFeedback(() => accionCopiarCorreo(correo), deps.toast),
    subacciones,
  }
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

  // WhatsApp dual: Flux + externo en una sola card. Si hay 2+ móviles,
  // el primero se fusiona con Flux y los siguientes se agregan aparte.
  const moviles = telefonos.filter(esMovil)
  const nombreContacto = nombreCompleto(c.nombre, c.apellido)
  const accionWA = accionWhatsAppDual({
    claveBase: 'principal',
    contactoId: c.id,
    numeroMovil: moviles[0]?.valor || null,
    nombre: nombreContacto,
    deps,
  })
  if (accionWA) acciones.push(accionWA)
  // Móviles secundarios (raro): se agregan como simples solo-externo
  moviles.slice(1).forEach((tel, i) => {
    const extra = accionWhatsAppDual({
      claveBase: `extra-${i}`,
      contactoId: null,
      numeroMovil: tel.valor,
      nombre: nombreContacto,
      deps,
    })
    if (extra) acciones.push(extra)
  })

  // Correo: card dual (Flux + externo) — más copiar en PC.
  if (c.correo) {
    acciones.push(
      accionCorreoDual({
        claveBase: 'principal',
        correo: c.correo,
        nombre: nombreContacto,
        deps,
      }),
    )
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
  atencionVivo: RespuestaContacto | null,
  deps: Deps,
): AccionRapida[] {
  const acciones: AccionRapida[] = []
  const tactil = esDispositivoTactil()
  const router = deps.router
  const nombreContacto = nombreCompleto(p.contacto_nombre, p.contacto_apellido, 'Cliente')
  const nombreAtencion = p.atencion_nombre || nombreCompleto(atencionVivo?.nombre, atencionVivo?.apellido, 'Dirigido a')

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

  // Teléfonos del "dirigido a" (si existe y es distinto del principal)
  const telefonosAtencion: TelefonoContacto[] = atencionVivo ? listarTelefonos(atencionVivo) : []
  telefonosAtencion.forEach((tel, i) => {
    const etiqTipo = etiquetaTelefono(tel.tipo)
    const sufijo = `${etiqTipo ? ` · ${etiqTipo}` : ''} · ${nombreAtencion}`
    acciones.push({
      clave: `llamar-atencion-${i}`,
      etiqueta: tactil ? 'Llamar' : 'Copiar número',
      descripcion: `${tel.valor}${sufijo}`,
      icono: tactil ? Phone : Copy,
      colorIcono: 'text-emerald-400/80',
      onEjecutar: () => ejecutarConFeedback(() => accionLlamar(tel.valor), deps.toast),
    })
  })

  // WhatsApp dual del contacto principal y del "dirigido a"
  const movilesPrincipal = telefonos.filter(esMovil)
  const movilesAtencion = telefonosAtencion.filter(esMovil)
  const accionWAPrincipal = accionWhatsAppDual({
    claveBase: 'principal',
    contactoId: p.contacto_id,
    numeroMovil: movilesPrincipal[0]?.valor || null,
    nombre: nombreContacto,
    deps,
  })
  if (accionWAPrincipal) acciones.push(accionWAPrincipal)
  const accionWAAtencion = accionWhatsAppDual({
    claveBase: 'atencion',
    contactoId: p.atencion_contacto_id,
    numeroMovil: movilesAtencion[0]?.valor || null,
    nombre: nombreAtencion,
    colorBase: 'text-green-400/80',
    deps,
  })
  if (accionWAAtencion) acciones.push(accionWAAtencion)

  // Correo dual del contacto principal y del "dirigido a"
  const correoContacto = contactoVivo?.correo || p.contacto_correo
  if (correoContacto) {
    acciones.push(
      accionCorreoDual({
        claveBase: 'principal',
        correo: correoContacto,
        nombre: nombreContacto,
        deps,
      }),
    )
  }
  const correoAtencion = atencionVivo?.correo || p.atencion_correo
  if (correoAtencion && correoAtencion !== correoContacto) {
    acciones.push(
      accionCorreoDual({
        claveBase: 'atencion',
        correo: correoAtencion,
        nombre: nombreAtencion,
        colorBase: 'text-sky-400/80',
        deps,
      }),
    )
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
  atencionVivo: RespuestaContacto | null,
  deps: Deps,
): AccionRapida[] {
  const acciones: AccionRapida[] = []
  const tactil = esDispositivoTactil()
  const router = deps.router
  const nombreContacto = o.contacto_nombre || 'Cliente'
  const nombreAtencion = o.atencion_nombre || nombreCompleto(atencionVivo?.nombre, atencionVivo?.apellido, 'Persona de contacto')

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

  // Teléfonos del "dirigido a" (si hay contacto vivo de atención con teléfonos)
  const telefonosAtencion: TelefonoContacto[] = atencionVivo
    ? listarTelefonos(atencionVivo)
    : o.atencion_telefono && o.atencion_telefono !== o.contacto_telefono
      ? [{ valor: o.atencion_telefono, tipo: null, es_principal: true }]
      : []
  telefonosAtencion.forEach((tel, i) => {
    const etiqTipo = etiquetaTelefono(tel.tipo)
    acciones.push({
      clave: `llamar-atencion-${i}`,
      etiqueta: tactil ? 'Llamar' : 'Copiar número',
      descripcion: `${tel.valor}${etiqTipo ? ` · ${etiqTipo}` : ''} · ${nombreAtencion}`,
      icono: tactil ? Phone : Copy,
      colorIcono: 'text-emerald-400/80',
      onEjecutar: () => ejecutarConFeedback(() => accionLlamar(tel.valor), deps.toast),
    })
  })

  // WhatsApp dual del contacto principal y del "dirigido a"
  const movilesOrden = telefonos.filter(esMovil)
  const movilesAtencionOrden = telefonosAtencion.filter(esMovil)
  const waPrincipal = accionWhatsAppDual({
    claveBase: 'principal',
    contactoId: o.contacto_id,
    numeroMovil: movilesOrden[0]?.valor || null,
    nombre: nombreContacto,
    deps,
  })
  if (waPrincipal) acciones.push(waPrincipal)
  const waAtencion = accionWhatsAppDual({
    claveBase: 'atencion',
    contactoId: o.atencion_contacto_id,
    numeroMovil: movilesAtencionOrden[0]?.valor || null,
    nombre: nombreAtencion,
    colorBase: 'text-green-400/80',
    deps,
  })
  if (waAtencion) acciones.push(waAtencion)

  // Correo dual del contacto principal y del "dirigido a"
  const correoContactoOrden = contactoVivo?.correo || o.contacto_correo
  if (correoContactoOrden) {
    acciones.push(
      accionCorreoDual({
        claveBase: 'principal',
        correo: correoContactoOrden,
        nombre: nombreContacto,
        deps,
      }),
    )
  }
  const correoAtencionOrden = atencionVivo?.correo || o.atencion_correo
  if (correoAtencionOrden && correoAtencionOrden !== correoContactoOrden) {
    acciones.push(
      accionCorreoDual({
        claveBase: 'atencion',
        correo: correoAtencionOrden,
        nombre: nombreAtencion,
        colorBase: 'text-sky-400/80',
        deps,
      }),
    )
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
  recibeVivo: RespuestaContacto | null,
  deps: Deps,
): AccionRapida[] {
  const acciones: AccionRapida[] = []
  const tactil = esDispositivoTactil()
  const router = deps.router
  const nombreContacto = v.contacto_nombre || 'Contacto'
  const nombreRecibe = v.recibe_nombre || nombreCompleto(recibeVivo?.nombre, recibeVivo?.apellido, 'Persona que recibe')

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

  // Teléfonos de quien recibe (preferimos contacto vivo; si no hay, snapshot de v.recibe_telefono)
  const telsContactoValores = telefonos.map((t) => t.valor)
  const telefonosRecibe: TelefonoContacto[] = recibeVivo
    ? listarTelefonos(recibeVivo)
    : v.recibe_telefono && !telsContactoValores.includes(v.recibe_telefono)
      ? [{ valor: v.recibe_telefono, tipo: null, es_principal: true }]
      : []
  telefonosRecibe.forEach((tel, i) => {
    const etiqTipo = etiquetaTelefono(tel.tipo)
    acciones.push({
      clave: `llamar-recibe-${i}`,
      etiqueta: tactil ? 'Llamar' : 'Copiar número',
      descripcion: `${tel.valor}${etiqTipo ? ` · ${etiqTipo}` : ''} · ${nombreRecibe}`,
      icono: tactil ? Phone : Copy,
      colorIcono: 'text-emerald-400/80',
      onEjecutar: () => ejecutarConFeedback(() => accionLlamar(tel.valor), deps.toast),
    })
  })

  // WhatsApp dual del contacto y de quien recibe
  const movilesContactoVisita = telefonos.filter(esMovil)
  const movilesRecibeVisita = telefonosRecibe.filter(esMovil)
  const waContacto = accionWhatsAppDual({
    claveBase: 'principal',
    contactoId: v.contacto_id,
    numeroMovil: movilesContactoVisita[0]?.valor || null,
    nombre: nombreContacto,
    deps,
  })
  if (waContacto) acciones.push(waContacto)
  const waRecibe = accionWhatsAppDual({
    claveBase: 'recibe',
    contactoId: v.recibe_contacto_id,
    numeroMovil: movilesRecibeVisita[0]?.valor || null,
    nombre: nombreRecibe,
    colorBase: 'text-green-400/80',
    deps,
  })
  if (waRecibe) acciones.push(waRecibe)

  // Correo dual del contacto y de quien recibe
  if (contactoVivo?.correo) {
    acciones.push(
      accionCorreoDual({
        claveBase: 'principal',
        correo: contactoVivo.correo,
        nombre: nombreContacto,
        deps,
      }),
    )
  }
  if (recibeVivo?.correo && recibeVivo.correo !== contactoVivo?.correo) {
    acciones.push(
      accionCorreoDual({
        claveBase: 'recibe',
        correo: recibeVivo.correo,
        nombre: nombreRecibe,
        colorBase: 'text-sky-400/80',
        deps,
      }),
    )
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

/**
 * Acciones rápidas para el detalle de un usuario (miembro del equipo).
 * Más acotadas que las de un contacto externo: solo llamar y correo —
 * no hay WhatsApp (canal de clientes), ni dirección (no aplica al equipo),
 * ni "Ir al contacto" (es la entidad raíz).
 *
 * Si el miembro tiene tanto correo personal como empresa, aparecen 2 cards.
 * Lo mismo con teléfonos.
 */
function construirAccionesUsuario(u: RespuestaUsuario, deps: Deps): AccionRapida[] {
  const acciones: AccionRapida[] = []
  const tactil = esDispositivoTactil()
  const nombre = nombreCompleto(u.nombre, u.apellido, 'Usuario')

  // Llamar — empresa primero (más relevante para contexto laboral) y luego personal
  if (u.telefono_empresa) {
    const tel = u.telefono_empresa
    acciones.push({
      clave: 'llamar-empresa',
      etiqueta: tactil ? 'Llamar' : 'Copiar número',
      descripcion: `${tel} · empresa · ${nombre}`,
      icono: tactil ? Phone : Copy,
      colorIcono: 'text-emerald-400',
      onEjecutar: () => ejecutarConFeedback(() => accionLlamar(tel), deps.toast),
    })
  }
  if (u.telefono && u.telefono !== u.telefono_empresa) {
    const tel = u.telefono
    acciones.push({
      clave: 'llamar-personal',
      etiqueta: tactil ? 'Llamar' : 'Copiar número',
      descripcion: `${tel} · personal · ${nombre}`,
      icono: tactil ? Phone : Copy,
      colorIcono: 'text-emerald-400/80',
      onEjecutar: () => ejecutarConFeedback(() => accionLlamar(tel), deps.toast),
    })
  }

  // Correo dual — empresa primero
  if (u.correo_empresa) {
    acciones.push(
      accionCorreoDual({
        claveBase: 'empresa',
        correo: u.correo_empresa,
        nombre: `${nombre} · empresa`,
        deps,
      }),
    )
  }
  if (u.correo && u.correo !== u.correo_empresa) {
    acciones.push(
      accionCorreoDual({
        claveBase: 'personal',
        correo: u.correo,
        nombre: `${nombre} · personal`,
        colorBase: 'text-sky-400/80',
        deps,
      }),
    )
  }

  return acciones
}
