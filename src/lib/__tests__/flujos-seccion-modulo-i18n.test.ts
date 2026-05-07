/**
 * Test de claves i18n alcanzables de la sección "Flujos" dentro de
 * cada `/<modulo>/configuracion` (sub-PR 19.7).
 *
 * Mismo patrón validado en 19.1 / 19.5 / 19.6: si una clave nueva
 * que la UI consume se borra, renombra o queda vacía en algún locale,
 * este test la pinta antes de pushear.
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
  // Bloque 1 — lista compacta del módulo
  'flujos.seccion_modulo.lista_titulo',
  'flujos.seccion_modulo.lista_ver_todos',
  'flujos.seccion_modulo.lista_mas_sufijo',
  'flujos.seccion_modulo.cargando',
  'flujos.seccion_modulo.ultima_ejecucion_prefijo',
  'flujos.seccion_modulo.sin_ejecutar',

  // Bloque 2 — plantillas curadas
  'flujos.seccion_modulo.plantillas_titulo',
  'flujos.seccion_modulo.plantillas_descripcion',

  // Reusadas en el render de filas (PillEstado interno usa
  // `flujos.estados.<estado>` y la claveya está cubierta por el
  // test del listado central, pero la sumamos acá para que el
  // contrato visual de la sección no quede oculto).
  'flujos.estados.activo',
  'flujos.estados.pausado',
  'flujos.estados.borrador',
]

describe('i18n — sección por módulo (sub-PR 19.7)', () => {
  for (const { nombre, obj } of LOCALES) {
    describe(`locale ${nombre}`, () => {
      it.each(CLAVES_OBLIGATORIAS)('clave %s tiene un string no vacío', (clave) => {
        const valor = leerClave(obj, clave)
        // Si la clave no existe, `leerClave` devuelve la clave misma —
        // la condición `valor !== clave` detecta el caso.
        expect(valor).not.toBe(clave)
        expect(valor.trim().length).toBeGreaterThan(0)
      })
    })
  }
})
