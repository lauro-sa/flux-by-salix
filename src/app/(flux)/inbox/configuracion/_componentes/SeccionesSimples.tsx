'use client'

import { useState, useEffect, useCallback } from 'react'
import { Boton } from '@/componentes/ui/Boton'
import { ModalConfirmacion } from '@/componentes/ui/ModalConfirmacion'
import { ListaConfiguracion, type ItemLista } from '@/componentes/ui/ListaConfiguracion'
import { ModalItemConfiguracion } from '@/componentes/ui/ModalItemConfiguracion'
import { Mail, Zap, Plus } from 'lucide-react'
import { IconoWhatsApp } from '@/componentes/iconos/IconoWhatsApp'
import { SeccionEtapas } from '../../_componentes/SeccionEtapas'
import { ModalReglas } from '../../_componentes/ModalReglas'
import { PanelMetricas } from '../../_componentes/PanelMetricas'
import { ListaProgramados } from '../../_componentes/ListaProgramados'
import { useTraduccion } from '@/lib/i18n'
import { useToast } from '@/componentes/feedback/Toast'
import { COLOR_ETIQUETA_DEFECTO, PALETA_COLORES_ETIQUETA } from '@/lib/colores_entidad'
import type { EtiquetaInbox } from '@/tipos/inbox'

/**
 * Sección Pipeline — tabs de WhatsApp y Correo con etapas drag-and-drop.
 * Se usa en la configuración del inbox cuando la sección activa es "pipeline".
 */
export function SeccionPipeline() {
  const [tabCanal, setTabCanal] = useState<'whatsapp' | 'correo'>('whatsapp')

  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-sm font-semibold text-texto-primario">
          Pipeline / Etapas
        </h3>
        <p className="text-xs mt-1 mb-4 text-texto-terciario">
          Definí las etapas por las que pasan tus conversaciones en cada canal. Podés personalizar nombres, colores e íconos, y ver las conversaciones organizadas en vista pipeline desde el inbox.
        </p>
      </div>

      {/* Tabs WhatsApp / Correo */}
      <div
        className="flex gap-1 p-1 rounded-lg w-fit"
        style={{ background: 'var(--superficie-hover)' }}
      >
        <button
          onClick={() => setTabCanal('whatsapp')}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all"
          style={{
            background: tabCanal === 'whatsapp' ? 'var(--superficie-tarjeta)' : 'transparent',
            color: tabCanal === 'whatsapp' ? 'var(--texto-primario)' : 'var(--texto-terciario)',
            boxShadow: tabCanal === 'whatsapp' ? '0 1px 2px rgba(0,0,0,0.1)' : 'none',
          }}
        >
          <IconoWhatsApp size={14} />
          WhatsApp
        </button>
        <button
          onClick={() => setTabCanal('correo')}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all"
          style={{
            background: tabCanal === 'correo' ? 'var(--superficie-tarjeta)' : 'transparent',
            color: tabCanal === 'correo' ? 'var(--texto-primario)' : 'var(--texto-terciario)',
            boxShadow: tabCanal === 'correo' ? '0 1px 2px rgba(0,0,0,0.1)' : 'none',
          }}
        >
          <Mail size={14} />
          Correo
        </button>
      </div>

      <SeccionEtapas tipoCanal={tabCanal} key={tabCanal} />
    </div>
  )
}

/**
 * Sección de Etiquetas en config — usa ListaConfiguracion unificada.
 */
export function SeccionEtiquetasConfig() {
  const { mostrar } = useToast()
  const [etiquetas, setEtiquetas] = useState<EtiquetaInbox[]>([])
  const [cargando, setCargando] = useState(true)
  const [confirmarEliminar, setConfirmarEliminar] = useState<string | null>(null)
  const [confirmarRestablecer, setConfirmarRestablecer] = useState(false)
  const [restaurando, setRestaurando] = useState(false)

  // Modal crear/editar
  const [modalAbierto, setModalAbierto] = useState(false)
  const [editandoEtiqueta, setEditandoEtiqueta] = useState<EtiquetaInbox | null>(null)

  const cargar = useCallback(async () => {
    setCargando(true)
    try {
      const res = await fetch('/api/inbox/etiquetas')
      const data = await res.json()
      setEtiquetas(data.etiquetas || [])
    } catch { mostrar('error', 'Error al cargar etiquetas') }
    setCargando(false)
  }, [mostrar])

  useEffect(() => { cargar() }, [cargar])

  const handleCrear2 = async (nombreParam: string, colorParam: string) => {
    try {
      const res = await fetch('/api/inbox/etiquetas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nombre: nombreParam, color: colorParam }),
      })
      if (res.ok) {
        cargar()
        mostrar('exito', 'Etiqueta creada')
      }
    } catch { mostrar('error', 'Error al crear etiqueta') }
  }

  const handleEliminar = async (id: string) => {
    try {
      await fetch(`/api/inbox/etiquetas?id=${id}`, { method: 'DELETE' })
      cargar()
      mostrar('exito', 'Etiqueta eliminada')
    } catch { mostrar('error', 'Error al eliminar etiqueta') }
  }

  const handleReordenar = async (idsOrdenados: string[]) => {
    const mapa = new Map(etiquetas.map(e => [e.id, e]))
    const nuevas = idsOrdenados.map((id, i) => ({ ...mapa.get(id)!, orden: i }))
    setEtiquetas(nuevas)
    try {
      await Promise.all(nuevas.map((e, i) =>
        fetch(`/api/inbox/etiquetas?id=${e.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ orden: i }),
        })
      ))
    } catch { mostrar('error', 'Error al reordenar') }
  }

  const handleRestablecer = async () => {
    setRestaurando(true)
    try {
      const res = await fetch('/api/inbox/etiquetas', { method: 'PUT' })
      const data = await res.json()
      if (data.etiquetas) {
        setEtiquetas(data.etiquetas)
        mostrar('exito', 'Etiquetas restablecidas')
      }
      setConfirmarRestablecer(false)
    } catch { mostrar('error', 'Error al restablecer') }
    setRestaurando(false)
  }

  const itemsLista: ItemLista[] = etiquetas.map(et => ({
    id: et.id,
    nombre: et.nombre,
    color: et.color,
  }))

  return (
    <div className="space-y-4">
      <ListaConfiguracion
        titulo="Etiquetas"
        descripcion="Arrastrá para reordenar. Este orden se refleja en los selectores de toda la app."
        items={itemsLista}
        controles="editar-borrar"
        ordenable
        acciones={[{
          tipo: 'fantasma',
          icono: <Plus size={16} />,
          soloIcono: true,
          titulo: 'Nueva etiqueta',
          onClick: () => { setEditandoEtiqueta(null); setModalAbierto(true) },
        }]}
        onEditar={(item) => {
          const et = etiquetas.find(e => e.id === item.id)
          if (et) { setEditandoEtiqueta(et); setModalAbierto(true) }
        }}
        onEliminar={(item) => setConfirmarEliminar(item.id)}
        onReordenar={handleReordenar}
        restaurable
        onRestaurar={() => setConfirmarRestablecer(true)}
      />

      {/* Modal crear/editar etiqueta */}
      <ModalItemConfiguracion
        abierto={modalAbierto}
        onCerrar={() => { setModalAbierto(false); setEditandoEtiqueta(null) }}
        titulo={editandoEtiqueta ? 'Editar etiqueta' : 'Nueva etiqueta'}
        campos={[
          { tipo: 'texto', clave: 'nombre', etiqueta: 'Nombre', placeholder: 'Nombre de la etiqueta...' },
          { tipo: 'color', clave: 'color', etiqueta: 'Color', colores: PALETA_COLORES_ETIQUETA.map(c => ({ valor: c, etiqueta: c })) },
        ]}
        valores={editandoEtiqueta ? { nombre: editandoEtiqueta.nombre, color: editandoEtiqueta.color } : undefined}
        onGuardar={async (valores) => {
          const nombre = String(valores.nombre || '').trim()
          const color = String(valores.color || COLOR_ETIQUETA_DEFECTO)
          if (!nombre) return
          if (editandoEtiqueta) {
            try {
              await fetch(`/api/inbox/etiquetas?id=${editandoEtiqueta.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ nombre, color }),
              })
              cargar()
              mostrar('exito', 'Etiqueta actualizada')
            } catch { mostrar('error', 'Error al editar etiqueta') }
          } else {
            await handleCrear2(nombre, color)
          }
          setModalAbierto(false)
          setEditandoEtiqueta(null)
        }}
      />

      {/* Confirmar eliminar */}
      <ModalConfirmacion
        abierto={!!confirmarEliminar}
        titulo="Eliminar etiqueta"
        descripcion={`Se eliminará "${etiquetas.find(e => e.id === confirmarEliminar)?.nombre || ''}". Las conversaciones con esta etiqueta la perderán.`}
        etiquetaConfirmar="Eliminar"
        tipo="peligro"
        onConfirmar={async () => {
          if (confirmarEliminar) {
            await handleEliminar(confirmarEliminar)
            setConfirmarEliminar(null)
          }
        }}
        onCerrar={() => setConfirmarEliminar(null)}
      />

      {/* Confirmar restablecer */}
      <ModalConfirmacion
        abierto={confirmarRestablecer}
        titulo="Restablecer etiquetas"
        descripcion="Se eliminarán las etiquetas personalizadas y se restablecerán las predefinidas."
        etiquetaConfirmar="Restablecer"
        tipo="peligro"
        cargando={restaurando}
        onConfirmar={handleRestablecer}
        onCerrar={() => setConfirmarRestablecer(false)}
      />
    </div>
  )
}

/**
 * Sección de Reglas automáticas en config — botón que abre ModalReglas.
 */
export function SeccionReglasConfig() {
  const [modalAbierto, setModalAbierto] = useState(false)

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-semibold text-texto-primario">
          Reglas automáticas
        </h3>
        <p className="text-xs mt-1 text-texto-terciario">
          Clasificá correos automáticamente según remitente, asunto o contenido. Las reglas se ejecutan al recibir cada correo nuevo.
        </p>
      </div>

      <Boton variante="primario" tamano="sm" icono={<Zap size={14} />} onClick={() => setModalAbierto(true)}>
        Gestionar reglas
      </Boton>

      <ModalReglas
        abierto={modalAbierto}
        onCerrar={() => setModalAbierto(false)}
      />
    </div>
  )
}

/**
 * Sección de Métricas en config — panel de métricas + lista de programados.
 */
export function SeccionMetricasConfig() {
  return (
    <div className="space-y-4">
      <PanelMetricas />

      <div className="pt-4 border-t border-white/[0.07]">
        <ListaProgramados />
      </div>
    </div>
  )
}
