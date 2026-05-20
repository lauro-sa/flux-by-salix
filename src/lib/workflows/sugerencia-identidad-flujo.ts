/**
 * sugerirIdentidadFlujo — recomienda un { icono, color } a partir del
 * nombre del flujo que el usuario va escribiendo en el modal "Desde
 * cero". Heurística simple por palabras clave (sin AI ni LLM), igual
 * que el patrón de auto-iconos de tipos de actividad.
 *
 * Reglas:
 *   • match case-insensitive sobre el nombre normalizado (sin tildes).
 *   • el primer match de la tabla gana — ordenar de más específico
 *     a más genérico.
 *   • si no hay match, default = { icono: 'Workflow', color: 'violeta' }.
 *
 * Si el usuario cambia ícono o color a mano, el componente que llama
 * a esta función debe respetar la elección (dirty flag) — esta lib
 * no tiene state, solo sugiere.
 */

// Los colores son hex de la `PALETA_COLORES_TIPO_ACTIVIDAD` para que
// el preset que sugerimos coincida 1-a-1 con una bolita seleccionada
// del selector (sin "verde aproximado" — el aro se posiciona exacto).
const REGLAS: ReadonlyArray<{
  patrones: ReadonlyArray<RegExp>
  icono: string
  color: string
}> = [
  // Comunicación — correo
  {
    patrones: [/\bcorreo\b/, /\bemail\b/, /\bmail\b/, /\bgmail\b/, /\binbox\b/, /\brespuesta\b/, /\bresponder\b/],
    icono: 'Mail',
    color: '#8e4ec6',
  },
  // Comunicación — WhatsApp
  {
    patrones: [/\bwhatsapp\b/, /\bwa\b/, /\bmensaje\b/, /\bmensajes\b/, /\bchat\b/],
    icono: 'MessageCircle',
    color: '#46a758',
  },
  // Notificaciones / alertas
  {
    patrones: [/\bnotific/, /\balerta\b/, /\baviso\b/, /\brecordatorio\b/, /\brecordar\b/],
    icono: 'Bell',
    color: '#f5a623',
  },
  // Visitas
  {
    patrones: [/\bvisita\b/, /\bvisitas\b/],
    icono: 'MapPin',
    color: '#7c93c4',
  },
  // Asistencias / fichaje
  {
    patrones: [/\basistencia\b/, /\bfichaje\b/, /\bjornada\b/],
    icono: 'Calendar',
    color: '#f5a623',
  },
  // Cobranzas / cuotas / pagos
  {
    patrones: [/\bcuota\b/, /\bcuotas\b/, /\bcobranza\b/, /\bcobrar\b/, /\bpago\b/, /\bpagos\b/, /\bdeuda\b/],
    icono: 'DollarSign',
    color: '#46a758',
  },
  // Presupuestos
  {
    patrones: [/\bpresupuesto\b/, /\bcotizaci/, /\boferta\b/],
    icono: 'FileText',
    color: '#3b82f6',
  },
  // Órdenes de trabajo
  {
    patrones: [/\borden\b/, /\bordenes\b/, /\bot\b/, /\btrabajo\b/],
    icono: 'Wrench',
    color: '#5b5bd6',
  },
  // Actividades / tareas
  {
    patrones: [/\bactividad\b/, /\bactividades\b/, /\btarea\b/, /\btareas\b/, /\bseguimiento\b/],
    icono: 'CheckCircle',
    color: '#5b5bd6',
  },
  // Nómina
  {
    patrones: [/\bnomina\b/, /\bsalario\b/, /\bsueldo\b/, /\badelanto\b/],
    icono: 'Wallet',
    color: '#f5a623',
  },
  // Etiquetas / clasificación
  {
    patrones: [/\betiqueta\b/, /\betiquetas\b/, /\bclasificar\b/],
    icono: 'Tag',
    color: '#ec4899',
  },
  // Tiempo / scheduler
  {
    patrones: [/\bdiari/, /\bsemanal/, /\bmensual/, /\bautomatic/, /\bprogramad/],
    icono: 'Clock',
    color: '#3b82f6',
  },
  // Contactos
  {
    patrones: [/\bcontacto\b/, /\bcontactos\b/, /\bcliente\b/, /\bclientes\b/],
    icono: 'Users',
    color: '#7c93c4',
  },
]

// Default = Índigo (color de marca de Flux) + ícono genérico de módulo.
const DEFAULT_IDENTIDAD = { icono: 'Workflow', color: '#5b5bd6' } as const

export interface IdentidadSugerida {
  icono: string
  color: string
}

/**
 * Devuelve la sugerencia para el nombre. Siempre retorna algo (default
 * si no hubo match), nunca null — así el componente puede asignarlo
 * directo sin manejar el caso vacío.
 */
export function sugerirIdentidadFlujo(nombre: string): IdentidadSugerida {
  const limpio = nombre
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim()

  if (!limpio) return { ...DEFAULT_IDENTIDAD }

  for (const regla of REGLAS) {
    if (regla.patrones.some((p) => p.test(limpio))) {
      return { icono: regla.icono, color: regla.color }
    }
  }

  return { ...DEFAULT_IDENTIDAD }
}
