import { NextResponse, type NextRequest } from 'next/server'
import { requerirPermisoAPI } from '@/lib/permisos-servidor'
import { crearClienteAdmin } from '@/lib/supabase/admin'
import { comprimirImagen, validarArchivo, TAMANO_MAXIMO_BYTES } from '@/lib/comprimir-imagen'
import { verificarCuotaStorage, registrarUsoStorage } from '@/lib/uso-storage'

/**
 * POST /api/chatter/adjuntar — Subir un archivo y registrarlo en el chatter.
 * Body: FormData con campos: archivo (File), entidad_tipo, entidad_id
 */
export async function POST(request: NextRequest) {
  try {
    const guard = await requerirPermisoAPI('contactos', 'ver_todos')
    if ('respuesta' in guard) return guard.respuesta
    const { user, empresaId } = guard

    const formData = await request.formData()
    const archivo = formData.get('archivo') as File | null
    const entidadTipo = formData.get('entidad_tipo') as string
    const entidadId = formData.get('entidad_id') as string

    if (!archivo || !entidadTipo || !entidadId) {
      return NextResponse.json({ error: 'Faltan campos requeridos' }, { status: 400 })
    }

    // Validar tipo y tamaño
    const errorValidacion = validarArchivo(archivo.type, archivo.size, TAMANO_MAXIMO_BYTES)
    if (errorValidacion) {
      return NextResponse.json({ error: errorValidacion }, { status: 400 })
    }

    // Verificar cuota de storage
    const errorCuota = await verificarCuotaStorage(empresaId, archivo.size)
    if (errorCuota) {
      return NextResponse.json({ error: errorCuota }, { status: 413 })
    }

    const admin = crearClienteAdmin()

    // Subir archivo a Storage (comprimir si es imagen)
    const bufferOriginal = Buffer.from(await archivo.arrayBuffer())
    const { buffer, tipo } = await comprimirImagen(bufferOriginal, archivo.type, {
      anchoMaximo: 1600,
      calidad: 80,
    })

    const nombreBase = archivo.name.replace(/\.[^.]+$/, '')
    const extension = tipo === 'image/webp' ? '.webp'
      : tipo === 'image/jpeg' && archivo.type !== 'image/jpeg' ? '.jpg'
      : `.${archivo.name.split('.').pop()}`
    const nombreFinal = `${nombreBase}${extension}`.replace(/[^a-zA-Z0-9._-]/g, '_')
    const storagePath = `${empresaId}/chatter/${entidadId}/${Date.now()}_${nombreFinal}`

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
    const url = urlData.publicUrl

    // Obtener nombre del usuario
    const { data: perfil } = await admin
      .from('perfiles')
      .select('nombre, apellido, avatar_url')
      .eq('id', user.id)
      .single()

    const nombreCompleto = perfil
      ? `${perfil.nombre || ''} ${perfil.apellido || ''}`.trim()
      : 'Usuario'

    // Registrar en chatter
    const { error: chatterError } = await admin
      .from('chatter')
      .insert({
        empresa_id: empresaId,
        entidad_tipo: entidadTipo,
        entidad_id: entidadId,
        tipo: 'sistema',
        contenido: `Adjuntó archivo: ${archivo.name}`,
        autor_id: user.id,
        autor_nombre: nombreCompleto,
        autor_avatar_url: perfil?.avatar_url || null,
        adjuntos: [{
          url,
          nombre: archivo.name,
          tipo,
          tamano: buffer.length,
        }],
        metadata: { accion: 'campo_editado' },
      })

    if (chatterError) {
      return NextResponse.json({ error: 'Error al registrar en chatter' }, { status: 500 })
    }

    // Registrar uso de storage
    registrarUsoStorage(empresaId, 'documentos-pdf', buffer.length)

    return NextResponse.json({ url, nombre: archivo.name }, { status: 201 })
  } catch (err) {
    console.error('Error al adjuntar archivo:', err)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
