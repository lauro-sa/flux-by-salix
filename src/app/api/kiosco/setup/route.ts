import { NextResponse, type NextRequest } from 'next/server'
import { crearClienteAdmin } from '@/lib/supabase/admin'
import { hashToken, generarTokenKiosco } from '@/lib/kiosco/auth'

/**
 * POST /api/kiosco/setup — Activar terminal con token de setup.
 * Body: { token, empresaId, terminalId }
 *
 * Valida el token temporal, genera un JWT de larga duración,
 * y lo devuelve para que el kiosco lo almacene.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { token, empresaId, terminalId } = body

    if (!token || !empresaId || !terminalId) {
      return NextResponse.json({ error: 'Datos incompletos' }, { status: 400 })
    }

    const admin = crearClienteAdmin()
    const tokenHashSetup = hashToken(token)

    // Buscar terminal con ese token de setup
    const { data: terminal } = await admin
      .from('terminales_kiosco')
      .select('id, nombre, empresa_id, activo, token_hash')
      .eq('id', terminalId)
      .eq('empresa_id', empresaId)
      .eq('token_hash', tokenHashSetup)
      .eq('activo', true)
      .is('revocado_en', null)
      .maybeSingle()

    if (!terminal) {
      return NextResponse.json(
        { error: 'Token inválido o terminal no encontrada' },
        { status: 404 },
      )
    }

    // Generar token de larga duración para el kiosco
    const tokenKiosco = generarTokenKiosco()
    const tokenHashKiosco = hashToken(tokenKiosco)

    // Actualizar terminal con el nuevo token permanente
    await admin
      .from('terminales_kiosco')
      .update({
        token_hash: tokenHashKiosco,
        ultimo_ping: new Date().toISOString(),
      })
      .eq('id', terminal.id)

    // Obtener datos de la empresa para el kiosco
    const { data: empresa } = await admin
      .from('empresas')
      .select('nombre, logo_url')
      .eq('id', empresaId)
      .single()

    // Obtener config de asistencias
    const { data: config } = await admin
      .from('config_asistencias')
      .select('kiosco_metodo_lectura, kiosco_capturar_foto, kiosco_modo_empresa')
      .eq('empresa_id', empresaId)
      .maybeSingle()

    return NextResponse.json({
      ok: true,
      token: tokenKiosco,
      terminal: {
        id: terminal.id,
        nombre: terminal.nombre,
      },
      empresa: {
        id: empresaId,
        nombre: empresa?.nombre || 'Empresa',
        logoUrl: empresa?.logo_url || null,
      },
      config: {
        metodoLectura: config?.kiosco_metodo_lectura || 'rfid_hid',
        capturarFoto: config?.kiosco_capturar_foto || false,
        modoEmpresa: config?.kiosco_modo_empresa || 'logo_y_nombre',
      },
    })
  } catch (error) {
    console.error('Error en /api/kiosco/setup:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
