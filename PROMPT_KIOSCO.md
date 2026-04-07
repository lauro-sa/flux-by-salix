# Prompt: Implementar Kiosco de Fichaje Standalone — Flux by Salix

## Contexto

Flux by Salix es un CRM/SaaS multi-tenant (Next.js 15 + Supabase + Drizzle ORM). Ya tiene un módulo de asistencias completo funcionando en `flux.salixweb.com`. Ahora hay que crear la **app standalone del kiosco** que se despliega en `kiosco.salixweb.com` — es una app separada que corre en tablets para que los empleados fichen entrada/salida presencialmente.

El sistema anterior (Firebase) tenía un kiosco funcionando. Se investigó a fondo y se documentó todo. Este prompt tiene toda la info para recrearlo adaptado al stack actual.

---

## Arquitectura

```
flux.salixweb.com        →  App principal (ya implementada)
kiosco.salixweb.com      →  Kiosco standalone (A IMPLEMENTAR)
```

### Mismo repo, deploy separado

El kiosco vive en el mismo repositorio de Flux pero como app separada:

```
apps/
  kiosco/
    src/
      app/
        layout.tsx                  # Layout kiosco (fullscreen, sin sidebar)
        page.tsx                    # Terminal de fichaje
        setup/page.tsx              # Login admin para configurar
      componentes/
        TerminalFichaje.tsx         # Máquina de estados principal
        PantallaEspera.tsx          # Idle — logo + reloj + instrucciones
        PantallaIdentificando.tsx   # Buscando empleado
        PantallaAcciones.tsx        # Botones contextuales
        PantallaConfirmacion.tsx    # Saludo + foto + confeti
        PantallaError.tsx           # Error auto-dismiss
        PantallaSolicitud.tsx       # Formulario reclamo
        TecladoPIN.tsx              # Teclado numérico fallback
        RelojTiempoReal.tsx         # Reloj digital con segundos
        SelectorTerminal.tsx        # Si hay múltiples terminales
      hooks/
        useEscuchaRFID.ts           # Lector RFID USB (HID emulado)
        useEscuchaNFC.ts            # Web NFC API
      lib/
        sonidos.ts                  # Tonos sintetizados Web Audio API
        confeti.ts                  # Animación confeti cumpleaños
        camara.ts                   # Captura foto silenciosa
```

**Comparte con Flux:** schema Drizzle, tipos TypeScript, tokens CSS, cliente Supabase.

**NO comparte:** layout, sidebar, auth de usuario, rutas de Flux.

### Auth del kiosco

El kiosco NO usa sesión de usuario normal. Flujo:

1. Admin va a Flux → Asistencias → Configuración → Terminales
2. Crea terminal "Entrada Principal"
3. Genera token de setup (válido 1 hora)
4. Se muestra QR + URL: `kiosco.salixweb.com/setup?token=xxx&empresa=xxx&terminal=xxx`
5. En la tablet se escanea el QR o se abre la URL
6. El kiosco valida el token, se registra, y queda funcionando
7. El token se invalida. El kiosco usa un JWT de larga duración con claim `es_kiosco: true`

**Para salir del kiosco:** botón en esquina inferior → requiere PIN admin (4 dígitos).

---

## Base de datos (ya creada en Supabase)

Todas estas tablas YA EXISTEN en la BD. No hay que migrar nada.

### Tablas relevantes

```sql
-- Asistencias: registro diario de fichaje
asistencias (
  id, empresa_id, miembro_id, fecha,
  hora_entrada, hora_salida,
  inicio_almuerzo, fin_almuerzo,
  salida_particular, vuelta_particular,
  estado,              -- 'activo' | 'almuerzo' | 'particular' | 'cerrado' | 'auto_cerrado' | 'ausente'
  tipo,                -- 'normal' | 'tardanza' | 'ausencia' | 'flexible'
  puntualidad_min,
  metodo_registro,     -- 'manual' | 'rfid' | 'nfc' | 'pin' | 'automatico' | 'solicitud' | 'sistema'
  terminal_id, terminal_nombre,
  ubicacion_entrada, ubicacion_salida,
  foto_entrada, foto_salida,
  turno_id, cierre_automatico,
  creado_por, editado_por, solicitud_id, notas
)
-- UNIQUE (empresa_id, miembro_id, fecha)

-- Terminales de kiosco
terminales_kiosco (
  id, empresa_id, nombre, activo,
  ultimo_ping, token_hash,
  creado_por, revocado_por, revocado_en
)

-- Configuración de asistencias (una por empresa)
config_asistencias (
  empresa_id,
  kiosco_habilitado, kiosco_metodo_lectura,  -- 'rfid_hid' | 'nfc'
  kiosco_pin_admin, kiosco_capturar_foto,
  kiosco_modo_empresa,                        -- 'logo_y_nombre' | 'solo_logo' | 'solo_nombre'
  auto_checkout_habilitado, auto_checkout_max_horas,
  descontar_almuerzo, duracion_almuerzo_min,
  ...
)

-- Solicitudes de fichaje (reclamos)
solicitudes_fichaje (
  id, empresa_id, solicitante_id,
  fecha, hora_entrada, hora_salida, motivo,
  terminal_nombre, estado,                    -- 'pendiente' | 'aprobada' | 'rechazada'
  resuelto_por, resuelto_en, notas_resolucion,
  solicitud_original_id, es_apelacion, motivo_apelacion
)

-- Turnos laborales
turnos_laborales (
  id, empresa_id, nombre, es_default, flexible,
  tolerancia_min, dias (jsonb con lunes-domingo desde/hasta)
)

-- Miembros (campos relevantes para kiosco)
miembros.kiosco_rfid        -- código RFID del llavero
miembros.kiosco_pin         -- PIN 4 dígitos
miembros.foto_kiosco_url    -- foto para mostrar en confirmación
miembros.metodo_fichaje     -- 'kiosco' | 'manual' | 'automatico'
miembros.turno_id           -- FK a turnos_laborales
miembros.fecha_nacimiento   -- para cumpleaños
```

### APIs existentes

```
POST /api/asistencias/fichar    — Registrar acción (entrada/salida/almuerzo/trámite)
GET  /api/asistencias/fichar    — Obtener turno actual del usuario
POST /api/asistencias/heartbeat — Heartbeat de actividad
GET  /api/asistencias/config    — Configuración de asistencias + turnos
```

---

## Máquina de estados del terminal

El terminal opera con 9 pantallas:

```
ESPERA → (RFID/NFC/PIN) → IDENTIFICANDO → ACCIONES → EJECUTANDO → CONFIRMACION → ESPERA
                                ↓                                        ↓
                              ERROR ← ← ← ← ← ← ← ← ← ← ← ← ← ← ERROR
                                ↓
                              ESPERA (auto-dismiss 2.5s)

Extras:
  ESPERA → (botón PIN) → TECLADO_PIN → IDENTIFICANDO
  ESPERA → (múltiples terminales) → SELECTOR_TERMINAL → ESPERA
  ACCIONES → (botón reportar) → SOLICITUD → CONFIRMACION → ESPERA
  cualquier pantalla → (esquina inferior) → ADMIN_PIN → (salir)
```

### Pantalla de espera (IDLE)

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
│              │  Pasá tu llavero por el lector  │            │
│              │  o acercá tu tarjeta NFC        │            │
│              └─────────────────────────────────┘            │
│                                                             │
│  [Ingresar con PIN]              ● Terminal activa    [⛶]  │
└─────────────────────────────────────────────────────────────┘
```

### Identificación del empleado

**Métodos:**

| Método | Hardware | Hook | Velocidad |
|--------|----------|------|-----------|
| RFID USB (HID emulado) | Lector USB + llaveros | `useEscuchaRFID` | <100ms |
| NFC (Web NFC API) | Tablet con NFC nativo | `useEscuchaNFC` | 1-2s |
| PIN manual | Ninguno | Teclado en pantalla | 10s+ |

**RFID HID:** el lector emula teclado. Envía código + Enter. Hook captura keystrokes con intervalo <50ms para distinguir de escritura humana.

**Búsqueda:**
```sql
SELECT * FROM miembros WHERE empresa_id = $1 AND kiosco_rfid = $2 AND activo = true LIMIT 1
```

### Flujo de identificación

1. Recibe código (RFID/NFC/PIN)
2. Busca miembro en BD
3. Si no encuentra → PantallaError "No reconocido"
4. Busca turno abierto de hoy (asistencias WHERE miembro_id AND fecha = hoy AND estado NOT IN cerrado, auto_cerrado, ausente)
5. Si tiene turno de día anterior sin cerrar → cerrar como 'auto_cerrado'
6. Consulta solicitudes pendientes/resueltas del último mes
7. Decide flujo:
   a. SIN turno + SIN solicitudes → crear entrada automáticamente → PantallaConfirmacion
   b. CON turno O solicitudes → PantallaAcciones (botones contextuales)

### Acciones según estado

**Turno activo (sin almuerzo previo):**
```
[🍽 Salir a almorzar]
[📋 Salgo un momento]
━━━━━━━━━━━━━━━━━━━━━
[🚪 Terminar jornada ··· 15s]  ← countdown con barra de progreso
```

**En almuerzo:** Volver del almuerzo / Terminar jornada
**En trámite:** Ya volví / Terminar jornada
**Siempre visible (si hay solicitudes):** Reportar asistencia
**Timeout:** 15 segundos de inactividad → vuelve a PantallaEspera

### Pantalla de confirmación

```
┌─────────────────────────────────────────────────────────────┐
│                    [Foto del miembro]                        │
│                     círculo grande                           │
│                  Juan García                                 │
│                  Sector: Administración                      │
│              "¡Buen turno, Juan!" ✓                         │
│              [confeti si es cumpleaños]                      │
└─────────────────────────────────────────────────────────────┘
Auto-dismiss: 4s normal / 8s cumpleaños o salida
```

### Mensajes al fichar

| Situación | Mensaje |
|-----------|---------|
| Entrada normal | "¡Buen turno, {nombre}!" |
| Entrada cumpleaños | "¡Feliz cumpleaños, {nombre}! 🎂" + confeti + arpa |
| Almuerzo | "¡Buen provecho!" |
| Volver almuerzo | "¡De vuelta al trabajo!" |
| Trámite | "¡Hasta pronto!" |
| Vuelta trámite | "¡De vuelta!" |
| Salida (jornada incompleta) | "Hoy trabajaste 7h 45min" |
| Salida (jornada completa) | "Jornada completa" (NO revela horas extra) |
| Salida cumpleaños | "¡A celebrar! 🎈" + confeti lluvia + fanfarria |

---

## Foto silenciosa

Configurable por empresa: `config_asistencias.kiosco_capturar_foto`

**TRUCO IMPORTANTE:** Capturar foto ANTES de autenticar (al recibir RFID/NFC/PIN), porque si capturás después, la persona ya se corrió. Después de autenticar, decidís si guardarla o descartarla.

1. Recibe código → captura frame inmediato (300ms)
2. Busca empleado en BD
3. Si encontró → guarda la foto ya capturada
4. Si no → descarta

**Compresión:** JPEG 320x240 @ 65% calidad (~10-15KB)
**Storage:** Supabase Storage: `asistencias/{empresa_id}/{fecha}/{asistencia_id}_entrada.jpg`

---

## Saludos y cumpleaños

### Detección de cumpleaños
```typescript
function esCumpleanosHoy(fechaNacimiento: string | null): boolean {
  if (!fechaNacimiento) return false
  const nacimiento = new Date(fechaNacimiento + 'T12:00:00')
  const hoy = new Date()
  return nacimiento.getDate() === hoy.getDate() && nacimiento.getMonth() === hoy.getMonth()
}
```

### Sonidos (Web Audio API sintetizado, no archivos)

| Evento | Sonido |
|--------|--------|
| Entrada normal | Tono corto ascendente |
| Entrada cumpleaños | Arpa mágica (cascada 9 notas Do Mayor) |
| Salida cumpleaños | Fanfarria (trompeta square + sawtooth) |
| Error | Tono descendente corto |

### Confeti de cumpleaños
- **Entrada:** explosión central hacia arriba (60 piezas, 8 colores, 2.5-3.5s)
- **Salida:** lluvia desde arriba hacia abajo (60 piezas, 3-5s)
- Formas: 50% círculos + 50% cuadrados, tamaño 6-12px

---

## Solicitudes de fichaje (reclamos)

Desde el kiosco, el empleado puede reportar un día que no fichó:

1. Toca "Reportar asistencia" en PantallaAcciones
2. PantallaSolicitud: selector fecha (últimos 30 días), hora entrada/salida, motivo
3. Envía → estado `pendiente`
4. Próxima vez que ficha, ve resultado:
   - Aprobada → check verde + "Tu solicitud del lunes fue aprobada"
   - Rechazada → cruz roja + notas del admin
   - Pendiente → reloj amarillo

**Reglas:**
- Máximo 1 reclamo por día
- Si rechazan → puede apelar 1 sola vez
- Si rechazan la apelación → "Consultá con Recursos Humanos"
- Solicitudes resueltas visibles por 7 días

**Admin gestiona desde Flux** (no desde el kiosco) — sección en Asistencias.

---

## Configuración del kiosco (ya existe en BD)

```
config_asistencias:
  kiosco_habilitado: boolean
  kiosco_metodo_lectura: 'rfid_hid' | 'nfc'
  kiosco_pin_admin: '0000'              -- PIN 4 dígitos para salir
  kiosco_capturar_foto: boolean
  kiosco_modo_empresa: 'logo_y_nombre' | 'solo_logo' | 'solo_nombre'

terminales_kiosco:
  id, nombre, activo, token_hash, ultimo_ping
```

---

## Layout responsive — Tablet 11"

Debe funcionar en apaisada (1194x834) y vertical (834x1194). Todo centrado, tipografía grande (legible a 1 metro), espaciado generoso. Flexbox column + justify-center.

---

## Reglas del proyecto

- **Todo en español:** componentes, variables, funciones, archivos, props
- **Stack:** Next.js 15 (App Router) + React 19 + TypeScript estricto + Tailwind CSS 4
- **BD:** Supabase (PostgreSQL con RLS)
- **Tokens CSS:** usar variables semánticas (--texto-primario, --superficie-app, etc.)
- **Animaciones:** Framer Motion (sutiles, no exageradas)
- **Sin over-engineering:** solo lo necesario
- **Ver CLAUDE.md** para reglas completas del proyecto

---

## Orden de implementación sugerido

1. **Setup de la app standalone** (Next.js en `/apps/kiosco/`, config Vercel)
2. **Layout + PantallaEspera** (reloj, logo empresa, instrucciones)
3. **Hooks RFID + NFC** (useEscuchaRFID, useEscuchaNFC)
4. **TecladoPIN** (fallback manual)
5. **Máquina de estados TerminalFichaje** (9 pantallas)
6. **PantallaAcciones** (botones contextuales + timeout 15s)
7. **PantallaConfirmacion** (saludo + foto + confeti + sonido)
8. **PantallaSolicitud** (formulario reclamo)
9. **Fotos silenciosas** (captura + storage)
10. **Setup por token/QR** (página /setup)
11. **Auth del kiosco** (JWT con claim es_kiosco)
12. **Gestión de solicitudes en Flux** (panel admin)
