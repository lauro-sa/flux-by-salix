/**
 * Wrapper de compatibilidad — DEPRECADO.
 *
 * El endpoint canónico es `/api/nominas`. Este archivo existe solo
 * para que clientes externos (mobile, integraciones, links viejos)
 * que apunten a `/api/asistencias/nomina` sigan funcionando durante
 * la transición. Se elimina cuando ningún consumidor lo use.
 *
 * Plan: ver PR 4 en PLAN_MODULO_NOMINAS.md.
 */
export { GET } from '@/app/api/nominas/route'
