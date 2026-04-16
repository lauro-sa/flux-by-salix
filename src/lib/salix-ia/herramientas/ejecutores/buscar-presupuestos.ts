/**
 * Ejecutor: buscar_presupuestos
 * Busca presupuestos por número, nombre de contacto o dirección.
 * Respeta visibilidad ver_propio vs ver_todos.
 */

import type { ContextoSalixIA, ResultadoHerramienta } from '@/tipos/salix-ia'
import { determinarVisibilidad } from '@/lib/salix-ia/permisos'

export async function ejecutarBuscarPresupuestos(
  ctx: ContextoSalixIA,
  params: Record<string, unknown>
): Promise<ResultadoHerramienta> {
  const busqueda = (params.busqueda as string)?.trim()

  const visibilidad = determinarVisibilidad(ctx.miembro, 'presupuestos')
  if (!visibilidad) {
    return { exito: false, error: 'No tenés permiso para ver presupuestos' }
  }

  const limite = Math.min((params.limite as number) || 10, 30)

  let query = ctx.admin
    .from('presupuestos')
    .select('id, numero, estado, contacto_id, contacto_nombre, contacto_apellido, contacto_direccion, total_final, moneda, fecha_emision, fecha_vencimiento, referencia, creado_por_nombre')
    .eq('empresa_id', ctx.empresa_id)
    .eq('en_papelera', false)
    .order('creado_en', { ascending: false })
    .limit(limite)

  // Búsqueda por texto (ahora opcional)
  if (busqueda) {
    query = query.or(`numero.ilike.%${busqueda}%,contacto_nombre.ilike.%${busqueda}%,contacto_apellido.ilike.%${busqueda}%,contacto_direccion.ilike.%${busqueda}%,referencia.ilike.%${busqueda}%`)
  }

  // Si solo puede ver los propios, filtrar por creado_por
  if (visibilidad === 'propio') {
    query = query.eq('creado_por', ctx.usuario_id)
  }

  // Filtrar por estado si se indica
  if (params.estado && params.estado !== 'todos') {
    query = query.eq('estado', params.estado)
  }

  const { data, error } = await query

  if (error) {
    return { exito: false, error: `Error buscando presupuestos: ${error.message}` }
  }

  const presupuestos = (data || []).map((p: Record<string, unknown>) => ({
    id: p.id,
    numero: p.numero,
    estado: p.estado,
    contacto: [p.contacto_nombre, p.contacto_apellido].filter(Boolean).join(' '),
    contacto_id: p.contacto_id,
    direccion: p.contacto_direccion || null,
    total: p.total_final,
    moneda: p.moneda,
    fecha_emision: p.fecha_emision,
    fecha_vencimiento: p.fecha_vencimiento || null,
    referencia: p.referencia || null,
    creado_por: p.creado_por_nombre || null,
  }))

  return {
    exito: true,
    datos: presupuestos,
    mensaje_usuario: presupuestos.length === 0
      ? `No encontré presupuestos con "${busqueda}".`
      : `Encontré ${presupuestos.length} presupuesto(s).`,
  }
}
