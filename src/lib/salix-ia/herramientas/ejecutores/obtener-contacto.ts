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
    .select('id, tipo, calle, barrio, ciudad, provincia, codigo_postal, pais, texto, lat, lng, es_principal, total_visitas, ultima_visita')
    .eq('contacto_id', contacto_id)

  // Obtener tipo de contacto
  const { data: tipoContacto } = data.tipo_contacto_id ? await ctx.admin
    .from('tipos_contacto')
    .select('clave, etiqueta')
    .eq('id', data.tipo_contacto_id as string)
    .single() : { data: null }

  // Contar visitas del contacto
  const { count: totalVisitas } = await ctx.admin
    .from('visitas')
    .select('id', { count: 'exact', head: true })
    .eq('contacto_id', contacto_id)
    .eq('empresa_id', ctx.empresa_id)
    .eq('en_papelera', false)

  // Contar presupuestos del contacto
  const { count: totalPresupuestos } = await ctx.admin
    .from('presupuestos')
    .select('id', { count: 'exact', head: true })
    .eq('contacto_id', contacto_id)
    .eq('empresa_id', ctx.empresa_id)
    .eq('en_papelera', false)

  // Últimas visitas
  const { data: ultimasVisitas } = await ctx.admin
    .from('visitas')
    .select('id, fecha_programada, fecha_completada, estado, motivo, direccion_texto')
    .eq('contacto_id', contacto_id)
    .eq('empresa_id', ctx.empresa_id)
    .eq('en_papelera', false)
    .order('fecha_programada', { ascending: false })
    .limit(5)

  // Últimos presupuestos
  const { data: ultimosPresupuestos } = await ctx.admin
    .from('presupuestos')
    .select('id, numero, estado, total_final, moneda, fecha_emision')
    .eq('contacto_id', contacto_id)
    .eq('empresa_id', ctx.empresa_id)
    .eq('en_papelera', false)
    .order('creado_en', { ascending: false })
    .limit(5)

  return {
    exito: true,
    datos: {
      ...data,
      nombre_completo: [data.nombre, data.apellido].filter(Boolean).join(' '),
      tipo_contacto: tipoContacto?.etiqueta || null,
      tipo_contacto_clave: tipoContacto?.clave || null,
      direcciones: (direcciones || []).map((d: Record<string, unknown>) => ({
        ...d,
        tiene_visitas: (d.total_visitas as number) > 0,
      })),
      total_visitas: totalVisitas || 0,
      total_presupuestos: totalPresupuestos || 0,
      ultimas_visitas: ultimasVisitas || [],
      ultimos_presupuestos: ultimosPresupuestos || [],
    },
  }
}
