import { NextResponse, type NextRequest } from 'next/server'
import { requerirPermisoAPI } from '@/lib/permisos-servidor'
import { crearClienteAdmin } from '@/lib/supabase/admin'
import { EstadosConversacion } from '@/tipos/conversacion'

/**
 * GET /api/inbox/correo/contadores — Contadores por canal y carpeta.
 * Usa SQL agregado para no traer todas las conversaciones al cliente.
 * Retorna sin leer Y totales por carpeta para cada canal.
 */
export async function GET(_request: NextRequest) {
  try {
    const guard = await requerirPermisoAPI('inbox_correo', 'ver_propio')
    if ('respuesta' in guard) return guard.respuesta
    const { empresaId } = guard

    const admin = crearClienteAdmin()

    // Agregación en SQL: contar por canal_id + estado, sumar sin_leer
    const { data: filas, error } = await admin.rpc('contar_correos_inbox', {
      p_empresa_id: empresaId,
    })

    interface Conteo {
      entrada: number
      entrada_total: number
      enviados_total: number
      spam: number
      spam_total: number
      archivado_total: number
    }

    const contadores: Record<string, Conteo> = {}
    const inicializar = (canalId: string) => {
      if (!contadores[canalId]) {
        contadores[canalId] = {
          entrada: 0, entrada_total: 0,
          enviados_total: 0,
          spam: 0, spam_total: 0,
          archivado_total: 0,
        }
      }
      return contadores[canalId]
    }

    // Si la función RPC no existe, fallback a query manual agrupada
    if (error?.message?.includes('function') || !filas) {
      const { data: conversaciones } = await admin
        .from('conversaciones')
        .select('canal_id, estado, mensajes_sin_leer, ultimo_mensaje_es_entrante, tiene_mensaje_entrante')
        .eq('empresa_id', empresaId)
        .eq('tipo_canal', 'correo')
        .eq('en_papelera', false)
        .eq('bloqueada', false)
        .limit(5000)

      for (const conv of conversaciones || []) {
        if (!conv.canal_id) continue
        const c = inicializar(conv.canal_id)
        const sinLeer = conv.mensajes_sin_leer || 0

        // "Enviados": conversaciones cuyo último mensaje es saliente.
        if (conv.ultimo_mensaje_es_entrante === false) {
          c.enviados_total++
        }

        switch (conv.estado) {
          case EstadosConversacion.ABIERTA:
          case EstadosConversacion.EN_ESPERA:
            // "Entrada" excluye hilos solo salientes (sin respuesta del contacto).
            if (conv.tiene_mensaje_entrante) {
              c.entrada += sinLeer
              c.entrada_total++
            }
            break
          case EstadosConversacion.SPAM:
            c.spam += sinLeer
            c.spam_total++
            break
          case EstadosConversacion.RESUELTA:
            c.archivado_total++
            break
        }
      }

      return NextResponse.json({ contadores })
    }

    // Procesar resultado del RPC (agrupado por canal/estado/tiene_entrante/ultimo_es_entrante)
    interface FilaRPC {
      canal_id: string
      estado: string
      tiene_mensaje_entrante: boolean
      ultimo_mensaje_es_entrante: boolean
      total: number
      sin_leer: number
    }

    for (const fila of (filas as FilaRPC[])) {
      if (!fila.canal_id) continue
      const c = inicializar(fila.canal_id)

      // "Enviados": último mensaje saliente, en cualquier estado.
      if (fila.ultimo_mensaje_es_entrante === false) {
        c.enviados_total += fila.total
      }

      switch (fila.estado) {
        case EstadosConversacion.ABIERTA:
        case EstadosConversacion.EN_ESPERA:
          // "Entrada" excluye hilos solo salientes.
          if (fila.tiene_mensaje_entrante) {
            c.entrada += fila.sin_leer
            c.entrada_total += fila.total
          }
          break
        case EstadosConversacion.SPAM:
          c.spam += fila.sin_leer
          c.spam_total += fila.total
          break
        case EstadosConversacion.RESUELTA:
          c.archivado_total += fila.total
          break
      }
    }

    return NextResponse.json({ contadores })
  } catch (err) {
    console.error('Error contadores correo:', err)
    return NextResponse.json({ contadores: {} })
  }
}
