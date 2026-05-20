/**
 * Patrones canónicos de carga de Flux.
 *
 * Hay TRES patrones, usar siempre uno de estos — nunca spinners ad-hoc:
 *
 *   CargaBarra  — barra fina con `flux-barra-progreso`
 *                 Para modales, listas, secciones, dropdowns con fetch.
 *
 *   CargaIcono  — ícono del módulo dibujándose + barra arriba
 *                 Para `loading.tsx` y `Suspense fallback` de módulos enteros.
 *
 *   CargaMarca  — logo Salix + byline "by Salix" + barra de progreso
 *                 Para splash de app, login, portal del cliente.
 *
 * Si cambia color, timing o forma de un patrón, se propaga a toda la app
 * desde un único lugar — no hay variantes duplicadas que cazar.
 */

export { CargaBarra } from './CargaBarra'
export { CargaIcono } from './CargaIcono'
export { default as CargaMarca } from './CargaMarca'
