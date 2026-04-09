'use client'

import { useState } from 'react'
import { Boton } from '@/componentes/ui/Boton'
import { Mail, Zap, KanbanSquare } from 'lucide-react'
import { IconoWhatsApp } from '@/componentes/iconos/IconoWhatsApp'
import { SeccionEtapas } from '../../_componentes/SeccionEtapas'
import { ModalEtiquetas } from '../../_componentes/ModalEtiquetas'
import { ModalReglas } from '../../_componentes/ModalReglas'
import { PanelMetricas } from '../../_componentes/PanelMetricas'
import { ListaProgramados } from '../../_componentes/ListaProgramados'
import { useTraduccion } from '@/lib/i18n'

/**
 * Sección Pipeline — tabs de WhatsApp y Correo con etapas drag-and-drop.
 * Se usa en la configuración del inbox cuando la sección activa es "pipeline".
 */
export function SeccionPipeline() {
  const [tabCanal, setTabCanal] = useState<'whatsapp' | 'correo'>('whatsapp')

  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-sm font-semibold" style={{ color: 'var(--texto-primario)' }}>
          Pipeline / Etapas
        </h3>
        <p className="text-xs mt-1 mb-4" style={{ color: 'var(--texto-terciario)' }}>
          Definí las etapas por las que pasan tus conversaciones en cada canal. Podés personalizar nombres, colores e íconos, y ver las conversaciones organizadas en vista pipeline desde el inbox.
        </p>
      </div>

      {/* Tabs WhatsApp / Correo */}
      <div
        className="flex gap-1 p-1 rounded-lg w-fit"
        style={{ background: 'var(--superficie-hover)' }}
      >
        <button
          onClick={() => setTabCanal('whatsapp')}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all"
          style={{
            background: tabCanal === 'whatsapp' ? 'var(--superficie-tarjeta)' : 'transparent',
            color: tabCanal === 'whatsapp' ? 'var(--texto-primario)' : 'var(--texto-terciario)',
            boxShadow: tabCanal === 'whatsapp' ? '0 1px 2px rgba(0,0,0,0.1)' : 'none',
          }}
        >
          <IconoWhatsApp size={14} />
          WhatsApp
        </button>
        <button
          onClick={() => setTabCanal('correo')}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all"
          style={{
            background: tabCanal === 'correo' ? 'var(--superficie-tarjeta)' : 'transparent',
            color: tabCanal === 'correo' ? 'var(--texto-primario)' : 'var(--texto-terciario)',
            boxShadow: tabCanal === 'correo' ? '0 1px 2px rgba(0,0,0,0.1)' : 'none',
          }}
        >
          <Mail size={14} />
          Correo
        </button>
      </div>

      <SeccionEtapas tipoCanal={tabCanal} key={tabCanal} />
    </div>
  )
}

/**
 * Sección de Etiquetas en config — muestra ModalEtiquetas inline en modo gestión.
 */
export function SeccionEtiquetasConfig() {
  const { t } = useTraduccion()

  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-sm font-semibold" style={{ color: 'var(--texto-primario)' }}>
          {t('inbox.etiquetar')}
        </h3>
        <p className="text-xs mt-1" style={{ color: 'var(--texto-terciario)' }}>
          Organizá conversaciones con etiquetas de color. Se pueden asignar manualmente desde cada conversación o vía reglas automáticas.
        </p>
      </div>

      <ModalEtiquetas
        abierto={true}
        onCerrar={() => {}}
        inline
      />
    </div>
  )
}

/**
 * Sección de Reglas automáticas en config — botón que abre ModalReglas.
 */
export function SeccionReglasConfig() {
  const [modalAbierto, setModalAbierto] = useState(false)

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-semibold" style={{ color: 'var(--texto-primario)' }}>
          Reglas automáticas
        </h3>
        <p className="text-xs mt-1" style={{ color: 'var(--texto-terciario)' }}>
          Clasificá correos automáticamente según remitente, asunto o contenido. Las reglas se ejecutan al recibir cada correo nuevo.
        </p>
      </div>

      <Boton variante="primario" tamano="sm" icono={<Zap size={14} />} onClick={() => setModalAbierto(true)}>
        Gestionar reglas
      </Boton>

      <ModalReglas
        abierto={modalAbierto}
        onCerrar={() => setModalAbierto(false)}
      />
    </div>
  )
}

/**
 * Sección de Métricas en config — panel de métricas + lista de programados.
 */
export function SeccionMetricasConfig() {
  return (
    <div className="space-y-4">
      <PanelMetricas />

      <div className="pt-4" style={{ borderTop: '1px solid var(--borde-sutil)' }}>
        <ListaProgramados />
      </div>
    </div>
  )
}
