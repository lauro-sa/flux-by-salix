/**
 * API Route: /api/salix-ia/conversaciones/[id]
 * GET — Obtiene una conversación completa
 * DELETE — Elimina una conversación
 */

import { NextRequest, NextResponse } from 'next/server'
import { obtenerUsuarioRuta } from '@/lib/supabase'
import { crearClienteAdmin } from '@/lib/supabase/admin'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user, respuesta401 } = await obtenerUsuarioRuta()
  if (!user) return respuesta401()

  const { id } = await params
  const admin = crearClienteAdmin()

  const { data, error } = await admin
    .from('conversaciones_salix_ia')
    .select('*')
    .eq('id', id)
    .eq('usuario_id', user.id)
    .single()

  if (error || !data) {
    return NextResponse.json({ error: 'Conversación no encontrada' }, { status: 404 })
  }

  return NextResponse.json(data)
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user, respuesta401 } = await obtenerUsuarioRuta()
  if (!user) return respuesta401()

  const { id } = await params
  const admin = crearClienteAdmin()

  const { error } = await admin
    .from('conversaciones_salix_ia')
    .delete()
    .eq('id', id)
    .eq('usuario_id', user.id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
