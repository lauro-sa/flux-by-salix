import { NextResponse, type NextRequest } from 'next/server'
import { crearClienteServidor } from '@/lib/supabase/servidor'
import { crearClienteAdmin } from '@/lib/supabase/admin'

/**
 * POST /api/chatter/adjuntar — Subir un archivo y registrarlo en el chatter.
 * Body: FormData con campos: archivo (File), entidad_tipo, entidad_id
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await crearClienteServidor()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const empresaId = user.app_metadata?.empresa_activa_id
    if (!empresaId) return NextResponse.json({ error: 'Sin empresa activa' }, { status: 403 })

    const formData = await request.formData()
    const archivo = formData.get('archivo') as File | null
    const entidadTipo = formData.get('entidad_tipo') as string
    const entidadId = formData.get('entidad_id') as string

    if (!archivo || !entidadTipo || !entidadId) {
      return NextResponse.json({ error: 'Faltan campos requeridos' }, { status: 400 })
    }

    const admin = crearClienteAdmin()

    // Subir archivo a Storage
    const ext = archivo.name.split('.').pop() || 'bin'
    const storagePath = `${empresaId}/chatter/${entidadId}/${Date.now()}_${archivo.name}`
    const buffer = Buffer.from(await archivo.arrayBuffer())

    const { error: uploadError } = await admin.storage
      .from('documentos-pdf')
      .upload(storagePath, buffer, {
        contentType: archivo.type,
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
          tipo: archivo.type,
          tamano: archivo.size,
        }],
        metadata: { accion: 'campo_editado' },
      })

    if (chatterError) {
      return NextResponse.json({ error: 'Error al registrar en chatter' }, { status: 500 })
    }

    return NextResponse.json({ url, nombre: archivo.name }, { status: 201 })
  } catch (err) {
    console.error('Error al adjuntar archivo:', err)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
