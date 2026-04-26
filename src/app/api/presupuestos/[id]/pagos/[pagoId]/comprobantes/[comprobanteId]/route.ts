/**
 * DELETE — Eliminar un comprobante específico de un pago.
 *          Borra el archivo del Storage y la fila. Si el comprobante
 *          eliminado coincide con los campos legacy `comprobante_*` del
 *          pago, los limpia para mantener consistencia.
 */

import { NextResponse, type NextRequest } from 'next/server'
import { obtenerUsuarioRuta } from '@/lib/supabase/servidor'
import { crearClienteAdmin } from '@/lib/supabase/admin'
import { obtenerYVerificarPermiso } from '@/lib/permisos-servidor'
import { descontarUsoStorage } from '@/lib/uso-storage'

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; pagoId: string; comprobanteId: string }> }
) {
  try {
    const { id: presupuestoId, pagoId, comprobanteId } = await params
    const { user } = await obtenerUsuarioRuta()
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const empresaId = user.app_metadata?.empresa_activa_id
    if (!empresaId) return NextResponse.json({ error: 'Sin empresa activa' }, { status: 403 })

    const { permitido } = await obtenerYVerificarPermiso(user.id, empresaId, 'presupuestos', 'editar')
    if (!permitido) return NextResponse.json({ error: 'Sin permiso' }, { status: 403 })

    const admin = crearClienteAdmin()

    // Validar pago
    const { data: pago } = await admin
      .from('presupuesto_pagos')
      .select('id, comprobante_storage_path')
      .eq('id', pagoId)
      .eq('presupuesto_id', presupuestoId)
      .eq('empresa_id', empresaId)
      .single()

    if (!pago) return NextResponse.json({ error: 'Pago no encontrado' }, { status: 404 })

    const { data: comprobante } = await admin
      .from('presupuesto_pago_comprobantes')
      .select('*')
      .eq('id', comprobanteId)
      .eq('pago_id', pagoId)
      .eq('empresa_id', empresaId)
      .single()

    if (!comprobante) return NextResponse.json({ error: 'Comprobante no encontrado' }, { status: 404 })

    if (comprobante.storage_path) {
      await admin.storage.from('documentos-pdf').remove([comprobante.storage_path])
      if (comprobante.tamano_bytes) {
        descontarUsoStorage(empresaId, 'documentos-pdf', Number(comprobante.tamano_bytes))
      }
    }

    const { error } = await admin
      .from('presupuesto_pago_comprobantes')
      .delete()
      .eq('id', comprobanteId)
      .eq('empresa_id', empresaId)

    if (error) {
      return NextResponse.json({ error: 'Error al eliminar' }, { status: 500 })
    }

    // Si el comprobante eliminado era el principal (legacy), promover el
    // siguiente o limpiar los campos.
    if (pago.comprobante_storage_path === comprobante.storage_path) {
      const { data: nuevoPrincipal } = await admin
        .from('presupuesto_pago_comprobantes')
        .select('*')
        .eq('pago_id', pagoId)
        .eq('empresa_id', empresaId)
        .eq('tipo', 'comprobante')
        .order('creado_en', { ascending: true })
        .limit(1)
        .maybeSingle()

      if (nuevoPrincipal) {
        await admin
          .from('presupuesto_pagos')
          .update({
            comprobante_url: nuevoPrincipal.url,
            comprobante_storage_path: nuevoPrincipal.storage_path,
            comprobante_nombre: nuevoPrincipal.nombre,
            comprobante_tipo: nuevoPrincipal.mime_tipo,
            comprobante_tamano_bytes: nuevoPrincipal.tamano_bytes,
          })
          .eq('id', pagoId)
      } else {
        await admin
          .from('presupuesto_pagos')
          .update({
            comprobante_url: null,
            comprobante_storage_path: null,
            comprobante_nombre: null,
            comprobante_tipo: null,
            comprobante_tamano_bytes: null,
          })
          .eq('id', pagoId)
      }
    }

    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
