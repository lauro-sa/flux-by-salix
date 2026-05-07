/**
 * Resolver de variables `{{vars}}` para plantillas del motor de
 * workflows (PR 16).
 *
 * Sintaxis soportada:
 *
 *   {{ ruta.al.campo }}                       — variable simple con dot notation
 *   {{ ruta | helper }}                       — helper único
 *   {{ ruta | helper(arg1, arg2) }}           — helper con argumentos literales
 *   {{ ruta | default('Cliente') }}           — fallback explícito
 *   {{ ruta | moneda | mayusculas }}          — chained helpers (izquierda a derecha)
 *
 * Comportamiento ante variables faltantes:
 *   - Default: la resolución FALLA con `VariableFaltante`. El orquestador
 *     marca el paso fallado (no transitorio, no reintenta).
 *   - El usuario fuerza tolerancia con `default("...")`. Si la variable
 *     no resuelve y hay un default en el chain, se usa ese valor.
 *
 * Validación de tipos en helpers:
 *   - Cada helper declara qué tipo acepta (`number`, `string`, `fecha`, `any`).
 *   - Si recibe un tipo distinto, falla con `HelperTipoInvalido`. Mensaje
 *     descriptivo: "helper 'moneda' espera number, recibió string". Esto
 *     atrapa errores de chained helpers en mal orden.
 *
 * Catálogo de helpers (15) — ver `HELPERS` abajo. Localización es-AR
 * por default; las fechas usan `empresa.zona_horaria` del contexto.
 */

const ZONA_HORARIA_DEFAULT = 'America/Argentina/Buenos_Aires'
const LOCALE = 'es-AR'

// =============================================================
// Errores tipados
// =============================================================

/**
 * Error que el resolver lanza cuando una variable no resuelve. El
 * executor lo captura y lo convierte en ResultadoAccion con
 * raw_class='VariableFaltante' y transitorio=false.
 */
export class VariableFaltanteError extends Error {
  constructor(public readonly path: string) {
    super(`Variable faltante: "{{${path}}}" no se pudo resolver contra el contexto`)
    this.name = 'VariableFaltanteError'
  }
}

export class HelperTipoInvalidoError extends Error {
  constructor(
    public readonly helper: string,
    public readonly tipoEsperado: string,
    public readonly tipoRecibido: string,
    public readonly valorRecibido: unknown,
  ) {
    const sample = JSON.stringify(valorRecibido)?.slice(0, 60) ?? '(sin sample)'
    super(
      `Helper "${helper}" espera ${tipoEsperado}, recibió ${tipoRecibido}: ${sample}`,
    )
    this.name = 'HelperTipoInvalidoError'
  }
}

export class HelperDesconocidoError extends Error {
  constructor(public readonly helper: string) {
    super(`Helper desconocido: "${helper}"`)
    this.name = 'HelperDesconocidoError'
  }
}

// =============================================================
// Tipos públicos
// =============================================================

export type ContextoVariables = Record<string, unknown>

type TipoEsperado = 'number' | 'string' | 'fecha' | 'any'

interface DefinicionHelper {
  /** Tipo que el helper espera recibir como input. */
  acepta: TipoEsperado
  /**
   * Aplica el helper. Si el valor de entrada es null/undefined, devuelve
   * cadena vacía SIN fallar — el `default()` ya manejó el faltante.
   */
  ejecutar: (valor: unknown, args: unknown[], ctx: ContextoVariables) => unknown
}

// =============================================================
// Punto de entrada
// =============================================================

/**
 * Resuelve todas las variables `{{...}}` en una plantilla string.
 *
 * @throws VariableFaltanteError si una variable no resuelve y no hay default
 * @throws HelperTipoInvalidoError si un helper recibe tipo incompatible
 * @throws HelperDesconocidoError si se usa un helper no registrado
 */
export function resolverPlantilla(
  plantilla: string,
  contexto: ContextoVariables,
): string {
  // Regex captura {{ ... }} con cualquier contenido interno excepto `}}`.
  // Lazy match para soportar múltiples vars en la misma línea.
  return plantilla.replace(/\{\{(.*?)\}\}/g, (_, expresion: string) => {
    return resolverExpresion(expresion.trim(), contexto)
  })
}

/**
 * Resuelve recursivamente todas las strings con `{{vars}}` dentro de un
 * objeto/array jsonb. Útil para componentes de WhatsApp y variables de
 * correo que tienen anidamiento.
 */
export function resolverEnObjeto(
  obj: unknown,
  contexto: ContextoVariables,
): unknown {
  if (typeof obj === 'string') {
    return resolverPlantilla(obj, contexto)
  }
  if (Array.isArray(obj)) {
    return obj.map((item) => resolverEnObjeto(item, contexto))
  }
  if (obj !== null && typeof obj === 'object') {
    const result: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(obj)) {
      result[k] = resolverEnObjeto(v, contexto)
    }
    return result
  }
  return obj
}

// =============================================================
// Parser de la expresión interna
// =============================================================
// Una expresión es: `path | helper1 | helper2(arg1, arg2)`.

function resolverExpresion(
  expresion: string,
  contexto: ContextoVariables,
): string {
  const partes = parsearChain(expresion)
  if (partes.length === 0) return ''

  // El primer elemento del chain es el path (no un helper).
  const path = partes[0].nombre
  if (partes[0].args.length > 0) {
    throw new Error(
      `Sintaxis inválida en {{${expresion}}}: el primer elemento debe ser un path, no una función`,
    )
  }

  const helpers = partes.slice(1)

  // Detectar si en el chain hay `default(...)`. Si lo hay, una variable
  // faltante NO lanza error — usa el default.
  const indiceDefault = helpers.findIndex((h) => h.nombre === 'default')
  const tieneDefault = indiceDefault >= 0

  let valor: unknown = leerCampoDot(path, contexto)
  const valorFaltante = valor === null || valor === undefined

  if (valorFaltante) {
    if (!tieneDefault) {
      throw new VariableFaltanteError(path)
    }
    // Adelantar al `default(...)`: aplicarlo y descartar helpers anteriores.
    const defaultArgs = helpers[indiceDefault].args
    valor = defaultArgs[0] ?? ''
    // Continuar el chain DESPUÉS del default (helpers post-default sí aplican).
    for (let i = indiceDefault + 1; i < helpers.length; i++) {
      valor = aplicarHelper(helpers[i].nombre, valor, helpers[i].args, contexto)
    }
    return formatearSalida(valor)
  }

  // Camino normal: aplicar todos los helpers en orden, salteando default
  // (que ya no aplica si la var resolvió).
  for (const helper of helpers) {
    if (helper.nombre === 'default') continue
    valor = aplicarHelper(helper.nombre, valor, helper.args, contexto)
  }

  return formatearSalida(valor)
}

interface SegmentoChain {
  nombre: string
  args: unknown[]
}

/**
 * Parsea `path | helper(a, b) | otro` en segmentos.
 * Args son literales: strings con quotes, numbers, true/false, null.
 */
function parsearChain(expresion: string): SegmentoChain[] {
  const segmentos: SegmentoChain[] = []
  // Split por `|` respetando quotes — implementación simple porque los
  // helpers no contienen `|` en sus args (validamos al parsear args).
  let depth = 0
  let dentroComilla: '"' | "'" | null = null
  let inicio = 0
  const partes: string[] = []
  for (let i = 0; i < expresion.length; i++) {
    const ch = expresion[i]
    if (dentroComilla) {
      if (ch === dentroComilla && expresion[i - 1] !== '\\') dentroComilla = null
      continue
    }
    if (ch === '"' || ch === "'") {
      dentroComilla = ch
      continue
    }
    if (ch === '(') depth++
    else if (ch === ')') depth--
    else if (ch === '|' && depth === 0) {
      partes.push(expresion.slice(inicio, i))
      inicio = i + 1
    }
  }
  partes.push(expresion.slice(inicio))

  for (const parte of partes) {
    segmentos.push(parsearSegmento(parte.trim()))
  }
  return segmentos
}

function parsearSegmento(s: string): SegmentoChain {
  const matchFn = s.match(/^([a-z_][a-z0-9_]*)\s*\((.*)\)\s*$/i)
  if (matchFn) {
    return {
      nombre: matchFn[1],
      args: parsearArgs(matchFn[2]),
    }
  }
  return { nombre: s, args: [] }
}

function parsearArgs(s: string): unknown[] {
  if (s.trim().length === 0) return []
  const args: unknown[] = []
  let dentroComilla: '"' | "'" | null = null
  let inicio = 0
  for (let i = 0; i <= s.length; i++) {
    const ch = s[i]
    if (dentroComilla) {
      if (ch === dentroComilla && s[i - 1] !== '\\') dentroComilla = null
      continue
    }
    if (ch === '"' || ch === "'") {
      dentroComilla = ch
      continue
    }
    if (ch === ',' || i === s.length) {
      const raw = s.slice(inicio, i).trim()
      if (raw.length > 0) args.push(parsearLiteral(raw))
      inicio = i + 1
    }
  }
  return args
}

function parsearLiteral(s: string): unknown {
  if (
    (s.startsWith('"') && s.endsWith('"')) ||
    (s.startsWith("'") && s.endsWith("'"))
  ) {
    return s.slice(1, -1).replace(/\\(["'\\])/g, '$1')
  }
  if (s === 'true') return true
  if (s === 'false') return false
  if (s === 'null') return null
  const n = Number(s)
  if (!Number.isNaN(n) && s.trim() !== '') return n
  // Fallback: tratarlo como string crudo (sin quotes — útil pero raro).
  return s
}

// =============================================================
// Lectura de campo con dot notation
// =============================================================

export function leerCampoDot(
  path: string,
  contexto: ContextoVariables,
): unknown {
  const partes = path.split('.')
  let actual: unknown = contexto
  for (const parte of partes) {
    if (actual === null || actual === undefined) return undefined
    if (typeof actual !== 'object') return undefined
    actual = (actual as Record<string, unknown>)[parte]
  }
  return actual
}

// =============================================================
// Aplicación de helpers + validación de tipos
// =============================================================

function aplicarHelper(
  nombre: string,
  valor: unknown,
  args: unknown[],
  ctx: ContextoVariables,
): unknown {
  const def = HELPERS[nombre]
  if (!def) throw new HelperDesconocidoError(nombre)
  validarTipo(nombre, def.acepta, valor)
  return def.ejecutar(valor, args, ctx)
}

function validarTipo(
  helperNombre: string,
  esperado: TipoEsperado,
  valor: unknown,
): void {
  if (esperado === 'any') return
  // null/undefined no validan tipo (los helpers manejan internamente).
  if (valor === null || valor === undefined) return

  if (esperado === 'number') {
    if (typeof valor !== 'number' || Number.isNaN(valor)) {
      throw new HelperTipoInvalidoError(helperNombre, 'number', tipoOf(valor), valor)
    }
    return
  }
  if (esperado === 'string') {
    if (typeof valor !== 'string') {
      throw new HelperTipoInvalidoError(helperNombre, 'string', tipoOf(valor), valor)
    }
    return
  }
  if (esperado === 'fecha') {
    // Acepta ISO string parseable o número (timestamp ms).
    if (typeof valor === 'string' && !Number.isNaN(Date.parse(valor))) return
    if (typeof valor === 'number' && !Number.isNaN(valor)) return
    throw new HelperTipoInvalidoError(helperNombre, 'fecha (ISO string o timestamp)', tipoOf(valor), valor)
  }
}

function tipoOf(v: unknown): string {
  if (v === null) return 'null'
  if (Array.isArray(v)) return 'array'
  return typeof v
}

function formatearSalida(valor: unknown): string {
  if (valor === null || valor === undefined) return ''
  if (typeof valor === 'string') return valor
  return String(valor)
}

// =============================================================
// Helpers de zona horaria / moneda desde contexto
// =============================================================

function leerZonaHoraria(ctx: ContextoVariables): string {
  const empresa = ctx.empresa as Record<string, unknown> | undefined
  const tz = typeof empresa?.zona_horaria === 'string' ? empresa.zona_horaria : null
  return tz ?? ZONA_HORARIA_DEFAULT
}

function leerMoneda(ctx: ContextoVariables): string {
  const empresa = ctx.empresa as Record<string, unknown> | undefined
  const moneda = typeof empresa?.moneda === 'string' ? empresa.moneda : null
  return moneda ?? 'ARS'
}

function aDate(valor: unknown): Date {
  if (typeof valor === 'number') return new Date(valor)
  return new Date(String(valor))
}

// =============================================================
// Catálogo de helpers (15)
// =============================================================

export const HELPERS: Record<string, DefinicionHelper> = {
  // ─── Fechas ──────────────────────────────────────────────
  fecha: {
    acepta: 'fecha',
    ejecutar: (v, _args, ctx) =>
      new Intl.DateTimeFormat(LOCALE, {
        timeZone: leerZonaHoraria(ctx),
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      }).format(aDate(v)),
  },
  fecha_corta: {
    acepta: 'fecha',
    ejecutar: (v, _args, ctx) =>
      new Intl.DateTimeFormat(LOCALE, {
        timeZone: leerZonaHoraria(ctx),
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      }).format(aDate(v)),
  },
  fecha_hora: {
    acepta: 'fecha',
    ejecutar: (v, _args, ctx) => {
      const tz = leerZonaHoraria(ctx)
      const f = new Intl.DateTimeFormat(LOCALE, {
        timeZone: tz,
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      }).format(aDate(v))
      const h = new Intl.DateTimeFormat(LOCALE, {
        timeZone: tz,
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      }).format(aDate(v))
      return `${f} ${h}`
    },
  },
  hora: {
    acepta: 'fecha',
    ejecutar: (v, _args, ctx) =>
      new Intl.DateTimeFormat(LOCALE, {
        timeZone: leerZonaHoraria(ctx),
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      }).format(aDate(v)),
  },
  dia_semana: {
    acepta: 'fecha',
    ejecutar: (v, _args, ctx) =>
      new Intl.DateTimeFormat(LOCALE, {
        timeZone: leerZonaHoraria(ctx),
        weekday: 'long',
      }).format(aDate(v)),
  },
  fecha_relativa: {
    acepta: 'fecha',
    ejecutar: (v) => {
      const target = aDate(v)
      const ahora = new Date()
      const diffMs = target.getTime() - ahora.getTime()
      const fmt = new Intl.RelativeTimeFormat(LOCALE, { numeric: 'auto' })
      const abs = Math.abs(diffMs)
      if (abs < 60_000) return fmt.format(Math.round(diffMs / 1000), 'second')
      if (abs < 3600_000) return fmt.format(Math.round(diffMs / 60_000), 'minute')
      if (abs < 86_400_000) return fmt.format(Math.round(diffMs / 3_600_000), 'hour')
      if (abs < 30 * 86_400_000) return fmt.format(Math.round(diffMs / 86_400_000), 'day')
      if (abs < 365 * 86_400_000) return fmt.format(Math.round(diffMs / (30 * 86_400_000)), 'month')
      return fmt.format(Math.round(diffMs / (365 * 86_400_000)), 'year')
    },
  },

  // ─── Números ─────────────────────────────────────────────
  moneda: {
    acepta: 'number',
    ejecutar: (v, _args, ctx) =>
      new Intl.NumberFormat(LOCALE, {
        style: 'currency',
        currency: leerMoneda(ctx),
        minimumFractionDigits: 2,
      }).format(v as number),
  },
  numero: {
    acepta: 'number',
    ejecutar: (v) => new Intl.NumberFormat(LOCALE).format(v as number),
  },
  porcentaje: {
    acepta: 'number',
    ejecutar: (v) =>
      new Intl.NumberFormat(LOCALE, {
        style: 'percent',
        maximumFractionDigits: 1,
      }).format(v as number),
  },

  // ─── Strings ─────────────────────────────────────────────
  mayusculas: {
    acepta: 'string',
    ejecutar: (v) => (v as string).toUpperCase(),
  },
  minusculas: {
    acepta: 'string',
    ejecutar: (v) => (v as string).toLowerCase(),
  },
  capitalizar: {
    acepta: 'string',
    ejecutar: (v) =>
      (v as string)
        .toLowerCase()
        .replace(/(^|\s)(\p{L})/gu, (m) => m.toUpperCase()),
  },
  nombre_corto: {
    acepta: 'string',
    ejecutar: (v) => {
      const s = (v as string).trim()
      const idx = s.indexOf(' ')
      return idx === -1 ? s : s.slice(0, idx)
    },
  },
  truncar: {
    acepta: 'string',
    ejecutar: (v, args) => {
      const n = typeof args[0] === 'number' ? args[0] : 50
      const s = v as string
      return s.length <= n ? s : `${s.slice(0, n)}…`
    },
  },

  // ─── Fallback ────────────────────────────────────────────
  // `default(valor)`: tratamiento especial en `resolverExpresion` —
  // acá lo registramos para que `aplicarHelper` no tire HelperDesconocido,
  // pero en path normal (var resolvió) lo skipea sin hacer nada.
  default: {
    acepta: 'any',
    ejecutar: (v) => v,
  },
}
