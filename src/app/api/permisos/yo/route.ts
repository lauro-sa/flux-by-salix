import { NextResponse } from 'next/server'
import { obtenerUsuarioRuta } from '@/lib/supabase/servidor'
import { crearClienteAdmin } from '@/lib/supabase/admin'
import type { Rol } from '@/tipos/miembro'
import type { PermisosMapa } from '@/tipos/permisos'

/**
 * GET /api/permisos/yo — Permisos efectivos del usuario autenticado leídos
 * directamente de la fila `miembros` en DB (no del JWT).
 *
 * Se usa desde ProveedorPermisos (cliente) tanto al montar como cada vez que
 * llega un evento realtime sobre la fila del miembro. Es la fuente de verdad
 * única de permisos en tiempo real — el JWT solo lleva rol + empresa_activa
 * y no se regenera con cada cambio de permisos_custom.
 */
export async function GET() {
  try {
    const { user } = await obtenerUsuarioRuta()
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const empresaId = user.app_metadata?.empresa_activa_id
    if (!empresaId) {
      return NextResponse.json({
        miembro_id: null,
        rol: null,
        permisos_custom: null,
        activo: false,
        es_propietario: false,
        es_superadmin: !!user.app_metadata?.es_superadmin,
      })
    }

    const admin = crearClienteAdmin()
    const { data: miembro } = await admin
      .from('miembros')
      .select('id, rol, permisos_custom, activo')
      .eq('usuario_id', user.id)
      .eq('empresa_id', empresaId)
      .maybeSingle()

    if (!miembro) {
      return NextResponse.json({
        miembro_id: null,
        rol: null,
        permisos_custom: null,
        activo: false,
        es_propietario: false,
        es_superadmin: !!user.app_metadata?.es_superadmin,
      })
    }

    return NextResponse.json({
      miembro_id: miembro.id as string,
      rol: miembro.rol as Rol,
      permisos_custom: (miembro.permisos_custom as PermisosMapa | null) || null,
      activo: !!miembro.activo,
      es_propietario: miembro.rol === 'propietario',
      es_superadmin: !!user.app_metadata?.es_superadmin,
    })
  } catch {
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
