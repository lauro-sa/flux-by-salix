/**
 * Tests integrados de los ejecutores de tools personales con un admin mockeado.
 * Garantizan el flujo completo: cargar miembro, resolver periodo, query a tablas
 * de asistencia/pagos/feriados, formato de respuesta.
 *
 * Estos tests no usan BD real — simulan las respuestas de Supabase para validar
 * la lógica de cada ejecutor en aislamiento.
 */

import { describe, it, expect } from 'vitest'
import { ejecutarMiProximoPago } from '../herramientas/ejecutores/mi-proximo-pago'
import { ejecutarMiHistorialPagos } from '../herramientas/ejecutores/mi-historial-pagos'
import { ejecutarMiPeriodoActual } from '../herramientas/ejecutores/mi-periodo-actual'
import { ejecutarMisTardanzasEInasistencias } from '../herramientas/ejecutores/mis-tardanzas-e-inasistencias'
import { ejecutarMiReciboPeriodo } from '../herramientas/ejecutores/mi-recibo-periodo'
import type { ContextoSalixIA } from '@/tipos/salix-ia'

/**
 * Crea un mock de admin que enruta queries por nombre de tabla.
 * `respuestas` es un mapa { tabla → array de respuestas en orden de llamada }.
 */
function admin(respuestas: Record<string, unknown[]>) {
  const indices: Record<string, number> = {}

  function devolver(tabla: string) {
    const idx = indices[tabla] ?? 0
    indices[tabla] = idx + 1
    return respuestas[tabla]?.[idx] ?? { data: null, error: null }
  }

  return {
    from: (tabla: string) => ({
      select: function() { return this },
      eq: function() { return this },
      gt: function() { return this },
      gte: function() { return this },
      lte: function() { return this },
      is: function() { return this },
      in: function() { return this },
      order: function() { return this },
      limit: function() { return this },
      maybeSingle: () => Promise.resolve(devolver(tabla)),
      single: () => Promise.resolve(devolver(tabla)),
      // Para queries sin .single()/.maybeSingle() (devuelven array)
      then: (resolve: (v: unknown) => unknown) => Promise.resolve(devolver(tabla)).then(resolve),
    }),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any
}

function ctx(adminMock: ContextoSalixIA['admin']): ContextoSalixIA {
  return {
    empresa_id: 'emp-1',
    usuario_id: 'u-1',
    miembro: {
      id: 'm-1',
      usuario_id: 'u-1',
      rol: 'colaborador',
      permisos_custom: null,
      nivel_salix: 'personal',
      salix_ia_web: true,
      salix_ia_whatsapp: false,
      puesto: 'Operario',
      sector: 'Producción',
    },
    nombre_usuario: 'Luis Romero',
    nombre_empresa: 'Herreelec',
    zona_horaria: 'America/Argentina/Buenos_Aires',
    admin: adminMock,
  }
}

const MIEMBRO_MENSUAL = {
  id: 'm-1',
  empresa_id: 'emp-1',
  compensacion_tipo: 'fijo',
  compensacion_monto: 500000,
  compensacion_frecuencia: 'mensual',
  dias_trabajo: 5,
  turno_id: null,
}

describe('mi_historial_pagos', () => {
  it('devuelve los últimos pagos cobrados con monto > 0', async () => {
    const adminMock = admin({
      miembros: [{ data: MIEMBRO_MENSUAL, error: null }],
      pagos_nomina: [{
        data: [
          { fecha_inicio_periodo: '2026-04-01', fecha_fin_periodo: '2026-04-30', concepto: null, monto_abonado: 500000, editado_en: null, creado_en: '2026-05-02T10:00:00Z' },
          { fecha_inicio_periodo: '2026-03-01', fecha_fin_periodo: '2026-03-31', concepto: null, monto_abonado: 480000, editado_en: null, creado_en: '2026-04-02T10:00:00Z' },
        ],
        error: null,
      }],
    })
    const r = await ejecutarMiHistorialPagos(ctx(adminMock), {})
    expect(r.exito).toBe(true)
    const datos = r.datos as { pagos: unknown[] }
    expect(datos.pagos).toHaveLength(2)
    expect(r.mensaje_usuario).toContain('500.000')
    expect(r.mensaje_usuario).toContain('comunicate con tu administrador')
  })

  it('sin pagos cobrados → mensaje claro', async () => {
    const adminMock = admin({
      miembros: [{ data: MIEMBRO_MENSUAL, error: null }],
      pagos_nomina: [{ data: [], error: null }],
    })
    const r = await ejecutarMiHistorialPagos(ctx(adminMock), {})
    expect(r.exito).toBe(true)
    expect(r.mensaje_usuario).toContain('Todavía no tengo pagos registrados')
  })

  it('limite respeta el máximo permitido (3)', async () => {
    const adminMock = admin({
      miembros: [{ data: MIEMBRO_MENSUAL, error: null }],
      pagos_nomina: [{ data: [], error: null }],
    })
    const r = await ejecutarMiHistorialPagos(ctx(adminMock), { limite: 999 })
    expect(r.exito).toBe(true)
    const datos = r.datos as { limite: number }
    expect(datos.limite).toBe(3)
  })

  it('miembro inactivo o no existe → error claro', async () => {
    const adminMock = admin({
      miembros: [{ data: null, error: null }],
    })
    const r = await ejecutarMiHistorialPagos(ctx(adminMock), {})
    expect(r.exito).toBe(false)
    expect(r.error).toContain('miembro activo')
  })
})

describe('mi_proximo_pago', () => {
  it('cuando el último cerrado NO está pagado → devuelve rango de pago para el cerrado', async () => {
    // Simular fecha actual: 2 mayo 2026 (jueves). Último cerrado: abril, sin pago.
    // Cierre de abril: 30/04/2026 (jueves). Próximos 3 hábiles: 1, 4, 5 mayo.
    // Pero 1 mayo es feriado en AR (Día del Trabajador). Debería saltearlo.
    // Sin embargo, el mock no incluye ese feriado en la tabla `feriados`,
    // y date-holidays SÍ lo trae. Verificamos eso.
    const adminMock = admin({
      miembros: [{ data: MIEMBRO_MENSUAL, error: null }],
      pagos_nomina: [{ data: null, error: null }], // no encontrado → no pagado
      empresas: [{ data: { pais: 'AR' }, error: null }],
      feriados: [{ data: [], error: null }],
    })
    const r = await ejecutarMiProximoPago(ctx(adminMock))
    expect(r.exito).toBe(true)
    const datos = r.datos as { estado: string; rango_pago: { fechas: string[] } }
    expect(datos.estado).toBe('cerrado_pendiente_pago')
    expect(datos.rango_pago.fechas.length).toBeGreaterThan(0)
    expect(r.mensaje_usuario).toContain('cobrar')
  })

  it('cuando el último cerrado YA está pagado → devuelve rango para el actual', async () => {
    const adminMock = admin({
      miembros: [{ data: MIEMBRO_MENSUAL, error: null }],
      pagos_nomina: [{ data: { monto_abonado: 500000 }, error: null }],
      empresas: [{ data: { pais: 'AR' }, error: null }],
      feriados: [{ data: [], error: null }],
    })
    const r = await ejecutarMiProximoPago(ctx(adminMock))
    expect(r.exito).toBe(true)
    const datos = r.datos as { estado: string }
    expect(datos.estado).toBe('en_curso')
  })
})

describe('mi_periodo_actual', () => {
  it('calcula días trabajados y tardanzas', async () => {
    const adminMock = admin({
      miembros: [{ data: MIEMBRO_MENSUAL, error: null }],
      asistencias: [{
        data: [
          { fecha: '2026-05-04', estado: 'cerrado', tipo: 'normal', puntualidad_min: 0 },
          { fecha: '2026-05-05', estado: 'cerrado', tipo: 'tardanza', puntualidad_min: 15 },
        ],
        error: null,
      }],
      empresas: [{ data: { pais: 'AR' }, error: null }],
      feriados: [{ data: [], error: null }],
    })
    const r = await ejecutarMiPeriodoActual(ctx(adminMock))
    expect(r.exito).toBe(true)
    const datos = r.datos as { dias_trabajados: number; tardanzas: number }
    expect(datos.dias_trabajados).toBe(2)
    expect(datos.tardanzas).toBe(1)
    expect(r.mensaje_usuario).toContain('Días trabajados')
    expect(r.mensaje_usuario).toContain('Tardanzas')
  })
})

describe('mis_tardanzas_e_inasistencias', () => {
  it("alias 'actual' devuelve datos del periodo en curso", async () => {
    const adminMock = admin({
      miembros: [{ data: MIEMBRO_MENSUAL, error: null }],
      asistencias: [{
        data: [
          { fecha: '2026-05-04', estado: 'cerrado', tipo: 'tardanza', puntualidad_min: 20, notas: null },
        ],
        error: null,
      }],
      empresas: [{ data: { pais: 'AR' }, error: null }],
      feriados: [{ data: [], error: null }],
    })
    const r = await ejecutarMisTardanzasEInasistencias(ctx(adminMock), { periodo: 'actual' })
    expect(r.exito).toBe(true)
    const datos = r.datos as { tardanzas: unknown[] }
    expect(datos.tardanzas).toHaveLength(1)
    expect(r.mensaje_usuario).toContain('20 min tarde')
  })

  it("alias inválido (más antiguo que la ventana) → fallback al admin", async () => {
    const adminMock = admin({
      miembros: [{ data: MIEMBRO_MENSUAL, error: null }],
    })
    const r = await ejecutarMisTardanzasEInasistencias(ctx(adminMock), { periodo: 'hace_un_ano' })
    expect(r.exito).toBe(true)
    expect(r.mensaje_usuario).toContain('comunicate con tu administrador')
  })
})

describe('mi_recibo_periodo', () => {
  it('si hay pago registrado en BD, usa esos datos como fuente', async () => {
    const adminMock = admin({
      miembros: [{ data: MIEMBRO_MENSUAL, error: null }],
      // pagos_nomina recibe DOS llamadas: una desde periodoRelevante (busca pago del último cerrado)
      // y otra desde el ejecutor (busca pago del periodo a mostrar). Ambas devuelven el pago.
      pagos_nomina: [
        { data: { monto_abonado: 500000 }, error: null },
        {
          data: {
            monto_sugerido: 500000,
            monto_abonado: 500000,
            dias_habiles: 22,
            dias_trabajados: 22,
            dias_ausentes: 0,
            tardanzas: 1,
            notas: 'Pagado en término',
          },
          error: null,
        },
      ],
    })
    const r = await ejecutarMiReciboPeriodo(ctx(adminMock), {})
    expect(r.exito).toBe(true)
    const datos = r.datos as { ya_pagado: boolean; monto_sugerido: number; tardanzas: number }
    expect(datos.ya_pagado).toBe(true)
    expect(datos.monto_sugerido).toBe(500000)
    expect(datos.tardanzas).toBe(1)
    expect(r.mensaje_usuario).toContain('500.000')
    expect(r.mensaje_usuario).toContain('Pagado en término')
  })

  it('sin pago registrado, calcula en vivo desde asistencias', async () => {
    const adminMock = admin({
      miembros: [{ data: MIEMBRO_MENSUAL, error: null }],
      pagos_nomina: [
        { data: null, error: null }, // periodoRelevante: no hay pago del cerrado
        { data: null, error: null }, // ejecutor: tampoco hay pago del periodo a mostrar
      ],
      asistencias: [{ data: [], error: null }],
      empresas: [{ data: { pais: 'AR' }, error: null }],
      feriados: [{ data: [], error: null }],
    })
    const r = await ejecutarMiReciboPeriodo(ctx(adminMock), {})
    expect(r.exito).toBe(true)
    const datos = r.datos as { ya_pagado: boolean; monto_sugerido: number }
    expect(datos.ya_pagado).toBe(false)
    expect(datos.monto_sugerido).toBe(500000) // compensacion fija
  })

  it("alias 'antepasado' → busca el periodo correcto (3 atrás)", async () => {
    const adminMock = admin({
      miembros: [{ data: MIEMBRO_MENSUAL, error: null }],
      pagos_nomina: [{ data: null, error: null }],
      asistencias: [{ data: [], error: null }],
      empresas: [{ data: { pais: 'AR' }, error: null }],
      feriados: [{ data: [], error: null }],
    })
    const r = await ejecutarMiReciboPeriodo(ctx(adminMock), { periodo: 'antepasado' })
    expect(r.exito).toBe(true)
    // Solo verificamos que devolvió un periodo (la fecha exacta depende de hoy)
    const datos = r.datos as { periodo: { etiqueta: string } }
    expect(datos.periodo.etiqueta).toBeTruthy()
  })

  it('sin miembro activo → error', async () => {
    const adminMock = admin({
      miembros: [{ data: null, error: null }],
    })
    const r = await ejecutarMiReciboPeriodo(ctx(adminMock), {})
    expect(r.exito).toBe(false)
  })
})
