import { NextRequest, NextResponse } from 'next/server'
import { requerirPermisoAPI } from '@/lib/permisos-servidor'
import { crearClienteAdmin } from '@/lib/supabase/admin'

/**
 * DELETE /api/chatter/adjuntos?chatter_id=xxx&indice=N
 * Elimina un adjunto específico de una entrada del chatter.
 * Remueve del array JSON y opcionalmente del storage.
 */
export async function DELETE(request: NextRequest) {
  try {
    const guard = await requerirPermisoAPI('contactos', 'ver_todos')
    if ('respuesta' in guard) return guard.respuesta
    const { empresaId } = guard

    const { searchParams } = new URL(request.url)
    const chatterId = searchParams.get('chatter_id')
    const indiceStr = searchParams.get('indice')

    if (!chatterId || indiceStr == null) {
      return NextResponse.json({ error: 'Faltan parámetros chatter_id e indice' }, { status: 400 })
    }

    const indice = parseInt(indiceStr, 10)
    if (isNaN(indice) || indice < 0) {
      return NextResponse.json({ error: 'Índice inválido' }, { status: 400 })
    }

    const admin = crearClienteAdmin()

    // Obtener la entrada del chatter
    const { data: entrada, error } = await admin
      .from('chatter')
      .select('id, adjuntos, empresa_id')
      .eq('id', chatterId)
      .eq('empresa_id', empresaId)
      .single()

    if (error || !entrada) {
      return NextResponse.json({ error: 'Entrada no encontrada' }, { status: 404 })
    }

    const adjuntos = (entrada.adjuntos as { url: string; nombre: string; tipo: string }[]) || []

    if (indice >= adjuntos.length) {
      return NextResponse.json({ error: 'Índice fuera de rango' }, { status: 400 })
    }

    // Remover el adjunto del array
    const nuevosAdjuntos = adjuntos.filter((_, i) => i !== indice)

    // Actualizar la entrada del chatter
    await admin
      .from('chatter')
      .update({ adjuntos: nuevosAdjuntos })
      .eq('id', chatterId)

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('Error eliminando adjunto:', err)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
