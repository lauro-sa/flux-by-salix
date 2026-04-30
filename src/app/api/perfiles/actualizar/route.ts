import { NextResponse, type NextRequest } from 'next/server'
import { requerirPermisoAPI, requerirAutenticacionAPI } from '@/lib/permisos-servidor'
import { crearClienteAdmin } from '@/lib/supabase/admin'
import { normalizarTelefono } from '@/lib/validaciones'

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

    // Editar propio perfil: cualquier miembro autenticado puede. Editar ajeno:
    // requiere usuarios:editar (se chequea después de identificar al usuario).
    const accion = 'editar' as const
    const guardMin = await requerirAutenticacionAPI()
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
    // Normalizar teléfonos al formato canónico E.164 antes de persistir
    if ('telefono' in actualizar && actualizar.telefono) {
      actualizar.telefono = normalizarTelefono(actualizar.telefono as string)
    }
    if ('telefono_empresa' in actualizar && actualizar.telefono_empresa) {
      actualizar.telefono_empresa = normalizarTelefono(actualizar.telefono_empresa as string)
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

    // Espejar nombre/apellido a auth.user_metadata para que sidebar/header/menú
    // móvil (que leen del JWT, no de perfiles) muestren el nombre actualizado
    // sin fetch extra. perfiles es la fuente de verdad; esto es solo el espejo.
    if ('nombre' in actualizar || 'apellido' in actualizar) {
      const { data: existente } = await admin.auth.admin.getUserById(perfil_id)
      const metaActual = existente?.user?.user_metadata ?? {}
      const nombreFinal = ('nombre' in actualizar ? actualizar.nombre : data.nombre) ?? null
      const apellidoFinal = ('apellido' in actualizar ? actualizar.apellido : data.apellido) ?? null
      await admin.auth.admin.updateUserById(perfil_id, {
        user_metadata: {
          ...metaActual,
          nombre: nombreFinal,
          apellido: apellidoFinal,
        },
      })
    }

    return NextResponse.json(data)
  } catch (err) {
    console.error('Error interno en /api/perfiles/actualizar:', err)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
