import { NextResponse, type NextRequest } from 'next/server'
import { requerirPermisoAPI } from '@/lib/permisos-servidor'
import { crearClienteAdmin } from '@/lib/supabase/admin'

/**
 * POST /api/presupuestos/[id]/mensajes-portal — Enviar mensaje del vendedor al portal.
 * Body: { contenido }
 * Agrega el mensaje al array de mensajes del portal_token activo.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: presupuestoId } = await params
    // Mensaje del vendedor al cliente vía portal → requiere editar presupuesto.
    const guard = await requerirPermisoAPI('presupuestos', 'editar')
    if ('respuesta' in guard) return guard.respuesta
    const { user, empresaId } = guard

    const body = await request.json()
    const { contenido } = body as { contenido: string }

    if (!contenido?.trim()) {
      return NextResponse.json({ error: 'Mensaje vacío' }, { status: 400 })
    }

    const admin = crearClienteAdmin()

    // Obtener nombre del vendedor
    const { data: perfil } = await admin
      .from('perfiles')
      .select('nombre, apellido')
      .eq('id', user.id)
      .single()
    const nombreVendedor = perfil ? `${perfil.nombre} ${perfil.apellido}`.trim() : 'Vendedor'

    // Buscar portal_token activo
    const { data: portalToken } = await admin
      .from('portal_tokens')
      .select('id, mensajes')
      .eq('presupuesto_id', presupuestoId)
      .eq('empresa_id', empresaId)
      .eq('activo', true)
      .order('creado_en', { ascending: false })
      .limit(1)
      .single()

    if (!portalToken) {
      return NextResponse.json({ error: 'Sin portal activo' }, { status: 404 })
    }

    const mensajesActuales = (portalToken.mensajes || []) as unknown[]
    const nuevoMensaje = {
      id: crypto.randomUUID(),
      autor: 'vendedor',
      autor_nombre: nombreVendedor,
      contenido: contenido.trim(),
      creado_en: new Date().toISOString(),
    }

    const { error } = await admin
      .from('portal_tokens')
      .update({ mensajes: [...mensajesActuales, nuevoMensaje] })
      .eq('id', portalToken.id)

    if (error) {
      return NextResponse.json({ error: 'Error al enviar mensaje' }, { status: 500 })
    }

    return NextResponse.json({ ok: true, mensaje: nuevoMensaje })
  } catch {
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
