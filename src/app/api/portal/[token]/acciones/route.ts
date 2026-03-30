import { NextResponse, type NextRequest } from 'next/server'
import { crearClienteAdmin } from '@/lib/supabase/admin'

/**
 * POST /api/portal/[token]/acciones — Acciones del cliente en el portal.
 * Acciones: aceptar (con firma), rechazar (con motivo), cancelar, comprobante.
 * Se usa en: VistaPortal (componentes de acción)
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params
    const body = await request.json()
    const { accion } = body as { accion: string }
    const admin = crearClienteAdmin()

    // Buscar token activo
    const { data: portalToken } = await admin
      .from('portal_tokens')
      .select('*')
      .eq('token', token)
      .eq('activo', true)
      .single()

    if (!portalToken) {
      return NextResponse.json({ error: 'Enlace no válido' }, { status: 404 })
    }

    if (new Date(portalToken.expira_en).getTime() < Date.now()) {
      return NextResponse.json({ error: 'Enlace expirado' }, { status: 410 })
    }

    switch (accion) {
      // ── ACEPTAR ────────────────────────────────────────────────
      case 'aceptar': {
        const { firma_base64, firma_nombre, firma_modo } = body as {
          firma_base64: string | null
          firma_nombre: string
          firma_modo: string
        }

        // Subir firma a Supabase Storage si hay base64
        let firmaUrl: string | null = null
        if (firma_base64) {
          const base64Data = firma_base64.replace(/^data:image\/\w+;base64,/, '')
          const buffer = Buffer.from(base64Data, 'base64')
          const storagePath = `portal/${portalToken.empresa_id}/${portalToken.id}/firma.png`

          const { error: uploadError } = await admin.storage
            .from('documentos')
            .upload(storagePath, buffer, {
              contentType: 'image/png',
              upsert: true,
            })

          if (!uploadError) {
            const { data: urlData } = admin.storage
              .from('documentos')
              .getPublicUrl(storagePath)
            firmaUrl = urlData.publicUrl
          }
        }

        // Metadata forense
        const firmaMetadata = {
          ip: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'desconocida',
          user_agent: request.headers.get('user-agent') || 'desconocido',
          modo: firma_modo,
          fecha_hora: new Date().toISOString(),
        }

        // Actualizar portal_tokens
        const { error } = await admin
          .from('portal_tokens')
          .update({
            estado_cliente: 'aceptado',
            firma_url: firmaUrl,
            firma_nombre,
            firma_modo,
            firma_metadata: firmaMetadata,
            aceptado_en: new Date().toISOString(),
          })
          .eq('id', portalToken.id)

        if (error) {
          return NextResponse.json({ error: 'Error al aceptar' }, { status: 500 })
        }

        // Actualizar estado del presupuesto → confirmado_cliente
        await admin
          .from('presupuestos')
          .update({ estado: 'confirmado_cliente' })
          .eq('id', portalToken.presupuesto_id)

        return NextResponse.json({
          ok: true,
          firma_url: firmaUrl,
          estado_cliente: 'aceptado',
        })
      }

      // ── RECHAZAR ───────────────────────────────────────────────
      case 'rechazar': {
        const { motivo } = body as { motivo: string }

        const { error } = await admin
          .from('portal_tokens')
          .update({
            estado_cliente: 'rechazado',
            motivo_rechazo: motivo || null,
            rechazado_en: new Date().toISOString(),
          })
          .eq('id', portalToken.id)

        if (error) {
          return NextResponse.json({ error: 'Error al rechazar' }, { status: 500 })
        }

        // Actualizar estado del presupuesto → rechazado
        await admin
          .from('presupuestos')
          .update({ estado: 'rechazado' })
          .eq('id', portalToken.presupuesto_id)

        return NextResponse.json({ ok: true, estado_cliente: 'rechazado' })
      }

      // ── CANCELAR ACEPTACIÓN ────────────────────────────────────
      case 'cancelar': {
        // Solo se puede cancelar si estaba aceptado
        if (portalToken.estado_cliente !== 'aceptado') {
          return NextResponse.json({ error: 'No se puede cancelar' }, { status: 400 })
        }

        const { error } = await admin
          .from('portal_tokens')
          .update({
            estado_cliente: 'visto',
            firma_url: null,
            firma_nombre: null,
            firma_modo: null,
            firma_metadata: null,
            aceptado_en: null,
          })
          .eq('id', portalToken.id)

        if (error) {
          return NextResponse.json({ error: 'Error al cancelar' }, { status: 500 })
        }

        // Revertir estado del presupuesto → enviado
        await admin
          .from('presupuestos')
          .update({ estado: 'enviado' })
          .eq('id', portalToken.presupuesto_id)

        return NextResponse.json({ ok: true, estado_cliente: 'visto' })
      }

      // ── SUBIR COMPROBANTE ──────────────────────────────────────
      case 'comprobante': {
        const { archivo_base64, nombre_archivo, tipo_archivo, cuota_id, monto } = body as {
          archivo_base64: string
          nombre_archivo: string
          tipo_archivo: string
          cuota_id: string | null
          monto: string | null
        }

        // Subir archivo a Storage
        const base64Data = archivo_base64.replace(/^data:[^;]+;base64,/, '')
        const buffer = Buffer.from(base64Data, 'base64')
        const ext = nombre_archivo.split('.').pop() || 'bin'
        const storagePath = `portal/${portalToken.empresa_id}/${portalToken.id}/comprobantes/${Date.now()}.${ext}`

        const { error: uploadError } = await admin.storage
          .from('documentos')
          .upload(storagePath, buffer, {
            contentType: tipo_archivo,
            upsert: false,
          })

        if (uploadError) {
          return NextResponse.json({ error: 'Error al subir comprobante' }, { status: 500 })
        }

        const { data: urlData } = admin.storage
          .from('documentos')
          .getPublicUrl(storagePath)

        // Agregar al array de comprobantes
        const comprobantesActuales = (portalToken.comprobantes || []) as unknown[]
        const nuevoComprobante = {
          id: crypto.randomUUID(),
          url: urlData.publicUrl,
          nombre_archivo,
          tipo: tipo_archivo,
          cuota_id: cuota_id || null,
          monto: monto || null,
          creado_en: new Date().toISOString(),
          estado: 'pendiente',
        }

        const { error } = await admin
          .from('portal_tokens')
          .update({
            comprobantes: [...comprobantesActuales, nuevoComprobante],
          })
          .eq('id', portalToken.id)

        if (error) {
          return NextResponse.json({ error: 'Error al guardar comprobante' }, { status: 500 })
        }

        return NextResponse.json({ ok: true, comprobante: nuevoComprobante })
      }

      default:
        return NextResponse.json({ error: 'Acción no válida' }, { status: 400 })
    }
  } catch {
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
