import { NextResponse, type NextRequest } from 'next/server'
import { crearClienteServidor } from '@/lib/supabase/servidor'
import { crearClienteAdmin } from '@/lib/supabase/admin'
import {
  listarPlantillasMeta, crearPlantillaMeta, eliminarPlantillaMeta,
  type ConfigCuentaWhatsApp, type ComponentePlantillaMeta,
} from '@/lib/whatsapp'
import type { ComponentesPlantillaWA, EstadoMeta } from '@/tipos/inbox'

/**
 * GET /api/inbox/whatsapp/plantillas — Listar plantillas locales.
 * Query params: canal_id (opcional, filtra por cuenta WA)
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await crearClienteServidor()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const empresaId = user.app_metadata?.empresa_activa_id
    if (!empresaId) return NextResponse.json({ error: 'Sin empresa activa' }, { status: 403 })

    const admin = crearClienteAdmin()
    const canalId = request.nextUrl.searchParams.get('canal_id')

    let query = admin
      .from('plantillas_whatsapp')
      .select('*')
      .eq('empresa_id', empresaId)
      .order('creado_en', { ascending: false })

    if (canalId) query = query.eq('canal_id', canalId)

    const { data, error } = await query
    if (error) {
      if (error.code === '42P01' || error.message?.includes('does not exist')) {
        return NextResponse.json({ plantillas: [] })
      }
      throw error
    }

    return NextResponse.json({ plantillas: data || [] })
  } catch (err) {
    console.error('Error al obtener plantillas WA:', err)
    return NextResponse.json({ plantillas: [] })
  }
}

/**
 * POST /api/inbox/whatsapp/plantillas — Acciones: guardar, enviar_a_meta, eliminar, sincronizar.
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await crearClienteServidor()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const empresaId = user.app_metadata?.empresa_activa_id
    if (!empresaId) return NextResponse.json({ error: 'Sin empresa activa' }, { status: 403 })

    const body = await request.json()
    const { accion } = body
    const admin = crearClienteAdmin()

    // ─── GUARDAR (crear o actualizar borrador local) ───
    if (accion === 'guardar') {
      const {
        id, canal_id, nombre, nombre_api, categoria, idioma, componentes,
        modulos, es_por_defecto, disponible_para, roles_permitidos, usuarios_permitidos,
      } = body

      if (!nombre || !nombre_api || !canal_id) {
        return NextResponse.json({ error: 'nombre, nombre_api y canal_id son requeridos' }, { status: 400 })
      }

      const datos = {
        empresa_id: empresaId,
        canal_id,
        nombre,
        nombre_api,
        categoria: categoria || 'UTILITY',
        idioma: idioma || 'es',
        componentes: componentes || {},
        modulos: modulos || [],
        es_por_defecto: es_por_defecto || false,
        disponible_para: disponible_para || 'todos',
        roles_permitidos: roles_permitidos || [],
        usuarios_permitidos: usuarios_permitidos || [],
        actualizado_en: new Date().toISOString(),
      }

      if (id) {
        // Verificar estado de la plantilla
        const { data: existente } = await admin
          .from('plantillas_whatsapp')
          .select('estado_meta')
          .eq('id', id)
          .eq('empresa_id', empresaId)
          .single()

        if (!existente) {
          return NextResponse.json({ error: 'Plantilla no encontrada' }, { status: 404 })
        }

        // Si está aprobada/pendiente en Meta, solo permitir campos locales (modulos, disponibilidad)
        const esEditableEnMeta = ['BORRADOR', 'ERROR'].includes(existente.estado_meta)
        const datosUpdate = esEditableEnMeta ? datos : {
          modulos: datos.modulos,
          es_por_defecto: datos.es_por_defecto,
          disponible_para: datos.disponible_para,
          roles_permitidos: datos.roles_permitidos,
          usuarios_permitidos: datos.usuarios_permitidos,
          actualizado_en: datos.actualizado_en,
        }

        const { data, error } = await admin
          .from('plantillas_whatsapp')
          .update(datosUpdate)
          .eq('id', id)
          .eq('empresa_id', empresaId)
          .select()
          .single()

        if (error) throw error
        return NextResponse.json({ plantilla: data })
      } else {
        // Crear nueva
        const { data, error } = await admin
          .from('plantillas_whatsapp')
          .insert({ ...datos, estado_meta: 'BORRADOR', creado_por: user.id })
          .select()
          .single()

        if (error) throw error
        return NextResponse.json({ plantilla: data }, { status: 201 })
      }
    }

    // ─── ENVIAR A META (crear plantilla en Meta y cambiar estado a PENDING) ───
    if (accion === 'enviar_a_meta') {
      const { id, canal_id } = body
      if (!id || !canal_id) {
        return NextResponse.json({ error: 'id y canal_id son requeridos' }, { status: 400 })
      }

      // Obtener plantilla local
      const { data: plantilla } = await admin
        .from('plantillas_whatsapp')
        .select('*')
        .eq('id', id)
        .eq('empresa_id', empresaId)
        .single()

      if (!plantilla) return NextResponse.json({ error: 'Plantilla no encontrada' }, { status: 404 })

      // Obtener config del canal
      const { data: canal } = await admin
        .from('canales_inbox')
        .select('config_conexion')
        .eq('id', canal_id)
        .eq('empresa_id', empresaId)
        .single()

      if (!canal) return NextResponse.json({ error: 'Canal no encontrado' }, { status: 404 })

      const config = canal.config_conexion as unknown as ConfigCuentaWhatsApp
      const comp = plantilla.componentes as unknown as ComponentesPlantillaWA

      // Transformar componentes a formato Meta
      const componentesMeta = transformarAMeta(comp)

      try {
        const resultado = await crearPlantillaMeta(
          config,
          plantilla.nombre_api,
          plantilla.idioma,
          plantilla.categoria,
          componentesMeta,
        )

        // Actualizar estado local
        await admin
          .from('plantillas_whatsapp')
          .update({
            estado_meta: 'PENDING' as EstadoMeta,
            id_template_meta: resultado.id,
            error_meta: null,
            ultima_sincronizacion: new Date().toISOString(),
            actualizado_en: new Date().toISOString(),
          })
          .eq('id', id)

        return NextResponse.json({ ok: true, id_template_meta: resultado.id, estado: resultado.status })
      } catch (err) {
        // Guardar error
        await admin
          .from('plantillas_whatsapp')
          .update({
            estado_meta: 'ERROR' as EstadoMeta,
            error_meta: (err as Error).message,
            actualizado_en: new Date().toISOString(),
          })
          .eq('id', id)

        return NextResponse.json({ error: (err as Error).message }, { status: 500 })
      }
    }

    // ─── ELIMINAR ───
    if (accion === 'eliminar') {
      const { id, canal_id } = body
      if (!id) return NextResponse.json({ error: 'id es requerido' }, { status: 400 })

      const { data: plantilla } = await admin
        .from('plantillas_whatsapp')
        .select('nombre_api, estado_meta')
        .eq('id', id)
        .eq('empresa_id', empresaId)
        .single()

      if (!plantilla) return NextResponse.json({ error: 'No encontrada' }, { status: 404 })

      // Si no es borrador/error, eliminar de Meta primero
      if (!['BORRADOR', 'ERROR'].includes(plantilla.estado_meta) && canal_id) {
        try {
          const { data: canal } = await admin
            .from('canales_inbox')
            .select('config_conexion')
            .eq('id', canal_id)
            .eq('empresa_id', empresaId)
            .single()

          if (canal) {
            const config = canal.config_conexion as unknown as ConfigCuentaWhatsApp
            await eliminarPlantillaMeta(config, plantilla.nombre_api)
          }
        } catch (err) {
          console.warn('Error eliminando de Meta (continuando eliminación local):', err)
        }
      }

      // Eliminar local
      await admin
        .from('plantillas_whatsapp')
        .delete()
        .eq('id', id)
        .eq('empresa_id', empresaId)

      return NextResponse.json({ ok: true })
    }

    // ─── SINCRONIZAR (traer estados desde Meta y actualizar locales + crear faltantes) ───
    if (accion === 'sincronizar') {
      const { canal_id } = body
      if (!canal_id) return NextResponse.json({ error: 'canal_id es requerido' }, { status: 400 })

      const { data: canal } = await admin
        .from('canales_inbox')
        .select('config_conexion')
        .eq('id', canal_id)
        .eq('empresa_id', empresaId)
        .single()

      if (!canal) return NextResponse.json({ error: 'Canal no encontrado' }, { status: 404 })

      const config = canal.config_conexion as unknown as ConfigCuentaWhatsApp
      const plantillasMeta = await listarPlantillasMeta(config)

      // Obtener plantillas locales de este canal
      const { data: locales } = await admin
        .from('plantillas_whatsapp')
        .select('id, nombre_api, estado_meta, id_template_meta')
        .eq('empresa_id', empresaId)
        .eq('canal_id', canal_id)

      const localesPorNombre = new Map((locales || []).map(l => [l.nombre_api, l]))
      const ahora = new Date().toISOString()
      let sincronizadas = 0
      let creadas = 0

      for (const pm of plantillasMeta) {
        const local = localesPorNombre.get(pm.name)
        const estadoMeta = mapearEstadoMeta(pm.status)

        if (local) {
          // Actualizar estado
          await admin
            .from('plantillas_whatsapp')
            .update({
              estado_meta: estadoMeta,
              id_template_meta: pm.id,
              error_meta: estadoMeta === 'REJECTED' ? (pm as unknown as Record<string, unknown>).rejected_reason as string || 'Rechazada por Meta' : null,
              ultima_sincronizacion: ahora,
              actualizado_en: ahora,
            })
            .eq('id', local.id)
          sincronizadas++
        } else {
          // Crear registro local para plantilla que existe en Meta pero no localmente
          const componentes = transformarDesdeMeta(pm.components || [])
          await admin
            .from('plantillas_whatsapp')
            .insert({
              empresa_id: empresaId,
              canal_id,
              nombre: pm.name.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
              nombre_api: pm.name,
              categoria: pm.category as string,
              idioma: pm.language,
              componentes,
              estado_meta: estadoMeta,
              id_template_meta: pm.id,
              ultima_sincronizacion: ahora,
              creado_por: user.id,
            })
          creadas++
        }
      }

      return NextResponse.json({ ok: true, sincronizadas, creadas, total_meta: plantillasMeta.length })
    }

    return NextResponse.json({ error: 'Acción no válida' }, { status: 400 })
  } catch (err) {
    console.error('Error en gestión de plantillas WA:', err)
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}

// ─── Helpers ───

/** Transforma componentes locales al formato Meta API */
function transformarAMeta(comp: ComponentesPlantillaWA): ComponentePlantillaMeta[] {
  const resultado: ComponentePlantillaMeta[] = []

  if (comp.encabezado && comp.encabezado.tipo !== 'NONE') {
    const header: ComponentePlantillaMeta = {
      type: 'HEADER',
      format: comp.encabezado.tipo,
    }
    if (comp.encabezado.tipo === 'TEXT' && comp.encabezado.texto) {
      header.text = comp.encabezado.texto
      if (comp.encabezado.ejemplo) {
        header.example = { header_text: [comp.encabezado.ejemplo] }
      }
    }
    resultado.push(header)
  }

  if (comp.cuerpo?.texto) {
    const body: ComponentePlantillaMeta = {
      type: 'BODY',
      text: comp.cuerpo.texto,
    }
    if (comp.cuerpo.ejemplos && comp.cuerpo.ejemplos.length > 0) {
      body.example = { body_text: [comp.cuerpo.ejemplos] }
    }
    resultado.push(body)
  }

  if (comp.pie_pagina?.texto) {
    resultado.push({
      type: 'FOOTER',
      text: comp.pie_pagina.texto,
    })
  }

  if (comp.botones && comp.botones.length > 0) {
    resultado.push({
      type: 'BUTTONS',
      buttons: comp.botones.map(b => {
        const btn: Record<string, unknown> = { type: b.tipo, text: b.texto }
        if (b.tipo === 'URL' && b.url) btn.url = b.url
        if (b.tipo === 'PHONE_NUMBER' && b.telefono) btn.phone_number = b.telefono
        return btn as unknown as ComponentePlantillaMeta['buttons'] extends (infer T)[] | undefined ? T : never
      }),
    })
  }

  return resultado
}

/** Transforma componentes de Meta al formato local */
function transformarDesdeMeta(components: ComponentePlantillaMeta[]): ComponentesPlantillaWA {
  const resultado: ComponentesPlantillaWA = {
    cuerpo: { texto: '' },
  }

  for (const c of components) {
    if (c.type === 'HEADER') {
      resultado.encabezado = {
        tipo: (c.format || 'TEXT') as ComponentesPlantillaWA['encabezado'] extends { tipo: infer T } ? T : never,
        texto: c.text,
      }
    }
    if (c.type === 'BODY') {
      resultado.cuerpo = {
        texto: c.text || '',
        ejemplos: (c.example as Record<string, string[][]>)?.body_text?.[0] || [],
      }
    }
    if (c.type === 'FOOTER') {
      resultado.pie_pagina = { texto: c.text || '' }
    }
    if (c.type === 'BUTTONS' && c.buttons) {
      resultado.botones = c.buttons.map(b => ({
        tipo: b.type,
        texto: b.text,
        url: b.url,
        telefono: b.phone_number,
      }))
    }
  }

  return resultado
}

/** Mapea estado de Meta al estado local */
function mapearEstadoMeta(status: string): EstadoMeta {
  const mapa: Record<string, EstadoMeta> = {
    APPROVED: 'APPROVED',
    PENDING: 'PENDING',
    REJECTED: 'REJECTED',
    DISABLED: 'DISABLED',
    PAUSED: 'PAUSED',
    IN_APPEAL: 'PENDING',
  }
  return mapa[status] || 'PENDING'
}
