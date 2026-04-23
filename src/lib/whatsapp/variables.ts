/**
 * Catálogo único de variables disponibles en plantillas de WhatsApp.
 *
 * Todos los lugares que resuelven {{1}}..{{N}} en plantillas deben usar este módulo:
 *  - Editor (vista previa con datos reales)
 *  - Chatter de documentos (envío con contacto + presupuesto/orden/visita/actividad)
 *  - ModalConfirmarVisita, PanelWhatsApp, ModalNuevoWhatsApp
 *
 * Así cualquier variable mapeada en el editor se resuelve de la misma forma en
 * todos los contextos de envío. Agregar una variable nueva implica: sumarla al
 * catálogo + extraer el valor en `construirDatosPlantilla`.
 */

import type { CuerpoPlantillaWA } from '@/tipos/whatsapp'

// ─── Entidades aceptadas ───

export type EntidadPlantillaWA =
  | 'contacto'
  | 'visita'
  | 'presupuesto'
  | 'orden'
  | 'actividad'

export interface EntidadesPlantilla {
  contacto?: Record<string, unknown> | null
  visita?: Record<string, unknown> | null
  presupuesto?: Record<string, unknown> | null
  orden?: Record<string, unknown> | null
  actividad?: Record<string, unknown> | null
  empresa?: { nombre?: string | null; correo?: string | null; telefono?: string | null } | null
}

// ─── Catálogo de variables ───

export interface DefinicionVariable {
  valor: string
  etiqueta: string
  grupo: 'Contacto' | 'Visita' | 'Documento' | 'Orden' | 'Actividad' | 'Empresa'
  entidad: EntidadPlantillaWA | 'empresa'
  ejemplo: string
  modulos?: string[]
}

export const CATALOGO_VARIABLES: DefinicionVariable[] = [
  // Contacto
  { valor: 'contacto_nombre', etiqueta: 'Contacto — Nombre completo', grupo: 'Contacto', entidad: 'contacto', ejemplo: 'Juan García' },
  { valor: 'contacto_primer_nombre', etiqueta: 'Contacto — Primer nombre', grupo: 'Contacto', entidad: 'contacto', ejemplo: 'Juan' },
  { valor: 'contacto_apellido', etiqueta: 'Contacto — Apellido', grupo: 'Contacto', entidad: 'contacto', ejemplo: 'García' },
  { valor: 'contacto_telefono', etiqueta: 'Contacto — Teléfono', grupo: 'Contacto', entidad: 'contacto', ejemplo: '+54 11 1234-5678' },
  { valor: 'contacto_whatsapp', etiqueta: 'Contacto — WhatsApp', grupo: 'Contacto', entidad: 'contacto', ejemplo: '+54 9 11 1234-5678' },
  { valor: 'contacto_correo', etiqueta: 'Contacto — Correo', grupo: 'Contacto', entidad: 'contacto', ejemplo: 'juan@ejemplo.com' },
  { valor: 'contacto_direccion', etiqueta: 'Contacto — Dirección principal', grupo: 'Contacto', entidad: 'contacto', ejemplo: 'Av. Corrientes 1234, CABA' },
  { valor: 'contacto_codigo', etiqueta: 'Contacto — Código', grupo: 'Contacto', entidad: 'contacto', ejemplo: 'C-00042' },

  // Visita
  { valor: 'visita_fecha', etiqueta: 'Visita — Fecha (día de la semana)', grupo: 'Visita', entidad: 'visita', ejemplo: 'martes 27 de abril', modulos: ['visitas', 'recorrido'] },
  { valor: 'visita_fecha_corta', etiqueta: 'Visita — Fecha corta (dd/mm)', grupo: 'Visita', entidad: 'visita', ejemplo: '27/04/2026', modulos: ['visitas', 'recorrido'] },
  { valor: 'visita_horario', etiqueta: 'Visita — Horario', grupo: 'Visita', entidad: 'visita', ejemplo: '11:00', modulos: ['visitas', 'recorrido'] },
  { valor: 'visita_direccion', etiqueta: 'Visita — Dirección', grupo: 'Visita', entidad: 'visita', ejemplo: 'Juncal 1724, Lanús Este', modulos: ['visitas', 'recorrido'] },
  { valor: 'visita_asignado', etiqueta: 'Visita — Asignado', grupo: 'Visita', entidad: 'visita', ejemplo: 'Carlos Pérez', modulos: ['visitas', 'recorrido'] },
  { valor: 'visita_motivo', etiqueta: 'Visita — Motivo', grupo: 'Visita', entidad: 'visita', ejemplo: 'Revisión técnica', modulos: ['visitas', 'recorrido'] },
  { valor: 'visita_duracion_min', etiqueta: 'Visita — Duración estimada (min)', grupo: 'Visita', entidad: 'visita', ejemplo: '30', modulos: ['visitas', 'recorrido'] },
  { valor: 'visita_eta', etiqueta: 'Visita — Tiempo estimado de llegada', grupo: 'Visita', entidad: 'visita', ejemplo: 'dentro de los próximos 25 minutos aproximadamente', modulos: ['recorrido'] },

  // Documento (presupuesto — compat hacia atrás con las claves originales)
  { valor: 'documento_numero', etiqueta: 'Documento — Número', grupo: 'Documento', entidad: 'presupuesto', ejemplo: 'PRE-00042', modulos: ['presupuestos'] },
  { valor: 'documento_total', etiqueta: 'Documento — Total', grupo: 'Documento', entidad: 'presupuesto', ejemplo: '$ 150.000,00', modulos: ['presupuestos'] },
  { valor: 'documento_fecha', etiqueta: 'Documento — Fecha de emisión', grupo: 'Documento', entidad: 'presupuesto', ejemplo: '05/04/2026', modulos: ['presupuestos'] },
  { valor: 'documento_fecha_vencimiento', etiqueta: 'Documento — Fecha de vencimiento', grupo: 'Documento', entidad: 'presupuesto', ejemplo: '20/04/2026', modulos: ['presupuestos'] },
  { valor: 'documento_moneda', etiqueta: 'Documento — Moneda', grupo: 'Documento', entidad: 'presupuesto', ejemplo: 'ARS', modulos: ['presupuestos'] },
  { valor: 'documento_estado', etiqueta: 'Documento — Estado', grupo: 'Documento', entidad: 'presupuesto', ejemplo: 'Enviado', modulos: ['presupuestos'] },

  // Orden
  { valor: 'orden_numero', etiqueta: 'Orden — Número', grupo: 'Orden', entidad: 'orden', ejemplo: 'OT-00015', modulos: ['ordenes'] },
  { valor: 'orden_titulo', etiqueta: 'Orden — Título', grupo: 'Orden', entidad: 'orden', ejemplo: 'Instalación de equipo', modulos: ['ordenes'] },
  { valor: 'orden_fecha_inicio', etiqueta: 'Orden — Fecha de inicio', grupo: 'Orden', entidad: 'orden', ejemplo: '10/04/2026', modulos: ['ordenes'] },
  { valor: 'orden_fecha_fin', etiqueta: 'Orden — Fecha fin estimada', grupo: 'Orden', entidad: 'orden', ejemplo: '15/04/2026', modulos: ['ordenes'] },
  { valor: 'orden_estado', etiqueta: 'Orden — Estado', grupo: 'Orden', entidad: 'orden', ejemplo: 'En curso', modulos: ['ordenes'] },

  // Actividad
  { valor: 'actividad_titulo', etiqueta: 'Actividad — Título', grupo: 'Actividad', entidad: 'actividad', ejemplo: 'Llamar al cliente', modulos: ['actividades'] },
  { valor: 'actividad_vencimiento', etiqueta: 'Actividad — Vencimiento', grupo: 'Actividad', entidad: 'actividad', ejemplo: '22/04/2026', modulos: ['actividades'] },
  { valor: 'actividad_estado', etiqueta: 'Actividad — Estado', grupo: 'Actividad', entidad: 'actividad', ejemplo: 'Pendiente', modulos: ['actividades'] },

  // Empresa (siempre disponible)
  { valor: 'empresa_nombre', etiqueta: 'Empresa — Nombre', grupo: 'Empresa', entidad: 'empresa', ejemplo: 'Mi Empresa S.A.' },
  { valor: 'empresa_correo', etiqueta: 'Empresa — Correo', grupo: 'Empresa', entidad: 'empresa', ejemplo: 'info@miempresa.com' },
  { valor: 'empresa_telefono', etiqueta: 'Empresa — Teléfono', grupo: 'Empresa', entidad: 'empresa', ejemplo: '+54 11 5050-1234' },
]

/** Mapa valor → definición para búsquedas rápidas. */
export const VARIABLES_POR_VALOR: Record<string, DefinicionVariable> = Object.fromEntries(
  CATALOGO_VARIABLES.map(v => [v.valor, v])
)

/** Ejemplo por campo (fallback cuando no hay dato real ni el usuario llenó el ejemplo). */
export const EJEMPLOS_POR_CAMPO: Record<string, string> = Object.fromEntries(
  CATALOGO_VARIABLES.map(v => [v.valor, v.ejemplo])
)

/**
 * Opciones para el selector de mapeo del editor.
 * Si se pasan `modulos`, filtra sólo variables relevantes a esos módulos
 * (variables sin `modulos` — contacto/empresa — siempre aparecen).
 */
export function opcionesMapeoVariables(modulos?: string[]): { valor: string; etiqueta: string }[] {
  const filtradas = !modulos || modulos.length === 0
    ? CATALOGO_VARIABLES
    : CATALOGO_VARIABLES.filter(v => !v.modulos || v.modulos.some(m => modulos.includes(m)))
  return [
    { valor: '', etiqueta: 'Sin asignar' },
    ...filtradas.map(v => ({ valor: v.valor, etiqueta: v.etiqueta })),
  ]
}

// ─── Formateadores ───

function formatoMoneda(valor: unknown, moneda?: string, locale = 'es-AR'): string {
  if (valor == null || valor === '') return ''
  const num = Number(valor)
  if (isNaN(num)) return String(valor)
  const simbolo = moneda === 'USD' ? 'US$' : moneda === 'EUR' ? '€' : '$'
  return `${simbolo} ${num.toLocaleString(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function formatoFechaCorta(valor: unknown, locale = 'es-AR'): string {
  if (!valor) return ''
  const d = new Date(String(valor))
  if (isNaN(d.getTime())) return String(valor)
  return d.toLocaleDateString(locale, { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function formatoFechaLarga(valor: unknown, locale = 'es-AR'): string {
  if (!valor) return ''
  const d = new Date(String(valor))
  if (isNaN(d.getTime())) return String(valor)
  return d.toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'long' })
}

function formatoHora(valor: unknown, locale = 'es-AR'): string {
  if (!valor) return ''
  const d = new Date(String(valor))
  if (isNaN(d.getTime())) return String(valor)
  return d.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit', hour12: false })
}

function primeraDireccion(contacto: Record<string, unknown> | null | undefined): string {
  if (!contacto) return ''
  const dirs = contacto.direcciones as Array<Record<string, unknown>> | undefined
  if (Array.isArray(dirs) && dirs.length > 0) {
    const d = dirs[0]
    return String(d.texto || d.direccion_texto || d.calle_altura || d.calle || '')
  }
  return String(contacto.direccion || contacto.direccion_texto || '')
}

// ─── Construcción de datos reales ───

/**
 * Construye el diccionario completo de valores reales listos para reemplazar
 * variables `{{N}}` en plantillas. Las entradas faltantes se devuelven como
 * string vacío — el caller decide si usar el "ejemplo para Meta" como fallback.
 */
export function construirDatosPlantilla(
  entidades: EntidadesPlantilla,
  locale = 'es-AR',
): Record<string, string> {
  const { contacto, visita, presupuesto, orden, actividad, empresa } = entidades
  const datos: Record<string, string> = {}

  // Helper: sólo asigna la clave si el valor no es vacío — así los ejemplos del
  // usuario / fallbacks del catálogo no quedan sobrescritos por strings vacíos.
  const set = (k: string, v: string | number | null | undefined) => {
    if (v === null || v === undefined) return
    const s = String(v).trim()
    if (s) datos[k] = s
  }

  // Contacto
  if (contacto) {
    const nombre = String(contacto.nombre || '').trim()
    const apellido = String(contacto.apellido || '').trim()
    const nombreCompleto = `${nombre} ${apellido}`.trim() || String(contacto.empresa_nombre || '')
    set('contacto_nombre', nombreCompleto)
    set('contacto_primer_nombre', nombre)
    set('contacto_apellido', apellido)
    set('contacto_telefono', contacto.telefono as string)
    set('contacto_whatsapp', (contacto.whatsapp || contacto.telefono) as string)
    set('contacto_correo', (contacto.correo || contacto.email) as string)
    set('contacto_direccion', primeraDireccion(contacto))
    set('contacto_codigo', contacto.codigo as string)
  }

  // Visita
  if (visita) {
    set('visita_fecha', formatoFechaLarga(visita.fecha_programada, locale))
    set('visita_fecha_corta', formatoFechaCorta(visita.fecha_programada, locale))
    set('visita_horario', formatoHora(visita.fecha_programada, locale))
    set('visita_direccion', visita.direccion_texto as string)
    set('visita_asignado', visita.asignado_nombre as string)
    set('visita_motivo', visita.motivo as string)
    set('visita_duracion_min', visita.duracion_estimada_min as number)
  }

  // Fallback: si hay contacto pero no visita (caso típico del preview del editor),
  // resolvemos `visita_direccion` con la dirección principal del contacto para que
  // el WYSIWYG muestre un valor real en vez del ejemplo hardcodeado.
  if (contacto && !visita && !datos['visita_direccion']) {
    set('visita_direccion', primeraDireccion(contacto))
  }

  // Presupuesto / Documento
  if (presupuesto) {
    set('documento_numero', presupuesto.numero as string)
    set('documento_total', formatoMoneda(presupuesto.total_final, String(presupuesto.moneda || ''), locale))
    set('documento_fecha', formatoFechaCorta(presupuesto.fecha_emision, locale))
    set('documento_fecha_vencimiento', formatoFechaCorta(presupuesto.fecha_vencimiento, locale))
    set('documento_moneda', presupuesto.moneda as string)
    set('documento_estado', presupuesto.estado as string)
  }

  // Orden
  if (orden) {
    set('orden_numero', orden.numero as string)
    set('orden_titulo', orden.titulo as string)
    set('orden_fecha_inicio', formatoFechaCorta(orden.fecha_inicio, locale))
    set('orden_fecha_fin', formatoFechaCorta(orden.fecha_fin_estimada, locale))
    set('orden_estado', orden.estado as string)
  }

  // Actividad
  if (actividad) {
    set('actividad_titulo', actividad.titulo as string)
    set('actividad_vencimiento', formatoFechaCorta(actividad.fecha_vencimiento, locale))
    set('actividad_estado', (actividad.estado_clave || actividad.estado) as string)
  }

  // Empresa
  if (empresa) {
    set('empresa_nombre', empresa.nombre)
    set('empresa_correo', empresa.correo)
    set('empresa_telefono', empresa.telefono)
  }

  return datos
}

// ─── Resolución de {{N}} ───

/**
 * Reemplaza cada `{{N}}` en `texto` usando el mapeo de la plantilla.
 * Orden de preferencia: valor real → ejemplo del usuario → placeholder `{{N}}`.
 */
export function resolverTextoPlantilla(
  texto: string,
  cuerpo: CuerpoPlantillaWA | undefined,
  datos: Record<string, string>,
): string {
  const mapeo = cuerpo?.mapeo_variables || []
  const ejemplos = cuerpo?.ejemplos || []
  return texto.replace(/\{\{(\d+)\}\}/g, (match, n) => {
    const idx = parseInt(n) - 1
    const clave = mapeo[idx]
    if (clave && datos[clave]) return datos[clave]
    if (ejemplos[idx]) return ejemplos[idx]
    return match
  })
}

/**
 * Construye el array `parameters` esperado por Meta API para el cuerpo
 * de la plantilla: un elemento por cada `{{N}}` detectada, en orden.
 * Devuelve `null` si el cuerpo no tiene variables.
 */
export function resolverParametrosCuerpo(
  cuerpo: CuerpoPlantillaWA | undefined,
  datos: Record<string, string>,
): { type: 'text'; text: string }[] | null {
  const texto = cuerpo?.texto || ''
  const matches = texto.match(/\{\{(\d+)\}\}/g)
  if (!matches || matches.length === 0) return null

  const mapeo = cuerpo?.mapeo_variables || []
  const ejemplos = cuerpo?.ejemplos || []
  const total = Math.max(...matches.map(m => parseInt(m.replace(/[{}]/g, ''))))

  return Array.from({ length: total }, (_, idx) => {
    const clave = mapeo[idx]
    const valor = (clave && datos[clave]) || ejemplos[idx] || ''
    return { type: 'text' as const, text: valor }
  })
}
