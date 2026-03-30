import { NextResponse } from 'next/server'
import { crearClienteServidor } from '@/lib/supabase/servidor'
import { crearClienteAdmin } from '@/lib/supabase/admin'

/**
 * GET /api/contactos/[id]/kpis — KPIs de un contacto específico.
 * Retorna conteos de vinculaciones, presupuestos (con monto), conversaciones, etc.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await crearClienteServidor()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const empresaId = user.app_metadata?.empresa_activa_id
    if (!empresaId) return NextResponse.json({ error: 'Sin empresa activa' }, { status: 403 })

    const admin = crearClienteAdmin()

    // Ejecutar todas las consultas en paralelo
    const [
      resVinculaciones,
      resPresupuestos,
      resConversaciones,
    ] = await Promise.all([
      // Vinculaciones (directas + inversas)
      Promise.all([
        admin.from('contacto_vinculaciones')
          .select('id', { count: 'exact', head: true })
          .eq('empresa_id', empresaId)
          .eq('contacto_id', id),
        admin.from('contacto_vinculaciones')
          .select('id', { count: 'exact', head: true })
          .eq('empresa_id', empresaId)
          .eq('vinculado_id', id),
      ]),

      // Presupuestos (como cliente principal O como "dirigido a")
      admin.from('presupuestos')
        .select('id, estado, total_final')
        .eq('empresa_id', empresaId)
        .or(`contacto_id.eq.${id},atencion_contacto_id.eq.${id}`)
        .eq('en_papelera', false),

      // Conversaciones
      admin.from('conversaciones')
        .select('id', { count: 'exact', head: true })
        .eq('empresa_id', empresaId)
        .eq('contacto_id', id),
    ])

    // Procesar vinculaciones
    const vinculacionesDirectas = resVinculaciones[0].count || 0
    const vinculacionesInversas = resVinculaciones[1].count || 0
    const totalVinculaciones = vinculacionesDirectas + vinculacionesInversas

    // Procesar presupuestos
    const presupuestos = resPresupuestos.data || []
    const totalPresupuestos = presupuestos.length
    const montoPresupuestos = presupuestos.reduce((sum, p) => sum + (Number(p.total_final) || 0), 0)

    // Procesar conversaciones
    const totalConversaciones = resConversaciones.count || 0

    return NextResponse.json({
      vinculaciones: totalVinculaciones,
      presupuestos: { total: totalPresupuestos, monto: montoPresupuestos },
      conversaciones: totalConversaciones,
      // Placeholders para módulos futuros
      visitas: 0,
      actividades: 0,
      facturas: { total: 0, monto: 0 },
      ordenes: 0,
    })
  } catch (error) {
    console.error('Error en KPIs contacto:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
