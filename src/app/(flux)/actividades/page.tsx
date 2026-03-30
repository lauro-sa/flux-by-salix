'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { PlantillaListado } from '@/componentes/entidad/PlantillaListado'
import { TablaDinamica } from '@/componentes/tablas/TablaDinamica'
import type { ColumnaDinamica } from '@/componentes/tablas/TablaDinamica'
import { PlusCircle, Download, ClipboardList, CalendarClock } from 'lucide-react'
import { EstadoVacio } from '@/componentes/feedback/EstadoVacio'
import { Boton } from '@/componentes/ui/Boton'
import { useTraduccion } from '@/lib/i18n'

export default function PaginaActividades() {
  const router = useRouter()
  const [busqueda, setBusqueda] = useState('')
  const { t } = useTraduccion()

  /** Columnas de la tabla — se definen dentro del componente para acceder a t() */
  const columnas: ColumnaDinamica<Record<string, unknown>>[] = [
    { clave: 'titulo', etiqueta: t('actividades.titulo_campo'), ancho: 250, ordenable: true },
    {
      clave: 'tipo', etiqueta: t('comun.tipo'), ancho: 120, ordenable: true,
      filtrable: true,
      opcionesFiltro: [
        { valor: 'llamada', etiqueta: t('actividades.tipo_llamada') },
        { valor: 'reunion', etiqueta: t('actividades.tipo_reunion') },
        { valor: 'correo', etiqueta: t('actividades.tipo_correo') },
        { valor: 'tarea', etiqueta: t('actividades.tipo_tarea') },
        { valor: 'visita', etiqueta: t('actividades.tipo_visita') },
      ],
    },
    {
      clave: 'estado', etiqueta: t('comun.estado'), ancho: 120, ordenable: true,
      filtrable: true,
      opcionesFiltro: [
        { valor: 'pendiente', etiqueta: t('actividades.estados.pendiente') },
        { valor: 'en_progreso', etiqueta: t('comun.en_progreso') },
        { valor: 'completada', etiqueta: t('actividades.estados.completada') },
        { valor: 'cancelada', etiqueta: t('actividades.estados.cancelada') },
      ],
    },
    { clave: 'responsable', etiqueta: t('actividades.asignado_a'), ancho: 180, ordenable: true },
    { clave: 'fecha', etiqueta: t('comun.fecha'), ancho: 140, ordenable: true, tipo: 'fecha', filtrable: true },
    { clave: 'contacto', etiqueta: t('contactos.titulo'), ancho: 180 },
  ]

  return (
    <PlantillaListado
      titulo={t('actividades.titulo')}
      icono={<ClipboardList size={20} />}
      accionPrincipal={{ etiqueta: t('actividades.nueva'), icono: <PlusCircle size={14} />, onClick: () => {} }}
      acciones={[
        { id: 'exportar', etiqueta: t('comun.exportar'), icono: <Download size={14} />, onClick: () => {} },
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
        placeholder={`${t('comun.buscar')}...`}
        idModulo="actividades"
        estadoVacio={
          <EstadoVacio
            icono={<CalendarClock size={52} strokeWidth={1} />}
            titulo={t('actividades.sin_actividades')}
            descripcion={t('actividades.sin_actividades_desc')}
            accion={<Boton>{t('actividades.crear_primera')}</Boton>}
          />
        }
      />
    </PlantillaListado>
  )
}
