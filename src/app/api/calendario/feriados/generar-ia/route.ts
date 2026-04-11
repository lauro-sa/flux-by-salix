import { NextResponse, type NextRequest } from 'next/server'
import { obtenerUsuarioRuta } from '@/lib/supabase/servidor'
import { crearClienteAdmin } from '@/lib/supabase/admin'
import { obtenerYVerificarPermiso } from '@/lib/permisos-servidor'
import Anthropic from '@anthropic-ai/sdk'

/**
 * POST /api/calendario/feriados/generar-ia — Genera feriados usando Salix IA con búsqueda web.
 * Body: { pais: string, anio: number }
 * Usa web_search para encontrar feriados actualizados (puentes decretados, etc.)
 * Devuelve un array de feriados sugeridos para que el usuario acepte/rechace.
 */
export async function POST(request: NextRequest) {
  try {
    const { user } = await obtenerUsuarioRuta()
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const empresaId = user.app_metadata?.empresa_activa_id
    if (!empresaId) return NextResponse.json({ error: 'Sin empresa activa' }, { status: 403 })

    const { permitido } = await obtenerYVerificarPermiso(user.id, empresaId, 'config_calendario', 'editar')
    if (!permitido) return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })

    const body = await request.json()
    const { pais, anio } = body

    if (!pais || !anio) {
      return NextResponse.json({ error: 'pais y anio son requeridos' }, { status: 400 })
    }

    // Obtener API key de la config IA de la empresa
    const admin = crearClienteAdmin()
    const { data: configIA } = await admin
      .from('config_ia')
      .select('api_key_anthropic, api_key_openai, proveedor_defecto, habilitado')
      .eq('empresa_id', empresaId)
      .single()

    const apiKey = configIA?.api_key_anthropic || process.env.ANTHROPIC_API_KEY || ''
    if (!apiKey) {
      return NextResponse.json({ error: 'Salix IA no está configurada. Configurá tu API Key en Configuración > Inteligencia Artificial.' }, { status: 503 })
    }

    const cliente = new Anthropic({ apiKey })

    // Usar web_search para que busque información actualizada de feriados
    const respuesta = await cliente.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      tools: [{
        type: 'web_search_20250305' as const,
        name: 'web_search' as const,
        max_uses: 5,
      }],
      messages: [{
        role: 'user',
        content: `Buscá en internet los feriados nacionales, feriados puente y días no laborables oficiales de ${pais} para el año ${anio}.

IMPORTANTE:
- Buscá la información oficial y actualizada (decretos gubernamentales, boletín oficial, etc.)
- Incluí feriados inamovibles, trasladables, puentes turísticos y días no laborables
- Para Argentina: buscá los decretos del Poder Ejecutivo que establecen los feriados puente

Después de investigar, devolvé ÚNICAMENTE un JSON válido con este formato exacto (sin texto adicional, sin markdown, sin backticks):
[{"fecha":"YYYY-MM-DD","nombre":"Nombre del feriado","tipo":"nacional"},...]

Tipos válidos (usá EXACTAMENTE estos strings):
- "nacional" — feriado nacional oficial (inamovible o trasladable)
- "puente" — día puente turístico / feriado puente
- "no_laborable" — día no laborable (no es feriado nacional pero no se trabaja, ej: Jueves Santo)

Ordená por fecha. Usá los nombres oficiales en español.`
      }],
    })

    // Extraer el texto final de la respuesta (puede tener múltiples bloques por web_search)
    let textoRespuesta = ''
    for (const bloque of respuesta.content) {
      if (bloque.type === 'text') {
        textoRespuesta = bloque.text
      }
    }

    if (!textoRespuesta) {
      return NextResponse.json({ error: 'La IA no devolvió una respuesta de texto' }, { status: 500 })
    }

    let feriadosSugeridos: { fecha: string; nombre: string; tipo: string }[]
    try {
      feriadosSugeridos = JSON.parse(textoRespuesta.trim())
    } catch {
      // Intentar extraer JSON de entre texto o backticks
      const match = textoRespuesta.match(/\[[\s\S]*\]/)
      if (!match) {
        return NextResponse.json({ error: 'No se pudo parsear la respuesta de IA', respuesta_raw: textoRespuesta }, { status: 500 })
      }
      feriadosSugeridos = JSON.parse(match[0])
    }

    // Validar estructura y normalizar tipos
    const fechaRegex = /^\d{4}-\d{2}-\d{2}$/
    const TIPOS_VALIDOS = ['nacional', 'puente', 'no_laborable', 'regional']

    function normalizarTipo(tipo: string): string {
      const t = (tipo || '').toLowerCase().trim()
      if (TIPOS_VALIDOS.includes(t)) return t
      if (t.includes('puente') || t.includes('bridge')) return 'puente'
      if (t.includes('no_lab') || t.includes('no lab') || t.includes('non-working')) return 'no_laborable'
      return 'nacional'
    }

    const validados = feriadosSugeridos
      .filter(f => f.fecha && f.nombre && fechaRegex.test(f.fecha))
      .map(f => ({
        fecha: f.fecha,
        nombre: f.nombre,
        tipo: normalizarTipo(f.tipo),
      }))

    return NextResponse.json({
      feriados: validados,
      pais,
      anio,
    })
  } catch (err) {
    console.error('Error generando feriados con IA:', err)
    return NextResponse.json({ error: 'Error al generar feriados con IA' }, { status: 500 })
  }
}
