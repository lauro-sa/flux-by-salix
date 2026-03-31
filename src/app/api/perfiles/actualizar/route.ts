import { NextResponse, type NextRequest } from 'next/server'
import { crearClienteServidor } from '@/lib/supabase/servidor'
import { crearClienteAdmin } from '@/lib/supabase/admin'

/**
 * PATCH /api/perfiles/actualizar — Actualizar perfil de un usuario.
 * - Si es tu propio perfil: cualquier usuario autenticado.
 * - Si es el perfil de otro: solo propietario o administrador de la misma empresa.
 * Usa admin client para bypasear RLS.
 */
export async function PATCH(request: NextRequest) {
  try {
    const supabase = await crearClienteServidor()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const { perfil_id, ...campos } = await request.json()
    if (!perfil_id) return NextResponse.json({ error: 'perfil_id requerido' }, { status: 400 })

    const admin = crearClienteAdmin()

    // Si no es el propio perfil, verificar permisos
    if (perfil_id !== user.id) {
      const empresaId = user.app_metadata?.empresa_activa_id
      if (!empresaId) return NextResponse.json({ error: 'Sin empresa activa' }, { status: 403 })

      // Verificar que el editor es propietario o admin
      const { data: miembroEditor } = await admin
        .from('miembros')
        .select('rol')
        .eq('usuario_id', user.id)
        .eq('empresa_id', empresaId)
        .single()

      if (!miembroEditor || !['propietario', 'administrador'].includes(miembroEditor.rol)) {
        return NextResponse.json({ error: 'Sin permisos para editar este perfil' }, { status: 403 })
      }

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
      'contacto_emergencia',
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
