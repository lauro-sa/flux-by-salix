/**
 * Helper único para resolver los datos de contacto efectivos de un miembro.
 *
 * Hay dos clases de empleado:
 *   - Con cuenta Flux: existe fila en `perfiles` (id = miembros.usuario_id).
 *     Tiene correo/correo_empresa, telefono/telefono_empresa y documento.
 *     Respeta `canal_notif_correo` y `canal_notif_telefono` del miembro.
 *   - Sin cuenta Flux (cargado a mano): usuario_id = NULL en miembros y los
 *     datos viven en `contactos.miembro_id`. El contacto tiene UN correo y
 *     UN teléfono (sin distinción personal/empresa), así que se usan tal cual.
 *
 * Este helper recibe perfil (puede ser null) + contactoEquipo (puede ser null)
 * y produce un objeto uniforme con los datos efectivos. Cualquier endpoint que
 * envíe correos o WhatsApp a empleados debe usarlo en vez de leer perfil
 * directo: así el flujo es idéntico tenga o no cuenta Flux.
 */

import { resolverCorreoNotif, resolverTelefonoNotif } from './canal-notif'

export interface PerfilParaContacto {
  nombre?: string | null
  apellido?: string | null
  correo?: string | null
  correo_empresa?: string | null
  telefono?: string | null
  telefono_empresa?: string | null
  documento_tipo?: string | null
  documento_numero?: string | null
}

export interface ContactoEquipoParaContacto {
  nombre?: string | null
  apellido?: string | null
  correo?: string | null
  telefono?: string | null
  /** Tipo del documento personal (DNI, RUT, etc.). En contactos vive como `tipo_identificacion`. */
  tipo_identificacion?: string | null
  /** Número del documento personal. En contactos vive como `numero_identificacion`. */
  numero_identificacion?: string | null
}

export interface MiembroParaContacto {
  canal_notif_correo?: 'empresa' | 'personal' | string | null
  canal_notif_telefono?: 'empresa' | 'personal' | string | null
}

export interface DatosContactoEfectivos {
  nombre: string
  apellido: string
  /** Nombre + apellido juntos, recortado. Vacío si ambos faltan. */
  nombre_completo: string
  /** Correo del canal elegido (empleado con cuenta) o el del contacto (sin cuenta). null si no hay. */
  correo: string | null
  /** Teléfono del canal elegido (con cuenta) o el del contacto (sin cuenta). null si no hay. */
  telefono: string | null
  /** Documento solo viene del perfil; los contactos de equipo no lo guardan. */
  documento_tipo: string | null
  documento_numero: string | null
  /** De dónde se sacaron los datos. Útil para distinguir UI o reportes. */
  fuente: 'perfil' | 'contacto_equipo' | 'sin_datos'
  tiene_cuenta_flux: boolean
}

export function resolverDatosContactoMiembro(args: {
  miembro: MiembroParaContacto
  perfil: PerfilParaContacto | null | undefined
  contactoEquipo: ContactoEquipoParaContacto | null | undefined
}): DatosContactoEfectivos {
  const { miembro, perfil, contactoEquipo } = args
  const tieneCuentaFlux = !!perfil
  const fuente: DatosContactoEfectivos['fuente'] = perfil
    ? 'perfil'
    : contactoEquipo
      ? 'contacto_equipo'
      : 'sin_datos'

  // Nombre/apellido: prioridad perfil. Si perfil no tiene nada, fallback a contacto.
  const perfilTieneNombre = !!(perfil?.nombre || perfil?.apellido)
  const nombre = (perfilTieneNombre ? perfil?.nombre : contactoEquipo?.nombre) || ''
  const apellido = (perfilTieneNombre ? perfil?.apellido : contactoEquipo?.apellido) || ''
  const nombre_completo = `${nombre} ${apellido}`.trim()

  // Correo y teléfono dependen de si hay perfil:
  //   - con perfil: respeta canal elegido. Si el campo del canal está vacío, queda null
  //     (el caller decide si avisa o usa otro canal).
  //   - sin perfil: usa el del contacto (único campo).
  const correo = perfil
    ? resolverCorreoNotif({
        correo: perfil.correo ?? null,
        correo_empresa: perfil.correo_empresa ?? null,
        canal_notif_correo: miembro.canal_notif_correo ?? null,
      })
    : (contactoEquipo?.correo?.trim() || null)

  const telefono = perfil
    ? resolverTelefonoNotif({
        telefono: perfil.telefono ?? null,
        telefono_empresa: perfil.telefono_empresa ?? null,
        canal_notif_telefono: miembro.canal_notif_telefono ?? null,
      })
    : (contactoEquipo?.telefono?.trim() || null)

  // Documento: con perfil viene de perfiles.documento_*; sin perfil del contacto
  // (numero_identificacion / tipo_identificacion, que es donde el trigger
  // sync_perfil_a_contactos copia el documento del perfil real).
  const documento_tipo = perfil
    ? (perfil.documento_tipo ?? null)
    : (contactoEquipo?.tipo_identificacion ?? null)
  const documento_numero = perfil
    ? (perfil.documento_numero ?? null)
    : (contactoEquipo?.numero_identificacion ?? null)

  return {
    nombre,
    apellido,
    nombre_completo,
    correo,
    telefono,
    documento_tipo,
    documento_numero,
    fuente,
    tiene_cuenta_flux: tieneCuentaFlux,
  }
}

/**
 * Carga en batch los contactos de equipo de varios miembros y devuelve un
 * Map indexado por miembro_id. Pensado para endpoints que ya levantan miembros
 * y perfiles y solo les falta el fallback de contactos.
 */
export async function cargarContactosEquipoPorMiembro(
  admin: {
    from: (tabla: string) => {
      select: (cols: string) => {
        in: (col: string, vals: string[]) => {
          eq: (col: string, val: unknown) => Promise<{ data: ContactoEquipoConMiembroId[] | null }>
        }
      }
    }
  },
  miembrosIds: string[],
): Promise<Map<string, ContactoEquipoParaContacto>> {
  const mapa = new Map<string, ContactoEquipoParaContacto>()
  if (!miembrosIds.length) return mapa
  const { data } = await admin
    .from('contactos')
    .select('miembro_id, nombre, apellido, correo, telefono, tipo_identificacion, numero_identificacion')
    .in('miembro_id', miembrosIds)
    .eq('en_papelera', false)
  for (const c of data || []) {
    if (!c.miembro_id) continue
    mapa.set(c.miembro_id, {
      nombre: c.nombre,
      apellido: c.apellido,
      correo: c.correo,
      telefono: c.telefono,
      tipo_identificacion: c.tipo_identificacion,
      numero_identificacion: c.numero_identificacion,
    })
  }
  return mapa
}

interface ContactoEquipoConMiembroId extends ContactoEquipoParaContacto {
  miembro_id: string | null
}
