import { NextResponse, type NextRequest } from 'next/server'
import { obtenerUsuarioRuta } from '@/lib/supabase/servidor'
import { crearClienteAdmin } from '@/lib/supabase/admin'
import { resolverPermisosGaleriaOT } from '@/lib/permisos-galeria-ot'
import {
  comprimirImagen,
  validarArchivo,
  TAMANO_MAXIMO_BYTES,
} from '@/lib/comprimir-imagen'
import { verificarCuotaStorage, registrarUsoStorage } from '@/lib/uso-storage'

/**
 * POST /api/ordenes/[id]/galeria/adjuntar
 * FormData: archivo (File), tipo ('relevamiento'|'bitacora')
 *
 * Sube un archivo al bucket `documentos-pdf` bajo el path
 * `<empresa>/ordenes/<ordenId>/<subtipo>/<timestamp>_<nombre>` y devuelve
 * el descriptor de adjunto. NO crea la entrada en chatter — el caller
 * combina varios adjuntos en una sola entrada con POST /galeria.
 *
 * Permisos:
 *   - tipo='relevamiento' → solo `puedeGestionar`.
 *   - tipo='bitacora'     → `puedeGestionar` o `esAsignado`.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: ordenId } = await params
    const { user } = await obtenerUsuarioRuta()
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const empresaId = user.app_metadata?.empresa_activa_id
    if (!empresaId) return NextResponse.json({ error: 'Sin empresa activa' }, { status: 403 })

    const formData = await request.formData()
    const archivo = formData.get('archivo') as File | null
    const tipoRaw = formData.get('tipo')
    const tipo = tipoRaw === 'relevamiento' || tipoRaw === 'bitacora' ? tipoRaw : null

    if (!archivo || !tipo) {
      return NextResponse.json({ error: 'archivo y tipo son requeridos' }, { status: 400 })
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
    const permisos = await resolverPermisosGaleriaOT(admin, user, empresaId, ordenId)
    if (!permisos.orden) return NextResponse.json({ error: 'Orden no encontrada' }, { status: 404 })

    const autorizado = tipo === 'relevamiento'
      ? permisos.puedeGestionar
      : permisos.puedeGestionar || permisos.esAsignado

    if (!autorizado) {
      return NextResponse.json({ error: 'Sin permiso para adjuntar a esta sección' }, { status: 403 })
    }

    const bufferOriginal = Buffer.from(await archivo.arrayBuffer())
    const { buffer, tipo: tipoMime } = await comprimirImagen(bufferOriginal, archivo.type, {
      anchoMaximo: 1600,
      calidad: 80,
    })

    const nombreBase = archivo.name.replace(/\.[^.]+$/, '')
    const extension =
      tipoMime === 'image/webp'
        ? '.webp'
        : tipoMime === 'image/jpeg' && archivo.type !== 'image/jpeg'
          ? '.jpg'
          : `.${archivo.name.split('.').pop()}`
    const nombreFinal = `${nombreBase}${extension}`.replace(/[^a-zA-Z0-9._-]/g, '_')
    const storagePath = `${empresaId}/ordenes/${ordenId}/${tipo}/${Date.now()}_${nombreFinal}`

    const { error: uploadError } = await admin.storage
      .from('documentos-pdf')
      .upload(storagePath, buffer, { contentType: tipoMime, upsert: false })

    if (uploadError) {
      return NextResponse.json({ error: `Error al subir: ${uploadError.message}` }, { status: 500 })
    }

    const { data: urlData } = admin.storage.from('documentos-pdf').getPublicUrl(storagePath)

    registrarUsoStorage(empresaId, 'documentos-pdf', buffer.length)

    return NextResponse.json(
      {
        url: urlData.publicUrl,
        nombre: archivo.name,
        tipo: tipoMime,
        tamano: buffer.length,
      },
      { status: 201 },
    )
  } catch (err) {
    console.error('[galeria-ot adjuntar] error interno:', err)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
