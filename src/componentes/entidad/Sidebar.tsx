'use client'

import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { createPortal } from 'react-dom'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { DndContext, closestCenter, PointerSensor, TouchSensor, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy, useSortable, arrayMove } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useTraduccion } from '@/lib/i18n'
import { Avatar } from '@/componentes/ui/Avatar'
import { ModalConfirmacion } from '@/componentes/ui/ModalConfirmacion'
import { useSonido } from '@/hooks/useSonido'
import { useSwipe } from '@/hooks/useSwipe'
import { useAuth } from '@/hooks/useAuth'
import { useEmpresa } from '@/hooks/useEmpresa'
import { usePreferencias } from '@/hooks/usePreferencias'
import { useRol } from '@/hooks/useRol'
import type { Modulo } from '@/tipos'
import {
  Home, Users, CheckSquare, MapPin, FileText, Package,
  Mail, Clock, Calendar, Shield,
  LayoutGrid, ChevronUp, ChevronDown, Building2,
  UserCog, BarChart3, Trash2, LogOut,
  Circle, MinusCircle, BellOff, MoreHorizontal, Check,
  Plus, Route, Receipt, FileBarChart, Wrench,
  GripVertical, Zap, BookOpen, LayoutDashboard, Eye, Power,
} from 'lucide-react'

/**
 * Sidebar — Barra lateral completa de Flux.
 * Secciones, badges, buscador, colapsar, switcher empresa, perfil.
 */

interface ItemNav {
  id: string
  etiqueta: string
  icono: React.ReactNode
  ruta: string
  badge?: number
  fijo?: boolean
  seccion: 'principal' | 'documentos' | 'admin' | 'otros'
  /** Módulo del sistema de permisos — si no tiene, siempre visible */
  modulo?: string
}

interface Empresa {
  id: string
  nombre: string
  rol: string
  activa: boolean
}

/** Genera items de navegación traducidos */
function crearItemsNav(t: (c: string) => string): ItemNav[] {
  return [
    { id: 'inbox', etiqueta: t('navegacion.inbox'), icono: <Mail size={20} strokeWidth={1.75} />, ruta: '/inbox', badge: 2, seccion: 'principal', modulo: 'inbox_interno' },
    { id: 'contactos', etiqueta: t('navegacion.contactos'), icono: <Users size={20} strokeWidth={1.75} />, ruta: '/contactos', seccion: 'principal', modulo: 'contactos' },
    { id: 'actividades', etiqueta: t('navegacion.actividades'), icono: <Zap size={20} strokeWidth={1.75} />, ruta: '/actividades', badge: 9, seccion: 'principal', modulo: 'actividades' },
    { id: 'calendario', etiqueta: t('navegacion.calendario'), icono: <Calendar size={20} strokeWidth={1.75} />, ruta: '/calendario', seccion: 'principal', modulo: 'calendario' },
    { id: 'visitas', etiqueta: t('navegacion.visitas'), icono: <MapPin size={20} strokeWidth={1.75} />, ruta: '/visitas', seccion: 'principal', modulo: 'visitas' },
    { id: 'recorrido', etiqueta: t('navegacion.recorrido'), icono: <Route size={20} strokeWidth={1.75} />, ruta: '/recorrido', seccion: 'principal', modulo: 'recorrido' },
    { id: 'productos', etiqueta: t('navegacion.productos'), icono: <Package size={20} strokeWidth={1.75} />, ruta: '/productos', seccion: 'documentos', modulo: 'productos' },
    { id: 'presupuestos', etiqueta: t('navegacion.presupuestos'), icono: <FileText size={20} strokeWidth={1.75} />, ruta: '/presupuestos', seccion: 'documentos', modulo: 'presupuestos' },
    { id: 'informes', etiqueta: t('navegacion.informes'), icono: <FileBarChart size={20} strokeWidth={1.75} />, ruta: '/informes', seccion: 'documentos', modulo: 'informes' },
    { id: 'ordenes', etiqueta: t('navegacion.ordenes'), icono: <Wrench size={20} strokeWidth={1.75} />, ruta: '/ordenes', seccion: 'documentos', modulo: 'ordenes_trabajo' },
    { id: 'asistencias', etiqueta: t('navegacion.asistencias'), icono: <Clock size={20} strokeWidth={1.75} />, ruta: '/asistencias', seccion: 'admin', modulo: 'asistencias' },
    { id: 'auditoria', etiqueta: t('navegacion.auditoria'), icono: <Shield size={20} strokeWidth={1.75} />, ruta: '/auditoria', seccion: 'admin', modulo: 'auditoria' },
    { id: 'papelera', etiqueta: t('navegacion.papelera'), icono: <Trash2 size={20} strokeWidth={1.75} />, ruta: '/papelera', seccion: 'otros' },
  ]
}

function crearItemsEmpresa(t: (c: string) => string): ItemNav[] {
  return [
    { id: 'empresa', etiqueta: t('empresa.titulo'), icono: <Building2 size={20} strokeWidth={1.75} />, ruta: '/configuracion', fijo: true, seccion: 'otros', modulo: 'empresa' },
    { id: 'usuarios', etiqueta: t('navegacion.usuarios'), icono: <UserCog size={20} strokeWidth={1.75} />, ruta: '/usuarios', fijo: true, seccion: 'otros', modulo: 'usuarios' },
    { id: 'aplicaciones', etiqueta: t('navegacion.aplicaciones'), icono: <LayoutGrid size={20} strokeWidth={1.75} />, ruta: '/aplicaciones', fijo: true, seccion: 'otros' },
    { id: 'documentacion', etiqueta: t('navegacion.documentacion'), icono: <BookOpen size={20} strokeWidth={1.75} />, ruta: '/documentacion', fijo: true, seccion: 'otros' },
    { id: 'vitrina', etiqueta: t('navegacion.vitrina'), icono: <Zap size={20} strokeWidth={1.75} />, ruta: '/vitrina', fijo: true, seccion: 'otros' },
  ]
}

function crearSecciones(t: (c: string) => string) {
  return [
    { id: 'principal', etiqueta: t('sidebar.secciones.principal') },
    { id: 'documentos', etiqueta: t('sidebar.secciones.documentos') },
    { id: 'admin', etiqueta: t('sidebar.secciones.admin') },
    { id: 'otros', etiqueta: t('sidebar.secciones.otros') },
  ]
}

// Ya no hay empresas mock — se leen de useEmpresa

interface PropiedadesSidebar {
  colapsado: boolean
  onToggle: () => void
  mobilAbierto: boolean
  onCerrarMobil: () => void
}

function Sidebar({ colapsado, onToggle, mobilAbierto, onCerrarMobil }: PropiedadesSidebar) {
  const pathname = usePathname()
  const { t } = useTraduccion()
  const router = useRouter()
  const { usuario, cerrarSesion } = useAuth()
  const { empresa, empresas, cambiarEmpresa } = useEmpresa()
  const { preferencias, guardar: guardarPreferencia } = usePreferencias()
  const { tienePermiso, esPropietario } = useRol()

  // Filtrar ítems por permisos — si tiene modulo, chequear al menos ver_propio o ver_todos
  const filtrarPorPermiso = (items: ItemNav[]): ItemNav[] => {
    if (esPropietario) return items
    return items.filter(item => {
      if (!item.modulo) return true // Sin módulo = siempre visible
      return tienePermiso(item.modulo as Modulo, 'ver_propio' as never)
        || tienePermiso(item.modulo as Modulo, 'ver_todos' as never)
        || tienePermiso(item.modulo as Modulo, 'ver' as never)
    })
  }

  const ITEMS_NAV = filtrarPorPermiso(crearItemsNav(t))
  const ITEMS_EMPRESA = filtrarPorPermiso(crearItemsEmpresa(t))
  const SECCIONES = crearSecciones(t)

  // Modal de cerrar sesión
  const [modalCerrarSesion, setModalCerrarSesion] = useState(false)
  const [cerrandoSesion, setCerrandoSesion] = useState(false)

  const manejarCerrarSesion = async () => {
    setCerrandoSesion(true)
    await cerrarSesion()
    window.location.href = '/login'
  }

  // Datos del perfil desde auth
  const nombreUsuario = usuario?.user_metadata?.nombre && usuario?.user_metadata?.apellido
    ? `${usuario.user_metadata.nombre} ${usuario.user_metadata.apellido}`
    : usuario?.email?.split('@')[0] || 'Usuario'
  const nombreEmpresa = empresa?.nombre || 'Flux'
  const inicialEmpresa = nombreEmpresa[0]?.toUpperCase() || 'F'

  // Orden, ocultos, deshabilitados — se cargan desde preferencias (BD)
  const [orden, setOrden] = useState<Record<string, string[]>>({})
  const [ocultos, setOcultos] = useState<Set<string>>(new Set())
  const [deshabilitados, setDeshabilitados] = useState<Set<string>>(new Set())

  useEffect(() => {
    if (preferencias.sidebar_orden) {
      try {
        const parsed = typeof preferencias.sidebar_orden === 'string'
          ? JSON.parse(preferencias.sidebar_orden)
          : preferencias.sidebar_orden
        setOrden(parsed)
      } catch {}
    }
    if (preferencias.sidebar_ocultos) {
      const arr = Array.isArray(preferencias.sidebar_ocultos) ? preferencias.sidebar_ocultos : []
      setOcultos(new Set(arr))
    }
    if (preferencias.sidebar_deshabilitados) {
      const arr = Array.isArray(preferencias.sidebar_deshabilitados) ? preferencias.sidebar_deshabilitados : []
      setDeshabilitados(new Set(arr))
    }
  }, [preferencias])

  // Secciones colapsables para ocultos/deshabilitados
  const [seccionOcultosAbierta, setSeccionOcultosAbierta] = useState(false)
  const [seccionDeshabilitadosAbierta, setSeccionDeshabilitadosAbierta] = useState(false)

  const guardarOrden = (nuevoOrden: Record<string, string[]>) => {
    setOrden(nuevoOrden)
    guardarPreferencia({ sidebar_orden: Object.values(nuevoOrden).flat() })
  }

  // Filtrar items visibles (ni ocultos ni deshabilitados)
  const obtenerItemsOrdenados = (seccionId: string): ItemNav[] => {
    const items = ITEMS_NAV.filter(i => i.seccion === seccionId && !ocultos.has(i.id) && !deshabilitados.has(i.id))
    const ordenSeccion = orden[seccionId]
    if (!ordenSeccion) return items
    return ordenSeccion
      .map(id => items.find(i => i.id === id))
      .filter((i): i is ItemNav => i !== undefined)
      .concat(items.filter(i => !ordenSeccion.includes(i.id)))
  }

  // Items ocultos y deshabilitados para mostrar en secciones especiales
  const itemsOcultos = ITEMS_NAV.filter(i => ocultos.has(i.id))
  const itemsDeshabilitados = ITEMS_NAV.filter(i => deshabilitados.has(i.id))

  const [animandoSalida, setAnimandoSalida] = useState<string | null>(null)

  const ocultarItem = (id: string) => {
    setMenuItemId(null)
    setAnimandoSalida(id)
    setTimeout(() => {
      setAnimandoSalida(null)
      const nuevo = new Set(ocultos).add(id)
      setOcultos(nuevo)
      guardarPreferencia({ sidebar_ocultos: [...nuevo] })
    }, 400)
  }

  const deshabilitarItem = (id: string) => {
    setMenuItemId(null)
    setAnimandoSalida(id)
    setTimeout(() => {
      setAnimandoSalida(null)
      const nuevo = new Set(deshabilitados).add(id)
      setDeshabilitados(nuevo)
      guardarPreferencia({ sidebar_deshabilitados: [...nuevo] })
    }, 400)
  }

  const restaurarOculto = (id: string) => {
    sonido.pop()
    vibrar()
    const nuevo = new Set(ocultos)
    nuevo.delete(id)
    setOcultos(nuevo)
    guardarPreferencia({ sidebar_ocultos: [...nuevo] })
  }

  const restaurarDeshabilitado = (id: string) => {
    sonido.pop()
    vibrar()
    const nuevo = new Set(deshabilitados)
    nuevo.delete(id)
    setDeshabilitados(nuevo)
    guardarPreferencia({ sidebar_deshabilitados: [...nuevo] })
  }

  const manejarDragEnd = (seccionId: string) => (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const items = obtenerItemsOrdenados(seccionId)
    const oldIndex = items.findIndex(i => i.id === active.id)
    const newIndex = items.findIndex(i => i.id === over.id)
    const reordenados = arrayMove(items, oldIndex, newIndex)
    guardarOrden({ ...orden, [seccionId]: reordenados.map(i => i.id) })
    sonido.drop()
    vibrar()
  }

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } })
  )

  const [empresaAbierto, setEmpresaAbierto] = useState(false)
  const [perfilAbierto, setPerfilAbierto] = useState(false)
  const [menuItemId, setMenuItemId] = useState<string | null>(null)
  const [menuPos, setMenuPos] = useState<{ top: number; left: number }>({ top: 0, left: 0 })

  const abrirMenu = useCallback((itemId: string, triggerEl: HTMLElement) => {
    const rect = triggerEl.getBoundingClientRect()
    setMenuPos({ top: rect.bottom + 4, left: rect.right - 176 }) // 176 = w-44
    setMenuItemId(prev => prev === itemId ? null : itemId)
  }, [])
  const [estado, setEstado] = useState<'online' | 'ausente' | 'no_molestar'>('online')
  const empresaRef = useRef<HTMLDivElement>(null)
  const perfilRef = useRef<HTMLDivElement>(null)

  const esActivo = (ruta: string) => {
    if (ruta === '/dashboard') return pathname === '/dashboard' || pathname === '/'
    return pathname.startsWith(ruta)
  }

  // Cmd+Shift+E para switcher empresa
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 'E') { e.preventDefault(); setEmpresaAbierto(v => !v) }
    }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [])

  // Cerrar empresa y perfil al click fuera
  useEffect(() => {
    const h = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      if (empresaRef.current && !empresaRef.current.contains(target)) setEmpresaAbierto(false)
      if (perfilRef.current && !perfilRef.current.contains(target)) setPerfilAbierto(false)
    }
    document.addEventListener('click', h)
    return () => document.removeEventListener('click', h)
  }, [])

  const sonido = useSonido()
  const vibrar = () => { if (typeof navigator !== 'undefined' && 'vibrate' in navigator) navigator.vibrate(10) }

  // Swipe para cerrar el drawer en móvil
  const swipeProps = useSwipe({ onSwipeIzquierda: onCerrarMobil })

  // Ícono grip 6 puntos
  const GripIcon = <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor"><circle cx="4" cy="3" r="1.2"/><circle cx="10" cy="3" r="1.2"/><circle cx="4" cy="7" r="1.2"/><circle cx="10" cy="7" r="1.2"/><circle cx="4" cy="11" r="1.2"/><circle cx="10" cy="11" r="1.2"/></svg>

  // Item sortable
  function ItemSortable({ item, sortable: esSortable }: { item: ItemNav; sortable: boolean }) {
    const activo = esActivo(item.ruta)
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
      id: item.id,
      disabled: !esSortable,
    })

    const estaAnimando = animandoSalida === item.id

    const estiloSortable: React.CSSProperties = {
      transform: CSS.Transform.toString(transform) || undefined,
      transition,
      zIndex: isDragging ? 50 : undefined,
      opacity: isDragging ? 0.8 : 1,
    }

    const navegar = () => {
      router.push(item.ruta)
      onCerrarMobil()
      vibrar()
    }

    return (
      <div ref={setNodeRef} style={estiloSortable} className={`relative group ${isDragging ? 'shadow-lg rounded-md bg-superficie-elevada' : ''} ${estaAnimando ? 'sidebar-item-puff' : ''}`}>
        {/* Item principal — div clickeable en vez de Link */}
        <div
          onClick={navegar}
          style={{ color: activo ? 'var(--texto-primario)' : 'var(--texto-secundario)' }}
          className={[
            'flex items-center rounded-md text-sm font-medium cursor-pointer transition-all duration-100 relative select-none',
            colapsado ? 'justify-center p-2' : 'px-2 py-2.5 pr-7',
            activo ? 'font-semibold bg-superficie-activa' : 'hover:bg-superficie-hover',
          ].join(' ')}
        >
          {/* Zona izquierda: badge / grip */}
          {esSortable && !colapsado && (
            <span className="shrink-0 w-5 h-5 flex items-center justify-center mr-1.5 rounded-full" {...attributes} {...listeners} onClick={(e) => e.stopPropagation()}>
              {item.badge && item.badge > 0 ? (<>
                <span className="group-hover:hidden min-w-[20px] h-[20px] flex items-center justify-center rounded-full bg-texto-marca text-texto-inverso text-xxs font-bold">{item.badge > 9 ? '9+' : item.badge}</span>
                <span className="hidden group-hover:flex items-center justify-center cursor-grab text-texto-terciario/50">{GripIcon}</span>
              </>) : (
                <span className="hidden group-hover:flex items-center justify-center cursor-grab text-texto-terciario/40">{GripIcon}</span>
              )}
            </span>
          )}

          <span className="shrink-0 flex mr-2.5">{item.icono}</span>
          {!colapsado && <span className="flex-1 truncate">{item.etiqueta}</span>}

          {colapsado && item.badge && item.badge > 0 && (
            <span className="absolute -top-1 -right-1 min-w-[16px] h-[16px] flex items-center justify-center px-0.5 rounded-full bg-texto-marca text-texto-inverso text-xxs font-bold">{item.badge > 9 ? '9+' : item.badge}</span>
          )}
          {colapsado && (
            <div className="absolute left-full ml-2 px-2.5 py-1.5 rounded-md bg-superficie-elevada border border-borde-sutil shadow-md text-sm text-texto-primario whitespace-nowrap opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity z-50">{item.etiqueta}</div>
          )}
        </div>

        {/* Botón 3 puntos */}
        {!item.fijo && !colapsado && (
          <div
            onClick={(e) => {
              e.stopPropagation()
              abrirMenu(item.id, e.currentTarget)
            }}
            className="absolute right-1 top-1/2 -translate-y-1/2 size-6 rounded-md cursor-pointer opacity-0 group-hover:opacity-100 hover:bg-superficie-activa flex items-center justify-center transition-opacity z-30"
            style={{ color: 'var(--texto-terciario)' }}
          >
            <MoreHorizontal size={13} />
          </div>
        )}

        {/* Menú contextual como portal — overlay cierra, menú con acciones */}
        {menuItemId === item.id && typeof document !== 'undefined' && createPortal(
          <div className="fixed inset-0 z-[9998]" onClick={() => setMenuItemId(null)}>
            <div
              className="absolute bg-superficie-elevada border border-borde-sutil rounded-md shadow-lg py-1 w-44"
              style={{ top: menuPos.top, left: menuPos.left }}
              onClick={(e) => e.stopPropagation()}
            >
              <div onClick={() => ocultarItem(item.id)} className="flex items-center gap-2 w-full px-3 py-2.5 text-sm cursor-pointer hover:bg-superficie-hover" style={{ color: 'var(--texto-secundario)' }}><MinusCircle size={14} /> {t('sidebar.ocultar')}</div>
              <div onClick={() => deshabilitarItem(item.id)} className="flex items-center gap-2 w-full px-3 py-2.5 text-sm cursor-pointer hover:bg-superficie-hover" style={{ color: 'var(--texto-secundario)' }}><BellOff size={14} /> {t('sidebar.deshabilitar')}</div>
              <div className="h-px bg-borde-sutil my-1" />
              <div className="flex items-center gap-2 w-full px-3 py-2.5 text-sm cursor-pointer hover:bg-insignia-peligro-fondo" style={{ color: 'var(--insignia-peligro)' }}><Trash2 size={14} /> {t('sidebar.desinstalar')}</div>
            </div>
          </div>,
          document.body
        )}
      </div>
    )
  }

  // Item no sortable (para fijos)
  const renderItemFijo = (item: ItemNav) => <ItemSortable key={item.id} item={item} sortable={false} />

  const renderSeccion = (seccionId: string, etiqueta: string) => {
    const items = obtenerItemsOrdenados(seccionId)
    if (items.length === 0) return null
    return (
      <div key={seccionId} className="mt-4 first:mt-0">
        {!colapsado && <div className="px-2 mb-1.5 text-xxs font-semibold text-texto-secundario/60 uppercase tracking-wider">{etiqueta}</div>}
        {colapsado && <div className="h-px bg-borde-sutil mx-2 my-1" />}
        <DndContext id={`sidebar-dnd-${seccionId}`} sensors={sensors} collisionDetection={closestCenter} onDragEnd={manejarDragEnd(seccionId)}>
          <SortableContext items={items.map(i => i.id)} strategy={verticalListSortingStrategy}>
            <div className="flex flex-col gap-px">
              {items.map(i => <ItemSortable key={i.id} item={i} sortable={true} />)}
            </div>
          </SortableContext>
        </DndContext>
      </div>
    )
  }

  const contenido = (
    <div className="flex flex-col h-full w-full overflow-hidden">
      {/* Switcher empresa */}
      <div ref={empresaRef} className="relative px-3 pt-3 pb-2 shrink-0">
        <div className={['flex items-center gap-3 w-full rounded-md', colapsado ? 'justify-center p-2' : 'px-2 py-2'].join(' ')}>
          {/* Logo — siempre toggle sidebar */}
          <button
            onClick={onToggle}
            className="size-8 rounded-lg bg-texto-marca flex items-center justify-center text-white font-bold text-sm shrink-0 border-none cursor-pointer hover:opacity-80 transition-opacity"
          >
            {inicialEmpresa}
          </button>
          {/* Nombre + flecha — abre switcher empresa */}
          {!colapsado && (
            <button
              onClick={() => setEmpresaAbierto(!empresaAbierto)}
              className="flex items-center gap-2 flex-1 min-w-0 bg-transparent border-none cursor-pointer rounded-md hover:bg-superficie-hover px-2.5 py-1.5 transition-colors"
            >
              <div className="flex-1 text-left min-w-0">
                <div className="text-sm font-semibold text-texto-primario truncate">{nombreEmpresa}</div>
                <div className="text-xxs text-texto-terciario">{empresa?.slug || 'flux'}</div>
              </div>
              <ChevronDown size={14} className={`text-texto-terciario transition-transform ${empresaAbierto ? 'rotate-180' : ''}`} />
            </button>
          )}
        </div>
        <AnimatePresence>
          {empresaAbierto && (
            <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} className="absolute left-2.5 right-2.5 top-full mt-1 bg-superficie-elevada border border-borde-sutil rounded-lg shadow-lg z-50 py-1">
              <div className="px-3 py-1.5 text-xxs font-semibold text-texto-terciario uppercase tracking-wider">{t('sidebar.empresas')}</div>
              {empresas.map(emp => (
                <button key={emp.id} onClick={async () => { if (emp.id !== empresa?.id) { await cambiarEmpresa(emp.id); window.location.reload() } setEmpresaAbierto(false) }} className="flex items-center gap-2.5 w-full px-3 py-2 text-left border-none cursor-pointer bg-transparent hover:bg-superficie-hover">
                  <div className={`size-7 rounded-md flex items-center justify-center text-white font-bold text-xs shrink-0 ${emp.id === empresa?.id ? 'bg-texto-marca' : 'bg-texto-terciario'}`}>{emp.nombre[0]}</div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-texto-primario truncate">{emp.nombre}</div>
                    <div className="text-xxs text-texto-terciario capitalize">{emp.rol}</div>
                  </div>
                  {emp.id === empresa?.id && <Check size={14} className="text-texto-marca shrink-0" />}
                </button>
              ))}
              <div className="h-px bg-borde-sutil my-1" />
              <button className="flex items-center gap-2 w-full px-3 py-2 text-sm text-texto-marca bg-transparent border-none cursor-pointer hover:bg-superficie-hover text-left"><Plus size={14} /> {t('sidebar.agregar_empresa')}</button>
              <div className="px-3 py-1.5 text-xxs text-texto-terciario">⌘ Shift E</div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Navegación */}
      <nav className="flex-1 overflow-y-auto pb-2 px-1.5 sidebar-scroll">
        {/* Inicio — siempre primero, sin sección */}
        {renderItemFijo({ id: 'inicio', etiqueta: t('navegacion.inicio'), icono: <LayoutDashboard size={20} strokeWidth={1.75} />, ruta: '/dashboard', fijo: true, seccion: 'principal' })}

        {/* Secciones reordenables */}
        {SECCIONES.map(s => renderSeccion(s.id, s.etiqueta))}

        {/* Sección OCULTOS — clickeables, solo no están en el nav principal */}
        {!colapsado && itemsOcultos.length > 0 && (
          <div className="mt-3">
            <button onClick={() => setSeccionOcultosAbierta(!seccionOcultosAbierta)} className="flex items-center gap-1 w-full px-1.5 mb-1 bg-transparent border-none cursor-pointer text-xxs font-semibold text-texto-terciario/50 uppercase tracking-wider hover:text-texto-terciario transition-colors">
              <ChevronDown size={10} className={`transition-transform ${seccionOcultosAbierta ? '' : '-rotate-90'}`} />
              Ocultos ({itemsOcultos.length})
            </button>
            <AnimatePresence>
              {seccionOcultosAbierta && (
                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="flex flex-col gap-px overflow-hidden">
                  {itemsOcultos.map(item => (
                    <motion.div key={item.id} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} className="relative group">
                      <Link
                        href={item.ruta}
                        onClick={() => { onCerrarMobil(); vibrar() }}
                        style={{ color: 'var(--texto-terciario)' }}
                        className="flex items-center gap-2 px-1.5 py-2 rounded-md no-underline hover:bg-superficie-hover transition-colors"
                      >
                        <span className="shrink-0 flex opacity-50 ml-6">{item.icono}</span>
                        <span className="flex-1 truncate text-sm opacity-60">{item.etiqueta}</span>
                      </Link>
                      <button
                        onMouseDown={(e) => { e.stopPropagation(); restaurarOculto(item.id) }}
                        className="absolute right-1 top-1/2 -translate-y-1/2 size-5 rounded bg-transparent border-none cursor-pointer opacity-0 group-hover:opacity-70 hover:bg-superficie-hover flex items-center justify-center"
                        style={{ color: 'var(--texto-terciario)' }}
                        title="Mostrar"
                      >
                        <Eye size={12} />
                      </button>
                    </motion.div>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}

        {/* Sección DESHABILITADOS — NO clickeables, tachados */}
        {!colapsado && itemsDeshabilitados.length > 0 && (
          <div className="mt-3">
            <button onClick={() => setSeccionDeshabilitadosAbierta(!seccionDeshabilitadosAbierta)} className="flex items-center gap-1 w-full px-1.5 mb-1 bg-transparent border-none cursor-pointer text-xxs font-semibold text-texto-terciario/50 uppercase tracking-wider hover:text-texto-terciario transition-colors">
              <ChevronDown size={10} className={`transition-transform ${seccionDeshabilitadosAbierta ? '' : '-rotate-90'}`} />
              Deshabilitados ({itemsDeshabilitados.length})
            </button>
            <AnimatePresence>
              {seccionDeshabilitadosAbierta && (
                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="flex flex-col gap-px overflow-hidden">
                  {itemsDeshabilitados.map(item => (
                    <motion.div key={item.id} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} className="relative group">
                      <div className="flex items-center gap-2 px-1.5 py-2 rounded-md cursor-not-allowed" style={{ color: 'var(--texto-terciario)' }}>
                        <span className="shrink-0 flex opacity-30 ml-6">{item.icono}</span>
                        <span className="flex-1 truncate text-sm opacity-40 line-through">{item.etiqueta}</span>
                      </div>
                      <button
                        onMouseDown={(e) => { e.stopPropagation(); restaurarDeshabilitado(item.id) }}
                        className="absolute right-1 top-1/2 -translate-y-1/2 size-5 rounded bg-transparent border-none cursor-pointer opacity-0 group-hover:opacity-70 hover:bg-superficie-hover flex items-center justify-center"
                        style={{ color: 'var(--texto-terciario)' }}
                        title="Habilitar"
                      >
                        <Power size={12} />
                      </button>
                    </motion.div>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}

        {/* Sección EMPRESA — fija al final */}
        <div className="mt-4">
          {!colapsado && <div className="px-2 mb-1.5 text-xxs font-semibold text-texto-secundario/60 uppercase tracking-wider">{t('sidebar.secciones.empresa')}</div>}
          {colapsado && <div className="h-px bg-borde-sutil mx-2 my-1" />}
          <div className="flex flex-col gap-px">
            {ITEMS_EMPRESA.map(i => renderItemFijo(i))}
          </div>
        </div>
      </nav>

      {/* Perfil */}
      <div ref={perfilRef} className="relative px-2 pb-2 pt-2 border-t border-borde-sutil shrink-0">
        <button onClick={() => setPerfilAbierto(!perfilAbierto)} className={['flex items-center gap-3 w-full rounded-lg border-none cursor-pointer transition-colors hover:bg-superficie-hover bg-transparent', colapsado ? 'justify-center p-2' : 'px-2 py-2.5'].join(' ')}>
          <div className="relative shrink-0">
            <Avatar nombre={nombreUsuario} tamano="sm" />
            <span className={`absolute -bottom-0.5 -right-0.5 size-2.5 rounded-full border-2 border-superficie-sidebar ${estado === 'online' ? 'bg-insignia-exito' : estado === 'ausente' ? 'bg-insignia-advertencia' : 'bg-insignia-peligro'}`} />
          </div>
          {!colapsado && (
            <div className="flex-1 text-left min-w-0">
              <div className="text-sm font-medium text-texto-primario truncate">{nombreUsuario}</div>
              <div className="text-xxs text-texto-terciario capitalize">{estado === 'no_molestar' ? 'No molestar' : estado}</div>
            </div>
          )}
        </button>
        <AnimatePresence>
          {perfilAbierto && (
            <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 4 }} className="absolute left-2.5 right-2.5 bottom-full mb-1 bg-superficie-elevada border border-borde-sutil rounded-lg shadow-lg z-50 py-1">
              <div className="px-3 py-1.5 text-xxs font-semibold text-texto-terciario uppercase tracking-wider">Estado</div>
              {([
                { id: 'online', etiqueta: 'Online', color: 'text-insignia-exito' },
                { id: 'ausente', etiqueta: 'Ausente', color: 'text-insignia-advertencia' },
                { id: 'no_molestar', etiqueta: 'No molestar', color: 'text-insignia-peligro' },
              ] as const).map(est => (
                <button key={est.id} onClick={() => { setEstado(est.id); setPerfilAbierto(false) }} className="flex items-center gap-2 w-full px-3 py-1.5 text-sm text-texto-secundario bg-transparent border-none cursor-pointer hover:bg-superficie-hover text-left">
                  <Circle size={8} className={`fill-current ${est.color}`} /> {est.etiqueta}
                  {estado === est.id && <Check size={13} className="ml-auto text-texto-marca" />}
                </button>
              ))}
              <div className="h-px bg-borde-sutil my-1" />
              <Link href="/configuracion" onClick={() => setPerfilAbierto(false)} className="flex items-center gap-2 w-full px-3 py-1.5 text-sm text-texto-secundario no-underline hover:bg-superficie-hover"><Building2 size={13} /> {t('empresa.titulo')}</Link>
              <Link href="/usuarios" onClick={() => setPerfilAbierto(false)} className="flex items-center gap-2 w-full px-3 py-1.5 text-sm text-texto-secundario no-underline hover:bg-superficie-hover"><UserCog size={13} /> Usuarios</Link>
              <div className="h-px bg-borde-sutil my-1" />
              <button onClick={() => { setPerfilAbierto(false); setModalCerrarSesion(true) }} className="flex items-center gap-2 w-full px-3 py-1.5 text-sm text-insignia-peligro bg-transparent border-none cursor-pointer hover:bg-insignia-peligro-fondo text-left"><LogOut size={13} /> {t('auth.cerrar_sesion')}</button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )

  return (
    <>
      <aside className="hidden md:block fixed top-0 left-0 h-dvh border-r border-borde-sutil bg-superficie-sidebar z-30 transition-[width] duration-200 cristal-panel overflow-hidden sidebar-scroll" style={{ width: colapsado ? 'var(--sidebar-ancho-colapsado)' : 'var(--sidebar-ancho)' }}>
        {contenido}
      </aside>
      <AnimatePresence>
        {mobilAbierto && (<>
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onCerrarMobil} className="fixed inset-0 bg-black/40 z-[45]" />
          <motion.aside initial={{ x: -300 }} animate={{ x: 0 }} exit={{ x: -300 }} transition={{ type: 'spring', damping: 25, stiffness: 300 }} className="fixed top-0 left-0 h-dvh bg-superficie-sidebar border-r border-borde-sutil z-[46] cristal-panel" style={{ width: 'var(--sidebar-ancho)', paddingTop: 'var(--safe-area-top)' }} {...swipeProps}>
            {contenido}
          </motion.aside>
        </>)}
      </AnimatePresence>

      {/* Modal de cerrar sesión */}
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

export { Sidebar }
