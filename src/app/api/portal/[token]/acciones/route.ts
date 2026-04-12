import { NextResponse, type NextRequest } from 'next/server'
import { crearClienteAdmin } from '@/lib/supabase/admin'
import { registrarChatter } from '@/lib/chatter'
import { crearNotificacion } from '@/lib/notificaciones'
import { generarPdfFirmado } from '@/lib/pdf/generar-pdf-firmado'
import { COLOR_MARCA_DEFECTO } from '@/lib/colores_entidad'
import { verificarRateLimit, obtenerIp } from '@/lib/rate-limit'

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

    // Rate limit: 10 acciones por minuto por IP
    const ip = obtenerIp(request)
    const { permitido } = verificarRateLimit(`portal-accion:${ip}`, { maximo: 10, ventanaSegundos: 60 })
    if (!permitido) return NextResponse.json({ error: 'Demasiadas solicitudes' }, { status: 429 })

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

            // Registrar uso de storage
            const { registrarUsoStorage } = await import('@/lib/uso-storage')
            registrarUsoStorage(portalToken.empresa_id, 'documentos', buffer.length)
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

        // Actualizar estado del presupuesto → confirmado_cliente + fecha_aceptacion
        await admin
          .from('presupuestos')
          .update({ estado: 'confirmado_cliente', fecha_aceptacion: new Date().toISOString() })
          .eq('id', portalToken.presupuesto_id)

        // Registrar en historial de estados
        await admin.from('presupuesto_historial').insert({
          presupuesto_id: portalToken.presupuesto_id,
          empresa_id: portalToken.empresa_id,
          estado: 'confirmado_cliente',
          usuario_id: portalToken.creado_por,
          usuario_nombre: `${firma_nombre} (portal)`,
        })

        // Generar PDF firmado con certificado de aceptación
        let pdfFirmadoUrl: string | null = null
        try {
          const [{ data: presupuesto }, { data: empresa }] = await Promise.all([
            admin.from('presupuestos').select('numero, contacto_nombre, total_final, moneda').eq('id', portalToken.presupuesto_id).single(),
            admin.from('empresas').select('nombre, logo_url, color_marca').eq('id', portalToken.empresa_id).single(),
          ])

          if (presupuesto && empresa) {
            const resultado = await generarPdfFirmado(admin, {
              presupuestoId: portalToken.presupuesto_id,
              empresaId: portalToken.empresa_id,
              numero: presupuesto.numero,
              contacto_nombre: presupuesto.contacto_nombre,
              total_final: presupuesto.total_final,
              moneda: presupuesto.moneda,
              empresa_nombre: empresa.nombre,
              empresa_logo_url: empresa.logo_url,
              color_marca: empresa.color_marca || COLOR_MARCA_DEFECTO,
              firma_url: firmaUrl,
              firma_nombre,
              firma_modo,
              ip: firmaMetadata.ip,
              user_agent: firmaMetadata.user_agent,
              fecha_hora: firmaMetadata.fecha_hora,
            })

            pdfFirmadoUrl = resultado.url

            // Guardar URL del PDF firmado en portal_tokens y presupuesto
            await Promise.all([
              admin.from('portal_tokens').update({
                pdf_firmado_url: resultado.url,
                pdf_firmado_storage_path: resultado.storage_path,
              }).eq('id', portalToken.id),
              admin.from('presupuestos').update({
                pdf_firmado_url: resultado.url,
                pdf_firmado_storage_path: resultado.storage_path,
              }).eq('id', portalToken.presupuesto_id),
            ])
          }
        } catch (err) {
          // No bloquear la aceptación si falla el PDF
          console.error('Error generando PDF firmado:', err)
        }

        // Registrar en chatter
        const adjuntosChatter = []
        if (firmaUrl) adjuntosChatter.push({ url: firmaUrl, nombre: 'firma.png', tipo: 'image/png' })
        if (pdfFirmadoUrl) adjuntosChatter.push({ url: pdfFirmadoUrl, nombre: 'certificado-aceptacion.pdf', tipo: 'application/pdf' })

        await registrarChatter({
          empresaId: portalToken.empresa_id,
          entidadTipo: 'presupuesto',
          entidadId: portalToken.presupuesto_id,
          contenido: `${firma_nombre} firmó y aceptó el presupuesto desde el portal (firma ${firma_modo})`,
          autorId: 'portal',
          autorNombre: `${firma_nombre} (portal)`,
          adjuntos: adjuntosChatter,
          metadata: {
            accion: 'portal_aceptado',
            portal: true,
            token,
            firma_nombre,
            firma_ip: firmaMetadata.ip,
            firma_modo,
          },
        })

        // Notificar al creador del presupuesto
        try {
          const { data: presInfo } = await admin
            .from('presupuestos')
            .select('numero, contacto_nombre')
            .eq('id', portalToken.presupuesto_id)
            .single()
          await crearNotificacion({
            empresaId: portalToken.empresa_id,
            usuarioId: portalToken.creado_por,
            tipo: 'portal_aceptado',
            titulo: `✅ ${firma_nombre} aceptó el presupuesto`,
            cuerpo: presInfo ? `Presupuesto #${presInfo.numero} — ${presInfo.contacto_nombre}` : undefined,
            icono: 'FileCheck',
            color: 'var(--insignia-exito-texto)',
            url: `/presupuestos`,
            referenciaTipo: 'presupuesto',
            referenciaId: portalToken.presupuesto_id,
          })
        } catch { /* no bloquear */ }

        return NextResponse.json({
          ok: true,
          firma_url: firmaUrl,
          pdf_firmado_url: pdfFirmadoUrl,
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

        // Registrar en historial
        await admin.from('presupuesto_historial').insert({
          presupuesto_id: portalToken.presupuesto_id,
          empresa_id: portalToken.empresa_id,
          estado: 'rechazado',
          usuario_id: portalToken.creado_por,
          usuario_nombre: 'Cliente (portal)',
          notas: motivo || null,
        })

        // Registrar en chatter
        await registrarChatter({
          empresaId: portalToken.empresa_id,
          entidadTipo: 'presupuesto',
          entidadId: portalToken.presupuesto_id,
          contenido: motivo
            ? `El cliente rechazó el presupuesto desde el portal. Motivo: ${motivo}`
            : 'El cliente rechazó el presupuesto desde el portal',
          autorId: 'portal',
          autorNombre: 'Cliente (portal)',
          metadata: {
            accion: 'portal_rechazado',
            portal: true,
            token,
          },
        })

        // Notificar al creador del presupuesto
        try {
          const { data: presInfo } = await admin
            .from('presupuestos')
            .select('numero, contacto_nombre')
            .eq('id', portalToken.presupuesto_id)
            .single()
          await crearNotificacion({
            empresaId: portalToken.empresa_id,
            usuarioId: portalToken.creado_por,
            tipo: 'portal_rechazado',
            titulo: '❌ El cliente rechazó el presupuesto',
            cuerpo: presInfo
              ? `Presupuesto #${presInfo.numero}${motivo ? ` — ${motivo}` : ''}`
              : motivo || undefined,
            icono: 'AlertTriangle',
            color: 'var(--insignia-peligro-texto)',
            url: `/presupuestos`,
            referenciaTipo: 'presupuesto',
            referenciaId: portalToken.presupuesto_id,
          })
        } catch { /* no bloquear */ }

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

        // Notificar al creador del presupuesto
        try {
          const { data: presInfo } = await admin
            .from('presupuestos')
            .select('numero, contacto_nombre')
            .eq('id', portalToken.presupuesto_id)
            .single()
          await crearNotificacion({
            empresaId: portalToken.empresa_id,
            usuarioId: portalToken.creado_por,
            tipo: 'portal_cancelado',
            titulo: '⚠️ El cliente canceló la aceptación',
            cuerpo: presInfo ? `Presupuesto #${presInfo.numero} — ${presInfo.contacto_nombre}` : undefined,
            icono: 'AlertTriangle',
            color: 'var(--insignia-advertencia-texto)',
            url: `/presupuestos`,
            referenciaTipo: 'presupuesto',
            referenciaId: portalToken.presupuesto_id,
          })
        } catch { /* no bloquear */ }

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

        // Registrar uso de storage
        const { registrarUsoStorage } = await import('@/lib/uso-storage')
        registrarUsoStorage(portalToken.empresa_id, 'documentos', buffer.length)

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

        // Registrar en chatter
        await registrarChatter({
          empresaId: portalToken.empresa_id,
          entidadTipo: 'presupuesto',
          entidadId: portalToken.presupuesto_id,
          contenido: `El cliente envió un comprobante de pago${monto ? ` por $${monto}` : ''}`,
          autorId: 'portal',
          autorNombre: 'Cliente (portal)',
          adjuntos: [{ url: urlData.publicUrl, nombre: nombre_archivo, tipo: tipo_archivo }],
          metadata: {
            accion: 'portal_comprobante',
            portal: true,
            token,
            cuota_id: cuota_id || undefined,
            monto_pago: monto || undefined,
            detalles: { comprobante_id: nuevoComprobante.id },
          },
        })

        // Notificar al creador del presupuesto
        try {
          await crearNotificacion({
            empresaId: portalToken.empresa_id,
            usuarioId: portalToken.creado_por,
            tipo: 'portal_aceptado',
            titulo: '🧾 El cliente subió un comprobante de pago',
            cuerpo: `${nombre_archivo}${monto ? ` — $${monto}` : ''}`,
            icono: 'FileCheck',
            color: 'var(--insignia-info-texto)',
            url: `/presupuestos`,
            referenciaTipo: 'presupuesto',
            referenciaId: portalToken.presupuesto_id,
          })
        } catch { /* no bloquear */ }

        return NextResponse.json({ ok: true, comprobante: nuevoComprobante })
      }

      // ── ENVIAR MENSAJE ──────────────────────────────────────
      case 'mensaje': {
        const { contenido, autor_nombre } = body as {
          contenido: string
          autor_nombre: string
        }

        if (!contenido?.trim()) {
          return NextResponse.json({ error: 'Mensaje vacío' }, { status: 400 })
        }

        const mensajesActuales = (portalToken.mensajes || []) as unknown[]
        const nuevoMensaje = {
          id: crypto.randomUUID(),
          autor: 'cliente',
          autor_nombre: autor_nombre || 'Cliente',
          contenido: contenido.trim(),
          creado_en: new Date().toISOString(),
        }

        const { error } = await admin
          .from('portal_tokens')
          .update({
            mensajes: [...mensajesActuales, nuevoMensaje],
          })
          .eq('id', portalToken.id)

        if (error) {
          return NextResponse.json({ error: 'Error al enviar mensaje' }, { status: 500 })
        }

        // Registrar en chatter del presupuesto
        await registrarChatter({
          empresaId: portalToken.empresa_id,
          entidadTipo: 'presupuesto',
          entidadId: portalToken.presupuesto_id,
          tipo: 'mensaje',
          contenido: contenido.trim(),
          autorId: 'portal',
          autorNombre: `${autor_nombre || 'Cliente'} (portal)`,
          metadata: { portal: true, token },
        })

        return NextResponse.json({ ok: true, mensaje: nuevoMensaje })
      }

      default:
        return NextResponse.json({ error: 'Acción no válida' }, { status: 400 })
    }
  } catch {
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
