-- =============================================================
-- Migración: Integración Google Drive para Flux by Salix
-- Tabla: configuracion_google_drive
-- Almacena tokens, configuración de sync y estado por empresa
-- =============================================================

CREATE TABLE IF NOT EXISTS public.configuracion_google_drive (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,

  -- Estado de conexión
  conectado boolean NOT NULL DEFAULT false,
  email text,                              -- email de la cuenta Google conectada

  -- Tokens OAuth (el refresh_token se encripta en la app)
  refresh_token text,
  access_token text,
  token_expira_en timestamptz,

  -- Configuración de sincronización
  frecuencia_horas integer NOT NULL DEFAULT 24,  -- cada cuántas horas sincronizar
  modulos_activos text[] NOT NULL DEFAULT ARRAY['contactos']::text[],

  -- Referencias a Google Drive
  folder_id text,                          -- ID de la carpeta en Drive
  hojas jsonb NOT NULL DEFAULT '{}'::jsonb, -- { contactos: { spreadsheet_id, url, nombre }, ... }

  -- Estado de la última sincronización
  ultima_sync timestamptz,
  ultimo_error text,
  resumen jsonb NOT NULL DEFAULT '{}'::jsonb, -- { contactos: 487, presupuestos: 152, ... }

  -- Auditoría
  conectado_por uuid REFERENCES auth.users(id),
  creado_en timestamptz NOT NULL DEFAULT now(),
  actualizado_en timestamptz NOT NULL DEFAULT now(),

  UNIQUE(empresa_id)
);

CREATE INDEX IF NOT EXISTS config_gdrive_empresa_idx ON public.configuracion_google_drive(empresa_id);

-- RLS: solo miembros de la empresa pueden ver/editar
ALTER TABLE public.configuracion_google_drive ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Miembros de empresa pueden ver config Google Drive"
  ON public.configuracion_google_drive FOR SELECT
  USING (empresa_id = (auth.jwt() ->> 'empresa_activa_id')::uuid);

CREATE POLICY "Admins pueden modificar config Google Drive"
  ON public.configuracion_google_drive FOR ALL
  USING (empresa_id = (auth.jwt() ->> 'empresa_activa_id')::uuid)
  WITH CHECK (empresa_id = (auth.jwt() ->> 'empresa_activa_id')::uuid);
