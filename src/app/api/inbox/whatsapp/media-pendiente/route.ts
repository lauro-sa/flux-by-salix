import { NextResponse, type NextRequest } from 'next/server'
import { obtenerUsuarioRuta } from '@/lib/supabase/servidor'
import { createClient } from '@supabase/supabase-js'
import {
  obtenerUrlMedia, descargarMediaBuffer,
  extraerMimeType, extraerNombreArchivo,
  type MensajeEntranteMeta,
} from '@/lib/whatsapp'

export const dynamic = 'force-dynamic'

/**
 * POST /api/inbox/whatsapp/media-pendiente
 * Reintenta descargar media de mensajes que no tienen adjunto.
 * Se llama desde el cliente cuando detecta mensajes sin adjuntos.
 * Procesa UN mensaje por llamada para no exceder el timeout de 10s.
 */
export async function POST(request: NextRequest) {
  try {
    const { user } = await obtenerUsuarioRuta()
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const empresaId = user.app_metadata?.empresa_activa_id
    if (!empresaId) return NextResponse.json({ error: 'Sin empresa' }, { status: 403 })

    const admin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    // Buscar mensajes con media pero sin adjuntos (máximo 1 por llamada)
    const { data: mensajesPendientes } = await admin
      .from('mensajes')
      .select('id, metadata, tipo_contenido, conversacion_id')
      .eq('empresa_id', empresaId)
      .in('tipo_contenido', ['imagen', 'audio', 'video', 'documento', 'sticker'])
      .not('metadata->document->id', 'is', null)
      .order('creado_en', { ascending: false })
      .limit(5)

    if (!mensajesPendientes || mensajesPendientes.length === 0) {
      return NextResponse.json({ procesados: 0 })
    }

    // Filtrar los que ya tienen adjuntos
    const { data: adjuntosExistentes } = await admin
      .from('mensaje_adjuntos')
      .select('mensaje_id')
      .in('mensaje_id', mensajesPendientes.map(m => m.id))

    const idsConAdjunto = new Set(adjuntosExistentes?.map(a => a.mensaje_id) || [])
    const sinAdjunto = mensajesPendientes.filter(m => !idsConAdjunto.has(m.id))

    if (sinAdjunto.length === 0) {
      return NextResponse.json({ procesados: 0 })
    }

    // Obtener token de acceso del canal WhatsApp
    const { data: canal } = await admin
      .from('canales_inbox')
      .select('id, empresa_id, config_conexion')
      .eq('empresa_id', empresaId)
      .eq('tipo', 'whatsapp')
      .limit(1)
      .single()

    if (!canal) {
      return NextResponse.json({ error: 'Canal WhatsApp no encontrado' }, { status: 404 })
    }

    const tokenAcceso = (canal.config_conexion as Record<string, string>)?.tokenAcceso
    if (!tokenAcceso) {
      return NextResponse.json({ error: 'Token no configurado' }, { status: 400 })
    }

    // Procesar solo 1 mensaje (para no exceder timeout)
    const msg = sinAdjunto[0]
    const metadata = msg.metadata as MensajeEntranteMeta

    // Extraer media ID del metadata
    const mediaId = metadata?.image?.id || metadata?.video?.id ||
      metadata?.audio?.id || metadata?.document?.id || metadata?.sticker?.id

    if (!mediaId) {
      return NextResponse.json({ procesados: 0, error: 'Sin media_id' })
    }

    try {
      // Obtener URL fresca de Meta (las URLs anteriores ya expiraron)
      const mediaInfo = await obtenerUrlMedia(mediaId, tokenAcceso)

      // Descargar
      const { buffer, contentType } = await descargarMediaBuffer(mediaInfo.url, tokenAcceso)
      const bytes = new Uint8Array(buffer)

      // Nombre sanitizado
      const nombreArchivo = extraerNombreArchivo(metadata)
      const storagePath = `inbox/${canal.empresa_id}/whatsapp/${msg.id}/${nombreArchivo}`

      // Subir a Storage
      const { error: uploadError } = await admin.storage
        .from('adjuntos')
        .upload(storagePath, bytes, { contentType, upsert: true })

      if (uploadError) {
        console.error('[MEDIA-RETRY] Error upload:', JSON.stringify(uploadError))
        return NextResponse.json({ procesados: 0, error: 'Upload falló' })
      }

      // URL pública
      const { data: urlData } = admin.storage
        .from('adjuntos')
        .getPublicUrl(storagePath)

      // Insertar adjunto
      await admin.from('mensaje_adjuntos').insert({
        mensaje_id: msg.id,
        empresa_id: canal.empresa_id,
        nombre_archivo: nombreArchivo,
        tipo_mime: extraerMimeType(metadata),
        tamano_bytes: mediaInfo.file_size || buffer.byteLength,
        url: urlData.publicUrl,
        storage_path: storagePath,
        es_sticker: metadata.type === 'sticker',
        es_animado: metadata.sticker?.animated || false,
      })

      return NextResponse.json({ procesados: 1, mensaje_id: msg.id })
    } catch (err) {
      console.error('[MEDIA-RETRY] Error:', err)
      return NextResponse.json({ procesados: 0, error: 'Descarga falló' })
    }
  } catch (err) {
    console.error('[MEDIA-RETRY] Error general:', err)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
