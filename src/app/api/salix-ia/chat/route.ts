/**
 * API Route: POST /api/salix-ia/chat
 * Endpoint principal de Salix IA. Recibe un mensaje y retorna la respuesta via streaming SSE.
 * Maneja: autenticación, persistencia de conversación, ejecución del pipeline.
 */

import { NextRequest, NextResponse } from 'next/server'
import { requerirPermisoAPI } from '@/lib/permisos-servidor'
import { crearClienteAdmin } from '@/lib/supabase/admin'
import { ejecutarSalixIA } from '@/lib/salix-ia/pipeline'
import type { MensajeSalixIA } from '@/tipos/salix-ia'

export async function POST(request: NextRequest) {
  const guard = await requerirPermisoAPI('contactos', 'ver_propio')
  if ('respuesta' in guard) return guard.respuesta
  const { user, empresaId: empresa_id } = guard

  const body = await request.json()
  const { mensaje, conversacion_id } = body as {
    mensaje?: string
    conversacion_id?: string
  }

  if (!mensaje?.trim()) {
    return NextResponse.json({ error: 'Mensaje vacío' }, { status: 400 })
  }

  const admin = crearClienteAdmin()

  // Verificar que Salix IA esté habilitado en la app para este usuario
  const { data: miembro } = await admin
    .from('miembros')
    .select('salix_ia_web')
    .eq('usuario_id', user.id)
    .eq('empresa_id', empresa_id)
    .eq('activo', true)
    .single()

  if (!miembro?.salix_ia_web) {
    return NextResponse.json({ error: 'Salix IA no está habilitado para tu cuenta' }, { status: 403 })
  }

  // Cargar o crear conversación
  let historial: MensajeSalixIA[] = []
  let convId = conversacion_id

  if (convId) {
    const { data: conv } = await admin
      .from('conversaciones_salix_ia')
      .select('mensajes')
      .eq('id', convId)
      .eq('usuario_id', user.id)
      .single()

    if (conv?.mensajes) {
      historial = conv.mensajes as MensajeSalixIA[]
    }
  }

  // Streaming SSE
  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    async start(controller) {
      const enviar = (tipo: string, datos: unknown) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ tipo, datos })}\n\n`))
      }

      try {
        enviar('herramienta_inicio', { mensaje: 'Procesando...' })

        // Ejecutar el pipeline
        const resultado = await ejecutarSalixIA({
          admin,
          empresa_id,
          usuario_id: user.id,
          mensaje: mensaje.trim(),
          historial,
          conversacion_id: convId,
          canal: 'app',
        })

        // Enviar la respuesta
        enviar('texto', { contenido: resultado.respuesta })

        // Enviar herramientas usadas
        if (resultado.herramientas_usadas.length > 0) {
          enviar('herramienta_resultado', {
            herramientas: resultado.herramientas_usadas,
          })
        }

        // Persistir la conversación
        const nuevoHistorial = [...historial, ...resultado.mensajes_nuevos]

        if (convId) {
          // Actualizar conversación existente
          await admin
            .from('conversaciones_salix_ia')
            .update({
              mensajes: nuevoHistorial,
              actualizado_en: new Date().toISOString(),
            })
            .eq('id', convId)
        } else {
          // Crear nueva conversación
          const titulo = mensaje.trim().substring(0, 80)
          const { data: nuevaConv } = await admin
            .from('conversaciones_salix_ia')
            .insert({
              empresa_id,
              usuario_id: user.id,
              canal: 'app',
              titulo,
              mensajes: nuevoHistorial,
            })
            .select('id')
            .single()

          convId = nuevaConv?.id
        }

        // Evento de finalización
        enviar('fin', {
          conversacion_id: convId,
          herramientas_usadas: resultado.herramientas_usadas,
          tokens: {
            entrada: resultado.tokens_entrada,
            salida: resultado.tokens_salida,
          },
          latencia_ms: resultado.latencia_ms,
        })
      } catch (err) {
        enviar('error', {
          mensaje: err instanceof Error ? err.message : 'Error inesperado',
        })
      } finally {
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  })
}
