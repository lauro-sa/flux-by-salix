import { NextResponse, type NextRequest } from 'next/server'
import { requerirPermisoAPI } from '@/lib/permisos-servidor'
import { crearClienteAdmin } from '@/lib/supabase/admin'

/** Campos que se auditan al editar (se ignora el resto). */
const CAMPOS_AUDITABLES = [
  'nombre', 'categoria', 'asunto', 'contenido', 'contenido_html',
  'modulos', 'disponible_para', 'roles_permitidos', 'usuarios_permitidos',
  'variables', 'activo', 'orden',
] as const

/** Serializa un valor a texto para guardar en auditoría. */
function serializarValor(valor: unknown): string {
  if (valor === null || valor === undefined) return ''
  if (typeof valor === 'string') return valor
  if (typeof valor === 'number' || typeof valor === 'boolean') return String(valor)
  return JSON.stringify(valor)
}

/**
 * PATCH /api/correo/plantillas/[id] — Actualizar plantilla de correo.
 * Registra auditoría campo por campo en auditoria_plantillas_correo.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const guard = await requerirPermisoAPI('config_correo', 'editar')
    if ('respuesta' in guard) return guard.respuesta
    const { user, empresaId } = guard

    const body = await request.json()
    const admin = crearClienteAdmin()

    // Obtener nombre del editor
    const { data: perfil } = await admin
      .from('perfiles')
      .select('nombre, apellido')
      .eq('id', user.id)
      .single()
    const nombreEditor = perfil ? `${perfil.nombre} ${perfil.apellido || ''}`.trim() : 'Usuario'

    // Obtener registro original para diff de auditoría
    const { data: original } = await admin
      .from('plantillas_correo')
      .select('*')
      .eq('id', id)
      .eq('empresa_id', empresaId)
      .single()

    if (!original) return NextResponse.json({ error: 'Plantilla no encontrada' }, { status: 404 })

    // Detectar cambios en campos auditables
    const cambios: Array<{ campo: string; antes: unknown; despues: unknown }> = []
    for (const campo of CAMPOS_AUDITABLES) {
      if (!(campo in body)) continue
      const antes = original[campo as keyof typeof original]
      const despues = body[campo]
      if (JSON.stringify(antes) !== JSON.stringify(despues)) {
        cambios.push({ campo, antes, despues })
      }
    }

    // Insertar auditoría por cada cambio
    if (cambios.length > 0) {
      const auditorias = cambios.map(c => ({
        empresa_id: empresaId,
        plantilla_id: id,
        editado_por: user.id,
        campo_modificado: c.campo,
        valor_anterior: serializarValor(c.antes),
        valor_nuevo: serializarValor(c.despues),
      }))
      await admin.from('auditoria_plantillas_correo').insert(auditorias)
    }

    const { data, error } = await admin
      .from('plantillas_correo')
      .update({
        ...body,
        editado_por: user.id,
        editado_por_nombre: nombreEditor,
        actualizado_en: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('empresa_id', empresaId)
      .select()
      .single()

    if (error) throw error
    return NextResponse.json({ plantilla: data })
  } catch (err) {
    console.error('Error al actualizar plantilla de correo:', err)
    return NextResponse.json({ error: 'Error al actualizar plantilla de correo' }, { status: 500 })
  }
}

/**
 * DELETE /api/correo/plantillas/[id] — Eliminar plantilla de correo.
 * Las plantillas de sistema no se pueden eliminar.
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const guard = await requerirPermisoAPI('config_correo', 'editar')
    if ('respuesta' in guard) return guard.respuesta
    const { empresaId } = guard

    const admin = crearClienteAdmin()

    // Verificar si es plantilla de sistema
    const { data: plantilla } = await admin
      .from('plantillas_correo')
      .select('es_sistema')
      .eq('id', id)
      .eq('empresa_id', empresaId)
      .single()

    if (plantilla?.es_sistema) {
      return NextResponse.json(
        { error: 'Las plantillas del sistema no se pueden eliminar' },
        { status: 403 },
      )
    }

    const { error } = await admin
      .from('plantillas_correo')
      .delete()
      .eq('id', id)
      .eq('empresa_id', empresaId)

    if (error) throw error
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('Error al eliminar plantilla de correo:', err)
    return NextResponse.json({ error: 'Error al eliminar plantilla de correo' }, { status: 500 })
  }
}
