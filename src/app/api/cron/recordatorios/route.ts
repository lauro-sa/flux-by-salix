import { NextResponse, type NextRequest } from 'next/server'
import { crearClienteAdmin } from '@/lib/supabase/admin'
import { crearNotificacionesBatch } from '@/lib/notificaciones'
import { obtenerComponentesFecha } from '@/lib/formato-fecha'
import { resolverTelefonoNotif } from '@/lib/miembros/canal-notif'

/**
 * GET /api/cron/recordatorios — Cron que revisa recordatorios vencidos.
 * Ejecutado por Vercel Cron cada 15 minutos.
 *
 * Busca recordatorios activos cuya fecha+hora ya pasaron y:
 * 1. Crea notificaciones in-app + push
 * 2. Envía WhatsApp al usuario si notificar_whatsapp=true y tiene teléfono
 * Si el recordatorio es recurrente, calcula la próxima fecha y actualiza.
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

    // Cargar la zona horaria de cada empresa para comparar "hoy" y "hora" en la zona correcta.
    // Sin esto, comparábamos contra UTC — en AR (-03) un recordatorio a las 14:30 se disparaba
    // recién a las 14:30 UTC (11:30 AR), 3hs tarde.
    const { data: empresasTz } = await admin.from('empresas').select('id, zona_horaria')
    const zonaPorEmpresa = new Map<string, string>()
    for (const e of empresasTz || []) {
      zonaPorEmpresa.set(e.id, (e.zona_horaria as string) || 'America/Argentina/Buenos_Aires')
    }
    const zonaDefault = 'America/Argentina/Buenos_Aires'

    // Usamos el "hoy" máximo posible en cualquier zona (hoy+1 en UTC) para traer candidatos,
    // después filtramos por zona real.
    const hoyMaxISO = obtenerComponentesFecha(new Date(ahora.getTime() + 14 * 3600_000), 'UTC')
    const hoyMaxISOStr = `${hoyMaxISO.anio}-${String(hoyMaxISO.mes).padStart(2, '0')}-${String(hoyMaxISO.dia).padStart(2, '0')}`

    const { data: vencidos } = await admin
      .from('recordatorios')
      .select('*')
      .eq('completado', false)
      .lte('fecha', hoyMaxISOStr)
      .order('fecha', { ascending: true })
      .limit(200)

    if (!vencidos || vencidos.length === 0) {
      return NextResponse.json({ procesados: 0, timestamp: ahora.toISOString() })
    }

    // Filtrar por la fecha/hora "ahora" en la zona de cada empresa.
    const paraNotificar = vencidos.filter((r) => {
      const zona = zonaPorEmpresa.get(r.empresa_id as string) || zonaDefault
      const comp = obtenerComponentesFecha(ahora, zona)
      const hoyEmpresa = `${comp.anio}-${String(comp.mes).padStart(2, '0')}-${String(comp.dia).padStart(2, '0')}`
      const horaEmpresa = `${String(comp.hora).padStart(2, '0')}:${String(comp.minuto).padStart(2, '0')}`
      if (r.fecha < hoyEmpresa) return true           // Fecha pasada → siempre notificar
      if (r.fecha > hoyEmpresa) return false          // Fecha futura → no notificar aún
      if (!r.hora) return true                        // Hoy sin hora → notificar
      return (r.hora as string) <= horaEmpresa        // Hoy con hora → solo si ya pasó en la zona local
    })

    if (paraNotificar.length === 0) {
      return NextResponse.json({ procesados: 0, timestamp: ahora.toISOString() })
    }

    // Crear notificaciones
    const notificaciones = paraNotificar.map((r) => ({
      empresaId: r.empresa_id as string,
      usuarioId: r.asignado_a as string,
      tipo: 'recordatorio',
      titulo: `🔔 ${r.titulo as string}`,
      cuerpo: r.descripcion ? `Actividad · ${r.descripcion as string}` : undefined,
      icono: 'AlarmClock',
      color: 'var(--texto-marca)',
      url: undefined,
      referenciaTipo: 'recordatorio',
      referenciaId: r.id as string,
    }))

    await crearNotificacionesBatch(notificaciones)

    // Enviar WhatsApp a los que tienen notificar_whatsapp=true
    const paraWhatsApp = paraNotificar.filter((r) => r.notificar_whatsapp === true)
    let whatsappEnviados = 0

    if (paraWhatsApp.length > 0) {
      // Agrupar por empresa para cargar configs de WhatsApp una sola vez por empresa
      const porEmpresa = new Map<string, typeof paraWhatsApp>()
      for (const r of paraWhatsApp) {
        const lista = porEmpresa.get(r.empresa_id) || []
        lista.push(r)
        porEmpresa.set(r.empresa_id, lista)
      }

      for (const [empresaId, recordatorios] of porEmpresa) {
        try {
          // Obtener canal WhatsApp de la empresa
          const { data: canal } = await admin
            .from('canales_whatsapp')
            .select('id, config_conexion')
            .eq('empresa_id', empresaId)
            .eq('activo', true)
            .limit(1)
            .single()

          if (!canal) continue

          const config = canal.config_conexion as {
            tokenAcceso?: string
            phoneNumberId?: string
          }
          if (!config?.tokenAcceso || !config?.phoneNumberId) continue

          // Obtener teléfonos y nombres de los usuarios
          const usuarioIds = recordatorios.map((r) => r.asignado_a as string)
          const { data: perfiles } = await admin
            .from('perfiles')
            .select('id, nombre, telefono, telefono_empresa')
            .in('id', usuarioIds)

          // Cargar canal_notif_telefono de cada miembro para respetar la
          // elección del usuario. Si el canal elegido está vacío no se envía.
          const { data: miembrosCanal } = await admin
            .from('miembros')
            .select('usuario_id, canal_notif_telefono')
            .eq('empresa_id', empresaId)
            .in('usuario_id', usuarioIds)

          const canalMap = new Map<string, 'empresa' | 'personal'>()
          for (const m of (miembrosCanal || [])) {
            canalMap.set(m.usuario_id as string, (m.canal_notif_telefono as 'empresa' | 'personal') || 'empresa')
          }

          const telefonoMap = new Map<string, string>()
          const perfilesMap = new Map<string, { nombre: string }>()
          for (const p of (perfiles || [])) {
            perfilesMap.set(p.id, { nombre: p.nombre || '' })
            const tel = resolverTelefonoNotif({
              telefono: p.telefono as string | null,
              telefono_empresa: p.telefono_empresa as string | null,
              canal_notif_telefono: canalMap.get(p.id) || 'empresa',
            })
            if (tel) {
              const normalizado = tel.replace(/[^\d]/g, '')
              if (normalizado.length >= 8) telefonoMap.set(p.id, normalizado)
            }
          }

          // Verificar ventana de 24h: buscar último mensaje del empleado en conversaciones del copilot
          const hace24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

          // Enviar WhatsApp a cada usuario
          for (const r of recordatorios) {
            const telefono = telefonoMap.get(r.asignado_a as string)
            if (!telefono) continue

            // Verificar si el empleado escribió en las últimas 24h (ventana abierta)
            const { data: convReciente } = await admin
              .from('conversaciones_salix_ia')
              .select('id')
              .eq('empresa_id', empresaId)
              .eq('usuario_id', r.asignado_a as string)
              .eq('canal', 'whatsapp')
              .gte('actualizado_en', hace24h)
              .limit(1)

            const ventanaAbierta = convReciente && convReciente.length > 0
            const titulo = r.titulo as string
            const horaTexto = r.hora ? `para las ${r.hora}` : 'para hoy'

            // Obtener nombre del usuario
            const perfilUsuario = perfilesMap.get(r.asignado_a as string)
            const nombreCorto = perfilUsuario?.nombre?.split(' ')[0] || ''

            // Mensaje personalizado guardado por el copilot, o generar uno natural
            const textoLibre = (r.mensaje_whatsapp as string) || generarMensajeNatural(nombreCorto, titulo, r.descripcion as string | null, horaTexto)

            // Variables para la plantilla (fuera de ventana 24h)
            const detallePlantilla = r.descripcion ? `${r.descripcion as string} — ${r.hora ? `A las ${r.hora}` : 'Hoy'}` : (r.hora ? `A las ${r.hora}` : 'Recordatorio del día')

            try {
              if (ventanaAbierta) {
                // Ventana 24h abierta → texto libre natural
                const texto = textoLibre
                await fetch(`https://graph.facebook.com/v21.0/${config.phoneNumberId}/messages`, {
                  method: 'POST',
                  headers: {
                    Authorization: `Bearer ${config.tokenAcceso}`,
                    'Content-Type': 'application/json',
                  },
                  body: JSON.stringify({
                    messaging_product: 'whatsapp',
                    to: telefono,
                    type: 'text',
                    text: { body: texto },
                  }),
                })
              } else {
                // Ventana cerrada → plantilla aprobada (siempre funciona)
                await fetch(`https://graph.facebook.com/v21.0/${config.phoneNumberId}/messages`, {
                  method: 'POST',
                  headers: {
                    Authorization: `Bearer ${config.tokenAcceso}`,
                    'Content-Type': 'application/json',
                  },
                  body: JSON.stringify({
                    messaging_product: 'whatsapp',
                    to: telefono,
                    type: 'template',
                    template: {
                      name: 'flux_recordatorio',
                      language: { code: 'es' },
                      components: [{
                        type: 'body',
                        parameters: [
                          { type: 'text', text: titulo },
                          { type: 'text', text: detallePlantilla },
                        ],
                      }],
                    },
                  }),
                })
              }
              whatsappEnviados++
            } catch (err) {
              console.error(`[Cron Recordatorios] Error enviando WA a ${telefono}:`, err)
            }
          }
        } catch (err) {
          console.error(`[Cron Recordatorios] Error procesando empresa ${empresaId}:`, err)
        }
      }
    }

    // Procesar recurrentes: calcular próxima fecha y actualizar
    // Agrupar por tipo de operación para hacer batch updates
    const idsCompletar: string[] = []
    const reprogramaciones: { id: string; fecha: string }[] = []

    for (const r of paraNotificar) {
      if (r.repetir === 'ninguno') {
        idsCompletar.push(r.id)
      } else {
        const proximaFecha = calcularProximaFecha(r.fecha, r.repetir, r.recurrencia)
        if (proximaFecha) {
          reprogramaciones.push({ id: r.id, fecha: proximaFecha })
        } else {
          idsCompletar.push(r.id)
        }
      }
    }

    // Batch: marcar como completados en 1 query
    if (idsCompletar.length > 0) {
      await admin
        .from('recordatorios')
        .update({ completado: true, completado_en: ahora.toISOString() })
        .in('id', idsCompletar)
    }

    // Reprogramaciones: agrupar por fecha para reducir queries
    const porFecha = new Map<string, string[]>()
    for (const r of reprogramaciones) {
      const ids = porFecha.get(r.fecha) || []
      ids.push(r.id)
      porFecha.set(r.fecha, ids)
    }
    for (const [fecha, ids] of porFecha) {
      await admin
        .from('recordatorios')
        .update({ fecha })
        .in('id', ids)
    }

    const completados = idsCompletar.length
    const reprogramados = reprogramaciones.length

    return NextResponse.json({
      procesados: paraNotificar.length,
      notificaciones_creadas: notificaciones.length,
      whatsapp_enviados: whatsappEnviados,
      completados,
      reprogramados,
      timestamp: ahora.toISOString(),
    })
  } catch (err) {
    console.error('Error en cron recordatorios:', err)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

/**
 * Genera un mensaje de WhatsApp natural/humano para un recordatorio.
 * Varía el tono aleatoriamente para que no se sienta repetitivo.
 */
function generarMensajeNatural(nombre: string, titulo: string, descripcion: string | null, horaTexto: string): string {
  const saludos = [
    `Ey ${nombre}, te recuerdo que tenés pendiente:`,
    `${nombre}, acordate:`,
    `Hola ${nombre} 👋 Te dejo tu recordatorio:`,
    `${nombre}, no te olvides:`,
    `Te aviso ${nombre}:`,
  ]

  const saludo = saludos[Math.floor(Math.random() * saludos.length)]
  const partes = [saludo, '', `*${titulo}*`]

  if (descripcion) partes.push(descripcion)
  partes.push(`⏰ ${horaTexto}`)

  return partes.join('\n')
}

/**
 * Calcula la próxima fecha de un recordatorio recurrente.
 */
function calcularProximaFecha(
  fechaActual: string,
  repetir: string,
  _recurrencia?: unknown,
): string | null {
  const fecha = new Date(fechaActual + 'T12:00:00')
  const hoy = new Date()
  hoy.setHours(12, 0, 0, 0)

  switch (repetir) {
    case 'diario':
      fecha.setDate(fecha.getDate() + 1)
      break
    case 'semanal':
      fecha.setDate(fecha.getDate() + 7)
      break
    case 'mensual':
      fecha.setMonth(fecha.getMonth() + 1)
      break
    case 'anual':
      fecha.setFullYear(fecha.getFullYear() + 1)
      break
    default:
      return null
  }

  // Si la fecha calculada aún está en el pasado, avanzar hasta el futuro
  while (fecha < hoy) {
    switch (repetir) {
      case 'diario':
        fecha.setDate(fecha.getDate() + 1)
        break
      case 'semanal':
        fecha.setDate(fecha.getDate() + 7)
        break
      case 'mensual':
        fecha.setMonth(fecha.getMonth() + 1)
        break
      case 'anual':
        fecha.setFullYear(fecha.getFullYear() + 1)
        break
    }
  }

  return fecha.toISOString().split('T')[0]
}
