/**
 * Estado de un miembro dentro del ciclo de vida del empleado en Flux.
 *
 * El modelo separa "empleado" (existe en RRHH, ficha, cobra) de "usuario"
 * (accede al software con correo y contraseña). Un mismo registro de
 * `miembros` transita entre estos estados sin duplicarse.
 */

export type EstadoMiembro =
  | 'fichaje'      // Carga manual, sin cuenta Flux. Solo kiosco / ficha.
  | 'pendiente'    // Invitación enviada, esperando que el empleado se registre.
  | 'activo'       // Cuenta Flux vinculada y acceso habilitado.
  | 'desactivado'  // Tenía acceso y fue deshabilitado por un admin.

export interface MiembroParaEstado {
  usuario_id: string | null
  activo: boolean
}

export interface InvitacionParaEstado {
  usado: boolean
  expira_en: string | Date
}

/**
 * Deriva el estado del miembro a partir de su fila + invitación vigente.
 * @param miembro  Fila de `miembros` con al menos `usuario_id` y `activo`.
 * @param invitacion Invitación más reciente de este correo (si existe).
 */
export function calcularEstadoMiembro(
  miembro: MiembroParaEstado,
  invitacion?: InvitacionParaEstado | null,
): EstadoMiembro {
  if (!miembro.activo) return 'desactivado'
  if (miembro.usuario_id) return 'activo'

  if (invitacion && !invitacion.usado) {
    const expira = invitacion.expira_en instanceof Date
      ? invitacion.expira_en
      : new Date(invitacion.expira_en)
    if (expira.getTime() > Date.now()) return 'pendiente'
  }

  return 'fichaje'
}

/**
 * Metadatos visuales de cada estado. Se consume desde el componente
 * InfoEstadoMiembro y cualquier lugar que muestre el estado.
 */
export const ESTADOS_MIEMBRO: Record<EstadoMiembro, {
  etiqueta: string
  descripcion: string
  color: 'cyan' | 'advertencia' | 'exito' | 'neutro'
  orden: number
}> = {
  fichaje: {
    etiqueta: 'Solo fichaje',
    descripcion: 'Puede fichar en el kiosco con RFID o PIN. No tiene cuenta para acceder a Flux.',
    color: 'cyan',
    orden: 0,
  },
  pendiente: {
    etiqueta: 'Pendiente',
    descripcion: 'Se le envió una invitación. Al aceptar y crear su cuenta queda como miembro activo.',
    color: 'advertencia',
    orden: 1,
  },
  activo: {
    etiqueta: 'Activo',
    descripcion: 'Tiene cuenta Flux vinculada y acceso completo según su rol.',
    color: 'exito',
    orden: 2,
  },
  desactivado: {
    etiqueta: 'Desactivado',
    descripcion: 'El acceso fue suspendido por un administrador. No puede iniciar sesión ni fichar.',
    color: 'neutro',
    orden: 3,
  },
}
