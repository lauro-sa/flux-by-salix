/**
 * Test de claves i18n alcanzables del panel lateral del editor de
 * flujos (sub-PR 19.3a).
 *
 * Replica el patrón de `flujos-etiquetas-disparador.test.ts`: si una
 * traducción se borra por error o se renombra, este test pinta el
 * síntoma antes de mergear. Verifica las tres locales (es / en / pt).
 *
 * Cobertura:
 *   • Claves del shell del panel (banner_lectura, secciones, subheader,
 *     footer, avanzado, pendiente) — tienen que estar en los 3 idiomas.
 *   • Claves específicas de los 4 tipos editables en 19.3a:
 *     `esperar`, `terminar`, `cron`, `actividad_completada`.
 *
 * Para cada locale leemos el objeto de traducción y verificamos que el
 * valor de la clave es un string no vacío, distinto de la clave misma.
 */

import { describe, expect, it } from 'vitest'
import { es } from '@/lib/i18n/es'
import { en } from '@/lib/i18n/en'
import { pt } from '@/lib/i18n/pt'
import type { Traducciones } from '@/lib/i18n/tipos'

const LOCALES: Array<{ nombre: string; obj: Traducciones }> = [
  { nombre: 'es', obj: es },
  { nombre: 'en', obj: en },
  { nombre: 'pt', obj: pt },
]

/** Lee dot-notation con fallback a la propia clave si no existe. */
function leerClave(obj: Traducciones, clave: string): string {
  const partes = clave.split('.')
  let actual: unknown = obj
  for (const parte of partes) {
    if (actual === null || actual === undefined || typeof actual !== 'object') {
      return clave
    }
    actual = (actual as Record<string, unknown>)[parte]
  }
  return typeof actual === 'string' ? actual : clave
}

// Claves que TIENEN que estar para que el panel renderice algo coherente.
const CLAVES_OBLIGATORIAS: readonly string[] = [
  // Shell
  'flujos.editor.panel.titulo_default',
  'flujos.editor.panel.banner_lectura',

  // Secciones (labels uppercase)
  'flujos.editor.panel.seccion.basicos',
  'flujos.editor.panel.seccion.tiempo',
  'flujos.editor.panel.seccion.disparador',
  'flujos.editor.panel.seccion.avanzado',

  // Sub-header
  'flujos.editor.panel.subheader.posicion',
  'flujos.editor.panel.subheader.rama_si',
  'flujos.editor.panel.subheader.rama_no',

  // Footer
  'flujos.editor.panel.footer.eliminar_paso',

  // Avanzado / Pendiente (fallbacks)
  'flujos.editor.panel.avanzado.proximamente',
  'flujos.editor.panel.pendiente.titulo',
  'flujos.editor.panel.pendiente.descripcion',

  // Tipo "esperar"
  'flujos.editor.panel.esperar.cantidad_label',
  'flujos.editor.panel.esperar.unidad_label',
  'flujos.editor.panel.esperar.unidad_min',
  'flujos.editor.panel.esperar.unidad_hora',
  'flujos.editor.panel.esperar.unidad_dia',
  'flujos.editor.panel.esperar.ayuda',
  'flujos.editor.panel.esperar.ayuda_fecha_absoluta',

  // Tipo "terminar"
  'flujos.editor.panel.terminar.leyenda',
  'flujos.editor.panel.terminar.motivo_label',
  'flujos.editor.panel.terminar.motivo_placeholder',

  // Disparador "tiempo.cron"
  'flujos.editor.panel.cron.expresion_label',
  'flujos.editor.panel.cron.ayuda',
  'flujos.editor.panel.cron.ejemplo_1',
  'flujos.editor.panel.cron.ejemplo_2',
  'flujos.editor.panel.cron.ejemplo_3',

  // Disparador "actividad.completada"
  'flujos.editor.panel.actividad_completada.tipo_clave_label',
  'flujos.editor.panel.actividad_completada.tipo_clave_placeholder',
  'flujos.editor.panel.actividad_completada.tipo_clave_ayuda',
] as const

describe('flujos / panel lateral / claves i18n alcanzables', () => {
  for (const locale of LOCALES) {
    describe(`locale: ${locale.nombre}`, () => {
      for (const clave of CLAVES_OBLIGATORIAS) {
        it(`tiene "${clave}" como string no vacío`, () => {
          const valor = leerClave(locale.obj, clave)
          expect(valor).not.toBe(clave)
          expect(typeof valor).toBe('string')
          expect(valor.length).toBeGreaterThan(0)
        })
      }
    })
  }

  it('la posición del sub-header tiene los placeholders {{n}} y {{total}}', () => {
    // Sin estos placeholders el componente renderiza un texto roto. Lo
    // chequeamos en es porque los placeholders son parte del contrato.
    const valor = leerClave(es, 'flujos.editor.panel.subheader.posicion')
    expect(valor).toContain('{{n}}')
    expect(valor).toContain('{{total}}')
  })

  it('la ayuda de fecha absoluta de "esperar" usa el placeholder {{fecha}}', () => {
    const valor = leerClave(es, 'flujos.editor.panel.esperar.ayuda_fecha_absoluta')
    expect(valor).toContain('{{fecha}}')
  })

  it('el título de "pendiente" usa el placeholder {{tipo}}', () => {
    const valor = leerClave(es, 'flujos.editor.panel.pendiente.titulo')
    expect(valor).toContain('{{tipo}}')
  })
})
