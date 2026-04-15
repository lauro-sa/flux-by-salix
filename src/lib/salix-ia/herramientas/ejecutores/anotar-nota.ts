/**
 * Ejecutor: anotar_nota
 * Crea o actualiza una nota rápida del usuario.
 * Puede ser personal o compartida con otro miembro del equipo.
 */

import type { ContextoSalixIA, ResultadoHerramienta } from '@/tipos/salix-ia'

export async function ejecutarAnotarNota(
  ctx: ContextoSalixIA,
  params: Record<string, unknown>
): Promise<ResultadoHerramienta> {
  const contenido = (params.contenido as string)?.trim()
  const titulo = (params.titulo as string)?.trim() || ''
  const compartir_con_nombre = (params.compartir_con as string)?.trim()
  const nota_id = params.nota_id as string | undefined

  if (!contenido) {
    return { exito: false, error: 'Se requiere contenido para la nota' }
  }

  // Si se pide compartir, buscar al usuario por nombre
  let compartir_usuario_id: string | null = null
  let compartir_nombre_completo = ''

  if (compartir_con_nombre) {
    // Queries separadas — los joins con perfiles son inestables en Supabase
    const { data: miembros } = await ctx.admin
      .from('miembros')
      .select('id, usuario_id')
      .eq('empresa_id', ctx.empresa_id)
      .eq('activo', true)

    if (miembros && miembros.length > 0) {
      const usuarioIds = miembros.map((m: { usuario_id: string }) => m.usuario_id)
      const { data: perfiles } = await ctx.admin
        .from('perfiles')
        .select('id, nombre, apellido')
        .in('id', usuarioIds)

      const busqueda = compartir_con_nombre.toLowerCase()
      const perfilEncontrado = (perfiles || []).find((p: { nombre: string; apellido: string }) => {
        const nombre = `${p.nombre} ${p.apellido || ''}`.toLowerCase()
        return nombre.includes(busqueda) || p.nombre.toLowerCase().includes(busqueda)
      })

      if (perfilEncontrado) {
        compartir_usuario_id = perfilEncontrado.id
        compartir_nombre_completo = `${perfilEncontrado.nombre} ${perfilEncontrado.apellido || ''}`.trim()
      } else {
        return {
          exito: false,
          error: `No encontré a "${compartir_con_nombre}" en el equipo. ¿Podrías darme el nombre completo?`,
        }
      }
    }
  }

  // Si hay nota_id, actualizar nota existente (agregar contenido)
  if (nota_id) {
    const { data: notaExistente } = await ctx.admin
      .from('notas_rapidas')
      .select('id, titulo, contenido')
      .eq('id', nota_id)
      .eq('empresa_id', ctx.empresa_id)
      .single()

    if (!notaExistente) {
      return { exito: false, error: 'No encontré esa nota' }
    }

    const nuevoContenido = notaExistente.contenido
      ? `${notaExistente.contenido}\n${contenido}`
      : contenido

    const { error } = await ctx.admin
      .from('notas_rapidas')
      .update({
        contenido: nuevoContenido,
        actualizado_en: new Date().toISOString(),
        actualizado_por: ctx.usuario_id,
      })
      .eq('id', nota_id)

    if (error) {
      return { exito: false, error: `Error al actualizar nota: ${error.message}` }
    }

    return {
      exito: true,
      datos: { id: nota_id },
      mensaje_usuario: `Nota "${notaExistente.titulo || 'Sin título'}" actualizada con el nuevo contenido.`,
    }
  }

  // Crear nota nueva
  const { data: nota, error: errorNota } = await ctx.admin
    .from('notas_rapidas')
    .insert({
      empresa_id: ctx.empresa_id,
      creador_id: ctx.usuario_id,
      titulo,
      contenido,
      color: 'amarillo',
      actualizado_por: ctx.usuario_id,
    })
    .select('id, titulo')
    .single()

  if (errorNota || !nota) {
    return { exito: false, error: `Error al crear nota: ${errorNota?.message}` }
  }

  // Compartir si se encontró el usuario
  if (compartir_usuario_id) {
    const { error: errorCompartir } = await ctx.admin
      .from('notas_rapidas_compartidas')
      .insert({
        nota_id: nota.id,
        usuario_id: compartir_usuario_id,
        puede_editar: true,
      })

    if (errorCompartir) {
      return {
        exito: true,
        datos: nota,
        mensaje_usuario: `Nota creada pero no se pudo compartir con ${compartir_nombre_completo}: ${errorCompartir.message}`,
      }
    }
  }

  let mensaje = `Nota creada`
  if (titulo) mensaje += ` "${titulo}"`
  if (compartir_usuario_id) {
    mensaje += ` y compartida con ${compartir_nombre_completo}`
  }
  mensaje += '.'

  return {
    exito: true,
    datos: nota,
    mensaje_usuario: mensaje,
  }
}
