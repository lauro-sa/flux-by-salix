/**
 * Helpers y componentes compartidos por los widgets del dashboard.
 * Centralizar acá evita que la misma utilidad viva duplicada en N widgets.
 */

// ─── Constantes de mes (es-AR) ───

export const MESES_LARGOS = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
]

export const MESES_CORTOS = [
  'Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun',
  'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic',
]

// ─── Formato de montos ───

/**
 * Formato compacto para KPIs: convierte 1.234.567 → "$1,2M",
 * 1.234 → "$1,2K". Usa formatoMoneda como fallback para montos chicos.
 * Sin decimales cuando es grande (≥10M) para que ocupe menos espacio.
 */
export function formatoCompacto(n: number, formatoMoneda: (n: number) => string): string {
  const abs = Math.abs(n)
  if (abs >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(1).replace('.', ',')}B`
  if (abs >= 10_000_000) return `$${Math.round(n / 1_000_000)}M`
  if (abs >= 1_000_000) return `$${(n / 1_000_000).toFixed(1).replace('.', ',')}M`
  if (abs >= 10_000) return `$${Math.round(n / 1_000)}K`
  if (abs >= 1_000) return `$${(n / 1_000).toFixed(1).replace('.', ',')}K`
  return formatoMoneda(n)
}

/**
 * Asegura que un monto con un solo decimal (",5") muestre los dos (",50")
 * para que `MontoConCentavos` siempre alinee visualmente.
 */
export function fmtFijo(formatoMoneda: (n: number) => string, n: number): string {
  const s = formatoMoneda(n)
  return s.replace(/(,\d)$/, '$10')
}

// ─── Formato de fecha ───

/**
 * Convierte ISO (YYYY-MM-DD o ISO timestamp) a "dd/mm".
 */
export function fmtFechaCorta(iso: string | null): string {
  if (!iso) return ''
  const [, m, d] = iso.slice(0, 10).split('-')
  return `${d}/${m}`
}

// ─── Caché local con TTL ───
//
// Pensado para los widgets navegables del dashboard (sueldos-mes, asistencia-mes,
// etc.). Cada widget genera una clave única (incluyendo empresa + período) y
// elige un TTL — por ejemplo, los meses ya cerrados rara vez cambian, así que
// pueden cachearse mucho más tiempo que el mes en curso.
//
// El caché se guarda en `localStorage`. Si el usuario abre el dashboard varias
// veces seguidas no se hace fetch al endpoint, se reusa el último response.

interface EntradaCache<T> {
  data: T
  guardadoEn: number
}

/**
 * Lee una entrada de caché si existe y no venció. Devuelve null si no hay
 * caché válido. No tira errores: si localStorage falla (modo privado, etc.)
 * devuelve null silenciosamente.
 */
export function leerCacheLocal<T>(clave: string, ttlMs: number): T | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(clave)
    if (!raw) return null
    const entrada = JSON.parse(raw) as EntradaCache<T>
    if (Date.now() - entrada.guardadoEn > ttlMs) return null
    return entrada.data
  } catch {
    return null
  }
}

/** Guarda una entrada en localStorage con timestamp de "ahora". */
export function guardarCacheLocal<T>(clave: string, data: T): void {
  if (typeof window === 'undefined') return
  try {
    const entrada: EntradaCache<T> = { data, guardadoEn: Date.now() }
    localStorage.setItem(clave, JSON.stringify(entrada))
  } catch {
    // Si está lleno o no hay permiso, lo ignoramos: el widget cae al fetch normal.
  }
}

// ─── Componente: monto con centavos atenuados ───

/**
 * Renderiza un monto con la parte entera grande y los centavos en
 * tipografía más chica + atenuada. Siempre muestra ",XX" — si el monto
 * es entero, agrega ",00" para que todas las filas alineen visualmente.
 */
export function MontoConCentavos({
  valor,
  formatoMoneda,
  className = '',
  tamanoCentavos = '60%',
}: {
  valor: number
  formatoMoneda: (n: number) => string
  className?: string
  tamanoCentavos?: string
}) {
  const completo = fmtFijo(formatoMoneda, valor)
  const conDecimales = completo.match(/^(.*?)(,\d{2})$/)
  const entero = conDecimales ? conDecimales[1] : completo
  const decimal = conDecimales ? conDecimales[2] : ',00'
  return (
    <span className={className}>
      {entero}
      <span className="opacity-60 font-light" style={{ fontSize: tamanoCentavos }}>
        {decimal}
      </span>
    </span>
  )
}
