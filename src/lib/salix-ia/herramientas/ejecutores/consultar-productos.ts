/**
 * Ejecutor: consultar_productos
 * Consulta el catálogo de productos y servicios: búsqueda, precios, categorías.
 * Respeta visibilidad (módulo presupuestos como proxy).
 */

import type { ContextoSalixIA, ResultadoHerramienta } from '@/tipos/salix-ia'

export async function ejecutarConsultarProductos(
  ctx: ContextoSalixIA,
  params: Record<string, unknown>
): Promise<ResultadoHerramienta> {
  const busqueda = (params.busqueda as string)?.trim()
  const tipo = params.tipo as string | undefined // 'producto' | 'servicio'
  const categoria = (params.categoria as string)?.trim()
  const limite = Math.min((params.limite as number) || 20, 50)

  let query = ctx.admin
    .from('productos')
    .select('id, codigo, nombre, tipo, categoria, precio_unitario, costo, moneda, unidad, descripcion, descripcion_venta, puede_venderse, puede_comprarse, favorito, activo, veces_presupuestado, veces_vendido')
    .eq('empresa_id', ctx.empresa_id)
    .eq('en_papelera', false)
    .eq('activo', true)
    .order('nombre', { ascending: true })
    .limit(limite)

  // Búsqueda por texto
  if (busqueda) {
    query = query.or(`nombre.ilike.%${busqueda}%,codigo.ilike.%${busqueda}%,descripcion.ilike.%${busqueda}%,categoria.ilike.%${busqueda}%`)
  }

  // Filtrar por tipo
  if (tipo) {
    query = query.eq('tipo', tipo)
  }

  // Filtrar por categoría
  if (categoria) {
    query = query.ilike('categoria', `%${categoria}%`)
  }

  // Filtrar favoritos
  if (params.solo_favoritos === true) {
    query = query.eq('favorito', true)
  }

  const { data, error } = await query

  if (error) {
    return { exito: false, error: `Error consultando productos: ${error.message}` }
  }

  const productos = (data || []).map((p: Record<string, unknown>) => ({
    id: p.id,
    codigo: p.codigo,
    nombre: p.nombre,
    tipo: p.tipo,
    categoria: p.categoria || null,
    precio: p.precio_unitario ? Number(p.precio_unitario) : null,
    costo: p.costo ? Number(p.costo) : null,
    moneda: p.moneda || 'ARS',
    unidad: p.unidad,
    descripcion: p.descripcion || null,
    puede_venderse: p.puede_venderse,
    puede_comprarse: p.puede_comprarse,
    favorito: p.favorito,
    veces_presupuestado: p.veces_presupuestado,
    veces_vendido: p.veces_vendido,
  }))

  // Formatear mensaje
  if (productos.length === 0) {
    return {
      exito: true,
      datos: [],
      mensaje_usuario: busqueda
        ? `No encontré productos con "${busqueda}".`
        : 'No hay productos activos en el catálogo.',
    }
  }

  const lineas: string[] = [`*Productos (${productos.length}):*`, '']
  for (const p of productos) {
    const prod = p as { nombre: string; codigo: string; tipo: string; precio: number | null; moneda: string; unidad: string; categoria: string | null; favorito: boolean }
    const icono = prod.tipo === 'servicio' ? '🔧' : '📦'
    const fav = prod.favorito ? '⭐ ' : ''
    let linea = `${fav}${icono} *${prod.nombre}* (${prod.codigo})`
    if (prod.precio !== null) {
      linea += ` — $${prod.precio.toLocaleString('es')} ${prod.moneda}/${prod.unidad}`
    }
    if (prod.categoria) linea += ` · _${prod.categoria}_`
    lineas.push(linea)
  }

  return {
    exito: true,
    datos: productos,
    mensaje_usuario: lineas.join('\n'),
  }
}
