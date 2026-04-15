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
 * Normaliza variantes de números argentinos.
 * Argentina tiene un problema: el 9 después del 54 es opcional.
 * - WhatsApp siempre manda: 5491132354334 (con 9)
 * - La gente guarda: +54 11 3235 4334 (sin 9) o +54 9 11 3235 4334 (con 9)
 * Esta función retorna todas las variantes posibles para comparar.
 */
function variantesTelefono(tel: string): string[] {
  const variantes = [tel]

  // Si empieza con 549 (argentina con 9) → agregar variante sin 9
  if (tel.startsWith('549') && tel.length >= 12) {
    variantes.push('54' + tel.slice(3)) // 5491132354334 → 541132354334
  }

  // Si empieza con 54 pero NO 549 (argentina sin 9) → agregar variante con 9
  if (tel.startsWith('54') && !tel.startsWith('549') && tel.length >= 11) {
    variantes.push('549' + tel.slice(2)) // 541132354334 → 5491132354334
  }

  return variantes
}

/**
 * Compara dos teléfonos normalizados.
 * Maneja: variantes argentinas (con/sin 9), sufijos sin código de país.
 */
function telefonosCoinciden(telBD: string, telEntrante: string): boolean {
  if (!telBD || !telEntrante) return false

  // Generar variantes de ambos números
  const variantesBD = variantesTelefono(telBD)
  const variantesEntrante = variantesTelefono(telEntrante)

  // Match exacto con cualquier variante
  for (const vBD of variantesBD) {
    for (const vE of variantesEntrante) {
      if (vBD === vE) return true
    }
  }

  // El de BD es más corto (sin código país) → verificar si es sufijo del entrante
  if (telBD.length >= 8) {
    for (const vE of variantesEntrante) {
      if (vE.endsWith(telBD)) return true
    }
  }

  // El entrante es más corto → verificar sufijo en BD
  if (telEntrante.length >= 8) {
    for (const vBD of variantesBD) {
      if (vBD.endsWith(telEntrante)) return true
    }
  }

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

  console.info(`[DETECTAR] ${miembros.length} miembros activos encontrados`)

  // Buscar coincidencia con prioridad: telefono_empresa > telefono
  for (const m of miembros) {
    // Supabase puede retornar el perfil como objeto o como array de 1 elemento
    const perfilRaw = m.perfil
    const perfil = (Array.isArray(perfilRaw) ? perfilRaw[0] : perfilRaw) as {
      nombre: string
      apellido: string
      telefono: string | null
      telefono_empresa: string | null
    } | null

    if (!perfil) {
      console.info(`[DETECTAR] Miembro ${m.id} sin perfil, saltando`)
      continue
    }

    const telEmpresa = normalizarTelefono(perfil.telefono_empresa)
    const telPersonal = normalizarTelefono(perfil.telefono)
    console.info(`[DETECTAR] ${perfil.nombre}: telEmpresa="${telEmpresa}", telPersonal="${telPersonal}", comparando con "${telefonoNormalizado}"`)


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
