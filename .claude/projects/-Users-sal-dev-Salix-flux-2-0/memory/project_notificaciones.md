---
name: Sistema de notificaciones
description: Arquitectura de notificaciones: 3 íconos en header (inbox, actividades, sistema), popovers, modo concentración, push PWA
type: project
---

## Decisión de diseño: 3 íconos en el header

Se descartó la bandeja unificada (1 campana) en favor de **3 íconos separados** en el header, cada uno con su Popover:

1. **✉ Sobre (Inbox)** → correos, WhatsApp, mensajes internos, menciones
2. **☑ Clipboard (Actividades)** → asignaciones, vencimientos, recordatorios, calendario
3. **🔔 Campana (Sistema)** → portal (documento visto/aceptado/rechazado), cumpleaños, anuncios, actualizaciones de Flux

**Why:** Permite al usuario saber de un vistazo *qué tipo* de cosa le espera sin tener que abrir nada. Patrón similar a Odoo y Slack.

**How to apply:** Cada ícono abre un Popover (no drawer lateral), panel flotante anclado al ícono, ancho y cómodo, con buen scroll.

## Funcionalidades pendientes

- **Modo concentración / silenciar**: botón "No molestar" que silencia por tiempo (30 min, 1h, 2h, hasta mañana, personalizado). Puede silenciar por categoría. Badge visual diferente (campana con rayita mute). Notificaciones se siguen acumulando pero no se muestran ni suenan.
- **Push notifications PWA**: Web Push API + edge function. Respetan modo concentración. Configurables por tipo en Mi Cuenta.
- **Configuración por usuario**: checkboxes por tipo (in-app, push, sonido) en Mi Cuenta > Notificaciones.
- **Anti-duplicación**: si ya hay notificación no leída con mismo referencia_tipo+referencia_id, se actualiza timestamp en vez de crear otra.
- **Cleanup automático**: cron que borra descartadas >30 días y cualquiera >90 días.
