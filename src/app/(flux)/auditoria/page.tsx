'use client'

import { useState } from 'react'
import { PlantillaListado } from '@/componentes/entidad/PlantillaListado'
import { TablaDinamica } from '@/componentes/tablas/TablaDinamica'
import type { ColumnaDinamica } from '@/componentes/tablas/TablaDinamica'
import { Download, Shield, ScanEye } from 'lucide-react'
import { EstadoVacio } from '@/componentes/feedback/EstadoVacio'
import { GuardPagina } from '@/componentes/entidad/GuardPagina'

const columnas: ColumnaDinamica<Record<string, unknown>>[] = [
  { clave: 'fecha', etiqueta: 'Fecha', ancho: 160, ordenable: true, tipo: 'fecha', filtrable: true },
  { clave: 'usuario', etiqueta: 'Usuario', ancho: 180, ordenable: true },
  {
    clave: 'accion', etiqueta: 'Acción', ancho: 150, ordenable: true,
    filtrable: true,
    opcionesFiltro: [
      { valor: 'crear', etiqueta: 'Crear' },
      { valor: 'editar', etiqueta: 'Editar' },
      { valor: 'eliminar', etiqueta: 'Eliminar' },
      { valor: 'login', etiqueta: 'Login' },
      { valor: 'permisos', etiqueta: 'Permisos' },
    ],
  },
  {
    clave: 'modulo', etiqueta: 'Módulo', ancho: 140, ordenable: true,
    filtrable: true,
    opcionesFiltro: [
      { valor: 'contactos', etiqueta: 'Contactos' },
      { valor: 'actividades', etiqueta: 'Actividades' },
      { valor: 'productos', etiqueta: 'Productos' },
      { valor: 'documentos', etiqueta: 'Documentos' },
      { valor: 'ordenes', etiqueta: 'Órdenes' },
      { valor: 'configuracion', etiqueta: 'Configuración' },
    ],
  },
  { clave: 'registro', etiqueta: 'Registro', ancho: 200 },
  { clave: 'detalle', etiqueta: 'Detalle', ancho: 300 },
]

export default function PaginaAuditoria() {
  return (
    <GuardPagina modulo="auditoria" accion="ver">
      <ContenidoAuditoria />
    </GuardPagina>
  )
}

function ContenidoAuditoria() {
  const [busqueda, setBusqueda] = useState('')

  return (
    <PlantillaListado
      titulo="Auditoría"
      icono={<Shield size={20} />}
      acciones={[
        { id: 'exportar', etiqueta: 'Exportar', icono: <Download size={14} />, onClick: () => {} },
      ]}
    >
      <TablaDinamica
        columnas={columnas}
        datos={[]}
        claveFila={(r) => String(r.id)}
        vistas={['lista']}
        busqueda={busqueda}
        onBusqueda={setBusqueda}
        placeholder="Buscar..."
        idModulo="auditoria"
        estadoVacio={
          <EstadoVacio
            icono={<ScanEye size={52} strokeWidth={1} />}
            titulo="Todo tranquilo por acá"
            descripcion="Todavía no hay movimientos registrados. Cuando el equipo empiece a usar Flux, cada acción queda registrada."
          />
        }
      />
    </PlantillaListado>
  )
}
