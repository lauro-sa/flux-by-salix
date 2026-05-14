# Plan de implementación — Módulo Nóminas

> **Rama de trabajo:** `feat/modulo-nominas`
> **Fecha de creación del plan:** 2026-05-14
> **Para:** Chat ejecutor (Claude Code)
> **Modo:** autónomo. No preguntar al usuario salvo bloqueo crítico. Revisar el propio trabajo antes de avanzar.

---

## 0. Reglas no negociables (leer antes de tocar nada)

1. **Revisión doble obligatoria.** Después de terminar cada PR, antes de marcarlo como hecho:
   - Releer todos los archivos modificados/creados (`git diff`).
   - Volver a leerlos en frío como si fueras un revisor externo.
   - Correr `npm run typecheck` y `npm run lint`. Cero errores.
   - Probar el flujo manualmente en `npm run dev` (al menos golden path).
2. **Multi-tenant siempre.** Toda tabla nueva con `empresa_id uuid NOT NULL` + RLS con `USING (empresa_id = (auth.jwt() ->> 'empresa_id')::uuid)`.
3. **Auditoría obligatoria** en toda tabla nueva: `creado_en`, `creado_por`, `actualizado_en`, `actualizado_por`. Tabla `auditoria` debe registrar cambios. Componente `IndicadorEditado` en UI.
4. **Todo en español** (variables, archivos, props, tipos, hooks, comentarios). Tildes correctas.
5. **Tokens de diseño**, nunca colores hardcodeados.
6. **Patrón existente.** Reutilizar `PlantillaListado`, `PlantillaEditor`, `TablaDinamica`, `PanelFiltrosAvanzado`, `MiniSelectorIcono`. NO reinventar componentes.
7. **Filtros avanzados:** todo listado nuevo sigue el patrón estándar (ver CLAUDE.md sección "Filtros avanzados").
8. **Migraciones SQL:** archivos numerados secuencialmente en `sql/`. Nombre claro. Comentarios al inicio explicando qué hace y por qué.
9. **Doble escritura legacy ↔ nuevo** durante transiciones (igual que en `feat/estados-configurables`).
10. **PRs pequeños y mergeables.** Cada PR debe poder mergearse a `main` sin romper nada (incluso si los siguientes no se hicieron).
11. **No usar `any`.** Tipado estricto.
12. **Cero parches.** Si encontrás inconsistencia BD/UI, arreglar de raíz con migración, no con helpers visuales.

---

## 1. Arquitectura general

### Concepto clave: **Contrato laboral con vigencia**

Cada empleado tiene **un contrato vigente + N contratos históricos**. Al cambiar salario, sector, turno o modalidad → se **genera un contrato nuevo** con fecha de inicio. El anterior queda con `fecha_fin` y `vigente = false`. Esto da:
- Timeline visual de la evolución laboral del empleado.
- Recibos pasados quedan congelados con su contrato.
- Preparado para auditoría legal y contaduría.

### Separación crítica: **modalidad de cálculo ≠ frecuencia de pago**

- **Modalidad de cálculo:** cómo se calcula cuánto ganó (`por_hora`, `por_dia`, `fijo_semanal`, `fijo_quincenal`, `fijo_mensual`).
- **Frecuencia de pago:** cada cuánto se le paga (`diaria`, `semanal`, `quincenal`, `mensual`).
Combinándolos cubrimos todos los casos reales.

### Distribución de la información

| Dato | Vive en | Comentario |
|---|---|---|
| Sectores (catálogo) | Config Empresa | Maestro compartido |
| Turnos/horarios (catálogo) | Config Empresa | Plantillas reusables |
| Conceptos de nómina (catálogo) | Config Nóminas | Premios, presentismo, descuentos |
| Contrato del empleado | Módulo Nóminas → Ficha laboral | Sector, turno, modalidad, salario, conceptos aplicables |
| Liquidaciones/recibos | Módulo Nóminas | Snapshot del contrato vigente |
| Adelantos | Módulo Nóminas | Ya existe, solo migrar UI |
| Fichajes/turnos diarios | Módulo Asistencias | Solo registro de horas |

---

## 2. Setup inicial

```bash
git checkout main
git pull
git checkout -b feat/modulo-nominas
```

Crear archivo `MODULO_NOMINAS_PROGRESO.md` en la raíz para ir marcando PRs hechos. Ignorar ese archivo en el commit final del proyecto (o eliminarlo cuando termine todo).

---

## 3. Etapas (PRs incrementales)

> Cada etapa = 1 PR a `main`. Después de cada merge, rebase de la rama de trabajo si hace falta.

---

### **PR 1 — Esqueleto del módulo + auto-dependencias**

**Objetivo:** Que el módulo `nominas` aparezca en `/aplicaciones` como instalable y dependa de `asistencias` (al instalarlo se instala asistencias si no está).

**Cambios:**

1. **Migración SQL** (`sql/0XX_modulo_nominas_catalogo.sql`):
   ```sql
   INSERT INTO catalogo_modulos (slug, nombre, descripcion, icono, categoria, es_base, orden, tier, requiere)
   VALUES ('nominas', 'Nóminas', 'Liquidación de salarios, contratos laborales, conceptos de pago y adelantos.', 'banknote', 'admin', false, 18, 'starter', ARRAY['asistencias']);
   ```
   Verificar que la columna `requiere` exista (si no, agregarla con ALTER TABLE).

2. **Sidebar** ([src/componentes/entidad/_sidebar/itemsNav.ts](src/componentes/entidad/_sidebar/itemsNav.ts)):
   Agregar item `nominas` con `moduloCatalogo: 'nominas'`, ícono `banknote`, ruta `/nominas`, justo debajo de Asistencias.

3. **Tipos** ([src/tipos/modulos.ts](src/tipos/modulos.ts)):
   Agregar `nominas: ['/nominas']` a `RUTAS_POR_MODULO`.

4. **Auto-instalación de dependencias** ([src/app/api/modulos/route.ts](src/app/api/modulos/route.ts)):
   En el `POST` de instalación, antes de instalar el módulo solicitado, leer su `requiere`. Para cada slug requerido que no esté instalado, instalarlo en cascada. Loggear cada instalación.

5. **Página placeholder** (`src/app/(flux)/nominas/page.tsx`):
   ```tsx
   <GuardPagina modulo="nominas">
     <div>Módulo Nóminas — en construcción</div>
   </GuardPagina>
   ```

**Criterios de hecho:**
- [ ] Migración aplicada en local.
- [ ] Ir a `/aplicaciones` con asistencias desinstalada → instalar Nóminas → ambas quedan instaladas.
- [ ] Aparece "Nóminas" en sidebar.
- [ ] Click en sidebar → muestra placeholder.
- [ ] `npm run typecheck` y `npm run lint` sin errores.
- [ ] PR creado, mergeado a `main`.

---

### **PR 2 — Tablas base: contratos y conceptos**

**Objetivo:** Crear el modelo de datos completo. Sin UI todavía.

**Cambios:**

1. **Migración** (`sql/0XX_contratos_laborales.sql`):
   ```sql
   CREATE TABLE contratos_laborales (
     id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
     empresa_id uuid NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
     miembro_id uuid NOT NULL REFERENCES miembros(id) ON DELETE CASCADE,
     fecha_inicio date NOT NULL,
     fecha_fin date,
     vigente boolean NOT NULL DEFAULT true,
     condicion text NOT NULL CHECK (condicion IN ('tiempo_indeterminado','plazo_fijo','temporal','pasantia','otro')),
     modalidad_calculo text NOT NULL CHECK (modalidad_calculo IN ('por_hora','por_dia','fijo_semanal','fijo_quincenal','fijo_mensual')),
     monto_base numeric(14,2) NOT NULL CHECK (monto_base >= 0),
     frecuencia_pago text NOT NULL CHECK (frecuencia_pago IN ('diaria','semanal','quincenal','mensual')),
     sector_id uuid REFERENCES sectores(id),
     turno_id uuid REFERENCES turnos_laborales(id),
     regimen text NOT NULL DEFAULT 'informal' CHECK (regimen IN ('informal','monotributo','relacion_dependencia')),
     pdf_url text,
     motivo_cambio text,
     notas text,
     creado_en timestamptz NOT NULL DEFAULT now(),
     creado_por uuid REFERENCES usuarios(id),
     actualizado_en timestamptz NOT NULL DEFAULT now(),
     actualizado_por uuid REFERENCES usuarios(id)
   );
   CREATE UNIQUE INDEX idx_contrato_vigente_unico ON contratos_laborales (miembro_id) WHERE vigente = true;
   CREATE INDEX idx_contratos_empresa_miembro ON contratos_laborales (empresa_id, miembro_id);
   CREATE INDEX idx_contratos_fechas ON contratos_laborales (empresa_id, fecha_inicio, fecha_fin);
   ALTER TABLE contratos_laborales ENABLE ROW LEVEL SECURITY;
   CREATE POLICY contratos_laborales_tenant ON contratos_laborales
     USING (empresa_id = (auth.jwt() ->> 'empresa_id')::uuid);
   ```

2. **Migración** (`sql/0XX_conceptos_nomina.sql`):
   ```sql
   CREATE TABLE conceptos_nomina (
     id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
     empresa_id uuid NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
     nombre text NOT NULL,
     descripcion text,
     tipo text NOT NULL CHECK (tipo IN ('haber','descuento')),
     categoria text CHECK (categoria IN ('presentismo','premio','bono','antiguedad','adicional','descuento_uniforme','descuento_otro','otro')),
     modo_calculo text NOT NULL CHECK (modo_calculo IN ('monto_fijo','porcentaje_basico','por_dia','por_evento','manual')),
     valor numeric(14,4),
     automatico boolean NOT NULL DEFAULT true,
     condicion_jsonb jsonb,
     recurrente boolean NOT NULL DEFAULT true,
     activo boolean NOT NULL DEFAULT true,
     orden int NOT NULL DEFAULT 0,
     icono text DEFAULT 'star',
     color text DEFAULT '#6b7280',
     creado_en timestamptz NOT NULL DEFAULT now(),
     creado_por uuid REFERENCES usuarios(id),
     actualizado_en timestamptz NOT NULL DEFAULT now(),
     actualizado_por uuid REFERENCES usuarios(id)
   );
   CREATE INDEX idx_conceptos_empresa_activo ON conceptos_nomina (empresa_id, activo);
   ALTER TABLE conceptos_nomina ENABLE ROW LEVEL SECURITY;
   CREATE POLICY conceptos_nomina_tenant ON conceptos_nomina
     USING (empresa_id = (auth.jwt() ->> 'empresa_id')::uuid);

   CREATE TABLE conceptos_contrato (
     id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
     empresa_id uuid NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
     contrato_id uuid NOT NULL REFERENCES contratos_laborales(id) ON DELETE CASCADE,
     concepto_id uuid NOT NULL REFERENCES conceptos_nomina(id) ON DELETE RESTRICT,
     valor_override numeric(14,4),
     activo boolean NOT NULL DEFAULT true,
     creado_en timestamptz NOT NULL DEFAULT now(),
     creado_por uuid REFERENCES usuarios(id),
     UNIQUE (contrato_id, concepto_id)
   );
   CREATE INDEX idx_conceptos_contrato_contrato ON conceptos_contrato (contrato_id);
   ALTER TABLE conceptos_contrato ENABLE ROW LEVEL SECURITY;
   CREATE POLICY conceptos_contrato_tenant ON conceptos_contrato
     USING (empresa_id = (auth.jwt() ->> 'empresa_id')::uuid);

   CREATE TABLE conceptos_aplicados_pago (
     id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
     empresa_id uuid NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
     pago_nomina_id uuid NOT NULL REFERENCES pagos_nomina(id) ON DELETE CASCADE,
     concepto_id uuid REFERENCES conceptos_nomina(id) ON DELETE SET NULL,
     nombre_snapshot text NOT NULL,
     tipo text NOT NULL CHECK (tipo IN ('haber','descuento')),
     monto numeric(14,2) NOT NULL,
     automatico boolean NOT NULL DEFAULT true,
     detalle text,
     creado_en timestamptz NOT NULL DEFAULT now()
   );
   CREATE INDEX idx_conceptos_aplicados_pago ON conceptos_aplicados_pago (pago_nomina_id);
   ALTER TABLE conceptos_aplicados_pago ENABLE ROW LEVEL SECURITY;
   CREATE POLICY conceptos_aplicados_pago_tenant ON conceptos_aplicados_pago
     USING (empresa_id = (auth.jwt() ->> 'empresa_id')::uuid);
   ```

3. **Migración** (`sql/0XX_pagos_nomina_contrato_snapshot.sql`):
   ```sql
   ALTER TABLE pagos_nomina
     ADD COLUMN contrato_id uuid REFERENCES contratos_laborales(id),
     ADD COLUMN contrato_snapshot jsonb;
   CREATE INDEX idx_pagos_nomina_contrato ON pagos_nomina (contrato_id);
   ```

4. **Migración semilla** (`sql/0XX_seed_contratos_desde_miembros.sql`):
   Para cada miembro existente, generar un `contrato_laboral` vigente con:
   - `fecha_inicio = miembros.creado_en::date`
   - `condicion = 'tiempo_indeterminado'`
   - `modalidad_calculo`: mapear desde `compensacion_tipo` (`fijo` → `fijo_mensual`, `por_dia` → `por_dia`, `por_hora` → `por_hora`)
   - `monto_base = compensacion_monto`
   - `frecuencia_pago = compensacion_frecuencia`
   - `regimen = 'informal'`
   - `motivo_cambio = 'Migración inicial desde campos legacy en miembros'`
   Saltear miembros sin `compensacion_monto`.

5. **Tipos TS** (`src/tipos/nominas.ts`):
   - `ContratoLaboral`, `ContratoLaboralConRelaciones`, `ConceptoNomina`, `ConceptoContrato`, `ConceptoAplicadoPago`, enums.

6. **Auditoría:** registrar las tablas nuevas en el sistema de auditoría existente.

**Criterios de hecho:**
- [ ] Migraciones aplicadas, sin errores.
- [ ] Tablas creadas con RLS activa.
- [ ] Semilla creó un contrato vigente para cada miembro existente con compensación.
- [ ] `npm run typecheck` OK.
- [ ] PR mergeado.

---

### **PR 3 — Verificar y completar sectores y turnos**

**Objetivo:** Asegurar que sectores y turnos están sólidos. Si faltan tablas/CRUD, completar.

**Cambios:**

1. **Auditar** las tablas `sectores` y `turnos_laborales` en `sql/`. Si no existe `CREATE TABLE` explícito:
   - Crearlas con todas las columnas necesarias (ver radiografía: nombre, color, icono, activo, orden, padre_id, jefe_id, turno_id default).
   - `turnos_laborales`: id, empresa_id, nombre, es_default, flexible, tolerancia_min, dias_jsonb (días de la semana con horarios).

2. **API completa** `/api/sectores/` y `/api/turnos/` con GET (listar), POST (crear), PATCH (actualizar), DELETE (desactivar).

3. **UI Config Empresa**: pestañas Sectores y Turnos con CRUD usando `PlantillaListado` + modales de edición.

4. Si ya está completo: solo dejar registrado en `MODULO_NOMINAS_PROGRESO.md` y saltar.

**Criterios de hecho:**
- [ ] Puedo crear/editar/desactivar sectores y turnos desde Config Empresa.
- [ ] Cada sector puede tener turno default.
- [ ] PR mergeado.

---

### **PR 4 — Migración de UI y API: nóminas → módulo propio**

**Objetivo:** Mover todo lo que hoy vive bajo `asistencias` y pertenece a nóminas hacia el nuevo módulo.

**Cambios:**

1. **Mover componentes:**
   - `src/app/(flux)/asistencias/_componentes/ModalNomina.tsx` → `src/app/(flux)/nominas/_componentes/ModalNomina.tsx`
   - `src/app/(flux)/asistencias/_componentes/ModalEnviarReciboNomina.tsx` → `src/app/(flux)/nominas/_componentes/`
   - `src/app/(flux)/asistencias/_componentes/VistaNomina.tsx` → `src/app/(flux)/nominas/_componentes/`
   - Mover subruta `src/app/(flux)/asistencias/nomina/[miembro_id]/` → `src/app/(flux)/nominas/empleado/[miembro_id]/`

2. **Mover API:**
   - `src/app/api/asistencias/nomina/*` → `src/app/api/nominas/*`
   - Dejar los endpoints viejos por 1 release como wrappers que reexportan los nuevos (compat hacia atrás).

3. **Mover adelantos UI** (si está embebido en asistencias) hacia `(flux)/nominas/adelantos/`. La API de adelantos ya está en `/api/adelantos/`, no mover (es estable).

4. **Actualizar imports** en todo el repo. Buscar referencias a las rutas viejas y actualizar.

5. **Página principal de Nóminas** (`src/app/(flux)/nominas/page.tsx`):
   - Reemplazar placeholder por el listado real (estilo Asistencias hoy, pero solo pestaña Nómina por ahora).
   - Pestañas: Liquidaciones | Adelantos | Empleados | Configuración.

6. **Asistencias** queda solo con: fichajes, matriz de asistencias, reportes de horas, configuración de turnos/jornadas. Quitar todo botón/link a nóminas (queda en su módulo).

7. **Salix IA tools** (consultar/crear movimientos de nómina): actualizar imports si rompen.

**Criterios de hecho:**
- [ ] Toda la funcionalidad de nóminas accesible desde `/nominas`.
- [ ] Asistencias funciona sin nóminas (probar con módulo nóminas desinstalado).
- [ ] Endpoints viejos siguen funcionando (compat).
- [ ] Tools de Salix IA siguen funcionando (correr fixtures de tests).
- [ ] `npm run typecheck`, `npm run lint`, `npm test` OK.
- [ ] PR mergeado.

---

### **PR 5 — Ficha laboral con timeline de contratos**

**Objetivo:** UI completa de ficha laboral del empleado con historial de contratos.

**Cambios:**

1. **Página** (`src/app/(flux)/nominas/empleado/[miembro_id]/page.tsx`):
   - Header: foto, nombre, sector vigente, turno vigente, modalidad/monto vigente.
   - Pestañas: Contrato vigente | Historial | Liquidaciones | Adelantos | Conceptos.

2. **Componente `ContratoVigente`**: muestra todos los datos del contrato actual. Botón "Nuevo contrato" arriba a la derecha.

3. **Componente `TimelineContratos`**: lista vertical con cada contrato (vigente arriba, históricos abajo). Cada item muestra fecha inicio→fin, modalidad, monto, sector, turno, motivo del cambio. Click expande detalle.

4. **Modal `EditorContrato`** (sigue patrón `ModalTipoActividad`):
   - Tamaño 5xl, grid 2 columnas.
   - Sección ancho completo: identidad (sector + turno + condición).
   - Columna izquierda: modalidad de cálculo + monto base + frecuencia de pago + fechas vigencia.
   - Columna derecha: régimen + PDF + motivo del cambio + notas.
   - Pestaña secundaria: conceptos aplicables (tags toggleables del catálogo + valor override por concepto).
   - Submit: crea contrato nuevo. Cierra el anterior con `fecha_fin = nuevo.fecha_inicio - 1 día` y `vigente = false`. Todo en transacción.

5. **API**:
   - `GET /api/nominas/contratos?miembro_id=...` → lista todos.
   - `GET /api/nominas/contratos/[id]` → detalle.
   - `POST /api/nominas/contratos` → crea nuevo + cierra anterior (transacción).
   - `PATCH /api/nominas/contratos/[id]` → editar (solo motivo/notas/PDF, no datos económicos — para cambio económico se crea contrato nuevo).

6. **Validaciones backend:**
   - Solo un contrato vigente por miembro (índice ya lo garantiza).
   - `fecha_inicio` no puede ser anterior al cierre del contrato anterior.
   - Si modalidad cambia, modificar también `compensacion_*` en miembros (doble escritura legacy).

7. **Vinculación** desde el listado de empleados: click en empleado → ficha laboral.

**Criterios de hecho:**
- [ ] Ver ficha laboral de cualquier miembro.
- [ ] Crear contrato nuevo cierra el anterior.
- [ ] Timeline muestra evolución correcta.
- [ ] Filtros avanzados en listado de empleados (con `gruposFiltros`: sector, turno, modalidad, régimen).
- [ ] PR mergeado.

---

### **PR 6 — Configuración de conceptos + asignación a contratos**

**Objetivo:** UI para administrar el catálogo de conceptos y asignarlos a contratos.

**Cambios:**

1. **Página config** (`src/app/(flux)/nominas/configuracion/conceptos/page.tsx`):
   - Listado con `PlantillaListado` + filtros (tipo, categoría, automático, activo).
   - Botón "Nuevo concepto".

2. **Modal `EditorConcepto`** (patrón `ModalTipoActividad`):
   - Identidad: nombre + ícono + color + categoría.
   - Tipo (haber/descuento) como pills.
   - Modo de cálculo: select con opciones contextual.
   - Valor: input numérico (oculto si modo = `manual`).
   - Switch `automatico` (si es manual desactivado, no se aplica solo).
   - Constructor de condición (JSONB):
     - "Sin ausencias en el período"
     - "Sin tardanzas en el período"
     - "Antigüedad ≥ X meses"
     - "Siempre"
     - (Empezar con estas 4, dejar la estructura abierta para más).
   - Switch `recurrente` y `activo`.

3. **Conceptos sugeridos al instalar el módulo:** seed inicial con:
   - Presentismo (haber, porcentaje 10% del básico, condición "sin ausencias")
   - Premio puntualidad (haber, monto fijo, condición "sin tardanzas")
   - Antigüedad (haber, manual)
   - Descuento por uniforme (descuento, monto manual)

4. **Asignación a contratos:** ya cubierta en PR 5 (pestaña conceptos del editor de contrato).

5. **API** (`/api/nominas/conceptos`): GET, POST, PATCH, DELETE (soft con `activo`).

**Criterios de hecho:**
- [ ] Crear/editar conceptos desde la config.
- [ ] Al instalar nóminas, se crean los 4 conceptos sugeridos.
- [ ] Asignar conceptos a un contrato funciona y se guarda.
- [ ] PR mergeado.

---

### **PR 7 — Motor de cálculo automático del recibo**

**Objetivo:** Que al abrir/calcular un recibo, el sistema arme TODO solo: días trabajados, monto base, conceptos automáticos, descuentos, adelantos, neto.

**Cambios:**

1. **Función central** (`src/lib/nominas/calcular-recibo.ts`):
   ```ts
   calcularRecibo({
     miembroId, periodoInicio, periodoFin
   }): Promise<DetalleReciboCalculado>
   ```
   Pasos internos:
   1. Obtener contrato vigente al `periodoFin` (o el más reciente si todos cerraron).
   2. Leer asistencias del período → calcular `dias_trabajados`, `dias_ausentes`, `tardanzas`, `horas_netas`.
   3. Calcular `monto_base_calculado` según modalidad:
      - `por_dia`: `dias_trabajados × monto_base`
      - `por_hora`: `horas_netas × monto_base`
      - `fijo_mensual`: prorratear si frecuencia ≠ mensual
      - `fijo_quincenal`: idem
      - `fijo_semanal`: idem
   4. Para cada concepto activo del contrato:
      - Si `automatico = true`: evaluar `condicion_jsonb` con los datos de asistencia. Si cumple → calcular monto según `modo_calculo` (con `valor_override` si existe) → sumar a haberes/descuentos.
      - Si `automatico = false`: dejar como sugerencia para agregar manual.
   5. Buscar adelantos vigentes con cuotas vencidas en este período → sumar como descuentos.
   6. Calcular subtotal y neto.
   7. Devolver desglose completo.

2. **API** (`POST /api/nominas/calcular`): recibe miembro + período → llama a `calcularRecibo` → devuelve preview.

3. **API** (`POST /api/nominas`): crea el `pago_nomina` con:
   - `contrato_id` y `contrato_snapshot` (JSONB del contrato completo en ese momento).
   - Inserta `conceptos_aplicados_pago` con cada haber/descuento aplicado.
   - Marca cuotas de adelanto como descontadas.

4. **Modal/Vista de Nómina** actualizado:
   - Al abrir, ejecuta cálculo en vivo.
   - Muestra desglose: haberes (uno por concepto) + descuentos + neto.
   - Permite agregar conceptos manuales.
   - Botón "Confirmar y pagar" graba todo.

5. **Tests unitarios** (`src/lib/nominas/__tests__/calcular-recibo.test.ts`):
   - Caso jornalero por_dia/quincenal.
   - Caso sueldo fijo_mensual/mensual.
   - Caso sueldo fijo_mensual/quincenal (prorrateo).
   - Caso con presentismo aplicado.
   - Caso con presentismo NO aplicado por ausencia.
   - Caso con adelanto descontado.
   - Caso con cambio de contrato a mitad de período.

**Criterios de hecho:**
- [ ] Tests pasan (mínimo 7).
- [ ] Abrir recibo de un miembro real muestra cálculo correcto.
- [ ] Recibo grabado tiene snapshot del contrato.
- [ ] PR mergeado.

---

### **PR 8 — Recibo PDF profesional + envío**

**Objetivo:** Mejorar el comprobante PDF y el flujo de envío.

**Cambios:**

1. **Template PDF** (usar el sistema de PDF que ya tenga el repo, sino `@react-pdf/renderer` o `pdfmake`):
   - Encabezado: empresa + logo + período + número de recibo.
   - Datos empleado: nombre, sector, turno, modalidad, contrato vigente, régimen.
   - Tabla haberes (concepto + detalle + monto).
   - Tabla descuentos (concepto + detalle + monto).
   - Total neto destacado.
   - Pie con firma.

2. **Mejorar `ModalEnviarReciboNomina`:**
   - Preview del PDF antes de enviar.
   - Opciones de canal: WhatsApp, correo, descargar.
   - Adjuntar PDF generado.

3. **Almacenamiento:** subir PDF a Supabase Storage en bucket `comprobantes-nomina/<empresa_id>/<año>/<archivo>.pdf`. Guardar URL en `pagos_nomina.comprobante_url`.

**Criterios de hecho:**
- [ ] Generar PDF de un recibo real, descargar y revisar visualmente.
- [ ] Enviar por WhatsApp y por correo (ambos canales).
- [ ] PDF queda almacenado con URL accesible.
- [ ] PR mergeado.

---

### **PR 9 — Documentación de usuario (en español)**

**Objetivo:** Documentar todo el módulo para el usuario final + marcar strings para i18n futura.

**Cambios:**

1. **Guía de usuario** (`docs/usuario/modulo-nominas.md`):
   - Cómo instalar el módulo.
   - Cómo crear un sector y un turno.
   - Cómo crear un contrato laboral.
   - Cómo configurar conceptos (presentismo, premios).
   - Cómo liquidar una quincena.
   - Cómo cargar un adelanto.
   - Cómo enviar un recibo.

2. **Strings UI:** revisar que todos los textos estén centralizados en archivos de traducción si el sistema i18n está activo. Si no, dejar comentario `// i18n: pendiente` cerca de strings hardcodeados.

3. **CONTEXTO_REBUILD.md:** agregar sección "Módulo Nóminas" con resumen de tablas, hooks, componentes, endpoints.

**Criterios de hecho:**
- [ ] Documento legible por un usuario no técnico.
- [ ] PR mergeado.

---

## 4. Fase 3 — Régimen fiscal (cuando el usuario lo pida)

> No incluir en este sprint salvo confirmación explícita del usuario.

PRs futuros:
- **PR 10**: Tabla `parametros_fiscales_empresa` con alícuotas configurables.
- **PR 11**: Conceptos automáticos de retención (jubilación, IPS, obra social) según régimen del contrato.
- **PR 12**: Recibo de sueldo legal con formato AFIP/IPS.
- **PR 13**: Reporte mensual de aportes para presentar.
- **PR 14**: Integración con módulo Contaduría (cuando exista).

---

## 5. Reglas de revisión doble (obligatorio antes de cada PR)

Después de terminar cada PR, ANTES de marcar como hecho:

### Pasada 1 — Auto-revisión
1. `git diff main...HEAD` y leer todo el cambio.
2. Para cada archivo nuevo/modificado:
   - ¿Sigue convenciones del proyecto (CLAUDE.md)?
   - ¿Tipos sin `any`?
   - ¿Comentarios en español?
   - ¿Tokens semánticos en vez de colores hardcodeados?
   - ¿RLS en tablas nuevas?
   - ¿Auditoría en tablas nuevas?
3. Correr:
   - `npm run typecheck`
   - `npm run lint`
   - `npm test` (si hay tests relacionados)
4. Probar el flujo manualmente en `npm run dev`.

### Pasada 2 — Revisión "fría" (como revisor externo)
1. Cerrar mentalmente lo que escribiste.
2. Releer el diff como si lo viera por primera vez.
3. Preguntarte:
   - ¿Esto rompe algo que ya existe?
   - ¿Qué pasa si el módulo nóminas está desinstalado?
   - ¿Qué pasa con un miembro sin contrato?
   - ¿Qué pasa si la empresa no tiene asistencias cargadas en el período?
   - ¿Funciona en mobile (responsive)?
   - ¿Funciona en dark mode?
4. Si encontrás algo, arreglar antes del PR.

### Si algo no funciona
- **NO** silenciar el error con try/catch genérico.
- **NO** hacer parches superficiales.
- Investigar root cause y arreglar de raíz.
- Si está fuera del alcance del PR, abrir issue/comentario en el plan y consultar al usuario.

---

## 6. Criterios de "todo terminado"

El plan se considera 100% completado cuando:

- [ ] PR 1 a 9 mergeados a `main`.
- [ ] Módulo Nóminas instalable/desinstalable desde `/aplicaciones`.
- [ ] Al instalar Nóminas se instala Asistencias automáticamente.
- [ ] Asistencias funciona perfecto con Nóminas desinstalada.
- [ ] Crear contrato laboral nuevo cierra el anterior y queda en historial.
- [ ] Recibo se calcula automático con días, conceptos, adelantos.
- [ ] PDF se genera y se envía por WhatsApp/correo.
- [ ] Documentación de usuario lista.
- [ ] Tests pasan (`npm test`).
- [ ] Cero errores de typecheck y lint.
- [ ] Probado manualmente con al menos 3 empleados con modalidades distintas.

---

## 7. Comunicación con el usuario

- **No preguntar** decisiones que ya están en este plan.
- **Sí preguntar** ante:
  - Bloqueo técnico real (algo del repo está roto y no se puede avanzar).
  - Decisión de producto que no esté en el plan.
  - Riesgo de pérdida de datos (migración compleja con muchos miembros).
- Avisar al usuario cuando se mergea cada PR (con resumen 2-3 líneas).
- Mantener `MODULO_NOMINAS_PROGRESO.md` actualizado en cada PR.

---

**Listo para arrancar. Branch:** `feat/modulo-nominas`. **Primer paso:** PR 1.
