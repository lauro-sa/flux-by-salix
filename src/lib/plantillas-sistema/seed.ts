/**
 * seed.ts — Crea las plantillas de sistema para una empresa.
 *
 * Se ejecuta al crear una empresa nueva (onboarding) y también
 * se puede invocar manualmente para empresas existentes.
 *
 * Se usa en: POST /api/empresas/crear, migración de datos.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import { PLANTILLAS_SISTEMA } from './definiciones'

/**
 * Crea las plantillas de sistema para una empresa.
 * Si alguna clave ya existe, la omite (upsert seguro).
 */
export async function crearPlantillasSistema(
  admin: SupabaseClient,
  empresaId: string,
  creadoPor: string,
): Promise<void> {
  // Verificar cuáles ya existen para esta empresa
  const { data: existentes } = await admin
    .from('plantillas_correo')
    .select('clave_sistema')
    .eq('empresa_id', empresaId)
    .eq('es_sistema', true)

  const clavesExistentes = new Set(
    (existentes || []).map((p: { clave_sistema: string }) => p.clave_sistema),
  )

  // Filtrar solo las que no existen
  const nuevas = PLANTILLAS_SISTEMA.filter(p => !clavesExistentes.has(p.clave))

  if (nuevas.length === 0) return

  const registros = nuevas.map(p => ({
    empresa_id: empresaId,
    nombre: p.nombre,
    categoria: p.categoria,
    asunto: p.asunto,
    contenido: p.contenido_html.replace(/<[^>]*>/g, '').trim(),
    contenido_html: p.contenido_html,
    contenido_original_html: p.contenido_html,
    asunto_original: p.asunto,
    es_sistema: true,
    clave_sistema: `${empresaId}_${p.clave}`,
    modulos: p.modulos,
    disponible_para: 'todos',
    activo: true,
    orden: p.orden,
    creado_por: creadoPor,
  }))

  const { error } = await admin
    .from('plantillas_correo')
    .insert(registros)

  if (error) {
    console.error('Error al crear plantillas de sistema:', error)
  }
}
