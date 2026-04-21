import { NextResponse, type NextRequest } from 'next/server'
import { obtenerUsuarioRuta } from '@/lib/supabase/servidor'
import { crearClienteAdmin } from '@/lib/supabase/admin'
import {
  listarPlantillasMeta, crearPlantillaMeta, editarPlantillaMeta, eliminarPlantillaMeta,
  type ConfigCuentaWhatsApp,
} from '@/lib/whatsapp'
import {
  transformarAMeta,
  transformarDesdeMeta,
  calcularHashMeta,
} from '@/lib/whatsapp/plantillas-sync'
import type { ComponentesPlantillaWA, EstadoMeta } from '@/tipos/whatsapp'

/**
 * Registra un evento en el historial de la plantilla (línea de tiempo del editor).
 * Fire-and-forget: si falla, no bloquea la operación principal.
 */
async function registrarEventoHistorial(
  admin: ReturnType<typeof crearClienteAdmin>,
  params: {
    empresaId: string
    plantillaId: string
    evento: string
    estadoPrevio?: string | null
    estadoNuevo?: string | null
    detalle?: string | null
    usuarioId?: string | null
    usuarioNombre?: string | null
    metadata?: Record<string, unknown> | null
  },
) {
  try {
    await admin.from('historial_plantillas_whatsapp').insert({
      empresa_id: params.empresaId,
      plantilla_id: params.plantillaId,
      evento: params.evento,
      estado_previo: params.estadoPrevio ?? null,
      estado_nuevo: params.estadoNuevo ?? null,
      detalle: params.detalle ?? null,
      usuario_id: params.usuarioId ?? null,
      usuario_nombre: params.usuarioNombre ?? null,
      metadata: params.metadata ?? null,
    })
  } catch (err) {
    console.warn('No se pudo registrar historial de plantilla WA:', err)
  }
}

/**
 * Agrega al objeto plantilla los campos computados:
 *  - `hash_actual`: hash del snapshot local (lo que viaja a Meta si se reenvía).
 *  - `desincronizada`: true si hay cambios locales no sincronizados con Meta.
 *    `null` significa "desconocido" (plantillas viejas sin hash guardado).
 */
function enriquecerPlantilla<T extends Record<string, unknown>>(
  plantilla: T,
): T & { hash_actual: string; desincronizada: boolean | null } {
  const componentes = plantilla.componentes as ComponentesPlantillaWA
  const hashActual = calcularHashMeta(componentes || { cuerpo: { texto: '' } })
  const hashMeta = plantilla.hash_componentes_meta as string | null
  const estado = plantilla.estado_meta as EstadoMeta
  let desincronizada: boolean | null = false
  if (estado === 'BORRADOR' || estado === 'ERROR') {
    // Borrador/error: no hay nada que "desincronizar" — el usuario aún no envió.
    desincronizada = false
  } else if (hashMeta) {
    desincronizada = hashMeta !== hashActual
  } else {
    // Plantilla aprobada/pendiente sin hash inicial → estado desconocido.
    // Mostramos la etiqueta de aviso pero no como error rojo fuerte.
    desincronizada = null
  }
  return { ...plantilla, hash_actual: hashActual, desincronizada }
}

/**
 * GET /api/whatsapp/plantillas — Listar plantillas locales.
 * Query params: canal_id (opcional, filtra por cuenta WA)
 */
export async function GET(request: NextRequest) {
  try {
    const { user } = await obtenerUsuarioRuta()
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const empresaId = user.app_metadata?.empresa_activa_id
    if (!empresaId) return NextResponse.json({ error: 'Sin empresa activa' }, { status: 403 })

    const admin = crearClienteAdmin()
    const canalId = request.nextUrl.searchParams.get('canal_id')

    let query = admin
      .from('plantillas_whatsapp')
      .select('*')
      .eq('empresa_id', empresaId)
      .order('orden', { ascending: true })
      .order('creado_en', { ascending: false })

    if (canalId) query = query.eq('canal_id', canalId)

    const { data, error } = await query
    if (error) {
      if (error.code === '42P01' || error.message?.includes('does not exist')) {
        return NextResponse.json({ plantillas: [] })
      }
      throw error
    }

    // Auto-backfill: plantillas que ya viven en Meta (APPROVED/PENDING/DISABLED/
    // PAUSED) pero nunca tuvieron hash — asumimos que el contenido actual en BD
    // coincide con lo aprobado en Meta y guardamos el hash. Así desaparece el
    // badge "Sin ref." de plantillas legacy sin tocar nada manualmente.
    // IMPORTANTE: solo se backfillea si el contenido no fue editado DESPUÉS de
    // la última sincronización con Meta. Si `actualizado_en > ultima_sincronizacion`
    // hay cambios locales pendientes — en ese caso conservamos `null` y el UI
    // lo marca como desincronizado correctamente.
    const paraBackfill = (data || []).filter(p => {
      const estado = p.estado_meta as EstadoMeta
      const necesita = ['APPROVED', 'PENDING', 'DISABLED', 'PAUSED'].includes(estado)
      if (!necesita || p.hash_componentes_meta) return false
      const sync = p.ultima_sincronizacion ? new Date(p.ultima_sincronizacion as string).getTime() : 0
      const upd = p.actualizado_en ? new Date(p.actualizado_en as string).getTime() : 0
      // Si la plantilla fue editada después de la última sync, NO asumir sincronizada.
      return sync >= upd
    })
    if (paraBackfill.length > 0) {
      await Promise.all(paraBackfill.map(p => {
        const componentes = p.componentes as ComponentesPlantillaWA
        const hash = calcularHashMeta(componentes || { cuerpo: { texto: '' } })
        // Escribimos el hash directo en la fila en memoria para que el enriquecimiento
        // de abajo vea la plantilla como sincronizada sin una segunda lectura.
        ;(p as Record<string, unknown>).hash_componentes_meta = hash
        return admin
          .from('plantillas_whatsapp')
          .update({ hash_componentes_meta: hash })
          .eq('id', p.id)
          .eq('empresa_id', empresaId)
      }))
    }

    const plantillas = (data || []).map(p => enriquecerPlantilla(p as Record<string, unknown>))
    return NextResponse.json({ plantillas })
  } catch (err) {
    console.error('Error al obtener plantillas WA:', err)
    return NextResponse.json({ plantillas: [] })
  }
}

/**
 * POST /api/whatsapp/plantillas — Acciones: guardar, enviar_a_meta, eliminar, sincronizar.
 */
export async function POST(request: NextRequest) {
  try {
    const { user } = await obtenerUsuarioRuta()
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const empresaId = user.app_metadata?.empresa_activa_id
    if (!empresaId) return NextResponse.json({ error: 'Sin empresa activa' }, { status: 403 })

    const body = await request.json()
    const { accion } = body
    const admin = crearClienteAdmin()

    // ─── REORDENAR (cambiar campo orden en lote) ───
    if (accion === 'reordenar') {
      const { ordenes } = body as { ordenes: Array<{ id: string; orden: number }> }
      if (!Array.isArray(ordenes)) {
        return NextResponse.json({ error: 'ordenes es requerido' }, { status: 400 })
      }
      await Promise.all(ordenes.map(o =>
        admin
          .from('plantillas_whatsapp')
          .update({ orden: o.orden, actualizado_en: new Date().toISOString() })
          .eq('id', o.id)
          .eq('empresa_id', empresaId),
      ))
      return NextResponse.json({ ok: true })
    }

    // ─── GUARDAR (crear o actualizar borrador local) ───
    if (accion === 'guardar') {
      const {
        id, canal_id, nombre, nombre_api, categoria, idioma, componentes,
        modulos, es_por_defecto, disponible_para, roles_permitidos, usuarios_permitidos,
      } = body

      if (!nombre || !nombre_api || !canal_id) {
        return NextResponse.json({ error: 'nombre, nombre_api y canal_id son requeridos' }, { status: 400 })
      }

      // Obtener nombre del usuario para auditoría
      const { data: perfil } = await admin
        .from('perfiles')
        .select('nombre, apellido')
        .eq('id', user.id)
        .single()
      const nombreUsuario = perfil ? `${perfil.nombre} ${perfil.apellido || ''}`.trim() : 'Usuario'

      const datos = {
        empresa_id: empresaId,
        canal_id,
        nombre,
        nombre_api,
        categoria: categoria || 'UTILITY',
        idioma: idioma || 'es',
        componentes: componentes || {},
        modulos: modulos || [],
        es_por_defecto: es_por_defecto || false,
        disponible_para: disponible_para || 'todos',
        roles_permitidos: roles_permitidos || [],
        usuarios_permitidos: usuarios_permitidos || [],
        actualizado_en: new Date().toISOString(),
      }

      if (id) {
        // Obtener estado + valores originales para auditoría
        const { data: existente } = await admin
          .from('plantillas_whatsapp')
          .select('*')
          .eq('id', id)
          .eq('empresa_id', empresaId)
          .single()

        if (!existente) {
          return NextResponse.json({ error: 'Plantilla no encontrada' }, { status: 404 })
        }

        // Se permite editar TODOS los campos incluso si la plantilla ya está
        // aprobada o en revisión en Meta: los cambios quedan locales hasta que
        // el usuario haga "Enviar a Meta" otra vez. Mientras tanto, el flag
        // `desincronizada` del GET avisa que lo que se envía al cliente puede
        // no coincidir con lo que Meta tiene aprobado.
        const datosUpdate: Record<string, unknown> = { ...datos }

        // Detectar cambios y registrar auditoría campo por campo
        const CAMPOS_AUDITABLES = [
          'nombre', 'nombre_api', 'categoria', 'idioma', 'componentes',
          'modulos', 'es_por_defecto', 'disponible_para', 'roles_permitidos', 'usuarios_permitidos',
        ] as const
        const cambios: Array<{ campo: string; antes: unknown; despues: unknown }> = []
        for (const campo of CAMPOS_AUDITABLES) {
          if (!(campo in datosUpdate)) continue
          const antes = (existente as Record<string, unknown>)[campo]
          const despues = (datosUpdate as Record<string, unknown>)[campo]
          if (JSON.stringify(antes) !== JSON.stringify(despues)) {
            cambios.push({ campo, antes, despues })
          }
        }

        if (cambios.length > 0) {
          const serializar = (v: unknown): string => {
            if (v === null || v === undefined) return ''
            if (typeof v === 'string') return v
            if (typeof v === 'number' || typeof v === 'boolean') return String(v)
            return JSON.stringify(v)
          }
          await admin.from('auditoria_plantillas_whatsapp').insert(
            cambios.map(c => ({
              empresa_id: empresaId,
              plantilla_id: id,
              editado_por: user.id,
              campo_modificado: c.campo,
              valor_anterior: serializar(c.antes),
              valor_nuevo: serializar(c.despues),
            })),
          )
          // Registrar evento en el timeline. Si lo que cambió afecta al payload
          // que viaja a Meta (componentes), lo indicamos en `metadata` para que
          // el UI pueda mostrar "tiene cambios pendientes de re-enviar".
          const afectaMeta = cambios.some(c => c.campo === 'componentes')
          await registrarEventoHistorial(admin, {
            empresaId,
            plantillaId: id,
            evento: 'editada',
            estadoPrevio: existente.estado_meta,
            estadoNuevo: existente.estado_meta,
            detalle: cambios.map(c => c.campo).join(', '),
            usuarioId: user.id,
            usuarioNombre: nombreUsuario,
            metadata: { afecta_meta: afectaMeta, campos: cambios.map(c => c.campo) },
          })
        }

        datosUpdate.editado_por = user.id
        datosUpdate.editado_por_nombre = nombreUsuario

        const { data, error } = await admin
          .from('plantillas_whatsapp')
          .update(datosUpdate)
          .eq('id', id)
          .eq('empresa_id', empresaId)
          .select()
          .single()

        if (error) throw error
        return NextResponse.json({ plantilla: enriquecerPlantilla(data as Record<string, unknown>) })
      } else {
        // Crear nueva
        const { data, error } = await admin
          .from('plantillas_whatsapp')
          .insert({
            ...datos,
            estado_meta: 'BORRADOR',
            creado_por: user.id,
            creado_por_nombre: nombreUsuario,
          })
          .select()
          .single()

        if (error) throw error
        await registrarEventoHistorial(admin, {
          empresaId,
          plantillaId: data.id,
          evento: 'creada',
          estadoNuevo: 'BORRADOR',
          usuarioId: user.id,
          usuarioNombre: nombreUsuario,
        })
        return NextResponse.json({ plantilla: enriquecerPlantilla(data as Record<string, unknown>) }, { status: 201 })
      }
    }

    // ─── ENVIAR A META (crear plantilla en Meta y cambiar estado a PENDING) ───
    if (accion === 'enviar_a_meta') {
      const { id, canal_id } = body
      if (!id || !canal_id) {
        return NextResponse.json({ error: 'id y canal_id son requeridos' }, { status: 400 })
      }

      // Obtener plantilla local
      const { data: plantilla } = await admin
        .from('plantillas_whatsapp')
        .select('*')
        .eq('id', id)
        .eq('empresa_id', empresaId)
        .single()

      if (!plantilla) return NextResponse.json({ error: 'Plantilla no encontrada' }, { status: 404 })

      // Obtener config del canal
      const { data: canal } = await admin
        .from('canales_whatsapp')
        .select('config_conexion')
        .eq('id', canal_id)
        .eq('empresa_id', empresaId)
        .single()

      if (!canal) return NextResponse.json({ error: 'Canal no encontrado' }, { status: 404 })

      const config = canal.config_conexion as unknown as ConfigCuentaWhatsApp
      const comp = plantilla.componentes as unknown as ComponentesPlantillaWA

      // Transformar componentes a formato Meta
      const componentesMeta = transformarAMeta(comp)
      const hashEnviado = calcularHashMeta(comp)

      // Nombre del usuario para el timeline
      const { data: perfil } = await admin
        .from('perfiles')
        .select('nombre, apellido')
        .eq('id', user.id)
        .single()
      const nombreUsuario = perfil ? `${perfil.nombre} ${perfil.apellido || ''}`.trim() : 'Usuario'

      try {
        // Si la plantilla ya existe en Meta (tiene `id_template_meta`) usamos
        // EDIT en lugar de CREATE. Meta rechaza crear una plantilla con mismo
        // nombre + idioma que ya existe (error_subcode 2388024 "Ya existe
        // contenido en este idioma"). EDIT actualiza el contenido y vuelve la
        // plantilla a revisión (PENDING).
        let idTemplateResultante: string
        if (plantilla.id_template_meta) {
          await editarPlantillaMeta(
            config,
            plantilla.id_template_meta,
            plantilla.categoria,
            componentesMeta,
          )
          idTemplateResultante = plantilla.id_template_meta
        } else {
          const resultado = await crearPlantillaMeta(
            config,
            plantilla.nombre_api,
            plantilla.idioma,
            plantilla.categoria,
            componentesMeta,
          )
          idTemplateResultante = resultado.id
        }

        // Actualizar estado local + guardar hash del snapshot enviado
        await admin
          .from('plantillas_whatsapp')
          .update({
            estado_meta: 'PENDING' as EstadoMeta,
            id_template_meta: idTemplateResultante,
            error_meta: null,
            hash_componentes_meta: hashEnviado,
            ultima_sincronizacion: new Date().toISOString(),
            actualizado_en: new Date().toISOString(),
          })
          .eq('id', id)

        await registrarEventoHistorial(admin, {
          empresaId,
          plantillaId: id,
          evento: 'enviada_a_meta',
          estadoPrevio: plantilla.estado_meta,
          estadoNuevo: 'PENDING',
          detalle: `Enviada a revisión en Meta (id: ${idTemplateResultante})`,
          usuarioId: user.id,
          usuarioNombre: nombreUsuario,
          metadata: { id_template_meta: idTemplateResultante },
        })

        return NextResponse.json({ ok: true, id_template_meta: idTemplateResultante })
      } catch (err) {
        // Guardar error
        await admin
          .from('plantillas_whatsapp')
          .update({
            estado_meta: 'ERROR' as EstadoMeta,
            error_meta: (err as Error).message,
            actualizado_en: new Date().toISOString(),
          })
          .eq('id', id)

        await registrarEventoHistorial(admin, {
          empresaId,
          plantillaId: id,
          evento: 'error',
          estadoPrevio: plantilla.estado_meta,
          estadoNuevo: 'ERROR',
          detalle: (err as Error).message,
          usuarioId: user.id,
          usuarioNombre: nombreUsuario,
        })

        return NextResponse.json({ error: (err as Error).message }, { status: 500 })
      }
    }

    // ─── ELIMINAR ───
    if (accion === 'eliminar') {
      const { id, canal_id } = body
      if (!id) return NextResponse.json({ error: 'id es requerido' }, { status: 400 })

      const { data: plantilla } = await admin
        .from('plantillas_whatsapp')
        .select('nombre_api, estado_meta')
        .eq('id', id)
        .eq('empresa_id', empresaId)
        .single()

      if (!plantilla) return NextResponse.json({ error: 'No encontrada' }, { status: 404 })

      // Si no es borrador/error, eliminar de Meta primero
      if (!['BORRADOR', 'ERROR'].includes(plantilla.estado_meta) && canal_id) {
        try {
          const { data: canal } = await admin
            .from('canales_whatsapp')
            .select('config_conexion')
            .eq('id', canal_id)
            .eq('empresa_id', empresaId)
            .single()

          if (canal) {
            const config = canal.config_conexion as unknown as ConfigCuentaWhatsApp
            await eliminarPlantillaMeta(config, plantilla.nombre_api)
          }
        } catch (err) {
          console.warn('Error eliminando de Meta (continuando eliminación local):', err)
        }
      }

      // Eliminar local
      await admin
        .from('plantillas_whatsapp')
        .delete()
        .eq('id', id)
        .eq('empresa_id', empresaId)

      return NextResponse.json({ ok: true })
    }

    // ─── SINCRONIZAR (traer estados desde Meta y actualizar locales + crear faltantes) ───
    if (accion === 'sincronizar') {
      const { canal_id } = body
      if (!canal_id) return NextResponse.json({ error: 'canal_id es requerido' }, { status: 400 })

      const { data: canal } = await admin
        .from('canales_whatsapp')
        .select('config_conexion')
        .eq('id', canal_id)
        .eq('empresa_id', empresaId)
        .single()

      if (!canal) return NextResponse.json({ error: 'Canal no encontrado' }, { status: 404 })

      const { data: perfilSync } = await admin
        .from('perfiles')
        .select('nombre, apellido')
        .eq('id', user.id)
        .single()
      const nombreUsuarioSync = perfilSync ? `${perfilSync.nombre} ${perfilSync.apellido || ''}`.trim() : 'Usuario'

      const config = canal.config_conexion as unknown as ConfigCuentaWhatsApp
      const plantillasMeta = await listarPlantillasMeta(config)

      // Obtener plantillas locales de este canal
      const { data: locales } = await admin
        .from('plantillas_whatsapp')
        .select('id, nombre_api, estado_meta, id_template_meta, componentes')
        .eq('empresa_id', empresaId)
        .eq('canal_id', canal_id)

      const localesPorNombre = new Map((locales || []).map(l => [l.nombre_api, l]))
      const ahora = new Date().toISOString()
      let sincronizadas = 0
      let creadas = 0

      for (const pm of plantillasMeta) {
        const local = localesPorNombre.get(pm.name)
        const estadoMeta = mapearEstadoMeta(pm.status)

        if (local) {
          // Si el estado cambió, registrar evento. Si la plantilla acaba de ser
          // aprobada, guardar el hash actual — Meta aprobó lo que hay localmente.
          const estadoCambio = local.estado_meta !== estadoMeta
          const actualizacion: Record<string, unknown> = {
            estado_meta: estadoMeta,
            id_template_meta: pm.id,
            error_meta: estadoMeta === 'REJECTED' ? (pm as unknown as Record<string, unknown>).rejected_reason as string || 'Rechazada por Meta' : null,
            ultima_sincronizacion: ahora,
            actualizado_en: ahora,
          }
          if (estadoCambio && estadoMeta === 'APPROVED') {
            const comp = local.componentes as unknown as ComponentesPlantillaWA
            actualizacion.hash_componentes_meta = calcularHashMeta(comp)
          }
          await admin
            .from('plantillas_whatsapp')
            .update(actualizacion)
            .eq('id', local.id)

          if (estadoCambio) {
            const mapaEvento: Record<string, string> = {
              APPROVED: 'aprobada',
              REJECTED: 'rechazada',
              DISABLED: 'deshabilitada',
              PAUSED: 'pausada',
              PENDING: 'enviada_a_meta',
            }
            await registrarEventoHistorial(admin, {
              empresaId,
              plantillaId: local.id,
              evento: mapaEvento[estadoMeta] || 'sincronizada',
              estadoPrevio: local.estado_meta,
              estadoNuevo: estadoMeta,
              detalle: estadoMeta === 'REJECTED'
                ? ((pm as unknown as Record<string, unknown>).rejected_reason as string || 'Rechazada por Meta')
                : 'Sincronizado desde Meta',
              usuarioId: user.id,
              usuarioNombre: nombreUsuarioSync,
            })
          }
          sincronizadas++
        } else {
          // Crear registro local para plantilla que existe en Meta pero no localmente
          const componentes = transformarDesdeMeta(pm.components || [])
          const { data: nueva } = await admin
            .from('plantillas_whatsapp')
            .insert({
              empresa_id: empresaId,
              canal_id,
              nombre: pm.name.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
              nombre_api: pm.name,
              categoria: pm.category as string,
              idioma: pm.language,
              componentes,
              estado_meta: estadoMeta,
              id_template_meta: pm.id,
              hash_componentes_meta: estadoMeta === 'APPROVED' ? calcularHashMeta(componentes) : null,
              ultima_sincronizacion: ahora,
              creado_por: user.id,
            })
            .select('id')
            .single()
          if (nueva) {
            await registrarEventoHistorial(admin, {
              empresaId,
              plantillaId: nueva.id,
              evento: 'sincronizada',
              estadoNuevo: estadoMeta,
              detalle: 'Importada desde Meta',
              usuarioId: user.id,
              usuarioNombre: nombreUsuarioSync,
            })
          }
          creadas++
        }
      }

      return NextResponse.json({ ok: true, sincronizadas, creadas, total_meta: plantillasMeta.length })
    }

    return NextResponse.json({ error: 'Acción no válida' }, { status: 400 })
  } catch (err) {
    console.error('Error en gestión de plantillas WA:', err)
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}

/** Mapea estado de Meta al estado local */
function mapearEstadoMeta(status: string): EstadoMeta {
  const mapa: Record<string, EstadoMeta> = {
    APPROVED: 'APPROVED',
    PENDING: 'PENDING',
    REJECTED: 'REJECTED',
    DISABLED: 'DISABLED',
    PAUSED: 'PAUSED',
    IN_APPEAL: 'PENDING',
  }
  return mapa[status] || 'PENDING'
}
