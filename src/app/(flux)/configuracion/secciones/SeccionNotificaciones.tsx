'use client'

import { useState, useEffect, useCallback } from 'react'
import { BellRing } from 'lucide-react'
import { EncabezadoSeccion } from '@/componentes/ui/EncabezadoSeccion'
import { IndicadorGuardado } from '@/componentes/ui/IndicadorGuardado'
import { EditorHorarioNotificaciones, HORARIO_DEFAULT } from '@/componentes/entidad/EditorHorarioNotificaciones'
import { useEmpresa } from '@/hooks/useEmpresa'
import { useAutoguardado } from '@/hooks/useAutoguardado'
import { crearClienteNavegador } from '@/lib/supabase/cliente'
import type { HorarioNotificaciones } from '@/lib/notificaciones-horario'

/**
 * Configuración del horario de notificaciones por defecto de la empresa.
 * Aplica a todos los miembros que no tengan un override personal.
 */
export function SeccionNotificaciones() {
  const { empresa } = useEmpresa()
  const supabase = crearClienteNavegador()
  const [horario, setHorario] = useState<HorarioNotificaciones>(HORARIO_DEFAULT)

  const guardarEnServidor = useCallback(async (datos: Record<string, unknown>) => {
    const res = await fetch('/api/empresas/actualizar', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(datos),
    })
    return res.ok
  }, [])

  const { estado, puedeDeshacer, guardarInmediato, setSnapshot, deshacer } = useAutoguardado({ onGuardar: guardarEnServidor })

  useEffect(() => {
    if (!empresa) return
    let cancelado = false
    const cargar = async () => {
      const { data } = await supabase
        .from('empresas')
        .select('horario_notificaciones')
        .eq('id', empresa.id)
        .single()
      if (cancelado) return
      const cargado = (data?.horario_notificaciones as HorarioNotificaciones | null) || HORARIO_DEFAULT
      setHorario(cargado)
      setSnapshot({ horario_notificaciones: cargado })
    }
    cargar()
    return () => { cancelado = true }
  }, [empresa, supabase, setSnapshot])

  const aplicarCambio = (nuevo: HorarioNotificaciones) => {
    setHorario(nuevo)
    guardarInmediato({ horario_notificaciones: nuevo })
  }

  return (
    <div className="space-y-6">
      <EncabezadoSeccion
        titulo="Notificaciones"
        descripcion="Define cuándo el sistema puede mandar push de notificaciones diferidas a los miembros. Mensajes entrantes de clientes (WhatsApp, correo, portal) siempre pasan."
        accion={
          <IndicadorGuardado
            estado={estado}
            puedeDeshacer={puedeDeshacer}
            onDeshacer={async () => {
              const restaurados = await deshacer()
              if (restaurados && 'horario_notificaciones' in restaurados) {
                setHorario(restaurados.horario_notificaciones as HorarioNotificaciones)
              }
            }}
          />
        }
      />

      <div className="border border-white/[0.06] rounded-card overflow-hidden">
        <div className="px-6 py-5">
          <div className="flex items-start gap-3 mb-4">
            <div className="size-8 rounded-card flex items-center justify-center shrink-0" style={{ background: 'rgba(74,144,226,0.15)' }}>
              <BellRing size={15} style={{ color: '#4A90E2' }} />
            </div>
            <div>
              <h3 className="text-[13px] font-medium text-texto-primario">Horario laboral por defecto</h3>
              <p className="text-[11px] text-texto-terciario mt-0.5">
                Las notificaciones diferidas (actividades vencidas, recordatorios, asignaciones internas, recordatorios de calendario) solo suenan dentro de este horario, calculado en la zona horaria de la empresa. Cada miembro puede sobrescribir este default desde su perfil.
              </p>
            </div>
          </div>
          <EditorHorarioNotificaciones valor={horario} onChange={aplicarCambio} />
        </div>
      </div>
    </div>
  )
}
