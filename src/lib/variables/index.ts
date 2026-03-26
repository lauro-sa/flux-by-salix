/**
 * Sistema de variables dinámicas de Flux.
 *
 * Importar las entidades registra todo automáticamente:
 *   import '@/lib/variables/entidades'
 *
 * Usar el registro para consultar variables:
 *   import { obtenerEntidades, buscarVariables } from '@/lib/variables'
 *
 * Resolver variables en texto:
 *   import { resolverVariables } from '@/lib/variables'
 *   resolverVariables('Hola {{contacto.nombre}}', { contacto: { nombre: 'Juan' } })
 */

// Tipos
export type {
  TipoDatoVariable,
  OrigenVariable,
  DefinicionVariable,
  DefinicionEntidad,
  VariableResuelta,
  ContextoVariables,
  GrupoVariables,
} from './tipos'

// Registro
export {
  registrarEntidad,
  eliminarEntidad,
  obtenerEntidades,
  obtenerEntidad,
  obtenerVariablesAgrupadas,
  buscarVariables,
  obtenerTodasLasClaves,
  ETIQUETAS_GRUPO,
} from './registro'

// Resolver
export {
  resolverVariables,
  extraerVariables,
  resolverVariablesDetallado,
  validarVariables,
} from './resolver'
