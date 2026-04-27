/**
 * Schemas Zod para validar payloads de pagos de presupuesto en POST/PATCH.
 *
 * Centraliza las reglas de validación que antes estaban dispersas en cada
 * endpoint:
 *   - monto > 0
 *   - monto_percepciones >= 0 y <= monto (en moneda original)
 *   - es_adicional=true ⇒ cuota_id null
 *   - cotizacion_cambio > 0
 *   - método válido
 *   - fecha_pago no más de 24h en el futuro
 *
 * NO valida cosas que dependen de la BD (moneda contra config_presupuestos,
 * cuota_id pertenece al presupuesto, OT pertenece al presupuesto, etc.):
 * eso vive en el endpoint con queries.
 */

import { z } from 'zod'
import type { MetodoPago } from '@/tipos/presupuesto-pago'

const METODOS_VALIDOS = [
  'efectivo',
  'transferencia',
  'cheque',
  'tarjeta',
  'deposito',
  'otro',
] as const satisfies readonly MetodoPago[]

const MAX_FUTURO_MS = 24 * 60 * 60 * 1000 // 1 día de tolerancia

/** Devuelve true si una fecha ISO no está más de 24h en el futuro. */
function fechaNoFutura(iso: string): boolean {
  const ts = new Date(iso).getTime()
  if (!Number.isFinite(ts)) return false
  return ts <= Date.now() + MAX_FUTURO_MS
}

/** Schema base reutilizable: chequea coherencia entre monto y percepciones,
 *  y entre es_adicional y cuota_id. Aplica a POST y PATCH (con campos opcionales). */
const baseRefine = (val: {
  monto?: number | null
  monto_percepciones?: number | null
  es_adicional?: boolean | null
  cuota_id?: string | null
}) => {
  // monto_percepciones <= monto (en moneda original, si ambos vienen)
  if (
    val.monto != null &&
    val.monto_percepciones != null &&
    val.monto_percepciones > val.monto
  ) {
    return false
  }
  // es_adicional=true ⇒ cuota_id debe ser null
  if (val.es_adicional === true && val.cuota_id) return false
  return true
}
const baseRefineMsg = 'Datos inconsistentes: percepciones > monto, o adicional con cuota'

export const CrearPagoSchema = z
  .object({
    monto: z.number().positive('El monto debe ser positivo'),
    monto_percepciones: z.number().nonnegative().optional().default(0),
    moneda: z.string().min(1).max(10).optional(),
    cotizacion_cambio: z.number().positive().optional(),
    cuota_id: z.string().nullable().optional(),
    orden_trabajo_id: z.string().uuid().nullable().optional(),
    fecha_pago: z
      .string()
      .refine((s) => !Number.isNaN(new Date(s).getTime()), 'Fecha inválida')
      .refine(fechaNoFutura, 'La fecha del pago no puede ser futura')
      .optional(),
    metodo: z.enum(METODOS_VALIDOS).optional(),
    referencia: z.string().nullable().optional(),
    descripcion: z.string().nullable().optional(),
    es_adicional: z.boolean().optional(),
    concepto_adicional: z.string().nullable().optional(),
    chatter_origen_id: z.string().uuid().nullable().optional(),
    mensaje_origen_id: z.string().uuid().nullable().optional(),
  })
  .refine(baseRefine, { message: baseRefineMsg })

export const EditarPagoSchema = z
  .object({
    monto: z.number().positive().optional(),
    monto_percepciones: z.number().nonnegative().optional(),
    moneda: z.string().min(1).max(10).optional(),
    cotizacion_cambio: z.number().positive().optional(),
    cuota_id: z.string().nullable().optional(),
    orden_trabajo_id: z.string().uuid().nullable().optional(),
    fecha_pago: z
      .string()
      .refine((s) => !Number.isNaN(new Date(s).getTime()), 'Fecha inválida')
      .refine(fechaNoFutura, 'La fecha del pago no puede ser futura')
      .optional(),
    metodo: z.enum(METODOS_VALIDOS).optional(),
    referencia: z.string().nullable().optional(),
    descripcion: z.string().nullable().optional(),
    es_adicional: z.boolean().optional(),
    concepto_adicional: z.string().nullable().optional(),
  })
  .refine(baseRefine, { message: baseRefineMsg })

export type CrearPagoInput = z.infer<typeof CrearPagoSchema>
export type EditarPagoInput = z.infer<typeof EditarPagoSchema>

/**
 * Helper para usar en route handlers. Devuelve los datos parseados o un
 * NextResponse con 400 si falla. Cuando falla, incluye `detalles` con los
 * issues de zod para debug.
 */
export function parsearPago<S extends typeof CrearPagoSchema | typeof EditarPagoSchema>(
  schema: S,
  datos: unknown
): { ok: true; datos: z.infer<S> } | { ok: false; error: string; detalles: z.ZodIssue[] } {
  const r = schema.safeParse(datos)
  if (r.success) return { ok: true, datos: r.data as z.infer<S> }
  const primer = r.error.issues[0]
  return {
    ok: false,
    error: primer?.message || 'Datos inválidos',
    detalles: r.error.issues,
  }
}
