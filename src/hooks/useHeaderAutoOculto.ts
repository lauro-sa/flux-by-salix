'use client'

import { useState, useEffect, useRef, useCallback } from 'react'

/**
 * useHeaderAutoOculto — Oculta el header al scrollear hacia abajo, lo muestra al scrollear hacia arriba.
 *
 * Patrón tipo Twitter/Instagram para ganar espacio en móvil.
 * Solo funciona cuando el scroll es del documento (mobile browser).
 * En desktop/PWA (layout fijo con overflow:hidden) el scroll no es del window → no aplica.
 *
 * Retorna `oculto: boolean` que se usa para aplicar una clase CSS con transform.
 */

/** Distancia mínima de scroll para activar hide/show (evita micro-scrolls) */
const UMBRAL = 10

export function useHeaderAutoOculto(): boolean {
  // Desactivado: el header siempre visible en mobile.
  // El patrón tipo Twitter/Instagram confunde más que ayuda
  // cuando hay navegación importante en el header.
  return false
}
