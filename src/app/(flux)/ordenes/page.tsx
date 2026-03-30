'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { PlantillaListado } from '@/componentes/entidad/PlantillaListado'
import { TablaDinamica } from '@/componentes/tablas/TablaDinamica'
import type { ColumnaDinamica } from '@/componentes/tablas/TablaDinamica'
import { PlusCircle, Download, Wrench, Hammer } from 'lucide-react'
import { EstadoVacio } from '@/componentes/feedback/EstadoVacio'
import { Boton } from '@/componentes/ui/Boton'
import { useTraduccion } from '@/lib/i18n'

export default function PaginaOrdenes() {
  const { t } = useTraduccion()
  const router = useRouter()
  const [busqueda, setBusqueda] = useState('')

  const columnas: ColumnaDinamica<Record<string, unknown>>[] = [
    { clave: 'numero', etiqueta: t('ordenes.numero'), ancho: 130, ordenable: true },
    { clave: 'titulo', etiqueta: t('ordenes.titulo_campo'), ancho: 250, ordenable: true },
    { clave: 'cliente', etiqueta: t('ordenes.cliente'), ancho: 180, ordenable: true },
    {
      clave: 'estado', etiqueta: t('comun.estado'), ancho: 120, ordenable: true,
      filtrable: true,
      opcionesFiltro: [
        { valor: 'abierta', etiqueta: t('ordenes.estados_orden.abierta') },
        { valor: 'en_progreso', etiqueta: t('ordenes.estados_orden.en_progreso') },
        { valor: 'esperando', etiqueta: t('ordenes.estados_orden.esperando') },
        { valor: 'completada', etiqueta: t('ordenes.estados_orden.completada') },
        { valor: 'cancelada', etiqueta: t('ordenes.estados_orden.cancelada') },
      ],
    },
    {
      clave: 'prioridad', etiqueta: t('comun.tipo'), ancho: 120, ordenable: true,
      filtrable: true,
      opcionesFiltro: [
        { valor: 'baja', etiqueta: t('ordenes.prioridades.baja') },
        { valor: 'media', etiqueta: t('ordenes.prioridades.media') },
        { valor: 'alta', etiqueta: t('ordenes.prioridades.alta') },
        { valor: 'urgente', etiqueta: t('ordenes.prioridades.urgente') },
      ],
    },
    { clave: 'fecha', etiqueta: t('comun.fecha'), ancho: 140, ordenable: true, tipo: 'fecha', filtrable: true },
    { clave: 'asignado', etiqueta: t('ordenes.asignado'), ancho: 180, ordenable: true },
  ]

  return (
    <PlantillaListado
      titulo="Órdenes de trabajo"
      icono={<Wrench size={20} />}
      accionPrincipal={{ etiqueta: t('ordenes.nueva'), icono: <PlusCircle size={14} />, onClick: () => {} }}
      acciones={[
        { id: 'exportar', etiqueta: t('comun.exportar'), icono: <Download size={14} />, onClick: () => {} },
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
