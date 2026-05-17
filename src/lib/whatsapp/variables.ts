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

// ─── Constantes ───

/**
 * Cantidad de slots fijos en la plantilla `recibo_haberes_nomina` para los
 * adelantos/descuentos del período (`descuento_1`..`descuento_N`). Meta no
 * respeta `\n` dentro de un valor de variable, por eso los bullets se mandan
 * como N variables separadas. Si hay menos ítems, se rellena con SLOT_VACIO;
 * si hay más, los excedentes se concatenan en el último slot.
 */
// Slots para adelantos/descuentos puntuales (no del contrato). Bajado a 3
// para alinear con la plantilla `recibo_haberes_nomina` v2 — el slot 3
// concatena los excedentes con `·` si hay más de 3 adelantos en el período.
export const TOTAL_SLOTS_DESCUENTOS = 3

/** Slots para conceptos haber del contrato (Presentismo, Antigüedad, etc.). */
export const TOTAL_SLOTS_HABERES = 3

/** Slots para descuentos del contrato (Uniforme, Cuota sindical, etc.). */
export const TOTAL_SLOTS_DESCUENTOS_CONTRATO = 2

/** Slots para bonos one-off del período. */
export const TOTAL_SLOTS_BONOS = 2

/** Texto que ocupa los slots sobrantes cuando hay menos items que slots. */
export const SLOT_VACIO_DESCUENTO = '—'

/**
 * Expande una lista variable de bullets a exactamente `slots` posiciones:
 *  - Si hay menos: rellena con `SLOT_VACIO_DESCUENTO`.
 *  - Si hay más: el último slot concatena los excedentes con `  ·  `.
 *
 * Exportado para que los callers (backend de envío, preview del modal) usen
 * el mismo padding/concat que el resolver de variables.
 */
export function expandirSlotsDescuentos(lineas: string[], slots = TOTAL_SLOTS_DESCUENTOS): string[] {
  const limpias = lineas.map(l => String(l || '').trim()).filter(Boolean)
  const resultado: string[] = []
  if (limpias.length <= slots) {
    for (let i = 0; i < slots; i++) resultado.push(limpias[i] || SLOT_VACIO_DESCUENTO)
  } else {
    for (let i = 0; i < slots - 1; i++) resultado.push(limpias[i])
    const sobrantes = limpias.slice(slots - 1).join('  ·  ')
    resultado.push(sobrantes)
  }
  return resultado
}

// ─── Entidades aceptadas ───

export type EntidadPlantillaWA =
  | 'contacto'
  | 'visita'
  | 'presupuesto'
  | 'orden'
  | 'actividad'
  | 'nomina'

export interface EntidadesPlantilla {
  contacto?: Record<string, unknown> | null
  visita?: Record<string, unknown> | null
  presupuesto?: Record<string, unknown> | null
  orden?: Record<string, unknown> | null
  actividad?: Record<string, unknown> | null
  /**
   * Datos de nómina del período: combina el resultado de `/api/nominas`
   * con el detalle de adelantos/descuentos para resolver variables de recibos.
   * Estructura esperada:
   *   { ...resultado_nomina, periodo, detalle_descuentos: string }
   */
  nomina?: Record<string, unknown> | null
  empresa?: { nombre?: string | null; correo?: string | null; telefono?: string | null } | null
}

// ─── Catálogo de variables ───

export interface DefinicionVariable {
  valor: string
  etiqueta: string
  grupo: 'Contacto' | 'Visita' | 'Documento' | 'Orden' | 'Actividad' | 'Empresa' | 'Nómina'
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

  // Nómina (recibos de haberes — módulo asistencias)
  { valor: 'nombre_empleado', etiqueta: 'Nómina — Nombre del empleado', grupo: 'Nómina', entidad: 'nomina', ejemplo: 'José Luis Romero', modulos: ['asistencias'] },
  { valor: 'periodo', etiqueta: 'Nómina — Período (etiqueta)', grupo: 'Nómina', entidad: 'nomina', ejemplo: 'Quincena 16-30 Abril 2026', modulos: ['asistencias'] },
  { valor: 'dias_trabajados', etiqueta: 'Nómina — Días trabajados', grupo: 'Nómina', entidad: 'nomina', ejemplo: '9', modulos: ['asistencias'] },
  { valor: 'dias_laborales', etiqueta: 'Nómina — Días laborales del período', grupo: 'Nómina', entidad: 'nomina', ejemplo: '11', modulos: ['asistencias'] },
  { valor: 'dias_a_horario', etiqueta: 'Nómina — Días llegados a horario', grupo: 'Nómina', entidad: 'nomina', ejemplo: '6', modulos: ['asistencias'] },
  { valor: 'dias_tardanza', etiqueta: 'Nómina — Días con tardanza', grupo: 'Nómina', entidad: 'nomina', ejemplo: '3', modulos: ['asistencias'] },
  { valor: 'monto_bruto', etiqueta: 'Nómina — Monto bruto', grupo: 'Nómina', entidad: 'nomina', ejemplo: '$340.000', modulos: ['asistencias'] },
  { valor: 'monto_descuentos', etiqueta: 'Nómina — Total de descuentos', grupo: 'Nómina', entidad: 'nomina', ejemplo: '$156.229', modulos: ['asistencias'] },
  { valor: 'monto_neto', etiqueta: 'Nómina — Neto a transferir', grupo: 'Nómina', entidad: 'nomina', ejemplo: '$183.771', modulos: ['asistencias'] },
  // Detalle textual (multi-línea) — útil cuando la plantilla puede usar
  // `\n` (no es el caso de Meta, pero sí del preview interno o del correo).
  { valor: 'detalle_descuentos', etiqueta: 'Nómina — Detalle de adelantos y descuentos', grupo: 'Nómina', entidad: 'nomina', ejemplo: '• *−$30.229* · Adelanto compra ML · 29-abr\n• *−$50.000* · Retiro de cajero · 26-abr', modulos: ['asistencias'] },
  // Slots fijos para listar adelantos/descuentos como variables separadas en
  // plantillas WA. Necesario porque Meta no respeta `\n` dentro de un valor de
  // variable: cada bullet va a su propio slot y el `\n` queda en el cuerpo
  // aprobado. Si hay menos de 3 ítems se rellenan con "—"; si hay más, los
  // excedentes se concatenan en el último. Formato: monto-adelante-bold.
  { valor: 'descuento_1', etiqueta: 'Nómina — Descuento 1', grupo: 'Nómina', entidad: 'nomina', ejemplo: '• *−$18.000* · A favor del período anterior', modulos: ['asistencias'] },
  { valor: 'descuento_2', etiqueta: 'Nómina — Descuento 2', grupo: 'Nómina', entidad: 'nomina', ejemplo: '• *−$58.000* · Inyectores cuota 2/2 · 17-abr', modulos: ['asistencias'] },
  // El slot 3 muestra el tercer adelanto o concatena los excedentes
  // (4to en adelante) separados por `·` cuando hay más de 3 en el período.
  { valor: 'descuento_3', etiqueta: 'Nómina — Descuento 3 (o concat. excedentes)', grupo: 'Nómina', entidad: 'nomina', ejemplo: '• *−$50.000* · Retiro de cajero · 26-abr · *−$30.229* · Adelanto ML · 29-abr', modulos: ['asistencias'] },
  { valor: 'compensacion_detalle', etiqueta: 'Nómina — Detalle de compensación', grupo: 'Nómina', entidad: 'nomina', ejemplo: '$40.000 × 8.5 días', modulos: ['asistencias'] },
  // Link firmado al PDF del recibo (expira 30 días). El server lo arma
  // desde `pagos_nomina.comprobante_url` cuando hay pago grabado; si no
  // hay pago aún, queda string vacío.
  { valor: 'enlace_recibo', etiqueta: 'Nómina — Enlace al recibo (PDF)', grupo: 'Nómina', entidad: 'nomina', ejemplo: 'https://flux.salixweb.com/r/abc123', modulos: ['asistencias'] },

  // ─── Conceptos HABER del contrato (Presentismo, Antigüedad, etc.) ───
  // Slots fijos — cada empresa nombra sus conceptos distinto, así que
  // exponemos slots genéricos en lugar de variables hardcoded. Mismo
  // patrón que `descuento_*`: los excedentes se concatenan al último.
  // Formato: monto-adelante-bold (`• *+$X* · Nombre`).
  { valor: 'haber_1', etiqueta: 'Nómina — Haber 1 (Presentismo, etc.)', grupo: 'Nómina', entidad: 'nomina', ejemplo: '• *+$15.200* · Presentismo (10/11 días)', modulos: ['asistencias'] },
  { valor: 'haber_2', etiqueta: 'Nómina — Haber 2 (Antigüedad, etc.)', grupo: 'Nómina', entidad: 'nomina', ejemplo: '• *+$12.000* · Antigüedad (3 años)', modulos: ['asistencias'] },
  { valor: 'haber_3', etiqueta: 'Nómina — Haber 3 (Adicional zona, etc.)', grupo: 'Nómina', entidad: 'nomina', ejemplo: '• *+$8.000* · Adicional zona', modulos: ['asistencias'] },
  { valor: 'total_haberes_extra', etiqueta: 'Nómina — Total haberes del contrato (suma)', grupo: 'Nómina', entidad: 'nomina', ejemplo: '$35.200', modulos: ['asistencias'] },
  { valor: 'detalle_haberes', etiqueta: 'Nómina — Detalle haberes (texto unificado)', grupo: 'Nómina', entidad: 'nomina', ejemplo: '• *+$15.200* · Presentismo\n• *+$12.000* · Antigüedad', modulos: ['asistencias'] },

  // ─── Descuentos del CONTRATO (Uniforme, Cuota sindical) ───
  // Distintos a los `descuento_*` que son adelantos puntuales del período.
  // Estos son recurrentes y los aplica el motor automáticamente.
  { valor: 'descuento_contrato_1', etiqueta: 'Nómina — Descuento contrato 1 (Uniforme, etc.)', grupo: 'Nómina', entidad: 'nomina', ejemplo: '• *−$8.500* · Uniforme cuota 2/3', modulos: ['asistencias'] },
  { valor: 'descuento_contrato_2', etiqueta: 'Nómina — Descuento contrato 2 (Cuota sindical, etc.)', grupo: 'Nómina', entidad: 'nomina', ejemplo: '• *−$3.500* · Cuota sindical', modulos: ['asistencias'] },
  { valor: 'total_descuentos_contrato', etiqueta: 'Nómina — Total descuentos del contrato (suma)', grupo: 'Nómina', entidad: 'nomina', ejemplo: '$12.000', modulos: ['asistencias'] },

  // ─── Bonos one-off del período (Bono producción, etc.) ───
  // Suman al neto. Los configura el operador desde adelantos_nomina
  // con tipo='bono'. Pueden ser 0, 1, 2+; los excedentes al último slot.
  { valor: 'bono_1', etiqueta: 'Nómina — Bono 1 (producción, etc.)', grupo: 'Nómina', entidad: 'nomina', ejemplo: '• *+$25.000* · Bono producción · 30-abr', modulos: ['asistencias'] },
  { valor: 'bono_2', etiqueta: 'Nómina — Bono 2 (extra, etc.)', grupo: 'Nómina', entidad: 'nomina', ejemplo: '• *+$10.000* · Bono fin de mes · 30-abr', modulos: ['asistencias'] },
  { valor: 'total_bonos_periodo', etiqueta: 'Nómina — Total bonos del período (suma)', grupo: 'Nómina', entidad: 'nomina', ejemplo: '$35.000', modulos: ['asistencias'] },
  { valor: 'detalle_bonos', etiqueta: 'Nómina — Detalle bonos (texto unificado)', grupo: 'Nómina', entidad: 'nomina', ejemplo: '• *+$25.000* · Bono producción · 30-abr', modulos: ['asistencias'] },

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

/** Formato de moneda compacto sin decimales — para recibos de nómina (ARS). */
function formatoMontoEntero(valor: unknown, locale = 'es-AR'): string {
  if (valor == null || valor === '') return ''
  const num = Number(valor)
  if (isNaN(num)) return String(valor)
  return `$${num.toLocaleString(locale, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
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
  const { contacto, visita, presupuesto, orden, actividad, nomina, empresa } = entidades
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

  // Nómina (recibo de haberes).
  // A diferencia de las otras entidades, asignamos las variables de forma
  // directa (no vía `set`) para que valores vacíos/cero sobrescriban los
  // ejemplos del catálogo. Si no, el preview de un empleado sin datos
  // mostraría el ejemplo hardcodeado y confundiría al usuario.
  if (nomina) {
    const nombre = String(nomina.nombre || '').trim()
    if (nombre) datos['nombre_empleado'] = nombre

    if (nomina.periodo) datos['periodo'] = String(nomina.periodo)

    const diasTrabajados = Number(nomina.dias_trabajados || 0)
    const diasLaborales = Number(nomina.dias_laborales || 0)
    const diasTardanza = Number(nomina.dias_tardanza || 0)
    datos['dias_trabajados'] = String(diasTrabajados)
    datos['dias_laborales'] = String(diasLaborales)
    datos['dias_a_horario'] = String(Math.max(0, diasTrabajados - diasTardanza))
    datos['dias_tardanza'] = String(diasTardanza)

    datos['monto_bruto'] = formatoMontoEntero(nomina.monto_pagar || 0)
    datos['monto_neto'] = formatoMontoEntero(nomina.monto_neto ?? nomina.monto_pagar ?? 0)
    const totalDescuentos = Number(nomina.descuento_adelanto || 0) + Math.max(0, Number(nomina.saldo_anterior || 0))
    datos['monto_descuentos'] = formatoMontoEntero(totalDescuentos)

    // Detalle: si no hay descuentos en el período, mensaje explícito en cursiva
    // (formato WA: _texto_) para no caer al ejemplo del catálogo.
    const detalle = String(nomina.detalle_descuentos || '').trim()
    datos['detalle_descuentos'] = detalle || '_Sin adelantos ni descuentos en el período._'

    // Slots fijos descuento_1..descuento_6: cada bullet en su propia variable
    // (Meta no respeta `\n` dentro del valor de un parámetro). Aceptamos un
    // array `descuentos_lista`; si no llega, lo derivamos partiendo `detalle`.
    const slots = TOTAL_SLOTS_DESCUENTOS
    const lista = Array.isArray(nomina.descuentos_lista)
      ? (nomina.descuentos_lista as unknown[]).map(v => String(v || '').trim()).filter(Boolean)
      : detalle.split('\n').map(s => s.trim()).filter(Boolean)
    const slotsValores = expandirSlotsDescuentos(lista, slots)
    for (let i = 0; i < slots; i++) {
      datos[`descuento_${i + 1}`] = slotsValores[i]
    }

    if (nomina.monto_detalle) datos['compensacion_detalle'] = String(nomina.monto_detalle)

    // Link firmado al PDF del recibo. Si el productor no lo manda,
    // queda string vacío en lugar del ejemplo del catálogo — así
    // queda explícito en el preview que todavía no se generó el PDF
    // (típicamente porque no hay pago grabado del período).
    datos['enlace_recibo'] = String(nomina.enlace_recibo || '')

    // ─── Conceptos del CONTRATO: HABERES y DESCUENTOS ───
    // `conceptos_aplicados` viene del motor: [{tipo, nombre, monto, detalle}].
    // Lo partimos por tipo y armamos las líneas tipo bullet, después las
    // distribuimos en slots fijos `haber_1..3` y `descuento_contrato_1..2`.
    // Si la empresa no tiene conceptos de contrato, los slots quedan en '—'.
    const conceptos = Array.isArray(nomina.conceptos_aplicados)
      ? (nomina.conceptos_aplicados as Array<{ tipo: string; nombre: string; monto: number; detalle?: string | null }>)
      : []
    const haberes = conceptos.filter(c => c.tipo === 'haber')
    const descuentosContrato = conceptos.filter(c => c.tipo === 'descuento')

    // Formato monto-adelante-bold (mismo que `construirLineasAjustes`):
    //   • *+$X* · Nombre (detalle)
    // El bold de WhatsApp se aplica con asteriscos.
    const lineasHaberes = haberes.map(h => {
      const det = h.detalle ? ` (${h.detalle})` : ''
      return `• *+${formatoMontoEntero(h.monto)}* · ${h.nombre}${det}`
    })
    const slotsHaberes = expandirSlotsDescuentos(lineasHaberes, TOTAL_SLOTS_HABERES)
    for (let i = 0; i < TOTAL_SLOTS_HABERES; i++) {
      datos[`haber_${i + 1}`] = slotsHaberes[i]
    }
    datos['detalle_haberes'] = lineasHaberes.join('\n') || '_Sin haberes extra del contrato._'
    datos['total_haberes_extra'] = formatoMontoEntero(
      Number(nomina.total_haberes ?? haberes.reduce((s, h) => s + Number(h.monto || 0), 0))
    )

    const lineasDescContrato = descuentosContrato.map(d => {
      const det = d.detalle ? ` (${d.detalle})` : ''
      return `• *−${formatoMontoEntero(d.monto)}* · ${d.nombre}${det}`
    })
    const slotsDescContrato = expandirSlotsDescuentos(lineasDescContrato, TOTAL_SLOTS_DESCUENTOS_CONTRATO)
    for (let i = 0; i < TOTAL_SLOTS_DESCUENTOS_CONTRATO; i++) {
      datos[`descuento_contrato_${i + 1}`] = slotsDescContrato[i]
    }
    datos['total_descuentos_contrato'] = formatoMontoEntero(
      Number(nomina.total_descuentos_conceptos ?? descuentosContrato.reduce((s, d) => s + Number(d.monto || 0), 0))
    )

    // ─── Bonos one-off del período ───
    // `bonos_lista` viene como string[] desde `construirLineasAjustes`
    // (helper compartido). Si no llega, usamos string vacío en todos los slots.
    const bonos = Array.isArray(nomina.bonos_lista)
      ? (nomina.bonos_lista as unknown[]).map(v => String(v || '').trim()).filter(Boolean)
      : []
    const slotsBonos = expandirSlotsDescuentos(bonos, TOTAL_SLOTS_BONOS)
    for (let i = 0; i < TOTAL_SLOTS_BONOS; i++) {
      datos[`bono_${i + 1}`] = slotsBonos[i]
    }
    datos['detalle_bonos'] = bonos.join('\n') || '_Sin bonos extra en el período._'
    datos['total_bonos_periodo'] = formatoMontoEntero(Number(nomina.bonos_periodo || 0))
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
    return { type: 'text' as const, text: sanearParametroPlantilla(valor) }
  })
}

/**
 * Limpia un valor para que sea válido como parámetro `{{N}}` en una plantilla
 * de Meta. Meta rechaza con error 132018 cualquier parámetro que contenga
 * saltos de línea, tabs o más de 4 espacios consecutivos.
 *
 * Reemplazos:
 *   - \r\n / \n / \r → " · " (separador visible para listas multilínea)
 *   - \t              → espacio
 *   - 5+ espacios     → 1 espacio
 *
 * El texto que se guarda en `mensajes.texto` (copia visual en la bandeja)
 * resuelve la plantilla con la versión original multilínea — esta función
 * aplica solo al payload que va a la API de Meta.
 */
export function sanearParametroPlantilla(valor: string): string {
  if (!valor) return valor
  return valor
    .replace(/\r\n|\n|\r/g, ' · ')
    .replace(/\t/g, ' ')
    .replace(/ {5,}/g, ' ')
}
