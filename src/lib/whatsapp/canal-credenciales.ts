/**
 * Validación de credenciales de un canal de WhatsApp.
 *
 * Un canal puede tener `estado_conexion = 'conectado'` en BD pero quedarse sin
 * credenciales (token expirado, regrabado vacío, migración fallida, etc.). En
 * ese caso seguir mostrándolo como "Conectado" engaña al usuario y los envíos
 * fallan con error 190 de Meta. Este helper expone una función única usada por
 * el endpoint, los cards de configuración y los modales de envío para
 * determinar si un canal puede operar realmente.
 */
/**
 * Las claves del JSON `config_conexion` se han escrito en distintas variantes
 * (camelCase y snake_case) según la época del onboarding. Este tipo describe
 * todas las que pueden encontrarse en BD; los lectores deben tolerar todas.
 */
export interface CredencialesCanalWA {
  access_token?: string | null
  tokenAcceso?: string | null
  token_acceso?: string | null
  phone_number_id?: string | null
  phoneNumberId?: string | null
  waba_id?: string | null
  wabaId?: string | null
  business_account_id?: string | null
  businessAccountId?: string | null
  numero_telefono?: string | null
  numeroTelefono?: string | null
}

export interface DiagnosticoCredenciales {
  /** El canal tiene los 3 datos mínimos para operar contra Meta. */
  validas: boolean
  /** Lista de claves que faltan, en orden de obviedad para el usuario. */
  faltantes: Array<'access_token' | 'phone_number_id' | 'business_account_id'>
}

/** Lee `access_token` aceptando todos los aliases conocidos. */
export function leerTokenAcceso(config: CredencialesCanalWA | null | undefined): string {
  const v = config?.access_token || config?.tokenAcceso || config?.token_acceso || ''
  return String(v || '').trim()
}

/** Lee `phone_number_id` aceptando todos los aliases conocidos. */
export function leerPhoneNumberId(config: CredencialesCanalWA | null | undefined): string {
  const v = config?.phone_number_id || config?.phoneNumberId || ''
  return String(v || '').trim()
}

/** Lee `waba_id` (business account id) aceptando todos los aliases conocidos. */
export function leerWabaId(config: CredencialesCanalWA | null | undefined): string {
  const v = config?.waba_id || config?.wabaId || config?.business_account_id || config?.businessAccountId || ''
  return String(v || '').trim()
}

/** Lee `numero_telefono` aceptando todos los aliases conocidos. */
export function leerNumeroTelefono(config: CredencialesCanalWA | null | undefined): string {
  const v = config?.numero_telefono || config?.numeroTelefono || ''
  return String(v || '').trim()
}

/**
 * Diagnostica si un objeto `config_conexion` tiene credenciales suficientes
 * para enviar mensajes vía Meta WhatsApp Business API.
 */
export function diagnosticarCredencialesCanal(
  config: CredencialesCanalWA | null | undefined,
): DiagnosticoCredenciales {
  const faltantes: DiagnosticoCredenciales['faltantes'] = []
  if (!leerTokenAcceso(config)) faltantes.push('access_token')
  if (!leerPhoneNumberId(config)) faltantes.push('phone_number_id')
  if (!leerWabaId(config)) faltantes.push('business_account_id')
  return { validas: faltantes.length === 0, faltantes }
}

/** Atajo booleano: ¿se puede enviar con este canal? */
export function canalPuedeEnviar(config: CredencialesCanalWA | null | undefined): boolean {
  return diagnosticarCredencialesCanal(config).validas
}

/** Etiqueta humana para mostrar en UI sobre qué falta. */
export function etiquetaFaltantesCanal(diag: DiagnosticoCredenciales): string {
  if (diag.validas) return ''
  const labels: Record<DiagnosticoCredenciales['faltantes'][number], string> = {
    access_token: 'Access Token',
    phone_number_id: 'Phone Number ID',
    business_account_id: 'WABA ID',
  }
  return diag.faltantes.map(f => labels[f]).join(', ')
}
