/**
 * Enriquecimiento del contexto de la ejecución (PR 16).
 *
 * `enriquecerContexto(ejecucion, admin)` toma el `contexto_inicial`
 * mínimo que el dispatcher seteó (solo trigger + cambio + entidad
 * { tipo, id }) y lo expande cargando datos completos:
 *
 *   - entidad: row completo de la tabla principal de la entidad
 *   - contacto: si la entidad tiene contacto_id, su row completo
 *   - actor: perfil del usuario que disparó (si aplica)
 *   - empresa: row completo de la empresa
 *   - ahora: timestamp del momento del enriquecimiento
 *
 * El orquestador llama esta función UNA SOLA VEZ al transicionar la
 * ejecución de `pendiente` → `corriendo`, persiste el resultado en
 * `ejecuciones_flujo.contexto_inicial` y lo deja fijo durante toda la
 * vida de la ejecución (incluso flujos con `esperar(7d)` ven los
 * datos congelados al momento del disparo). Comportamiento estándar
 * de Salesforce/HubSpot/Make — predecible y evita race conditions
 * cuando la entidad muta durante el delay.
 *
 * Si una carga falla (entidad borrada, RLS, network), el campo
 * correspondiente queda `null`. La ejecución continúa: si una acción
 * referencia ese campo con `{{vars}}`, fallará con `VariableFaltante`
 * de manera predecible (a menos que use `default(...)`).
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type { EntidadConEstado } from '@/tipos/estados'
import { TABLA_PRINCIPAL_POR_ENTIDAD } from '@/lib/estados/mapeo'
import type { ContextoVariables } from './resolver-variables'

// =============================================================
// Mapeo de columna contacto_id por entidad
// =============================================================
// No todas las entidades tienen `contacto_id` directo. Las que sí
// (verificado en BD): presupuestos, conversaciones, ordenes_trabajo,
// visitas. Para las otras dejamos contacto en null en este PR; en el
// futuro podemos agregar derivación a través de joins (ej: cuota →
// presupuesto.contacto_id) si los flujos lo requieren.

const ENTIDADES_CON_CONTACTO_DIRECTO: Set<EntidadConEstado> = new Set([
  'presupuesto',
  'conversacion',
  'orden',
  'visita',
])

// =============================================================
// Punto de entrada
// =============================================================

export interface EjecucionEnriquecible {
  empresa_id: string
  contexto_inicial: ContextoVariables | null
  /** disparado_por es text discriminado: 'cambios_estado:<uuid>' | 'cron:<expr>' | etc. */
  disparado_por: string | null
}

/**
 * Devuelve un contexto nuevo, enriquecido, para persistir y para usar
 * durante la ejecución. NO muta el `contexto_inicial` recibido.
 */
export async function enriquecerContexto(
  ejecucion: EjecucionEnriquecible,
  admin: SupabaseClient,
): Promise<ContextoVariables> {
  const base = ejecucion.contexto_inicial ?? {}
  const tipoEntidad = leerTipoEntidad(base)
  const idEntidad = leerIdEntidad(base)

  const [entidadCompleta, empresaCompleta, actorPerfil] = await Promise.all([
    tipoEntidad && idEntidad
      ? cargarEntidad(tipoEntidad, idEntidad, ejecucion.empresa_id, admin)
      : Promise.resolve(null),
    cargarEmpresa(ejecucion.empresa_id, admin),
    cargarActorDesdeDisparadoPor(ejecucion.disparado_por, ejecucion.empresa_id, admin),
  ])

  const contacto =
    tipoEntidad &&
    entidadCompleta &&
    ENTIDADES_CON_CONTACTO_DIRECTO.has(tipoEntidad) &&
    typeof entidadCompleta.contacto_id === 'string'
      ? await cargarContacto(entidadCompleta.contacto_id, ejecucion.empresa_id, admin)
      : null

  return {
    ...base,
    // Reemplazamos el `entidad: { tipo, id }` mínimo por el row completo,
    // pero preservamos `tipo` para que las plantillas puedan hacer
    // `{{entidad.tipo}}` igual que antes.
    entidad: entidadCompleta
      ? { tipo: tipoEntidad, ...entidadCompleta }
      : (base.entidad ?? null),
    contacto,
    actor: actorPerfil,
    empresa: empresaCompleta,
    ahora: new Date().toISOString(),
  }
}

// =============================================================
// Cargadores individuales
// =============================================================

async function cargarEntidad(
  tipo: EntidadConEstado,
  id: string,
  empresaId: string,
  admin: SupabaseClient,
): Promise<Record<string, unknown> | null> {
  const tabla = TABLA_PRINCIPAL_POR_ENTIDAD[tipo]
  if (!tabla) return null

  const { data, error } = await admin
    .from(tabla)
    .select('*')
    .eq('id', id)
    .eq('empresa_id', empresaId)
    .maybeSingle()

  if (error) {
    console.warn(
      JSON.stringify({
        nivel: 'warn',
        mensaje: 'enriquecer_contexto_error_carga_entidad',
        tipo,
        id,
        detalle: error.message,
      }),
    )
    return null
  }
  return data as Record<string, unknown> | null
}

async function cargarContacto(
  contactoId: string,
  empresaId: string,
  admin: SupabaseClient,
): Promise<Record<string, unknown> | null> {
  const { data, error } = await admin
    .from('contactos')
    .select('*')
    .eq('id', contactoId)
    .eq('empresa_id', empresaId)
    .maybeSingle()
  if (error) {
    console.warn(
      JSON.stringify({
        nivel: 'warn',
        mensaje: 'enriquecer_contexto_error_carga_contacto',
        contacto_id: contactoId,
        detalle: error.message,
      }),
    )
    return null
  }
  return data as Record<string, unknown> | null
}

async function cargarEmpresa(
  id: string,
  admin: SupabaseClient,
): Promise<Record<string, unknown> | null> {
  const { data, error } = await admin
    .from('empresas')
    .select('id, nombre, slug, pais, zona_horaria, moneda, formato_fecha, formato_hora, telefono, correo, pagina_web, datos_fiscales')
    .eq('id', id)
    .maybeSingle()
  if (error) {
    console.warn(
      JSON.stringify({
        nivel: 'warn',
        mensaje: 'enriquecer_contexto_error_carga_empresa',
        empresa_id: id,
        detalle: error.message,
      }),
    )
    return null
  }
  return data as Record<string, unknown> | null
}

async function cargarActorDesdeDisparadoPor(
  disparadoPor: string | null,
  empresaId: string,
  admin: SupabaseClient,
): Promise<Record<string, unknown> | null> {
  if (!disparadoPor) return null
  // disparado_por es text discriminado por prefijo. Solo `manual:<uuid>`
  // tiene un perfil de usuario asociable directamente.
  // Para cambios_estado:<uuid>, el actor real está en cambios_estado.usuario_id;
  // lo cargamos vía esa fila (más fiel — refleja quién hizo el cambio).
  if (disparadoPor.startsWith('manual:')) {
    const usuarioId = disparadoPor.slice('manual:'.length)
    return cargarPerfil(usuarioId, admin)
  }
  if (disparadoPor.startsWith('cambios_estado:')) {
    const cambiosEstadoId = disparadoPor.slice('cambios_estado:'.length)
    const { data: ce } = await admin
      .from('cambios_estado')
      .select('usuario_id, usuario_nombre, origen')
      .eq('id', cambiosEstadoId)
      .eq('empresa_id', empresaId)
      .maybeSingle()
    if (!ce?.usuario_id) {
      // El cambio fue del sistema/cron sin usuario. Devolvemos un actor
      // sintético con info disponible para que `{{actor.origen}}` resuelva.
      return ce
        ? {
            usuario_id: null,
            origen: ce.origen ?? null,
            nombre: ce.usuario_nombre ?? null,
          }
        : null
    }
    const perfil = await cargarPerfil(ce.usuario_id as string, admin)
    return perfil
      ? { ...perfil, origen: (ce.origen as string | null) ?? null }
      : { usuario_id: ce.usuario_id, nombre: ce.usuario_nombre, origen: ce.origen }
  }
  // cron:* / webhook:* → sin perfil de usuario.
  return null
}

async function cargarPerfil(
  usuarioId: string,
  admin: SupabaseClient,
): Promise<Record<string, unknown> | null> {
  const { data, error } = await admin
    .from('perfiles')
    .select('id, nombre, apellido, email, telefono, avatar_url')
    .eq('id', usuarioId)
    .maybeSingle()
  if (error) {
    console.warn(
      JSON.stringify({
        nivel: 'warn',
        mensaje: 'enriquecer_contexto_error_carga_perfil',
        usuario_id: usuarioId,
        detalle: error.message,
      }),
    )
    return null
  }
  if (!data) return null
  // Agregamos `nombre_completo` para conveniencia en plantillas.
  const r = data as Record<string, unknown>
  const nombre = typeof r.nombre === 'string' ? r.nombre : ''
  const apellido = typeof r.apellido === 'string' ? r.apellido : ''
  return {
    ...r,
    usuario_id: r.id,
    nombre_completo: `${nombre} ${apellido}`.trim() || null,
  }
}

// =============================================================
// Helpers de lectura del contexto base
// =============================================================

function leerTipoEntidad(base: ContextoVariables): EntidadConEstado | null {
  const ent = base.entidad as Record<string, unknown> | undefined
  const t = ent?.tipo
  if (typeof t !== 'string') return null
  return t as EntidadConEstado
}

function leerIdEntidad(base: ContextoVariables): string | null {
  const ent = base.entidad as Record<string, unknown> | undefined
  const id = ent?.id
  return typeof id === 'string' ? id : null
}
