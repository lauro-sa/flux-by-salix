import { NextResponse, type NextRequest } from 'next/server'
import { requerirPermisoAPI } from '@/lib/permisos-servidor'
import { crearClienteAdmin } from '@/lib/supabase/admin'
import { crearNotificacion } from '@/lib/notificaciones'
import { recalcularContadoresRecorrido } from '@/lib/recorrido-contadores'

/**
 * POST /api/recorrido/agregar-parada — Agrega una parada al final del recorrido.
 *
 * Soporta dos modos:
 *
 * 1. Parada tipo 'visita' (compatibilidad previa):
 *    Body: { recorrido_id, visita_id }
 *    Enlaza una visita existente al recorrido.
 *
 * 2. Parada tipo 'parada' (nueva):
 *    Body: {
 *      recorrido_id,
 *      tipo: 'parada',
 *      titulo,
 *      motivo?,
 *      direccion_texto?, direccion_lat?, direccion_lng?, direccion_id?,
 *      contacto_id?, contacto_nombre?
 *    }
 *    Crea una parada genérica (café, combustible, depósito, etc.) que NO cuenta
 *    como visita al cliente, incluso si está vinculada a la dirección de un contacto.
 *
 * Calcula el orden automáticamente (último + 1).
 * Recalcula contadores del recorrido (total_visitas, total_paradas, etc.).
 * Notifica al visitador si el recorrido está en curso.
 */
export async function POST(request: NextRequest) {
  try {
    const guard = await requerirPermisoAPI('recorrido', 'reordenar')
    if ('respuesta' in guard) return guard.respuesta
    const { user, empresaId } = guard

    const body = await request.json() as {
      recorrido_id?: string
      tipo?: 'visita' | 'parada'
      // modo visita
      visita_id?: string
      // modo parada
      titulo?: string
      motivo?: string
      direccion_texto?: string
      direccion_lat?: number
      direccion_lng?: number
      direccion_id?: string | null
      contacto_id?: string | null
      contacto_nombre?: string | null
    }

    const { recorrido_id } = body

    if (!recorrido_id) {
      return NextResponse.json({ error: 'recorrido_id requerido' }, { status: 400 })
    }

    const admin = crearClienteAdmin()

    const { data: recorrido } = await admin
      .from('recorridos')
      .select('id, asignado_a, estado')
      .eq('id', recorrido_id)
      .eq('empresa_id', empresaId)
      .single()

    if (!recorrido) {
      return NextResponse.json({ error: 'Recorrido no encontrado' }, { status: 404 })
    }

    // Obtener el último orden (compartido por los dos modos)
    const { data: ultimaParada } = await admin
      .from('recorrido_paradas')
      .select('orden')
      .eq('recorrido_id', recorrido_id)
      .order('orden', { ascending: false })
      .limit(1)
      .maybeSingle()

    const nuevoOrden = (ultimaParada?.orden || 0) + 1

    // ── Determinar modo ──
    const esParadaGenerica = body.tipo === 'parada'

    let paradaInsert: Record<string, unknown>
    let notificacionTitulo = 'Se agregó una parada a tu recorrido'
    let notificacionCuerpo = 'Revisá tu recorrido, se agregó una nueva parada.'

    if (esParadaGenerica) {
      // ── Modo 'parada' ──
      const titulo = (body.titulo || '').trim()
      if (!titulo) {
        return NextResponse.json({ error: 'titulo requerido para paradas genéricas' }, { status: 400 })
      }

      // Resolver snapshot de dirección y contacto:
      //  1. Si viene direccion_id, leer lat/lng/texto desde contacto_direcciones (es la fuente de verdad).
      //  2. Si viene contacto_id sin direccion_id, usar la dirección principal del contacto.
      //  3. Si no hay nada, tomar lo que vino en el body (caso "a mano").
      let contactoNombre = body.contacto_nombre || null
      let direccionTexto = body.direccion_texto?.trim() || null
      let direccionLat: number | null = body.direccion_lat ?? null
      let direccionLng: number | null = body.direccion_lng ?? null
      let direccionId: string | null = body.direccion_id || null

      if (body.contacto_id) {
        const { data: contacto } = await admin
          .from('contactos')
          .select('nombre')
          .eq('id', body.contacto_id)
          .eq('empresa_id', empresaId)
          .maybeSingle()
        if (!contacto) {
          return NextResponse.json({ error: 'Contacto no encontrado' }, { status: 404 })
        }
        if (!contactoNombre) contactoNombre = contacto.nombre

        // Cargar dirección del contacto: la específica si vino id, o la principal como fallback.
        let queryDir = admin
          .from('contacto_direcciones')
          .select('id, lat, lng, texto')
          .eq('contacto_id', body.contacto_id)
        queryDir = direccionId
          ? queryDir.eq('id', direccionId)
          : queryDir.eq('es_principal', true)
        const { data: dir } = await queryDir.maybeSingle()
        if (dir) {
          // Si el cliente no pasó lat/lng explícitos, snapshotear los del contacto.
          if (direccionLat == null) direccionLat = dir.lat ?? null
          if (direccionLng == null) direccionLng = dir.lng ?? null
          if (!direccionTexto) direccionTexto = dir.texto ?? null
          if (!direccionId) direccionId = dir.id
        }
      }

      paradaInsert = {
        recorrido_id,
        tipo: 'parada',
        visita_id: null,
        titulo,
        motivo: body.motivo?.trim() || null,
        direccion_texto: direccionTexto,
        direccion_lat: direccionLat,
        direccion_lng: direccionLng,
        direccion_id: direccionId,
        contacto_id: body.contacto_id || null,
        contacto_nombre: contactoNombre,
        estado: 'programada',
        orden: nuevoOrden,
        creado_por: user.id,
      }

      notificacionTitulo = 'Se agregó una parada a tu recorrido'
      notificacionCuerpo = `Se agregó "${titulo}" como parada logística.`
    } else {
      // ── Modo 'visita' (legacy) ──
      const visitaId = body.visita_id
      if (!visitaId) {
        return NextResponse.json({ error: 'visita_id requerido' }, { status: 400 })
      }

      // Evitar duplicados de la misma visita en el recorrido
      const { data: existente } = await admin
        .from('recorrido_paradas')
        .select('id')
        .eq('recorrido_id', recorrido_id)
        .eq('visita_id', visitaId)
        .maybeSingle()

      if (existente) {
        return NextResponse.json({ error: 'La visita ya está en el recorrido' }, { status: 409 })
      }

      paradaInsert = {
        recorrido_id,
        tipo: 'visita',
        visita_id: visitaId,
        orden: nuevoOrden,
        creado_por: user.id,
      }
    }

    const { data: paradaCreada, error: errorInsert } = await admin
      .from('recorrido_paradas')
      .insert(paradaInsert)
      .select('*')
      .single()

    if (errorInsert || !paradaCreada) {
      return NextResponse.json({ error: 'Error al agregar parada', detalle: errorInsert?.message }, { status: 500 })
    }

    // Recalcular contadores (separa visitas vs paradas)
    await recalcularContadoresRecorrido(admin, recorrido_id)

    // Notificar al visitador solo si está en curso
    if (recorrido.asignado_a !== user.id && recorrido.estado === 'en_curso') {
      crearNotificacion({
        empresaId,
        usuarioId: recorrido.asignado_a,
        tipo: 'sistema',
        titulo: notificacionTitulo,
        cuerpo: notificacionCuerpo,
        icono: 'route',
        url: '/recorrido',
        referenciaTipo: 'recorrido',
        referenciaId: recorrido_id,
      }).catch(() => {})
    }

    return NextResponse.json({ ok: true, parada: paradaCreada, orden: nuevoOrden })
  } catch (err) {
    console.error('Error en POST /api/recorrido/agregar-parada:', err)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
