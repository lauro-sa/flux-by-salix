# Flux by Salix — Guía para el usuario final

> Esta guía explica cómo funciona cada sección de Flux desde el punto de vista del administrador de empresa.

---

## Primeros pasos

### Crear tu empresa
1. Registrate con tu correo o con Google
2. Creá una nueva empresa (nombre, país, logo)
3. Elegí tu subdominio: `tuempresa.salixweb.com`
4. Invitá a tu equipo con un link de invitación

### Roles de usuario
| Rol | Qué puede hacer |
|-----|----------------|
| **Propietario** | Acceso total. Gestiona la empresa, facturación, y puede eliminar la cuenta |
| **Administrador** | Casi todo, excepto eliminar la empresa |
| **Gestor** | Gestión completa: contactos, documentos, actividades, visitas |
| **Vendedor** | Solo sus propios contactos y actividades |
| **Supervisor** | Visión de equipo, puede ver datos de otros usuarios |
| **Empleado** | Básico: solo fichaje de asistencias |
| **Invitado** | Acceso limitado a módulos específicos |

---

## Módulos

### Contactos
Tu base de clientes, proveedores y prospectos.

**Tipos de contacto:** Cliente, Proveedor, Competidor, Equipo, Prospecto, Otro.

**Qué podés hacer:**
- Ver en tabla, tarjetas o kanban (agrupados por tipo, etapa o etiqueta)
- Buscar por nombre, correo, teléfono o código
- Filtrar por tipo, etiqueta, etapa o fecha
- Importar contactos masivamente desde Excel/CSV
- Hacer acciones masivas (etiquetar, asignar, eliminar)
- Ver el historial completo de cada contacto (chatter)

**Configuración:**
- Pipeline de etapas (ej: Nuevo → Contactado → Negociación → Cerrado)
- Etiquetas personalizadas
- Prefijo del código secuencial (ej: C-, CLI-, CT-)

---

### Actividades
Tareas y seguimientos para tu equipo.

**Prioridades:** Baja, Normal, Alta.

**Estados:** Pendiente, Completada, Vencida, Cancelada.

**Qué podés hacer:**
- Crear actividades vinculadas a contactos, visitas o documentos
- Usar plantillas rápidas (presets) para crear actividades recurrentes
- Recibir alertas por vencimiento (push notification)
- Ver actividades pendientes en el dashboard

**Configuración:**
- Tipos de actividad personalizados (nombre + color)
- Estados personalizados

---

### Visitas
Gestión de visitas a clientes con ubicación y seguimiento.

**Estados:** Programada, En progreso, Completada, Cancelada.

**Qué podés hacer:**
- Programar visitas con fecha, motivo y dirección
- Asignar a técnicos o vendedores
- Registrar resultado, duración y fotos
- Ver visitas en el calendario
- Notificar al cliente por email o WhatsApp

**Configuración:**
- Motivos de visita personalizables
- Resultados personalizables

---

### Documentos (Presupuestos, Facturas, Informes)
Creación y gestión de documentos comerciales.

**Tipos:** Presupuesto, Factura, Informe, Orden de trabajo.

**Estados:** Borrador → Enviado → Confirmado/Rechazado → Pagado/Vencido.

**Qué podés hacer:**
- Crear documentos con líneas de productos (cantidad, precio, descuento, impuesto)
- Cálculo automático de totales e impuestos
- Generar PDF con plantilla personalizable
- Enviar por email con seguimiento
- Compartir portal público (el cliente descarga, firma, comenta)
- Convertir presupuesto a factura con un click

**Configuración:**
- **Numeración:** Prefijo + separador + año + secuencial. Ejemplo: `FA-2026-00001`
- **Reinicio del secuencial:** Nunca, cada año, o cada mes
- **Impuestos:** IVA 21%, 10.5%, exento, etc. (personalizables)
- **Monedas:** ARS, USD, EUR, etc.
- **Datos fiscales (Argentina):** Letra de comprobante (A/B/C), CUIT, punto de venta

---

### Productos
Catálogo de productos y servicios.

**Qué podés hacer:**
- Cargar productos con precio de costo y venta
- Organizar por categoría y subcategoría
- Controlar stock con historial
- Seleccionar productos rápidamente al crear documentos

---

### Inbox (Mensajería)
Centro de comunicación omnicanal.

**Tres canales:**

| Canal | Descripción |
|-------|------------|
| **WhatsApp** | Mensajes entrantes y salientes via Meta Cloud API. Soporta texto, imágenes, audio, archivos y plantillas |
| **Correo** | Sincronización IMAP + envío SMTP. Threading de conversaciones. Editor con firma |
| **Interno** | Mensajes entre miembros de tu equipo |

**Qué podés hacer:**
- Ver todas las conversaciones en un solo lugar
- Asignar conversaciones a miembros del equipo
- Distribución automática (round-robin) de nuevas conversaciones
- Archivar conversaciones resueltas
- Transcripción automática de audios (WhatsApp)
- Descripción automática de imágenes con IA

**Configuración:**
- Cuentas de WhatsApp (Phone Number ID, Access Token)
- Cuentas de correo (servidor IMAP/SMTP, credenciales)
- Pipeline de conversaciones (etapas personalizables)

---

### Agente IA (Salix Agent)
Responde automáticamente a mensajes entrantes.

**Qué hace:**
- Responde mensajes de WhatsApp y correo usando IA
- Puede crear visitas, actividades y contactos automáticamente
- Detecta cuándo transferir a un humano

**Configuración:**
- **Proveedor:** Claude (Anthropic), GPT-4 (OpenAI), Gemini (Google), Groq
- **Prompt personalizable** con variables: `{{contacto.nombre}}`, `{{empresa.nombre}}`, etc.
- **Horario:** 24/7, solo fuera de horario, o franjas específicas
- **Herramientas habilitadas:** Crear visita, crear actividad, actualizar contacto, etc.
- **Controles de seguridad:** Límite de respuestas, detección de loops, auto-pausa al intervenir un humano

---

### Asistente IA (Salix Copilot)
Asistente conversacional dentro de Flux.

**Qué hace:**
- Responde preguntas sobre tus datos (contactos, pipeline, productos)
- Ayuda a redactar correos y mensajes
- Sugiere acciones según el contexto del módulo

**Configuración independiente** del agente: proveedor, modelo, prompt, variables.

---

### Asistencias y Fichaje
Control de horarios del equipo.

**Tres métodos de fichaje:**

| Método | Cómo funciona |
|--------|--------------|
| **Manual** | El administrador marca entrada/salida desde la matriz |
| **Kiosco** | Terminal dedicada con lectura NFC/RFID. Ideal para oficinas |
| **Automático** | Al abrir la app marca entrada. Al cerrarla o por inactividad, marca salida |

**Qué podés hacer:**
- Ver la matriz de asistencias (usuarios × días)
- Widget en el dashboard con el estado de tu jornada
- Exportar a Excel
- Ver feriados por país

**Configuración:**
- Umbral de inactividad (minutos)
- Horarios permitidos de fichaje
- Duración máxima de turno (auto-cierre)
- PIN de kiosco
- Días laborales por usuario

---

### Calendario
Vista unificada de todos los eventos.

**Fuentes:** Actividades, visitas, cumpleaños de contactos, feriados.

**Vistas:** Mes, semana, día.

**Funcionalidad:** Click para crear, drag-and-drop para mover, colores por tipo.

---

### Órdenes de Trabajo
Seguimiento de trabajos con etapas.

**Qué podés hacer:**
- Crear órdenes vinculadas a contactos
- Definir etapas por empresa
- Asignar a equipos
- Ver progreso visual

---

### Auditoría
Registro automático de todo lo que pasa en Flux.

**Se registra:** Creación, edición, eliminación de cualquier entidad. Cambios de permisos. Acciones del agente IA.

**Qué podés hacer:**
- Filtrar por recurso, usuario, fecha o acción
- Ver el antes/después de cada cambio
- Exportar el log

---

### Dashboard
Panel personalizable con widgets.

**Widgets disponibles:**
- Reloj
- Estado de mi jornada (fichaje)
- Actividades pendientes
- Agenda del día
- Mensajes sin leer
- KPIs: contactos nuevos, presupuestos, facturas, visitas

**Personalización:** Drag-and-drop para mover widgets. Resize para cambiar tamaño.

---

### Notificaciones Push
Alertas en tiempo real en tu celular/PC.

**Te avisa cuando:**
- Recibís un mensaje en una conversación asignada
- Te mencionan en un chatter
- Te asignan una actividad
- Vence una actividad
- Tenés una visita programada

---

## Configuración general

Desde **Configuración** podés personalizar todo tu Flux:

| Sección | Qué configurás |
|---------|---------------|
| **General** | Nombre, logo, color de marca, país, subdominio |
| **Pipeline** | Etapas del embudo de ventas |
| **Actividades** | Tipos y estados personalizados |
| **Contactos** | Roles, etiquetas, cargos predefinidos |
| **Documentos** | Numeración, impuestos, monedas |
| **Asistencias** | Métodos de fichaje, horarios, kiosco |
| **WhatsApp** | Cuentas conectadas |
| **Correo** | Cuentas SMTP/IMAP |
| **Agente IA** | Proveedor, prompt, herramientas, horario |
| **Asistente IA** | Proveedor, prompt, variables |
| **Integraciones** | Google Drive, AFIP |

---

## Multi-idioma

Flux soporta múltiples idiomas:
- **Español** (por defecto)
- **Inglés**
- **Portugués**

El idioma se detecta automáticamente del navegador, o se puede cambiar manualmente. La preferencia se guarda para futuras sesiones.

---

## Soporte

- Web: [salixweb.com](https://salixweb.com)
- Correo: soporte@salixweb.com
