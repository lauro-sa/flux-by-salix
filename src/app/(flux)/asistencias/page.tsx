'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { PlantillaListado } from '@/componentes/entidad/PlantillaListado'
import { TablaDinamica } from '@/componentes/tablas/TablaDinamica'
import type { ColumnaDinamica } from '@/componentes/tablas/TablaDinamica'
import { Download, Clock, TimerOff } from 'lucide-react'
import { EstadoVacio } from '@/componentes/feedback/EstadoVacio'
import { useTraduccion } from '@/lib/i18n'

export default function PaginaAsistencias() {
  const { t } = useTraduccion()
  const router = useRouter()
  const [busqueda, setBusqueda] = useState('')

  const columnas: ColumnaDinamica<Record<string, unknown>>[] = [
    { clave: 'empleado', etiqueta: t('asistencias_page.empleado'), ancho: 200, ordenable: true },
    { clave: 'fecha', etiqueta: t('comun.fecha'), ancho: 140, ordenable: true, tipo: 'fecha', filtrable: true },
    { clave: 'entrada', etiqueta: t('asistencias.entrada'), ancho: 120 },
    { clave: 'salida', etiqueta: t('asistencias.salida'), ancho: 120 },
    { clave: 'horas', etiqueta: t('asistencias_page.horas'), ancho: 100, tipo: 'numero', alineacion: 'right' },
    {
      clave: 'estado', etiqueta: t('comun.estado'), ancho: 120, ordenable: true,
      filtrable: true,
      opcionesFiltro: [
        { valor: 'presente', etiqueta: t('asistencias_page.estados_asist.presente') },
        { valor: 'tardanza', etiqueta: t('asistencias_page.estados_asist.tardanza') },
        { valor: 'ausente', etiqueta: t('asistencias_page.estados_asist.ausente') },
        { valor: 'justificado', etiqueta: t('asistencias_page.estados_asist.justificado') },
      ],
    },
    { clave: 'ubicacion', etiqueta: t('asistencias_page.ubicacion'), ancho: 180 },
  ]

  return (
    <PlantillaListado
      titulo="Asistencias"
      icono={<Clock size={20} />}
      acciones={[
        { id: 'exportar', etiqueta: t('comun.exportar'), icono: <Download size={14} />, onClick: () => {} },
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
