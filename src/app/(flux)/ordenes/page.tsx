'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { PlantillaListado } from '@/componentes/entidad/PlantillaListado'
import { TablaDinamica } from '@/componentes/tablas/TablaDinamica'
import type { ColumnaDinamica } from '@/componentes/tablas/TablaDinamica'
import { PlusCircle, Download, Wrench, Hammer } from 'lucide-react'
import { EstadoVacio } from '@/componentes/feedback/EstadoVacio'
import { Boton } from '@/componentes/ui/Boton'

const columnas: ColumnaDinamica<Record<string, unknown>>[] = [
  { clave: 'numero', etiqueta: 'Número', ancho: 130, ordenable: true },
  { clave: 'titulo', etiqueta: 'Título', ancho: 250, ordenable: true },
  { clave: 'cliente', etiqueta: 'Cliente', ancho: 180, ordenable: true },
  {
    clave: 'estado', etiqueta: 'Estado', ancho: 120, ordenable: true,
    filtrable: true,
    opcionesFiltro: [
      { valor: 'abierta', etiqueta: 'Abierta' },
      { valor: 'en_progreso', etiqueta: 'En progreso' },
      { valor: 'esperando', etiqueta: 'Esperando' },
      { valor: 'completada', etiqueta: 'Completada' },
      { valor: 'cancelada', etiqueta: 'Cancelada' },
    ],
  },
  {
    clave: 'prioridad', etiqueta: 'Prioridad', ancho: 120, ordenable: true,
    filtrable: true,
    opcionesFiltro: [
      { valor: 'baja', etiqueta: 'Baja' },
      { valor: 'media', etiqueta: 'Media' },
      { valor: 'alta', etiqueta: 'Alta' },
      { valor: 'urgente', etiqueta: 'Urgente' },
    ],
  },
  { clave: 'fecha', etiqueta: 'Fecha', ancho: 140, ordenable: true, tipo: 'fecha', filtrable: true },
  { clave: 'asignado', etiqueta: 'Asignado', ancho: 180, ordenable: true },
]

export default function PaginaOrdenes() {
  const router = useRouter()
  const [busqueda, setBusqueda] = useState('')

  return (
    <PlantillaListado
      titulo="Órdenes de trabajo"
      icono={<Wrench size={20} />}
      accionPrincipal={{ etiqueta: 'Nueva orden', icono: <PlusCircle size={14} />, onClick: () => {} }}
      acciones={[
        { id: 'exportar', etiqueta: 'Exportar', icono: <Download size={14} />, onClick: () => {} },
      ]}
      mostrarConfiguracion
      onConfiguracion={() => router.push('/ordenes/configuracion')}
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
        idModulo="ordenes"
        estadoVacio={
          <EstadoVacio
            icono={<Hammer size={52} strokeWidth={1} />}
            titulo="Taller en silencio"
            descripcion="No hay órdenes de trabajo por ahora. Creá la primera y poné al equipo en acción."
            accion={<Boton>Crear primera orden</Boton>}
          />
        }
      />
    </PlantillaListado>
  )
}
