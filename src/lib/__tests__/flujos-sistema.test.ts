/**
 * Tests del catálogo de flujos del sistema (sub-PR 20.3).
 *
 * El catálogo `FLUJOS_SISTEMA` es el espejo TS del seed SQL de
 * `sql/067_flujos_sistema_autocompletar.sql`. Estos tests garantizan
 * que cada flujo sembrado:
 *
 *   1. Tiene shape válido publicable según `validarPublicable` — el
 *      mismo gate que el endpoint `/activar` aplica. Si `AccionCompletarActividad`
 *      cambia en TS, el catálogo queda alineado o este test pinta el
 *      síntoma antes de mergear.
 *
 *   2. Tiene `clave` único, `estado_inicial = 'pausado'` y descripciones
 *      legibles (no jerga interna como "sub-PR 20.5").
 *
 *   3. Cada disparador es un `entidad.estado_cambio` válido (forma
 *      esperada por el motor PR 14, narrowing por type guard).
 *
 *   4. Cada acción `completar_actividad` cumple las reglas votadas para
 *      el seed: `criterio.relacionada_a` apuntando a la entidad
 *      disparadora, `si_multiple = 'todas'`, `si_no_encuentra = 'continuar'`
 *      (consistente con el comportamiento del helper legacy: si no hay
 *      actividades vinculadas, no rompe la cadena).
 *
 * NO testeamos ejecución del flujo — eso lo cubre `workflows-executor-completar-actividad.test.ts`
 * desde el ángulo de `completar_actividad` con shapes equivalentes. El
 * test E2E de "el seed corre y queda exactamente 1 fila por empresa"
 * se hizo via Supabase MCP en flux-dev y NO se replica como test unit
 * (no hay infra de tests con BD real en el proyecto).
 */

import { describe, expect, it } from 'vitest'
import {
  FLUJOS_SISTEMA,
  flujoSistemaPorClave,
} from '../workflows/flujos-sistema'
import { validarPublicable } from '../workflows/validacion-flujo'
import {
  esDisparadorEntidadEstadoCambio,
  esAccionCompletarActividad,
} from '@/tipos/workflow'

describe('FLUJOS_SISTEMA — catálogo declarativo', () => {
  it('tiene los flujos del seed inicial 20.3 + los al_crear del 20.5', () => {
    const claves = FLUJOS_SISTEMA.map((f) => f.clave)
    // Sub-PR 20.3
    expect(claves).toContain('autocompletar_al_enviar_presupuesto')
    expect(claves).toContain('autocompletar_al_finalizar_visita')
    // Sub-PR 20.5 (paridad con evento_auto_completar='al_crear' del helper legacy)
    expect(claves).toContain('autocompletar_al_crear_presupuesto')
    expect(claves).toContain('autocompletar_al_crear_visita')
  })

  it('todas las claves son únicas (defensa idempotencia con UNIQUE en BD)', () => {
    const claves = FLUJOS_SISTEMA.map((f) => f.clave)
    expect(new Set(claves).size).toBe(claves.length)
  })

  it('estado_inicial corresponde al sub-PR de origen del flujo', () => {
    // Sub-PR 20.3: pausados (admin los activa explícitamente — la activación
    // automática la hace la migración 068 cuando ya no hay helper vivo).
    // Sub-PR 20.5: los al_crear van activos directo para mantener paridad
    // funcional con `evento_auto_completar='al_crear'` que se elimina.
    const esperados: Record<string, 'pausado' | 'activo'> = {
      autocompletar_al_enviar_presupuesto: 'pausado',
      autocompletar_al_finalizar_visita: 'pausado',
      autocompletar_al_crear_presupuesto: 'activo',
      autocompletar_al_crear_visita: 'activo',
    }
    for (const f of FLUJOS_SISTEMA) {
      expect(f.estado_inicial, `Flujo ${f.clave}`).toBe(esperados[f.clave])
    }
  })

  it('descripciones son legibles al admin (sin jerga interna)', () => {
    // El coordinador del 20.3 votó: nada de "sub-PR 20.X" en strings
    // visibles al admin. Si reaparece, este test rompe.
    const jerga = /sub-?PR|TODO|FIXME|placeholder|stub/i
    for (const f of FLUJOS_SISTEMA) {
      expect(f.descripcion, `Descripción del flujo ${f.clave}`).not.toMatch(jerga)
      expect(f.descripcion.length).toBeGreaterThan(40)
      expect(f.descripcion.length).toBeLessThan(500)
    }
  })

  it('flujoSistemaPorClave resuelve una clave conocida y devuelve null para una desconocida', () => {
    expect(flujoSistemaPorClave('autocompletar_al_enviar_presupuesto')).not.toBeNull()
    expect(flujoSistemaPorClave('inexistente_xyz')).toBeNull()
  })
})

describe('FLUJOS_SISTEMA — validación publicable (motor lo aceptaría al activar)', () => {
  for (const flujo of FLUJOS_SISTEMA) {
    it(`${flujo.clave} pasa validarPublicable`, () => {
      const r = validarPublicable(flujo.disparador, flujo.acciones)
      expect(r.ok, `Errores: ${r.errores.join(' | ')}`).toBe(true)
      expect(r.errores).toEqual([])
    })

    it(`${flujo.clave} tiene disparador entidad.estado_cambio bien formado`, () => {
      expect(esDisparadorEntidadEstadoCambio(flujo.disparador)).toBe(true)
    })

    it(`${flujo.clave} tiene exactamente 1 acción y es completar_actividad`, () => {
      expect(flujo.acciones).toHaveLength(1)
      const a = flujo.acciones[0]
      expect(esAccionCompletarActividad(a)).toBe(true)
    })
  }
})

describe('FLUJOS_SISTEMA — reglas de seed votadas en 20.3', () => {
  it('autocompletar_al_enviar_presupuesto: dispara en presupuesto→enviado y cierra todas las relacionadas', () => {
    const f = flujoSistemaPorClave('autocompletar_al_enviar_presupuesto')!
    expect(f.disparador.tipo).toBe('entidad.estado_cambio')
    if (f.disparador.tipo === 'entidad.estado_cambio') {
      expect(f.disparador.configuracion.entidad_tipo).toBe('presupuesto')
      expect(f.disparador.configuracion.hasta_clave).toBe('enviado')
    }
    const accion = f.acciones[0]
    if (esAccionCompletarActividad(accion)) {
      expect(accion.criterio.si_multiple).toBe('todas')
      expect(accion.criterio.si_no_encuentra).toBe('continuar')
      expect(accion.criterio.relacionada_a?.entidad_tipo).toBe('presupuesto')
      expect(accion.criterio.relacionada_a?.entidad_id).toBe('{{entidad.id}}')
    } else {
      throw new Error('La acción debería ser completar_actividad')
    }
  })

  it('autocompletar_al_finalizar_visita: dispara en visita→completada y cierra todas las relacionadas', () => {
    const f = flujoSistemaPorClave('autocompletar_al_finalizar_visita')!
    expect(f.disparador.tipo).toBe('entidad.estado_cambio')
    if (f.disparador.tipo === 'entidad.estado_cambio') {
      expect(f.disparador.configuracion.entidad_tipo).toBe('visita')
      expect(f.disparador.configuracion.hasta_clave).toBe('completada')
    }
    const accion = f.acciones[0]
    if (esAccionCompletarActividad(accion)) {
      expect(accion.criterio.si_multiple).toBe('todas')
      expect(accion.criterio.si_no_encuentra).toBe('continuar')
      expect(accion.criterio.relacionada_a?.entidad_tipo).toBe('visita')
      expect(accion.criterio.relacionada_a?.entidad_id).toBe('{{entidad.id}}')
    } else {
      throw new Error('La acción debería ser completar_actividad')
    }
  })
})

describe('FLUJOS_SISTEMA — reglas de seed votadas en 20.5 (al_crear)', () => {
  it('autocompletar_al_crear_presupuesto: dispara en creación de presupuesto (solo_creacion=true) y cierra todas las relacionadas', () => {
    const f = flujoSistemaPorClave('autocompletar_al_crear_presupuesto')!
    expect(f.disparador.tipo).toBe('entidad.estado_cambio')
    if (f.disparador.tipo === 'entidad.estado_cambio') {
      expect(f.disparador.configuracion.entidad_tipo).toBe('presupuesto')
      expect(f.disparador.configuracion.hasta_clave).toBe('borrador')
      expect(f.disparador.configuracion.solo_creacion).toBe(true)
    }
    const accion = f.acciones[0]
    if (esAccionCompletarActividad(accion)) {
      expect(accion.criterio.si_multiple).toBe('todas')
      expect(accion.criterio.si_no_encuentra).toBe('continuar')
      expect(accion.criterio.relacionada_a?.entidad_tipo).toBe('presupuesto')
      expect(accion.criterio.relacionada_a?.entidad_id).toBe('{{entidad.id}}')
    } else {
      throw new Error('La acción debería ser completar_actividad')
    }
  })

  it('autocompletar_al_crear_visita: dispara en creación de visita (solo_creacion=true) y cierra todas las relacionadas', () => {
    const f = flujoSistemaPorClave('autocompletar_al_crear_visita')!
    expect(f.disparador.tipo).toBe('entidad.estado_cambio')
    if (f.disparador.tipo === 'entidad.estado_cambio') {
      expect(f.disparador.configuracion.entidad_tipo).toBe('visita')
      expect(f.disparador.configuracion.hasta_clave).toBe('programada')
      expect(f.disparador.configuracion.solo_creacion).toBe(true)
    }
    const accion = f.acciones[0]
    if (esAccionCompletarActividad(accion)) {
      expect(accion.criterio.si_multiple).toBe('todas')
      expect(accion.criterio.si_no_encuentra).toBe('continuar')
      expect(accion.criterio.relacionada_a?.entidad_tipo).toBe('visita')
      expect(accion.criterio.relacionada_a?.entidad_id).toBe('{{entidad.id}}')
    } else {
      throw new Error('La acción debería ser completar_actividad')
    }
  })
})
