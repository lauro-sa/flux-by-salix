import { NextResponse, type NextRequest } from 'next/server'
import { obtenerUsuarioRuta } from '@/lib/supabase/servidor'
import { crearClienteAdmin } from '@/lib/supabase/admin'
import { generarTokenSetup, hashToken } from '@/lib/kiosco/auth'

/**
 * POST /api/kiosco/terminales — Crear terminal + generar link de setup.
 * Body: { nombre }
 * Retorna: { terminal, linkSetup }
 */
export async function POST(request: NextRequest) {
  try {
    const { user } = await obtenerUsuarioRuta()
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const empresaId = user.app_metadata?.empresa_activa_id
    if (!empresaId) return NextResponse.json({ error: 'Sin empresa activa' }, { status: 403 })

    const body = await request.json()
    const { nombre } = body

    if (!nombre?.trim()) {
      return NextResponse.json({ error: 'El nombre es obligatorio' }, { status: 400 })
    }

    const admin = crearClienteAdmin()

    // Generar token de setup (temporal)
    const tokenSetup = generarTokenSetup()
    const tokenHashSetup = hashToken(tokenSetup)

    // Obtener miembro_id del usuario actual
    const { data: miembro } = await admin
      .from('miembros')
      .select('id')
      .eq('usuario_id', user.id)
      .eq('empresa_id', empresaId)
      .single()

    const { data: terminal, error } = await admin
      .from('terminales_kiosco')
      .insert({
        empresa_id: empresaId,
        nombre: nombre.trim(),
        activo: true,
        token_hash: tokenHashSetup,
        creado_por: miembro?.id || null,
        creado_en: new Date().toISOString(),
      })
      .select('id, nombre, activo, creado_en')
      .single()

    if (error) {
      console.error('Error al crear terminal:', error)
      return NextResponse.json({ error: 'Error al crear terminal' }, { status: 500 })
    }

    // Construir link de setup
    const linkSetup = `https://kiosco.salixweb.com/kiosco/setup?token=${tokenSetup}&empresa=${empresaId}&terminal=${terminal.id}`

    return NextResponse.json({
      terminal,
      linkSetup,
      tokenSetup, // Para mostrarlo en UI (válido hasta que se use)
    })
  } catch (error) {
    console.error('Error en POST /api/kiosco/terminales:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

/**
 * DELETE /api/kiosco/terminales — Revocar o eliminar terminal.
 * Body: { terminalId, eliminar?: boolean }
 * eliminar=true → borra de la BD (solo revocadas)
 * eliminar=false → revoca (desactiva)
 */
export async function DELETE(request: NextRequest) {
  try {
    const { user } = await obtenerUsuarioRuta()
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const empresaId = user.app_metadata?.empresa_activa_id
    if (!empresaId) return NextResponse.json({ error: 'Sin empresa activa' }, { status: 403 })

    const body = await request.json()
    const { terminalId, eliminar } = body

    if (!terminalId) {
      return NextResponse.json({ error: 'ID de terminal requerido' }, { status: 400 })
    }

    const admin = crearClienteAdmin()

    // Eliminar definitivamente (solo terminales ya revocadas)
    if (eliminar) {
      const { error } = await admin
        .from('terminales_kiosco')
        .delete()
        .eq('id', terminalId)
        .eq('empresa_id', empresaId)
        .eq('activo', false)

      if (error) {
        return NextResponse.json({ error: 'Error al eliminar' }, { status: 500 })
      }
      return NextResponse.json({ ok: true })
    }

    // Revocar (desactivar)
    const { data: miembro } = await admin
      .from('miembros')
      .select('id')
      .eq('usuario_id', user.id)
      .eq('empresa_id', empresaId)
      .single()

    const { error } = await admin
      .from('terminales_kiosco')
      .update({
        activo: false,
        revocado_por: miembro?.id || null,
        revocado_en: new Date().toISOString(),
        token_hash: null,
      })
      .eq('id', terminalId)
      .eq('empresa_id', empresaId)

    if (error) {
      console.error('Error al revocar terminal:', error)
      return NextResponse.json({ error: 'Error al revocar' }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('Error en DELETE /api/kiosco/terminales:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

/**
 * PATCH /api/kiosco/terminales — Regenerar link de setup para terminal existente.
 * Body: { terminalId }
 */
export async function PATCH(request: NextRequest) {
  try {
    const { user } = await obtenerUsuarioRuta()
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const empresaId = user.app_metadata?.empresa_activa_id
    if (!empresaId) return NextResponse.json({ error: 'Sin empresa activa' }, { status: 403 })

    const body = await request.json()
    const { terminalId, zona_horaria } = body

    if (!terminalId) {
      return NextResponse.json({ error: 'ID de terminal requerido' }, { status: 400 })
    }

    const admin = crearClienteAdmin()

    // Si viene zona_horaria, actualizar solo eso (no regenerar token)
    if ('zona_horaria' in body) {
      const { error } = await admin
        .from('terminales_kiosco')
        .update({ zona_horaria: zona_horaria || null })
        .eq('id', terminalId)
        .eq('empresa_id', empresaId)

      if (error) {
        return NextResponse.json({ error: 'Error al actualizar zona horaria' }, { status: 500 })
      }
      return NextResponse.json({ ok: true })
    }

    // Regenerar link de setup
    const tokenSetup = generarTokenSetup()
    const tokenHashSetup = hashToken(tokenSetup)

    const { error } = await admin
      .from('terminales_kiosco')
      .update({ token_hash: tokenHashSetup })
      .eq('id', terminalId)
      .eq('empresa_id', empresaId)
      .eq('activo', true)

    if (error) {
      console.error('Error al regenerar token:', error)
      return NextResponse.json({ error: 'Error al regenerar' }, { status: 500 })
    }

    const linkSetup = `https://kiosco.salixweb.com/kiosco/setup?token=${tokenSetup}&empresa=${empresaId}&terminal=${terminalId}`

    return NextResponse.json({ linkSetup, tokenSetup })
  } catch (error) {
    console.error('Error en PATCH /api/kiosco/terminales:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
