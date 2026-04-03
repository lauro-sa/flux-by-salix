/// Service Worker de Flux by Salix
/// Cache de assets estáticos + estrategia network-first para API

const CACHE_NAME = 'flux-v2'

// Assets estáticos que se cachean en la instalación
const ASSETS_ESTATICOS = [
  '/dashboard',
  '/offline',
  '/login',
  '/manifest.json',
  '/iconos/icon-192.png',
  '/iconos/apple-touch-icon.png',
  '/iconos/favicon.svg',
]

// Instalación — cachear assets estáticos (sin fallar si alguno no carga)
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      Promise.allSettled(
        ASSETS_ESTATICOS.map((url) =>
          fetch(url).then((res) => {
            if (res.ok) return cache.put(url, res)
          }).catch(() => {})
        )
      )
    )
  )
  self.skipWaiting()
})

// Activación — limpiar caches viejos
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  )
  self.clients.claim()
})

// Fetch — network-first para API y navegación, cache-first para assets
self.addEventListener('fetch', (event) => {
  const { request } = event
  const url = new URL(request.url)

  // No cachear requests de Supabase ni API
  if (url.pathname.startsWith('/api/') || url.hostname.includes('supabase')) {
    return
  }

  // Assets estáticos (_next/static) — cache-first
  if (url.pathname.startsWith('/_next/static/')) {
    event.respondWith(
      caches.match(request).then((cached) =>
        cached || fetch(request).then((response) => {
          const clone = response.clone()
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone))
          return response
        })
      )
    )
    return
  }

  // Google Fonts — cache-first (raramente cambian)
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    event.respondWith(
      caches.match(request).then((cached) =>
        cached || fetch(request).then((response) => {
          const clone = response.clone()
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone))
          return response
        })
      )
    )
    return
  }

  // Iconos y splash screens — cache-first
  if (url.pathname.startsWith('/iconos/') || url.pathname.startsWith('/splash/')) {
    event.respondWith(
      caches.match(request).then((cached) =>
        cached || fetch(request).then((response) => {
          const clone = response.clone()
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone))
          return response
        })
      )
    )
    return
  }

  // Navegación y resto — network-first con fallback a cache
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const clone = response.clone()
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone))
          return response
        })
        .catch(() => caches.match(request).then((cached) => cached || caches.match('/offline')))
    )
    return
  }
})

// ─── Push Notifications ───
// Recibe notificaciones push y muestra una notificación nativa del SO.

self.addEventListener('push', (event) => {
  if (!event.data) return

  try {
    const datos = event.data.json()
    const titulo = datos.titulo || 'Flux'
    const opciones = {
      body: datos.cuerpo || '',
      icon: datos.icono || '/iconos/icon-192.png',
      badge: datos.insignia || '/iconos/icon-192.png',
      tag: datos.url || 'flux-notificacion',
      data: { url: datos.url || '/' },
      vibrate: [200, 100, 200],
      renotify: true,
    }

    event.waitUntil(self.registration.showNotification(titulo, opciones))
  } catch {
    // Si el payload no es JSON, mostrar como texto plano
    const texto = event.data.text()
    event.waitUntil(
      self.registration.showNotification('Flux', { body: texto })
    )
  }
})

// Click en la notificación — abrir la URL correspondiente
self.addEventListener('notificationclick', (event) => {
  event.notification.close()

  const url = event.notification.data?.url || '/'

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientes) => {
      // Si ya hay una ventana abierta, navegar ahí
      for (const cliente of clientes) {
        if (cliente.url.includes(self.location.origin)) {
          cliente.focus()
          cliente.navigate(url)
          return
        }
      }
      // Si no hay ventana, abrir una nueva
      return self.clients.openWindow(url)
    })
  )
})
