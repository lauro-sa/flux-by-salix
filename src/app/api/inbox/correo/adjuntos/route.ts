import { NextResponse, type NextRequest } from 'next/server'
import { crearClienteServidor } from '@/lib/supabase/servidor'
import { crearClienteAdmin } from '@/lib/supabase/admin'

/**
 * POST /api/inbox/correo/adjuntos — Sube archivos adjuntos para correos.
 * Recibe FormData con archivos, los sube a Supabase Storage y devuelve metadata.
 * Se usa antes de enviar un correo con adjuntos nuevos.
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await crearClienteServidor()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const empresaId = user.app_metadata?.empresa_activa_id
    if (!empresaId) return NextResponse.json({ error: 'Sin empresa activa' }, { status: 403 })

    const formData = await request.formData()
    const archivos = formData.getAll('archivos') as File[]

    if (archivos.length === 0) {
      return NextResponse.json({ error: 'No se enviaron archivos' }, { status: 400 })
    }

    // Límite: 25MB total (como email estándar)
    const totalBytes = archivos.reduce((sum, f) => sum + f.size, 0)
    if (totalBytes > 25 * 1024 * 1024) {
      return NextResponse.json({ error: 'Los adjuntos superan el límite de 25 MB' }, { status: 400 })
    }

    const admin = crearClienteAdmin()
    const timestamp = Date.now()
    const adjuntosSubidos: {
      id: string
      nombre_archivo: string
      tipo_mime: string
      tamano_bytes: number
      url: string
      storage_path: string
      miniatura_url: string | null
    }[] = []

    for (const archivo of archivos) {
      const buffer = Buffer.from(await archivo.arrayBuffer())

      // Sanitizar nombre
      const nombreLimpio = archivo.name
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-zA-Z0-9._-]/g, '_')
        .slice(0, 100)

      const storagePath = `inbox/${empresaId}/correo/borrador_${timestamp}/${nombreLimpio}`

      // Subir a Storage
      const { error: errorStorage } = await admin.storage
        .from('adjuntos')
        .upload(storagePath, buffer, {
          contentType: archivo.type || 'application/octet-stream',
          upsert: true,
        })

      if (errorStorage) {
        console.error(`Error subiendo ${archivo.name}:`, errorStorage)
        continue
      }

      // URL pública
      const { data: urlData } = admin.storage
        .from('adjuntos')
        .getPublicUrl(storagePath)

      // Miniatura para imágenes
      let miniaturaUrl: string | null = null
      if (archivo.type.startsWith('image/')) {
        try {
          const sharp = (await import('sharp')).default
          const miniatura = await sharp(buffer)
            .resize(200, 200, { fit: 'cover' })
            .jpeg({ quality: 70 })
            .toBuffer()

          const thumbPath = `inbox/${empresaId}/correo/borrador_${timestamp}/thumb_${nombreLimpio}`
          await admin.storage
            .from('adjuntos')
            .upload(thumbPath, miniatura, {
              contentType: 'image/jpeg',
              upsert: true,
            })

          const { data: thumbUrl } = admin.storage
            .from('adjuntos')
            .getPublicUrl(thumbPath)

          miniaturaUrl = thumbUrl.publicUrl
        } catch {
          // Sin miniatura si falla
        }
      }

      // Insertar en BD (sin mensaje_id por ahora, se linkea después)
      const { data: adjunto, error: errorInsert } = await admin
        .from('mensaje_adjuntos')
        .insert({
          mensaje_id: null, // Se linkea al enviar el correo
          empresa_id: empresaId,
          nombre_archivo: archivo.name,
          tipo_mime: archivo.type || 'application/octet-stream',
          tamano_bytes: archivo.size,
          url: urlData.publicUrl,
          storage_path: storagePath,
          miniatura_url: miniaturaUrl,
        })
        .select('id, nombre_archivo, tipo_mime, tamano_bytes, url, storage_path, miniatura_url')
        .single()

      if (!errorInsert && adjunto) {
        adjuntosSubidos.push(adjunto)
      }
    }

    return NextResponse.json({ adjuntos: adjuntosSubidos }, { status: 201 })
  } catch (err) {
    console.error('Error subiendo adjuntos:', err)
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}
