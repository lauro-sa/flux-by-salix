'use client'

/**
 * Página /nominas — Layout del módulo Nóminas con pestañas.
 * Estructura introducida en PR 4b del plan. Las pestañas:
 *   - Liquidaciones: vista de nómina del período (única con contenido real
 *     por ahora; equivalente a lo que antes era la pestaña "Nómina" en
 *     /asistencias).
 *   - Adelantos:    se llena en un PR futuro (UI dedicada, hoy la API
 *     existe pero el acceso es desde la liquidación).
 *   - Empleados:    será el listado de empleados con su contrato vigente
 *     y atajo a la ficha laboral (PR 5).
 *   - Configuración: conceptos de nómina, premios, descuentos (PR 6).
 *
 * Las pestañas todavía vacías muestran un EstadoVacio "en construcción"
 * para no dar la sensación de bug.
 */

import { useState, useEffect } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { GuardPagina } from '@/componentes/entidad/GuardPagina'
import { Tabs } from '@/componentes/ui/Tabs'
import { Banknote, Wallet, Users, Settings, BookOpen } from 'lucide-react'
import { VistaNomina } from './_componentes/VistaNomina'
import { VistaEmpleados } from './_componentes/VistaEmpleados'
import { VistaConfiguracion } from './_componentes/VistaConfiguracion'
import { VistaAdelantos } from './_componentes/VistaAdelantos'

type TabClave = 'liquidaciones' | 'adelantos' | 'empleados' | 'configuracion'

const TABS = [
  { clave: 'liquidaciones', etiqueta: 'Liquidaciones', icono: <Banknote size={15} /> },
  { clave: 'adelantos',     etiqueta: 'Adelantos',     icono: <Wallet size={15} /> },
  { clave: 'empleados',     etiqueta: 'Empleados',     icono: <Users size={15} /> },
  { clave: 'configuracion', etiqueta: 'Configuración', icono: <Settings size={15} /> },
]

function ContenidoNominas() {
  const router = useRouter()
  const searchParams = useSearchParams()

  // Tab activa con sync URL ↔ estado. Permite linkear directo a una
  // pestaña concreta y mantenerla al volver con back.
  const tabUrl = searchParams.get('tab') as TabClave | null
  const [tab, setTab] = useState<TabClave>(
    TABS.some(t => t.clave === tabUrl) ? tabUrl! : 'liquidaciones',
  )
  // Tabs ya visitadas. Mantenemos vivas en memoria las que ya se
  // mostraron (solo las ocultamos con `hidden`), así cambiar de tab
  // no remonta el componente ni dispara re-fetches: el estado interno
  // (período seleccionado, scroll, búsqueda, conceptos cargados) queda
  // cacheado. La primera visita sí monta (lazy).
  const [tabsVisitadas, setTabsVisitadas] = useState<Set<TabClave>>(() => new Set([tab]))
  useEffect(() => {
    setTabsVisitadas(prev => prev.has(tab) ? prev : new Set([...prev, tab]))
  }, [tab])

  const cambiarTab = (claveStr: string) => {
    const clave = claveStr as TabClave
    setTab(clave)
    const params = new URLSearchParams(window.location.search)
    if (clave === 'liquidaciones') params.delete('tab')
    else params.set('tab', clave)
    const qs = params.toString()
    router.replace(`/nominas${qs ? `?${qs}` : ''}`, { scroll: false })
  }

  return (
    <>
      {/* Tabs: pegadas al cabezal de la vista (mismo bloque que el hero). */}
      <div className="px-4 md:px-6 pt-4 flex items-center justify-between gap-3">
        <Tabs tabs={TABS} activo={tab} onChange={cambiarTab} layoutId="tab-nominas" />
        {/* Acceso rápido a la guía del módulo. */}
        <button
          type="button"
          onClick={() => router.push('/documentacion/nominas')}
          title="Cómo funciona Nóminas"
          className="shrink-0 inline-flex items-center gap-1.5 text-xs text-texto-terciario hover:text-texto-primario px-2.5 py-1.5 rounded-md hover:bg-superficie-elevada/40 transition-colors"
        >
          <BookOpen size={13} />
          <span className="hidden md:inline">Guía de uso</span>
        </button>
      </div>

      {/* Contenido por pestaña — keep-alive: cada tab se monta la
          primera vez que el usuario entra y luego se oculta con
          `hidden` en lugar de desmontarse. Esto evita refetch y
          recálculos al alternar entre tabs. */}
      {tabsVisitadas.has('liquidaciones') && (
        <div hidden={tab !== 'liquidaciones'}>
          <VistaNomina />
        </div>
      )}

      {tabsVisitadas.has('adelantos') && (
        <div hidden={tab !== 'adelantos'}>
          <VistaAdelantos />
        </div>
      )}

      {tabsVisitadas.has('empleados') && (
        <div hidden={tab !== 'empleados'}>
          <VistaEmpleados />
        </div>
      )}

      {tabsVisitadas.has('configuracion') && (
        <div hidden={tab !== 'configuracion'}>
          <VistaConfiguracion />
        </div>
      )}
    </>
  )
}

export default function PaginaNominas() {
  return (
    <GuardPagina modulo="nomina">
      <ContenidoNominas />
    </GuardPagina>
  )
}
