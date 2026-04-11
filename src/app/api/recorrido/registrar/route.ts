import { NextResponse, type NextRequest } from 'next/server'
import { obtenerUsuarioRuta } from '@/lib/supabase/servidor'
import { crearClienteAdmin } from '@/lib/supabase/admin'
import { registrarChatter } from '@/lib/chatter'
import type { AdjuntoChatter } from '@/tipos/chatter'

/**
 * POST /api/recorrido/registrar — Registrar llegada con fotos, notas y checklist.
 * Body: FormData con visita_id, notas?, resultado?, checklist? (JSON string), archivos (fotos)
 * Se usa en: RegistroVisita (BottomSheet).
 */
export async function POST(request: NextRequest) {
  try {
    const { user } = await obtenerUsuarioRuta()
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const empresaId = user.app_metadata?.empresa_activa_id
    if (!empresaId) return NextResponse.json({ error: 'Sin empresa activa' }, { status: 403 })

    const formData = await request.formData()
    const visitaId = formData.get('visita_id') as string
    const notas = formData.get('notas') as string | null
    const resultado = formData.get('resultado') as string | null
    const temperatura = formData.get('temperatura') as string | null
    const checklistJson = formData.get('checklist') as string | null

    if (!visitaId) {
      return NextResponse.json({ error: 'visita_id es requerido' }, { status: 400 })
    }

    const admin = crearClienteAdmin()

    // Verificar que la visita existe y pertenece a la empresa
    const { data: visita } = await admin
      .from('visitas')
      .select('id, empresa_id')
      .eq('id', visitaId)
      .eq('empresa_id', empresaId)
      .single()

    if (!visita) {
      return NextResponse.json({ error: 'Visita no encontrada' }, { status: 404 })
    }

    // Subir fotos a Storage
    const adjuntos: AdjuntoChatter[] = []
    const archivos = formData.getAll('archivos') as File[]

    for (const archivo of archivos) {
      if (!archivo.size) continue

      const timestamp = Date.now()
      const nombreLimpio = archivo.name.replace(/[^a-zA-Z0-9._-]/g, '_')
      const ruta = `documentos-pdf/${empresaId}/chatter/${visitaId}/${timestamp}_${nombreLimpio}`

      const buffer = Buffer.from(await archivo.arrayBuffer())
      const { error: errorStorage } = await admin.storage
        .from('documentos-pdf')
        .upload(ruta.replace('documentos-pdf/', ''), buffer, {
          contentType: archivo.type,
          upsert: false,
        })

      if (!errorStorage) {
        const { data: urlData } = admin.storage
          .from('documentos-pdf')
          .getPublicUrl(ruta.replace('documentos-pdf/', ''))

        adjuntos.push({
          nombre: archivo.name,
          url: urlData.publicUrl,
          tipo: archivo.type,
          tamano: archivo.size,
        })
      }
    }

    // Actualizar visita con resultado, notas y checklist
    const actualizacion: Record<string, unknown> = { actualizado_en: new Date().toISOString() }
    if (notas) actualizacion.notas = notas
    if (resultado) actualizacion.resultado = resultado
    if (temperatura) actualizacion.temperatura = temperatura
    if (checklistJson) {
      try {
        actualizacion.checklist = JSON.parse(checklistJson)
      } catch { /* ignorar JSON inválido */ }
    }

    await admin
      .from('visitas')
      .update(actualizacion)
      .eq('id', visitaId)

    // Obtener nombre del usuario
    const { data: miembro } = await admin
      .from('miembros')
      .select('nombre_completo')
      .eq('usuario_id', user.id)
      .eq('empresa_id', empresaId)
      .single()

    // Crear entrada en chatter con fotos y notas
    const contenidoChatter = notas
      ? `Registro de visita: ${notas}`
      : 'Registro de visita completado'

    await registrarChatter({
      empresaId,
      entidadTipo: 'visita',
      entidadId: visitaId,
      tipo: 'nota_interna',
      contenido: contenidoChatter,
      autorId: user.id,
      autorNombre: miembro?.nombre_completo || user.email || 'Usuario',
      adjuntos,
      metadata: {
        accion: 'estado_cambiado',
        detalles: {
          resultado: resultado || undefined,
          fotos: adjuntos.length,
        },
      },
    })

    return NextResponse.json({ ok: true, adjuntos: adjuntos.length })
  } catch (err) {
    console.error('Error en POST /api/recorrido/registrar:', err)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
