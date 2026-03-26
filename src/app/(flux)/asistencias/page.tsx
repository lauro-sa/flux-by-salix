'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { PlantillaListado } from '@/componentes/entidad/PlantillaListado'
import { TablaDinamica } from '@/componentes/tablas/TablaDinamica'
import type { ColumnaDinamica } from '@/componentes/tablas/TablaDinamica'
import { Download, Clock, TimerOff } from 'lucide-react'
import { EstadoVacio } from '@/componentes/feedback/EstadoVacio'

const columnas: ColumnaDinamica<Record<string, unknown>>[] = [
  { clave: 'empleado', etiqueta: 'Empleado', ancho: 200, ordenable: true },
  { clave: 'fecha', etiqueta: 'Fecha', ancho: 140, ordenable: true, tipo: 'fecha', filtrable: true },
  { clave: 'entrada', etiqueta: 'Entrada', ancho: 120 },
  { clave: 'salida', etiqueta: 'Salida', ancho: 120 },
  { clave: 'horas', etiqueta: 'Horas', ancho: 100, tipo: 'numero', alineacion: 'right' },
  {
    clave: 'estado', etiqueta: 'Estado', ancho: 120, ordenable: true,
    filtrable: true,
    opcionesFiltro: [
      { valor: 'presente', etiqueta: 'Presente' },
      { valor: 'tardanza', etiqueta: 'Tardanza' },
      { valor: 'ausente', etiqueta: 'Ausente' },
      { valor: 'justificado', etiqueta: 'Justificado' },
    ],
  },
  { clave: 'ubicacion', etiqueta: 'Ubicación', ancho: 180 },
]

export default function PaginaAsistencias() {
  const router = useRouter()
  const [busqueda, setBusqueda] = useState('')

  return (
    <PlantillaListado
      titulo="Asistencias"
      icono={<Clock size={20} />}
      acciones={[
        { id: 'exportar', etiqueta: 'Exportar', icono: <Download size={14} />, onClick: () => {} },
      ]}
      mostrarConfiguracion
      onConfiguracion={() => router.push('/asistencias/configuracion')}
    >
      <TablaDinamica
        columnas={columnas}
        datos={[]}
        claveFila={(r) => String(r.id)}
        vistas={['lista']}
        seleccionables
        busqueda={busqueda}
        onBusqueda={setBusqueda}
        placeholder="Buscar..."
        idModulo="asistencias"
        estadoVacio={
          <EstadoVacio
            icono={<TimerOff size={52} strokeWidth={1} />}
            titulo="Nadie fichó todavía"
            descripcion="Cuando tu equipo empiece a registrar entrada y salida, las fichadas van a aparecer acá solitas."
          />
        }
      />
    </PlantillaListado>
  )
}
