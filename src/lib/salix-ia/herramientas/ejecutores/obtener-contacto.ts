/**
 * Ejecutor: obtener_contacto
 * Obtiene datos completos de un contacto por ID.
 */

import type { ContextoSalixIA, ResultadoHerramienta } from '@/tipos/salix-ia'

export async function ejecutarObtenerContacto(
  ctx: ContextoSalixIA,
  params: Record<string, unknown>
): Promise<ResultadoHerramienta> {
  const contacto_id = params.contacto_id as string
  if (!contacto_id) {
    return { exito: false, error: 'Se requiere el ID del contacto' }
  }

  const { data, error } = await ctx.admin
    .from('contactos')
    .select(`
      id, nombre, apellido, correo, telefono, whatsapp, cargo, rubro,
      etiquetas, notas, activo, es_provisorio, origen,
      tipo_identificacion, numero_identificacion,
      creado_en, actualizado_en
    `)
    .eq('id', contacto_id)
    .eq('empresa_id', ctx.empresa_id)
    .eq('en_papelera', false)
    .single()

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
