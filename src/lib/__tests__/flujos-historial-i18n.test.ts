/**
 * Test de claves i18n alcanzables del historial de ejecuciones
 * (sub-PR 19.6).
 *
 * Mismo patrón que flujos-consola-i18n / flujos-panel-i18n: si una
 * clave de las que la UI consume se borra, renombra o queda vacía en
 * algún locale, este test la pinta antes del merge.
 *
 * Cobertura:
 *   • Tabs Editor / Historial (commit 1).
 *   • Placeholder cuando no hay ejecuciones (commit 1 → reemplazado en commit 2).
 *   • Listado: columnas, grupos, filtros, presets de fecha, estados,
 *     disparado_por, empty, hint dataset grande (commit 2).
 *   • Drawer: header, fechas, errores, no encontrada (commit 3).
 *   • Timeline: pasos, intentos, pendientes (commit 3).
 *   • Acciones: reejecutar / cancelar / copiar log + modales de
 *     confirmación (commit 4).
 *   • Sección chatter "Flujos disparados" (commit 5).
 */

import { describe, expect, it } from 'vitest'
import { es } from '@/lib/i18n/es'
import { en } from '@/lib/i18n/en'
import { pt } from '@/lib/i18n/pt'
import type { Traducciones } from '@/lib/i18n/tipos'
import {
  ESTADOS_EJECUCION,
} from '@/tipos/workflow'
import { TIPOS_DISPARADO_POR } from '@/app/(flux)/flujos/[id]/_componentes/_historial/formato-ejecucion'

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
  // ─── Tabs Editor / Historial (commit 1) ───────────────────────────
  'flujos.editor.tabs.aria_label',
  'flujos.editor.tabs.editor',
  'flujos.editor.tabs.historial',

  // ─── Placeholder pestaña (commit 1) ───────────────────────────────
  'flujos.historial.placeholder.titulo',
  'flujos.historial.placeholder.descripcion',

  // ─── Listado (commit 2) ───────────────────────────────────────────
  'flujos.historial.busqueda_placeholder',
  'flujos.historial.entidad_sin_referencia',
  'flujos.historial.hint_dataset_grande',

  'flujos.historial.columnas.estado',
  'flujos.historial.columnas.fecha',
  'flujos.historial.columnas.disparado_por',
  'flujos.historial.columnas.entidad',
  'flujos.historial.columnas.duracion',

  'flujos.historial.grupos.estado',
  'flujos.historial.grupos.cuando',
  'flujos.historial.grupos.origen',

  'flujos.historial.filtros.estado',
  'flujos.historial.filtros.estado_desc',
  'flujos.historial.filtros.disparado_por',
  'flujos.historial.filtros.disparado_por_desc',
  'flujos.historial.filtros.creado_rango',
  'flujos.historial.filtros.creado_rango_desc',
  'flujos.historial.filtros.error_raw_class',
  'flujos.historial.filtros.error_raw_class_desc',

  'flujos.historial.preset_fecha.hoy',
  'flujos.historial.preset_fecha.7d',
  'flujos.historial.preset_fecha.30d',
  'flujos.historial.preset_fecha.90d',

  'flujos.historial.disparado_por.desconocido',

  'flujos.historial.empty.sin_ejecuciones_titulo',
  'flujos.historial.empty.sin_ejecuciones_desc',

  // ─── Drawer (commit 3) ────────────────────────────────────────────
  'flujos.historial.drawer.titulo',
  'flujos.historial.drawer.cerrar',
  'flujos.historial.drawer.reintentar',
  'flujos.historial.drawer.creado_en',
  'flujos.historial.drawer.inicio',
  'flujos.historial.drawer.fin',
  'flujos.historial.drawer.no_encontrada_titulo',
  'flujos.historial.drawer.no_encontrada_desc',
  'flujos.historial.drawer.error_titulo',
  'flujos.historial.drawer.error_desc',

  // ─── Timeline (commit 3) ──────────────────────────────────────────
  'flujos.historial.timeline.sin_pasos',
  'flujos.historial.timeline.intentos',
  'flujos.historial.timeline.continuo_pese_fallo',
  'flujos.historial.timeline.pendientes',
  'flujos.historial.timeline.pendiente_estado',
  'flujos.historial.timeline.ejecutar_en',

  // ─── Acciones (commit 4) ──────────────────────────────────────────
  'flujos.historial.acciones.reejecutar',
  'flujos.historial.acciones.reejecutar_ok',
  'flujos.historial.acciones.reejecutar_error',
  'flujos.historial.acciones.cancelar',
  'flujos.historial.acciones.cancelar_ok',
  'flujos.historial.acciones.cancelar_error',
  'flujos.historial.acciones.cancelar_ya_termino',
  'flujos.historial.acciones.cancelar_corriendo',
  'flujos.historial.acciones.copiar_log',
  'flujos.historial.acciones.copiar_log_tooltip',
  'flujos.historial.acciones.copiar_log_ok',
  'flujos.historial.acciones.copiar_log_error',

  'flujos.historial.acciones.confirmar_reejecutar.titulo',
  'flujos.historial.acciones.confirmar_reejecutar.descripcion',
  'flujos.historial.acciones.confirmar_reejecutar.confirmar',

  'flujos.historial.acciones.confirmar_cancelar.titulo',
  'flujos.historial.acciones.confirmar_cancelar.descripcion',
  'flujos.historial.acciones.confirmar_cancelar.confirmar',

  // ─── Chatter (commit 5) ───────────────────────────────────────────
  'flujos.historial.chatter.titulo',
  'flujos.historial.chatter.flujo_sin_nombre',
]

describe('claves i18n del historial de flujos (sub-PR 19.6)', () => {
  it.each(LOCALES)('locale $nombre traduce todas las claves obligatorias', ({ obj }) => {
    for (const clave of CLAVES_OBLIGATORIAS) {
      const valor = leerClave(obj, clave)
      expect(valor, `clave faltante: ${clave}`).not.toBe(clave)
      expect(valor.length, `clave vacía: ${clave}`).toBeGreaterThan(0)
    }
  })

  // Las claves de estado y disparado_por se generan dinámicamente
  // desde el catálogo TS — si se agrega un estado nuevo a
  // ESTADOS_EJECUCION, tiene que tener su traducción acá.
  it.each(LOCALES)('locale $nombre traduce todos los EstadoEjecucion', ({ obj }) => {
    for (const estado of ESTADOS_EJECUCION) {
      const clave = `flujos.historial.estados.${estado}`
      const valor = leerClave(obj, clave)
      expect(valor, `falta traducción de estado: ${estado}`).not.toBe(clave)
      expect(valor.length).toBeGreaterThan(0)
    }
  })

  it.each(LOCALES)('locale $nombre traduce todos los TipoDisparadoPor', ({ obj }) => {
    for (const tipo of TIPOS_DISPARADO_POR) {
      const clave = `flujos.historial.disparado_por.${tipo}`
      const valor = leerClave(obj, clave)
      expect(valor, `falta traducción de disparado_por: ${tipo}`).not.toBe(clave)
      expect(valor.length).toBeGreaterThan(0)
    }
  })
})
