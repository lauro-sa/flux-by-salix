/**
 * Parser bidireccional de expresiones `{{ ruta | helper(arg) }}` para el
 * `InputConVariables` y `PickerVariables` del editor de flujos
 * (sub-PR 19.3b).
 *
 * Compatibilidad con el resolver del motor: el shape de las expresiones
 * que parseamos / serializamos es el subset que `src/lib/workflows/
 * resolver-variables.ts` puede ejecutar (dot notation libre + chain de
 * helpers con args literales: string con quotes simples/dobles, number,
 * true / false / null).
 *
 * Garantías:
 *   • `parsearTexto(canon) → segs`, `serializarSegmentos(segs) → canon`.
 *     Para una expresión "canónica" (con whitespace `{{ ruta | helper }}`)
 *     la roundtrip es idempotente.
 *   • Variables con whitespace inconsistente (`{{x}}` o `{{ x }}`)
 *     parsean igual; el serializador outputea siempre la forma canónica
 *     `{{ ruta }}` o `{{ ruta | helper(arg) }}`.
 *   • Expresiones malformadas (no cierra `}}`, vacío `{{ }}`, etc.) se
 *     preservan como TEXTO LITERAL — el parser nunca lanza ni deja al
 *     usuario sin sus tipeos.
 *
 * NO soportado en 19.3b (deuda explícita):
 *   • Comillas escapadas dentro de string args (ej: `'Don\\'t'`).
 *     El parser falla a interpretar el helper y deja el `{{ }}` como
 *     texto literal. La regla del coordinador: documentar y diferir.
 *   • Helpers compuestos con paréntesis anidados.
 *
 * Uso:
 *   parsearTexto("Hola {{ contacto.nombre | nombre_corto }}")
 *     → [
 *         { tipo: 'texto', valor: 'Hola ' },
 *         { tipo: 'variable', expresion: {
 *             ruta: 'contacto.nombre',
 *             helpers: [{ nombre: 'nombre_corto', args: [] }]
 *           }
 *         }
 *       ]
 *
 *   serializarSegmentos(segs)
 *     → "Hola {{ contacto.nombre | nombre_corto }}"
 */

export interface ExpresionVariable {
  /** Path del valor: dot notation libre, ej: "contacto.empresa.nombre". */
  ruta: string
  /** Chain de helpers a aplicar al valor. */
  helpers: Array<{
    nombre: string
    args: Array<string | number | boolean | null>
  }>
}

export type Segmento =
  | { tipo: 'texto'; valor: string }
  | { tipo: 'variable'; expresion: ExpresionVariable }

// =============================================================
// Parser
// =============================================================

/**
 * Convierte un string crudo en una secuencia de segmentos. Cada
 * `{{ ... }}` que se pueda interpretar como expresión válida se
 * convierte en `{ tipo: 'variable', ... }`; cualquier otra cosa
 * (incluyendo `{{ }}` vacíos o malformados) cae en `{ tipo: 'texto' }`.
 */
export function parsearTexto(texto: string): Segmento[] {
  const segmentos: Segmento[] = []
  let bufferTexto = ''
  let i = 0

  while (i < texto.length) {
    if (texto[i] === '{' && texto[i + 1] === '{') {
      // Buscar el `}}` de cierre. Respetamos comillas simples y dobles
      // (los strings literales pueden contener `}}` adentro). Si no se
      // encuentra cierre antes del fin del texto, tratamos los `{{`
      // como literales y seguimos.
      const finCierre = encontrarCierre(texto, i + 2)
      if (finCierre === -1) {
        bufferTexto += texto[i]
        i++
        continue
      }

      const interior = texto.slice(i + 2, finCierre)
      const expresion = parsearExpresionVariable(interior)
      if (expresion) {
        if (bufferTexto.length > 0) {
          segmentos.push({ tipo: 'texto', valor: bufferTexto })
          bufferTexto = ''
        }
        segmentos.push({ tipo: 'variable', expresion })
      } else {
        // `{{ }}` vacío o malformado → preservar como texto literal.
        bufferTexto += texto.slice(i, finCierre + 2)
      }
      i = finCierre + 2
      continue
    }
    bufferTexto += texto[i]
    i++
  }

  if (bufferTexto.length > 0) {
    segmentos.push({ tipo: 'texto', valor: bufferTexto })
  }
  return segmentos
}

/**
 * Encuentra el índice de `}}` de cierre a partir de `desde`. Respeta
 * comillas simples y dobles (así `{{ x | default('}}') }}` se cierra
 * en el segundo `}}`, no el primero). Devuelve -1 si no hay cierre.
 */
function encontrarCierre(texto: string, desde: number): number {
  let dentroComilla: '"' | "'" | null = null
  for (let i = desde; i < texto.length; i++) {
    const ch = texto[i]
    if (dentroComilla) {
      if (ch === dentroComilla && texto[i - 1] !== '\\') dentroComilla = null
      continue
    }
    if (ch === '"' || ch === "'") {
      dentroComilla = ch
      continue
    }
    if (ch === '}' && texto[i + 1] === '}') return i
  }
  return -1
}

/**
 * Parsea el contenido interno de un `{{ ... }}` y devuelve la
 * expresión estructurada. Devuelve `null` si está vacío o no se puede
 * interpretar (ej: empieza con un helper en lugar de path, args
 * malformados, etc.).
 */
export function parsearExpresionVariable(interior: string): ExpresionVariable | null {
  const trimmed = interior.trim()
  if (trimmed.length === 0) return null

  const partes = splitChainPipe(trimmed)
  if (partes.length === 0) return null

  // El primer segmento del chain es el path. NO admite paréntesis
  // (eso es un helper). Si la primera parte parece función, rechazamos.
  const primero = partes[0]
  if (/[()]/.test(primero)) return null

  const ruta = primero
  // Validar shape mínima del path: chars permitidos `[a-zA-Z0-9_.]`.
  // Strings con espacios o símbolos raros no son paths válidos.
  if (!/^[a-zA-Z_][a-zA-Z0-9_]*(\.[a-zA-Z_][a-zA-Z0-9_]*)*$/.test(ruta)) return null

  const helpers: ExpresionVariable['helpers'] = []
  for (let k = 1; k < partes.length; k++) {
    const helper = parsearSegmentoHelper(partes[k])
    if (!helper) return null
    helpers.push(helper)
  }
  return { ruta, helpers }
}

/**
 * Divide la cadena por `|` respetando comillas. Devuelve los segmentos
 * trimmed. Si la división deja segmentos vacíos, devuelve [] (señal de
 * expresión inválida).
 */
function splitChainPipe(s: string): string[] {
  const out: string[] = []
  let inicio = 0
  let depth = 0
  let dentroComilla: '"' | "'" | null = null
  for (let i = 0; i < s.length; i++) {
    const ch = s[i]
    if (dentroComilla) {
      if (ch === dentroComilla && s[i - 1] !== '\\') dentroComilla = null
      continue
    }
    if (ch === '"' || ch === "'") {
      dentroComilla = ch
      continue
    }
    if (ch === '(') depth++
    else if (ch === ')') depth--
    else if (ch === '|' && depth === 0) {
      out.push(s.slice(inicio, i).trim())
      inicio = i + 1
    }
  }
  out.push(s.slice(inicio).trim())
  if (out.some((p) => p.length === 0)) return []
  return out
}

/**
 * Parsea un segmento helper: `nombre` (sin args) o `nombre(arg1, arg2)`.
 * Args válidos: string entre comillas simples/dobles SIN escape, number,
 * true / false / null.
 */
function parsearSegmentoHelper(s: string): ExpresionVariable['helpers'][number] | null {
  const conArgs = s.match(/^([a-zA-Z_][a-zA-Z0-9_]*)\s*\((.*)\)\s*$/)
  if (conArgs) {
    const args = parsearArgsLiteralesSinEscape(conArgs[2])
    if (args === null) return null
    return { nombre: conArgs[1], args }
  }
  if (/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(s)) {
    return { nombre: s, args: [] }
  }
  return null
}

/**
 * Parsea args como lista de literales separados por `,`. Soporta:
 *   - string entre `"..."` o `'...'` SIN comillas escapadas adentro
 *   - number (incluyendo decimales y negativos simples)
 *   - true / false / null
 *
 * Si encuentra una comilla escapada (`\\'` o `\\"`), devuelve null —
 * tratamos la expresión como malformada (caveat documentado).
 */
function parsearArgsLiteralesSinEscape(
  s: string,
): Array<string | number | boolean | null> | null {
  const trimmed = s.trim()
  if (trimmed.length === 0) return []

  // Hard reject: comilla escapada. No soportada en 19.3b.
  if (/\\['"]/.test(trimmed)) return null

  const out: Array<string | number | boolean | null> = []
  let inicio = 0
  let dentroComilla: '"' | "'" | null = null
  for (let i = 0; i <= trimmed.length; i++) {
    const ch = trimmed[i]
    if (dentroComilla) {
      if (ch === dentroComilla) dentroComilla = null
      continue
    }
    if (ch === '"' || ch === "'") {
      dentroComilla = ch
      continue
    }
    if (ch === ',' || i === trimmed.length) {
      const raw = trimmed.slice(inicio, i).trim()
      if (raw.length === 0) return null
      const literal = parsearLiteralSinEscape(raw)
      if (literal === SINEL) return null
      out.push(literal)
      inicio = i + 1
    }
  }
  return out
}

const SINEL = Symbol('literal-invalido')

function parsearLiteralSinEscape(s: string): string | number | boolean | null | typeof SINEL {
  if (s === 'true') return true
  if (s === 'false') return false
  if (s === 'null') return null
  if (
    (s.startsWith('"') && s.endsWith('"') && s.length >= 2) ||
    (s.startsWith("'") && s.endsWith("'") && s.length >= 2)
  ) {
    return s.slice(1, -1)
  }
  // Number tolerante: solo aceptamos los que parsean limpio.
  if (/^-?\d+(\.\d+)?$/.test(s)) {
    const n = Number(s)
    if (!Number.isNaN(n)) return n
  }
  return SINEL
}

// =============================================================
// Serializador (canónico)
// =============================================================

/** Forma canónica completa de un texto con segmentos. */
export function serializarSegmentos(segs: Segmento[]): string {
  return segs
    .map((s) => (s.tipo === 'texto' ? s.valor : serializarExpresionVariable(s.expresion)))
    .join('')
}

/**
 * Forma canónica de una expresión variable. Espacios consistentes:
 *   {{ ruta }}                   sin helpers
 *   {{ ruta | helper }}          un helper sin args
 *   {{ ruta | helper(arg) }}     con args
 *   {{ ruta | h1 | h2(arg) }}    chain
 */
export function serializarExpresionVariable(e: ExpresionVariable): string {
  const cuerpo =
    e.helpers.length === 0
      ? e.ruta
      : `${e.ruta} | ${e.helpers.map(serializarHelper).join(' | ')}`
  return `{{ ${cuerpo} }}`
}

function serializarHelper(h: ExpresionVariable['helpers'][number]): string {
  if (h.args.length === 0) return h.nombre
  return `${h.nombre}(${h.args.map(serializarLiteral).join(', ')})`
}

function serializarLiteral(v: string | number | boolean | null): string {
  if (v === null) return 'null'
  if (typeof v === 'boolean') return String(v)
  if (typeof v === 'number') return String(v)
  // String → preferimos comillas simples para que no pelee con quotes
  // dentro del HTML del input. Si el string contiene `'` literal,
  // serializamos con `"..."`. Si contiene ambos → caveat documentado:
  // no soportado en 19.3b, devolvemos comillas simples y el parsear
  // posterior va a fallar (preservación como texto literal).
  if (v.includes("'") && !v.includes('"')) return `"${v}"`
  return `'${v}'`
}
