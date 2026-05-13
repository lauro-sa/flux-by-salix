/**
 * Ejecutor: vincular_contactos
 * Crea o elimina una vinculación entre dos contactos existentes.
 *
 * Las vinculaciones son UNIDIRECCIONALES: el `contacto_id` es el dueño
 * (típicamente el contenedor: edificio, empresa) y `vinculado_id` es el hijo
 * (la persona, el contacto subordinado). Solo se inserta UNA fila.
 *
 * Para crear contacto + vincular en un solo paso, usar `crear_contacto`
 * con el parámetro `vincular_a_contacto_id`.
 */

import type { ContextoSalixIA, ResultadoHerramienta } from '@/tipos/salix-ia'
import { verificarPermiso } from '@/lib/permisos-servidor'
import type { Rol } from '@/tipos/miembro'

export async function ejecutarVincularContactos(
  ctx: ContextoSalixIA,
  params: Record<string, unknown>
): Promise<ResultadoHerramienta> {
  const contacto_id = (params.contacto_id as string)?.trim()
  const vinculado_id = (params.vinculado_id as string)?.trim()
  const desvincular = !!params.desvincular

  if (!contacto_id || !vinculado_id) {
    return {
      exito: false,
      error: 'Se requieren contacto_id (el contenedor o dueño) y vinculado_id (el contacto a vincular).',
    }
  }
  if (contacto_id === vinculado_id) {
    return { exito: false, error: 'Un contacto no puede vincularse a sí mismo.' }
  }

  // Editar vinculaciones requiere permiso de editar en contactos
  const tienePermiso = verificarPermiso(
    { rol: ctx.miembro.rol as Rol, permisos_custom: ctx.miembro.permisos_custom },
    'contactos',
    'editar'
  )
  if (!tienePermiso) {
    return { exito: false, error: 'No tenés permiso para modificar vinculaciones de contactos.' }
  }

  // Verificar que ambos contactos pertenezcan a la empresa
  const { data: contactos } = await ctx.admin
    .from('contactos')
    .select('id, nombre, apellido')
    .eq('empresa_id', ctx.empresa_id)
    .eq('en_papelera', false)
    .in('id', [contacto_id, vinculado_id])

  if (!contactos || contactos.length !== 2) {
    return { exito: false, error: 'Uno o ambos contactos no existen o están en papelera.' }
  }

  const dueno = contactos.find((c: { id: string }) => c.id === contacto_id)
  const hijo = contactos.find((c: { id: string }) => c.id === vinculado_id)
  const nombreDueno = [dueno?.nombre, dueno?.apellido].filter(Boolean).join(' ')
  const nombreHijo = [hijo?.nombre, hijo?.apellido].filter(Boolean).join(' ')

  // ─── Desvincular ───
  if (desvincular) {
    const { error } = await ctx.admin
      .from('contacto_vinculaciones')
      .delete()
      .eq('empresa_id', ctx.empresa_id)
      .eq('contacto_id', contacto_id)
      .eq('vinculado_id', vinculado_id)

    if (error) {
      return { exito: false, error: `Error al desvincular: ${error.message}` }
    }
    return {
      exito: true,
      mensaje_usuario: `Desvinculé a *${nombreHijo}* de *${nombreDueno}*.`,
    }
  }

  // ─── Vincular ───
  // Resolver tipo_relacion_clave si se pasa
  let tipo_relacion_id: string | null = null
  const tipoRelacionClave = (params.tipo_relacion_clave as string)?.trim()?.toLowerCase()

  if (tipoRelacionClave) {
    const { data: tipoRel } = await ctx.admin
      .from('tipos_relacion')
      .select('id, etiqueta')
      .eq('empresa_id', ctx.empresa_id)
      .eq('clave', tipoRelacionClave)
      .eq('activo', true)
      .maybeSingle()

    if (!tipoRel) {
      const { data: disponibles } = await ctx.admin
        .from('tipos_relacion')
        .select('clave, etiqueta')
        .eq('empresa_id', ctx.empresa_id)
        .eq('activo', true)
      const lista = (disponibles || []).map((t: { clave: string; etiqueta: string }) => `${t.clave} (${t.etiqueta})`).join(', ')
      return {
        exito: false,
        error: `Tipo de relación "${tipoRelacionClave}" no encontrado. Disponibles: ${lista || '(ninguno configurado)'}`,
      }
    }
    tipo_relacion_id = tipoRel.id
  }

  const { error } = await ctx.admin
    .from('contacto_vinculaciones')
    .insert({
      empresa_id: ctx.empresa_id,
      contacto_id,
      vinculado_id,
      tipo_relacion_id,
      puesto: (params.puesto as string)?.trim() || null,
      recibe_documentos: !!params.recibe_documentos,
    })

  if (error) {
    // 23505 = unique violation: ya existe la vinculación
    if (typeof error.code === 'string' && error.code === '23505') {
      return {
        exito: false,
        error: `*${nombreHijo}* ya estaba vinculado a *${nombreDueno}*.`,
      }
    }
    return { exito: false, error: `Error al vincular: ${error.message}` }
  }

  const detalle = [
    params.puesto ? `puesto: ${params.puesto}` : null,
    tipoRelacionClave ? `relación: ${tipoRelacionClave}` : null,
    params.recibe_documentos ? 'recibe documentos' : null,
  ].filter(Boolean).join(' · ')

  return {
    exito: true,
    datos: { contacto_id, vinculado_id, tipo_relacion_id },
    mensaje_usuario: `Vinculé a *${nombreHijo}* dentro de *${nombreDueno}*${detalle ? ` _(${detalle})_` : ''}.`,
  }
}
