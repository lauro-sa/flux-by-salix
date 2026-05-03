import { NextResponse, type NextRequest } from 'next/server'
import { requerirPermisoAPI } from '@/lib/permisos-servidor'
import { crearClienteAdmin } from '@/lib/supabase/admin'

/**
 * POST /api/miembros/[id]/revocar — Revocacion de emergencia.
 * Quita TODOS los permisos de un miembro (permisos_custom = {} vacio).
 * Requiere motivo obligatorio (min 5 caracteres).
 * Solo propietario puede ejecutar.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: miembroId } = await params
    const guard = await requerirPermisoAPI('usuarios', 'editar')
    if ('respuesta' in guard) return guard.respuesta
    const { user, empresaId } = guard

    const admin = crearClienteAdmin()

    const body = await request.json()
    const { motivo } = body as { motivo: string }

    // Motivo obligatorio, minimo 5 caracteres
    if (!motivo || motivo.trim().length < 5) {
      return NextResponse.json({ error: 'El motivo es obligatorio (minimo 5 caracteres)' }, { status: 400 })
    }

    // Verificar miembro objetivo
    const { data: miembroObjetivo } = await admin
      .from('miembros')
      .select('id, rol, permisos_custom')
      .eq('id', miembroId)
      .eq('empresa_id', empresaId)
      .single()

    if (!miembroObjetivo) {
      return NextResponse.json({ error: 'Miembro no encontrado en esta empresa' }, { status: 404 })
    }

    if (miembroObjetivo.rol === 'propietario') {
      return NextResponse.json({ error: 'No se pueden revocar permisos del propietario' }, { status: 403 })
    }

    const permisosAntes = miembroObjetivo.permisos_custom

    // Revocar: establecer permisos_custom como objeto vacio (sin acceso a nada)
    const { error: errorUpdate } = await admin
      .from('miembros')
      .update({ permisos_custom: {} })
      .eq('id', miembroId)

    if (errorUpdate) {
      return NextResponse.json({ error: 'Error al revocar permisos' }, { status: 500 })
    }

    // Registrar en auditoria con motivo
    await admin
      .from('permisos_auditoria')
      .insert({
        empresa_id: empresaId,
        miembro_id: miembroId,
        accion_tipo: 'revocar_todo',
        permisos_antes: permisosAntes,
        permisos_despues: {},
        motivo: motivo.trim(),
        editado_por: user.id,
      })

    // Forzar logout del usuario afectado
    const { data: miembroData } = await admin
      .from('miembros')
      .select('usuario_id')
      .eq('id', miembroId)
      .single()

    // Empleados sin cuenta Flux (usuario_id null) no tienen sesión que cerrar.
    if (miembroData?.usuario_id) {
      await admin.auth.admin.signOut(miembroData.usuario_id, 'global')
    }

    return NextResponse.json({
      mensaje: 'Permisos revocados. El usuario fue desconectado.',
      miembro_id: miembroId,
      motivo: motivo.trim(),
    })
  } catch {
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
