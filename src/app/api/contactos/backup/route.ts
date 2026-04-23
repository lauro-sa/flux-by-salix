import { NextResponse, type NextRequest } from 'next/server'
import { requerirPermisoAPI } from '@/lib/permisos-servidor'
import { crearClienteAdmin } from '@/lib/supabase/admin'
import { resolverListaDesdeBody, type TelefonoEntrada } from '@/lib/contacto-telefonos'

/**
 * GET /api/contactos/backup — Exportar copia de seguridad completa en JSON.
 * Incluye TODOS los campos, vinculaciones, direcciones (a diferencia del Excel).
 * Se usa en: página de contactos → menú acciones → "Copia de seguridad".
 *
 * POST /api/contactos/backup — Restaurar desde archivo JSON de backup.
 * Crea o actualiza contactos según el código existente.
 */

export async function GET() {
  try {
    // Backup completo = ver todos los contactos
    const guard = await requerirPermisoAPI('contactos', 'ver_todos')
    if ('respuesta' in guard) return guard.respuesta
    const { empresaId } = guard

    const admin = crearClienteAdmin()

    // Obtener todos los contactos con todas las relaciones
    const { data: contactos, error } = await admin
      .from('contactos')
      .select(`
        *,
        tipo_contacto:tipos_contacto!tipo_contacto_id(clave, etiqueta),
        direcciones:contacto_direcciones(*),
        telefonos:contacto_telefonos(tipo, valor, es_whatsapp, es_principal, etiqueta, orden),
        vinculaciones:contacto_vinculaciones!contacto_vinculaciones_contacto_id_fkey(
          puesto,
          recibe_documentos,
          vinculado_id,
          vinculado:contactos!contacto_vinculaciones_vinculado_id_fkey(codigo, nombre, apellido, tipo_contacto:tipos_contacto!tipo_contacto_id(clave)),
          tipo_relacion:tipos_relacion(clave, etiqueta)
        ),
        responsables:contacto_responsables(
          usuario_id,
          perfil:perfiles!contacto_responsables_usuario_id_fkey(nombre, apellido)
        ),
        seguidores:contacto_seguidores(
          usuario_id,
          modo_copia,
          perfil:perfiles!contacto_seguidores_usuario_id_fkey(nombre, apellido)
        )
      `)
      .eq('empresa_id', empresaId)
      .eq('en_papelera', false)
      .order('codigo')

    if (error) throw error

    const backup = {
      version: 1,
      tipo: 'contactos',
      plataforma: 'flux',
      exportadoEn: new Date().toISOString(),
      totalContactos: contactos?.length || 0,
      contactos: contactos || [],
    }

    const json = JSON.stringify(backup, null, 2)
    const ahora = new Date()
    const nombreArchivo = `backup_contactos_${ahora.toISOString().slice(0, 10)}.json`

    return new Response(json, {
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Disposition': `attachment; filename="${nombreArchivo}"`,
      },
    })
  } catch (err) {
    console.error('Error backup export:', err)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    // Restaurar backup modifica masivamente → requiere editar contactos
    const guard = await requerirPermisoAPI('contactos', 'editar')
    if ('respuesta' in guard) return guard.respuesta
    const { user, empresaId } = guard

    const formData = await request.formData()
    const archivo = formData.get('archivo') as File | null
    if (!archivo) return NextResponse.json({ error: 'Archivo obligatorio' }, { status: 400 })

    const texto = await archivo.text()
    let backup: BackupJSON

    try {
      backup = JSON.parse(texto)
    } catch {
      return NextResponse.json({ error: 'JSON inválido' }, { status: 400 })
    }

    // Validar estructura
    if (backup.version !== 1 || backup.tipo !== 'contactos' || !Array.isArray(backup.contactos)) {
      return NextResponse.json({ error: 'Formato de backup no válido. Debe ser version 1, tipo "contactos".' }, { status: 400 })
    }

    const admin = crearClienteAdmin()

    // Obtener tipos de contacto
    const { data: tipos } = await admin.from('tipos_contacto').select('id, clave').eq('empresa_id', empresaId)
    const mapasTipo: Record<string, string> = {}
    for (const t of (tipos || [])) mapasTipo[t.clave] = t.id

    // Obtener códigos existentes
    const { data: existentes } = await admin.from('contactos').select('id, codigo').eq('empresa_id', empresaId)
    const mapaExistentes: Record<string, string> = {}
    for (const c of (existentes || [])) mapaExistentes[c.codigo] = c.id

    let creados = 0
    let actualizados = 0
    let errores = 0
    const detalleErrores: string[] = []

    for (let i = 0; i < backup.contactos.length; i++) {
      const c = backup.contactos[i]

      try {
        if (!c.nombre) {
          errores++
          detalleErrores.push(`Contacto ${i + 1}: sin nombre`)
          continue
        }

        // Resolver tipo
        const tipoClave = c.tipo_contacto?.clave || 'persona'
        const tipoId = mapasTipo[tipoClave] || mapasTipo['persona']
        if (!tipoId) {
          errores++
          detalleErrores.push(`Contacto ${i + 1} (${c.nombre}): tipo "${tipoClave}" no existe`)
          continue
        }

        // Resolver lista de teléfonos: prioriza c.telefonos[] (backup nuevo),
        // fallback a c.telefono / c.whatsapp legacy.
        const telefonosBackup = resolverListaDesdeBody({
          telefonos: c.telefonos as TelefonoEntrada[] | undefined,
          telefono: c.telefono as string | undefined,
          whatsapp: c.whatsapp as string | undefined,
        })

        const campos = {
          tipo_contacto_id: tipoId,
          nombre: c.nombre,
          apellido: c.apellido || null,
          titulo: c.titulo || null,
          correo: c.correo || null,
          web: c.web || null,
          cargo: c.cargo || null,
          rubro: c.rubro || null,
          tipo_identificacion: c.tipo_identificacion || null,
          numero_identificacion: c.numero_identificacion || null,
          datos_fiscales: c.datos_fiscales || {},
          moneda: c.moneda || null,
          idioma: c.idioma || null,
          zona_horaria: c.zona_horaria || null,
          limite_credito: c.limite_credito || null,
          plazo_pago_cliente: c.plazo_pago_cliente || null,
          plazo_pago_proveedor: c.plazo_pago_proveedor || null,
          rank_cliente: c.rank_cliente || null,
          rank_proveedor: c.rank_proveedor || null,
          etiquetas: c.etiquetas || [],
          notas: c.notas || null,
          activo: c.activo !== false,
        }

        const idExistente = c.codigo ? mapaExistentes[c.codigo] : null

        if (idExistente) {
          // Actualizar
          await admin.from('contactos')
            .update({ ...campos, editado_por: user.id, actualizado_en: new Date().toISOString() })
            .eq('id', idExistente)

          // Reemplazar direcciones
          if (Array.isArray(c.direcciones) && c.direcciones.length > 0) {
            await admin.from('contacto_direcciones').delete().eq('contacto_id', idExistente)
            await admin.from('contacto_direcciones').insert(
              c.direcciones.map((d: Record<string, unknown>) => ({
                contacto_id: idExistente,
                tipo: d.tipo || 'principal',
                calle: d.calle || null,
                numero: d.numero || null,
                piso: d.piso || null,
                departamento: d.departamento || null,
                barrio: d.barrio || null,
                ciudad: d.ciudad || null,
                provincia: d.provincia || null,
                codigo_postal: d.codigo_postal || null,
                pais: d.pais || null,
                lat: d.lat || null,
                lng: d.lng || null,
                texto: d.texto || null,
                es_principal: d.es_principal || false,
              }))
            )
          }
          // Reemplazar lista de teléfonos
          if (telefonosBackup.length > 0) {
            await admin.from('contacto_telefonos').delete().eq('contacto_id', idExistente).eq('empresa_id', empresaId)
            await admin.from('contacto_telefonos').insert(
              telefonosBackup.map(t => ({
                empresa_id: empresaId,
                contacto_id: idExistente,
                tipo: t.tipo,
                valor: t.valor,
                es_whatsapp: t.es_whatsapp,
                es_principal: t.es_principal,
                etiqueta: t.etiqueta,
                orden: t.orden,
                creado_por: user.id,
              }))
            )
          }
          actualizados++
        } else {
          // Crear nuevo
          const { data: codigoData } = await admin.rpc('siguiente_codigo', { p_empresa_id: empresaId, p_entidad: 'contacto' })

          const { data: nuevo, error } = await admin.from('contactos').insert({
            empresa_id: empresaId,
            ...campos,
            codigo: codigoData as string,
            origen: 'importacion',
            creado_por: user.id,
          }).select('id').single()

          if (error) throw error

          // Insertar lista de teléfonos
          if (nuevo && telefonosBackup.length > 0) {
            await admin.from('contacto_telefonos').insert(
              telefonosBackup.map(t => ({
                empresa_id: empresaId,
                contacto_id: nuevo.id,
                tipo: t.tipo,
                valor: t.valor,
                es_whatsapp: t.es_whatsapp,
                es_principal: t.es_principal,
                etiqueta: t.etiqueta,
                orden: t.orden,
                creado_por: user.id,
              }))
            )
          }

          // Crear direcciones
          if (nuevo && Array.isArray(c.direcciones) && c.direcciones.length > 0) {
            await admin.from('contacto_direcciones').insert(
              c.direcciones.map((d: Record<string, unknown>) => ({
                contacto_id: nuevo.id,
                tipo: d.tipo || 'principal',
                calle: d.calle || null,
                numero: d.numero || null,
                piso: d.piso || null,
                departamento: d.departamento || null,
                barrio: d.barrio || null,
                ciudad: d.ciudad || null,
                provincia: d.provincia || null,
                codigo_postal: d.codigo_postal || null,
                pais: d.pais || null,
                lat: d.lat || null,
                lng: d.lng || null,
                texto: d.texto || null,
                es_principal: d.es_principal || false,
              }))
            )
          }

          // Responsable
          if (nuevo) {
            await admin.from('contacto_responsables').insert({
              contacto_id: nuevo.id,
              usuario_id: user.id,
            })
          }

          creados++
        }
      } catch (err) {
        errores++
        const msg = err instanceof Error ? err.message : String(err)
        detalleErrores.push(`Contacto ${i + 1} (${c.nombre || '?'}): ${msg}`)
      }
    }

    return NextResponse.json({
      creados,
      actualizados,
      errores,
      total: backup.contactos.length,
      detalleErrores: detalleErrores.slice(0, 50),
    })
  } catch (err) {
    console.error('Error backup import:', err)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

interface BackupJSON {
  version: number
  tipo: string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  contactos: any[]
}
