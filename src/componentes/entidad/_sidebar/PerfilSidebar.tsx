'use client'

/**
 * PerfilSidebar — Seccion de perfil del usuario en la parte inferior del Sidebar.
 * Avatar, estado (online/ausente/no molestar), menu con acciones de cuenta y cerrar sesion.
 */

import { useState, useRef, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import { Circle, Check, UserCog, LogOut } from 'lucide-react'
import { useTraduccion } from '@/lib/i18n'
import { OpcionMenu } from '@/componentes/ui/OpcionMenu'
import { Avatar } from '@/componentes/ui/Avatar'
import { ModalConfirmacion } from '@/componentes/ui/ModalConfirmacion'
import { useAuth } from '@/hooks/useAuth'

interface PropiedadesPerfilSidebar {
  colapsado: boolean
}

function PerfilSidebar({ colapsado }: PropiedadesPerfilSidebar) {
  const { t } = useTraduccion()
  const { usuario, cerrarSesion } = useAuth()

  const [perfilAbierto, setPerfilAbierto] = useState(false)
  const [estado, setEstado] = useState<'online' | 'ausente' | 'no_molestar'>('online')
  const [modalCerrarSesion, setModalCerrarSesion] = useState(false)
  const [cerrandoSesion, setCerrandoSesion] = useState(false)
  const [menuPos, setMenuPos] = useState<{ bottom: number; left: number } | null>(null)
  const perfilRef = useRef<HTMLDivElement>(null)

  const nombreUsuario = usuario?.user_metadata?.nombre && usuario?.user_metadata?.apellido
    ? `${usuario.user_metadata.nombre} ${usuario.user_metadata.apellido}`
    : usuario?.email?.split('@')[0] || 'Usuario'

  const manejarCerrarSesion = async () => {
    setCerrandoSesion(true)
    await cerrarSesion()
    window.location.href = '/login'
  }

  // Cerrar perfil al click fuera
  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (perfilRef.current && !perfilRef.current.contains(e.target as HTMLElement)) setPerfilAbierto(false)
    }
    document.addEventListener('click', h)
    return () => document.removeEventListener('click', h)
  }, [])

  // Calcular posición del menú cuando está colapsado (se abre a la derecha, anclado abajo)
  const abrirPerfil = useCallback(() => {
    if (colapsado && perfilRef.current) {
      const rect = perfilRef.current.getBoundingClientRect()
      setMenuPos({ bottom: window.innerHeight - rect.bottom, left: rect.right + 6 })
    }
    setPerfilAbierto(v => !v)
  }, [colapsado])

  const estados = [
    { id: 'online', etiqueta: 'Online', color: 'text-insignia-exito' },
    { id: 'ausente', etiqueta: 'Ausente', color: 'text-insignia-advertencia' },
    { id: 'no_molestar', etiqueta: 'No molestar', color: 'text-insignia-peligro' },
  ] as const

  return (
    <>
      <div ref={perfilRef} className="relative px-2 pb-2 pt-2 border-t border-borde-sutil shrink-0">
        <button onClick={colapsado ? abrirPerfil : () => setPerfilAbierto(!perfilAbierto)} className="flex items-center gap-3 w-full rounded-lg border-none cursor-pointer transition-colors hover:bg-superficie-hover bg-transparent px-2 py-2.5 focus-visible:outline-2 focus-visible:outline-texto-marca focus-visible:-outline-offset-2">
          <div className="relative shrink-0">
            <Avatar nombre={nombreUsuario} tamano="sm" />
            <span className={`absolute -bottom-0.5 -right-0.5 size-2.5 rounded-full border-2 border-superficie-sidebar ${estado === 'online' ? 'bg-insignia-exito' : estado === 'ausente' ? 'bg-insignia-advertencia' : 'bg-insignia-peligro'}`} />
          </div>
          {!colapsado && (
            <div className="flex-1 text-left min-w-0 sidebar-texto-fade">
              <div className="text-sm font-medium text-texto-primario truncate">{nombreUsuario}</div>
              <div className="text-xxs text-texto-terciario capitalize">{estado === 'no_molestar' ? 'No molestar' : estado}</div>
            </div>
          )}
        </button>
        {/* Menú desplegable — portal flotante cuando colapsado, inline cuando expandido */}
        {colapsado ? (
          typeof document !== 'undefined' && createPortal(
            <AnimatePresence>
              {perfilAbierto && menuPos && (
                <div className="fixed inset-0 z-[var(--z-popover)]" onClick={() => setPerfilAbierto(false)}>
                  <motion.div
                    initial={{ opacity: 0, x: -4 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -4 }}
                    className="absolute w-56 bg-superficie-elevada border border-borde-sutil rounded-lg shadow-lg z-[var(--z-popover)] py-1"
                    style={{ bottom: menuPos.bottom, left: menuPos.left }}
                    onClick={e => e.stopPropagation()}
                  >
                    <div className="px-3 py-1.5 text-xxs font-semibold text-texto-terciario uppercase tracking-wider">Estado</div>
                    {estados.map(est => (
                      <OpcionMenu
                        key={est.id}
                        icono={<Circle size={8} className={`fill-current ${est.color}`} />}
                        activo={estado === est.id}
                        derecha={estado === est.id ? <Check size={13} className="text-texto-marca" /> : undefined}
                        onClick={() => { setEstado(est.id); setPerfilAbierto(false) }}
                      >
                        {est.etiqueta}
                      </OpcionMenu>
                    ))}
                    <div className="h-px bg-borde-sutil my-1" />
                    <Link href="/mi-cuenta" onClick={() => setPerfilAbierto(false)} className="flex items-center gap-2 w-full px-3 py-1.5 text-sm text-texto-secundario no-underline hover:bg-superficie-hover"><UserCog size={13} /> Mi cuenta</Link>
                    <div className="h-px bg-borde-sutil my-1" />
                    <OpcionMenu icono={<LogOut size={13} />} peligro onClick={() => { setPerfilAbierto(false); setModalCerrarSesion(true) }}>{t('auth.cerrar_sesion')}</OpcionMenu>
                  </motion.div>
                </div>
              )}
            </AnimatePresence>,
            document.body
          )
        ) : (
          <AnimatePresence>
            {perfilAbierto && (
              <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 4 }} className="absolute left-2.5 right-2.5 bottom-full mb-1 bg-superficie-elevada border border-borde-sutil rounded-lg shadow-lg z-50 py-1">
                <div className="px-3 py-1.5 text-xxs font-semibold text-texto-terciario uppercase tracking-wider">Estado</div>
                {estados.map(est => (
                  <OpcionMenu
                    key={est.id}
                    icono={<Circle size={8} className={`fill-current ${est.color}`} />}
                    activo={estado === est.id}
                    derecha={estado === est.id ? <Check size={13} className="text-texto-marca" /> : undefined}
                    onClick={() => { setEstado(est.id); setPerfilAbierto(false) }}
                  >
                    {est.etiqueta}
                  </OpcionMenu>
                ))}
                <div className="h-px bg-borde-sutil my-1" />
                <Link href="/mi-cuenta" onClick={() => setPerfilAbierto(false)} className="flex items-center gap-2 w-full px-3 py-1.5 text-sm text-texto-secundario no-underline hover:bg-superficie-hover"><UserCog size={13} /> Mi cuenta</Link>
                <div className="h-px bg-borde-sutil my-1" />
                <OpcionMenu icono={<LogOut size={13} />} peligro onClick={() => { setPerfilAbierto(false); setModalCerrarSesion(true) }}>{t('auth.cerrar_sesion')}</OpcionMenu>
              </motion.div>
            )}
          </AnimatePresence>
        )}
      </div>

      {/* Modal de cerrar sesion */}
      <ModalConfirmacion
        abierto={modalCerrarSesion}
        onCerrar={() => setModalCerrarSesion(false)}
        onConfirmar={manejarCerrarSesion}
        titulo="¿Cerrar sesión?"
        descripcion="Vas a salir de tu cuenta. Podés volver a iniciar sesión en cualquier momento."
        tipo="peligro"
        etiquetaConfirmar={t('auth.cerrar_sesion')}
        cargando={cerrandoSesion}
      />
    </>
  )
}

export { PerfilSidebar }
