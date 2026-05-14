import { NextResponse, type NextRequest } from 'next/server'
import Holidays from 'date-holidays'

/**
 * GET /api/calendario/feriados-oficiales?pais=AR&anios=2025,2026
 *
 * Devuelve los feriados PÚBLICOS oficiales para uno o varios años en un
 * país determinado. Antes este cálculo vivía en cliente vía
 * `date-holidays`, que arrastra moment.js + todas las locales (~1.6 MB)
 * al bundle. Ahora la librería sólo se carga en el servidor.
 *
 * El response se cachea agresivamente porque los feriados oficiales no
 * cambian día a día (s-maxage=1 día, stale-while-revalidate=7 días).
 *
 * Usado por: VistaMatriz de asistencias, calendario y cualquier vista que
 * pinte feriados oficiales sin necesidad de leer la tabla `feriados` de
 * la empresa (esa sí incluye los custom).
 */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams
  const pais = (params.get('pais') || 'AR').toUpperCase()
  const aniosStr = params.get('anios') || String(new Date().getFullYear())
  const anios = aniosStr
    .split(',')
    .map(s => parseInt(s.trim(), 10))
    .filter(n => Number.isFinite(n) && n >= 1900 && n <= 2100)

  if (anios.length === 0) {
    return NextResponse.json({ error: 'Parámetro "anios" inválido' }, { status: 400 })
  }

  const hd = new Holidays(pais)
  const feriados: Array<{ fecha: string; nombre: string }> = []
  for (const anio of anios) {
    const list = hd.getHolidays(anio)
    for (const h of list) {
      if (h.type === 'public') {
        feriados.push({
          fecha: h.date.split(' ')[0], // "YYYY-MM-DD HH:mm:ss" → "YYYY-MM-DD"
          nombre: h.name,
        })
      }
    }
  }

  return NextResponse.json(
    { pais, anios, feriados },
    {
      headers: {
        'Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=604800',
      },
    },
  )
}
