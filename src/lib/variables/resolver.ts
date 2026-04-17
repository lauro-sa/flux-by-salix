/**
 * Resolver de variables — reemplaza {{entidad.campo}} por valores reales.
 * Soporta campos directos, calculados y formateo automático por tipo de dato.
 *
 * Uso:
 *   resolverVariables('Hola {{contacto.nombre}}', { contacto: { nombre: 'Juan' } })
 *   // → 'Hola Juan'
 */

import type { ContextoVariables, DefinicionVariable, VariableResuelta } from './tipos'
import { obtenerEntidad } from './registro'

// Regex para encontrar variables: {{entidad.campo}}
const REGEX_VARIABLE = /\{\{([a-z_]+)\.([a-z_]+)\}\}/g

/**
 * Formatea un valor crudo según el tipo de dato de la variable.
 */
function formatearValor(valor: unknown, definicion?: DefinicionVariable, moneda?: string, locale = 'es-AR'): string {
  if (valor === null || valor === undefined || valor === '') return ''

  if (!definicion) return String(valor)

  switch (definicion.tipo_dato) {
    case 'moneda': {
      const num = typeof valor === 'number' ? valor : parseFloat(String(valor))
      if (isNaN(num)) return String(valor)
      const codigoMoneda = moneda || 'ARS'
      return new Intl.NumberFormat(locale, {
        style: 'currency',
        currency: codigoMoneda,
        minimumFractionDigits: 2,
      }).format(num)
    }

    case 'numero': {
      const num = typeof valor === 'number' ? valor : parseFloat(String(valor))
      if (isNaN(num)) return String(valor)
      return new Intl.NumberFormat(locale).format(num)
    }

    case 'porcentaje': {
      const num = typeof valor === 'number' ? valor : parseFloat(String(valor))
      if (isNaN(num)) return String(valor)
      return `${num}%`
    }

    case 'fecha': {
      const fecha = valor instanceof Date ? valor : new Date(String(valor))
      if (isNaN(fecha.getTime())) return String(valor)
      return new Intl.DateTimeFormat(locale, {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      }).format(fecha)
    }

    case 'fecha_hora': {
      const fecha = valor instanceof Date ? valor : new Date(String(valor))
      if (isNaN(fecha.getTime())) return String(valor)
      return new Intl.DateTimeFormat(locale, {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      }).format(fecha)
    }

    case 'booleano':
      return valor ? 'Sí' : 'No'

    default:
      return String(valor)
  }
}

/**
 * Obtiene el valor de una variable desde el contexto.
 * Si la variable es calculada, ejecuta la función de cálculo.
 */
function obtenerValor(
  claveEntidad: string,
  claveCampo: string,
  contexto: ContextoVariables,
): { valor: unknown; definicion?: DefinicionVariable } {
  const datosEntidad = contexto[claveEntidad]
  if (!datosEntidad) return { valor: undefined }

  // Buscar la definición de la variable en el registro
  const entidad = obtenerEntidad(claveEntidad)
  const definicion = entidad?.variables.find((v) => v.clave === claveCampo)

  // Si es calculado, usar la función de cálculo
  if (definicion?.origen === 'calculado' && definicion.calcular) {
    return { valor: definicion.calcular(datosEntidad), definicion }
  }

  // Valor directo del contexto
  return { valor: datosEntidad[claveCampo], definicion }
}

/**
 * Resuelve todas las variables en un texto.
 * Reemplaza {{entidad.campo}} por el valor formateado.
 * Las variables sin datos se reemplazan por cadena vacía.
 */
export function resolverVariables(
  texto: string,
  contexto: ContextoVariables,
  locale = 'es-AR',
): string {
  // Detectar moneda del presupuesto o empresa para formatear importes
  const moneda = (contexto.presupuesto?.moneda || contexto.empresa?.moneda || 'ARS') as string

  return texto.replace(REGEX_VARIABLE, (_match, claveEntidad: string, claveCampo: string) => {
    const { valor, definicion } = obtenerValor(claveEntidad, claveCampo, contexto)
    return formatearValor(valor, definicion, moneda, locale)
  })
}

/**
 * Extrae todas las variables encontradas en un texto.
 * Útil para saber qué datos se necesitan antes de resolver.
 */
export function extraerVariables(texto: string): Array<{ entidad: string; campo: string; clave_completa: string }> {
  const variables: Array<{ entidad: string; campo: string; clave_completa: string }> = []
  let coincidencia: RegExpExecArray | null

  // Crear nueva instancia de regex para evitar problemas con lastIndex
  const regex = /\{\{([a-z_]+)\.([a-z_]+)\}\}/g
  while ((coincidencia = regex.exec(texto)) !== null) {
    variables.push({
      entidad: coincidencia[1],
      campo: coincidencia[2],
      clave_completa: `${coincidencia[1]}.${coincidencia[2]}`,
    })
  }

  return variables
}

/**
 * Resuelve variables y retorna info detallada de cada una.
 * Útil para preview/depuración.
 */
export function resolverVariablesDetallado(
  texto: string,
  contexto: ContextoVariables,
  locale = 'es-AR',
): { texto_resuelto: string; variables: VariableResuelta[] } {
  const variablesResueltas: VariableResuelta[] = []
  const moneda = (contexto.presupuesto?.moneda || contexto.empresa?.moneda || 'ARS') as string

  const texto_resuelto = texto.replace(REGEX_VARIABLE, (_match, claveEntidad: string, claveCampo: string) => {
    const { valor, definicion } = obtenerValor(claveEntidad, claveCampo, contexto)
    const formateado = formatearValor(valor, definicion, moneda, locale)

    variablesResueltas.push({
      clave_completa: `${claveEntidad}.${claveCampo}`,
      valor_crudo: valor,
      valor_formateado: formateado,
    })

    return formateado
  })

  return { texto_resuelto, variables: variablesResueltas }
}

/**
 * Valida que todas las variables de un texto existan en el registro.
 * Retorna las variables inválidas (no registradas).
 */
export function validarVariables(texto: string): Array<{ entidad: string; campo: string; clave_completa: string }> {
  const variables = extraerVariables(texto)
  const invalidas: Array<{ entidad: string; campo: string; clave_completa: string }> = []

  for (const variable of variables) {
    const entidad = obtenerEntidad(variable.entidad)
    if (!entidad || !entidad.variables.some((v) => v.clave === variable.campo)) {
      invalidas.push(variable)
    }
  }

  return invalidas
}

/**
 * Formatea un valor individual de una variable según su tipo de dato.
 * Útil para formatear previews de chips de variable en el editor.
 *   formatearVariable('presupuesto', 'total_final', 586850, 'ARS') → '$586.850,00'
 */
export function formatearVariable(
  claveEntidad: string,
  claveCampo: string,
  valor: unknown,
  moneda?: string,
  locale = 'es-AR',
): string {
  if (valor === null || valor === undefined || valor === '') return ''
  const entidad = obtenerEntidad(claveEntidad)
  const definicion = entidad?.variables.find((v) => v.clave === claveCampo)
  return formatearValor(valor, definicion, moneda || 'ARS', locale)
}

/**
 * Revierte valores resueltos a variables {{entidad.campo}}.
 * Útil para guardar plantillas con variables en vez de datos hardcodeados.
 *
 * 1. Revierte spans data-variable="entidad.campo" → {{entidad.campo}}
 * 2. Revierte valores formateados inline (moneda, porcentaje) → {{entidad.campo}}
 * 3. Revierte valores de texto plano → {{entidad.campo}}
 *
 * Prioriza coincidencias más largas primero para evitar reemplazos parciales.
 */
export function revertirVariablesEnPlantilla(
  texto: string,
  contexto: Record<string, Record<string, unknown> | undefined>,
  locale = 'es-AR',
): string {
  if (!texto || !contexto) return texto

  // 1. Revertir spans data-variable a {{entidad.campo}}
  let resultado = texto.replace(
    /<span[^>]*data-variable="([a-z_]+)\.([a-z_]+)"[^>]*>[^<]*<\/span>/g,
    (_match, entidad: string, campo: string) => `{{${entidad}.${campo}}}`
  )

  // 2. Construir mapa de valor formateado → variable, priorizando strings más largos
  const moneda = (contexto.presupuesto?.moneda || contexto.empresa?.moneda || 'ARS') as string
  const reemplazos: { valor: string; variable: string }[] = []

  for (const [entidad, campos] of Object.entries(contexto)) {
    if (!campos || typeof campos !== 'object') continue
    for (const [campo, valorCrudo] of Object.entries(campos)) {
      if (valorCrudo === null || valorCrudo === undefined || valorCrudo === '') continue
      const variable = `{{${entidad}.${campo}}}`

      // Valor formateado (moneda, fecha, etc.)
      const formateado = formatearVariable(entidad, campo, valorCrudo, moneda, locale)
      if (formateado && formateado.length > 2) {
        reemplazos.push({ valor: formateado, variable })
      }

      // Valor crudo como string (si es diferente al formateado)
      const crudo = String(valorCrudo)
      if (crudo.length > 2 && crudo !== formateado) {
        reemplazos.push({ valor: crudo, variable })
      }
    }
  }

  // Ordenar por largo descendente para reemplazar primero los más específicos
  reemplazos.sort((a, b) => b.valor.length - a.valor.length)

  for (const { valor, variable } of reemplazos) {
    const escapado = valor.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    resultado = resultado.replace(new RegExp(escapado, 'g'), variable)
  }

  return resultado
}
