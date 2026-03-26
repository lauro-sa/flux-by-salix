'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { PlantillaListado } from '@/componentes/entidad/PlantillaListado'
import { TablaDinamica } from '@/componentes/tablas/TablaDinamica'
import type { ColumnaDinamica } from '@/componentes/tablas/TablaDinamica'
import { PlusCircle, Download, Upload, Package, PackageOpen } from 'lucide-react'
import { EstadoVacio } from '@/componentes/feedback/EstadoVacio'
import { Boton } from '@/componentes/ui/Boton'

const columnas: ColumnaDinamica<Record<string, unknown>>[] = [
  { clave: 'codigo', etiqueta: 'Código', ancho: 120, ordenable: true },
  { clave: 'nombre', etiqueta: 'Nombre', ancho: 250, ordenable: true },
  {
    clave: 'categoria', etiqueta: 'Categoría', ancho: 150, ordenable: true,
    filtrable: true, tipoFiltro: 'multiple',
    opcionesFiltro: [
      { valor: 'insumos', etiqueta: 'Insumos' },
      { valor: 'servicios', etiqueta: 'Servicios' },
      { valor: 'equipos', etiqueta: 'Equipos' },
      { valor: 'repuestos', etiqueta: 'Repuestos' },
    ],
  },
  { clave: 'precio', etiqueta: 'Precio', ancho: 120, ordenable: true, tipo: 'moneda', alineacion: 'right' },
  { clave: 'stock', etiqueta: 'Stock', ancho: 100, ordenable: true, tipo: 'numero', alineacion: 'right' },
  {
    clave: 'estado', etiqueta: 'Estado', ancho: 120, ordenable: true,
    filtrable: true,
    opcionesFiltro: [
      { valor: 'activo', etiqueta: 'Activo' },
      { valor: 'inactivo', etiqueta: 'Inactivo' },
      { valor: 'agotado', etiqueta: 'Agotado' },
    ],
  },
]

export default function PaginaProductos() {
  const router = useRouter()
  const [busqueda, setBusqueda] = useState('')

  return (
    <PlantillaListado
      titulo="Productos"
      icono={<Package size={20} />}
      accionPrincipal={{ etiqueta: 'Nuevo producto', icono: <PlusCircle size={14} />, onClick: () => {} }}
      acciones={[
        { id: 'importar', etiqueta: 'Importar', icono: <Upload size={14} />, onClick: () => {} },
        { id: 'exportar', etiqueta: 'Exportar', icono: <Download size={14} />, onClick: () => {} },
      ]}
      mostrarConfiguracion
      onConfiguracion={() => router.push('/productos/configuracion')}
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
        idModulo="productos"
        estadoVacio={
          <EstadoVacio
            icono={<PackageOpen size={52} strokeWidth={1} />}
            titulo="Las estanterías están vacías"
            descripcion="Cargá tu primer producto o importá tu catálogo completo. Sin productos no hay presupuestos."
            accion={<Boton>Cargar primer producto</Boton>}
          />
        }
      />
    </PlantillaListado>
  )
}
