import { NextResponse, type NextRequest } from 'next/server'
import { requerirPermisoAPI } from '@/lib/permisos-servidor'
import { crearClienteAdmin } from '@/lib/supabase/admin'
import { registrarChatter } from '@/lib/chatter'

/**
 * PATCH /api/presupuestos/[id]/comprobantes — Confirmar o rechazar un comprobante.
 * Body: { comprobante_id, accion: 'confirmar' | 'rechazar', motivo?: string }
 * Si todas las cuotas quedan cobradas → auto-transición a orden_venta.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: presupuestoId } = await params
    // Confirmar/rechazar comprobantes = modificar presupuesto.
    const guard = await requerirPermisoAPI('presupuestos', 'editar')
    if ('respuesta' in guard) return guard.respuesta
    const { user, empresaId } = guard

    const body = await request.json()
    const { comprobante_id, accion, motivo } = body as {
      comprobante_id: string
      accion: 'confirmar' | 'rechazar'
      motivo?: string
    }

    if (!comprobante_id || !accion) {
      return NextResponse.json({ error: 'Faltan campos' }, { status: 400 })
    }

    const admin = crearClienteAdmin()

    // Obtener nombre del usuario
    const { data: perfil } = await admin
      .from('perfiles')
      .select('nombre, apellido')
      .eq('id', user.id)
      .single()
    const nombreUsuario = perfil ? `${perfil.nombre} ${perfil.apellido}`.trim() : 'Usuario'

    // Buscar el portal_token del presupuesto
    const { data: portalToken } = await admin
      .from('portal_tokens')
      .select('id, comprobantes')
      .eq('presupuesto_id', presupuestoId)
      .eq('empresa_id', empresaId)
      .eq('activo', true)
      .order('creado_en', { ascending: false })
      .limit(1)
      .single()

    if (!portalToken) {
      return NextResponse.json({ error: 'Token de portal no encontrado' }, { status: 404 })
    }

    // Actualizar estado del comprobante
    const comprobantes = (portalToken.comprobantes || []) as {
      id: string; estado: string; monto: string | null; cuota_id: string | null
      confirmado_por?: string; confirmado_en?: string; motivo_rechazo?: string
    }[]

    const idx = comprobantes.findIndex(c => c.id === comprobante_id)
    if (idx === -1) {
      return NextResponse.json({ error: 'Comprobante no encontrado' }, { status: 404 })
    }

    const nuevoEstado = accion === 'confirmar' ? 'confirmado' : 'rechazado'
    comprobantes[idx] = {
      ...comprobantes[idx],
      estado: nuevoEstado,
      confirmado_por: nombreUsuario,
      confirmado_en: new Date().toISOString(),
      ...(accion === 'rechazar' && motivo ? { motivo_rechazo: motivo } : {}),
    }

    // Guardar comprobantes actualizados
    await admin
      .from('portal_tokens')
      .update({ comprobantes })
      .eq('id', portalToken.id)

    // Si confirmado y tiene cuota_id → marcar cuota como cobrada
    const comprobante = comprobantes[idx]
    if (accion === 'confirmar' && comprobante.cuota_id) {
      await admin
        .from('presupuesto_cuotas')
        .update({
          estado: 'cobrada',
          fecha_cobro: new Date().toISOString(),
          cobrado_por_nombre: nombreUsuario,
        })
        .eq('id', comprobante.cuota_id)
        .eq('presupuesto_id', presupuestoId)
    }

    // Registrar en chatter
    const contenidoChatter = accion === 'confirmar'
      ? `${nombreUsuario} confirmó el comprobante de pago${comprobante.monto ? ` por $${comprobante.monto}` : ''}`
      : `${nombreUsuario} rechazó el comprobante de pago${motivo ? `. Motivo: ${motivo}` : ''}`

    await registrarChatter({
      empresaId,
      entidadTipo: 'presupuesto',
      entidadId: presupuestoId,
      contenido: contenidoChatter,
      autorId: user.id,
      autorNombre: nombreUsuario,
      metadata: {
        accion: accion === 'confirmar' ? 'pago_confirmado' : 'pago_rechazado',
        cuota_id: comprobante.cuota_id || undefined,
        monto_pago: comprobante.monto || undefined,
      },
    })

    // Auto-transición: si todas las cuotas están cobradas → orden_venta
    if (accion === 'confirmar') {
      const { data: cuotas } = await admin
        .from('presupuesto_cuotas')
        .select('id, estado')
        .eq('presupuesto_id', presupuestoId)

      const todasCobradas = cuotas && cuotas.length > 0 && cuotas.every(c => c.estado === 'cobrada')

      if (todasCobradas) {
        // Verificar que el presupuesto está en confirmado_cliente
        const { data: presupuesto } = await admin
          .from('presupuestos')
          .select('estado, numero, fecha_aceptacion')
          .eq('id', presupuestoId)
          .single()

        if (presupuesto?.estado === 'confirmado_cliente') {
          await admin
            .from('presupuestos')
            .update({ estado: 'orden_venta', ...(!presupuesto.fecha_aceptacion ? { fecha_aceptacion: new Date().toISOString() } : {}) })
            .eq('id', presupuestoId)

          // Historial
          await admin.from('presupuesto_historial').insert({
            presupuesto_id: presupuestoId,
            empresa_id: empresaId,
            estado: 'orden_venta',
            usuario_id: user.id,
            usuario_nombre: `${nombreUsuario} (auto)`,
            notas: 'Transición automática: pago completo confirmado',
          })

          // Chatter
          await registrarChatter({
            empresaId,
            entidadTipo: 'presupuesto',
            entidadId: presupuestoId,
            contenido: `Presupuesto ${presupuesto.numero} pasó a Orden de Venta automáticamente (pago completo confirmado)`,
            autorId: 'sistema',
            autorNombre: 'Sistema',
            metadata: {
              accion: 'estado_cambiado',
              estado_anterior: 'confirmado_cliente',
              estado_nuevo: 'orden_venta',
            },
          })

          return NextResponse.json({
            ok: true,
            comprobante_estado: nuevoEstado,
            auto_transicion: 'orden_venta',
          })
        }
      }
    }

    return NextResponse.json({
      ok: true,
      comprobante_estado: nuevoEstado,
    })
  } catch {
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
