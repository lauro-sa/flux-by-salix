'use client'

import { useTraduccion } from '@/lib/i18n'
import { DIAS_SEMANA, type CondicionHorario, type DiaSemana } from '@/tipos/workflow'

/**
 * Editor visual de `CondicionHorario` para el branch builder.
 *
 * Controles:
 *   - Toggle modo: dentro / fuera del rango.
 *   - Pills de días de la semana (multi-select).
 *   - Inputs HH:MM para hora_desde y hora_hasta.
 *   - Input de zona horaria IANA (texto libre). Default lee de la
 *     zona local del navegador con `Intl.DateTimeFormat().resolvedOptions().timeZone`.
 *
 * El motor evalúa con `Intl.DateTimeFormat` + zona explícita, así que
 * funciona consistente en el server (UTC) y el client.
 */

interface Props {
  condicion: CondicionHorario
  soloLectura: boolean
  onCambiar: (nueva: CondicionHorario) => void
}

const DIA_LABEL_ES: Record<DiaSemana, string> = {
  lun: 'Lun',
  mar: 'Mar',
  mie: 'Mié',
  jue: 'Jue',
  vie: 'Vie',
  sab: 'Sáb',
  dom: 'Dom',
}

export default function EditorCondicionHorario({ condicion, soloLectura, onCambiar }: Props) {
  const { t: _t } = useTraduccion()

  const cambiarModo = (modo: 'dentro' | 'fuera') => {
    if (soloLectura) return
    onCambiar({ ...condicion, modo })
  }

  const toggleDia = (dia: DiaSemana) => {
    if (soloLectura) return
    const set = new Set(condicion.dias)
    if (set.has(dia)) set.delete(dia)
    else set.add(dia)
    // Mantener orden canónico lunes→domingo.
    const ordenados = DIAS_SEMANA.filter((d) => set.has(d))
    onCambiar({ ...condicion, dias: ordenados })
  }

  const cambiarHora = (campo: 'hora_desde' | 'hora_hasta', valor: string) => {
    if (soloLectura) return
    onCambiar({ ...condicion, [campo]: valor })
  }

  const cambiarZona = (zona: string) => {
    if (soloLectura) return
    onCambiar({ ...condicion, zona_horaria: zona })
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Modo dentro/fuera */}
      <div className="flex flex-col gap-1">
        <span className="text-sm font-medium text-texto-secundario">
          Cuando
        </span>
        <div className="inline-flex rounded-md border border-borde-sutil overflow-hidden self-start">
          <button
            type="button"
            onClick={() => cambiarModo('dentro')}
            disabled={soloLectura}
            className={[
              'px-3 py-1.5 text-xs font-medium transition-colors',
              condicion.modo === 'dentro'
                ? 'bg-texto-marca/15 text-texto-marca'
                : 'text-texto-secundario hover:bg-superficie-hover',
              soloLectura ? 'cursor-not-allowed opacity-70' : 'cursor-pointer',
            ].join(' ')}
          >
            Estamos en el rango
          </button>
          <button
            type="button"
            onClick={() => cambiarModo('fuera')}
            disabled={soloLectura}
            className={[
              'px-3 py-1.5 text-xs font-medium transition-colors border-l border-borde-sutil',
              condicion.modo === 'fuera'
                ? 'bg-texto-marca/15 text-texto-marca'
                : 'text-texto-secundario hover:bg-superficie-hover',
              soloLectura ? 'cursor-not-allowed opacity-70' : 'cursor-pointer',
            ].join(' ')}
          >
            Estamos FUERA del rango
          </button>
        </div>
      </div>

      {/* Días de la semana */}
      <div className="flex flex-col gap-1">
        <span className="text-sm font-medium text-texto-secundario">
          Días que cuentan como "horario"
        </span>
        <div className="flex flex-wrap gap-1.5">
          {DIAS_SEMANA.map((d) => {
            const activo = condicion.dias.includes(d)
            return (
              <button
                key={d}
                type="button"
                onClick={() => toggleDia(d)}
                disabled={soloLectura}
                className={[
                  'h-8 px-3 text-xs font-medium rounded-md border transition-colors',
                  activo
                    ? 'border-texto-marca/40 bg-texto-marca/15 text-texto-marca'
                    : 'border-borde-sutil text-texto-terciario hover:border-borde-fuerte',
                  soloLectura ? 'cursor-not-allowed opacity-70' : 'cursor-pointer',
                ].join(' ')}
              >
                {DIA_LABEL_ES[d]}
              </button>
            )
          })}
        </div>
        {condicion.dias.length === 0 && (
          <span className="text-xs text-insignia-peligro-texto">
            Elegí al menos un día.
          </span>
        )}
      </div>

      {/* Rango horario */}
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1">
          <span className="text-sm font-medium text-texto-secundario">Desde</span>
          <input
            type="time"
            value={condicion.hora_desde}
            onChange={(e) => cambiarHora('hora_desde', e.target.value)}
            disabled={soloLectura}
            className="h-9 px-2 text-sm rounded-md border border-borde-sutil bg-superficie-tarjeta text-texto-primario disabled:cursor-not-allowed disabled:opacity-70"
          />
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-sm font-medium text-texto-secundario">Hasta</span>
          <input
            type="time"
            value={condicion.hora_hasta}
            onChange={(e) => cambiarHora('hora_hasta', e.target.value)}
            disabled={soloLectura}
            className="h-9 px-2 text-sm rounded-md border border-borde-sutil bg-superficie-tarjeta text-texto-primario disabled:cursor-not-allowed disabled:opacity-70"
          />
        </div>
      </div>
      <span className="text-xs text-texto-terciario leading-relaxed">
        Si "Hasta" es menor que "Desde" se interpreta como cruzando medianoche (ej: 22:00–06:00).
      </span>

      {/* Zona horaria */}
      <div className="flex flex-col gap-1">
        <span className="text-sm font-medium text-texto-secundario">
          Zona horaria
        </span>
        <input
          type="text"
          value={condicion.zona_horaria}
          onChange={(e) => cambiarZona(e.target.value)}
          disabled={soloLectura}
          placeholder="America/Argentina/Buenos_Aires"
          className="h-9 px-2.5 text-sm rounded-md border border-borde-sutil bg-superficie-tarjeta text-texto-primario disabled:cursor-not-allowed disabled:opacity-70"
        />
        <span className="text-xs text-texto-terciario leading-relaxed">
          Formato IANA (ej: America/Argentina/Buenos_Aires, Europe/Madrid).
        </span>
      </div>
    </div>
  )
}
