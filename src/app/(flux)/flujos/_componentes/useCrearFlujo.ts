'use client'

/**
 * useCrearFlujo — hook compartido para crear un flujo borrador
 * (POST /api/flujos) y navegar al editor con `?plantilla=<id>` si
 * arranca desde una plantilla curada.
 *
 * Centraliza la lógica que estaba duplicada entre `ModalNuevoFlujo`
 * (sub-PR 19.1) y la sección "Flujos" por módulo del 19.7. La idea
 * es que el día que cambie el contrato del POST o el formato de la
 * URL del editor, haya un único punto a tocar.
 *
 * El hook NO renderiza nada: maneja fetch + toast + navegación. Las
 * funciones expuestas son fire-and-forget desde la perspectiva del
 * caller (toda la UX de éxito/error vive acá).
 *
 * La función pura `payloadDesdePlantilla` queda exportada aparte
 * para que sea testeable sin levantar React/Next router.
 */

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useToast } from '@/componentes/feedback/Toast'
import { useTraduccion } from '@/lib/i18n'
import type { PlantillaSugerida } from '@/lib/workflows/plantillas-sugeridas'

// =============================================================
// Función pura — separada del hook para que sea testeable
// =============================================================

/**
 * Convierte una plantilla del catálogo en el payload `{ nombre,
 * descripcion, plantillaId }` que consume `crearFlujo`.
 *
 * Hoy usa los `fallback_es` (mismo criterio que el modal del 19.1).
 * Cuando se materialicen las claves i18n por plantilla se cambia
 * acá adentro y todos los consumidores hereda el cambio.
 */
export function payloadDesdePlantilla(plantilla: PlantillaSugerida): {
  nombre: string
  descripcion: string
  plantillaId: string
} {
  return {
    nombre: plantilla.fallback_es.titulo,
    descripcion: plantilla.fallback_es.descripcion,
    plantillaId: plantilla.id,
  }
}

// =============================================================
// Hook
// =============================================================

interface PayloadCrear {
  nombre: string
  descripcion?: string
  plantillaId?: string | null
}

interface ResultadoUseCrearFlujo {
  /** True mientras está corriendo el POST. Bloquea botones. */
  creando: boolean
  /**
   * POST + toast + redirect. Si `plantillaId` viene, la URL final
   * es `/flujos/<id>?plantilla=<id>` (el editor lee la query y
   * pre-rellena disparador/acciones).
   */
  crearFlujo: (payload: PayloadCrear) => Promise<void>
  /**
   * Atajo: arma el payload desde una plantilla curada y llama a
   * `crearFlujo`. Usado por el modal "+ Nuevo flujo" y por la
   * sección "Flujos" de cada módulo.
   */
  crearDesdePlantilla: (plantilla: PlantillaSugerida) => Promise<void>
}

export function useCrearFlujo(callbacks?: {
  /** Se ejecuta tras crear con éxito (ej: cerrar modal contenedor). */
  onCreado?: () => void
}): ResultadoUseCrearFlujo {
  const router = useRouter()
  const { mostrar } = useToast()
  const { t } = useTraduccion()
  const [creando, setCreando] = useState(false)

  const crearFlujo = useCallback(
    async (payload: PayloadCrear) => {
      setCreando(true)
      try {
        const res = await fetch('/api/flujos', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            nombre: payload.nombre,
            ...(payload.descripcion ? { descripcion: payload.descripcion } : {}),
          }),
        })
        if (!res.ok) {
          const cuerpo = (await res.json().catch(() => ({}))) as { error?: string }
          throw new Error(cuerpo.error ?? `HTTP ${res.status}`)
        }
        const data = (await res.json()) as { flujo?: { id: string } }
        const id = data.flujo?.id
        if (!id) throw new Error('Respuesta sin id')

        mostrar('exito', t('flujos.toast.creado'))
        callbacks?.onCreado?.()
        const sufijo = payload.plantillaId
          ? `?plantilla=${encodeURIComponent(payload.plantillaId)}`
          : ''
        router.push(`/flujos/${id}${sufijo}`)
      } catch (err) {
        console.error('Error al crear flujo:', err)
        mostrar(
          'error',
          err instanceof Error ? err.message : t('flujos.toast.error_crear'),
        )
      } finally {
        setCreando(false)
      }
    },
    [router, mostrar, t, callbacks],
  )

  const crearDesdePlantilla = useCallback(
    async (plantilla: PlantillaSugerida) => {
      await crearFlujo(payloadDesdePlantilla(plantilla))
    },
    [crearFlujo],
  )

  return { creando, crearFlujo, crearDesdePlantilla }
}
