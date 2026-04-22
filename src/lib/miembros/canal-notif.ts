/**
 * Helpers para resolver correo y teléfono de un miembro según el canal
 * elegido (`canal_notif_correo` / `canal_notif_telefono`).
 *
 * Reglas:
 * - 'empresa'  → usa correo_empresa / telefono_empresa.
 * - 'personal' → usa correo / telefono.
 * - NO hay fallback al otro canal: si el campo elegido está vacío, se
 *   devuelve null y el caller decide (normalmente: no envía y reporta
 *   "sin correo/teléfono configurado en el canal elegido").
 *
 * Default seguro si el miembro aún no tiene canal asignado: 'empresa'.
 */

type CanalNotif = 'empresa' | 'personal'

export interface DatosCanalCorreo {
  correo?: string | null
  correo_empresa?: string | null
  canal_notif_correo?: CanalNotif | string | null
}

export interface DatosCanalTelefono {
  telefono?: string | null
  telefono_empresa?: string | null
  canal_notif_telefono?: CanalNotif | string | null
}

function normalizarCanal(valor: unknown): CanalNotif {
  return valor === 'personal' ? 'personal' : 'empresa'
}

/**
 * Devuelve el correo a usar para notificaciones del miembro.
 * @returns string limpio, o null si el campo del canal elegido está vacío.
 */
export function resolverCorreoNotif(datos: DatosCanalCorreo): string | null {
  const canal = normalizarCanal(datos.canal_notif_correo)
  const valor = (canal === 'empresa' ? datos.correo_empresa : datos.correo) || ''
  const limpio = valor.trim()
  return limpio || null
}

/**
 * Devuelve el teléfono a usar para notificaciones (WhatsApp) del miembro.
 * @returns string limpio, o null si el campo del canal elegido está vacío.
 */
export function resolverTelefonoNotif(datos: DatosCanalTelefono): string | null {
  const canal = normalizarCanal(datos.canal_notif_telefono)
  const valor = (canal === 'empresa' ? datos.telefono_empresa : datos.telefono) || ''
  const limpio = valor.trim()
  return limpio || null
}

/**
 * Devuelve la etiqueta humana del canal (para mensajes de error):
 * "correo de empresa" / "correo personal" / "teléfono de empresa" / "teléfono personal".
 */
export function etiquetaCanal(tipo: 'correo' | 'telefono', canal: CanalNotif | string | null | undefined): string {
  const c = normalizarCanal(canal)
  const base = tipo === 'correo' ? 'correo' : 'teléfono'
  return c === 'empresa' ? `${base} de empresa` : `${base} personal`
}
