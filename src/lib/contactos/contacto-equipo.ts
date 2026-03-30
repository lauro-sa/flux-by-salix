import type { SupabaseClient } from '@supabase/supabase-js'

interface DatosContactoEquipo {
  miembroId: string
  empresaId: string
  correo: string
  nombre: string
  usuarioId: string
}

/**
 * Cuando se crea un miembro, busca si ya existe un contacto tipo "equipo"
 * con el mismo correo y lo vincula. Si no existe, crea uno nuevo.
 * Esto replica el comportamiento de Firebase donde cada usuario del equipo
 * también existía como contacto.
 */
export async function vincularOCrearContactoEquipo(
  admin: SupabaseClient,
  datos: DatosContactoEquipo
) {
  const { miembroId, empresaId, correo, nombre, usuarioId } = datos

  // Buscar el tipo_contacto "equipo" de esta empresa
  const { data: tipoEquipo } = await admin
    .from('tipos_contacto')
    .select('id')
    .eq('empresa_id', empresaId)
    .eq('clave', 'equipo')
    .single()

  if (!tipoEquipo) return

  // Buscar si ya existe un contacto con ese correo en esta empresa
  // (puede ser uno importado de Firebase sin miembro_id)
  if (correo) {
    const { data: contactoExistente } = await admin
      .from('contactos')
      .select('id')
      .eq('empresa_id', empresaId)
      .eq('correo', correo.toLowerCase().trim())
      .eq('en_papelera', false)
      .maybeSingle()

    if (contactoExistente) {
      // Vincular el contacto existente con este miembro y asegurar tipo "equipo"
      await admin
        .from('contactos')
        .update({
          miembro_id: miembroId,
          tipo_contacto_id: tipoEquipo.id,
        })
        .eq('id', contactoExistente.id)
      return
    }
  }

  // No existe → generar código y crear contacto nuevo
  const { data: codigo } = await admin
    .rpc('siguiente_codigo', { p_empresa_id: empresaId, p_entidad: 'contacto' })

  if (!codigo) return

  // Separar nombre y apellido si viene "Nombre Apellido"
  const partes = nombre.trim().split(/\s+/)
  const nombreContacto = partes[0] || nombre
  const apellidoContacto = partes.length > 1 ? partes.slice(1).join(' ') : null

  await admin
    .from('contactos')
    .insert({
      empresa_id: empresaId,
      tipo_contacto_id: tipoEquipo.id,
      codigo,
      nombre: nombreContacto,
      apellido: apellidoContacto,
      correo: correo?.toLowerCase().trim() || null,
      origen: 'sistema',
      miembro_id: miembroId,
      creado_por: usuarioId,
      activo: true,
      en_papelera: false,
      es_provisorio: false,
      etiquetas: [],
      datos_fiscales: {},
    })
}
