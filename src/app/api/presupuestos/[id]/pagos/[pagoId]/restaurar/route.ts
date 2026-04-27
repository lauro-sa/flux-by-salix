/**
 * POST /api/presupuestos/[id]/pagos/[pagoId]/restaurar
 *
 * Revierte el soft-delete de un pago: limpia eliminado_en/eliminado_por.
 * Los comprobantes y su storage no se tocan (nunca se borraron en el
 * soft-delete, así que vuelven con el pago).
 *
 * Casos de uso:
 *  - Toast "Deshacer" inmediato tras eliminar (UI flow estándar).
 *  - Recuperación manual desde papelera/auditoría dentro del periodo de
 *    gracia (7 días por default; pasado ese tiempo el cron lo purga).
 *
 * Si la entrada del chatter del pago original fue borrada al eliminar,
 * registramos una nueva entrada de "pago restaurado" para que el timeline
 * refleje el evento.
 */

import { NextResponse, type NextRequest } from 'next/server'
import { obtenerUsuarioRuta } from '@/lib/supabase/servidor'
import { crearClienteAdmin } from '@/lib/supabase/admin'
import { obtenerYVerificarPermiso } from '@/lib/permisos-servidor'
import { registrarChatter } from '@/lib/chatter'
import { sincronizarEstadoPresupuesto } from '@/lib/presupuesto-auto-transicion'

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; pagoId: string }> }
) {
  try {
    const { id: presupuestoId, pagoId } = await params
    const { user } = await obtenerUsuarioRuta()
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const empresaId = user.app_metadata?.empresa_activa_id
    if (!empresaId) return NextResponse.json({ error: 'Sin empresa activa' }, { status: 403 })

    const { permitido } = await obtenerYVerificarPermiso(user.id, empresaId, 'presupuestos', 'editar')
    if (!permitido) return NextResponse.json({ error: 'Sin permiso' }, { status: 403 })

    const admin = crearClienteAdmin()

    const { data: pago } = await admin
      .from('presupuesto_pagos')
      .select('id, monto, moneda, eliminado_en, fecha_pago, metodo, descripcion, cuota_id, es_adicional, concepto_adicional')
      .eq('id', pagoId)
      .eq('presupuesto_id', presupuestoId)
      .eq('empresa_id', empresaId)
      .single()

    if (!pago) return NextResponse.json({ error: 'Pago no encontrado' }, { status: 404 })
    if (!pago.eliminado_en) {
      return NextResponse.json({ error: 'El pago no está eliminado' }, { status: 409 })
    }

    const { data: perfil } = await admin
      .from('perfiles')
      .select('nombre, apellido, avatar_url')
      .eq('id', user.id)
      .single()
    const nombreUsuario = perfil ? `${perfil.nombre || ''} ${perfil.apellido || ''}`.trim() : 'Usuario'

    // Limpiar marcadores de soft-delete. El AFTER UPDATE de
    // presupuesto_pagos_recalcular_cuotas dispara recalcular_estado_cuota
    // automáticamente: la cuota vuelve a contar este pago.
    const { error } = await admin
      .from('presupuesto_pagos')
      .update({
        eliminado_en: null,
        eliminado_por: null,
        eliminado_por_nombre: null,
      })
      .eq('id', pagoId)
      .eq('empresa_id', empresaId)

    if (error) {
      console.error('Error al restaurar pago:', error)
      return NextResponse.json({ error: 'Error al restaurar' }, { status: 500 })
    }

    // Re-registrar entrada de chatter con marca de "restaurado". No
    // recreamos la entrada original (eso confundiría el timeline al tener
    // un evento "creado" en el pasado y otro al lado de su eliminación).
    const formatoMonto = new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: pago.moneda,
      maximumFractionDigits: 2,
    }).format(Number(pago.monto))

    await registrarChatter({
      empresaId,
      entidadTipo: 'presupuesto',
      entidadId: presupuestoId,
      contenido: `Restauró el pago de ${formatoMonto}`,
      autorId: user.id,
      autorNombre: nombreUsuario,
      autorAvatarUrl: perfil?.avatar_url || null,
      metadata: {
        accion: 'pago_restaurado',
        pago_id: pagoId,
        pago_metodo: pago.metodo,
        pago_moneda: pago.moneda,
        pago_fecha: pago.fecha_pago,
        monto_pago: String(pago.monto),
      },
    })

    // El estado del presupuesto puede tener que avanzar (ahora que el pago
    // vuelve a contar) o no cambiar.
    await sincronizarEstadoPresupuesto({
      admin,
      presupuestoId,
      empresaId,
      usuarioId: user.id,
      usuarioNombre: nombreUsuario,
      razon: 'pago restaurado',
    })

    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
