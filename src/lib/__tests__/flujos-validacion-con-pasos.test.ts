/**
 * Tests de `validarFlujoConPasos` (sub-PR 19.4).
 *
 * La función pura es la base del banner rojo + markers por-paso del
 * editor visual. Estos tests cubren:
 *
 *   1. Disparador inválido → error con `ruta = disparador`.
 *   2. Paso roto en raíz → error con `ruta = paso, pasoId = id del paso`.
 *   3. Paso roto dentro de un branch → `pasoId` apunta al paso interno
 *      (no al branch padre), para que el scroll-to-paso del banner
 *      vaya al lugar correcto.
 *   4. Branch con rama vacía → error con `pasoId = id del branch`
 *      (no hay paso interno al cual atribuirlo, así que cae al padre).
 *   5. Flujo válido completo → ok=true, errores vacíos.
 *
 * No depende de `validarPublicable`: se ejerce el shape-check completo
 * vía la función pública nueva, garantizando que la atribución de
 * `pasoId` es correcta independientemente del refactor interno.
 */

import { describe, expect, it } from 'vitest'
import { validarFlujoConPasos } from '@/lib/workflows/validacion-flujo'

const DISPARADOR_OK = {
  tipo: 'tiempo.cron',
  configuracion: { expresion: '0 9 * * *' },
}

function pasoEsperarOk(id: string) {
  return { id, tipo: 'esperar', duracion_ms: 60_000 }
}

function pasoTerminarOk(id: string) {
  return { id, tipo: 'terminar_flujo' }
}

describe('validarFlujoConPasos', () => {
  it('flujo válido: ok=true, errores vacíos', () => {
    const r = validarFlujoConPasos(DISPARADOR_OK, [pasoEsperarOk('a'), pasoTerminarOk('b')])
    expect(r.ok).toBe(true)
    expect(r.errores).toEqual([])
  })

  it('disparador no configurado → error con ruta=disparador', () => {
    const r = validarFlujoConPasos(null, [pasoEsperarOk('a')])
    expect(r.ok).toBe(false)
    const err = r.errores.find((e) => e.ruta.tipo === 'disparador')
    expect(err).toBeDefined()
  })

  it('disparador con tipo inexistente → error con ruta=disparador', () => {
    const r = validarFlujoConPasos({ tipo: 'inventado.tipo' }, [pasoEsperarOk('a')])
    const errs = r.errores.filter((e) => e.ruta.tipo === 'disparador')
    expect(errs.length).toBeGreaterThan(0)
  })

  it('lista vacía de pasos → error atribuido al disparador', () => {
    // No hay paso al cual atribuir "el flujo debe tener al menos una
    // acción", así que cae a disparador (decisión documentada).
    const r = validarFlujoConPasos(DISPARADOR_OK, [])
    expect(r.ok).toBe(false)
    expect(r.errores.some((e) => e.ruta.tipo === 'disparador')).toBe(true)
  })

  it('paso con tipo inexistente → error con pasoId del paso', () => {
    const r = validarFlujoConPasos(DISPARADOR_OK, [
      { id: 'paso-x', tipo: 'inventado_tipo' },
    ])
    expect(r.ok).toBe(false)
    const err = r.errores.find(
      (e) => e.ruta.tipo === 'paso' && e.ruta.pasoId === 'paso-x',
    )
    expect(err).toBeDefined()
  })

  it('paso "esperar" sin duración → error con pasoId del paso', () => {
    // Shape inválido: esperar requiere duracion_ms o hasta_fecha.
    const r = validarFlujoConPasos(DISPARADOR_OK, [
      { id: 'p1', tipo: 'esperar' },
    ])
    expect(r.ok).toBe(false)
    const err = r.errores.find(
      (e) => e.ruta.tipo === 'paso' && e.ruta.pasoId === 'p1',
    )
    expect(err).toBeDefined()
  })

  it('paso roto dentro de rama SI de branch → pasoId apunta al paso interno', () => {
    const r = validarFlujoConPasos(DISPARADOR_OK, [
      {
        id: 'branch-1',
        tipo: 'condicion_branch',
        condicion: { campo: 'entidad.estado', operador: 'igual', valor: 'pendiente' },
        acciones_si: [{ id: 'paso-roto', tipo: 'esperar' /* sin duracion */ }],
        acciones_no: [pasoTerminarOk('paso-fin')],
      },
    ])
    expect(r.ok).toBe(false)
    const err = r.errores.find(
      (e) => e.ruta.tipo === 'paso' && e.ruta.pasoId === 'paso-roto',
    )
    expect(err).toBeDefined()
    // No debería haber un error atribuido al branch padre por este paso
    // (sí puede haber otro error si la condición tiene shape inválido,
    // pero el del esperar tiene que ir al hijo).
    expect(
      r.errores.find(
        (e) => e.ruta.tipo === 'paso' && e.ruta.pasoId === 'branch-1' &&
        e.mensaje.toLowerCase().includes('esperar'),
      ),
    ).toBeUndefined()
  })

  it('paso roto dentro de rama NO de branch → pasoId apunta al paso interno', () => {
    const r = validarFlujoConPasos(DISPARADOR_OK, [
      {
        id: 'branch-2',
        tipo: 'condicion_branch',
        condicion: { campo: 'entidad.estado', operador: 'igual', valor: 'pendiente' },
        acciones_si: [pasoTerminarOk('si-ok')],
        acciones_no: [{ id: 'no-roto', tipo: 'esperar' }],
      },
    ])
    expect(r.ok).toBe(false)
    const err = r.errores.find(
      (e) => e.ruta.tipo === 'paso' && e.ruta.pasoId === 'no-roto',
    )
    expect(err).toBeDefined()
  })

  it('rama vacía de branch → pasoId apunta al branch padre', () => {
    // No hay paso interno, así que el error de "rama vacía" cae al
    // branch (mejor lugar para abrir el panel y entender el problema).
    const r = validarFlujoConPasos(DISPARADOR_OK, [
      {
        id: 'branch-3',
        tipo: 'condicion_branch',
        condicion: { campo: 'entidad.estado', operador: 'igual', valor: 'pendiente' },
        acciones_si: [],
        acciones_no: [pasoTerminarOk('ok')],
      },
    ])
    expect(r.ok).toBe(false)
    const err = r.errores.find(
      (e) => e.ruta.tipo === 'paso' && e.ruta.pasoId === 'branch-3',
    )
    expect(err).toBeDefined()
  })

  it('errores múltiples se acumulan en el array', () => {
    const r = validarFlujoConPasos(null, [
      { id: 'p1', tipo: 'esperar' },
      { id: 'p2', tipo: 'inventado_tipo' },
    ])
    expect(r.errores.length).toBeGreaterThanOrEqual(3) // disparador + 2 pasos
  })

  it('paso sin id (caso defensivo) → atribuye al disparador', () => {
    // No debería pasar en producción (el editor hidrata con
    // `asignarIdsAcciones`), pero validamos el comportamiento defensivo.
    const r = validarFlujoConPasos(DISPARADOR_OK, [{ tipo: 'esperar' }])
    expect(r.ok).toBe(false)
    const err = r.errores.find((e) => e.ruta.tipo === 'disparador')
    expect(err).toBeDefined()
  })
})
