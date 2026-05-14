'use client'

/**
 * Página /nominas — placeholder del módulo Nóminas (PR 1 del plan).
 * En PRs siguientes (ver PLAN_MODULO_NOMINAS.md) se reemplaza por el
 * listado real con pestañas Liquidaciones · Adelantos · Empleados ·
 * Configuración. Por ahora solo protege la ruta con GuardPagina y
 * muestra un estado de "en construcción" para que el sidebar pueda
 * navegar sin romperse mientras avanzamos.
 */

import { Banknote } from 'lucide-react'
import { GuardPagina } from '@/componentes/entidad/GuardPagina'
import { EstadoVacio } from '@/componentes/feedback/EstadoVacio'

function ContenidoNominas() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center p-8">
      <EstadoVacio
        icono={<Banknote size={48} strokeWidth={1.5} className="text-texto-terciario" />}
        titulo="Módulo Nóminas — en construcción"
        descripcion="Estamos armando este módulo. Pronto vas a poder liquidar sueldos, gestionar contratos laborales, conceptos de pago y adelantos desde acá."
      />
    </div>
  )
}

export default function PaginaNominas() {
  return (
    <GuardPagina modulo="nomina">
      <ContenidoNominas />
    </GuardPagina>
  )
}
