import { NextResponse, type NextRequest } from 'next/server'
import { requerirPermisoAPI } from '@/lib/permisos-servidor'
import { crearClienteAdmin } from '@/lib/supabase/admin'

/**
 * PATCH /api/asistencias/fichar/ubicacion — Actualizar ubicación de un fichaje existente.
 * Se usa en segundo plano después de que el fichaje ya se registró (para no bloquear la UI).
 * Body: { fichaje_id: string, campo: 'ubicacion_entrada' | 'ubicacion_salida', ubicacion: object }
 */
export async function PATCH(request: NextRequest) {
  try {
    const guard = await requerirPermisoAPI('asistencias', 'marcar')
    if ('respuesta' in guard) return guard.respuesta
    const { empresaId } = guard

    const { fichaje_id, campo, ubicacion } = await request.json()

    if (!fichaje_id || !campo || !ubicacion) {
      return NextResponse.json({ error: 'Faltan parámetros' }, { status: 400 })
    }

    // Solo permitir campos de ubicación válidos
    if (campo !== 'ubicacion_entrada' && campo !== 'ubicacion_salida') {
      return NextResponse.json({ error: 'Campo inválido' }, { status: 400 })
    }

    const admin = crearClienteAdmin()

    // Verificar que el fichaje pertenece a la empresa del usuario
    const { error } = await admin
      .from('asistencias')
      .update({ [campo]: ubicacion, actualizado_en: new Date().toISOString() })
      .eq('id', fichaje_id)
      .eq('empresa_id', empresaId)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
