# Informe Completo: Sistema de Contactos — SalixCRM

> **Propósito**: Documento de referencia para replicar/mejorar el sistema de contactos en otro software (Supabase). Cubre: modelo de datos, tipos, vinculaciones, estados de todas las entidades, y relaciones entre módulos. Si algo se puede mejorar, preguntame y proponé cómo hacerlo.

---

## 1. Tipos de Contacto

El CRM maneja **6 tipos** de contacto. Todos conviven en la misma tabla/colección y se diferencian por el campo `tipo`:

| Tipo | Descripción | Icono | Puede tener hijos | Campos especiales |
|------|-------------|-------|-------------------|-------------------|
| `empresa` | Compañía, organización | business | ✅ (personas, leads) | CUIT, condiciónIVA, rubro, web |
| `persona` | Individuo/empleado | person | ❌ | DNI/CUIL, cargo, título, idioma |
| `edificio` | Propiedad, consorcio | apartment | ✅ (personas, empresas) | Dirección obligatoria |
| `proveedor` | Proveedor externo | local_shipping | ✅ | CUIT, rubro, web, términos de pago |
| `lead` | Prospecto de venta | person_add | ❌ | Campos mínimos |
| `equipo` | Miembro del equipo interno | badge | ❌ | Se sincroniza desde perfil de usuario (read-only) |

### Notas para el nuevo sistema:
- **empresa/edificio/proveedor** actúan como "contenedores" — personas y leads se vinculan a ellos.
- **lead** es un contacto liviano para el funnel de ventas. Puede convertirse en persona/empresa.
- **equipo** se auto-genera desde la tabla de usuarios. No se crea manualmente.

---

## 2. Modelo de Datos del Contacto

### Campos de Identidad
| Campo | Tipo | Obligatorio | Notas |
|-------|------|-------------|-------|
| `nombre` | string | ✅ | Nombre o razón social |
| `apellido` | string | ❌ | Solo personas |
| `tipo` | enum | ✅ | empresa, persona, edificio, proveedor, lead, equipo |
| `activo` | boolean | — | Default: true |
| `codigo` | string | Auto | Secuencial: C-0001, C-0002... (generado por transacción atómica) |

### Datos de Contacto
| Campo | Tipo | Notas |
|-------|------|-------|
| `correo` | string | Email principal |
| `telefono` | string | Teléfono fijo/celular |
| `whatsapp` | string | Número WhatsApp (campo separado para mensajería) |
| `cargo` | string | Puesto laboral (personas) |
| `titulo` | string | Tratamiento: Sr., Dra., Ing., etc. |

### Información Comercial
| Campo | Tipo | Notas |
|-------|------|-------|
| `rubro` | string | Industria/actividad (empresas, proveedores) |
| `web` | string | Sitio web |
| `moneda` | string | ARS, USD, EUR |
| `idioma` | string | es, en |
| `zonaHoraria` | string | Timezone |
| `limiteCredito` | number | Límite de crédito |
| `plazoPagoCliente` | string | contado, 30_dias, 60_dias, etc. |
| `plazoPagoProveedor` | string | Idem para proveedores |
| `rankCliente` | number | Ranking como cliente |
| `rankProveedor` | number | Ranking como proveedor |

### Identificación Fiscal (Argentina)
| Campo | Tipo | Notas |
|-------|------|-------|
| `tipoIdentificacion` | enum | cuit, cuil, dni, pasaporte, cedula |
| `numeroIdentificacion` | string | Valor unificado |
| `condicionIVA` | enum | responsable_inscripto, monotributista, exento, consumidor_final, no_categorizado, no_alcanzado, exterior |
| `tipoIIBB` | enum | local, convenio_multilateral, exento |
| `numeroIIBB` | string | Nro Ingresos Brutos |
| `posicionFiscal` | string | Texto libre |

### Cuentas Bancarias (array)
```
cuentasBancarias: [{
  id, banco, cbu, alias, tipo (ca/cc/cvu), moneda, principal (boolean)
}]
```

### Direcciones (array)
```
direcciones: [{
  id, tipo (principal/fiscal/entrega/otra),
  calle, barrio, ciudad, provincia, cp, piso, timbre,
  coordenadas: { lat, lng },
  texto  // dirección completa formateada
}]
```

### Etiquetas
```
etiquetas: ['VIP', 'Zona Norte', ...]  // Tags libres, configurables por empresa
```

### Notas
```
notas: string  // Texto libre
```

### Metadata
| Campo | Tipo | Notas |
|-------|------|-------|
| `origen` | enum | manual, importacion, usuario, whatsapp |
| `creadoPor` / `creadoPorNombre` | string | Quién creó |
| `editadoPor` / `editadoPorNombre` | string | Última edición |
| `fechaCreacion` | timestamp | Server timestamp |
| `fechaModificacion` | timestamp | Server timestamp |
| `enPapelera` | boolean | Soft delete |
| `papeleraEn` | timestamp | Cuándo se borró |
| `esProvisorio` | boolean | Creado por IA, pendiente de aprobación |

### Búsqueda
```
_busqueda: ['mar', 'mari', 'maria', 'gon', 'gonz', ...]
// Tokens generados automáticamente de: nombre, apellido, correo, teléfono,
// whatsapp, cuit, dni, código, cargo, rubro, web, dirección
```

---

## 3. Sistema de Vinculaciones (Relaciones entre Contactos)

### Concepto
Cualquier contacto puede vincularse a cualquier otro. La vinculación es **bidireccional por defecto** — al vincular A→B, también se escribe B→A.

### Estructura del vínculo
Cada contacto tiene un array `vinculados[]`:

```javascript
vinculados: [
  {
    id: "abc123",              // ID del contacto vinculado
    nombre: "María García",    // Cache del nombre
    apellido: "García",        // Cache del apellido
    tipo: "persona",           // Tipo del contacto vinculado
    puesto: "Encargada",       // Rol CONTEXTUAL respecto a ESTE contacto
    correo: "maria@...",       // Cache
    telefono: "+54...",        // Cache
    cargo: "Gerente",          // Cache del cargo laboral
    recibeDocumentos: true,    // ¿Incluir al enviar documentos?
    empresaPadre: {            // Si la persona pertenece a una empresa
      id: "xyz789",
      nombre: "Corp SA"
    }
  }
]
```

### Operaciones de vinculación
| Operación | Comportamiento |
|-----------|---------------|
| **Vincular** | Escribe en vinculados[] de AMBOS contactos. Si el vinculado tiene empresa padre, la incluye automáticamente. |
| **Desvincular** | Elimina de vinculados[] de AMBOS contactos. |
| **Cambiar puesto** | Actualiza el rol contextual de UN lado. El puesto es relativo a cada contacto. |
| **Toggle recibeDocumentos** | Marca/desmarca si recibe copias de documentos. Se actualiza en ambos lados. |

### Campo legacy: `parentId`
Antes existía `parentId` para relaciones padre-hijo (persona→empresa). Ahora se usa `vinculados[]` pero el sistema mantiene compatibilidad leyendo ambos.

### Puestos de vinculación predefinidos (configurables)
Consejo, Encargado, Propietario, Administrador, Técnico, Inquilino, Empleado, Gerente, Director, Mantenimiento, Socio, Otro.

### Relaciones inversas (reversos)
El sistema detecta automáticamente contactos que te vincularon a vos pero vos no vinculaste a ellos. Se muestran como "Externos" en la UI.

### Vista Unificada (Pool)
La pestaña de relaciones combina 4 fuentes:
1. **Directos** — vinculados[] del contacto actual
2. **Subcontactos legacy** — contactos con parentId apuntando a este
3. **Empresa padre** — si este contacto tiene parentId
4. **Reversos** — contactos que tienen a ESTE contacto en sus vinculados[]

### Pregunta para mejorar:
> En Supabase podrías modelar las vinculaciones como una **tabla intermedia** (ej: `contacto_vinculaciones`) con foreign keys en ambos sentidos, en lugar de arrays embebidos. Esto permitiría queries más eficientes para relaciones complejas, sin duplicar datos en ambos documentos.

---

## 4. Asignación y Seguimiento

### Responsables
```
responsableIds: ['uid1', 'uid2']        // IDs de usuarios asignados
responsablesInfo: [{ uid, nombre, foto }]  // Datos denormalizados
```
- Al crear un contacto, el creador se auto-asigna como responsable.
- Los responsables filtran su vista para ver solo "sus" contactos.

### Seguidores
```
seguidores: ['uid1', 'uid2']
seguidoresInfo: [{
  uid, nombre, foto, agregadoEn,
  modoCopia: 'CC' | 'CCO' | null,  // null = solo notificaciones internas
  correo, tipoSeguidor, empresa, sector, cargo
}]
```
- Los seguidores reciben notificaciones de cambios.
- `modoCopia` controla si se los incluye en CC/CCO de correos.

---

## 5. Detección de Duplicados

Al crear un contacto, el sistema busca duplicados por:
- CUIT
- DNI
- Email
- Número de identificación

El usuario puede ignorar la advertencia y crear igual (checkbox "ignorar duplicados").

También existe: `buscarContactoPorTelefono()` — match exacto por teléfono/WhatsApp (usado por el agente IA para vincular mensajes entrantes).

---

## 6. Contactos Provisorios

El agente de IA puede crear contactos con `esProvisorio: true` cuando detecta un contacto nuevo en un mensaje entrante. Estos contactos:
- No tienen código asignado
- Aparecen marcados como pendientes de aprobación
- Al aprobar: se les genera código, se registra en chatter, se actualiza timestamp

---

## 7. Conexiones con Otras Entidades

### 7.1 Documentos → Contacto
| Campo en Documento | Descripción |
|--------------------|-------------|
| `idContacto` | FK al contacto |
| `contactoNombre`, `contactoApellido` | Cache denormalizado |
| `contactoEmpresa`, `contactoCargo` | Cache denormalizado |
| `contactoCorreo`, `contactoTelefono`, `contactoWhatsapp` | Cache denormalizado |
| `direccion` | Dirección copiada del contacto al crear |

**Relación documento→documento**: `origenDocumentoId` permite encadenar documentos (ej: presupuesto → factura → recibo).

**Destinatarios**: Al enviar un documento, se obtienen los vinculados con `recibeDocumentos: true` del contacto.

### 7.2 Visitas → Contacto
| Campo en Visita | Descripción |
|-----------------|-------------|
| `contactoId` | FK al contacto |
| `nombreContacto` | Cache denormalizado |
| `direccion` | Dirección copiada |
| `tecnicoId`, `tecnicoNombre` | Técnico asignado |

### 7.3 Actividades → Contacto (Multi-entidad)
Las actividades usan un sistema de **vínculos múltiples**:

```javascript
vinculos: [
  { tipo: 'contacto', id: 'abc', nombre: 'María García' },
  { tipo: 'visita', id: 'xyz', nombre: 'Visita #V-0012' },
  { tipo: 'documento', id: 'def', nombre: 'Presupuesto #P-0005' }
]
vinculoIds: ['contacto:abc', 'visita:xyz', 'documento:def']  // Para búsquedas
```
Una actividad puede estar vinculada a múltiples entidades simultáneamente.

### 7.4 Conversaciones/Mensajes → Contacto
| Campo en Conversación | Descripción |
|----------------------|-------------|
| `idContacto` | FK al contacto |
| `contactoNombre`, `contactoEmpresa`, `contactoCargo` | Cache denormalizado |
| `tipo` | whatsapp, correo, interno |
| `documentoVinculado` | Documento asociado (para pipeline) |

Cuando se actualiza el nombre/empresa/cargo de un contacto, se sincronizan **todas** sus conversaciones por batch.

### 7.5 Pipeline → Contacto
El pipeline funciona a nivel de **conversación**, no de contacto directamente. Cada conversación tiene:
```
etapa: 'nuevo' | 'interesado' | 'visita_programada' | 'presupuesto_enviado' | 'cliente_activo' | 'cerrado'
```
Las etapas son configurables por empresa.

---

## 8. Sistema de Chatter (Timeline/Historial)

Cada entidad tiene su propio chatter (timeline). Path: `empresas/{id}/{coleccion}/{idEntidad}/chatter`.

### Tipos de entrada
- `nota` — Nota del usuario
- `sistema` — Entrada automática del sistema
- `borrador` — Borrador de correo
- `correo` / `whatsapp` — Mensajes enviados

### Acciones del sistema registradas
| Acción | Cuándo se registra |
|--------|--------------------|
| `creacion` | Se crea la entidad |
| `edicion` | Se editan campos |
| `cambio_estado` | Cambia estado (visita, documento) |
| `vinculacion` | Se vincula un documento a otro |
| `documento_creado` | Se crea documento para este contacto |
| `visita_creada` | Se crea visita para este contacto |
| `actividad_creada` | Se crea actividad vinculada |
| `actividad_completada` | Se completa actividad vinculada |
| `aprobacion` | Se aprueba contacto provisorio |

### Cross-posting
Cuando se crea una visita/documento/actividad para un contacto, se registra la entrada en **ambos** chatters: el de la entidad creada Y el del contacto.

---

## 9. Patrón de Denormalización

**Importante para Supabase**: En Firestore (NoSQL) se denormalizan datos para evitar joins. Ejemplo: cada documento guarda `contactoNombre`, `contactoEmpresa`, etc.

En Supabase (PostgreSQL) **NO necesitás esto**. Podés usar:
- Foreign keys reales (`contacto_id REFERENCES contactos(id)`)
- JOINs en las queries
- Views materializadas si necesitás performance

**Campos que en Supabase serían FKs en vez de datos copiados:**
- `idContacto` → FK a tabla contactos
- `tecnicoId` → FK a tabla usuarios
- `creadoPor` → FK a tabla usuarios
- `responsableIds` → tabla intermedia contacto_responsables
- `seguidores` → tabla intermedia contacto_seguidores
- `vinculados` → tabla intermedia contacto_vinculaciones
- `etiquetas` → tabla intermedia contacto_etiquetas (o array nativo de PostgreSQL)

---

## 10. Estados de TODAS las Entidades

### 10.1 Contactos
No tienen "estado" como tal. Se filtran por:
- `activo`: true/false
- `enPapelera`: true/false (soft delete, recuperable 15 días)
- `esProvisorio`: true/false (pendiente de aprobación)
- `tipo`: empresa, persona, edificio, proveedor, lead, equipo

### 10.2 Actividades
| Estado | Color | Descripción |
|--------|-------|-------------|
| `pendiente` | Azul | Por hacer |
| `completada` | Verde | Finalizada |
| `vencida` | Rojo | Pasó la fecha límite sin completar |
| `cancelada` | Gris | Descartada |

**Prioridades**: baja (gris), normal (ámbar), alta (rojo)

**Tipos** (configurables por empresa): llamada, reunion, tarea, nota, correo, visita

### 10.3 Visitas
| Estado | Color | Transiciones permitidas |
|--------|-------|------------------------|
| `programada` | Azul | → en_camino, cancelada |
| `en_camino` | Ámbar | → en_sitio, cancelada, programada |
| `en_sitio` | Naranja | → completada, cancelada, programada |
| `completada` | Verde | (terminal) |
| `cancelada` | Rojo | → programada |

**Motivos** (configurables): instalacion, mantenimiento, reparacion, inspeccion, relevamiento, capacitacion, retiro_equipo, entrega, otro

**Resultados** (configurables): exitosa, parcial, no_recibieron, no_estaba, no_pude_ir, reprogramada, cancelada_cliente

### 10.4 Documentos
| Estado | Color | Transiciones permitidas |
|--------|-------|------------------------|
| `borrador` | Gris | → confirmado, cancelado |
| `confirmado` | Azul | → enviado, borrador, cancelado |
| `enviado` | Violeta | → aceptado, rechazado, cancelado, vencido |
| `aceptado` | Verde | → borrador, cancelado |
| `rechazado` | Rojo | → borrador, cancelado |
| `cancelado` | Gris | → borrador |
| `vencido` | Ámbar | → borrador, cancelado |
| `archivado` | Gris | (terminal) |

**Tipos de documento**: presupuesto, orden_trabajo, factura, factura_proforma, orden_compra, nota_credito, nota_debito, recibo, remito, informe

### 10.5 Órdenes de Trabajo (sub-estados del documento)
| Estado | Color | Transiciones |
|--------|-------|-------------|
| `borrador_ot` | Gris | → programada, en_ejecucion, cancelado |
| `programada` | Azul | → en_ejecucion, borrador_ot, cancelado |
| `en_ejecucion` | Ámbar | → completada_ot, programada, cancelado |
| `completada_ot` | Verde | → archivado, en_ejecucion |

**Etapas de ejecución de OT**: relevamiento, compra_materiales, fabricacion, entrega, instalacion, prueba, capacitacion (cada una con estado: pendiente/en_proceso/completada)

### 10.6 Conversaciones (Pipeline)
Etapas configurables por empresa. Default:
1. `nuevo` (Gris)
2. `interesado` (Ámbar)
3. `visita_programada` (Azul)
4. `presupuesto_enviado` (Violeta)
5. `cliente_activo` (Verde)
6. `cerrado` (Rojo)

**Tipos de conversación**: whatsapp, correo, interno

### 10.7 Eventos de Calendario
| Estado | Color |
|--------|-------|
| `confirmado` | Verde |
| `tentativo` | Ámbar |
| `cancelado` | Gris |

### 10.8 Asistencias (Fichajes)
| Estado | Color | Descripción |
|--------|-------|-------------|
| `activo` | Verde | En turno |
| `almuerzo` | Ámbar | En almuerzo |
| `particular` | Celeste | Salida personal |
| `cerrado` | Gris | Jornada cerrada |
| `auto_cerrado` | Naranja | No fichó salida |

**Tipos de jornada**: normal, tardanza, ausencia

**Método de fichaje**: manual, rfid, nfc, pin, solicitud, automatico, importacion

### 10.9 Productos
**Tipos**: producto, servicio

### 10.10 Usuarios (Roles)
- `propietario` — Control total
- `administrador` — Gestión completa
- `colaborador` — Acceso limitado

---

## 11. Flujo de Creación de Contacto (paso a paso)

1. **Selección de tipo**: El usuario elige empresa/persona/edificio/proveedor/lead
2. **Formulario**: Se muestra formulario con campos según tipo
3. **Verificación ARCA** (opcional): Si ingresa CUIT, se valida contra AFIP y auto-completa razón social
4. **Detección de duplicados**: Se busca por CUIT, DNI, email, número de identificación
5. **Vinculaciones** (pestaña): Se pueden vincular contactos existentes en el momento de creación
6. **Notas** (pestaña): Texto libre
7. **Guardar**:
   - Se genera código secuencial (C-0001) por transacción atómica
   - Se genera array `_busqueda` con tokens
   - Se asigna al creador como responsable y seguidor
   - Se registra entrada de sistema en chatter
   - Se ejecutan vinculaciones bidireccionales si se agregaron

---

## 12. Flujo de Edición de Contacto

1. **Vista detalle** con pestañas: General, Relaciones, Documentos, Visitas, Actividades, Mensajes, Notas
2. **Edición inline**: Los campos se editan directamente en la vista detalle
3. **Al guardar**:
   - Se actualiza `fechaModificacion`, `editadoPor`
   - Se regeneran tokens de búsqueda
   - Se sincronizan datos denormalizados en conversaciones (nombre, empresa, cargo)
   - Se registra en chatter qué campos cambiaron

---

## 13. Soft Delete (Papelera)

- `moverAPapeleraContacto()` → marca `enPapelera: true`, `papeleraEn: timestamp`
- Recuperable por 15 días
- `restaurarContacto()` → vuelve a activo
- `eliminarDefinitivoContacto()` → borra de BD. Antes desvincula de todas las conversaciones.

---

## 14. Multi-Tenancy

**Path en Firestore**: `empresas/{idEmpresa}/contactos/{contactoId}`

Cada empresa tiene su espacio aislado. Todas las queries incluyen `idEmpresa` como primer segmento del path. Las Firestore Rules garantizan que un usuario solo acceda a datos de su empresa.

**En Supabase**: Esto se modelaría con una columna `empresa_id` en cada tabla + Row Level Security (RLS).

---

## 15. Búsqueda y Filtrado

### Búsqueda por texto
- Se generan tokens de los primeros caracteres de cada palabra de cada campo indexado
- Se almacenan en `_busqueda[]` (array)
- Query: `array-contains` con el token del término buscado
- Para múltiples palabras: filtro adicional client-side

### Filtros disponibles
- Por tipo (empresa, persona, etc.) con contadores por tipo
- Por responsable asignado
- Por estado (activo/inactivo)
- Por origen (manual, importación, etc.)
- Por etiquetas

### En Supabase
Podés usar `ILIKE`, `tsvector`/`tsquery` (full-text search nativo de PostgreSQL), o `pg_trgm` para búsqueda fuzzy. No necesitás el hack de tokens.

---

## 16. Resumen de Tablas Sugeridas para Supabase

```sql
-- Tabla principal
contactos (id, empresa_id, tipo, nombre, apellido, correo, telefono, whatsapp,
           cargo, titulo, rubro, web, codigo, activo, en_papelera, es_provisorio,
           condicion_iva, tipo_identificacion, numero_identificacion,
           moneda, idioma, zona_horaria, limite_credito,
           plazo_pago_cliente, plazo_pago_proveedor,
           tipo_iibb, numero_iibb, posicion_fiscal,
           rank_cliente, rank_proveedor,
           origen, notas,
           creado_por, editado_por, created_at, updated_at)

-- Vinculaciones (reemplaza el array vinculados[])
contacto_vinculaciones (id, empresa_id, contacto_id, vinculado_id,
                        puesto, recibe_documentos, created_at)
-- UNIQUE(contacto_id, vinculado_id) para evitar duplicados
-- Al crear: insertar AMBAS direcciones (A→B y B→A)

-- Direcciones
contacto_direcciones (id, contacto_id, tipo, calle, barrio, ciudad,
                      provincia, cp, piso, timbre, lat, lng, texto)

-- Cuentas bancarias
contacto_cuentas_bancarias (id, contacto_id, banco, cbu, alias,
                            tipo, moneda, principal)

-- Etiquetas
contacto_etiquetas (contacto_id, etiqueta)
-- O usar array nativo: etiquetas TEXT[] en la tabla contactos

-- Responsables asignados
contacto_responsables (contacto_id, usuario_id)

-- Seguidores
contacto_seguidores (contacto_id, usuario_id, modo_copia, tipo_seguidor)

-- Documentos → Contacto
documentos (id, empresa_id, contacto_id REFERENCES contactos(id),
            tipo, estado, numero, ...)

-- Visitas → Contacto
visitas (id, empresa_id, contacto_id REFERENCES contactos(id),
         estado, motivo, resultado, tecnico_id, ...)

-- Actividades → Multi-entidad
actividades (id, empresa_id, tipo, estado, prioridad, ...)
actividad_vinculos (actividad_id, tipo_entidad, entidad_id)

-- Conversaciones → Contacto
conversaciones (id, empresa_id, contacto_id REFERENCES contactos(id),
                tipo, etapa, ...)

-- Chatter genérico
chatter_entries (id, empresa_id, entidad_tipo, entidad_id,
                 autor_id, tipo_entrada, accion, contenido, metadata, created_at)
```

---

## 17. Cosas que Podrían Mejorarse

1. **Vinculaciones como tabla intermedia** en vez de arrays embebidos — queries más potentes, sin duplicación de datos cached.
2. **Full-text search nativo** de PostgreSQL en vez del hack de tokens de búsqueda.
3. **Foreign keys reales** en vez de datos denormalizados (contactoNombre en documentos) — JOINs son baratos en SQL.
4. **Historial de cambios** con tabla de auditoría genérica en vez de chatter entries mezcladas con notas manuales.
5. **Pipeline como entidad propia** (deals/oportunidades) separada de conversaciones — más flexible para múltiples deals por contacto.
6. **Tipos de contacto extensibles** — en vez de enum hardcodeado, una tabla `tipos_contacto` configurable por empresa.
7. **Relaciones tipadas** — la tabla de vinculaciones podría tener un campo `tipo_relacion` (empleado_de, proveedor_de, administra, etc.) en vez de solo `puesto` como texto libre.

---

*Generado desde SalixCRM — Marzo 2026*
