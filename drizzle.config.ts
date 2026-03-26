import { defineConfig } from 'drizzle-kit'

/**
 * Configuración de Drizzle Kit — genera y aplica migraciones.
 * Conecta al PostgreSQL de Supabase via DATABASE_URL.
 */
export default defineConfig({
  schema: './src/db/esquema.ts',
  out: './src/db/migraciones',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
})
