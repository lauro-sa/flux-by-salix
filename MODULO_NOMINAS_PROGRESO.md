# Progreso — Módulo Nóminas

> Tracking de PRs del plan [PLAN_MODULO_NOMINAS.md](PLAN_MODULO_NOMINAS.md).
> Cuando todo termine este archivo se elimina.

## Estado por PR

| # | Título | Estado | Notas |
|---|---|---|---|
| 1 | Esqueleto del módulo + auto-dependencias | ✅ Hecho (PR #37) | Catálogo + sidebar + auto-instalación cascada de `asistencias` |
| 2 | Tablas base: contratos y conceptos | ✅ Hecho (PR #40) | 5 migraciones + tipos TS + seed de 6 contratos vigentes desde miembros |
| 3 | Verificar y completar sectores y turnos | ✅ Hecho (PR #41) | Auditoría: UI + API ya estaban completos. Se agregan 2 archivos SQL "shadow" (079, 080) para que el repo sea reproducible |
| 4 | Migración UI y API: nóminas → módulo propio | ✅ Hecho (PR #42) | Files movidos con `git mv` + wrappers de compat |
| 4b | Limpiar asistencias y agregar tabs en /nominas | ✅ Hecho (PR #43) | Pestaña "Nómina" desmontada de asistencias + botón "Nómina" quitado de matriz + 4 tabs en /nominas (Liquidaciones / Adelantos / Empleados / Configuración) con sync URL |
| 5 | Ficha laboral con timeline de contratos | ✅ Hecho (PR #44) | API completa /api/nominas/contratos + /api/nominas/empleados + ficha laboral 5-tabs + EditorContrato modal con doble escritura legacy |
| 6 | Configuración de conceptos + asignación | ✅ Hecho | API CRUD + seed 4 conceptos + EditorConcepto modal + VistaConfiguracion en tab. Asignación a contratos diferida a PR 6b |
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

## PR 4b — Detalle

**Cambios funcionales (usuario percibe):**
- `/asistencias` ya no tiene pestaña "Nómina". Queda como una sola vista de fichajes/matriz. El acceso a nómina es exclusivamente por sidebar → `/nominas`.
- `/asistencias` (vista matriz) ya no tiene el botón "Nómina" que abría el modal de cálculo desde la selección. La selección sigue funcionando para otras acciones (export, etc.), pero la generación de nómina se hace ahora desde `/nominas`.
- `/nominas` tiene 4 pestañas: **Liquidaciones**, **Adelantos**, **Empleados**, **Configuración**. Solo la primera tiene contenido real (la `<VistaNomina />` que se movió en PR 4). Las otras tres muestran "en construcción" para señalizar al usuario qué viene. La tab activa se sincroniza con `?tab=...` en la URL para linkear directo.

**Archivos tocados:**
- `src/app/(flux)/asistencias/_componentes/ContenidoAsistencias.tsx`: quitados imports VistaNomina/Tabs/Banknote/Send/useRef, vars de permisos de nomina, `seccion` state, `nominaRef`, `tabsSeccion`, branches de `accionPrincipalHero` y `accionesHero`, JSX de `<Tabs>` y `<VistaNomina>`. Resultado: archivo solo de fichajes.
- `src/app/(flux)/asistencias/_componentes/VistaMatriz.tsx`: quitados import `ModalNomina`, ícono `Printer`, state `nominaAbierta`, computados `selEmpleadosNomina` y `selDiasNomina`, botón "Nómina" del toolbar y render del `<ModalNomina>`.
- `src/app/(flux)/nominas/page.tsx`: reemplazado el wrapper PR-4 por una página con 4 tabs (`Tabs` + ternarios) y sync URL.

**Scope deferido a PR siguientes:**
- Tab Empleados queda como placeholder hasta PR 5 (ficha laboral con timeline).
- Tab Configuración queda como placeholder hasta PR 6 (catálogo de conceptos).
- Tab Adelantos espera UI dedicada en PR futuro (no está en el plan formal pero se incluye en la nav para señalizar a usuarios dónde buscar).

## PR 5 — Detalle

**API nueva (3 endpoints):**
- `src/app/api/nominas/contratos/route.ts` — `GET ?miembro_id=...` (lista vigente + históricos) y `POST` (crea nuevo, cierra anterior con `fecha_fin = nuevo.fecha_inicio - 1` y `vigente=false`, todo en sucesión + doble escritura legacy en `miembros.compensacion_*`).
- `src/app/api/nominas/contratos/[id]/route.ts` — `GET` detalle + `PATCH` whitelist (solo `motivo_cambio`, `notas`, `pdf_url`; los cambios económicos requieren contrato nuevo por inmutabilidad del histórico).
- `src/app/api/nominas/empleados/route.ts` — listado de empleados con su contrato vigente expandido (sector + turno + modalidad + monto + frecuencia + régimen). Soporta filtros opcionales `sector_id`, `turno_id`, `modalidad`, `regimen`.

**Validaciones backend en POST contratos:**
- `miembro_id` debe pertenecer a la empresa del JWT (RLS + safety check explícito).
- `condicion`, `modalidad_calculo`, `frecuencia_pago`, `regimen` validados contra whitelist (enums espejo del CHECK SQL).
- `fecha_inicio` formato YYYY-MM-DD.
- `monto_base ≥ 0`.
- `fecha_inicio` no puede ser anterior al `fecha_inicio` del contrato vigente actual (sino el `restarUnDia` daría una fecha de cierre inválida).
- Permiso `nomina:editar` requerido.
- Restricción de `ver_propio`: el GET solo puede leer contratos del miembro vinculado al usuario.

**Componentes nuevos:**
- `EditorContrato.tsx` — modal 5xl con layout patrón ModalTipoActividad (identidad ancho completo + 2 columnas: cálculo izq / régimen-docs der). Prefilea desde `contratoActual` para el caso típico de "subir el sueldo" (solo cambia monto + motivo).
- `ContratoVigente.tsx` — card con datos del contrato actual + CTA "Nuevo contrato"; muestra EstadoVacio si no hay contrato.
- `TimelineContratos.tsx` — historial vertical con punto del timeline + ítems clickables (expanden detalle). Vigente arriba con badge "ACTIVO".
- `VistaEmpleados.tsx` — listado con búsqueda por nombre/número de empleado. Click navega a la ficha.

**Refactor de ficha laboral (`/nominas/empleado/[miembro_id]/page.tsx`):**
- Header sticky con foto/iniciales + nombre + sector/turno/modalidad/monto vigente.
- 5 tabs (sync con `?tab=...`): Contrato vigente · Historial · Liquidaciones · Adelantos · Conceptos.
- "Liquidaciones" envuelve la `<PaginaEditorNominaEmpleado />` legacy intacta (motor de cálculo aún no se cambió; lo ataca PR 7).
- "Adelantos" y "Conceptos" son placeholders por ahora.
- El editor de contrato se abre desde "Contrato vigente" o desde el EstadoVacio si no hay vigente; al guardar refresca y vuelve a la tab Contrato.

**Wire del tab Empleados en /nominas:**
- Reemplazado el placeholder por `<VistaEmpleados />`.

**Doble escritura legacy:**
- Al POST de contrato, además del insert en `contratos_laborales`, se actualiza `miembros.compensacion_tipo`, `compensacion_monto` y `compensacion_frecuencia` con el mapeo inverso al seed de PR 2 (modalidad → tipo legacy, frecuencia → frecuencia legacy con fallback `diaria → mensual` para no romper el CHECK del legacy).
- Esto permite seguir sirviendo a consumidores que aún lean los campos viejos hasta que se haga el cleanup final.

**Verificado:**
- `npx tsc --noEmit` verde.
- `npm run test:run` — 1675/1675.
- Smoke SQL: las queries de empleados + sus joins funcionan con datos reales en flux-dev.

## PR 6 — Detalle

**Migración + seed:**
- `sql/081_seed_conceptos_sugeridos.sql` — inserta 4 conceptos sugeridos (Presentismo / Premio puntualidad / Antigüedad / Descuento por uniforme) en el catálogo de toda empresa que ya tenga el módulo `nominas` activo. Aplicado en flux-dev (Herreelec SAS quedó con los 4).
- Hook en `src/app/api/modulos/route.ts` (`seedConceptosNominaSugeridos`): cuando una empresa nueva instala el módulo Nóminas, el endpoint ejecuta el mismo seed automáticamente. Idempotente con chequeo `NOT IN (nombres existentes)`.

**API nueva:**
- `src/app/api/nominas/conceptos/route.ts` — `GET` (lista, opcional `?incluirInactivos=true`) y `POST` (crea).
- `src/app/api/nominas/conceptos/[id]/route.ts` — `PATCH` (whitelist amplia) y `DELETE` (soft con `activo=false`). Permisos: `nomina:editar` para mutaciones, `nomina:ver_propio`/`ver_todos` para GET.

**Validaciones backend:**
- Whitelist de enums (`tipo`, `categoria`, `modo_calculo`) espejo del CHECK SQL.
- Coherencia `modo↔valor`: modo `manual` → valor NULL obligatorio; otros modos → valor numérico ≥ 0 obligatorio (matches el `CONSTRAINT conceptos_valor_segun_modo`).

**Componentes nuevos:**
- `EditorConcepto.tsx` — modal 5xl patrón ModalTipoActividad: identidad (nombre + categoría) → tipo (pills haber/descuento) → 2 columnas (Cálculo / Comportamiento). El campo "valor" se oculta cuando `modo = manual`. Constructor de condición simple con 4 opciones predefinidas (sin ausencias / sin tardanzas / antigüedad mínima / siempre), JSONB abierto para extender después.
- `VistaConfiguracion.tsx` — lista de conceptos con filtros (todos / haberes / descuentos + checkbox "mostrar inactivos"), tabla con color/nombre/categoría/tipo/modo/valor, botones Editar y Desactivar. CTA "Nuevo concepto" en el header.

**Wire:**
- Tab "Configuración" de `/nominas` reemplaza el placeholder por `<VistaConfiguracion />`.

**Scope deferido a PR 6b:**
- Asignación de conceptos al contrato dentro de `EditorContrato` (sub-tab "Conceptos aplicables" con tags toggleables + valor override). El plan original lo metía acá, lo separo porque `EditorContrato` ya está cargado y este PR ya tiene scope alto. Una vez listo, el tab "Conceptos" de la ficha laboral (hoy placeholder) muestra los conceptos asignados al contrato vigente.

**Verificado:**
- `npx tsc --noEmit` verde.
- `npm run test:run` — 1675/1675.
- Seed corrido contra flux-dev: 4 conceptos insertados en Herreelec SAS.
