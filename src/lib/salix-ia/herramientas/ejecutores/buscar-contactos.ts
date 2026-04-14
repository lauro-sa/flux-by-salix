/**
 * Ejecutor: buscar_contactos
 * Busca contactos por nombre, teléfono, email o empresa.
 * Respeta visibilidad ver_propio vs ver_todos.
 */

import type { ContextoSalixIA, ResultadoHerramienta } from '@/tipos/salix-ia'
import { determinarVisibilidad } from '@/lib/salix-ia/permisos'

export async function ejecutarBuscarContactos(
  ctx: ContextoSalixIA,
  params: Record<string, unknown>
): Promise<ResultadoHerramienta> {
  const busqueda = (params.busqueda as string)?.trim()
  if (!busqueda) {
    return { exito: false, error: 'Se requiere un texto de búsqueda' }
  }

  const limite = Math.min((params.limite as number) || 10, 50)
  const visibilidad = determinarVisibilidad(ctx.miembro, 'contactos')

  if (!visibilidad) {
    return { exito: false, error: 'No tenés permiso para ver contactos' }
  }

  let query = ctx.admin
    .from('contactos')
    .select('id, nombre, apellido, correo, telefono, whatsapp, cargo, rubro, etiquetas, activo, es_provisorio')
    .eq('empresa_id', ctx.empresa_id)
    .eq('en_papelera', false)
    .or(`nombre.ilike.%${busqueda}%,apellido.ilike.%${busqueda}%,correo.ilike.%${busqueda}%,telefono.ilike.%${busqueda}%,whatsapp.ilike.%${busqueda}%,rubro.ilike.%${busqueda}%`)
    .order('actualizado_en', { ascending: false })
    .limit(limite)

  // Si solo puede ver los propios, filtrar por creado_por o responsable
  if (visibilidad === 'propio') {
    query = query.eq('creado_por', ctx.usuario_id)
  }

  const { data, error } = await query

  if (error) {
    return { exito: false, error: `Error buscando contactos: ${error.message}` }
  }

  const contactos = (data || []).map((c: Record<string, unknown>) => ({
    id: c.id,
    nombre: [c.nombre, c.apellido].filter(Boolean).join(' '),
    correo: c.correo || null,
    telefono: c.telefono || null,
    whatsapp: c.whatsapp || null,
    cargo: c.cargo || null,
    empresa: c.rubro || null,
    activo: c.activo,
  }))

  return {
    exito: true,
    datos: contactos,
    mensaje_usuario: contactos.length === 0
      ? `No encontré contactos con "${busqueda}".`
      : `Encontré ${contactos.length} contacto(s).`,
  }
}
