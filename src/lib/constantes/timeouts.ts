/**
 * Constantes de tiempos (ms) usadas en toda la app.
 * Centraliza timeouts, debounces e intervalos para facilitar ajustes globales.
 */

// Debounce y animación
export const DEBOUNCE_BUSQUEDA = 300
export const DEBOUNCE_AUTOGUARDADO = 300

// Delays de UI
export const DELAY_TRANSICION = 1500
export const DELAY_CARGA = 2000
export const DELAY_ACCION = 3000
export const DELAY_NOTIFICACION = 5000

// Timeouts de sistema
export const TIMEOUT_AUTH = 8000
export const TIMEOUT_AUTOGUARDADO = 4000
export const TIMEOUT_ACCION = 5000

// Intervalos
export const INTERVALO_HEARTBEAT = 60000
export const INTERVALO_POLLING = 5000
export const INTERVALO_SYNC_CORREO_BACKGROUND = 180000 // 3 min — sync de correos desde cualquier página
