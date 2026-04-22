import { NextResponse, type NextRequest } from 'next/server'
import { requerirPermisoAPI } from '@/lib/permisos-servidor'
import { crearClienteAdmin } from '@/lib/supabase/admin'

/**
 * PATCH /api/perfiles/actualizar — Actualizar perfil de un usuario.
 * - Si es tu propio perfil: cualquier usuario autenticado.
 * - Si es el perfil de otro: solo propietario o administrador de la misma empresa.
 * Usa admin client para bypasear RLS.
 */
export async function PATCH(request: NextRequest) {
  try {
    const { perfil_id, ...campos } = await request.json()
    if (!perfil_id) return NextResponse.json({ error: 'perfil_id requerido' }, { status: 400 })

    // Para editar a otros usamos el permiso fuerte; si es uno mismo, basta con
    // tener visibilidad propia (cualquier miembro activo la tiene).
    const accion = 'editar' as const
    // Primero tratamos de obtener el user con un permiso mínimo para conocer identidad.
    const guardMin = await requerirPermisoAPI('contactos', 'ver_propio')
    if ('respuesta' in guardMin) return guardMin.respuesta
    const { user, empresaId } = guardMin

    const admin = crearClienteAdmin()

    // Si es otro perfil, exigir permiso explícito de usuarios:editar
    if (perfil_id !== user.id) {
      const guardOtro = await requerirPermisoAPI('usuarios', accion)
      if ('respuesta' in guardOtro) return guardOtro.respuesta

      // Verificar que el perfil objetivo pertenece a la misma empresa
      const { data: miembroObjetivo } = await admin
        .from('miembros')
        .select('id')
        .eq('usuario_id', perfil_id)
        .eq('empresa_id', empresaId)
        .single()

      if (!miembroObjetivo) {
        return NextResponse.json({ error: 'Usuario no pertenece a esta empresa' }, { status: 403 })
      }
    }

    // Campos permitidos
    const permitidos = [
      'nombre', 'apellido', 'telefono', 'avatar_url',
      'fecha_nacimiento', 'genero', 'domicilio', 'direccion',
      'documento_tipo', 'documento_numero',
      'correo', 'correo_empresa', 'telefono_empresa', 'firma_correo',
      'contacto_emergencia', 'formato_nombre_remitente',
    ]
    const actualizar: Record<string, unknown> = {}
    for (const campo of permitidos) {
      if (campo in campos) actualizar[campo] = campos[campo]
    }

    if (Object.keys(actualizar).length === 0) {
      return NextResponse.json({ error: 'Sin campos para actualizar' }, { status: 400 })
    }

    actualizar.actualizado_en = new Date().toISOString()

    const { data, error } = await admin
      .from('perfiles')
      .update(actualizar)
      .eq('id', perfil_id)
      .select()
      .single()

    if (error) {
      console.error('Error actualizando perfil:', error)
      return NextResponse.json({ error: 'Error al actualizar perfil' }, { status: 500 })
    }

    return NextResponse.json(data)
  } catch (err) {
    console.error('Error interno en /api/perfiles/actualizar:', err)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
