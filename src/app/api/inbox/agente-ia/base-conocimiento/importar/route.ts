import { NextResponse, type NextRequest } from 'next/server'
import { requerirPermisoAPI } from '@/lib/permisos-servidor'
import { crearClienteAdmin } from '@/lib/supabase/admin'

/**
 * POST /api/inbox/agente-ia/base-conocimiento/importar
 * Importar contenido desde una URL o texto de archivo para la base de conocimiento.
 *
 * Body: { tipo: 'url' | 'texto', url?: string, texto?: string, titulo?: string }
 */

export async function POST(request: NextRequest) {
  try {
    const guard = await requerirPermisoAPI('config_correo', 'editar')
    if ('respuesta' in guard) return guard.respuesta
    const { empresaId } = guard

    const body = await request.json()
    const { tipo, url, texto, titulo } = body

    let contenido = ''
    let tituloFinal = titulo || ''

    if (tipo === 'url') {
      if (!url || typeof url !== 'string') {
        return NextResponse.json({ error: 'URL requerida' }, { status: 400 })
      }

      // Validar que sea una URL válida
      try {
        new URL(url)
      } catch {
        return NextResponse.json({ error: 'URL no válida' }, { status: 400 })
      }

      // Fetch de la página
      const res = await fetch(url, {
        headers: { 'User-Agent': 'FluxBot/1.0 (Knowledge Base Importer)' },
        signal: AbortSignal.timeout(15000),
      })

      if (!res.ok) {
        return NextResponse.json({ error: `Error al acceder a la URL: ${res.status}` }, { status: 400 })
      }

      const html = await res.text()

      // Extraer texto del HTML (limpieza básica)
      contenido = extraerTextoDeHTML(html)
      if (!tituloFinal) {
        // Extraer título de la página
        const tituloMatch = html.match(/<title[^>]*>(.*?)<\/title>/i)
        tituloFinal = tituloMatch ? tituloMatch[1].trim() : new URL(url).hostname
      }

    } else if (tipo === 'texto') {
      if (!texto || typeof texto !== 'string') {
        return NextResponse.json({ error: 'Texto requerido' }, { status: 400 })
      }
      contenido = texto.trim()
      if (!tituloFinal) tituloFinal = contenido.slice(0, 60) + '...'
    } else {
      return NextResponse.json({ error: 'tipo debe ser "url" o "texto"' }, { status: 400 })
    }

    if (!contenido || contenido.length < 10) {
      return NextResponse.json({ error: 'No se pudo extraer contenido suficiente' }, { status: 400 })
    }

    // Limitar largo
    if (contenido.length > 15000) {
      contenido = contenido.slice(0, 15000) + '\n\n[... contenido truncado por largo]'
    }

    // Guardar en base de conocimiento
    const admin = crearClienteAdmin()
    const { data, error } = await admin
      .from('base_conocimiento_ia')
      .insert({
        empresa_id: empresaId,
        titulo: tituloFinal.slice(0, 200),
        contenido,
        categoria: 'general',
        etiquetas: tipo === 'url' ? ['importado', 'web'] : ['importado'],
        activo: true,
      })
      .select()
      .single()

    if (error) throw error

    // Generar embedding en background
    if (data?.id) {
      import('@/lib/agente-ia/embeddings').then(({ actualizarEmbedding }) => {
        actualizarEmbedding(admin, empresaId, data.id, `${tituloFinal}\n\n${contenido}`).catch(() => {})
      }).catch(() => {})
    }

    return NextResponse.json({ entrada: data, caracteres: contenido.length })
  } catch (err) {
    console.error('Error al importar contenido:', err)
    return NextResponse.json({ error: 'Error al importar' }, { status: 500 })
  }
}

// ─── Extraer texto legible del HTML ───

function extraerTextoDeHTML(html: string): string {
  // Remover script, style, nav, footer, header
  let texto = html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<nav[\s\S]*?<\/nav>/gi, '')
    .replace(/<footer[\s\S]*?<\/footer>/gi, '')
    .replace(/<header[\s\S]*?<\/header>/gi, '')

  // Convertir <br>, <p>, <div>, <li>, headings a saltos de línea
  texto = texto
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<\/div>/gi, '\n')
    .replace(/<\/li>/gi, '\n')
    .replace(/<\/h[1-6]>/gi, '\n\n')
    .replace(/<h[1-6][^>]*>/gi, '\n')
    .replace(/<li[^>]*>/gi, '- ')

  // Remover todas las tags HTML restantes
  texto = texto.replace(/<[^>]+>/g, '')

  // Decodificar entidades HTML comunes
  texto = texto
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&eacute;/g, 'é')
    .replace(/&aacute;/g, 'á')
    .replace(/&iacute;/g, 'í')
    .replace(/&oacute;/g, 'ó')
    .replace(/&uacute;/g, 'ú')
    .replace(/&ntilde;/g, 'ñ')

  // Limpiar espacios múltiples y líneas vacías
  texto = texto
    .replace(/[ \t]+/g, ' ')
    .replace(/\n\s*\n\s*\n/g, '\n\n')
    .trim()

  return texto
}
