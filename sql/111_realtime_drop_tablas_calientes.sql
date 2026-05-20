-- 111_realtime_drop_tablas_calientes.sql
--
-- Saca de la publicación `supabase_realtime` las tablas con muchos writes
-- que estaban saturando la replicación lógica.
--
-- Contexto (incidente 2026-05-20): pg_stat_statements mostraba 87.7% del
-- tiempo total de Postgres consumido por la query interna de Realtime
-- que escanea el WAL (`SELECT wal->>... FROM ...`). Total: 4M+ ejecuciones
-- desde el último reset. Con compute t4g.nano (free tier) la base entera
-- quedaba `Unhealthy`, Auth no podía dial-tcp a Postgres y el middleware
-- de Next tiraba 504 MIDDLEWARE_INVOCATION_TIMEOUT.
--
-- Writes acumulados que disparaban WAL events:
--   - notificaciones:    20.681 writes (sobre 383 filas → ~54x cada una)
--   - conversaciones:    14.037 writes (sobre 277 filas → ~50x cada una)
--   - mensajes:           2.519 writes
--   - mensaje_adjuntos:   1.006 writes
--
-- Continúa la línea de mitigación del PR #79 (sql/109_fixes_criticos_supabase.sql)
-- que ya había sacado `miembros` y `chatter` por el mismo motivo.
--
-- Impacto en UX (aceptado):
--   - Notificaciones nuevas (campana) ya no llegan instantáneas; aparecen
--     en el próximo heartbeat de 60s (`useNotificaciones` con
--     INTERVALO_HEARTBEAT) o al recargar.
--   - Mensajes nuevos en Inbox/WhatsApp → llegan al próximo polling de 30s
--     (`useEstadoInbox` / `useEstadoWhatsApp` con INTERVALO_POLLING).
--
-- Si en el futuro se reintroduce alguna tabla en Realtime, hacerlo SIEMPRE
-- con filtros estrictos por usuario/empresa para que el escaneo del WAL
-- por suscripción sea acotado.
ALTER PUBLICATION supabase_realtime DROP TABLE public.notificaciones;
ALTER PUBLICATION supabase_realtime DROP TABLE public.conversaciones;
ALTER PUBLICATION supabase_realtime DROP TABLE public.mensajes;
ALTER PUBLICATION supabase_realtime DROP TABLE public.mensaje_adjuntos;
