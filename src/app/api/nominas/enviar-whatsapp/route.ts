import { NextResponse, type NextRequest } from 'next/server'
import { obtenerUsuarioRuta } from '@/lib/supabase/servidor'
import { crearClienteAdmin } from '@/lib/supabase/admin'
import { verificarPermiso, obtenerDatosMiembro } from '@/lib/permisos-servidor'
import { enviarPlantillaWhatsApp, type ConfigCuentaWhatsApp } from '@/lib/whatsapp'
import { normalizarTelefono } from '@/lib/validaciones'
import { generarPdfRecibo } from '@/lib/nominas/generar-pdf-recibo'
import {
  diagnosticarCredencialesCanal,
  etiquetaFaltantesCanal,
  leerTokenAcceso,
  leerPhoneNumberId,
  leerWabaId,
  leerNumeroTelefono,
  type CredencialesCanalWA,
} from '@/lib/whatsapp/canal-credenciales'
import {
  construirDatosPlantilla,
  resolverParametrosCuerpo,
  resolverTextoPlantilla,
} from '@/lib/whatsapp/variables'
import { construirLineasAjustes } from '@/lib/nominas/lineas-ajustes'
import {
  asegurarConversacionEmpleado,
  registrarMensajeEmpleado,
} from '@/lib/conversaciones/empleados'

/**
 * POST /api/nominas/enviar-whatsapp — Enviar recibos de nómina por WhatsApp.
 * Usa la plantilla aprobada `recibo_haberes_nomina` con variables resueltas por empleado.
 *
 * Body:
 *   canal_id: string — canal de WhatsApp
 *   plantilla_id: string — ID de la plantilla en BD
 *   empleados: { nombre, telefono, dias_trabajados, dias_laborales, dias_a_horario, dias_tardanza, horas_netas, monto_bruto, compensacion_detalle, periodo }[]
 */
export async function POST(request: NextRequest) {
  try {
    const { user } = await obtenerUsuarioRuta()
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const empresaId = user.app_metadata?.empresa_activa_id
    if (!empresaId) return NextResponse.json({ error: 'Sin empresa activa' }, { status: 403 })

    // Debe poder enviar por WhatsApp Y tener permiso de enviar nómina.
    const datosMiembro = await obtenerDatosMiembro(user.id, empresaId)
    if (!datosMiembro) return NextResponse.json({ error: 'Sin empresa' }, { status: 403 })
    if (!verificarPermiso(datosMiembro, 'inbox_whatsapp', 'enviar')) {
      return NextResponse.json({ error: 'Sin permiso para enviar WhatsApp' }, { status: 403 })
    }
    if (!verificarPermiso(datosMiembro, 'nomina', 'enviar')) {
      return NextResponse.json({ error: 'Sin permiso para enviar recibos de nómina' }, { status: 403 })
    }

    const body = await request.json()
    const { canal_id, plantilla_id, empleados, periodo_desde, periodo_hasta } = body as {
      canal_id: string
      plantilla_id: string
      // Rango de fechas del período — usado para filtrar las cuotas de adelantos
      // que entran en el recibo. Si no llega, no se incluye `detalle_descuentos`.
      periodo_desde?: string
      periodo_hasta?: string
      empleados: {
        miembro_id?: string
        nombre: string
        telefono: string
        dias_trabajados: number
        dias_laborales: number
        dias_a_horario: number
        dias_tardanza: number
        monto_pagar?: number
        monto_bruto: string
        monto_neto?: number
        descuento_adelanto?: number
        /** Bonos del período (suman al neto). Variable nueva post sql/092. */
        bonos_periodo?: number
        saldo_anterior?: number
        compensacion_detalle: string
        periodo: string
      }[]
    }

    if (!canal_id) return NextResponse.json({ error: 'canal_id requerido' }, { status: 400 })
    if (!plantilla_id) return NextResponse.json({ error: 'plantilla_id requerido' }, { status: 400 })
    if (!empleados?.length) return NextResponse.json({ error: 'Sin empleados' }, { status: 400 })

    const admin = crearClienteAdmin()

    // Obtener plantilla y verificar que esté aprobada
    const { data: plantilla } = await admin
      .from('plantillas_whatsapp')
      .select('nombre_api, idioma, estado_meta, componentes')
      .eq('id', plantilla_id)
      .eq('empresa_id', empresaId)
      .single()

    if (!plantilla) return NextResponse.json({ error: 'Plantilla no encontrada' }, { status: 404 })
    if (plantilla.estado_meta !== 'APPROVED') {
      return NextResponse.json({ error: 'La plantilla debe estar aprobada por Meta para enviar' }, { status: 400 })
    }

    // Obtener config del canal de WhatsApp
    const { data: canal } = await admin
      .from('canales_whatsapp')
      .select('config_conexion')
      .eq('id', canal_id)
      .eq('empresa_id', empresaId)
      .single()

    if (!canal) return NextResponse.json({ error: 'Canal de WhatsApp no encontrado' }, { status: 404 })

    const configConexion = canal.config_conexion as CredencialesCanalWA
    // Validar credenciales antes de tocar Meta. Los aliases (camelCase/snake_case)
    // se resuelven dentro de los lectores — así da igual cómo quedó guardado
    // el canal originalmente.
    const diag = diagnosticarCredencialesCanal(configConexion)
    if (!diag.validas) {
      return NextResponse.json({
        error: `El canal de WhatsApp no tiene credenciales completas. Falta: ${etiquetaFaltantesCanal(diag)}. Reconectalo desde Inbox → Configuración → Canales.`,
        code: 'canal_sin_credenciales',
        faltantes: diag.faltantes,
      }, { status: 400 })
    }
    const config: ConfigCuentaWhatsApp = {
      phoneNumberId: leerPhoneNumberId(configConexion),
      wabaId: leerWabaId(configConexion),
      tokenAcceso: leerTokenAcceso(configConexion),
      numeroTelefono: leerNumeroTelefono(configConexion),
    }

    const nombreApi = plantilla.nombre_api as string
    const idioma = (plantilla.idioma as string) || 'es'
    const componentesPlantilla = plantilla.componentes as {
      cuerpo?: { texto: string; mapeo_variables?: string[]; ejemplos?: string[] }
      encabezado?: { tipo?: string; texto?: string; mapeo_variable?: string }
      pie_pagina?: { texto?: string }
    }

    // Enviar a cada empleado
    const resultados: { telefono: string; nombre: string; ok: boolean; error?: string }[] = []

    for (const emp of empleados) {
      if (!emp.telefono) {
        // El frontend arma este payload usando el teléfono del canal elegido
        // del miembro (canal_notif_telefono). Si está vacío, no se envía.
        resultados.push({ telefono: '', nombre: emp.nombre, ok: false, error: 'Sin teléfono en el canal elegido' })
        continue
      }

      // Cargar ajustes del período (adelantos / descuentos / bonos) usando
      // el helper compartido. Devuelve dos listas separadas:
      //   - `descuentos`: lo que RESTA al neto (adelantos + descuentos
      //     puntuales + saldo a favor del período anterior). Compat con
      //     plantillas legacy que usan `detalle_descuentos`.
      //   - `bonos`: lo que SUMA al neto (bonos one-off del período).
      //     Variable nueva para plantillas WA con bloque de pagos extra.
      let detalleDescuentos = ''
      let detalleBonos = ''
      let lineasDescuentos: string[] = []
      let lineasBonos: string[] = []
      if (emp.miembro_id && periodo_desde && periodo_hasta) {
        const { data: adelantos } = await admin
          .from('adelantos_nomina')
          .select('id, tipo, notas, fecha_solicitud, estado, cuotas_totales, adelantos_cuotas(numero_cuota, fecha_programada, monto_cuota)')
          .eq('miembro_id', emp.miembro_id)
          .eq('empresa_id', empresaId)
          .eq('eliminado', false)
        const { descuentos, bonos } = construirLineasAjustes(
          adelantos || [],
          periodo_desde,
          periodo_hasta,
          { saldoAnterior: Number(emp.saldo_anterior || 0) },
        )
        lineasDescuentos = descuentos
        lineasBonos = bonos
        detalleDescuentos = lineasDescuentos.join('\n') || '_Sin adelantos ni descuentos en el período._'
        detalleBonos = lineasBonos.join('\n') || '_Sin bonos ni pagos extra en el período._'
      }

      // ─── Link al PDF del recibo (si hay pago grabado del período) ───
      // El destinatario abre el WhatsApp y desde ahí puede tocar el link y
      // ver el recibo en el navegador. URL firmada con expiración larga
      // (30 días) porque el empleado puede tardar en revisar el mensaje.
      // Guardamos `pagoIdActual` para marcar `recibo_whatsapp_enviado_*`
      // si el envío termina OK.
      let enlaceRecibo = ''
      let pagoIdActual: string | null = null
      if (emp.miembro_id && periodo_desde && periodo_hasta) {
        try {
          const { data: pago } = await admin
            .from('pagos_nomina')
            .select('id')
            .eq('empresa_id', empresaId)
            .eq('miembro_id', emp.miembro_id)
            .eq('fecha_inicio_periodo', periodo_desde)
            .eq('fecha_fin_periodo', periodo_hasta)
            .eq('eliminado', false)
            .order('creado_en', { ascending: false })
            .limit(1)
            .maybeSingle()
          if (pago) {
            pagoIdActual = pago.id as string
            const { url } = await generarPdfRecibo(admin, pago.id, empresaId, {
              expiracionSegundos: 60 * 60 * 24 * 30, // 30 días
            })
            enlaceRecibo = url
          }
        } catch (errPdf) {
          console.error('[nominas/enviar-whatsapp] error al generar PDF:', errPdf)
          // Seguimos sin enlace: el cuerpo del mensaje todavía va.
        }
      }

      // Resolver variables usando el mapeo de la plantilla — así si mañana
      // se agregan/quitan variables, el código no necesita cambios.
      const datos = construirDatosPlantilla({
        nomina: {
          nombre: emp.nombre,
          periodo: emp.periodo,
          dias_trabajados: emp.dias_trabajados,
          dias_laborales: emp.dias_laborales,
          dias_tardanza: emp.dias_tardanza,
          monto_pagar: emp.monto_pagar ?? (Number(String(emp.monto_bruto).replace(/[^\d.-]/g, '')) || 0),
          monto_neto: emp.monto_neto,
          descuento_adelanto: emp.descuento_adelanto || 0,
          // Bonos del período (suman al neto). Se exponen también
          // como `bonos_lista` y `detalle_bonos` para que plantillas
          // WA armen un bloque de pagos extra.
          bonos_periodo: emp.bonos_periodo || 0,
          saldo_anterior: emp.saldo_anterior || 0,
          monto_detalle: emp.compensacion_detalle,
          detalle_descuentos: detalleDescuentos,
          descuentos_lista: lineasDescuentos,
          detalle_bonos: detalleBonos,
          bonos_lista: lineasBonos,
          // Disponible para que las plantillas WA incluyan {{nomina.enlace_recibo}}.
          // Si no hay pago grabado en el período, queda string vacío.
          enlace_recibo: enlaceRecibo,
        },
      })

      const paramsCuerpo = resolverParametrosCuerpo(componentesPlantilla.cuerpo, datos) || []
      // Header: si hay `mapeo_variable`, usamos el dato real; si no, fallback al período.
      const claveHeader = componentesPlantilla.encabezado?.mapeo_variable
      const valorHeader = (claveHeader && datos[claveHeader]) || emp.periodo

      const componentesMeta: Array<{ type: string; parameters: Array<{ type: string; text: string }> }> = []
      if (componentesPlantilla.encabezado?.tipo === 'TEXT' && componentesPlantilla.encabezado?.texto?.includes('{{1}}')) {
        componentesMeta.push({
          type: 'header',
          parameters: [{ type: 'text', text: valorHeader }],
        })
      }
      if (paramsCuerpo.length > 0) {
        componentesMeta.push({
          type: 'body',
          parameters: paramsCuerpo,
        })
      }

      // Normalizar al formato E.164 canónico antes de enviar a Meta (con el 9 para AR)
      const telCanonico = normalizarTelefono(emp.telefono) || emp.telefono

      // Asegurar conversación perpetua del empleado en la bandeja para que el
      // recibo aparezca en el chat con tracking de status (sent/delivered/read).
      // Si no se conoce el miembro, igual se envía pero sin registro.
      let conversacionEmpleadoId: string | null = null
      if (emp.miembro_id) {
        conversacionEmpleadoId = await asegurarConversacionEmpleado({
          admin,
          empresa_id: empresaId,
          miembro_id: emp.miembro_id,
          tipo_canal: 'whatsapp',
          canal_id,
          identificador_externo: telCanonico,
          contacto_nombre: emp.nombre,
        })
      }

      // Cuerpo completo de la plantilla con variables ya resueltas. Es lo que
      // se guarda en `mensajes.texto` para que el chat del empleado muestre el
      // recibo entero (días, montos, descuentos, encabezado, pie), no un preview.
      const cuerpoResuelto = resolverTextoPlantilla(
        componentesPlantilla.cuerpo?.texto || '',
        componentesPlantilla.cuerpo,
        datos,
      )
      const headerResuelto = componentesPlantilla.encabezado?.tipo === 'TEXT'
        ? (componentesPlantilla.encabezado.texto || '').replace(/\{\{1\}\}/g, valorHeader)
        : ''
      const pieResuelto = (componentesPlantilla.pie_pagina?.texto || '').trim()
      const textoMensaje = [
        headerResuelto ? `*${headerResuelto}*` : '',
        cuerpoResuelto,
        pieResuelto,
      ]
        .filter(Boolean)
        .join('\n\n')

      try {
        const respuestaMeta = await enviarPlantillaWhatsApp(config, `+${telCanonico}`, nombreApi, idioma, componentesMeta)
        const waMessageId = respuestaMeta.messages?.[0]?.id || null

        if (conversacionEmpleadoId) {
          await registrarMensajeEmpleado({
            admin,
            empresa_id: empresaId,
            conversacion_id: conversacionEmpleadoId,
            es_entrante: false,
            remitente_tipo: 'agente',
            remitente_id: user.id,
            remitente_nombre: user.user_metadata?.nombre || user.email || null,
            texto: textoMensaje,
            wa_message_id: waMessageId,
            plantilla_id,
            estado: 'enviado',
          })
        }

        // Marcar el pago como "recibo enviado por WhatsApp" — habilita el
        // badge en la UI y la lógica anti-duplicado. Igual que correo:
        // solo se marca si el operador ya registró el pago.
        if (pagoIdActual) {
          await admin
            .from('pagos_nomina')
            .update({
              recibo_whatsapp_enviado_en: new Date().toISOString(),
              recibo_whatsapp_enviado_a: telCanonico,
              recibo_whatsapp_enviado_por: user.id,
            })
            .eq('id', pagoIdActual)
            .eq('empresa_id', empresaId)
        }

        resultados.push({ telefono: telCanonico, nombre: emp.nombre, ok: true })
      } catch (e) {
        const mensajeError = e instanceof Error ? e.message : 'Error al enviar'

        if (conversacionEmpleadoId) {
          await registrarMensajeEmpleado({
            admin,
            empresa_id: empresaId,
            conversacion_id: conversacionEmpleadoId,
            es_entrante: false,
            remitente_tipo: 'agente',
            remitente_id: user.id,
            remitente_nombre: user.user_metadata?.nombre || user.email || null,
            texto: textoMensaje,
            plantilla_id,
            estado: 'fallido',
            error_envio: mensajeError,
          })
        }

        resultados.push({
          telefono: telCanonico,
          nombre: emp.nombre,
          ok: false,
          error: mensajeError,
        })
      }
    }

    const enviados = resultados.filter(r => r.ok).length
    const fallidos = resultados.filter(r => !r.ok).length

    return NextResponse.json({ enviados, fallidos, total: empleados.length, resultados })
  } catch {
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
