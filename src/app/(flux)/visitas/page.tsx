'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { PlantillaListado } from '@/componentes/entidad/PlantillaListado'
import { TablaDinamica } from '@/componentes/tablas/TablaDinamica'
import type { ColumnaDinamica } from '@/componentes/tablas/TablaDinamica'
import { PlusCircle, Download, MapPin, MapPinOff } from 'lucide-react'
import { EstadoVacio } from '@/componentes/feedback/EstadoVacio'
import { Boton } from '@/componentes/ui/Boton'

const columnas: ColumnaDinamica<Record<string, unknown>>[] = [
  { clave: 'contacto', etiqueta: 'Contacto', ancho: 200, ordenable: true },
  { clave: 'direccion', etiqueta: 'Dirección', ancho: 250 },
  { clave: 'fecha', etiqueta: 'Fecha', ancho: 140, ordenable: true, tipo: 'fecha', filtrable: true },
  {
    clave: 'estado', etiqueta: 'Estado', ancho: 120, ordenable: true,
    filtrable: true,
    opcionesFiltro: [
      { valor: 'programada', etiqueta: 'Programada' },
      { valor: 'en_curso', etiqueta: 'En curso' },
      { valor: 'completada', etiqueta: 'Completada' },
      { valor: 'cancelada', etiqueta: 'Cancelada' },
    ],
  },
  { clave: 'vendedor', etiqueta: 'Vendedor', ancho: 180, ordenable: true },
  { clave: 'notas', etiqueta: 'Notas', ancho: 200 },
]

export default function PaginaVisitas() {
  const router = useRouter()
  const [busqueda, setBusqueda] = useState('')

  return (
    <PlantillaListado
      titulo="Visitas"
      icono={<MapPin size={20} />}
      accionPrincipal={{ etiqueta: 'Nueva visita', icono: <PlusCircle size={14} />, onClick: () => {} }}
      acciones={[
        { id: 'exportar', etiqueta: 'Exportar', icono: <Download size={14} />, onClick: () => {} },
      ]}
      mostrarConfiguracion
      onConfiguracion={() => router.push('/visitas/configuracion')}
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
        idModulo="visitas"
        estadoVacio={
          <EstadoVacio
            icono={<MapPinOff size={52} strokeWidth={1} />}
            titulo="El mapa está en blanco"
            descripcion="Tu equipo comercial todavía no tiene visitas agendadas. Programá la primera y salí a la calle."
            accion={<Boton>Agendar primera visita</Boton>}
          />
        }
      />
    </PlantillaListado>
  )
}
