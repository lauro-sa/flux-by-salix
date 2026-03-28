import { NextResponse, type NextRequest } from 'next/server'
import { crearClienteAdmin } from '@/lib/supabase/admin'
import {
  intercambiarCodigo,
  obtenerEmailUsuario,
  crearCarpeta,
  crearSpreadsheet,
  MODULOS_SYNC,
} from '@/lib/google-drive'

/**
 * GET /api/integraciones/google-drive/callback — Callback de OAuth de Google.
 * Google redirige acá después de que el usuario autoriza.
 * Intercambia el código por tokens, crea carpeta y spreadsheets en Drive,
 * guarda la config en BD y redirige a la página de configuración.
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const codigo = searchParams.get('code')
    const estado = searchParams.get('state')
    const errorGoogle = searchParams.get('error')

    // Si el usuario canceló
    if (errorGoogle) {
      return NextResponse.redirect(new URL('/contactos/configuracion?gdrive=cancelado', request.url))
    }

    if (!codigo || !estado) {
      return NextResponse.redirect(new URL('/contactos/configuracion?gdrive=error', request.url))
    }

    // Decodificar estado
    let empresaId: string
    let userId: string
    try {
      const decoded = JSON.parse(Buffer.from(estado, 'base64').toString())
      empresaId = decoded.empresaId
      userId = decoded.userId
    } catch {
      return NextResponse.redirect(new URL('/contactos/configuracion?gdrive=error', request.url))
    }

    // Intercambiar código por tokens
    const tokens = await intercambiarCodigo(codigo)
    const accessToken = tokens.access_token!
    const refreshToken = tokens.refresh_token!

    // Obtener email del usuario de Google
    const email = await obtenerEmailUsuario(accessToken)

    // Obtener nombre de empresa
    const admin = crearClienteAdmin()
    const { data: empresa } = await admin.from('empresas').select('nombre').eq('id', empresaId).single()
    const nombreEmpresa = empresa?.nombre || 'Mi Empresa'

    // Crear carpeta en Drive
    const folderId = await crearCarpeta(accessToken, nombreEmpresa)

    // Crear spreadsheets para módulos activos
    const modulosActivos = MODULOS_SYNC.map(m => m.clave)
    const hojas: Record<string, { spreadsheet_id: string; url: string; nombre: string }> = {}

    for (const modulo of MODULOS_SYNC) {
      const sheet = await crearSpreadsheet(accessToken, folderId, modulo.nombreHoja)
      hojas[modulo.clave] = {
        spreadsheet_id: sheet.spreadsheetId,
        url: sheet.url,
        nombre: modulo.nombreHoja,
      }
    }

    // Verificar si ya existe un registro para esta empresa
    const { data: existente } = await admin
      .from('configuracion_google_drive')
      .select('id')
      .eq('empresa_id', empresaId)
      .maybeSingle()

    if (existente) {
      // Actualizar registro existente (sin empresa_id que es UNIQUE)
      const { error } = await admin.from('configuracion_google_drive').update({
        conectado: true,
        email,
        refresh_token: refreshToken,
        access_token: accessToken,
        token_expira_en: tokens.expiry_date ? new Date(tokens.expiry_date).toISOString() : null,
        frecuencia_horas: 24,
        modulos_activos: modulosActivos,
        folder_id: folderId,
        hojas,
        ultima_sync: null,
        ultimo_error: null,
        resumen: {},
        conectado_por: userId,
        actualizado_en: new Date().toISOString(),
      }).eq('id', existente.id)

      if (error) {
        console.error('Error update config Google Drive:', error)
        return NextResponse.redirect(new URL('/contactos/configuracion?gdrive=error', request.url))
      }
    } else {
      // Crear nuevo registro
      const { error } = await admin.from('configuracion_google_drive').insert({
        empresa_id: empresaId,
        conectado: true,
        email,
        refresh_token: refreshToken,
        access_token: accessToken,
        token_expira_en: tokens.expiry_date ? new Date(tokens.expiry_date).toISOString() : null,
        frecuencia_horas: 24,
        modulos_activos: modulosActivos,
        folder_id: folderId,
        hojas,
        conectado_por: userId,
      })

      if (error) {
        console.error('Error insert config Google Drive:', error)
        return NextResponse.redirect(new URL('/contactos/configuracion?gdrive=error', request.url))
      }
    }

    // Ejecutar primera sincronización automáticamente
    try {
      const { sincronizarEmpresa } = await import('@/lib/google-drive-sync')
      const { data: configGuardada } = await admin
        .from('configuracion_google_drive')
        .select('*')
        .eq('empresa_id', empresaId)
        .maybeSingle()

      if (configGuardada) {
        await sincronizarEmpresa(admin, configGuardada)
      }
    } catch (err) {
      console.error('Error en primera sincronización:', err)
      // No falla el callback, solo loguea
    }

    // Redirigir a configuración con éxito
    return NextResponse.redirect(new URL('/contactos/configuracion?gdrive=conectado', request.url))
  } catch (err) {
    console.error('Error callback Google Drive:', err)
    return NextResponse.redirect(new URL('/contactos/configuracion?gdrive=error', request.url))
  }
}
