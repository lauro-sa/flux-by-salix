-- Agrega canal_login a miembros: 'empresa' | 'personal'
-- Determina cuál de los dos correos del perfil (correo / correo_empresa) se usa
-- como email de auth.users (login). Cuando cambia, un endpoint admin sincroniza
-- auth.users.email con el campo correspondiente del perfil.
-- Default 'empresa' (nuevo estándar — emails laborales para login).

ALTER TABLE miembros
  ADD COLUMN IF NOT EXISTS canal_login text NOT NULL DEFAULT 'empresa';

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'miembros_canal_login_check') THEN
    ALTER TABLE miembros ADD CONSTRAINT miembros_canal_login_check
      CHECK (canal_login IN ('empresa','personal'));
  END IF;
END $$;
