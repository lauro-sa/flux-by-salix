import { NextResponse, type NextRequest } from 'next/server'
import { obtenerUsuarioRuta } from '@/lib/supabase/servidor'
import { crearClienteAdmin } from '@/lib/supabase/admin'
import { registrarChatter } from '@/lib/chatter'
import { crearNotificacion } from '@/lib/notificaciones'
import { obtenerYVerificarPermiso } from '@/lib/permisos-servidor'
import { registrarReciente } from '@/lib/recientes'
import { obtenerTiposVisita, sincronizarRegistrosVinculados, eliminarRegistrosVinculados } from '@/lib/visitas-sync'
import { COLOR_NOTIFICACION, COLORES_HEX_ESTADO_ACTIVIDAD } from '@/lib/colores_entidad'
import { autoCompletarActividad } from '@/lib/auto-completar-actividad'

/** Calcula distancia en metros entre dos coordenadas (fórmula de Haversine) */
function calcularDistanciaMetros(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000
  const toRad = (deg: number) => deg * (Math.PI / 180)
  const dLat = toRad(lat2 - lat1)
  const dLng = toRad(lng2 - lng1)
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

/**
 * GET /api/visitas/[id] — Obtener una visita por ID.
 */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const { user } = await obtenerUsuarioRuta()
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const empresaId = user.app_metadata?.empresa_activa_id
    if (!empresaId) return NextResponse.json({ error: 'Sin empresa activa' }, { status: 403 })

    const admin = crearClienteAdmin()
    const { data, error } = await admin
      .from('visitas')
      .select('*')
      .eq('id', id)
      .eq('empresa_id', empresaId)
      .single()

    if (error || !data) return NextResponse.json({ error: 'Visita no encontrada' }, { status: 404 })

    // Flags granulares para la UI (ver nota en actividades/[id]).
    const [puedeEditar, puedeEliminar, puedeCompletar, puedeAsignar] = await Promise.all([
      obtenerYVerificarPermiso(user.id, empresaId, 'visitas', 'editar'),
      obtenerYVerificarPermiso(user.id, empresaId, 'visitas', 'eliminar'),
      obtenerYVerificarPermiso(user.id, empresaId, 'visitas', 'completar'),
      obtenerYVerificarPermiso(user.id, empresaId, 'visitas', 'asignar'),
    ])
    const esCreador = data.creado_por === user.id
    const esAsignado = data.asignado_a === user.id
    const conOwnership = esCreador || esAsignado

    // Registrar en recientes (fire-and-forget)
    registrarReciente({
      empresaId,
      usuarioId: user.id,
      tipoEntidad: 'visita',
      entidadId: id,
      titulo: data.contacto_nombre || 'Visita',
      subtitulo: data.estado || undefined,
      accion: 'visto',
    })

    return NextResponse.json({
      ...data,
      permisos: {
        editar: puedeEditar.permitido,
        eliminar: puedeEliminar.permitido,
        completar: puedeCompletar.permitido && conOwnership,
        asignar: puedeAsignar.permitido,
      },
    })
  } catch {
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

/**
 * PATCH /api/visitas/[id] — Actualizar una visita.
 * Soporta acciones especiales via body.accion: 'en_camino', 'en_sitio', 'completar', 'cancelar', 'reprogramar'
 */
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const { user } = await obtenerUsuarioRuta()
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const empresaId = user.app_metadata?.empresa_activa_id
    if (!empresaId) return NextResponse.json({ error: 'Sin empresa activa' }, { status: 403 })

    const { permitido } = await obtenerYVerificarPermiso(user.id, empresaId, 'visitas', 'editar')
    if (!permitido) return NextResponse.json({ error: 'Sin permiso para editar visitas' }, { status: 403 })

    const admin = crearClienteAdmin()
    const body = await request.json()

    // Obtener nombre del editor
    const { data: perfil } = await admin
      .from('perfiles')
      .select('nombre, apellido')
      .eq('id', user.id)
      .single()
    const nombreEditor = perfil ? `${perfil.nombre} ${perfil.apellido}`.trim() : 'Usuario'

    const ahora = new Date().toISOString()

    // ── Restaurar desde papelera ──
    if ('en_papelera' in body && body.en_papelera === false) {
      const { data, error } = await admin
        .from('visitas')
        .update({
          en_papelera: false,
          papelera_en: null,
          editado_por: user.id,
          editado_por_nombre: nombreEditor,
          actualizado_en: ahora,
        })
        .eq('id', id)
        .eq('empresa_id', empresaId)
        .select()
        .single()

      if (error) return NextResponse.json({ error: 'Error al restaurar' }, { status: 500 })
      return NextResponse.json(data)
    }

    // ── Acción: confirmar (provisoria → programada) ──
    if (body.accion === 'confirmar') {
      const campos: Record<string, unknown> = {
        estado: 'programada',
        editado_por: user.id,
        editado_por_nombre: nombreEditor,
        actualizado_en: ahora,
      }
      // Permitir ajustar fecha/franja al confirmar
      if (body.fecha_programada) campos.fecha_programada = body.fecha_programada
      if (body.tiene_hora_especifica !== undefined) campos.tiene_hora_especifica = body.tiene_hora_especifica === true
      if (body.duracion_estimada_min !== undefined) campos.duracion_estimada_min = body.duracion_estimada_min
      if (body.asignado_a !== undefined) {
        campos.asignado_a = body.asignado_a
        campos.asignado_nombre = body.asignado_nombre || null
      }

      const { data, error } = await admin
        .from('visitas')
        .update(campos)
        .eq('id', id)
        .eq('empresa_id', empresaId)
        .eq('estado', 'provisoria')
        .select()
        .single()

      if (error || !data) return NextResponse.json({ error: 'Error al confirmar (¿ya estaba confirmada?)' }, { status: 500 })

      registrarChatter({
        empresaId,
        entidadTipo: 'contacto',
        entidadId: data.contacto_id,
        contenido: `${nombreEditor} confirmó la visita provisoria del agente IA`,
        autorId: user.id,
        autorNombre: nombreEditor,
        metadata: { accion: 'estado_cambiado', visita_id: data.id, estado: 'programada' },
      })

      // Sincronizar actividad + evento calendario (ahora que es real)
      const tiposConf = await obtenerTiposVisita(empresaId)
      if (tiposConf) {
        await sincronizarRegistrosVinculados({
          id: data.id, empresa_id: empresaId, contacto_id: data.contacto_id,
          contacto_nombre: data.contacto_nombre, direccion_texto: data.direccion_texto,
          asignado_a: data.asignado_a, asignado_nombre: data.asignado_nombre,
          fecha_programada: data.fecha_programada, duracion_estimada_min: data.duracion_estimada_min || 30,
          estado: 'programada', motivo: data.motivo, prioridad: data.prioridad,
          actividad_id: data.actividad_id, creado_por: data.creado_por, creado_por_nombre: data.creado_por_nombre,
        }, tiposConf)
      }

      return NextResponse.json(data)
    }

    // ── Acción: rechazar (provisoria → cancelada, sin notificar al creador sistema) ──
    if (body.accion === 'rechazar') {
      const { data, error } = await admin
        .from('visitas')
        .update({
          estado: 'cancelada',
          resultado: body.resultado || 'Rechazada por el equipo',
          editado_por: user.id,
          editado_por_nombre: nombreEditor,
          actualizado_en: ahora,
        })
        .eq('id', id)
        .eq('empresa_id', empresaId)
        .eq('estado', 'provisoria')
        .select()
        .single()

      if (error || !data) return NextResponse.json({ error: 'Error al rechazar' }, { status: 500 })

      registrarChatter({
        empresaId,
        entidadTipo: 'contacto',
        entidadId: data.contacto_id,
        contenido: `${nombreEditor} rechazó la visita provisoria del agente IA${body.resultado ? `: ${body.resultado}` : ''}`,
        autorId: user.id,
        autorNombre: nombreEditor,
        metadata: { accion: 'estado_cambiado', visita_id: data.id, estado: 'cancelada' },
      })

      return NextResponse.json(data)
    }

    // ── Acción: en_camino ──
    if (body.accion === 'en_camino') {
      const { data, error } = await admin
        .from('visitas')
        .update({
          estado: 'en_camino',
          fecha_inicio: ahora,
          editado_por: user.id,
          editado_por_nombre: nombreEditor,
          actualizado_en: ahora,
        })
        .eq('id', id)
        .eq('empresa_id', empresaId)
        .select()
        .single()

      if (error) return NextResponse.json({ error: 'Error al actualizar estado' }, { status: 500 })

      registrarChatter({
        empresaId,
        entidadTipo: 'contacto',
        entidadId: data.contacto_id,
        contenido: `${nombreEditor} está en camino a la visita`,
        autorId: user.id,
        autorNombre: nombreEditor,
        metadata: { accion: 'estado_cambiado', visita_id: data.id, estado: 'en_camino' },
      })

      // Notificar al creador/supervisor que el visitador salió
      if (data.creado_por && data.creado_por !== user.id) {
        crearNotificacion({
          empresaId,
          usuarioId: data.creado_por,
          tipo: 'actividad_asignada',
          titulo: `🚗 ${nombreEditor} está en camino`,
          cuerpo: data.contacto_nombre,
          icono: 'MapPin',
          color: COLOR_NOTIFICACION.info,
          url: '/visitas',
          referenciaTipo: 'visita',
          referenciaId: data.id,
        })
      }

      return NextResponse.json(data)
    }

    // ── Acción: en_sitio ──
    if (body.accion === 'en_sitio') {
      const campos: Record<string, unknown> = {
        estado: 'en_sitio',
        fecha_llegada: ahora,
        editado_por: user.id,
        editado_por_nombre: nombreEditor,
        actualizado_en: ahora,
      }

      // Registrar geolocalización si la envía
      if (body.registro_lat !== undefined) {
        campos.registro_lat = body.registro_lat
        campos.registro_lng = body.registro_lng
        campos.registro_precision_m = body.registro_precision_m || null
      }

      const { data, error } = await admin
        .from('visitas')
        .update(campos)
        .eq('id', id)
        .eq('empresa_id', empresaId)
        .select()
        .single()

      if (error) return NextResponse.json({ error: 'Error al registrar llegada' }, { status: 500 })

      // Validar proximidad GPS: comparar ubicación registrada vs dirección programada
      let advertenciaProximidad: string | null = null
      if (body.registro_lat != null && data.direccion_lat != null) {
        const distanciaM = calcularDistanciaMetros(
          body.registro_lat, body.registro_lng,
          data.direccion_lat, data.direccion_lng
        )
        const UMBRAL_PROXIMIDAD_M = 500
        if (distanciaM > UMBRAL_PROXIMIDAD_M) {
          advertenciaProximidad = `El visitador registró llegada a ${Math.round(distanciaM)}m de la dirección programada`
        }
      }

      registrarChatter({
        empresaId,
        entidadTipo: 'contacto',
        entidadId: data.contacto_id,
        contenido: advertenciaProximidad
          ? `${nombreEditor} llegó al sitio (⚠ ${advertenciaProximidad})`
          : `${nombreEditor} llegó al sitio`,
        autorId: user.id,
        autorNombre: nombreEditor,
        metadata: {
          accion: 'estado_cambiado', visita_id: data.id, estado: 'en_sitio',
          ...(advertenciaProximidad ? { advertencia_proximidad: true } : {}),
        },
      })

      return NextResponse.json({ ...data, advertencia_proximidad: advertenciaProximidad })
    }

    // ── Acción: completar ──
    if (body.accion === 'completar') {
      // Obtener la visita para calcular duración + saber si tiene actividad origen
      const { data: visitaActual } = await admin
        .from('visitas')
        .select('fecha_llegada, contacto_id, contacto_nombre, actividad_origen_id')
        .eq('id', id)
        .single()

      let duracionReal: number | null = null
      if (visitaActual?.fecha_llegada) {
        duracionReal = Math.round((Date.now() - new Date(visitaActual.fecha_llegada).getTime()) / 60000)
      }

      const { data, error } = await admin
        .from('visitas')
        .update({
          estado: 'completada',
          fecha_completada: ahora,
          duracion_real_min: duracionReal,
          resultado: body.resultado || null,
          checklist: body.checklist || undefined,
          editado_por: user.id,
          editado_por_nombre: nombreEditor,
          actualizado_en: ahora,
        })
        .eq('id', id)
        .eq('empresa_id', empresaId)
        .select()
        .single()

      if (error) return NextResponse.json({ error: 'Error al completar' }, { status: 500 })

      registrarChatter({
        empresaId,
        entidadTipo: 'contacto',
        entidadId: data.contacto_id,
        contenido: `Visita completada${duracionReal ? ` (${duracionReal} min)` : ''}${body.resultado ? `: ${body.resultado}` : ''}`,
        autorId: user.id,
        autorNombre: nombreEditor,
        metadata: { accion: 'estado_cambiado', visita_id: data.id, estado: 'completada' },
      })

      // Notificar al creador si fue otro quien completó
      if (data.creado_por && data.creado_por !== user.id) {
        crearNotificacion({
          empresaId,
          usuarioId: data.creado_por,
          tipo: 'actividad_asignada',
          titulo: `✅ ${nombreEditor} completó la visita`,
          cuerpo: `${data.contacto_nombre}`,
          icono: 'CheckCircle',
          color: COLOR_NOTIFICACION.exito,
          url: '/visitas',
          referenciaTipo: 'visita',
          referenciaId: data.id,
        })
      }

      // Marcar notificaciones previas como leídas
      admin
        .from('notificaciones')
        .update({ leida: true })
        .eq('referencia_tipo', 'visita')
        .eq('referencia_id', data.id)
        .eq('empresa_id', empresaId)
        .eq('leida', false)
        .then(() => {})

      // Sincronizar actividad + evento
      const tiposComp = await obtenerTiposVisita(empresaId)
      if (tiposComp) {
        await sincronizarRegistrosVinculados({
          id: data.id, empresa_id: empresaId, contacto_id: data.contacto_id,
          contacto_nombre: data.contacto_nombre, direccion_texto: data.direccion_texto,
          asignado_a: data.asignado_a, asignado_nombre: data.asignado_nombre,
          fecha_programada: data.fecha_programada, duracion_estimada_min: data.duracion_estimada_min || 30,
          estado: 'completada', motivo: data.motivo, prioridad: data.prioridad,
          actividad_id: data.actividad_id, creado_por: data.creado_por, creado_por_nombre: data.creado_por_nombre,
        }, tiposComp)
      }

      // Listener de auto-completar al finalizar la visita. Solo dispara si el tipo
      // de la actividad origen tiene `evento_auto_completar = 'al_finalizar'`.
      if (visitaActual?.actividad_origen_id) {
        await autoCompletarActividad({
          admin,
          empresaId,
          actividadId: visitaActual.actividad_origen_id,
          eventoEsperado: 'al_finalizar',
          usuarioId: user.id,
          usuarioNombre: nombreEditor,
          mensajeChatter: `Completada automáticamente al finalizar visita a ${data.contacto_nombre || 'contacto'}`,
          metadataChatter: { visita_id: id },
        })
      }

      registrarReciente({
        empresaId, usuarioId: user.id, tipoEntidad: 'visita', entidadId: id,
        titulo: data.contacto_nombre || 'Visita', subtitulo: 'completada', accion: 'editado',
      })

      return NextResponse.json(data)
    }

    // ── Acción: cancelar ──
    if (body.accion === 'cancelar') {
      const { data, error } = await admin
        .from('visitas')
        .update({
          estado: 'cancelada',
          resultado: body.resultado || null,
          editado_por: user.id,
          editado_por_nombre: nombreEditor,
          actualizado_en: ahora,
        })
        .eq('id', id)
        .eq('empresa_id', empresaId)
        .select()
        .single()

      if (error) return NextResponse.json({ error: 'Error al cancelar' }, { status: 500 })

      registrarChatter({
        empresaId,
        entidadTipo: 'contacto',
        entidadId: data.contacto_id,
        contenido: `Visita cancelada${body.resultado ? `: ${body.resultado}` : ''}`,
        autorId: user.id,
        autorNombre: nombreEditor,
        metadata: { accion: 'estado_cambiado', visita_id: data.id, estado: 'cancelada' },
      })

      // Notificar al asignado si fue otro quien canceló
      if (data.asignado_a && data.asignado_a !== user.id) {
        crearNotificacion({
          empresaId,
          usuarioId: data.asignado_a,
          tipo: 'actividad_asignada',
          titulo: `❌ ${nombreEditor} canceló tu visita`,
          cuerpo: `${data.contacto_nombre}${body.resultado ? ` · ${body.resultado}` : ''}`,
          icono: 'XCircle',
          color: COLOR_NOTIFICACION.peligro,
          url: '/visitas',
          referenciaTipo: 'visita',
          referenciaId: data.id,
        })
      }
      // Notificar al creador si fue otro quien canceló
      if (data.creado_por && data.creado_por !== user.id && data.creado_por !== data.asignado_a) {
        crearNotificacion({
          empresaId,
          usuarioId: data.creado_por,
          tipo: 'actividad_asignada',
          titulo: `❌ ${nombreEditor} canceló la visita`,
          cuerpo: `${data.contacto_nombre}`,
          icono: 'XCircle',
          color: COLOR_NOTIFICACION.peligro,
          url: '/visitas',
          referenciaTipo: 'visita',
          referenciaId: data.id,
        })
      }

      // Sincronizar actividad + evento (cancelar)
      const tiposCanc = await obtenerTiposVisita(empresaId)
      if (tiposCanc) {
        await sincronizarRegistrosVinculados({
          id: data.id, empresa_id: empresaId, contacto_id: data.contacto_id,
          contacto_nombre: data.contacto_nombre, direccion_texto: data.direccion_texto,
          asignado_a: data.asignado_a, asignado_nombre: data.asignado_nombre,
          fecha_programada: data.fecha_programada, duracion_estimada_min: data.duracion_estimada_min || 30,
          estado: 'cancelada', motivo: data.motivo, prioridad: data.prioridad,
          actividad_id: data.actividad_id, creado_por: data.creado_por, creado_por_nombre: data.creado_por_nombre,
        }, tiposCanc)
      }

      // Marcar notificaciones como leídas
      admin
        .from('notificaciones')
        .update({ leida: true })
        .eq('referencia_tipo', 'visita')
        .eq('referencia_id', data.id)
        .eq('empresa_id', empresaId)
        .eq('leida', false)
        .then(() => {})

      return NextResponse.json(data)
    }

    // ── Acción: reprogramar ──
    if (body.accion === 'reprogramar') {
      if (!body.fecha_programada) {
        return NextResponse.json({ error: 'La nueva fecha es obligatoria' }, { status: 400 })
      }

      const { data, error } = await admin
        .from('visitas')
        .update({
          estado: 'reprogramada',
          fecha_programada: body.fecha_programada,
          ...(body.tiene_hora_especifica !== undefined ? { tiene_hora_especifica: body.tiene_hora_especifica === true } : {}),
          fecha_inicio: null,
          fecha_llegada: null,
          editado_por: user.id,
          editado_por_nombre: nombreEditor,
          actualizado_en: ahora,
        })
        .eq('id', id)
        .eq('empresa_id', empresaId)
        .select()
        .single()

      if (error) return NextResponse.json({ error: 'Error al reprogramar' }, { status: 500 })

      // Cargar zona horaria de la empresa para formatear la fecha en la zona correcta
      // (en Vercel el servidor corre en UTC, sin zona explícita mostraríamos el día equivocado)
      const { data: empresaTz } = await admin
        .from('empresas').select('zona_horaria').eq('id', empresaId).maybeSingle()
      const zonaEmpresa = empresaTz?.zona_horaria || 'America/Argentina/Buenos_Aires'

      registrarChatter({
        empresaId,
        entidadTipo: 'contacto',
        entidadId: data.contacto_id,
        contenido: `Visita reprogramada para ${new Date(body.fecha_programada).toLocaleDateString('es-AR', { timeZone: zonaEmpresa })}`,
        autorId: user.id,
        autorNombre: nombreEditor,
        metadata: { accion: 'estado_cambiado', visita_id: data.id, estado: 'reprogramada' },
      })

      // Notificar al asignado si fue otro quien reprogramó
      const fechaFormateada = new Date(body.fecha_programada).toLocaleDateString('es-AR', { day: 'numeric', month: 'short', timeZone: zonaEmpresa })
      if (data.asignado_a && data.asignado_a !== user.id) {
        crearNotificacion({
          empresaId,
          usuarioId: data.asignado_a,
          tipo: 'actividad_asignada',
          titulo: `📅 ${nombreEditor} reprogramó tu visita`,
          cuerpo: `${data.contacto_nombre} · Nueva fecha: ${fechaFormateada}`,
          icono: 'CalendarClock',
          color: COLOR_NOTIFICACION.advertencia,
          url: '/visitas',
          referenciaTipo: 'visita',
          referenciaId: data.id,
        })
      }

      // Sincronizar actividad + evento calendario (nueva fecha)
      const tiposRepr = await obtenerTiposVisita(empresaId)
      if (tiposRepr) {
        await sincronizarRegistrosVinculados({
          id: data.id, empresa_id: empresaId, contacto_id: data.contacto_id,
          contacto_nombre: data.contacto_nombre, direccion_texto: data.direccion_texto,
          asignado_a: data.asignado_a, asignado_nombre: data.asignado_nombre,
          fecha_programada: data.fecha_programada, duracion_estimada_min: data.duracion_estimada_min || 30,
          estado: 'programada', motivo: data.motivo, prioridad: data.prioridad,
          actividad_id: data.actividad_id, creado_por: data.creado_por, creado_por_nombre: data.creado_por_nombre,
        }, tiposRepr)
      }

      return NextResponse.json(data)
    }

    // ── Acción: reactivar (volver a programada) ──
    if (body.accion === 'reactivar') {
      const { data, error } = await admin
        .from('visitas')
        .update({
          estado: 'programada',
          fecha_completada: null,
          fecha_inicio: null,
          fecha_llegada: null,
          duracion_real_min: null,
          resultado: null,
          editado_por: user.id,
          editado_por_nombre: nombreEditor,
          actualizado_en: ahora,
        })
        .eq('id', id)
        .eq('empresa_id', empresaId)
        .select()
        .single()

      if (error) return NextResponse.json({ error: 'Error al reactivar' }, { status: 500 })

      registrarChatter({
        empresaId,
        entidadTipo: 'contacto',
        entidadId: data.contacto_id,
        contenido: `${nombreEditor} reactivó la visita`,
        autorId: user.id,
        autorNombre: nombreEditor,
        metadata: { accion: 'estado_cambiado', visita_id: data.id, estado: 'programada' },
      })

      // Sincronizar actividad + evento calendario (reactivar)
      const tiposReact = await obtenerTiposVisita(empresaId)
      if (tiposReact) {
        await sincronizarRegistrosVinculados({
          id: data.id, empresa_id: empresaId, contacto_id: data.contacto_id,
          contacto_nombre: data.contacto_nombre, direccion_texto: data.direccion_texto,
          asignado_a: data.asignado_a, asignado_nombre: data.asignado_nombre,
          fecha_programada: data.fecha_programada, duracion_estimada_min: data.duracion_estimada_min || 30,
          estado: 'programada', motivo: data.motivo, prioridad: data.prioridad,
          actividad_id: data.actividad_id, creado_por: data.creado_por, creado_por_nombre: data.creado_por_nombre,
        }, tiposReact)
      }

      return NextResponse.json(data)
    }

    // ── Edición general ──
    const campos: Record<string, unknown> = {
      editado_por: user.id,
      editado_por_nombre: nombreEditor,
      actualizado_en: ahora,
    }

    if (body.contacto_id !== undefined) {
      campos.contacto_id = body.contacto_id
      // Snapshot del nombre
      if (body.contacto_nombre) {
        campos.contacto_nombre = body.contacto_nombre
      } else {
        const { data: c } = await admin.from('contactos').select('nombre').eq('id', body.contacto_id).single()
        campos.contacto_nombre = c?.nombre || 'Sin nombre'
      }
    }
    if (body.direccion_id !== undefined) {
      campos.direccion_id = body.direccion_id
      campos.direccion_texto = body.direccion_texto || null
      campos.direccion_lat = body.direccion_lat || null
      campos.direccion_lng = body.direccion_lng || null
    }
    if (body.asignado_a !== undefined) {
      campos.asignado_a = body.asignado_a
      campos.asignado_nombre = body.asignado_nombre || null
    }
    if (body.fecha_programada !== undefined) campos.fecha_programada = body.fecha_programada
    if (body.tiene_hora_especifica !== undefined) campos.tiene_hora_especifica = body.tiene_hora_especifica === true
    if (body.duracion_estimada_min !== undefined) campos.duracion_estimada_min = body.duracion_estimada_min
    if (body.motivo !== undefined) campos.motivo = body.motivo
    if (body.resultado !== undefined) campos.resultado = body.resultado
    if (body.notas !== undefined) campos.notas = body.notas
    if (body.prioridad !== undefined) campos.prioridad = body.prioridad
    if (body.checklist !== undefined) campos.checklist = body.checklist
    if (body.recibe_nombre !== undefined) campos.recibe_nombre = body.recibe_nombre
    if (body.recibe_telefono !== undefined) campos.recibe_telefono = body.recibe_telefono
    if (body.recibe_contacto_id !== undefined) campos.recibe_contacto_id = body.recibe_contacto_id
    if (body.vinculos !== undefined) campos.vinculos = body.vinculos

    const { data, error } = await admin
      .from('visitas')
      .update(campos)
      .eq('id', id)
      .eq('empresa_id', empresaId)
      .select()
      .single()

    if (error) {
      console.error('Error al editar visita:', error)
      return NextResponse.json({ error: 'Error al editar' }, { status: 500 })
    }

    // Sincronizar actividad + evento calendario
    const tipos = await obtenerTiposVisita(empresaId)
    if (tipos) {
      await sincronizarRegistrosVinculados({
        id: data.id,
        empresa_id: empresaId,
        contacto_id: data.contacto_id,
        contacto_nombre: data.contacto_nombre,
        direccion_texto: data.direccion_texto,
        asignado_a: data.asignado_a,
        asignado_nombre: data.asignado_nombre,
        fecha_programada: data.fecha_programada,
        duracion_estimada_min: data.duracion_estimada_min || 30,
        estado: data.estado,
        motivo: data.motivo,
        prioridad: data.prioridad,
        actividad_id: data.actividad_id,
        creado_por: data.creado_por,
        creado_por_nombre: data.creado_por_nombre,
      }, tipos)
    }

    // Registrar en recientes
    registrarReciente({
      empresaId, usuarioId: user.id, tipoEntidad: 'visita', entidadId: id,
      titulo: data.contacto_nombre || 'Visita', subtitulo: data.estado, accion: 'editado',
    })

    // Notificar si se reasignó a otro usuario
    if (body.asignado_a && body.asignado_a !== user.id) {
      crearNotificacion({
        empresaId,
        usuarioId: body.asignado_a,
        tipo: 'actividad_asignada',
        titulo: `📍 ${nombreEditor} te asignó una visita`,
        cuerpo: `${data.contacto_nombre} · ${data.direccion_texto || 'Sin dirección'}`,
        icono: 'MapPin',
        color: COLOR_NOTIFICACION.info,
        url: '/visitas',
        referenciaTipo: 'visita',
        referenciaId: data.id,
      })
    }

    return NextResponse.json(data)
  } catch {
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

/**
 * DELETE /api/visitas/[id] — Enviar visita a papelera (soft delete).
 */
export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const { user } = await obtenerUsuarioRuta()
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const empresaId = user.app_metadata?.empresa_activa_id
    if (!empresaId) return NextResponse.json({ error: 'Sin empresa activa' }, { status: 403 })

    const { permitido } = await obtenerYVerificarPermiso(user.id, empresaId, 'visitas', 'eliminar')
    if (!permitido) return NextResponse.json({ error: 'Sin permiso para eliminar visitas' }, { status: 403 })

    const admin = crearClienteAdmin()

    // Obtener la visita para saber su estado y actividad_id
    const { data: visita } = await admin
      .from('visitas')
      .select('actividad_id, en_papelera')
      .eq('id', id)
      .eq('empresa_id', empresaId)
      .single()

    if (!visita) return NextResponse.json({ error: 'Visita no encontrada' }, { status: 404 })

    // Si ya está en papelera → hard delete definitivo
    if (visita.en_papelera) {
      await admin.from('chatter').delete().eq('empresa_id', empresaId).contains('metadata', { visita_id: id })
      if (visita.actividad_id) {
        await eliminarRegistrosVinculados(id, visita.actividad_id)
      }
      await admin.from('visitas').delete().eq('id', id).eq('empresa_id', empresaId)
      return NextResponse.json({ ok: true })
    }

    // Soft delete: enviar a papelera
    const { error } = await admin
      .from('visitas')
      .update({
        en_papelera: true,
        papelera_en: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('empresa_id', empresaId)

    if (error) return NextResponse.json({ error: 'Error al eliminar' }, { status: 500 })

    // Eliminar actividad + evento calendario vinculados
    await eliminarRegistrosVinculados(id, visita?.actividad_id || null)

    // Eliminar entradas del chatter vinculadas
    await admin.from('chatter')
      .delete()
      .eq('empresa_id', empresaId)
      .contains('metadata', { visita_id: id })

    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
