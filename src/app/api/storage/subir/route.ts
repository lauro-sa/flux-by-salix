import { NextResponse, type NextRequest } from 'next/server'
import { requerirPermisoAPI } from '@/lib/permisos-servidor'
import { crearClienteAdmin } from '@/lib/supabase/admin'
import { comprimirImagen, validarArchivo, TAMANO_MAXIMO_BYTES } from '@/lib/comprimir-imagen'
import { verificarCuotaStorage, registrarUsoStorage } from '@/lib/uso-storage'

/**
 * POST /api/storage/subir — Sube un archivo a Storage y devuelve su URL pública.
 * A diferencia de /api/chatter/adjuntar, NO crea registro en chatter:
 * se usa cuando el cliente necesita acumular URLs para enviarlas en otra request
 * (ej: EditorNota acumula adjuntos en estado local y los manda junto con la nota).
 *
 * Body: FormData con:
 *   - archivo (File, requerido)
 *   - carpeta (string, opcional) — sufijo bajo {empresaId}/ para organizar
 *
 * Respuesta: { url, nombre, tipo, tamano }
 */
export async function POST(request: NextRequest) {
  try {
    const guard = await requerirPermisoAPI('contactos', 'ver_todos')
    if ('respuesta' in guard) return guard.respuesta
    const { empresaId } = guard

    const formData = await request.formData()
    const archivo = formData.get('archivo') as File | null
    const carpetaCruda = (formData.get('carpeta') as string | null) || ''

    if (!archivo) {
      return NextResponse.json({ error: 'Falta el archivo' }, { status: 400 })
    }

    const errorValidacion = validarArchivo(archivo.type, archivo.size, TAMANO_MAXIMO_BYTES)
    if (errorValidacion) {
      return NextResponse.json({ error: errorValidacion }, { status: 400 })
    }

    const errorCuota = await verificarCuotaStorage(empresaId, archivo.size)
    if (errorCuota) {
      return NextResponse.json({ error: errorCuota }, { status: 413 })
    }

    const admin = crearClienteAdmin()

    // Comprimir si es imagen; PDFs y demás pasan tal cual
    const bufferOriginal = Buffer.from(await archivo.arrayBuffer())
    const { buffer, tipo } = await comprimirImagen(bufferOriginal, archivo.type, {
      anchoMaximo: 1600,
      calidad: 80,
    })

    // Nombre final preservando la extensión correcta tras eventual conversión a webp
    const nombreBase = archivo.name.replace(/\.[^.]+$/, '')
    const extension = tipo === 'image/webp' ? '.webp'
      : tipo === 'image/jpeg' && archivo.type !== 'image/jpeg' ? '.jpg'
      : `.${archivo.name.split('.').pop()}`
    const nombreFinal = `${nombreBase}${extension}`.replace(/[^a-zA-Z0-9._-]/g, '_')

    // Sanitizar carpeta: sin barras iniciales, sin "..", sin prefijo con empresaId duplicado
    const carpetaLimpia = carpetaCruda
      .replace(/^\/+/, '')
      .replace(/\.\./g, '')
      .replace(/[^a-zA-Z0-9._/-]/g, '_')
    const prefijo = carpetaLimpia ? `${empresaId}/${carpetaLimpia}` : `${empresaId}/adjuntos`
    const storagePath = `${prefijo}/${Date.now()}_${nombreFinal}`

    const { error: uploadError } = await admin.storage
      .from('documentos-pdf')
      .upload(storagePath, buffer, {
        contentType: tipo,
        upsert: false,
      })

    if (uploadError) {
      return NextResponse.json({ error: `Error al subir: ${uploadError.message}` }, { status: 500 })
    }

    const { data: urlData } = admin.storage.from('documentos-pdf').getPublicUrl(storagePath)

    registrarUsoStorage(empresaId, 'documentos-pdf', buffer.length)

    return NextResponse.json({
      url: urlData.publicUrl,
      nombre: archivo.name,
      tipo,
      tamano: buffer.length,
    }, { status: 201 })
  } catch (err) {
    console.error('Error al subir archivo:', err)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
