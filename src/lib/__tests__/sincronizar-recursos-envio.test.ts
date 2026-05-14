/**
 * Tests de `sincronizarRecursosEnvio` — helper que regenera PDF + PDF
 * congelado + link del portal cuando un presupuesto se va a enviar.
 *
 * Validamos:
 *   - Si `documentoDesactualizado=false` y las 3 URLs vienen, devuelve
 *     `ok` sin llamar a la API (atajo de performance: Puppeteer pesa).
 *   - Si `documentoDesactualizado=true`, llama a `/pdf` con `forzar`
 *     para ambos modos (principal + congelado) y al portal.
 *   - Si solo falta una URL, regenera SOLO esa.
 *   - Si la API devuelve error en alguna llamada, el helper devuelve
 *     `error` con mensaje compuesto y preserva las URLs ya obtenidas.
 *   - Sin `presupuestoId` → error inmediato.
 */

import { describe, expect, it, vi, beforeEach } from 'vitest'
import { sincronizarRecursosEnvio } from '../presupuestos/sincronizar-recursos-envio'

const PRESUPUESTO_ID = 'presu-uuid-1'

interface RespuestaFake {
  ok?: boolean
  body?: Record<string, unknown>
  status?: number
}

function fetchMock(rutaAPI: Record<string, RespuestaFake>) {
  return vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input.toString()
    // El primer fragmento de la ruta es lo que distingue (pdf con body distinto
    // se diferencia por el cuerpo). Probamos por método + url + cuerpo.
    const body = init?.body ? JSON.parse(init.body as string) : null
    let clave = url
    if (url.endsWith('/pdf')) {
      clave = body?.congelado ? `${url}#congelado` : `${url}#principal`
    }
    const r = rutaAPI[clave]
    if (!r) throw new Error(`fetch sin mock: ${clave}`)
    return {
      ok: r.ok ?? true,
      status: r.status ?? 200,
      json: async () => r.body ?? {},
    } as unknown as Response
  })
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('sincronizarRecursosEnvio', () => {
  it('si no está desactualizado y todas las URLs están → devuelve ok sin fetch', async () => {
    const fetchImpl = vi.fn() as unknown as typeof fetch
    const res = await sincronizarRecursosEnvio({
      presupuestoId: PRESUPUESTO_ID,
      documentoDesactualizado: false,
      pdfActualUrl: 'https://x/pdf.pdf',
      pdfCongeladoActualUrl: 'https://x/congelado.pdf',
      portalActualUrl: 'https://x/portal',
      fetchImpl,
    })

    expect(res.estado).toBe('ok')
    expect(res.pdfUrl).toBe('https://x/pdf.pdf')
    expect(res.pdfCongeladoUrl).toBe('https://x/congelado.pdf')
    expect(res.portalUrl).toBe('https://x/portal')
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it('si desactualizado=true regenera ambos PDFs (forzar) pero reutiliza portal si está en memoria', async () => {
    const fetchImpl = fetchMock({
      [`/api/presupuestos/${PRESUPUESTO_ID}/pdf#principal`]: { body: { url: 'https://x/nuevo.pdf' } },
      [`/api/presupuestos/${PRESUPUESTO_ID}/pdf#congelado`]: { body: { url: 'https://x/cong.pdf' } },
    })

    const res = await sincronizarRecursosEnvio({
      presupuestoId: PRESUPUESTO_ID,
      documentoDesactualizado: true,
      pdfActualUrl: 'https://x/viejo.pdf',
      pdfCongeladoActualUrl: 'https://x/cviejo.pdf',
      portalActualUrl: 'https://x/portal-viejo',
      fetchImpl: fetchImpl as unknown as typeof fetch,
    })

    expect(res).toEqual({
      estado: 'ok',
      pdfUrl: 'https://x/nuevo.pdf',
      pdfCongeladoUrl: 'https://x/cong.pdf',
      portalUrl: 'https://x/portal-viejo',
    })

    // 2 llamadas (los 2 PDFs); el portal NO se vuelve a pedir porque su
    // token sigue activo y la URL ya estaba en memoria.
    expect(fetchImpl).toHaveBeenCalledTimes(2)
    const llamadas = (fetchImpl as unknown as { mock: { calls: unknown[][] } }).mock.calls
    const pdfCalls = llamadas.filter(c => (c[0] as string).endsWith('/pdf'))
    for (const c of pdfCalls) {
      const body = JSON.parse((c[1] as RequestInit).body as string)
      expect(body.forzar).toBe(true)
    }
    expect(pdfCalls).toHaveLength(2)
  })

  it('si desactualizado=true y no hay portal en memoria, también pide portal', async () => {
    const fetchImpl = fetchMock({
      [`/api/presupuestos/${PRESUPUESTO_ID}/pdf#principal`]: { body: { url: 'https://x/nuevo.pdf' } },
      [`/api/presupuestos/${PRESUPUESTO_ID}/pdf#congelado`]: { body: { url: 'https://x/cong.pdf' } },
      [`/api/presupuestos/${PRESUPUESTO_ID}/portal`]: { body: { url: 'https://x/portal' } },
    })

    const res = await sincronizarRecursosEnvio({
      presupuestoId: PRESUPUESTO_ID,
      documentoDesactualizado: true,
      fetchImpl: fetchImpl as unknown as typeof fetch,
    })

    expect(res.estado).toBe('ok')
    expect(res.portalUrl).toBe('https://x/portal')
    expect(fetchImpl).toHaveBeenCalledTimes(3)
  })

  it('regenera solo lo que falta cuando no está desactualizado pero alguna URL falta', async () => {
    const fetchImpl = fetchMock({
      [`/api/presupuestos/${PRESUPUESTO_ID}/portal`]: { body: { url: 'https://x/portal-nuevo' } },
    })

    const res = await sincronizarRecursosEnvio({
      presupuestoId: PRESUPUESTO_ID,
      documentoDesactualizado: false,
      pdfActualUrl: 'https://x/pdf.pdf',
      pdfCongeladoActualUrl: 'https://x/cong.pdf',
      portalActualUrl: null,
      fetchImpl: fetchImpl as unknown as typeof fetch,
    })

    expect(res.estado).toBe('ok')
    expect(res.portalUrl).toBe('https://x/portal-nuevo')
    expect(res.pdfUrl).toBe('https://x/pdf.pdf')
    expect(fetchImpl).toHaveBeenCalledTimes(1)
  })

  it('si la API devuelve error en alguna llamada → estado=error con mensaje compuesto', async () => {
    const fetchImpl = fetchMock({
      [`/api/presupuestos/${PRESUPUESTO_ID}/pdf#principal`]: {
        ok: false,
        status: 500,
        body: { error: 'puppeteer crashed' },
      },
      [`/api/presupuestos/${PRESUPUESTO_ID}/pdf#congelado`]: { body: { url: 'https://x/cong.pdf' } },
      [`/api/presupuestos/${PRESUPUESTO_ID}/portal`]: { body: { url: 'https://x/portal' } },
    })

    const res = await sincronizarRecursosEnvio({
      presupuestoId: PRESUPUESTO_ID,
      documentoDesactualizado: true,
      fetchImpl: fetchImpl as unknown as typeof fetch,
    })

    expect(res.estado).toBe('error')
    expect(res.mensaje).toMatch(/puppeteer crashed/)
    // Las URLs que sí se obtuvieron se preservan.
    expect(res.pdfCongeladoUrl).toBe('https://x/cong.pdf')
    expect(res.portalUrl).toBe('https://x/portal')
  })

  it('fetch que tira excepción → estado=error con mensaje', async () => {
    const fetchImpl = vi.fn(async () => {
      throw new Error('network down')
    }) as unknown as typeof fetch

    const res = await sincronizarRecursosEnvio({
      presupuestoId: PRESUPUESTO_ID,
      documentoDesactualizado: true,
      fetchImpl,
    })

    expect(res.estado).toBe('error')
    expect(res.mensaje).toMatch(/network down/)
  })

  it('sin presupuestoId → estado=error inmediato', async () => {
    const fetchImpl = vi.fn() as unknown as typeof fetch
    const res = await sincronizarRecursosEnvio({
      presupuestoId: '',
      fetchImpl,
    })
    expect(res.estado).toBe('error')
    expect(fetchImpl).not.toHaveBeenCalled()
  })
})
