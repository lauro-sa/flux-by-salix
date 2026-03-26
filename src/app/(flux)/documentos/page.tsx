'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { PlantillaListado } from '@/componentes/entidad/PlantillaListado'
import { TablaDinamica } from '@/componentes/tablas/TablaDinamica'
import type { ColumnaDinamica } from '@/componentes/tablas/TablaDinamica'
import { PlusCircle, Download, FileText, FilePlus2 } from 'lucide-react'
import { EstadoVacio } from '@/componentes/feedback/EstadoVacio'
import { Boton } from '@/componentes/ui/Boton'

const columnas: ColumnaDinamica<Record<string, unknown>>[] = [
  { clave: 'numero', etiqueta: 'Número', ancho: 140, ordenable: true },
  {
    clave: 'tipo', etiqueta: 'Tipo', ancho: 130, ordenable: true,
    filtrable: true,
    opcionesFiltro: [
      { valor: 'presupuesto', etiqueta: 'Presupuesto' },
      { valor: 'factura', etiqueta: 'Factura' },
      { valor: 'nota_credito', etiqueta: 'Nota de crédito' },
      { valor: 'recibo', etiqueta: 'Recibo' },
      { valor: 'remito', etiqueta: 'Remito' },
    ],
  },
  { clave: 'contacto', etiqueta: 'Contacto', ancho: 200, ordenable: true },
  { clave: 'monto', etiqueta: 'Monto', ancho: 130, ordenable: true, tipo: 'moneda', alineacion: 'right' },
  {
    clave: 'estado', etiqueta: 'Estado', ancho: 120, ordenable: true,
    filtrable: true,
    opcionesFiltro: [
      { valor: 'borrador', etiqueta: 'Borrador' },
      { valor: 'enviado', etiqueta: 'Enviado' },
      { valor: 'pagado', etiqueta: 'Pagado' },
      { valor: 'vencido', etiqueta: 'Vencido' },
      { valor: 'anulado', etiqueta: 'Anulado' },
    ],
  },
  { clave: 'fecha', etiqueta: 'Fecha', ancho: 140, ordenable: true, tipo: 'fecha', filtrable: true },
  { clave: 'vencimiento', etiqueta: 'Vencimiento', ancho: 140, ordenable: true, tipo: 'fecha', filtrable: true },
]

export default function PaginaDocumentos() {
  const router = useRouter()
  const [busqueda, setBusqueda] = useState('')

  return (
    <PlantillaListado
      titulo="Documentos"
      icono={<FileText size={20} />}
      accionPrincipal={{ etiqueta: 'Nuevo documento', icono: <PlusCircle size={14} />, onClick: () => {} }}
      acciones={[
        { id: 'exportar', etiqueta: 'Exportar', icono: <Download size={14} />, onClick: () => {} },
      ]}
      mostrarConfiguracion
      onConfiguracion={() => router.push('/documentos/configuracion')}
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
        idModulo="documentos"
        estadoVacio={
          <EstadoVacio
            icono={<FilePlus2 size={52} strokeWidth={1} />}
            titulo="Ni un papel a la vista"
            descripcion="Presupuestos, facturas, notas de crédito... todo empieza con el primer documento."
            accion={<Boton>Crear primer documento</Boton>}
          />
        }
      />
    </PlantillaListado>
  )
}
