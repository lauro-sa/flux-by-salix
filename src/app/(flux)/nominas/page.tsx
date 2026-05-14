'use client'

/**
 * Página /nominas — Vista principal del módulo Nóminas (PR 4 del plan).
 *
 * Reemplaza al placeholder de PR 1. Renderiza `<VistaNomina>`, la misma
 * vista que hasta ahora vivía como pestaña dentro de Asistencias.
 *
 * En PR 4b se agregan las pestañas Liquidaciones · Adelantos ·
 * Empleados · Configuración. Por ahora solo está la vista de
 * liquidaciones (la que ya existía).
 */

import { GuardPagina } from '@/componentes/entidad/GuardPagina'
import { VistaNomina } from './_componentes/VistaNomina'

function ContenidoNominas() {
  return <VistaNomina />
}

export default function PaginaNominas() {
  return (
    <GuardPagina modulo="nomina">
      <ContenidoNominas />
    </GuardPagina>
  )
}
