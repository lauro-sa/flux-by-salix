'use client'

import { useState, useEffect, useCallback } from 'react'
import { Interruptor } from '@/componentes/ui/Interruptor'
import { SelectorHora } from '@/componentes/ui/SelectorHora'
import { CargadorSeccion } from '@/componentes/ui/Cargador'

/**
 * SeccionHorarioCalendario — Configuración del horario laboral visible en el calendario.
 * Incluye: hora inicio/fin, días laborales, intervalo de slots, mostrar fines de semana.
 * Autoguardado al cambiar cualquier valor.
 */

// Nombres de días en español, indexados 1-7 (lunes a domingo)
const DIAS_SEMANA = [
  { valor: 1, etiqueta: 'Lun' },
  { valor: 2, etiqueta: 'Mar' },
  { valor: 3, etiqueta: 'Mié' },
  { valor: 4, etiqueta: 'Jue' },
  { valor: 5, etiqueta: 'Vie' },
  { valor: 6, etiqueta: 'Sáb' },
  { valor: 7, etiqueta: 'Dom' },
]

const INTERVALOS_SLOT = [
  { valor: 15, etiqueta: '15 minutos' },
  { valor: 30, etiqueta: '30 minutos' },
  { valor: 60, etiqueta: '60 minutos' },
]

interface PropiedadesSeccionHorario {
  config: {
    hora_inicio_laboral?: string
    hora_fin_laboral?: string
    dias_laborales?: number[]
    intervalo_slot?: number
    mostrar_fines_semana?: boolean
  } | null
  cargando: boolean
  onAccionAPI: (accion: string, datos: Record<string, unknown>) => Promise<unknown>
}

function SeccionHorarioCalendario({ config, cargando, onAccionAPI }: PropiedadesSeccionHorario) {
  const [horaInicio, setHoraInicio] = useState('08:00')
  const [horaFin, setHoraFin] = useState('18:00')
  const [diasLaborales, setDiasLaborales] = useState<number[]>([1, 2, 3, 4, 5])
  const [intervaloSlot, setIntervaloSlot] = useState(30)
  const [mostrarFinesSemana, setMostrarFinesSemana] = useState(true)
  const [guardando, setGuardando] = useState(false)

  // Sincronizar con config recibida
  useEffect(() => {
    if (!config) return
    if (config.hora_inicio_laboral) setHoraInicio(config.hora_inicio_laboral)
    if (config.hora_fin_laboral) setHoraFin(config.hora_fin_laboral)
    if (config.dias_laborales) setDiasLaborales(config.dias_laborales)
    if (config.intervalo_slot) setIntervaloSlot(config.intervalo_slot)
    if (config.mostrar_fines_semana !== undefined) setMostrarFinesSemana(config.mostrar_fines_semana)
  }, [config])

  // Autoguardado: envía la actualización al backend
  const guardar = useCallback(async (datos: Record<string, unknown>) => {
    setGuardando(true)
    try {
      await onAccionAPI('actualizar_config', datos)
    } finally {
      setGuardando(false)
    }
  }, [onAccionAPI])

  // Handlers con autoguardado
  const cambiarHoraInicio = (valor: string) => {
    setHoraInicio(valor)
    guardar({ hora_inicio_laboral: valor })
  }

  const cambiarHoraFin = (valor: string) => {
    setHoraFin(valor)
    guardar({ hora_fin_laboral: valor })
  }

  const toggleDia = (dia: number) => {
    const nuevos = diasLaborales.includes(dia)
      ? diasLaborales.filter(d => d !== dia)
      : [...diasLaborales, dia].sort()
    setDiasLaborales(nuevos)
    guardar({ dias_laborales: nuevos })
  }

  const cambiarIntervalo = (valor: number) => {
    setIntervaloSlot(valor)
    guardar({ intervalo_slot: valor })
  }

  const toggleFinesSemana = (valor: boolean) => {
    setMostrarFinesSemana(valor)
    guardar({ mostrar_fines_semana: valor })
  }

  if (cargando) return <CargadorSeccion />

  return (
    <div className="space-y-4">
      <div className="bg-superficie-tarjeta border border-borde-sutil rounded-xl p-5">
        <h3 className="text-base font-semibold text-texto-primario">Horario laboral</h3>
        <p className="text-sm text-texto-terciario mt-0.5 mb-5">
          Define el horario visible en el calendario y los días laborales de tu equipo.
        </p>

        {/* Hora de inicio y fin */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-5">
          <SelectorHora
            etiqueta="Hora de inicio"
            valor={horaInicio}
            onChange={(v) => cambiarHoraInicio(v || '08:00')}
          />
          <SelectorHora
            etiqueta="Hora de fin"
            valor={horaFin}
            onChange={(v) => cambiarHoraFin(v || '18:00')}
          />
        </div>

        {/* Días laborales */}
        <div className="mb-5">
          <label className="text-sm font-medium text-texto-secundario block mb-2">Días laborales</label>
          <div className="flex flex-wrap gap-2">
            {DIAS_SEMANA.map(dia => {
              const activo = diasLaborales.includes(dia.valor)
              return (
                <button
                  key={dia.valor}
                  onClick={() => toggleDia(dia.valor)}
                  className={`px-3.5 py-2 rounded-lg text-sm font-medium transition-all duration-150 cursor-pointer border ${
                    activo
                      ? 'bg-texto-marca text-white border-texto-marca'
                      : 'bg-superficie-tarjeta text-texto-secundario border-borde-sutil hover:bg-superficie-hover'
                  }`}
                >
                  {dia.etiqueta}
                </button>
              )
            })}
          </div>
        </div>

        {/* Intervalo de slots */}
        <div className="mb-5">
          <label className="text-sm font-medium text-texto-secundario block mb-2">Intervalo de slots</label>
          <div className="flex rounded-lg border border-borde-fuerte overflow-hidden w-fit">
            {INTERVALOS_SLOT.map(slot => (
              <button
                key={slot.valor}
                onClick={() => cambiarIntervalo(slot.valor)}
                className={`px-4 py-2 text-sm font-medium transition-colors cursor-pointer border-none ${
                  intervaloSlot === slot.valor
                    ? 'bg-texto-marca text-white'
                    : 'bg-superficie-tarjeta text-texto-secundario hover:bg-superficie-hover'
                }`}
              >
                {slot.etiqueta}
              </button>
            ))}
          </div>
          <p className="text-xs text-texto-terciario mt-1.5">
            Las filas del calendario se dividirán en intervalos de {intervaloSlot} minutos.
          </p>
        </div>

        {/* Mostrar fines de semana */}
        <div className="flex items-center justify-between py-3 border-t border-borde-sutil">
          <div>
            <p className="text-sm font-medium text-texto-primario">Mostrar fines de semana</p>
            <p className="text-xs text-texto-terciario mt-0.5">
              Muestra sábado y domingo en las vistas de semana y mes del calendario.
            </p>
          </div>
          <Interruptor activo={mostrarFinesSemana} onChange={toggleFinesSemana} />
        </div>
      </div>

      {/* Indicador de guardado */}
      {guardando && (
        <p className="text-xs text-texto-terciario text-right animate-pulse">Guardando...</p>
      )}
    </div>
  )
}

export { SeccionHorarioCalendario }
