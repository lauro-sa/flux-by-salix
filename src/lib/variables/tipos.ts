/**
 * Tipos del sistema de variables dinámicas de Flux.
 * Las variables se auto-generan desde el registro de entidades y se usan
 * en plantillas de documentos, emails, WhatsApp, etc.
 * Sintaxis: {{entidad.campo}} — ej: {{contacto.nombre}}, {{presupuesto.total_con_iva}}
 */

import type { ReactNode } from 'react'

/** Tipo de dato de una variable — determina cómo se formatea al resolver */
export type TipoDatoVariable =
  | 'texto'
  | 'numero'
  | 'moneda'
  | 'porcentaje'
  | 'fecha'
  | 'fecha_hora'
  | 'booleano'
  | 'email'
  | 'telefono'
  | 'url'
  | 'imagen'

/** Origen de la variable — de dónde sale el valor */
export type OrigenVariable =
  | 'columna'    // Columna directa de la tabla en BD
  | 'calculado'  // Se calcula a partir de otros campos (ej: total_con_iva)
  | 'relacion'   // Viene de una tabla relacionada (ej: contacto.empresa_nombre)

/** Definición de una variable individual */
export interface DefinicionVariable {
  /** Clave única dentro de la entidad — ej: 'nombre', 'total_con_iva' */
  clave: string
  /** Etiqueta en español para mostrar en el selector — ej: 'Nombre completo' */
  etiqueta: string
  /** Descripción breve opcional — ej: 'Nombre y apellido del contacto' */
  descripcion?: string
  /** Tipo de dato para formateo */
  tipo_dato: TipoDatoVariable
  /** De dónde sale el valor */
  origen: OrigenVariable
  /** Grupo visual dentro de la entidad — ej: 'basico', 'contacto', 'ubicacion', 'financiero' */
  grupo?: string
  /** Función para calcular el valor (solo para origen 'calculado') */
  calcular?: (datos: Record<string, unknown>) => unknown
}

/** Definición de una entidad (categoría de variables) */
export interface DefinicionEntidad {
  /** Clave única de la entidad — ej: 'contacto', 'presupuesto', 'empresa' */
  clave: string
  /** Etiqueta en español — ej: 'Contacto', 'Presupuesto' */
  etiqueta: string
  /** Ícono de Lucide para el selector */
  icono: ReactNode
  /** Color del ícono (token CSS) */
  color?: string
  /** Variables disponibles de esta entidad */
  variables: DefinicionVariable[]
}

/** Variable resuelta con su valor final formateado */
export interface VariableResuelta {
  clave_completa: string  // 'contacto.nombre'
  valor_crudo: unknown     // 'Juan'
  valor_formateado: string // 'Juan'
}

/** Contexto de datos para resolver variables — mapa de entidad → datos */
export type ContextoVariables = Record<string, Record<string, unknown>>

/** Grupo visual de variables dentro de una entidad */
export interface GrupoVariables {
  clave: string
  etiqueta: string
  variables: DefinicionVariable[]
}
