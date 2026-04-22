import { NextResponse } from 'next/server'
import { requerirPermisoAPI } from '@/lib/permisos-servidor'
import { obtenerUsoStorage } from '@/lib/uso-storage'
import { crearClienteAdmin } from '@/lib/supabase/admin'

/**
 * GET /api/storage/uso — Devuelve el uso de storage de la empresa actual.
 * Respuesta: { bytes_totales, cantidad_archivos, por_bucket, cuota_bytes, porcentaje_usado }
 * Se usa en: Configuración de empresa, dashboard admin.
 */
export async function GET() {
  try {
    const guard = await requerirPermisoAPI('config_empresa', 'ver')
    if ('respuesta' in guard) return guard.respuesta
    const { empresaId } = guard

    const admin = crearClienteAdmin()

    // Obtener uso y cuota en paralelo
    const [uso, empresaData] = await Promise.all([
      obtenerUsoStorage(empresaId),
      admin.from('empresas').select('cuota_storage_bytes').eq('id', empresaId).single(),
    ])

    const cuota_bytes = empresaData.data?.cuota_storage_bytes || (2 * 1024 * 1024 * 1024)

    return NextResponse.json({
      ...uso,
      cuota_bytes,
      porcentaje_usado: Math.round((uso.bytes_totales / cuota_bytes) * 100),
    })
  } catch (err) {
    console.error('Error obteniendo uso de storage:', err)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
