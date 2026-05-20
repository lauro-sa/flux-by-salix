import { describe, it, expect } from 'vitest'
import { sugerirIdentidadFlujo } from '@/lib/workflows/sugerencia-identidad-flujo'

describe('sugerirIdentidadFlujo', () => {
  it('nombre vacío → default Workflow + índigo', () => {
    expect(sugerirIdentidadFlujo('')).toEqual({ icono: 'Workflow', color: '#5b5bd6' })
    expect(sugerirIdentidadFlujo('   ')).toEqual({ icono: 'Workflow', color: '#5b5bd6' })
  })

  it('correo y variantes → Mail + violeta', () => {
    expect(sugerirIdentidadFlujo('Respuesta automática fuera de horario'))
      .toEqual({ icono: 'Mail', color: '#8e4ec6' })
    expect(sugerirIdentidadFlujo('Reenvío de correo a soporte'))
      .toEqual({ icono: 'Mail', color: '#8e4ec6' })
    expect(sugerirIdentidadFlujo('Email a nuevos clientes'))
      .toEqual({ icono: 'Mail', color: '#8e4ec6' })
  })

  it('whatsapp y mensajería → MessageCircle + verde', () => {
    expect(sugerirIdentidadFlujo('Bienvenida WhatsApp'))
      .toEqual({ icono: 'MessageCircle', color: '#46a758' })
    expect(sugerirIdentidadFlujo('Mensaje a cliente nuevo'))
      .toEqual({ icono: 'MessageCircle', color: '#46a758' })
  })

  it('recordatorios y alertas → Bell + naranja', () => {
    expect(sugerirIdentidadFlujo('Recordatorio 3 días antes')).toEqual({
      icono: 'Bell',
      color: '#f5a623',
    })
    expect(sugerirIdentidadFlujo('Aviso de vencimiento')).toEqual({
      icono: 'Bell',
      color: '#f5a623',
    })
  })

  it('cobranzas y cuotas → DollarSign + verde', () => {
    expect(sugerirIdentidadFlujo('Cobranza de cuotas atrasadas')).toEqual({
      icono: 'DollarSign',
      color: '#46a758',
    })
  })

  it('case y tildes son irrelevantes', () => {
    expect(sugerirIdentidadFlujo('CORREO importante'))
      .toEqual({ icono: 'Mail', color: '#8e4ec6' })
    expect(sugerirIdentidadFlujo('Cotización aceptada'))
      .toEqual({ icono: 'FileText', color: '#3b82f6' })
  })

  it('orden de prioridad: correo gana sobre actividad cuando ambas aparecen', () => {
    // En la lista, "correo" está antes que "tarea" — el primer match gana.
    expect(sugerirIdentidadFlujo('Tarea de correo automático'))
      .toEqual({ icono: 'Mail', color: '#8e4ec6' })
  })

  it('sin match → default', () => {
    expect(sugerirIdentidadFlujo('xyz sin palabras conocidas'))
      .toEqual({ icono: 'Workflow', color: '#5b5bd6' })
  })
})
