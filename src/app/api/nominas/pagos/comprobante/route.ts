/**
 * POST /api/nominas/pagos/comprobante
 *
 * Sube un archivo (PDF/imagen) al Storage y devuelve la URL pública +
 * el storage_path. Pensado para que el cliente lo suba ANTES de
 * confirmar el pago: el modal acumula la URL en estado local y la
 * pasa como `comprobante_url` en el POST /api/nominas/pagos.
 *
 * Por qué dedicado (no reutilizar /api/storage/subir):
 *   • Acá requerimos `nomina:editar` (el genérico exige `contactos:ver_todos`).
 *   • Path organizado bajo `${empresa_id}/nomina-pagos/...` para que
 *     el cron de limpieza pueda barrer huérfanos por bucket-prefix.
 *
 * Body: FormData con:
 *   - archivo (File, requerido)
 *
 * Respuesta: { url, storage_path, nombre, tipo, tamano }
 */

import { NextResponse, type NextRequest } from 'next/server'
import { requerirPermisoAPI } from '@/lib/permisos-servidor'
import { crearClienteAdmin } from '@/lib/supabase/admin'
import { comprimirImagen, validarArchivo, TAMANO_MAXIMO_BYTES } from '@/lib/comprimir-imagen'
import { verificarCuotaStorage, registrarUsoStorage } from '@/lib/uso-storage'

export async function POST(request: NextRequest) {
  try {
    const guard = await requerirPermisoAPI('nomina', 'editar')
    if ('respuesta' in guard) return guard.respuesta
    const { empresaId } = guard

    const formData = await request.formData()
    const archivo = formData.get('archivo') as File | null

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

    // Imágenes se comprimen; PDFs y otros formatos pasan tal cual.
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

    // Path organizado por empresa para que el cron de limpieza pueda
    // identificar huérfanos sin recorrer toda la BD. Token random
    // para evitar adivinación de URLs sin tener acceso a la fila.
    const storagePath = `${empresaId}/nomina-pagos/${Date.now()}_${Math.random().toString(36).slice(2, 6)}_${nombreFinal}`

    const { error: uploadError } = await admin.storage
      .from('documentos-pdf')
      .upload(storagePath, buffer, { contentType: tipo, upsert: false })

    if (uploadError) {
      return NextResponse.json({ error: `Error al subir: ${uploadError.message}` }, { status: 500 })
    }

    const { data: urlData } = admin.storage.from('documentos-pdf').getPublicUrl(storagePath)
    registrarUsoStorage(empresaId, 'documentos-pdf', buffer.length)

    return NextResponse.json({
      url: urlData.publicUrl,
      storage_path: storagePath,
      nombre: archivo.name,
      tipo,
      tamano: buffer.length,
    }, { status: 201 })
  } catch (err) {
    console.error('Error al subir comprobante de nómina:', err)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
