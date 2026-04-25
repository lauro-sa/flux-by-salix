import { NextResponse, type NextRequest } from 'next/server'
import { crearClienteAdmin } from '@/lib/supabase/admin'
import { requerirPermisoAPI } from '@/lib/permisos-servidor'

/**
 * GET /api/miembros/[id] — Datos públicos accionables del miembro: nombre,
 * apellido, correos (login + empresa) y teléfonos (personal + empresa). Lo
 * usa el panel de acciones rápidas (FAB de Salix IA) cuando el usuario está
 * en /usuarios/[id] para ofrecer "Llamar / Correo" al compañero del equipo.
 *
 * Permiso requerido: `usuarios:ver` — mismo gate que el listado completo
 * en /api/miembros. Evita que un colaborador sin acceso a Usuarios pueda
 * extraer correos/teléfonos del equipo iterando IDs.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const guard = await requerirPermisoAPI('usuarios', 'ver')
    if ('respuesta' in guard) return guard.respuesta
    const { empresaId } = guard

    const admin = crearClienteAdmin()

    // Validar que el miembro pertenezca a la empresa activa
    const { data: miembro, error: errMiembro } = await admin
      .from('miembros')
      .select('id, empresa_id, usuario_id')
      .eq('id', id)
      .eq('empresa_id', empresaId)
      .maybeSingle()

    if (errMiembro || !miembro) {
      return NextResponse.json({ error: 'Miembro no encontrado' }, { status: 404 })
    }

    // Si tiene cuenta Flux, traer perfil real
    if (miembro.usuario_id) {
      const { data: perfil } = await admin
        .from('perfiles')
        .select('nombre, apellido, correo, correo_empresa, telefono, telefono_empresa')
        .eq('id', miembro.usuario_id)
        .maybeSingle()

      if (perfil) {
        return NextResponse.json({
          id: miembro.id,
          nombre: perfil.nombre,
          apellido: perfil.apellido,
          correo: perfil.correo,
          correo_empresa: perfil.correo_empresa,
          telefono: perfil.telefono,
          telefono_empresa: perfil.telefono_empresa,
        })
      }
    }

    // Miembro sin cuenta (solo fichaje): derivar del contacto tipo equipo
    const { data: contacto } = await admin
      .from('contactos')
      .select('nombre, apellido, correo, telefono')
      .eq('miembro_id', miembro.id)
      .eq('en_papelera', false)
      .maybeSingle()

    return NextResponse.json({
      id: miembro.id,
      nombre: contacto?.nombre || '',
      apellido: contacto?.apellido || '',
      correo: contacto?.correo || null,
      correo_empresa: null,
      telefono: contacto?.telefono || null,
      telefono_empresa: null,
    })
  } catch {
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
