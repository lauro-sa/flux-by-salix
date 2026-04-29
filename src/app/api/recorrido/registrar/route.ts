import { NextResponse, type NextRequest } from 'next/server'
import { requerirPermisoAPI } from '@/lib/permisos-servidor'
import { crearClienteAdmin } from '@/lib/supabase/admin'
import { registrarChatter } from '@/lib/chatter'
import { comprimirImagen, validarArchivo, TAMANO_MAXIMO_BYTES } from '@/lib/comprimir-imagen'
import { verificarCuotaStorage, registrarUsoStorage } from '@/lib/uso-storage'
import type { AdjuntoChatter } from '@/tipos/chatter'

/**
 * POST /api/recorrido/registrar — Registrar llegada con fotos, notas y checklist.
 * Body: FormData con visita_id, notas?, resultado?, checklist? (JSON string), archivos (fotos)
 * Se usa en: RegistroVisita (BottomSheet).
 */
export async function POST(request: NextRequest) {
  try {
    const guard = await requerirPermisoAPI('recorrido', 'registrar')
    if ('respuesta' in guard) return guard.respuesta
    const { user, empresaId } = guard

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

    // Subir fotos a Storage (con compresión y validación)
    const adjuntos: AdjuntoChatter[] = []
    const archivos = formData.getAll('archivos') as File[]

    // Verificar cuota antes de subir
    const tamanoTotal = archivos.reduce((sum, a) => sum + a.size, 0)
    const errorCuota = await verificarCuotaStorage(empresaId, tamanoTotal)
    if (errorCuota) {
      return NextResponse.json({ error: errorCuota }, { status: 413 })
    }

    for (const archivo of archivos) {
      if (!archivo.size) continue

      // Validar tipo y tamaño
      const errorValidacion = validarArchivo(archivo.type, archivo.size, TAMANO_MAXIMO_BYTES)
      if (errorValidacion) {
        console.warn(`Archivo rechazado en visita ${visitaId}: ${errorValidacion}`)
        continue
      }

      const timestamp = Date.now()
      const bufferOriginal = Buffer.from(await archivo.arrayBuffer())

      // Comprimir imágenes: max 1600px ancho, WebP 80% — preserva detalle
      // técnico (placas, cables, etiquetas) para zoom y mantiene peso razonable.
      const { buffer, tipo } = await comprimirImagen(bufferOriginal, archivo.type, {
        anchoMaximo: 1600,
        calidad: 80,
      })

      // Ajustar extensión si se convirtió a JPEG
      const nombreBase = archivo.name.replace(/\.[^.]+$/, '')
      const extension = tipo === 'image/webp' ? '.webp' : tipo === 'image/jpeg' ? '.jpg' : `.${archivo.name.split('.').pop()}`
      const nombreLimpio = `${nombreBase}${extension}`.replace(/[^a-zA-Z0-9._-]/g, '_')
      const rutaStorage = `${empresaId}/chatter/${visitaId}/${timestamp}_${nombreLimpio}`

      const { error: errorStorage } = await admin.storage
        .from('documentos-pdf')
        .upload(rutaStorage, buffer, {
          contentType: tipo,
          upsert: false,
        })

      if (!errorStorage) {
        const { data: urlData } = admin.storage
          .from('documentos-pdf')
          .getPublicUrl(rutaStorage)

        adjuntos.push({
          nombre: archivo.name,
          url: urlData.publicUrl,
          tipo,
          tamano: buffer.length,
        })

        // Registrar uso de storage
        registrarUsoStorage(empresaId, 'documentos-pdf', buffer.length)
      }
    }

    // Actualizar visita con resultado, notas y checklist
    const actualizacion: Record<string, unknown> = { actualizado_en: new Date().toISOString() }
    if (notas) actualizacion.notas_registro = notas
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
      .select('nombre, apellido, correo')
      .eq('id', user.id)
      .single()

    // Re-leer la visita actualizada para tener los datos más frescos
    const { data: visitaActualizada } = await admin
      .from('visitas')
      .select('notas, notas_registro, resultado, temperatura')
      .eq('id', visitaId)
      .single()

    // Metadata compartida para las entradas de chatter
    const nombreAutor = perfil ? `${perfil.nombre} ${perfil.apellido}`.trim() : 'Usuario'
    const checklistParseado = checklistJson ? (() => { try { return JSON.parse(checklistJson) } catch { return [] } })() : []
    const tempFinal = temperatura || visitaActualizada?.temperatura || null
    const notasFinal = notas || visitaActualizada?.notas_registro || null
    const resultadoFinal = resultado || visitaActualizada?.resultado || null
    const metadataVisita = {
      accion: 'visita_completada' as const,
      visita_id: visitaId,
      visita_resultado: resultadoFinal || undefined,
      visita_notas: notasFinal || undefined,
      visita_temperatura: tempFinal || undefined,
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

    // Buscar si ya existe una entrada de chatter de visita para esta visita (evitar duplicados)
    const { data: chatterExistenteVisita } = await admin
      .from('chatter')
      .select('id, adjuntos')
      .eq('entidad_tipo', 'visita')
      .eq('entidad_id', visitaId)
      .eq('tipo', 'visita')
      .order('creado_en', { ascending: false })
      .limit(1)
      .single()

    const { data: chatterExistenteContacto } = visita.contacto_id
      ? await admin
          .from('chatter')
          .select('id, adjuntos')
          .eq('entidad_tipo', 'contacto')
          .eq('entidad_id', visita.contacto_id)
          .eq('tipo', 'visita')
          .eq('metadata->>visita_id', visitaId)
          .order('creado_en', { ascending: false })
          .limit(1)
          .single()
      : { data: null }

    // Combinar adjuntos existentes con los nuevos
    const adjuntosExistentes = (chatterExistenteVisita?.adjuntos as AdjuntoChatter[] || [])
    const todosAdjuntos = [...adjuntosExistentes, ...adjuntos]

    if (chatterExistenteVisita) {
      // Actualizar entrada existente en chatter de la visita
      await admin
        .from('chatter')
        .update({
          contenido: resultado || 'Visita completada',
          adjuntos: todosAdjuntos,
          metadata: metadataVisita,
          actualizado_en: new Date().toISOString(),
        })
        .eq('id', chatterExistenteVisita.id)
    } else {
      // Primera vez — crear entrada en chatter de la visita
      await registrarChatter({
        empresaId,
        entidadTipo: 'visita',
        entidadId: visitaId,
        tipo: 'visita',
        contenido: resultado || 'Visita completada',
        autorId: user.id,
        autorNombre: nombreAutor,
        adjuntos: todosAdjuntos,
        metadata: metadataVisita,
      })
    }

    // Chatter del contacto — actualizar o crear
    if (visita.contacto_id) {
      if (chatterExistenteContacto) {
        await admin
          .from('chatter')
          .update({
            contenido: resultado || 'Visita completada',
            adjuntos: todosAdjuntos,
            metadata: metadataVisita,
            actualizado_en: new Date().toISOString(),
          })
          .eq('id', chatterExistenteContacto.id)
      } else {
        await registrarChatter({
          empresaId,
          entidadTipo: 'contacto',
          entidadId: visita.contacto_id,
          tipo: 'visita',
          contenido: resultado || 'Visita completada',
          autorId: user.id,
          autorNombre: nombreAutor,
          adjuntos: todosAdjuntos,
          metadata: metadataVisita,
        })
      }
    }

    return NextResponse.json({ ok: true, adjuntos: adjuntos.length })
  } catch (err) {
    console.error('Error en POST /api/recorrido/registrar:', err)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
