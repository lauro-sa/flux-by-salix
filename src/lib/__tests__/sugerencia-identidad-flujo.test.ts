import { describe, it, expect } from 'vitest'
import { sugerirIdentidadFlujo } from '@/lib/workflows/sugerencia-identidad-flujo'

describe('sugerirIdentidadFlujo', () => {
  it('nombre vacío → default Workflow/violeta', () => {
    expect(sugerirIdentidadFlujo('')).toEqual({ icono: 'Workflow', color: 'violeta' })
    expect(sugerirIdentidadFlujo('   ')).toEqual({ icono: 'Workflow', color: 'violeta' })
  })

  it('correo y variantes → Mail + violeta', () => {
    expect(sugerirIdentidadFlujo('Respuesta automática fuera de horario'))
      .toEqual({ icono: 'Mail', color: 'violeta' })
    expect(sugerirIdentidadFlujo('Reenvío de correo a soporte'))
      .toEqual({ icono: 'Mail', color: 'violeta' })
    expect(sugerirIdentidadFlujo('Email a nuevos clientes'))
      .toEqual({ icono: 'Mail', color: 'violeta' })
  })

  it('whatsapp y mensajería → MessageCircle + exito', () => {
    expect(sugerirIdentidadFlujo('Bienvenida WhatsApp'))
      .toEqual({ icono: 'MessageCircle', color: 'exito' })
    expect(sugerirIdentidadFlujo('Mensaje a cliente nuevo'))
      .toEqual({ icono: 'MessageCircle', color: 'exito' })
  })

  it('recordatorios y alertas → Bell + advertencia', () => {
    expect(sugerirIdentidadFlujo('Recordatorio 3 días antes')).toEqual({
      icono: 'Bell',
      color: 'advertencia',
    })
    expect(sugerirIdentidadFlujo('Aviso de vencimiento')).toEqual({
      icono: 'Bell',
      color: 'advertencia',
    })
  })

  it('cobranzas y cuotas → DollarSign + exito', () => {
    expect(sugerirIdentidadFlujo('Cobranza de cuotas atrasadas')).toEqual({
      icono: 'DollarSign',
      color: 'exito',
    })
  })

  it('case y tildes son irrelevantes', () => {
    expect(sugerirIdentidadFlujo('CORREO importante'))
      .toEqual({ icono: 'Mail', color: 'violeta' })
    expect(sugerirIdentidadFlujo('Cotización aceptada'))
      .toEqual({ icono: 'FileText', color: 'info' })
  })

  it('orden de prioridad: correo gana sobre actividad cuando ambas aparecen', () => {
    // En la lista, "correo" está antes que "tarea" — el primer match gana.
    expect(sugerirIdentidadFlujo('Tarea de correo automático'))
      .toEqual({ icono: 'Mail', color: 'violeta' })
  })

  it('sin match → default', () => {
    expect(sugerirIdentidadFlujo('xyz sin palabras conocidas'))
      .toEqual({ icono: 'Workflow', color: 'violeta' })
  })
})
