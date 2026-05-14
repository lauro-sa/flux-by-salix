# Progreso — Módulo Nóminas

> Tracking de PRs del plan [PLAN_MODULO_NOMINAS.md](PLAN_MODULO_NOMINAS.md).
> Cuando todo termine este archivo se elimina.

## Estado por PR

| # | Título | Estado | Notas |
|---|---|---|---|
| 1 | Esqueleto del módulo + auto-dependencias | ✅ Hecho (PR #37) | Catálogo + sidebar + auto-instalación cascada de `asistencias` |
| 2 | Tablas base: contratos y conceptos | ✅ Hecho | 5 migraciones + tipos TS + seed de 6 contratos vigentes desde miembros |
| 3 | Verificar y completar sectores y turnos | ⏳ Pendiente | |
| 4 | Migración UI y API: nóminas → módulo propio | ⏳ Pendiente | |
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
