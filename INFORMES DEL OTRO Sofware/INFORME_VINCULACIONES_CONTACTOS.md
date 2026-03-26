# Informe: Sistema de Vinculaciones entre Contactos — SalixCRM

> **Propósito**: Documento técnico detallado para replicar el sistema de vinculaciones (relaciones entre contactos) en otro software con Supabase. Cubre: cómo se guarda, cómo se vincula, cómo se desvincula, bidireccionalidad, campos, jerarquías, y cómo se usa en documentos/visitas/actividades.

---

## 1. Concepto General

Cualquier contacto puede vincularse a cualquier otro contacto. Las vinculaciones son **bidireccionales por naturaleza** — si yo vinculo A con B, también se escribe la relación en B apuntando a A.

No hay una tabla/colección separada de vinculaciones. Todo vive dentro del contacto como un **array embebido** llamado `vinculados[]`.

---

## 2. Estructura de Datos del Vínculo

Cada contacto tiene un campo `vinculados` que es un array de objetos:

```json
{
  "vinculados": [
    {
      "id": "firestore_id_del_vinculado",
      "nombre": "María",
      "apellido": "García",
      "tipo": "persona",
      "puesto": "Encargada",
      "correo": "maria@empresa.com",
      "telefono": "+54 11 5678-1234",
      "cargo": "Gerente Comercial",
      "recibeDocumentos": true,
      "empresaPadre": {
        "id": "firestore_id_empresa",
        "nombre": "Corp SA"
      }
    },
    {
      "id": "otro_contacto_id",
      "nombre": "Corp SA",
      "apellido": null,
      "tipo": "empresa",
      "puesto": null,
      "correo": "info@corpsa.com",
      "telefono": "+54 11 4444-5555",
      "cargo": null,
      "recibeDocumentos": false,
      "empresaPadre": null
    }
  ]
}
```

### Detalle de cada campo del vínculo

| Campo | Tipo | Obligatorio | Descripción |
|-------|------|-------------|-------------|
| `id` | string | ✅ | ID del contacto vinculado (referencia interna) |
| `nombre` | string | ✅ | Nombre del vinculado (copia/cache al momento de vincular) |
| `apellido` | string \| null | ❌ | Apellido (null para empresas) |
| `tipo` | string | ✅ | Tipo del vinculado: empresa, persona, edificio, proveedor, lead, equipo |
| `puesto` | string \| null | ❌ | **Rol contextual** de este vinculado RESPECTO al contacto base. Ej: si vinculo a María con Edificio Centro, el puesto dice "Encargada" (su rol en ese edificio). Es diferente en cada lado de la relación. |
| `correo` | string \| null | ❌ | Email (copia al vincular) |
| `telefono` | string \| null | ❌ | Teléfono o WhatsApp (copia al vincular) |
| `cargo` | string \| null | ❌ | Cargo laboral del vinculado (copia de su ficha) |
| `recibeDocumentos` | boolean | ✅ | ¿Incluir como destinatario cuando se envían documentos al contacto base? Default: false |
| `empresaPadre` | object \| null | ❌ | Si el vinculado es persona y tiene empresa madre: `{ id, nombre }`. Se auto-completa al vincular. |

---

## 3. Cómo se Crea una Vinculación (paso a paso)

### Flujo del usuario:
1. Abro la ficha de un contacto (ej: "Edificio Centro")
2. Voy a la pestaña **Relaciones**
3. Hago clic en **"Vincular contacto"**
4. Se abre un modal de búsqueda — busco por nombre, email, teléfono, código
5. Selecciono al contacto (ej: "María García")
6. Opcionalmente asigno un **puesto** (ej: "Encargada")
7. Se guarda

### Qué pasa en la base de datos:

**Paso 1 — Se actualiza el contacto BASE (Edificio Centro):**
```json
// empresas/{idEmpresa}/contactos/{idEdificioCentro}
{
  "vinculados": [
    ...vinculados_existentes,
    {
      "id": "id_maria",
      "nombre": "María",
      "apellido": "García",
      "tipo": "persona",
      "puesto": "Encargada",
      "correo": "maria@empresa.com",
      "telefono": "+54...",
      "cargo": "Gerente Comercial",
      "recibeDocumentos": false,
      "empresaPadre": null
    }
  ]
}
```

**Paso 2 — Si es bidireccional, se actualiza el contacto VINCULADO (María García):**
```json
// empresas/{idEmpresa}/contactos/{idMaria}
{
  "vinculados": [
    ...vinculados_existentes_de_maria,
    {
      "id": "id_edificio_centro",
      "nombre": "Edificio Centro",
      "apellido": null,
      "tipo": "edificio",
      "puesto": null,
      "correo": null,
      "telefono": "+54...",
      "cargo": null,
      "recibeDocumentos": false,
      "empresaPadre": null
    }
  ]
}
```

**Nota importante**: el `puesto` solo se guarda en el lado del contacto base. En el lado recíproco queda `null`. Esto es porque el puesto es **contextual** — María es "Encargada" respecto al Edificio, pero el Edificio no tiene un "puesto" respecto a María.

### Auto-vinculación de empresa padre
Si vinculo a una persona que tiene empresa padre (ej: María trabaja en "Corp SA"), el sistema automáticamente:
1. Busca la empresa padre de María
2. La agrega también a `vinculados[]` del contacto base
3. Pone `empresaPadre: { id: "id_corp_sa", nombre: "Corp SA" }` en la entrada de María

---

## 4. Cómo se Desvincula

### Qué pasa:
1. Se elimina la entrada del array `vinculados[]` del contacto base
2. Se elimina la entrada recíproca del array `vinculados[]` del otro contacto
3. **SIEMPRE es bidireccional** — no se puede desvincular de un solo lado

```
// Antes: Edificio Centro vinculados = [{id: "maria"}, {id: "juan"}]
// Después de desvincular a María: vinculados = [{id: "juan"}]

// Y en María: se elimina la entrada que apunta a Edificio Centro
```

---

## 5. Operaciones sobre Vinculaciones

### 5.1 Cambiar puesto
- Actualiza el campo `puesto` de UNA entrada en `vinculados[]`
- **Solo afecta un lado** (el contacto base). El puesto es contextual.
- Ejemplo: Cambiar a María de "Encargada" a "Administradora" en el Edificio Centro

### 5.2 Toggle "Recibe Documentos"
- Cambia el flag `recibeDocumentos` de una entrada
- **Bidireccional** — se actualiza en AMBOS contactos
- Cuando envío un documento al Edificio Centro, el sistema mira qué vinculados tienen `recibeDocumentos: true` y los incluye como destinatarios

### Resumen de bidireccionalidad

| Operación | ¿Bidireccional? | ¿Por qué? |
|-----------|-----------------|-----------|
| Vincular | Opcional (default: NO) | El contacto base decide si vincular, el otro puede no saber |
| Desvincular | SIEMPRE SÍ | Si se rompe la relación, se rompe de ambos lados |
| Cambiar puesto | NO | El puesto es contextual, diferente significado en cada lado |
| Toggle recibe documentos | SIEMPRE SÍ | Coherencia: si "yo le mando docs", "él recibe docs de mí" |

---

## 6. Clasificación en la UI: Directos vs. Externos

La pantalla de relaciones muestra dos secciones:

### Directos (mis vinculados)
Contactos que YO vinculé. Puedo:
- Desvincular
- Cambiar puesto
- Editar datos básicos
- Toggle recibe documentos

### Externos (me vincularon a mí)
Contactos que ME vincularon a ellos, pero yo no los vinculé. Son read-only desde mi ficha. Para desvincular, hay que ir al contacto fuente.

### Regla de jerarquía para vínculos mutuos
Cuando AMBOS contactos se vincularon entre sí (mutuo), se aplica jerarquía:

| Mi tipo | Su tipo | Clasificación |
|---------|---------|---------------|
| empresa/edificio/proveedor | persona/lead | **Directo** (el contenedor "posee" a la persona) |
| persona/lead | empresa/edificio/proveedor | **Externo** (la persona "pertenece" al contenedor) |
| persona | persona | **Directo** en ambos lados |
| empresa | empresa | **Directo** en ambos lados |

---

## 7. Fuentes del Pool de Relaciones

La vista unifica 4 fuentes de relaciones en un solo listado:

| Fuente | Descripción | Cómo se detecta |
|--------|-------------|-----------------|
| `vinculado` | Vinculación directa (array `vinculados[]`) | Está en mi array vinculados |
| `subcontacto` | Relación padre-hijo legacy | El otro contacto tiene `parentId` apuntando a mí |
| `padre` | Yo soy hijo de este contacto | Mi `parentId` apunta a él |
| `reverso` | Me vinculó pero yo no lo vinculé | Él me tiene en su `vinculados[]` pero yo no lo tengo en el mío |

---

## 8. Datos que se Copian (Denormalización)

Al momento de vincular, se **copian** estos datos del contacto vinculado al array:
- nombre, apellido, tipo, correo, telefono, cargo

**Estos datos son una foto del momento**. Si el contacto vinculado cambia su nombre o email después, la copia en `vinculados[]` queda desactualizada.

La UI compensa esto cruzando con la lista completa de contactos en tiempo real y mostrando los datos frescos. Pero en la base de datos, la copia queda como estaba.

### Para Supabase esto NO hace falta
Con foreign keys y JOINs, no necesitás copiar datos. Simplemente guardás el ID y hacés JOIN al consultar:

```sql
SELECT v.puesto, v.recibe_documentos,
       c.nombre, c.apellido, c.tipo, c.correo, c.telefono, c.cargo
FROM contacto_vinculaciones v
JOIN contactos c ON c.id = v.vinculado_id
WHERE v.contacto_id = $1;
```

---

## 9. Cómo las Vinculaciones Impactan Otros Módulos

### 9.1 Documentos — Destinatarios
Cuando envío un documento (presupuesto, factura) al contacto X:
1. El sistema busca `X.vinculados[]` donde `recibeDocumentos === true`
2. Filtra los que tienen email
3. Los ofrece como destinatarios adicionales (CC)

```
Enviar Presupuesto a: Edificio Centro
CC automático: María García (Encargada) ✅, Juan Pérez (Propietario) ✅
```

### 9.2 Documentos — Facturar A / Dirigido A / Atención
Un documento puede tener hasta 4 contactos diferentes:
- **Cliente** (contacto principal del documento)
- **Facturar A** (a quién va la factura, puede ser la empresa madre)
- **Dirigido A** (a quién se entrega, puede ser un edificio)
- **Atención** (persona de contacto, puede ser un vinculado)

Estos se seleccionan de los vinculados del cliente principal.

### 9.3 Visitas — Estructura organizacional
Al crear una visita, el selector de contacto muestra la estructura jerárquica:
```
Corp SA (empresa)
  ├── María García (persona, Gerente)
  ├── Juan Pérez (persona, Técnico)
  └── Edificio Centro (edificio)
        └── Ana López (persona, Encargada)
```
Esto se arma a partir de los `vinculados[]` de cada contacto contenedor.

### 9.4 Actividades — Vínculos múltiples
Las actividades pueden vincularse a MÚLTIPLES entidades al mismo tiempo:
```json
{
  "vinculos": [
    { "tipo": "contacto", "id": "id_maria", "nombre": "María García" },
    { "tipo": "visita", "id": "id_visita", "nombre": "Visita #V-0012" },
    { "tipo": "documento", "id": "id_presu", "nombre": "P-0001" }
  ]
}
```
No usan el mismo sistema de `vinculados[]` de contactos — es un array diferente.

### 9.5 Conversaciones — Contacto vinculado
Cada conversación (WhatsApp, correo, interno) tiene UN contacto vinculado:
- `idContacto` → apunta al contacto
- Datos denormalizados: `contactoNombre`, `contactoEmpresa`, `contactoCargo`
- Cuando el contacto cambia de nombre, se sincronizan todas sus conversaciones

---

## 10. Puestos/Roles Predefinidos

Los puestos son **texto libre**, pero hay valores sugeridos configurables por empresa:

| Puesto | Uso típico |
|--------|------------|
| Consejo | Miembro del consejo de administración |
| Encargado | Encargado del edificio/local |
| Propietario | Dueño de la propiedad |
| Administrador | Administrador del consorcio |
| Técnico | Personal técnico |
| Inquilino | Inquilino de una propiedad |
| Empleado | Empleado de la empresa |
| Gerente | Gerente de área |
| Director | Director |
| Mantenimiento | Personal de mantenimiento |
| Socio | Socio comercial |
| Otro | Cualquier otro rol |

Estos son configurables por empresa en `empresas/{id}/configuracion/contactos`.puestos[]`.

---

## 11. Normalización de Versiones Legacy

El campo `puesto` pasó por 3 versiones:

| Versión | Campo | Ejemplo |
|---------|-------|---------|
| v1 (legacy) | `rol: "Encargado"` | String simple |
| v2 (legacy) | `roles: ["Encargado", "Propietario"]` | Array de strings |
| v3 (actual) | `puesto: "Encargado"` | String simple |

Al leer de la base de datos, siempre se normaliza a v3:
- Si tiene `puesto` → usar puesto
- Si tiene `roles[]` → usar roles[0]
- Si tiene `rol` → usar rol
- Si no tiene ninguno → null

---

## 12. Cómo Modelar en Supabase (Recomendación)

### Opción recomendada: Tabla intermedia

```sql
-- Tabla de vinculaciones entre contactos
CREATE TABLE contacto_vinculaciones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL REFERENCES empresas(id),

  -- Los dos contactos vinculados
  contacto_id UUID NOT NULL REFERENCES contactos(id) ON DELETE CASCADE,
  vinculado_id UUID NOT NULL REFERENCES contactos(id) ON DELETE CASCADE,

  -- Datos de la relación
  puesto TEXT,                    -- Rol contextual (diferente en cada dirección)
  recibe_documentos BOOLEAN DEFAULT false,

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID REFERENCES usuarios(id),

  -- Evitar duplicados
  UNIQUE(contacto_id, vinculado_id)
);

-- Índices para búsqueda rápida
CREATE INDEX idx_vinc_contacto ON contacto_vinculaciones(contacto_id);
CREATE INDEX idx_vinc_vinculado ON contacto_vinculaciones(vinculado_id);
CREATE INDEX idx_vinc_empresa ON contacto_vinculaciones(empresa_id);
```

### Reglas de negocio a implementar

```sql
-- 1. No vincularse a sí mismo
ALTER TABLE contacto_vinculaciones
ADD CONSTRAINT no_self_link CHECK (contacto_id != vinculado_id);

-- 2. RLS para multi-tenant
ALTER TABLE contacto_vinculaciones ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON contacto_vinculaciones
  USING (empresa_id = current_setting('app.empresa_id')::uuid);
```

### Bidireccionalidad en Supabase

**Dos opciones:**

**Opción A — Dos filas por vínculo (como SalixCRM):**
Al vincular A↔B, insertar:
```sql
INSERT INTO contacto_vinculaciones (contacto_id, vinculado_id, puesto)
VALUES
  ('id_A', 'id_B', 'Encargada'),   -- A ve a B como "Encargada"
  ('id_B', 'id_A', null);           -- B ve a A sin puesto
```

Ventaja: consultas simples (`WHERE contacto_id = $1` me da todos mis vinculados).
Desventaja: duplicación, hay que mantener consistencia.

**Opción B — Una fila por vínculo (normalizado):**
```sql
CREATE TABLE contacto_vinculaciones (
  id UUID PRIMARY KEY,
  empresa_id UUID NOT NULL,
  contacto_a_id UUID NOT NULL REFERENCES contactos(id),
  contacto_b_id UUID NOT NULL REFERENCES contactos(id),
  puesto_a TEXT,     -- Cómo A ve a B
  puesto_b TEXT,     -- Cómo B ve a A
  recibe_documentos BOOLEAN DEFAULT false,
  UNIQUE(contacto_a_id, contacto_b_id)
);
```

Consulta "mis vinculados":
```sql
SELECT
  CASE WHEN contacto_a_id = $1 THEN contacto_b_id ELSE contacto_a_id END AS vinculado_id,
  CASE WHEN contacto_a_id = $1 THEN puesto_a ELSE puesto_b END AS puesto
FROM contacto_vinculaciones
WHERE contacto_a_id = $1 OR contacto_b_id = $1;
```

Ventaja: una sola fila, sin duplicación.
Desventaja: queries más complejas.

### Consultas útiles en Supabase

```sql
-- Todos los vinculados de un contacto (con datos)
SELECT v.puesto, v.recibe_documentos,
       c.id, c.nombre, c.apellido, c.tipo, c.correo, c.telefono, c.cargo,
       ep.nombre AS empresa_padre_nombre
FROM contacto_vinculaciones v
JOIN contactos c ON c.id = v.vinculado_id
LEFT JOIN contactos ep ON ep.id = c.empresa_padre_id
WHERE v.contacto_id = $1;

-- Destinatarios de documentos
SELECT c.nombre, c.correo
FROM contacto_vinculaciones v
JOIN contactos c ON c.id = v.vinculado_id
WHERE v.contacto_id = $1
  AND v.recibe_documentos = true
  AND c.correo IS NOT NULL;

-- Reversos (quién me vinculó a mí pero yo no los vinculé)
SELECT c.id, c.nombre, c.tipo
FROM contacto_vinculaciones v
JOIN contactos c ON c.id = v.contacto_id
WHERE v.vinculado_id = $1
  AND NOT EXISTS (
    SELECT 1 FROM contacto_vinculaciones v2
    WHERE v2.contacto_id = $1 AND v2.vinculado_id = v.contacto_id
  );

-- Árbol jerárquico: empresa + sus personas
SELECT c.id, c.nombre, c.tipo, v.puesto
FROM contacto_vinculaciones v
JOIN contactos c ON c.id = v.vinculado_id
WHERE v.contacto_id = $1
  AND c.tipo IN ('persona', 'lead', 'equipo')
ORDER BY c.nombre;
```

---

## 13. Resumen Visual

### Cómo se ve un vínculo en ambos lados:

```
┌──────────────────────────┐         ┌──────────────────────────┐
│   EDIFICIO CENTRO        │         │   MARÍA GARCÍA           │
│   tipo: edificio         │         │   tipo: persona          │
│                          │         │                          │
│   vinculados: [          │         │   vinculados: [          │
│     {                    │         │     {                    │
│       id: "id_maria",    │ ◄─────► │       id: "id_edificio", │
│       nombre: "María",   │         │       nombre: "Edificio",│
│       puesto: "Encargada"│         │       puesto: null,      │  ← puesto diferente en cada lado
│       recibeDoc: true,   │         │       recibeDoc: true,   │  ← flag sincronizado
│       empresaPadre: {    │         │       empresaPadre: null │
│         id: "id_corp",   │         │     }                    │
│         nombre: "Corp SA"│         │   ]                      │
│       }                  │         │                          │
│     }                    │         └──────────────────────────┘
│   ]                      │
│                          │
└──────────────────────────┘
```

### Flujo completo de vincular:

```
Usuario abre Edificio Centro
  → Click "Vincular contacto"
    → Modal de búsqueda
      → Escribe "María"
        → Resultados: María García (persona, Corp SA)
          → Click en María
            → WRITE: Edificio Centro.vinculados[] ← agregar María
            → WRITE: María.vinculados[] ← agregar Edificio Centro (si bidireccional)
            → María tiene parentId=Corp SA?
              → SÍ → WRITE: Edificio Centro.vinculados[] ← agregar Corp SA también
              → NO → nada extra
```

### Flujo de desvincular:

```
Usuario abre Edificio Centro
  → Ve a María en "Directos"
    → Click desvincular
      → WRITE: Edificio Centro.vinculados[] ← quitar entrada de María
      → WRITE: María.vinculados[] ← quitar entrada de Edificio Centro
      → (SIEMPRE ambos lados)
```

---

## 14. Casos Especiales

### Contacto eliminado
Si se elimina definitivamente un contacto, hay que limpiar sus referencias en los `vinculados[]` de todos los contactos que lo tenían vinculado. En SalixCRM esto lo hace `eliminarDefinitivoContacto()`.

En Supabase con `ON DELETE CASCADE` en la FK esto se resuelve automáticamente.

### Empresa padre automática
Cuando vinculo a una persona que trabaja en una empresa:
1. Se vincula la persona
2. Se vincula TAMBIÉN la empresa automáticamente
3. En la entrada de la persona se guarda `empresaPadre: { id, nombre }`

Esto permite en la UI mostrar el árbol:
```
Corp SA (empresa)
  └── María García (Encargada)
```

### Vinculaciones durante la creación del contacto
Al crear un contacto nuevo, se pueden vincular contactos desde el formulario de creación (pestaña Relaciones). Los vínculos se guardan junto con la creación del contacto en una sola operación.

### Contactos provisorios
El agente de IA puede crear contactos provisorios (`esProvisorio: true`) que aún no están aprobados. Estos contactos SÍ pueden tener vinculaciones, que se preservan al aprobarlos.

---

*Generado desde SalixCRM — Marzo 2026*
