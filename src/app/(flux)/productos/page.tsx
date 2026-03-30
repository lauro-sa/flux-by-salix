'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { PlantillaListado } from '@/componentes/entidad/PlantillaListado'
import { TablaDinamica } from '@/componentes/tablas/TablaDinamica'
import type { ColumnaDinamica } from '@/componentes/tablas/TablaDinamica'
import { PlusCircle, Download, Upload, Package, PackageOpen } from 'lucide-react'
import { EstadoVacio } from '@/componentes/feedback/EstadoVacio'
import { Boton } from '@/componentes/ui/Boton'
import { useTraduccion } from '@/lib/i18n'

export default function PaginaProductos() {
  const { t } = useTraduccion()
  const router = useRouter()
  const [busqueda, setBusqueda] = useState('')

  const columnas: ColumnaDinamica<Record<string, unknown>>[] = [
    { clave: 'codigo', etiqueta: t('comun.codigo'), ancho: 120, ordenable: true },
    { clave: 'nombre', etiqueta: t('comun.nombre'), ancho: 250, ordenable: true },
    {
      clave: 'categoria', etiqueta: t('productos.categoria'), ancho: 150, ordenable: true,
      filtrable: true, tipoFiltro: 'multiple',
      opcionesFiltro: [
        { valor: 'insumos', etiqueta: t('productos.categorias_prod.insumos') },
        { valor: 'servicios', etiqueta: t('productos.categorias_prod.servicios') },
        { valor: 'equipos', etiqueta: t('productos.categorias_prod.equipos') },
        { valor: 'repuestos', etiqueta: t('productos.categorias_prod.repuestos') },
      ],
    },
    { clave: 'precio', etiqueta: t('productos.precio_venta'), ancho: 120, ordenable: true, tipo: 'moneda', alineacion: 'right' },
    { clave: 'stock', etiqueta: t('productos.stock'), ancho: 100, ordenable: true, tipo: 'numero', alineacion: 'right' },
    {
      clave: 'estado', etiqueta: t('comun.estado'), ancho: 120, ordenable: true,
      filtrable: true,
      opcionesFiltro: [
        { valor: 'activo', etiqueta: t('productos.estados_prod.activo') },
        { valor: 'inactivo', etiqueta: t('productos.estados_prod.inactivo') },
        { valor: 'agotado', etiqueta: t('productos.estados_prod.agotado') },
      ],
    },
  ]

  return (
    <PlantillaListado
      titulo="Productos"
      icono={<Package size={20} />}
      accionPrincipal={{ etiqueta: t('productos.nuevo'), icono: <PlusCircle size={14} />, onClick: () => {} }}
      acciones={[
        { id: 'importar', etiqueta: t('comun.importar'), icono: <Upload size={14} />, onClick: () => {} },
        { id: 'exportar', etiqueta: t('comun.exportar'), icono: <Download size={14} />, onClick: () => {} },
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
