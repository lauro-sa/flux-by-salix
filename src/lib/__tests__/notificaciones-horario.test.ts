/**
 * Tests del gate de horario para notificaciones diferidas.
 *
 * Cubre las funciones puras `horaEnRango` y `permiteNotificar`.
 * `puedeNotificarAhora` no se testea acá porque depende de Supabase
 * (su lógica de cascada miembro→empresa se cubre indirectamente vía
 * `permiteNotificar` con distintos JSONs).
 */

import { describe, expect, it } from 'vitest'
import {
  horaEnRango,
  permiteNotificar,
  type HorarioNotificaciones,
} from '@/lib/notificaciones-horario'

const HORARIO_OFICINA: HorarioNotificaciones = {
  activo: true,
  dias: {
    lunes:     { activo: true,  desde: '09:00', hasta: '18:00' },
    martes:    { activo: true,  desde: '09:00', hasta: '18:00' },
    miercoles: { activo: true,  desde: '09:00', hasta: '18:00' },
    jueves:    { activo: true,  desde: '09:00', hasta: '18:00' },
    viernes:   { activo: true,  desde: '09:00', hasta: '18:00' },
    sabado:    { activo: false, desde: '09:00', hasta: '13:00' },
    domingo:   { activo: false, desde: '09:00', hasta: '13:00' },
  },
}

const HORARIO_NOCTURNO: HorarioNotificaciones = {
  activo: true,
  dias: {
    lunes:     { activo: true, desde: '22:00', hasta: '06:00' },
    martes:    { activo: true, desde: '22:00', hasta: '06:00' },
    miercoles: { activo: true, desde: '22:00', hasta: '06:00' },
    jueves:    { activo: true, desde: '22:00', hasta: '06:00' },
    viernes:   { activo: true, desde: '22:00', hasta: '06:00' },
    sabado:    { activo: true, desde: '22:00', hasta: '06:00' },
    domingo:   { activo: true, desde: '22:00', hasta: '06:00' },
  },
}

describe('horaEnRango', () => {
  it('rango normal: incluye desde, excluye hasta', () => {
    expect(horaEnRango('09:00', '09:00', '18:00')).toBe(true)
    expect(horaEnRango('12:30', '09:00', '18:00')).toBe(true)
    expect(horaEnRango('17:59', '09:00', '18:00')).toBe(true)
    expect(horaEnRango('18:00', '09:00', '18:00')).toBe(false)
    expect(horaEnRango('08:59', '09:00', '18:00')).toBe(false)
  })

  it('rango invertido (cruza medianoche)', () => {
    expect(horaEnRango('23:00', '22:00', '06:00')).toBe(true)
    expect(horaEnRango('03:00', '22:00', '06:00')).toBe(true)
    expect(horaEnRango('06:00', '22:00', '06:00')).toBe(false)
    expect(horaEnRango('21:59', '22:00', '06:00')).toBe(false)
    expect(horaEnRango('12:00', '22:00', '06:00')).toBe(false)
  })

  it('rango de hora idéntica = 24h cubiertas', () => {
    expect(horaEnRango('00:00', '09:00', '09:00')).toBe(true)
    expect(horaEnRango('15:30', '09:00', '09:00')).toBe(true)
  })
})

describe('permiteNotificar', () => {
  // Zona AR (UTC-3): un Date construido con Date.UTC ya está en UTC.
  // Para "lunes 12:00 hora AR" → 12:00 + 3 = 15:00 UTC.
  const zonaAR = 'America/Argentina/Buenos_Aires'
  const lunes12hAR = new Date(Date.UTC(2026, 4, 11, 15, 0))   // 2026-05-11 (lunes) 12:00 AR
  const lunes03hAR = new Date(Date.UTC(2026, 4, 11, 6, 0))    // 2026-05-11 (lunes) 03:00 AR
  const sabado12hAR = new Date(Date.UTC(2026, 4, 16, 15, 0))  // 2026-05-16 (sábado) 12:00 AR
  const domingo23hAR = new Date(Date.UTC(2026, 4, 18, 2, 0))  // domingo 23:00 AR (lunes 02:00 UTC)

  it('horario null/undefined → permite siempre (fail-open)', () => {
    expect(permiteNotificar(null, zonaAR, lunes03hAR)).toBe(true)
    expect(permiteNotificar(undefined, zonaAR, lunes03hAR)).toBe(true)
  })

  it('horario con activo=false → permite siempre', () => {
    const desactivado: HorarioNotificaciones = { ...HORARIO_OFICINA, activo: false }
    expect(permiteNotificar(desactivado, zonaAR, lunes03hAR)).toBe(true)
  })

  it('oficina 9-18 lun-vie: lunes 12:00 AR pasa', () => {
    expect(permiteNotificar(HORARIO_OFICINA, zonaAR, lunes12hAR)).toBe(true)
  })

  it('oficina 9-18 lun-vie: lunes 03:00 AR bloquea (el bug original)', () => {
    expect(permiteNotificar(HORARIO_OFICINA, zonaAR, lunes03hAR)).toBe(false)
  })

  it('oficina 9-18 lun-vie: sábado bloqueado', () => {
    expect(permiteNotificar(HORARIO_OFICINA, zonaAR, sabado12hAR)).toBe(false)
  })

  it('turno nocturno 22-06: domingo 23:00 pasa', () => {
    expect(permiteNotificar(HORARIO_NOCTURNO, zonaAR, domingo23hAR)).toBe(true)
  })

  it('respeta zona horaria: lunes 12:00 UTC = lunes 09:00 AR (pasa)', () => {
    const lunes12UTC = new Date(Date.UTC(2026, 4, 11, 12, 0))
    expect(permiteNotificar(HORARIO_OFICINA, zonaAR, lunes12UTC)).toBe(true)
  })

  it('respeta zona horaria: lunes 06:00 UTC = lunes 03:00 AR (bloqueado)', () => {
    const lunes06UTC = new Date(Date.UTC(2026, 4, 11, 6, 0))
    expect(permiteNotificar(HORARIO_OFICINA, zonaAR, lunes06UTC)).toBe(false)
  })

  it('zona Madrid (UTC+2 en mayo): lunes 11:00 UTC = lunes 13:00 Madrid (pasa)', () => {
    const lunes11UTC = new Date(Date.UTC(2026, 4, 11, 11, 0))
    expect(permiteNotificar(HORARIO_OFICINA, 'Europe/Madrid', lunes11UTC)).toBe(true)
  })
})
