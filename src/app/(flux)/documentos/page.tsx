'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { PlantillaListado } from '@/componentes/entidad/PlantillaListado'
import { TablaDinamica } from '@/componentes/tablas/TablaDinamica'
import type { ColumnaDinamica } from '@/componentes/tablas/TablaDinamica'
import { PlusCircle, Download, FileText, FilePlus2 } from 'lucide-react'
import { EstadoVacio } from '@/componentes/feedback/EstadoVacio'
import { Boton } from '@/componentes/ui/Boton'
import { useTraduccion } from '@/lib/i18n'

export default function PaginaDocumentos() {
  const { t } = useTraduccion()
  const router = useRouter()
  const [busqueda, setBusqueda] = useState('')

  const columnas: ColumnaDinamica<Record<string, unknown>>[] = [
    { clave: 'numero', etiqueta: t('documentos.numero'), ancho: 140, ordenable: true },
    {
      clave: 'tipo', etiqueta: t('comun.tipo'), ancho: 130, ordenable: true,
      filtrable: true,
      opcionesFiltro: [
        { valor: 'presupuesto', etiqueta: t('documentos.tipos.presupuesto') },
        { valor: 'factura', etiqueta: t('documentos.tipos.factura') },
        { valor: 'nota_credito', etiqueta: t('documentos_page.tipos_doc.nota_credito') },
        { valor: 'recibo', etiqueta: t('documentos_page.tipos_doc.recibo') },
        { valor: 'remito', etiqueta: t('documentos_page.tipos_doc.remito') },
      ],
    },
    { clave: 'contacto', etiqueta: t('documentos_page.contacto'), ancho: 200, ordenable: true },
    { clave: 'monto', etiqueta: t('documentos_page.monto'), ancho: 130, ordenable: true, tipo: 'moneda', alineacion: 'right' },
    {
      clave: 'estado', etiqueta: t('comun.estado'), ancho: 120, ordenable: true,
      filtrable: true,
      opcionesFiltro: [
        { valor: 'borrador', etiqueta: t('documentos.estados.borrador') },
        { valor: 'enviado', etiqueta: t('documentos.estados.enviado') },
        { valor: 'pagado', etiqueta: t('documentos.estados.pagado') },
        { valor: 'vencido', etiqueta: t('documentos.estados.vencido') },
        { valor: 'anulado', etiqueta: t('documentos_page.estados_doc.anulado') },
      ],
    },
    { clave: 'fecha', etiqueta: t('documentos_page.fecha'), ancho: 140, ordenable: true, tipo: 'fecha', filtrable: true },
    { clave: 'vencimiento', etiqueta: t('documentos_page.vencimiento'), ancho: 140, ordenable: true, tipo: 'fecha', filtrable: true },
  ]

  return (
    <PlantillaListado
      titulo="Documentos"
      icono={<FileText size={20} />}
      accionPrincipal={{ etiqueta: t('documentos.nuevo'), icono: <PlusCircle size={14} />, onClick: () => {} }}
      acciones={[
        { id: 'exportar', etiqueta: t('comun.exportar'), icono: <Download size={14} />, onClick: () => {} },
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
