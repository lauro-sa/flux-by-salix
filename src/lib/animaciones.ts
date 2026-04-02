/**
 * Constantes globales de animación para Framer Motion.
 * Centraliza springs, transiciones y variantes para consistencia en toda la app.
 * Se usa en: Modal, BottomSheet, Toast, Sidebar, Boton, MenuMovil, etc.
 */

// === Springs ===

/** Spring suave — modales, popovers, elementos que aparecen */
export const springSuave = {
  type: 'spring' as const,
  damping: 25,
  stiffness: 350,
}

/** Spring enérgico — botones, toggles, micro-interacciones */
export const springEnergico = {
  type: 'spring' as const,
  damping: 20,
  stiffness: 400,
}

/** Spring pesado — bottom sheets, paneles grandes */
export const springPesado = {
  type: 'spring' as const,
  damping: 32,
  stiffness: 350,
  mass: 0.8,
}

// === Transiciones por duración ===

/** Transición rápida (150ms) — hover, focus, micro-feedback */
export const transicionRapida = { duration: 0.15, ease: 'easeOut' as const }

/** Transición normal (200ms) — apariciones, cambios de estado */
export const transicionNormal = { duration: 0.2, ease: 'easeOut' as const }

/** Transición lenta (300ms) — layout changes, navegación */
export const transicionLenta = { duration: 0.3, ease: 'easeInOut' as const }

// === Variantes reutilizables ===

/** Fade in/out — para elementos que aparecen y desaparecen */
export const variantesFade = {
  oculto: { opacity: 0 },
  visible: { opacity: 1, transition: transicionNormal },
  salida: { opacity: 0, transition: transicionRapida },
}

/** Scale + fade — para modales y popovers */
export const variantesModal = {
  oculto: { opacity: 0, scale: 0.96 },
  visible: { opacity: 1, scale: 1, transition: springSuave },
  salida: { opacity: 0, scale: 0.96, transition: transicionRapida },
}

/** Slide desde abajo — para bottom sheets y toasts */
export const variantesSlideArriba = {
  oculto: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: springSuave },
  salida: { opacity: 0, y: 8, transition: transicionRapida },
}

/** Stagger children — para listas con entrada escalonada */
export const contenedorStagger = {
  visible: {
    transition: {
      staggerChildren: 0.04,
    },
  },
}

export const hijoStagger = {
  oculto: { opacity: 0, y: 8 },
  visible: { opacity: 1, y: 0, transition: springSuave },
}

// === Presets para gestos ===

/** Efecto hover/tap para botones interactivos */
export const gestosBoton = {
  whileHover: { scale: 1.02 },
  whileTap: { scale: 0.98 },
  transition: springEnergico,
}
