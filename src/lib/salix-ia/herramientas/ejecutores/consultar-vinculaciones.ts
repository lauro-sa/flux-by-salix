/**
 * Ejecutor: consultar_vinculaciones_contacto
 * Devuelve los contactos vinculados a un contacto dado, en una o ambas direcciones.
 *
 * Direcciones:
 *  - 'hijos'   → contactos que el contacto_id agrupa (ej: empleados de una empresa,
 *                contactos asociados a un edificio). Lee filas donde contacto_id = X.
 *  - 'padres'  → contactos que vinculan al contacto_id como hijo (ej: edificios o
 *                empresas donde esta persona figura). Lee filas donde vinculado_id = X.
 *  - 'ambas'   → combina las dos listas, etiquetando cada item con su dirección.
 *
 * Las vinculaciones son unidireccionales (una sola fila por par), así que la
 * dirección es relevante: el "dueño" siempre es el campo contacto_id.
 */

import type { ContextoSalixIA, ResultadoHerramienta } from '@/tipos/salix-ia'
import { determinarVisibilidad } from '@/lib/salix-ia/permisos'

interface VinculacionVista {
  contacto_id: string
  nombre_completo: string
  tipo_contacto: string | null
  tipo_relacion: string | null
  puesto: string | null
  recibe_documentos: boolean
  telefono: string | null
  correo: string | null
  /** 'hijo' = contacto vinculado como dependiente; 'padre' = contacto que agrupa al consultado */
  direccion: 'hijo' | 'padre'
}

export async function ejecutarConsultarVinculacionesContacto(
  ctx: ContextoSalixIA,
  params: Record<string, unknown>
): Promise<ResultadoHerramienta> {
  const contacto_id = (params.contacto_id as string)?.trim()
  if (!contacto_id) {
    return { exito: false, error: 'Se requiere el ID del contacto. Buscalo primero con buscar_contactos.' }
  }

  const visibilidad = determinarVisibilidad(ctx.miembro, 'contactos')
  if (!visibilidad) {
    return { exito: false, error: 'No tenés permiso para ver contactos' }
  }

  const direccionParam = ((params.direccion as string) || 'ambas').toLowerCase()
  const direccion: 'hijos' | 'padres' | 'ambas' =
    direccionParam === 'hijos' || direccionParam === 'padres' ? direccionParam : 'ambas'

  // Verificar que el contacto exista y pertenezca a la empresa.
  // Si el usuario solo ve los suyos, también filtra por creado_por.
  let queryContacto = ctx.admin
    .from('contactos')
    .select('id, nombre, apellido')
    .eq('id', contacto_id)
    .eq('empresa_id', ctx.empresa_id)
    .eq('en_papelera', false)

  if (visibilidad === 'propio') {
    queryContacto = queryContacto.eq('creado_por', ctx.usuario_id)
  }

  const { data: contactoOrigen } = await queryContacto.single()

  if (!contactoOrigen) {
    return { exito: false, error: 'Contacto no encontrado o sin permisos para verlo.' }
  }

  const nombreOrigen = [contactoOrigen.nombre, contactoOrigen.apellido].filter(Boolean).join(' ')

  const vinculaciones: VinculacionVista[] = []

  // Hijos: filas donde contacto_id = X. Trae el contacto vinculado.
  if (direccion === 'hijos' || direccion === 'ambas') {
    const { data: hijos } = await ctx.admin
      .from('contacto_vinculaciones')
      .select(`
        puesto, recibe_documentos,
        vinculado:contactos!contacto_vinculaciones_vinculado_id_fkey(
          id, nombre, apellido, correo, telefono,
          tipo_contacto:tipos_contacto!tipo_contacto_id(etiqueta)
        ),
        tipo_relacion:tipos_relacion(etiqueta)
      `)
      .eq('empresa_id', ctx.empresa_id)
      .eq('contacto_id', contacto_id)

    for (const v of (hijos || [])) {
      const c = v.vinculado as unknown as {
        id: string
        nombre: string
        apellido: string | null
        correo: string | null
        telefono: string | null
        tipo_contacto: { etiqueta: string } | null
      } | null
      if (!c) continue
      vinculaciones.push({
        contacto_id: c.id,
        nombre_completo: [c.nombre, c.apellido].filter(Boolean).join(' '),
        tipo_contacto: c.tipo_contacto?.etiqueta || null,
        tipo_relacion: (v.tipo_relacion as { etiqueta: string } | null)?.etiqueta || null,
        puesto: v.puesto || null,
        recibe_documentos: !!v.recibe_documentos,
        telefono: c.telefono || null,
        correo: c.correo || null,
        direccion: 'hijo',
      })
    }
  }

  // Padres: filas donde vinculado_id = X. Trae el contacto contenedor.
  if (direccion === 'padres' || direccion === 'ambas') {
    const { data: padres } = await ctx.admin
      .from('contacto_vinculaciones')
      .select(`
        puesto, recibe_documentos,
        contenedor:contactos!contacto_vinculaciones_contacto_id_fkey(
          id, nombre, apellido, correo, telefono,
          tipo_contacto:tipos_contacto!tipo_contacto_id(etiqueta)
        ),
        tipo_relacion:tipos_relacion(etiqueta)
      `)
      .eq('empresa_id', ctx.empresa_id)
      .eq('vinculado_id', contacto_id)

    for (const v of (padres || [])) {
      const c = v.contenedor as unknown as {
        id: string
        nombre: string
        apellido: string | null
        correo: string | null
        telefono: string | null
        tipo_contacto: { etiqueta: string } | null
      } | null
      if (!c) continue
      vinculaciones.push({
        contacto_id: c.id,
        nombre_completo: [c.nombre, c.apellido].filter(Boolean).join(' '),
        tipo_contacto: c.tipo_contacto?.etiqueta || null,
        tipo_relacion: (v.tipo_relacion as { etiqueta: string } | null)?.etiqueta || null,
        puesto: v.puesto || null,
        recibe_documentos: !!v.recibe_documentos,
        telefono: c.telefono || null,
        correo: c.correo || null,
        direccion: 'padre',
      })
    }
  }

  return {
    exito: true,
    datos: {
      contacto: { id: contacto_id, nombre_completo: nombreOrigen },
      vinculaciones,
      total: vinculaciones.length,
    },
    mensaje_usuario: vinculaciones.length === 0
      ? `*${nombreOrigen}* no tiene contactos vinculados.`
      : `${vinculaciones.length} contacto(s) vinculado(s) a *${nombreOrigen}*.`,
  }
}
