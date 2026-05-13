/**
 * Ejecutor: buscar_contactos
 * Busca contactos por nombre, teléfono, email o empresa.
 * Respeta visibilidad ver_propio vs ver_todos.
 * Soporta búsqueda multi-palabra: "Nora Riquelme" busca nombre=Nora Y apellido=Riquelme.
 * Permite filtrar por tipo de contacto (persona, empresa, edificio, proveedor, lead)
 * y enriquecer la respuesta con actividad reciente (última visita, totales).
 */

import type { ContextoSalixIA, ResultadoHerramienta } from '@/tipos/salix-ia'
import { determinarVisibilidad } from '@/lib/salix-ia/permisos'

interface ContactoBase {
  id: string
  nombre: string
  correo: string | null
  telefono: string | null
  whatsapp: string | null
  cargo: string | null
  empresa: string | null
  tipo_contacto: string | null
  activo: boolean
}

interface ContactoConActividad extends ContactoBase {
  total_visitas?: number
  ultima_visita_fecha?: string | null
  ultima_visita_estado?: string | null
  total_presupuestos?: number
  ultimo_presupuesto_fecha?: string | null
}

export async function ejecutarBuscarContactos(
  ctx: ContextoSalixIA,
  params: Record<string, unknown>
): Promise<ResultadoHerramienta> {
  const busqueda = (params.busqueda as string)?.trim()
  if (!busqueda) {
    return { exito: false, error: 'Se requiere un texto de búsqueda' }
  }

  const limite = Math.min((params.limite as number) || 10, 50)
  const visibilidad = determinarVisibilidad(ctx.miembro, 'contactos')

  if (!visibilidad) {
    return { exito: false, error: 'No tenés permiso para ver contactos' }
  }

  // Resolver tipo_clave a un tipo_contacto_id concreto. Si la clave no existe,
  // devolvemos un error con la lista de claves válidas en vez de "no encontró
  // nada" — así el modelo puede reintentar con la clave correcta.
  const tipoClave = (params.tipo_clave as string)?.trim()?.toLowerCase()
  let tipoContactoId: string | null = null

  if (tipoClave) {
    const { data: tipo } = await ctx.admin
      .from('tipos_contacto')
      .select('id, clave, etiqueta')
      .eq('empresa_id', ctx.empresa_id)
      .eq('clave', tipoClave)
      .eq('activo', true)
      .maybeSingle()

    if (!tipo) {
      const { data: disponibles } = await ctx.admin
        .from('tipos_contacto')
        .select('clave, etiqueta')
        .eq('empresa_id', ctx.empresa_id)
        .eq('activo', true)
      const lista = (disponibles || []).map((t: { clave: string }) => t.clave).join(', ')
      return { exito: false, error: `Tipo "${tipoClave}" no existe. Disponibles: ${lista}` }
    }
    tipoContactoId = tipo.id
  }

  // Separar palabras para búsqueda inteligente
  const palabras = busqueda.split(/\s+/).filter(p => p.length >= 2)

  let query = ctx.admin
    .from('contactos')
    .select(`
      id, nombre, apellido, correo, telefono, whatsapp, cargo, rubro,
      etiquetas, activo, es_provisorio, tipo_contacto_id,
      tipo_contacto:tipos_contacto!tipo_contacto_id(etiqueta)
    `)
    .eq('empresa_id', ctx.empresa_id)
    .eq('en_papelera', false)
    .order('actualizado_en', { ascending: false })
    .limit(limite)

  if (tipoContactoId) {
    query = query.eq('tipo_contacto_id', tipoContactoId)
  }

  if (palabras.length >= 2) {
    // Multi-palabra: cada palabra debe aparecer en algún campo.
    // Supabase no soporta AND de or(), así que filtramos por la primera palabra
    // en la query y validamos el resto en memoria con post-filtro.
    query = query.or(`nombre.ilike.%${palabras[0]}%,apellido.ilike.%${palabras[0]}%,correo.ilike.%${palabras[0]}%,telefono.ilike.%${palabras[0]}%,whatsapp.ilike.%${palabras[0]}%,rubro.ilike.%${palabras[0]}%`)
  } else {
    query = query.or(`nombre.ilike.%${busqueda}%,apellido.ilike.%${busqueda}%,correo.ilike.%${busqueda}%,telefono.ilike.%${busqueda}%,whatsapp.ilike.%${busqueda}%,rubro.ilike.%${busqueda}%`)
  }

  if (visibilidad === 'propio') {
    query = query.eq('creado_por', ctx.usuario_id)
  }

  const { data, error } = await query

  if (error) {
    return { exito: false, error: `Error buscando contactos: ${error.message}` }
  }

  let contactos: ContactoBase[] = (data || []).map((c: Record<string, unknown>) => ({
    id: c.id as string,
    nombre: [c.nombre, c.apellido].filter(Boolean).join(' '),
    correo: (c.correo as string) || null,
    telefono: (c.telefono as string) || null,
    whatsapp: (c.whatsapp as string) || null,
    cargo: (c.cargo as string) || null,
    empresa: (c.rubro as string) || null,
    tipo_contacto: (c.tipo_contacto as { etiqueta: string } | null)?.etiqueta || null,
    activo: c.activo as boolean,
  }))

  // Post-filtro multi-palabra: TODAS las palabras deben aparecer en algún campo.
  if (palabras.length >= 2) {
    contactos = contactos.filter((c) => {
      const textoCompleto = [c.nombre, c.correo, c.empresa, c.telefono, c.cargo, c.whatsapp, c.tipo_contacto]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
      return palabras.every(p => textoCompleto.includes(p.toLowerCase()))
    })
  }

  // Enriquecer con actividad reciente si lo piden. Hacemos 2 queries IN
  // (visitas + presupuestos) y agregamos en memoria — evita N+1.
  const incluirActividad = !!params.incluir_actividad
  if (incluirActividad && contactos.length > 0) {
    const ids = contactos.map(c => c.id)

    const [{ data: visitas }, { data: presupuestos }] = await Promise.all([
      ctx.admin
        .from('visitas')
        .select('contacto_id, fecha_programada, estado')
        .eq('empresa_id', ctx.empresa_id)
        .eq('en_papelera', false)
        .in('contacto_id', ids)
        .order('fecha_programada', { ascending: false }),
      ctx.admin
        .from('presupuestos')
        .select('contacto_id, fecha_emision, creado_en')
        .eq('empresa_id', ctx.empresa_id)
        .eq('en_papelera', false)
        .in('contacto_id', ids)
        .order('creado_en', { ascending: false }),
    ])

    // Agregar por contacto_id quedándose con la fecha más reciente.
    const visitasPorContacto = new Map<string, { fecha: string; estado: string; total: number }>()
    for (const v of (visitas || [])) {
      const cId = v.contacto_id as string
      const existente = visitasPorContacto.get(cId)
      if (!existente) {
        visitasPorContacto.set(cId, {
          fecha: v.fecha_programada as string,
          estado: v.estado as string,
          total: 1,
        })
      } else {
        existente.total += 1
      }
    }

    const presupPorContacto = new Map<string, { fecha: string | null; total: number }>()
    for (const p of (presupuestos || [])) {
      const cId = p.contacto_id as string
      const existente = presupPorContacto.get(cId)
      if (!existente) {
        presupPorContacto.set(cId, {
          fecha: (p.fecha_emision as string) || (p.creado_en as string) || null,
          total: 1,
        })
      } else {
        existente.total += 1
      }
    }

    const enriquecidos: ContactoConActividad[] = contactos.map(c => ({
      ...c,
      total_visitas: visitasPorContacto.get(c.id)?.total || 0,
      ultima_visita_fecha: visitasPorContacto.get(c.id)?.fecha || null,
      ultima_visita_estado: visitasPorContacto.get(c.id)?.estado || null,
      total_presupuestos: presupPorContacto.get(c.id)?.total || 0,
      ultimo_presupuesto_fecha: presupPorContacto.get(c.id)?.fecha || null,
    }))

    return {
      exito: true,
      datos: enriquecidos,
      mensaje_usuario: enriquecidos.length === 0
        ? `No encontré contactos con "${busqueda}".`
        : `Encontré ${enriquecidos.length} contacto(s).`,
    }
  }

  return {
    exito: true,
    datos: contactos,
    mensaje_usuario: contactos.length === 0
      ? `No encontré contactos con "${busqueda}".`
      : `Encontré ${contactos.length} contacto(s).`,
  }
}
