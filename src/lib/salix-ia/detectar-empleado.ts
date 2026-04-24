/**
 * Detecta si un número de teléfono pertenece a un empleado activo de la empresa.
 * Se usa en: webhook de WhatsApp para decidir si activar Salix IA (copilot) o el flujo normal de clientes.
 *
 * Teléfonos usados para matchear:
 * - Compara contra TODOS los teléfonos del miembro: `perfil.telefono`, `perfil.telefono_empresa`,
 *   y el teléfono del contacto vinculado (`contactos.telefono` si el miembro tiene un contacto
 *   "de equipo"). El empleado puede escribir desde cualquiera.
 * - `canal_notif_telefono` se respeta SOLO para envíos (notificaciones, recordatorios), no para
 *   detección de mensajes entrantes — un empleado escribiendo desde su personal igual es empleado.
 *
 * Normalización: compara solo dígitos, ignorando +, espacios, guiones.
 * También maneja el caso de teléfonos sin código de país (ej: "1160990312" se intenta matchear
 * como sufijo del número completo "5491160990312").
 */

import type { ResultadoDeteccionEmpleado, SupabaseAdmin } from '@/tipos/salix-ia'
import { telefonosCoinciden as telefonosCoincidenCentral, generarVariantesTelefono, normalizarTelefono } from '@/lib/validaciones'

/** Wrapper que además matchea por sufijo (datos antiguos sin código de país). */
function telefonosCoinciden(telBD: string, telEntrante: string): boolean {
  if (!telBD || !telEntrante) return false
  // Match por variantes canónicas (central)
  if (telefonosCoincidenCentral(telBD, telEntrante)) return true
  // Fallback por sufijo: útil cuando uno de los dos está cargado sin código país
  const bdDigitos = telBD.replace(/\D/g, '')
  const entDigitos = telEntrante.replace(/\D/g, '')
  const variantesEnt = generarVariantesTelefono(telEntrante)
  const variantesBD = generarVariantesTelefono(telBD)
  if (bdDigitos.length >= 8 && variantesEnt.some(v => v.endsWith(bdDigitos))) return true
  if (entDigitos.length >= 8 && variantesBD.some(v => v.endsWith(entDigitos))) return true
  return false
}

/**
 * Detecta si un teléfono pertenece a un empleado.
 * @param admin - Cliente Supabase con service role
 * @param empresa_id - ID de la empresa del canal WhatsApp
 * @param telefonoNormalizado - Teléfono sin + (solo dígitos), como viene de Meta
 */
export async function detectarEmpleado(
  admin: SupabaseAdmin,
  empresa_id: string,
  telefonoNormalizado: string
): Promise<ResultadoDeteccionEmpleado> {
  if (!telefonoNormalizado) {
    return { es_empleado: false }
  }

  // Obtener miembros activos (query separada de perfiles porque el join falla en este proyecto)
  const { data: miembros } = await admin
    .from('miembros')
    .select('id, usuario_id, rol, permisos_custom, salix_ia_habilitado, salix_ia_web, salix_ia_whatsapp, canal_notif_telefono, puesto_nombre, sector')
    .eq('empresa_id', empresa_id)
    .eq('activo', true)

  if (!miembros || miembros.length === 0) {
    return { es_empleado: false }
  }

  // Obtener perfiles de miembros con cuenta Flux
  const usuarioIds = miembros.map((m: { usuario_id: string | null }) => m.usuario_id).filter((x: string | null): x is string => !!x)
  const { data: perfiles } = usuarioIds.length > 0
    ? await admin.from('perfiles').select('id, nombre, apellido, telefono, telefono_empresa').in('id', usuarioIds)
    : { data: [] as Array<{ id: string; nombre: string | null; apellido: string | null; telefono: string | null; telefono_empresa: string | null }> }

  const perfilesMap = new Map<string, { nombre: string; apellido: string; telefono: string | null; telefono_empresa: string | null }>()
  for (const p of (perfiles || [])) {
    perfilesMap.set(p.id, {
      nombre: p.nombre || '',
      apellido: p.apellido || '',
      telefono: p.telefono,
      telefono_empresa: p.telefono_empresa,
    })
  }

  // Fallback contacto equipo: nombre + teléfono para empleados sin cuenta Flux
  const miembrosIdsArr = miembros.map((m: { id: string }) => m.id)
  const { data: contactosEq } = miembrosIdsArr.length > 0
    ? await admin
        .from('contactos')
        .select('miembro_id, nombre, apellido, telefono')
        .in('miembro_id', miembrosIdsArr)
        .eq('en_papelera', false)
    : { data: [] as Array<{ miembro_id: string | null; nombre: string | null; apellido: string | null; telefono: string | null }> }
  const contactoEqMap = new Map<string, { nombre: string; apellido: string; telefono: string | null }>()
  for (const c of (contactosEq || [])) {
    if (!c.miembro_id) continue
    contactoEqMap.set(c.miembro_id, {
      nombre: c.nombre || '',
      apellido: c.apellido || '',
      telefono: c.telefono,
    })
  }

  console.info(`[DETECTAR] ${miembros.length} miembros, ${perfilesMap.size} perfiles, ${contactoEqMap.size} contactos equipo`)

  // Buscar coincidencia: comparar contra TODOS los teléfonos del miembro
  // (telefono personal + telefono_empresa + telefono del contacto vinculado).
  for (const m of miembros) {
    const perfil = m.usuario_id ? perfilesMap.get(m.usuario_id) : undefined
    const contactoEq = contactoEqMap.get(m.id)
    const datos = perfil || (contactoEq ? { nombre: contactoEq.nombre, apellido: contactoEq.apellido, telefono: contactoEq.telefono, telefono_empresa: null } : null)

    if (!datos) {
      console.info(`[DETECTAR] Miembro ${m.id} sin perfil ni contacto, saltando`)
      continue
    }

    // Lista de teléfonos posibles del miembro. El empleado puede escribir desde cualquiera.
    const telefonosPosibles = [
      perfil?.telefono,
      perfil?.telefono_empresa,
      contactoEq?.telefono,
    ]
      .map(t => normalizarTelefono(t))
      .filter((t): t is string => !!t)

    console.info(`[DETECTAR] ${datos.nombre}: probando ${telefonosPosibles.length} tel(s) [${telefonosPosibles.join(', ')}] contra "${telefonoNormalizado}"`)

    const coincide = telefonosPosibles.some(t => telefonosCoinciden(t, telefonoNormalizado))

    if (coincide) {
      return {
        es_empleado: true,
        miembro: {
          id: m.id,
          usuario_id: m.usuario_id,
          rol: m.rol,
          permisos_custom: m.permisos_custom,
          salix_ia_habilitado: m.salix_ia_habilitado,
          salix_ia_web: m.salix_ia_web,
          salix_ia_whatsapp: m.salix_ia_whatsapp,
          puesto_nombre: m.puesto_nombre,
          sector: m.sector,
        },
        perfil: {
          nombre: datos.nombre,
          apellido: datos.apellido,
          telefono: datos.telefono,
          telefono_empresa: datos.telefono_empresa,
        },
      }
    }
  }

  return { es_empleado: false }
}
