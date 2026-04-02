'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ModalAdaptable as Modal } from '@/componentes/ui/ModalAdaptable'
import { Boton } from '@/componentes/ui/Boton'
import { Input } from '@/componentes/ui/Input'
import { Select } from '@/componentes/ui/Select'
import { Interruptor } from '@/componentes/ui/Interruptor'
import { Insignia } from '@/componentes/ui/Insignia'
import { Alerta } from '@/componentes/ui/Alerta'
import {
  Plus, Trash2, Zap, X, ChevronDown, ChevronUp, Pencil,
} from 'lucide-react'
import { useTraduccion } from '@/lib/i18n'
import { useToast } from '@/componentes/feedback/Toast'
import type { ReglaCorreo, CondicionRegla, AccionRegla } from '@/tipos/inbox'

/**
 * Modal para gestionar reglas automáticas de correo.
 * Se usa en: configuración del inbox, sección de correo.
 */

interface PropiedadesModalReglas {
  abierto: boolean
  onCerrar: () => void
}

const CAMPOS_CONDICION = [
  { valor: 'correo_de', etiqueta: 'Remitente (De)' },
  { valor: 'correo_para', etiqueta: 'Destinatario (Para)' },
  { valor: 'asunto', etiqueta: 'Asunto' },
  { valor: 'texto', etiqueta: 'Cuerpo del mensaje' },
]

const OPERADORES = [
  { valor: 'contiene', etiqueta: 'Contiene' },
  { valor: 'es', etiqueta: 'Es exactamente' },
  { valor: 'empieza', etiqueta: 'Empieza con' },
  { valor: 'termina', etiqueta: 'Termina con' },
  { valor: 'dominio', etiqueta: 'Dominio es' },
]

const TIPOS_ACCION = [
  { valor: 'marcar_spam', etiqueta: 'Marcar como spam' },
  { valor: 'archivar', etiqueta: 'Archivar (marcar resuelta)' },
  { valor: 'etiquetar', etiqueta: 'Asignar etiqueta' },
  { valor: 'asignar', etiqueta: 'Asignar a agente' },
]

export function ModalReglas({ abierto, onCerrar }: PropiedadesModalReglas) {
  const { t } = useTraduccion()
  const { mostrar } = useToast()
  const [reglas, setReglas] = useState<ReglaCorreo[]>([])
  const [cargando, setCargando] = useState(false)
  const [editando, setEditando] = useState<ReglaCorreo | null>(null)
  const [expandida, setExpandida] = useState<string | null>(null)

  // Form de edición
  const [nombre, setNombre] = useState('')
  const [condiciones, setCondiciones] = useState<CondicionRegla[]>([])
  const [acciones, setAcciones] = useState<AccionRegla[]>([])
  const [activa, setActiva] = useState(true)

  const cargar = useCallback(async () => {
    setCargando(true)
    try {
      const res = await fetch('/api/inbox/reglas')
      const data = await res.json()
      setReglas(data.reglas || [])
    } catch { mostrar('error', 'Error al cargar reglas') }
    setCargando(false)
  }, [])

  useEffect(() => {
    if (abierto) cargar()
  }, [abierto, cargar])

  const iniciarEdicion = (regla?: ReglaCorreo) => {
    if (regla) {
      setEditando(regla)
      setNombre(regla.nombre)
      setCondiciones(regla.condiciones)
      setAcciones(regla.acciones)
      setActiva(regla.activa)
    } else {
      setEditando({ id: '' } as ReglaCorreo)
      setNombre('')
      setCondiciones([{ campo: 'correo_de', operador: 'contiene', valor: '' }])
      setAcciones([{ tipo: 'marcar_spam', valor: '' }])
      setActiva(true)
    }
  }

  const cancelarEdicion = () => {
    setEditando(null)
    setNombre('')
    setCondiciones([])
    setAcciones([])
  }

  const guardar = async () => {
    if (!nombre.trim() || condiciones.length === 0 || acciones.length === 0) return

    const condicionesFiltradas = condiciones.filter(c => c.valor.trim())
    if (condicionesFiltradas.length === 0) return

    try {
      if (editando?.id) {
        await fetch(`/api/inbox/reglas?id=${editando.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ nombre, condiciones: condicionesFiltradas, acciones, activa }),
        })
      } else {
        await fetch('/api/inbox/reglas', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ nombre, condiciones: condicionesFiltradas, acciones, activa }),
        })
      }
      cancelarEdicion()
      cargar()
      mostrar('exito', editando?.id ? 'Regla actualizada' : 'Regla creada')
    } catch { mostrar('error', 'Error al guardar la regla') }
  }

  const eliminar = async (id: string) => {
    try {
      await fetch(`/api/inbox/reglas?id=${id}`, { method: 'DELETE' })
      cargar()
      mostrar('exito', 'Regla eliminada')
    } catch { mostrar('error', 'Error al eliminar la regla') }
  }

  const toggleActiva = async (regla: ReglaCorreo) => {
    try {
      await fetch(`/api/inbox/reglas?id=${regla.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ activa: !regla.activa }),
      })
      cargar()
    } catch { mostrar('error', 'Error al cambiar estado de la regla') }
  }

  // Helpers para condiciones/acciones
  const agregarCondicion = () => setCondiciones(prev => [...prev, { campo: 'correo_de', operador: 'contiene', valor: '' }])
  const removerCondicion = (i: number) => setCondiciones(prev => prev.filter((_, j) => j !== i))
  const actualizarCondicion = (i: number, cambios: Partial<CondicionRegla>) => {
    setCondiciones(prev => prev.map((c, j) => j === i ? { ...c, ...cambios } : c))
  }

  const agregarAccion = () => setAcciones(prev => [...prev, { tipo: 'marcar_spam', valor: '' }])
  const removerAccion = (i: number) => setAcciones(prev => prev.filter((_, j) => j !== i))
  const actualizarAccion = (i: number, cambios: Partial<AccionRegla>) => {
    setAcciones(prev => prev.map((a, j) => j === i ? { ...a, ...cambios } : a))
  }

  return (
    <Modal
      abierto={abierto}
      onCerrar={onCerrar}
      titulo="Reglas automáticas"
      tamano="lg"
      acciones={
        editando ? (
          <div className="flex items-center gap-2">
            <Boton variante="secundario" tamano="sm" onClick={cancelarEdicion}>Cancelar</Boton>
            <Boton variante="primario" tamano="sm" onClick={guardar} disabled={!nombre.trim()}>
              {editando.id ? 'Guardar cambios' : 'Crear regla'}
            </Boton>
          </div>
        ) : undefined
      }
    >
      {editando ? (
        /* ─── Formulario de edición ─── */
        <div className="space-y-4">
          <Input
            etiqueta={t('inbox.nombre_regla')}
            placeholder="Ej: Spam de marketing"
            defaultValue={nombre}
            onChange={(e) => setNombre(e.target.value)}
          />

          <Interruptor activo={activa} onChange={setActiva} etiqueta={t('inbox.regla_activa')} />

          {/* Condiciones */}
          <div>
            <p className="text-xs font-semibold mb-2" style={{ color: 'var(--texto-primario)' }}>
              Cuando se cumplan TODAS estas condiciones:
            </p>
            <div className="space-y-2">
              {condiciones.map((cond, i) => (
                <div key={i} className="flex items-center gap-2">
                  <Select
                    valor={cond.campo}
                    onChange={(v) => actualizarCondicion(i, { campo: v as CondicionRegla['campo'] })}
                    opciones={CAMPOS_CONDICION}
                    className="text-xs"
                  />
                  <Select
                    valor={cond.operador}
                    onChange={(v) => actualizarCondicion(i, { operador: v as CondicionRegla['operador'] })}
                    opciones={OPERADORES}
                    className="text-xs"
                  />
                  <Input
                    value={cond.valor}
                    onChange={(e) => actualizarCondicion(i, { valor: e.target.value })}
                    compacto
                    formato={null}
                    className="flex-1 text-xs"
                    placeholder="Valor..."
                  />
                  {condiciones.length > 1 && (
                    <Boton variante="fantasma" tamano="xs" soloIcono titulo="Quitar condición" icono={<X size={12} />} onClick={() => removerCondicion(i)} />
                  )}
                </div>
              ))}
            </div>
            <Boton variante="fantasma" tamano="xs" icono={<Plus size={10} />} onClick={agregarCondicion} className="mt-2 text-texto-marca">
              Agregar condición
            </Boton>
          </div>

          {/* Acciones */}
          <div>
            <p className="text-xs font-semibold mb-2" style={{ color: 'var(--texto-primario)' }}>
              Entonces hacer:
            </p>
            <div className="space-y-2">
              {acciones.map((acc, i) => (
                <div key={i} className="flex items-center gap-2">
                  <Select
                    valor={acc.tipo}
                    onChange={(v) => actualizarAccion(i, { tipo: v as AccionRegla['tipo'] })}
                    opciones={TIPOS_ACCION}
                    className="text-xs"
                  />
                  {(acc.tipo === 'etiquetar' || acc.tipo === 'asignar') && (
                    <Input
                      value={acc.valor}
                      onChange={(e) => actualizarAccion(i, { valor: e.target.value })}
                      compacto
                      formato={null}
                      className="flex-1 text-xs"
                      placeholder={acc.tipo === 'etiquetar' ? 'ID de etiqueta' : 'ID de agente'}
                    />
                  )}
                  {acciones.length > 1 && (
                    <Boton variante="fantasma" tamano="xs" soloIcono titulo="Quitar acción" icono={<X size={12} />} onClick={() => removerAccion(i)} />
                  )}
                </div>
              ))}
            </div>
            <Boton variante="fantasma" tamano="xs" icono={<Plus size={10} />} onClick={agregarAccion} className="mt-2 text-texto-marca">
              Agregar acción
            </Boton>
          </div>
        </div>
      ) : (
        /* ─── Lista de reglas ─── */
        <div className="space-y-3">
          {cargando ? (
            <div className="py-8 text-center">
              <span className="text-xs" style={{ color: 'var(--texto-terciario)' }}>Cargando...</span>
            </div>
          ) : reglas.length === 0 ? (
            <div className="py-8 text-center">
              <Zap size={24} className="mx-auto mb-2" style={{ color: 'var(--texto-terciario)' }} />
              <p className="text-sm" style={{ color: 'var(--texto-secundario)' }}>Sin reglas</p>
              <p className="text-xs mt-1" style={{ color: 'var(--texto-terciario)' }}>
                Creá reglas para clasificar correos automáticamente.
              </p>
            </div>
          ) : (
            reglas.map((regla) => (
              <div
                key={regla.id}
                className="rounded-lg transition-all"
                style={{ border: '1px solid var(--borde-sutil)' }}
              >
                <div className="flex items-center gap-3 px-3 py-2.5">
                  <Interruptor
                    activo={regla.activa}
                    onChange={() => toggleActiva(regla)}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium" style={{ color: regla.activa ? 'var(--texto-primario)' : 'var(--texto-terciario)' }}>
                      {regla.nombre}
                    </p>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className="text-xxs" style={{ color: 'var(--texto-terciario)' }}>
                        {regla.condiciones.length} condición{regla.condiciones.length !== 1 ? 'es' : ''}
                      </span>
                      <span className="text-xxs" style={{ color: 'var(--texto-terciario)' }}>→</span>
                      <span className="text-xxs" style={{ color: 'var(--texto-terciario)' }}>
                        {regla.acciones.length} acción{regla.acciones.length !== 1 ? 'es' : ''}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <Boton variante="fantasma" tamano="xs" soloIcono titulo="Editar regla" icono={<Pencil size={12} />} onClick={() => iniciarEdicion(regla)} />
                    <Boton variante="fantasma" tamano="xs" soloIcono titulo="Eliminar regla" icono={<Trash2 size={12} />} onClick={() => eliminar(regla.id)} className="text-insignia-peligro" />
                  </div>
                </div>
              </div>
            ))
          )}

          <Boton
            variante="primario"
            tamano="sm"
            icono={<Plus size={14} />}
            onClick={() => iniciarEdicion()}
          >
            Nueva regla
          </Boton>
        </div>
      )}
    </Modal>
  )
}
