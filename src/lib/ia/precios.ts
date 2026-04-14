/**
 * Precios estimados por modelo de IA (USD por millón de tokens).
 * Se usa para mostrar costos aproximados en el dashboard de consumo.
 * Actualizar manualmente cuando los proveedores cambien precios.
 */

export const PRECIOS_MODELOS: Record<string, { entrada: number; salida: number }> = {
  // Anthropic
  'claude-sonnet-4-20250514':  { entrada: 3.00,  salida: 15.00 },
  'claude-haiku-4-5-20251001': { entrada: 0.80,  salida: 4.00  },
  'claude-opus-4-20250514':    { entrada: 15.00, salida: 75.00 },
  // OpenAI
  'gpt-4o':      { entrada: 2.50,  salida: 10.00 },
  'gpt-4o-mini': { entrada: 0.15,  salida: 0.60  },
  'gpt-4-turbo': { entrada: 10.00, salida: 30.00 },
  // Google
  'gemini-2.0-flash': { entrada: 0.10, salida: 0.40 },
  'gemini-2.0-pro':   { entrada: 1.25, salida: 5.00 },
  'gemini-1.5-pro':   { entrada: 1.25, salida: 5.00 },
  // xAI
  'grok-3':      { entrada: 3.00, salida: 15.00 },
  'grok-3-mini': { entrada: 0.30, salida: 0.50  },
}

/** Calcula el costo estimado en USD a partir de tokens y modelo */
export function calcularCostoEstimado(
  modelo: string,
  tokensEntrada: number,
  tokensSalida: number,
): number {
  const precio = PRECIOS_MODELOS[modelo]
  if (!precio) return 0
  return (tokensEntrada / 1_000_000) * precio.entrada
       + (tokensSalida / 1_000_000) * precio.salida
}

/** Formatea un número de tokens para mostrar: 1234567 → "1.2M", 12345 → "12.3K" */
export function formatearTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return n.toString()
}

/** Formatea costo USD: 2.4 → "US$ 2.40", 0.005 → "< US$ 0.01" */
export function formatearCosto(usd: number): string {
  if (usd > 0 && usd < 0.01) return '< US$ 0.01'
  return `US$ ${usd.toFixed(2)}`
}

/** URLs de facturación/consola de cada proveedor */
export const ENLACES_FACTURACION: Record<string, { url: string; etiqueta: string }> = {
  anthropic: { url: 'https://console.anthropic.com/settings/billing', etiqueta: 'Consola de Anthropic' },
  openai:    { url: 'https://platform.openai.com/settings/organization/billing/overview', etiqueta: 'Billing de OpenAI' },
  google:    { url: 'https://aistudio.google.com/apikey', etiqueta: 'Google AI Studio' },
  xai:       { url: 'https://console.x.ai', etiqueta: 'Consola de xAI' },
}
