'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { PlantillaListado } from '@/componentes/entidad/PlantillaListado'
import { TablaDinamica } from '@/componentes/tablas/TablaDinamica'
import type { ColumnaDinamica } from '@/componentes/tablas/TablaDinamica'
import { PlusCircle, Download, ClipboardList, CalendarClock } from 'lucide-react'
import { EstadoVacio } from '@/componentes/feedback/EstadoVacio'
import { Boton } from '@/componentes/ui/Boton'

const columnas: ColumnaDinamica<Record<string, unknown>>[] = [
  { clave: 'titulo', etiqueta: 'Título', ancho: 250, ordenable: true },
  {
    clave: 'tipo', etiqueta: 'Tipo', ancho: 120, ordenable: true,
    filtrable: true,
    opcionesFiltro: [
      { valor: 'llamada', etiqueta: 'Llamada' },
      { valor: 'reunion', etiqueta: 'Reunión' },
      { valor: 'correo', etiqueta: 'Correo' },
      { valor: 'tarea', etiqueta: 'Tarea' },
      { valor: 'visita', etiqueta: 'Visita' },
    ],
  },
  {
    clave: 'estado', etiqueta: 'Estado', ancho: 120, ordenable: true,
    filtrable: true,
    opcionesFiltro: [
      { valor: 'pendiente', etiqueta: 'Pendiente' },
      { valor: 'en_progreso', etiqueta: 'En progreso' },
      { valor: 'completada', etiqueta: 'Completada' },
      { valor: 'cancelada', etiqueta: 'Cancelada' },
    ],
  },
  { clave: 'responsable', etiqueta: 'Responsable', ancho: 180, ordenable: true },
  { clave: 'fecha', etiqueta: 'Fecha', ancho: 140, ordenable: true, tipo: 'fecha', filtrable: true },
  { clave: 'contacto', etiqueta: 'Contacto', ancho: 180 },
]

export default function PaginaActividades() {
  const router = useRouter()
  const [busqueda, setBusqueda] = useState('')

  return (
    <PlantillaListado
      titulo="Actividades"
      icono={<ClipboardList size={20} />}
      accionPrincipal={{ etiqueta: 'Nueva actividad', icono: <PlusCircle size={14} />, onClick: () => {} }}
      acciones={[
        { id: 'exportar', etiqueta: 'Exportar', icono: <Download size={14} />, onClick: () => {} },
      ]}
      mostrarConfiguracion
      onConfiguracion={() => router.push('/actividades/configuracion')}
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
        idModulo="actividades"
        estadoVacio={
          <EstadoVacio
            icono={<CalendarClock size={52} strokeWidth={1} />}
            titulo="La agenda está vacía"
            descripcion="Ni una llamada, ni una reunión, ni un café pendiente. Creá tu primera actividad y ponete en movimiento."
            accion={<Boton>Crear primera actividad</Boton>}
          />
        }
      />
    </PlantillaListado>
  )
}
