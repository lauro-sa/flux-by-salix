import { NextResponse, type NextRequest } from 'next/server'
import { crearClienteAdmin } from '@/lib/supabase/admin'
import { crearNotificacion } from '@/lib/notificaciones'

/**
 * GET /api/cron/mantenimiento — Limpieza y mantenimiento general de datos.
 * Ejecutado por Vercel Cron diariamente a las 2:00 AM.
 *
 * Tareas:
 * 1. Purgar papelera: elimina permanentemente registros con en_papelera=true > 30 días
 *    - contactos, presupuestos, productos, actividades, eventos_calendario, conversaciones, visitas
 *    - Limpia archivos de Storage asociados (chatter adjuntos)
 * 2. Archivar visitas completadas > 30 días (marca archivada=true)
 * 3. Rotar logs del agente IA > 90 días
 * 4. Limpiar tablas de auditoría > 365 días
 * 5. Purgar recordatorios_calendario enviados > 30 días
 * 6. Purgar mensajes programados (WhatsApp + correo) enviados/error > 60 días
 */
export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET

    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const admin = crearClienteAdmin()
    const ahora = new Date()
    const resultado: Record<string, number> = {}

    // ─── Fechas de corte ──────────────────────────────────────
    const hace30dias = new Date(ahora)
    hace30dias.setDate(hace30dias.getDate() - 30)

    const hace60dias = new Date(ahora)
    hace60dias.setDate(hace60dias.getDate() - 60)

    const hace90dias = new Date(ahora)
    hace90dias.setDate(hace90dias.getDate() - 90)

    const hace365dias = new Date(ahora)
    hace365dias.setDate(hace365dias.getDate() - 365)

    const hace2anios = new Date(ahora)
    hace2anios.setFullYear(hace2anios.getFullYear() - 2)

    // ─── 1. PURGAR PAPELERA ──────────────────────────────────
    // Tablas con en_papelera que llevan más de 30 días eliminadas
    const tablasPapelera = [
      'contactos',
      'presupuestos',
      'productos',
      'actividades',
      'eventos_calendario',
      'conversaciones',
      'visitas',
    ] as const

    for (const tabla of tablasPapelera) {
      // Antes de borrar, limpiar adjuntos de chatter asociados en Storage
      if (['contactos', 'visitas', 'presupuestos', 'actividades'].includes(tabla)) {
        await limpiarAdjuntosChatter(admin, tabla, hace30dias)
      }

      const { count } = await admin
        .from(tabla)
        .delete({ count: 'exact' })
        .eq('en_papelera', true)
        .lt('papelera_en', hace30dias.toISOString())

      resultado[`papelera_${tabla}`] = count || 0
    }

    // ─── 2. ARCHIVAR VISITAS COMPLETADAS > 30 DÍAS ───────────
    const { count: visitasArchivadas } = await admin
      .from('visitas')
      .update({
        archivada: true,
        archivada_en: ahora.toISOString(),
      }, { count: 'exact' })
      .eq('estado', 'completada')
      .eq('archivada', false)
      .eq('en_papelera', false)
      .lt('fecha_completada', hace30dias.toISOString())

    resultado.visitas_archivadas = visitasArchivadas || 0

    // ─── 3. ROTAR LOGS DEL AGENTE IA > 90 DÍAS ──────────────
    const { count: logsIA } = await admin
      .from('log_agente_ia')
      .delete({ count: 'exact' })
      .lt('creado_en', hace90dias.toISOString())

    resultado.logs_ia_borrados = logsIA || 0

    // ─── 4. LIMPIAR TABLAS DE AUDITORÍA > 365 DÍAS ──────────
    const { count: auditPermisos } = await admin
      .from('permisos_auditoria')
      .delete({ count: 'exact' })
      .lt('creado_en', hace365dias.toISOString())

    resultado.audit_permisos_borrados = auditPermisos || 0

    const { count: auditAsistencias } = await admin
      .from('auditoria_asistencias')
      .delete({ count: 'exact' })
      .lt('creado_en', hace365dias.toISOString())

    resultado.audit_asistencias_borrados = auditAsistencias || 0

    const { count: historialPresupuestos } = await admin
      .from('presupuesto_historial')
      .delete({ count: 'exact' })
      .lt('fecha', hace365dias.toISOString())

    resultado.historial_presupuestos_borrados = historialPresupuestos || 0

    // ─── 5. RECORDATORIOS CALENDARIO ENVIADOS > 30 DÍAS ─────
    const { count: recordatoriosCal } = await admin
      .from('recordatorios_calendario')
      .delete({ count: 'exact' })
      .eq('enviado', true)
      .lt('enviado_en', hace30dias.toISOString())

    resultado.recordatorios_calendario_borrados = recordatoriosCal || 0

    // ─── 6. MENSAJES PROGRAMADOS ENVIADOS/ERROR > 60 DÍAS ───
    const { count: waProgramados } = await admin
      .from('whatsapp_programados')
      .delete({ count: 'exact' })
      .in('estado', ['enviado', 'error', 'cancelado'])
      .lt('creado_en', hace60dias.toISOString())

    resultado.wa_programados_borrados = waProgramados || 0

    const { count: correoProgramados } = await admin
      .from('correos_programados')
      .delete({ count: 'exact' })
      .in('estado', ['enviado', 'error', 'cancelado'])
      .lt('creado_en', hace60dias.toISOString())

    resultado.correo_programados_borrados = correoProgramados || 0

    // ─── 7. INVITACIONES EXPIRADAS ──────────────────────────
    const { count: invitacionesExpiradas } = await admin
      .from('invitaciones')
      .delete({ count: 'exact' })
      .lt('expira_en', ahora.toISOString())
      .eq('usado', false)

    resultado.invitaciones_expiradas_borradas = invitacionesExpiradas || 0

    // ─── 8. PORTAL TOKENS EXPIRADOS > 90 DÍAS ──────────────
    const { count: tokensExpirados } = await admin
      .from('portal_tokens')
      .delete({ count: 'exact' })
      .lt('expira_en', hace90dias.toISOString())

    resultado.portal_tokens_expirados_borrados = tokensExpirados || 0

    // ─── 9. RETENCIÓN DE MENSAJES > 2 AÑOS ──────────────────
    // Borra mensajes (emails, WhatsApp, internos) de más de 2 años.
    // Lo importante (presupuestos, actividades, visitas, chatter) se queda.
    // Primero borrar adjuntos de Storage, luego mensajes, luego conversaciones vacías.
    try {
      // Buscar adjuntos de mensajes viejos para limpiar Storage
      const { data: adjuntosViejos } = await admin
        .from('mensaje_adjuntos')
        .select('id, storage_path, empresa_id, tamano_bytes')
        .lt('creado_en', hace2anios.toISOString())
        .limit(500)

      if (adjuntosViejos && adjuntosViejos.length > 0) {
        // Eliminar de Storage en lotes
        const pathsPorBucket: Record<string, string[]> = {}
        for (const adj of adjuntosViejos) {
          if (!adj.storage_path) continue
          const bucket = adj.storage_path.split('/')[0] || 'adjuntos'
          const ruta = adj.storage_path.includes('/') ? adj.storage_path : adj.storage_path
          if (!pathsPorBucket[bucket]) pathsPorBucket[bucket] = []
          pathsPorBucket[bucket].push(ruta)
        }

        for (const [bucket, paths] of Object.entries(pathsPorBucket)) {
          for (let i = 0; i < paths.length; i += 100) {
            await admin.storage.from(bucket).remove(paths.slice(i, i + 100))
          }
        }

        // Eliminar registros de adjuntos
        await admin
          .from('mensaje_adjuntos')
          .delete()
          .in('id', adjuntosViejos.map(a => a.id))

        resultado.adjuntos_mensajes_viejos_borrados = adjuntosViejos.length
      } else {
        resultado.adjuntos_mensajes_viejos_borrados = 0
      }

      // Borrar mensajes > 2 años (soft-deleted o no)
      const { count: mensajesBorrados } = await admin
        .from('mensajes')
        .delete({ count: 'exact' })
        .lt('creado_en', hace2anios.toISOString())

      resultado.mensajes_viejos_borrados = mensajesBorrados || 0
    } catch (err) {
      console.error('Error limpiando mensajes viejos:', err)
      resultado.mensajes_viejos_borrados = -1
    }

    // ─── 8. ALERTAS DE CUOTA DE STORAGE ─────────────────────
    try {
      // Obtener empresas con su cuota y uso
      const { data: empresas } = await admin
        .from('empresas')
        .select('id, nombre, cuota_storage_bytes')

      if (empresas) {
        for (const empresa of empresas) {
          const cuota = empresa.cuota_storage_bytes || (2 * 1024 * 1024 * 1024)

          // Sumar uso total de la empresa
          const { data: usos } = await admin
            .from('uso_storage')
            .select('bytes_usados')
            .eq('empresa_id', empresa.id)

          const bytesTotales = (usos || []).reduce((s, u) => s + u.bytes_usados, 0)
          const porcentaje = Math.round((bytesTotales / cuota) * 100)

          // Alertar a admins/owners si > 80%
          if (porcentaje >= 80) {
            const { data: admins } = await admin
              .from('miembros')
              .select('usuario_id')
              .eq('empresa_id', empresa.id)
              .in('rol', ['admin', 'owner'])
              .eq('activo', true)

            const nivel = porcentaje >= 95 ? 'crítico' : porcentaje >= 90 ? 'alto' : 'moderado'
            const usadoGB = (bytesTotales / (1024 * 1024 * 1024)).toFixed(2)
            const limiteGB = (cuota / (1024 * 1024 * 1024)).toFixed(1)

            for (const adm of admins || []) {
              await crearNotificacion({
                empresaId: empresa.id,
                usuarioId: adm.usuario_id,
                tipo: 'sistema',
                titulo: `Almacenamiento ${nivel}: ${porcentaje}% usado`,
                cuerpo: `${usadoGB} GB de ${limiteGB} GB. Libera espacio o aumenta tu plan.`,
                icono: 'hard-drive',
                color: porcentaje >= 95 ? 'error' : porcentaje >= 90 ? 'advertencia' : 'info',
                url: '/configuracion',
                referenciaTipo: 'storage',
                referenciaId: empresa.id,
              })
            }
          }
        }
      }
    } catch (err) {
      console.error('Error verificando cuotas de storage:', err)
    }

    return NextResponse.json({
      ...resultado,
      timestamp: ahora.toISOString(),
    })
  } catch (err) {
    console.error('Error en cron mantenimiento:', err)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

/**
 * Limpia archivos de Storage vinculados a entidades que están en papelera.
 * Busca entradas de chatter con adjuntos y elimina los archivos de Supabase Storage.
 */
async function limpiarAdjuntosChatter(
  admin: ReturnType<typeof crearClienteAdmin>,
  entidadTipo: string,
  fechaCorte: Date
) {
  try {
    // Buscar IDs de entidades en papelera que van a ser purgadas
    const { data: entidades } = await admin
      .from(entidadTipo)
      .select('id')
      .eq('en_papelera', true)
      .lt('papelera_en', fechaCorte.toISOString())
      .limit(200)

    if (!entidades || entidades.length === 0) return

    const entidadIds = entidades.map(e => e.id)

    // Buscar chatter con adjuntos para estas entidades
    // El tipo de entidad en chatter puede ser singular
    const tipoChatter = entidadTipo === 'contactos' ? 'contacto'
      : entidadTipo === 'visitas' ? 'visita'
      : entidadTipo === 'presupuestos' ? 'presupuesto'
      : entidadTipo === 'actividades' ? 'actividad'
      : entidadTipo

    const { data: chatters } = await admin
      .from('chatter')
      .select('adjuntos')
      .eq('entidad_tipo', tipoChatter)
      .in('entidad_id', entidadIds)
      .not('adjuntos', 'is', null)

    if (!chatters || chatters.length === 0) return

    // Extraer rutas de Storage de los adjuntos
    const rutasStorage: string[] = []

    for (const chat of chatters) {
      const adjuntos = chat.adjuntos as Array<{ url?: string; nombre?: string }> | null
      if (!Array.isArray(adjuntos)) continue

      for (const adj of adjuntos) {
        if (!adj.url) continue
        // Extraer ruta relativa del URL público de Supabase Storage
        // Formato: https://xxx.supabase.co/storage/v1/object/public/documentos-pdf/empresaId/chatter/...
        const match = adj.url.match(/\/storage\/v1\/object\/public\/documentos-pdf\/(.+)/)
        if (match?.[1]) {
          rutasStorage.push(match[1])
        }
      }
    }

    // Eliminar archivos en lotes de 100
    for (let i = 0; i < rutasStorage.length; i += 100) {
      const lote = rutasStorage.slice(i, i + 100)
      await admin.storage.from('documentos-pdf').remove(lote)
    }

    // Eliminar registros de chatter asociados
    await admin
      .from('chatter')
      .delete()
      .eq('entidad_tipo', tipoChatter)
      .in('entidad_id', entidadIds)
  } catch (err) {
    // No fallar el cron por errores de limpieza de Storage
    console.error(`Error limpiando adjuntos de ${entidadTipo}:`, err)
  }
}
