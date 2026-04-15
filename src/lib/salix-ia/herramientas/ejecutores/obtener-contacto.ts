/**
 * Ejecutor: obtener_contacto
 * Obtiene datos completos de un contacto por ID.
 */

import type { ContextoSalixIA, ResultadoHerramienta } from '@/tipos/salix-ia'
import { determinarVisibilidad } from '@/lib/salix-ia/permisos'

export async function ejecutarObtenerContacto(
  ctx: ContextoSalixIA,
  params: Record<string, unknown>
): Promise<ResultadoHerramienta> {
  const contacto_id = params.contacto_id as string
  if (!contacto_id) {
    return { exito: false, error: 'Se requiere el ID del contacto' }
  }

  // Verificar visibilidad del usuario
  const visibilidad = determinarVisibilidad(ctx.miembro, 'contactos')
  if (!visibilidad) {
    return { exito: false, error: 'No tenés permiso para ver contactos' }
  }

  let query = ctx.admin
    .from('contactos')
    .select(`
      id, nombre, apellido, correo, telefono, whatsapp, cargo, rubro,
      etiquetas, notas, activo, es_provisorio, origen,
      tipo_identificacion, numero_identificacion,
      creado_por, creado_en, actualizado_en
    `)
    .eq('id', contacto_id)
    .eq('empresa_id', ctx.empresa_id)
    .eq('en_papelera', false)

  // Si solo puede ver los propios, filtrar por creado_por
  if (visibilidad === 'propio') {
    query = query.eq('creado_por', ctx.usuario_id)
  }

  const { data, error } = await query.single()

  if (error || !data) {
    return { exito: false, error: 'Contacto no encontrado' }
  }

  // Obtener direcciones del contacto
  const { data: direcciones } = await ctx.admin
    .from('contacto_direcciones')
    .select('tipo, direccion, localidad, provincia, pais, codigo_postal')
    .eq('contacto_id', contacto_id)

  return {
    exito: true,
    datos: {
      ...data,
      nombre_completo: [data.nombre, data.apellido].filter(Boolean).join(' '),
      direcciones: direcciones || [],
    },
  }
}
