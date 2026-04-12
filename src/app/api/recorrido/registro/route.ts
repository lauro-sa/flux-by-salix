import { NextResponse, type NextRequest } from 'next/server'
import { obtenerUsuarioRuta } from '@/lib/supabase/servidor'
import { crearClienteAdmin } from '@/lib/supabase/admin'
import { descontarUsoStorage } from '@/lib/uso-storage'

/**
 * GET /api/recorrido/registro?visita_id=xxx — Obtener datos del registro previo de una visita.
 * Devuelve: visita (notas, resultado, checklist) + fotos del chatter.
 * Se usa en: RegistroVisita para cargar datos existentes al abrir.
 *
 * DELETE /api/recorrido/registro — Eliminar un adjunto (foto) de una entrada del chatter.
 * Body: { chatter_id, adjunto_url }
 * Se usa en: RegistroVisita para eliminar fotos.
 */
export async function GET(request: NextRequest) {
  try {
    const { user } = await obtenerUsuarioRuta()
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const empresaId = user.app_metadata?.empresa_activa_id
    if (!empresaId) return NextResponse.json({ error: 'Sin empresa activa' }, { status: 403 })

    const { searchParams } = new URL(request.url)
    const visitaId = searchParams.get('visita_id')
    if (!visitaId) return NextResponse.json({ error: 'visita_id requerido' }, { status: 400 })

    const admin = crearClienteAdmin()

    // Obtener visita
    const { data: visita } = await admin
      .from('visitas')
      .select('id, notas, resultado, checklist, estado')
      .eq('id', visitaId)
      .eq('empresa_id', empresaId)
      .single()

    if (!visita) return NextResponse.json({ error: 'Visita no encontrada' }, { status: 404 })

    // Obtener entradas del chatter con adjuntos (fotos)
    const { data: entradas } = await admin
      .from('chatter')
      .select('id, contenido, adjuntos, creado_en')
      .eq('entidad_tipo', 'visita')
      .eq('entidad_id', visitaId)
      .eq('empresa_id', empresaId)
      .not('adjuntos', 'eq', '[]')
      .order('creado_en', { ascending: false })

    // Extraer todas las fotos con referencia a su entrada de chatter
    const fotos = (entradas || []).flatMap(e =>
      ((e.adjuntos || []) as { url: string; nombre: string; tipo: string; tamano?: number }[]).map(adj => ({
        chatter_id: e.id,
        url: adj.url,
        nombre: adj.nombre,
        tipo: adj.tipo,
        tamano: adj.tamano,
        creado_en: e.creado_en,
      }))
    )

    return NextResponse.json({
      visita: {
        notas: visita.notas,
        resultado: visita.resultado,
        checklist: visita.checklist,
        estado: visita.estado,
      },
      fotos,
    })
  } catch (err) {
    console.error('Error en GET /api/recorrido/registro:', err)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { user } = await obtenerUsuarioRuta()
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const empresaId = user.app_metadata?.empresa_activa_id
    if (!empresaId) return NextResponse.json({ error: 'Sin empresa activa' }, { status: 403 })

    const { chatter_id, adjunto_url } = await request.json() as {
      chatter_id: string
      adjunto_url: string
    }

    if (!chatter_id || !adjunto_url) {
      return NextResponse.json({ error: 'chatter_id y adjunto_url requeridos' }, { status: 400 })
    }

    const admin = crearClienteAdmin()

    // Obtener la entrada de chatter
    const { data: entrada } = await admin
      .from('chatter')
      .select('id, adjuntos')
      .eq('id', chatter_id)
      .eq('empresa_id', empresaId)
      .single()

    if (!entrada) return NextResponse.json({ error: 'Entrada no encontrada' }, { status: 404 })

    // Filtrar el adjunto
    const adjuntosActualizados = ((entrada.adjuntos || []) as { url: string }[])
      .filter(a => a.url !== adjunto_url)

    // Actualizar la entrada
    await admin
      .from('chatter')
      .update({ adjuntos: adjuntosActualizados })
      .eq('id', chatter_id)

    // Intentar eliminar el archivo de Storage (best effort)
    try {
      const ruta = adjunto_url.split('/storage/v1/object/public/')[1]
      if (ruta) {
        const bucket = ruta.split('/')[0]
        const rutaArchivo = ruta.split('/').slice(1).join('/')
        await admin.storage.from(bucket).remove([rutaArchivo])

        // Descontar del tracking — estimar tamaño del adjunto eliminado
        const adjEliminado = ((entrada.adjuntos || []) as { url: string; tamano?: number }[])
          .find(a => a.url === adjunto_url)
        if (adjEliminado?.tamano) {
          descontarUsoStorage(empresaId, bucket, adjEliminado.tamano)
        }
      }
    } catch { /* ignorar error de storage */ }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('Error en DELETE /api/recorrido/registro:', err)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
