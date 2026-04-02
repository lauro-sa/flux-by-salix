'use client'

/**
 * SidebarContenido — Contenido interno del Sidebar (sin el shell aside/drawer).
 * Orquesta: SwitcherEmpresa, secciones de navegacion, items fijos, ocultos/deshabilitados y perfil.
 */

import { useState, useEffect, useCallback } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { PointerSensor, TouchSensor, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core'
import { arrayMove } from '@dnd-kit/sortable'
import { useTraduccion } from '@/lib/i18n'
import { useSonido } from '@/hooks/useSonido'
import { useAuth } from '@/hooks/useAuth'
import { useEmpresa } from '@/hooks/useEmpresa'
import { usePreferencias } from '@/hooks/usePreferencias'
import { useRol } from '@/hooks/useRol'
import { useModulos } from '@/hooks/useModulos'
import { useNotificaciones } from '@/hooks/useNotificaciones'
import type { Modulo } from '@/tipos'
import type { ItemNav } from './tipos'
import { crearItemsNav, crearItemsEmpresa, crearItemAplicaciones, crearSecciones, crearItemInicio } from './itemsNav'
import { SwitcherEmpresa } from './SwitcherEmpresa'
import { ItemSortable } from './ItemSortable'
import { SeccionNav } from './SeccionNav'
import { SeccionOcultosDeshabilitados } from './SeccionOcultosDeshabilitados'
import { PerfilSidebar } from './PerfilSidebar'

interface PropiedadesSidebarContenido {
  colapsado: boolean
  onToggle: () => void
  onCerrarMobil: () => void
}

function SidebarContenido({ colapsado, onToggle, onCerrarMobil }: PropiedadesSidebarContenido) {
  const pathname = usePathname()
  const router = useRouter()
  const { t } = useTraduccion()
  const { preferencias, guardar: guardarPreferencia } = usePreferencias()
  const { esPropietario, tienePermiso } = useRol()
  const { tieneModulo } = useModulos()
  const { noLeidasPorCategoria } = useNotificaciones({ deshabilitado: false })
  const sonido = useSonido()
  const vibrar = () => { if (typeof navigator !== 'undefined' && 'vibrate' in navigator) navigator.vibrate(10) }

  // Badges dinamicos basados en notificaciones reales
  const badgesReales: Record<string, number> = {
    inbox: noLeidasPorCategoria('inbox'),
    actividades: noLeidasPorCategoria('actividades'),
  }

  // Filtrar items por permisos Y modulos instalados
  const filtrarItems = (items: ItemNav[]): ItemNav[] => {
    return items.filter(item => {
      if (item.moduloCatalogo && !tieneModulo(item.moduloCatalogo)) return false
      if (esPropietario) return true
      if (!item.modulo) return true
      return tienePermiso(item.modulo as Modulo, 'ver_propio' as never)
        || tienePermiso(item.modulo as Modulo, 'ver_todos' as never)
        || tienePermiso(item.modulo as Modulo, 'ver' as never)
    })
  }

  const ITEMS_NAV = filtrarItems(crearItemsNav(t)).map(item =>
    badgesReales[item.id] !== undefined ? { ...item, badge: badgesReales[item.id] } : item
  )
  const ITEMS_EMPRESA = filtrarItems(crearItemsEmpresa(t))
  const ITEM_APLICACIONES = crearItemAplicaciones(t)
  const ITEM_INICIO = crearItemInicio(t)
  const SECCIONES = crearSecciones(t)

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

  const itemsOcultos = ITEMS_NAV.filter(i => ocultos.has(i.id))
  const itemsDeshabilitados = ITEMS_NAV.filter(i => deshabilitados.has(i.id))

  // Animacion de salida al ocultar/deshabilitar
  const [animandoSalida, setAnimandoSalida] = useState<string | null>(null)
  const [menuItemId, setMenuItemId] = useState<string | null>(null)
  const [menuPos, setMenuPos] = useState<{ top: number; left: number }>({ top: 0, left: 0 })

  const abrirMenu = useCallback((itemId: string, triggerEl: HTMLElement) => {
    const rect = triggerEl.getBoundingClientRect()
    setMenuPos({ top: rect.bottom + 4, left: rect.right - 176 })
    setMenuItemId(prev => prev === itemId ? null : itemId)
  }, [])

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

  const esActivo = (ruta: string) => {
    if (ruta === '/dashboard') return pathname === '/dashboard' || pathname === '/'
    return pathname.startsWith(ruta)
  }

  const navegar = (ruta: string) => {
    router.push(ruta)
    onCerrarMobil()
    vibrar()
  }

  return (
    <div className="flex flex-col h-full w-full overflow-hidden">
      {/* Switcher empresa */}
      <SwitcherEmpresa colapsado={colapsado} onToggle={onToggle} />

      {/* Navegacion */}
      <nav className="flex-1 overflow-y-auto pb-2 px-1.5 sidebar-scroll">
        {/* Inicio — siempre primero, sin seccion */}
        <ItemSortable
          item={ITEM_INICIO}
          sortable={false}
          colapsado={colapsado}
          activo={esActivo(ITEM_INICIO.ruta)}
          animandoSalida={false}
          menuAbierto={false}
          menuPos={menuPos}
          onNavegar={() => navegar(ITEM_INICIO.ruta)}
          onAbrirMenu={abrirMenu}
          onCerrarMenu={() => setMenuItemId(null)}
          onOcultar={ocultarItem}
          onDeshabilitar={deshabilitarItem}
        />

        {/* Secciones reordenables */}
        {SECCIONES.map(s => (
          <SeccionNav
            key={s.id}
            seccionId={s.id}
            etiqueta={s.etiqueta}
            items={obtenerItemsOrdenados(s.id)}
            colapsado={colapsado}
            sensors={sensors}
            esActivo={esActivo}
            animandoSalida={animandoSalida}
            menuItemId={menuItemId}
            menuPos={menuPos}
            onDragEnd={manejarDragEnd(s.id)}
            onNavegar={navegar}
            onAbrirMenu={abrirMenu}
            onCerrarMenu={() => setMenuItemId(null)}
            onOcultar={ocultarItem}
            onDeshabilitar={deshabilitarItem}
          />
        ))}

        {/* Ocultos y deshabilitados */}
        {!colapsado && (
          <SeccionOcultosDeshabilitados
            itemsOcultos={itemsOcultos}
            itemsDeshabilitados={itemsDeshabilitados}
            onRestaurarOculto={restaurarOculto}
            onRestaurarDeshabilitado={restaurarDeshabilitado}
            onCerrarMobil={onCerrarMobil}
            vibrar={vibrar}
          />
        )}
      </nav>

      {/* Seccion inferior — fija abajo, fuera del scroll */}
      <div className="shrink-0 px-1.5 py-1.5 border-t border-borde-sutil">
        {/* Aplicaciones — separado */}
        <ItemSortable
          item={ITEM_APLICACIONES}
          sortable={false}
          colapsado={colapsado}
          activo={esActivo(ITEM_APLICACIONES.ruta)}
          animandoSalida={false}
          menuAbierto={false}
          menuPos={menuPos}
          onNavegar={() => navegar(ITEM_APLICACIONES.ruta)}
          onAbrirMenu={abrirMenu}
          onCerrarMenu={() => setMenuItemId(null)}
          onOcultar={ocultarItem}
          onDeshabilitar={deshabilitarItem}
        />
        {/* Empresa + Usuarios */}
        {ITEMS_EMPRESA.length > 0 && (
          <>
            <div className="px-2 mt-2 mb-1 text-xxs font-semibold uppercase tracking-wider flex items-center" style={{ minHeight: '1rem' }}>
              {colapsado
                ? <div className="h-px bg-borde-sutil w-full" />
                : <span className="sidebar-texto-fade text-texto-secundario/60">{t('sidebar.secciones.empresa')}</span>
              }
            </div>
            {ITEMS_EMPRESA.map(i => (
              <ItemSortable
                key={i.id}
                item={i}
                sortable={false}
                colapsado={colapsado}
                activo={esActivo(i.ruta)}
                animandoSalida={false}
                menuAbierto={false}
                menuPos={menuPos}
                onNavegar={() => navegar(i.ruta)}
                onAbrirMenu={abrirMenu}
                onCerrarMenu={() => setMenuItemId(null)}
                onOcultar={ocultarItem}
                onDeshabilitar={deshabilitarItem}
              />
            ))}
          </>
        )}
      </div>

      {/* Perfil */}
      <PerfilSidebar colapsado={colapsado} />
    </div>
  )
}

export { SidebarContenido }
