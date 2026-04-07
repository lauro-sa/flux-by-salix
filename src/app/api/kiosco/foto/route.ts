import { NextResponse, type NextRequest } from 'next/server'
import { crearClienteAdmin } from '@/lib/supabase/admin'
import { verificarTokenKiosco } from '@/lib/kiosco/auth'

/**
 * POST /api/kiosco/foto — Subir foto silenciosa del fichaje.
 * FormData: { foto: Blob, asistenciaId, tipo: 'entrada'|'salida', empresaId }
 * Storage: asistencias/{empresaId}/{fecha}/{asistenciaId}_{tipo}.jpg
 */
export async function POST(request: NextRequest) {
  try {
    const terminal = await verificarTokenKiosco(request)
    if (!terminal) {
      return NextResponse.json({ error: 'Terminal no autorizada' }, { status: 401 })
    }

    const formData = await request.formData()
    const foto = formData.get('foto') as Blob | null
    const asistenciaId = formData.get('asistenciaId') as string
    const tipo = formData.get('tipo') as string
    const empresaId = formData.get('empresaId') as string

    if (!foto || !asistenciaId || !tipo || !empresaId) {
      return NextResponse.json({ error: 'Datos incompletos' }, { status: 400 })
    }

    const admin = crearClienteAdmin()
    const fechaHoy = new Date().toISOString().split('T')[0]
    const rutaArchivo = `asistencias/${empresaId}/${fechaHoy}/${asistenciaId}_${tipo}.jpg`

    // Convertir Blob a Buffer
    const buffer = Buffer.from(await foto.arrayBuffer())

    // Subir a Supabase Storage
    const { error: errorStorage } = await admin.storage
      .from('fotos')
      .upload(rutaArchivo, buffer, {
        contentType: 'image/jpeg',
        upsert: true,
      })

    if (errorStorage) {
      console.error('Error al subir foto:', errorStorage)
      return NextResponse.json({ error: 'Error al guardar foto' }, { status: 500 })
    }

    // Obtener URL pública
    const { data: urlData } = admin.storage
      .from('fotos')
      .getPublicUrl(rutaArchivo)

    // Actualizar asistencia con la URL de la foto
    const campo = tipo === 'entrada' ? 'foto_entrada' : 'foto_salida'
    await admin
      .from('asistencias')
      .update({ [campo]: urlData.publicUrl })
      .eq('id', asistenciaId)

    return NextResponse.json({ ok: true, url: urlData.publicUrl })
  } catch (error) {
    console.error('Error en /api/kiosco/foto:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
