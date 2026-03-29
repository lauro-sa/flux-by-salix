import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Embeddings para búsqueda semántica en la base de conocimiento.
 * Usa la API de OpenAI (text-embedding-3-small) para generar vectores.
 * Se usa en: pipeline (buscar conocimiento relevante) y API (al crear/editar entradas).
 */

const MODELO_EMBEDDING = 'text-embedding-3-small'
const DIMENSIONES = 1536

// ─── Generar embedding con OpenAI ───

export async function generarEmbedding(texto: string, apiKey: string): Promise<number[]> {
  const res = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: MODELO_EMBEDDING,
      input: texto.slice(0, 8000), // Limitar largo del input
      dimensions: DIMENSIONES,
    }),
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(`Error generando embedding: ${JSON.stringify(err)}`)
  }

  const data = await res.json() as {
    data: { embedding: number[] }[]
  }

  return data.data[0].embedding
}

// ─── Obtener API key de OpenAI de la config de la empresa ───

export async function obtenerApiKeyOpenAI(admin: SupabaseClient, empresaId: string): Promise<string | null> {
  const { data } = await admin
    .from('config_ia')
    .select('api_key_openai')
    .eq('empresa_id', empresaId)
    .single()

  return data?.api_key_openai || process.env.OPENAI_API_KEY || null
}

// ─── Actualizar embedding de una entrada de conocimiento ───

export async function actualizarEmbedding(
  admin: SupabaseClient,
  empresaId: string,
  entradaId: string,
  contenido: string,
): Promise<boolean> {
  try {
    const apiKey = await obtenerApiKeyOpenAI(admin, empresaId)
    if (!apiKey) return false

    const textoParaEmbedding = contenido.slice(0, 8000)
    const embedding = await generarEmbedding(textoParaEmbedding, apiKey)

    // Guardar como string JSON del vector (Supabase acepta formato [n1,n2,...])
    const { error } = await admin
      .from('base_conocimiento_ia')
      .update({ embedding: JSON.stringify(embedding) })
      .eq('id', entradaId)
      .eq('empresa_id', empresaId)

    if (error) {
      console.error('[EMBEDDINGS] Error guardando embedding:', error)
      return false
    }

    return true
  } catch (err) {
    console.error('[EMBEDDINGS] Error:', err)
    return false
  }
}

// ─── Buscar entradas similares por embedding ───

export async function buscarConocimientoSimilar(
  admin: SupabaseClient,
  empresaId: string,
  consulta: string,
  limite: number = 5,
): Promise<{ id: string; titulo: string; contenido: string; categoria: string; similitud: number }[]> {
  try {
    const apiKey = await obtenerApiKeyOpenAI(admin, empresaId)
    if (!apiKey) return []

    const embedding = await generarEmbedding(consulta, apiKey)

    const { data, error } = await admin.rpc('buscar_conocimiento_similar', {
      p_empresa_id: empresaId,
      p_embedding: JSON.stringify(embedding),
      p_limite: limite,
      p_umbral: 0.5,
    })

    if (error) {
      console.error('[EMBEDDINGS] Error en búsqueda semántica:', error)
      return []
    }

    return (data || []) as { id: string; titulo: string; contenido: string; categoria: string; similitud: number }[]
  } catch (err) {
    console.error('[EMBEDDINGS] Error en búsqueda:', err)
    return []
  }
}

// ─── Generar embeddings para todas las entradas sin vector ───

export async function generarEmbeddingsPendientes(
  admin: SupabaseClient,
  empresaId: string,
): Promise<number> {
  const apiKey = await obtenerApiKeyOpenAI(admin, empresaId)
  if (!apiKey) return 0

  // Buscar entradas activas sin embedding
  const { data: entradas } = await admin
    .from('base_conocimiento_ia')
    .select('id, titulo, contenido')
    .eq('empresa_id', empresaId)
    .eq('activo', true)
    .is('embedding', null)
    .limit(50)

  if (!entradas || entradas.length === 0) return 0

  let actualizadas = 0
  for (const entrada of entradas) {
    const texto = `${entrada.titulo}\n\n${entrada.contenido}`
    const exito = await actualizarEmbedding(admin, empresaId, entrada.id, texto)
    if (exito) actualizadas++
  }

  return actualizadas
}
