/**
 * Tipo Miembro — relación usuario↔empresa.
 * Un usuario puede pertenecer a múltiples empresas con distintos roles.
 * Se usa en: auth, permisos, selector de empresa, gestión de usuarios.
 */

export type Rol =
  | 'propietario'
  | 'administrador'
  | 'gestor'
  | 'vendedor'
  | 'supervisor'
  | 'empleado'
  | 'invitado'

export type CompensacionTipo = 'fijo' | 'por_dia' | 'por_hora'
export type CompensacionFrecuencia = 'semanal' | 'quincenal' | 'mensual' | 'eventual'
export type HorarioTipo = 'lunes_viernes' | 'lunes_sabado' | 'todos' | 'custom'
export type MetodoFichaje = 'kiosco' | 'automatico' | 'manual'

export interface Miembro {
  id: string
  usuario_id: string
  empresa_id: string
  rol: Rol
  activo: boolean
  permisos_custom: Record<string, string[]> | null
  unido_en: string

  // Laboral
  numero_empleado: number | null
  puesto_id: string | null
  puesto_nombre: string | null
  sector: string | null

  // Horario y fichaje
  horario_tipo: HorarioTipo | null
  horario_flexible: boolean
  metodo_fichaje: MetodoFichaje | null
  salix_ia_habilitado: boolean

  // Kiosco
  kiosco_rfid: string | null
  kiosco_pin: string | null
  foto_kiosco_url: string | null

  // Compensación / nómina
  compensacion_tipo: CompensacionTipo | null
  compensacion_monto: number | null
  compensacion_frecuencia: CompensacionFrecuencia | null
  dias_trabajo: number | null
}
