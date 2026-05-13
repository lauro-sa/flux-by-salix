/**
 * Gate de horario para notificaciones diferidas.
 *
 * Las notificaciones de eventos diferidos (actividad vencida, recordatorios,
 * cumpleaños, SLA, calendario, asignaciones internas) consultan este helper
 * antes de enviar push. Si el usuario está fuera de su horario configurado,
 * la notificación in-app se crea igual pero el push se omite.
 *
 * Comunicación entrante de clientes (webhook WhatsApp, correo entrante) pasa
 * el flag `esTiempoReal: true` aguas arriba y nunca consulta este helper.
 */

import { obtenerComponentesFecha } from '@/lib/formato-fecha'

export interface HorarioDia {
  activo: boolean
  desde: string // 'HH:MM'
  hasta: string // 'HH:MM'
}

export interface HorarioNotificaciones {
  activo: boolean
  dias: {
    domingo: HorarioDia
    lunes: HorarioDia
    martes: HorarioDia
    miercoles: HorarioDia
    jueves: HorarioDia
    viernes: HorarioDia
    sabado: HorarioDia
  }
}

const CLAVES_DIA: Record<number, keyof HorarioNotificaciones['dias']> = {
  0: 'domingo',
  1: 'lunes',
  2: 'martes',
  3: 'miercoles',
  4: 'jueves',
  5: 'viernes',
  6: 'sabado',
}

/**
 * Verifica si una hora "HH:MM" cae dentro del rango [desde, hasta).
 * Comparación lexicográfica válida porque ambos son zero-padded.
 * Soporta rangos invertidos (turnos nocturnos: desde 22:00 hasta 06:00).
 */
export function horaEnRango(ahora: string, desde: string, hasta: string): boolean {
  if (desde === hasta) return true
  if (desde < hasta) return ahora >= desde && ahora < hasta
  return ahora >= desde || ahora < hasta
}

/**
 * Determina si el horario configurado permite notificar en el instante dado.
 * Si `horario.activo === false`, devuelve true (filtro deshabilitado).
 */
export function permiteNotificar(
  horario: HorarioNotificaciones | null | undefined,
  zonaHoraria: string,
  ahora: Date = new Date(),
): boolean {
  if (!horario || horario.activo === false) return true

  const { diaSemana, hora, minuto } = obtenerComponentesFecha(ahora, zonaHoraria)
  const claveDia = CLAVES_DIA[diaSemana]
  const cfgDia = horario.dias?.[claveDia]
  if (!cfgDia || !cfgDia.activo) return false

  const hhmm = `${String(hora).padStart(2, '0')}:${String(minuto).padStart(2, '0')}`
  return horaEnRango(hhmm, cfgDia.desde, cfgDia.hasta)
}

/**
 * Resuelve el horario aplicable a un usuario con cascada miembro → empresa.
 * Devuelve null si la consulta falla — la política es fail-open (permitir).
 */
async function resolverHorarioYZona(empresaId: string, usuarioId: string): Promise<{
  horario: HorarioNotificaciones | null
  zonaHoraria: string
}> {
  const { crearClienteAdmin } = await import('@/lib/supabase/admin')
  const admin = crearClienteAdmin()

  const [empresaRes, miembroRes] = await Promise.all([
    admin
      .from('empresas')
      .select('horario_notificaciones, zona_horaria')
      .eq('id', empresaId)
      .maybeSingle(),
    admin
      .from('miembros')
      .select('horario_notificaciones')
      .eq('empresa_id', empresaId)
      .eq('usuario_id', usuarioId)
      .eq('activo', true)
      .maybeSingle(),
  ])

  const zonaHoraria = (empresaRes.data?.zona_horaria as string | null) || 'America/Argentina/Buenos_Aires'
  const horarioMiembro = miembroRes.data?.horario_notificaciones as HorarioNotificaciones | null
  const horarioEmpresa = empresaRes.data?.horario_notificaciones as HorarioNotificaciones | null
  return { horario: horarioMiembro ?? horarioEmpresa ?? null, zonaHoraria }
}

/**
 * Consulta principal usada por enviarPush(): ¿puedo notificar a este usuario ahora?
 * Fail-open: cualquier error de consulta devuelve true (notificación pasa).
 */
export async function puedeNotificarAhora(
  empresaId: string,
  usuarioId: string,
  ahora: Date = new Date(),
): Promise<boolean> {
  try {
    const { horario, zonaHoraria } = await resolverHorarioYZona(empresaId, usuarioId)
    return permiteNotificar(horario, zonaHoraria, ahora)
  } catch (err) {
    console.error('[Push] puedeNotificarAhora — error consultando horario, fail-open:', err)
    return true
  }
}
