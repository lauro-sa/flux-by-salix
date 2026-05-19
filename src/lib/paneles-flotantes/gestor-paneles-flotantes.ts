/**
 * gestor-paneles-flotantes — Store global de los paneles laterales derechos
 * (Salix IA Chat, Notas Rápidas, Recordatorios, Armador de presupuesto).
 *
 * Problema que resuelve:
 * Cada panel hoy es independiente y se ancla a `right: 0`. Si el usuario
 * abre dos al mismo tiempo, uno tapa al otro porque comparten posición.
 *
 * Solución:
 * Un gestor que coordina el orden y la posición visual de los paneles
 * abiertos para mostrarlos como una cascada de hojas: el del frente
 * pegado al borde derecho, los de atrás escalonados a la izquierda con
 * un borde sutil asomando. Click en el borde de un panel atrás lo
 * promueve al frente con una animación de cross-slide.
 *
 * El gestor expone:
 *  - `registrar(panel)`: agrega un panel al stack (o lo trae al frente si
 *    ya estaba). Devuelve función de unregister para el cleanup.
 *  - `promover(id)`: lleva un panel ya registrado al frente sin tocar los
 *    demás (los empuja un escalón).
 *  - `cerrar(id)`: quita el panel del stack. El siguiente queda al frente.
 *  - `subscribir(listener)` + `obtener()` para useSyncExternalStore.
 *
 * El ORDEN del array significa: index 0 = frente. Los componentes consumen
 * su posición vía `usePanelFlotante` y aplican estilos según corresponda.
 */

export interface PanelFlotanteRegistrado {
  /** Identificador único del panel (ej. 'salix-chat', 'notas', 'recordatorios', 'armador-presupuesto'). */
  id: string
  /** Etiqueta corta para mostrar en el borde clickeable de los paneles de atrás. */
  etiqueta: string
  /** Color de acento del panel — se usa en el borde clickeable para que cada panel sea reconocible al ojo. */
  colorAcento: string
}

type Listener = () => void

const CLAVE_SS_MINIMIZADOS = 'flux_paneles_minimizados'

let stack: PanelFlotanteRegistrado[] = []
/** Set de IDs de paneles que fueron MINIMIZADOS (no cerrados). Se persiste
 *  en sessionStorage para sobrevivir minimización pero perderse al cerrar
 *  el browser o cerrar sesión. */
let minimizados: PanelFlotanteRegistrado[] = (() => {
  if (typeof window === 'undefined') return []
  try {
    const raw = sessionStorage.getItem(CLAVE_SS_MINIMIZADOS)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
})()
const listeners = new Set<Listener>()

function notificar() {
  listeners.forEach(l => l())
}

function persistirMinimizados() {
  if (typeof window === 'undefined') return
  try {
    sessionStorage.setItem(CLAVE_SS_MINIMIZADOS, JSON.stringify(minimizados))
  } catch {
    // sessionStorage puede fallar (modo privado, cuota); ignoramos.
  }
}

/**
 * Agrega un panel al stack (al frente). Si ya estaba registrado, lo promueve
 * al frente sin duplicar.
 *
 * Devuelve la función de cleanup para usar en el useEffect que registra:
 *   useEffect(() => registrar({...}), [...])
 */
export function registrarPanel(panel: PanelFlotanteRegistrado): () => void {
  const existe = stack.find(p => p.id === panel.id)
  if (existe) {
    // Ya estaba: lo promovemos al frente sin duplicar.
    stack = [panel, ...stack.filter(p => p.id !== panel.id)]
  } else {
    stack = [panel, ...stack]
  }
  notificar()
  return () => cerrarPanel(panel.id)
}

/** Promueve un panel ya registrado al frente. No-op si no estaba registrado. */
export function promoverPanel(id: string): void {
  const panel = stack.find(p => p.id === id)
  if (!panel) return
  stack = [panel, ...stack.filter(p => p.id !== id)]
  notificar()
}

/** Quita un panel del stack. El siguiente queda al frente.
 *  Si el panel estaba en `minimizados`, también se quita de ahí —
 *  cerrar manualmente significa "ya no me importa". */
export function cerrarPanel(id: string): void {
  const antesStack = stack.length
  const antesMin = minimizados.length
  stack = stack.filter(p => p.id !== id)
  minimizados = minimizados.filter(p => p.id !== id)
  if (minimizados.length !== antesMin) persistirMinimizados()
  if (stack.length !== antesStack || minimizados.length !== antesMin) notificar()
}

/** Minimiza TODOS los paneles abiertos: los saca del stack pero los
 *  guarda en `minimizados` para que el FAB pueda restaurarlos después.
 *  Emite un CustomEvent para que cada host de panel cierre su flag
 *  `abierto` interno sin tratar esto como un cierre definitivo.
 *  No-op si no hay paneles abiertos. */
export function minimizarTodos(): void {
  if (stack.length === 0) return
  minimizados = [...stack]
  const idsAMinimizar = minimizados.map(p => p.id)
  stack = []
  persistirMinimizados()
  notificar()
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('flux:minimizar-paneles', { detail: idsAMinimizar }))
  }
}

/** Restaura los paneles que fueron minimizados. Emite un CustomEvent
 *  con los IDs para que cada host vuelva a abrir su panel correspondiente.
 *  El orden visual se preserva (el que estaba al frente vuelve al frente)
 *  porque los hosts emiten su `abierto=true` en orden y el gestor los
 *  registra como nuevos paneles en ese orden. */
export function restaurarMinimizados(): PanelFlotanteRegistrado[] {
  if (minimizados.length === 0) return []
  const restaurados = [...minimizados]
  const idsARestaurar = restaurados.map(p => p.id)
  minimizados = []
  persistirMinimizados()
  notificar()
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('flux:restaurar-paneles', { detail: idsARestaurar }))
  }
  return restaurados
}

/** Snapshot de los paneles minimizados. */
export function obtenerMinimizados(): PanelFlotanteRegistrado[] {
  return minimizados
}
/** Snapshot SSR — misma referencia constante (ver explicación en
 *  `obtenerStackPanelesSSR`). */
const MINIMIZADOS_VACIO_SSR: PanelFlotanteRegistrado[] = []
export function obtenerMinimizadosSSR(): PanelFlotanteRegistrado[] {
  return MINIMIZADOS_VACIO_SSR
}

/** Snapshot del stack actual. NO mutar el array devuelto. */
export function obtenerStackPaneles(): PanelFlotanteRegistrado[] {
  return stack
}

/** Snapshot SSR: stack vacío. IMPORTANTE: retornamos siempre la MISMA
 *  referencia (no `[]` literal por llamada) para evitar el infinite loop
 *  de `useSyncExternalStore` que sucede cuando el getter SSR devuelve una
 *  referencia nueva en cada render. */
const STACK_VACIO_SSR: PanelFlotanteRegistrado[] = []
export function obtenerStackPanelesSSR(): PanelFlotanteRegistrado[] {
  return STACK_VACIO_SSR
}

export function suscribirPaneles(listener: Listener): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}
