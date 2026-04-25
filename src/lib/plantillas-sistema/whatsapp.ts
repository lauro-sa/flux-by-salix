/**
 * whatsapp.ts — Plantillas WhatsApp precargadas del sistema.
 *
 * Cuando se crea una empresa nueva, estas plantillas se insertan en
 * `plantillas_whatsapp` en estado BORRADOR. El administrador las revisa,
 * las envía a Meta para aprobación y quedan disponibles cuando Meta las aprueba.
 *
 * A diferencia de las de correo (editables libremente), las de WhatsApp
 * tienen que pasar por revisión de Meta obligatoriamente — el seed solo
 * acelera el primer paso: que aparezcan en la lista sin tener que escribirlas.
 *
 * Se usa en: POST /api/empresas/crear.
 */

import type { SupabaseClient } from '@supabase/supabase-js'

interface DefinicionPlantillaWA {
  nombre_api: string
  nombre: string
  categoria: 'UTILITY' | 'MARKETING' | 'AUTHENTICATION'
  idioma: string
  modulos: string[]
  componentes: {
    cuerpo: {
      texto: string
      ejemplos: string[]
      mapeo_variables: string[]
    }
    pie_pagina?: { texto: string }
  }
}

/**
 * Plantillas del módulo Recorrido (visitas programadas).
 * Dos flujos complementarios: avisar que se va en camino y avisar que llegó.
 */
const RECORRIDO_PLANTILLAS: DefinicionPlantillaWA[] = [
  {
    nombre_api: 'flux_aviso_en_camino',
    nombre: 'Aviso en Camino',
    categoria: 'UTILITY',
    idioma: 'es',
    modulos: ['recorrido'],
    componentes: {
      cuerpo: {
        texto: 'Hola {{1}}, le informamos que nuestro visitador va en camino a:\n*{{2}}*.\n\nEstará llegando {{3}}.\n\nAnte cualquier consulta, no dude en comunicarse con nosotros.\n\nMuchas gracias.',
        ejemplos: ['Juan Pérez', 'Av. Suárez 1719', 'dentro de los próximos 25 minutos aproximadamente'],
        mapeo_variables: ['contacto_nombre', 'visita_direccion', 'visita_eta'],
      },
      pie_pagina: { texto: 'Enviado desde Flux by Salix' },
    },
  },
  {
    nombre_api: 'flux_aviso_llegada_visita',
    nombre: 'Aviso de Llegada (Visita)',
    categoria: 'UTILITY',
    idioma: 'es',
    modulos: ['recorrido'],
    componentes: {
      cuerpo: {
        texto: 'Hola {{1}} 👋\n\nLe informamos que nuestro técnico visitador ya se encuentra en:\n📍 *{{2}}*\n\nMuchas gracias.',
        ejemplos: ['Juan Pérez', 'Av. Suárez 1719'],
        mapeo_variables: ['contacto_nombre', 'visita_direccion'],
      },
      pie_pagina: { texto: 'Enviado desde Flux by Salix' },
    },
  },
]

export const PLANTILLAS_WHATSAPP_SISTEMA: DefinicionPlantillaWA[] = [
  ...RECORRIDO_PLANTILLAS,
]

/**
 * Crea las plantillas WhatsApp de sistema para una empresa. Se insertan en
 * estado BORRADOR — el admin tiene que enviarlas a Meta manualmente desde el
 * panel de plantillas.
 *
 * Si alguna `nombre_api` ya existe para la empresa, se omite (upsert seguro).
 * Si la empresa todavía no tiene un canal WhatsApp activo, se inserta sin
 * `canal_id` (se puede vincular después desde el panel).
 */
export async function crearPlantillasWhatsAppSistema(
  admin: SupabaseClient,
  empresaId: string,
  creadoPor: string,
): Promise<void> {
  // Plantillas ya existentes — evitar duplicados
  const { data: existentes } = await admin
    .from('plantillas_whatsapp')
    .select('nombre_api')
    .eq('empresa_id', empresaId)

  const nombresExistentes = new Set(
    (existentes || []).map((p: { nombre_api: string }) => p.nombre_api),
  )

  const nuevas = PLANTILLAS_WHATSAPP_SISTEMA.filter(p => !nombresExistentes.has(p.nombre_api))
  if (nuevas.length === 0) return

  // Canal WhatsApp activo (si hay) — si no, la plantilla queda sin canal y
  // se vincula cuando se configure uno.
  const { data: canal } = await admin
    .from('canales_whatsapp')
    .select('id')
    .eq('empresa_id', empresaId)
    .eq('activo', true)
    .limit(1)
    .maybeSingle()

  const registros = nuevas.map(p => ({
    empresa_id: empresaId,
    canal_id: canal?.id || null,
    nombre: p.nombre,
    nombre_api: p.nombre_api,
    categoria: p.categoria,
    idioma: p.idioma,
    componentes: p.componentes,
    estado_meta: 'BORRADOR',
    modulos: p.modulos,
    disponible_para: 'todos',
    activo: true,
    creado_por: creadoPor,
  }))

  const { error } = await admin
    .from('plantillas_whatsapp')
    .insert(registros)

  if (error) {
    console.error('Error creando plantillas WhatsApp de sistema:', error)
  }
}
