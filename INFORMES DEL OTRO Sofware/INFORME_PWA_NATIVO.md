# Informe: PWA, Mobile y Preparación para Apps Nativas

**Fecha:** 25 de marzo de 2026
**Proyecto:** Flux by Salix

---

## 1. Estado actual de la base de datos

### Lo que tenemos
- **4 tablas core:** `empresas`, `perfiles`, `miembros`, `invitaciones` + `preferencias_usuario`
- **Multi-tenant con RLS:** Cada tabla usa `empresa_id` con políticas Row Level Security
- **JWT custom claims:** `empresa_activa_id`, `rol`, `es_superadmin` en el token
- **3 clientes Supabase:** navegador (anon), servidor (session), admin (service role)
- **Drizzle ORM** para tipado fuerte del schema

### Veredicto: La BD SÍ sirve para nativo
La base de datos PostgreSQL con Supabase es **completamente agnóstica al frontend**. Las tablas, RLS, índices y relaciones funcionarían igual para una app web, PWA, iOS o Android. No hay nada que cambiar en la BD.

---

## 2. ¿Sirve para una PWA?

### Estado actual: NO hay PWA configurada (0/10)

| Componente PWA | Estado |
|---|---|
| `manifest.json` | No existe |
| Service Worker | No existe |
| Iconos (192x192, 512x512) | No existen |
| Plugin `next-pwa` o similar | No instalado |
| Soporte offline | No implementado |
| Push notifications | No implementado |

### ¿Qué se necesita para PWA?

**Esfuerzo estimado: 1-2 días de trabajo**

1. **`public/manifest.json`** — nombre, iconos, colores, orientación
2. **Service Worker** — cache de assets estáticos, manejo offline básico
3. **Plugin `@ducanh2912/next-pwa`** — integración con Next.js 15
4. **Iconos** — set completo para iOS y Android
5. **Meta tags** — `apple-mobile-web-app-capable`, etc.

### ¿Funciona bien en iOS/Android como PWA?

**Limitaciones importantes de PWA en iOS:**
- No hay push notifications reales (solo desde iOS 16.4+, limitado)
- No acceso a contactos, SMS, Bluetooth
- Safari limita el storage a ~50MB
- Las PWA se "matan" en background frecuentemente
- No aparece en la App Store

**En Android las PWA funcionan mucho mejor:**
- Push notifications completas
- Instalación desde Chrome con prompt nativo
- Acceso a más APIs del dispositivo
- Puede publicarse en Play Store vía TWA (Trusted Web Activity)

---

## 3. ¿La web actual es responsive?

### Puntuación: 5.5/10

| Aspecto | Nota | Detalle |
|---|---|---|
| Viewport config | 8/10 | Meta tags correctos, usa `dvh` |
| Breakpoints responsive | 5/10 | Solo ~30 instancias de `md:`/`lg:` en todo el código |
| Componentes móviles | 7/10 | Sidebar drawer, BottomSheet, modales responsivos |
| Interacciones táctiles | 7/10 | DnD con touch, vibración, sonido |
| Tamaño de tap targets | 3/10 | Muchos botones por debajo de 44x44px |
| Dark/Light mode | 9/10 | Sistema completo de tokens |
| Accesibilidad (ARIA) | 2/10 | Casi nula |
| PWA | 0/10 | No existe |
| CSS/Tokens | 9/10 | Excelente sistema semántico |

### Lo que funciona bien en móvil
- **Sidebar:** Se convierte en drawer en móvil, con drag-and-drop táctil
- **BottomSheet:** Componente nativo para móvil (sube desde abajo)
- **Auth layout:** Se apila verticalmente en móvil
- **Migajas:** En móvil muestra botón "atrás" + título, en desktop la ruta completa
- **Temas:** Dark/light automático + manual, con efectos cristal

### Lo que necesita mejora
- **Tap targets pequeños:** Botones de sidebar (~24px), iconos del header (~32px)
- **Pocas media queries:** La mayoría del layout no tiene breakpoints
- **Sin gestos swipe:** No hay swipe para cerrar drawer ni pull-to-refresh
- **Sin `inputmode`:** Los campos de teléfono no abren teclado numérico
- **Sin `<Image>` de Next.js:** Las imágenes no están optimizadas

---

## 4. ¿La arquitectura soporta una app nativa?

### Estado actual: NO es API-first

**Problema principal:** Los componentes del frontend consultan Supabase directamente desde el navegador, sin pasar por una API centralizada.

```
Patrón actual (web):
  React Component → supabase.from('tabla').select() → BD

Lo que necesita una app nativa:
  App iOS/Android → API REST/GraphQL → BD
```

### ¿Qué se puede reutilizar para nativo?

| Componente | Reutilizable | Notas |
|---|---|---|
| Base de datos PostgreSQL | ✅ 100% | Schema, índices, relaciones |
| Políticas RLS | ✅ 100% | Seguridad a nivel de BD |
| Supabase Auth | ✅ 90% | Supabase tiene SDK para iOS/Android/Flutter |
| Supabase Realtime | ✅ 90% | SDK nativo disponible |
| Supabase Storage | ✅ 100% | Acceso via URL |
| API Routes (`/api/*`) | ⚠️ 60% | Existen 14 endpoints, pero solo cubren auth/empresas/prefs |
| Hooks de React | ❌ 0% | Son específicos de React |
| Middleware Next.js | ❌ 0% | Es específico de Next.js |
| Componentes UI | ❌ 0% | Son React/Tailwind |

### Opciones para app nativa

#### Opción A: PWA (Recomendada a corto plazo)
- **Esfuerzo:** 1-2 días
- **Resultado:** App instalable desde el navegador
- **Pro:** Zero código nuevo, misma base de código
- **Contra:** Limitaciones en iOS (notificaciones, background)

#### Opción B: Supabase SDK Nativo (React Native o Flutter)
- **Esfuerzo:** 2-4 semanas para MVP
- **Resultado:** App nativa real
- **Pro:** Supabase tiene SDKs oficiales para Flutter, Swift, Kotlin
- **Contra:** Hay que reescribir todo el frontend
- **La BD no cambia nada** — el SDK nativo habla directo con Supabase igual que el web

#### Opción C: Capacitor (Híbrida)
- **Esfuerzo:** 3-5 días
- **Resultado:** La web actual empaquetada como app nativa
- **Pro:** Reutiliza 95% del código actual, acceso a APIs nativas
- **Contra:** Performance no es 100% nativa

#### Opción D: API REST independiente + App nativa
- **Esfuerzo:** 4-8 semanas
- **Resultado:** Backend API-first + app nativa separada
- **Pro:** Arquitectura limpia, múltiples clientes
- **Contra:** Mayor esfuerzo, mantener dos codebases

---

## 5. Recomendación estratégica

### Ruta recomendada (por fases)

```
FASE 1 (Ahora): Hacer la web más responsive
  → Arreglar tap targets, añadir breakpoints, gestos swipe
  → Esfuerzo: 2-3 días

FASE 2 (Corto plazo): Implementar PWA
  → manifest.json, service worker, iconos
  → Esfuerzo: 1-2 días
  → Resultado: App instalable en Android y iOS

FASE 3 (Cuando se necesite nativo): Capacitor
  → Empaquetar la web como app nativa
  → Acceso a cámara, GPS, notificaciones push reales
  → Esfuerzo: 3-5 días
  → Publicable en App Store y Play Store

FASE 4 (Solo si es necesario): App nativa pura
  → Solo si Capacitor no es suficiente
  → Flutter + Supabase SDK (la BD no cambia)
```

### ¿La BD necesita cambios? NO.

La base de datos con Supabase está **perfectamente preparada** para cualquier opción:
- **PWA:** Usa los mismos clientes JS que ya existen
- **Capacitor:** Misma web, misma BD
- **React Native:** Supabase tiene `@supabase/supabase-js` que funciona en RN
- **Flutter:** Supabase tiene `supabase_flutter` oficial
- **Swift/Kotlin nativo:** Supabase tiene SDKs oficiales

En todos los casos, las políticas RLS, el multi-tenant, los JWT custom claims y el schema funcionan idéntico. **No hay que crear otra base de datos ni modificar la actual.**

---

## 6. Acciones inmediatas recomendadas

### Alta prioridad
1. **Aumentar tap targets** a mínimo 44x44px en sidebar, header e iconos
2. **Añadir más breakpoints responsive** en listas, tablas y grids
3. **Crear `manifest.json`** y configurar PWA básica
4. **Añadir `inputmode="tel"`** en campos de teléfono
5. **Implementar gestos swipe** para cerrar drawer y navegación

### Media prioridad
6. **Mejorar accesibilidad** — ARIA labels, focus management
7. **Usar `<Image>` de Next.js** para optimización de imágenes
8. **Tipografía fluida** con `clamp()` para diferentes pantallas
9. **Navegación inferior** en móvil para acceso rápido

### Baja prioridad (para cuando se necesite nativo)
10. **Evaluar Capacitor** como bridge a nativo
11. **Documentar API endpoints** con OpenAPI/Swagger
12. **Considerar Flutter** solo si Capacitor no cumple requisitos

---

*Este informe cubre el estado actual del proyecto al 25/03/2026. La base de datos NO necesita modificaciones para soportar PWA ni apps nativas.*
