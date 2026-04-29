// Helper para abrir enlaces externos (Google Maps, WhatsApp, tel:, etc.)
// desde la PWA sin que la pantalla quede en blanco al volver.
//
// En PWA standalone iOS, `window.open(url, '_blank')` tiene un bug donde
// abre la URL en Safari/Maps pero al volver, el WebView de la PWA queda
// pintado en blanco hasta que se cierra y reabre. Disparar un click sobre
// un <a> con target="_blank" se trata como navegación intencional del
// usuario y preserva correctamente el estado de la PWA al volver.

/**
 * Abre una URL externa de la forma más segura para PWA standalone iOS.
 * Si por algún motivo el click sintético falla, cae a window.open.
 */
export function abrirEnlaceExterno(url: string) {
  if (typeof document === 'undefined') return

  try {
    const a = document.createElement('a')
    a.href = url
    a.target = '_blank'
    a.rel = 'noopener noreferrer'
    a.style.display = 'none'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
  } catch {
    window.open(url, '_blank', 'noopener,noreferrer')
  }
}
