import { NextResponse, type NextRequest } from 'next/server'
import { obtenerUsuarioRuta } from '@/lib/supabase/servidor'
import { crearClienteAdmin } from '@/lib/supabase/admin'
import { verificarVisibilidad } from '@/lib/permisos-servidor'
import type { Modulo } from '@/tipos/permisos'

/**
 * GET /api/inbox/conversaciones/[id]/entidades-vinculadas
 *
 * Devuelve las entidades del sistema (presupuesto, factura, orden, contacto…)
 * que generaron correos en esta conversación. La vinculación se reconstruye
 * desde la tabla `chatter`: cada vez que se envía un correo desde una entidad
 * (ej. presupuesto), se registra una entrada en chatter con el `correo_message_id`.
 *
 * Cruzamos los `correo_message_id` de los mensajes de la conversación contra
 * los registros de chatter para encontrar las entidades de origen.
 */

function moduloPorTipoCanal(tipo: string | null | undefined): Modulo {
  if (tipo === 'whatsapp') return 'inbox_whatsapp'
  if (tipo === 'interno') return 'inbox_interno'
  return 'inbox_correo'
}

interface EntidadVinculada {
  tipo: string
  id: string
  nombre: string
  /** Ruta dentro de la app a la que navegar */
  ruta: string
}

/** Resuelve nombre + ruta de cada entidad según su tipo. */
async function resolverEntidad(
  admin: ReturnType<typeof crearClienteAdmin>,
  empresaId: string,
  tipo: string,
  id: string,
): Promise<EntidadVinculada | null> {
  switch (tipo) {
    case 'presupuesto': {
      const { data } = await admin
        .from('presupuestos')
        .select('numero, contacto_nombre')
        .eq('id', id)
        .eq('empresa_id', empresaId)
        .maybeSingle()
      if (!data) return null
      const nombre = data.numero
        ? `${data.numero}${data.contacto_nombre ? ` — ${data.contacto_nombre}` : ''}`
        : data.contacto_nombre || 'Presupuesto'
      return { tipo, id, nombre, ruta: `/presupuestos/${id}` }
    }
    case 'orden': {
      const { data } = await admin
        .from('ordenes_trabajo')
        .select('numero, titulo')
        .eq('id', id)
        .eq('empresa_id', empresaId)
        .maybeSingle()
      if (!data) return null
      const nombre = data.numero
        ? `${data.numero}${data.titulo ? ` — ${data.titulo}` : ''}`
        : data.titulo || 'Orden'
      return { tipo, id, nombre, ruta: `/ordenes/${id}` }
    }
    case 'contacto': {
      const { data } = await admin
        .from('contactos')
        .select('nombre, apellido')
        .eq('id', id)
        .eq('empresa_id', empresaId)
        .maybeSingle()
      if (!data) return null
      const nombre = `${data.nombre || ''} ${data.apellido || ''}`.trim() || 'Contacto'
      return { tipo, id, nombre, ruta: `/contactos/${id}` }
    }
    case 'visita': {
      const { data } = await admin
        .from('visitas')
        .select('contacto_nombre, motivo')
        .eq('id', id)
        .eq('empresa_id', empresaId)
        .maybeSingle()
      if (!data) return null
      const nombre = data.contacto_nombre || data.motivo || 'Visita'
      return { tipo, id, nombre, ruta: `/visitas/${id}` }
    }
    case 'actividad': {
      const { data } = await admin
        .from('actividades')
        .select('titulo')
        .eq('id', id)
        .eq('empresa_id', empresaId)
        .maybeSingle()
      if (!data) return null
      return { tipo, id, nombre: data.titulo || 'Actividad', ruta: `/actividades/${id}` }
    }
    default:
      return null
  }
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const { user } = await obtenerUsuarioRuta()
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const empresaId = user.app_metadata?.empresa_activa_id
    if (!empresaId) return NextResponse.json({ error: 'Sin empresa activa' }, { status: 403 })

    const admin = crearClienteAdmin()

    // Verificar acceso a la conversación (mismo criterio que el endpoint base)
    const { data: conv } = await admin
      .from('conversaciones')
      .select('id, tipo_canal, asignado_a')
      .eq('id', id)
      .eq('empresa_id', empresaId)
      .maybeSingle()
    if (!conv) {
      return NextResponse.json({ error: 'Conversación no encontrada' }, { status: 404 })
    }
    const moduloCanal = moduloPorTipoCanal(conv.tipo_canal as string | null)
    const visibilidad = await verificarVisibilidad(user.id, empresaId, moduloCanal)
    if (!visibilidad) {
      return NextResponse.json({ error: 'Sin permiso' }, { status: 403 })
    }
    // Las conversaciones se crean por webhook (sin creador humano):
    // soloPropio se valida únicamente contra el agente asignado.
    if (visibilidad.soloPropio && conv.asignado_a !== user.id) {
      return NextResponse.json({ error: 'Sin permiso' }, { status: 403 })
    }

    // Recolectar message-ids de los mensajes de la conversación.
    const { data: msgs } = await admin
      .from('mensajes')
      .select('correo_message_id')
      .eq('empresa_id', empresaId)
      .eq('conversacion_id', id)
      .not('correo_message_id', 'is', null)

    const messageIds = (msgs || [])
      .map(m => m.correo_message_id as string | null)
      .filter((v): v is string => Boolean(v))

    if (messageIds.length === 0) {
      return NextResponse.json({ entidades: [] })
    }

    // Buscar en chatter las entidades cuyo correo coincida con algún mensaje
    // de la conversación. El campo `metadata->>correo_message_id` no tiene
    // índice dedicado, pero el filtro previo por empresa_id + tipo limita el set.
    const { data: filas } = await admin
      .from('chatter')
      .select('entidad_tipo, entidad_id, metadata')
      .eq('empresa_id', empresaId)
      .eq('tipo', 'correo')
      .in('metadata->>correo_message_id', messageIds)

    // Dedup por (tipo, id) preservando el primer hallazgo.
    const vistos = new Set<string>()
    const pares: { tipo: string; id: string }[] = []
    for (const fila of filas || []) {
      const tipo = fila.entidad_tipo as string
      const idEnt = fila.entidad_id as string
      // Ignorar contactos: ya se ven en la cabecera del correo y agregan ruido.
      if (tipo === 'contacto') continue
      const clave = `${tipo}:${idEnt}`
      if (vistos.has(clave)) continue
      vistos.add(clave)
      pares.push({ tipo, id: idEnt })
    }

    // Resolver nombre + ruta de cada entidad en paralelo.
    const resueltas = await Promise.all(
      pares.map(p => resolverEntidad(admin, empresaId, p.tipo, p.id)),
    )
    const entidades = resueltas.filter((e): e is EntidadVinculada => e !== null)

    return NextResponse.json({ entidades })
  } catch (err) {
    console.error('Error al obtener entidades vinculadas:', err)
    return NextResponse.json({ entidades: [] })
  }
}
