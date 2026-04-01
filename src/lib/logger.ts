/**
 * Logger centralizado para API routes y server-side.
 * En desarrollo: console.error con contexto.
 * En producción: Vercel captura stdout/stderr automáticamente.
 * Si se integra Sentry en el futuro, se cambia solo este archivo.
 * Se usa en: API routes, cron jobs, webhooks.
 */

interface ContextoError {
  ruta?: string
  empresaId?: string
  usuarioId?: string
  accion?: string
  datos?: Record<string, unknown>
}

/** Registra un error con contexto estructurado */
export function registrarError(error: unknown, contexto?: ContextoError): void {
  const mensaje = error instanceof Error ? error.message : String(error)
  const stack = error instanceof Error ? error.stack : undefined

  const log = {
    nivel: 'error',
    mensaje,
    ...(stack && { stack }),
    ...(contexto?.ruta && { ruta: contexto.ruta }),
    ...(contexto?.empresaId && { empresa_id: contexto.empresaId }),
    ...(contexto?.usuarioId && { usuario_id: contexto.usuarioId }),
    ...(contexto?.accion && { accion: contexto.accion }),
    ...(contexto?.datos && { datos: contexto.datos }),
    timestamp: new Date().toISOString(),
  }

  // Vercel captura JSON estructurado de stderr para búsqueda en logs
  console.error(JSON.stringify(log))
}

/** Registra una advertencia */
export function registrarAdvertencia(mensaje: string, contexto?: ContextoError): void {
  const log = {
    nivel: 'warn',
    mensaje,
    ...(contexto?.ruta && { ruta: contexto.ruta }),
    ...(contexto?.empresaId && { empresa_id: contexto.empresaId }),
    timestamp: new Date().toISOString(),
  }

  console.warn(JSON.stringify(log))
}
