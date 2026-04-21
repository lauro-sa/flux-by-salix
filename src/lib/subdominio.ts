/**
 * Utilidad para extraer el slug del subdominio desde el header host.
 * En producción: miempresa.salixweb.com → 'miempresa'
 * En desarrollo: localhost:3000 → null (sin subdominio)
 * Se usa en: middleware, resolución de empresa por URL.
 */

const DOMINIO_APP = process.env.NEXT_PUBLIC_APP_DOMAIN || 'salixweb.com'

export function extraerSlug(host: string): string | null {
  // En desarrollo local no hay subdominios
  if (host.startsWith('localhost') || host.startsWith('127.0.0.1')) {
    return null
  }

  // Quitar el puerto si existe
  const hostSinPuerto = host.split(':')[0]

  // Verificar que termina con el dominio de la app
  if (!hostSinPuerto.endsWith(DOMINIO_APP)) {
    return null
  }

  // Extraer la parte antes del dominio
  const prefijo = hostSinPuerto.slice(0, -(DOMINIO_APP.length + 1)) // +1 por el punto

  // Si no hay prefijo o es 'www', no hay subdominio
  if (!prefijo || prefijo === 'www') {
    return null
  }

  return prefijo
}
