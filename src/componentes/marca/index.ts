/**
 * Marca Salix — Sistema de identidad visual.
 *
 * Componentes:
 *   IconoSalix  — Símbolo SVG (estático o animado)
 *   LogoSalix   — Ícono + texto con variantes (icono | horizontal | completo)
 *
 * Para splash de carga con el logo, ver `@/componentes/carga` → CargaMarca.
 *
 * Las piezas del ícono están expuestas para uso avanzado (PIEZAS_ICONO).
 */

export { default as IconoSalix, PIEZAS_ICONO } from './IconoSalix'
export type { VarianteIcono } from './IconoSalix'
export { default as LogoSalix } from './LogoSalix'
