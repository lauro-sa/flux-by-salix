/**
 * Detector simple de mensajes de cortesía (gracias, ok, hola, chao, emojis solos).
 *
 * Se usa cuando un empleado tiene Salix bloqueado (`nivel_salix='ninguno'` o
 * canal apagado): si su mensaje es solo cortesía, lo ignoramos en silencio;
 * si es una consulta real, le respondemos con un aviso de derivación al admin.
 *
 * El criterio es deliberadamente conservador:
 *  - Mensajes muy cortos (≤ 30 caracteres tras normalizar)
 *  - Compuestos solo por palabras/emojis de cortesía conocidas
 *  - Hasta 3 "tokens" de cortesía concatenados (ej: "ok gracias")
 *
 * Cualquier cosa más larga o con palabras fuera de la lista cuenta como
 * consulta. Ante la duda, NO es cortesía → mejor pecar de derivar al admin
 * que ignorar una pregunta real.
 */

const CORTESIAS = new Set<string>([
  // Agradecimientos
  'gracias', 'gracia', 'graci', 'mil gracias', 'muchas gracias', 'thx', 'thanks', 'ty',
  // Confirmaciones cortas
  'ok', 'okey', 'okay', 'oki', 'okii', 'okk', 'oka',
  'dale', 'listo', 'genial', 'perfecto', 'bueno', 'buenisimo', 'buenísimo',
  'entendido', 'enterado', 'recibido', 'copiado',
  // Saludos
  'hola', 'holi', 'holis', 'hello', 'hi', 'ey', 'hey',
  'buenas', 'buenos dias', 'buenos días', 'buen dia', 'buen día',
  'buenas tardes', 'buena tarde', 'buenas noches', 'buena noche',
  // Despedidas
  'chao', 'chau', 'adios', 'adiós', 'bye', 'nos vemos',
  'hasta luego', 'hasta mañana', 'hasta manana', 'hasta pronto',
  // Respuestas de nada
  'de nada', 'no hay de qué', 'no hay de que', 'nada', 'por nada',
  // Sí/no minimales
  'si', 'sí', 'sip', 'sii', 'siii',
  'no', 'nop', 'nope',
  // Emojis frecuentes (solos)
  '👍', '👌', '🙏', '😊', '😀', '😁', '😄', '😅', '🥰', '😘', '❤', '❤️', '💪', '🤝', '✅',
])

/**
 * Determina si un texto es solo cortesía (gracias, ok, emojis, etc.).
 * Devuelve true para mensajes que no requieren respuesta automática.
 */
export function esMensajeCortesia(texto: string): boolean {
  const limpio = texto
    .trim()
    .toLowerCase()
    // Normalizar puntuación final repetida y espacios múltiples
    .replace(/[.!¡?¿,]+$/g, '')
    .replace(/\s+/g, ' ')

  if (limpio.length === 0) return true
  // Más de 30 caracteres ya parece una consulta — mejor derivar al admin.
  if (limpio.length > 30) return false

  // Match exacto con la lista (ej: "gracias", "buenos dias")
  if (CORTESIAS.has(limpio)) return true

  // Hasta 3 tokens, todos en la lista (ej: "ok gracias", "hola buenas")
  const tokens = limpio.split(' ').filter(Boolean)
  if (tokens.length === 0 || tokens.length > 3) return false
  return tokens.every(t => CORTESIAS.has(t))
}
