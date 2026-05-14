import { NextResponse, type NextRequest } from 'next/server'
import { crearClienteAdmin } from '@/lib/supabase/admin'
import { requerirPermisoAPI } from '@/lib/permisos-servidor'
import { obtenerIdentidadMiembro } from '@/lib/miembros/identidad'

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

    // Identidad consolidada: perfil para los que tienen cuenta, contacto-equipo
    // para los que no. Ver src/lib/miembros/identidad.ts.
    const identidad = await obtenerIdentidadMiembro(admin, miembro, empresaId)

    return NextResponse.json({
      id: miembro.id,
      nombre: identidad?.nombre ?? '',
      apellido: identidad?.apellido ?? '',
      correo: identidad?.correo ?? null,
      correo_empresa: identidad?.correo_empresa ?? null,
      telefono: identidad?.telefono ?? null,
      telefono_empresa: identidad?.telefono_empresa ?? null,
    })
  } catch {
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
