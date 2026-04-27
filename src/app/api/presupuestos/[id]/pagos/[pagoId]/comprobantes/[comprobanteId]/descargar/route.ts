/**
 * GET /api/presupuestos/[id]/pagos/[pagoId]/comprobantes/[comprobanteId]/descargar
 *
 * Devuelve una signed URL temporal (5 min) al archivo del comprobante.
 * El frontend usa esto en lugar de la URL pública del Storage para que los
 * archivos en el bucket privado `comprobantes-pago` queden inaccesibles
 * sin pasar por el backend.
 *
 * Comprobantes legacy en `documentos-pdf` (público) también pasan por acá:
 * el endpoint detecta el bucket desde la fila y devuelve la URL apropiada.
 *
 * Permisos: cualquiera con visibilidad sobre el módulo presupuestos.
 * Respeta soloPropio: si el usuario solo ve sus presupuestos y este pago
 * pertenece a otro presupuesto, devuelve 404 (sin filtrar existencia).
 */

import { NextResponse, type NextRequest } from 'next/server'
import { obtenerUsuarioRuta } from '@/lib/supabase/servidor'
import { crearClienteAdmin } from '@/lib/supabase/admin'
import { verificarVisibilidad } from '@/lib/permisos-servidor'

const EXPIRACION_SEGUNDOS = 5 * 60 // 5 min

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; pagoId: string; comprobanteId: string }> }
) {
  try {
    const { id: presupuestoId, pagoId, comprobanteId } = await params
    const { user } = await obtenerUsuarioRuta()
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const empresaId = user.app_metadata?.empresa_activa_id
    if (!empresaId) return NextResponse.json({ error: 'Sin empresa activa' }, { status: 403 })

    const visibilidad = await verificarVisibilidad(user.id, empresaId, 'presupuestos')
    if (!visibilidad) return NextResponse.json({ error: 'Sin permiso' }, { status: 403 })

    const admin = crearClienteAdmin()

    // Validar cadena empresa → presupuesto → pago → comprobante. RLS por
    // empresa_id está activa pero acá usamos service_role; igual filtramos.
    const { data: presupuesto } = await admin
      .from('presupuestos')
      .select('id, creado_por')
      .eq('id', presupuestoId)
      .eq('empresa_id', empresaId)
      .single()
    if (!presupuesto) return NextResponse.json({ error: 'No encontrado' }, { status: 404 })
    if (visibilidad.soloPropio && presupuesto.creado_por !== user.id) {
      return NextResponse.json({ error: 'No encontrado' }, { status: 404 })
    }

    const { data: comprobante } = await admin
      .from('presupuesto_pago_comprobantes')
      .select('id, bucket, storage_path, mime_tipo, nombre, pago_id')
      .eq('id', comprobanteId)
      .eq('empresa_id', empresaId)
      .single()
    if (!comprobante) return NextResponse.json({ error: 'No encontrado' }, { status: 404 })
    if (comprobante.pago_id !== pagoId) {
      return NextResponse.json({ error: 'No encontrado' }, { status: 404 })
    }

    const bucket = comprobante.bucket || 'documentos-pdf'

    // Signed URL temporal. Para descargas que tienen que abrir directo
    // (PDFs, imágenes), no forzamos download — sirve para preview.
    const { data: firmada, error } = await admin.storage
      .from(bucket)
      .createSignedUrl(comprobante.storage_path, EXPIRACION_SEGUNDOS)

    if (error || !firmada?.signedUrl) {
      console.error('Error firmando URL de comprobante:', error)
      return NextResponse.json({ error: 'No se pudo generar la URL' }, { status: 500 })
    }

    return NextResponse.json({
      url: firmada.signedUrl,
      nombre: comprobante.nombre,
      mime_tipo: comprobante.mime_tipo,
      expira_en: new Date(Date.now() + EXPIRACION_SEGUNDOS * 1000).toISOString(),
    })
  } catch {
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
