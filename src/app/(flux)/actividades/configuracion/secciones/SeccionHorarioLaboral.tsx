'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { Info, Sparkles } from 'lucide-react'
import { Interruptor } from '@/componentes/ui/Interruptor'
import { Boton } from '@/componentes/ui/Boton'
import { ModalConfirmacion } from '@/componentes/ui/ModalConfirmacion'
import { CargadorSeccion } from '@/componentes/ui/Cargador'

/**
 * SeccionHorarioLaboral — Respetar días hábiles en vencimientos y posposiciones.
 * Toggle para activar/desactivar + botón para ajustar actividades existentes.
 */

interface PropiedadesSeccion {
  config: { respetar_dias_laborales?: boolean } | null
  cargando: boolean
  onAccionAPI: (accion: string, datos: Record<string, unknown>) => Promise<unknown>
}

function SeccionHorarioLaboral({ config, cargando, onAccionAPI }: PropiedadesSeccion) {
  const [respetarDias, setRespetarDias] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [confirmarAjustar, setConfirmarAjustar] = useState(false)
  const [ajustando, setAjustando] = useState(false)

  useEffect(() => {
    if (config?.respetar_dias_laborales !== undefined) {
      setRespetarDias(config.respetar_dias_laborales)
    }
  }, [config])

  const toggleRespetar = useCallback(async (valor: boolean) => {
    setRespetarDias(valor)
    setGuardando(true)
    try {
      await onAccionAPI('actualizar_config', { respetar_dias_laborales: valor })
    } finally {
      setGuardando(false)
    }
  }, [onAccionAPI])

  // Fase futura: ajustar fechas de actividades existentes al cambiar horario laboral
  const ajustarExistentes = async () => {
    setAjustando(true)
    try {
      // Por ahora solo cierra el modal — la lógica de mover actividades
      // al próximo día hábil se implementa cuando tengamos el calendario de feriados
      setConfirmarAjustar(false)
    } finally {
      setAjustando(false)
    }
  }

  if (cargando) return <CargadorSeccion />

  return (
    <div className="space-y-4">
      <div className="bg-superficie-tarjeta border border-borde-sutil rounded-card p-5">
        <h3 className="text-base font-semibold text-texto-primario">Horario laboral</h3>
        <p className="text-base text-texto-terciario mt-0.5 mb-5">
          Respetar el horario de atención de la empresa al calcular fechas de vencimiento y posposición.
        </p>

        {/* Toggle principal */}
        <div className="flex items-center justify-between py-3 border-b border-borde-sutil">
          <div>
            <p className="text-sm font-medium text-texto-primario">Respetar días laborales</p>
            <p className="text-xs text-texto-terciario mt-0.5">
              Los vencimientos y posposiciones solo caerán en días hábiles (según horario de atención y feriados del país).
            </p>
          </div>
          <Interruptor activo={respetarDias} onChange={toggleRespetar} />
        </div>

        {/* Info box */}
        {respetarDias && (
          <div className="mt-4 p-4 rounded-card bg-superficie-hover/50 border border-borde-sutil">
            <div className="flex gap-3">
              <Info size={16} className="text-texto-terciario shrink-0 mt-0.5" />
              <div className="text-xs text-texto-secundario space-y-1.5">
                <p>Los vencimientos por defecto y las posposiciones saltarán fines de semana no laborales y feriados nacionales.</p>
                <p>Las actividades sin hora se mostrarán en el calendario abarcando el horario laboral del día.</p>
                <p>Configurá el horario de atención y el país de feriados en <Link href="/configuracion" className="text-texto-marca font-semibold hover:underline">Empresa</Link>.</p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Ajustar actividades existentes — Salix IA */}
      {respetarDias && (
        <div className="bg-superficie-tarjeta border border-borde-sutil rounded-card p-5">
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <h4 className="text-sm font-semibold text-texto-primario">Ajustar actividades existentes</h4>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xxs font-semibold bg-texto-marca/10 text-texto-marca">
                  <Sparkles size={10} />
                  Salix IA
                </span>
              </div>
              <p className="text-xs text-texto-terciario">
                Mover las actividades pendientes que caen en días no laborales al próximo día hábil.
              </p>
            </div>
            <Boton
              variante="primario"
              tamano="sm"
              icono={<Sparkles size={14} />}
              onClick={() => setConfirmarAjustar(true)}
            >
              Ajustar
            </Boton>
          </div>
        </div>
      )}

      <ModalConfirmacion
        abierto={confirmarAjustar}
        titulo="Ajustar actividades existentes"
        descripcion="Se moverán todas las actividades pendientes que caen en fines de semana o feriados al próximo día hábil. Esta acción no se puede deshacer."
        etiquetaConfirmar="Ajustar"
        tipo="advertencia"
        cargando={ajustando}
        onConfirmar={ajustarExistentes}
        onCerrar={() => setConfirmarAjustar(false)}
      />
    </div>
  )
}

export { SeccionHorarioLaboral }
