/**
 * Ejecutor: modificar_contacto
 * Modifica datos de un contacto: nombre, teléfono, correo, cargo, tipo, dirección.
 * Para direcciones: valida con Google Places antes de guardar.
 * Siempre confirma los cambios mostrando el antes y después.
 */

import type { ContextoSalixIA, ResultadoHerramienta } from '@/tipos/salix-ia'
import { validarDireccion } from '@/lib/agente-ia/validar-direccion'
// TODO(refactor-telefonos): cuando todos los consumidores migren al schema `telefonos[]`,
// eliminar el soporte legacy a params.telefono / params.whatsapp y dejar solo `telefonos`.
import { resolverListaDesdeBody, type TelefonoEntrada } from '@/lib/contacto-telefonos'

export async function ejecutarModificarContacto(
  ctx: ContextoSalixIA,
  params: Record<string, unknown>
): Promise<ResultadoHerramienta> {
  const contacto_id = params.contacto_id as string
  if (!contacto_id) {
    return { exito: false, error: 'Se requiere el ID del contacto a modificar' }
  }

  // Obtener contacto actual para comparar
  const { data: contacto, error: errorBusca } = await ctx.admin
    .from('contactos')
    .select('id, nombre, apellido, telefono, whatsapp, correo, cargo, rubro, tipo_contacto_id, notas')
    .eq('id', contacto_id)
    .eq('empresa_id', ctx.empresa_id)
    .eq('en_papelera', false)
    .single()

  if (errorBusca || !contacto) {
    return { exito: false, error: 'Contacto no encontrado' }
  }

  const cambios: Record<string, unknown> = {}
  const descripcionCambios: string[] = []

  // Nombre
  if (params.nombre !== undefined) {
    const anterior = contacto.nombre
    cambios.nombre = (params.nombre as string).trim()
    descripcionCambios.push(`nombre: "${anterior}" → "${cambios.nombre}"`)
  }

  // Apellido
  if (params.apellido !== undefined) {
    const anterior = contacto.apellido || '(vacío)'
    cambios.apellido = (params.apellido as string).trim()
    descripcionCambios.push(`apellido: "${anterior}" → "${cambios.apellido}"`)
  }

  // Teléfonos — el reemplazo de la lista se procesa más abajo (DELETE + INSERT en contacto_telefonos).
  // Acá solo armamos la entrada y la descripción del cambio.
  const reemplazarTelefonos = params.telefono !== undefined
    || params.whatsapp !== undefined
    || Array.isArray(params.telefonos)
  const telefonosNuevos = reemplazarTelefonos
    ? resolverListaDesdeBody({
        telefonos: params.telefonos as TelefonoEntrada[] | undefined,
        telefono: params.telefono as string | undefined,
        whatsapp: params.whatsapp as string | undefined,
      })
    : []
  if (reemplazarTelefonos) {
    const anterior = contacto.telefono || contacto.whatsapp || '(vacío)'
    const nuevo = telefonosNuevos[0]?.valor || '(vacío)'
    descripcionCambios.push(`teléfono: ${anterior} → ${nuevo}`)
  }

  // Correo
  if (params.correo !== undefined) {
    const anterior = contacto.correo || '(vacío)'
    cambios.correo = (params.correo as string).trim().toLowerCase()
    descripcionCambios.push(`correo: ${anterior} → ${cambios.correo}`)
  }

  // Cargo
  if (params.cargo !== undefined) {
    const anterior = contacto.cargo || '(vacío)'
    cambios.cargo = (params.cargo as string).trim()
    descripcionCambios.push(`cargo: "${anterior}" → "${cambios.cargo}"`)
  }

  // Empresa/Rubro
  if (params.empresa !== undefined) {
    const anterior = contacto.rubro || '(vacío)'
    cambios.rubro = (params.empresa as string).trim()
    descripcionCambios.push(`empresa: "${anterior}" → "${cambios.rubro}"`)
  }

  // Tipo de contacto
  if (params.tipo_clave) {
    const { data: tipos } = await ctx.admin
      .from('tipos_contacto')
      .select('id, clave, etiqueta')
      .eq('empresa_id', ctx.empresa_id)
      .eq('clave', params.tipo_clave)
      .eq('activo', true)
      .single()

    if (tipos) {
      cambios.tipo_contacto_id = tipos.id
      descripcionCambios.push(`tipo: → ${tipos.etiqueta}`)
    } else {
      const { data: todosLosTipos } = await ctx.admin
        .from('tipos_contacto')
        .select('clave, etiqueta')
        .eq('empresa_id', ctx.empresa_id)
        .eq('activo', true)

      const disponibles = (todosLosTipos || []).map((t: { etiqueta: string }) => t.etiqueta).join(', ')
      return { exito: false, error: `Tipo "${params.tipo_clave}" no encontrado. Disponibles: ${disponibles}` }
    }
  }

  // Notas
  if (params.notas !== undefined) {
    cambios.notas = (params.notas as string).trim()
    descripcionCambios.push('notas actualizadas')
  }

  // Actualizar contacto si hay cambios de campos
  if (Object.keys(cambios).length > 0) {
    cambios.actualizado_por = ctx.usuario_id
    cambios.actualizado_en = new Date().toISOString()

    const { error } = await ctx.admin
      .from('contactos')
      .update(cambios)
      .eq('id', contacto_id)

    if (error) {
      return { exito: false, error: `Error actualizando contacto: ${error.message}` }
    }
  }

  // Reemplazar lista de teléfonos si vino telefono/whatsapp/telefonos en params.
  // Ojo: esto reemplaza la lista COMPLETA — si el contacto tenía 3 teléfonos y la tool
  // recibe solo `telefono: 'X'`, los otros 2 se pierden. La tool debería preguntar al
  // usuario antes de invocar si hay ambigüedad.
  if (reemplazarTelefonos) {
    const { error: delError } = await ctx.admin
      .from('contacto_telefonos')
      .delete()
      .eq('contacto_id', contacto_id)
      .eq('empresa_id', ctx.empresa_id)
    if (delError) {
      return { exito: false, error: `Error borrando teléfonos previos: ${delError.message}` }
    }
    if (telefonosNuevos.length > 0) {
      const { error: insError } = await ctx.admin.from('contacto_telefonos').insert(
        telefonosNuevos.map(t => ({
          empresa_id: ctx.empresa_id,
          contacto_id,
          tipo: t.tipo,
          valor: t.valor,
          es_whatsapp: t.es_whatsapp,
          es_principal: t.es_principal,
          etiqueta: t.etiqueta,
          orden: t.orden,
          creado_por: ctx.usuario_id,
          editado_por: ctx.usuario_id,
        }))
      )
      if (insError) {
        return { exito: false, error: `Error guardando teléfonos: ${insError.message}` }
      }
    }
  }

  // Dirección — validar con Google Places y guardar
  let direccionMsg = ''
  if (params.direccion) {
    const textoDir = params.direccion as string
    const direccionValidada = await validarDireccion(textoDir)

    if (!direccionValidada) {
      direccionMsg = `\n⚠ No se encontró la dirección "${textoDir}" en Google. Podés agregarla manualmente desde la ficha del contacto.`
    } else {
      // Obtener dirección actual
      const { data: dirActual } = await ctx.admin
        .from('contacto_direcciones')
        .select('id, texto')
        .eq('contacto_id', contacto_id)
        .eq('es_principal', true)
        .limit(1)
        .single()

      if (dirActual) {
        // Actualizar dirección existente
        await ctx.admin
          .from('contacto_direcciones')
          .update({
            calle: direccionValidada.calle,
            barrio: direccionValidada.barrio,
            ciudad: direccionValidada.ciudad,
            provincia: direccionValidada.provincia,
            lat: direccionValidada.coordenadas?.lat || null,
            lng: direccionValidada.coordenadas?.lng || null,
            texto: direccionValidada.textoCompleto,
          })
          .eq('id', dirActual.id)

        descripcionCambios.push(`dirección: "${dirActual.texto}" → "${direccionValidada.textoCompleto}"`)
      } else {
        // Crear dirección nueva
        await ctx.admin
          .from('contacto_direcciones')
          .insert({
            contacto_id,
            tipo: 'principal',
            calle: direccionValidada.calle,
            barrio: direccionValidada.barrio,
            ciudad: direccionValidada.ciudad,
            provincia: direccionValidada.provincia,
            lat: direccionValidada.coordenadas?.lat || null,
            lng: direccionValidada.coordenadas?.lng || null,
            texto: direccionValidada.textoCompleto,
            es_principal: true,
          })

        descripcionCambios.push(`dirección agregada: "${direccionValidada.textoCompleto}"`)
      }
    }
  }

  if (descripcionCambios.length === 0 && !direccionMsg) {
    return { exito: false, error: 'No se indicaron cambios para realizar' }
  }

  const nombreCompleto = [
    (cambios.nombre as string) || contacto.nombre,
    (cambios.apellido as string) || contacto.apellido,
  ].filter(Boolean).join(' ')

  return {
    exito: true,
    datos: { id: contacto_id, cambios: descripcionCambios },
    mensaje_usuario: `Contacto *${nombreCompleto}* actualizado:\n${descripcionCambios.map(c => `• ${c}`).join('\n')}${direccionMsg}`,
  }
}
