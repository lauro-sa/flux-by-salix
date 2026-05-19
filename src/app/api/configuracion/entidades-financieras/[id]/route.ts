import { NextResponse, type NextRequest } from 'next/server'
import { requerirPermisoAPI } from '@/lib/permisos-servidor'
import { crearClienteAdmin } from '@/lib/supabase/admin'

/**
 * PATCH/DELETE de entidades del catálogo. Edita o elimina (soft) una
 * entidad financiera concreta. Requiere `config_empresa:editar`.
 *
 * Soft-delete: `eliminada = true`. No se borra el registro porque las
 * `info_bancaria` apuntan vía FK (ON DELETE SET NULL) y queremos
 * preservar el nombre histórico en pagos viejos.
 */

const CAMPOS_PATCH = ['nombre', 'tipo', 'codigo_banco', 'activa'] as const
type CampoPatch = typeof CAMPOS_PATCH[number]

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const guard = await requerirPermisoAPI('config_empresa', 'editar')
    if ('respuesta' in guard) return guard.respuesta
    const { empresaId, user } = guard
    const { id } = await params

    const body = await request.json()
    const admin = crearClienteAdmin()

    const { data: actual } = await admin
      .from('entidades_financieras')
      .select('id, tipo, nombre, codigo_banco, activa, eliminada')
      .eq('id', id)
      .eq('empresa_id', empresaId)
      .maybeSingle()

    if (!actual || actual.eliminada) {
      return NextResponse.json({ error: 'Entidad no encontrada' }, { status: 404 })
    }

    const cambios: Record<string, unknown> = {}
    const auditoriaCampos: Array<{ campo: string; antes: string | null; despues: string | null }> = []

    for (const campo of CAMPOS_PATCH) {
      if (!(campo in body)) continue
      let valor: unknown = body[campo]

      if (campo === 'nombre' && typeof valor === 'string') {
        const raw = valor.trim()
        if (!raw) return NextResponse.json({ error: 'Nombre vacío' }, { status: 400 })
        valor = raw.replace(/\b\w/g, (c: string) => c.toUpperCase())
      }

      if (campo === 'codigo_banco') {
        const raw = (valor as string | null | undefined)?.toString().trim() ?? ''
        valor = /^\d{3}$/.test(raw) ? raw : null
      }

      if (campo === 'tipo' && valor !== 'banco' && valor !== 'digital') continue

      if (valor !== (actual as Record<string, unknown>)[campo]) {
        cambios[campo] = valor
        auditoriaCampos.push({
          campo,
          antes: (actual as Record<string, unknown>)[campo] === null ? null : String((actual as Record<string, unknown>)[campo]),
          despues: valor === null ? null : String(valor),
        })
      }
    }

    if (Object.keys(cambios).length === 0) {
      return NextResponse.json({ entidad: actual })
    }

    cambios.actualizado_por = user.id

    const { data, error } = await admin
      .from('entidades_financieras')
      .update(cambios)
      .eq('id', id)
      .eq('empresa_id', empresaId)
      .select('id, tipo, nombre, codigo_banco, activa')
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    // Auditoría por cada campo modificado.
    if (auditoriaCampos.length > 0) {
      const accion: 'activar' | 'desactivar' | 'editar' =
        cambios.activa === true ? 'activar'
        : cambios.activa === false ? 'desactivar'
        : 'editar'

      await admin.from('auditoria_entidades_financieras').insert(
        auditoriaCampos.map(c => ({
          empresa_id: empresaId,
          entidad_id: id,
          editado_por: user.id,
          accion,
          campo_modificado: c.campo,
          valor_anterior: c.antes,
          valor_nuevo: c.despues,
        }))
      )
    }

    return NextResponse.json({ entidad: data })
  } catch {
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const guard = await requerirPermisoAPI('config_empresa', 'editar')
    if ('respuesta' in guard) return guard.respuesta
    const { empresaId, user } = guard
    const { id } = await params

    const admin = crearClienteAdmin()
    const { data: entidad } = await admin
      .from('entidades_financieras')
      .select('id, nombre, eliminada')
      .eq('id', id)
      .eq('empresa_id', empresaId)
      .maybeSingle()

    if (!entidad || entidad.eliminada) {
      return NextResponse.json({ error: 'Entidad no encontrada' }, { status: 404 })
    }

    const { error } = await admin
      .from('entidades_financieras')
      .update({ eliminada: true, activa: false, actualizado_por: user.id })
      .eq('id', id)
      .eq('empresa_id', empresaId)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    await admin.from('auditoria_entidades_financieras').insert({
      empresa_id: empresaId,
      entidad_id: id,
      editado_por: user.id,
      accion: 'eliminar',
      campo_modificado: 'eliminada',
      valor_anterior: 'false',
      valor_nuevo: 'true',
    })

    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
