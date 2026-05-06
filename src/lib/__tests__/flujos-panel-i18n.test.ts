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

  // ─── Sub-PR 19.3b ────────────────────────────────────────────

  'flujos.editor.panel.header.editar_nombre_tooltip',

  // Avanzado · continuar_si_falla
  'flujos.editor.panel.avanzado.continuar_si_falla_label',
  'flujos.editor.panel.avanzado.continuar_si_falla_ayuda',

  // Acción: enviar_whatsapp_plantilla
  'flujos.editor.panel.whatsapp.canal_label',
  'flujos.editor.panel.whatsapp.telefono_label',
  'flujos.editor.panel.whatsapp.plantilla_label',
  'flujos.editor.panel.whatsapp.idioma_label',

  // Acción: notificar_usuario
  'flujos.editor.panel.notificar.usuario_label',
  'flujos.editor.panel.notificar.titulo_label',
  'flujos.editor.panel.notificar.cuerpo_label',
  'flujos.editor.panel.notificar.url_label',

  // Acción: crear_actividad
  'flujos.editor.panel.actividad.tipo_id_label',
  'flujos.editor.panel.actividad.titulo_label',
  'flujos.editor.panel.actividad.descripcion_label',
  'flujos.editor.panel.actividad.prioridad_label',
  'flujos.editor.panel.actividad.prioridad_baja',
  'flujos.editor.panel.actividad.prioridad_normal',
  'flujos.editor.panel.actividad.prioridad_alta',

  // Acción: cambiar_estado_entidad
  'flujos.editor.panel.cambiar_estado.entidad_label',
  'flujos.editor.panel.cambiar_estado.entidad_id_label',
  'flujos.editor.panel.cambiar_estado.hasta_clave_label',
  'flujos.editor.panel.cambiar_estado.entidad.presupuesto',
  'flujos.editor.panel.cambiar_estado.entidad.cuota',
  'flujos.editor.panel.cambiar_estado.entidad.actividad',

  // Disparadores
  'flujos.editor.panel.entidad_estado_cambio.entidad_label',
  'flujos.editor.panel.entidad_estado_cambio.hasta_label',
  'flujos.editor.panel.entidad_estado_cambio.desde_label',
  'flujos.editor.panel.entidad_creada.entidad_label',
  'flujos.editor.panel.entidad_campo_cambia.entidad_label',
  'flujos.editor.panel.entidad_campo_cambia.campo_label',
  'flujos.editor.panel.entidad_campo_cambia.valor_label',
  'flujos.editor.panel.relativo_a_campo.entidad_label',
  'flujos.editor.panel.relativo_a_campo.campo_fecha_label',
  'flujos.editor.panel.relativo_a_campo.delta_label',
  'flujos.editor.panel.relativo_a_campo.hora_local_label',
  'flujos.editor.panel.relativo_a_campo.tolerancia_label',

  // Picker
  'flujos.picker.titulo',
  'flujos.picker.buscador_placeholder',
  'flujos.picker.tab_todas',
  'flujos.picker.sin_resultados',
  'flujos.picker.boton_insertar',
  'flujos.picker.fuente.entidad',
  'flujos.picker.fuente.contacto',
  'flujos.picker.fuente.empresa',
  'flujos.picker.fuente.sistema',
  'flujos.picker.fuente.cambio',
  'flujos.picker.fuente.actor',

  // Variables (un sample por fuente — el catálogo completo es deuda
  // documentada en variables-disponibles.ts)
  'flujos.variables.presupuesto.numero',
  'flujos.variables.cuota.fecha_vencimiento',
  'flujos.variables.contacto.nombre',
  'flujos.variables.empresa.nombre',
  'flujos.variables.sistema.ahora',
  'flujos.variables.actor.nombre_completo',
  'flujos.variables.cambio.desde',

  // Fallback de etiqueta de acción cuando el tipo se desconoce.
  'flujos.accion.sin_tipo',

  // ─── Sub-PR 19.3c ────────────────────────────────────────────

  // Sección Condiciones (label uppercase)
  'flujos.editor.panel.seccion.condiciones',

  // Branch builder
  'flujos.editor.panel.branch.operador_label',
  'flujos.editor.panel.branch.operador_y',
  'flujos.editor.panel.branch.operador_o',
  'flujos.editor.panel.branch.ayuda_y',
  'flujos.editor.panel.branch.ayuda_o',
  'flujos.editor.panel.branch.sin_condiciones',
  'flujos.editor.panel.branch.agregar_condicion',
  'flujos.editor.panel.branch.fila_anidada_no_editable',
  'flujos.editor.panel.branch.fila.variable_label',
  'flujos.editor.panel.branch.fila.valor_label',
  'flujos.editor.panel.branch.fila.eliminar',

  // Operadores del Branch — los 10
  'flujos.editor.panel.branch.op.igual',
  'flujos.editor.panel.branch.op.distinto',
  'flujos.editor.panel.branch.op.mayor',
  'flujos.editor.panel.branch.op.menor',
  'flujos.editor.panel.branch.op.mayor_o_igual',
  'flujos.editor.panel.branch.op.menor_o_igual',
  'flujos.editor.panel.branch.op.contiene',
  'flujos.editor.panel.branch.op.no_contiene',
  'flujos.editor.panel.branch.op.esta_vacio',
  'flujos.editor.panel.branch.op.no_esta_vacio',

  // Tipos baratos: asignar_usuario, etiquetas, notificar_grupo,
  // whatsapp_texto, correo_texto.
  'flujos.editor.panel.asignar.usuario_label',
  'flujos.editor.panel.asignar.entidad_id_label',
  'flujos.editor.panel.etiqueta.agregar_label',
  'flujos.editor.panel.etiqueta.quitar_label',
  'flujos.editor.panel.etiqueta.clave_ayuda',
  'flujos.editor.panel.notificar_grupo.grupo_label',
  'flujos.editor.panel.notificar_grupo.titulo_label',
  'flujos.editor.panel.notificar_grupo.cuerpo_label',
  'flujos.editor.panel.whatsapp_texto.mensaje_label',
  'flujos.editor.panel.correo_texto.destinatario_label',
  'flujos.editor.panel.correo_texto.asunto_label',
  'flujos.editor.panel.correo_texto.cuerpo_label',

  // Selectores autocomplete
  'flujos.selector.buscar',
  'flujos.selector.cargando',
  'flujos.selector.error_cargar',
  'flujos.selector.sin_resultados',
  'flujos.selector.canal_wa.placeholder',
  'flujos.selector.plantilla_wa.placeholder',
  'flujos.selector.tipo_actividad.placeholder',
  'flujos.selector.miembro.placeholder',
  'flujos.selector.miembro.placeholder_multi',
  'flujos.selector.estado.placeholder',

  // ─── Sub-PR 19.3d ────────────────────────────────────────────

  // Picker mobile (helpers acordeón)
  'flujos.picker.helpers_mostrar',
  'flujos.picker.helpers_ocultar',

  // Selectores 19.3d
  'flujos.selector.etiqueta.placeholder',
  'flujos.selector.plantilla_correo.placeholder',

  // Panel: enviar_correo_plantilla
  'flujos.editor.panel.correo_plantilla.plantilla_label',
  'flujos.editor.panel.correo_plantilla.plantilla_ayuda',
  'flujos.editor.panel.correo_plantilla.destinatario_label',
  'flujos.editor.panel.correo_plantilla.preview_titulo',
  'flujos.editor.panel.correo_plantilla.preview_asunto_label',
  'flujos.editor.panel.correo_plantilla.preview_cuerpo_label',
  'flujos.editor.panel.correo_plantilla.preview_ayuda',

  // Panel: JSON crudo (genérico)
  'flujos.editor.panel.generico_json.cartel_titulo',
  'flujos.editor.panel.generico_json.cartel_descripcion',
  'flujos.editor.panel.generico_json.cartel_aviso_no_guarda',
  'flujos.editor.panel.generico_json.formatear',
  'flujos.editor.panel.generico_json.error_parse',
  'flujos.editor.panel.generico_json.error_no_objeto',
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
