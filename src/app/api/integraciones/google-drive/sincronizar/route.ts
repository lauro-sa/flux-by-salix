import { NextResponse } from 'next/server'
import { requerirPermisoAPI } from '@/lib/permisos-servidor'
import { crearClienteAdmin } from '@/lib/supabase/admin'
import { sincronizarEmpresa } from '@/lib/google-drive-sync'

/**
 * POST /api/integraciones/google-drive/sincronizar — Forzar sincronización manual.
 * Sincroniza todos los módulos activos de la empresa con Google Sheets.
 * Se usa en: configuración → Google Drive → botón "Sincronizar ahora".
 */
export async function POST() {
  try {
    const guard = await requerirPermisoAPI('config_empresa', 'editar')
    if ('respuesta' in guard) return guard.respuesta
    const { empresaId } = guard

    const admin = crearClienteAdmin()

    // Obtener config de Google Drive
    const { data: config } = await admin
      .from('configuracion_google_drive')
      .select('*')
      .eq('empresa_id', empresaId)
      .maybeSingle()

    if (!config?.conectado || !config.refresh_token) {
      return NextResponse.json({ error: 'Google Drive no conectado' }, { status: 400 })
    }

    // Ejecutar sincronización
    const resultado = await sincronizarEmpresa(admin, config)

    return NextResponse.json(resultado)
  } catch (err) {
    console.error('Error sincronizar Google Drive:', err)
    return NextResponse.json({ error: 'Error al sincronizar' }, { status: 500 })
  }
}
