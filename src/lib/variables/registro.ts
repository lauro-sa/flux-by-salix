/**
 * Registro central de entidades y variables de Flux.
 * Cada módulo registra sus entidades aquí. Las variables se auto-generan
 * desde las definiciones y quedan disponibles en el SelectorVariables.
 *
 * Uso:
 *   registrarEntidad({ clave: 'contacto', etiqueta: 'Contacto', ... })
 *   obtenerEntidades()         → todas las entidades registradas
 *   obtenerVariables('contacto') → variables de una entidad
 *   buscarVariables('nombre')  → búsqueda global por etiqueta/clave
 */

import type { DefinicionEntidad, DefinicionVariable, GrupoVariables } from './tipos'

// Almacén interno de entidades registradas
const entidadesRegistradas = new Map<string, DefinicionEntidad>()

/** Etiquetas de grupos de variables en español */
const ETIQUETAS_GRUPO: Record<string, string> = {
  basico: 'Básico',
  contacto: 'Contacto',
  ubicacion: 'Ubicación',
  financiero: 'Financiero',
  fechas: 'Fechas',
  estado: 'Estado',
  pagos: 'Pagos',
  detalles: 'Detalles',
  configuracion: 'Configuración',
  relacion: 'Relación',
  otro: 'Otro',
}

/**
 * Registra una entidad con sus variables en el sistema.
 * Si la entidad ya existe, la reemplaza (útil para hot-reload en dev).
 */
export function registrarEntidad(entidad: DefinicionEntidad): void {
  entidadesRegistradas.set(entidad.clave, entidad)
}

/**
 * Elimina una entidad del registro.
 */
export function eliminarEntidad(clave: string): void {
  entidadesRegistradas.delete(clave)
}

/**
 * Obtiene todas las entidades registradas, ordenadas alfabéticamente por etiqueta.
 */
export function obtenerEntidades(): DefinicionEntidad[] {
  return Array.from(entidadesRegistradas.values())
    .sort((a, b) => a.etiqueta.localeCompare(b.etiqueta, 'es'))
}

/**
 * Obtiene una entidad específica por su clave.
 */
export function obtenerEntidad(clave: string): DefinicionEntidad | undefined {
  return entidadesRegistradas.get(clave)
}

/**
 * Obtiene las variables de una entidad, agrupadas por grupo visual.
 */
export function obtenerVariablesAgrupadas(claveEntidad: string): GrupoVariables[] {
  const entidad = entidadesRegistradas.get(claveEntidad)
  if (!entidad) return []

  const grupos = new Map<string, DefinicionVariable[]>()

  for (const variable of entidad.variables) {
    const grupo = variable.grupo || 'otro'
    if (!grupos.has(grupo)) grupos.set(grupo, [])
    grupos.get(grupo)!.push(variable)
  }

  return Array.from(grupos.entries()).map(([clave, variables]) => ({
    clave,
    etiqueta: ETIQUETAS_GRUPO[clave] || clave.charAt(0).toUpperCase() + clave.slice(1),
    variables: variables.sort((a, b) => a.etiqueta.localeCompare(b.etiqueta, 'es')),
  }))
}

/**
 * Busca variables en todas las entidades por texto.
 * Busca en: clave de variable, etiqueta, descripción y etiqueta de entidad.
 * Retorna resultados con la clave completa (entidad.campo).
 */
export function buscarVariables(consulta: string): Array<{
  entidad: DefinicionEntidad
  variable: DefinicionVariable
  clave_completa: string
}> {
  const termino = consulta.toLowerCase().trim()
  if (!termino) return []

  const resultados: Array<{
    entidad: DefinicionEntidad
    variable: DefinicionVariable
    clave_completa: string
  }> = []

  for (const entidad of entidadesRegistradas.values()) {
    for (const variable of entidad.variables) {
      const coincide =
        variable.clave.toLowerCase().includes(termino) ||
        variable.etiqueta.toLowerCase().includes(termino) ||
        variable.descripcion?.toLowerCase().includes(termino) ||
        entidad.etiqueta.toLowerCase().includes(termino) ||
        `${entidad.clave}.${variable.clave}`.includes(termino)

      if (coincide) {
        resultados.push({
          entidad,
          variable,
          clave_completa: `${entidad.clave}.${variable.clave}`,
        })
      }
    }
  }

  return resultados
}

/**
 * Obtiene todas las claves de variables disponibles.
 * Útil para validación y autocompletado.
 */
export function obtenerTodasLasClaves(): string[] {
  const claves: string[] = []
  for (const entidad of entidadesRegistradas.values()) {
    for (const variable of entidad.variables) {
      claves.push(`${entidad.clave}.${variable.clave}`)
    }
  }
  return claves
}

/** Exportar etiquetas de grupo para uso en UI */
export { ETIQUETAS_GRUPO }
