/**
 * Ejecutor: consultar_notas
 * Consulta las notas rápidas del usuario (propias y compartidas).
 */

import type { ContextoSalixIA, ResultadoHerramienta } from '@/tipos/salix-ia'
import { htmlATextoPlano } from '@/lib/notas/html'

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

  // Notas compartidas conmigo — queries separadas para evitar joins inestables
  let compartidas: Array<{ id: string; titulo: string; contenido: string; actualizado_en: string }> = []
  if (tipo === 'todas' || tipo === 'compartidas') {
    const { data: relaciones } = await ctx.admin
      .from('notas_rapidas_compartidas')
      .select('nota_id')
      .eq('usuario_id', ctx.usuario_id)

    if (relaciones && relaciones.length > 0) {
      const notaIds = relaciones.map((r: { nota_id: string }) => r.nota_id)

      let queryComp = ctx.admin
        .from('notas_rapidas')
        .select('id, titulo, contenido, actualizado_en')
        .in('id', notaIds)
        .eq('archivada', false)

      if (busqueda) {
        queryComp = queryComp.or(`titulo.ilike.%${busqueda}%,contenido.ilike.%${busqueda}%`)
      }

      const { data: notasComp } = await queryComp

      compartidas = (notasComp || []).map((n: { id: string; titulo: string; contenido: string; actualizado_en: string }) => ({
        id: n.id,
        titulo: n.titulo || '',
        contenido: n.contenido || '',
        actualizado_en: n.actualizado_en,
      }))
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

  // Formatear resumen — el contenido en BD es HTML de Tiptap, así que
  // lo convertimos a texto plano antes de mostrarlo por WhatsApp. Los
  // ítems de checklist se marcan con [ ] / [x] dentro de htmlATextoPlano.
  const lineas: string[] = []

  if (propias.length > 0) {
    lineas.push(`*Tus notas (${propias.length}):*`)
    for (const n of propias) {
      const planoLargo = htmlATextoPlano(n.contenido)
      const preview = planoLargo.slice(0, 80).replace(/\n/g, ' ')
      const pin = n.fijada ? '📌 ' : ''
      lineas.push(`${pin}• ${n.titulo || 'Sin título'}: ${preview}${planoLargo.length > 80 ? '...' : ''}`)
    }
  }

  if (compartidas.length > 0) {
    if (lineas.length > 0) lineas.push('')
    lineas.push(`*Compartidas conmigo (${compartidas.length}):*`)
    for (const n of compartidas) {
      const planoLargo = htmlATextoPlano(n.contenido)
      const preview = planoLargo.slice(0, 80).replace(/\n/g, ' ')
      lineas.push(`• ${n.titulo || 'Sin título'}: ${preview}${planoLargo.length > 80 ? '...' : ''}`)
    }
  }

  // Devolvemos también la versión texto plano del contenido en `datos`
  // para que el LLM (próximo paso del agente) razone sobre el texto
  // legible y no sobre HTML con tags.
  const propiasTexto = propias.map((n) => ({ ...n, contenido: htmlATextoPlano(n.contenido) }))
  const compartidasTexto = compartidas.map((n) => ({ ...n, contenido: htmlATextoPlano(n.contenido) }))

  return {
    exito: true,
    datos: { propias: propiasTexto, compartidas: compartidasTexto },
    mensaje_usuario: lineas.join('\n'),
  }
}
