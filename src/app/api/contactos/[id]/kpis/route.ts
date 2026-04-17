import { NextResponse } from 'next/server'
import { obtenerUsuarioRuta } from '@/lib/supabase/servidor'
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
    const { user } = await obtenerUsuarioRuta()
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const empresaId = user.app_metadata?.empresa_activa_id
    if (!empresaId) return NextResponse.json({ error: 'Sin empresa activa' }, { status: 403 })

    const admin = crearClienteAdmin()

    // Ejecutar todas las consultas en paralelo
    const [
      resVinculaciones,
      resPresupuestos,
      resConversaciones,
      resVisitas,
      resActividades,
      resOrdenes,
    ] = await Promise.all([
      // Vinculaciones (directas + inversas) — obtener IDs para deduplicar contactos únicos
      Promise.all([
        admin.from('contacto_vinculaciones')
          .select('vinculado_id')
          .eq('empresa_id', empresaId)
          .eq('contacto_id', id),
        admin.from('contacto_vinculaciones')
          .select('contacto_id')
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

      // Visitas
      admin.from('visitas')
        .select('id', { count: 'exact', head: true })
        .eq('empresa_id', empresaId)
        .eq('contacto_id', id)
        .eq('en_papelera', false),

      // Actividades
      admin.from('actividades')
        .select('id', { count: 'exact', head: true })
        .eq('empresa_id', empresaId)
        .eq('contacto_id', id)
        .eq('en_papelera', false),

      // Órdenes de trabajo
      admin.from('ordenes_trabajo')
        .select('id', { count: 'exact', head: true })
        .eq('empresa_id', empresaId)
        .eq('contacto_id', id)
        .eq('en_papelera', false),
    ])

    // Procesar vinculaciones — contar contactos únicos (no filas, ya que bidireccional duplica)
    const idsDirectos = (resVinculaciones[0].data || []).map(v => v.vinculado_id)
    const idsInversos = (resVinculaciones[1].data || []).map(v => v.contacto_id)
    const contactosUnicos = new Set([...idsDirectos, ...idsInversos])
    const totalVinculaciones = contactosUnicos.size

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
      visitas: resVisitas.count || 0,
      actividades: resActividades.count || 0,
      facturas: { total: 0, monto: 0 },
      ordenes: resOrdenes.count || 0,
    })
  } catch (error) {
    console.error('Error en KPIs contacto:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
