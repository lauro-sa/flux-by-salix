'use client'

import { type ReactNode, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  usePanelFlotante,
  ANCHO_PANEL,
  OFFSET_BORDE,
} from '@/hooks/usePanelFlotante'
import { useEsMovil } from '@/hooks/useEsMovil'
import { minimizarTodos } from '@/lib/paneles-flotantes/gestor-paneles-flotantes'

/**
 * PanelFlotanteCascada — Wrapper unificado para todos los paneles laterales
 * derechos del sistema (Salix IA Chat, Notas Rápidas, Recordatorios, Armador
 * de presupuesto).
 *
 * Qué hace:
 *  - Se registra en el gestor global de paneles flotantes al abrirse.
 *  - Si hay UNO solo abierto, se comporta como antes: pegado al borde derecho,
 *    con backdrop oscuro y animación de slide.
 *  - Si hay MÚLTIPLES abiertos, se apila como una cascada de hojas: el del
 *    frente pegado al borde derecho, los de atrás escalonados a la izquierda
 *    asomando OFFSET_BORDE px de su lado izquierdo. Cada panel atrás tiene
 *    una solapa clickeable que lo trae al frente con animación spring.
 *  - En móvil (pantalla chica) NO hay cascada: el frente ocupa todo, los
 *    otros quedan registrados en el stack pero invisibles. Tocar el FAB de
 *    un panel atrás lo trae al frente.
 *
 * API:
 *   <PanelFlotanteCascada
 *     id="salix-chat"
 *     etiqueta="Salix IA"
 *     colorAcento="var(--insignia-primario)"
 *     abierto={panelAbierto}
 *     onCerrar={() => setPanelAbierto(false)}
 *     zBase={70}
 *   >
 *     {contenido del panel}
 *   </PanelFlotanteCascada>
 */

interface PropsPanelFlotanteCascada {
  /** ID único del panel en el stack global. */
  id: string
  /** Etiqueta corta que se muestra rotada en la solapa cuando el panel está
   *  atrás (ej. "Chat", "Notas", "Recordatorios", "Salix IA"). */
  etiqueta: string
  /** Color de acento (var CSS o hex) para el indicador visual de la solapa. */
  colorAcento: string
  abierto: boolean
  onCerrar: () => void
  /** z-index base del panel del frente. Los de atrás usan zBase - posicion.
   *  Default 70 (mismo valor que PanelChat). */
  zBase?: number
  /** Mostrar el overlay oscuro detrás del panel del frente. Default true. */
  mostrarBackdrop?: boolean
  children: ReactNode
}

export function PanelFlotanteCascada({
  id,
  etiqueta,
  colorAcento,
  abierto,
  onCerrar,
  zBase = 70,
  mostrarBackdrop = true,
  children,
}: PropsPanelFlotanteCascada) {
  const esMovil = useEsMovil()
  const { posicion, total, esFrente, enStack, minimizado, traerAlFrente } = usePanelFlotante({
    id,
    etiqueta,
    colorAcento,
    abierto,
  })
  const [montado, setMontado] = useState(false)

  // Snapshot del último estado VISIBLE en stack. Lo usamos durante la
  // minimización para que el panel anime su salida desde la posición
  // donde estaba — sin esto, los paneles que estaban "atrás" en la
  // cascada (visibility: hidden) se hacen visibles abruptamente al
  // colapsar el stack y se ve feo. Capturamos posicion/total/esFrente
  // mientras enStack=true; cuando el panel se minimiza (enStack=false
  // pero abierto=true) usamos este snapshot para mantener su layout.
  const ultimoVisibleRef = useRef({ posicion: 0, total: 1, esFrente: true })
  useEffect(() => {
    if (enStack) {
      ultimoVisibleRef.current = { posicion, total, esFrente }
    }
  }, [enStack, posicion, total, esFrente])

  const posicionEf = enStack ? posicion : ultimoVisibleRef.current.posicion
  const totalEf = enStack ? total : ultimoVisibleRef.current.total
  const esFrenteEf = enStack ? esFrente : ultimoVisibleRef.current.esFrente

  // SSR-safe portal: el portal recién se hace en el primer efecto client-side.
  useEffect(() => {
    setMontado(true)
  }, [])

  // Listener global de doble click afuera de los paneles → minimizar todos.
  // Solo lo monta el panel del FRENTE (real, en stack) para que no se
  // duplique entre paneles del stack. Se desactiva si no hay paneles
  // abiertos en stack o si este panel está minimizado.
  useEffect(() => {
    if (!esFrente || total === 0 || minimizado) return
    const handler = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null
      if (!target) return
      // Si el doble click ocurrió dentro de algún panel flotante o sobre un
      // FAB que abre paneles, ignorar — esos clicks no son "afuera".
      if (target.closest('[data-panel-flotante]')) return
      if (target.closest('[data-fab-flotante]')) return
      minimizarTodos()
    }
    window.addEventListener('dblclick', handler)
    return () => window.removeEventListener('dblclick', handler)
  }, [esFrente, total, minimizado])

  if (!montado || typeof window === 'undefined') return null

  // Mobile: comportamiento simple sin cascada. El frente ocupa todo,
  // los demás quedan invisibles registrados en el stack. Al minimizar,
  // el panel se mantiene MONTADO con `y: '100%'` para preservar su
  // estado interno (formularios, scroll, conversación). Sólo cuando
  // `abierto` baja a false (X explícita) se desmonta.
  if (esMovil) {
    return createPortal(
      <AnimatePresence>
        {abierto && (esFrenteEf || totalEf <= 1) && (
          <motion.div
            data-panel-flotante={id}
            initial={{ y: '100%' }}
            animate={{ y: minimizado ? '100%' : 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300, mass: 0.8 }}
            className="salix-glass salix-panel fixed inset-0 z-[80] flex flex-col"
            style={{
              paddingTop: 'env(safe-area-inset-top, 0px)',
              paddingBottom: 'env(safe-area-inset-bottom, 0px)',
              height: 'calc(var(--vh, 1vh) * 100)',
              pointerEvents: minimizado ? 'none' : 'auto',
            }}
          >
            {children}
          </motion.div>
        )}
      </AnimatePresence>,
      document.body,
    )
  }

  // Desktop: cascada. Cada panel atrás se DESPLAZA SOLO `OFFSET_BORDE` px
  // a la izquierda del que tiene adelante (no `ANCHO - OFFSET`). Resultado:
  // el panel atrás queda casi 100% tapado por el frente; solo asoma esa
  // franja chiquita por la izquierda — como hojas apiladas.
  //   posicion=0 (frente)  → right: 0          (visible entero)
  //   posicion=1 (atrás 1) → right: 14         (solo asoma 14px a la izq)
  //   posicion=N           → right: N * 14
  // Usamos posicionEf/totalEf/esFrenteEf (snapshot del último estado en
  // stack) para que durante la minimización el panel anime su salida
  // desde donde estaba y no se reposicione abruptamente al `right: 0`.
  const rightCalculado = posicionEf * OFFSET_BORDE
  const zIndex = abierto ? zBase - Math.max(posicionEf, 0) : zBase

  // Visibilidad efectiva en la cascada (sin contar minimización):
  // sólo el frente y el caso de un único panel son visibles; los de atrás
  // quedan ocultos para no robar clicks. La minimización se maneja
  // aparte vía width/opacity en el animate del motion.div.
  const visibleEnCascada = esFrenteEf || totalEf <= 1

  return createPortal(
    <AnimatePresence>
      {abierto && (
        <>
          {/* Backdrop oscuro — solo cuando este panel es el frente Y NO hay
              otros apilados detrás Y no está minimizado. Si hay cascada,
              no lo mostramos porque taparía las solapas asomando de los
              paneles atrás y robaría los clicks. Para cerrar con cascada
              se usa la X o ESC. */}
          {mostrarBackdrop && esFrenteEf && totalEf === 1 && !minimizado && (
            <motion.div
              key={`backdrop-${id}`}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={onCerrar}
              className="fixed inset-0 bg-black/20"
              style={{ zIndex: zIndex - 1 }}
            />
          )}

          {/* Wrapper EXTERIOR: animamos su `width` de 0 → ANCHO_PANEL.
              Está fijo al borde derecho de la pantalla (a `rightCalculado`
              píxeles) y tiene `overflow: hidden`. Cuando el width crece,
              el contenido se REVELA desde la derecha hacia la izquierda
              sin distorsión (porque el contenido adentro tiene tamaño fijo).
              Este es el approach limpio para "nacer desde el borde derecho";
              scaleX deformaba el contenido y clipPath no interpolaba bien.

              Cuando se MINIMIZA, animamos width y opacity de vuelta a 0
              pero el componente sigue montado: así preserva su estado
              interno (formularios, conversación, scroll). Sólo cuando
              `abierto` baja a false (cierre definitivo por X), AnimatePresence
              desmonta el componente. */}
          <motion.div
            key={`panel-${id}`}
            data-panel-flotante={id}
            initial={{ opacity: 0, width: 0, right: rightCalculado }}
            animate={{
              opacity: minimizado ? 0 : 1,
              width: minimizado ? 0 : ANCHO_PANEL,
              right: rightCalculado,
            }}
            exit={{ opacity: 0, width: 0 }}
            transition={{
              opacity: { duration: 0.18 },
              width: { duration: 0.32, ease: [0.16, 1, 0.3, 1] },
              right: { type: 'spring', damping: 28, stiffness: 260 },
            }}
            style={{
              position: 'fixed',
              top: 0,
              height: '100%',
              overflow: 'hidden',
              zIndex,
              maxWidth: '92vw',
              pointerEvents: minimizado ? 'none' : (visibleEnCascada ? 'auto' : 'none'),
              // Cuando está minimizado, el panel está animando width→0;
              // mantenerlo `visible` durante la animación es necesario
              // para que se vea el colapso. Después de la animación el
              // width=0 lo hace invisible de facto.
              visibility: minimizado ? 'visible' : (visibleEnCascada ? 'visible' : 'hidden'),
            }}
          >
            {/* Contenido interno: tamaño FIJO de ANCHO_PANEL, anclado al
                lado derecho del wrapper. Mientras el wrapper crece, este
                contenido siempre tiene el tamaño correcto y se va "revelando"
                desde la derecha. */}
            <aside
              className="salix-glass salix-panel absolute top-0 right-0 h-full flex flex-col border-l border-white/[0.07] shadow-2xl"
              style={{ width: ANCHO_PANEL, maxWidth: '92vw' }}
            >
              {children}
            </aside>
          </motion.div>

          {/* Solapa-borde: SIBLING del aside (no hijo), para evitar problemas
              de stacking context con salix-glass / backdrop-filter. Se ancla
              al borde izquierdo del panel atrás (los OFFSET_BORDE px visibles
              que asoman a la izquierda del frente). Su zIndex es el del aside
              + 1, así garantiza que recibe los clicks en su franja sin que el
              frente la tape.

              Internamente usa flex items-center justify-center para que la
              etiqueta vertical quede SIEMPRE centrada verticalmente, sin
              importar el alto del viewport.

              Cuando este panel está minimizado, la solapa también desaparece
              (width→0). */}
          {!esFrenteEf && totalEf > 1 && (
            // Misma técnica que el panel: wrapper exterior con width animado
            // de 0 → OFFSET_BORDE, anclado al borde derecho del panel atrás.
            // La solapa adentro tiene tamaño fijo y se revela desde la derecha.
            <motion.div
              key={`solapa-${id}`}
              data-panel-flotante={`${id}-solapa`}
              initial={{ opacity: 0, width: 0, right: rightCalculado + ANCHO_PANEL - OFFSET_BORDE }}
              animate={{
                opacity: minimizado ? 0 : 1,
                width: minimizado ? 0 : OFFSET_BORDE,
                right: rightCalculado + ANCHO_PANEL - OFFSET_BORDE,
              }}
              exit={{ opacity: 0, width: 0 }}
              transition={{
                opacity: { duration: 0.18 },
                width: { duration: 0.3, ease: [0.16, 1, 0.3, 1] },
                right: { type: 'spring', damping: 28, stiffness: 260 },
              }}
              style={{
                position: 'fixed',
                top: 0,
                height: '100%',
                overflow: 'hidden',
                zIndex: zIndex + 1,
                pointerEvents: minimizado ? 'none' : 'auto',
              }}
            >
              <button
                type="button"
                onClick={traerAlFrente}
                title={`Mostrar ${etiqueta}`}
                aria-label={`Mostrar panel ${etiqueta}`}
                className="absolute top-0 right-0 h-full cursor-pointer group flex items-center justify-center"
                style={{
                  width: OFFSET_BORDE,
                  // Fondo opaco SÓLIDO + degradé del acento encima. Sin el
                  // sólido, el degradé semi-transparente se mezclaba con el
                  // contenido detrás.
                  backgroundColor: '#15151c',
                  backgroundImage: `linear-gradient(to right, ${colorAcento}, ${colorAcento}cc 60%, ${colorAcento}88)`,
                  boxShadow: `inset 1px 0 0 ${colorAcento}, 2px 0 8px -2px rgba(0,0,0,0.45)`,
                }}
              >
                {/* Etiqueta vertical centrada por el flex del button. */}
                <span
                  className="text-[10px] font-semibold tracking-widest uppercase text-white group-hover:text-white transition-colors pointer-events-none whitespace-nowrap"
                  style={{
                    writingMode: 'vertical-rl',
                    transform: 'rotate(180deg)',
                    textShadow: '0 1px 3px rgba(0,0,0,0.7)',
                  }}
                >
                  {etiqueta}
                </span>
                {/* Hover overlay: ilumina toda la franja sutilmente. */}
                <span
                  className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"
                  style={{ background: 'rgba(255,255,255,0.18)' }}
                />
              </button>
            </motion.div>
          )}
        </>
      )}
    </AnimatePresence>,
    document.body,
  )
}
