/**
 * Detecta si un número de teléfono pertenece a un empleado activo de la empresa.
 * Se usa en: webhook de WhatsApp para decidir si activar Salix IA (copilot) o el flujo normal de clientes.
 *
 * Prioridad de teléfono:
 * - Si el empleado tiene telefono_empresa → solo matchea con ese
 * - Si NO tiene telefono_empresa → matchea con telefono (personal)
 *
 * Normalización: compara solo dígitos, ignorando +, espacios, guiones.
 * También maneja el caso de teléfonos sin código de país (ej: "1160990312" se intenta matchear
 * como sufijo del número completo "5491160990312").
 */

import type { ResultadoDeteccionEmpleado, SupabaseAdmin } from '@/tipos/salix-ia'

/** Normaliza un teléfono a solo dígitos */
function normalizarTelefono(tel: string | null | undefined): string {
  if (!tel) return ''
  return tel.replace(/[^\d]/g, '')
}

/**
 * Compara dos teléfonos normalizados.
 * Maneja el caso donde uno es más corto (sin código de país).
 * Ej: "1160990312" matchea con "5491160990312" porque es un sufijo.
 */
function telefonosCoinciden(telBD: string, telEntrante: string): boolean {
  if (!telBD || !telEntrante) return false

  // Match exacto
  if (telBD === telEntrante) return true

  // El de BD es más corto (sin código país) → verificar si es sufijo del entrante
  if (telBD.length >= 8 && telEntrante.endsWith(telBD)) return true

  // El entrante es más corto (raro, pero por si acaso)
  if (telEntrante.length >= 8 && telBD.endsWith(telEntrante)) return true

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

  // Obtener miembros activos con sus perfiles
  const { data: miembros } = await admin
    .from('miembros')
    .select(`
      id, usuario_id, rol, permisos_custom, salix_ia_habilitado,
      puesto_nombre, sector,
      perfil:perfiles!usuario_id(
        nombre, apellido, telefono, telefono_empresa
      )
    `)
    .eq('empresa_id', empresa_id)
    .eq('activo', true)

  if (!miembros || miembros.length === 0) {
    return { es_empleado: false }
  }

  // Buscar coincidencia con prioridad: telefono_empresa > telefono
  for (const m of miembros) {
    const perfil = m.perfil as {
      nombre: string
      apellido: string
      telefono: string | null
      telefono_empresa: string | null
    } | null

    if (!perfil) continue

    const telEmpresa = normalizarTelefono(perfil.telefono_empresa)
    const telPersonal = normalizarTelefono(perfil.telefono)

    let coincide = false

    if (telEmpresa) {
      // Si tiene teléfono empresa, SOLO matchear con ese
      coincide = telefonosCoinciden(telEmpresa, telefonoNormalizado)
    } else if (telPersonal) {
      // Si NO tiene teléfono empresa, usar el personal
      coincide = telefonosCoinciden(telPersonal, telefonoNormalizado)
    }

    if (coincide) {
      return {
        es_empleado: true,
        miembro: {
          id: m.id,
          usuario_id: m.usuario_id,
          rol: m.rol,
          permisos_custom: m.permisos_custom,
          salix_ia_habilitado: m.salix_ia_habilitado,
          puesto_nombre: m.puesto_nombre,
          sector: m.sector,
        },
        perfil: {
          nombre: perfil.nombre,
          apellido: perfil.apellido,
          telefono: perfil.telefono,
          telefono_empresa: perfil.telefono_empresa,
        },
      }
    }
  }

  return { es_empleado: false }
}
