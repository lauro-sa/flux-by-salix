-- Migración: canal de notificación por correo/teléfono y separación de Salix IA (web vs WhatsApp)
-- Fecha: 2026-04-21
--
-- Agrega a miembros:
--   canal_notif_correo   : 'empresa' | 'personal' — dónde reciben correos (nómina, recordatorios, etc.)
--   canal_notif_telefono : 'empresa' | 'personal' — dónde reciben WhatsApp (nómina, recordatorios, copilot IA)
--   salix_ia_web         : habilita Salix IA como asistente dentro de la app
--   salix_ia_whatsapp    : habilita Salix IA como copilot por WhatsApp
--
-- Reemplaza el toggle único `salix_ia_habilitado`. Se migra el valor actual a
-- ambos flags nuevos para mantener el comportamiento existente.

ALTER TABLE miembros
  ADD COLUMN IF NOT EXISTS canal_notif_correo text NOT NULL DEFAULT 'empresa',
  ADD COLUMN IF NOT EXISTS canal_notif_telefono text NOT NULL DEFAULT 'empresa',
  ADD COLUMN IF NOT EXISTS salix_ia_web boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS salix_ia_whatsapp boolean NOT NULL DEFAULT false;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'miembros_canal_notif_correo_check') THEN
    ALTER TABLE miembros ADD CONSTRAINT miembros_canal_notif_correo_check
      CHECK (canal_notif_correo IN ('empresa','personal'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'miembros_canal_notif_telefono_check') THEN
    ALTER TABLE miembros ADD CONSTRAINT miembros_canal_notif_telefono_check
      CHECK (canal_notif_telefono IN ('empresa','personal'));
  END IF;
END $$;

-- Migrar valor existente de salix_ia_habilitado a los dos nuevos flags
UPDATE miembros SET salix_ia_web = true, salix_ia_whatsapp = true
  WHERE salix_ia_habilitado = true
    AND salix_ia_web = false
    AND salix_ia_whatsapp = false;
