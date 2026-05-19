'use client'

/**
 * BotonFlotante — Botón flotante de Salix IA.
 * Posición fija bottom-right. Al tocar, abre el PanelChat.
 * Usa el IconoSalix (logo Flux) con hover interactivo que separa las piezas.
 * Solo visible si el usuario tiene salix_ia_web = true.
 *
 * Se usa en: PlantillaApp (se renderiza una vez en el layout principal).
 */

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { PanelChat } from './PanelChat'
import { useAuth } from '@/hooks/useAuth'
import IconoSalix from '@/componentes/marca/IconoSalix'
import { useMinimizadosFlotantes } from '@/hooks/useMinimizable'
import { restaurarMinimizados } from '@/lib/paneles-flotantes/gestor-paneles-flotantes'

/** Máximo de chats abiertos en paralelo. Más de 3 satura visualmente la
 *  cascada y multiplica conexiones al backend. */
const MAX_CHATS_SIMULTANEOS = 3

interface PropiedadesBoton {
  /** Callback para avisar al padre que el hover está activo (para empujar al botón de arriba) */
  onHoverChange?: (hover: boolean) => void
}

function BotonFlotanteSalixIA({ onHoverChange }: PropiedadesBoton = {}) {
  // Lista de chats abiertos (hasta MAX_CHATS_SIMULTANEOS en paralelo).
  // Cada elemento es el id único del chat (ej. 'salix-chat-1234567').
  // Si la lista está vacía, no hay chats abiertos.
  const [chatsAbiertos, setChatsAbiertos] = useState<string[]>([])
  const [habilitado, setHabilitado] = useState(false)
  const [hover, setHover] = useState(false)
  const { usuario, cargando } = useAuth()
  // Reaccionar a minimizar/restaurar global. Como cada chat tiene un id
  // distinto, escuchamos por TODOS los que tengamos abiertos. El hook se
  // monta una vez por id usando un componente hijo. Acá usamos un único
  // listener manual.
  useEffect(() => {
    const onMinimizar = (e: Event) => {
      const detalle = (e as CustomEvent<string[]>).detail
      if (!Array.isArray(detalle)) return
      // Cerrar visualmente los chats que estaban abiertos. Como `restaurar`
      // los reabrirá, no los borramos del state — los marcamos como
      // "minimizados" cerrándolos via la cascada del gestor (que ya los
      // sacó del stack al llamar minimizarTodos).
      if (detalle.some(id => chatsAbiertos.includes(id))) {
        setChatsAbiertos([])
      }
    }
    const onRestaurar = (e: Event) => {
      const detalle = (e as CustomEvent<string[]>).detail
      if (!Array.isArray(detalle)) return
      // Reabrir los chats que estaban minimizados. Filtramos solo los que
      // tienen prefijo 'salix-chat' para no abrir paneles de otros tipos.
      const chatsARestaurar = detalle.filter(id => id.startsWith('salix-chat'))
      if (chatsARestaurar.length > 0) {
        setChatsAbiertos(prev => {
          // Unión sin duplicados, conservando el orden de los restaurados.
          const todos = [...chatsARestaurar, ...prev.filter(id => !chatsARestaurar.includes(id))]
          return todos.slice(0, MAX_CHATS_SIMULTANEOS)
        })
      }
    }
    window.addEventListener('flux:minimizar-paneles', onMinimizar)
    window.addEventListener('flux:restaurar-paneles', onRestaurar)
    return () => {
      window.removeEventListener('flux:minimizar-paneles', onMinimizar)
      window.removeEventListener('flux:restaurar-paneles', onRestaurar)
    }
  }, [chatsAbiertos])

  // Si hay paneles minimizados, el FAB cambia de comportamiento: en vez
  // de abrir SU panel, restaura TODOS los minimizados (incluido el suyo).
  const minimizadosPendientes = useMinimizadosFlotantes()
  const hayMinimizados = minimizadosPendientes.length > 0
  const fabVisible = chatsAbiertos.length === 0 || hayMinimizados

  const abrirChat = useCallback(() => {
    setChatsAbiertos(prev => {
      if (prev.length >= MAX_CHATS_SIMULTANEOS) return prev
      // ID único por chat — timestamp suficientemente aleatorio para no
      // colisionar entre clicks rápidos del mismo usuario.
      const nuevoId = `salix-chat-${Date.now()}`
      return [...prev, nuevoId]
    })
  }, [])

  const cerrarChat = useCallback((id: string) => {
    setChatsAbiertos(prev => prev.filter(c => c !== id))
  }, [])

  // Verificar si Salix IA está habilitado — depende solo de que haya sesión
  useEffect(() => {
    if (cargando || !usuario) return

    const verificar = async () => {
      try {
        const res = await fetch('/api/salix-ia/estado')
        if (res.ok) {
          const data = await res.json()
          setHabilitado(data.habilitado)
        }
      } catch {
        // Si falla, no mostrar el botón
      }
    }

    verificar()
  }, [usuario, cargando])

  if (!habilitado) return null

  return (
    <>
      {/* Botón flotante — visible cuando no hay chats abiertos, o cuando
          hay minimizados pendientes (para restaurarlos). */}
      <AnimatePresence>
        {fabVisible && (
          <motion.button
            data-fab-flotante="salix-chat"
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            whileTap={{ scale: 0.92 }}
            onMouseEnter={() => { setHover(true); onHoverChange?.(true) }}
            onMouseLeave={() => { setHover(false); onHoverChange?.(false) }}
            onClick={() => {
              // Si hay paneles minimizados, los restauramos todos en lugar
              // de abrir un chat nuevo. Si no, abrimos un chat.
              if (hayMinimizados) restaurarMinimizados()
              else abrirChat()
            }}
            className="size-12 flex items-center justify-center text-texto-marca drop-shadow-lg transition-all duration-200 relative"
            title={hayMinimizados ? `Restaurar ${minimizadosPendientes.length} panel${minimizadosPendientes.length > 1 ? 'es' : ''}` : 'Abrir Salix IA'}
          >
            {/* Glow centrado detrás del ícono — rellena huecos entre piezas al separarse */}
            <motion.div
              animate={{
                scale: hover ? 1.15 : 0.85,
                opacity: hover ? 0.85 : 0,
              }}
              transition={{ duration: 0.25, ease: 'easeOut' }}
              style={{
                position: 'absolute',
                width: 40,
                height: 40,
                borderRadius: '50%',
                background: 'var(--superficie-app)',
                filter: 'blur(12px)',
                pointerEvents: 'none',
              }}
            />
            <IconoSalix
              tamano={hover ? 38 : 32}
              hover
              variante="estatico"
              className="transition-all duration-200 relative"
            />
          </motion.button>
        )}
      </AnimatePresence>

      {/* Render de los chats abiertos. Cada uno con su propio id, su propio
          PanelChat (que internamente crea su instancia de useSalixIA) y un
          callback para abrir otro chat (deshabilitado si ya hay MAX). */}
      {chatsAbiertos.map((idChat, i) => (
        <PanelChat
          key={idChat}
          idChat={idChat}
          etiquetaChat={chatsAbiertos.length > 1 ? `Chat ${i + 1}` : 'Chat'}
          abierto={true}
          onCerrar={() => cerrarChat(idChat)}
          onAbrirNuevoChat={abrirChat}
          puedeAbrirNuevoChat={chatsAbiertos.length < MAX_CHATS_SIMULTANEOS}
        />
      ))}
    </>
  )
}

export { BotonFlotanteSalixIA }
