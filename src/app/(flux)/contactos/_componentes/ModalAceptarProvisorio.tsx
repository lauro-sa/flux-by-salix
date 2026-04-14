'use client'

/**
 * ModalAceptarProvisorio — Se abre al pulsar "Aceptar" en un contacto provisorio.
 *
 * Opciones:
 * 1. Crear como nuevo contacto (le asigna código secuencial)
 * 2. Unificar con un contacto existente (muestra similares + buscador)
 *
 * Se usa en: página de detalle del contacto provisorio.
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import {
  Search, UserPlus, Users, ArrowRight, Check,
  Phone, Mail, MessageCircle, MapPin,
} from 'lucide-react'
import { ModalAdaptable as Modal } from '@/componentes/ui/ModalAdaptable'
import { Boton } from '@/componentes/ui/Boton'
import { Input } from '@/componentes/ui/Input'
import { Avatar } from '@/componentes/ui/Avatar'
import { Insignia } from '@/componentes/ui/Insignia'
import { CargadorInline } from '@/componentes/ui/Cargador'
import { DEBOUNCE_BUSQUEDA } from '@/lib/constantes/timeouts'

// ─── Tipos ───

interface ContactoSimilar {
  id: string
  nombre: string
  apellido?: string
  codigo: string
  correo?: string
  telefono?: string
  whatsapp?: string
  cargo?: string
  activo: boolean
  tipo_contacto?: { clave: string; etiqueta: string; icono?: string; color?: string }
  puntuacion: number
  coincidencias: string[]
}

interface ContactoBusqueda {
  id: string
  nombre: string
  apellido?: string
  codigo: string
  correo?: string
  telefono?: string
  whatsapp?: string
  cargo?: string
  tipo_contacto?: { clave: string; etiqueta: string; icono?: string; color?: string }
}

interface PropiedadesModal {
  abierto: boolean
  onCerrar: () => void
  contactoId: string
  nombreContacto: string
  /** Callback cuando se acepta como nuevo (ya aceptado en backend) */
  onAceptarNuevo: (codigo: string) => void
}

// ─── Componente ───

export function ModalAceptarProvisorio({
  abierto,
  onCerrar,
  contactoId,
  nombreContacto,
  onAceptarNuevo,
}: PropiedadesModal) {
  const router = useRouter()

  // Estado
  const [paso, setPaso] = useState<'elegir' | 'unificar'>('elegir')
  const [similares, setSimilares] = useState<ContactoSimilar[]>([])
  const [cargandoSimilares, setCargandoSimilares] = useState(false)
  const [busqueda, setBusqueda] = useState('')
  const [resultadosBusqueda, setResultadosBusqueda] = useState<ContactoBusqueda[]>([])
  const [buscando, setBuscando] = useState(false)
  const [seleccionado, setSeleccionado] = useState<ContactoSimilar | ContactoBusqueda | null>(null)
  const [fusionando, setFusionando] = useState(false)
  const [aceptandoNuevo, setAceptandoNuevo] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  // Cargar similares al abrir
  useEffect(() => {
    if (!abierto || !contactoId) return
    setCargandoSimilares(true)
    fetch(`/api/contactos/similares?contacto_id=${contactoId}`)
      .then(r => r.json())
      .then(data => setSimilares(data.similares || []))
      .catch(() => setSimilares([]))
      .finally(() => setCargandoSimilares(false))
  }, [abierto, contactoId])

  // Reset al cerrar
  useEffect(() => {
    if (!abierto) {
      setPaso('elegir')
      setBusqueda('')
      setResultadosBusqueda([])
      setSeleccionado(null)
    }
  }, [abierto])

  // Búsqueda con debounce
  useEffect(() => {
    if (busqueda.length < 2) {
      setResultadosBusqueda([])
      return
    }
    clearTimeout(timerRef.current)
    timerRef.current = setTimeout(async () => {
      setBuscando(true)
      try {
        const res = await fetch(`/api/contactos?busqueda=${encodeURIComponent(busqueda)}&por_pagina=10`)
        if (res.ok) {
          const data = await res.json()
          // Filtrar el provisorio de los resultados
          const filtrados = (data.contactos || []).filter(
            (c: ContactoBusqueda) => c.id !== contactoId
          )
          setResultadosBusqueda(filtrados)
        }
      } catch { /* silenciar */ }
      finally { setBuscando(false) }
    }, DEBOUNCE_BUSQUEDA)
    return () => clearTimeout(timerRef.current)
  }, [busqueda, contactoId])

  // Aceptar como nuevo contacto
  const aceptarComoNuevo = useCallback(async () => {
    setAceptandoNuevo(true)
    try {
      const res = await fetch(`/api/contactos/${contactoId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ es_provisorio: false }),
      })
      if (res.ok) {
        const data = await res.json()
        onAceptarNuevo(data.codigo || '')
        onCerrar()
      }
    } catch (err) {
      console.error('Error aceptando provisorio:', err)
    } finally {
      setAceptandoNuevo(false)
    }
  }, [contactoId, onAceptarNuevo, onCerrar])

  // Fusionar con contacto seleccionado
  const fusionarContacto = useCallback(async () => {
    if (!seleccionado) return
    setFusionando(true)
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
        // Navegar al contacto destino
        router.push(`/contactos/${data.destino_id}`)
      }
    } catch (err) {
      console.error('Error fusionando:', err)
    } finally {
      setFusionando(false)
    }
  }, [contactoId, seleccionado, onCerrar, router])

  // ─── Render helpers ───

  const renderContactoItem = (
    contacto: ContactoSimilar | ContactoBusqueda,
    esSimilar = false,
  ) => {
    const nombreCompleto = [contacto.nombre, contacto.apellido].filter(Boolean).join(' ')
    const estaSeleccionado = seleccionado?.id === contacto.id
    const similar = esSimilar ? (contacto as ContactoSimilar) : null

    return (
      <button
        key={contacto.id}
        type="button"
        onClick={() => setSeleccionado(estaSeleccionado ? null : contacto)}
        className={`
          w-full text-left p-3 rounded-lg border transition-all
          ${estaSeleccionado
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
              {contacto.codigo && (
                <span className="text-[11px] text-texto-terciario flex-shrink-0">{contacto.codigo}</span>
              )}
            </div>
            {/* Datos de contacto */}
            <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-0.5">
              {contacto.correo && (
                <span className="flex items-center gap-1 text-xs text-texto-terciario">
                  <Mail size={11} /> {contacto.correo}
                </span>
              )}
              {contacto.telefono && (
                <span className="flex items-center gap-1 text-xs text-texto-terciario">
                  <Phone size={11} /> {contacto.telefono}
                </span>
              )}
              {contacto.whatsapp && (
                <span className="flex items-center gap-1 text-xs text-texto-terciario">
                  <MessageCircle size={11} /> {contacto.whatsapp}
                </span>
              )}
              {contacto.cargo && (
                <span className="text-xs text-texto-terciario">{contacto.cargo}</span>
              )}
            </div>
          </div>
          {estaSeleccionado && (
            <div className="flex-shrink-0 size-5 rounded-full flex items-center justify-center"
              style={{ background: 'var(--texto-marca)' }}>
              <Check size={12} className="text-white" />
            </div>
          )}
        </div>

        {/* Insignias de coincidencia */}
        {similar && similar.coincidencias.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2">
            {similar.coincidencias.map(c => (
              <Insignia key={c} color="info" tamano="sm">{c}</Insignia>
            ))}
          </div>
        )}
      </button>
    )
  }

  // ─── Render ───

  return (
    <Modal
      abierto={abierto}
      onCerrar={onCerrar}
      titulo={`Aceptar contacto: ${nombreContacto}`}
      tamano="2xl"
      alturaMovil="completo"
    >
      {/* ═══ PASO 1: Elegir acción ═══ */}
      {paso === 'elegir' && (
        <div className="space-y-4">
          {/* Similares encontrados */}
          {cargandoSimilares && (
            <div className="flex justify-center py-6"><CargadorInline /></div>
          )}

          {!cargandoSimilares && similares.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Users size={15} className="text-texto-terciario" />
                <span className="text-[11px] font-medium text-texto-terciario uppercase tracking-wider">
                  Posibles coincidencias ({similares.length})
                </span>
              </div>
              <div className="space-y-1.5 max-h-64 overflow-y-auto">
                {similares.map(s => renderContactoItem(s, true))}
              </div>
            </div>
          )}

          {!cargandoSimilares && similares.length === 0 && (
            <div className="text-center py-4">
              <p className="text-sm text-texto-secundario">No se encontraron contactos similares</p>
              <p className="text-xs text-texto-terciario mt-1">Podés crear uno nuevo o buscar manualmente</p>
            </div>
          )}

          {/* Separador */}
          <div className="border-t border-white/[0.07]" />

          {/* Acciones */}
          <div className="flex flex-col sm:flex-row gap-2">
            <Boton
              variante="exito"
              icono={<UserPlus size={15} />}
              iconoDerecho={<ArrowRight size={14} />}
              onClick={seleccionado ? fusionarContacto : aceptarComoNuevo}
              cargando={aceptandoNuevo || fusionando}
              anchoCompleto
            >
              {seleccionado
                ? `Unificar con ${seleccionado.nombre}`
                : 'Crear como nuevo contacto'
              }
            </Boton>
            <Boton
              variante="secundario"
              icono={<Search size={15} />}
              onClick={() => setPaso('unificar')}
              anchoCompleto
            >
              Buscar otro contacto
            </Boton>
          </div>
        </div>
      )}

      {/* ═══ PASO 2: Buscar contacto para unificar ═══ */}
      {paso === 'unificar' && (
        <div className="space-y-4">
          <Input
            value={busqueda}
            onChange={e => setBusqueda(e.target.value)}
            placeholder="Buscar por nombre, email, teléfono, código..."
            icono={<Search size={16} />}
            autoFocus
          />

          <div className="max-h-72 overflow-y-auto space-y-1.5">
            {buscando && (
              <div className="flex justify-center py-4"><CargadorInline /></div>
            )}

            {!buscando && busqueda.length >= 2 && resultadosBusqueda.length === 0 && (
              <p className="text-sm text-texto-terciario text-center py-4">
                No se encontraron resultados
              </p>
            )}

            {!buscando && resultadosBusqueda.map(c => renderContactoItem(c))}

            {busqueda.length < 2 && !buscando && (
              <p className="text-xs text-texto-terciario text-center py-4">
                Escribí al menos 2 caracteres para buscar
              </p>
            )}
          </div>

          {/* Separador */}
          <div className="border-t border-white/[0.07]" />

          {/* Acciones */}
          <div className="flex justify-between gap-2">
            <Boton variante="fantasma" onClick={() => { setPaso('elegir'); setBusqueda(''); setResultadosBusqueda([]); setSeleccionado(null) }}>
              Volver
            </Boton>
            <div className="flex gap-2">
              <Boton
                variante="exito"
                icono={seleccionado ? <Users size={15} /> : <UserPlus size={15} />}
                onClick={seleccionado ? fusionarContacto : aceptarComoNuevo}
                cargando={aceptandoNuevo || fusionando}
              >
                {seleccionado
                  ? `Unificar con ${seleccionado.nombre}`
                  : 'Crear como nuevo'
                }
              </Boton>
            </div>
          </div>
        </div>
      )}
    </Modal>
  )
}
