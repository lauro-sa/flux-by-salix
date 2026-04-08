import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as esquema from './esquema'

/**
 * Cliente Drizzle ORM — conexión directa a PostgreSQL de Supabase.
 * Se usa en API routes para queries tipadas.
 * Nota: usar solo en el servidor (Route Handlers, Server Components).
 */
const conexionString = process.env.DATABASE_URL!

const cliente = postgres(conexionString, {
  max: 20,
  idle_timeout: 30,
  connect_timeout: 10,
  prepare: true,
})
export const db = drizzle(cliente, { schema: esquema })

export { esquema }
