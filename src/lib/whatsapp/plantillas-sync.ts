/**
 * Helpers para sincronización entre plantillas locales y Meta.
 *
 * - `transformarAMeta` / `transformarDesdeMeta`: conversión bidireccional entre
 *   nuestro schema local (ComponentesPlantillaWA) y el formato que espera la
 *   API de Meta Business.
 * - `calcularHashMeta`: SHA-256 estable del snapshot que se enviaría a Meta.
 *   Se usa para detectar cuándo una plantilla tiene cambios locales que no
 *   fueron sincronizados con Meta: si el hash actual ≠ `hash_componentes_meta`
 *   guardado en BD, la plantilla está desincronizada y el cliente final podría
 *   estar recibiendo algo distinto a lo que ve el admin en la UI.
 *
 * Nota: el hash se calcula solo sobre lo que viaja a Meta; campos locales
 * como `mapeo_variables` o `modulos` no afectan el hash.
 */

import { createHash } from 'node:crypto'
import type { ComponentesPlantillaWA } from '@/tipos/whatsapp'
import type { ComponentePlantillaMeta } from '@/lib/whatsapp'

/** Transforma componentes locales al formato Meta API. */
export function transformarAMeta(comp: ComponentesPlantillaWA): ComponentePlantillaMeta[] {
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
        if (b.tipo === 'URL' && b.url) {
          btn.url = b.url
          // Meta exige `example` cuando la URL contiene `{{N}}` — debe ser la
          // URL resuelta con un valor real de muestra. Si el usuario no lo
          // cargó, generamos uno automáticamente reemplazando la variable por
          // un placeholder legible (Meta igual lo acepta).
          if (b.url.includes('{{')) {
            const ejemplo = b.ejemplo?.trim()
              || b.url.replace(/\{\{(\d+)\}\}/g, 'ejemplo-1234')
            btn.example = [ejemplo]
          }
        }
        if (b.tipo === 'PHONE_NUMBER' && b.telefono) btn.phone_number = b.telefono
        return btn as unknown as NonNullable<ComponentePlantillaMeta['buttons']>[number]
      }),
    })
  }

  return resultado
}

/** Transforma componentes de Meta al formato local. */
export function transformarDesdeMeta(components: ComponentePlantillaMeta[]): ComponentesPlantillaWA {
  const resultado: ComponentesPlantillaWA = {
    cuerpo: { texto: '' },
  }

  for (const c of components) {
    if (c.type === 'HEADER') {
      resultado.encabezado = {
        tipo: (c.format || 'TEXT') as NonNullable<ComponentesPlantillaWA['encabezado']>['tipo'],
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

/**
 * JSON.stringify con claves ordenadas para que el hash sea estable aunque
 * el orden de las propiedades cambie entre guardadas.
 */
function jsonEstable(valor: unknown): string {
  if (valor === null || typeof valor !== 'object') return JSON.stringify(valor)
  if (Array.isArray(valor)) {
    return '[' + valor.map(jsonEstable).join(',') + ']'
  }
  const obj = valor as Record<string, unknown>
  const claves = Object.keys(obj).sort()
  return '{' + claves.map(k => JSON.stringify(k) + ':' + jsonEstable(obj[k])).join(',') + '}'
}

/**
 * Calcula el hash SHA-256 del payload que se enviaría a Meta.
 * Solo se hashea lo que Meta efectivamente recibe — no `mapeo_variables`,
 * `modulos`, `disponible_para`, etc. (esos son metadatos locales).
 */
export function calcularHashMeta(componentes: ComponentesPlantillaWA): string {
  const payload = {
    componentes: transformarAMeta(componentes),
  }
  return createHash('sha256').update(jsonEstable(payload)).digest('hex')
}
