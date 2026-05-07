/**
 * Helpers puros para construir filtros del listado de flujos
 * (`GET /api/flujos`). Extraídos del route handler para que sean
 * testeables sin levantar Supabase y reusables si más adelante
 * otro listado necesita el mismo patrón.
 *
 * El listado expone varios filtros multivaluados (CSV en query
 * string). Cuando llegan dos o más valores y el campo vive dentro
 * de un JSONB hace falta una expresión `or(...)` PostgREST porque
 * `.in(path, [...])` no soporta operadores `->` / `->>`. Estas
 * funciones encapsulan esa traducción.
 */

/**
 * Parsea un valor CSV crudo (de `searchParams.get(...)`) a array
 * de strings limpios. Tolera espacios, comas vacías y valor vacío.
 */
export function parsearCSV(raw: string | null | undefined): string[] {
  if (!raw) return []
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
}

/**
 * Construye la expresión PostgREST `or(...)` para matchear un
 * conjunto de valores contra un mismo path JSONB.
 *
 * Pensado para casos como `disparador->configuracion->>entidad_tipo`
 * o `disparador->>tipo`, donde `.in(path, [...])` no funciona.
 *
 * @param valores Lista no vacía de valores a matchear.
 * @param path Path PostgREST del campo (ej: `disparador->>tipo`).
 * @returns Expresión lista para pasar a `query.or(...)`.
 *
 * Si la lista viene con menos de 2 elementos, el caller debería
 * estar usando `.eq` directo y no llamar a este helper. Devolvemos
 * la expresión equivalente igual (un solo `.eq.x`) para que sea
 * consistente; la decisión `.eq` vs `.or` queda en el caller.
 */
export function expresionORJsonPath(
  valores: readonly string[],
  path: string,
): string {
  return valores.map((v) => `${path}.eq.${v}`).join(',')
}
