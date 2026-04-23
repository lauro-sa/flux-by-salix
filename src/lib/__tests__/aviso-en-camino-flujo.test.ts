import { describe, expect, it } from 'vitest'
import { formatearETATexto } from '../eta'
import {
  construirDatosPlantilla,
  resolverTextoPlantilla,
  resolverParametrosCuerpo,
} from '../whatsapp/variables'
import type { CuerpoPlantillaWA } from '@/tipos/whatsapp'

/**
 * Simula el flujo completo del endpoint /api/recorrido/aviso-en-camino
 * con una visita real de la BD (Victoria Storck, Rondeau 1766, CABA),
 * validando que el mensaje se arme bien y los parámetros para Meta sean correctos.
 */
describe('flujo end-to-end: aviso en camino', () => {
  // Cuerpo idéntico al guardado en BD para `flux_aviso_en_camino`
  const cuerpoPlantilla: CuerpoPlantillaWA = {
    texto: 'Hola {{1}}, le informamos que nuestro visitador va en camino a:\n*{{2}}*.\n\nEstará llegando {{3}}.\n\nAnte cualquier consulta, no dude en comunicarse con nosotros.\n\nMuchas gracias.',
    mapeo_variables: ['contacto_nombre', 'visita_direccion', 'visita_eta'],
    ejemplos: ['Juan Pérez', 'Av. Suárez 1719', 'dentro de los próximos 25 minutos aproximadamente'],
  }

  // Datos reales de una visita programada en HERREELEC
  const visitaReal = {
    contacto_nombre: 'Victoria Storck',
    recibe_nombre: null,
    direccion_texto: 'Rondeau 1766, C1130ACF C1130ACF, Cdad. Autónoma de Buenos Aires, Argentina',
    direccion_lat: -34.6327257,
    direccion_lng: -58.3898418,
  }

  function simularEndpoint(etaMinutosReal: number | null) {
    const valorNombre = visitaReal.recibe_nombre || visitaReal.contacto_nombre
    const valorDireccion = visitaReal.direccion_texto
    const valorETA = etaMinutosReal != null ? formatearETATexto(etaMinutosReal) : 'en breve'

    const datosRuntime: Record<string, string> = {
      contacto_nombre: valorNombre,
      visita_direccion: valorDireccion,
      visita_eta: valorETA,
    }

    const mensaje = resolverTextoPlantilla(cuerpoPlantilla.texto, cuerpoPlantilla, datosRuntime)
    const parametros = resolverParametrosCuerpo(cuerpoPlantilla, datosRuntime) || []

    return { mensaje, parametros }
  }

  it('resuelve el mensaje con ETA de 22 min → "25 minutos"', () => {
    const { mensaje } = simularEndpoint(22)
    expect(mensaje).toBe(
      'Hola Victoria Storck, le informamos que nuestro visitador va en camino a:\n' +
      '*Rondeau 1766, C1130ACF C1130ACF, Cdad. Autónoma de Buenos Aires, Argentina*.\n\n' +
      'Estará llegando dentro de los próximos 25 minutos aproximadamente.\n\n' +
      'Ante cualquier consulta, no dude en comunicarse con nosotros.\n\n' +
      'Muchas gracias.'
    )
  })

  it('arma los parameters correctos para Meta API (3 texts en orden)', () => {
    const { parametros } = simularEndpoint(22)
    expect(parametros).toEqual([
      { type: 'text', text: 'Victoria Storck' },
      { type: 'text', text: 'Rondeau 1766, C1130ACF C1130ACF, Cdad. Autónoma de Buenos Aires, Argentina' },
      { type: 'text', text: 'dentro de los próximos 25 minutos aproximadamente' },
    ])
  })

  it('si no hay ETA (Google falló) usa fallback "en breve"', () => {
    const { mensaje, parametros } = simularEndpoint(null)
    expect(mensaje).toContain(' en breve.')
    expect(parametros[2]).toEqual({ type: 'text', text: 'en breve' })
  })

  it('respeta la prioridad recibe_nombre > contacto_nombre', () => {
    const conRecibe = { ...visitaReal, recibe_nombre: 'Jorge Covacivich' }
    const valorNombre = conRecibe.recibe_nombre || conRecibe.contacto_nombre
    const datos = { contacto_nombre: valorNombre, visita_direccion: conRecibe.direccion_texto }
    const mensaje = resolverTextoPlantilla(cuerpoPlantilla.texto, cuerpoPlantilla, datos)
    expect(mensaje.startsWith('Hola Jorge Covacivich,')).toBe(true)
  })

  it('fallback: construirDatosPlantilla con solo contacto (sin visita) llena visita_direccion', () => {
    // Reproduce el bug reportado: al seleccionar un contacto en el editor sin visita,
    // visita_direccion debe caer a contacto_direccion.
    const datos = construirDatosPlantilla({
      contacto: {
        nombre: 'Natalia',
        apellido: 'Trebisacce',
        direccion: 'Suipacha 567, CABA',
      },
    })
    expect(datos['contacto_nombre']).toBe('Natalia Trebisacce')
    expect(datos['visita_direccion']).toBe('Suipacha 567, CABA')
  })
})
