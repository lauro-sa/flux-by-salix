/**
 * Tests del catálogo + resolución de variables de plantillas WhatsApp.
 */

import { describe, it, expect } from 'vitest'
import {
  construirDatosPlantilla,
  resolverTextoPlantilla,
  resolverParametrosCuerpo,
  opcionesMapeoVariables,
  EJEMPLOS_POR_CAMPO,
} from '../variables'
import type { CuerpoPlantillaWA } from '@/tipos/whatsapp'

describe('construirDatosPlantilla', () => {
  it('resuelve contacto: nombre completo + primer nombre + teléfono + correo', () => {
    const datos = construirDatosPlantilla({
      contacto: { nombre: 'Juan', apellido: 'García', telefono: '+5491112345678', correo: 'juan@example.com' },
    })
    expect(datos.contacto_nombre).toBe('Juan García')
    expect(datos.contacto_primer_nombre).toBe('Juan')
    expect(datos.contacto_apellido).toBe('García')
    expect(datos.contacto_telefono).toBe('+5491112345678')
    expect(datos.contacto_correo).toBe('juan@example.com')
  })

  it('contacto sin apellido usa solo nombre para contacto_nombre', () => {
    const datos = construirDatosPlantilla({ contacto: { nombre: 'Edif. Castillo 1181' } })
    expect(datos.contacto_nombre).toBe('Edif. Castillo 1181')
  })

  it('no asigna claves con valor vacío (para permitir fallback a ejemplos)', () => {
    const datos = construirDatosPlantilla({ contacto: { nombre: 'Juan', telefono: '' } })
    expect(datos.contacto_nombre).toBe('Juan')
    expect('contacto_telefono' in datos).toBe(false)
  })

  it('resuelve visita: fecha larga + horario + dirección + asignado', () => {
    const datos = construirDatosPlantilla({
      visita: {
        fecha_programada: '2026-04-27T11:00:00-03:00',
        direccion_texto: 'Juncal 1724, Lanús Este',
        asignado_nombre: 'Carlos Pérez',
        duracion_estimada_min: 45,
      },
    }, 'es-AR')
    expect(datos.visita_fecha).toContain('abril')
    expect(datos.visita_horario).toMatch(/^\d{2}:\d{2}$/)
    expect(datos.visita_direccion).toBe('Juncal 1724, Lanús Este')
    expect(datos.visita_asignado).toBe('Carlos Pérez')
    expect(datos.visita_duracion_min).toBe('45')
  })

  it('resuelve presupuesto con formato de moneda', () => {
    const datos = construirDatosPlantilla({
      presupuesto: { numero: 'PRE-042', total_final: '150000', moneda: 'ARS', fecha_emision: '2026-04-05T12:00:00' },
    }, 'es-AR')
    expect(datos.documento_numero).toBe('PRE-042')
    expect(datos.documento_total).toContain('150')
    expect(datos.documento_total.startsWith('$')).toBe(true)
    expect(datos.documento_fecha).toBe('05/04/2026')
  })

  it('resuelve empresa cuando se pasa', () => {
    const datos = construirDatosPlantilla({ empresa: { nombre: 'Mi Empresa S.A.' } })
    expect(datos.empresa_nombre).toBe('Mi Empresa S.A.')
  })
})

describe('resolverTextoPlantilla', () => {
  const cuerpo: CuerpoPlantillaWA = {
    texto: 'Hola {{1}}, visita el {{2}} a las {{3}}',
    mapeo_variables: ['contacto_nombre', 'visita_fecha', 'visita_horario'],
    ejemplos: ['Juan', '05/04/2026', '11:00'],
  }

  it('usa dato real si está mapeado y disponible', () => {
    const datos = { contacto_nombre: 'Edif. Castillo 1181', visita_fecha: 'martes 27 de abril', visita_horario: '11:00' }
    const out = resolverTextoPlantilla(cuerpo.texto, cuerpo, datos)
    expect(out).toBe('Hola Edif. Castillo 1181, visita el martes 27 de abril a las 11:00')
  })

  it('cae al ejemplo si el mapeo no tiene dato real', () => {
    const datos = { contacto_nombre: 'Ana', visita_horario: '14:00' }
    const out = resolverTextoPlantilla(cuerpo.texto, cuerpo, datos)
    expect(out).toBe('Hola Ana, visita el 05/04/2026 a las 14:00')
  })

  it('deja {{N}} si no hay ni mapeo ni ejemplo', () => {
    const texto = 'Hola {{1}}'
    const out = resolverTextoPlantilla(texto, { texto }, {})
    expect(out).toBe('Hola {{1}}')
  })
})

describe('resolverParametrosCuerpo', () => {
  it('genera un parameter por cada {{N}}, en orden', () => {
    const cuerpo: CuerpoPlantillaWA = {
      texto: 'Hola {{1}}, fecha {{2}}',
      mapeo_variables: ['contacto_nombre', 'visita_fecha'],
      ejemplos: ['Juan García', '05/04/2026'],
    }
    const datos = { contacto_nombre: 'Ana', visita_fecha: 'martes 27' }
    const params = resolverParametrosCuerpo(cuerpo, datos)
    expect(params).toEqual([
      { type: 'text', text: 'Ana' },
      { type: 'text', text: 'martes 27' },
    ])
  })

  it('devuelve null si el cuerpo no tiene variables', () => {
    const cuerpo: CuerpoPlantillaWA = { texto: 'Hola' }
    expect(resolverParametrosCuerpo(cuerpo, {})).toBeNull()
  })

  it('usa ejemplo cuando no hay dato real', () => {
    const cuerpo: CuerpoPlantillaWA = {
      texto: 'Hola {{1}}',
      mapeo_variables: ['contacto_nombre'],
      ejemplos: ['Juan García'],
    }
    const params = resolverParametrosCuerpo(cuerpo, {})
    expect(params).toEqual([{ type: 'text', text: 'Juan García' }])
  })
})

describe('opcionesMapeoVariables', () => {
  it('sin módulos: incluye todas las variables del catálogo', () => {
    const opc = opcionesMapeoVariables()
    expect(opc[0]).toEqual({ valor: '', etiqueta: 'Sin asignar' })
    expect(opc.some(o => o.valor === 'visita_fecha')).toBe(true)
    expect(opc.some(o => o.valor === 'documento_numero')).toBe(true)
  })

  it('filtra por módulos: "visitas" incluye visita_* y contacto_* pero no documento_*', () => {
    const opc = opcionesMapeoVariables(['visitas'])
    expect(opc.some(o => o.valor === 'visita_fecha')).toBe(true)
    expect(opc.some(o => o.valor === 'contacto_nombre')).toBe(true)
    expect(opc.some(o => o.valor === 'documento_numero')).toBe(false)
  })
})

describe('EJEMPLOS_POR_CAMPO', () => {
  it('tiene un ejemplo por cada variable del catálogo', () => {
    expect(EJEMPLOS_POR_CAMPO.contacto_nombre).toBeTruthy()
    expect(EJEMPLOS_POR_CAMPO.visita_fecha).toBeTruthy()
    expect(EJEMPLOS_POR_CAMPO.documento_numero).toBeTruthy()
    expect(EJEMPLOS_POR_CAMPO.orden_numero).toBeTruthy()
    expect(EJEMPLOS_POR_CAMPO.empresa_nombre).toBeTruthy()
  })
})
