/**
 * Tests del detector de mensajes de cortesía.
 *
 * Cubrimos los casos típicos que un empleado contesta tras recibir una plantilla
 * (recibo de nómina, aviso, etc.) — todos deberían detectarse como cortesía y
 * NO disparar el mensaje de derivación al admin.
 *
 * También verificamos que consultas reales NO se confundan con cortesía: ante
 * la duda, mejor derivar al admin que ignorar una pregunta.
 */

import { describe, it, expect } from 'vitest'
import { esMensajeCortesia } from '../es-cortesia'

describe('esMensajeCortesia — debe detectar como cortesía', () => {
  const cortesias = [
    'gracias',
    'Gracias!',
    'GRACIAS',
    'muchas gracias',
    'mil gracias',
    'gracias!!!',
    'ok',
    'OK',
    'okey',
    'Dale',
    'listo',
    'perfecto',
    'genial',
    'entendido',
    'recibido',
    'hola',
    'Buenos días',
    'buenas',
    'buenas tardes',
    'chao',
    'chau',
    'hasta luego',
    'adiós',
    'de nada',
    'sí',
    'si',
    'no',
    'ok gracias',
    'gracias chao',
    'hola buenas',
    '👍',
    '🙏',
    '❤️',
    '   gracias   ', // espacios al borde
    '',
    '   ',
  ]

  for (const texto of cortesias) {
    it(`"${texto}" → cortesía`, () => {
      expect(esMensajeCortesia(texto)).toBe(true)
    })
  }
})

describe('esMensajeCortesia — NO es cortesía (debe derivar al admin)', () => {
  const consultas = [
    '¿cuándo cobro?',
    'cuando cobro',
    'cuanto voy a cobrar este mes',
    'me podés decir cuánto cobré?',
    'no entiendo el recibo',
    'me falta un día',
    'gracias, pero quería preguntarte cuánto cobro', // empieza con "gracias" pero es consulta
    'hola, una consulta',
    'tengo una pregunta',
    'porqué me descontaron?',
    'cuántos días me faltan?',
    'no llegó el recibo',
    'mañana puedo faltar?',
    'estoy enfermo, no puedo ir',
  ]

  for (const texto of consultas) {
    it(`"${texto}" → consulta`, () => {
      expect(esMensajeCortesia(texto)).toBe(false)
    })
  }
})

describe('esMensajeCortesia — bordes', () => {
  it('mensaje muy largo (> 30 chars) nunca es cortesía aunque contenga "gracias"', () => {
    expect(esMensajeCortesia('muchas gracias por la info, después te paso datos')).toBe(false)
  })

  it('más de 3 tokens de cortesía juntos NO cuenta como cortesía (probablemente sea otra cosa)', () => {
    // 4 tokens, todos cortesía. Es un caso raro — mejor derivar al admin.
    expect(esMensajeCortesia('hola buenas gracias chao')).toBe(false)
  })
})
