'use client'

import { type ReactNode } from 'react'
import { ModalAdaptable as Modal } from './ModalAdaptable'
import { Boton } from './Boton'
import { AlertTriangle, Info, AlertCircle, CheckCircle } from 'lucide-react'
import { useTraduccion } from '@/lib/i18n'

/**
 * ModalConfirmacion — Modal de alerta/confirmación reutilizable.
 * Tipos: peligro (eliminar, cerrar sesión), advertencia, info, exito.
 * Se usa en: cerrar sesión, eliminar registros, acciones destructivas.
 */

type TipoConfirmacion = 'peligro' | 'advertencia' | 'info' | 'exito'

interface PropiedadesModalConfirmacion {
  abierto: boolean
  onCerrar: () => void
  onConfirmar: () => void
  titulo: string
  descripcion?: string
  tipo?: TipoConfirmacion
  etiquetaConfirmar?: string
  etiquetaCancelar?: string
  cargando?: boolean
  icono?: ReactNode
}

const iconosPorTipo: Record<TipoConfirmacion, ReactNode> = {
  peligro: <AlertCircle size={24} />,
  advertencia: <AlertTriangle size={24} />,
  info: <Info size={24} />,
  exito: <CheckCircle size={24} />,
}

const coloresPorTipo: Record<TipoConfirmacion, { fondo: string; texto: string; variante: 'peligro' | 'primario' | 'advertencia' | 'exito' }> = {
  peligro: { fondo: 'bg-insignia-peligro/10', texto: 'text-insignia-peligro', variante: 'peligro' },
  advertencia: { fondo: 'bg-insignia-advertencia/10', texto: 'text-insignia-advertencia', variante: 'advertencia' },
  info: { fondo: 'bg-insignia-info/10', texto: 'text-insignia-info', variante: 'primario' },
  exito: { fondo: 'bg-insignia-exito/10', texto: 'text-insignia-exito', variante: 'exito' },
}

function ModalConfirmacion({
  abierto,
  onCerrar,
  onConfirmar,
  titulo,
  descripcion,
  tipo = 'peligro',
  etiquetaConfirmar,
  etiquetaCancelar,
  cargando = false,
  icono,
}: PropiedadesModalConfirmacion) {
  const { t } = useTraduccion()
  const colores = coloresPorTipo[tipo]
  const textoConfirmar = etiquetaConfirmar ?? t('comun.confirmar')
  const textoCancelar = etiquetaCancelar ?? t('comun.cancelar')
  const iconoFinal = icono || iconosPorTipo[tipo]

  return (
    <Modal abierto={abierto} onCerrar={onCerrar} tamano="sm">
      <div className="flex flex-col items-center text-center p-2">
        {/* Ícono */}
        <div className={`w-14 h-14 rounded-full ${colores.fondo} flex items-center justify-center mb-4 ${colores.texto}`}>
          {iconoFinal}
        </div>

        {/* Título */}
        <h3 className="text-lg font-semibold text-texto-primario mb-1">
          {titulo}
        </h3>

        {/* Descripción */}
        {descripcion && (
          <p className="text-base text-texto-terciario mb-6 leading-relaxed">
            {descripcion}
          </p>
        )}

        {/* Acciones */}
        <div className="flex gap-3 w-full mt-2">
          <Boton
            variante="secundario"
            anchoCompleto
            onClick={onCerrar}
            disabled={cargando}
          >
            {textoCancelar}
          </Boton>
          <Boton
            variante={colores.variante}
            anchoCompleto
            onClick={onConfirmar}
            cargando={cargando}
          >
            {textoConfirmar}
          </Boton>
        </div>
      </div>
    </Modal>
  )
}

export { ModalConfirmacion, type PropiedadesModalConfirmacion, type TipoConfirmacion }
