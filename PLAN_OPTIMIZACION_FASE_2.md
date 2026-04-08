# Plan de Optimización — Fase 2

## Contexto: qué se hizo en Fase 1 (ya implementado)

Se optimizó todo el stack de rendimiento del frontend y las APIs:

- **React Query**: cache en cliente, navegación instantánea entre páginas
- **Connection pooling**: 20 conexiones con idle timeout en Drizzle
- **APIs optimizadas**: select selectivo (sin `*`), queries en paralelo, permisos con 1 sola query
- **Skeletons**: placeholder visual mientras cargan los datos
- **Hook `useListado`**: patrón unificado para listados paginados con cache

Las 4 páginas principales (contactos, presupuestos, actividades, papelera) ya usan React Query.

---

## Fase 2A: Función SQL para recalcular totales de presupuestos

### Por qué hacemos esto

Actualmente, cada vez que se agrega, edita o elimina una línea de un presupuesto, la función `recalcularTotales` en JavaScript hace:
1. SELECT todas las líneas del presupuesto
2. SELECT el descuento global del presupuesto
3. Iterar en JavaScript y calcular subtotales
4. UPDATE el presupuesto con los totales

Esto son 3 roundtrips a la BD cuando podría ser 1 solo. Con una función PL/pgSQL en PostgreSQL, toda la lógica corre dentro de la BD en una sola operación atómica.

### Beneficios
- **1 roundtrip en vez de 3**: el cálculo corre en la BD, no en el servidor JS
- **Atomicidad**: no hay ventana donde los totales estén desactualizados
- **Reutilizable**: se puede llamar desde triggers, migraciones, o manualmente
- **Multi-tenant safe**: la función filtra por `presupuesto_id`, no necesita `empresa_id`

### Lógica de cálculo actual (debe respetarse exactamente)

```
Para cada línea del presupuesto:
  - tipo_linea = 'producto' → sumar subtotal a subtotal_neto, sumar impuesto_monto a total_impuestos
  - tipo_linea = 'descuento' → sumar monto (negativo) a subtotal_neto
  - tipo_linea = 'seccion' o 'nota' → ignorar

descuento_global_monto = subtotal_neto × descuento_global / 100
total_final = subtotal_neto - descuento_global_monto + total_impuestos
```

### Campos que se actualizan en `presupuestos`
- `subtotal_neto`
- `total_impuestos`
- `descuento_global_monto`
- `total_final`
- `editado_por` (uuid del usuario que editó)
- `actualizado_en` (timestamp actual)

### Pasos de implementación

1. **Crear migración SQL** en `src/db/migraciones/recalcular_totales_presupuesto.sql`:

```sql
-- Función PL/pgSQL para recalcular totales de un presupuesto.
-- Reemplaza la lógica JavaScript que hacía 3 roundtrips.
-- Se llama desde: POST/PATCH/DELETE de líneas de presupuesto.
-- 2026-04-08

CREATE OR REPLACE FUNCTION public.recalcular_totales_presupuesto(
  p_presupuesto_id uuid,
  p_usuario_id uuid DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_subtotal_neto numeric := 0;
  v_total_impuestos numeric := 0;
  v_descuento_global numeric := 0;
  v_descuento_global_monto numeric := 0;
  v_total_final numeric := 0;
BEGIN
  -- Calcular subtotal e impuestos desde líneas
  SELECT
    COALESCE(SUM(CASE WHEN tipo_linea = 'producto' THEN COALESCE(subtotal::numeric, 0) ELSE 0 END), 0)
      + COALESCE(SUM(CASE WHEN tipo_linea = 'descuento' THEN COALESCE(monto::numeric, 0) ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN tipo_linea = 'producto' THEN COALESCE(impuesto_monto::numeric, 0) ELSE 0 END), 0)
  INTO v_subtotal_neto, v_total_impuestos
  FROM lineas_presupuesto
  WHERE presupuesto_id = p_presupuesto_id;

  -- Obtener descuento global del presupuesto
  SELECT COALESCE(descuento_global::numeric, 0)
  INTO v_descuento_global
  FROM presupuestos
  WHERE id = p_presupuesto_id;

  -- Calcular descuento global y total final
  v_descuento_global_monto := v_subtotal_neto * v_descuento_global / 100;
  v_total_final := v_subtotal_neto - v_descuento_global_monto + v_total_impuestos;

  -- Actualizar presupuesto
  UPDATE presupuestos SET
    subtotal_neto = v_subtotal_neto::text,
    total_impuestos = v_total_impuestos::text,
    descuento_global_monto = v_descuento_global_monto::text,
    total_final = v_total_final::text,
    editado_por = COALESCE(p_usuario_id, editado_por),
    actualizado_en = now()
  WHERE id = p_presupuesto_id;
END;
$$;
```

2. **Ejecutar la migración** en Supabase (SQL Editor o MCP)

3. **Simplificar `recalcularTotales`** en `src/app/api/presupuestos/[id]/lineas/route.ts`:

```typescript
async function recalcularTotales(
  admin: ReturnType<typeof crearClienteAdmin>,
  presupuestoId: string,
  _empresaId: string,
  userId: string,
) {
  await admin.rpc('recalcular_totales_presupuesto', {
    p_presupuesto_id: presupuestoId,
    p_usuario_id: userId,
  })
}
```

4. **Verificar** que crear/editar/eliminar líneas siga calculando bien los totales

### Checklist de verificación
- [ ] Crear presupuesto con líneas → totales correctos
- [ ] Agregar línea producto → subtotal y total se actualizan
- [ ] Agregar línea descuento (monto negativo) → resta del subtotal
- [ ] Agregar línea sección/nota → totales no cambian
- [ ] Editar cantidad/precio de línea → totales se recalculan
- [ ] Eliminar línea → totales se recalculan
- [ ] Descuento global → se aplica correctamente sobre subtotal
- [ ] Impuestos → se suman después del descuento de línea, antes del global
- [ ] Funciona para todas las empresas (multi-tenant)
- [ ] Presupuesto con 0 líneas → totales en 0

---

## Fase 2B: Server Components con Suspense/Streaming

### Por qué hacemos esto

Hoy todas las páginas son `'use client'`. El flujo actual es:
```
Navegador carga JS → Ejecuta React → useListado hace fetch → Espera respuesta → Renderiza datos
```

Con Server Components + Suspense:
```
Servidor renderiza HTML con datos → Navegador muestra instantáneamente → JS hidrata interactividad
```

El usuario ve los datos **antes** de que el JavaScript termine de cargar. Esto es lo que hace que Attio/Linear se sientan instantáneos.

### Arquitectura propuesta

Cada página se divide en dos:
1. **Server Component** (page.tsx sin 'use client') → hace el fetch inicial de datos en el servidor
2. **Client Component** (ContenidoContactos.tsx con 'use client') → maneja interactividad, filtros, paginación

```
page.tsx (Server Component)
├── Suspense boundary con SkeletonTabla como fallback
└── ContenidoContactos (Client Component)
    ├── useListado (React Query) para paginación/filtros subsiguientes
    ├── TablaDinamica
    └── Filtros, búsqueda, acciones lote
```

### Cómo funciona la carga inicial vs subsiguiente

1. **Primera carga**: El Server Component pasa `datosIniciales` al Client Component como prop. React Query los usa como `initialData` → la página se renderiza con datos desde el HTML del servidor.

2. **Filtros/paginación/búsqueda**: El Client Component usa `useListado` (React Query) para hacer fetch del cliente como ahora. El cache de React Query se encarga de no re-pedir datos que ya tiene.

3. **Navegación entre páginas**: Si el usuario va a contactos → presupuestos → contactos, la segunda vez React Query devuelve los datos del cache instantáneamente.

### Páginas a migrar (en orden de prioridad)

| Página | Filtros server-side | Complejidad |
|--------|---------------------|-------------|
| Contactos | tipo, origen, iva, etapa, búsqueda | Alta (más filtros) |
| Presupuestos | estado, moneda, contacto_id, búsqueda | Media |
| Actividades | tipo, estado[], prioridad, vista, búsqueda | Alta (config dinámica) |
| Papelera | ninguno (carga todo) | Baja |

### Patrón de implementación (ejemplo: Presupuestos)

**Archivo: `src/app/(flux)/presupuestos/page.tsx`** (Server Component)
```tsx
import { Suspense } from 'react'
import { SkeletonTabla } from '@/componentes/feedback/SkeletonTabla'
import { ContenidoPresupuestos } from './_componentes/ContenidoPresupuestos'
import { crearClienteServidor } from '@/lib/supabase/servidor'
import { crearClienteAdmin } from '@/lib/supabase/admin'

export default async function PaginaPresupuestos() {
  return (
    <Suspense fallback={<SkeletonTabla />}>
      <PresupuestosConDatos />
    </Suspense>
  )
}

async function PresupuestosConDatos() {
  // Fetch inicial en el servidor — datos para la primera renderización
  const supabase = await crearClienteServidor()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const empresaId = user.app_metadata?.empresa_activa_id
  const admin = crearClienteAdmin()

  const { data, count } = await admin
    .from('presupuestos')
    .select('id, numero, estado, ...campos necesarios...', { count: 'exact' })
    .eq('empresa_id', empresaId)
    .eq('en_papelera', false)
    .order('numero', { ascending: false })
    .range(0, 49)

  return (
    <ContenidoPresupuestos
      datosIniciales={data || []}
      totalInicial={count || 0}
    />
  )
}
```

**Archivo: `src/app/(flux)/presupuestos/_componentes/ContenidoPresupuestos.tsx`** (Client Component)
```tsx
'use client'
// ... todo el código actual de PaginaPresupuestos movido aquí
// Con useListado({ ..., initialData: datosIniciales })
```

### Consideraciones multi-tenant

- El Server Component usa `crearClienteServidor()` que lee las cookies del request → obtiene el JWT → extrae `empresa_activa_id`
- Las queries server-side ya filtran por `empresa_id` — esto NO cambia
- RLS sigue activo en todas las queries
- No hay riesgo de filtrar datos entre empresas

### Consideraciones de producción

- **Deploy gradual**: migrar una página a la vez, no todas juntas
- **Rollback fácil**: si algo falla, volver a poner `'use client'` en el page.tsx
- **Cache de Next.js**: las páginas autenticadas ya usan `force-dynamic`, esto no cambia
- **Verificar en móvil**: el streaming beneficia especialmente conexiones lentas (PWA en celular)

### Filtros que deben seguir funcionando al 100%

#### Contactos
- [ ] Filtro por tipo de contacto (persona, empresa, edificio, etc.)
- [ ] Filtro por origen (manual, importación, IA, usuario)
- [ ] Filtro por condición IVA (responsable inscripto, monotributista, etc.)
- [ ] Filtro por etapa de conversación (WhatsApp y correo)
- [ ] Búsqueda con debounce 300ms (nombre, apellido, correo, teléfono, dirección)
- [ ] Filtro por vinculado_de (desde URL params)
- [ ] Paginación server-side (50 por página)
- [ ] Ordenamiento por columna
- [ ] Acciones lote (papelera, etiquetas, exportar CSV)
- [ ] Vista tarjetas + vista lista

#### Presupuestos
- [ ] Filtro por estado (borrador, enviado, aceptado, rechazado, vencido)
- [ ] Filtro por moneda (ARS, USD, EUR)
- [ ] Filtro por contacto (desde URL params contacto_id)
- [ ] Búsqueda con debounce 300ms
- [ ] Paginación server-side
- [ ] Acciones lote (estado, duplicar, exportar, papelera)
- [ ] Chip de filtro de contacto removible

#### Actividades
- [ ] Filtro por tipo (dinámico desde config empresa)
- [ ] Filtro por estado multi-select (pendiente, vencida, completada, cancelada)
- [ ] Filtro por prioridad (baja, normal, alta)
- [ ] Filtro por vista (mías, equipo, todas)
- [ ] Búsqueda con debounce 300ms
- [ ] Paginación server-side
- [ ] Modal de actividad desde ?actividad_id= en URL
- [ ] Acciones rápidas (completar, posponer)

#### Papelera
- [ ] Tabs por tipo de entidad
- [ ] Búsqueda client-side
- [ ] Restaurar elemento
- [ ] Eliminar definitivamente (solo contactos)
- [ ] Contadores por tipo

### Orden recomendado de ejecución
1. Primero la Fase 2A (SQL function) — es independiente y rápida
2. Luego Fase 2B empezando por Papelera (la más simple, buen smoke test)
3. Seguir con Presupuestos (complejidad media)
4. Luego Contactos (más filtros)
5. Finalmente Actividades (config dinámica + modal)

---

## Prompt para ejecutar en otro chat

Copia este prompt para iniciar la implementación:

---

### PROMPT FASE 2A — Función SQL recalcular totales

```
Necesito crear una función PL/pgSQL en Supabase para recalcular los totales de presupuestos, y luego simplificar el código JavaScript que la llama.

Lee el archivo PLAN_OPTIMIZACION_FASE_2.md en la raíz del proyecto — tiene toda la especificación de la función SQL, la lógica de cálculo, y los pasos exactos.

Pasos:
1. Crear el archivo de migración SQL en src/db/migraciones/recalcular_totales_presupuesto.sql con la función PL/pgSQL
2. Ejecutar la migración en Supabase usando el MCP de Supabase (apply_migration)
3. Simplificar la función recalcularTotales en src/app/api/presupuestos/[id]/lineas/route.ts para que solo llame admin.rpc('recalcular_totales_presupuesto', ...)
4. Verificar que TypeScript compile sin errores
5. Probar creando un presupuesto con líneas y verificando que los totales sean correctos

IMPORTANTE: 
- Estamos en producción. La función SQL debe usar CREATE OR REPLACE para ser idempotente.
- Debe funcionar para todas las empresas (multi-tenant) — la función filtra por presupuesto_id, no por empresa_id.
- Los campos en la BD son tipo text (no numeric), así que los casts deben ser ::numeric para operar y ::text para guardar.
- SECURITY DEFINER para que funcione con el admin client.
```

### PROMPT FASE 2B — Server Components con Suspense

```
Necesito migrar las páginas principales de Flux de Client Components puros a Server Components con Suspense, para que los datos se rendericen en el servidor y el usuario vea la página instantáneamente.

Lee el archivo PLAN_OPTIMIZACION_FASE_2.md en la raíz del proyecto — tiene la arquitectura propuesta, el patrón de implementación, y el checklist completo de filtros que deben seguir funcionando.

El patrón es:
- page.tsx → Server Component que hace el fetch inicial y pasa datos como props
- _componentes/Contenido[Modulo].tsx → Client Component con toda la interactividad actual

Orden de migración:
1. Papelera (la más simple)
2. Presupuestos
3. Contactos
4. Actividades

Para CADA página:
1. Crear el Client Component moviendo todo el código actual
2. Convertir page.tsx en Server Component con Suspense
3. Hacer el fetch inicial server-side con crearClienteServidor()
4. Pasar datosIniciales como prop al Client Component
5. En el Client Component, usar initialData en useListado/useQuery
6. Verificar que TODOS los filtros, búsqueda, paginación y acciones sigan funcionando
7. Verificar que compile sin errores TypeScript

IMPORTANTE:
- Estamos en producción con múltiples empresas usando el sistema
- Cada página debe funcionar exactamente igual que antes para el usuario
- Los filtros son server-side (query params al API), no cambian
- El cache de React Query (useListado) sigue manejando paginación/filtros subsiguientes
- El Server Component solo hace el fetch de la primera página con filtros default
- Verificar en el checklist del plan que CADA filtro funcione correctamente
- Si algo no funciona, hacer rollback de esa página antes de seguir con la siguiente
```
