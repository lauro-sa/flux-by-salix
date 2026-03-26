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
function formatearValor(valor: unknown, definicion?: DefinicionVariable): string {
  if (valor === null || valor === undefined || valor === '') return ''

  if (!definicion) return String(valor)

  switch (definicion.tipo_dato) {
    case 'moneda': {
      const num = typeof valor === 'number' ? valor : parseFloat(String(valor))
      if (isNaN(num)) return String(valor)
      return new Intl.NumberFormat('es-AR', {
        style: 'currency',
        currency: 'ARS',
        minimumFractionDigits: 2,
      }).format(num)
    }

    case 'numero': {
      const num = typeof valor === 'number' ? valor : parseFloat(String(valor))
      if (isNaN(num)) return String(valor)
      return new Intl.NumberFormat('es-AR').format(num)
    }

    case 'porcentaje': {
      const num = typeof valor === 'number' ? valor : parseFloat(String(valor))
      if (isNaN(num)) return String(valor)
      return `${num}%`
    }

    case 'fecha': {
      const fecha = valor instanceof Date ? valor : new Date(String(valor))
      if (isNaN(fecha.getTime())) return String(valor)
      return new Intl.DateTimeFormat('es-AR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      }).format(fecha)
    }

    case 'fecha_hora': {
      const fecha = valor instanceof Date ? valor : new Date(String(valor))
      if (isNaN(fecha.getTime())) return String(valor)
      return new Intl.DateTimeFormat('es-AR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
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
): string {
  return texto.replace(REGEX_VARIABLE, (_match, claveEntidad: string, claveCampo: string) => {
    const { valor, definicion } = obtenerValor(claveEntidad, claveCampo, contexto)
    return formatearValor(valor, definicion)
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
): { texto_resuelto: string; variables: VariableResuelta[] } {
  const variablesResueltas: VariableResuelta[] = []

  const texto_resuelto = texto.replace(REGEX_VARIABLE, (_match, claveEntidad: string, claveCampo: string) => {
    const { valor, definicion } = obtenerValor(claveEntidad, claveCampo, contexto)
    const formateado = formatearValor(valor, definicion)

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
