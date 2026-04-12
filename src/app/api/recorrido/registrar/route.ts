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

    // Verificar que la visita existe y pertenece a la empresa — traer datos completos para el chatter
    const { data: visita } = await admin
      .from('visitas')
      .select('id, empresa_id, contacto_id, contacto_nombre, direccion_texto, direccion_lat, direccion_lng, fecha_programada, fecha_completada, fecha_llegada, duracion_estimada_min, duracion_real_min, motivo, estado, asignado_nombre, registro_lat, registro_lng, registro_precision_m')
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

    // Obtener nombre del usuario desde perfiles
    const { data: perfil } = await admin
      .from('perfiles')
      .select('nombre, apellido')
      .eq('id', user.id)
      .single()

    // Metadata compartida para las entradas de chatter
    const nombreAutor = perfil ? `${perfil.nombre} ${perfil.apellido}`.trim() : (user.email || 'Usuario')
    const checklistParseado = checklistJson ? (() => { try { return JSON.parse(checklistJson) } catch { return [] } })() : []
    const metadataVisita = {
      accion: 'visita_completada' as const,
      visita_id: visitaId,
      visita_resultado: resultado || undefined,
      visita_notas: notas || undefined,
      visita_temperatura: temperatura || undefined,
      visita_checklist: checklistParseado,
      visita_direccion: visita.direccion_texto || undefined,
      visita_duracion_real: visita.duracion_real_min || undefined,
      visita_duracion_estimada: visita.duracion_estimada_min || undefined,
      visita_fecha_completada: visita.fecha_completada || new Date().toISOString(),
      visita_fecha_programada: visita.fecha_programada || undefined,
      visita_motivo: visita.motivo || undefined,
      visita_contacto_nombre: visita.contacto_nombre || undefined,
      visita_contacto_id: visita.contacto_id || undefined,
      visita_registro_lat: visita.registro_lat || undefined,
      visita_registro_lng: visita.registro_lng || undefined,
      visita_registro_precision: visita.registro_precision_m || undefined,
    }

    // Entrada en el chatter de la visita
    await registrarChatter({
      empresaId,
      entidadTipo: 'visita',
      entidadId: visitaId,
      tipo: 'visita',
      contenido: resultado || 'Visita completada',
      autorId: user.id,
      autorNombre: nombreAutor,
      adjuntos,
      metadata: metadataVisita,
    })

    // Entrada en el chatter del contacto — bloque visual de visita completada
    if (visita.contacto_id) {
      await registrarChatter({
        empresaId,
        entidadTipo: 'contacto',
        entidadId: visita.contacto_id,
        tipo: 'visita',
        contenido: resultado || 'Visita completada',
        autorId: user.id,
        autorNombre: nombreAutor,
        adjuntos,
        metadata: metadataVisita,
      })
    }

    return NextResponse.json({ ok: true, adjuntos: adjuntos.length })
  } catch (err) {
    console.error('Error en POST /api/recorrido/registrar:', err)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
