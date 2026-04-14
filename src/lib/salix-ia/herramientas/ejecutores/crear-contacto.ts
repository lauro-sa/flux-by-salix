/**
 * Ejecutor: crear_contacto
 * Crea un nuevo contacto en el sistema.
 */

import type { ContextoSalixIA, ResultadoHerramienta } from '@/tipos/salix-ia'

export async function ejecutarCrearContacto(
  ctx: ContextoSalixIA,
  params: Record<string, unknown>
): Promise<ResultadoHerramienta> {
  const nombre = (params.nombre as string)?.trim()
  if (!nombre) {
    return { exito: false, error: 'Se requiere al menos el nombre del contacto' }
  }

  // Buscar tipo_contacto por defecto (Persona o Lead)
  const { data: tipos } = await ctx.admin
    .from('tipos_contacto')
    .select('id, clave')
    .eq('empresa_id', ctx.empresa_id)
    .in('clave', ['persona', 'lead'])
    .limit(2)

  const tipoDefault = tipos?.find((t: { clave: string }) => t.clave === 'persona')
    || tipos?.[0]

  if (!tipoDefault) {
    return { exito: false, error: 'No se encontró un tipo de contacto configurado en la empresa' }
  }

  // Obtener nombre del creador
  const { data: perfil } = await ctx.admin
    .from('perfiles')
    .select('nombre, apellido')
    .eq('id', ctx.usuario_id)
    .single()

  const nombreCreador = perfil
    ? [perfil.nombre, perfil.apellido].filter(Boolean).join(' ')
    : 'Salix IA'

  const { data, error } = await ctx.admin
    .from('contactos')
    .insert({
      empresa_id: ctx.empresa_id,
      nombre,
      apellido: (params.apellido as string)?.trim() || '',
      telefono: (params.telefono as string)?.trim() || null,
      whatsapp: (params.whatsapp as string)?.trim() || (params.telefono as string)?.trim() || null,
      correo: (params.correo as string)?.trim()?.toLowerCase() || null,
      rubro: (params.empresa as string)?.trim() || null,
      cargo: (params.cargo as string)?.trim() || null,
      notas: (params.notas as string)?.trim() || null,
      tipo_contacto_id: tipoDefault.id,
      origen: 'salix_ia',
      creado_por: ctx.usuario_id,
      creado_por_nombre: nombreCreador,
      activo: true,
      es_provisorio: false,
    })
    .select('id, nombre, apellido')
    .single()

  if (error) {
    return { exito: false, error: `Error creando contacto: ${error.message}` }
  }

  return {
    exito: true,
    datos: data,
    mensaje_usuario: `Contacto "${nombre}${params.apellido ? ' ' + params.apellido : ''}" creado correctamente.`,
  }
}
