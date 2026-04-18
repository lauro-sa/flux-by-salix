'use client'

import { PaginaEditorTipoEvento } from '@/componentes/entidad/_editor_tipo_evento/PaginaEditorTipoEvento'

export default function PaginaNuevoTipoEvento() {
  return (
    <PaginaEditorTipoEvento
      tipo={null}
      rutaVolver="/calendario/configuracion/tipos"
      textoVolver="Tipos de evento"
    />
  )
}
