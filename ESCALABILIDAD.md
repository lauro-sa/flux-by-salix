# Escalabilidad — Flux by Salix

Notas técnicas sobre decisiones, límites y optimizaciones a tener en cuenta a medida que el sistema crece.

---

## Vercel Pro (migrado 2026-04-01)

### Límites actuales del plan
- **Funciones:** hasta 800s con Fluid Compute (usamos 60-120s según ruta)
- **Invocaciones incluidas:** 1M/mes
- **Crons:** sin restricción de frecuencia (Hobby solo permitía diarios)
- **Logs:** retención 24h (Hobby era 1h)
- **Bandwidth:** 1TB/mes incluido

### Crons configurados

| Cron | Frecuencia | Notas |
|---|---|---|
| `sincronizar-correo` | Cada 3 min | Sincroniza Gmail OAuth e IMAP. Escala linealmente con cantidad de canales |
| `enviar-programados` | Cada 1 min | Envía correos programados pendientes |
| `recordatorios` | Cada 5 min | Evalúa recordatorios vencidos |
| `actividades-vencimientos` | Diario 8:00 UTC | Notifica actividades vencidas |
| `cumpleanios` | Diario 9:00 UTC | Notifica cumpleaños del día |
| `limpiar-adjuntos` | Diario 3:00 UTC | Limpia adjuntos huérfanos |
| `limpiar-notificaciones` | Diario 5:00 UTC | Borra notificaciones antiguas |

### Proyección de invocaciones (solo sync correo)

| Empresas | Canales/empresa | Invocaciones/mes (sync correo) |
|---|---|---|
| 10 | 2 | ~288K |
| 50 | 2 | ~1.4M (supera incluido) |
| 100 | 3 | ~4.3M |

---

## Optimizaciones pendientes para escalar

### 1. Sync inteligente de correo
**Problema:** El cron sincroniza TODOS los canales cada 3 min, sin importar si alguien está usando el inbox.
**Solución:** Solo sincronizar canales de empresas con usuarios activos (sesión en últimas 2h). El resto, cada 15-30 min.
**Cuándo:** Cuando supere ~50 canales activos.

### 2. Gmail Push Notifications
**Problema:** Para canales Gmail OAuth, el polling cada 3 min tiene latencia innecesaria.
**Solución:** Usar Google Cloud Pub/Sub (gratis) para recibir push instantáneo. El cron queda como fallback.
**Cuándo:** Cuando haya demanda de correo en tiempo real para Gmail.
**No aplica a:** Canales IMAP (Hostinger, etc.) — IMAP no tiene push nativo en serverless.

### 3. IMAP IDLE (correo instantáneo para cualquier proveedor)
**Problema:** IMAP requiere conexión persistente para push, incompatible con serverless.
**Solución:** Servidor persistente dedicado (ej: un worker en Fly.io o Railway) que mantenga IMAP IDLE y llame al webhook de Flux.
**Cuándo:** Solo si la latencia de 3 min es inaceptable para clientes con IMAP.

### 4. Cola de trabajos pesados
**Problema:** Importaciones grandes, sync de Google Drive, y pipeline de agente IA pueden exceder timeouts.
**Solución:** Mover a una cola (ej: Vercel Workflow, Inngest, o Trigger.dev) con reintentos y progreso visible.
**Cuándo:** Cuando un cliente intente importar >10K contactos o el agente IA tenga pipelines complejos.

### 5. Rate limits por empresa
**Problema:** Una empresa hiperactiva podría consumir recursos desproporcionados.
**Solución:** Implementar rate limiting por empresa_id en rutas pesadas (sync, envío masivo, agente IA).
**Cuándo:** Cuando haya +20 empresas activas.

---

## maxDuration por ruta

Configurados en `vercel.json`. Si una ruta falla por timeout, se puede subir hasta 800s.

| Ruta | maxDuration | Razón |
|---|---|---|
| WhatsApp webhook | 120s | Descarga media + agente IA |
| Sincronizar correo | 120s | Múltiples canales IMAP/Gmail |
| Agente IA ejecutar | 120s | Llamadas LLM multi-paso |
| Asistente presupuestos | 120s | Llamada a Claude API |
| Importar contactos | 120s | Excel grande + upserts masivos |
| Google Drive sync | 120s | Sync sheets múltiples módulos |
| Exportar contactos | 60s | Generación Excel |
| Backup contactos | 60s | JSON dump |
| Importar base conocimiento | 60s | Parsing PDF |
