/**
 * Barrel export de clientes Supabase.
 * Cada cliente tiene un uso específico:
 * - crearClienteNavegador: componentes 'use client'
 * - crearClienteServidor: Server Components y Route Handlers
 * - crearClienteMiddleware: middleware de Next.js
 * - crearClienteAdmin: operaciones privilegiadas (solo servidor)
 */
export { crearClienteNavegador } from './cliente'
export { crearClienteServidor, obtenerUsuarioRuta } from './servidor'
export { crearClienteMiddleware } from './middleware'
export { crearClienteAdmin } from './admin'
