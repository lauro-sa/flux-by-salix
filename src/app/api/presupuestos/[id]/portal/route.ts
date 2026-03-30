import { NextResponse, type NextRequest } from 'next/server'
import { crearClienteServidor } from '@/lib/supabase/servidor'
import { crearClienteAdmin } from '@/lib/supabase/admin'
import crypto from 'crypto'

/**
 * POST /api/presupuestos/[id]/portal — Generar (o reutilizar) token de acceso público.
 * Retorna la URL del portal para compartir con el cliente.
 * Se usa en: EditorPresupuesto (botón Vista previa)
 */
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: presupuestoId } = await params

    const supabase = await crearClienteServidor()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const empresaId = user.app_metadata?.empresa_activa_id
    if (!empresaId) return NextResponse.json({ error: 'Sin empresa activa' }, { status: 403 })

    const admin = crearClienteAdmin()

    // Verificar que el presupuesto existe y pertenece a la empresa
    const { data: presupuesto } = await admin
      .from('presupuestos')
      .select('id')
      .eq('id', presupuestoId)
      .eq('empresa_id', empresaId)
      .single()

    if (!presupuesto) {
      return NextResponse.json({ error: 'Presupuesto no encontrado' }, { status: 404 })
    }

    // Buscar token activo y no expirado
    const { data: tokenExistente } = await admin
      .from('portal_tokens')
      .select('*')
      .eq('presupuesto_id', presupuestoId)
      .eq('empresa_id', empresaId)
      .eq('activo', true)
      .gt('expira_en', new Date().toISOString())
      .order('creado_en', { ascending: false })
      .limit(1)
      .single()

    if (tokenExistente) {
      const url = `${process.env.NEXT_PUBLIC_APP_URL || ''}/portal/${tokenExistente.token}`
      return NextResponse.json({
        token: tokenExistente.token,
        url,
        expira_en: tokenExistente.expira_en,
        veces_visto: tokenExistente.veces_visto,
        existente: true,
      })
    }

    // Crear nuevo token (expira en 30 días)
    const nuevoToken = crypto.randomUUID()
    const expiraEn = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()

    const { error } = await admin
      .from('portal_tokens')
      .insert({
        token: nuevoToken,
        presupuesto_id: presupuestoId,
        empresa_id: empresaId,
        creado_por: user.id,
        expira_en: expiraEn,
      })

    if (error) {
      console.error('Error al insertar portal_token:', error)
      return NextResponse.json({ error: error.message || 'Error al generar token' }, { status: 500 })
    }

    const url = `${process.env.NEXT_PUBLIC_APP_URL || ''}/portal/${nuevoToken}`
    return NextResponse.json({
      token: nuevoToken,
      url,
      expira_en: expiraEn,
      veces_visto: 0,
      existente: false,
    })
  } catch (err) {
    console.error('Error en POST portal:', err)
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Error interno' }, { status: 500 })
  }
}

/**
 * GET /api/presupuestos/[id]/portal — Obtener info del token existente.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: presupuestoId } = await params

    const supabase = await crearClienteServidor()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const empresaId = user.app_metadata?.empresa_activa_id
    if (!empresaId) return NextResponse.json({ error: 'Sin empresa activa' }, { status: 403 })

    const admin = crearClienteAdmin()

    const { data: token } = await admin
      .from('portal_tokens')
      .select('*')
      .eq('presupuesto_id', presupuestoId)
      .eq('empresa_id', empresaId)
      .eq('activo', true)
      .gt('expira_en', new Date().toISOString())
      .order('creado_en', { ascending: false })
      .limit(1)
      .single()

    if (!token) {
      return NextResponse.json({ existe: false })
    }

    const url = `${process.env.NEXT_PUBLIC_APP_URL || ''}/portal/${token.token}`
    return NextResponse.json({
      existe: true,
      token: token.token,
      url,
      expira_en: token.expira_en,
      visto_en: token.visto_en,
      veces_visto: token.veces_visto,
    })
  } catch {
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
