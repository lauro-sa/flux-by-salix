import { crearClienteAdmin } from '@/lib/supabase/admin'

/** Cuota por defecto si la empresa no tiene una configurada: 2 GB */
const CUOTA_DEFECTO_BYTES = 2 * 1024 * 1024 * 1024

/**
 * Registra el uso de storage después de un upload exitoso.
 * Incrementa bytes_usados y cantidad_archivos para la empresa + bucket.
 * Usa upsert para crear el registro si no existe.
 */
export async function registrarUsoStorage(
  empresaId: string,
  bucket: string,
  bytesSubidos: number
) {
  try {
    const admin = crearClienteAdmin()

    // Intentar actualizar registro existente
    const { data: existente } = await admin
      .from('uso_storage')
      .select('id, bytes_usados, cantidad_archivos')
      .eq('empresa_id', empresaId)
      .eq('bucket', bucket)
      .single()

    if (existente) {
      await admin
        .from('uso_storage')
        .update({
          bytes_usados: existente.bytes_usados + bytesSubidos,
          cantidad_archivos: existente.cantidad_archivos + 1,
          actualizado_en: new Date().toISOString(),
        })
        .eq('id', existente.id)
    } else {
      await admin
        .from('uso_storage')
        .insert({
          empresa_id: empresaId,
          bucket,
          bytes_usados: bytesSubidos,
          cantidad_archivos: 1,
        })
    }
  } catch (err) {
    // No bloquear el upload si falla el tracking
    console.error('Error registrando uso de storage:', err)
  }
}

/**
 * Descuenta bytes cuando se elimina un archivo de storage.
 */
export async function descontarUsoStorage(
  empresaId: string,
  bucket: string,
  bytesEliminados: number
) {
  try {
    const admin = crearClienteAdmin()

    const { data: existente } = await admin
      .from('uso_storage')
      .select('id, bytes_usados, cantidad_archivos')
      .eq('empresa_id', empresaId)
      .eq('bucket', bucket)
      .single()

    if (existente) {
      await admin
        .from('uso_storage')
        .update({
          bytes_usados: Math.max(0, existente.bytes_usados - bytesEliminados),
          cantidad_archivos: Math.max(0, existente.cantidad_archivos - 1),
          actualizado_en: new Date().toISOString(),
        })
        .eq('id', existente.id)
    }
  } catch (err) {
    console.error('Error descontando uso de storage:', err)
  }
}

/**
 * Obtiene el uso total de storage de una empresa (suma de todos los buckets).
 * Devuelve bytes totales y cantidad de archivos.
 */
export async function obtenerUsoStorage(empresaId: string): Promise<{
  bytes_totales: number
  cantidad_archivos: number
  por_bucket: Array<{ bucket: string; bytes_usados: number; cantidad_archivos: number }>
}> {
  const admin = crearClienteAdmin()

  const { data } = await admin
    .from('uso_storage')
    .select('bucket, bytes_usados, cantidad_archivos')
    .eq('empresa_id', empresaId)

  const registros = data || []

  return {
    bytes_totales: registros.reduce((sum, r) => sum + r.bytes_usados, 0),
    cantidad_archivos: registros.reduce((sum, r) => sum + r.cantidad_archivos, 0),
    por_bucket: registros,
  }
}

/**
 * Obtiene la cuota de storage configurada para la empresa.
 * Lee de la columna cuota_storage_bytes de la tabla empresas.
 */
async function obtenerCuotaEmpresa(empresaId: string): Promise<number> {
  try {
    const admin = crearClienteAdmin()
    const { data } = await admin
      .from('empresas')
      .select('cuota_storage_bytes')
      .eq('id', empresaId)
      .single()

    return data?.cuota_storage_bytes || CUOTA_DEFECTO_BYTES
  } catch {
    return CUOTA_DEFECTO_BYTES
  }
}

/**
 * Verifica si la empresa tiene espacio disponible antes de un upload.
 * Lee la cuota configurada en la tabla empresas.
 * Devuelve null si hay espacio, o un string con el error si no.
 */
export async function verificarCuotaStorage(
  empresaId: string,
  bytesNuevos: number
): Promise<string | null> {
  try {
    const [{ bytes_totales }, cuotaMaxima] = await Promise.all([
      obtenerUsoStorage(empresaId),
      obtenerCuotaEmpresa(empresaId),
    ])

    if (bytes_totales + bytesNuevos > cuotaMaxima) {
      const usadoGB = (bytes_totales / (1024 * 1024 * 1024)).toFixed(2)
      const limiteGB = (cuotaMaxima / (1024 * 1024 * 1024)).toFixed(1)
      return `Espacio de almacenamiento agotado (${usadoGB} GB de ${limiteGB} GB usados)`
    }

    return null
  } catch {
    // Si falla la verificación, permitir el upload (fail-open)
    return null
  }
}
