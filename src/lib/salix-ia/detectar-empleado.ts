/**
 * Detecta si un número de teléfono pertenece a un empleado activo de la empresa.
 * Se usa en: webhook de WhatsApp para decidir si activar Salix IA (copilot) o el flujo normal de clientes.
 *
 * Teléfono usado para matchear:
 * - Empleado con cuenta Flux: respeta `miembros.canal_notif_telefono` ('empresa' | 'personal').
 *   Solo matchea con el teléfono del canal elegido, sin fallback al otro.
 * - Empleado sin cuenta Flux: usa el teléfono del contacto de equipo (único campo).
 *
 * Normalización: compara solo dígitos, ignorando +, espacios, guiones.
 * También maneja el caso de teléfonos sin código de país (ej: "1160990312" se intenta matchear
 * como sufijo del número completo "5491160990312").
 */

import type { ResultadoDeteccionEmpleado, SupabaseAdmin } from '@/tipos/salix-ia'
import { resolverDatosContactoMiembro } from '@/lib/miembros/datos-contacto'
import { cargarEtiquetasMiembros } from '@/lib/miembros/etiquetas'
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
    .select('id, usuario_id, rol, permisos_custom, nivel_salix, salix_ia_web, salix_ia_whatsapp, canal_notif_telefono, puesto_id')
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

  const perfilesMap = new Map<string, { nombre: string | null; apellido: string | null; telefono: string | null; telefono_empresa: string | null }>()
  for (const p of (perfiles || [])) {
    perfilesMap.set(p.id, p)
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
  const contactoEqMap = new Map<string, { nombre: string | null; apellido: string | null; telefono: string | null }>()
  for (const c of (contactosEq || [])) {
    if (!c.miembro_id) continue
    contactoEqMap.set(c.miembro_id, {
      nombre: c.nombre,
      apellido: c.apellido,
      telefono: c.telefono,
    })
  }

  console.info(`[DETECTAR] ${miembros.length} miembros, ${perfilesMap.size} perfiles, ${contactoEqMap.size} contactos equipo`)

  // Buscar coincidencia respetando canal y fallback unificado
  for (const m of miembros) {
    const perfil = m.usuario_id ? perfilesMap.get(m.usuario_id) : undefined
    const contactoEq = contactoEqMap.get(m.id)

    if (!perfil && !contactoEq) {
      console.info(`[DETECTAR] Miembro ${m.id} sin perfil ni contacto, saltando`)
      continue
    }

    const datosContacto = resolverDatosContactoMiembro({
      miembro: { canal_notif_telefono: m.canal_notif_telefono as 'empresa' | 'personal' | null },
      perfil: perfil || null,
      contactoEquipo: contactoEq || null,
    })

    const telNorm = normalizarTelefono(datosContacto.telefono)
    console.info(`[DETECTAR] ${datosContacto.nombre_completo}: fuente=${datosContacto.fuente}, tel="${telNorm}", comparando con "${telefonoNormalizado}"`)

    const coincide = telNorm ? telefonosCoinciden(telNorm, telefonoNormalizado) : false

    if (coincide) {
      const etiquetas = await cargarEtiquetasMiembros(admin, [{ id: m.id, puesto_id: m.puesto_id ?? null }])
      const et = etiquetas.get(m.id)
      return {
        es_empleado: true,
        miembro: {
          id: m.id,
          usuario_id: m.usuario_id,
          rol: m.rol,
          permisos_custom: m.permisos_custom,
          nivel_salix: (m.nivel_salix ?? 'ninguno') as import('@/tipos/miembro').NivelSalix,
          salix_ia_web: m.salix_ia_web,
          salix_ia_whatsapp: m.salix_ia_whatsapp,
          puesto: et?.puesto ?? null,
          sector: et?.sector ?? null,
        },
        perfil: {
          nombre: datosContacto.nombre,
          apellido: datosContacto.apellido,
          telefono: perfil?.telefono ?? contactoEq?.telefono ?? null,
          telefono_empresa: perfil?.telefono_empresa ?? null,
        },
      }
    }
  }

  return { es_empleado: false }
}
