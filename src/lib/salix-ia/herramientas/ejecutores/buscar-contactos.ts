/**
 * Ejecutor: buscar_contactos
 * Busca contactos por nombre, teléfono, email o empresa.
 * Respeta visibilidad ver_propio vs ver_todos.
 * Soporta búsqueda multi-palabra: "Nora Riquelme" busca nombre=Nora Y apellido=Riquelme.
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

  // Separar palabras para búsqueda inteligente
  const palabras = busqueda.split(/\s+/).filter(p => p.length >= 2)

  let query = ctx.admin
    .from('contactos')
    .select('id, nombre, apellido, correo, telefono, whatsapp, cargo, rubro, etiquetas, activo, es_provisorio')
    .eq('empresa_id', ctx.empresa_id)
    .eq('en_papelera', false)
    .order('actualizado_en', { ascending: false })
    .limit(limite)

  if (palabras.length >= 2) {
    // Multi-palabra: cada palabra debe aparecer en algún campo
    // Supabase no soporta AND de or(), así que hacemos filtros encadenados
    // Primera palabra en nombre o apellido
    query = query.or(`nombre.ilike.%${palabras[0]}%,apellido.ilike.%${palabras[0]}%,correo.ilike.%${palabras[0]}%,telefono.ilike.%${palabras[0]}%,whatsapp.ilike.%${palabras[0]}%,rubro.ilike.%${palabras[0]}%`)
  } else {
    // Una sola palabra: buscar en todos los campos
    query = query.or(`nombre.ilike.%${busqueda}%,apellido.ilike.%${busqueda}%,correo.ilike.%${busqueda}%,telefono.ilike.%${busqueda}%,whatsapp.ilike.%${busqueda}%,rubro.ilike.%${busqueda}%`)
  }

  // Si solo puede ver los propios, filtrar por creado_por
  if (visibilidad === 'propio') {
    query = query.eq('creado_por', ctx.usuario_id)
  }

  const { data, error } = await query

  if (error) {
    return { exito: false, error: `Error buscando contactos: ${error.message}` }
  }

  let contactos = (data || []).map((c: Record<string, unknown>) => ({
    id: c.id,
    nombre: [c.nombre, c.apellido].filter(Boolean).join(' '),
    correo: c.correo || null,
    telefono: c.telefono || null,
    whatsapp: c.whatsapp || null,
    cargo: c.cargo || null,
    empresa: c.rubro || null,
    activo: c.activo,
  }))

  // Post-filtro para multi-palabra: verificar que TODAS las palabras aparezcan
  if (palabras.length >= 2) {
    contactos = contactos.filter((c: { nombre: string; correo: string | null; empresa: string | null }) => {
      const textoCompleto = [c.nombre, c.correo, c.empresa].filter(Boolean).join(' ').toLowerCase()
      return palabras.every(p => textoCompleto.includes(p.toLowerCase()))
    })
  }

  return {
    exito: true,
    datos: contactos,
    mensaje_usuario: contactos.length === 0
      ? `No encontré contactos con "${busqueda}".`
      : `Encontré ${contactos.length} contacto(s).`,
  }
}
