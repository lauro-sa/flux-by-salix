'use client'

/**
 * ModalFusionarContacto — Fusiona el contacto actual con otro existente.
 *
 * El contacto actual se elimina; todo su histórico (presupuestos, visitas,
 * conversaciones, actividades, direcciones, vinculaciones) se migra al
 * contacto destino. El código del contacto actual queda como "hueco" en la
 * secuencia y no se reutiliza — ver /api/contactos/fusionar.
 *
 * Se usa en: página de detalle del contacto (acción del menú kebab).
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Search, AlertTriangle, Users, Check, Phone, Mail } from 'lucide-react'
import { IconoWhatsApp } from '@/componentes/iconos/IconoWhatsApp'
import { TextoTelefono } from '@/componentes/ui/TextoTelefono'
import { ModalAdaptable as Modal } from '@/componentes/ui/ModalAdaptable'
import { Boton } from '@/componentes/ui/Boton'
import { Input } from '@/componentes/ui/Input'
import { Avatar } from '@/componentes/ui/Avatar'
import { CargadorInline } from '@/componentes/ui/Cargador'
import { DEBOUNCE_BUSQUEDA } from '@/lib/constantes/timeouts'

interface ContactoBusqueda {
  id: string
  nombre: string
  apellido?: string
  codigo: string
  correo?: string
  telefono?: string
  whatsapp?: string
  cargo?: string
}

interface PropiedadesModal {
  abierto: boolean
  onCerrar: () => void
  /** Contacto actual (se elimina tras la fusión). */
  contactoId: string
  nombreContacto: string
  codigoContacto?: string
}

export function ModalFusionarContacto({
  abierto,
  onCerrar,
  contactoId,
  nombreContacto,
  codigoContacto,
}: PropiedadesModal) {
  const router = useRouter()

  const [busqueda, setBusqueda] = useState('')
  const [resultados, setResultados] = useState<ContactoBusqueda[]>([])
  const [buscando, setBuscando] = useState(false)
  const [seleccionado, setSeleccionado] = useState<ContactoBusqueda | null>(null)
  const [fusionando, setFusionando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  // Reset al cerrar
  useEffect(() => {
    if (!abierto) {
      setBusqueda('')
      setResultados([])
      setSeleccionado(null)
      setError(null)
    }
  }, [abierto])

  // Búsqueda con debounce
  useEffect(() => {
    if (!abierto) return
    if (busqueda.length < 2) {
      setResultados([])
      return
    }
    clearTimeout(timerRef.current)
    timerRef.current = setTimeout(async () => {
      setBuscando(true)
      try {
        const res = await fetch(`/api/contactos?busqueda=${encodeURIComponent(busqueda)}&por_pagina=10`)
        if (res.ok) {
          const data = await res.json()
          // Excluir el contacto actual de los resultados — no se puede fusionar consigo mismo
          const filtrados = (data.contactos || []).filter(
            (c: ContactoBusqueda) => c.id !== contactoId
          )
          setResultados(filtrados)
        }
      } catch {
        /* silenciar */
      } finally {
        setBuscando(false)
      }
    }, DEBOUNCE_BUSQUEDA)
    return () => clearTimeout(timerRef.current)
  }, [busqueda, contactoId, abierto])

  const fusionar = useCallback(async () => {
    if (!seleccionado) return
    setFusionando(true)
    setError(null)
    try {
      const res = await fetch('/api/contactos/fusionar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provisorio_id: contactoId,
          destino_id: seleccionado.id,
        }),
      })
      if (res.ok) {
        const data = await res.json()
        onCerrar()
        router.push(`/contactos/${data.destino_id}`)
      } else {
        const data = await res.json().catch(() => ({}))
        setError(data.error || 'No se pudo fusionar el contacto')
      }
    } catch (err) {
      setError((err as Error).message || 'Error de red')
    } finally {
      setFusionando(false)
    }
  }, [contactoId, seleccionado, onCerrar, router])

  const nombreDestino = seleccionado
    ? [seleccionado.nombre, seleccionado.apellido].filter(Boolean).join(' ')
    : ''

  return (
    <Modal
      abierto={abierto}
      onCerrar={onCerrar}
      titulo="Fusionar contacto"
      tamano="2xl"
      alturaMovil="completo"
    >
      <div className="space-y-4">
        {/* Aviso de irreversibilidad */}
        <div
          className="flex gap-2 p-3 rounded-card"
          style={{
            background: 'var(--insignia-advertencia-fondo)',
            border: '1px solid var(--insignia-advertencia)',
          }}
        >
          <AlertTriangle size={16} className="flex-shrink-0 mt-0.5" style={{ color: 'var(--insignia-advertencia)' }} />
          <div className="text-xs" style={{ color: 'var(--texto-secundario)' }}>
            <p style={{ color: 'var(--texto-primario)' }} className="font-medium mb-0.5">
              Esta acción es irreversible
            </p>
            <p>
              El contacto <span className="font-medium">{nombreContacto}</span>
              {codigoContacto ? ` (${codigoContacto})` : ''} se eliminará. Todos sus presupuestos,
              visitas, conversaciones, actividades, direcciones y vinculaciones se moverán al
              contacto seleccionado. El código no se reutiliza.
            </p>
          </div>
        </div>

        {/* Buscador */}
        <Input
          value={busqueda}
          onChange={e => setBusqueda(e.target.value)}
          placeholder="Buscar contacto destino por nombre, email, teléfono o código..."
          icono={<Search size={16} />}
          autoFocus
        />

        {/* Resultados */}
        <div className="max-h-72 overflow-y-auto space-y-1.5">
          {buscando && (
            <div className="flex justify-center py-4">
              <CargadorInline />
            </div>
          )}

          {!buscando && busqueda.length >= 2 && resultados.length === 0 && (
            <p className="text-sm text-texto-terciario text-center py-4">No se encontraron resultados</p>
          )}

          {!buscando && busqueda.length < 2 && (
            <p className="text-xs text-texto-terciario text-center py-4">
              Escribí al menos 2 caracteres para buscar
            </p>
          )}

          {!buscando &&
            resultados.map(c => {
              const nombreCompleto = [c.nombre, c.apellido].filter(Boolean).join(' ')
              const estaSeleccionado = seleccionado?.id === c.id
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setSeleccionado(estaSeleccionado ? null : c)}
                  className={`
                    w-full text-left p-3 rounded-card border transition-all
                    ${
                      estaSeleccionado
                        ? 'border-texto-marca/50 bg-texto-marca/10'
                        : 'border-borde-sutil hover:border-white/20 hover:bg-white/[0.03]'
                    }
                  `}
                >
                  <div className="flex items-center gap-3">
                    <Avatar nombre={nombreCompleto} tamano="sm" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-texto-primario truncate">{nombreCompleto}</span>
                        {c.codigo && (
                          <span className="text-[11px] text-texto-terciario flex-shrink-0">{c.codigo}</span>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-0.5">
                        {c.correo && (
                          <span className="flex items-center gap-1 text-xs text-texto-terciario">
                            <Mail size={11} /> {c.correo}
                          </span>
                        )}
                        {c.telefono && (
                          <span className="flex items-center gap-1 text-xs text-texto-terciario">
                            <Phone size={11} /> <TextoTelefono valor={c.telefono} />
                          </span>
                        )}
                        {c.whatsapp && (
                          <span className="flex items-center gap-1 text-xs text-texto-terciario">
                            <IconoWhatsApp size={11} /> <TextoTelefono valor={c.whatsapp} />
                          </span>
                        )}
                        {c.cargo && <span className="text-xs text-texto-terciario">{c.cargo}</span>}
                      </div>
                    </div>
                    {estaSeleccionado && (
                      <div
                        className="flex-shrink-0 size-5 rounded-full flex items-center justify-center"
                        style={{ background: 'var(--texto-marca)' }}
                      >
                        <Check size={12} className="text-white" />
                      </div>
                    )}
                  </div>
                </button>
              )
            })}
        </div>

        {error && (
          <p className="text-xs text-center" style={{ color: 'var(--insignia-peligro)' }}>
            {error}
          </p>
        )}

        <div className="border-t border-white/[0.07]" />

        <div className="flex justify-between gap-2">
          <Boton variante="fantasma" onClick={onCerrar} disabled={fusionando}>
            Cancelar
          </Boton>
          <Boton
            variante="peligro"
            icono={<Users size={15} />}
            onClick={fusionar}
            cargando={fusionando}
            disabled={!seleccionado}
          >
            {seleccionado ? `Fusionar en ${nombreDestino}` : 'Seleccioná un contacto destino'}
          </Boton>
        </div>
      </div>
    </Modal>
  )
}
