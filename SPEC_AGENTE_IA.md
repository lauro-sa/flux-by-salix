# Agente IA — Especificación Completa para Flux

## Concepto

El **Agente IA** es la capa inteligente que se activa **automáticamente** cuando llega un mensaje. A diferencia de la IA manual actual (el usuario pide sugerencias), el agente **decide y actúa solo**: clasifica, responde, enruta, escala y ejecuta acciones sobre los datos de Flux.

Se posiciona **después del chatbot** en la cadena:

```
Mensaje entrante → Chatbot (reglas fijas) → Agente IA (inteligencia) → Agente humano
```

---

## Contexto del proyecto

- **Stack:** Next.js 15 (App Router) + React 19 + TypeScript estricto + Supabase + Tailwind CSS 4
- **Todo en español:** componentes, variables, funciones, archivos, props, tipos, hooks
- **Multi-tenant:** toda tabla tiene `empresa_id` con RLS
- **IA actual:** existe `/api/inbox/ia` con acciones manuales (sugerir_respuesta, resumir, analizar_sentimiento) usando Anthropic/OpenAI
- **Chatbot actual:** reglas fijas en `/api/inbox/whatsapp/webhook/route.ts` — bienvenida, menú, palabras clave, transferencia a agente
- **Config IA:** tabla `config_ia` con proveedor, API keys, modelo, temperatura — ya existe
- **Helpers IA:** funciones `llamarAnthropic()` y `llamarOpenAI()` ya existen en `/api/inbox/ia/route.ts`

---

## 1. Tablas de Base de Datos

### 1.1 `config_agente_ia`

```sql
CREATE TABLE config_agente_ia (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id    UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,

  -- General
  activo                  BOOLEAN DEFAULT false,
  nombre                  TEXT DEFAULT 'Asistente Flux',
  personalidad            TEXT DEFAULT '',
  instrucciones           TEXT DEFAULT '',
  idioma                  TEXT DEFAULT 'es',

  -- Canales donde opera
  canales_activos         TEXT[] DEFAULT '{}',

  -- Cuándo actuar
  modo_activacion         TEXT DEFAULT 'despues_chatbot',
    -- 'siempre' | 'despues_chatbot' | 'fuera_horario' | 'sin_asignar'
  delay_segundos          INT DEFAULT 0,
  max_mensajes_auto       INT DEFAULT 5,

  -- Capacidades (toggles)
  puede_responder         BOOLEAN DEFAULT true,
  puede_clasificar        BOOLEAN DEFAULT true,
  puede_enrutar           BOOLEAN DEFAULT false,
  puede_resumir           BOOLEAN DEFAULT true,
  puede_sentimiento       BOOLEAN DEFAULT true,
  puede_crear_actividad   BOOLEAN DEFAULT false,
  puede_actualizar_contacto BOOLEAN DEFAULT false,
  puede_etiquetar         BOOLEAN DEFAULT true,

  -- Respuestas
  modo_respuesta          TEXT DEFAULT 'sugerir',
    -- 'automatico' | 'sugerir' | 'borrador'
    -- automatico: envía sin aprobación
    -- sugerir: muestra al agente humano para aprobar
    -- borrador: guarda como borrador en el compositor
  tono                    TEXT DEFAULT 'profesional',
    -- 'profesional' | 'amigable' | 'formal' | 'casual'
  largo_respuesta         TEXT DEFAULT 'medio',
    -- 'corto' | 'medio' | 'largo'
  firmar_como             TEXT DEFAULT '',

  -- Base de conocimiento
  usar_base_conocimiento  BOOLEAN DEFAULT false,

  -- Escalamiento
  escalar_si_negativo     BOOLEAN DEFAULT true,
  escalar_si_no_sabe      BOOLEAN DEFAULT true,
  escalar_palabras        TEXT[] DEFAULT ARRAY['hablar con persona', 'agente', 'humano', 'gerente'],
  mensaje_escalamiento    TEXT DEFAULT 'Te voy a comunicar con un agente. Un momento por favor.',

  -- Workflow-ready: acciones disponibles como nodos
  acciones_habilitadas    JSONB DEFAULT '[]',

  -- Métricas
  total_mensajes_enviados INT DEFAULT 0,
  total_escalamientos     INT DEFAULT 0,

  -- Timestamps
  creado_en               TIMESTAMPTZ DEFAULT now(),
  actualizado_en          TIMESTAMPTZ DEFAULT now(),

  UNIQUE(empresa_id)
);

ALTER TABLE config_agente_ia ENABLE ROW LEVEL SECURITY;
CREATE POLICY "empresa_aislada" ON config_agente_ia
  USING (empresa_id = (auth.jwt() ->> 'empresa_id')::uuid);
```

### 1.2 `base_conocimiento_ia`

```sql
CREATE TABLE base_conocimiento_ia (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id    UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,

  titulo        TEXT NOT NULL,
  contenido     TEXT NOT NULL,
  categoria     TEXT DEFAULT 'general',
  etiquetas     TEXT[] DEFAULT '{}',
  activo        BOOLEAN DEFAULT true,

  -- Embedding para búsqueda semántica (futuro)
  embedding     VECTOR(1536),

  creado_en     TIMESTAMPTZ DEFAULT now(),
  actualizado_en TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE base_conocimiento_ia ENABLE ROW LEVEL SECURITY;
CREATE POLICY "empresa_aislada" ON base_conocimiento_ia
  USING (empresa_id = (auth.jwt() ->> 'empresa_id')::uuid);
CREATE INDEX idx_bc_empresa ON base_conocimiento_ia(empresa_id);
```

### 1.3 `log_agente_ia`

```sql
CREATE TABLE log_agente_ia (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id      UUID NOT NULL,
  conversacion_id UUID NOT NULL REFERENCES conversaciones(id),
  mensaje_id      UUID REFERENCES mensajes(id),

  accion          TEXT NOT NULL,
    -- 'responder' | 'clasificar' | 'enrutar' | 'resumir' | 'sentimiento' |
    -- 'etiquetar' | 'escalar' | 'crear_actividad' | 'actualizar_contacto'

  entrada         JSONB,
  salida          JSONB,
  exito           BOOLEAN DEFAULT true,
  error           TEXT,

  proveedor       TEXT,
  modelo          TEXT,
  tokens_entrada  INT DEFAULT 0,
  tokens_salida   INT DEFAULT 0,
  latencia_ms     INT DEFAULT 0,

  creado_en       TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_log_empresa ON log_agente_ia(empresa_id, creado_en DESC);
CREATE INDEX idx_log_conv ON log_agente_ia(conversacion_id);
```

### 1.4 Columnas nuevas en `conversaciones`

```sql
ALTER TABLE conversaciones
  ADD COLUMN agente_ia_activo BOOLEAN DEFAULT true,
  ADD COLUMN clasificacion_ia JSONB;
  -- {"intencion": "soporte", "tema": "facturación", "urgencia": "alta", "confianza": 85}
```

---

## 2. Tipos TypeScript

Agregar en `src/tipos/inbox.ts`:

```typescript
// ─── Agente IA ───

export type ModoActivacionAgente = 'siempre' | 'despues_chatbot' | 'fuera_horario' | 'sin_asignar'
export type ModoRespuestaAgente = 'automatico' | 'sugerir' | 'borrador'
export type TonoAgente = 'profesional' | 'amigable' | 'formal' | 'casual'
export type LargoRespuesta = 'corto' | 'medio' | 'largo'

export type AccionAgente =
  | 'responder' | 'clasificar' | 'enrutar' | 'resumir'
  | 'sentimiento' | 'etiquetar' | 'escalar'
  | 'crear_actividad' | 'actualizar_contacto'

export interface ConfigAgenteIA {
  id: string
  empresa_id: string
  activo: boolean
  nombre: string
  personalidad: string
  instrucciones: string
  idioma: string
  canales_activos: string[]
  modo_activacion: ModoActivacionAgente
  delay_segundos: number
  max_mensajes_auto: number
  puede_responder: boolean
  puede_clasificar: boolean
  puede_enrutar: boolean
  puede_resumir: boolean
  puede_sentimiento: boolean
  puede_crear_actividad: boolean
  puede_actualizar_contacto: boolean
  puede_etiquetar: boolean
  modo_respuesta: ModoRespuestaAgente
  tono: TonoAgente
  largo_respuesta: LargoRespuesta
  firmar_como: string
  usar_base_conocimiento: boolean
  escalar_si_negativo: boolean
  escalar_si_no_sabe: boolean
  escalar_palabras: string[]
  mensaje_escalamiento: string
  acciones_habilitadas: AccionNodo[]
  total_mensajes_enviados: number
  total_escalamientos: number
}

// Preparado para workflows — cada acción es un nodo potencial
export interface AccionNodo {
  id: string
  tipo: AccionAgente
  config?: Record<string, unknown>
  activo?: boolean
}

export interface EntradaBaseConocimiento {
  id: string
  empresa_id: string
  titulo: string
  contenido: string
  categoria: string
  etiquetas: string[]
  activo: boolean
}

export interface LogAgenteIA {
  id: string
  empresa_id: string
  conversacion_id: string
  mensaje_id: string | null
  accion: AccionAgente
  entrada: Record<string, unknown>
  salida: Record<string, unknown>
  exito: boolean
  error: string | null
  proveedor: string
  modelo: string
  tokens_entrada: number
  tokens_salida: number
  latencia_ms: number
  creado_en: string
}

export interface ClasificacionIA {
  intencion: string       // "soporte", "ventas", "consulta", "queja", "spam"
  tema: string            // "facturación", "envío", "producto", etc.
  urgencia: 'baja' | 'media' | 'alta' | 'critica'
  confianza: number       // 0-100
  idioma_detectado?: string
}

// Resultado del pipeline del agente
export interface ResultadoPipelineAgente {
  clasificacion?: ClasificacionIA
  sentimiento?: { valor: string; confianza: number }
  respuesta?: { texto: string; fuentes?: string[] }
  acciones_ejecutadas: AccionAgente[]
  escalado: boolean
  razon_escalamiento?: string
}
```

---

## 3. API Routes

### 3.1 Estructura de archivos

```
src/app/api/inbox/agente-ia/
  config/route.ts                   → GET/PUT config_agente_ia
  ejecutar/route.ts                 → POST — ejecutar pipeline en un mensaje
  base-conocimiento/route.ts        → GET/POST base_conocimiento_ia
  base-conocimiento/[id]/route.ts   → GET/PUT/DELETE entrada individual
  log/route.ts                      → GET log con filtros y paginación
```

### 3.2 `GET/PUT /api/inbox/agente-ia/config`

Mismo patrón que `/api/inbox/chatbot`:
- GET: obtener `config_agente_ia` de la empresa (por empresa_id del JWT)
- PUT: upsert de la configuración

### 3.3 `POST /api/inbox/agente-ia/ejecutar` — El corazón

```typescript
// Input
{
  conversacion_id: string
  mensaje_id: string
  canal_id: string
  forzar?: boolean          // Ignorar modo_activacion (para testing)
}

// Pipeline de ejecución:
// 1. Verificar si el agente debe actuar (modo_activacion, canal, max_mensajes)
// 2. Obtener contexto (últimos 30 mensajes, datos del contacto, base de conocimiento)
// 3. Construir system prompt dinámico con toda la info
// 4. UNA sola llamada al LLM pidiendo JSON estructurado
// 5. Parsear respuesta del LLM
// 6. Ejecutar decisión:
//    - Si debe_escalar → enviar mensaje_escalamiento, marcar agente_ia_activo=false
//    - Si modo='automatico' → enviar respuesta vía WhatsApp/correo API
//    - Si modo='sugerir' → guardar como sugerencia visible al agente
//    - Si modo='borrador' → guardar como borrador
// 7. Ejecutar acciones secundarias (etiquetar, crear actividad, actualizar contacto)
// 8. Actualizar conversación (clasificacion_ia, sentimiento, resumen_ia)
// 9. Loggear en log_agente_ia (tokens, latencia, resultado)

// Output
{
  clasificacion: { intencion, tema, urgencia, confianza },
  sentimiento: { valor, confianza },
  respuesta: { texto, modo, fuentes },
  acciones: ['clasificar', 'sentimiento', 'responder'],
  escalado: false
}
```

### 3.4 System prompt del agente (construido dinámicamente)

```
Eres {nombre}, asistente virtual de {empresa}.

PERSONALIDAD:
{personalidad}

INSTRUCCIONES DEL NEGOCIO:
{instrucciones}

TONO: {tono}
LARGO DE RESPUESTAS: {largo_respuesta}

BASE DE CONOCIMIENTO:
{entradas relevantes de base_conocimiento_ia, filtradas por categoría si aplica}

DATOS DEL CONTACTO:
- Nombre: {contacto.nombre}
- Empresa: {contacto.empresa}
- Etiquetas: {contacto.etiquetas}
- Historial: {resumen de interacciones previas}

REGLAS:
- Si no sabés la respuesta, decilo honestamente
- Si el cliente pide hablar con un humano, responde: "{mensaje_escalamiento}"
- No inventés información que no esté en la base de conocimiento
- Palabras de escalamiento: {escalar_palabras.join(', ')}
- {firmar_como ? 'Firmá como: ' + firmar_como : ''}

CONVERSACIÓN ACTUAL:
{últimos 30 mensajes formateados como [Cliente/Agente] nombre: texto}

RESPONDE EXCLUSIVAMENTE con este JSON (sin texto adicional):
{
  "respuesta": "tu respuesta al cliente",
  "clasificacion": {
    "intencion": "soporte|ventas|consulta|queja|spam|saludo",
    "tema": "string descriptivo",
    "urgencia": "baja|media|alta|critica",
    "confianza": 0-100
  },
  "sentimiento": {
    "valor": "positivo|neutro|negativo|urgente",
    "confianza": 0-100
  },
  "debe_escalar": true/false,
  "razon_escalamiento": "motivo o null",
  "etiquetas_sugeridas": ["etiqueta1", "etiqueta2"],
  "acciones_sugeridas": [
    {"tipo": "crear_actividad", "datos": {"titulo": "...", "descripcion": "..."}},
    {"tipo": "actualizar_contacto", "datos": {"campo": "...", "valor": "..."}}
  ]
}
```

### 3.5 `GET/POST /api/inbox/agente-ia/base-conocimiento`

- GET: listar entradas de la empresa, con filtros opcionales (categoria, activo, búsqueda)
- POST: crear nueva entrada

### 3.6 `GET/PUT/DELETE /api/inbox/agente-ia/base-conocimiento/[id]`

CRUD estándar para una entrada individual.

### 3.7 `GET /api/inbox/agente-ia/log`

```typescript
// Query params:
// ?conversacion_id=xxx     → logs de una conversación
// ?accion=responder        → filtrar por tipo de acción
// ?desde=2024-01-01        → desde fecha
// ?hasta=2024-01-31        → hasta fecha
// ?pagina=1&limite=50      → paginación

// Retorna:
{
  logs: LogAgenteIA[],
  total: number,
  metricas: {
    total_acciones: number,
    total_tokens: number,
    latencia_promedio: number,
    tasa_exito: number,
    por_accion: Record<string, number>
  }
}
```

---

## 4. Lógica Core del Pipeline

### 4.1 Estructura de archivos

```
src/lib/agente-ia/
  pipeline.ts       → Orquestador principal
  nodos.ts          → Cada acción como función independiente (workflow-ready)
  contexto.ts       → Constructor del system prompt y contexto
  tipos.ts          → Re-export de tipos + interfaces internas
```

### 4.2 `pipeline.ts` — Orquestador

```typescript
// Función principal que ejecuta el pipeline completo
export async function ejecutarPipelineAgente(params: {
  admin: SupabaseClient
  empresa_id: string
  conversacion_id: string
  mensaje_id: string
  canal_id: string
  forzar?: boolean
}): Promise<ResultadoPipelineAgente>

// Pasos internos:
// 1. cargarConfigAgente(admin, empresa_id)
// 2. verificarDebeActuar(config, conversacion, canal_id)
// 3. construirContexto(admin, empresa_id, conversacion_id, config)
// 4. ejecutarLLM(contexto, configIA)  → una sola llamada
// 5. procesarRespuestaLLM(respuestaJSON)
// 6. ejecutarAcciones(resultado, config, admin)
// 7. loggear(admin, resultado, metricas)
```

### 4.3 `nodos.ts` — Acciones independientes (workflow-ready)

Cada acción es una función pura que recibe contexto y retorna resultado. Diseñadas para ser invocables individualmente desde un futuro workflow:

```typescript
// Interfaz base para todos los nodos
export interface NodoAgenteIA {
  tipo: AccionAgente
  ejecutar(contexto: ContextoPipeline): Promise<ResultadoNodo>
}

// Contexto compartido entre nodos
export interface ContextoPipeline {
  empresa_id: string
  conversacion_id: string
  mensaje_id: string
  mensajes: MensajeContexto[]
  contacto: DatosContacto | null
  base_conocimiento: EntradaBaseConocimiento[]
  config: ConfigAgenteIA
  config_ia: ConfigIA             // Proveedor, API key, modelo
  resultados_previos: Record<string, unknown>
}

// Nodos implementados:
export const nodoClasificar: NodoAgenteIA
export const nodoResponder: NodoAgenteIA
export const nodoSentimiento: NodoAgenteIA
export const nodoEtiquetar: NodoAgenteIA
export const nodoResumir: NodoAgenteIA
export const nodoEnrutar: NodoAgenteIA
export const nodoEscalar: NodoAgenteIA
export const nodoCrearActividad: NodoAgenteIA
export const nodoActualizarContacto: NodoAgenteIA
```

### 4.4 `contexto.ts` — Constructor

```typescript
// Construye el system prompt dinámico
export function construirSystemPrompt(params: {
  config: ConfigAgenteIA
  contacto: DatosContacto | null
  empresa: { nombre: string }
  baseConocimiento: EntradaBaseConocimiento[]
  mensajes: MensajeContexto[]
}): string

// Obtiene todo el contexto necesario de la BD
export async function obtenerContextoCompleto(params: {
  admin: SupabaseClient
  empresa_id: string
  conversacion_id: string
  config: ConfigAgenteIA
}): Promise<ContextoPipeline>
```

---

## 5. Integración en el Webhook de WhatsApp

En `src/app/api/inbox/whatsapp/webhook/route.ts`, después de `procesarChatbot` (línea ~341):

```typescript
// ─── Agente IA: procesamiento inteligente ───
try {
  // Solo si el chatbot no respondió (chatbot_activo=false o no matcheó)
  const { data: convActualizada } = await admin
    .from('conversaciones')
    .select('chatbot_activo, agente_ia_activo')
    .eq('id', conversacion.id)
    .single()

  // Si el chatbot sigue activo y respondió, no interviene el agente
  // Si agente_ia_activo=false (fue escalado), tampoco interviene
  if (convActualizada?.agente_ia_activo) {
    const { ejecutarPipelineAgente } = await import('@/lib/agente-ia/pipeline')
    await ejecutarPipelineAgente({
      admin,
      empresa_id: canal.empresa_id,
      conversacion_id: conversacion.id,
      mensaje_id: mensajeGuardado.id,
      canal_id: canal.id,
    })
  }
} catch (err) {
  console.warn('[AGENTE_IA] Error:', err)
}
```

---

## 6. UI de Configuración

### 6.1 Agregar sección en el sidebar

En `src/app/(flux)/inbox/configuracion/page.tsx`, agregar en el array `secciones`:

```typescript
{ id: 'agente_ia', etiqueta: 'Agente IA', icono: <Sparkles size={16} />, grupo: 'Automatización' },
```

Y en el render:

```typescript
{seccionActiva === 'agente_ia' && (
  <SeccionAgenteIA />
)}
```

### 6.2 Componente `SeccionAgenteIA`

Crear como componente separado en `src/app/(flux)/inbox/_componentes/SeccionAgenteIA.tsx`.

**Estructura con tabs internos:**

#### Tab "General"
- Toggle activo/inactivo (header con icono Sparkles)
- Input: Nombre del agente
- Textarea: Personalidad (placeholder: "Eres un asistente profesional de ventas...")
- Textarea: Instrucciones del negocio (placeholder: "Horario: L-V 9-18hs. No ofrecer descuentos >15%...")
- Checkboxes: Canales donde opera (lista de canales_inbox de la empresa)
- Select: Modo de activación (siempre, después del chatbot, fuera de horario, sin asignar)
- Input numérico: Esperar X segundos antes de responder

#### Tab "Capacidades"
- Toggles (Interruptor) para cada capacidad:
  - Responder mensajes
  - Clasificar intención y tema
  - Detectar sentimiento
  - Etiquetar conversaciones
  - Resumir conversaciones
  - Enrutar a agente/equipo
  - Crear actividades
  - Actualizar datos del contacto
- Cada toggle con descripción breve debajo

#### Tab "Respuestas"
- Radio group: Modo de respuesta
  - Automático — envía sin aprobación
  - Sugerir — muestra al agente humano para aprobar
  - Borrador — guarda en compositor
- Select: Tono (profesional, amigable, formal, casual)
- Select: Largo (corto: 1 oración, medio: 1-3 oraciones, largo: párrafo)
- Input: Firma (ej: "— Equipo de Soporte")
- Input numérico: Máx respuestas seguidas sin humano

#### Tab "Conocimiento"
- Toggle: Usar base de conocimiento
- Lista de entradas con:
  - Título, categoría (badge), toggle activo
  - Botón editar (abre modal)
  - Botón eliminar
- Botón "+ Agregar entrada" que abre modal con:
  - Input: Título
  - Select: Categoría (general, soporte, ventas, info, producto)
  - Input: Etiquetas (chips/tags)
  - Textarea grande: Contenido
- Estado vacío cuando no hay entradas

#### Tab "Escalamiento"
- Toggle: Escalar si sentimiento negativo
- Toggle: Escalar si no sabe responder
- Input de tags: Palabras que disparan escalamiento
- Textarea: Mensaje al escalar

#### Tab "Actividad"
- Métricas de las últimas 24h:
  - Mensajes procesados
  - Respuestas automáticas enviadas
  - Escalamientos
  - Sentimiento promedio
  - Tokens consumidos
- Mini tabla/lista con últimas 10 acciones del log
- Link "Ver log completo" (podría abrir modal o navegar)

### 6.3 Patrón visual

Seguir exactamente el mismo patrón que `SeccionChatbot`:
- Header con icono + toggle global
- Contenido deshabilitado (opacity + pointer-events) cuando inactivo
- Secciones con `border: 1px solid var(--borde-sutil)` y `rounded-xl`
- Labels con `text-xxs font-semibold uppercase tracking-wider`
- Usar los componentes existentes: `Interruptor`, `Select`, `Input`, `Boton`, `Tarjeta`, `Insignia`, `Modal`
- Tokens semánticos para colores (nunca hardcodeados)

---

## 7. Flujo Completo de un Mensaje

```
1. Llega mensaje WhatsApp al webhook
              ↓
2. Se guarda en BD (mensajes + conversaciones)
              ↓
3. Chatbot evalúa (reglas fijas: bienvenida, menú, palabras clave)
   ├─ Si matchea → responde el chatbot, FIN
   └─ Si no matchea o chatbot_activo=false → continúa
              ↓
4. Agente IA evalúa (si config.activo && agente_ia_activo en conversación)
   ├─ Verifica modo_activacion (siempre, después chatbot, fuera horario, sin asignar)
   ├─ Verifica canal está en canales_activos
   ├─ Verifica max_mensajes_auto no superado
   └─ Si no debe actuar → FIN (espera agente humano)
              ↓
5. Pipeline IA (una sola llamada al LLM con JSON estructurado):
   ├─ Clasifica intención + tema + urgencia
   ├─ Detecta sentimiento
   ├─ Decide si escalar o responder
   ├─ Genera respuesta con contexto + base de conocimiento
   └─ Sugiere etiquetas y acciones
              ↓
6. Ejecutar decisión:
   ├─ Si debe_escalar → enviar mensaje_escalamiento, marcar agente_ia_activo=false
   ├─ Si modo='automatico' → enviar respuesta vía WhatsApp API
   ├─ Si modo='sugerir' → guardar como sugerencia (el agente la ve y aprueba)
   ├─ Si modo='borrador' → guardar como borrador en conversación
   └─ Ejecutar acciones secundarias (etiquetar, crear actividad, etc.)
              ↓
7. Loggear en log_agente_ia (acción, tokens, latencia, resultado)
              ↓
8. Actualizar conversación (clasificacion_ia, sentimiento, resumen_ia)
```

---

## 8. Preparación para Workflows

La arquitectura está diseñada para que cada capacidad del agente sea un **nodo invocable** desde un futuro editor visual de workflows (React Flow):

```typescript
// Cuando se implementen workflows, el nodo "Agente IA" será:
[Trigger: Mensaje nuevo] → [Nodo: Agente IA - Clasificar] → [Condición: urgencia alta?]
                                                              → Sí → [Nodo: Agente IA - Escalar]
                                                              → No → [Nodo: Agente IA - Responder]
```

La columna `acciones_habilitadas` (JSONB) en `config_agente_ia` ya almacena las acciones como array de nodos:

```json
[
  {"id": "nodo_1", "tipo": "clasificar", "activo": true},
  {"id": "nodo_2", "tipo": "responder", "activo": true, "config": {"tono": "amigable"}},
  {"id": "nodo_3", "tipo": "etiquetar", "activo": true}
]
```

Cada función en `src/lib/agente-ia/nodos.ts` implementa la interfaz `NodoAgenteIA` con `ejecutar(contexto)`, lista para ser llamada individualmente desde un workflow.

---

## 9. Archivos a Crear/Modificar

| Archivo | Acción |
|---------|--------|
| `src/tipos/inbox.ts` | Agregar tipos del agente IA (sección 2) |
| `src/lib/agente-ia/pipeline.ts` | Orquestador principal del pipeline |
| `src/lib/agente-ia/nodos.ts` | Cada acción como función independiente |
| `src/lib/agente-ia/contexto.ts` | Constructor del system prompt y contexto |
| `src/app/api/inbox/agente-ia/config/route.ts` | GET/PUT configuración |
| `src/app/api/inbox/agente-ia/ejecutar/route.ts` | POST ejecutar pipeline |
| `src/app/api/inbox/agente-ia/base-conocimiento/route.ts` | GET/POST conocimiento |
| `src/app/api/inbox/agente-ia/base-conocimiento/[id]/route.ts` | GET/PUT/DELETE individual |
| `src/app/api/inbox/agente-ia/log/route.ts` | GET log con filtros |
| `src/app/(flux)/inbox/_componentes/SeccionAgenteIA.tsx` | UI completa de configuración |
| `src/app/(flux)/inbox/configuracion/page.tsx` | Agregar sección al sidebar + render |
| `src/app/api/inbox/whatsapp/webhook/route.ts` | Integrar llamada post-chatbot |

---

## 10. Orden de Implementación

```
Paso 1  → Crear tablas en Supabase (SQL de sección 1)
Paso 2  → Agregar tipos en src/tipos/inbox.ts (sección 2)
Paso 3  → API config GET/PUT (simple CRUD, patrón de /api/inbox/chatbot)
Paso 4  → API base de conocimiento CRUD
Paso 5  → src/lib/agente-ia/ — pipeline.ts, nodos.ts, contexto.ts
Paso 6  → API ejecutar — endpoint principal que usa el pipeline
Paso 7  → SeccionAgenteIA.tsx (UI de config con tabs)
Paso 8  → Integrar en configuracion/page.tsx (sidebar + render)
Paso 9  → Integrar en webhook de WhatsApp (post-chatbot)
Paso 10 → API log + tab actividad en la UI
```

---

## 11. Referencias de Código Existente

Estos archivos ya existen y contienen patrones/helpers que se deben reutilizar:

- **Config IA (proveedor, API keys):** tabla `config_ia`, leída en `/api/inbox/ia/route.ts` línea 94-126
- **Helpers LLM:** `llamarAnthropic()` y `llamarOpenAI()` en `/api/inbox/ia/route.ts` línea 14-62 — extraer a `src/lib/agente-ia/` o reutilizar
- **Chatbot (patrón):** `procesarChatbot()` en `/api/inbox/whatsapp/webhook/route.ts` línea 781+
- **Config chatbot UI:** `SeccionChatbot` en `/inbox/configuracion/page.tsx` línea 1281+ — copiar patrón visual
- **Tipos inbox:** `src/tipos/inbox.ts` — agregar tipos ahí
- **Enviar WhatsApp:** `enviarTextoWhatsApp()` de `@/lib/whatsapp` — usar para modo automático
- **Componentes UI:** `Interruptor`, `Select`, `Input`, `Boton`, `Tarjeta`, `Insignia`, `Modal`, `EditorTexto`, `Alerta` de `@/componentes/ui/`
