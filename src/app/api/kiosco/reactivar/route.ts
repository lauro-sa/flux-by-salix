import { NextResponse, type NextRequest } from 'next/server'
import { crearClienteAdmin } from '@/lib/supabase/admin'
import { hashToken, generarTokenKiosco } from '@/lib/kiosco/auth'

/**
 * POST /api/kiosco/reactivar — Reactivar terminal con PIN admin.
 * Body: { terminalNombre, pinAdmin }
 *
 * Permite reactivar un kiosco sin generar un nuevo QR.
 * Útil cuando se borran los datos del navegador.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { terminalNombre, pinAdmin } = body

    if (!terminalNombre || !pinAdmin) {
      return NextResponse.json({ error: 'Ingresá nombre y PIN' }, { status: 400 })
    }

    const admin = crearClienteAdmin()

    // Buscar terminal activa con ese nombre
    const { data: terminal } = await admin
      .from('terminales_kiosco')
      .select('id, empresa_id, nombre')
      .ilike('nombre', terminalNombre.trim())
      .eq('activo', true)
      .is('revocado_en', null)
      .maybeSingle()

    if (!terminal) {
      return NextResponse.json({ error: 'Terminal no encontrada' }, { status: 404 })
    }

    // Verificar PIN admin de la empresa
    const { data: config } = await admin
      .from('config_asistencias')
      .select('kiosco_pin_admin, kiosco_metodo_lectura, kiosco_capturar_foto, kiosco_modo_empresa')
      .eq('empresa_id', terminal.empresa_id)
      .maybeSingle()

    if (!config?.kiosco_pin_admin || config.kiosco_pin_admin !== pinAdmin) {
      return NextResponse.json({ error: 'PIN incorrecto' }, { status: 401 })
    }

    // Generar nuevo token
    const tokenKiosco = generarTokenKiosco()
    const tokenHashKiosco = hashToken(tokenKiosco)

    await admin
      .from('terminales_kiosco')
      .update({
        token_hash: tokenHashKiosco,
        ultimo_ping: new Date().toISOString(),
      })
      .eq('id', terminal.id)

    // Datos de empresa
    const { data: empresa } = await admin
      .from('empresas')
      .select('nombre, logo_url')
      .eq('id', terminal.empresa_id)
      .single()

    const datosRespuesta = {
      ok: true,
      token: tokenKiosco,
      terminal: { id: terminal.id, nombre: terminal.nombre },
      empresa: {
        id: terminal.empresa_id,
        nombre: empresa?.nombre || 'Empresa',
        logoUrl: empresa?.logo_url || null,
      },
      config: {
        metodoLectura: config.kiosco_metodo_lectura || 'rfid_hid',
        capturarFoto: config.kiosco_capturar_foto || false,
        modoEmpresa: config.kiosco_modo_empresa || 'logo_y_nombre',
      },
    }

    const response = NextResponse.json(datosRespuesta)

    // Mismas cookies que en setup
    response.cookies.set('kiosco_token', tokenKiosco, {
      httpOnly: true,
      secure: true,
      sameSite: 'strict',
      path: '/',
      maxAge: 60 * 60 * 24 * 365 * 10,
    })

    response.cookies.set('kiosco_config', JSON.stringify({
      terminal: datosRespuesta.terminal,
      empresa: datosRespuesta.empresa,
      config: datosRespuesta.config,
    }), {
      httpOnly: false,
      secure: true,
      sameSite: 'strict',
      path: '/',
      maxAge: 60 * 60 * 24 * 365 * 10,
    })

    return response
  } catch (error) {
    console.error('Error en /api/kiosco/reactivar:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
