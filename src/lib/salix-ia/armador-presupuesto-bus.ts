/**
 * armador-presupuesto-bus — Bus de coordinación entre el copilot global de
 * Salix IA (FAB en PlantillaApp) y el EditorPresupuesto que monta el armador
 * de líneas con IA.
 *
 * Problema que resuelve:
 * El armador (PanelAsistenteIA) vive dentro del EditorPresupuesto porque
 * necesita callbacks que solo el editor conoce (aplicar líneas al estado
 * local, crear servicios en el catálogo). Pero el FAB del copilot vive en
 * el layout global y no tiene referencia directa al editor.
 *
 * Solución:
 * Un store global pequeño que el editor registra al montarse (publicando
 * un flag "estoy listo" + el método `abrir`). El copilot consume ese
 * estado vía useSyncExternalStore para saber si puede ofrecer la acción
 * de armar líneas, y al hacer click invoca `solicitarAbrir()` que llama
 * al callback registrado.
 *
 * Cuando no hay editor montado, `disponible=false` y los consumidores
 * deben ocultar/desactivar la acción.
 */

type ListenerStore = () => void

interface EstadoArmador {
  /** true si hay un EditorPresupuesto montado que puede recibir el armador. */
  disponible: boolean
}

let estadoActual: EstadoArmador = { disponible: false }
let callbackAbrir: (() => void) | null = null
const listeners = new Set<ListenerStore>()

function notificar() {
  listeners.forEach(l => l())
}

/**
 * Llamar desde el EditorPresupuesto cuando monta. Recibe el callback que
 * abre su PanelAsistenteIA. Devuelve la función de desregistro para usar
 * dentro del cleanup del useEffect.
 */
export function registrarArmador(abrir: () => void): () => void {
  callbackAbrir = abrir
  estadoActual = { disponible: true }
  notificar()
  return () => {
    if (callbackAbrir === abrir) callbackAbrir = null
    estadoActual = { disponible: false }
    notificar()
  }
}

/**
 * Llamar desde el copilot al hacer click en la acción rápida de IA.
 * Si hay un editor escuchando, invoca su callback de abrir.
 * Devuelve true si se invocó, false si no había nadie escuchando.
 */
export function solicitarAbrirArmador(): boolean {
  if (callbackAbrir) {
    callbackAbrir()
    return true
  }
  return false
}

/**
 * Estado actual del bus. Apto para consumir desde useSyncExternalStore.
 * IMPORTANTE: devuelve referencia estable mientras no haya cambios para
 * que React no re-renderee de más.
 */
export function obtenerEstadoArmador(): EstadoArmador {
  return estadoActual
}

/** Snapshot estable para SSR — siempre indisponible. Retornamos SIEMPRE
 *  la misma referencia (no `{}` literal) para evitar el infinite loop de
 *  `useSyncExternalStore` cuando el getter SSR devuelve una nueva
 *  referencia en cada render. */
const ESTADO_INDISPONIBLE_SSR: EstadoArmador = { disponible: false }
export function obtenerEstadoArmadorSSR(): EstadoArmador {
  return ESTADO_INDISPONIBLE_SSR
}

/** Suscribirse a cambios del estado. Devuelve función de unsuscribe. */
export function suscribirArmador(listener: ListenerStore): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}
