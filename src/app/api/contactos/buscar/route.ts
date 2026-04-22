import { NextResponse, type NextRequest } from 'next/server'
import { requerirPermisoAPI } from '@/lib/permisos-servidor'
import { crearClienteServidor } from '@/lib/supabase/servidor'
import { normalizarAcentos } from '@/lib/validaciones'

/**
 * GET /api/contactos/buscar?q=texto&padre_id=uuid
 * Búsqueda rápida de contactos por nombre o email, con priorización opcional:
 * cuando se pasa `padre_id`, los contactos vinculados (hijos) de ese padre
 * aparecen primero en los resultados con `es_hijo: true` y su puesto en el contenedor.
 * Si `q` viene vacío pero hay `padre_id`, devuelve solo los hijos (sin filtrar).
 * Se usa en: autocomplete del compositor de correo (CC/CCO priorizan contactos
 * del destinatario principal del documento).
 */
export async function GET(request: NextRequest) {
  try {
    const guard = await requerirPermisoAPI('contactos', 'ver_propio')
    if ('respuesta' in guard) return guard.respuesta
    const { empresaId } = guard

    const { searchParams } = new URL(request.url)
    const q = searchParams.get('q')?.trim() || ''
    const padreId = searchParams.get('padre_id')?.trim() || null

    const qNorm = q ? normalizarAcentos(q) : ''
    const supabase = await crearClienteServidor()

    // 1) Si hay padre_id, traer primero los hijos (vinculados) del contacto principal.
    //    Los filtramos por `q` en memoria (son pocos, <50 en casi todos los casos).
    let hijos: Array<{ id: string; nombre: string; correo: string; puesto: string | null; es_hijo: true }> = []
    const idsHijos = new Set<string>()

    if (padreId) {
      const { data: vinc } = await supabase
        .from('contacto_vinculaciones')
        .select(`
          puesto,
          vinculado:contactos!contacto_vinculaciones_vinculado_id_fkey(
            id, nombre, apellido, correo
          )
        `)
        .eq('empresa_id', empresaId)
        .eq('contacto_id', padreId)

      const filtroTexto = (n: string, a: string | null, c: string) => {
        if (!qNorm) return true
        const hay = normalizarAcentos(`${n} ${a || ''} ${c}`).toLowerCase()
        return hay.includes(qNorm.toLowerCase())
      }

      hijos = (vinc || [])
        .map(v => {
          const ct = v.vinculado as unknown as { id: string; nombre: string; apellido: string | null; correo: string | null } | null
          if (!ct || !ct.correo) return null
          if (!filtroTexto(ct.nombre, ct.apellido, ct.correo)) return null
          idsHijos.add(ct.id)
          return {
            id: ct.id,
            nombre: `${ct.nombre} ${ct.apellido || ''}`.trim(),
            correo: ct.correo,
            puesto: v.puesto ?? null,
            es_hijo: true as const,
          }
        })
        .filter((x): x is NonNullable<typeof x> => x !== null)
        .slice(0, 10)
    }

    // 2) Si no hay query y sí padre, devolver solo hijos (pre-carga al enfocar).
    if (!q && padreId) {
      return NextResponse.json({ contactos: hijos })
    }

    // 3) Sin query ni padre: nada que sugerir.
    if (!q || q.length < 2) {
      return NextResponse.json({ contactos: [] })
    }

    // 4) Query general, excluyendo hijos ya incluidos arriba.
    let query = supabase
      .from('contactos')
      .select('id, nombre, apellido, correo')
      .eq('empresa_id', empresaId)
      .or(`nombre.ilike.%${qNorm}%,apellido.ilike.%${qNorm}%,correo.ilike.%${qNorm}%`)
      .not('correo', 'is', null)
      .limit(10)

    if (idsHijos.size > 0) {
      const lista = Array.from(idsHijos).map(id => `"${id}"`).join(',')
      query = query.not('id', 'in', `(${lista})`)
    }

    const { data: otros } = await query

    const resto = (otros || []).map(c => ({
      id: c.id,
      nombre: `${c.nombre} ${c.apellido || ''}`.trim(),
      correo: c.correo as string,
      puesto: null,
      es_hijo: false as const,
    }))

    // Hijos primero, resto después, máximo 10 total para no saturar el popover
    const combinado = [...hijos, ...resto].slice(0, 10)

    return NextResponse.json({ contactos: combinado })
  } catch (err) {
    console.error('Error buscando contactos:', err)
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}
