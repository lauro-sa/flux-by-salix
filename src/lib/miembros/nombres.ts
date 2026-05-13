import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Combina nombre + apellido en un único string. Devuelve null si ambos vacíos.
 */
function unirNombre(
  fuente: { nombre?: string | null; apellido?: string | null } | null | undefined
): string | null {
  if (!fuente) return null
  const completo = `${fuente.nombre || ''} ${fuente.apellido || ''}`.trim()
  return completo || null
}

/**
 * Resuelve nombre de UN miembro siguiendo la misma preferencia:
 * perfil (cuenta Flux) → contacto equipo vinculado → "Sin nombre".
 *
 * Pensado para flujos puntuales (kiosco identificación, modales, paneles)
 * donde solo se necesita un miembro y traer todos los de la empresa sería
 * desperdicio. Mantiene paridad de comportamiento con `resolverNombresMiembros`.
 */
export async function resolverNombreMiembro(
  admin: SupabaseClient,
  args: { miembroId: string; usuarioId: string | null }
): Promise<string> {
  const { miembroId, usuarioId } = args

  const [perfilRes, contactoRes] = await Promise.all([
    usuarioId
      ? admin
          .from('perfiles')
          .select('nombre, apellido')
          .eq('id', usuarioId)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    admin
      .from('contactos')
      .select('nombre, apellido')
      .eq('miembro_id', miembroId)
      .eq('en_papelera', false)
      .maybeSingle(),
  ])

  return (
    unirNombre(perfilRes.data as { nombre?: string | null; apellido?: string | null } | null) ||
    unirNombre(contactoRes.data as { nombre?: string | null; apellido?: string | null } | null) ||
    'Sin nombre'
  )
}

/**
 * Resuelve nombre+apellido de miembros para listados/exports.
 * Con preferencia: perfil (cuenta Flux) → contacto equipo vinculado → "Sin nombre".
 *
 * Los empleados que solo fichan en kiosco (sin cuenta Flux) no tienen perfil
 * asociado, pero sí un contacto tipo equipo vinculado por `miembro_id`. Este
 * helper evita que aparezcan como "Sin nombre" en Asistencias, Nómina, etc.
 */
export async function resolverNombresMiembros(
  admin: SupabaseClient,
  empresaId: string
): Promise<Map<string, string>> {
  const { data: miembrosData } = await admin
    .from('miembros')
    .select('id, usuario_id')
    .eq('empresa_id', empresaId)

  const miembros = (miembrosData || []) as Array<{ id: string; usuario_id: string | null }>
  const miembroIds = miembros.map(m => m.id)
  const usuarioIds = miembros.map(m => m.usuario_id).filter((x): x is string => !!x)

  const [{ data: perfilesData }, { data: contactosData }] = await Promise.all([
    usuarioIds.length > 0
      ? admin.from('perfiles').select('id, nombre, apellido').in('id', usuarioIds)
      : Promise.resolve({ data: [] as Array<{ id: string; nombre: string | null; apellido: string | null }> }),
    miembroIds.length > 0
      ? admin.from('contactos').select('miembro_id, nombre, apellido').in('miembro_id', miembroIds).eq('en_papelera', false)
      : Promise.resolve({ data: [] as Array<{ miembro_id: string | null; nombre: string | null; apellido: string | null }> }),
  ])

  const perfilMap = new Map(
    (perfilesData || []).map(p => [p.id as string, p])
  )
  const contactoMap = new Map(
    (contactosData || [])
      .filter(c => c.miembro_id)
      .map(c => [c.miembro_id as string, c])
  )

  const nombres = new Map<string, string>()
  for (const m of miembros) {
    const perfil = m.usuario_id ? perfilMap.get(m.usuario_id) : undefined
    if (perfil && (perfil.nombre || perfil.apellido)) {
      nombres.set(m.id, `${perfil.nombre || ''} ${perfil.apellido || ''}`.trim())
      continue
    }
    const contacto = contactoMap.get(m.id)
    if (contacto && (contacto.nombre || contacto.apellido)) {
      nombres.set(m.id, `${contacto.nombre || ''} ${contacto.apellido || ''}`.trim())
      continue
    }
    nombres.set(m.id, 'Sin nombre')
  }
  return nombres
}
