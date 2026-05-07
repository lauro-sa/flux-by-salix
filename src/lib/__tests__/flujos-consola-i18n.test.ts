/**
 * Test de claves i18n alcanzables de la consola del editor de flujos
 * (sub-PR 19.5).
 *
 * Mismo patrón que `flujos-panel-i18n.test.ts`: si una traducción se
 * borra o renombra, este test pinta el síntoma antes del merge.
 *
 * Cobertura:
 *   • Shell de la consola (título, cerrar, tabs, evento, CTAs).
 *   • Banner ámbar de acciones no implementadas (caveat D3).
 *   • Banner rojo "no se puede probar todavía".
 *   • Vista previa estática: títulos + helpers de resolución de variables.
 *   • Dry-run: paso completado/fallado/no_implementada + textos por
 *     tipo de acción simulada + resumen.
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

const CLAVES_OBLIGATORIAS: readonly string[] = [
  // Shell
  'flujos.editor.consola.titulo',
  'flujos.editor.consola.cerrar',
  'flujos.editor.consola.tab_preview',
  'flujos.editor.consola.tab_dryrun',
  'flujos.editor.consola.evento_label',
  'flujos.editor.consola.evento_sin_evento',
  'flujos.editor.consola.evento_no_disponible',
  'flujos.editor.consola.cargando',
  'flujos.editor.consola.cta_correr',
  'flujos.editor.consola.cta_volver_a_correr',
  'flujos.editor.consola.cta_actualizar_preview',
  'flujos.editor.consola.sin_pasos',

  // Banners
  'flujos.editor.consola.banner_invalido_titulo',
  'flujos.editor.consola.banner_invalido_desc',
  'flujos.editor.consola.banner_no_implementadas_titulo',
  'flujos.editor.consola.banner_no_implementadas_desc',

  // Vista previa estática
  'flujos.editor.consola.preview.titulo',
  'flujos.editor.consola.preview.descripcion',
  'flujos.editor.consola.preview.paso_titulo',
  'flujos.editor.consola.preview.rama_si_resuelta',
  'flujos.editor.consola.preview.rama_no_resuelta',
  'flujos.editor.consola.preview.esperaria',
  'flujos.editor.consola.preview.esperaria_hasta',
  'flujos.editor.consola.preview.terminar_flujo',
  'flujos.editor.consola.preview.variable_faltante',
  'flujos.editor.consola.preview.ver_detalle',
  'flujos.editor.consola.preview.ocultar_detalle',

  // Dry-run
  'flujos.editor.consola.dryrun.titulo',
  'flujos.editor.consola.dryrun.paso_completado',
  'flujos.editor.consola.dryrun.paso_simulado',
  'flujos.editor.consola.dryrun.paso_fallado',
  'flujos.editor.consola.dryrun.paso_no_implementada',
  'flujos.editor.consola.dryrun.accion_no_implementada_inline',
  'flujos.editor.consola.dryrun.duracion_ms',
  'flujos.editor.consola.dryrun.terminado_temprano',
  'flujos.editor.consola.dryrun.resumen_titulo',
  'flujos.editor.consola.dryrun.resumen_completados',
  'flujos.editor.consola.dryrun.resumen_fallados',
  'flujos.editor.consola.dryrun.resumen_simulados',
  'flujos.editor.consola.dryrun.resumen_total',
  'flujos.editor.consola.dryrun.accion_simulada_whatsapp',
  'flujos.editor.consola.dryrun.accion_simulada_actividad',
  'flujos.editor.consola.dryrun.accion_simulada_estado',
  'flujos.editor.consola.dryrun.accion_simulada_notificar',
  'flujos.editor.consola.dryrun.accion_simulada_generica',
  'flujos.editor.consola.dryrun.error_correr',
]

describe('Claves i18n alcanzables de la consola de prueba (sub-PR 19.5)', () => {
  for (const { nombre, obj } of LOCALES) {
    describe(`locale=${nombre}`, () => {
      for (const clave of CLAVES_OBLIGATORIAS) {
        it(`tiene ${clave}`, () => {
          const valor = leerClave(obj, clave)
          expect(valor, `Clave ${clave} faltante en ${nombre}`).not.toBe(clave)
          expect(valor.length, `Clave ${clave} vacía en ${nombre}`).toBeGreaterThan(0)
        })
      }
    })
  }

  it('los placeholders {{n}}, {{plantilla}}, {{destinatario}} están presentes en las plantillas relevantes', () => {
    const checks: Array<{ clave: string; placeholders: string[] }> = [
      { clave: 'flujos.editor.consola.banner_no_implementadas_desc', placeholders: ['{{n}}'] },
      { clave: 'flujos.editor.consola.preview.paso_titulo', placeholders: ['{{n}}', '{{nombre}}'] },
      { clave: 'flujos.editor.consola.preview.esperaria', placeholders: ['{{texto}}'] },
      { clave: 'flujos.editor.consola.preview.esperaria_hasta', placeholders: ['{{fecha}}'] },
      { clave: 'flujos.editor.consola.preview.variable_faltante', placeholders: ['{{ruta}}'] },
      {
        clave: 'flujos.editor.consola.dryrun.accion_simulada_whatsapp',
        placeholders: ['{{plantilla}}', '{{destinatario}}'],
      },
      {
        clave: 'flujos.editor.consola.dryrun.accion_simulada_actividad',
        placeholders: ['{{titulo}}', '{{tipo}}'],
      },
      {
        clave: 'flujos.editor.consola.dryrun.accion_simulada_estado',
        placeholders: ['{{entidad}}', '{{nuevo}}'],
      },
      {
        clave: 'flujos.editor.consola.dryrun.accion_simulada_notificar',
        placeholders: ['{{usuario}}', '{{titulo}}'],
      },
      {
        clave: 'flujos.editor.consola.dryrun.accion_simulada_generica',
        placeholders: ['{{tipo}}'],
      },
      {
        clave: 'flujos.editor.consola.dryrun.duracion_ms',
        placeholders: ['{{ms}}'],
      },
      {
        clave: 'flujos.editor.consola.dryrun.resumen_total',
        placeholders: ['{{ms}}'],
      },
    ]
    for (const { nombre, obj } of LOCALES) {
      for (const { clave, placeholders } of checks) {
        const valor = leerClave(obj, clave)
        for (const p of placeholders) {
          expect(valor, `Falta ${p} en ${clave} (${nombre}): "${valor}"`).toContain(p)
        }
      }
    }
  })
})
