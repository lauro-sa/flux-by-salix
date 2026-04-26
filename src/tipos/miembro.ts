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
  | 'colaborador'
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

  // Laboral. El nombre del puesto se resuelve por FK puesto_id → puestos.nombre.
  // El sector primario vive en la tabla relación miembros_sectores (es_primario=true).
  numero_empleado: number | null
  puesto_id: string | null

  // Horario y fichaje
  horario_tipo: HorarioTipo | null
  horario_flexible: boolean
  metodo_fichaje: MetodoFichaje | null
  fichaje_auto_movil: boolean

  // Canal por el que el miembro recibe notificaciones (nómina, recordatorios,
  // invitaciones). 'empresa' usa correo_empresa / telefono_empresa del perfil;
  // 'personal' usa correo / telefono. Si el campo elegido está vacío, NO se
  // envía (no hay fallback automático al otro).
  canal_notif_correo: 'empresa' | 'personal'
  canal_notif_telefono: 'empresa' | 'personal'

  // Canal de login: define cuál de los dos correos del perfil (correo / correo_empresa)
  // se usa como email de auth.users. Al cambiarlo, un endpoint admin sincroniza
  // auth.users.email con el campo elegido del perfil. Default 'empresa'.
  canal_login: 'empresa' | 'personal'

  // Backup del usuario_id cuando el miembro pasa a "Solo fichaje". Permite
  // reactivar restaurando el vínculo. Si la cuenta auth ya no existe, el
  // endpoint de reactivar pide enviar invitación nueva.
  usuario_id_anterior: string | null

  // Acceso a Salix IA separado por canal
  salix_ia_web: boolean       // asistente dentro de la app
  salix_ia_whatsapp: boolean  // copilot por WhatsApp

  /** @deprecated Usar salix_ia_web / salix_ia_whatsapp. Se mantiene por compatibilidad de lectura. */
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
