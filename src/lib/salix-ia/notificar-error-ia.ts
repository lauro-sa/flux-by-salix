/**
 * Notifica a los administradores cuando hay un error de IA (créditos, API key, etc.)
 * Se usa en: pipeline de Salix IA y pipeline del agente IA de WhatsApp.
 *
 * Solo notifica una vez por tipo de error (anti-duplicación via referencia_id).
 * El administrador recibe una notificación de sistema con link a Configuración → IA.
 */

import { crearNotificacion } from '@/lib/notificaciones'
import type { SupabaseAdmin } from '@/tipos/salix-ia'

interface ErrorIA {
  empresa_id: string
  origen: 'salix_ia' | 'agente_ia'
  mensajeError: string
}

/** Mapea errores de API a mensajes claros y tipo de error para anti-duplicación */
function clasificarError(mensajeError: string): { titulo: string; cuerpo: string; tipoError: string } | null {
  const errorLower = mensajeError.toLowerCase()

  if (errorLower.includes('credit balance') || errorLower.includes('billing') || errorLower.includes('purchase credits')) {
    return {
      titulo: 'IA sin créditos',
      cuerpo: 'La API key de Anthropic no tiene créditos. El asistente IA no puede funcionar hasta que se recarguen créditos o se actualice la key.',
      tipoError: 'sin_creditos',
    }
  }

  if (errorLower.includes('invalid api key') || errorLower.includes('authentication') || errorLower.includes('unauthorized') || errorLower.includes('401')) {
    return {
      titulo: 'API key de IA inválida',
      cuerpo: 'La API key de Anthropic es inválida o fue revocada. Verificala en Configuración → IA.',
      tipoError: 'key_invalida',
    }
  }

  if (errorLower.includes('rate limit') || errorLower.includes('too many requests') || errorLower.includes('429')) {
    return {
      titulo: 'Límite de IA alcanzado',
      cuerpo: 'Se excedió el límite de solicitudes a la API de Anthropic. El servicio se recuperará en unos minutos.',
      tipoError: 'rate_limit',
    }
  }

  // No notificar errores genéricos o temporales (overloaded, etc.)
  return null
}

/**
 * Envía notificación de error de IA a todos los administradores y propietarios de la empresa.
 * Anti-duplicación: usa referencia_tipo='error_ia' + referencia_id='{tipoError}' para no spamear.
 */
export async function notificarErrorIA(
  admin: SupabaseAdmin,
  { empresa_id, origen, mensajeError }: ErrorIA
): Promise<void> {
  const clasificacion = clasificarError(mensajeError)
  if (!clasificacion) return // No notificar errores genéricos

  const { titulo, cuerpo, tipoError } = clasificacion
  const origenTexto = origen === 'salix_ia' ? 'Salix IA' : 'Agente IA WhatsApp'

  // Obtener administradores y propietarios activos
  const { data: admins } = await admin
    .from('miembros')
    .select('usuario_id')
    .eq('empresa_id', empresa_id)
    .in('rol', ['propietario', 'administrador'])
    .eq('activo', true)

  if (!admins || admins.length === 0) return

  // Enviar notificación a cada admin (crearNotificacion ya maneja anti-duplicación)
  for (const adm of admins) {
    try {
      await crearNotificacion({
        empresaId: empresa_id,
        usuarioId: adm.usuario_id,
        tipo: 'sistema',
        titulo: `⚠ ${titulo}`,
        cuerpo: `${origenTexto}: ${cuerpo}`,
        icono: 'alert-triangle',
        color: 'var(--insignia-peligro)',
        url: '/configuracion?seccion=ia',
        referenciaTipo: 'error_ia',
        referenciaId: tipoError, // Anti-dup: solo 1 notificación por tipo de error
      })
    } catch {
      // No fallar si la notificación falla
    }
  }
}
