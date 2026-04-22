import { resolverPermiso } from '@/lib/permisos-logica'
import type { Modulo, Accion, PermisosMapa } from '@/tipos/permisos'
import type { Rol } from '@/tipos/miembro'
import { crearClienteAdmin } from '@/lib/supabase/admin'
import { obtenerUsuarioRuta } from '@/lib/supabase/servidor'
import { NextResponse } from 'next/server'

/**
 * Verificación de permisos server-side para API routes.
 * Replica la lógica de useRol pero sin depender de hooks de React.
 * Se usa en: API routes que necesitan validar permisos por acción.
 */

interface DatosMiembro {
  rol: Rol
  permisos_custom: PermisosMapa | null
  /** Superadmin interno de Salix (solo soporte). Viene del JWT. */
  esSuperadmin?: boolean
}

/** Verifica si un rol+permisos tiene acceso a modulo+accion.
 * Thin wrapper de `resolverPermiso` que adapta la forma de DatosMiembro (snake_case). */
export function verificarPermiso(
  miembro: DatosMiembro,
  modulo: Modulo,
  accion: Accion
): boolean {
  return resolverPermiso({
    rol: miembro.rol,
    permisosCustom: miembro.permisos_custom,
    esPropietario: miembro.rol === 'propietario',
    esSuperadmin: miembro.esSuperadmin === true,
  }, modulo, accion)
}

/** Obtiene el miembro actual y verifica permiso en una sola llamada */
export async function obtenerYVerificarPermiso(
  usuarioId: string,
  empresaId: string,
  modulo: Modulo,
  accion: Accion
): Promise<{ permitido: boolean; miembro: DatosMiembro | null }> {
  const datos = await obtenerDatosMiembro(usuarioId, empresaId)
  if (!datos) return { permitido: false, miembro: null }
  return {
    permitido: verificarPermiso(datos, modulo, accion),
    miembro: datos,
  }
}

/**
 * Obtiene datos del miembro una sola vez para verificar múltiples permisos.
 * Evita hacer N queries a miembros cuando se necesitan verificar ver_todos + ver_propio.
 */
export async function obtenerDatosMiembro(
  usuarioId: string,
  empresaId: string
): Promise<DatosMiembro | null> {
  const admin = crearClienteAdmin()
  const { data: miembro } = await admin
    .from('miembros')
    .select('rol, permisos_custom')
    .eq('usuario_id', usuarioId)
    .eq('empresa_id', empresaId)
    .eq('activo', true)
    .single()

  if (!miembro) return null

  return {
    rol: miembro.rol as Rol,
    permisos_custom: miembro.permisos_custom as PermisosMapa | null,
  }
}

/**
 * Guard completo para API routes: autentica usuario y verifica permiso.
 *
 * Uso típico:
 * ```
 * const guard = await requerirPermisoAPI('asistencias', 'ver_todos')
 * if ('respuesta' in guard) return guard.respuesta
 * const { user, empresaId, miembro } = guard
 * ```
 *
 * Devuelve `{ respuesta }` con NextResponse 401/403 si falla, o `{ user, empresaId, miembro }` si pasa.
 * Se ahorra ~8 líneas por endpoint y homogeniza las respuestas de error.
 */
export async function requerirPermisoAPI(
  modulo: Modulo,
  accion: Accion,
): Promise<
  | { respuesta: NextResponse }
  | { user: { id: string; app_metadata?: { empresa_activa_id?: string; es_superadmin?: boolean } }; empresaId: string; miembro: DatosMiembro }
> {
  const { user } = await obtenerUsuarioRuta()
  if (!user) {
    return { respuesta: NextResponse.json({ error: 'No autenticado' }, { status: 401 }) }
  }

  const empresaId = user.app_metadata?.empresa_activa_id
  if (!empresaId) {
    return { respuesta: NextResponse.json({ error: 'Sin empresa activa' }, { status: 403 }) }
  }

  // Superadmin interno de Salix: bypass total, no requiere ser miembro de la empresa.
  // El claim `es_superadmin` lo controla el service role de Supabase (no el usuario).
  const esSuperadmin = user.app_metadata?.es_superadmin === true
  if (esSuperadmin) {
    const miembroVirtual: DatosMiembro = { rol: 'propietario', permisos_custom: null, esSuperadmin: true }
    return { user: user as { id: string; app_metadata?: { empresa_activa_id?: string; es_superadmin?: boolean } }, empresaId, miembro: miembroVirtual }
  }

  const { permitido, miembro } = await obtenerYVerificarPermiso(user.id, empresaId, modulo, accion)
  if (!permitido || !miembro) {
    return { respuesta: NextResponse.json({ error: 'Sin permiso' }, { status: 403 }) }
  }

  return { user: user as { id: string; app_metadata?: { empresa_activa_id?: string; es_superadmin?: boolean } }, empresaId, miembro }
}

/**
 * Guard ligero: autentica y verifica empresa activa, sin chequear permiso de módulo.
 *
 * Se usa en endpoints que forman parte del "shell" de la app y cualquier miembro
 * autenticado debe poder invocar (preferencias personales, catálogo de módulos
 * para filtrar sidebar, registro de push notifications, editar propio perfil).
 * NO reemplaza a `requerirPermisoAPI` para features sensibles.
 */
export async function requerirAutenticacionAPI(): Promise<
  | { respuesta: NextResponse }
  | { user: { id: string; app_metadata?: { empresa_activa_id?: string; es_superadmin?: boolean } }; empresaId: string }
> {
  const { user } = await obtenerUsuarioRuta()
  if (!user) {
    return { respuesta: NextResponse.json({ error: 'No autenticado' }, { status: 401 }) }
  }
  const empresaId = user.app_metadata?.empresa_activa_id
  if (!empresaId) {
    return { respuesta: NextResponse.json({ error: 'Sin empresa activa' }, { status: 403 }) }
  }
  return { user: user as { id: string; app_metadata?: { empresa_activa_id?: string; es_superadmin?: boolean } }, empresaId }
}

/**
 * Verifica permisos de visibilidad (ver_todos vs ver_propio) con una sola query a BD.
 * Retorna { verTodos, soloPropio, miembro } o null si no tiene ningún permiso.
 */
export async function verificarVisibilidad(
  usuarioId: string,
  empresaId: string,
  modulo: Modulo
): Promise<{ verTodos: boolean; soloPropio: boolean; miembro: DatosMiembro } | null> {
  const miembro = await obtenerDatosMiembro(usuarioId, empresaId)
  if (!miembro) return null

  const verTodos = verificarPermiso(miembro, modulo, 'ver_todos')
  if (verTodos) return { verTodos: true, soloPropio: false, miembro }

  const verPropio = verificarPermiso(miembro, modulo, 'ver_propio')
  if (verPropio) return { verTodos: false, soloPropio: true, miembro }

  return null
}
