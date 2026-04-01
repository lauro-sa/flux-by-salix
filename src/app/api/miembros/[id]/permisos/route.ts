import { NextResponse, type NextRequest } from 'next/server'
import { crearClienteServidor } from '@/lib/supabase/servidor'
import { crearClienteAdmin } from '@/lib/supabase/admin'
import type { PermisosMapa } from '@/tipos'
import { ACCIONES_POR_MODULO } from '@/tipos'

/**
 * PUT /api/miembros/[id]/permisos — Editar permisos custom de un miembro.
 * Solo el propietario de la empresa puede editar permisos.
 * Si permisos_custom es null, el miembro usa los defaults del rol.
 *
 * Body: { permisos: PermisosMapa } o { permisos: null } para restablecer
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: miembroId } = await params
    const supabase = await crearClienteServidor()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    const empresaId = user.app_metadata?.empresa_activa_id
    if (!empresaId) {
      return NextResponse.json({ error: 'Sin empresa activa' }, { status: 403 })
    }

    const admin = crearClienteAdmin()

    // Propietario o administrador pueden editar permisos
    const { data: miembroActual } = await admin
      .from('miembros')
      .select('rol')
      .eq('usuario_id', user.id)
      .eq('empresa_id', empresaId)
      .single()

    if (!miembroActual || !['propietario', 'administrador'].includes(miembroActual.rol)) {
      return NextResponse.json({ error: 'Sin permisos para editar permisos de miembros' }, { status: 403 })
    }

    const body = await request.json()
    const { permisos } = body as { permisos: PermisosMapa | null }

    // Validar que los permisos son validos si se envian
    if (permisos !== null && permisos !== undefined) {
      for (const [modulo, acciones] of Object.entries(permisos)) {
        const accionesValidas = ACCIONES_POR_MODULO[modulo as keyof typeof ACCIONES_POR_MODULO]
        if (!accionesValidas) {
          return NextResponse.json({ error: `Modulo invalido: ${modulo}` }, { status: 400 })
        }
        if (!Array.isArray(acciones)) {
          return NextResponse.json({ error: `Acciones de ${modulo} deben ser un array` }, { status: 400 })
        }
        for (const accion of acciones) {
          if (!accionesValidas.includes(accion)) {
            return NextResponse.json({ error: `Accion invalida '${accion}' en modulo '${modulo}'` }, { status: 400 })
          }
        }
      }
    }

    // Verificar que el miembro objetivo existe en la misma empresa
    const { data: miembroObjetivo } = await admin
      .from('miembros')
      .select('id, rol, permisos_custom')
      .eq('id', miembroId)
      .eq('empresa_id', empresaId)
      .single()

    if (!miembroObjetivo) {
      return NextResponse.json({ error: 'Miembro no encontrado en esta empresa' }, { status: 404 })
    }

    // No se pueden editar permisos del propietario
    if (miembroObjetivo.rol === 'propietario') {
      return NextResponse.json({ error: 'No se pueden editar permisos del propietario' }, { status: 403 })
    }

    const permisosAntes = miembroObjetivo.permisos_custom

    // Actualizar permisos_custom
    const { error: errorUpdate } = await admin
      .from('miembros')
      .update({ permisos_custom: permisos ?? null })
      .eq('id', miembroId)

    if (errorUpdate) {
      return NextResponse.json({ error: 'Error al actualizar permisos' }, { status: 500 })
    }

    // Registrar en auditoria
    const accionTipo = permisos === null ? 'restablecer_rol' : 'editar_permisos'
    await admin
      .from('permisos_auditoria')
      .insert({
        empresa_id: empresaId,
        miembro_id: miembroId,
        accion_tipo: accionTipo,
        permisos_antes: permisosAntes,
        permisos_despues: permisos,
        editado_por: user.id,
      })

    return NextResponse.json({
      mensaje: permisos === null
        ? 'Permisos restablecidos a defaults del rol'
        : 'Permisos actualizados',
      miembro_id: miembroId,
      permisos_custom: permisos,
    })
  } catch {
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}

/**
 * GET /api/miembros/[id]/permisos — Obtener permisos efectivos de un miembro.
 * Propietario y administrador pueden ver permisos de cualquier miembro.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: miembroId } = await params
    const supabase = await crearClienteServidor()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    const empresaId = user.app_metadata?.empresa_activa_id
    if (!empresaId) {
      return NextResponse.json({ error: 'Sin empresa activa' }, { status: 403 })
    }

    const admin = crearClienteAdmin()

    // Verificar que el solicitante es admin+
    const { data: miembroActual } = await admin
      .from('miembros')
      .select('rol')
      .eq('usuario_id', user.id)
      .eq('empresa_id', empresaId)
      .single()

    if (!miembroActual || !['propietario', 'administrador'].includes(miembroActual.rol)) {
      return NextResponse.json({ error: 'Sin permiso para ver permisos' }, { status: 403 })
    }

    // Obtener miembro objetivo
    const { data: miembro } = await admin
      .from('miembros')
      .select('id, rol, permisos_custom')
      .eq('id', miembroId)
      .eq('empresa_id', empresaId)
      .single()

    if (!miembro) {
      return NextResponse.json({ error: 'Miembro no encontrado' }, { status: 404 })
    }

    // Obtener historial de auditoria (ultimos 20)
    const { data: auditoria } = await admin
      .from('permisos_auditoria')
      .select('*')
      .eq('miembro_id', miembroId)
      .order('editado_en', { ascending: false })
      .limit(20)

    return NextResponse.json({
      miembro_id: miembro.id,
      rol: miembro.rol,
      permisos_custom: miembro.permisos_custom,
      usa_custom: miembro.permisos_custom !== null,
      auditoria: auditoria ?? [],
    })
  } catch {
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
