import { NextResponse, type NextRequest } from 'next/server'
import { obtenerUsuarioRuta } from '@/lib/supabase/servidor'
import { crearClienteAdmin } from '@/lib/supabase/admin'
import { TABLA_ESTADOS_POR_ENTIDAD } from '@/lib/estados/mapeo'
import { esEntidadConEstado, esGrupoEstado } from '@/tipos/estados'

/**
 * POST /api/estados/items — Crear un estado propio de empresa.
 *
 * Body: {
 *   entidad_tipo: EntidadConEstado,
 *   clave: string,
 *   etiqueta: string,
 *   grupo: GrupoEstado,
 *   icono?: string,
 *   color?: string,
 *   orden?: number,
 * }
 *
 * Restricciones:
 *   - Solo crea estados propios (empresa_id = empresa actual). Los del sistema
 *     se gestionan por seed/migraciones, no desde la app.
 *   - Si la `clave` ya existe (sistema o propio) la API devuelve 409.
 *     Las claves son únicas por (empresa_id, clave) según constraint.
 */
export async function POST(request: NextRequest) {
  try {
    const { user } = await obtenerUsuarioRuta()
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const empresaId = user.app_metadata?.empresa_activa_id
    if (!empresaId) return NextResponse.json({ error: 'Sin empresa activa' }, { status: 403 })

    const body = await request.json()
    const { entidad_tipo, clave, etiqueta, grupo } = body
    const icono = body.icono ?? 'Circle'
    const color = body.color ?? '#6b7280'
    const orden = typeof body.orden === 'number' ? body.orden : 100

    if (!entidad_tipo || !esEntidadConEstado(entidad_tipo)) {
      return NextResponse.json({ error: `entidad_tipo inválida: "${entidad_tipo}"` }, { status: 400 })
    }
    const tabla = TABLA_ESTADOS_POR_ENTIDAD[entidad_tipo]
    if (!tabla) {
      return NextResponse.json({ error: `Entidad "${entidad_tipo}" no soportada todavía` }, { status: 400 })
    }
    if (!clave || typeof clave !== 'string' || !clave.trim()) {
      return NextResponse.json({ error: 'clave es obligatoria' }, { status: 400 })
    }
    if (!etiqueta || typeof etiqueta !== 'string' || !etiqueta.trim()) {
      return NextResponse.json({ error: 'etiqueta es obligatoria' }, { status: 400 })
    }
    if (!esGrupoEstado(grupo)) {
      return NextResponse.json({ error: 'grupo inválido' }, { status: 400 })
    }

    // Normalizar clave: snake_case, solo letras/números/guiones bajos.
    const claveNormalizada = clave.trim().toLowerCase()
      .replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '')
    if (!claveNormalizada) {
      return NextResponse.json({ error: 'clave inválida' }, { status: 400 })
    }

    const admin = crearClienteAdmin()
    const { data, error } = await admin
      .from(tabla)
      .insert({
        empresa_id: empresaId,
        clave: claveNormalizada,
        etiqueta: etiqueta.trim(),
        grupo,
        icono,
        color,
        orden,
        activo: true,
        es_sistema: false,
      })
      .select()
      .single()

    if (error) {
      // 23505 = unique violation (clave duplicada)
      if ((error as { code?: string }).code === '23505') {
        return NextResponse.json({ error: 'Ya existe un estado con esa clave' }, { status: 409 })
      }
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ estado: data })
  } catch (err) {
    console.error('Error POST /api/estados/items:', err)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
