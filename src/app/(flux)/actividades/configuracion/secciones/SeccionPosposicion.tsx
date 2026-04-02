'use client'

import { useState, useEffect, useCallback } from 'react'
import { Plus, Trash2, Clock, RotateCcw } from 'lucide-react'
import { Boton } from '@/componentes/ui/Boton'
import { Input } from '@/componentes/ui/Input'
import { ModalConfirmacion } from '@/componentes/ui/ModalConfirmacion'
import { CargadorSeccion } from '@/componentes/ui/Cargador'

/**
 * SeccionPosposicion — Configurar los presets de posposición.
 * Define los intervalos disponibles en la acción rápida de posponer (1 día, 3 días, etc.)
 */

interface PresetPosposicion {
  id: string
  etiqueta: string
  dias: number
}

interface PropiedadesSeccion {
  config: { presets_posposicion: PresetPosposicion[] } | null
  cargando: boolean
  onAccionAPI: (accion: string, datos: Record<string, unknown>) => Promise<unknown>
}

const PRESETS_DEFAULT: PresetPosposicion[] = [
  { id: '1d', etiqueta: '1 día', dias: 1 },
  { id: '3d', etiqueta: '3 días', dias: 3 },
  { id: '1s', etiqueta: '1 semana', dias: 7 },
  { id: '2s', etiqueta: '2 semanas', dias: 14 },
]

function SeccionPosposicion({ config, cargando, onAccionAPI }: PropiedadesSeccion) {
  const [presets, setPresets] = useState<PresetPosposicion[]>(PRESETS_DEFAULT)
  const [guardando, setGuardando] = useState(false)
  const [confirmarRestablecer, setConfirmarRestablecer] = useState(false)

  // Sincronizar con config
  useEffect(() => {
    if (config?.presets_posposicion) {
      setPresets(config.presets_posposicion)
    }
  }, [config])

  // Guardar en servidor
  const guardar = useCallback(async (nuevos: PresetPosposicion[]) => {
    setPresets(nuevos)
    setGuardando(true)
    try {
      await onAccionAPI('actualizar_config', { presets_posposicion: nuevos })
    } finally {
      setGuardando(false)
    }
  }, [onAccionAPI])

  const agregar = () => {
    const nuevoDias = Math.max(...presets.map(p => p.dias), 0) + 7
    const nuevo: PresetPosposicion = {
      id: crypto.randomUUID(),
      etiqueta: `${nuevoDias} días`,
      dias: nuevoDias,
    }
    guardar([...presets, nuevo])
  }

  const actualizar = (id: string, dias: number) => {
    const etiqueta = dias === 1 ? '1 día' : dias < 7 ? `${dias} días` : dias === 7 ? '1 semana' : dias === 14 ? '2 semanas' : `${dias} días`
    guardar(presets.map(p => p.id === id ? { ...p, dias, etiqueta } : p))
  }

  const eliminar = (id: string) => {
    guardar(presets.filter(p => p.id !== id))
  }

  const restablecer = async () => {
    await guardar(PRESETS_DEFAULT)
    setConfirmarRestablecer(false)
  }

  if (cargando) return <CargadorSeccion />

  return (
    <div className="space-y-4">
      <div className="bg-superficie-tarjeta border border-borde-sutil rounded-xl overflow-hidden">
        <div className="flex items-start justify-between p-5 pb-3">
          <div>
            <h3 className="text-base font-semibold text-texto-primario">Opciones de posposición</h3>
            <p className="text-sm text-texto-terciario mt-0.5">
              Define los intervalos disponibles en la acción rápida de posponer.
            </p>
          </div>
          <Boton
            variante="fantasma"
            tamano="sm"
            icono={<Plus size={14} />}
            onClick={agregar}
          >
            Agregar
          </Boton>
        </div>

        <div className="divide-y divide-borde-sutil">
          {presets.map(preset => (
            <div key={preset.id} className="flex items-center gap-4 px-5 py-3.5">
              <Clock size={16} className="text-texto-terciario shrink-0" />
              <Input
                tipo="number"
                min={1}
                max={365}
                value={preset.dias}
                onChange={(e) => {
                  const v = parseInt(e.target.value)
                  if (v > 0) actualizar(preset.id, v)
                }}
                formato={null}
                compacto
                className="flex-1 text-center font-medium"
              />
              <span className="text-sm text-texto-terciario shrink-0">días →</span>
              <span className="text-xs text-texto-terciario w-16 text-center shrink-0 bg-superficie-hover rounded-md px-2 py-1.5">
                {preset.dias < 7 ? `${preset.dias}d` : preset.dias === 7 ? '1 sem' : preset.dias === 14 ? '2 sem' : `${Math.round(preset.dias / 7)}sem`}
              </span>
              <Boton
                variante="fantasma"
                tamano="xs"
                soloIcono
                titulo="Eliminar"
                icono={<Trash2 size={15} />}
                onClick={() => eliminar(preset.id)}
                className="shrink-0 hover:text-insignia-peligro-texto"
              />
            </div>
          ))}

          {presets.length === 0 && (
            <p className="text-sm text-texto-terciario text-center py-6">Sin opciones de posposición</p>
          )}
        </div>

        {/* Footer: restablecer */}
        <div className="flex justify-end px-5 py-3 border-t border-borde-sutil bg-superficie-hover/30">
          <Boton variante="fantasma" tamano="xs" icono={<RotateCcw size={13} />} onClick={() => setConfirmarRestablecer(true)}>
            Restablecer
          </Boton>
        </div>
      </div>

      <ModalConfirmacion
        abierto={confirmarRestablecer}
        titulo="Restablecer posposición"
        descripcion="Se restablecerán los intervalos a los valores por defecto (1 día, 3 días, 1 semana, 2 semanas)."
        etiquetaConfirmar="Restablecer"
        tipo="peligro"
        cargando={guardando}
        onConfirmar={restablecer}
        onCerrar={() => setConfirmarRestablecer(false)}
      />
    </div>
  )
}

export { SeccionPosposicion }
