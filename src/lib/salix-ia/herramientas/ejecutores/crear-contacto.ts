/**
 * Ejecutor: crear_contacto
 * Crea un nuevo contacto en el sistema.
 * Soporta: elegir tipo (persona, empresa, edificio, proveedor, lead),
 * validar dirección con Google Places, y guardarla.
 */

import type { ContextoSalixIA, ResultadoHerramienta } from '@/tipos/salix-ia'
import { validarDireccion } from '@/lib/agente-ia/validar-direccion'
// TODO(refactor-telefonos): cuando todos los consumidores migren al schema de tools `telefonos[]`,
// eliminar el soporte legacy a params.telefono / params.whatsapp y dejar solo `telefonos`.
import { resolverListaDesdeBody, type TelefonoEntrada } from '@/lib/contacto-telefonos'

export async function ejecutarCrearContacto(
  ctx: ContextoSalixIA,
  params: Record<string, unknown>
): Promise<ResultadoHerramienta> {
  const nombre = (params.nombre as string)?.trim()
  if (!nombre) {
    return { exito: false, error: 'Se requiere al menos el nombre del contacto' }
  }

  // Buscar tipo de contacto — por clave si se especifica, o persona por defecto
  const tipoClave = (params.tipo_clave as string)?.trim()?.toLowerCase()

  const { data: tipos } = await ctx.admin
    .from('tipos_contacto')
    .select('id, clave, etiqueta')
    .eq('empresa_id', ctx.empresa_id)
    .eq('activo', true)

  let tipoElegido = tipoClave
    ? tipos?.find((t: { clave: string }) => t.clave === tipoClave)
    : null

  // Si no se especificó o no se encontró, usar persona como default
  if (!tipoElegido) {
    tipoElegido = tipos?.find((t: { clave: string }) => t.clave === 'persona')
      || tipos?.[0]
  }

  if (!tipoElegido) {
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

  const correo = (params.correo as string)?.trim()?.toLowerCase() || null

  // Resolver lista de teléfonos: prioriza params.telefonos[], fallback a params.telefono/whatsapp legacy.
  const telefonosNorm = resolverListaDesdeBody({
    telefonos: params.telefonos as TelefonoEntrada[] | undefined,
    telefono: params.telefono as string | undefined,
    whatsapp: params.whatsapp as string | undefined,
  })

  // Verificar duplicados por correo o por cualquier teléfono de la lista
  if (correo || telefonosNorm.length > 0) {
    const idsDups = new Set<string>()

    if (correo) {
      const { data } = await ctx.admin
        .from('contactos')
        .select('id, nombre, apellido, correo, telefono')
        .eq('empresa_id', ctx.empresa_id)
        .eq('en_papelera', false)
        .eq('correo', correo)
        .limit(3)
      for (const d of (data || [])) idsDups.add(d.id)
    }

    if (telefonosNorm.length > 0) {
      const valores = telefonosNorm.map(t => t.valor)
      const { data } = await ctx.admin
        .from('contacto_telefonos')
        .select('contactos!inner(id, nombre, apellido, correo, telefono, en_papelera)')
        .eq('empresa_id', ctx.empresa_id)
        .in('valor', valores)
        .eq('contactos.en_papelera', false)
        .limit(3)
      for (const r of (data || [])) {
        const c = r.contactos as unknown as { id: string }
        if (c) idsDups.add(c.id)
      }
    }

    if (idsDups.size > 0) {
      const { data: duplicados } = await ctx.admin
        .from('contactos')
        .select('id, nombre, apellido, correo, telefono')
        .in('id', [...idsDups])
        .limit(3)

      const nombres = (duplicados || []).map((d: { nombre: string; apellido: string | null; correo: string | null; telefono: string | null }) =>
        `${d.nombre} ${d.apellido || ''}`.trim() + (d.correo ? ` (${d.correo})` : '') + (d.telefono ? ` — ${d.telefono}` : '')
      )
      return {
        exito: false,
        error: `Ya existe un contacto con ese ${correo ? 'correo' : 'teléfono'}:\n${nombres.join('\n')}\n¿Querés crear uno nuevo igual o usar el existente?`,
        datos: { duplicados },
      }
    }
  }

  // Insertar contacto SIN telefono/whatsapp directos: el trigger de sync los completa
  // automáticamente al insertar en contacto_telefonos.
  const { data, error } = await ctx.admin
    .from('contactos')
    .insert({
      empresa_id: ctx.empresa_id,
      nombre,
      apellido: (params.apellido as string)?.trim() || '',
      correo,
      rubro: (params.empresa as string)?.trim() || null,
      cargo: (params.cargo as string)?.trim() || null,
      notas: (params.notas as string)?.trim() || null,
      tipo_contacto_id: tipoElegido.id,
      origen: 'salix_ia',
      creado_por: ctx.usuario_id,
      creado_por_nombre: nombreCreador,
      actualizado_por: ctx.usuario_id,
      activo: true,
      es_provisorio: false,
    })
    .select('id, nombre, apellido')
    .single()

  if (error) {
    return { exito: false, error: `Error creando contacto: ${error.message}` }
  }

  // Insertar la lista de teléfonos. El trigger sincroniza contactos.telefono / whatsapp.
  if (telefonosNorm.length > 0) {
    const { error: telError } = await ctx.admin.from('contacto_telefonos').insert(
      telefonosNorm.map(t => ({
        empresa_id: ctx.empresa_id,
        contacto_id: data.id,
        tipo: t.tipo,
        valor: t.valor,
        es_whatsapp: t.es_whatsapp,
        es_principal: t.es_principal,
        etiqueta: t.etiqueta,
        orden: t.orden,
        creado_por: ctx.usuario_id,
      }))
    )
    if (telError) {
      // Rollback: borrar contacto huérfano
      await ctx.admin.from('contactos').delete().eq('id', data.id)
      return { exito: false, error: `Error guardando teléfonos: ${telError.message}` }
    }
  }

  // Si hay dirección, validar con Google Places y guardar
  let direccionMsg = ''
  if (params.direccion) {
    const textoDir = (params.direccion as string).trim()
    const direccionValidada = await validarDireccion(textoDir)

    if (direccionValidada) {
      await ctx.admin
        .from('contacto_direcciones')
        .insert({
          contacto_id: data.id,
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

      direccionMsg = `\n📍 Dirección: ${direccionValidada.textoCompleto}`
      if (direccionValidada.barrio) direccionMsg += ` _(${direccionValidada.barrio})_`
    } else {
      direccionMsg = `\n⚠ No se encontró la dirección "${textoDir}" en Google. Podés agregarla desde la ficha.`
    }
  }

  const tipoTexto = tipoElegido.clave !== 'persona' ? ` (${(tipoElegido as { etiqueta: string }).etiqueta})` : ''

  return {
    exito: true,
    datos: data,
    mensaje_usuario: `Contacto "${nombre}${params.apellido ? ' ' + params.apellido : ''}"${tipoTexto} creado correctamente.${direccionMsg}`,
  }
}
