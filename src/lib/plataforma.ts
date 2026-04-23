/**
 * plataforma — helpers para detectar el tipo de dispositivo y ejecutar
 * acciones de contacto (llamar, WhatsApp, correo, navegar) de forma
 * adecuada a cada plataforma.
 *
 * Usado por las acciones rápidas del panel de Salix IA: en móvil dispara
 * protocolos nativos (tel:, wa.me, mailto:, maps); en PC cae a copiar al
 * portapapeles o abrir la versión web cuando corresponde.
 */

/** ¿El dispositivo es táctil sin hover? (móvil/tablet) */
export function esDispositivoTactil(): boolean {
  if (typeof window === 'undefined') return false
  return window.matchMedia('(hover: none) and (pointer: coarse)').matches
}

/** Quita todo lo que no sea dígito o + inicial (para tel:/wa.me) */
export function normalizarTelefono(numero: string): string {
  const limpio = numero.trim().replace(/[^\d+]/g, '')
  // wa.me no acepta el + inicial, pero tel: sí — devolvemos sin +
  return limpio.startsWith('+') ? limpio.slice(1) : limpio
}

/** Copia texto al portapapeles. Devuelve true si tuvo éxito. */
export async function copiarAlPortapapeles(texto: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(texto)
      return true
    }
    // Fallback muy viejo
    const input = document.createElement('textarea')
    input.value = texto
    input.style.position = 'fixed'
    input.style.opacity = '0'
    document.body.appendChild(input)
    input.select()
    const ok = document.execCommand('copy')
    document.body.removeChild(input)
    return ok
  } catch {
    return false
  }
}

export type ResultadoAccion = {
  exito: boolean
  /** Mensaje listo para mostrar en toast */
  mensaje: string
  /** Tipo de toast recomendado */
  tipo: 'exito' | 'error' | 'info'
}

/**
 * Llamar a un número.
 * - Móvil: tel:<numero> dispara la app de llamadas.
 * - PC: copia al portapapeles (no hay cliente nativo útil).
 */
export async function accionLlamar(numero: string): Promise<ResultadoAccion> {
  const limpio = normalizarTelefono(numero)
  if (!limpio) return { exito: false, mensaje: 'Número inválido', tipo: 'error' }

  if (esDispositivoTactil()) {
    window.location.href = `tel:+${limpio}`
    return { exito: true, mensaje: 'Abriendo llamada…', tipo: 'info' }
  }

  const copiado = await copiarAlPortapapeles(`+${limpio}`)
  return copiado
    ? { exito: true, mensaje: `Número copiado: +${limpio}`, tipo: 'exito' }
    : { exito: false, mensaje: 'No se pudo copiar el número', tipo: 'error' }
}

/**
 * Abrir conversación de WhatsApp.
 * - Móvil: wa.me/<num> abre la app nativa.
 * - PC: wa.me/<num> (redirige a WhatsApp Desktop si está instalado,
 *       si no, a web.whatsapp.com). Evitamos whatsapp:// porque dispara
 *       un prompt "abrir aplicación" que falla silenciosamente si no hay app.
 */
export function accionWhatsApp(numero: string, mensaje?: string): ResultadoAccion {
  const limpio = normalizarTelefono(numero)
  if (!limpio) return { exito: false, mensaje: 'Número inválido', tipo: 'error' }

  const sufijo = mensaje ? `?text=${encodeURIComponent(mensaje)}` : ''
  window.open(`https://wa.me/${limpio}${sufijo}`, '_blank', 'noopener,noreferrer')
  return { exito: true, mensaje: 'Abriendo WhatsApp…', tipo: 'info' }
}

/**
 * Enviar correo.
 * - mailto: funciona en todas las plataformas si hay cliente configurado.
 * - En PC sin cliente, no pasa nada: dejamos fallback a copiar al hacer
 *   click secundario (el caller decide si ofrece "copiar correo").
 */
export function accionCorreo(correo: string, asunto?: string): ResultadoAccion {
  const limpio = correo.trim().toLowerCase()
  if (!limpio) return { exito: false, mensaje: 'Correo inválido', tipo: 'error' }

  const sufijo = asunto ? `?subject=${encodeURIComponent(asunto)}` : ''
  window.location.href = `mailto:${limpio}${sufijo}`
  return { exito: true, mensaje: 'Abriendo correo…', tipo: 'info' }
}

/** Copia un correo al portapapeles (fallback útil para PC sin cliente). */
export async function accionCopiarCorreo(correo: string): Promise<ResultadoAccion> {
  const limpio = correo.trim().toLowerCase()
  const copiado = await copiarAlPortapapeles(limpio)
  return copiado
    ? { exito: true, mensaje: `Correo copiado: ${limpio}`, tipo: 'exito' }
    : { exito: false, mensaje: 'No se pudo copiar el correo', tipo: 'error' }
}

/**
 * Abrir Google Maps con la dirección indicada.
 * El URL de "search" abre la app de Maps en móvil si está instalada,
 * y cae a la versión web cuando no.
 */
export function accionNavegar(direccion: string): ResultadoAccion {
  const limpia = direccion.trim()
  if (!limpia) return { exito: false, mensaje: 'Sin dirección', tipo: 'error' }

  const url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(limpia)}`
  window.open(url, '_blank', 'noopener,noreferrer')
  return { exito: true, mensaje: 'Abriendo Google Maps…', tipo: 'info' }
}
