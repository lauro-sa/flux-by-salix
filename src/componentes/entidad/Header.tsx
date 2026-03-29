'use client'

import { useState, useRef, useEffect } from 'react'
import { useTema } from '@/hooks/useTema'
import { useTraduccion } from '@/lib/i18n'
import { Migajas } from './Migajas'
import { PanelLeft, Moon, Sun, Monitor, Check, Globe } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { Avatar } from '@/componentes/ui/Avatar'
import { useAuth } from '@/hooks/useAuth'
import type { Migaja } from '@/hooks/useNavegacion'

const BANDERAS: Record<string, string> = {
  es: '🇪🇸',
  en: '🇺🇸',
  pt: '🇧🇷',
}

/**
 * Header — Barra superior compacta estilo Linear.
 * Migajas + acciones a la derecha.
 */

interface PropiedadesHeader {
  onAbrirMenuMobil: () => void
  migajasExtras?: Migaja[]
}

const OPCIONES_TEMA = [
  { clave: 'sistema' as const, icono: <Monitor size={14} /> },
  { clave: 'claro' as const, icono: <Sun size={14} /> },
  { clave: 'oscuro' as const, icono: <Moon size={14} /> },
]

function Header({ onAbrirMenuMobil, migajasExtras }: PropiedadesHeader) {
  const { tema, temaActivo, efecto, cambiarTema } = useTema()
  const { t, idioma, cambiarIdioma, idiomasDisponibles } = useTraduccion()
  const { usuario } = useAuth()

  const nombreUsuario = usuario?.user_metadata?.nombre && usuario?.user_metadata?.apellido
    ? `${usuario.user_metadata.nombre} ${usuario.user_metadata.apellido}`
    : usuario?.email?.split('@')[0] || 'U'
  const [idiomaAbierto, setIdiomaAbierto] = useState(false)
  const idiomaRef = useRef<HTMLDivElement>(null)
  const esCristal = efecto !== 'solido'

  useEffect(() => {
    if (!idiomaAbierto) return
    const handler = (e: MouseEvent) => {
      if (idiomaRef.current && !idiomaRef.current.contains(e.target as Node)) setIdiomaAbierto(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [idiomaAbierto])

  return (
    <header className="h-[var(--header-alto)] flex items-center justify-between px-4 bg-superficie-app md:bg-superficie-tarjeta/80 md:backdrop-blur-sm border-b-0 md:border-b md:border-borde-sutil sticky top-0 z-20 gap-4 md:cristal-panel" style={{ paddingTop: 'var(--safe-area-top)' }}>
      {/* Izquierda */}
      <div className="flex items-center gap-2 flex-1 min-w-0">
        <button
          onClick={onAbrirMenuMobil}
          className="md:hidden flex items-center justify-center size-10 rounded-lg bg-transparent border-none text-texto-secundario cursor-pointer hover:bg-superficie-hover shrink-0"
        >
          <PanelLeft size={22} />
        </button>
        <Migajas extras={migajasExtras} />
      </div>

      {/* Derecha */}
      <div className="flex items-center gap-1.5 shrink-0">
        {/* Selector de idioma */}
        <div ref={idiomaRef} className="relative">
          <button
            onClick={() => setIdiomaAbierto(!idiomaAbierto)}
            className="flex items-center justify-center size-10 rounded-md bg-transparent border-none text-texto-terciario cursor-pointer hover:bg-superficie-hover transition-colors duration-100"
            title="Cambiar idioma"
          >
            <Globe size={18} />
          </button>
          <AnimatePresence>
            {idiomaAbierto && (
              <motion.div
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.12 }}
                className="absolute right-0 top-full mt-1.5 border border-borde-sutil rounded-lg shadow-lg overflow-hidden min-w-[160px]"
                style={esCristal ? {
                  backgroundColor: 'var(--superficie-flotante)',
                  backdropFilter: 'blur(32px) saturate(1.5)',
                  WebkitBackdropFilter: 'blur(32px) saturate(1.5)',
                } : {
                  backgroundColor: 'var(--superficie-elevada)',
                }}
              >
                {idiomasDisponibles.map((i) => (
                  <button
                    key={i.codigo}
                    onClick={() => { cambiarIdioma(i.codigo as 'es' | 'en' | 'pt'); setIdiomaAbierto(false) }}
                    className={[
                      'flex items-center gap-2.5 w-full px-3 py-2 text-sm border-none cursor-pointer transition-colors duration-100',
                      idioma === i.codigo
                        ? 'bg-superficie-seleccionada text-texto-marca font-medium'
                        : 'bg-transparent text-texto-primario hover:bg-superficie-hover',
                    ].join(' ')}
                  >
                    <span className="text-base leading-none">{BANDERAS[i.codigo]}</span>
                    <span className="flex-1 text-left">{i.nombre}</span>
                    {idioma === i.codigo && <Check size={14} className="text-texto-marca shrink-0" />}
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Tema: click rota sistema → claro → oscuro → sistema... */}
        <button
          onClick={() => {
            const orden = ['sistema', 'claro', 'oscuro'] as const
            const siguiente = orden[(orden.indexOf(tema as typeof orden[number]) + 1) % orden.length]
            cambiarTema(siguiente)
          }}
          title={tema === 'sistema' ? 'Sistema' : tema === 'claro' ? 'Claro' : 'Oscuro'}
          className="flex items-center justify-center size-10 rounded-md bg-transparent border-none text-texto-terciario cursor-pointer hover:bg-superficie-hover transition-colors duration-100"
        >
          {tema === 'sistema' ? <Monitor size={18} /> : tema === 'claro' ? <Sun size={18} /> : <Moon size={18} />}
        </button>

        {/* Avatar */}
        <div className="ml-1">
          <Avatar nombre={nombreUsuario} tamano="sm" />
        </div>
      </div>
    </header>
  )
}

export { Header }
