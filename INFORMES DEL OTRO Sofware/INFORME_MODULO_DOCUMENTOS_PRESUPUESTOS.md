# Informe Técnico: Módulo de Presupuestos

> **Propósito**: Documentar la lógica del módulo de presupuestos de SalixCRM para que el equipo del otro software (Supabase) pueda implementar un sistema equivalente o superior. Solo presupuestos — no facturas, notas de crédito, informes ni órdenes de trabajo.

---

## 1. Qué es un Presupuesto

Un presupuesto es una cotización comercial que se envía a un cliente. Contiene líneas de productos/servicios con precios, impuestos y descuentos. Se puede enviar por email, generar como PDF, y el cliente puede aceptarlo o rechazarlo desde un portal público.

### Flujo de estados

```
cotizacion → cotizacion_enviada → confirmado_cliente → orden_venta
                                → rechazado
                                → cancelado
                                → vencido
```

- `cotizacion`: borrador editable
- `cotizacion_enviada`: se envió al cliente (bloquea edición parcial)
- `confirmado_cliente`: el cliente aceptó
- `orden_venta`: se activó la ejecución (con etapas de trabajo)
- `rechazado` / `cancelado` / `vencido`: estados terminales

---

## 2. Modelo de Datos

### Ubicación en Firestore

```
/empresas/{idEmpresa}/documentos/{idDocumento}
```

Todos los presupuestos viven en la misma colección `documentos` filtrados por `tipoDocumento: "presupuesto"`.

### Campos del presupuesto

```javascript
{
  // ─── IDENTIDAD ───────────────────────────
  id: "abc123",                          // ID auto-generado
  numero: "P-0001",                      // Auto-generado por contador secuencial
  tipoDocumento: "presupuesto",          // Siempre "presupuesto"
  estado: "cotizacion",                  // Ver flujo de estados arriba
  referencia: "REF-2024-001",            // Referencia interna opcional

  // ─── CONTACTO VINCULADO (CLIENTE) ────────
  idContacto: "contact123",             // FK al contacto principal
  contactoNombre: "Juan",
  contactoApellido: "Pérez",
  contactoTipo: "persona",              // "persona" | "empresa"
  contactoCuit: "20-12345678-9",
  contactoCondicionIVA: "responsable_inscripto",
  contactoDireccion: "Calle 123",
  contactoCiudad: "Buenos Aires",
  contactoCorreo: "juan@example.com",
  contactoTelefono: "+541123456789",
  contactoWhatsapp: "+541123456789",
  contactoVinculadosEmail: [],           // Emails adicionales (CC/BCC al enviar)

  // ─── DIRIGIDO A (persona de contacto) ────
  // Útil cuando el cliente es una empresa y el presupuesto va dirigido
  // a una persona específica dentro de esa empresa
  atencionId: "contact456",
  atencionNombre: "María González",
  atencionCorreo: "maria@example.com",
  atencionCargo: "Gerente de Compras",

  // ─── MONEDA Y CONDICIONES DE PAGO ────────
  moneda: "ARS",                         // ARS | USD | EUR (configurable)
  cotizacion: 1.0,                       // Tipo de cambio si moneda != predeterminada
  condicionPagoId: "30dias",
  condicionPagoLabel: "30 días",
  condicionPagoTipo: "plazo_fijo",       // "plazo_fijo" | "hitos"

  // ─── FECHAS ──────────────────────────────
  fechaEmision: Timestamp,
  diasVencimiento: 30,
  fechaVencimiento: Timestamp,           // Calculada: fechaEmision + diasVencimiento

  // ─── LÍNEAS DE PRODUCTO / SERVICIO ───────
  lineas: [
    {
      id: "line1",
      tipoLinea: "producto",             // "producto" | "seccion" | "nota" | "descuento"
      codigoProducto: "PROD-001",
      descripcion: "Consultoría técnica",
      descripcionDetalle: "Incluye 2 horas en sitio",
      cantidad: 2,
      unidad: "hs",
      precioUnitario: 500,
      descuento: 10,                     // Porcentaje de descuento por línea
      impuestoLabel: "IVA 21%",
      impuestoPorcentaje: 21,
      subtotal: 900,                     // cantidad × precioUnitario × (1 - descuento/100)
      impuestoMonto: 189,
      total: 1089
    },
    // Líneas especiales (sin cálculo, solo visuales):
    { tipoLinea: "seccion", descripcion: "SERVICIOS ADICIONALES" },
    { tipoLinea: "nota", descripcion: "Nota: incluye 2 visitas de seguimiento" },
    { tipoLinea: "descuento", descripcion: "Descuento volumen", monto: -500 }
  ],

  // Configuración visual de qué columnas mostrar en el PDF:
  columnasLineas: ["producto", "cantidad", "unidad", "precioUnitario", "descuento", "impuestos"],
  alineacionesColumnas: { producto: "left", cantidad: "center", precioUnitario: "right" },

  // ─── TOTALES (calculados automáticamente) ──
  subtotalNeto: 900,
  totalImpuestos: 189,
  descuentoGlobal: 0,                   // Porcentaje de descuento global
  descuentoGlobalMonto: 0,
  totalFinal: 1089,

  // ─── NOTAS Y CONDICIONES (HTML rico) ─────
  notasHTML: "<p>Válido por 30 días</p>",
  condicionesHTML: "<p>Sujeto a disponibilidad</p>",
  notaPlanPago: "Pago dentro de 30 días de facturación",

  // ─── CUOTAS DE PAGO (si condición = "hitos") ──
  cuotasPago: [
    {
      id: "cuota1",
      numero: 1,
      descripcion: "Adelanto",
      porcentaje: 50,
      monto: 544.50,
      diasDesdeEmision: 0,
      estado: "pendiente",               // "pendiente" | "cobrada"
      fechaCobro: null,
      cobradoPorNombre: null
    }
  ],

  // ─── EJECUCIÓN (cuando pasa a orden_venta) ──
  ejecucion: {
    estado: "pendiente",                  // "pendiente" | "en_proceso" | "completada"
    etapas: [
      {
        id: "fabrica",
        nombre: "Fabricación",
        icono: "engineering",
        color: "#FF6B6B",
        orden: 0,
        estado: "pendiente",
        asignadoA: "user123",
        asignadoANombre: "Carlos",
        notas: "Iniciar producción",
        fechaInicio: null,
        fechaCompletada: null
      }
    ],
    activadaEn: Timestamp,
    activadaPor: "user123"
  },

  // ─── PDF ─────────────────────────────────
  pdfUrl: "https://storage.googleapis.com/...",
  pdfMiniaturaUrl: "https://...",
  pdfGeneradoEn: Timestamp,
  pdfStoragePath: "empresas/xyz/documentos/abc123.pdf",

  // ─── SEGUIDORES (reciben notificaciones) ──
  seguidores: ["user1", "user2"],
  seguidoresInfo: [
    { uid: "user1", nombre: "Ana", foto: "...", agregadoEn: Timestamp }
  ],

  // ─── AUDITORÍA ───────────────────────────
  creadoPor: "user1",
  creadoPorNombre: "Juan López",
  creadoEn: Timestamp,
  editadoPor: "user2",
  editadoPorNombre: "María García",
  actualizadoEn: Timestamp,

  // ─── HISTORIAL DE ESTADOS ────────────────
  historialEstados: [
    { estado: "cotizacion", fecha: Timestamp, usuarioId: "user1", usuarioNombre: "Juan" },
    { estado: "cotizacion_enviada", fecha: Timestamp, usuarioId: "user1", usuarioNombre: "Juan" }
  ],

  // ─── SOFT DELETE ─────────────────────────
  activo: true,
  enPapelera: false,

  // ─── ÍNDICE DE BÚSQUEDA ──────────────────
  _busqueda: ["juan", "pérez", "20-12345", "p-0001"]
}
```

### Contadores (numeración secuencial)

```
/empresas/{idEmpresa}/contadores/documentos_presupuesto
  → { valor: 42 }  // Se incrementa atómicamente al crear cada presupuesto
```

El número se genera combinando: `prefijo + separador + valor (con padding de ceros)`.

Ejemplo: prefijo "P", padding 4, separador "-" → `P-0042`

---

## 3. Conexión con Contactos

### Vinculación directa

Cada presupuesto tiene un `idContacto` que referencia al contacto principal (cliente). Los datos del contacto se **embeben** (desnormalizan) en el presupuesto al momento de la creación.

**Razón**: El presupuesto es un "snapshot" del estado del contacto al momento de emisión. Si el contacto cambia después (nueva dirección, nuevo CUIT), el presupuesto conserva los datos originales.

### Dos niveles de contacto

1. **Contacto principal** (`idContacto`): el cliente o empresa a quien se cotiza
2. **Dirigido a** (`atencionId`): la persona de contacto dentro de la empresa (ej: gerente de compras). Opcional.

### Historial automático en el contacto (Chatter)

Al crear un presupuesto, se registra automáticamente una entrada en el timeline del contacto:

```javascript
{
  accion: "documento_creado",
  tipoDocumento: "presupuesto",
  numero: "P-0001",
  documentoId: "abc123"
}
```

Esto permite ver desde el perfil del contacto todos los presupuestos que se le han emitido.

### Filtrado por contacto

Desde el perfil de un contacto se listan todos sus presupuestos filtrando por `idContacto`. También se pueden vincular presupuestos entre sí (ver sección 4).

---

## 4. Vinculación entre Presupuestos (y futuros documentos)

Aunque hoy solo hay presupuestos, el modelo ya soporta vinculación para cuando se agreguen facturas u otros tipos:

```javascript
// En el documento hijo:
origenDocumentoId: "id_del_presupuesto_padre"
origenDocumentoNumero: "P-0001"
```

`obtenerDocumentosVinculados()` retorna: padre, hijos y hermanos. Esto permite trazar la cadena completa: Presupuesto → Factura → Recibo (a futuro).

---

## 5. Generación de PDF

### Cloud Function: `generarPDFDocumento`

**Motor**: Handlebars (templates HTML) + Puppeteer (renderizado HTML → PDF)

### Flujo

```
1. Recibe { idEmpresa, idDocumento, congelado }
2. Obtiene el presupuesto + configuración (membrete, pie, datos fiscales, impuestos)
3. Construye contexto de variables Handlebars
4. Compila la plantilla (.hbs por defecto o HTML custom desde config)
5. Puppeteer renderiza el HTML a PDF
6. Sube el PDF a Firebase Storage
7. Genera miniatura (imagen) del PDF
8. Actualiza el presupuesto con pdfUrl, pdfMiniaturaUrl, pdfStoragePath
9. Retorna URLs y metadata
```

### Parámetro `congelado`

- `false`: PDF normal, se guarda en el presupuesto (pdfUrl, miniatura). Se regenera cada vez.
- `true`: Copia inmutable para envío por email. No actualiza el presupuesto. Así el PDF enviado no cambia si después se edita el presupuesto.

### Variables disponibles en la plantilla

```handlebars
{{documento.numero}}
{{etiquetaTipo}}                  <!-- "Presupuesto" -->
{{fechaEmision}}                  <!-- dd/mm/yyyy -->
{{fechaVencimiento}}
{{documento.moneda}}
{{simbolo}}                       <!-- $ | US$ | € -->

<!-- Contacto -->
{{documento.contactoNombre}}
{{documento.contactoApellido}}
{{documento.contactoCuit}}
{{documento.contactoDireccion}}

<!-- Líneas -->
{{#each lineas}}
  {{tipoLinea}} {{codigoProducto}} {{descripcion}}
  {{cantidad}} {{unidad}} {{precioUnitario}}
  {{descuento}} {{subtotal}}
{{/each}}

<!-- Totales -->
{{documento.subtotalNeto}}
{{#each desgloseIVA}}
  {{label}} / {{base}} / {{monto}}
{{/each}}
{{documento.descuentoGlobal}}
{{documento.totalFinal}}

<!-- Membrete y datos empresa -->
{{logoBase64}}
{{{membrete.contenidoHTML}}}
{{datosFiscales.razonSocial}}
{{datosFiscales.cuit}}

<!-- Helpers disponibles -->
{{formatMoneda valor}}
{{formatNumero valor}}
{{formatFecha valor}}
```

### Nombre del archivo PDF

Configurable con patrón: `"{{documento.numero}} - {{contacto.nombre}}"`

Resultado: `P-0001 - Juan Pérez.pdf`

---

## 6. Configuración por Empresa

### Estructura en Firestore

```
/empresas/{idEmpresa}/configuracion/
  ├── documentos                        ← Config GLOBAL (compartida)
  └── documentos_presupuestos           ← Config específica de presupuestos
```

### 6.1 Configuración Global (compartida)

```javascript
{
  // ─── DATOS DE LA EMPRESA (aparecen en el PDF) ──
  datosFiscales: {
    razonSocial: "Mi Empresa S.A.",
    cuit: "30-12345678-9",
    condicionIVA: "responsable_inscripto",
    domicilioFiscal: "Avenida Principal 456",
    ciudad: "Buenos Aires",
    telefono: "+541143210000",
    correo: "ventas@miempresa.com.ar",
    logoDocumentos: "https://storage.googleapis.com/logo.png",
    datosBancarios: {
      banco: "Banco Argentino",
      titular: "Mi Empresa S.A.",
      cbu: "0110123456789012345678",
      alias: "MIEMPRESA.BCA"
    },
    // Qué campos mostrar en el PDF:
    camposVisibles: {
      logo: true, razonSocial: true, cuit: true,
      condicionIVA: true, domicilioFiscal: true,
      ciudad: false, telefono: false, correo: false
    }
  },

  // ─── IMPUESTOS DISPONIBLES ───────────────
  impuestos: [
    { id: "iva21", label: "IVA 21%", porcentaje: 21, activo: true },
    { id: "iva105", label: "IVA 10.5%", porcentaje: 10.5, activo: true },
    { id: "exento", label: "Exento", porcentaje: 0, activo: true }
  ],

  // ─── MONEDAS DISPONIBLES ─────────────────
  monedas: [
    { id: "ARS", label: "Peso Argentino", simbolo: "$", activo: true },
    { id: "USD", label: "Dólar", simbolo: "US$", activo: true },
    { id: "EUR", label: "Euro", simbolo: "€", activo: true }
  ],
  monedaPredeterminada: "ARS",

  // ─── BRANDING ────────────────────────────
  logoUrl: "https://...",
  colorPrimario: "#3B82F6"
}
```

### 6.2 Configuración Específica de Presupuestos

```javascript
{
  // ─── PREFIJO Y NUMERACIÓN ────────────────
  prefijos: {
    presupuesto: "P"
  },
  numeracion: {
    presupuesto: {
      prefijo: "P",
      padding: 4,                        // P-0001, P-0002...
      componentes: [
        { tipo: "prefijo" },
        { tipo: "separador", valor: "-" },
        { tipo: "secuencial" }
        // Otros posibles: "anio", "mes", "dia"
      ],
      reinicio: "nunca"                  // "nunca" | "anual" | "mensual"
    }
  },

  // ─── CONDICIONES DE PAGO ─────────────────
  condicionesPago: [
    {
      id: "contado",
      label: "Contado",
      tipo: "plazo_fijo",
      diasVencimiento: 0,
      hitos: [],
      notaPlanPago: "Pago al contado",
      predeterminado: false
    },
    {
      id: "30dias",
      label: "30 días",
      tipo: "plazo_fijo",
      diasVencimiento: 30,
      hitos: [],
      notaPlanPago: "Pago dentro de 30 días",
      predeterminado: true
    },
    {
      id: "50_50",
      label: "50% adelanto + 50% al finalizar",
      tipo: "hitos",
      diasVencimiento: 0,
      hitos: [
        { id: "h1", porcentaje: 50, descripcion: "Adelanto", diasDesdeEmision: 0 },
        { id: "h2", porcentaje: 50, descripcion: "Al finalizar", diasDesdeEmision: 0 }
      ],
      predeterminado: false
    }
  ],

  // ─── ENCABEZADO / MEMBRETE DEL PDF ───────
  membrete: {
    contenidoHTML: "<h1>Mi Empresa</h1>",
    mostrarLogo: true,
    posicionLogo: "izquierda",          // "izquierda" | "centro" | "derecha"
    anchoLogo: 30,                       // Porcentaje del ancho
    alineacionTexto: "izquierda",
    tamanoTexto: 14,
    lineaSeparadora: true
  },

  // ─── PIE DE PÁGINA DEL PDF ───────────────
  piePagina: {
    lineaSuperior: true,
    tamanoTexto: 10,
    columnas: {
      izquierda: {
        tipo: "texto",                   // "vacio" | "texto" | "numeracion" | "imagen"
        texto: "Gracias por su confianza."
      },
      centro: {
        tipo: "vacio"
      },
      derecha: {
        tipo: "numeracion"               // "Página X de Y"
      }
    }
  },

  // ─── NOMBRE DEL ARCHIVO PDF ──────────────
  patronNombrePDF: "{{documento.numero}} - {{contacto.nombre}}",

  // ─── PLANTILLA HTML CUSTOM (opcional) ────
  plantillaPDFHTML: "<html>...</html>",

  // ─── PLANTILLAS DE PRESUPUESTOS ──────────
  // Templates reutilizables con líneas, notas y condiciones pre-cargadas
  plantillasDocumentos: [
    {
      id: "template1",
      nombre: "Consultoría estándar",
      descripcion: "Presupuesto tipo para consultoría IT",
      creadoPor: "user1",
      esGlobal: true,                    // true = para todos, false = solo del usuario
      datos: {
        lineas: [...],
        notasHTML: "...",
        condicionesHTML: "...",
        condicionPagoId: "30dias",
        moneda: "ARS"
      }
    }
  ],
  // Plantilla predeterminada por usuario (se carga automáticamente al crear):
  plantillasPredeterminadas: {
    "userId1": "template1",
    "userId2": "template2"
  },

  // ─── PLANTILLAS DE NOTAS ─────────────────
  plantillasNotas: [
    { id: "n1", nombre: "Validez 30 días", contenido: "<p>Válido por 30 días.</p>" }
  ],

  // ─── DEFAULTS ────────────────────────────
  diasVencimientoPredeterminado: 30,
  condicionesPredeterminadas: "<p>Condiciones estándar...</p>",

  // ─── ETAPAS DE EJECUCIÓN (para orden_venta) ──
  etapasEjecucion: [
    { id: "fabrica", nombre: "Fabricación", icono: "engineering", color: "#FF6B6B", orden: 0 },
    { id: "entrega", nombre: "Entrega", icono: "local_shipping", color: "#4ECDC4", orden: 1 }
  ]
}
```

---

## 7. Envío por Email

### Flujo completo

```
1. Usuario abre el modal de envío desde el detalle del presupuesto
2. Se genera un PDF congelado (copia inmutable)
3. Se busca o crea una conversación vinculada al presupuesto
4. Se envía email con:
   - Asunto personalizable
   - Cuerpo HTML rico (editor Tiptap)
   - CC/BCC con chips de destinatarios
   - PDF adjunto + archivos extra opcionales
   - Threading RFC 2822 (para que las respuestas queden en hilo)
5. Se registra en el chatter del presupuesto
6. Los CC se agregan como seguidores del presupuesto
7. El estado pasa a "cotizacion_enviada"
```

### Conversación vinculada

El envío genera una conversación en el Inbox con metadata del presupuesto:

```javascript
{
  documentoVinculado: {
    id: "doc123",
    numero: "P-0001",
    tipoDocumento: "presupuesto",
    estado: "cotizacion_enviada",
    pdfUrl: "https://..."
  }
}
```

---

## 8. Portal Público del Cliente (sin login)

El portal es una página pública donde el cliente puede ver el presupuesto, aceptarlo/rechazarlo, firmar digitalmente, subir comprobantes de pago y chatear con el vendedor. Todo sin crear cuenta ni autenticarse.

### 8.1 Generación del Token

**Cloud Function**: `generarTokenPortal` (autenticada, solo usuarios del CRM)

- Genera un UUID aleatorio (`crypto.randomUUID`)
- Expiración: **30 días**
- Si ya existe un token activo para el mismo presupuesto, lo reutiliza (preserva interacciones previas del cliente)
- URL: `https://app.salixweb.com/portal/{token}`

### 8.2 Datos almacenados en el portal

```
Firestore: /portalDocumentos/{token}
```

```javascript
{
  // ─── IDENTIDAD ───────────────────────────
  token: "uuid-aleatorio",
  idEmpresa: "emp123",
  idDocumento: "doc456",
  estado: "pendiente",                   // pendiente → visto → aceptado/rechazado/cancelado
  activo: true,
  creadoEn: Timestamp,
  expiraEn: Timestamp,                   // 30 días

  // ─── SNAPSHOT DEL PRESUPUESTO ────────────
  tipoDocumento: "presupuesto",
  numeroDocumento: "P-0001",
  totalFinal: 50000,
  moneda: "ARS",
  simboloMoneda: "$",
  lineas: [...],                          // Copia completa de las líneas
  condicionPagoLabel: "50% adelanto + 50% al finalizar",
  condicionPagoTipo: "hitos",
  notaPlanPago: "...",
  condicionesHTML: "...",
  notasHTML: "...",
  cuotasPago: [
    { id, porcentaje, monto, estado, fechaVencimiento }
  ],

  // ─── CONTACTO ────────────────────────────
  contactoNombre: "Juan Pérez",
  contactoCorreo: "juan@example.com",
  contactoTelefono: "+541123456789",
  contactoDireccion: "Calle 123",

  // ─── EMPRESA (branding del portal) ───────
  empresaNombre: "Mi Empresa S.A.",
  empresaLogo: "https://...",
  empresaColor: "#3B82F6",
  empresaTelefono: "+541143210000",
  empresaCorreo: "ventas@miempresa.com.ar",
  datosBancarios: {
    banco: "Banco Argentino",
    cbu: "0110123456789012345678",
    alias: "MIEMPRESA.BCA"
  },

  // ─── VENDEDOR ────────────────────────────
  vendedorId: "user1",
  vendedorNombre: "Carlos López",
  vendedorFoto: "https://...",

  // ─── INTERACCIONES DEL CLIENTE ───────────
  mensajes: [],                           // Mini-chatter embebido (array real-time)
  comprobantes: [],                       // Comprobantes de pago subidos
  pagosVerificados: {
    totalAcumulado: 0,
    comprobantes: []                      // Con resultado de verificación IA
  },

  // ─── FIRMA DIGITAL ──────────────────────
  firmaUrl: null,
  firmaStoragePath: null,
  firmaNombre: null,
  firmaMetadata: {
    ip: "190.xxx.xxx.xxx",
    userAgent: "Mozilla/5.0...",
    modo: "dibujar",                     // "auto" | "dibujar" | "subir"
    geolocalizacion: { lat, lng },       // Si el navegador lo permite
    timestamp: Timestamp
  },

  // ─── PDF FIRMADO ─────────────────────────
  pdfFirmadoUrl: null,
  pdfFirmadoStoragePath: null
}
```

### 8.3 Lo que ve el cliente en el portal

La página del portal muestra (de arriba a abajo):

1. **Encabezado de la empresa** — Logo, nombre, descripción, dirección, teléfono, correo
2. **Resumen del presupuesto** — Tipo, número, estado (badge), fechas emisión/vencimiento, condición de pago, vendedor, datos del cliente
3. **Botón descargar PDF** — Link al PDF original
4. **Botones de contacto rápido** — WhatsApp y llamar (si la empresa tiene teléfono)
5. **Botones de acción** — "Aceptar y Firmar" + "Rechazar" (solo antes de responder)
6. **Sección de pago** (solo después de aceptar) — Instrucciones, datos bancarios, estado por cuota, botón subir comprobante
7. **Líneas del presupuesto** (accordion) — Productos/servicios con detalle expandible, subtotales e impuestos, total final
8. **Notas y condiciones** — HTML rico
9. **Mini-chatter** — Mensajes en tiempo real entre cliente y vendedor
10. **Footer** — Branding empresa + "Powered by Salix"

### 8.4 Acciones del cliente

#### Ver (`accion: 'ver'`)
- Primera vez: cambia estado a `visto` y notifica al vendedor (push + in-app)
- Cooldown de 5 minutos entre notificaciones (evita spam si recarga)
- Detecta si quien ve es interno (usuario del CRM) para no notificar

#### Aceptar y Firmar (`accion: 'aceptar'`)
- Abre componente de firma digital con **3 modos**:
  - **Auto**: Firma cursiva generada con el nombre (fuente Dancing Script)
  - **Dibujar**: Canvas para firmar con mouse o dedo (touch)
  - **Subir**: Subir imagen PNG/JPG de la firma (máx 5MB)
- Al confirmar:
  1. Sube la imagen de firma a Storage (`empresas/{id}/portal/{token}/firma.png`)
  2. Captura **metadata forense**: IP, User-Agent, modo de firma, geolocalización (si el navegador lo permite), timestamp
  3. Descarga el PDF original y le agrega una **página de certificado** usando `pdf-lib`:
     - Título: "CERTIFICADO DE ACEPTACIÓN DIGITAL"
     - Info del documento (tipo, número, cliente, empresa, total)
     - Info de la firma (nombre, fecha/hora en zona horaria Argentina)
     - Modo de firma (auto/manuscrita/imagen)
     - **Datos forenses** (IP, User-Agent, geolocalización, token)
     - Imagen de la firma embebida
  4. Sube el PDF firmado a Storage
  5. Cambia estado del presupuesto a `confirmado_cliente`
  6. Registra en el chatter del presupuesto con el PDF firmado adjunto
  7. Notifica al vendedor

#### Rechazar (`accion: 'rechazar'`)
- Pide motivo de rechazo (opcional)
- Cambia estado del presupuesto a `cancelado`
- Registra en chatter con motivo
- Notifica al vendedor

#### Cancelar aceptación (`accion: 'cancelar'`)
- Solo válido si el estado es `aceptado` y el presupuesto NO avanzó a `orden_venta`
- Revierte estado a `cotizacion_enviada`
- Limpia: firma, firmaUrl, pdfFirmadoUrl, firmaMetadata
- Registra cancelación en chatter

#### Enviar mensaje (`accion: 'mensaje'`)
- Agrega al array `mensajes[]` en el portal (real-time via Firestore listener)
- Estructura: `{ id, autor: 'cliente', autorNombre, contenido, creadoEn }`
- Registra en chatter del presupuesto
- Notifica al vendedor con preview del mensaje

#### Subir comprobante de pago (`accion: 'comprobante'`)
- Acepta PDF o imagen (PNG, JPG)
- Sube a Storage (`empresas/{id}/portal/{token}/comprobante-{timestamp}.{ext}`)
- **Verificación con IA** (si la empresa tiene IA configurada):
  - Analiza el comprobante con Vision API
  - Extrae: monto, moneda, fecha, ordenante (CUIT/nombre), destinatario (CBU/alias), tipo de operación
  - Compara contra los datos del presupuesto
  - Resultado: `verificado` / `revision` / `rechazado` con nivel de confianza
  - Acumula en `pagosVerificados.totalAcumulado`
- Registra en chatter con estado `pendiente_confirmacion` (el vendedor debe aprobar desde el CRM)

### 8.5 Acciones del vendedor (desde el CRM)

#### Responder mensaje
- **Cloud Function**: `responderMensajePortal` (autenticada)
- Agrega al array `mensajes[]` con `autor: 'vendedor'`
- El cliente lo ve en tiempo real

#### Confirmar pago
- **Cloud Function**: `confirmarPagoPortal` (autenticada)
- Acciones posibles:
  - **`confirmar`**: Aprueba el comprobante → marca la cuota como `cobrada` → si el total acumulado >= total del presupuesto y está en `confirmado_cliente`, transiciona automáticamente a `orden_venta`
  - **`rechazar`**: Rechaza el comprobante con motivo → resta del total acumulado
  - **`eliminar`**: Elimina comprobante inválido y recalcula totales

### 8.6 Seguridad del portal

```
Firestore Rules:
  /portalDocumentos/{token}
    read: true          ← Lectura pública (cualquiera con el token)
    write: false         ← Solo Cloud Functions (admin SDK)
```

- **Lectura**: Pública. La seguridad depende de la aleatoriedad del token UUID
- **Escritura**: Solo Cloud Functions. El frontend llama `httpsCallable` sin auth, la CF valida que el portal existe y no expiró, y escribe con admin SDK
- **Limpieza**: Scheduled function cada 6 horas elimina portales expirados

### 8.7 Link del portal en emails

Al enviar el presupuesto por email, se inyecta un botón CTA:

- Genera token → construye URL del portal
- Botón HTML: `"Ver Presupuesto"` con el color de la empresa
- Se inyecta en el cuerpo del email (si hay variable `{{documento.botonPortal}}` la reemplaza, si no lo agrega al inicio)
- Compatible con todos los clientes de email (estilos inline, directivas MSO para Outlook)

### 8.8 Tabla resumen de acciones

| Acción | Quién | Auth | Efecto en presupuesto |
|--------|-------|------|-----------------------|
| Ver | Cliente | No | Estado → `visto`, notifica vendedor |
| Aceptar + Firmar | Cliente | No | Estado → `confirmado_cliente`, genera PDF firmado |
| Rechazar | Cliente | No | Estado → `cancelado`, registra motivo |
| Cancelar aceptación | Cliente | No | Revierte a `cotizacion_enviada` |
| Enviar mensaje | Cliente | No | Agrega al chatter, notifica vendedor |
| Subir comprobante | Cliente | No | Verificación IA, queda pendiente de aprobación |
| Responder mensaje | Vendedor | Sí | Agrega al chatter, cliente ve en real-time |
| Confirmar pago | Vendedor | Sí | Marca cuota cobrada, puede transicionar a `orden_venta` |
| Rechazar pago | Vendedor | Sí | Resta del acumulado, registra motivo |

---

## 9. Módulo Instalable

El módulo de presupuestos es **independiente e instalable**:

```javascript
{
  id: "presupuestos",
  nombre: "Presupuestos",
  categoria: "finanzas",
  tipo: "estandar",                     // Gratis, instalable/desinstalable
  dependencias: ["contactos", "productos"],  // Requiere estos módulos activos
  ruta: "/documentos/presupuestos",
  permisos: [
    "crear_documento",
    "editar_documento",
    "enviar_documento",
    "ver_propio",                        // Solo los que creó el usuario
    "ver_todos"                          // Todos los de la empresa
  ]
}
```

### Activación en Firestore

```
/empresas/{idEmpresa}/modulos/presupuestos → { activo: true, activadoEn, activadoPor }
```

### Efecto de desactivar

- Se oculta del sidebar y rutas
- Los permisos dejan de aplicar
- **Los datos NO se eliminan** (soft-disable)
- Al reactivar, todo vuelve a estar disponible

---

## 10. Búsqueda e Indexación

Cada presupuesto genera un campo `_busqueda` con tokens normalizados:

```javascript
_busqueda: ["juan", "pérez", "20-12345678-9", "ref-2024-001", "p-0001"]
```

Se indexan: nombre, apellido, CUIT, referencia, correo y número del presupuesto. Permite búsqueda full-text server-side con paginación.

---

## 11. Recomendaciones para Supabase

### Modelo relacional sugerido

En vez de un solo documento con todo embebido (Firestore), en PostgreSQL conviene normalizar:

| Tabla | Campos clave |
|-------|-------------|
| `presupuestos` | id, numero, estado, contacto_id, moneda, totales, fechas, config_pago, notas_html, pdf_url, auditoría |
| `lineas_presupuesto` | id, presupuesto_id (FK), tipo_linea, producto_id, descripcion, cantidad, precio, descuento, impuesto |
| `cuotas_pago` | id, presupuesto_id (FK), numero, descripcion, porcentaje, monto, estado |
| `historial_estados` | id, presupuesto_id (FK), estado, fecha, usuario_id |
| `config_presupuestos` | empresa_id, prefijo, padding, numeracion, condiciones_pago (JSONB), membrete (JSONB), pie_pagina (JSONB) |
| `plantillas_presupuesto` | id, empresa_id, nombre, es_global, datos (JSONB), creado_por |
| `contadores` | empresa_id, tipo, valor |
| `portal_presupuestos` | token, presupuesto_id, estado, expira_en, aceptado, motivo_rechazo |

### PDF

Opciones:
- **Puppeteer en Edge Function** (similar al approach actual)
- **React-PDF** (generar del lado del cliente)
- **Gotenberg** o servicio externo de HTML → PDF

### Separación modular

Aunque hoy es solo presupuestos, diseñar la tabla base pensando en que a futuro se pueden agregar facturas, informes, etc. como módulos separados. El campo `tipo_documento` o tablas separadas permiten esta extensión.

---

## 12. Resumen de Relaciones

```
CONTACTO ──── tiene muchos ──── PRESUPUESTOS (por idContacto)

PRESUPUESTO ──── tiene muchas ──── LÍNEAS (productos/servicios)
PRESUPUESTO ──── tiene muchas ──── CUOTAS DE PAGO (si condición = hitos)
PRESUPUESTO ──── tiene ──── HISTORIAL DE ESTADOS (timeline)
PRESUPUESTO ──── genera ──── PDF (Cloud Function)
PRESUPUESTO ──── se envía por ──── EMAIL (conversación vinculada)
PRESUPUESTO ──── tiene ──── PORTAL PÚBLICO (token temporal)
PRESUPUESTO ──── puede vincular a ──── OTRO DOCUMENTO (origenDocumentoId, a futuro)

EMPRESA ──── configura ──── CONFIG GLOBAL (impuestos, monedas, datos empresa)
EMPRESA ──── configura ──── CONFIG PRESUPUESTOS (prefijo, membrete, pie, plantillas, condiciones pago)
EMPRESA ──── instala ──── MÓDULO PRESUPUESTOS (activar/desactivar)
```
