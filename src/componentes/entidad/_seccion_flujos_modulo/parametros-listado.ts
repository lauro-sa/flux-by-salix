/**
 * Helper puro `construirParametrosListado` — arma los search params
 * del fetch de `/api/flujos` desde dentro de la sección por módulo
 * (sub-PR 19.7).
 *
 * Vive en un archivo aparte (sin imports de React/Supabase) para que
 * sea testeable en vitest sin levantar el cliente Supabase. Lo
 * importan tanto `SeccionFlujosModulo.tsx` como sus tests.
 */

const POR_PAGINA_DEFAULT = 5

export function construirParametrosListado(opciones: {
  modulos?: readonly string[]
  tiposDisparador?: readonly string[]
  porPagina?: number
}): Record<string, string | number> {
  const params: Record<string, string | number> = {
    pagina: 1,
    por_pagina: opciones.porPagina ?? POR_PAGINA_DEFAULT,
  }
  if (opciones.modulos && opciones.modulos.length > 0) {
    params.modulo = opciones.modulos.join(',')
  }
  if (opciones.tiposDisparador && opciones.tiposDisparador.length > 0) {
    params.tipo_disparador = opciones.tiposDisparador.join(',')
  }
  return params
}

export const POR_PAGINA_SECCION_FLUJOS = POR_PAGINA_DEFAULT
