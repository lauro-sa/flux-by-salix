import type { SupabaseClient } from '@supabase/supabase-js'
import type { AccionAgente } from '@/tipos/inbox'
import type { ContextoPipeline } from './contexto'

/**
 * Nodos del agente IA — cada acción es una función independiente (workflow-ready).
 * Se usa en: pipeline.ts para ejecutar acciones post-LLM.
 * Cada nodo implementa la interfaz NodoAgenteIA y puede invocarse individualmente.
 */

// ─── Interfaz base para nodos ───

export interface ResultadoNodo {
  exito: boolean
  datos?: Record<string, unknown>
  error?: string
}

export interface NodoAgenteIA {
  tipo: AccionAgente
  ejecutar(ctx: ContextoPipeline, admin: SupabaseClient, datos: Record<string, unknown>): Promise<ResultadoNodo>
}

// ─── Respuesta del LLM parseada ───

export interface RespuestaLLM {
  respuesta: string
  tipo_contacto: string
  fase_conversacion: string
  clasificacion: {
    intencion: string
    tema: string
    urgencia: string
    confianza: number
  }
  sentimiento: {
    valor: string
    confianza: number
  }
  debe_escalar: boolean
  razon_escalamiento: string | null
  datos_capturados: {
    nombre: string | null
    zona: string | null
    tipo_trabajo: string | null
    tiene_fotos: boolean
    tipo_facturacion: string | null
    direccion: string | null
    email: string | null
    telefono: string | null
  } | null
  etiquetas_sugeridas: string[]
  acciones_sugeridas: { tipo: string; datos: Record<string, unknown> }[]
}

// ─── Nodo: Etiquetar conversación ───

export const nodoEtiquetar: NodoAgenteIA = {
  tipo: 'etiquetar',
  async ejecutar(ctx, admin, datos) {
    try {
      const etiquetas = (datos.etiquetas_sugeridas as string[]) || []
      if (etiquetas.length === 0) return { exito: true }

      // Obtener etiquetas actuales
      const { data: conv } = await admin
        .from('conversaciones')
        .select('etiquetas')
        .eq('id', ctx.conversacion_id)
        .single()

      const actuales: string[] = conv?.etiquetas || []
      const nuevas = [...new Set([...actuales, ...etiquetas])]

      await admin
        .from('conversaciones')
        .update({ etiquetas: nuevas })
        .eq('id', ctx.conversacion_id)

      return { exito: true, datos: { etiquetas: nuevas } }
    } catch (err) {
      return { exito: false, error: String(err) }
    }
  },
}

// ─── Nodo: Clasificar conversación (guardar clasificacion_ia en BD) ───

export const nodoClasificar: NodoAgenteIA = {
  tipo: 'clasificar',
  async ejecutar(ctx, admin, datos) {
    try {
      const clasificacion = datos.clasificacion as RespuestaLLM['clasificacion']
      if (!clasificacion) return { exito: true }

      await admin
        .from('conversaciones')
        .update({ clasificacion_ia: clasificacion })
        .eq('id', ctx.conversacion_id)

      return { exito: true, datos: { clasificacion } }
    } catch (err) {
      return { exito: false, error: String(err) }
    }
  },
}

// ─── Nodo: Escalar a agente humano ───

export const nodoEscalar: NodoAgenteIA = {
  tipo: 'escalar',
  async ejecutar(ctx, admin, datos) {
    try {
      const razon = (datos.razon_escalamiento as string) || 'Escalado por el agente IA'

      // Desactivar agente IA en la conversación
      await admin
        .from('conversaciones')
        .update({ agente_ia_activo: false })
        .eq('id', ctx.conversacion_id)

      // Incrementar contador de escalamientos
      await admin
        .from('config_agente_ia')
        .update({ total_escalamientos: (ctx.config.total_escalamientos || 0) + 1 })
        .eq('empresa_id', ctx.empresa_id)

      return { exito: true, datos: { razon } }
    } catch (err) {
      return { exito: false, error: String(err) }
    }
  },
}

// ─── Nodo: Crear actividad (tarea/seguimiento) ───

export const nodoCrearActividad: NodoAgenteIA = {
  tipo: 'crear_actividad',
  async ejecutar(ctx, admin, datos) {
    try {
      const titulo = (datos.titulo as string) || 'Actividad creada por IA'
      const descripcion = (datos.descripcion as string) || ''

      const { error } = await admin
        .from('actividades')
        .insert({
          empresa_id: ctx.empresa_id,
          titulo,
          descripcion,
          tipo: 'tarea',
          estado: 'pendiente',
          origen: 'agente_ia',
          referencia_tipo: 'conversacion',
          referencia_id: ctx.conversacion_id,
        })

      if (error) throw error
      return { exito: true, datos: { titulo } }
    } catch (err) {
      return { exito: false, error: String(err) }
    }
  },
}

// ─── Nodo: Actualizar datos del contacto ───

export const nodoActualizarContacto: NodoAgenteIA = {
  tipo: 'actualizar_contacto',
  async ejecutar(ctx, admin, datos) {
    try {
      const campo = datos.campo as string
      const valor = datos.valor as string
      if (!campo || !valor || !ctx.contacto?.telefono) return { exito: true }

      // Solo actualizar campos seguros
      const camposPermitidos = ['empresa', 'cargo', 'notas', 'email']
      if (!camposPermitidos.includes(campo)) {
        return { exito: false, error: `Campo "${campo}" no permitido para actualización automática` }
      }

      await admin
        .from('contactos')
        .update({ [campo]: valor })
        .eq('empresa_id', ctx.empresa_id)
        .eq('telefono', ctx.contacto.telefono)

      return { exito: true, datos: { campo, valor } }
    } catch (err) {
      return { exito: false, error: String(err) }
    }
  },
}

// ─── Nodo: Sentimiento (guardar en conversación) ───

export const nodoSentimiento: NodoAgenteIA = {
  tipo: 'sentimiento',
  async ejecutar(ctx, admin, datos) {
    try {
      const sentimiento = datos.sentimiento as RespuestaLLM['sentimiento']
      if (!sentimiento) return { exito: true }

      // Guardar sentimiento como campo directo de la conversación
      await admin
        .from('conversaciones')
        .update({ sentimiento: sentimiento.valor })
        .eq('id', ctx.conversacion_id)

      return { exito: true, datos: { sentimiento } }
    } catch (err) {
      return { exito: false, error: String(err) }
    }
  },
}

// ─── Nodo: Enrutar a agente/equipo (asignación automática) ───

export const nodoEnrutar: NodoAgenteIA = {
  tipo: 'enrutar',
  async ejecutar(ctx, admin) {
    try {
      // Verificar que no haya agente asignado
      const { data: conv } = await admin
        .from('conversaciones')
        .select('asignado_a, canal_id')
        .eq('id', ctx.conversacion_id)
        .single()

      if (conv?.asignado_a) return { exito: true, datos: { ya_asignado: true } }

      // Obtener config de asignación
      const { data: configInbox } = await admin
        .from('config_inbox')
        .select('asignacion_automatica, algoritmo_asignacion')
        .eq('empresa_id', ctx.empresa_id)
        .single()

      if (!configInbox?.asignacion_automatica) return { exito: true, datos: { asignacion_deshabilitada: true } }

      const algoritmo = configInbox.algoritmo_asignacion || 'round_robin'
      const canalId = conv?.canal_id || ''

      // Obtener agentes disponibles (primero del canal, luego todos)
      const { data: agentesCanal } = await admin
        .from('canal_agentes_asignados')
        .select('usuario_id, usuario_nombre')
        .eq('canal_id', canalId)
        .eq('empresa_id', ctx.empresa_id)

      let agentes: { id: string; nombre: string }[] = []
      if (agentesCanal && agentesCanal.length > 0) {
        agentes = agentesCanal.map(a => ({ id: a.usuario_id, nombre: a.usuario_nombre || 'Agente' }))
      } else {
        const { data: usuarios } = await admin
          .from('usuarios_empresa')
          .select('usuario_id, nombre, apellido')
          .eq('empresa_id', ctx.empresa_id)

        agentes = (usuarios || []).map(u => ({
          id: u.usuario_id,
          nombre: `${u.nombre || ''} ${u.apellido || ''}`.trim() || 'Agente',
        }))
      }

      if (agentes.length === 0) return { exito: true, datos: { sin_agentes: true } }

      // Seleccionar agente según algoritmo (una sola query en vez de N)
      let seleccionado: { id: string; nombre: string } | null = null
      const idsAgentes = agentes.map(a => a.id)

      if (algoritmo === 'por_carga') {
        // Una sola query: contar conversaciones abiertas por agente
        const { data: cargas } = await admin
          .from('conversaciones')
          .select('asignado_a')
          .eq('empresa_id', ctx.empresa_id)
          .eq('estado', 'abierta')
          .in('asignado_a', idsAgentes)

        // Contar por agente
        const conteo = new Map<string, number>()
        for (const a of agentes) conteo.set(a.id, 0)
        for (const c of cargas || []) {
          conteo.set(c.asignado_a, (conteo.get(c.asignado_a) || 0) + 1)
        }

        // Elegir el de menor carga
        let menorCarga = Infinity
        for (const agente of agentes) {
          const carga = conteo.get(agente.id) || 0
          if (carga < menorCarga) {
            menorCarga = carga
            seleccionado = agente
          }
        }
      } else {
        // Round robin: una sola query para obtener la última asignación de cada agente
        const { data: ultimasConvs } = await admin
          .from('conversaciones')
          .select('asignado_a, actualizado_en')
          .eq('empresa_id', ctx.empresa_id)
          .in('asignado_a', idsAgentes)
          .order('actualizado_en', { ascending: false })

        // Para cada agente, tomar la fecha más reciente
        const ultimaAsignacion = new Map<string, string>()
        for (const c of ultimasConvs || []) {
          if (!ultimaAsignacion.has(c.asignado_a)) {
            ultimaAsignacion.set(c.asignado_a, c.actualizado_en)
          }
        }

        // Elegir el que fue asignado hace más tiempo (o nunca)
        let fechaMasAntigua = new Date().toISOString()
        for (const agente of agentes) {
          const fecha = ultimaAsignacion.get(agente.id) || '1970-01-01'
          if (fecha < fechaMasAntigua) {
            fechaMasAntigua = fecha
            seleccionado = agente
          }
        }

        if (!seleccionado && agentes.length > 0) seleccionado = agentes[0]
      }

      if (!seleccionado) return { exito: true, datos: { sin_agente_disponible: true } }

      // Asignar
      await admin
        .from('conversaciones')
        .update({
          asignado_a: seleccionado.id,
          asignado_a_nombre: seleccionado.nombre,
        })
        .eq('id', ctx.conversacion_id)

      return { exito: true, datos: { asignado_a: seleccionado.nombre, algoritmo } }
    } catch (err) {
      return { exito: false, error: String(err) }
    }
  },
}

// ─── Nodo: Resumir conversación ───

export const nodoResumir: NodoAgenteIA = {
  tipo: 'resumir',
  async ejecutar(ctx, admin) {
    try {
      if (ctx.mensajes.length < 3) return { exito: true, datos: { pocos_mensajes: true } }

      // Construir resumen estructurado usando datos del LLM ya procesados
      const clasificacion = ctx.resultados_previos.clasificacion as RespuestaLLM['clasificacion'] | undefined
      const sentimiento = ctx.resultados_previos.sentimiento as RespuestaLLM['sentimiento'] | undefined

      // Tomar últimos mensajes del cliente como contexto
      const mensajesCliente = ctx.mensajes
        .filter(m => m.es_entrante && m.texto)
        .slice(-5)
        .map(m => m.texto!.trim())

      // Armar resumen con estructura: [intención] tema — último mensaje del cliente
      const partes: string[] = []

      if (clasificacion) {
        partes.push(`[${clasificacion.intencion}] ${clasificacion.tema}`)
        if (clasificacion.urgencia !== 'baja') partes.push(`(urgencia: ${clasificacion.urgencia})`)
      }

      if (sentimiento && sentimiento.valor !== 'neutro') {
        partes.push(`— sentimiento: ${sentimiento.valor}`)
      }

      // Agregar último mensaje como contexto
      const ultimoMsg = mensajesCliente.at(-1)
      if (ultimoMsg) {
        const fragmento = ultimoMsg.length > 120 ? ultimoMsg.slice(0, 120) + '...' : ultimoMsg
        partes.push(`| "${fragmento}"`)
      }

      const resumen = partes.join(' ') || mensajesCliente.join(' | ').slice(0, 200)

      if (resumen) {
        await admin
          .from('conversaciones')
          .update({ resumen_ia: resumen })
          .eq('id', ctx.conversacion_id)
      }

      return { exito: true, datos: { resumen } }
    } catch (err) {
      return { exito: false, error: String(err) }
    }
  },
}
