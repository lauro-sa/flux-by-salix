# Progreso — Módulo Nóminas

> Tracking de PRs del plan [PLAN_MODULO_NOMINAS.md](PLAN_MODULO_NOMINAS.md).
> Cuando todo termine este archivo se elimina.

## Estado por PR

| # | Título | Estado | Notas |
|---|---|---|---|
| 1 | Esqueleto del módulo + auto-dependencias | ✅ Hecho | Catálogo + sidebar + auto-instalación cascada de `asistencias` |
| 2 | Tablas base: contratos y conceptos | ⏳ Pendiente | |
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
