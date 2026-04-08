import { NextResponse, type NextRequest } from 'next/server'
import { crearClienteServidor } from '@/lib/supabase/servidor'
import { crearClienteAdmin } from '@/lib/supabase/admin'

/**
 * GET /api/inbox/correo/contadores — Contadores por canal y carpeta.
 * Usa SQL agregado para no traer todas las conversaciones al cliente.
 * Retorna sin leer Y totales por carpeta para cada canal.
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await crearClienteServidor()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const empresaId = user.app_metadata?.empresa_activa_id
    if (!empresaId) return NextResponse.json({ error: 'Sin empresa activa' }, { status: 403 })

    const admin = crearClienteAdmin()

    // Agregación en SQL: contar por canal_id + estado, sumar sin_leer
    const { data: filas, error } = await admin.rpc('contar_correos_inbox', {
      p_empresa_id: empresaId,
    })

    // Si la función RPC no existe, fallback a query manual agrupada
    if (error?.message?.includes('function') || !filas) {
      // Fallback: traer solo los campos mínimos con límite razonable
      const { data: conversaciones } = await admin
        .from('conversaciones')
        .select('canal_id, estado, mensajes_sin_leer, ultimo_mensaje_es_entrante')
        .eq('empresa_id', empresaId)
        .eq('tipo_canal', 'correo')
        .eq('en_papelera', false)
        .eq('bloqueada', false)
        .limit(5000)

      interface Conteo {
        entrada: number
        entrada_total: number
        enviados_total: number
        spam: number
        spam_total: number
        archivado_total: number
      }

      const contadores: Record<string, Conteo> = {}

      for (const conv of conversaciones || []) {
        if (!conv.canal_id) continue
        if (!contadores[conv.canal_id]) {
          contadores[conv.canal_id] = {
            entrada: 0, entrada_total: 0,
            enviados_total: 0,
            spam: 0, spam_total: 0,
            archivado_total: 0,
          }
        }

        const c = contadores[conv.canal_id]
        const sinLeer = conv.mensajes_sin_leer || 0

        // Contar enviados: conversaciones cuyo último mensaje es saliente
        if (conv.ultimo_mensaje_es_entrante === false) {
          c.enviados_total++
        }

        switch (conv.estado) {
          case 'abierta':
          case 'en_espera':
            c.entrada += sinLeer
            c.entrada_total++
            break
          case 'spam':
            c.spam += sinLeer
            c.spam_total++
            break
          case 'resuelta':
            c.archivado_total++
            break
        }
      }

      return NextResponse.json({ contadores })
    }

    // Procesar resultado del RPC
    interface FilaRPC {
      canal_id: string
      estado: string
      total: number
      sin_leer: number
    }

    interface Conteo {
      entrada: number
      entrada_total: number
      enviados_total: number
      spam: number
      spam_total: number
      archivado_total: number
    }

    const contadores: Record<string, Conteo> = {}

    for (const fila of (filas as FilaRPC[])) {
      if (!fila.canal_id) continue
      if (!contadores[fila.canal_id]) {
        contadores[fila.canal_id] = {
          entrada: 0, entrada_total: 0,
          enviados_total: 0,
          spam: 0, spam_total: 0,
          archivado_total: 0,
        }
      }

      const c = contadores[fila.canal_id]

      switch (fila.estado) {
        case 'abierta':
        case 'en_espera':
          c.entrada += fila.sin_leer
          c.entrada_total += fila.total
          break
        case 'spam':
          c.spam += fila.sin_leer
          c.spam_total += fila.total
          break
        case 'resuelta':
          c.archivado_total += fila.total
          break
      }
    }

    // Contar enviados por canal (el RPC agrupa por estado, no por dirección)
    const { data: enviadosPorCanal } = await admin
      .from('conversaciones')
      .select('canal_id')
      .eq('empresa_id', empresaId)
      .eq('tipo_canal', 'correo')
      .eq('ultimo_mensaje_es_entrante', false)
      .eq('en_papelera', false)
      .eq('bloqueada', false)

    if (enviadosPorCanal) {
      for (const conv of enviadosPorCanal) {
        if (!conv.canal_id) continue
        if (!contadores[conv.canal_id]) {
          contadores[conv.canal_id] = {
            entrada: 0, entrada_total: 0,
            enviados_total: 0,
            spam: 0, spam_total: 0,
            archivado_total: 0,
          }
        }
        contadores[conv.canal_id].enviados_total++
      }
    }

    return NextResponse.json({ contadores })
  } catch (err) {
    console.error('Error contadores correo:', err)
    return NextResponse.json({ contadores: {} })
  }
}
