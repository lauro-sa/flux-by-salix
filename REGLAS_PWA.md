# Reglas PWA — Flux by Salix

> Referencia para cualquier editor de código. Estas reglas se aprendieron con prueba y error real en iOS 26 (iPhone 17 Pro Max) y Android.

---

## 1. Safe Areas — La solución oficial

La UNICA forma correcta de manejar safe areas en PWA iOS es en el `html`:

```css
html {
  min-height: calc(100% + env(safe-area-inset-top));
  padding: env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left);
}
```

- Ref: https://dev.to/karmasakshi/make-your-pwas-look-handsome-on-ios-1o08
- Esto elimina el gap negro inferior en PWA standalone
- El html se estira para incluir el safe-area, y los paddings protegen el contenido

**NUNCA hacer esto:**
- Padding de safe-area en wrappers con `overflow: hidden` → crea gaps negros
- JS condicional en render (`typeof window`, `useEsMovil`, `matchMedia`) → hydration mismatch
- `padding-top` dentro de un header con `h-14` fija → contenido negativo, layout roto

---

## 2. Viewport meta tag

```tsx
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover', // ESENCIAL para safe areas
}
```

- `viewport-fit: cover` es OBLIGATORIO para que `env(safe-area-inset-*)` funcione
- `maximumScale: 1` + `userScalable: false` evita zoom accidental en PWA
- Para evitar zoom de Safari en inputs: `--texto-sm` debe ser >= 16px (1rem) en mobile

---

## 3. Apple meta tags

```tsx
appleWebApp: {
  capable: true,
  statusBarStyle: 'black-translucent', // status bar se funde con la app
  title: 'Flux',
}
```

- `black-translucent` = la app pinta detrás del status bar (necesita viewport-fit: cover)
- `mobile-web-app-capable: yes` para Chrome/Android

---

## 4. Layout responsive (CSS puro, sin JS)

```css
/* Mobile browser: documento scrollea → Safari compacta toolbar */
.layout-app {
  background-color: var(--superficie-app);
  min-height: 100dvh;
}

/* Desktop: layout fijo con scroll interno */
@media (min-width: 768px) {
  .layout-app {
    height: 100dvh;
    overflow: hidden;
  }
}

/* PWA standalone: layout fijo, safe areas manejadas por html */
@media (display-mode: standalone) {
  .layout-app {
    height: 100%;
    overflow: hidden;
  }
}
```

**Regla de oro:** Toda la lógica de layout se resuelve con CSS media queries. NUNCA con JS condicional en el render (causa hydration mismatch en Next.js SSR).

---

## 5. Safari toolbar transparente (browser, no PWA)

Para que Safari muestre su toolbar transparente con contenido visible detrás:

- El documento debe scrollear (NO usar `overflow: hidden` en el wrapper en mobile)
- `overscroll-behavior: none` SOLO en `@media (display-mode: standalone)` (en browser bloquea el scroll nativo)
- Agregar `padding-bottom` al main en mobile browser para que el último contenido no quede detrás de la toolbar

---

## 6. Theme color dinámico

```html
<meta name="theme-color" content="#ffffff" media="(prefers-color-scheme: light)" />
<meta name="theme-color" content="#000000" media="(prefers-color-scheme: dark)" />
```

- Los meta tags se sincronizan en runtime cuando el usuario cambia tema (en `useTema.tsx`)
- Script anti-FOUC con `next/script` strategy `beforeInteractive` lee tema de localStorage ANTES de React

---

## 7. Scroll lock en modales (iOS)

`document.body.style.overflow = 'hidden'` NO funciona en iOS Safari. La solución:

```ts
// position:fixed en body + guardar/restaurar scrollY
body.style.position = 'fixed'
body.style.top = `-${scrollY}px`
// ... al cerrar: restaurar y window.scrollTo(0, scrollY)
```

Hook: `useScrollLockiOS(abierto: boolean)` — usado en Modal, BottomSheet, MenuMovil.

---

## 8. Inputs — Prevenir zoom Safari

Safari hace zoom automático si `font-size < 16px` al enfocar un input. Solución:

```css
/* En tokens.css, mobile */
--texto-sm: 1rem; /* 16px — mínimo para evitar auto-zoom */
```

NO usar `font-size: max(16px, 1em) !important` en inputs — hace los bullets de password grotescos.

---

## 9. Banner de instalación

- `fixed bottom-6` — flota encima de la toolbar de Safari
- `bg-superficie-elevada/95 backdrop-blur-md` — translúcido
- Sin `paddingBottom` de safe-area (causa rectángulo oscuro extra)
- Se oculta por 7 días al descartar (localStorage)
- iOS: muestra 3 pasos (··· → Compartir → Agregar a Inicio)
- Android/Chrome: prompt nativo con `beforeinstallprompt`

---

## 10. Service Worker

- Cache v2: assets estáticos, fuentes, iconos, splash, login
- Network-first para navegación con fallback a `/offline`
- Cache-first para `/_next/static/`, fuentes Google, iconos
- NO cachear requests de Supabase ni `/api/`
- Push notifications con Firebase Cloud Messaging (FCM → APNs para iOS)

---

## 11. Splash screens

PNG por resolución de iPhone, referenciados con `apple-touch-startup-image` + media queries por device-width/height/pixel-ratio.

---

## 12. Manifest

```json
{
  "display": "standalone",
  "background_color": "#ffffff",
  "theme_color": "#ffffff",
  "orientation": "any"
}
```

- `background_color` y `theme_color` en blanco (para modo claro, que es el splash por defecto)
- Iconos: `purpose: "any"` y `purpose: "maskable"` separados

---

## Checklist rápido

- [ ] `viewport-fit: cover` en viewport meta
- [ ] `apple-mobile-web-app-capable: yes`
- [ ] `apple-mobile-web-app-status-bar-style: black-translucent`
- [ ] `html { min-height: calc(100% + env(safe-area-inset-top)); padding: env(...) }`
- [ ] `overscroll-behavior: none` solo en `@media (display-mode: standalone)`
- [ ] Layout mobile browser: `min-height: 100dvh` sin overflow hidden
- [ ] Layout desktop: `height: 100dvh; overflow: hidden`
- [ ] Layout PWA: `height: 100%; overflow: hidden`
- [ ] Inputs: font-size >= 16px en mobile
- [ ] Theme-color meta tags con media queries light/dark
- [ ] Script anti-FOUC con next/script beforeInteractive
- [ ] Scroll lock iOS con position:fixed (no overflow:hidden)
