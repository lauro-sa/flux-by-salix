import { NextResponse, type NextRequest } from 'next/server'
import { requerirPermisoAPI } from '@/lib/permisos-servidor'
import { crearClienteAdmin } from '@/lib/supabase/admin'
import { normalizarAcentos } from '@/lib/validaciones'

/**
 * GET /api/contactos/similares?contacto_id=xxx — Busca contactos similares al provisorio dado.
 * Compara por nombre, teléfono, whatsapp, correo y dirección.
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

    // Obtener datos del contacto provisorio
    const { data: provisorio } = await admin
      .from('contactos')
      .select('id, nombre, apellido, correo, telefono, whatsapp, es_provisorio')
      .eq('id', contactoId)
      .eq('empresa_id', empresaId)
      .single()

    if (!provisorio) {
      return NextResponse.json({ error: 'Contacto no encontrado' }, { status: 404 })
    }

    // Obtener direcciones del provisorio
    const { data: direccionesProvisorio } = await admin
      .from('contacto_direcciones')
      .select('calle, numero, ciudad, provincia')
      .eq('contacto_id', contactoId)

    // Construir condiciones OR para buscar similares
    const condiciones: string[] = []

    // Por nombre (parcial)
    if (provisorio.nombre) {
      const nombreNorm = normalizarAcentos(provisorio.nombre)
      condiciones.push(`nombre.ilike.%${nombreNorm}%`)
    }
    if (provisorio.apellido) {
      const apellidoNorm = normalizarAcentos(provisorio.apellido)
      condiciones.push(`apellido.ilike.%${apellidoNorm}%`)
    }

    // Por teléfono (exacto, los últimos 8 dígitos)
    if (provisorio.telefono) {
      const telDigitos = provisorio.telefono.replace(/\D/g, '').slice(-8)
      if (telDigitos.length >= 6) {
        condiciones.push(`telefono.ilike.%${telDigitos}%`)
      }
    }

    // Por whatsapp (exacto, los últimos 8 dígitos)
    if (provisorio.whatsapp) {
      const waDigitos = provisorio.whatsapp.replace(/\D/g, '').slice(-8)
      if (waDigitos.length >= 6) {
        condiciones.push(`whatsapp.ilike.%${waDigitos}%`)
        condiciones.push(`telefono.ilike.%${waDigitos}%`)
      }
    }

    // Por correo
    if (provisorio.correo) {
      condiciones.push(`correo.ilike.%${provisorio.correo}%`)
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
        direcciones:contacto_direcciones(calle, numero, ciudad, provincia)
      `)
      .eq('empresa_id', empresaId)
      .eq('en_papelera', false)
      .neq('id', contactoId)
      .or(condiciones.join(','))
      .limit(20)

    if (!candidatos || candidatos.length === 0) {
      return NextResponse.json({ similares: [] })
    }

    // Calcular puntuación de similitud para cada candidato
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

      // Teléfono
      if (provisorio.telefono && c.telefono) {
        const provTel = provisorio.telefono.replace(/\D/g, '').slice(-8)
        const candTel = c.telefono.replace(/\D/g, '').slice(-8)
        if (provTel && candTel && provTel === candTel) {
          puntuacion += 5
          coincidencias.push('teléfono')
        }
      }

      // WhatsApp
      if (provisorio.whatsapp) {
        const provWa = provisorio.whatsapp.replace(/\D/g, '').slice(-8)
        if (c.whatsapp) {
          const candWa = c.whatsapp.replace(/\D/g, '').slice(-8)
          if (provWa && candWa && provWa === candWa) {
            puntuacion += 5
            coincidencias.push('whatsapp')
          }
        }
        // También comparar whatsapp del provisorio con teléfono del candidato
        if (c.telefono) {
          const candTel = c.telefono.replace(/\D/g, '').slice(-8)
          if (provWa && candTel && provWa === candTel) {
            puntuacion += 4
            if (!coincidencias.includes('teléfono')) coincidencias.push('teléfono similar')
          }
        }
      }

      // Correo
      if (provisorio.correo && c.correo) {
        if (provisorio.correo.toLowerCase() === c.correo.toLowerCase()) {
          puntuacion += 5
          coincidencias.push('correo')
        }
      }

      // Dirección (comparar ciudad/calle)
      if (direccionesProvisorio?.length && Array.isArray(c.direcciones) && c.direcciones.length) {
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
