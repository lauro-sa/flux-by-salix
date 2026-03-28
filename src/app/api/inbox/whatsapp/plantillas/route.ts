import { NextResponse, type NextRequest } from 'next/server'
import { crearClienteServidor } from '@/lib/supabase/servidor'
import { crearClienteAdmin } from '@/lib/supabase/admin'
import {
  listarPlantillasMeta, crearPlantillaMeta, eliminarPlantillaMeta,
  type ConfigCuentaWhatsApp, type ComponentePlantillaMeta,
} from '@/lib/whatsapp'

/**
 * GET /api/inbox/whatsapp/plantillas — Sincronizar plantillas desde Meta.
 * Trae todas las plantillas de la cuenta de WhatsApp Business y las compara con las locales.
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await crearClienteServidor()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const empresaId = user.app_metadata?.empresa_activa_id
    if (!empresaId) return NextResponse.json({ error: 'Sin empresa activa' }, { status: 403 })

    const canalId = request.nextUrl.searchParams.get('canal_id')
    if (!canalId) return NextResponse.json({ error: 'canal_id es requerido' }, { status: 400 })

    const admin = crearClienteAdmin()

    // Obtener config del canal
    const { data: canal } = await admin
      .from('canales_inbox')
      .select('config_conexion')
      .eq('id', canalId)
      .eq('empresa_id', empresaId)
      .single()

    if (!canal) return NextResponse.json({ error: 'Canal no encontrado' }, { status: 404 })

    const config = canal.config_conexion as unknown as ConfigCuentaWhatsApp

    // Traer plantillas desde Meta
    const plantillasMeta = await listarPlantillasMeta(config)

    return NextResponse.json({
      plantillas: plantillasMeta,
      total: plantillasMeta.length,
    })
  } catch (err) {
    console.error('Error al sincronizar plantillas:', err)
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}

/**
 * POST /api/inbox/whatsapp/plantillas — Crear o eliminar plantilla en Meta.
 * Body: { accion: 'crear' | 'eliminar' | 'sincronizar', ... }
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await crearClienteServidor()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const empresaId = user.app_metadata?.empresa_activa_id
    if (!empresaId) return NextResponse.json({ error: 'Sin empresa activa' }, { status: 403 })

    const body = await request.json()
    const { accion, canal_id } = body

    if (!canal_id || !accion) {
      return NextResponse.json({ error: 'canal_id y accion son requeridos' }, { status: 400 })
    }

    const admin = crearClienteAdmin()

    const { data: canal } = await admin
      .from('canales_inbox')
      .select('config_conexion')
      .eq('id', canal_id)
      .eq('empresa_id', empresaId)
      .single()

    if (!canal) return NextResponse.json({ error: 'Canal no encontrado' }, { status: 404 })

    const config = canal.config_conexion as unknown as ConfigCuentaWhatsApp

    if (accion === 'crear') {
      const { nombre_api, idioma, categoria, componentes } = body

      if (!nombre_api || !idioma || !categoria || !componentes) {
        return NextResponse.json({ error: 'Datos de plantilla incompletos' }, { status: 400 })
      }

      const resultado = await crearPlantillaMeta(
        config, nombre_api, idioma, categoria,
        componentes as ComponentePlantillaMeta[],
      )

      return NextResponse.json({ plantilla: resultado }, { status: 201 })
    }

    if (accion === 'eliminar') {
      const { nombre_api } = body
      if (!nombre_api) return NextResponse.json({ error: 'nombre_api es requerido' }, { status: 400 })

      await eliminarPlantillaMeta(config, nombre_api)
      return NextResponse.json({ ok: true })
    }

    if (accion === 'sincronizar') {
      const plantillasMeta = await listarPlantillasMeta(config)
      return NextResponse.json({ plantillas: plantillasMeta, total: plantillasMeta.length })
    }

    return NextResponse.json({ error: 'Acción no válida' }, { status: 400 })
  } catch (err) {
    console.error('Error en gestión de plantillas:', err)
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}
