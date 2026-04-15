/**
 * Ejecutor: modificar_nota
 * Modifica una nota rápida: cambiar título, contenido, fijar/desfijar, archivar o eliminar.
 * Puede buscar por título si no se tiene el ID.
 */

import type { ContextoSalixIA, ResultadoHerramienta } from '@/tipos/salix-ia'

export async function ejecutarModificarNota(
  ctx: ContextoSalixIA,
  params: Record<string, unknown>
): Promise<ResultadoHerramienta> {
  let nota_id = params.nota_id as string | undefined
  const busqueda = (params.busqueda as string)?.trim()

  // Si no hay ID, buscar por título
  if (!nota_id && busqueda) {
    // Buscar en propias
    const { data: propias } = await ctx.admin
      .from('notas_rapidas')
      .select('id, titulo, contenido')
      .eq('empresa_id', ctx.empresa_id)
      .eq('creador_id', ctx.usuario_id)
      .eq('archivada', false)
      .ilike('titulo', `%${busqueda}%`)
      .limit(5)

    // Buscar en compartidas conmigo — queries separadas para evitar joins inestables
    const { data: relaciones } = await ctx.admin
      .from('notas_rapidas_compartidas')
      .select('nota_id, puede_editar')
      .eq('usuario_id', ctx.usuario_id)
      .eq('puede_editar', true)

    let notasCompartidas: Array<{ id: string; titulo: string; contenido: string }> = []
    const notaIdsEditables = (relaciones || []).map((r: { nota_id: string }) => r.nota_id)

    if (notaIdsEditables.length > 0) {
      const { data: notasComp } = await ctx.admin
        .from('notas_rapidas')
        .select('id, titulo, contenido')
        .in('id', notaIdsEditables)
        .eq('archivada', false)
        .ilike('titulo', `%${busqueda}%`)

      notasCompartidas = (notasComp || []).map((n: { id: string; titulo: string; contenido: string }) => ({
        id: n.id,
        titulo: n.titulo || '',
        contenido: n.contenido || '',
      }))
    }

    const todas = [...(propias || []), ...notasCompartidas]

    if (todas.length === 0) {
      return { exito: false, error: `No encontré una nota con "${busqueda}". ¿Podrías darme más detalles?` }
    }
    if (todas.length > 1) {
      const opciones = todas.map((n: { titulo: string; contenido: string }) =>
        `• ${n.titulo || 'Sin título'}: ${n.contenido.slice(0, 50)}...`
      ).join('\n')
      return { exito: false, error: `Encontré ${todas.length} notas:\n${opciones}\n¿Cuál querés modificar?` }
    }

    nota_id = todas[0].id
  }

  if (!nota_id) {
    return { exito: false, error: 'Se requiere nota_id o busqueda para encontrar la nota' }
  }

  // Verificar que la nota existe y el usuario tiene acceso
  const { data: nota } = await ctx.admin
    .from('notas_rapidas')
    .select('id, titulo, contenido, creador_id, archivada')
    .eq('id', nota_id)
    .eq('empresa_id', ctx.empresa_id)
    .single()

  if (!nota) {
    return { exito: false, error: 'Nota no encontrada' }
  }

  // Verificar permisos: es el creador o tiene permiso de edición
  const esPropietario = nota.creador_id === ctx.usuario_id
  if (!esPropietario) {
    const { data: compartida } = await ctx.admin
      .from('notas_rapidas_compartidas')
      .select('puede_editar')
      .eq('nota_id', nota_id)
      .eq('usuario_id', ctx.usuario_id)
      .single()

    if (!compartida?.puede_editar) {
      return { exito: false, error: 'No tenés permiso para editar esta nota' }
    }
  }

  // Eliminar (archivar)
  if (params.eliminar === true) {
    const { error: errorEliminar } = await ctx.admin
      .from('notas_rapidas')
      .update({ archivada: true, actualizado_en: new Date().toISOString(), actualizado_por: ctx.usuario_id })
      .eq('id', nota_id)

    if (errorEliminar) {
      return { exito: false, error: `Error eliminando nota: ${errorEliminar.message}` }
    }

    return {
      exito: true,
      datos: { id: nota_id },
      mensaje_usuario: `Nota "${nota.titulo || 'Sin título'}" eliminada.`,
    }
  }

  // Preparar cambios
  const cambios: Record<string, unknown> = {}
  const descripcionCambios: string[] = []

  if (params.titulo !== undefined) {
    cambios.titulo = (params.titulo as string).trim()
    descripcionCambios.push('título actualizado')
  }

  if (params.contenido !== undefined) {
    cambios.contenido = (params.contenido as string).trim()
    descripcionCambios.push('contenido actualizado')
  }

  if (params.fijada !== undefined) {
    cambios.fijada = params.fijada as boolean
    descripcionCambios.push(params.fijada ? 'fijada' : 'desfijada')
  }

  if (Object.keys(cambios).length === 0) {
    return { exito: false, error: 'No se indicaron cambios. Podés cambiar título, contenido, fijar/desfijar o eliminar.' }
  }

  cambios.actualizado_en = new Date().toISOString()
  cambios.actualizado_por = ctx.usuario_id

  const { error } = await ctx.admin
    .from('notas_rapidas')
    .update(cambios)
    .eq('id', nota_id)

  if (error) {
    return { exito: false, error: `Error modificando nota: ${error.message}` }
  }

  return {
    exito: true,
    datos: { id: nota_id, cambios: descripcionCambios },
    mensaje_usuario: `Nota "${nota.titulo || 'Sin título'}" actualizada: ${descripcionCambios.join(', ')}.`,
  }
}
