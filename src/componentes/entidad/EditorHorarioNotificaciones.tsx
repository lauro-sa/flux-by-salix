'use client'

/**
 * Editor compartido para el horario laboral de notificaciones.
 *
 * Estructura visual idéntica al editor de turnos laborales: lista vertical de
 * los 7 días con interruptor + selectores de hora "desde / hasta".
 *
 * Lo usan:
 * - Configuración de empresa (default para todos los miembros).
 * - Mi cuenta → notificaciones (override personal opcional).
 */

import { Interruptor } from '@/componentes/ui/Interruptor'
import { SelectorHora } from '@/componentes/ui/SelectorHora'
import type { HorarioNotificaciones, HorarioDia } from '@/lib/notificaciones-horario'

const DIAS_SEMANA: { clave: keyof HorarioNotificaciones['dias']; etiqueta: string }[] = [
  { clave: 'lunes', etiqueta: 'Lunes' },
  { clave: 'martes', etiqueta: 'Martes' },
  { clave: 'miercoles', etiqueta: 'Miércoles' },
  { clave: 'jueves', etiqueta: 'Jueves' },
  { clave: 'viernes', etiqueta: 'Viernes' },
  { clave: 'sabado', etiqueta: 'Sábado' },
  { clave: 'domingo', etiqueta: 'Domingo' },
]

export const HORARIO_DEFAULT: HorarioNotificaciones = {
  activo: true,
  dias: {
    lunes:     { activo: true,  desde: '09:00', hasta: '18:00' },
    martes:    { activo: true,  desde: '09:00', hasta: '18:00' },
    miercoles: { activo: true,  desde: '09:00', hasta: '18:00' },
    jueves:    { activo: true,  desde: '09:00', hasta: '18:00' },
    viernes:   { activo: true,  desde: '09:00', hasta: '18:00' },
    sabado:    { activo: false, desde: '09:00', hasta: '13:00' },
    domingo:   { activo: false, desde: '09:00', hasta: '13:00' },
  },
}

interface Props {
  valor: HorarioNotificaciones
  onChange: (nuevo: HorarioNotificaciones) => void
  deshabilitado?: boolean
}

export function EditorHorarioNotificaciones({ valor, onChange, deshabilitado }: Props) {
  const actualizarActivo = (activo: boolean) => {
    onChange({ ...valor, activo })
  }

  const actualizarDia = (clave: keyof HorarioNotificaciones['dias'], campo: keyof HorarioDia, nuevo: boolean | string) => {
    onChange({
      ...valor,
      dias: { ...valor.dias, [clave]: { ...valor.dias[clave], [campo]: nuevo } },
    })
  }

  return (
    <div className="space-y-3">
      <div className="py-2 px-3 rounded-card border border-white/[0.06] bg-white/[0.03] flex items-center justify-between gap-3">
        <div className="text-sm">
          <div className="text-texto-primario font-medium">Filtrar push fuera de horario laboral</div>
          <div className="text-xs text-texto-terciario mt-0.5">
            Las notificaciones diferidas (vencimientos, recordatorios, asignaciones internas) no suenan fuera de los horarios marcados. Mensajes entrantes de clientes pasan siempre.
          </div>
        </div>
        <Interruptor
          activo={valor.activo}
          onChange={actualizarActivo}
          deshabilitado={deshabilitado}
        />
      </div>

      {valor.activo && (
        <div className="space-y-1.5">
          {DIAS_SEMANA.map(({ clave, etiqueta }) => {
            const dia = valor.dias[clave]
            return (
              <div
                key={clave}
                className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 py-2 px-3 rounded-card border border-white/[0.06] bg-white/[0.03]"
              >
                <div className="w-full sm:w-32 shrink-0">
                  <Interruptor
                    activo={dia.activo}
                    onChange={(v) => actualizarDia(clave, 'activo', v)}
                    etiqueta={etiqueta}
                    deshabilitado={deshabilitado}
                  />
                </div>
                {dia.activo ? (
                  <div className="flex items-center gap-2 text-sm pl-12 sm:pl-0">
                    <div className="w-[120px]">
                      <SelectorHora
                        valor={dia.desde || null}
                        onChange={(v) => actualizarDia(clave, 'desde', v || '09:00')}
                        pasoMinutos={15}
                      />
                    </div>
                    <span className="text-texto-terciario shrink-0">a</span>
                    <div className="w-[120px]">
                      <SelectorHora
                        valor={dia.hasta || null}
                        onChange={(v) => actualizarDia(clave, 'hasta', v || '18:00')}
                        pasoMinutos={15}
                      />
                    </div>
                  </div>
                ) : (
                  <span className="text-xs text-texto-terciario italic pl-12 sm:pl-0">No notificar</span>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
