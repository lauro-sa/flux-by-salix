'use client'

/**
 * SwitcherEmpresa — Selector de empresa en la parte superior del Sidebar.
 * Muestra logo/inicial, nombre de empresa, y dropdown para cambiar entre empresas.
 */

import { useState, useEffect, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronDown, Check, Plus } from 'lucide-react'
import { OpcionMenu } from '@/componentes/ui/OpcionMenu'
import { useTraduccion } from '@/lib/i18n'
import { useAuth } from '@/hooks/useAuth'
import { useEmpresa } from '@/hooks/useEmpresa'

interface PropiedadesSwitcherEmpresa {
  colapsado: boolean
  onToggle: () => void
}

function SwitcherEmpresa({ colapsado, onToggle }: PropiedadesSwitcherEmpresa) {
  const { t } = useTraduccion()
  const router = useRouter()
  const { empresa, empresas, cambiarEmpresa } = useEmpresa()
  const [abierto, setAbierto] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  const nombreEmpresa = empresa?.nombre || 'Mi empresa'
  const inicialEmpresa = nombreEmpresa[0]?.toUpperCase() || 'F'
  const logoEmpresa = empresa?.logo_url || null
  const [menuPos, setMenuPos] = useState<{ top: number; left: number } | null>(null)

  // Calcular posición del menú cuando está colapsado (se abre a la derecha)
  const abrirMenu = useCallback(() => {
    if (colapsado && ref.current) {
      const rect = ref.current.getBoundingClientRect()
      setMenuPos({ top: rect.top, left: rect.right + 6 })
    }
    setAbierto(v => !v)
  }, [colapsado])

  // Atajo Cmd+Shift+E para abrir el switcher
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 'E') {
        e.preventDefault()
        abrirMenu()
      }
    }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [abrirMenu])

  // Cerrar al click fuera
  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as HTMLElement)) setAbierto(false)
    }
    document.addEventListener('click', h)
    return () => document.removeEventListener('click', h)
  }, [])

  return (
    <div ref={ref} className={`relative py-4 shrink-0 ${colapsado ? 'px-0' : 'px-3'}`} style={{ height: 72 }}>
      <div className={`flex items-center w-full rounded-boton h-10 ${colapsado ? 'justify-center' : 'gap-2.5 px-2'}`}>
        {/* Logo — toggle sidebar en expandido, abre switcher en colapsado */}
        <button
          onClick={colapsado ? abrirMenu : onToggle}
          className={`size-10 rounded-card flex items-center justify-center text-white font-bold text-base shrink-0 border-none cursor-pointer hover:opacity-80 transition-opacity focus-visible:outline-2 focus-visible:outline-texto-marca focus-visible:-outline-offset-2 ${logoEmpresa ? '' : 'bg-texto-marca'}`}
        >
          {logoEmpresa ? (
            <Image src={logoEmpresa} alt={nombreEmpresa} width={40} height={40} className="size-10 rounded-card object-cover" />
          ) : (
            inicialEmpresa
          )}
        </button>
        {/* Nombre + flecha — abre switcher empresa */}
        {!colapsado && (
          <button
            onClick={() => setAbierto(!abierto)}
            className="flex items-center gap-2 flex-1 min-w-0 bg-transparent border-none cursor-pointer rounded-card hover:bg-superficie-hover px-2.5 py-0 transition-colors sidebar-texto-fade focus-visible:outline-2 focus-visible:outline-texto-marca focus-visible:-outline-offset-2"
          >
            <div className="flex-1 text-left min-w-0">
              <div className="text-md font-semibold text-texto-primario truncate">{nombreEmpresa}</div>
              <div className="text-xxs text-texto-terciario truncate leading-tight">Flux by Salix</div>
            </div>
            <ChevronDown size={14} className={`text-texto-terciario transition-transform ${abierto ? 'rotate-180' : ''}`} />
          </button>
        )}
      </div>
      {/* Menú desplegable — portal flotante cuando colapsado, inline cuando expandido */}
      {colapsado ? (
        typeof document !== 'undefined' && createPortal(
          <AnimatePresence>
            {abierto && menuPos && (
              <div className="fixed inset-0 z-[var(--z-popover)]" onClick={() => setAbierto(false)}>
                <motion.div
                  initial={{ opacity: 0, x: -4 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -4 }}
                  className="absolute w-64 bg-superficie-elevada border border-borde-sutil rounded-popover shadow-lg z-[var(--z-popover)] py-1"
                  style={{ top: menuPos.top, left: menuPos.left }}
                  onClick={e => e.stopPropagation()}
                >
                  <div className="px-3 py-1.5 text-xxs font-semibold text-texto-terciario uppercase tracking-wider">{t('sidebar.empresas')}</div>
                  {empresas.map(emp => (
                    <button key={emp.id} onClick={async () => { if (emp.id !== empresa?.id) { await cambiarEmpresa(emp.id); router.push('/dashboard') } setAbierto(false) }} className="flex items-center gap-2.5 w-full px-3 py-2 text-left border-none cursor-pointer bg-transparent hover:bg-superficie-hover focus-visible:outline-2 focus-visible:outline-texto-marca focus-visible:-outline-offset-2 rounded-card">
                      <div className={`size-7 rounded-boton flex items-center justify-center text-white font-bold text-xs shrink-0 ${!emp.logo_url ? (emp.id === empresa?.id ? 'bg-texto-marca' : 'bg-texto-terciario') : ''}`}>
                        {emp.logo_url ? (
                          <Image src={emp.logo_url} alt={emp.nombre} width={28} height={28} className="size-7 rounded-boton object-cover" />
                        ) : (
                          emp.nombre[0]
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm text-texto-primario truncate">{emp.nombre}</div>
                        <div className="text-xxs text-texto-terciario capitalize">{emp.rol}</div>
                      </div>
                      {emp.id === empresa?.id && <Check size={14} className="text-texto-marca shrink-0" />}
                    </button>
                  ))}
                  <div className="h-px bg-borde-sutil my-1" />
                  <OpcionMenu icono={<Plus size={14} />} activo>{t('sidebar.agregar_empresa')}</OpcionMenu>
                  <div className="px-3 py-1.5 text-xxs text-texto-terciario">&#x2318; Shift E</div>
                </motion.div>
              </div>
            )}
          </AnimatePresence>,
          document.body
        )
      ) : (
        <AnimatePresence>
          {abierto && (
            <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} className="absolute left-2.5 right-2.5 top-full mt-1 bg-superficie-elevada border border-borde-sutil rounded-popover shadow-lg z-50 py-1">
              <div className="px-3 py-1.5 text-xxs font-semibold text-texto-terciario uppercase tracking-wider">{t('sidebar.empresas')}</div>
              {empresas.map(emp => (
                <button key={emp.id} onClick={async () => { if (emp.id !== empresa?.id) { await cambiarEmpresa(emp.id); router.push('/dashboard') } setAbierto(false) }} className="flex items-center gap-2.5 w-full px-3 py-2 text-left border-none cursor-pointer bg-transparent hover:bg-superficie-hover focus-visible:outline-2 focus-visible:outline-texto-marca focus-visible:-outline-offset-2 rounded-card">
                  <div className={`size-7 rounded-boton flex items-center justify-center text-white font-bold text-xs shrink-0 ${!emp.logo_url ? (emp.id === empresa?.id ? 'bg-texto-marca' : 'bg-texto-terciario') : ''}`}>
                    {emp.logo_url ? (
                      <Image src={emp.logo_url} alt={emp.nombre} width={28} height={28} className="size-7 rounded-boton object-cover" />
                    ) : (
                      emp.nombre[0]
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-texto-primario truncate">{emp.nombre}</div>
                    <div className="text-xxs text-texto-terciario capitalize">{emp.rol}</div>
                  </div>
                  {emp.id === empresa?.id && <Check size={14} className="text-texto-marca shrink-0" />}
                </button>
              ))}
              <div className="h-px bg-borde-sutil my-1" />
              <OpcionMenu icono={<Plus size={14} />} activo>{t('sidebar.agregar_empresa')}</OpcionMenu>
              <div className="px-3 py-1.5 text-xxs text-texto-terciario">&#x2318; Shift E</div>
            </motion.div>
          )}
        </AnimatePresence>
      )}
    </div>
  )
}

export { SwitcherEmpresa }
