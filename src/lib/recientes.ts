import { crearClienteAdmin } from '@/lib/supabase/admin'

/**
 * registrarReciente — Guarda o actualiza una entrada en historial_recientes.
 * Usa upsert: si la entidad ya existe para ese usuario, actualiza accedido_en y título.
 * Se ejecuta fire-and-forget para no bloquear la respuesta.
 */
export function registrarReciente({
  empresaId,
  usuarioId,
  tipoEntidad,
  entidadId,
  titulo,
  subtitulo,
  accion = 'visto',
}: {
  empresaId: string
  usuarioId: string
  tipoEntidad: 'contacto' | 'presupuesto' | 'actividad' | 'producto' | 'documento' | 'conversacion' | 'evento' | 'miembro'
  entidadId: string
  titulo: string
  subtitulo?: string
  accion?: 'visto' | 'editado' | 'creado' | 'eliminado'
}) {
  // Fire-and-forget: no bloqueamos la response del API route
  const admin = crearClienteAdmin()
  admin
    .from('historial_recientes')
    .upsert(
      {
        empresa_id: empresaId,
        usuario_id: usuarioId,
        tipo_entidad: tipoEntidad,
        entidad_id: entidadId,
        titulo,
        subtitulo: subtitulo || null,
        accion,
        accedido_en: new Date().toISOString(),
      },
      { onConflict: 'empresa_id,usuario_id,tipo_entidad,entidad_id' }
    )
    .then(({ error }) => {
      if (error) console.error('[recientes] Error registrando:', error.message)
    })
}
