/**
 * Tests del catálogo de plantillas curadas para `completar_actividad`
 * (sub-PR 20.4).
 *
 * Patrón espejo de `flujos-sistema.test.ts` (20.3): el catálogo es
 * declarativo y los tests garantizan que cada plantilla:
 *
 *   1. Tiene id único.
 *   2. Pasa el type guard `esAccionCompletarActividad` cuando se le
 *      pega el shape envoltorio mínimo (`tipo: 'completar_actividad'`).
 *   3. Cumple la regla del validador del 20.1: al menos uno de
 *      `tipo_actividad_id` o `relacionada_a` está presente, salvo
 *      cuando `requiere_tipo_actividad: true` (en cuyo caso el panel
 *      avisa al usuario que complete el tipo antes de publicar).
 *   4. Tiene i18n keys alcanzables en es/en/pt para titulo y descripcion.
 */

import { describe, expect, it } from 'vitest'
import {
  PLANTILLAS_COMPLETAR_ACTIVIDAD,
  plantillaCompletarActividadPorId,
} from '../workflows/plantillas-completar-actividad'
import { esAccionCompletarActividad } from '@/tipos/workflow'
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

describe('PLANTILLAS_COMPLETAR_ACTIVIDAD — catálogo declarativo', () => {
  it('tiene exactamente 4 plantillas (sub-PR 20.4 voto del coordinador)', () => {
    expect(PLANTILLAS_COMPLETAR_ACTIVIDAD).toHaveLength(4)
  })

  it('todos los ids son únicos', () => {
    const ids = PLANTILLAS_COMPLETAR_ACTIVIDAD.map((p) => p.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('plantillaCompletarActividadPorId resuelve y devuelve null para desconocidas', () => {
    expect(plantillaCompletarActividadPorId('cerrar_al_enviar_presupuesto')).not.toBeNull()
    expect(plantillaCompletarActividadPorId('inexistente')).toBeNull()
  })

  it('cada plantilla envuelta como AccionCompletarActividad pasa el type guard', () => {
    for (const p of PLANTILLAS_COMPLETAR_ACTIVIDAD) {
      const accion = {
        tipo: 'completar_actividad' as const,
        // Si la plantilla requiere tipo, ponemos uno sintético para el guard
        // (el panel obliga al usuario a setearlo en runtime).
        criterio: p.requiere_tipo_actividad
          ? { ...p.criterio, tipo_actividad_id: 'test-tipo-uuid' }
          : p.criterio,
      }
      expect(esAccionCompletarActividad(accion)).toBe(true)
    }
  })

  it('plantillas sin requiere_tipo_actividad tienen filtro positivo (regla del validador)', () => {
    for (const p of PLANTILLAS_COMPLETAR_ACTIVIDAD) {
      if (p.requiere_tipo_actividad) continue
      const tienePositivo = !!p.criterio.tipo_actividad_id || !!p.criterio.relacionada_a
      expect(tienePositivo, `Plantilla ${p.id} debe tener filtro positivo`).toBe(true)
    }
  })

  it('plantillas con requiere_tipo_actividad NO traen tipo_actividad_id (lo elige el user)', () => {
    for (const p of PLANTILLAS_COMPLETAR_ACTIVIDAD) {
      if (!p.requiere_tipo_actividad) continue
      expect(p.criterio.tipo_actividad_id).toBeUndefined()
    }
  })
})

describe('PLANTILLAS_COMPLETAR_ACTIVIDAD — i18n alcanzable', () => {
  for (const { nombre, obj } of LOCALES) {
    for (const p of PLANTILLAS_COMPLETAR_ACTIVIDAD) {
      it(`${nombre}: titulo de "${p.id}" existe y no es la clave raw`, () => {
        const clave = `flujos.editor.panel.completar_actividad.plantilla.${p.id}.titulo`
        const valor = leerClave(obj, clave)
        expect(valor).not.toBe(clave)
        expect(valor.length).toBeGreaterThan(5)
      })

      it(`${nombre}: descripcion de "${p.id}" existe y no es la clave raw`, () => {
        const clave = `flujos.editor.panel.completar_actividad.plantilla.${p.id}.descripcion`
        const valor = leerClave(obj, clave)
        expect(valor).not.toBe(clave)
        expect(valor.length).toBeGreaterThan(20)
      })
    }
  }
})

describe('Panel completar_actividad — claves i18n del shell alcanzables', () => {
  // Claves del shell del panel (labels + ayudas + plantillas + secciones
  // nuevas). Replica patrón de `flujos-panel-i18n.test.ts` para los
  // demás paneles.
  const CLAVES_OBLIGATORIAS: readonly string[] = [
    'flujos.editor.panel.seccion.criterio',
    'flujos.editor.panel.seccion.comportamiento',
    'flujos.editor.panel.seccion.plantillas',
    'flujos.editor.panel.completar_actividad.tipo_id_label',
    'flujos.editor.panel.completar_actividad.tipo_id_ayuda',
    'flujos.editor.panel.completar_actividad.relacionada_label',
    'flujos.editor.panel.completar_actividad.relacionada_ayuda',
    'flujos.editor.panel.completar_actividad.relacionada_ninguna',
    'flujos.editor.panel.completar_actividad.entidad_contacto',
    'flujos.editor.panel.completar_actividad.relacionada_entidad_id_label',
    'flujos.editor.panel.completar_actividad.relacionada_entidad_id_placeholder',
    'flujos.editor.panel.completar_actividad.contacto_label',
    'flujos.editor.panel.completar_actividad.contacto_placeholder',
    'flujos.editor.panel.completar_actividad.asignado_label',
    'flujos.editor.panel.completar_actividad.estado_label',
    'flujos.editor.panel.completar_actividad.estado_pendiente',
    'flujos.editor.panel.completar_actividad.estado_completada',
    'flujos.editor.panel.completar_actividad.estado_cancelada',
    'flujos.editor.panel.completar_actividad.si_multiple_label',
    'flujos.editor.panel.completar_actividad.si_multiple_mas_antigua',
    'flujos.editor.panel.completar_actividad.si_multiple_mas_reciente',
    'flujos.editor.panel.completar_actividad.si_multiple_todas',
    'flujos.editor.panel.completar_actividad.si_multiple_fallar',
    'flujos.editor.panel.completar_actividad.si_no_encuentra_label',
    'flujos.editor.panel.completar_actividad.si_no_encuentra_continuar',
    'flujos.editor.panel.completar_actividad.si_no_encuentra_fallar',
    'flujos.editor.panel.completar_actividad.motivo_label',
    'flujos.editor.panel.completar_actividad.motivo_placeholder',
    'flujos.editor.panel.completar_actividad.motivo_ayuda',
    'flujos.editor.panel.completar_actividad.plantillas_titulo',
    'flujos.editor.panel.completar_actividad.plantillas_ayuda',
    'flujos.editor.panel.completar_actividad.plantillas_aplicada',
    'flujos.editor.panel.completar_actividad.error_filtro_positivo',
  ]

  for (const { nombre, obj } of LOCALES) {
    for (const clave of CLAVES_OBLIGATORIAS) {
      it(`${nombre}: ${clave} alcanzable`, () => {
        const valor = leerClave(obj, clave)
        expect(valor).not.toBe(clave)
        expect(valor.length).toBeGreaterThan(0)
      })
    }
  }
})
