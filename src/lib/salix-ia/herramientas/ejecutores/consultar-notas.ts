/**
 * Ejecutor: consultar_notas
 * Consulta las notas rápidas del usuario (propias y compartidas).
 */

import type { ContextoSalixIA, ResultadoHerramienta } from '@/tipos/salix-ia'

export async function ejecutarConsultarNotas(
  ctx: ContextoSalixIA,
  params: Record<string, unknown>
): Promise<ResultadoHerramienta> {
  const tipo = (params.tipo as string) || 'todas' // todas, propias, compartidas
  const busqueda = (params.busqueda as string)?.trim()

  // Notas propias
  let propias: Array<{ id: string; titulo: string; contenido: string; fijada: boolean; actualizado_en: string }> = []
  if (tipo === 'todas' || tipo === 'propias') {
    let query = ctx.admin
      .from('notas_rapidas')
      .select('id, titulo, contenido, fijada, actualizado_en')
      .eq('empresa_id', ctx.empresa_id)
      .eq('creador_id', ctx.usuario_id)
      .eq('archivada', false)
      .order('fijada', { ascending: false })
      .order('actualizado_en', { ascending: false })
      .limit(20)

    if (busqueda) {
      query = query.or(`titulo.ilike.%${busqueda}%,contenido.ilike.%${busqueda}%`)
    }

    const { data } = await query
    propias = data ?? []
  }

  // Notas compartidas conmigo
  let compartidas: Array<{ id: string; titulo: string; contenido: string; actualizado_en: string }> = []
  if (tipo === 'todas' || tipo === 'compartidas') {
    const { data: compartidas_raw } = await ctx.admin
      .from('notas_rapidas_compartidas')
      .select('nota:notas_rapidas(id, titulo, contenido, actualizado_en)')
      .eq('usuario_id', ctx.usuario_id)

    if (compartidas_raw) {
      compartidas = compartidas_raw
        .filter((c: { nota: unknown }) => c.nota && typeof c.nota === 'object')
        .map((c: { nota: { id: string; titulo: string; contenido: string; actualizado_en: string } }) => ({
          ...c.nota,
          titulo: c.nota.titulo || '',
          contenido: c.nota.contenido || '',
        }))

      if (busqueda) {
        const b = busqueda.toLowerCase()
        compartidas = compartidas.filter(
          (n) => (n.titulo || '').toLowerCase().includes(b) || (n.contenido || '').toLowerCase().includes(b)
        )
      }
    }
  }

  const total = propias.length + compartidas.length
  if (total === 0) {
    return {
      exito: true,
      datos: { propias: [], compartidas: [] },
      mensaje_usuario: busqueda
        ? `No encontré notas que contengan "${busqueda}".`
        : 'No tenés notas todavía. Podés pedirme que te anote algo.',
    }
  }

  // Formatear resumen
  const lineas: string[] = []

  if (propias.length > 0) {
    lineas.push(`*Tus notas (${propias.length}):*`)
    for (const n of propias) {
      const preview = n.contenido.slice(0, 80).replace(/\n/g, ' ')
      const pin = n.fijada ? '📌 ' : ''
      lineas.push(`${pin}• ${n.titulo || 'Sin título'}: ${preview}${n.contenido.length > 80 ? '...' : ''}`)
    }
  }

  if (compartidas.length > 0) {
    if (lineas.length > 0) lineas.push('')
    lineas.push(`*Compartidas conmigo (${compartidas.length}):*`)
    for (const n of compartidas) {
      const preview = n.contenido.slice(0, 80).replace(/\n/g, ' ')
      lineas.push(`• ${n.titulo || 'Sin título'}: ${preview}${n.contenido.length > 80 ? '...' : ''}`)
    }
  }

  return {
    exito: true,
    datos: { propias, compartidas },
    mensaje_usuario: lineas.join('\n'),
  }
}
