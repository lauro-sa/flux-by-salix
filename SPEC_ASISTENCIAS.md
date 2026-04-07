# Spec Completo — Modulo de Asistencias + Kiosco

> Documento de referencia para implementar el sistema de fichaje y asistencias en Flux by Salix.
> Basado en el sistema anterior (salixweb-0226) + mejoras y adaptaciones al stack actual.

---

## 1. Arquitectura General

### 1.1 Dos aplicaciones, mismo repo

```
flux.salixweb.com        →  App principal (Next.js 15, App Router)
kiosco.salixweb.com      →  Kiosco standalone (Next.js 15, standalone)
```

**Comparten:** schema Drizzle, tipos TypeScript, tokens CSS, utilidades, cliente Supabase.

**NO comparten:** layout, sidebar, auth de usuario, rutas.

El kiosco es un deploy separado en Vercel (o subdirectorio con rewrites) con su propia auth basada en token especial — no sesion de usuario. El kiosco solo puede fichar, ver solicitudes, nada mas.

### 1.2 Estructura de carpetas

```
src/
  app/(flux)/asistencias/           # Paginas admin en Flux
    page.tsx                        # Listado principal
    matriz/page.tsx                 # Vista calendario
    configuracion/page.tsx          # Config completa
  app/api/asistencias/              # API routes compartidas
    fichar/route.ts
    heartbeat/route.ts
    solicitudes/route.ts
    auto-checkout/route.ts          # Cron
    marcar-ausentes/route.ts        # Cron
  componentes/
    entidad/WidgetJornada.tsx       # Widget fichaje manual en Flux
    kiosco/                         # Componentes del kiosco (si monorepo)

apps/
  kiosco/                           # App standalone del kiosco
    src/
      app/
        layout.tsx                  # Layout kiosco (sin sidebar, fullscreen)
        page.tsx                    # Terminal de fichaje
        setup/page.tsx              # Login admin para configurar
      componentes/
        TerminalFichaje.tsx         # Maquina de estados principal
        PantallaEspera.tsx          # Idle — logo + reloj + instrucciones
        PantallaIdentificando.tsx   # Buscando empleado
        PantallaAcciones.tsx        # Botones contextuales
        PantallaConfirmacion.tsx    # Saludo + foto + confeti
        PantallaError.tsx           # Error auto-dismiss
        PantallaSolicitud.tsx       # Formulario reclamo
        TecladoPIN.tsx              # Teclado numerico fallback
        RelojTiempoReal.tsx         # Reloj digital con segundos
        SelectorTerminal.tsx        # Si hay multiples terminales
      hooks/
        useEscuchaRFID.ts           # Lector RFID USB (HID emulado)
        useEscuchaNFC.ts            # Web NFC API
      lib/
        sonidos.ts                  # Tonos sintetizados Web Audio API
        confeti.ts                  # Animacion confeti cumpleanos
        camara.ts                   # Captura foto silenciosa
```

---

## 2. Base de Datos (Schema Drizzle)

### 2.1 Tabla: `turnos_laborales`

Horarios configurables por empresa. Se asignan a sectores o miembros individuales.

```sql
turnos_laborales
  id              uuid PK
  empresa_id      uuid FK → empresas (cascade)
  nombre          text NOT NULL          -- "Horario general", "Turno fabrica"
  es_default      boolean DEFAULT false  -- uno solo por empresa
  flexible        boolean DEFAULT false  -- sin control de puntualidad ni ausencia
  tolerancia_min  integer DEFAULT 10     -- minutos de gracia para tardanza
  dias            jsonb NOT NULL
    -- {
    --   lunes:     { activo: true,  desde: "09:00", hasta: "18:00" },
    --   martes:    { activo: true,  desde: "09:00", hasta: "18:00" },
    --   miercoles: { activo: true,  desde: "09:00", hasta: "18:00" },
    --   jueves:    { activo: true,  desde: "09:00", hasta: "18:00" },
    --   viernes:   { activo: true,  desde: "09:00", hasta: "18:00" },
    --   sabado:    { activo: false, desde: "09:00", hasta: "13:00" },
    --   domingo:   { activo: false, desde: "09:00", hasta: "13:00" },
    -- }
  creado_en       timestamptz DEFAULT now()
  actualizado_en  timestamptz DEFAULT now()

INDICES:
  (empresa_id)
  (empresa_id, es_default)
```

### 2.2 Tabla: `asistencias`

Registro diario de fichaje por miembro. Un registro por persona por dia.

```sql
asistencias
  id                  uuid PK
  empresa_id          uuid FK → empresas (cascade)
  miembro_id          uuid FK → miembros (cascade)
  fecha               date NOT NULL               -- YYYY-MM-DD

  -- Timestamps de jornada
  hora_entrada        timestamptz
  hora_salida         timestamptz
  inicio_almuerzo     timestamptz
  fin_almuerzo        timestamptz
  salida_particular   timestamptz                 -- salida breve (tramite)
  vuelta_particular   timestamptz

  -- Estado de la jornada (maquina de estados)
  estado              text NOT NULL DEFAULT 'activo'
    -- 'activo'        → en turno
    -- 'almuerzo'      → pausa almuerzo
    -- 'particular'    → salida breve (tramite)
    -- 'cerrado'       → turno finalizado normalmente
    -- 'auto_cerrado'  → cierre automatico (sistema)
    -- 'ausente'       → no ficho en dia laboral

  -- Clasificacion
  tipo                text NOT NULL DEFAULT 'normal'
    -- 'normal' | 'tardanza' | 'ausencia' | 'flexible'
  puntualidad_min     integer                     -- minutos de desvio vs horario

  -- Metodo de registro
  metodo_registro     text NOT NULL DEFAULT 'manual'
    -- 'manual' | 'rfid' | 'nfc' | 'pin' | 'automatico' | 'solicitud' | 'sistema'
  terminal_id         uuid FK → terminales_kiosco
  terminal_nombre     text

  -- Fotos
  foto_entrada        text                        -- URL Supabase Storage
  foto_salida         text

  -- Geolocalizacion
  ubicacion_entrada   jsonb                       -- { lat, lng, direccion, barrio, ciudad }
  ubicacion_salida    jsonb                       -- idem

  -- Turno laboral aplicado
  turno_id            uuid FK → turnos_laborales

  -- Auditoria
  cierre_automatico   boolean DEFAULT false
  creado_por          uuid FK → miembros
  editado_por         uuid FK → miembros
  solicitud_id        uuid FK → solicitudes_fichaje
  notas               text
  creado_en           timestamptz DEFAULT now()
  actualizado_en      timestamptz DEFAULT now()

INDICES:
  (empresa_id)
  (miembro_id)
  (empresa_id, miembro_id, fecha) UNIQUE
  (empresa_id, estado, hora_entrada)  -- para auto-checkout
  (empresa_id, fecha)                 -- para marcar ausentes
```

### 2.3 Tabla: `fichajes_actividad`

Heartbeats para fichaje automatico y tracking de uso real del sistema.

```sql
fichajes_actividad
  id              uuid PK
  empresa_id      uuid FK → empresas (cascade)
  miembro_id      uuid FK → miembros (cascade)
  fecha           date NOT NULL
  timestamp       timestamptz NOT NULL
  tipo            text NOT NULL
    -- 'login'        → primer acceso del dia
    -- 'heartbeat'    → cada 5 min si pestana visible
    -- 'beforeunload' → cerro pestana/navegador
    -- 'visibility'   → cambio de visibilidad (hidden/visible)
  metadata        jsonb
    -- { navegador, so, dispositivo, pestana_visible }

INDICES:
  (empresa_id, miembro_id, fecha)
  (empresa_id, miembro_id, timestamp)
```

### 2.4 Tabla: `solicitudes_fichaje`

Reclamos de correccion de asistencia enviados desde el kiosco.

```sql
solicitudes_fichaje
  id                    uuid PK
  empresa_id            uuid FK → empresas (cascade)
  solicitante_id        uuid FK → miembros (cascade)
  fecha                 date NOT NULL              -- dia de la asistencia reclamada
  hora_entrada          text                       -- "09:15" (formato HH:mm)
  hora_salida           text                       -- "18:30"
  motivo                text NOT NULL              -- descripcion libre
  terminal_nombre       text                       -- desde que terminal se envio

  -- Resolucion
  estado                text NOT NULL DEFAULT 'pendiente'
    -- 'pendiente' | 'aprobada' | 'rechazada'
  resuelto_por          uuid FK → miembros
  resuelto_en           timestamptz
  notas_resolucion      text                       -- feedback del admin

  -- Apelacion (maximo 1)
  solicitud_original_id uuid FK → solicitudes_fichaje  -- si es apelacion
  es_apelacion          boolean DEFAULT false
  motivo_apelacion      text

  creado_en             timestamptz DEFAULT now()

INDICES:
  (empresa_id, solicitante_id, fecha)
  (empresa_id, estado)
```

### 2.5 Tabla: `terminales_kiosco`

Dispositivos kiosco registrados por empresa.

```sql
terminales_kiosco
  id              uuid PK
  empresa_id      uuid FK → empresas (cascade)
  nombre          text NOT NULL          -- "Entrada Principal", "Planta 2"
  activo          boolean DEFAULT true
  ultimo_ping     timestamptz            -- ultimo heartbeat del kiosco
  token_hash      text                   -- hash del token de setup
  creado_por      uuid FK → miembros
  revocado_por    uuid FK → miembros
  revocado_en     timestamptz
  creado_en       timestamptz DEFAULT now()

INDICES:
  (empresa_id)
  (empresa_id, activo)
```

### 2.6 Tabla: `config_asistencias`

Configuracion del modulo por empresa. Un registro por empresa.

```sql
config_asistencias
  id              uuid PK
  empresa_id      uuid FK → empresas (cascade) UNIQUE

  -- Kiosco
  kiosco_habilitado           boolean DEFAULT false
  kiosco_metodo_lectura       text DEFAULT 'rfid_hid'  -- 'rfid_hid' | 'nfc'
  kiosco_pin_admin            text                      -- PIN 4 digitos para salir
  kiosco_capturar_foto        boolean DEFAULT false
  kiosco_modo_empresa         text DEFAULT 'logo_y_nombre'
    -- 'logo_y_nombre' | 'solo_logo' | 'solo_nombre'

  -- Auto-checkout
  auto_checkout_habilitado    boolean DEFAULT true
  auto_checkout_max_horas     integer DEFAULT 12

  -- Calculo de horas
  descontar_almuerzo          boolean DEFAULT true
  duracion_almuerzo_min       integer DEFAULT 60        -- minutos
  horas_minimas_diarias       numeric(4,2) DEFAULT 0    -- 0 = desactivado
  horas_maximas_diarias       numeric(4,2) DEFAULT 0    -- 0 = desactivado

  -- Fichaje automatico
  fichaje_auto_habilitado     boolean DEFAULT false
  fichaje_auto_notif_min      integer DEFAULT 10        -- minutos para notificar
  fichaje_auto_umbral_salida  integer DEFAULT 30        -- min sin heartbeat = salida

  creado_en                   timestamptz DEFAULT now()
  actualizado_en              timestamptz DEFAULT now()
```

### 2.7 Cambios a tablas existentes

**Tabla `sectores`** — agregar:
```sql
  turno_id    uuid FK → turnos_laborales   -- nullable, si null hereda empresa
```

**Tabla `miembros`** — ya tiene, verificar/ajustar:
```sql
  turno_id          uuid FK → turnos_laborales  -- nullable, si null hereda sector
  metodo_fichaje    text     -- 'kiosco' | 'manual' | 'automatico'
  codigo_rfid       text     -- string unico del llavero
  pin_kiosco        text     -- 4 digitos
  fecha_nacimiento  date     -- para cumpleanos en kiosco
```

---

## 3. Jerarquia de Horarios

Resolucion al fichar (de mas especifico a mas general):

```
1. miembro.turno_id         → si tiene, usa ese
2. sector.turno_id          → si su sector tiene, usa ese
3. turno con es_default     → el default de la empresa
```

```typescript
async function resolverTurno(miembroId: string, empresaId: string): Promise<TurnoLaboral> {
  const miembro = await obtenerMiembro(miembroId)

  // 1. Turno individual
  if (miembro.turno_id) return await obtenerTurno(miembro.turno_id)

  // 2. Turno del sector
  if (miembro.sector_id) {
    const sector = await obtenerSector(miembro.sector_id)
    if (sector.turno_id) return await obtenerTurno(sector.turno_id)
  }

  // 3. Default de la empresa
  return await obtenerTurnoDefault(empresaId)
}
```

---

## 4. Kiosco Standalone

### 4.1 Auth del kiosco

El kiosco NO usa sesion de usuario. Flujo:

1. Admin va a Flux → Asistencias → Configuracion → Terminales
2. Crea terminal "Entrada Principal"
3. Genera token de setup (valido 1 hora)
4. Se muestra QR + URL: `kiosco.salixweb.com/setup?token=xxx&empresa=xxx&terminal=xxx`
5. En la tablet se escanea el QR o se abre la URL
6. El kiosco valida el token, se registra, y queda funcionando
7. El token se invalida. El kiosco usa un token de larga duracion (JWT con claim `es_kiosco: true`)

**Para salir del kiosco:** boton en esquina inferior → requiere PIN admin (4 digitos).

### 4.2 Maquina de estados del terminal

```
ESPERA → (RFID/NFC/PIN) → IDENTIFICANDO → ACCIONES → EJECUTANDO → CONFIRMACION → ESPERA
                                ↓                                        ↓
                              ERROR ← ← ← ← ← ← ← ← ← ← ← ← ← ← ERROR
                                ↓
                              ESPERA (auto-dismiss 2.5s)

Extras:
  ESPERA → (boton PIN) → TECLADO_PIN → IDENTIFICANDO
  ESPERA → (multiples terminales) → SELECTOR_TERMINAL → ESPERA
  ACCIONES → (boton reportar) → SOLICITUD → CONFIRMACION → ESPERA
  cualquier pantalla → (esquina inferior) → ADMIN_PIN → (salir)
```

### 4.3 Pantalla de espera

Layout para tablet 11" (apaisada o vertical):

```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│              [Logo empresa]                                 │
│              NOMBRE EMPRESA                                 │
│              (configurable: logo+nombre / solo logo /       │
│               solo nombre)                                  │
│                                                             │
│              14:35:22                                       │
│              Lunes 6 de abril, 2026                         │
│                                                             │
│              ┌─────────────────────────────────┐            │
│              │  Pasa tu llavero por el lector  │            │
│              │  o acerca tu tarjeta NFC        │            │
│              └─────────────────────────────────┘            │
│                                                             │
│                                                             │
│  [Ingresar con PIN]              ● Terminal activa    [⛶]  │
└─────────────────────────────────────────────────────────────┘
```

### 4.4 Identificacion del empleado

**Metodos soportados:**

| Metodo | Hardware | Hook | Velocidad |
|--------|----------|------|-----------|
| RFID USB (HID) | Lector USB + llaveros | `useEscuchaRFID` | <100ms |
| NFC | Tablet con NFC nativo | `useEscuchaNFC` | 1-2s |
| PIN manual | Ninguno (software) | Teclado en pantalla | 10s+ |

**RFID HID:** el lector emula teclado. Envia codigo + Enter. El hook captura keystrokes con intervalo <50ms para distinguir de escritura humana.

**Busqueda:**
```sql
SELECT * FROM miembros
WHERE empresa_id = $1 AND codigo_rfid = $2 AND estado = 'activo'
LIMIT 1
```

### 4.5 Flujo de identificacion

```
1. Recibe codigo (RFID/NFC/PIN)
2. Busca miembro en BD
3. Si no encuentra → PantallaError "No reconocido"
4. Busca turno abierto del dia (asistencias WHERE miembro_id AND fecha = hoy AND estado != 'cerrado')
5. Si tiene turno de dia anterior sin cerrar → cerrar como 'auto_cerrado'
6. Consulta solicitudes pendientes/resueltas del ultimo mes
7. Decide flujo:
   a. SIN turno + SIN solicitudes → crear entrada automatica → PantallaConfirmacion
   b. CON turno O solicitudes → PantallaAcciones (botones contextuales)
```

### 4.6 Acciones segun estado

**Turno activo (sin almuerzo previo):**
```
[🍽 Salir a almorzar]
[📋 Salgo un momento]
━━━━━━━━━━━━━━━━━━━━━
[🚪 Terminar jornada ··· 15s]  ← countdown con barra de progreso
```

**En almuerzo:**
```
[↩ Volver del almuerzo]
━━━━━━━━━━━━━━━━━━━━━
[🚪 Terminar jornada ··· 15s]
```

**En tramite/particular:**
```
[↩ Ya volvi]
━━━━━━━━━━━━━━━━━━━━━
[🚪 Terminar jornada ··· 15s]
```

**Siempre visible (si hay solicitudes pendientes o resueltas):**
```
[📝 Reportar asistencia]
```

**Timeout:** 15 segundos de inactividad → vuelve a PantallaEspera (NO marca salida).

### 4.7 Pantalla de confirmacion

```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│                    [Foto del miembro]                       │
│                     circulo grande                          │
│                                                             │
│                  Juan Garcia                                │
│                  Sector: Administracion                     │
│                                                             │
│              "¡Buen turno, Juan!" ✓                         │
│                                                             │
│              [confeti si es cumpleanos]                     │
│                                                             │
└─────────────────────────────────────────────────────────────┘
Auto-dismiss: 4s normal / 8s cumpleanos o salida
```

### 4.8 Mensajes al fichar salida

| Situacion | Mensaje |
|-----------|---------|
| Jornada incompleta | "Hoy trabajaste 7h 45min" (muestra tiempo real) |
| Jornada completa o mas | "Jornada completa" (NO revela horas extra) |
| Turno flexible | Solo muestra horas trabajadas, sin juicio |
| Cumpleanos | "¡A celebrar! Disfruta tu dia." |

### 4.9 Calculo de horas al fichar salida

```typescript
function calcularJornada(registro: Asistencia, config: ConfigAsistencias): ResultadoJornada {
  let minutosTrabajados = diffMinutos(ahora, registro.hora_entrada)

  // Descontar almuerzo si la empresa lo configuro
  if (config.descontar_almuerzo && registro.inicio_almuerzo && registro.fin_almuerzo) {
    minutosTrabajados -= diffMinutos(registro.fin_almuerzo, registro.inicio_almuerzo)
  } else if (config.descontar_almuerzo && !registro.inicio_almuerzo) {
    // Si la empresa descuenta almuerzo pero el empleado no lo marco
    // descontar la duracion configurada automaticamente
    minutosTrabajados -= config.duracion_almuerzo_min
  }

  // Comparar contra jornada esperada
  const turno = await resolverTurno(registro.miembro_id, registro.empresa_id)
  const horarioDia = turno.dias[nombreDiaHoy]
  const minutosJornada = calcMinutosJornada(horarioDia.desde, horarioDia.hasta)

  return {
    minutosTrabajados,
    minutosJornada,
    completa: minutosTrabajados >= minutosJornada,
    textoResumen: minutosTrabajados >= minutosJornada
      ? 'Jornada completa'
      : `Hoy trabajaste ${formatearDuracion(minutosTrabajados)}`
  }
}
```

---

## 5. Saludos y Cumpleanos

### 5.1 Deteccion de cumpleanos

```typescript
function esCumpleanosHoy(fechaNacimiento: string | null): boolean {
  if (!fechaNacimiento) return false
  const nacimiento = parseISO(fechaNacimiento) // parsear al mediodia local evita drift UTC
  const hoy = new Date()
  return nacimiento.getDate() === hoy.getDate() && nacimiento.getMonth() === hoy.getMonth()
}
```

### 5.2 Tabla de saludos

| Evento | Normal | Cumpleanos |
|--------|--------|------------|
| **Entrada** | "¡Buen turno, {nombre}!" | "¡Feliz cumpleanos, {nombre}! Que tengas un excelente dia." |
| **Almuerzo** | "¡Buen provecho!" | "¡Buen provecho, cumpleanero/a!" |
| **Volver almuerzo** | "¡De vuelta al trabajo!" | "¡De vuelta, {nombre}!" |
| **Salida tramite** | "¡Hasta pronto!" | "¡Hasta pronto!" |
| **Vuelta tramite** | "¡De vuelta!" | "¡De vuelta!" |
| **Salida** | "Jornada completa" / "Trabajaste Xh" | "¡A celebrar! Disfruta tu dia." |

### 5.3 Sonidos (Web Audio API sintetizado)

| Evento | Sonido | Descripcion |
|--------|--------|-------------|
| Entrada normal | Tono exito | Tono corto ascendente |
| Entrada cumple | Arpa magica | Cascada de notas Do Mayor (9 notas ascendentes) |
| Salida cumple | Fanfarria | Trompeta clasica (square + sawtooth) |
| Error | Tono error | Tono descendente corto |

### 5.4 Confeti de cumpleanos

- **Entrada:** explosion central hacia arriba (60 piezas, 8 colores, 2.5-3.5s)
- **Salida:** lluvia desde bordes superiores hacia abajo (60 piezas, 3-5s)
- Formas: 50% circulos + 50% cuadrados
- Tamano: 6-12px

---

## 6. Fotos Silenciosas

### 6.1 Configuracion

Activable/desactivable por empresa: `config_asistencias.kiosco_capturar_foto`

### 6.2 Flujo — Foto primero, autenticacion despues

**Problema:** si primero se busca al empleado en la BD (1-2 segundos) y despues se saca la foto, la persona ya se movio o se dio vuelta.

**Solucion:** capturar la foto INMEDIATAMENTE al recibir el codigo, ANTES de buscar en la BD.

```
1. RFID/NFC/PIN recibido
2. INMEDIATAMENTE capturar frame de la camara (< 50ms) → blob en memoria
3. Mostrar PantallaIdentificando (spinner)
4. Buscar al empleado en la BD
5. Si lo encuentra:
   a. Procesar accion (entrada/salida/etc)
   b. Comprimir foto: JPEG 320x240 @ 65% (~10-15KB)
   c. Subir a Supabase Storage (fire & forget, no bloquea la UI)
   d. Guardar URL en asistencias.foto_entrada o foto_salida
6. Si NO lo encuentra:
   a. Descartar el blob — nunca se sube
   b. Mostrar PantallaError
```

**Storage path:** `asistencias/{empresa_id}/{fecha}/{asistencia_id}_entrada.jpg`

**La camara esta siempre activa** (stream abierto mientras el kiosco esta en PantallaEspera). Asi no hay delay de inicializacion — el frame se captura en milisegundos.

### 6.3 Pre-captura para salida

Cuando un empleado que YA tiene turno activo se identifica, se captura un segundo frame inmediato. Si despues elige "Terminar jornada", ya tenemos la foto de salida lista (fire & forget). Si elige otra accion (almuerzo, tramite), se descarta.

---

## 7. Geolocalizacion al Fichar

### 7.1 Cuando se captura

Se captura ubicacion en TODOS los metodos de fichaje:

| Metodo | Fuente de ubicacion |
|--------|---------------------|
| Manual (desde Flux PC/movil) | `navigator.geolocation` del navegador |
| Automatico (heartbeat) | `navigator.geolocation` en el primer login del dia |
| Kiosco (RFID/NFC/PIN) | Ubicacion fija configurada en la terminal |

### 7.2 Geocoding inverso — direccion legible

Las coordenadas crudas se convierten a una direccion legible, redondeada a la cuadra (centena) por privacidad.

```
Coordenadas:        -34.6345, -58.3987
                         ↓ geocoding inverso (API)
Direccion exacta:   Av. Directorio 843
                         ↓ redondear altura a centena
Resultado final:    Av. Directorio 800, Parque Patricios, CABA
```

**API:** Google Maps Geocoding API (ya la usamos en el agente IA) o Nominatim (gratuito).

**Redondeo:** `Math.floor(numero / 100) * 100` → 843 se convierte en 800.

### 7.3 Estructura guardada

```typescript
interface UbicacionFichaje {
  lat: number
  lng: number
  direccion: string      // "Av. Directorio 800"
  barrio: string         // "Parque Patricios"
  ciudad: string         // "CABA"
  precision: number      // metros de precision del GPS
  fuente: 'navegador' | 'terminal_fija'
}
```

### 7.4 Visualizacion

**En el WidgetJornada (fichaje desde PC/movil):**
- Despues de fichar, muestra la ubicacion: "Fichaste desde Av. Directorio 800, Parque Patricios"
- Texto sutil debajo del horario de entrada

**En el listado admin:**
- Columna "Ubicacion" con la direccion corta
- Tooltip o click para ver mapa
- Info interna — no se muestra al empleado en el kiosco

**En el kiosco:**
- La ubicacion se toma de la configuracion de la terminal (es fija, no del GPS)
- Se guarda igual para consistencia

### 7.5 Permisos del navegador

- Primera vez: se pide permiso de geolocalizacion
- Si rechaza: se ficha igual, pero `ubicacion_entrada = null`
- La ubicacion es informativa, nunca bloquea el fichaje

---

## 8. Reclamos de Fichaje (Solicitudes)

### 8.1 Flujo desde el kiosco

1. Empleado toca "Reportar asistencia" en PantallaAcciones
2. Se abre PantallaSolicitud:
   - Selector de fecha (ultimos 30 dias)
   - Hora de entrada (selector HH:mm cada 5 min)
   - Hora de salida (opcional)
   - Motivo (textarea libre)
3. Envia → estado `pendiente`
4. La proxima vez que ficha, ve el resultado:
   - Aprobada → check verde + "Tu solicitud del lunes fue aprobada"
   - Rechazada → cruz roja + notas del admin
   - Pendiente → reloj amarillo + "Tu solicitud esta en revision"

### 8.2 Reglas

- **Maximo 1 reclamo** por dia fichado
- Si rechazan → puede **apelar 1 sola vez** con nueva justificacion (`es_apelacion = true`)
- Si rechazan la apelacion → "Consulta con Recursos Humanos" (no mas intentos)
- Solicitudes resueltas se muestran por **7 dias** despues de resolucion, luego dejan de aparecer en el kiosco

### 8.3 Gestion admin (en Flux)

- Seccion en Asistencias → badge con cantidad de solicitudes pendientes
- Aprobar: crea/actualiza registro de asistencia automaticamente
- Rechazar: incluir notas de rechazo (obligatorio)
- Notificacion al miembro cuando se resuelve

---

## 9. Fichaje Automatico (por actividad en Flux)

Para miembros con `metodo_fichaje = 'automatico'`.

### 9.1 Entrada automatica

```
09:00  → Miembro abre Flux (login o primera visita del dia)
       → Se detecta que no tiene turno abierto hoy
       → Se crea asistencia con hora_entrada = ahora, metodo_registro = 'automatico'
09:10  → Notificacion: "Tu fichada automatica fue registrada a las 09:00"
         (delay configurable: config_asistencias.fichaje_auto_notif_min)
```

### 9.2 Heartbeat de actividad

```
Cada 5 minutos, si la pestana esta visible:
  → POST /api/asistencias/heartbeat
  → Inserta en fichajes_actividad { tipo: 'heartbeat', timestamp: ahora }
  → Actualiza asistencias.hora_salida = ahora (salida tentativa, siempre actualizada)
```

### 9.3 Salida inteligente (NO cierra por pausas)

```
13:00  → Deja de usar la PC
13:05  → Ultimo heartbeat
         NO marca salida — solo para de actualizar

14:30  → Vuelve a usar Flux
         Heartbeat se reanuda → la pausa queda como gap interno
         hora_salida se actualiza a 14:35 (proximo heartbeat)

18:00  → Cierra todo, se va
18:05  → Ultimo heartbeat = 18:00
...sin actividad...
         La hora_salida queda en 18:00

Al otro dia o por cron nocturno:
  → Si no hubo mas heartbeats → salida definitiva = ultimo heartbeat (18:00)
  → estado = 'cerrado'
```

**La salida NUNCA se marca por una pausa.** Solo se confirma cuando:
- El cron nocturno detecta que no volvio (auto-checkout a las 03:00)
- O al dia siguiente cuando se conecta de nuevo

### 9.4 Datos de actividad real (analytics internos)

Procesando `fichajes_actividad` se puede calcular:

```
Intervalos activos:   09:00-13:00, 14:30-18:00
Tiempo en pantalla:   7h 30min
Tiempo total fichado: 9h (09:00-18:00)
Pausas detectadas:    1h 30min (13:00-14:30)
```

Esto es **informacion interna** para reportes — no afecta el fichaje ni se muestra al empleado.

---

## 10. Automatizaciones (Crons / Vercel)

### 10.1 Auto-checkout (03:00 AM)

```
POST /api/asistencias/auto-checkout (cron diario 03:00 Argentina)

Para cada empresa con auto_checkout_habilitado:
  1. Buscar asistencias con estado IN ('activo', 'almuerzo', 'particular')
     Y hora_entrada < (ahora - max_horas * 3600)
  2. Para cada una:
     - hora_salida = hora_entrada + max_horas
     - estado = 'auto_cerrado'
     - cierre_automatico = true
     - notas = "Cierre automatico — turno supero {max_horas}h sin registrar salida"
  3. Registrar en auditoria
```

### 10.2 Marcar ausentes (00:00 medianoche)

```
POST /api/asistencias/marcar-ausentes (cron diario 00:00 Argentina)

Para cada empresa:
  1. Obtener config de turnos
  2. Obtener miembros activos
  3. Para cada miembro:
     a. Resolver su turno (miembro → sector → default)
     b. Si turno flexible → saltar
     c. Si ayer NO era dia laboral → saltar
     d. Buscar asistencia de ayer
     e. Si NO existe → crear:
        - estado = 'ausente'
        - tipo = 'ausencia'
        - metodo_registro = 'sistema'
        - notas = "Marcado automatico — no registro asistencia en dia laboral"
  4. Registrar en auditoria
```

### 10.3 Recordatorio de fichaje (cada 15 min entre 6-22h)

```
POST /api/asistencias/recordatorio (cron cada 15 min)

Para cada miembro con turno asignado:
  - 15 min antes de entrada → notificacion "Recorda fichar entrada"
  - 30 min antes de salida → notificacion "Recorda fichar salida"
  - Dedup: 1 sola notificacion por tipo por dia
```

---

## 11. Configuracion del Modulo (Admin en Flux)

### 11.1 Secciones de configuracion

```
Asistencias → Configuracion
  ├─ General
  │   ├─ Descontar almuerzo: [si/no]
  │   ├─ Duracion almuerzo: [60] min
  │   ├─ Horas minimas diarias: [0] (0 = desactivado)
  │   └─ Horas maximas diarias: [0] (0 = desactivado)
  │
  ├─ Kiosco
  │   ├─ Habilitado: [si/no]
  │   ├─ Metodo lectura: [RFID HID / NFC]
  │   ├─ PIN admin (4 digitos): [****]
  │   ├─ Capturar foto: [si/no]
  │   └─ Visualizacion empresa: [Logo+nombre / Solo logo / Solo nombre]
  │
  ├─ Terminales
  │   ├─ Lista de terminales registradas
  │   ├─ [+ Agregar terminal] → genera QR/URL de setup
  │   ├─ Activar/desactivar terminal
  │   └─ Revocar terminal
  │
  ├─ Turnos laborales
  │   ├─ Lista de turnos configurados
  │   ├─ [+ Nuevo turno]
  │   ├─ Editor de dias (lun-dom, desde/hasta, activo)
  │   ├─ Marcar como default
  │   ├─ Marcar como flexible
  │   ├─ Tolerancia de tardanza: [10] min
  │   └─ Asignar a sectores
  │
  ├─ Auto-checkout
  │   ├─ Habilitado: [si/no]
  │   └─ Duracion maxima turno: [12] horas
  │
  └─ Fichaje automatico
      ├─ Habilitado: [si/no]
      ├─ Notificar despues de: [10] min
      └─ Umbral de salida: [30] min sin actividad
```

---

## 12. Vistas de Administracion (en Flux)

### 12.1 Listado principal

Tabla con columnas configurables:

| Columna | Tipo | Filtrable | Ordenable |
|---------|------|-----------|-----------|
| Empleado | texto | si | si |
| Fecha | fecha | si | si |
| Entrada | hora | no | si |
| Salida | hora | no | si |
| Duracion | numero | no | si |
| Estado | badge | si (multi) | si |
| Tipo | badge | si (multi) | no |
| Almuerzo | hora rango | no | no |
| Tramite | hora rango | no | no |
| Terminal | texto | si | no |
| Metodo | icono | si | no |
| Puntualidad | numero | no | si |

**Acciones:**
- Editar registro (timestamps, tipo, notas)
- Eliminar registro
- Exportar a Excel
- Filtrar por rango de fechas, sector, empleado

### 12.2 Edicion de fichajes (admin)

El administrador (o quien tenga permisos) puede editar cualquier registro de asistencia desde el listado o la matriz. Se abre un modal/panel lateral con los datos editables.

**Campos editables:**

| Campo | Tipo de input | Notas |
|-------|---------------|-------|
| Hora de entrada | datetime picker | Cambia el timestamp de entrada |
| Hora de salida | datetime picker | Cambia el timestamp de salida |
| Inicio almuerzo | datetime picker | Puede agregar/quitar almuerzo |
| Fin almuerzo | datetime picker | |
| Salida particular | datetime picker | Puede agregar/quitar tramite |
| Vuelta particular | datetime picker | |
| Estado | select | activo, cerrado, ausente, tardanza, justificado |
| Tipo | select | normal, tardanza, ausencia, flexible |
| Notas | textarea | Observaciones del admin |

**Acciones adicionales desde el listado:**

- **Crear fichaje manual:** el admin puede crear un registro para un miembro que no ficho (por ejemplo, alguien que trabajo en campo y no tenia acceso al kiosco)
- **Eliminar fichaje:** con confirmacion ("Estas seguro?"), queda en auditoria
- **Justificar ausencia:** cambiar un registro de `ausente` a `justificado` con nota (ej: "certificado medico")

**Auditoria:**

Toda edicion queda registrada:

```typescript
{
  asistencia_id:     'uuid',
  editado_por:       'uuid del admin',
  campo_modificado:  'hora_entrada',
  valor_anterior:    '2026-04-06T09:15:00',
  valor_nuevo:       '2026-04-06T08:45:00',
  motivo:            'Empleado llego temprano, kiosco no funcionaba',  // opcional
  fecha_edicion:     '2026-04-06T14:30:00',
}
```

El registro de asistencia se marca con `editado_por` para saber que fue tocado manualmente. En el listado se puede mostrar un icono sutil (lapiz) en las filas que fueron editadas.

**Recalculo automatico:**

Al editar timestamps, se recalculan automaticamente:
- Duracion de la jornada
- Puntualidad (tardanza o no, segun tolerancia)
- Tipo (normal/tardanza) segun el horario del turno asignado

### 12.3 Vista matriz (calendario)

```
                 Lun 6   Mar 7   Mie 8   Jue 9   Vie 10
Juan Garcia      [■]     [■]     [▲]     [■]     [□]
Maria Lopez      [■]     [■]     [■]     [■]     [■]
Pedro Ramirez    [✕]     [■]     [■]     [□]     [■]
```

- ■ Normal (verde)
- ▲ Tardanza (ambar)
- ✕ Ausente (rojo)
- □ Sin fichaje todavia / dia no laboral (gris)
- ◐ Auto-cerrado (naranja)

Periodos: semana / quincena / mes

### 12.4 Solicitudes pendientes

Badge en la seccion de asistencias con cantidad de solicitudes pendientes.
Click → panel lateral con lista, cada una con botones Aprobar / Rechazar.

---

## 13. WidgetJornada (fichaje manual desde Flux)

Widget en el header o sidebar de Flux para miembros con `metodo_fichaje = 'manual'`.

### Estados del widget

```
Sin turno hoy:     [▶ Marcar entrada]
En turno:          09:00 — ⏱ 4h 32min  [⏸ Almuerzo] [🚪 Salida]
En almuerzo:       12:30 — Almorzando   [↩ Volver]
En tramite:        15:00 — En tramite   [↩ Volvi]
Turno cerrado:     09:00-18:00 — 8h 15min ✓
```

---

## 14. Constantes y Tokens

### 14.1 Estados de asistencia

```typescript
export const ESTADOS_ASISTENCIA = ['activo', 'almuerzo', 'particular', 'cerrado', 'auto_cerrado', 'ausente'] as const

export const ETIQUETA_ESTADO: Record<EstadoAsistencia, string> = {
  activo:       'En turno',
  almuerzo:     'En almuerzo',
  particular:   'Tramite',
  cerrado:      'Cerrado',
  auto_cerrado: 'Sin salida',
  ausente:      'Ausente',
}

export const ICONO_ESTADO: Record<EstadoAsistencia, string> = {
  activo:       'PlayCircle',
  almuerzo:     'UtensilsCrossed',
  particular:   'Footprints',
  cerrado:      'CheckCircle',
  auto_cerrado: 'AlertTriangle',
  ausente:      'XCircle',
}
```

### 14.2 Tokens CSS (agregar a los existentes)

```css
--estado-activo:        var(--insignia-exito);
--estado-almuerzo:      var(--insignia-advertencia);
--estado-particular:    var(--insignia-info);
--estado-cerrado:       var(--texto-terciario);
--estado-auto-cerrado:  var(--insignia-peligro);
--estado-ausente:       var(--insignia-peligro);
```

### 14.3 Metodos de fichaje

```typescript
export const METODO_INFO = {
  manual:     { icono: 'Pencil',       etiqueta: 'Manual' },
  rfid:       { icono: 'Key',          etiqueta: 'Llavero RFID' },
  nfc:        { icono: 'Wifi',         etiqueta: 'NFC' },
  pin:        { icono: 'Hash',         etiqueta: 'Codigo PIN' },
  automatico: { icono: 'Activity',     etiqueta: 'Automatico' },
  solicitud:  { icono: 'Mail',         etiqueta: 'Solicitud' },
  sistema:    { icono: 'RefreshCw',    etiqueta: 'Sistema' },
} as const
```

---

## 15. Seguridad y RLS

### 15.1 Politicas RLS

Todas las tablas nuevas siguen el patron multi-tenant:

```sql
-- asistencias
CREATE POLICY "empresa_asistencias" ON asistencias
  USING (empresa_id = (auth.jwt() ->> 'empresa_id')::uuid);

-- Kiosco: token especial con claim empresa_id
CREATE POLICY "kiosco_asistencias" ON asistencias
  USING (empresa_id = (auth.jwt() ->> 'empresa_id')::uuid)
  WITH CHECK (
    (auth.jwt() ->> 'es_kiosco')::boolean = true
    AND metodo_registro IN ('rfid', 'nfc', 'pin')
  );
```

### 15.2 Permisos por rol

| Accion | Admin/Propietario | Empleado | Kiosco |
|--------|-------------------|----------|--------|
| Ver todas las asistencias | ✓ | ✗ | ✗ |
| Ver asistencias propias | ✓ | ✓ | ✗ |
| Crear fichaje | ✓ | ✓ (propio) | ✓ |
| Editar fichaje | ✓ | ✗ | ✗ |
| Eliminar fichaje | ✓ | ✗ | ✗ |
| Aprobar/rechazar solicitud | ✓ | ✗ | ✗ |
| Crear solicitud | ✗ | ✗ | ✓ (desde kiosco) |
| Configurar modulo | ✓ | ✗ | ✗ |
| Generar token kiosco | ✓ | ✗ | ✗ |

---

## 16. Layout del Kiosco — Responsive

### 16.1 Tablet 11" apaisada (1194x834 o similar)

```
┌──────────────────────────────────────────────────────────┐
│                                                          │
│                   [Logo 96px]                             │
│                NOMBRE EMPRESA                            │
│                                                          │
│                  14:35:22                                 │
│            Lunes 6 de abril, 2026                        │
│                                                          │
│         ┌────────────────────────────┐                   │
│         │ Pasa tu llavero por el     │                   │
│         │ lector para fichar         │                   │
│         └────────────────────────────┘                   │
│                                                          │
│                                                          │
│  [PIN]                          ● Terminal activa  [⛶]  │
└──────────────────────────────────────────────────────────┘
```

### 16.2 Tablet 11" vertical (834x1194 o similar)

```
┌────────────────────────────┐
│                            │
│                            │
│        [Logo 80px]         │
│      NOMBRE EMPRESA        │
│                            │
│                            │
│         14:35:22           │
│   Lunes 6 de abril, 2026  │
│                            │
│                            │
│  ┌──────────────────────┐  │
│  │ Pasa tu llavero por  │  │
│  │ el lector para fichar│  │
│  └──────────────────────┘  │
│                            │
│                            │
│                            │
│                            │
│  [PIN]          ● Activa   │
└────────────────────────────┘
```

Todo el contenido centrado, tipografia grande (legible a 1 metro), espaciado generoso. Funciona bien en ambas orientaciones con flex column + justify-center.

---

## 17. Orden de Implementacion Sugerido

### Fase 1 — Base (schema + config + listado)
1. Schema Drizzle: todas las tablas nuevas + migracion
2. Ajustar tabla `miembros` y `sectores` (campos nuevos)
3. Config asistencias (pagina de configuracion funcional)
4. Turnos laborales (CRUD + asignacion a sectores)
5. Listado de asistencias (tabla con datos reales)
6. Vista matriz (calendario)

### Fase 2 — Fichaje manual + automatico
7. WidgetJornada (fichaje manual desde Flux)
8. API fichar (entrada/salida/almuerzo/tramite)
9. Fichaje automatico (heartbeat + logica de entrada/salida)
10. Crons (auto-checkout, marcar ausentes, recordatorios)

### Fase 3 — Kiosco standalone
11. App kiosco (setup, auth por token)
12. Terminal de fichaje (maquina de estados completa)
13. Hooks RFID/NFC
14. Fotos silenciosas
15. Saludos + cumpleanos (sonidos, confeti)
16. Solicitudes de fichaje (desde kiosco + gestion admin)

### Fase 4 — Polish
17. Exportacion Excel
18. Reportes de actividad (analytics internos)
19. Notificaciones push (recordatorios, solicitudes)
20. Dashboard de asistencias (widget resumen)
