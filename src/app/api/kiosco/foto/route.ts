import { NextResponse, type NextRequest } from 'next/server'
import { crearClienteAdmin } from '@/lib/supabase/admin'
import { verificarTokenKiosco } from '@/lib/kiosco/auth'
import { comprimirImagen } from '@/lib/comprimir-imagen'
import { registrarUsoStorage, verificarCuotaStorage } from '@/lib/uso-storage'
import { formatearFechaISO } from '@/lib/formato-fecha'

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

    // Verificar cuota de storage
    const errorCuota = await verificarCuotaStorage(empresaId, foto.size)
    if (errorCuota) {
      return NextResponse.json({ error: errorCuota }, { status: 413 })
    }

    const admin = crearClienteAdmin()
    // La fecha del path debe coincidir con el día local del fichaje (no UTC),
    // para que todas las fotos del mismo turno queden en la misma carpeta.
    const { data: empKio } = await admin.from('empresas').select('zona_horaria').eq('id', empresaId).maybeSingle()
    const zonaKio = (empKio?.zona_horaria as string) || 'America/Argentina/Buenos_Aires'
    const fechaHoy = formatearFechaISO(new Date(), zonaKio)
    const rutaArchivo = `asistencias/${empresaId}/${fechaHoy}/${asistenciaId}_${tipo}.webp`

    // Convertir Blob a Buffer y comprimir (max 800px, WebP, calidad 75)
    const bufferOriginal = Buffer.from(await foto.arrayBuffer())
    const { buffer, tipo: tipoComprimido } = await comprimirImagen(bufferOriginal, 'image/jpeg', {
      anchoMaximo: 800,
      calidad: 75,
    })

    // Subir a Supabase Storage
    const { error: errorStorage } = await admin.storage
      .from('fotos')
      .upload(rutaArchivo, buffer, {
        contentType: tipoComprimido,
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

    // Registrar uso de storage
    registrarUsoStorage(empresaId, 'fotos', buffer.length)

    return NextResponse.json({ ok: true, url: urlData.publicUrl })
  } catch (error) {
    console.error('Error en /api/kiosco/foto:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
