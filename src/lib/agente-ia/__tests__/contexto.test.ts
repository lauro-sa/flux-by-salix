/**
 * Tests del bloque "ACTIVIDAD RECIENTE DEL CLIENTE" que se inyecta al prompt del Agente IA.
 * Verifica que el IA recibe visibilidad de presupuestos, visitas y órdenes del contacto.
 */

import { describe, it, expect } from 'vitest'
import { construirPrompts, type ContextoPipeline } from '../contexto'

const CTX_BASE: ContextoPipeline = {
  empresa_id: 'e1',
  conversacion_id: 'c1',
  mensaje_id: 'm1',
  mensajes: [{ es_entrante: true, remitente_nombre: 'Cliente', texto: 'Hola', tipo_contenido: 'texto', creado_en: '2026-04-22T19:00:00Z' }],
  contacto: {
    nombre: 'Natalia Trebisacce', empresa: null, email: null, telefono: null,
    etiquetas: [], notas: null, cargo: null, es_provisorio: false, direcciones: [],
  },
  actividad: { presupuestos: [], visitas: [], ordenes: [] },
  base_conocimiento: [],
  config: {
    nombre: 'Asistente', apodo: null, tono: 'cercano',
    personalidad: '', firmar_como: null, vocabulario_natural: null,
    largo_respuesta: 'medio' as const,
    instrucciones: null, respuesta_si_bot: null,
    zona_cobertura: null, sitio_web: null, horario_atencion: null, correo_empresa: null,
    servicios_si: null, servicios_no: null,
    tipos_contacto: [], flujo_conversacion: [], ejemplos_conversacion: [],
    reglas_agenda: null, info_precios: null, situaciones_especiales: null,
    mensaje_escalamiento: 'Te paso con un humano', escalar_palabras: ['humano'],
    usar_base_conocimiento: false,
  } as unknown as ContextoPipeline['config'],
  config_ia: { proveedor: 'anthropic', apiKey: '', modelo: 'claude-haiku-4-5' },
  empresa_nombre: 'HERREELEC',
  etiquetas_disponibles: [],
  resultados_previos: {},
}

describe('construirPrompts — sección ACTIVIDAD RECIENTE', () => {
  it('omite la sección cuando el contacto no tiene actividad', () => {
    const { sistema } = construirPrompts(CTX_BASE)
    expect(sistema).not.toContain('ACTIVIDAD RECIENTE DEL CLIENTE')
  })

  it('incluye presupuestos con número, estado, total y fecha', () => {
    const ctx: ContextoPipeline = {
      ...CTX_BASE,
      actividad: {
        presupuestos: [{
          numero: 'Pres 26-080', estado: 'enviado', total: 762300, moneda: 'ARS',
          fecha_emision: '2026-04-22T00:00:00Z', fecha_vencimiento: '2026-04-29T00:00:00Z',
          referencia: null,
        }],
        visitas: [], ordenes: [],
      },
    }
    const { sistema } = construirPrompts(ctx, { locale: 'es-AR', zonaHoraria: 'America/Argentina/Buenos_Aires' })
    expect(sistema).toContain('ACTIVIDAD RECIENTE DEL CLIENTE')
    expect(sistema).toContain('Pres 26-080')
    expect(sistema).toContain('enviado')
    expect(sistema).toMatch(/\$\s?762\.?300/)
    // Regla anti-repetir-pregunta
    expect(sistema).toContain('no le preguntes')
  })

  it('incluye visitas programadas con fecha y asignado', () => {
    const ctx: ContextoPipeline = {
      ...CTX_BASE,
      actividad: {
        presupuestos: [],
        visitas: [{
          fecha_programada: '2026-04-25T14:00:00Z',
          estado: 'programada',
          asignado_nombre: 'Sebastian Lauro',
          direccion_texto: 'Castillo 1181, CABA',
          motivo: 'Revisión de portón',
        }],
        ordenes: [],
      },
    }
    const { sistema } = construirPrompts(ctx, { locale: 'es-AR', zonaHoraria: 'America/Argentina/Buenos_Aires' })
    expect(sistema).toContain('VISITAS:')
    expect(sistema).toContain('Sebastian Lauro')
    expect(sistema).toContain('Castillo 1181')
    expect(sistema).toContain('programada')
  })

  it('incluye órdenes de trabajo abiertas', () => {
    const ctx: ContextoPipeline = {
      ...CTX_BASE,
      actividad: {
        presupuestos: [],
        visitas: [],
        ordenes: [{ numero: 'OT-123', estado: 'en_progreso', titulo: 'Reparación portón', prioridad: 'alta' }],
      },
    }
    const { sistema } = construirPrompts(ctx)
    expect(sistema).toContain('ÓRDENES DE TRABAJO ABIERTAS')
    expect(sistema).toContain('OT-123')
    expect(sistema).toContain('Reparación portón')
  })

  it('combina las 3 categorías cuando hay actividad en todas', () => {
    const ctx: ContextoPipeline = {
      ...CTX_BASE,
      actividad: {
        presupuestos: [{ numero: 'Pres 26-079', estado: 'enviado', total: 925650, moneda: 'ARS', fecha_emision: '2026-04-22T00:00:00Z', fecha_vencimiento: null, referencia: null }],
        visitas: [{ fecha_programada: '2026-04-25T14:00:00Z', estado: 'programada', asignado_nombre: 'Sebas', direccion_texto: null, motivo: null }],
        ordenes: [{ numero: 'OT-50', estado: 'abierta', titulo: 'Instalación', prioridad: 'media' }],
      },
    }
    const { sistema } = construirPrompts(ctx)
    expect(sistema).toContain('PRESUPUESTOS RECIENTES:')
    expect(sistema).toContain('VISITAS:')
    expect(sistema).toContain('ÓRDENES DE TRABAJO ABIERTAS')
  })
})
