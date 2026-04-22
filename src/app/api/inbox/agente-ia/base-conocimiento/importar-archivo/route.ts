import { NextResponse, type NextRequest } from 'next/server'
import { requerirPermisoAPI } from '@/lib/permisos-servidor'
import { crearClienteAdmin } from '@/lib/supabase/admin'

/**
 * POST /api/inbox/agente-ia/base-conocimiento/importar-archivo
 * Importar contenido desde un archivo binario (PDF, TXT, MD, CSV).
 * Acepta multipart/form-data con campo "archivo".
 */

export async function POST(request: NextRequest) {
  try {
    const guard = await requerirPermisoAPI('config_correo', 'editar')
    if ('respuesta' in guard) return guard.respuesta
    const { empresaId } = guard

    const formData = await request.formData()
    const archivo = formData.get('archivo') as File | null

    if (!archivo) {
      return NextResponse.json({ error: 'No se recibió ningún archivo' }, { status: 400 })
    }

    // Validar tamaño (max 10MB)
    if (archivo.size > 10 * 1024 * 1024) {
      return NextResponse.json({ error: 'El archivo no puede superar 10MB' }, { status: 400 })
    }

    const nombreArchivo = archivo.name
    const extension = nombreArchivo.split('.').pop()?.toLowerCase() || ''
    let contenido = ''
    let titulo = nombreArchivo.replace(/\.[^.]+$/, '')

    if (extension === 'pdf') {
      // Extraer texto del PDF con pdf-parse
      const arrayBuffer = await archivo.arrayBuffer()
      const { PDFParse } = await import('pdf-parse')
      const parser = new PDFParse({ data: new Uint8Array(arrayBuffer) })
      const resultado = await parser.getText()
      contenido = resultado.text?.trim() || ''

      if (!contenido) {
        return NextResponse.json({
          error: 'No se pudo extraer texto del PDF. Puede ser un PDF escaneado (imágenes).',
        }, { status: 400 })
      }
    } else if (['txt', 'md', 'csv', 'json'].includes(extension)) {
      contenido = await archivo.text()
    } else {
      return NextResponse.json({
        error: `Formato no soportado: .${extension}. Usá PDF, TXT, MD, CSV o JSON.`,
      }, { status: 400 })
    }

    contenido = contenido.trim()

    if (!contenido || contenido.length < 10) {
      return NextResponse.json({ error: 'No se pudo extraer contenido suficiente del archivo' }, { status: 400 })
    }

    // Limitar largo
    if (contenido.length > 15000) {
      contenido = contenido.slice(0, 15000) + '\n\n[... contenido truncado por largo]'
    }

    // Determinar etiquetas según tipo
    const etiquetas = ['importado', extension === 'pdf' ? 'pdf' : 'archivo']

    // Guardar en base de conocimiento
    const admin = crearClienteAdmin()
    const { data, error } = await admin
      .from('base_conocimiento_ia')
      .insert({
        empresa_id: empresaId,
        titulo: titulo.slice(0, 200),
        contenido,
        categoria: 'general',
        etiquetas,
        activo: true,
      })
      .select()
      .single()

    if (error) throw error

    // Generar embedding en background
    if (data?.id) {
      import('@/lib/agente-ia/embeddings').then(({ actualizarEmbedding }) => {
        actualizarEmbedding(admin, empresaId, data.id, `${titulo}\n\n${contenido}`).catch(() => {})
      }).catch(() => {})
    }

    return NextResponse.json({ entrada: data, caracteres: contenido.length })
  } catch (err) {
    console.error('Error al importar archivo:', err)
    return NextResponse.json({ error: 'Error al procesar el archivo' }, { status: 500 })
  }
}
