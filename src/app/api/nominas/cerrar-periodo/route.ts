/**
 * POST /api/nominas/cerrar-periodo
 *
 * Cierra el período: pasa liquidaciones_periodo de 'abierto' a 'cerrado'.
 * Valida que TODOS los empleados activos del período estén en estado
 * 'pagado'. Si alguno está en borrador/liquidado/enviado, devuelve 400
 * con el detalle de los pendientes.
 *
 * Body: { periodo_inicio, periodo_fin }
 */

import { NextResponse, type NextRequest } from 'next/server'
import { requerirPermisoAPI } from '@/lib/permisos-servidor'
import { crearClienteAdmin } from '@/lib/supabase/admin'

interface Payload {
  periodo_inicio: string
  periodo_fin: string
}

export async function POST(request: NextRequest) {
  const guard = await requerirPermisoAPI('nomina', 'editar')
  if ('respuesta' in guard) return guard.respuesta
  const { user, empresaId } = guard

  let body: Payload
  try { body = await request.json() } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 })
  }

  const { periodo_inicio, periodo_fin } = body
  if (!periodo_inicio || !periodo_fin) {
    return NextResponse.json({ error: 'periodo_inicio y periodo_fin requeridos' }, { status: 400 })
  }

  const admin = crearClienteAdmin()

  // 1. Listar miembros activos de la empresa que tienen actividad en el período.
  //    Un miembro "está en el período" si:
  //      a. tiene fila en liquidaciones_empleado_periodo, o
  //      b. está activo y su contrato existía durante el período (lo dejamos
  //         para v2: hoy validamos solo las filas existentes — si nunca se
  //         liquidó al empleado, asumimos que no aplicaba al período).
  const { data: liquidaciones, error: errLiq } = await admin
    .from('liquidaciones_empleado_periodo')
    .select('miembro_id, estado_clave')
    .eq('empresa_id', empresaId)
    .eq('periodo_inicio', periodo_inicio)
    .eq('periodo_fin', periodo_fin)

  if (errLiq) {
    return NextResponse.json({ error: 'No se pudieron leer las liquidaciones' }, { status: 500 })
  }

  const pendientes = (liquidaciones ?? []).filter(l => l.estado_clave !== 'pagado')
  if (pendientes.length > 0) {
    return NextResponse.json({
      error: 'No se puede cerrar: hay liquidaciones pendientes',
      code: 'pendientes',
      pendientes: pendientes.map(p => ({
        miembro_id: p.miembro_id,
        estado_actual: p.estado_clave,
      })),
    }, { status: 400 })
  }

  // 2. Cerrar el período (idempotente: si ya está cerrado, no falla).
  const { data: perfil } = await admin
    .from('perfiles').select('nombre, apellido').eq('id', user.id).single()
  const nombreActor = perfil ? `${perfil.nombre} ${perfil.apellido}`.trim() : 'Sistema'

  // Buscar o crear la fila del período.
  const { data: existente } = await admin
    .from('liquidaciones_periodo')
    .select('id, estado_clave')
    .eq('empresa_id', empresaId)
    .eq('periodo_inicio', periodo_inicio)
    .eq('periodo_fin', periodo_fin)
    .maybeSingle()

  if (!existente) {
    // No hay fila del período pero sí hay liquidaciones de empleados todos
    // pagados → caso de período backfilleado o legacy. Crearlo cerrado.
    const { error: errIns } = await admin
      .from('liquidaciones_periodo')
      .insert({
        empresa_id: empresaId,
        periodo_inicio,
        periodo_fin,
        estado_clave: 'cerrado',
        cerrado_en: new Date().toISOString(),
        cerrado_por: user.id,
        cerrado_por_nombre: nombreActor,
        motivo_cierre: 'Cierre con todos los empleados pagados',
        creado_por: user.id,
      })
    if (errIns) {
      return NextResponse.json({ error: 'No se pudo cerrar el período', detalle: errIns }, { status: 500 })
    }
    return NextResponse.json({ ok: true, cerrado: true, creado: true })
  }

  if (existente.estado_clave === 'cerrado') {
    return NextResponse.json({ ok: true, cerrado: true, ya_estaba: true })
  }

  const { error: errUpd } = await admin
    .from('liquidaciones_periodo')
    .update({
      estado_clave: 'cerrado',
      cerrado_en: new Date().toISOString(),
      cerrado_por: user.id,
      cerrado_por_nombre: nombreActor,
      motivo_cierre: 'Cierre con todos los empleados pagados',
      actualizado_por: user.id,
    })
    .eq('id', existente.id)

  if (errUpd) {
    return NextResponse.json({ error: 'No se pudo cerrar el período', detalle: errUpd }, { status: 500 })
  }

  return NextResponse.json({ ok: true, cerrado: true })
}
