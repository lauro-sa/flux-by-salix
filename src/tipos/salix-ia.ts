/**
 * Tipos para Salix IA — Copilot interno de Flux
 * Define las interfaces para herramientas, configuración, mensajes y contexto.
 */

import type { Modulo, Accion } from '@/tipos/permisos'

// ═══════════════════════════════════════════════════════════════
// HERRAMIENTAS
// ═══════════════════════════════════════════════════════════════

/** Nombres de todas las herramientas disponibles */
export type NombreHerramienta =
  | 'buscar_contactos'
  | 'obtener_contacto'
  | 'crear_contacto'
  | 'crear_actividad'
  | 'crear_recordatorio'
  | 'crear_visita'
  | 'consultar_asistencias'
  | 'consultar_calendario'
  | 'consultar_actividades'
  | 'consultar_visitas'
  | 'buscar_presupuestos'
  | 'modificar_actividad'
  | 'modificar_visita'
  | 'modificar_presupuesto'
  | 'modificar_evento'
  | 'anotar_nota'
  | 'consultar_notas'
  | 'modificar_nota'

/** Definición de una herramienta con su schema Anthropic y metadata de permisos */
export interface DefinicionHerramienta {
  nombre: NombreHerramienta
  definicion: {
    name: string
    description: string
    input_schema: Record<string, unknown>
  }
  modulo: Modulo
  accion_requerida: Accion
  /** Si true, para ver_propio se filtra automáticamente por el usuario */
  soporta_visibilidad: boolean
}

/** Resultado de la ejecución de una herramienta */
export interface ResultadoHerramienta {
  exito: boolean
  datos?: unknown
  error?: string
  mensaje_usuario?: string
}

/** Función ejecutora de una herramienta */
export type EjecutorHerramienta = (
  ctx: ContextoSalixIA,
  params: Record<string, unknown>
) => Promise<ResultadoHerramienta>

// ═══════════════════════════════════════════════════════════════
// CONFIGURACIÓN
// ═══════════════════════════════════════════════════════════════

/** Configuración de Salix IA por empresa */
export interface ConfigSalixIA {
  empresa_id: string
  habilitado: boolean
  nombre: string
  personalidad: string
  herramientas_habilitadas: NombreHerramienta[]
  whatsapp_copilot_habilitado: boolean
  max_iteraciones_herramientas: number
  creado_en: string
  actualizado_en: string
}

/** Configuración de IA (provider/keys/modelo) — reutiliza config_ia existente */
export interface ConfigIA {
  proveedor_defecto: string
  api_key_anthropic: string | null
  api_key_openai: string | null
  modelo_anthropic: string
  modelo_openai: string
  temperatura: string
  max_tokens: number
}

// ═══════════════════════════════════════════════════════════════
// MENSAJES Y CONVERSACIÓN
// ═══════════════════════════════════════════════════════════════

/** Roles posibles en una conversación con Salix IA */
export type RolMensaje = 'user' | 'assistant'

/** Un bloque de contenido de texto */
export interface BloqueTexto {
  type: 'text'
  text: string
}

/** Un bloque de uso de herramienta (assistant → tool call) */
export interface BloqueToolUse {
  type: 'tool_use'
  id: string
  name: string
  input: Record<string, unknown>
}

/** Un bloque de resultado de herramienta (user → tool result) */
export interface BloqueToolResult {
  type: 'tool_result'
  tool_use_id: string
  content: string
}

/** Mensaje en una conversación de Salix IA */
export interface MensajeSalixIA {
  role: RolMensaje
  content: string | (BloqueTexto | BloqueToolUse | BloqueToolResult)[]
  timestamp?: string
}

/** Conversación persistida */
export interface ConversacionSalixIA {
  id: string
  empresa_id: string
  usuario_id: string
  canal: 'app' | 'whatsapp'
  titulo: string
  mensajes: MensajeSalixIA[]
  resumen: string
  creado_en: string
  actualizado_en: string
}

// ═══════════════════════════════════════════════════════════════
// CONTEXTO DE EJECUCIÓN
// ═══════════════════════════════════════════════════════════════

/** Datos del miembro relevantes para Salix IA */
export interface MiembroSalixIA {
  id: string
  usuario_id: string
  rol: string
  permisos_custom: Record<string, string[]> | null
  salix_ia_habilitado: boolean
  puesto_nombre: string | null
  sector: string | null
}

/** Contexto completo que recibe cada herramienta y el pipeline */
export interface ContextoSalixIA {
  empresa_id: string
  usuario_id: string
  miembro: MiembroSalixIA
  nombre_usuario: string
  nombre_empresa: string
  /** Cliente admin de Supabase (service role) para queries sin RLS */
  admin: SupabaseAdmin
}

/** Tipo simplificado del cliente admin de Supabase */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type SupabaseAdmin = any

// ═══════════════════════════════════════════════════════════════
// PIPELINE
// ═══════════════════════════════════════════════════════════════

/** Parámetros para ejecutar el pipeline de Salix IA */
export interface ParamsPipeline {
  admin: SupabaseAdmin
  empresa_id: string
  usuario_id: string
  mensaje: string
  historial?: MensajeSalixIA[]
  conversacion_id?: string
  canal?: 'app' | 'whatsapp'
}

/** Resultado del pipeline */
export interface ResultadoPipeline {
  respuesta: string
  herramientas_usadas: string[]
  mensajes_nuevos: MensajeSalixIA[]
  tokens_entrada: number
  tokens_salida: number
  latencia_ms: number
}

// ═══════════════════════════════════════════════════════════════
// STREAMING (para la API del panel en la app)
// ═══════════════════════════════════════════════════════════════

/** Tipos de eventos SSE */
export type TipoEventoSSE =
  | 'texto'
  | 'herramienta_inicio'
  | 'herramienta_resultado'
  | 'error'
  | 'fin'

/** Evento enviado por SSE al frontend */
export interface EventoSSE {
  tipo: TipoEventoSSE
  datos: unknown
}

// ═══════════════════════════════════════════════════════════════
// WHATSAPP COPILOT
// ═══════════════════════════════════════════════════════════════

/** Resultado de la detección de empleado por teléfono */
export interface ResultadoDeteccionEmpleado {
  es_empleado: boolean
  miembro?: MiembroSalixIA
  perfil?: {
    nombre: string
    apellido: string
    telefono: string | null
    telefono_empresa: string | null
  }
}
