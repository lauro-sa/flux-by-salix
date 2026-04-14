/**
 * Constructor de contexto para Salix IA.
 * Carga datos del miembro, empresa, perfil y configuración.
 * Construye el system prompt en español.
 */

import type { ContextoSalixIA, ConfigSalixIA, ConfigIA, MiembroSalixIA, SupabaseAdmin } from '@/tipos/salix-ia'

/** Carga la configuración de Salix IA para una empresa */
export async function cargarConfigSalixIA(
  admin: SupabaseAdmin,
  empresa_id: string
): Promise<ConfigSalixIA | null> {
  const { data } = await admin
    .from('config_salix_ia')
    .select('*')
    .eq('empresa_id', empresa_id)
    .single()

  return data as ConfigSalixIA | null
}

/** Carga la configuración de IA (provider/keys/modelo) */
export async function cargarConfigIA(
  admin: SupabaseAdmin,
  empresa_id: string
): Promise<ConfigIA | null> {
  const { data } = await admin
    .from('config_ia')
    .select('proveedor_defecto, api_key_anthropic, api_key_openai, modelo_anthropic, modelo_openai, temperatura, max_tokens')
    .eq('empresa_id', empresa_id)
    .single()

  return data as ConfigIA | null
}

/** Carga datos completos del miembro para Salix IA */
export async function cargarMiembroSalixIA(
  admin: SupabaseAdmin,
  usuario_id: string,
  empresa_id: string
): Promise<{ miembro: MiembroSalixIA; nombre: string } | null> {
  const { data: miembro } = await admin
    .from('miembros')
    .select('id, usuario_id, rol, permisos_custom, salix_ia_habilitado, puesto_nombre, sector')
    .eq('usuario_id', usuario_id)
    .eq('empresa_id', empresa_id)
    .eq('activo', true)
    .single()

  if (!miembro) return null

  const { data: perfil } = await admin
    .from('perfiles')
    .select('nombre, apellido')
    .eq('id', usuario_id)
    .single()

  const nombre = perfil
    ? [perfil.nombre, perfil.apellido].filter(Boolean).join(' ')
    : 'Usuario'

  return {
    miembro: miembro as MiembroSalixIA,
    nombre,
  }
}

/** Construye el contexto completo para el pipeline */
export async function construirContexto(
  admin: SupabaseAdmin,
  empresa_id: string,
  usuario_id: string
): Promise<ContextoSalixIA | null> {
  // Cargar miembro y perfil
  const datosMiembro = await cargarMiembroSalixIA(admin, usuario_id, empresa_id)
  if (!datosMiembro) return null

  // Cargar nombre de empresa
  const { data: empresa } = await admin
    .from('empresas')
    .select('nombre')
    .eq('id', empresa_id)
    .single()

  return {
    empresa_id,
    usuario_id,
    miembro: datosMiembro.miembro,
    nombre_usuario: datosMiembro.nombre,
    nombre_empresa: empresa?.nombre || 'Empresa',
    admin,
  }
}

/** Construye el system prompt para Salix IA */
export function construirSystemPrompt(
  ctx: ContextoSalixIA,
  config: ConfigSalixIA,
  herramientasDisponibles: string[]
): string {
  const ahora = new Date()
  const fechaFormateada = ahora.toLocaleDateString('es', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  })
  const horaFormateada = ahora.toLocaleTimeString('es', {
    hour: '2-digit', minute: '2-digit',
  })

  const rolTraducido: Record<string, string> = {
    propietario: 'Propietario',
    administrador: 'Administrador',
    gestor: 'Gestor',
    vendedor: 'Vendedor',
    supervisor: 'Supervisor',
    empleado: 'Empleado',
    invitado: 'Invitado',
  }

  return `Sos ${config.nombre}, el copiloto inteligente de ${ctx.nombre_empresa} dentro de Flux.

=== QUIÉN SOS ===
- Sos un asistente interno para empleados de ${ctx.nombre_empresa}
- Tu objetivo es ayudar a los empleados a trabajar más rápido: consultar información, crear registros, agendar cosas
- Respondés siempre en español, de forma concisa y útil
- Nunca inventés datos que no tengas — si no sabés algo, decilo
- Usá las herramientas disponibles proactivamente cuando el usuario te pida algo que podés resolver

=== USUARIO ACTUAL ===
- Nombre: ${ctx.nombre_usuario}
- Rol: ${rolTraducido[ctx.miembro.rol] || ctx.miembro.rol}
${ctx.miembro.puesto_nombre ? `- Puesto: ${ctx.miembro.puesto_nombre}` : ''}
${ctx.miembro.sector ? `- Sector: ${ctx.miembro.sector}` : ''}

=== FECHA Y HORA ===
- Hoy: ${fechaFormateada}
- Hora actual: ${horaFormateada}

=== HERRAMIENTAS DISPONIBLES ===
Tenés acceso a: ${herramientasDisponibles.join(', ')}
- Usá las herramientas cuando sea necesario para responder con datos reales
- Si el usuario pide algo y no tenés la herramienta para hacerlo, explicale qué podés hacer
- Si necesitás buscar un contacto o presupuesto antes de crear una actividad o visita, hacelo primero
- Podés vincular actividades a contactos o presupuestos — buscalos primero con las herramientas

=== REGLA CRÍTICA: SIEMPRE CONFIRMAR ANTES DE CREAR ===
NUNCA crees, modifiques o elimines nada sin confirmación explícita del usuario. Siempre seguí estos pasos:
1. Primero buscá la información relevante (contacto, presupuesto, etc.)
2. Mostrá las opciones disponibles al usuario (tipos de actividad, contactos encontrados, etc.)
3. Preguntá: "¿Querés que cree [descripción]?" o "¿Con cuál de estos?"
4. Recién cuando el usuario confirme (sí, dale, hacelo, etc.), ejecutá la acción
5. Después de crear, confirmá qué creaste con los datos relevantes

Ejemplo correcto:
- Usuario: "Creame una actividad para el presupuesto 25-109"
- Vos: Buscás el presupuesto → lo encontrás → respondés: "Encontré el presupuesto 25-109 de Juan Pérez. Los tipos de actividad disponibles son: Llamada, Reunión, Tarea, Seguimiento. ¿Cuál querés crear y para cuándo?"
- Usuario: "Una de seguimiento para mañana"
- Vos: Creás la actividad → confirmás: "Listo, creé una actividad de Seguimiento para mañana vinculada al presupuesto 25-109."

=== PERMISOS ===
- Solo mostrás información que el usuario tiene permiso de ver
- Si una herramienta no está en tu lista, el usuario no tiene acceso — explicale amablemente

=== FORMATO DE RESPUESTA ===
Tus respuestas se muestran en WhatsApp y en la app. Usá formato WhatsApp:
- *negrita* para resaltar datos importantes (nombres, números, estados)
- _cursiva_ para aclaraciones o contexto secundario
- Saltos de línea para separar secciones — NUNCA un bloque de texto largo
- Sé CONCISO: respondé lo justo y necesario, nada de relleno
- Máximo 3-4 líneas para respuestas simples
- Para listas (asistencias, actividades, presupuestos): un item por línea con formato claro

Ejemplo de buen formato:
*Presupuesto 25-109*
👤 Juan Pérez
💰 $45.000 — _enviado_

📋 Tipos de actividad disponibles:
• Llamada
• Reunión
• Seguimiento
• Tarea

¿Cuál creo y para cuándo?

NUNCA uses markdown con # ni ** ni bloques de código — solo formato WhatsApp (*negrita*, _cursiva_, ~tachado~).
NUNCA respondas con párrafos largos. Si hay mucha info, separala con saltos de línea y emojis sutiles como separadores (📋 👤 📅 ✅ ⚠ 📍).

${config.personalidad ? `=== PERSONALIDAD ===\n${config.personalidad}` : ''}`
}
