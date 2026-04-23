import { NextResponse, type NextRequest } from 'next/server'
import { requerirPermisoAPI } from '@/lib/permisos-servidor'
import { crearClienteAdmin } from '@/lib/supabase/admin'
import { normalizarAcentos } from '@/lib/validaciones'

/**
 * GET /api/contactos/similares?contacto_id=xxx — Busca contactos similares al provisorio dado.
 * Compara por nombre, lista de teléfonos, correo y dirección.
 * Devuelve contactos ordenados por cantidad de coincidencias (más similar primero).
 */
export async function GET(request: NextRequest) {
  try {
    const guard = await requerirPermisoAPI('contactos', 'ver_todos')
    if ('respuesta' in guard) return guard.respuesta
    const { empresaId } = guard

    const { searchParams } = new URL(request.url)
    const contactoId = searchParams.get('contacto_id')

    if (!contactoId) {
      return NextResponse.json({ error: 'contacto_id requerido' }, { status: 400 })
    }

    const admin = crearClienteAdmin()

    // Datos del contacto provisorio + sus teléfonos + sus direcciones (en paralelo)
    const [provisorioRes, telProvRes, dirProvRes] = await Promise.all([
      admin.from('contactos')
        .select('id, nombre, apellido, correo, es_provisorio')
        .eq('id', contactoId).eq('empresa_id', empresaId)
        .single(),
      admin.from('contacto_telefonos')
        .select('valor')
        .eq('contacto_id', contactoId).eq('empresa_id', empresaId),
      admin.from('contacto_direcciones')
        .select('calle, numero, ciudad, provincia')
        .eq('contacto_id', contactoId),
    ])

    const provisorio = provisorioRes.data
    if (!provisorio) {
      return NextResponse.json({ error: 'Contacto no encontrado' }, { status: 404 })
    }

    const telefonosProvisorio = (telProvRes.data || []).map(t => t.valor).filter(Boolean) as string[]
    const direccionesProvisorio = dirProvRes.data || []

    // Construir condiciones OR para buscar similares
    const condiciones: string[] = []

    if (provisorio.nombre) {
      const nombreNorm = normalizarAcentos(provisorio.nombre)
      condiciones.push(`nombre.ilike.%${nombreNorm}%`)
    }
    if (provisorio.apellido) {
      const apellidoNorm = normalizarAcentos(provisorio.apellido)
      condiciones.push(`apellido.ilike.%${apellidoNorm}%`)
    }
    if (provisorio.correo) {
      condiciones.push(`correo.ilike.%${provisorio.correo}%`)
    }

    // Pre-query: contactos que comparten algún teléfono con el provisorio.
    // Buscamos en contacto_telefonos.valor IN (lista del provisorio).
    let idsPorTelefono: string[] = []
    if (telefonosProvisorio.length > 0) {
      const { data: telMatches } = await admin
        .from('contacto_telefonos')
        .select('contacto_id')
        .eq('empresa_id', empresaId)
        .in('valor', telefonosProvisorio)
        .neq('contacto_id', contactoId)
      idsPorTelefono = [...new Set((telMatches || []).map(t => t.contacto_id))]
    }

    if (idsPorTelefono.length > 0) {
      condiciones.push(`id.in.(${idsPorTelefono.join(',')})`)
    }

    if (condiciones.length === 0) {
      return NextResponse.json({ similares: [] })
    }

    // Buscar contactos que coincidan en al menos un campo
    const { data: candidatos } = await admin
      .from('contactos')
      .select(`
        id, nombre, apellido, codigo, correo, telefono, whatsapp, cargo,
        activo, es_provisorio,
        tipo_contacto:tipos_contacto!tipo_contacto_id(id, clave, etiqueta, icono, color),
        direcciones:contacto_direcciones(calle, numero, ciudad, provincia),
        telefonos:contacto_telefonos(valor, es_whatsapp, es_principal)
      `)
      .eq('empresa_id', empresaId)
      .eq('en_papelera', false)
      .neq('id', contactoId)
      .or(condiciones.join(','))
      .limit(20)

    if (!candidatos || candidatos.length === 0) {
      return NextResponse.json({ similares: [] })
    }

    // Set de teléfonos del provisorio para lookup rápido
    const telProvSet = new Set(telefonosProvisorio)

    const similares = candidatos.map(c => {
      let puntuacion = 0
      const coincidencias: string[] = []

      // Nombre
      if (provisorio.nombre && c.nombre) {
        const provNom = normalizarAcentos(provisorio.nombre).toLowerCase()
        const candNom = normalizarAcentos(c.nombre).toLowerCase()
        if (provNom === candNom) {
          puntuacion += 3
          coincidencias.push('nombre exacto')
        } else if (candNom.includes(provNom) || provNom.includes(candNom)) {
          puntuacion += 2
          coincidencias.push('nombre parcial')
        }
      }

      // Apellido
      if (provisorio.apellido && c.apellido) {
        const provAp = normalizarAcentos(provisorio.apellido).toLowerCase()
        const candAp = normalizarAcentos(c.apellido).toLowerCase()
        if (provAp === candAp) {
          puntuacion += 3
          coincidencias.push('apellido exacto')
        } else if (candAp.includes(provAp) || provAp.includes(candAp)) {
          puntuacion += 1
          coincidencias.push('apellido parcial')
        }
      }

      // Teléfonos: cualquier coincidencia exacta entre las listas suma fuerte.
      const telCand = (c.telefonos as unknown as { valor: string; es_whatsapp: boolean }[] | null) || []
      let telCoincide = false
      let waCoincide = false
      for (const t of telCand) {
        if (telProvSet.has(t.valor)) {
          if (t.es_whatsapp) waCoincide = true
          else telCoincide = true
        }
      }
      if (telCoincide) {
        puntuacion += 5
        coincidencias.push('teléfono')
      }
      if (waCoincide) {
        puntuacion += 5
        coincidencias.push('whatsapp')
      }

      // Correo
      if (provisorio.correo && c.correo) {
        if (provisorio.correo.toLowerCase() === c.correo.toLowerCase()) {
          puntuacion += 5
          coincidencias.push('correo')
        }
      }

      // Dirección (comparar ciudad/calle)
      if (direccionesProvisorio.length && Array.isArray(c.direcciones) && c.direcciones.length) {
        for (const dirProv of direccionesProvisorio) {
          for (const dirCand of c.direcciones as { calle?: string; ciudad?: string }[]) {
            if (dirProv.ciudad && dirCand.ciudad &&
              normalizarAcentos(dirProv.ciudad).toLowerCase() === normalizarAcentos(dirCand.ciudad).toLowerCase()) {
              puntuacion += 1
              if (!coincidencias.includes('ciudad')) coincidencias.push('ciudad')
            }
            if (dirProv.calle && dirCand.calle) {
              const provCalle = normalizarAcentos(dirProv.calle).toLowerCase()
              const candCalle = normalizarAcentos(dirCand.calle).toLowerCase()
              if (provCalle === candCalle) {
                puntuacion += 2
                if (!coincidencias.includes('dirección')) coincidencias.push('dirección')
              }
            }
          }
        }
      }

      return {
        id: c.id,
        nombre: c.nombre,
        apellido: c.apellido,
        codigo: c.codigo,
        correo: c.correo,
        telefono: c.telefono,
        whatsapp: c.whatsapp,
        cargo: c.cargo,
        activo: c.activo,
        es_provisorio: c.es_provisorio,
        tipo_contacto: c.tipo_contacto,
        puntuacion,
        coincidencias,
      }
    })
      .filter(c => c.puntuacion > 0 && !c.es_provisorio)
      .sort((a, b) => b.puntuacion - a.puntuacion)
      .slice(0, 10)

    return NextResponse.json({ similares })
  } catch (err) {
    console.error('Error buscando similares:', err)
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}
