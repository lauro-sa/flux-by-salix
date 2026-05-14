# Progreso — Módulo Nóminas

> Tracking de PRs del plan [PLAN_MODULO_NOMINAS.md](PLAN_MODULO_NOMINAS.md).
> Cuando todo termine este archivo se elimina.

## Estado por PR

| # | Título | Estado | Notas |
|---|---|---|---|
| 1 | Esqueleto del módulo + auto-dependencias | ✅ Hecho (PR #37) | Catálogo + sidebar + auto-instalación cascada de `asistencias` |
| 2 | Tablas base: contratos y conceptos | ✅ Hecho (PR #40) | 5 migraciones + tipos TS + seed de 6 contratos vigentes desde miembros |
| 3 | Verificar y completar sectores y turnos | ✅ Hecho (PR #41) | Auditoría: UI + API ya estaban completos. Se agregan 2 archivos SQL "shadow" (079, 080) para que el repo sea reproducible |
| 4 | Migración UI y API: nóminas → módulo propio | ✅ Hecho | Files movidos con `git mv` (historia preservada), API con wrappers de compat, `/nominas` ya renderiza la vista real. **Pendiente PR 4b**: desmontar la pestaña "Nómina" de asistencias y agregar tabs (Liquidaciones / Adelantos / Empleados / Config) |
| 5 | Ficha laboral con timeline de contratos | ⏳ Pendiente | |
| 6 | Configuración de conceptos + asignación | ⏳ Pendiente | |
| 7 | Motor de cálculo automático del recibo | ⏳ Pendiente | |
| 8 | Recibo PDF profesional + envío | ⏳ Pendiente | |
| 9 | Documentación de usuario | ⏳ Pendiente | |

## PR 1 — Detalle

**Mergeado en main:** _por confirmar_

**Archivos tocados:**
- `sql/073_modulo_nominas_catalogo.sql` (nuevo) — seed del catálogo + `requiere=['asistencias']`.
- `src/componentes/entidad/_sidebar/itemsNav.ts` — agregado item `nominas` (sección admin, debajo de Asistencias, ícono `Banknote`, módulo de permiso `nomina`).
- `src/tipos/modulos.ts` — agregado `nominas: ['/nominas']` a `RUTAS_POR_MODULO` y `/nominas → nominas` a `MODULO_POR_RUTA`.
- `src/lib/i18n/{tipos,es,en,pt}.ts` — etiqueta `navegacion.nominas` en los 3 idiomas.
- `src/app/(flux)/aplicaciones/page.tsx` — agregado ícono `banknote` al mapa de íconos del catálogo.
- `src/app/api/modulos/route.ts` — al instalar un módulo se resuelven dependencias en cascada (BFS, evita ciclos). Ya no se devuelve `400 faltantes`; se activan en orden y se reportan en `dependenciasInstaladas` en la respuesta.
- `src/app/(flux)/nominas/page.tsx` (nuevo) — placeholder con `GuardPagina modulo="nomina"`.

**Aplicado en flux-dev:** sí (INSERT con ON CONFLICT idempotente).

## PR 2 — Detalle

**Archivos tocados:**
- `sql/074_contratos_laborales.sql` (nuevo) — tabla `contratos_laborales` + índice UNIQUE parcial "solo 1 vigente por miembro" + RLS + trigger `actualizar_timestamp` + 2 CHECK constraints (vigencia consistente, fechas ordenadas).
- `sql/075_conceptos_nomina.sql` (nuevo) — 3 tablas: `conceptos_nomina` (catálogo), `conceptos_contrato` (N:M con `valor_override`), `conceptos_aplicados_pago` (snapshot inmutable del recibo). RLS + triggers.
- `sql/076_pagos_nomina_contrato_snapshot.sql` (nuevo) — ALTER `pagos_nomina` agregando `contrato_id uuid` + `contrato_snapshot jsonb` + índice.
- `sql/077_seed_contratos_desde_miembros.sql` (nuevo) — semilla idempotente: genera 1 contrato vigente por cada miembro con `compensacion_monto`. Mapea legacy `tipo + frecuencia → modalidad_calculo + frecuencia_pago`. Sector desde `miembros_sectores` (es_primario), turno desde `miembros.turno_id`, fecha_inicio desde `unido_en`.
- `sql/078_auditoria_contratos_y_conceptos.sql` (nuevo) — `auditoria_contratos_laborales` y `auditoria_conceptos_nomina` siguiendo el patrón de `auditoria_<entidad>` del repo (campo_modificado / valor_anterior / valor_nuevo / motivo). RLS por empresa.
- `src/tipos/nominas.ts` (nuevo) — `ContratoLaboral`, `ConceptoNomina`, `ConceptoContrato`, `ConceptoAplicadoPago`, `ContratoSnapshot` + enums espejo de los CHECK constraints (`CondicionContrato`, `ModalidadCalculo`, `FrecuenciaPago`, `RegimenContrato`, `TipoConcepto`, `CategoriaConcepto`, `ModoCalculoConcepto`).

**Aplicado en flux-dev:** sí (todas las migraciones aplicadas vía MCP; 6 contratos vigentes sembrados sobre los miembros con compensación; UNIQUE parcial verificado).

**Notas técnicas:**
- FK de auditoría apuntan a `auth.users(id)` (mismo patrón que `pagos_nomina`), no a `perfiles`.
- `RLS` usa `auth.jwt() ->> 'empresa_id'` (convención estándar del repo).
- No se eliminaron las columnas legacy `miembros.compensacion_*` — se ataca en PR 4 (doble escritura) y PR 5 (cierre).

## PR 3 — Detalle

**Auditoría de sectores y turnos:**
- Tabla `sectores`: existe en flux-dev con todas las columnas esperadas. UI completa en `src/app/(flux)/configuracion/secciones/SeccionEstructura.tsx` (CRUD vía cliente Supabase + RLS). Sin API REST dedicada, lo cual es consistente con el patrón del repo para tablas de configuración.
- Tabla `turnos_laborales`: existe con todas las columnas. API completa en `src/app/api/asistencias/turnos/route.ts` (GET + POST CRUD + acción reordenar). UI en `src/app/(flux)/asistencias/configuracion/turnos/*`.
- **Faltaba**: el `CREATE TABLE` no estaba trackeado en `sql/`. Las tablas se crearon vía Studio. Se agregan archivos "shadow" idempotentes (079, 080) para que un dev nuevo pueda recrear el esquema desde `sql/`.

**Archivos tocados:**
- `sql/079_sectores_definicion.sql` (nuevo, idempotente con `IF NOT EXISTS` + `DO $$` guard para policy).
- `sql/080_turnos_laborales_definicion.sql` (nuevo, idempotente; incluye trigger `actualizar_timestamp`).

**Hallazgos para revisar fuera del scope nóminas (tech debt pre-existente):**
- `sectores.turno_id` y `miembros.turno_id` no tienen FK a `turnos_laborales(id)`. Permite valores huérfanos. Bajo impacto porque la app valida desde el lado servidor.
- `sectores` tiene **3 policies RLS** activas en flux-dev: dos legacy con `app_metadata.empresa_activa_id` + una con `auth.jwt() ->> 'empresa_id'`. La canónica del repo es la última; las otras dos quedan pendientes de limpieza en una migración futura.

**Aplicado en flux-dev:** no requiere ejecutar nada (las tablas ya existen; el archivo SQL es documentación reproducible).

## PR 4 — Detalle

**Archivos movidos con `git mv` (preserva historia):**
- `src/app/(flux)/asistencias/_componentes/ModalNomina.tsx` → `src/app/(flux)/nominas/_componentes/ModalNomina.tsx`
- `src/app/(flux)/asistencias/_componentes/VistaNomina.tsx` → `src/app/(flux)/nominas/_componentes/VistaNomina.tsx`
- `src/app/(flux)/asistencias/_componentes/ModalEnviarReciboNomina.tsx` → `src/app/(flux)/nominas/_componentes/ModalEnviarReciboNomina.tsx`
- `src/app/(flux)/asistencias/nomina/[miembro_id]/page.tsx` → `src/app/(flux)/nominas/empleado/[miembro_id]/page.tsx`
- `src/app/api/asistencias/nomina/route.ts` → `src/app/api/nominas/route.ts`
- `src/app/api/asistencias/nomina/enviar/route.ts` → `src/app/api/nominas/enviar/route.ts`
- `src/app/api/asistencias/nomina/enviar-whatsapp/route.ts` → `src/app/api/nominas/enviar-whatsapp/route.ts`

**Wrappers de compat (deprecados, eliminar tras 1 release):**
- `src/app/api/asistencias/nomina/route.ts` — re-exporta `GET` desde `/api/nominas`.
- `src/app/api/asistencias/nomina/enviar/route.ts` — re-exporta `POST` desde `/api/nominas/enviar`.
- `src/app/api/asistencias/nomina/enviar-whatsapp/route.ts` — re-exporta `POST` desde `/api/nominas/enviar-whatsapp`.

**Archivos actualizados (imports + URLs):**
- `src/app/(flux)/asistencias/_componentes/ContenidoAsistencias.tsx` — `import VistaNomina` ahora apunta al nuevo path.
- `src/app/(flux)/asistencias/_componentes/VistaMatriz.tsx` — idem para `ModalNomina`.
- `src/componentes/entidad/_editor_nomina_empleado/PaginaEditorNominaEmpleado.tsx` — `import ModalEnviarReciboNomina` + fetch URLs + breadcrumb + replaceState.
- `src/componentes/entidad/_editor_plantilla_meta/PaginaEditorPlantillaMeta.tsx` — fetch URL.
- `src/app/(flux)/dashboard/_componentes/WidgetSueldos.tsx` — link "Asistencias → Nómina" reemplazado por "Nóminas" → `/nominas`.
- `src/lib/salix-ia/herramientas/ejecutores/{eliminar,modificar}-movimiento-nomina.ts` — links `{{link:/nominas|Nómina}}`.
- `src/lib/{asistencias/dias-habiles,salix-ia/herramientas/ejecutores/mi-recibo-periodo,whatsapp/variables}.ts` y `src/app/api/dashboard/{sueldos-mes,asistencia-mes}/route.ts` — comentarios actualizados al path canónico.

**Página /nominas:**
Reemplazado el placeholder de PR 1 por una página real que renderiza `<VistaNomina>`. La página `/asistencias` sigue teniendo la pestaña Nómina (mismo componente importado del nuevo path) — eso se limpia en PR 4b.

**Scope reducido vs plan original:**
El plan PR 4 incluía además: desmontar pestaña "Nómina" de asistencias, agregar tabs (Liquidaciones / Adelantos / Empleados / Configuración). Se difiere a PR 4b para reducir blast radius: este PR es solo mecánico (renames + wrappers + imports). Los users no perciben cambios funcionales — sigue funcionando todo donde antes funcionaba, más ahora también desde `/nominas`.
