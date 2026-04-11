'use client'

import { useState } from 'react'
import { Interruptor } from '@/componentes/ui/Interruptor'
import { Boton } from '@/componentes/ui/Boton'
import { Popover } from '@/componentes/ui/Popover'
import { useTraduccion } from '@/lib/i18n'
import { useToast } from '@/componentes/feedback/Toast'
import { Settings2 } from 'lucide-react'

/**
 * ConfigRecorrido — Popover con permisos del recorrido para un visitador.
 * Se guarda en el campo `config` (jsonb) del recorrido.
 */

export interface ConfigPermisos {
  puede_reordenar: boolean
  puede_cambiar_duracion: boolean
  puede_agregar_paradas: boolean
  puede_quitar_paradas: boolean
  puede_cancelar: boolean
}

const PERMISOS_DEFAULT: ConfigPermisos = {
  puede_reordenar: true,
  puede_cambiar_duracion: true,
  puede_agregar_paradas: false,
  puede_quitar_paradas: false,
  puede_cancelar: false,
}

interface Props {
  recorridoId: string | null
  configActual?: ConfigPermisos | null
  nombreVisitador: string
  onGuardar: (config: ConfigPermisos) => Promise<void>
}

export default function ConfigRecorrido({ recorridoId, configActual, nombreVisitador, onGuardar }: Props) {
  const { t } = useTraduccion()
  const { mostrar } = useToast()
  const [config, setConfig] = useState<ConfigPermisos>(configActual || PERMISOS_DEFAULT)
  const [guardando, setGuardando] = useState(false)

  const togglePermiso = (campo: keyof ConfigPermisos) => {
    setConfig(prev => ({ ...prev, [campo]: !prev[campo] }))
  }

  const guardar = async () => {
    if (!recorridoId) return
    setGuardando(true)
    try {
      await onGuardar(config)
      mostrar('exito', t('visitas.permisos_recorrido'))
    } catch {
      mostrar('error', 'Error al guardar permisos')
    } finally {
      setGuardando(false)
    }
  }

  const permisos: { campo: keyof ConfigPermisos; clave: string }[] = [
    { campo: 'puede_reordenar', clave: 'visitas.puede_reordenar' },
    { campo: 'puede_cambiar_duracion', clave: 'visitas.puede_cambiar_duracion' },
    { campo: 'puede_agregar_paradas', clave: 'visitas.puede_agregar_paradas' },
    { campo: 'puede_quitar_paradas', clave: 'visitas.puede_quitar_paradas' },
    { campo: 'puede_cancelar', clave: 'visitas.puede_cancelar' },
  ]

  const contenido = (
    <div className="p-3 space-y-3">
      <p className="text-[11px] font-medium text-texto-terciario uppercase tracking-wider">
        {t('visitas.permisos_recorrido')}
      </p>
      <p className="text-sm text-texto-secundario">{nombreVisitador}</p>

      <div className="space-y-2">
        {permisos.map(({ campo, clave }) => (
          <div
            key={campo}
            className="flex items-center justify-between rounded-lg border border-white/[0.06] bg-white/[0.03] py-2 px-2.5"
          >
            <span className="text-sm text-texto-primario">{t(clave)}</span>
            <Interruptor
              activo={config[campo]}
              onChange={() => togglePermiso(campo)}
            />
          </div>
        ))}
      </div>

      <Boton
        variante="primario"
        tamano="sm"
        anchoCompleto
        cargando={guardando}
        onClick={guardar}
        disabled={!recorridoId}
      >
        {recorridoId ? t('visitas.aplicar_a_todos') : 'Sin recorrido'}
      </Boton>
    </div>
  )

  return (
    <Popover contenido={contenido} ancho={300}>
      <Boton variante="fantasma" tamano="xs" soloIcono icono={<Settings2 size={14} />} tooltip={t('visitas.permisos_recorrido')} />
    </Popover>
  )
}
