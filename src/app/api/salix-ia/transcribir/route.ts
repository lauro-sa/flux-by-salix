/**
 * API Route: POST /api/salix-ia/transcribir
 * Recibe audio grabado del navegador y lo transcribe con Whisper (OpenAI).
 * Retorna el texto transcrito.
 */

import { NextRequest, NextResponse } from 'next/server'
import { obtenerUsuarioRuta } from '@/lib/supabase'
import { crearClienteAdmin } from '@/lib/supabase/admin'

export async function POST(request: NextRequest) {
  const { user, respuesta401 } = await obtenerUsuarioRuta()
  if (!user) return respuesta401()

  const empresa_id = user.app_metadata?.empresa_activa_id
  if (!empresa_id) {
    return NextResponse.json({ error: 'Sin empresa asociada' }, { status: 400 })
  }

  // Leer el audio del body
  const formData = await request.formData()
  const archivo = formData.get('audio') as File | null

  if (!archivo) {
    return NextResponse.json({ error: 'No se recibió archivo de audio' }, { status: 400 })
  }

  // Obtener API key de OpenAI
  const admin = crearClienteAdmin()
  let apiKey = process.env.OPENAI_API_KEY || ''

  if (!apiKey) {
    const { data: configIA } = await admin
      .from('config_ia')
      .select('api_key_openai')
      .eq('empresa_id', empresa_id)
      .single()
    apiKey = configIA?.api_key_openai || ''
  }

  if (!apiKey) {
    return NextResponse.json({ error: 'No hay API key de OpenAI configurada para transcripción' }, { status: 500 })
  }

  // Enviar a Whisper
  const buffer = Buffer.from(await archivo.arrayBuffer())
  const blob = new Blob([buffer], { type: archivo.type || 'audio/webm' })

  const whisperForm = new FormData()
  whisperForm.append('file', blob, 'audio.webm')
  whisperForm.append('model', 'whisper-1')
  whisperForm.append('language', 'es')

  const res = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}` },
    body: whisperForm,
  })

  if (!res.ok) {
    const err = await res.text()
    console.error('[Salix IA] Error Whisper:', err)
    return NextResponse.json({ error: 'Error al transcribir audio' }, { status: 500 })
  }

  const data = await res.json() as { text: string }
  const texto = data.text?.trim() || ''

  if (!texto) {
    return NextResponse.json({ error: 'No se pudo transcribir el audio' }, { status: 400 })
  }

  return NextResponse.json({ texto })
}
