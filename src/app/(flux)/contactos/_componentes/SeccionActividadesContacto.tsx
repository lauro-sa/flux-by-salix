'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { PlusCircle, CheckCircle, Clock, ChevronDown, ChevronUp } from 'lucide-react'
import { obtenerIcono } from '@/componentes/ui/SelectorIcono'
import { Boton } from '@/componentes/ui/Boton'
import { ModalActividad } from '../../actividades/_componentes/ModalActividad'
import type { Actividad, Miembro } from '../../actividades/_componentes/ModalActividad'
import type { TipoActividad } from '../../actividades/configuracion/_tipos'
import type { EstadoActividad } from '../../actividades/configuracion/secciones/SeccionEstados'
import { crearClienteNavegador } from '@/lib/supabase/cliente'
import { useFormato } from '@/hooks/useFormato'
import { useModalVisita } from '@/hooks/useModalVisita'
import { ModalVisita } from '@/app/(flux)/visitas/_componentes/ModalVisita'

/**
 * SeccionActividadesContacto — Sección de actividades dentro de la ficha del contacto.
 * Muestra actividades pendientes y completadas vinculadas a este contacto.
 * Permite crear nuevas actividades pre-vinculadas.
 */

interface PropiedadesSeccion {
  contactoId: string
  contactoNombre: string
}

function SeccionActividadesContacto({ contactoId, contactoNombre }: PropiedadesSeccion) {
  const [actividades, setActividades] = useState<Actividad[]>([])
  const [tipos, setTipos] = useState<TipoActividad[]>([])
  const [estados, setEstados] = useState<EstadoActividad[]>([])
  const [miembros, setMiembros] = useState<Miembro[]>([])
  const [cargando, setCargando] = useState(true)
  const [modalAbierto, setModalAbierto] = useState(false)
  const [verCompletadas, setVerCompletadas] = useState(false)
  const modalVisitaHook = useModalVisita()

  // Cargar datos
  const cargar = useCallback(async () => {
    try {
      const [actRes, configRes, miembrosData] = await Promise.all([
        fetch(`/api/actividades?contacto_id=${contactoId}&por_pagina=50`).then(r => r.json()),
        fetch('/api/actividades/config').then(r => r.json()),
        (async () => {
          const supabase = crearClienteNavegador()
          const { data: { user } } = await supabase.auth.getUser()
          if (!user) return []
          const empresaId = user.app_metadata?.empresa_activa_id
          if (!empresaId) return []
          const { data: mRes } = await supabase.from('miembros').select('usuario_id').eq('empresa_id', empresaId).eq('activo', true)
          if (!mRes?.length) return []
          const { data: perfiles } = await supabase.from('perfiles').select('id, nombre, apellido').in('id', mRes.map(m => m.usuario_id))
          return (perfiles || []).map(p => ({ usuario_id: p.id, nombre: p.nombre, apellido: p.apellido }))
        })(),
      ])
      setActividades(actRes.actividades || [])
      setTipos(configRes.tipos || [])
      setEstados(configRes.estados || [])
      setMiembros(miembrosData)
    } catch {
      console.error('Error al cargar actividades del contacto')
    } finally {
      setCargando(false)
    }
  }, [contactoId])

  useEffect(() => { cargar() }, [cargar])

  // Crear actividad pre-vinculada a este contacto
  const crearActividad = async (datos: Record<string, unknown>) => {
    const res = await fetch('/api/actividades', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(datos),
    })
    if (!res.ok) throw new Error('Error al crear')
    cargar()
  }

  // Completar actividad
  const completar = async (id: string) => {
    await fetch(`/api/actividades/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accion: 'completar' }),
    })
    cargar()
  }

  // Posponer actividad
  const posponer = async (id: string) => {
    await fetch(`/api/actividades/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accion: 'posponer', dias: 1 }),
    })
    cargar()
  }

  // Mapas para render
  const tiposPorId = Object.fromEntries(tipos.map(t => [t.id, t]))
  const estadosPorClave = Object.fromEntries(estados.map(e => [e.clave, e]))

  // Separar pendientes y completadas
  const pendientes = actividades.filter(a => a.estado_clave !== 'completada' && a.estado_clave !== 'cancelada')
  const completadas = actividades.filter(a => a.estado_clave === 'completada' || a.estado_clave === 'cancelada')

  return (
    <section>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xs font-semibold text-texto-terciario uppercase tracking-wider">
          Actividades
          {pendientes.length > 0 && (
            <span className="ml-1.5 text-texto-marca">{pendientes.length}</span>
          )}
        </h3>
        <Boton
          variante="fantasma"
          tamano="xs"
          icono={<PlusCircle size={13} />}
          onClick={() => setModalAbierto(true)}
        >
          Nueva
        </Boton>
      </div>

      {/* Pendientes */}
      {cargando ? (
        <div className="py-4 text-center text-xs text-texto-terciario">Cargando...</div>
      ) : pendientes.length === 0 && completadas.length === 0 ? (
        <div className="py-4 text-center text-xs text-texto-terciario">
          Sin actividades vinculadas
        </div>
      ) : (
        <div className="space-y-1.5">
          {pendientes.map(act => (
            <FilaActividadCompacta
              key={act.id}
              actividad={act}
              tipo={tiposPorId[act.tipo_id]}
              estado={estadosPorClave[act.estado_clave]}
              onCompletar={() => completar(act.id)}
              onPosponer={() => posponer(act.id)}
            />
          ))}

          {/* Completadas (colapsables) */}
          {completadas.length > 0 && (
            <>
              <Boton
                variante="fantasma"
                tamano="xs"
                icono={verCompletadas ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                onClick={() => setVerCompletadas(!verCompletadas)}
                className="w-full mt-2 pt-2"
              >
                {completadas.length} completada{completadas.length > 1 ? 's' : ''}
              </Boton>
              <AnimatePresence>
                {verCompletadas && completadas.map(act => (
                  <motion.div
                    key={act.id}
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                  >
                    <FilaActividadCompacta
                      actividad={act}
                      tipo={tiposPorId[act.tipo_id]}
                      estado={estadosPorClave[act.estado_clave]}
                      completada
                    />
                  </motion.div>
                ))}
              </AnimatePresence>
            </>
          )}
        </div>
      )}

      {/* Modal de crear actividad pre-vinculada */}
      <ModalActividad
        abierto={modalAbierto}
        tipos={tipos}
        estados={estados}
        miembros={miembros}
        vinculoInicial={{ tipo: 'contacto', id: contactoId, nombre: contactoNombre }}
        modulo="contactos"
        onGuardar={crearActividad}
        onCerrar={() => setModalAbierto(false)}
        onCambiarAVisita={() => { setModalAbierto(false); modalVisitaHook.abrir() }}
      />

      {/* Modal de visita — abierto cuando se selecciona tipo "visita" en actividades */}
      <ModalVisita
        abierto={modalVisitaHook.abierto}
        visita={modalVisitaHook.visitaEditando}
        miembros={modalVisitaHook.miembros}
        config={modalVisitaHook.config}
        onGuardar={async (datos) => { await modalVisitaHook.guardar(datos); cargar() }}
        onCompletar={async (id) => { await modalVisitaHook.completarVisita(id); cargar() }}
        onCancelar={async (id) => { await modalVisitaHook.cancelarVisita(id); cargar() }}
        onCerrar={modalVisitaHook.cerrar}
      />
    </section>
  )
}

// ── Fila compacta de actividad ──

function FilaActividadCompacta({
  actividad,
  tipo,
  estado,
  completada,
  onCompletar,
  onPosponer,
}: {
  actividad: Actividad
  tipo?: TipoActividad
  estado?: EstadoActividad
  completada?: boolean
  onCompletar?: () => void
  onPosponer?: () => void
}) {
  const formato = useFormato()
  const Icono = tipo ? obtenerIcono(tipo.icono) : null
  const vencida = actividad.fecha_vencimiento && new Date(actividad.fecha_vencimiento) < new Date() && !completada

  return (
    <div className={`flex items-center gap-2.5 px-2.5 py-2 rounded-card transition-colors ${completada ? 'opacity-50' : 'hover:bg-superficie-hover/50'}`}>
      {/* Icono tipo */}
      {tipo && (
        <div
          className="w-7 h-7 rounded-card flex items-center justify-center shrink-0"
          style={{ backgroundColor: tipo.color + '15', color: tipo.color }}
        >
          {Icono && <Icono size={13} />}
        </div>
      )}

      {/* Título + fecha */}
      <div className="flex-1 min-w-0">
        <p className={`text-sm truncate ${completada ? 'line-through text-texto-terciario' : 'text-texto-primario'}`}>
          {actividad.titulo}
        </p>
        {actividad.fecha_vencimiento && (
          <p className={`text-xs ${vencida ? 'text-insignia-peligro-texto font-medium' : 'text-texto-terciario'}`}>
            {formato.fecha(actividad.fecha_vencimiento, { corta: true })}
            {vencida && ' — vencida'}
          </p>
        )}
      </div>

      {/* Acciones rápidas */}
      {!completada && (
        <div className="flex items-center gap-0.5 shrink-0">
          {onCompletar && (
            <Boton variante="fantasma" tamano="xs" soloIcono titulo="Completar" icono={<CheckCircle size={14} />} onClick={onCompletar} className="hover:bg-insignia-exito-fondo hover:text-insignia-exito-texto" />
          )}
          {onPosponer && (
            <Boton variante="fantasma" tamano="xs" soloIcono titulo="Posponer" icono={<Clock size={14} />} onClick={onPosponer} className="hover:bg-insignia-advertencia-fondo hover:text-insignia-advertencia-texto" />
          )}
        </div>
      )}
    </div>
  )
}

export { SeccionActividadesContacto }
