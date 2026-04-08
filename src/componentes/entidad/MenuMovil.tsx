'use client'

import { useState, useCallback } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import Image from 'next/image'
import { motion } from 'framer-motion'
import { useTraduccion } from '@/lib/i18n'
import { useAuth } from '@/hooks/useAuth'
import { useEmpresa } from '@/hooks/useEmpresa'
import { useRol } from '@/hooks/useRol'
import { useModulos } from '@/hooks/useModulos'
import { useNotificaciones } from '@/hooks/useNotificaciones'
import { useScrollLockiOS } from '@/hooks/useScrollLockiOS'
import { Avatar } from '@/componentes/ui/Avatar'
import { OpcionMenu } from '@/componentes/ui/OpcionMenu'
import { ModalConfirmacion } from '@/componentes/ui/ModalConfirmacion'
import type { Modulo } from '@/tipos'
import {
  Users, Zap, Calendar, MapPin, Mail, Clock,
  FileText, Package, Shield, Trash2, Route, Wrench,
  FileBarChart, LayoutDashboard, Blocks, Building2,
  UserCog, X, LogOut, ChevronRight, Check, Plus,
  Circle, Megaphone,
} from 'lucide-react'

/**
 * MenuMovil — Menú de navegación fullscreen para teléfonos.
 * Se abre desde el botón hamburguesa del header.
 * Ocupa toda la pantalla con animación de entrada.
 * Diseñado para iOS y Android (safe areas, scroll, haptics).
 */

interface ItemNav {
  id: string
  etiqueta: string
  icono: React.ReactNode
  ruta: string
  badge?: number
  seccion: string
  modulo?: string
  moduloCatalogo?: string
}

interface PropiedadesMenuMovil {
  abierto: boolean
  onCerrar: () => void
}

function crearItemsMovil(t: (c: string) => string): ItemNav[] {
  return [
    { id: 'inicio', etiqueta: t('navegacion.inicio'), icono: <LayoutDashboard size={20} strokeWidth={1.7} />, ruta: '/dashboard', seccion: 'principal' },
    { id: 'inbox', etiqueta: t('navegacion.inbox'), icono: <Mail size={20} strokeWidth={1.7} />, ruta: '/inbox', seccion: 'principal', modulo: 'inbox_interno', moduloCatalogo: 'inbox' },
    { id: 'contactos', etiqueta: t('navegacion.contactos'), icono: <Users size={20} strokeWidth={1.7} />, ruta: '/contactos', seccion: 'principal', modulo: 'contactos', moduloCatalogo: 'contactos' },
    { id: 'actividades', etiqueta: t('navegacion.actividades'), icono: <Zap size={20} strokeWidth={1.7} />, ruta: '/actividades', seccion: 'principal', modulo: 'actividades', moduloCatalogo: 'actividades' },
    { id: 'calendario', etiqueta: t('navegacion.calendario'), icono: <Calendar size={20} strokeWidth={1.7} />, ruta: '/calendario', seccion: 'principal', modulo: 'calendario', moduloCatalogo: 'calendario' },
    { id: 'visitas', etiqueta: t('navegacion.visitas'), icono: <MapPin size={20} strokeWidth={1.7} />, ruta: '/visitas', seccion: 'principal', modulo: 'visitas', moduloCatalogo: 'visitas' },
    { id: 'recorrido', etiqueta: t('navegacion.recorrido'), icono: <Route size={20} strokeWidth={1.7} />, ruta: '/recorrido', seccion: 'principal', modulo: 'recorrido', moduloCatalogo: 'recorrido' },
    { id: 'marketing', etiqueta: t('navegacion.marketing'), icono: <Megaphone size={20} strokeWidth={1.7} />, ruta: '/marketing', seccion: 'principal', moduloCatalogo: 'marketing' },
    { id: 'productos', etiqueta: t('navegacion.productos'), icono: <Package size={20} strokeWidth={1.7} />, ruta: '/productos', seccion: 'documentos', modulo: 'productos', moduloCatalogo: 'productos' },
    { id: 'presupuestos', etiqueta: t('navegacion.presupuestos'), icono: <FileText size={20} strokeWidth={1.7} />, ruta: '/presupuestos', seccion: 'documentos', modulo: 'presupuestos', moduloCatalogo: 'presupuestos' },
    { id: 'informes', etiqueta: t('navegacion.informes'), icono: <FileBarChart size={20} strokeWidth={1.7} />, ruta: '/informes', seccion: 'documentos', modulo: 'informes', moduloCatalogo: 'informes' },
    { id: 'ordenes', etiqueta: t('navegacion.ordenes'), icono: <Wrench size={20} strokeWidth={1.7} />, ruta: '/ordenes', seccion: 'documentos', modulo: 'ordenes_trabajo', moduloCatalogo: 'ordenes_trabajo' },
    { id: 'asistencias', etiqueta: t('navegacion.asistencias'), icono: <Clock size={20} strokeWidth={1.7} />, ruta: '/asistencias', seccion: 'admin', modulo: 'asistencias', moduloCatalogo: 'asistencias' },
    { id: 'auditoria', etiqueta: t('navegacion.auditoria'), icono: <Shield size={20} strokeWidth={1.7} />, ruta: '/auditoria', seccion: 'admin', modulo: 'auditoria', moduloCatalogo: 'auditoria' },
    { id: 'aplicaciones', etiqueta: t('navegacion.aplicaciones'), icono: <Blocks size={20} strokeWidth={1.7} />, ruta: '/aplicaciones', seccion: 'otros' },
    { id: 'empresa', etiqueta: t('empresa.titulo'), icono: <Building2 size={20} strokeWidth={1.7} />, ruta: '/configuracion', seccion: 'empresa', modulo: 'empresa' },
    { id: 'usuarios', etiqueta: t('navegacion.usuarios'), icono: <UserCog size={20} strokeWidth={1.7} />, ruta: '/usuarios', seccion: 'empresa', modulo: 'usuarios' },
    { id: 'papelera', etiqueta: t('navegacion.papelera'), icono: <Trash2 size={20} strokeWidth={1.7} />, ruta: '/papelera', seccion: 'otros' },
  ]
}

const SECCIONES: { id: string; etiqueta: string }[] = [
  { id: 'principal', etiqueta: 'Principal' },
  { id: 'documentos', etiqueta: 'Documentos' },
  { id: 'admin', etiqueta: 'Administración' },
  { id: 'empresa', etiqueta: 'Empresa' },
  { id: 'otros', etiqueta: 'Otros' },
]

/** Animación escalonada para los ítems */
const itemVariantes = {
  oculto: { opacity: 0, x: -16 },
  visible: (i: number) => ({
    opacity: 1,
    x: 0,
    transition: { delay: 0.04 * i, duration: 0.25, ease: [0.25, 0.1, 0.25, 1] as [number, number, number, number] },
  }),
}

function MenuMovil({ abierto, onCerrar }: PropiedadesMenuMovil) {
  const pathname = usePathname()
  const router = useRouter()
  const { t } = useTraduccion()
  const { usuario, cerrarSesion } = useAuth()
  const { empresa, empresas, cambiarEmpresa } = useEmpresa()
  const { tienePermiso, esPropietario } = useRol()
  const { tieneModulo } = useModulos()
  const { noLeidasPorCategoria } = useNotificaciones({ deshabilitado: false })

  // iOS: position:fixed en body para evitar scroll detrás del menú
  useScrollLockiOS(abierto)

  const [modalCerrarSesion, setModalCerrarSesion] = useState(false)
  const [cerrandoSesion, setCerrandoSesion] = useState(false)
  const [estado, setEstado] = useState<'online' | 'ausente' | 'no_molestar'>('online')

  const vibrar = () => {
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) navigator.vibrate(10)
  }

  /* Badges */
  const badgesReales: Record<string, number> = {
    inbox: noLeidasPorCategoria('inbox'),
    actividades: noLeidasPorCategoria('actividades'),
  }

  /* Filtrar por permisos y módulos */
  const filtrarItems = useCallback((items: ItemNav[]): ItemNav[] => {
    return items.filter(item => {
      if (item.moduloCatalogo && !tieneModulo(item.moduloCatalogo)) return false
      if (esPropietario) return true
      if (!item.modulo) return true
      return tienePermiso(item.modulo as Modulo, 'ver_propio' as never)
        || tienePermiso(item.modulo as Modulo, 'ver_todos' as never)
        || tienePermiso(item.modulo as Modulo, 'ver' as never)
    })
  }, [esPropietario, tienePermiso, tieneModulo])

  const todosLosItems = filtrarItems(crearItemsMovil(t)).map(item =>
    badgesReales[item.id] !== undefined ? { ...item, badge: badgesReales[item.id] } : item
  )

  /* Agrupar por sección */
  const seccionesConItems = SECCIONES
    .map(s => ({ ...s, items: todosLosItems.filter(i => i.seccion === s.id) }))
    .filter(s => s.items.length > 0)

  const esActivo = (ruta: string) => {
    if (ruta === '/dashboard') return pathname === '/dashboard' || pathname === '/'
    return pathname.startsWith(ruta)
  }

  const navegar = (ruta: string) => {
    vibrar()
    router.push(ruta)
    onCerrar()
  }

  const manejarCerrarSesion = async () => {
    setCerrandoSesion(true)
    await cerrarSesion()
    window.location.href = '/login'
  }

  /* Datos del perfil */
  const nombreUsuario = usuario?.user_metadata?.nombre && usuario?.user_metadata?.apellido
    ? `${usuario.user_metadata.nombre} ${usuario.user_metadata.apellido}`
    : usuario?.email?.split('@')[0] || 'Usuario'
  const nombreEmpresa = empresa?.nombre || 'Mi empresa'
  const inicialEmpresa = nombreEmpresa[0]?.toUpperCase() || 'F'
  const logoEmpresa = empresa?.logo_url || null

  /* Contador global para animación escalonada */
  let contadorGlobal = 0

  return (
    <>
      {abierto && (
          <div
            className="md:hidden fixed inset-0 z-[60] bg-superficie-app flex flex-col"
            style={{
              paddingTop: 'var(--safe-area-top)',
              paddingBottom: 'var(--safe-area-bottom)',
            }}
          >
            {/* ═══ HEADER ═══ */}
            <div className="flex items-center justify-between px-5 h-[var(--header-alto)] shrink-0">
              {/* Empresa */}
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <div className={`size-9 rounded-lg flex items-center justify-center text-white font-bold text-sm shrink-0 ${logoEmpresa ? '' : 'bg-texto-marca'}`}>
                  {logoEmpresa ? (
                    <Image src={logoEmpresa} alt={nombreEmpresa} width={36} height={36} className="size-9 rounded-lg object-cover" />
                  ) : (
                    inicialEmpresa
                  )}
                </div>
                <div className="min-w-0">
                  <div className="text-base font-semibold text-texto-primario truncate">{nombreEmpresa}</div>
                  <div className="text-xxs text-texto-terciario">Flux by Salix</div>
                </div>
              </div>

              {/* Botón cerrar */}
              <motion.button
                initial={{ rotate: -90, opacity: 0 }}
                animate={{ rotate: 0, opacity: 1 }}
                transition={{ delay: 0.1, duration: 0.2 }}
                onClick={onCerrar}
                className="size-10 rounded-full flex items-center justify-center bg-superficie-hover border-none cursor-pointer shrink-0"
                style={{ color: 'var(--texto-secundario)' }}
              >
                <X size={20} />
              </motion.button>
            </div>

            {/* ═══ CONTENIDO SCROLLEABLE ═══ */}
            <div className="flex-1 overflow-y-auto overscroll-contain px-5 pb-6">
              {/* Secciones de navegación */}
              {seccionesConItems.map(seccion => (
                <div key={seccion.id} className="mb-5">
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.08 }}
                    className="px-1 mb-2 text-xxs font-semibold text-texto-terciario/60 uppercase tracking-wider"
                  >
                    {seccion.etiqueta}
                  </motion.div>

                  <div className="flex flex-col gap-0.5">
                    {seccion.items.map(item => {
                      const activo = esActivo(item.ruta)
                      const indice = contadorGlobal++
                      return (
                        <motion.button
                          key={item.id}
                          custom={indice}
                          variants={itemVariantes}
                          initial="oculto"
                          animate="visible"
                          onClick={() => navegar(item.ruta)}
                          className={[
                            'flex items-center gap-3.5 w-full px-3 py-3 rounded-xl border-none cursor-pointer transition-colors active:scale-[0.98] text-left',
                            activo
                              ? 'bg-texto-marca/10'
                              : 'bg-transparent',
                          ].join(' ')}
                          style={{ color: activo ? 'var(--texto-marca)' : 'var(--texto-primario)' }}
                        >
                          <span className="shrink-0 flex">{item.icono}</span>
                          <span className={`flex-1 text-md ${activo ? 'font-semibold' : 'font-medium'}`}>
                            {item.etiqueta}
                          </span>
                          {/* Badge */}
                          {item.badge != null && item.badge > 0 && (
                            <span className="min-w-[20px] h-5 rounded-full bg-insignia-peligro text-white text-xs font-bold flex items-center justify-center px-1.5 leading-none shrink-0">
                              {item.badge > 99 ? '99+' : item.badge}
                            </span>
                          )}
                          {activo && (
                            <span className="shrink-0" style={{ color: 'var(--texto-marca)' }}>
                              <ChevronRight size={16} />
                            </span>
                          )}
                        </motion.button>
                      )
                    })}
                  </div>
                </div>
              ))}

              {/* ═══ SEPARADOR ═══ */}
              <div className="h-px bg-borde-sutil my-4" />

              {/* ═══ PERFIL ═══ */}
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.25, duration: 0.3 }}
              >
                {/* Avatar + nombre */}
                <button
                  onClick={() => navegar('/mi-cuenta')}
                  className="flex items-center gap-3.5 w-full px-3 py-3 rounded-xl bg-transparent border-none cursor-pointer hover:bg-superficie-hover transition-colors text-left active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-texto-marca focus-visible:-outline-offset-2"
                >
                  <div className="relative shrink-0">
                    <Avatar nombre={nombreUsuario} tamano="md" />
                    <span className={`absolute -bottom-0.5 -right-0.5 size-2.5 rounded-full border-2 border-superficie-app ${estado === 'online' ? 'bg-insignia-exito' : estado === 'ausente' ? 'bg-insignia-advertencia' : 'bg-insignia-peligro'}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-md font-semibold text-texto-primario truncate">{nombreUsuario}</div>
                    <div className="text-xs text-texto-terciario capitalize">{estado === 'no_molestar' ? 'No molestar' : estado}</div>
                  </div>
                  <ChevronRight size={16} className="text-texto-terciario/50 shrink-0" />
                </button>

                {/* Estado rápido */}
                <div className="flex items-center gap-2 px-3 mt-2 mb-3">
                  {([
                    { id: 'online', color: 'bg-insignia-exito' },
                    { id: 'ausente', color: 'bg-insignia-advertencia' },
                    { id: 'no_molestar', color: 'bg-insignia-peligro' },
                  ] as const).map(est => (
                    <button
                      key={est.id}
                      onClick={() => { vibrar(); setEstado(est.id) }}
                      className={[
                        'flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-medium cursor-pointer transition-all active:scale-95 focus-visible:outline-2 focus-visible:outline-texto-marca focus-visible:-outline-offset-2',
                        estado === est.id
                          ? 'border-texto-marca/30 bg-texto-marca/10 text-texto-marca'
                          : 'border-borde-sutil bg-transparent text-texto-secundario',
                      ].join(' ')}
                    >
                      <span className={`size-2 rounded-full ${est.color}`} />
                      {est.id === 'no_molestar' ? 'No molestar' : est.id.charAt(0).toUpperCase() + est.id.slice(1)}
                    </button>
                  ))}
                </div>

                {/* Switcher empresa (si hay más de una) */}
                {empresas.length > 1 && (
                  <div className="mb-3">
                    <div className="px-3 mb-1.5 text-xxs font-semibold text-texto-terciario/60 uppercase tracking-wider">Empresas</div>
                    {empresas.map(emp => (
                      <button
                        key={emp.id}
                        onClick={async () => {
                          if (emp.id !== empresa?.id) {
                            await cambiarEmpresa(emp.id)
                            router.push('/dashboard')
                          }
                        }}
                        className="flex items-center gap-3 w-full px-3 py-2.5 rounded-xl bg-transparent border-none cursor-pointer hover:bg-superficie-hover transition-colors text-left active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-texto-marca focus-visible:-outline-offset-2"
                      >
                        <div className={`size-8 rounded-lg flex items-center justify-center text-white font-bold text-xs shrink-0 ${!emp.logo_url ? (emp.id === empresa?.id ? 'bg-texto-marca' : 'bg-texto-terciario') : ''}`}>
                          {emp.logo_url ? (
                            <Image src={emp.logo_url} alt={emp.nombre} width={32} height={32} className="size-8 rounded-lg object-cover" />
                          ) : (
                            emp.nombre[0]
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm text-texto-primario truncate">{emp.nombre}</div>
                          <div className="text-xxs text-texto-terciario capitalize">{emp.rol}</div>
                        </div>
                        {emp.id === empresa?.id && <Check size={16} className="text-texto-marca shrink-0" />}
                      </button>
                    ))}
                  </div>
                )}

                {/* Cerrar sesión */}
                <OpcionMenu
                  icono={<LogOut size={20} strokeWidth={1.7} />}
                  peligro
                  onClick={() => { onCerrar(); setModalCerrarSesion(true) }}
                >
                  {t('auth.cerrar_sesion')}
                </OpcionMenu>
              </motion.div>
            </div>
          </div>
      )}

      {/* Modal cerrar sesión */}
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

export { MenuMovil }
