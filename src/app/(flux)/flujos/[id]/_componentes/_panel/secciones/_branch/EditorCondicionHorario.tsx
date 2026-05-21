'use client'

import { Plus, Trash2 } from 'lucide-react'
import { useTraduccion } from '@/lib/i18n'
import { SelectorHora } from '@/componentes/ui/SelectorHora'
import {
  DIAS_SEMANA,
  type CondicionCompuesta,
  type CondicionHorario,
  type DiaSemana,
} from '@/tipos/workflow'

/**
 * Editor visual de uno o varios `CondicionHorario` en el branch builder.
 *
 * Cada rango es independiente:
 *   - Su propio modo `dentro` / `fuera` (definido por rango, no global).
 *   - Sus propios días.
 *   - Toggle "Todo el día" que oculta hora_desde/hora_hasta y manda al
 *     motor a usar `todo_el_dia: true` (matchea cuando el día está
 *     marcado sin importar la hora).
 *
 * Shape interno:
 *   • 1 rango → `CondicionHorario` directo (compat backwards).
 *   • 2+ rangos → `CondicionCompuesta` con `operador: 'o'` y
 *     `condiciones: CondicionHorario[]`. OR siempre (validado
 *     matemáticamente que cubre los 4 casos modo×días).
 *
 * Zona horaria es global porque es propiedad de la empresa, no del
 * rango. Se replica en cada CondicionHorario para que el motor pueda
 * evaluar cada uno por separado.
 */

interface Props {
  condicion: CondicionHorario | CondicionCompuesta
  soloLectura: boolean
  onCambiar: (nueva: CondicionHorario | CondicionCompuesta) => void
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

/**
 * Convierte la condición externa a un array de rangos. Para
 * `CondicionHorario` retorna `[c]`; para compuesta extrae las
 * sub-condiciones que sean horarios (las que no, las ignora —
 * defensivo).
 */
function leerRangos(c: CondicionHorario | CondicionCompuesta): CondicionHorario[] {
  if ((c as { tipo?: string }).tipo === 'horario') {
    return [c as CondicionHorario]
  }
  const compuesta = c as CondicionCompuesta
  return (compuesta.condiciones ?? []).filter(
    (sub): sub is CondicionHorario =>
      typeof sub === 'object' &&
      sub !== null &&
      (sub as { tipo?: unknown }).tipo === 'horario',
  )
}

/**
 * Reconstruye el shape correcto desde el array de rangos:
 *   - 1 rango → `CondicionHorario` directo.
 *   - 2+ rangos → `CondicionCompuesta` con OR.
 *   - 0 rangos → fallback a 1 rango vacío.
 */
function escribirRangos(
  rangos: CondicionHorario[],
): CondicionHorario | CondicionCompuesta {
  if (rangos.length <= 1) {
    return rangos[0] ?? rangoVacio()
  }
  return { operador: 'o', condiciones: rangos }
}

function rangoVacio(): CondicionHorario {
  const zona = typeof Intl !== 'undefined'
    ? new Intl.DateTimeFormat().resolvedOptions().timeZone
    : 'America/Argentina/Buenos_Aires'
  return {
    tipo: 'horario',
    modo: 'fuera',
    zona_horaria: zona || 'America/Argentina/Buenos_Aires',
    dias: ['lun', 'mar', 'mie', 'jue', 'vie'],
    hora_desde: '09:00',
    hora_hasta: '18:00',
  }
}

export default function EditorCondicionHorario({
  condicion,
  soloLectura,
  onCambiar,
}: Props) {
  const { t: _t } = useTraduccion()
  const rangos = leerRangos(condicion)

  // Zona horaria global — la guardamos en cada rango (el motor evalúa
  // cada uno aislado), pero el usuario edita un solo input.
  const zonaGlobal = rangos[0]?.zona_horaria ?? 'America/Argentina/Buenos_Aires'

  const cambiarZona = (zona: string) => {
    if (soloLectura) return
    const nuevos = rangos.map((r) => ({ ...r, zona_horaria: zona }))
    onCambiar(escribirRangos(nuevos))
  }

  const actualizarRango = (idx: number, parche: Partial<CondicionHorario>) => {
    if (soloLectura) return
    const nuevos = rangos.map((x, i) => (i === idx ? { ...x, ...parche } : x))
    onCambiar(escribirRangos(nuevos))
  }

  const toggleDia = (idx: number, dia: DiaSemana) => {
    if (soloLectura) return
    const r = rangos[idx]
    if (!r) return
    const set = new Set(r.dias)
    if (set.has(dia)) set.delete(dia)
    else set.add(dia)
    const dias = DIAS_SEMANA.filter((d) => set.has(d))
    actualizarRango(idx, { dias })
  }

  const agregarRango = () => {
    if (soloLectura) return
    // Heredamos zona del primer rango.
    const base = rangoVacio()
    const nuevo: CondicionHorario = {
      ...base,
      zona_horaria: zonaGlobal,
      // Sugerencia inteligente: si Lun-Vie ya están cubiertos pero
      // Sáb/Dom no, sugerimos Sáb-Dom (caso de uso más común).
      dias: sugerirDiasParaRangoAdicional(rangos),
    }
    onCambiar(escribirRangos([...rangos, nuevo]))
  }

  const eliminarRango = (idx: number) => {
    if (soloLectura || rangos.length <= 1) return
    const nuevos = rangos.filter((_, i) => i !== idx)
    onCambiar(escribirRangos(nuevos))
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Rangos — cada uno independiente con su propio modo y horas. */}
      <div className="flex flex-col gap-3">
        {rangos.map((r, idx) => (
          <RangoHorario
            key={idx}
            rango={r}
            idx={idx}
            soloLectura={soloLectura}
            mostrarEliminar={rangos.length > 1}
            onCambiar={(parche) => actualizarRango(idx, parche)}
            onToggleDia={(d) => toggleDia(idx, d)}
            onEliminar={() => eliminarRango(idx)}
          />
        ))}
      </div>

      {!soloLectura && (
        <button
          type="button"
          onClick={agregarRango}
          className="self-start inline-flex items-center gap-1.5 h-8 px-2.5 text-sm font-medium rounded-md text-texto-marca hover:bg-texto-marca/10 transition-colors cursor-pointer"
        >
          <Plus size={14} strokeWidth={1.8} />
          Agregar otro rango
        </button>
      )}

      {/* Ayuda contextual sobre el OR implícito entre rangos. */}
      {rangos.length >= 2 && (
        <p className="text-xs text-texto-terciario leading-relaxed">
          El flujo va a la rama "Sí" cuando se cumpla cualquiera de los rangos.
        </p>
      )}

      {/* Zona horaria global */}
      <div className="flex flex-col gap-1">
        <span className="text-sm font-medium text-texto-secundario">
          Zona horaria
        </span>
        <input
          type="text"
          value={zonaGlobal}
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

/**
 * Heurística para los días del rango nuevo: si en los rangos previos
 * todos los días Lun-Vie ya están cubiertos pero Sáb/Dom no, sugerimos
 * Sáb-Dom (caso de uso más común: horario diferenciado de fin de
 * semana). Si no, sugerimos Lun-Vie estándar.
 */
function sugerirDiasParaRangoAdicional(previos: CondicionHorario[]): DiaSemana[] {
  const cubiertos = new Set<DiaSemana>()
  for (const r of previos) for (const d of r.dias) cubiertos.add(d)
  const laboralesCubiertos = (['lun', 'mar', 'mie', 'jue', 'vie'] as DiaSemana[]).every(
    (d) => cubiertos.has(d),
  )
  const finSemanaCubierto = (['sab', 'dom'] as DiaSemana[]).every((d) => cubiertos.has(d))
  if (laboralesCubiertos && !finSemanaCubierto) return ['sab', 'dom']
  return ['lun', 'mar', 'mie', 'jue', 'vie']
}

// =============================================================
// Sub-componente: una tarjeta de rango (auto-contenida)
// =============================================================

interface PropsRango {
  rango: CondicionHorario
  idx: number
  soloLectura: boolean
  mostrarEliminar: boolean
  onCambiar: (parche: Partial<CondicionHorario>) => void
  onToggleDia: (dia: DiaSemana) => void
  onEliminar: () => void
}

function RangoHorario({
  rango,
  idx,
  soloLectura,
  mostrarEliminar,
  onCambiar,
  onToggleDia,
  onEliminar,
}: PropsRango) {
  const esTodoElDia = rango.todo_el_dia === true

  return (
    <div className="rounded-md border border-borde-sutil bg-superficie-tarjeta/40 p-3 flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] font-semibold tracking-wider uppercase text-texto-terciario">
          Rango {idx + 1}
        </span>
        {mostrarEliminar && !soloLectura && (
          <button
            type="button"
            onClick={onEliminar}
            aria-label="Eliminar rango"
            className="shrink-0 inline-flex items-center justify-center size-7 rounded-md text-texto-terciario hover:bg-insignia-peligro-fondo/50 hover:text-insignia-peligro-texto transition-colors cursor-pointer"
          >
            <Trash2 size={13} strokeWidth={1.8} />
          </button>
        )}
      </div>

      {/* Modo del rango (oculto cuando es "todo el día" porque
          semánticamente no aplica). */}
      {!esTodoElDia && (
        <div className="flex items-center flex-wrap gap-1.5 text-sm text-texto-secundario">
          <span className="shrink-0">Matchea cuando estamos</span>
          <div className="inline-flex rounded-md border border-borde-sutil overflow-hidden">
            <button
              type="button"
              onClick={() => onCambiar({ modo: 'dentro' })}
              disabled={soloLectura}
              className={[
                'px-2.5 py-0.5 text-xs font-medium transition-colors',
                rango.modo === 'dentro'
                  ? 'bg-texto-marca/15 text-texto-marca'
                  : 'text-texto-secundario hover:bg-superficie-hover',
                soloLectura ? 'cursor-not-allowed opacity-70' : 'cursor-pointer',
              ].join(' ')}
            >
              dentro
            </button>
            <button
              type="button"
              onClick={() => onCambiar({ modo: 'fuera' })}
              disabled={soloLectura}
              className={[
                'px-2.5 py-0.5 text-xs font-medium transition-colors border-l border-borde-sutil',
                rango.modo === 'fuera'
                  ? 'bg-texto-marca/15 text-texto-marca'
                  : 'text-texto-secundario hover:bg-superficie-hover',
                soloLectura ? 'cursor-not-allowed opacity-70' : 'cursor-pointer',
              ].join(' ')}
            >
              fuera
            </button>
          </div>
          <span className="shrink-0">del horario</span>
        </div>
      )}

      {/* Días */}
      <div className="flex flex-col gap-1">
        <span className="text-xs font-medium text-texto-secundario">Días</span>
        <div className="flex flex-wrap gap-1.5">
          {DIAS_SEMANA.map((d) => {
            const activo = rango.dias.includes(d)
            return (
              <button
                key={d}
                type="button"
                onClick={() => onToggleDia(d)}
                disabled={soloLectura}
                className={[
                  'h-7 px-2.5 text-xs font-medium rounded-md border transition-colors',
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
        {rango.dias.length === 0 && (
          <span className="text-xs text-insignia-peligro-texto">
            Elegí al menos un día para este rango.
          </span>
        )}
      </div>

      {/* Toggle "todo el día" — cuando está activo, oculta las horas
          y el motor matchea siempre que el día esté marcado. */}
      <label className="flex items-center gap-2 text-sm text-texto-secundario cursor-pointer select-none">
        <input
          type="checkbox"
          checked={esTodoElDia}
          onChange={(e) => onCambiar({ todo_el_dia: e.target.checked })}
          disabled={soloLectura}
          className="size-4 rounded border-borde-fuerte bg-superficie-tarjeta text-texto-marca cursor-pointer disabled:cursor-not-allowed"
        />
        Todo el día
      </label>

      {/* Horario — oculto cuando es "todo el día" */}
      {!esTodoElDia && (
        <div className="grid grid-cols-2 gap-3">
          <SelectorHora
            etiqueta="Desde"
            valor={rango.hora_desde}
            onChange={(v) => onCambiar({ hora_desde: v ?? rango.hora_desde })}
            disabled={soloLectura}
          />
          <SelectorHora
            etiqueta="Hasta"
            valor={rango.hora_hasta}
            onChange={(v) => onCambiar({ hora_hasta: v ?? rango.hora_hasta })}
            disabled={soloLectura}
          />
        </div>
      )}
    </div>
  )
}
