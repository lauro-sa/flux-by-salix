'use client'

import { useMemo, useState } from 'react'
import { Check } from 'lucide-react'
import { Boton } from '@/componentes/ui/Boton'
import { Select } from '@/componentes/ui/Select'
import { SelectorHora } from '@/componentes/ui/SelectorHora'
import { crearClienteNavegador } from '@/lib/supabase/cliente'
import { useTraduccion } from '@/lib/i18n'
import type { Sector, Horario } from './tipos'

interface PropsTabHorarios {
  empresaId: string
  sectores: Sector[]
  horarios: Horario[]
  onCambio: () => void
}

const DIAS_SEMANA = [
  { valor: 0, etiqueta: 'Lunes' },
  { valor: 1, etiqueta: 'Martes' },
  { valor: 2, etiqueta: 'Miércoles' },
  { valor: 3, etiqueta: 'Jueves' },
  { valor: 4, etiqueta: 'Viernes' },
  { valor: 5, etiqueta: 'Sábado' },
  { valor: 6, etiqueta: 'Domingo' },
]

function calcularHoras(inicio: string, fin: string): string {
  const [hi, mi] = inicio.split(':').map(Number)
  const [hf, mf] = fin.split(':').map(Number)
  const minutos = (hf * 60 + mf) - (hi * 60 + mi)
  return minutos > 0 ? (minutos / 60).toFixed(1) : '0'
}

export function TabHorarios({ empresaId, sectores, horarios, onCambio }: PropsTabHorarios) {
  const { t } = useTraduccion()
  const supabase = crearClienteNavegador()
  const [horarioSectorId, setHorarioSectorId] = useState<string | null>(null)

  const horariosDelSector = useMemo(() => {
    return horarios.filter(h =>
      horarioSectorId ? h.sector_id === horarioSectorId : h.sector_id === null,
    )
  }, [horarios, horarioSectorId])

  const guardarHorario = async (diaSemana: number, datos: { activo: boolean; hora_inicio: string; hora_fin: string }) => {
    const existente = horariosDelSector.find(h => h.dia_semana === diaSemana)

    if (existente) {
      await supabase.from('horarios').update({
        activo: datos.activo,
        hora_inicio: datos.hora_inicio,
        hora_fin: datos.hora_fin,
      }).eq('id', existente.id)
    } else {
      await supabase.from('horarios').insert({
        empresa_id: empresaId,
        sector_id: horarioSectorId,
        dia_semana: diaSemana,
        activo: datos.activo,
        hora_inicio: datos.hora_inicio,
        hora_fin: datos.hora_fin,
      })
    }

    onCambio()
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Select
          etiqueta={t('configuracion.estructura.horario_de')}
          opciones={[
            { valor: '__general__', etiqueta: 'General (toda la empresa)' },
            ...sectores.map(s => ({ valor: s.id, etiqueta: s.nombre })),
          ]}
          valor={horarioSectorId || '__general__'}
          onChange={(v) => setHorarioSectorId(v === '__general__' ? null : v)}
        />
      </div>

      <p className="text-xs text-texto-terciario">
        {horarioSectorId
          ? 'Este horario aplica solo a este sector. Si no se define, hereda el horario general.'
          : 'Este es el horario por defecto para toda la empresa. Cada sector puede tener uno propio.'}
      </p>

      <div className="bg-superficie-tarjeta border border-borde-sutil rounded-card overflow-hidden">
        <div className="px-4 py-3 border-b border-borde-sutil">
          <h3 className="text-sm font-semibold text-texto-primario">
            {horarioSectorId ? `Horario — ${sectores.find(s => s.id === horarioSectorId)?.nombre}` : 'Horario general'}
          </h3>
        </div>

        <div className="divide-y divide-borde-sutil">
          {DIAS_SEMANA.map(dia => {
            const horario = horariosDelSector.find(h => h.dia_semana === dia.valor)
            const activo = horario?.activo ?? (dia.valor <= 4)
            const inicio = horario?.hora_inicio || '09:00'
            const fin = horario?.hora_fin || '18:00'

            return (
              <div key={dia.valor} className={`flex items-center gap-4 px-4 py-3 ${!activo ? 'opacity-40' : ''}`}>
                <Boton
                  variante="fantasma"
                  tamano="xs"
                  soloIcono
                  titulo={activo ? 'Desactivar día' : 'Activar día'}
                  onClick={() => guardarHorario(dia.valor, { activo: !activo, hora_inicio: inicio, hora_fin: fin })}
                  icono={activo ? <Check size={12} className="text-white" /> : undefined}
                  className={`!w-5 !h-5 !rounded !border-2 ${
                    activo ? '!bg-texto-marca !border-texto-marca' : '!bg-transparent !border-borde-fuerte'
                  }`}
                />

                <span className="text-sm font-medium text-texto-primario w-24">{dia.etiqueta}</span>

                {activo ? (
                  <div className="flex items-center gap-2 flex-1">
                    <SelectorHora
                      valor={inicio}
                      onChange={(v) => guardarHorario(dia.valor, { activo, hora_inicio: v || '09:00', hora_fin: fin })}
                    />
                    <span className="text-xs text-texto-terciario">a</span>
                    <SelectorHora
                      valor={fin}
                      onChange={(v) => guardarHorario(dia.valor, { activo, hora_inicio: inicio, hora_fin: v || '18:00' })}
                    />
                    <span className="text-xs text-texto-terciario ml-2">
                      {calcularHoras(inicio, fin)}h
                    </span>
                  </div>
                ) : (
                  <span className="text-xs text-texto-terciario italic">No laboral</span>
                )}
              </div>
            )
          })}
        </div>

        <div className="px-4 py-3 bg-superficie-hover/30 border-t border-borde-sutil">
          <p className="text-xs text-texto-terciario">
            Los colaboradores con <strong>horario flexible</strong> habilitado en su perfil no están sujetos a estos horarios para el fichaje, pero siguen contando como horas trabajadas.
          </p>
        </div>
      </div>
    </div>
  )
}
