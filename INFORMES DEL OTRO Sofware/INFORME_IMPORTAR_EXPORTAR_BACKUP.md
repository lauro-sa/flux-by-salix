# Informe: Importación, Exportación y Copia de Seguridad — Flux by Salix

> **Propósito**: Documento de referencia para entender cómo funciona la importación/exportación de contactos (Excel/CSV), la copia de seguridad local (JSON) y la sincronización automática con Google Drive en el software anterior (SalixCRM v1, basado en Firestore/Cloud Functions). Este informe sirve como base para replicar y mejorar estas funcionalidades en Flux v2 (Supabase/PostgreSQL).

---

## 1. Exportación de Contactos a Excel

### Cómo se activa
Desde la página de Contactos → menú de acciones → **"Exportar Excel"**.

### Qué genera
Un archivo `.xlsx` con nombre: `Contactos - {NombreEmpresa} - {YYYY-MM-DD} {HHMM}.xlsx`

### Estructura del archivo

**Fila 1**: Título fusionado con nombre del módulo + empresa + fecha/hora. Fondo con el color primario de la empresa.

**Fila 2**: Encabezados en negrita, texto blanco sobre color de empresa, borde inferior.

**Filas 3+**: Datos con colores alternados (slate-100 / blanco).

**Características del Excel:**
- Ancho de columnas auto-calculado (10-60 caracteres)
- Auto-filtro aplicado en la fila de encabezados
- Filas 1-2 congeladas (frozen) al hacer scroll
- Sección de referencia al final con valores válidos para campos de selección
- Librería usada: ExcelJS + file-saver

### Las ~45 columnas exportadas
(En el orden exacto que aparecen)

| Columna | Campo | Notas |
|---------|-------|-------|
| Código | `codigo` | C-0001 (ID visible único) |
| Tipo | `tipo` | empresa, persona, edificio, proveedor, lead, equipo |
| Nombre | `nombre` | |
| Apellido | `apellido` | |
| Tipo Identificación | `tipoIdentificacion` | cuit, cuil, dni, pasaporte, cedula |
| Nro Identificación | `numeroIdentificacion` | |
| Condición IVA | `condicionIVA` | |
| Cargo | `cargo` | |
| Rubro | `rubro` | |
| Sector | `sector` | |
| Correo | `correo` | |
| Teléfono | `telefono` | |
| WhatsApp | `whatsapp` | |
| Web | `web` | |
| Vinculado a (Código) | primer vinculado | Solo el PRIMER vinculado |
| Vinculado a (Nombre) | primer vinculado | |
| Rol Vinculación | primer vinculado puesto | |
| Etiquetas | `etiquetas[]` | Separadas por comas |
| Notas | `notas` | |
| Origen | `origen` | manual, importacion, usuario, whatsapp |
| Estado | derivado de `activo` | Activo / Inactivo |
| Asignado | `responsablesInfo[]` | Nombres separados por comas |
| Etapa | `etapa` | Etapa del pipeline |
| Título | `titulo` | Sr., Dra., Ing. |
| ID Externo | `idExterno` | |
| Idioma | `idioma` | |
| Zona Horaria | `zonaHoraria` | |
| Moneda | `moneda` | |
| Límite Crédito | `limiteCredito` | |
| Plazo Pago Cliente | `plazoPagoCliente` | |
| Plazo Pago Proveedor | `plazoPagoProveedor` | |
| Posición Fiscal | `posicionFiscal` | |
| Tipo IIBB | `tipoIIBB` | |
| Nro. IIBB | `numeroIIBB` | |
| Rank Cliente | `rankCliente` | |
| Rank Proveedor | `rankProveedor` | |
| Creado por | `creadoPorNombre` | |
| Fecha Creación | `fechaCreacion` | DD/MM/YYYY HH:mm |
| Fecha Modificación | `fechaModificacion` | DD/MM/YYYY HH:mm |
| Tipo Dirección 1...N | `direcciones[n].tipo` | Dinámicas según cantidad |
| Dirección 1...N | `direcciones[n].texto` | Texto completo concatenado |

### Limitaciones del Excel
- Solo exporta el **primer vinculado** por contacto (no todos)
- Direcciones como texto concatenado (no desglosadas en calle/ciudad/provincia)
- No incluye cuentas bancarias
- No incluye historial del chatter

---

## 2. Importación de Contactos desde Excel/CSV

### Cómo se activa
Desde la página de Contactos → menú de acciones → **"Importar"** → se abre modal.

### Formatos soportados
`.xlsx`, `.xls`, `.csv`

### Flujo paso a paso (5 pasos)

#### Paso 1 — Subir archivo
- Drag & drop o selector de archivo
- Parsea el archivo con la librería correspondiente
- Detecta las columnas del archivo

#### Paso 2 — Mapeo de columnas
El sistema intenta **auto-mapear** cada columna del archivo a un campo de Flux.

**Estrategia de auto-mapeo (3 niveles):**
1. **Match exacto** — el nombre de la columna coincide exactamente con el campo o un alias
2. **Empieza con** — el nombre de la columna empieza con el nombre del campo
3. **Contiene** — el nombre de la columna contiene el nombre del campo

**226+ alias definidos**, incluyendo variantes en español, inglés, y formato Odoo. Ejemplos:

| Columna en el archivo | Se mapea a |
|----------------------|------------|
| email, mail, correo electrónico, e-mail | `correo` |
| phone, tel, teléfono, fono | `telefono` |
| mobile, celular, cel, whatsapp, wa | `whatsapp` |
| tax_id, vat, cuit, rut, ruc, nit | `cuit` |
| company, empresa, company_name, parent_id | `empresaPadreCodigo` |
| name, nombre, razón social | `nombre` |
| payment_terms, plazo pago, customer payment terms | `plazoPagoCliente` |
| street, calle, dirección, address | `calle` o `direccion` |
| city, ciudad, localidad | `ciudad` |
| state, provincia, departamento | `provincia` |
| zip, cp, código postal, postal code | `cp` |
| country, pais, país | `pais` |
| tags, etiquetas, labels, categorías | `etiquetas` |
| notes, notas, comentarios, description | `notas` |

**Normalización de nombres**: se quitan tildes, se pasa a minúsculas, se reemplazan separadores (_, -, /) por espacios.

El usuario puede corregir manualmente cualquier mapeo antes de continuar.

#### Paso 3 — Vista previa y validación
- Muestra tabla con los datos parseados
- Marca errores por fila (campos inválidos, tipos incorrectos)
- El usuario puede revisar antes de importar
- Campos obligatorios: solo `nombre`
- Si falta `tipo`, se asigna `persona` por defecto

#### Paso 4 — Importación
- Importa en paralelo: **10 filas simultáneas**
- Barra de progreso con porcentaje y contador
- Por cada fila:
  - Si el `codigo` ya existe → **actualiza** el contacto existente
  - Si es nuevo → **crea** contacto nuevo con código auto-generado

**Procesamiento especial por campo:**
| Campo | Procesamiento |
|-------|---------------|
| `tipo` | Normaliza a minúsculas, mapea variantes (company→empresa, individual→persona) |
| `correo` | Si hay múltiples emails separados por `;` o `,`, toma el primero y pone el resto en notas |
| `direccion` | Si es texto completo, lo guarda como dirección principal. Si hay calle/ciudad/provincia por separado, los combina |
| `etiquetas` | Split por comas, trim de espacios |
| `fechaCreacion` | Parsea: objetos Date de Excel, YYYY-MM-DD, DD/MM/YYYY, ISO 8601, números seriales de Excel |
| `condicionIVA` | Normaliza variantes: "Resp. Inscripto" → responsable_inscripto |
| `vinculados` | Si es JSON string, lo parsea y vincula post-importación |
| `empresaPadreCodigo` | Busca contacto por código y vincula como empresa padre |
| `limiteCredito` | Convierte a número, acepta formatos con separadores de miles |
| `rankCliente/Proveedor` | Convierte a número |

#### Paso 5 — Resultado
- Resumen: X creados, Y actualizados, Z errores
- Lista de errores si los hubo
- Botón para cerrar

### Plantilla descargable
Desde el modal hay un botón **"Descargar plantilla"** que genera un Excel con:
- Los encabezados correctos
- 5 filas de ejemplo (una de cada tipo: empresa, persona, proveedor, lead, edificio)
- Sección de referencia con valores válidos para cada campo de selección

---

## 3. Copia de Seguridad Local (JSON)

### Concepto
Backup completo de los datos en formato JSON, descargable como archivo local. Incluye TODOS los datos sin truncar (a diferencia del Excel).

### Módulos con backup JSON disponible
| Módulo | Servicio | Incluye |
|--------|----------|---------|
| Contactos | `copiaSeguridadContactos.js` | Todos los campos + notas del chatter |
| Conversaciones | `copiaSeguridadInbox.js` | Conversaciones + todos los mensajes |
| Documentos | `copiaSeguridadDocumentos.js` | Encabezado + líneas + chatter |
| Actividades | `copiaSeguridadActividades.js` | Todos los campos |
| Visitas | `copiaSeguridadVisitas.js` | Todos los campos + chatter |
| Productos | `copiaSeguridadProductos.js` | Todos los campos |
| Usuarios | `copiaSeguridadUsuarios.js` | Perfiles + configuración |
| Asistencias | `copiaSeguridadAsistencias.js` | Registros de fichaje |

### Estructura del archivo JSON

```json
{
  "version": 1,
  "tipo": "contactos",
  "exportadoEn": "2026-03-26T15:30:00.000Z",
  "totalContactos": 487,
  "contactos": [
    {
      "id": "firestore_uuid",
      "codigo": "C-0001",
      "tipo": "empresa",
      "nombre": "Corp SA",
      "apellido": null,
      "correo": "info@corpsa.com",
      "telefono": "+54 11 4444-5555",
      "whatsapp": "+5491144445555",
      "vinculados": [
        {
          "id": "otro_uuid",
          "nombre": "María",
          "apellido": "García",
          "tipo": "persona",
          "puesto": "Encargada",
          "recibeDocumentos": true,
          "empresaPadre": { "id": "...", "nombre": "..." }
        }
      ],
      "direcciones": [
        {
          "id": "dir_uuid",
          "tipo": "principal",
          "calle": "Av. Rivadavia 1234",
          "ciudad": "CABA",
          "provincia": "Buenos Aires",
          "cp": "1406",
          "coordenadas": { "lat": -34.61, "lng": -58.38 }
        }
      ],
      "cuentasBancarias": [
        {
          "id": "cta_uuid",
          "banco": "Banco Nación",
          "cbu": "0110000000000000000001",
          "alias": "CORP.SA.NACION",
          "tipo": "cc",
          "moneda": "ARS",
          "principal": true
        }
      ],
      "etiquetas": ["VIP", "Zona Norte"],
      "responsableIds": ["uid1"],
      "seguidores": ["uid1", "uid2"],
      "fechaCreacion": "2025-06-15T10:30:00.000Z",
      "fechaModificacion": "2026-03-20T14:22:00.000Z",
      "notas": [
        {
          "id": "nota_uuid",
          "contenido": "Llamar el lunes para confirmar reunión",
          "autorId": "uid1",
          "autorNombre": "Admin",
          "fechaCreacion": "2026-03-18T09:00:00.000Z"
        }
      ]
    }
  ]
}
```

### Diferencia con el Excel

| Aspecto | Excel | JSON Backup |
|---------|-------|-------------|
| Vinculados | Solo el primero | Array completo |
| Direcciones | Texto concatenado | Desglosadas (calle, ciudad, provincia, CP, coordenadas) |
| Cuentas bancarias | No incluye | Incluye todas |
| Notas del chatter | No incluye | Incluye todas |
| IDs internos | No incluye | Incluye (Firestore UUIDs) |
| Timestamps | Formateados DD/MM/YYYY | ISO 8601 preciso |
| Seguidores/Responsables | Solo nombres | IDs + datos completos |
| Restaurable | No directamente | Sí, importación directa |

### Proceso de exportación JSON

```
1. Lee TODOS los contactos de la empresa (query sin filtros)
2. Para cada contacto:
   a. Serializa Timestamps → ISO strings
   b. Lee subcolección de notas (chatter)
   c. Agrega notas al objeto
3. Empaqueta en estructura { version, tipo, exportadoEn, totalContactos, contactos }
4. Genera archivo y dispara descarga en el navegador
5. Registra la exportación en el historial (max 3 entradas)
```

**Callback de progreso**: `onProgreso(porcentaje)` se llama durante el proceso para actualizar la barra de progreso en la UI.

### Proceso de importación JSON

```
1. Usuario sube archivo .json
2. Validación: { version === 1, tipo === 'contactos', contactos es array }
3. Para cada contacto:
   a. Deserializa ISO strings → Firestore Timestamps
   b. Crea o actualiza el contacto
   c. Si tiene notas: crea entradas en subcolección chatter
4. Batch writes en chunks de 500
5. Muestra resumen
```

### Campos timestamp conocidos (se deserializan automáticamente)
`fechaCreacion`, `fechaModificacion`, `creadoEn`, `editadoEn`, `papeleraEn`

---

## 4. Copia de Seguridad por Inbox (Conversaciones)

### Exportación
Se exporta por **canal**:
- WhatsApp
- Correo
- Mensajes internos
- Todos

Cada backup incluye las conversaciones Y todos sus mensajes.

```json
{
  "version": 1,
  "tipo": "conversaciones_whatsapp",
  "exportadoEn": "2026-03-26T...",
  "totalConversaciones": 120,
  "totalMensajes": 4580,
  "conversaciones": [
    {
      "id": "conv_uuid",
      "tipo": "whatsapp",
      "contactoNombre": "María García",
      "idContacto": "contacto_uuid",
      "etapa": "cliente_activo",
      "mensajes": [
        {
          "id": "msg_uuid",
          "contenido": "Hola, necesito un presupuesto",
          "autorId": "uid_externo",
          "autorNombre": "María",
          "tipo": "texto",
          "fechaCreacion": "2026-03-25T10:00:00.000Z"
        }
      ]
    }
  ]
}
```

### Importación
- Batch de **500 mensajes** por operación para no exceder límites de Firestore
- Progreso trackeado por conversación

---

## 5. Sincronización Automática con Google Drive

### Concepto
El sistema puede conectarse a la cuenta de Google Drive del administrador y mantener **spreadsheets actualizados automáticamente** con los datos de la empresa. No es un backup binario — son hojas de cálculo legibles y editables.

### Flujo de conexión

```
1. Admin hace clic en "Conectar Google Drive"
2. Se abre popup de OAuth de Google
   - Permisos solicitados:
     • drive.file (crear/editar archivos en Drive)
     • spreadsheets (leer/escribir hojas de cálculo)
     • userinfo.email (identificar la cuenta)
   - access_type: 'offline' (para refresh tokens)
   - prompt: 'consent' (siempre pide permiso explícito)
3. Usuario autoriza
4. Google devuelve un authorization code
5. El frontend envía el code al backend (Cloud Function)
6. El backend:
   a. Intercambia el code por access_token + refresh_token
   b. Crea una carpeta "Flux - {NombreEmpresa}" en Drive
   c. Crea spreadsheets vacíos para cada módulo activo
   d. Guarda la configuración en Firestore:
      empresas/{id}/configuracion/googleDrive
   e. Ejecuta la primera sincronización
7. UI muestra "Conectado como: email@gmail.com"
```

### Configuración almacenada

```
empresas/{idEmpresa}/configuracion/googleDrive:
{
  conectado: true,
  email: "admin@gmail.com",
  refreshToken: "encrypted_token...",
  frecuenciaHoras: 24,
  modulosActivos: ["contactos", "presupuestos", "facturas", "actividades"],
  folderId: "google_drive_folder_id",
  hojas: {
    contactos: {
      spreadsheetId: "abc123...",
      spreadsheetUrl: "https://docs.google.com/spreadsheets/d/abc123...",
      nombreHoja: "Contactos"
    },
    presupuestos: {
      spreadsheetId: "def456...",
      spreadsheetUrl: "https://docs.google.com/spreadsheets/d/def456...",
      nombreHoja: "Presupuestos"
    }
  },
  ultimaSync: Timestamp,
  ultimoError: null,
  resumen: {
    contactos: 487,
    presupuestos: 152,
    facturas: 89
  }
}
```

### Módulos sincronizables (9)

| Módulo | Spreadsheet | Contenido |
|--------|-------------|-----------|
| `contactos` | Contactos | Todos los contactos con datos desglosados |
| `presupuestos` | Presupuestos | Documentos tipo presupuesto con líneas |
| `facturas` | Facturas | Documentos tipo factura con líneas |
| `informes` | Informes | Documentos tipo informe |
| `actividades` | Actividades | Todas las actividades |
| `visitas` | Visitas | Todas las visitas |
| `productos` | Productos | Catálogo de productos/servicios |
| `usuarios` | Usuarios | Lista de usuarios y roles |
| `asistencias` | Asistencias | Registros de fichaje |

### Cómo funciona la sincronización

```
1. Cloud Function obtiene el refreshToken de la config
2. Genera un nuevo accessToken con el refreshToken
3. Para cada módulo activo:
   a. Lee TODOS los datos del módulo desde Firestore
   b. Transforma a formato tabular (filas y columnas)
   c. Aplica estilos:
      - Encabezados: negrita, texto blanco, fondo color empresa
      - Filas alternadas: gris claro / blanco
      - Formato de fechas: locale es-AR
   d. Reemplaza TODO el contenido del spreadsheet
      (no es incremental — reescribe completo cada vez)
   e. Actualiza el campo resumen con conteos
4. Guarda ultimaSync y limpia ultimoError
```

### Frecuencia de sincronización

- **Manual**: Botón "Sincronizar ahora" en la UI
- **Automática**: Cloud Function programada que corre **cada hora**
  - Revisa todas las empresas con Google Drive conectado
  - Si pasaron N horas desde la última sync (según `frecuenciaHoras`), sincroniza
  - Frecuencia configurable: 1h, 6h, 12h, 24h, 48h, 72h

### Acciones disponibles en la UI

| Acción | Descripción |
|--------|-------------|
| Conectar | OAuth popup → autorización → creación de carpeta y hojas |
| Desconectar | Revoca token, limpia config (no borra archivos de Drive) |
| Sincronizar ahora | Fuerza sincronización inmediata de todos los módulos activos |
| Cambiar frecuencia | Configura cada cuántas horas se sincroniza |
| Activar/desactivar módulos | Checkbox por módulo para incluir/excluir de la sync |
| Ver en Drive | Link directo al spreadsheet en Google Drive |

### Desconexión

```
1. Cloud Function revoca el token con Google
2. Limpia la config en Firestore (refreshToken, conectado=false)
3. NO borra los archivos de Google Drive (quedan como backup estático)
4. UI vuelve a estado desconectado
```

---

## 6. Exportación Completa de Datos de Empresa

### Concepto
Para eliminación de cuenta o GDPR — exporta ABSOLUTAMENTE TODO en un JSON comprimido.

### Cloud Function: `exportarDatosEmpresa`
- Timeout: 300 segundos
- Memoria: 1 GiB
- Solo accesible por el **propietario** de la empresa

### Qué exporta (11 colecciones con subcolecciones)

| Colección | Subcolecciones incluidas |
|-----------|-------------------------|
| contactos | notas, chatter |
| documentos | chatter |
| productos | chatter |
| conversaciones | mensajes |
| visitas | chatter |
| actividades | — |
| usuarios | pagos |
| asistencias | — |
| eventos | — |
| configuracion | (todos los docs) |
| auditoria | — |
| plantillasCorreo | — |
| anuncios | — |

### Proceso

```
1. Valida que el usuario es propietario
2. Lee cada colección completa
3. Para cada documento, lee subcolecciones
4. Serializa Timestamps → ISO strings
5. Comprime con gzip
6. Sube a Firebase Storage: empresas/{id}/exports/backup-eliminacion-{timestamp}.json.gz
7. Genera URL firmada (expira en 7 días)
8. Retorna: { url, storagePath, totalDocs, tamanoBytes }
```

---

## 7. Historial de Backups

Cada módulo registra sus últimas exportaciones en:
`empresas/{id}/configuracion/backup{Modulo}`

```json
{
  "historial": [
    {
      "fecha": "2026-03-26T15:30:00.000Z",
      "usuarioId": "uid1",
      "usuarioNombre": "Admin",
      "totalRegistros": 487,
      "tipo": "excel"
    },
    {
      "fecha": "2026-03-20T10:00:00.000Z",
      "usuarioId": "uid1",
      "usuarioNombre": "Admin",
      "totalRegistros": 480,
      "tipo": "json"
    }
  ]
}
```

- Máximo **3 entradas** por módulo (las más recientes)
- Se usa para mostrar en la UI: "Último backup: hace 6 días"
- Color del badge según antigüedad:
  - 🟢 Verde: ≤ 7 días
  - 🟡 Ámbar: 8-30 días
  - 🔴 Rojo: > 30 días

---

## 8. Resumen Comparativo

| Característica | Excel Export | JSON Backup | Google Drive Sync |
|---------------|-------------|-------------|-------------------|
| **Formato** | .xlsx | .json | Google Sheets (online) |
| **Datos completos** | Parcial (sin vinculados completos, sin cuentas bancarias) | ✅ Completo | Completo (tabular) |
| **Restaurable** | No directamente | ✅ Importación directa | No (solo lectura) |
| **Automático** | No (manual) | No (manual) | ✅ Cada N horas |
| **Requiere cuenta Google** | No | No | Sí |
| **Incluye mensajes/chatter** | No | ✅ | No |
| **Editable por humanos** | ✅ En Excel | Difícil (JSON) | ✅ En Google Sheets |
| **Uso principal** | Compartir datos, análisis | Backup completo, migración | Backup continuo, acceso externo |
| **Acceso** | Cualquier usuario | Cualquier usuario | Solo admin |

---

## 9. Para Supabase — Qué Replicar

### Mínimo viable
1. **Exportar Excel** — igual, con las columnas adaptadas al nuevo schema
2. **Importar Excel/CSV** — con auto-mapeo de columnas y detección de duplicados
3. **Backup JSON** — dump completo de la BD para restore

### Mejoras posibles
1. **pg_dump nativo** — en vez de JSON artesanal, usar el dump de PostgreSQL
2. **Supabase Storage** — para guardar backups comprimidos en vez de descarga local
3. **Cron de Supabase** — para backups automáticos sin necesidad de Google Drive
4. **CSV nativo de PostgreSQL** — `COPY TO` para exports ultra-rápidos
5. **Importación por COPY FROM** — bulk insert nativo de PostgreSQL, mucho más rápido que fila por fila

---

*Generado desde Flux by Salix — Marzo 2026*
