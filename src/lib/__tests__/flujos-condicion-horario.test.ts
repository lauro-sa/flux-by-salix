/**
 * Tests del evaluador de `CondicionHorario`.
 *
 * Cubre los puntos delicados:
 *   - Zona horaria distinta a UTC (server de Vercel corre en UTC,
 *     pero el flujo evalúa en zona horaria del usuario).
 *   - Cross-medianoche (rango que cruza las 00:00).
 *   - modo='dentro' vs modo='fuera' devuelven valores opuestos en
 *     todos los casos.
 *   - Falla cerrada para zonas horarias inválidas y formatos rotos.
 *   - Días vacíos: defensa además del validador.
 */

import { describe, it, expect } from 'vitest'
import { evaluarCondicion } from '@/lib/workflows/evaluar-condicion'
import type { CondicionHorario } from '@/tipos/workflow'

const BUE = 'America/Argentina/Buenos_Aires'

/**
 * Construye un Date que en UTC corresponde a la fecha+hora dada en
 * Buenos Aires (UTC-3 todo el año, sin DST). Útil para escribir tests
 * legibles tipo "el lunes a las 14:30 hora argentina".
 */
function dateEnBuenosAires(
  anio: number,
  mes: number,
  dia: number,
  hora: number,
  minuto: number,
): Date {
  // BUE = UTC-3 → la hora local sumada 3 hs es UTC.
  return new Date(Date.UTC(anio, mes - 1, dia, hora + 3, minuto))
}

describe('evaluarCondicion - CondicionHorario', () => {
  const horarioLaboralBUE: CondicionHorario = {
    tipo: 'horario',
    modo: 'dentro',
    zona_horaria: BUE,
    dias: ['lun', 'mar', 'mie', 'jue', 'vie'],
    hora_desde: '09:00',
    hora_hasta: '18:00',
  }

  describe('modo "dentro"', () => {
    it('lunes 14:30 en BUE → true (en horario)', () => {
      // Lunes 4 de mayo de 2026, 14:30 BUE.
      const ahora = dateEnBuenosAires(2026, 5, 4, 14, 30)
      expect(evaluarCondicion(horarioLaboralBUE, {}, ahora)).toBe(true)
    })

    it('lunes 08:59 en BUE → false (antes del horario)', () => {
      const ahora = dateEnBuenosAires(2026, 5, 4, 8, 59)
      expect(evaluarCondicion(horarioLaboralBUE, {}, ahora)).toBe(false)
    })

    it('lunes 09:00 en BUE → true (límite inferior inclusivo)', () => {
      const ahora = dateEnBuenosAires(2026, 5, 4, 9, 0)
      expect(evaluarCondicion(horarioLaboralBUE, {}, ahora)).toBe(true)
    })

    it('lunes 18:00 en BUE → false (límite superior exclusivo)', () => {
      const ahora = dateEnBuenosAires(2026, 5, 4, 18, 0)
      expect(evaluarCondicion(horarioLaboralBUE, {}, ahora)).toBe(false)
    })

    it('sábado 14:00 en BUE → false (día no incluido)', () => {
      // Sábado 9 de mayo de 2026.
      const ahora = dateEnBuenosAires(2026, 5, 9, 14, 0)
      expect(evaluarCondicion(horarioLaboralBUE, {}, ahora)).toBe(false)
    })
  })

  describe('modo "fuera"', () => {
    const fueraHorario: CondicionHorario = { ...horarioLaboralBUE, modo: 'fuera' }

    it('lunes 14:30 BUE → false (estamos en horario)', () => {
      const ahora = dateEnBuenosAires(2026, 5, 4, 14, 30)
      expect(evaluarCondicion(fueraHorario, {}, ahora)).toBe(false)
    })

    it('lunes 22:00 BUE → true (fuera del horario laboral)', () => {
      const ahora = dateEnBuenosAires(2026, 5, 4, 22, 0)
      expect(evaluarCondicion(fueraHorario, {}, ahora)).toBe(true)
    })

    it('sábado 14:00 BUE → false (sábado no está en días marcados, no aplica)', () => {
      // Semántica 2026-05-20: días no marcados nunca matchean. Para
      // disparar también en Sáb/Dom, el usuario debe marcarlos
      // explícitamente o agregar otro rango.
      const ahora = dateEnBuenosAires(2026, 5, 9, 14, 0)
      expect(evaluarCondicion(fueraHorario, {}, ahora)).toBe(false)
    })

    it('domingo 03:00 BUE → false (domingo no está en días marcados)', () => {
      // Domingo 10 de mayo 2026.
      const ahora = dateEnBuenosAires(2026, 5, 10, 3, 0)
      expect(evaluarCondicion(fueraHorario, {}, ahora)).toBe(false)
    })
  })

  describe('cruce de zona horaria server → BUE', () => {
    it('lunes 03:00 UTC = lunes 00:00 BUE → fuera de horario laboral', () => {
      // El servidor está en UTC. Si usáramos new Date().getHours() acá
      // sería 03:00 UTC; en BUE (UTC-3) son las 00:00 del mismo lunes.
      // El motor debe evaluar la hora local (00:00 está fuera de 9-18),
      // no la UTC.
      const ahora = new Date(Date.UTC(2026, 4, 4, 3, 0)) // lunes 4 de mayo 03:00 UTC
      const fueraHorario: CondicionHorario = { ...horarioLaboralBUE, modo: 'fuera' }
      expect(evaluarCondicion(fueraHorario, {}, ahora)).toBe(true)
      expect(evaluarCondicion(horarioLaboralBUE, {}, ahora)).toBe(false)
    })
  })

  describe('rango cross-medianoche', () => {
    const horarioNocturno: CondicionHorario = {
      tipo: 'horario',
      modo: 'dentro',
      zona_horaria: BUE,
      dias: ['lun', 'mar', 'mie', 'jue', 'vie', 'sab', 'dom'],
      hora_desde: '22:00',
      hora_hasta: '06:00',
    }

    it('23:30 BUE → true (después de hora_desde)', () => {
      const ahora = dateEnBuenosAires(2026, 5, 4, 23, 30)
      expect(evaluarCondicion(horarioNocturno, {}, ahora)).toBe(true)
    })

    it('02:00 BUE → true (antes de hora_hasta)', () => {
      const ahora = dateEnBuenosAires(2026, 5, 4, 2, 0)
      expect(evaluarCondicion(horarioNocturno, {}, ahora)).toBe(true)
    })

    it('14:00 BUE → false (fuera de ambos extremos)', () => {
      const ahora = dateEnBuenosAires(2026, 5, 4, 14, 0)
      expect(evaluarCondicion(horarioNocturno, {}, ahora)).toBe(false)
    })

    it('06:00 BUE → false (límite superior exclusivo)', () => {
      const ahora = dateEnBuenosAires(2026, 5, 4, 6, 0)
      expect(evaluarCondicion(horarioNocturno, {}, ahora)).toBe(false)
    })

    it('22:00 BUE → true (límite inferior inclusivo)', () => {
      const ahora = dateEnBuenosAires(2026, 5, 4, 22, 0)
      expect(evaluarCondicion(horarioNocturno, {}, ahora)).toBe(true)
    })
  })

  describe('casos defensivos', () => {
    it('zona horaria inválida → false (falla cerrada)', () => {
      const cond: CondicionHorario = {
        ...horarioLaboralBUE,
        zona_horaria: 'Foo/Bar_Invalid',
      }
      const ahora = dateEnBuenosAires(2026, 5, 4, 14, 30)
      expect(evaluarCondicion(cond, {}, ahora)).toBe(false)
    })

    it('días vacíos + modo dentro → false (defensa)', () => {
      const cond = { ...horarioLaboralBUE, dias: [] }
      const ahora = dateEnBuenosAires(2026, 5, 4, 14, 30)
      expect(evaluarCondicion(cond, {}, ahora)).toBe(false)
    })

    it('días vacíos + modo fuera → false (semántica 2026-05-20: días vacíos nunca matchean)', () => {
      // Antes esto retornaba true porque "fuera de ningún horario = todo
      // el tiempo fuera". El nuevo motor es estricto: sin días marcados,
      // la condición no aplica nunca, independiente del modo.
      const cond = { ...horarioLaboralBUE, dias: [], modo: 'fuera' as const }
      const ahora = dateEnBuenosAires(2026, 5, 4, 14, 30)
      expect(evaluarCondicion(cond, {}, ahora)).toBe(false)
    })

    it('hora_desde mal formada → false', () => {
      const cond = { ...horarioLaboralBUE, hora_desde: '9:00' } // sin pad
      const ahora = dateEnBuenosAires(2026, 5, 4, 14, 30)
      expect(evaluarCondicion(cond, {}, ahora)).toBe(false)
    })

    it('hora_hasta mal formada → false', () => {
      const cond = { ...horarioLaboralBUE, hora_hasta: '25:00' } // hora inválida
      const ahora = dateEnBuenosAires(2026, 5, 4, 14, 30)
      expect(evaluarCondicion(cond, {}, ahora)).toBe(false)
    })
  })

  describe('integración con CondicionCompuesta', () => {
    it('horario + condición sobre contexto en AND', () => {
      const cond = {
        operador: 'y' as const,
        condiciones: [
          horarioLaboralBUE,
          { campo: 'entidad.tipo', operador: 'igual' as const, valor: 'mensaje' },
        ],
      }
      const ahora = dateEnBuenosAires(2026, 5, 4, 14, 30)
      expect(
        evaluarCondicion(cond, { entidad: { tipo: 'mensaje' } }, ahora),
      ).toBe(true)
      expect(
        evaluarCondicion(cond, { entidad: { tipo: 'actividad' } }, ahora),
      ).toBe(false)
    })
  })
})
