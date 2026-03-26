'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { PlantillaListado } from '@/componentes/entidad/PlantillaListado'
import { TablaDinamica } from '@/componentes/tablas/TablaDinamica'
import type { ColumnaDinamica } from '@/componentes/tablas/TablaDinamica'
import { PlusCircle, Download, FileText, FilePen } from 'lucide-react'
import { EstadoVacio } from '@/componentes/feedback/EstadoVacio'
import { Boton } from '@/componentes/ui/Boton'

const columnas: ColumnaDinamica<Record<string, unknown>>[] = [
  { clave: 'numero', etiqueta: 'Número', ancho: 140, ordenable: true },
  { clave: 'contacto', etiqueta: 'Contacto', ancho: 200, ordenable: true },
  { clave: 'monto', etiqueta: 'Monto', ancho: 130, ordenable: true, tipo: 'moneda', alineacion: 'right' },
  { clave: 'estado', etiqueta: 'Estado', ancho: 120, ordenable: true },
  { clave: 'fecha', etiqueta: 'Fecha', ancho: 140, ordenable: true, tipo: 'fecha' },
  { clave: 'vencimiento', etiqueta: 'Vencimiento', ancho: 140, ordenable: true, tipo: 'fecha' },
]

export default function PaginaPresupuestos() {
  const router = useRouter()
  const [busqueda, setBusqueda] = useState('')

  return (
    <PlantillaListado
      titulo="Presupuestos"
      icono={<FileText size={20} />}
      accionPrincipal={{ etiqueta: 'Nuevo presupuesto', icono: <PlusCircle size={14} />, onClick: () => {} }}
      acciones={[
        { id: 'exportar', etiqueta: 'Exportar', icono: <Download size={14} />, onClick: () => {} },
      ]}
      mostrarConfiguracion
      onConfiguracion={() => router.push('/presupuestos/configuracion')}
    >
      <TablaDinamica
        columnas={columnas}
        datos={[]}
        claveFila={(r) => String(r.id)}
        vistas={['lista', 'tarjetas']}
        seleccionables
        busqueda={busqueda}
        onBusqueda={setBusqueda}
        placeholder="Buscar..."
        estadoVacio={
          <EstadoVacio
            icono={<FilePen size={52} strokeWidth={1} />}
            titulo="Sin presupuestos todavía"
            descripcion="Armá tu primer presupuesto y empezá a cerrar negocios. Cada venta arranca acá."
            accion={<Boton>Crear primer presupuesto</Boton>}
          />
        }
      />
    </PlantillaListado>
  )
}
