# Prompts para 3 chats paralelos — Módulo Visitas + Recorrido

Copiar cada sección en una conversación separada de Claude Code.
**Orden:** Chat 2, 3 y 4 pueden ejecutarse en paralelo.

---

## CHAT 2 — Módulo Visitas (API Routes + UI escritorio)

```
# CONTEXTO DEL PROYECTO

Estoy construyendo el módulo de **Visitas** para Flux by Salix, un CRM multi-tenant con Next.js 15 + Supabase.

**Lee CLAUDE.md** antes de hacer cualquier cosa — tiene todas las reglas del proyecto (español, tokens CSS, componentes reutilizables, etc.).

La base de datos ya está migrada. El schema Drizzle ya está en `src/db/esquema.ts` (busca `export const visitas` y `export const config_visitas`). Las traducciones i18n ya existen en `src/lib/i18n/` bajo la clave `visitas`. Los permisos ya están en `src/tipos/permisos.ts`.

## TABLA VISITAS (ya creada en BD)

Campos principales:
- id, empresa_id, contacto_id, contacto_nombre (snapshot), direccion_id, direccion_texto, direccion_lat, direccion_lng
- asignado_a, asignado_nombre
- fecha_programada, fecha_inicio, fecha_llegada, fecha_completada, duracion_estimada_min, duracion_real_min
- estado: 'programada' | 'en_camino' | 'en_sitio' | 'completada' | 'cancelada' | 'reprogramada'
- motivo, resultado, notas, prioridad ('baja'|'normal'|'alta'|'urgente'), checklist (jsonb [])
- registro_lat, registro_lng, registro_precision_m (geolocalización de registro)
- actividad_id, vinculos (jsonb [])
- en_papelera, papelera_en
- creado_por, creado_por_nombre, editado_por, editado_por_nombre, creado_en, actualizado_en

## TABLA CONFIG_VISITAS (ya creada en BD)

- empresa_id (unique), checklist_predeterminado (jsonb), requiere_geolocalizacion (bool), distancia_maxima_m (int, default 500), duracion_estimada_default (int, default 30), motivos_predefinidos (jsonb), resultados_predefinidos (jsonb)

## ARCHIVOS QUE VOS CREÁS/MODIFICÁS (NO toques otros)

```
src/app/api/visitas/route.ts              — GET (listado) + POST (crear)
src/app/api/visitas/[id]/route.ts         — PATCH (editar/cambiar estado) + DELETE (papelera)
src/app/api/visitas/config/route.ts       — GET + PATCH config empresa
src/app/(flux)/visitas/page.tsx           — Server component con datos hidratados
src/app/(flux)/visitas/_componentes/ContenidoVisitas.tsx  — Client component principal
src/app/(flux)/visitas/_componentes/ModalVisita.tsx       — Modal crear/editar
src/app/(flux)/visitas/[id]/page.tsx      — Detalle con PanelChatter
src/app/(flux)/visitas/configuracion/page.tsx — Config del módulo
```

## PATRONES EXACTOS A SEGUIR

### Auth en API Routes (EXACTO, no cambiar):

```typescript
import { NextResponse, type NextRequest } from 'next/server'
import { crearClienteServidor } from '@/lib/supabase/servidor'
import { crearClienteAdmin } from '@/lib/supabase/admin'
import { obtenerYVerificarPermiso, verificarVisibilidad } from '@/lib/permisos-servidor'

export async function GET(request: NextRequest) {
  const supabase = await crearClienteServidor()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const empresaId = user.app_metadata?.empresa_activa_id
  if (!empresaId) return NextResponse.json({ error: 'Sin empresa activa' }, { status: 403 })

  // Para listados: verificar visibilidad
  const visibilidad = await verificarVisibilidad(user.id, empresaId, 'visitas')
  if (!visibilidad) return NextResponse.json({ error: 'Sin permiso' }, { status: 403 })
  const soloPropio = visibilidad.soloPropio

  const admin = crearClienteAdmin()
  let query = admin.from('visitas').select('*', { count: 'exact' })
    .eq('empresa_id', empresaId)
    .eq('en_papelera', false)

  // Si solo puede ver las propias:
  if (soloPropio) {
    query = query.or(`creado_por.eq.${user.id},asignado_a.eq.${user.id}`)
  }

  // ... filtros, orden, paginación
}

export async function POST(request: NextRequest) {
  // ... auth igual
  const { permitido } = await obtenerYVerificarPermiso(user.id, empresaId, 'visitas', 'crear')
  if (!permitido) return NextResponse.json({ error: 'Sin permiso' }, { status: 403 })

  // Obtener perfil del creador para snapshot
  const admin = crearClienteAdmin()
  const { data: perfil } = await admin.from('perfiles').select('nombre, apellido').eq('id', user.id).single()
  const nombreCreador = perfil ? `${perfil.nombre} ${perfil.apellido}`.trim() : ''

  const body = await request.json()
  // Validar campos requeridos: contacto_id, fecha_programada
  // Hacer snapshot de contacto_nombre y direccion_texto
  // INSERT con empresa_id, creado_por, creado_por_nombre

  // Registrar en chatter:
  // import { registrarChatter } from '@/lib/chatter'
  // await registrarChatter({ empresaId, entidadTipo: 'visita', entidadId: data.id, tipo: 'sistema', contenido: 'Visita creada', autorId: user.id, autorNombre: nombreCreador })

  return NextResponse.json(data, { status: 201 })
}
```

### Para PATCH (cambio de estado):
```typescript
// const { id } = await params  // Next.js 15+ params son Promises
// body.accion puede ser: 'completar', 'cancelar', 'reprogramar', 'en_camino', 'en_sitio'
// Actualizar timestamps según estado:
// - en_camino → fecha_inicio = now()
// - en_sitio → fecha_llegada = now()
// - completada → fecha_completada = now(), calcular duracion_real_min
// Siempre setear editado_por, editado_por_nombre, actualizado_en
// Registrar cambio de estado en chatter
```

### Para DELETE (soft delete, EXACTO):
```typescript
const { error } = await admin.from('visitas')
  .update({ en_papelera: true, papelera_en: new Date().toISOString() })
  .eq('id', id).eq('empresa_id', empresaId)
return NextResponse.json({ ok: true })
```

### Page.tsx (Server Component con hidratación):

Seguir EXACTAMENTE el patrón de `src/app/(flux)/actividades/page.tsx`:

```typescript
import { crearClienteServidor } from '@/lib/supabase/servidor'
import { crearClienteAdmin } from '@/lib/supabase/admin'
import { verificarVisibilidad } from '@/lib/permisos-servidor'
import { redirect } from 'next/navigation'
import { HydrationBoundary, dehydrate } from '@tanstack/react-query'
import { crearQueryClient } from '@/hooks/useQueryClient'
import { ContenidoVisitas } from './_componentes/ContenidoVisitas'

const POR_PAGINA = 50

export default async function PaginaVisitas() {
  const supabase = await crearClienteServidor()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const empresaId = user.app_metadata?.empresa_activa_id
  if (!empresaId) redirect('/login')

  // ... query inicial, hidratar con queryClient
  // return <HydrationBoundary><ContenidoVisitas datosInicialesJson={...} /></HydrationBoundary>
}
```

### ContenidoVisitas (Client Component):

Seguir el patrón de `src/app/(flux)/actividades/_componentes/ContenidoActividades.tsx`:

```typescript
'use client'
// Hooks: useState, useCallback, useMemo, useRouter, useSearchParams
// Hooks del proyecto: useTraduccion, useFormato, useToast, useRol (para tienePermiso)
// Componentes: TablaDinamica (de @/componentes/tablas/TablaDinamica), Boton, Insignia, Modal, EstadoVacio
// Iconos de lucide-react

// Props de TablaDinamica<T> principales que vas a usar:
// columnas: ColumnaDinamica<T>[]  — cada una con: clave, etiqueta, ancho, render, ordenable, grupo, icono
// datos: T[]
// claveFila: (fila: T) => string
// totalRegistros: number
// registrosPorPagina: 50
// paginaExterna / onCambiarPagina
// seleccionables + accionesLote
// busqueda / onBusqueda / placeholder
// filtros: FiltroTabla[] — con tipos: 'seleccion' | 'multiple' | 'fecha' | 'pills'
// vistas: ['lista', 'tarjetas']
// renderTarjeta: (fila) => ReactNode
// idModulo: 'visitas'
// columnasVisiblesDefault: string[]
```

### ModalVisita:

Usar `ModalAdaptable` (no Modal directo). Referencia: `src/app/(flux)/actividades/_componentes/ModalActividad.tsx`.

Campos del modal:
- Contacto: selector con buscador (buscar en API contactos)
- Dirección: selector de direcciones del contacto seleccionado (si tiene lat/lng mostrar miniatura)
- Asignado a: selector de miembros de la empresa
- Fecha y hora: SelectorFecha + SelectorHora
- Motivo: Select con motivos predefinidos de config + opción texto libre
- Prioridad: Select (baja, normal, alta, urgente)
- Checklist: lista editable (agregar/quitar items)
- Notas: textarea

### Detalle de visita ([id]/page.tsx):

- Server component que carga la visita por ID
- Layout de 2 columnas en desktop: izquierda (info), derecha (PanelChatter)
- PanelChatter: `<PanelChatter entidadTipo="visita" entidadId={visita.id} />`
- Botones de acción según estado actual
- Mapa pequeño si hay lat/lng (puede ser un placeholder con link a Google Maps por ahora)

### Colores de estado (usar tokens CSS existentes):
- programada → --estado-pendiente
- en_camino → --canal-whatsapp (verde)
- en_sitio → --insignia-info (azul)
- completada → --estado-completado
- cancelada → --estado-error
- reprogramada → --insignia-advertencia

### Traducciones: usar t('visitas.xxx') para todo texto visible. Ya existen:
- t('visitas.titulo'), t('visitas.nueva'), t('visitas.contacto'), t('visitas.estados.programada'), etc.
- t('visitas.estados.en_camino'), t('visitas.estados.en_sitio'), t('visitas.estados.reprogramada') — nuevos estados
- t('visitas.prioridades.baja/normal/alta/urgente')
- t('visitas.checklist'), t('visitas.registro_ubicacion'), t('visitas.duracion_estimada'), t('visitas.duracion_real')
```

---

## CHAT 3 — Módulo Recorrido (mobile-first)

```
# CONTEXTO DEL PROYECTO

Estoy construyendo el módulo de **Recorrido** para Flux by Salix, un CRM multi-tenant con Next.js 15 + Supabase. Este módulo es la experiencia MOBILE del visitador — lo usa desde el celular. Inspirado en la app **Spoke** para iOS.

**Lee CLAUDE.md** antes de hacer cualquier cosa.

La BD ya está migrada. El schema Drizzle está en `src/db/esquema.ts` (busca `export const recorridos`, `export const recorrido_paradas`, `export const visitas`). Las traducciones i18n existen bajo la clave `recorrido` en `src/lib/i18n/`.

## TABLAS RELEVANTES (ya creadas)

**visitas:** id, empresa_id, contacto_id, contacto_nombre, direccion_texto, direccion_lat, direccion_lng, asignado_a, asignado_nombre, fecha_programada, estado ('programada'|'en_camino'|'en_sitio'|'completada'|'cancelada'|'reprogramada'), motivo, resultado, notas, prioridad, checklist (jsonb), registro_lat, registro_lng, registro_precision_m, duracion_estimada_min, duracion_real_min, fecha_inicio, fecha_llegada, fecha_completada

**recorridos:** id, empresa_id, asignado_a, asignado_nombre, fecha (date, UNIQUE con empresa+asignado), estado ('pendiente'|'en_curso'|'completado'), origen_lat, origen_lng, origen_texto, total_visitas, visitas_completadas, distancia_total_km, duracion_total_min, notas

**recorrido_paradas:** id, recorrido_id, visita_id, orden (int), distancia_km, duracion_viaje_min, hora_estimada_llegada, notas

## ARCHIVOS QUE VOS CREÁS (NO toques visitas/ ni componentes/mapa/)

```
src/app/(flux)/recorrido/layout.tsx           — Layout DEDICADO sin sidebar/header
src/app/(flux)/recorrido/page.tsx             — Página principal mobile-first
src/app/(flux)/recorrido/_componentes/
  ListaParadas.tsx        — Lista ordenable de paradas del día
  TarjetaParada.tsx       — Card de cada parada con estado y acciones
  RegistroVisita.tsx      — BottomSheet para registrar llegada (fotos, notas, checklist)
  BarraProgreso.tsx       — Progreso visual (3/6 completadas)
  ResumenDia.tsx          — Vista al completar todo
  HeaderRecorrido.tsx     — Header simple con fecha y progreso
src/app/api/recorrido/
  hoy/route.ts            — GET recorrido del día del usuario
  reordenar/route.ts      — PATCH reordenar paradas
  estado/route.ts         — PATCH cambiar estado de visita desde recorrido
  registrar/route.ts      — POST registrar llegada con geo + fotos + notas
```

## LAYOUT DEDICADO (sin sidebar/header)

El recorrido vive dentro de (flux) pero necesita su PROPIO layout sin sidebar ni header. Referencia exacta de cómo hacerlo — mirá `src/app/kiosco/layout.tsx`:

```typescript
// src/app/(flux)/recorrido/layout.tsx
import type { Metadata, Viewport } from 'next'

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
}

export default function LayoutRecorrido({ children }: { children: React.ReactNode }) {
  // IMPORTANTE: este layout REEMPLAZA el PlantillaApp que viene del (flux)/layout.tsx
  // Pero como está DENTRO del grupo (flux), tiene acceso a todos los providers (auth, tema, i18n, etc.)
  // El truco: NO envolver en PlantillaApp, sino renderizar directo
  return (
    <div className="fixed inset-0 flex flex-col bg-superficie-app" style={{ paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'env(safe-area-inset-bottom)' }}>
      {children}
    </div>
  )
}
```

IMPORTANTE: El layout de (flux) usa PlantillaApp que incluye sidebar + header. Para que recorrido NO los tenga, necesitás que tu layout reemplace ese wrapping. Investigá si (flux)/layout.tsx permite opt-out o si necesitás mover recorrido fuera del grupo (flux) pero mantener los providers. Mirá `src/app/(flux)/layout.tsx` para entender la cadena de providers.

## PATRONES DE AUTH EN API ROUTES

```typescript
import { NextResponse, type NextRequest } from 'next/server'
import { crearClienteServidor } from '@/lib/supabase/servidor'
import { crearClienteAdmin } from '@/lib/supabase/admin'
import { obtenerYVerificarPermiso } from '@/lib/permisos-servidor'

// Auth:
const supabase = await crearClienteServidor()
const { data: { user } } = await supabase.auth.getUser()
if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
const empresaId = user.app_metadata?.empresa_activa_id
if (!empresaId) return NextResponse.json({ error: 'Sin empresa activa' }, { status: 403 })

// Permisos: modulo 'recorrido', acciones: 'ver_propio', 'registrar', 'reordenar'
const { permitido } = await obtenerYVerificarPermiso(user.id, empresaId, 'recorrido', 'registrar')

// Queries siempre con admin client + filtro empresa_id
const admin = crearClienteAdmin()
```

## API ROUTES DETALLADAS

### GET /api/recorrido/hoy
1. Auth + obtener user.id
2. Fecha de hoy en timezone de la empresa (o UTC)
3. Buscar recorrido: `admin.from('recorridos').select('*').eq('empresa_id', empresaId).eq('asignado_a', user.id).eq('fecha', hoy).single()`
4. Si no existe recorrido, crearlo automáticamente buscando visitas del día:
   ```
   visitas del día = admin.from('visitas').select('*').eq('empresa_id', empresaId).eq('asignado_a', user.id).gte('fecha_programada', inicioDelDia).lte('fecha_programada', finDelDia).eq('en_papelera', false).neq('estado', 'cancelada').order('fecha_programada', { ascending: true })
   ```
5. Si hay visitas, crear recorrido + crear paradas (una por visita, orden secuencial)
6. Retornar recorrido + paradas con datos de visita joineados:
   ```json
   {
     "recorrido": { id, fecha, estado, total_visitas, visitas_completadas, ... },
     "paradas": [{ id, orden, visita: { id, contacto_nombre, direccion_texto, direccion_lat, direccion_lng, estado, motivo, prioridad, checklist, ... }, distancia_km, duracion_viaje_min }]
   }
   ```

### PATCH /api/recorrido/reordenar
Body: `{ recorrido_id, paradas: [{ id, orden }] }`
Actualizar el campo `orden` de cada parada en `recorrido_paradas`.

### PATCH /api/recorrido/estado
Body: `{ visita_id, estado: 'en_camino' | 'en_sitio' | 'completada' | 'cancelada', registro_lat?, registro_lng?, registro_precision_m? }`
1. Actualizar visita con nuevo estado + timestamps correspondientes
2. Si completada → calcular duracion_real_min desde fecha_llegada hasta ahora
3. Actualizar contadores del recorrido (visitas_completadas)
4. Si todas completadas → marcar recorrido como 'completado'
5. Registrar cambio de estado en chatter de la visita:
   ```typescript
   import { registrarChatter } from '@/lib/chatter'
   await registrarChatter({ empresaId, entidadTipo: 'visita', entidadId: visita_id, tipo: 'sistema', contenido: `Estado cambiado a ${estado}`, autorId: user.id, autorNombre: '...' })
   ```

### POST /api/recorrido/registrar
Body: FormData con: `visita_id`, `notas?`, `resultado?`, `checklist?` (JSON string), archivos (fotos)
1. Subir fotos a Storage: `documentos-pdf/${empresaId}/chatter/${visita_id}/${Date.now()}_${nombre}`
2. Crear entrada en chatter con las fotos como adjuntos y las notas como contenido
3. Actualizar la visita con resultado y notas
4. Retornar OK

## COMPONENTES — DISEÑO MOBILE-FIRST

### HeaderRecorrido
- Fijo arriba, safe-area padding
- Muestra: fecha de hoy formateada, botón atrás (a /), indicador progreso "3/6"
- Altura: 56px mínimo + safe-area

### ListaParadas
- Lista vertical scrollable con drag & drop para reordenar
- Usar @dnd-kit: `import { DndContext, closestCenter } from '@dnd-kit/core'` y `import { SortableContext, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable'`
- @dnd-kit YA está instalado: @dnd-kit/core ^6.3.1, @dnd-kit/sortable ^10.0.0, @dnd-kit/utilities ^3.2.2
- Al soltar: POST a /api/recorrido/reordenar

### TarjetaParada
- Card grande touch-friendly (min height 80px)
- Muestra: número de orden, nombre contacto (grande), dirección (chico), hora estimada
- Badge de estado con color según token CSS
- Botón de acción principal según estado:
  - programada → "En camino" (botón grande verde)
  - en_camino → "¡Llegué!" (botón grande azul)
  - en_sitio → "Completar" (botón grande)
  - completada → check verde, no hay botón
  - cancelada → tachado, gris
- Al tocar la tarjeta: expandir/contraer para ver más info (motivo, notas)
- Botón de navegación (ícono MapPin): abre Google Maps al destino
  - En móvil: `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`

### RegistroVisita (BottomSheet)
Se abre al tocar "¡Llegué!" o "Completar":
```typescript
// BottomSheet ya existe: import { BottomSheet } from '@/componentes/ui/BottomSheet'
// Props: abierto, onCerrar, titulo, children, acciones, altura ('auto'|'medio'|'alto'|'completo')
```
Contenido:
- Indicador de ubicación registrada (lat/lng con precisión)
- Input para notas
- Input para resultado (si es completar)
- Checklist: renderizar items del checklist de la visita como checkboxes tocables
- Botón "Tomar foto": `<input type="file" accept="image/*" capture="environment" />` (abre cámara nativa)
- Preview de fotos tomadas
- Botón principal: "Registrar llegada" o "Completar visita"

### BarraProgreso
- Barra horizontal con segmentos por cada parada
- Colores: completada=verde, actual=azul, pendiente=gris
- Texto: "3 de 6 completadas"

### ResumenDia
- Se muestra cuando todas las paradas están completadas
- Resumen: total visitas, completadas, tiempo total, distancia (si disponible)
- Botón "Volver al inicio"

## GEOLOCALIZACIÓN

Al tocar "¡Llegué!":
```typescript
navigator.geolocation.getCurrentPosition(
  (pos) => {
    const { latitude, longitude, accuracy } = pos.coords
    // Enviar a /api/recorrido/estado junto con el cambio a 'en_sitio'
  },
  (err) => { /* Permitir continuar sin geo, pero mostrar aviso */ },
  { enableHighAccuracy: true, timeout: 10000 }
)
```

## HOOKS DEL PROYECTO QUE USÁS

```typescript
import { useTraduccion } from '@/lib/i18n'           // const { t } = useTraduccion()
import { useFormato } from '@/hooks/useFormato'       // const formato = useFormato() → formato.fecha(), formato.hora()
import { useAuth } from '@/hooks/useAuth'             // const { usuario } = useAuth()
import { useToast } from '@/componentes/feedback/Toast'  // const { exito, error } = useToast()
```

## ANIMACIONES

Usar framer-motion (ya instalado v12.38) para:
- Transiciones entre estados de las tarjetas
- Drag & drop feedback visual
- Entrada/salida del BottomSheet (ya lo maneja el componente)
- Celebración sutil al completar la última visita

## TOKENS CSS (no hardcodear colores)

```css
--texto-primario, --texto-secundario, --texto-terciario
--superficie-app, --superficie-tarjeta, --superficie-elevada
--borde-sutil, --borde-fuerte
--estado-pendiente, --estado-completado, --estado-error
--canal-whatsapp (verde), --insignia-info (azul), --insignia-advertencia (amarillo)
```

## TRADUCCIONES DISPONIBLES (ya creadas)

```
t('recorrido.titulo'), t('recorrido.mi_recorrido'), t('recorrido.recorrido_del_dia')
t('recorrido.sin_recorrido'), t('recorrido.sin_recorrido_desc')
t('recorrido.paradas'), t('recorrido.parada'), t('recorrido.agregar_parada'), t('recorrido.quitar_parada')
t('recorrido.reordenar'), t('recorrido.optimizar_ruta')
t('recorrido.iniciar_recorrido'), t('recorrido.finalizar_recorrido'), t('recorrido.siguiente_parada')
t('recorrido.abrir_mapa'), t('recorrido.abrir_navegacion'), t('recorrido.ruta_completa'), t('recorrido.una_por_una')
t('recorrido.progreso'), t('recorrido.completadas'), t('recorrido.pendientes')
t('recorrido.distancia_total'), t('recorrido.tiempo_estimado')
t('recorrido.llegue'), t('recorrido.en_camino'), t('recorrido.registrar_visita')
t('recorrido.tomar_foto'), t('recorrido.notas')
t('recorrido.punto_partida'), t('recorrido.mi_ubicacion')
t('recorrido.plantillas'), t('recorrido.guardar_como_plantilla'), t('recorrido.cargar_plantilla')
t('recorrido.estados.pendiente'), t('recorrido.estados.en_curso'), t('recorrido.estados.completado')
```
```

---

## CHAT 4 — Componentes Mapa + Google Maps

```
# CONTEXTO DEL PROYECTO

Estoy construyendo los componentes de mapa reutilizables para Flux by Salix, un CRM multi-tenant con Next.js 15 + Supabase. Estos componentes serán importados por los módulos de Visitas (escritorio) y Recorrido (mobile).

**Lee CLAUDE.md** antes de hacer cualquier cosa.

## ESTADO ACTUAL DE GOOGLE MAPS EN EL PROYECTO

Ya existe:
- `GOOGLE_PLACES_API_KEY` en .env.local (para Places API)
- API routes en `src/app/api/lugares/autocompletar/route.ts` y `detalle/route.ts` que usan Google Places REST API
- `InputDireccion` en componentes UI que usa el autocompletado
- Tabla `contacto_direcciones` con campos `lat` y `lng`
- **NO hay librería de mapas visual instalada** — toca instalar una

NO existe:
- Variable `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` (hay que documentar que se necesita)
- Ningún componente de mapa visual
- Ninguna integración con Google Directions API

## ARCHIVOS QUE VOS CREÁS (NO toques visitas/ ni recorrido/)

```
src/componentes/mapa/
  ProveedorMapa.tsx       — Wrapper con Google Maps API loader
  MapaVisitas.tsx         — Mapa con marcadores de visitas
  MapaRecorrido.tsx       — Mapa con ruta ordenada entre puntos
  MarcadorVisita.tsx      — Marcador custom con estado
  tipos-mapa.ts           — Tipos TypeScript
  index.ts                — Exports
  utilidades-mapa.ts      — Funciones helper (navegación, URLs)
src/app/api/mapa/
  optimizar-ruta/route.ts — Optimización via Google Directions API
```

## LIBRERÍA DE MAPAS

Instalar `@vis.gl/react-google-maps` (librería oficial de Google para React):
```bash
npm install @vis.gl/react-google-maps
```

**Uso básico:**
```typescript
import { APIProvider, Map, AdvancedMarker, Pin } from '@vis.gl/react-google-maps'

// Wrapper
<APIProvider apiKey={process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || ''}>
  <Map
    mapId="VISITAS_MAP" // para estilos custom
    defaultCenter={{ lat: -34.6037, lng: -58.3816 }} // Buenos Aires default
    defaultZoom={12}
    gestureHandling="greedy"
    disableDefaultUI={true}
  >
    <AdvancedMarker position={{ lat, lng }}>
      <Pin background="#color" borderColor="#color" glyphColor="#fff" />
    </AdvancedMarker>
  </Map>
</APIProvider>
```

## TIPOS A DEFINIR (tipos-mapa.ts)

```typescript
export interface PuntoMapa {
  id: string
  lat: number
  lng: number
  titulo: string
  subtitulo?: string
  estado?: 'programada' | 'en_camino' | 'en_sitio' | 'completada' | 'cancelada' | 'reprogramada'
}

export interface RutaMapa {
  puntos: PuntoMapa[]
  origen?: { lat: number; lng: number; texto?: string }
}

export type ModoNavegacion = 'completa' | 'siguiente'

export interface PropiedadesMapaVisitas {
  puntos: PuntoMapa[]
  onClickPunto?: (punto: PuntoMapa) => void
  className?: string
  zoom?: number
  centro?: { lat: number; lng: number }
}

export interface PropiedadesMapaRecorrido {
  ruta: RutaMapa
  paradaActual?: number // índice de la parada actual
  onClickParada?: (punto: PuntoMapa, indice: number) => void
  className?: string
}
```

## COMPONENTES DETALLADOS

### ProveedorMapa
- Wrapper que carga la API de Google Maps
- Si no hay API key (NEXT_PUBLIC_GOOGLE_MAPS_API_KEY), renderizar fallback: lista de direcciones con links a Google Maps
- Manejar estado de carga con skeleton/loader

### MapaVisitas (para la sección Visitas en escritorio)
- Muestra puntos en el mapa
- Cada marcador tiene color según estado de la visita:
  - programada → gris
  - en_camino → verde
  - en_sitio → azul
  - completada → verde oscuro
  - cancelada → rojo
  - reprogramada → amarillo
- Click en marcador: callback onClickPunto
- Auto-fit bounds para mostrar todos los puntos
- Responsive: se adapta al contenedor

### MapaRecorrido (para la sección Recorrido en mobile)
- Muestra la ruta ordenada entre puntos con LÍNEAS conectándolos (Polyline)
- Números en cada marcador indicando el orden (1, 2, 3...)
- Punto de partida (origen) marcado diferente (ícono de persona o pin especial)
- Parada actual resaltada (más grande, animada con pulse)
- Paradas completadas con check
- Más compacto en mobile: menos padding, controles pequeños

### MarcadorVisita
- Componente que renderiza el marcador custom dentro de AdvancedMarker
- Muestra: número de orden (si aplica) + ícono de estado
- Colores según estado usando tokens CSS del proyecto
- Tamaño: 32px normal, 40px si es la parada actual

### utilidades-mapa.ts

```typescript
/**
 * Abre Google Maps para navegación al destino.
 * Detecta plataforma para usar el scheme correcto.
 */
export function abrirNavegacion(destino: { lat: number; lng: number }) {
  // En mobile: usar URL universal que Google Maps maneja
  const url = `https://www.google.com/maps/dir/?api=1&destination=${destino.lat},${destino.lng}&travelmode=driving`
  window.open(url, '_blank')
}

/**
 * Abre Google Maps con ruta completa (múltiples waypoints).
 * Máximo 25 waypoints en Google Maps URL.
 */
export function abrirRutaCompleta(paradas: { lat: number; lng: number }[], origen?: { lat: number; lng: number }) {
  if (paradas.length === 0) return

  const destino = paradas[paradas.length - 1]
  const waypoints = paradas.slice(0, -1) // todos menos el último

  let url = `https://www.google.com/maps/dir/?api=1&destination=${destino.lat},${destino.lng}&travelmode=driving`

  if (origen) {
    url += `&origin=${origen.lat},${origen.lng}`
  }

  if (waypoints.length > 0) {
    const wp = waypoints.map(p => `${p.lat},${p.lng}`).join('|')
    url += `&waypoints=${wp}`
  }

  window.open(url, '_blank')
}

/**
 * Calcula el centro geográfico de un array de puntos.
 */
export function calcularCentro(puntos: { lat: number; lng: number }[]): { lat: number; lng: number } {
  if (puntos.length === 0) return { lat: -34.6037, lng: -58.3816 } // Buenos Aires default
  const lat = puntos.reduce((sum, p) => sum + p.lat, 0) / puntos.length
  const lng = puntos.reduce((sum, p) => sum + p.lng, 0) / puntos.length
  return { lat, lng }
}
```

### API: POST /api/mapa/optimizar-ruta

Auth exacto del proyecto:
```typescript
import { NextResponse, type NextRequest } from 'next/server'
import { crearClienteServidor } from '@/lib/supabase/servidor'

export async function POST(request: NextRequest) {
  const supabase = await crearClienteServidor()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const body = await request.json()
  // body: { origen: {lat, lng}, paradas: [{id, lat, lng}] }

  // Llamar a Google Directions API con optimize:true
  const apiKey = process.env.GOOGLE_PLACES_API_KEY // reusar la misma key server-side
  const origin = `${body.origen.lat},${body.origen.lng}`
  const destination = origin // ruta circular, o última parada
  const waypoints = `optimize:true|` + body.paradas.map((p: {lat:number,lng:number}) => `${p.lat},${p.lng}`).join('|')

  const url = `https://maps.googleapis.com/maps/api/directions/json?origin=${origin}&destination=${destination}&waypoints=${waypoints}&key=${apiKey}`

  const res = await fetch(url)
  const data = await res.json()

  if (data.status !== 'OK') {
    return NextResponse.json({ error: 'No se pudo optimizar la ruta', detalle: data.status }, { status: 400 })
  }

  // data.routes[0].waypoint_order = [2, 0, 1, 3] — el orden óptimo
  const ordenOptimo = data.routes[0].waypoint_order as number[]
  const paradasOrdenadas = ordenOptimo.map((i: number) => body.paradas[i])

  // También extraer distancias y tiempos por tramo
  const tramos = data.routes[0].legs.map((leg: { distance: { value: number }; duration: { value: number } }) => ({
    distancia_km: Math.round(leg.distance.value / 100) / 10,
    duracion_min: Math.round(leg.duration.value / 60),
  }))

  return NextResponse.json({
    paradas_ordenadas: paradasOrdenadas,
    tramos,
    distancia_total_km: tramos.reduce((s: number, t: { distancia_km: number }) => s + t.distancia_km, 0),
    duracion_total_min: tramos.reduce((s: number, t: { duracion_min: number }) => s + t.duracion_min, 0),
  })
}
```

## FALLBACK SIN API KEY

Si `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` no está configurada, los componentes de mapa deben renderizar un fallback útil en vez de crashear:

```typescript
// En MapaVisitas y MapaRecorrido:
if (!process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY) {
  return (
    <div className="rounded-xl border border-borde-sutil bg-superficie-tarjeta p-4">
      <p className="text-texto-secundario text-sm mb-3">Mapa no disponible — configurar NEXT_PUBLIC_GOOGLE_MAPS_API_KEY</p>
      {/* Lista de direcciones con links a Google Maps */}
      {puntos.map((p, i) => (
        <a key={p.id} href={`https://www.google.com/maps?q=${p.lat},${p.lng}`} target="_blank" className="flex items-center gap-2 py-2 text-sm hover:bg-superficie-elevada rounded px-2">
          <MapPin size={14} />
          <span>{p.titulo}</span>
          <span className="text-texto-terciario">{p.subtitulo}</span>
        </a>
      ))}
    </div>
  )
}
```

## TOKENS CSS Y RESPONSIVE

Colores: usar variables CSS del proyecto, NO hex hardcodeados.
Responsive: en mobile (< 768px) el mapa ocupa menos altura (200px), en desktop más (400px).
Border radius: usar `rounded-xl` como el resto de la app.

## EXPORTS (index.ts)

```typescript
export { MapaVisitas } from './MapaVisitas'
export { MapaRecorrido } from './MapaRecorrido'
export { ProveedorMapa } from './ProveedorMapa'
export { MarcadorVisita } from './MarcadorVisita'
export { abrirNavegacion, abrirRutaCompleta, calcularCentro } from './utilidades-mapa'
export type { PuntoMapa, RutaMapa, ModoNavegacion, PropiedadesMapaVisitas, PropiedadesMapaRecorrido } from './tipos-mapa'
```
```

---

**FIN DE PROMPTS**
