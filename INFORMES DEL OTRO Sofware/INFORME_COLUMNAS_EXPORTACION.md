# Informe: Columnas de Exportación/Importación — SalixCRM

> **Propósito**: Responder las preguntas del otro chat sobre los formatos exactos de exportación de contactos y documentos para la migración a Supabase.

---

## Pregunta 1: ¿Qué columnas tiene el Excel/CSV de contactos?

### 45 columnas, nombres exactos tal cual aparecen:

| # | Nombre de columna | Campo interno | Valores posibles |
|---|-------------------|---------------|------------------|
| 1 | Código | `codigo` | C-0001, C-0002... (secuencial, único) |
| 2 | Tipo | `tipo` | empresa, persona, edificio, proveedor, lead, equipo |
| 3 | Nombre | `nombre` | Texto libre |
| 4 | Apellido | `apellido` | Texto libre (vacío en empresas) |
| 5 | Tipo Identificación | `tipoIdentificacion` | cuit, cuil, dni, pasaporte, cedula |
| 6 | Nro Identificación | `numeroIdentificacion` | Texto (ej: 30-12345678-9) |
| 7 | Condición IVA | `condicionIVA` | responsable_inscripto, monotributista, exento, consumidor_final, no_categorizado, no_alcanzado, exterior |
| 8 | Cargo | `cargo` | Texto libre (ej: Gerente Comercial) |
| 9 | Rubro | `rubro` | Texto libre (ej: Construcción) |
| 10 | Sector | `sector` | Texto libre |
| 11 | Correo | `correo` | Email |
| 12 | Teléfono | `telefono` | Texto (ej: +54 11 4567-8900) |
| 13 | WhatsApp | `whatsapp` | Texto (ej: +5491145678900) |
| 14 | Web | `web` | URL |
| 15 | Vinculado a (Código) | primer `vinculados[].id` → código | C-0003 |
| 16 | Vinculado a (Nombre) | primer `vinculados[].nombre` | Texto |
| 17 | Rol Vinculación | primer `vinculados[].puesto` | Texto libre (Encargado, Propietario, etc.) |
| 18 | Etiquetas | `etiquetas[]` | Texto separado por comas (VIP, Zona Norte) |
| 19 | Notas | `notas` | Texto libre multilínea |
| 20 | Origen | `origen` | manual, importacion, usuario, whatsapp |
| 21 | Estado | derivado de `activo` | Activo / Inactivo |
| 22 | Asignado | `responsablesInfo[].nombre` | Nombres separados por comas |
| 23 | Etapa | `etapa` | nuevo, interesado, visita_programada, presupuesto_enviado, cliente_activo, cerrado |
| 24 | Título | `titulo` | Sr., Sra., Dr., Dra., Ing., Lic., Arq., Cr., etc. |
| 25 | ID Externo | `idExterno` | Texto (referencia a sistema anterior) |
| 26 | Idioma | `idioma` | es, en |
| 27 | Zona Horaria | `zonaHoraria` | Texto (ej: America/Argentina/Buenos_Aires) |
| 28 | Moneda | `moneda` | ARS, USD, EUR |
| 29 | Límite Crédito | `limiteCredito` | Numérico |
| 30 | Plazo Pago Cliente | `plazoPagoCliente` | contado, 30_dias, 60_dias, 90_dias, etc. |
| 31 | Plazo Pago Proveedor | `plazoPagoProveedor` | Idem |
| 32 | Posición Fiscal | `posicionFiscal` | Texto libre |
| 33 | Tipo IIBB | `tipoIIBB` | local, convenio_multilateral, exento |
| 34 | Nro. IIBB | `numeroIIBB` | Texto |
| 35 | Rank Cliente | `rankCliente` | Numérico |
| 36 | Rank Proveedor | `rankProveedor` | Numérico |
| 37 | Creado por | `creadoPorNombre` | Nombre del usuario |
| 38 | Fecha Creación | `fechaCreacion` | DD/MM/YYYY HH:mm |
| 39 | Fecha Modificación | `fechaModificacion` | DD/MM/YYYY HH:mm |
| 40+ | Tipo Dirección 1 | `direcciones[0].tipo` | principal, fiscal, entrega, otra |
| 41+ | Dirección 1 | `direcciones[0].texto` | Texto completo concatenado |
| ... | Tipo Dirección N / Dirección N | (dinámico, se repiten según cantidad máxima de direcciones) | |

---

## Pregunta 2: ¿Las vinculaciones están en el mismo archivo o en otro?

**En el mismo archivo**, pero limitadas:
- Solo se exporta **el PRIMER contacto vinculado** por fila, en 3 columnas:
  - `Vinculado a (Código)` — el código del contacto vinculado
  - `Vinculado a (Nombre)` — su nombre
  - `Rol Vinculación` — el puesto/rol contextual (ej: "Encargado", "Propietario")

- **Si un contacto tiene múltiples vinculados**, solo aparece el primero en el Excel.

- **Para obtener TODAS las vinculaciones completas**, hay que usar el **backup JSON** que exporta el array `vinculados[]` íntegro:
```json
"vinculados": [
  {
    "id": "abc123",
    "nombre": "María García",
    "apellido": "García",
    "tipo": "persona",
    "puesto": "Encargada",
    "correo": "maria@empresa.com",
    "telefono": "+54...",
    "cargo": "Gerente",
    "recibeDocumentos": true,
    "empresaPadre": { "id": "xyz789", "nombre": "Corp SA" }
  },
  { ... segundo vinculado ... }
]
```

---

## Pregunta 3: ¿Los tipos de contacto están como columna? ¿Qué valores usa?

**Sí**, columna `Tipo` (columna #2).

**Valores exactos** (español, minúsculas, sin tildes):
| Valor | Significado |
|-------|-------------|
| `empresa` | Compañía/organización |
| `persona` | Individuo/empleado |
| `edificio` | Propiedad/consorcio |
| `proveedor` | Proveedor externo |
| `lead` | Prospecto de venta |
| `equipo` | Miembro interno (sincronizado desde usuarios) |

---

## Pregunta 4: ¿Hay un ID único por contacto?

**Sí, dos niveles**:

| ID | Formato | Dónde se usa |
|----|---------|-------------|
| `codigo` | C-0001, C-0002... | En el Excel, en la UI, para vincular entre exports. **Este es el que aparece en las planillas.** |
| `id` (Firestore) | UUID tipo `a8Kd92xMpQ...` | Interno en base de datos. No aparece en exports de Excel. |

- Para vincular un presupuesto con un contacto en el Excel, se usa el **Código** (C-0001).
- El código es secuencial por empresa y se genera atómicamente (no se repite).

---

## Pregunta 5: ¿Las direcciones van separadas o en un solo campo?

**Columnas dinámicas separadas** por cada dirección:

```
Tipo Dirección 1 | Dirección 1 | Tipo Dirección 2 | Dirección 2 | ...
principal        | Av. Rivadavia 1234, CABA, Buenos Aires, 1406 | fiscal | Mitre 567, Córdoba, Córdoba, 5000
```

- Cada dirección tiene: **tipo** (principal/fiscal/entrega/otra) + **texto completo** (calle, ciudad, provincia, CP concatenados en un solo string).
- La cantidad de columnas de dirección se ajusta al contacto con más direcciones en el lote exportado.
- **No hay columnas individuales** de calle, ciudad, provincia, CP en el Excel. Es un texto concatenado.
- **En la base de datos sí están separados**: calle, barrio, ciudad, provincia, cp, piso, timbre, coordenadas (lat/lng).

---

## Pregunta 6: ¿Qué columnas tiene el Excel de presupuestos/documentos?

### Estructura: 1 fila por línea de item
Si un presupuesto tiene 5 líneas de productos, ocupa 5 filas en el Excel. Los datos del encabezado se repiten en cada fila.

### Columnas del encabezado (45 columnas):

**Datos principales (14 columnas)**:
| # | Nombre de columna | Valores posibles |
|---|-------------------|------------------|
| 1 | Número | P-0001, F-0001, OT-0001, etc. |
| 2 | Tipo Documento | presupuesto, factura, factura_proforma, orden_compra, nota_credito, nota_debito, recibo, remito, informe, orden_trabajo |
| 3 | Letra Comprobante | A, B, C (facturación fiscal Argentina) |
| 4 | Estado | borrador, confirmado, enviado, aceptado, rechazado, cancelado, vencido, archivado |
| 5 | Código Contacto | C-0001 (vincula al contacto) |
| 6 | Cliente | Nombre del contacto |
| 7 | Apellido Cliente | Apellido |
| 8 | CUIT Cliente | CUIT/CUIL |
| 9 | Condición IVA Cliente | responsable_inscripto, monotributista, etc. |
| 10 | Correo Cliente | Email |
| 11 | Teléfono Cliente | Teléfono |
| 12 | WhatsApp Cliente | WhatsApp |
| 13 | Dirección Cliente | Texto completo |
| 14 | Tipo Dirección | principal, fiscal, entrega |

**Facturar a (4 columnas)** — cuando se factura a un contacto diferente al cliente:
| 15 | Código Facturar A |
| 16 | Facturar A Nombre |
| 17 | Facturar A CUIT |
| 18 | Facturar A Cond. IVA |

**Dirigido a (3 columnas)** — destinatario de entrega:
| 19 | Código Dirigido A |
| 20 | Dirigido A Nombre |
| 21 | Dirigido A Dirección |

**Atención (4 columnas)** — persona de contacto/atención:
| 22 | Código Atención |
| 23 | Atención Nombre |
| 24 | Atención Correo |
| 25 | Atención Cargo |

**Fechas y financiero (8 columnas)**:
| 26 | Fecha Emisión | DD/MM/YYYY |
| 27 | Fecha Vencimiento | DD/MM/YYYY |
| 28 | Descuento Global % | Numérico |
| 29 | Moneda | ARS, USD, EUR |
| 30 | Condición de Pago | contado, 30_dias, 60_dias, 90_dias |
| 31 | Tipo Condición Pago | plazo_fijo, hitos |
| 32 | Nota Plan Pago | Texto |
| 33 | Referencia | Texto libre |

**Fiscal (3 columnas)**:
| 34 | CAE | Código autorización electrónica AFIP |
| 35 | CAE Vencimiento | DD/MM/YYYY |
| 36 | Punto de Venta | Numérico (ej: 00001) |

**Contenido (3 columnas)**:
| 37 | Notas | Texto libre |
| 38 | Condiciones | Términos y condiciones |
| 39 | Doc. Origen | Número del documento del que se convirtió (ej: P-0001 → F-0001) |

**Totales (4 columnas)**:
| 40 | Subtotal | Numérico |
| 41 | Impuestos | Numérico |
| 42 | Total Final | Numérico |
| 43 | PDF | URL al PDF generado |

**Sistema (2 columnas)**:
| 44 | Creado por | Nombre del usuario |
| 45 | Fecha Creación | DD/MM/YYYY HH:mm |

### Columnas de líneas de item (9 columnas adicionales por fila):
| Nombre de columna | Valores posibles |
|-------------------|------------------|
| Tipo Línea | producto, nota, seccion |
| Descripción | Nombre del producto/servicio |
| Descripción Detalle | Texto extendido |
| Cantidad | Numérico |
| Precio Unitario | Numérico |
| Descuento Línea | % numérico |
| IVA % | 0, 10.5, 21, 27 |
| Unidad | unidad, hora, metro, kg, litro, m2, m3, etc. |
| Código Producto | Código del catálogo (PR-0001) |

---

## Pregunta 7: ¿Cómo se vincula un presupuesto con su contacto?

**Por Código de Contacto** (columna #5 del Excel de documentos):

```
Número    | Tipo Documento | Código Contacto | Cliente
P-0001    | presupuesto    | C-0003          | Empresa ABC SA
```

- El `Código Contacto` (C-0003) hace match con el `Código` del Excel de contactos.
- También se incluye CUIT y nombre como referencia visual, pero la vinculación formal es por **código**.
- En la base de datos se usa el `id` interno (UUID de Firestore), no el código. Pero en los exports, el código es el nexo.

---

## Pregunta 8: ¿Los items/líneas del presupuesto están en el mismo archivo o en otro?

**En el MISMO archivo.** Estructura:

```
Número  | Cliente     | Total   | Tipo Línea | Descripción       | Cantidad | Precio
P-0001  | Corp SA     | 150000  | producto   | Servicio Técnico  | 10       | 10000
P-0001  | Corp SA     | 150000  | producto   | Materiales        | 5        | 10000
P-0002  | Juan Pérez  | 50000   | producto   | Consultoría       | 20       | 2500
```

- Las columnas del encabezado (Número, Cliente, Total, etc.) se **repiten** en cada fila.
- Si un documento no tiene líneas, aparece 1 fila con las columnas de línea vacías.
- Se agrupan por número de documento.

---

## Pregunta 9: ¿Hay otros documentos además de presupuestos que haya que migrar?

**Sí, 10 tipos de documento**, todos con el mismo formato de exportación:

| Tipo | Prefijo código | Descripción |
|------|---------------|-------------|
| `presupuesto` | P- | Cotización / oferta |
| `factura` | F- | Factura de venta |
| `factura_proforma` | FP- | Factura proforma |
| `orden_compra` | OC- | Orden de compra |
| `nota_credito` | NC- | Nota de crédito |
| `nota_debito` | ND- | Nota de débito |
| `recibo` | R- | Recibo de pago |
| `remito` | RE- | Remito de entrega |
| `informe` | INF- | Informe técnico |
| `orden_trabajo` | OT- | Orden de trabajo (tiene sub-estados especiales) |

### Cadena de conversión entre documentos
Los documentos se pueden convertir entre sí, manteniendo la referencia al documento origen:

```
Presupuesto (P-0001) → Factura (F-0001, con Doc. Origen = P-0001)
                      → Orden de Trabajo (OT-0001, con Doc. Origen = P-0001)
                      → Remito (RE-0001, con Doc. Origen = P-0001)
```

El campo `Doc. Origen` en el Excel indica de qué documento se generó.

---

## Pregunta 10 (bonus): ¿Cómo se relaciona todo entre sí?

### Diagrama de relaciones:

```
                    ┌─────────────┐
                    │  CONTACTO   │
                    │  (C-0001)   │
                    └──────┬──────┘
                           │
          ┌────────────────┼────────────────┐
          │                │                │
    ┌─────▼─────┐   ┌─────▼─────┐   ┌─────▼─────┐
    │ DOCUMENTO  │   │  VISITA   │   │CONVERSACIÓN│
    │ (P-0001)   │   │ (V-0001)  │   │ (WhatsApp) │
    └─────┬──────┘   └─────┬─────┘   └─────┬──────┘
          │                │                │
          └────────────────┼────────────────┘
                           │
                    ┌──────▼──────┐
                    │ ACTIVIDADES │
                    │ (multi-link)│
                    └─────────────┘
```

**Claves de vinculación**:
- Contacto ↔ Contacto: `vinculados[]` (bidireccional, por ID interno)
- Documento → Contacto: `idContacto` / `Código Contacto`
- Visita → Contacto: `contactoId` / `Código Contacto`
- Conversación → Contacto: `idContacto`
- Actividad → Múltiples entidades: `vinculos[]` (puede vincularse a contacto + visita + documento a la vez)
- Documento → Documento: `origenDocumentoId` / `Doc. Origen`

### Para la migración a Supabase:
1. Migrar **contactos** primero (tabla principal)
2. Migrar **vinculaciones entre contactos** (tabla intermedia)
3. Migrar **documentos** vinculando por código de contacto
4. Migrar **visitas** vinculando por código de contacto
5. Migrar **actividades** con sus vínculos múltiples

**Recomendación**: Usar el **backup JSON** (no el Excel) para migración completa — tiene todos los datos sin truncar, incluyendo IDs internos, arrays completos de vinculados, direcciones desglosadas, cuentas bancarias, etc.

---

*Generado desde SalixCRM — Marzo 2026*
