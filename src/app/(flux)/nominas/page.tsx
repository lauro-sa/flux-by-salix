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

import { useState } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { GuardPagina } from '@/componentes/entidad/GuardPagina'
import { Tabs } from '@/componentes/ui/Tabs'
import { EstadoVacio } from '@/componentes/feedback/EstadoVacio'
import { Banknote, Wallet, Users, Settings } from 'lucide-react'
import { VistaNomina } from './_componentes/VistaNomina'
import { VistaEmpleados } from './_componentes/VistaEmpleados'

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
      <div className="px-4 md:px-6 pt-4">
        <Tabs tabs={TABS} activo={tab} onChange={cambiarTab} layoutId="tab-nominas" />
      </div>

      {/* Contenido por pestaña */}
      {tab === 'liquidaciones' && <VistaNomina />}

      {tab === 'adelantos' && (
        <EstadoVacio
          icono={<Wallet size={48} strokeWidth={1.5} />}
          titulo="Adelantos — en construcción"
          descripcion="Por ahora los adelantos se gestionan desde el detalle de cada empleado dentro de Liquidaciones. Próximamente esta pestaña va a mostrar el listado completo de adelantos por empresa."
        />
      )}

      {tab === 'empleados' && <VistaEmpleados />}

      {tab === 'configuracion' && (
        <EstadoVacio
          icono={<Settings size={48} strokeWidth={1.5} />}
          titulo="Configuración — en construcción"
          descripcion="Va a permitir administrar el catálogo de conceptos de nómina (presentismo, premios, descuentos) y asignarlos a contratos."
        />
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
