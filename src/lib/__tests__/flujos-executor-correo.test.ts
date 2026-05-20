/**
 * Tests del executor para los handlers `enviar_correo_plantilla` y
 * `enviar_respuesta_rapida_correo`.
 *
 * Se centra en el flujo "responder automático a correo entrante" del
 * branch feat/flujos-inbox-correo:
 *   - dry-run no llama a Gmail/IMAP ni inserta en `mensajes`.
 *   - destinatario se deriva del `correo_de` del mensaje disparador.
 *   - threading inyecta `in_reply_to` y `references`.
 *   - variables `{{contacto.nombre}}` se resuelven contra el contexto.
 *   - falla cerrada cuando el canal no existe / no está conectado / no
 *     hay mensaje disparador y tampoco `destinatario_override`.
 */

import { describe, it, expect, vi } from 'vitest'
import { ejecutarAccion, type ContextoEjecucion } from '@/lib/workflows/executor'

// ─── Fixtures ──────────────────────────────────────────────────

const EMPRESA_ID = 'emp-1'
const PLANTILLA_ID = 'pl-1'
const RAPIDA_ID = 'rap-1'
const CANAL_ID = 'can-1'
const CONVERSACION_ID = 'conv-1'
const MENSAJE_ID = 'msg-orig-1'
const MESSAGE_ID_RFC = '<msg-orig@dominio.com>'

const PLANTILLA_FIXTURE = {
  id: PLANTILLA_ID,
  nombre: 'Aviso fuera de horario',
  asunto: 'Recibimos tu correo, {{contacto.nombre}}',
  contenido: 'Hola {{contacto.nombre}}, te contestaremos a las 9hs.',
  contenido_html: '<p>Hola <strong>{{contacto.nombre}}</strong></p>',
  activo: true,
}

const RAPIDA_FIXTURE = {
  id: RAPIDA_ID,
  nombre: 'Respuesta rápida fuera de horario',
  asunto: null,
  contenido: 'Estamos fuera de horario.',
  contenido_html: null,
  activo: true,
}

const CANAL_FIXTURE = {
  id: CANAL_ID,
  nombre: 'Info HE',
  proveedor: 'imap' as const,
  config_conexion: { usuario: 'info@herreelec.com' },
  estado_conexion: 'conectado' as const,
}

const CONTEXTO_INICIAL_CON_MENSAJE = {
  trigger: { tipo: 'inbox.mensaje_recibido' },
  entidad: { tipo: 'mensaje', id: MENSAJE_ID },
  contacto: { nombre: 'Juan' },
  mensaje_disparador: {
    id: MENSAJE_ID,
    conversacion_id: CONVERSACION_ID,
    canal_id: CANAL_ID,
    correo_de: '"Juan Pérez" <juan@cliente.com>',
    correo_message_id: MESSAGE_ID_RFC,
    correo_references: [],
  },
}

function ctxDry(): ContextoEjecucion {
  return {
    empresa_id: EMPRESA_ID,
    ejecucion_id: 'ej-1',
    flujo_id: 'fl-1',
    contexto_inicial: CONTEXTO_INICIAL_CON_MENSAJE,
    dry_run: true,
  }
}

function ctxReal(contexto_inicial = CONTEXTO_INICIAL_CON_MENSAJE): ContextoEjecucion {
  return {
    empresa_id: EMPRESA_ID,
    ejecucion_id: 'ej-1',
    flujo_id: 'fl-1',
    contexto_inicial,
    dry_run: false,
  }
}

/**
 * Mock admin compositivo. Cada tabla devuelve un row preconfigurado.
 * Soporta los métodos encadenables que usan los handlers.
 */
function crearAdmin(
  rows: { plantilla?: object | null; rapida?: object | null; canal?: object | null },
  opciones: { errorAlInsertar?: boolean } = {},
) {
  const inserts: Array<{ tabla: string; data: unknown }> = []
  return {
    inserts,
    admin: {
      from(tabla: string) {
        return {
          select() {
            return {
              eq() {
                return {
                  eq() {
                    return {
                      maybeSingle: async () => {
                        if (tabla === 'plantillas_correo') {
                          return { data: rows.plantilla ?? null, error: null }
                        }
                        if (tabla === 'respuestas_rapidas_correo') {
                          return { data: rows.rapida ?? null, error: null }
                        }
                        if (tabla === 'canales_correo') {
                          return { data: rows.canal ?? null, error: null }
                        }
                        return { data: null, error: null }
                      },
                    }
                  },
                }
              },
            }
          },
          insert(data: unknown) {
            inserts.push({ tabla, data })
            if (opciones.errorAlInsertar) {
              return Promise.resolve({ error: { message: 'fake insert error', code: '23505' } })
            }
            return Promise.resolve({ error: null })
          },
        }
      },
    },
  }
}

// ─── Tests ─────────────────────────────────────────────────────

describe('ejecutarAccion - enviar_correo_plantilla (dry-run)', () => {
  it('no llama a la BD para enviar, devuelve simulado=true con vars resueltas y threading', async () => {
    const { admin, inserts } = crearAdmin({
      plantilla: PLANTILLA_FIXTURE,
      canal: CANAL_FIXTURE,
    })

    const r = await ejecutarAccion(
      { tipo: 'enviar_correo_plantilla', plantilla_id: PLANTILLA_ID },
      ctxDry(),
      admin as never,
    )

    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.resultado.simulado).toBe(true)
    expect(r.resultado.accion_simulada).toBe('enviar_correo_plantilla')
    expect(r.resultado.destinatario).toBe('juan@cliente.com')
    expect(r.resultado.asunto).toBe('Recibimos tu correo, Juan')
    expect(r.resultado.texto).toBe('Hola Juan, te contestaremos a las 9hs.')
    expect(r.resultado.html).toBe('<p>Hola <strong>Juan</strong></p>')
    expect(r.resultado.in_reply_to).toBe(MESSAGE_ID_RFC)
    expect(r.resultado.references).toEqual([MESSAGE_ID_RFC])
    // En dry-run NO debe insertar en `mensajes`.
    expect(inserts).toHaveLength(0)
  })

  it('rechaza con PlantillaNoEncontrada si la plantilla no existe', async () => {
    const { admin } = crearAdmin({ plantilla: null, canal: CANAL_FIXTURE })
    const r = await ejecutarAccion(
      { tipo: 'enviar_correo_plantilla', plantilla_id: 'no-existe' },
      ctxDry(),
      admin as never,
    )
    expect(r.ok).toBe(false)
    if (r.ok) return
    expect(r.error.raw_class).toBe('PlantillaNoEncontrada')
    expect(r.error.transitorio).toBe(false)
  })

  it('rechaza con PlantillaInactiva si está marcada inactiva', async () => {
    const { admin } = crearAdmin({
      plantilla: { ...PLANTILLA_FIXTURE, activo: false },
      canal: CANAL_FIXTURE,
    })
    const r = await ejecutarAccion(
      { tipo: 'enviar_correo_plantilla', plantilla_id: PLANTILLA_ID },
      ctxDry(),
      admin as never,
    )
    expect(r.ok).toBe(false)
    if (r.ok) return
    expect(r.error.raw_class).toBe('PlantillaInactiva')
  })

  it('rechaza con DestinatarioFaltante si el flujo no viene de mensaje entrante y no hay override', async () => {
    const { admin } = crearAdmin({
      plantilla: PLANTILLA_FIXTURE,
      canal: CANAL_FIXTURE,
    })
    const ctxSinMensaje: ContextoEjecucion = {
      empresa_id: EMPRESA_ID,
      ejecucion_id: 'ej-1',
      flujo_id: 'fl-1',
      contexto_inicial: { trigger: { tipo: 'tiempo.cron' } },
      dry_run: true,
    }
    const r = await ejecutarAccion(
      { tipo: 'enviar_correo_plantilla', plantilla_id: PLANTILLA_ID },
      ctxSinMensaje,
      admin as never,
    )
    expect(r.ok).toBe(false)
    if (r.ok) return
    expect(r.error.raw_class).toBe('DestinatarioFaltante')
  })

  it('usa destinatario_override con variables resueltas si está presente', async () => {
    const { admin } = crearAdmin({
      plantilla: PLANTILLA_FIXTURE,
      canal: CANAL_FIXTURE,
    })
    const ctx = ctxDry()
    // Agregar email del contacto al contexto.
    const ctxConEmail: ContextoEjecucion = {
      ...ctx,
      contexto_inicial: {
        ...ctx.contexto_inicial,
        contacto: { nombre: 'Juan', email: 'override@cliente.com' },
      },
    }
    const r = await ejecutarAccion(
      {
        tipo: 'enviar_correo_plantilla',
        plantilla_id: PLANTILLA_ID,
        destinatario_override: '{{contacto.email}}',
      },
      ctxConEmail,
      admin as never,
    )
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.resultado.destinatario).toBe('override@cliente.com')
  })

  it('rechaza con CanalNoEncontrado si el canal_id del mensaje no resuelve', async () => {
    const { admin } = crearAdmin({
      plantilla: PLANTILLA_FIXTURE,
      canal: null,
    })
    const r = await ejecutarAccion(
      { tipo: 'enviar_correo_plantilla', plantilla_id: PLANTILLA_ID },
      ctxDry(),
      admin as never,
    )
    expect(r.ok).toBe(false)
    if (r.ok) return
    expect(r.error.raw_class).toBe('CanalNoEncontrado')
  })

  it('rechaza con CanalDesconectado (transitorio) en path real si estado no es "conectado"', async () => {
    const { admin } = crearAdmin({
      plantilla: PLANTILLA_FIXTURE,
      canal: { ...CANAL_FIXTURE, estado_conexion: 'error' },
    })
    const r = await ejecutarAccion(
      { tipo: 'enviar_correo_plantilla', plantilla_id: PLANTILLA_ID },
      ctxReal(),
      admin as never,
    )
    expect(r.ok).toBe(false)
    if (r.ok) return
    expect(r.error.raw_class).toBe('CanalDesconectado')
    expect(r.error.transitorio).toBe(true)
  })

  it('dry-run con canal "error" sí pasa (no chequea conectividad)', async () => {
    const { admin } = crearAdmin({
      plantilla: PLANTILLA_FIXTURE,
      canal: { ...CANAL_FIXTURE, estado_conexion: 'error' },
    })
    const r = await ejecutarAccion(
      { tipo: 'enviar_correo_plantilla', plantilla_id: PLANTILLA_ID },
      ctxDry(),
      admin as never,
    )
    expect(r.ok).toBe(true)
  })
})

describe('ejecutarAccion - enviar_respuesta_rapida_correo (dry-run)', () => {
  it('devuelve simulado=true con datos de la respuesta rápida', async () => {
    const { admin } = crearAdmin({
      rapida: RAPIDA_FIXTURE,
      canal: CANAL_FIXTURE,
    })
    const r = await ejecutarAccion(
      { tipo: 'enviar_respuesta_rapida_correo', respuesta_rapida_id: RAPIDA_ID },
      ctxDry(),
      admin as never,
    )
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.resultado.accion_simulada).toBe('enviar_respuesta_rapida_correo')
    expect(r.resultado.origen).toBe('respuesta_rapida')
    expect(r.resultado.origen_id).toBe(RAPIDA_ID)
    expect(r.resultado.destinatario).toBe('juan@cliente.com')
    // Respuesta rápida sin asunto → fallback "(Sin asunto)".
    expect(r.resultado.asunto).toBe('(Sin asunto)')
  })

  it('rechaza con RespuestaRapidaNoEncontrada si no existe', async () => {
    const { admin } = crearAdmin({ rapida: null, canal: CANAL_FIXTURE })
    const r = await ejecutarAccion(
      { tipo: 'enviar_respuesta_rapida_correo', respuesta_rapida_id: 'no-existe' },
      ctxDry(),
      admin as never,
    )
    expect(r.ok).toBe(false)
    if (r.ok) return
    expect(r.error.raw_class).toBe('RespuestaRapidaNoEncontrada')
  })
})
