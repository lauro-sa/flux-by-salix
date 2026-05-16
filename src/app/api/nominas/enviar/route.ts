import { NextResponse, type NextRequest } from 'next/server'
import { obtenerUsuarioRuta } from '@/lib/supabase/servidor'
import { crearClienteAdmin } from '@/lib/supabase/admin'
import { verificarPermiso, obtenerDatosMiembro } from '@/lib/permisos-servidor'
import { resolverVariables } from '@/lib/variables/resolver'
import { construirContextoNomina, type DatosNominaCorreo } from '@/lib/plantilla-correo-nomina'
import { construirHtmlCorreoDocumento } from '@/lib/plantilla-correo-documento'
import { generarPdfRecibo } from '@/lib/nominas/generar-pdf-recibo'
// Importar entidades para que el registro de variables esté disponible
import '@/lib/variables/entidades'

/**
 * POST /api/nominas/enviar — Enviar recibos de nómina por correo.
 * Envía un correo personalizado a cada empleado con sus datos de nómina.
 *
 * Body:
 *   canal_id: string — canal de correo a usar como remitente
 *   asunto_plantilla: string — asunto con variables {{nomina.*}}
 *   html_plantilla: string — HTML con variables {{nomina.*}}
 *   empleados: DatosNominaCorreo[] — datos de cada empleado
 *   nombre_empresa: string — nombre de la empresa
 *   adjuntos_ids?: string[] — IDs de adjuntos compartidos (comprobante transferencia)
 */
export async function POST(request: NextRequest) {
  try {
    const { user } = await obtenerUsuarioRuta()
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const empresaId = user.app_metadata?.empresa_activa_id
    if (!empresaId) return NextResponse.json({ error: 'Sin empresa activa' }, { status: 403 })

    // Doble permiso: poder enviar correos Y tener permiso de enviar nómina.
    const datosMiembro = await obtenerDatosMiembro(user.id, empresaId)
    if (!datosMiembro) return NextResponse.json({ error: 'Sin empresa' }, { status: 403 })
    if (!verificarPermiso(datosMiembro, 'inbox_correo', 'enviar')) {
      return NextResponse.json({ error: 'Sin permiso para enviar correos' }, { status: 403 })
    }
    if (!verificarPermiso(datosMiembro, 'nomina', 'enviar')) {
      return NextResponse.json({ error: 'Sin permiso para enviar recibos de nómina' }, { status: 403 })
    }

    const body = await request.json()
    const {
      canal_id,
      asunto_plantilla,
      html_plantilla,
      empleados,
      nombre_empresa,
      adjuntos_ids,
      periodo_desde,
      periodo_hasta,
    } = body as {
      canal_id: string
      asunto_plantilla: string
      html_plantilla: string
      empleados: DatosNominaCorreo[]
      nombre_empresa: string
      adjuntos_ids?: string[]
      /** Período del recibo. Si viene, el server busca el pago grabado
       *  del empleado y adjunta el PDF del recibo. */
      periodo_desde?: string
      periodo_hasta?: string
    }

    if (!canal_id) return NextResponse.json({ error: 'canal_id requerido' }, { status: 400 })
    if (!empleados?.length) return NextResponse.json({ error: 'Sin empleados' }, { status: 400 })

    // Obtener datos de la empresa para el pie del correo
    const admin = crearClienteAdmin()
    const { data: empresaData } = await admin
      .from('empresas')
      .select('nombre, correo_contacto, telefono, sitio_web, color_marca')
      .eq('id', empresaId)
      .single()

    const empresa = empresaData as Record<string, unknown> | null

    // Enviar un correo por cada empleado usando la API interna
    const resultados: { correo: string; ok: boolean; error?: string }[] = []

    for (const empleado of empleados) {
      if (!empleado.correo_empleado) {
        // El frontend arma este payload leyendo el correo del canal elegido del
        // miembro (canal_notif_correo). Si está vacío, no se envía y se reporta.
        resultados.push({ correo: '', ok: false, error: 'Sin correo en el canal elegido' })
        continue
      }

      // Construir contexto de variables para este empleado
      const contexto = construirContextoNomina(empleado, nombre_empresa)

      // Resolver variables en asunto y cuerpo
      const asuntoResuelto = resolverVariables(asunto_plantilla, contexto)
      const htmlResuelto = resolverVariables(html_plantilla, contexto)

      // Construir HTML final con pie de empresa
      const htmlFinal = construirHtmlCorreoDocumento({
        htmlCuerpo: htmlResuelto,
        incluirPortal: false,
        empresa: {
          nombre: (empresa?.nombre as string) || nombre_empresa,
          telefono: empresa?.telefono as string | null,
          correo: empresa?.correo_contacto as string | null,
          sitioWeb: empresa?.sitio_web as string | null,
        },
      })

      // ─── Adjuntar PDF del recibo (si existe pago en el período) ───
      // Guardamos el id del pago para marcar `recibo_correo_enviado_*`
      // si el envío termina OK — así la UI puede mostrar "ya enviado".
      let pdfUrl: string | null = null
      let pdfNombre: string | null = null
      let pagoIdActual: string | null = null
      if (empleado.miembro_id && periodo_desde && periodo_hasta) {
        try {
          const { data: pago } = await admin
            .from('pagos_nomina')
            .select('id')
            .eq('empresa_id', empresaId)
            .eq('miembro_id', empleado.miembro_id)
            .eq('fecha_inicio_periodo', periodo_desde)
            .eq('fecha_fin_periodo', periodo_hasta)
            .eq('eliminado', false)
            .order('creado_en', { ascending: false })
            .limit(1)
            .maybeSingle()
          if (pago) {
            pagoIdActual = pago.id as string
            const { url } = await generarPdfRecibo(admin, pago.id, empresaId)
            pdfUrl = url
            pdfNombre = `Recibo_${empleado.nombre_empleado.replace(/\s+/g, '_')}_${periodo_desde}_${periodo_hasta}.pdf`
          }
        } catch (errPdf) {
          // No bloqueamos el envío si falla la generación del PDF.
          console.error('[nominas/enviar] error al generar PDF:', errPdf)
        }
      }

      try {
        // Llamar a la API interna de envío de correo
        const baseUrl = request.nextUrl.origin
        const respuesta = await fetch(`${baseUrl}/api/inbox/correo/enviar`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Cookie': request.headers.get('cookie') || '',
          },
          body: JSON.stringify({
            canal_id,
            correo_para: [empleado.correo_empleado],
            correo_asunto: asuntoResuelto,
            texto: asuntoResuelto,
            html: htmlFinal,
            tipo: 'nuevo',
            adjuntos_ids: adjuntos_ids || [],
            pdf_url: pdfUrl,
            pdf_nombre: pdfNombre,
          }),
        })

        if (respuesta.ok) {
          // Marcar el pago como "recibo enviado por correo" para que la UI
          // muestre el badge y bloquee envíos duplicados. Si no hay pago
          // grabado todavía (operador mandó antes de "Registrar pago"),
          // no podemos marcar — el badge solo aparece desde el momento
          // que existe la fila de pago.
          if (pagoIdActual) {
            await admin
              .from('pagos_nomina')
              .update({
                recibo_correo_enviado_en: new Date().toISOString(),
                recibo_correo_enviado_a: empleado.correo_empleado,
                recibo_correo_enviado_por: user.id,
              })
              .eq('id', pagoIdActual)
              .eq('empresa_id', empresaId)
          }
          resultados.push({ correo: empleado.correo_empleado, ok: true })
        } else {
          const err = await respuesta.json().catch(() => ({}))
          resultados.push({
            correo: empleado.correo_empleado,
            ok: false,
            error: (err as Record<string, string>).error || 'Error al enviar',
          })
        }
      } catch (e) {
        resultados.push({
          correo: empleado.correo_empleado,
          ok: false,
          error: e instanceof Error ? e.message : 'Error desconocido',
        })
      }
    }

    const enviados = resultados.filter(r => r.ok).length
    const fallidos = resultados.filter(r => !r.ok).length

    return NextResponse.json({
      enviados,
      fallidos,
      total: empleados.length,
      resultados,
    })
  } catch {
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
