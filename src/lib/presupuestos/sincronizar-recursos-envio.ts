/**
 * Coordina la regeneración de los recursos asociados al envío de un
 * presupuesto: PDF actual (visible), PDF congelado (adjunto inmutable)
 * y link público del portal. El editor lo invoca antes de abrir el
 * modal "Enviar documento" para asegurar que lo que ve el cliente es
 * la última versión del presupuesto.
 *
 * Por qué existe:
 *   - El PDF se genera con Puppeteer (server-side) y vive en Storage.
 *   - El PDF "congelado" se sube a una ruta separada y se adjunta al
 *     chatter como prueba inmutable de qué se envió al cliente.
 *   - El portal público necesita un token activo no vencido (30 días).
 *   Si alguno está desactualizado, el cliente vería información vieja
 *   o un link roto.
 *
 * Decisión clave: si `documentoDesactualizado === false` y todas las
 * URLs actuales están en memoria, el helper devuelve estado `'ok'` sin
 * llamar a Puppeteer (la regeneración pesa varios segundos). Solo
 * regenera lo que falta o está desactualizado. Esto preserva el
 * "atajo" del editor que ya está implementado (línea 1302 de
 * EditorPresupuesto: si `yaPreparado` no llama al helper).
 */

export type EstadoSincronizacionEnvio = 'ok' | 'sincronizando' | 'desactualizado' | 'error'

export interface ResultadoSincronizacionEnvio {
  estado: EstadoSincronizacionEnvio
  pdfUrl?: string | null
  pdfCongeladoUrl?: string | null
  portalUrl?: string | null
  mensaje?: string | null
}

interface ArgsSincronizarRecursosEnvio {
  presupuestoId: string
  /** Si true: regenerar PDF + PDF congelado forzando aunque ya existan,
   *  porque el presupuesto cambió desde el último envío. */
  documentoDesactualizado?: boolean
  /** URLs actuales en memoria del editor — si faltan se piden/generan. */
  pdfActualUrl?: string | null
  pdfCongeladoActualUrl?: string | null
  portalActualUrl?: string | null
  /** Override del cliente fetch para tests. Default: global fetch. */
  fetchImpl?: typeof fetch
}

async function pedirPdf(
  presupuestoId: string,
  opciones: { forzar?: boolean; congelado?: boolean },
  fetchImpl: typeof fetch,
): Promise<{ url: string | null; error?: string }> {
  try {
    const res = await fetchImpl(`/api/presupuestos/${presupuestoId}/pdf`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(opciones),
    })
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { error?: string }
      return { url: null, error: body?.error || `PDF: HTTP ${res.status}` }
    }
    const data = (await res.json()) as { url?: string | null }
    return { url: data.url ?? null }
  } catch (err) {
    return { url: null, error: err instanceof Error ? err.message : 'Error de red al generar PDF' }
  }
}

async function pedirPortal(
  presupuestoId: string,
  fetchImpl: typeof fetch,
): Promise<{ url: string | null; error?: string }> {
  try {
    const res = await fetchImpl(`/api/presupuestos/${presupuestoId}/portal`, { method: 'POST' })
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { error?: string }
      return { url: null, error: body?.error || `Portal: HTTP ${res.status}` }
    }
    const data = (await res.json()) as { url?: string | null }
    return { url: data.url ?? null }
  } catch (err) {
    return { url: null, error: err instanceof Error ? err.message : 'Error de red al generar portal' }
  }
}

export async function sincronizarRecursosEnvio(
  args: ArgsSincronizarRecursosEnvio,
): Promise<ResultadoSincronizacionEnvio> {
  const {
    presupuestoId,
    documentoDesactualizado = false,
    pdfActualUrl = null,
    pdfCongeladoActualUrl = null,
    portalActualUrl = null,
    fetchImpl = fetch,
  } = args

  if (!presupuestoId) {
    return { estado: 'error', mensaje: 'Falta el id del presupuesto' }
  }

  // Si el documento NO está desactualizado y tenemos las 3 URLs, no toca nada.
  if (!documentoDesactualizado && pdfActualUrl && pdfCongeladoActualUrl && portalActualUrl) {
    return {
      estado: 'ok',
      pdfUrl: pdfActualUrl,
      pdfCongeladoUrl: pdfCongeladoActualUrl,
      portalUrl: portalActualUrl,
    }
  }

  // Sino, regeneramos en paralelo:
  //   - PDF principal: solo si está desactualizado o no existe.
  //   - PDF congelado: idem.
  //   - Portal: solo si no hay URL en memoria (el endpoint ya reutiliza
  //     tokens activos no vencidos, así que es seguro pedirlo siempre).
  const necesitaPdf = documentoDesactualizado || !pdfActualUrl
  const necesitaCongelado = documentoDesactualizado || !pdfCongeladoActualUrl
  const necesitaPortal = !portalActualUrl

  const tareas: Array<Promise<{ tipo: 'pdf' | 'congelado' | 'portal'; url: string | null; error?: string }>> = []

  if (necesitaPdf) {
    tareas.push(
      pedirPdf(presupuestoId, { forzar: documentoDesactualizado }, fetchImpl).then(r => ({ tipo: 'pdf' as const, ...r })),
    )
  }
  if (necesitaCongelado) {
    tareas.push(
      pedirPdf(presupuestoId, { congelado: true, forzar: documentoDesactualizado }, fetchImpl).then(r => ({
        tipo: 'congelado' as const,
        ...r,
      })),
    )
  }
  if (necesitaPortal) {
    tareas.push(pedirPortal(presupuestoId, fetchImpl).then(r => ({ tipo: 'portal' as const, ...r })))
  }

  const resultados = await Promise.all(tareas)

  const indexado = new Map(resultados.map(r => [r.tipo, r]))
  const errores = resultados.filter(r => r.error).map(r => `${r.tipo}: ${r.error}`)

  if (errores.length > 0) {
    return {
      estado: 'error',
      pdfUrl: indexado.get('pdf')?.url ?? pdfActualUrl,
      pdfCongeladoUrl: indexado.get('congelado')?.url ?? pdfCongeladoActualUrl,
      portalUrl: indexado.get('portal')?.url ?? portalActualUrl,
      mensaje: errores.join(' · '),
    }
  }

  return {
    estado: 'ok',
    pdfUrl: indexado.get('pdf')?.url ?? pdfActualUrl,
    pdfCongeladoUrl: indexado.get('congelado')?.url ?? pdfCongeladoActualUrl,
    portalUrl: indexado.get('portal')?.url ?? portalActualUrl,
  }
}
