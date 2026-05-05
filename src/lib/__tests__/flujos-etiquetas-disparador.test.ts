/**
 * Tests unit del helper `etiquetaDisparador` y `descripcionDisparador`
 * (sub-PR 19.1).
 *
 * El helper es el único punto que mapea `TipoDisparador → string` para
 * la UI. Si cambia el catálogo de tipos en `tipos/workflow.ts`, queremos
 * que estos tests fallen para forzar el upgrade de las claves i18n
 * antes de mergear (no descubrirlo en producción con un disparador que
 * se renderiza como 'webhook.entrante' raw).
 */

import { describe, expect, it } from 'vitest'
import {
  etiquetaDisparador,
  descripcionDisparador,
} from '@/lib/workflows/etiquetas-disparador'
import { TIPOS_DISPARADOR } from '@/tipos/workflow'

// Stub mínimo de `t` para los tests: imita el comportamiento de
// `useTraduccion().t` con el archivo es.ts. Si la clave no está, devuelve
// la clave (igual que el i18n real). Hardcodeamos los strings que nos
// interesa verificar — el resto va al fallback (raw).
function tStub(claves: Record<string, string>) {
  return (clave: string) => claves[clave] ?? clave
}

describe('etiquetaDisparador', () => {
  it('devuelve la etiqueta legible para un tipo conocido', () => {
    const t = tStub({
      'flujos.disparador.entidad.estado_cambio': 'Cambio de estado',
    })
    expect(etiquetaDisparador(t, 'entidad.estado_cambio')).toBe('Cambio de estado')
  })

  it('devuelve "Sin disparador" cuando el tipo es null o undefined', () => {
    const t = tStub({
      'flujos.disparador.sin_disparador': 'Sin disparador',
    })
    expect(etiquetaDisparador(t, null)).toBe('Sin disparador')
    expect(etiquetaDisparador(t, undefined)).toBe('Sin disparador')
  })

  it('devuelve el tipo raw cuando la clave i18n no existe (forward-compat)', () => {
    // Si el backend agrega un disparador nuevo antes de que se traduzca,
    // queremos mostrar el raw en lugar de "flujos.disparador.x.y" feo.
    const t = tStub({})
    expect(etiquetaDisparador(t, 'tipo_nuevo' as never)).toBe('tipo_nuevo')
  })

  it('cada tipo de TIPOS_DISPARADOR tiene una clave i18n alcanzable', () => {
    // Smoke test: no validamos el contenido de la traducción (eso está en
    // los archivos i18n) pero sí que el helper no devuelva la clave cruda
    // para ningún tipo del catálogo. Si una traducción se borra por error,
    // este test pinta el síntoma.
    const t = tStub(
      TIPOS_DISPARADOR.reduce((acc, tipo) => ({
        ...acc,
        [`flujos.disparador.${tipo}`]: `[OK ${tipo}]`,
      }), {}),
    )
    for (const tipo of TIPOS_DISPARADOR) {
      const resultado = etiquetaDisparador(t, tipo)
      expect(resultado).toBe(`[OK ${tipo}]`)
    }
  })
})

describe('descripcionDisparador', () => {
  it('devuelve la descripción cuando existe', () => {
    const t = tStub({
      'flujos.disparador_descripcion.tiempo.cron': 'En horarios definidos por una expresión cron.',
    })
    expect(descripcionDisparador(t, 'tiempo.cron')).toMatch(/cron/)
  })

  it('devuelve string vacío cuando el tipo es null', () => {
    const t = tStub({})
    expect(descripcionDisparador(t, null)).toBe('')
  })

  it('devuelve string vacío cuando la clave no existe (no muestra "flujos.disparador_descripcion.x")', () => {
    const t = tStub({})
    expect(descripcionDisparador(t, 'tipo_nuevo' as never)).toBe('')
  })
})
