import { NextResponse, type NextRequest } from 'next/server'
import { obtenerUsuarioRuta } from '@/lib/supabase/servidor'
import { crearClienteAdmin } from '@/lib/supabase/admin'
import { enviarPlantillaWhatsApp, type ConfigCuentaWhatsApp } from '@/lib/whatsapp'

/**
 * POST /api/asistencias/nomina/enviar-whatsapp — Enviar recibos de nómina por WhatsApp.
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

    const body = await request.json()
    const { canal_id, plantilla_id, empleados } = body as {
      canal_id: string
      plantilla_id: string
      empleados: {
        nombre: string
        telefono: string
        dias_trabajados: number
        dias_laborales: number
        dias_a_horario: number
        dias_tardanza: number
        monto_bruto: string
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

    const configConexion = canal.config_conexion as Record<string, string>
    const config: ConfigCuentaWhatsApp = {
      phoneNumberId: configConexion.phone_number_id,
      wabaId: configConexion.waba_id,
      tokenAcceso: configConexion.token_acceso,
      numeroTelefono: configConexion.numero_telefono || '',
    }

    const nombreApi = plantilla.nombre_api as string
    const idioma = (plantilla.idioma as string) || 'es'

    // Enviar a cada empleado
    const resultados: { telefono: string; nombre: string; ok: boolean; error?: string }[] = []

    for (const emp of empleados) {
      if (!emp.telefono) {
        resultados.push({ telefono: '', nombre: emp.nombre, ok: false, error: 'Sin teléfono' })
        continue
      }

      // Armar componentes con variables resueltas
      // Header {{1}} = periodo
      // Body {{1}}=nombre, {{2}}=dias_trabajados, {{3}}=dias_laborales,
      //       {{4}}=dias_a_horario, {{5}}=dias_tardanza,
      //       {{6}}=monto_bruto, {{7}}=compensacion_detalle
      const componentesMeta = [
        {
          type: 'header',
          parameters: [
            { type: 'text', text: emp.periodo },
          ],
        },
        {
          type: 'body',
          parameters: [
            { type: 'text', text: emp.nombre },
            { type: 'text', text: String(emp.dias_trabajados) },
            { type: 'text', text: String(emp.dias_laborales) },
            { type: 'text', text: String(emp.dias_a_horario) },
            { type: 'text', text: String(emp.dias_tardanza) },
            { type: 'text', text: emp.monto_bruto },
            { type: 'text', text: emp.compensacion_detalle },
          ],
        },
      ]

      try {
        await enviarPlantillaWhatsApp(config, emp.telefono, nombreApi, idioma, componentesMeta)
        resultados.push({ telefono: emp.telefono, nombre: emp.nombre, ok: true })
      } catch (e) {
        resultados.push({
          telefono: emp.telefono,
          nombre: emp.nombre,
          ok: false,
          error: e instanceof Error ? e.message : 'Error al enviar',
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
