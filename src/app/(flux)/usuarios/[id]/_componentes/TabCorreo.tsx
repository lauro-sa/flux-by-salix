'use client'

/**
 * TabCorreo — Bandejas personales del usuario.
 * Solo propietario/admin/config_correo:editar puede conectar desde acá
 * (asumido por el guard de `/usuarios/[id]` — esta tab solo se muestra si puedeEditar).
 *
 * Las bandejas compartidas de equipo (ventas@, soporte@) NO se muestran acá:
 * viven en /inbox/configuracion. Solo listamos las del usuario (propietario_usuario_id = user.id).
 */

import { useState, useEffect, useCallback } from 'react'
import { Plus, Mail } from 'lucide-react'
import { Boton } from '@/componentes/ui/Boton'
import { EstadoVacio } from '@/componentes/feedback/EstadoVacio'
import { ModalAgregarCanal } from '@/componentes/mensajeria/ModalAgregarCanal'
import { CanalCard } from '@/app/(flux)/inbox/configuracion/_componentes/CanalCard'
import type { CanalMensajeria } from '@/tipos/inbox'

interface PropsTabCorreo {
  usuarioId: string
  nombreUsuario: string
  puedeEditar: boolean
}

export function TabCorreo({ usuarioId, nombreUsuario, puedeEditar }: PropsTabCorreo) {
  const [canales, setCanales] = useState<CanalMensajeria[]>([])
  const [cargando, setCargando] = useState(true)
  const [modalAbierto, setModalAbierto] = useState(false)

  const cargar = useCallback(async () => {
    setCargando(true)
    try {
      const res = await fetch(`/api/correo/canales?propietario=${usuarioId}`)
      const data = await res.json()
      setCanales(data.canales || [])
    } catch {
      // silenciar
    } finally {
      setCargando(false)
    }
  }, [usuarioId])

  useEffect(() => { cargar() }, [cargar])

  return (
    <section className="space-y-4">
      {/* Encabezado */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <div className="flex items-center gap-2">
            <Mail size={18} className="text-texto-marca" />
            <h3 className="text-base font-semibold text-texto-primario">Bandejas personales</h3>
          </div>
          <p className="text-xs text-texto-terciario mt-1 max-w-2xl leading-relaxed">
            Correos asignados a <span className="font-medium text-texto-secundario">{nombreUsuario}</span>.
            Solo esta persona los ve en su inbox. Las bandejas compartidas del equipo
            (ventas@, soporte@) se configuran desde Inbox → Configuración.
          </p>
        </div>
        {puedeEditar && (
          <Boton
            variante="primario"
            tamano="sm"
            icono={<Plus size={14} />}
            onClick={() => setModalAbierto(true)}
          >
            Conectar correo
          </Boton>
        )}
      </div>

      {/* Lista */}
      {cargando ? (
        <div className="text-xs py-8 text-center text-texto-terciario">Cargando…</div>
      ) : canales.length === 0 ? (
        <EstadoVacio
          icono={<Mail />}
          titulo="Sin bandejas conectadas"
          descripcion={
            puedeEditar
              ? `Conectá una cuenta de correo para ${nombreUsuario}. Va a aparecer en su inbox apenas quede conectada.`
              : 'No hay bandejas personales conectadas.'
          }
        />
      ) : (
        <div className="space-y-3">
          {canales.map(canal => (
            <CanalCard key={canal.id} canal={canal} onRecargar={cargar} />
          ))}
        </div>
      )}

      {/* Modal conectar — pasa propietarioUsuarioId para que quede como bandeja personal */}
      {modalAbierto && (
        <ModalAgregarCanal
          abierto={modalAbierto}
          onCerrar={() => setModalAbierto(false)}
          tipoCanal="correo"
          onCanalCreado={() => { setModalAbierto(false); cargar() }}
          propietarioUsuarioId={usuarioId}
        />
      )}
    </section>
  )
}
