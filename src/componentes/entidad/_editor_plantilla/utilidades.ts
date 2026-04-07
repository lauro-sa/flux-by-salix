/**
 * Funciones utilitarias del editor de plantillas.
 * Formato de moneda, fecha, iniciales, color de avatar, formato/compactación HTML.
 */

import { COLORES_AVATAR } from './constantes'

// ─── Formato de moneda para la vista previa ───

export function formatoMoneda(valor: string | null | undefined, moneda?: string, locale: string = 'es-AR'): string {
  if (!valor) return ''
  const num = Number(valor)
  if (isNaN(num)) return valor
  const simbolo = moneda === 'USD' ? 'US$' : moneda === 'EUR' ? '€' : '$'
  return `${simbolo} ${num.toLocaleString(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

// ─── Formato de fecha para la vista previa ───

export function formatoFecha(valor: string | null | undefined, locale: string = 'es-AR'): string {
  if (!valor) return ''
  try {
    const d = new Date(valor)
    return d.toLocaleDateString(locale, { day: '2-digit', month: '2-digit', year: 'numeric' })
  } catch { return valor }
}

// ─── Iniciales para avatar ───

export function iniciales(nombre: string, apellido?: string | null): string {
  const n = (nombre || '').charAt(0).toUpperCase()
  const a = (apellido || '').charAt(0).toUpperCase()
  return `${n}${a}` || '?'
}

// ─── Color determinista para avatar basado en nombre ───

export function colorAvatar(nombre: string): string {
  let hash = 0
  for (let i = 0; i < nombre.length; i++) hash = nombre.charCodeAt(i) + ((hash << 5) - hash)
  return COLORES_AVATAR[Math.abs(hash) % COLORES_AVATAR.length]
}

// ─── Formatear HTML para que sea legible en textarea ───

export function formatearHtml(html: string): string {
  return html
    .replace(/<\/(p|div|h[1-6]|ul|ol|li|blockquote|table|tr|thead|tbody)>/gi, '</$1>\n')
    .replace(/<br\s*\/?>/gi, '<br/>\n')
    .replace(/<hr\s*\/?>/gi, '<hr/>\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

// ─── Compactar HTML al volver al editor visual ───

export function compactarHtml(html: string): string {
  return html
    .split('\n')
    .map(l => l.trim())
    .filter(l => l.length > 0)
    .join('')
}
