'use client'

import type { AuthResponse } from '@supabase/supabase-js'
import { crearClienteNavegador } from './cliente'

/**
 * Wrapper centralizado para refreshSession de Supabase Auth.
 * - Deduplica: si ya hay un refresh en curso, reutiliza la misma promesa
 * - Backoff en 429: espera antes de reintentar (máx 2 reintentos)
 * - Se usa en: useAuth, useEmpresa, onboarding, invitación, esperando-activación
 */

let promesaEnCurso: Promise<AuthResponse> | null = null
let bloqueadoHasta = 0

export async function refrescarSesionSegura() {
  // Si estamos en periodo de backoff por un 429 previo, esperar
  const ahora = Date.now()
  if (ahora < bloqueadoHasta) {
    const espera = bloqueadoHasta - ahora
    await new Promise(r => setTimeout(r, espera))
  }

  // Deduplicar: si ya hay un refresh en curso, reutilizar
  if (promesaEnCurso) {
    return promesaEnCurso
  }

  const supabase = crearClienteNavegador()

  promesaEnCurso = (async () => {
    for (let intento = 0; intento < 3; intento++) {
      const resultado = await supabase.auth.refreshSession()

      // Si no hay error, retornar
      if (!resultado.error) {
        return resultado
      }

      // Detectar 429 — el SDK de Supabase lo reporta como AuthApiError
      const es429 = resultado.error.message?.includes('429')
        || resultado.error.message?.toLowerCase().includes('too many')
        || resultado.error.message?.toLowerCase().includes('rate limit')
        || resultado.error.status === 429

      if (es429) {
        // Backoff exponencial: 5s, 15s, 30s
        const esperaMs = [5000, 15000, 30000][intento] ?? 30000
        bloqueadoHasta = Date.now() + esperaMs
        console.warn(`[Auth] 429 detectado, esperando ${esperaMs / 1000}s antes de reintentar (intento ${intento + 1}/3)`)

        if (intento < 2) {
          await new Promise(r => setTimeout(r, esperaMs))
          continue
        }
      }

      // Otro error no-429, retornar sin reintentar
      return resultado
    }

    // Si agotamos reintentos, retornar el último intento
    return supabase.auth.refreshSession()
  })()

  try {
    return await promesaEnCurso
  } finally {
    promesaEnCurso = null
  }
}
