'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { PlantillaListado } from '@/componentes/entidad/PlantillaListado'
import { TablaDinamica } from '@/componentes/tablas/TablaDinamica'
import type { ColumnaDinamica } from '@/componentes/tablas/TablaDinamica'
import { PlusCircle, Download, MapPin, MapPinOff } from 'lucide-react'
import { EstadoVacio } from '@/componentes/feedback/EstadoVacio'
import { Boton } from '@/componentes/ui/Boton'
import { useTraduccion } from '@/lib/i18n'

export default function PaginaVisitas() {
  const { t } = useTraduccion()
  const router = useRouter()
  const [busqueda, setBusqueda] = useState('')

  const columnas: ColumnaDinamica<Record<string, unknown>>[] = [
    { clave: 'contacto', etiqueta: t('comun.contacto'), ancho: 200, ordenable: true },
    { clave: 'direccion', etiqueta: t('visitas.direccion'), ancho: 250 },
    { clave: 'fecha', etiqueta: t('comun.fecha'), ancho: 140, ordenable: true, tipo: 'fecha', filtrable: true },
    {
      clave: 'estado', etiqueta: t('comun.estado'), ancho: 120, ordenable: true,
      filtrable: true,
      opcionesFiltro: [
        { valor: 'programada', etiqueta: t('visitas.estados.programada') },
        { valor: 'en_curso', etiqueta: t('visitas.estados_visita.en_curso') },
        { valor: 'completada', etiqueta: t('visitas.estados.completada') },
        { valor: 'cancelada', etiqueta: t('visitas.estados.cancelada') },
      ],
    },
    { clave: 'vendedor', etiqueta: t('visitas.vendedor'), ancho: 180, ordenable: true },
    { clave: 'notas', etiqueta: t('comun.notas'), ancho: 200 },
  ]

  return (
    <PlantillaListado
      titulo="Visitas"
      icono={<MapPin size={20} />}
      accionPrincipal={{ etiqueta: t('visitas.nueva'), icono: <PlusCircle size={14} />, onClick: () => {} }}
      acciones={[
        { id: 'exportar', etiqueta: t('comun.exportar'), icono: <Download size={14} />, onClick: () => {} },
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
