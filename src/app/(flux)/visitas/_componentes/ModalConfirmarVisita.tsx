'use client'

import { useEffect, useMemo, useState } from 'react'
import { Send, CheckCircle, MessageSquare, Loader2, MapPin, CalendarClock, AlertTriangle } from 'lucide-react'
import { Modal } from '@/componentes/ui/Modal'
import { Boton } from '@/componentes/ui/Boton'
import { TextoTelefono } from '@/componentes/ui/TextoTelefono'
import { useToast } from '@/componentes/feedback/Toast'
import { SelectorPlantillasWA } from '@/app/(flux)/whatsapp/_componentes/SelectorPlantillasWA'
import { useEmpresa } from '@/hooks/useEmpresa'
import type { PlantillaWhatsApp } from '@/tipos/whatsapp'
import { construirDatosPlantilla, resolverParametrosCuerpo } from '@/lib/whatsapp/variables'

/**
 * ModalConfirmarVisita — Modal para confirmar una visita provisoria creada por el agente IA.
 * Permite ajustar fecha/duración y enviar una plantilla de WhatsApp de confirmación al cliente.
 * Se usa en: ContenidoVisitas al clickear "Confirmar" en una visita con estado 'provisoria'.
 */

interface VisitaMinima {
  id: string
  contacto_id: string
  contacto_nombre: string
  direccion_texto: string | null
  fecha_programada: string
  duracion_estimada_min: number | null
  motivo: string | null
  notas: string | null
}

interface Props {
  visita: VisitaMinima | null
  abierto: boolean
  onCerrar: () => void
  onConfirmado: () => void
}

interface CanalInfo {
  id: string
  nombre: string
}

interface ContactoInfo {
  nombre: string | null
  apellido: string | null
  telefono: string | null
  email: string | null
}

export function ModalConfirmarVisita({ visita, abierto, onCerrar, onConfirmado }: Props) {
  const { mostrar } = useToast()
  const { empresa } = useEmpresa()
  const empresaNombre = empresa?.nombre || null

  // Datos auxiliares que cargamos al abrir
  const [conversacionId, setConversacionId] = useState<string | null>(null)
  const [canal, setCanal] = useState<CanalInfo | null>(null)
  const [contacto, setContacto] = useState<ContactoInfo | null>(null)
  const [cargando, setCargando] = useState(false)

  // Valores ajustables de la visita
  const [fechaHora, setFechaHora] = useState('')
  const [duracion, setDuracion] = useState<number>(60)

  // Estado UI
  const [mostrarPlantillas, setMostrarPlantillas] = useState(false)
  const [enviando, setEnviando] = useState(false)

  // Reset + carga al abrir
  useEffect(() => {
    if (!abierto || !visita) return

    // Convertir fecha ISO a "yyyy-MM-ddTHH:mm" para input datetime-local (hora local)
    const f = new Date(visita.fecha_programada)
    const pad = (n: number) => String(n).padStart(2, '0')
    const local = `${f.getFullYear()}-${pad(f.getMonth() + 1)}-${pad(f.getDate())}T${pad(f.getHours())}:${pad(f.getMinutes())}`
    setFechaHora(local)
    setDuracion(visita.duracion_estimada_min || 60)
    setMostrarPlantillas(false)
    setConversacionId(null)
    setCanal(null)
    setContacto(null)

    // Cargar conversación abierta del contacto (para obtener canal y poder enviar plantilla)
    setCargando(true)
    ;(async () => {
      try {
        const res = await fetch(`/api/inbox/conversaciones?contacto_id=${visita.contacto_id}&limite=1`)
        if (res.ok) {
          const data = await res.json()
          const conv = data.conversaciones?.[0] || data[0] || null
          if (conv) {
            setConversacionId(conv.id)
            if (conv.canal_id) {
              setCanal({ id: conv.canal_id, nombre: conv.canal_nombre || 'WhatsApp' })
            }
          }
        }

        // Cargar datos completos del contacto (para variables de plantilla)
        const resContacto = await fetch(`/api/contactos/${visita.contacto_id}`)
        if (resContacto.ok) {
          const dataC = await resContacto.json()
          setContacto({
            nombre: dataC.nombre ?? null,
            apellido: dataC.apellido ?? null,
            telefono: dataC.telefono ?? null,
            email: dataC.email ?? null,
          })
        }
      } catch {
        /* silencioso: el usuario puede confirmar sin enviar plantilla igual */
      } finally {
        setCargando(false)
      }
    })()
  }, [abierto, visita])

  const datosContactoPreview = useMemo(() => ({
    nombre: contacto?.nombre,
    apellido: contacto?.apellido,
    telefono: contacto?.telefono,
    correo: contacto?.email,
  }), [contacto])

  if (!visita) return null

  const fechaISO = fechaHora ? new Date(fechaHora).toISOString() : visita.fecha_programada

  // Confirmar la visita en BD (opcionalmente tras enviar plantilla)
  const confirmarEnBD = async (): Promise<boolean> => {
    const res = await fetch(`/api/visitas/${visita.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        accion: 'confirmar',
        fecha_programada: fechaISO,
        duracion_estimada_min: duracion,
      }),
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      mostrar('error', err.error || 'No se pudo confirmar la visita')
      return false
    }
    return true
  }

  // Confirmar sin mandar plantilla
  const handleConfirmarSinEnviar = async () => {
    setEnviando(true)
    const ok = await confirmarEnBD()
    setEnviando(false)
    if (ok) {
      mostrar('exito', 'Visita confirmada')
      onConfirmado()
    }
  }

  // Enviar plantilla + confirmar
  const handleEnviarPlantilla = async (plantilla: PlantillaWhatsApp) => {
    if (!conversacionId || !canal) {
      mostrar('error', 'Sin conversación o canal activo para enviar la plantilla')
      return
    }
    setEnviando(true)
    try {
      // Resolver variables del cuerpo usando datos reales (contacto + visita ajustada + empresa)
      const datos = construirDatosPlantilla({
        contacto: contacto ? { ...contacto, correo: contacto.email } : null,
        visita: {
          fecha_programada: fechaISO,
          duracion_estimada_min: duracion,
          direccion_texto: visita.direccion_texto,
          motivo: visita.motivo,
        },
        empresa: { nombre: empresaNombre },
      })
      const componentes: Array<Record<string, unknown>> = []
      const parametros = resolverParametrosCuerpo(plantilla.componentes?.cuerpo, datos)
      // Si no hay contacto cargado al momento del envío, garantizar un nombre por defecto
      if (parametros) {
        parametros.forEach(p => { if (!p.text) p.text = '' })
        componentes.push({ type: 'body', parameters: parametros })
      }

      const resEnvio = await fetch('/api/whatsapp/enviar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversacion_id: conversacionId,
          canal_id: canal.id,
          tipo: 'plantilla',
          plantilla_nombre_api: plantilla.nombre_api,
          plantilla_idioma: plantilla.idioma || 'es',
          plantilla_componentes: componentes,
        }),
      })

      if (!resEnvio.ok) {
        const err = await resEnvio.json().catch(() => ({}))
        mostrar('error', err.error || 'No se pudo enviar la plantilla')
        setEnviando(false)
        return
      }

      const ok = await confirmarEnBD()
      setEnviando(false)
      if (ok) {
        mostrar('exito', 'Plantilla enviada y visita confirmada')
        onConfirmado()
      }
    } catch {
      setEnviando(false)
      mostrar('error', 'Error al enviar la plantilla')
    }
  }

  return (
    <Modal
      abierto={abierto}
      onCerrar={onCerrar}
      titulo="Confirmar visita provisoria"
      tamano="2xl"
      accionSecundaria={{
        etiqueta: 'Cancelar',
        onClick: onCerrar,
        disabled: enviando,
      }}
      accionPrimaria={{
        etiqueta: mostrarPlantillas ? 'Volver' : 'Confirmar sin enviar',
        onClick: mostrarPlantillas ? () => setMostrarPlantillas(false) : handleConfirmarSinEnviar,
        disabled: enviando,
        icono: mostrarPlantillas ? undefined : <CheckCircle size={14} />,
      }}
    >
      <div className="space-y-5 relative">
        {/* ── Datos de la visita (read-only) ── */}
        <div className="space-y-2">
          <div className="flex items-start gap-2 text-sm">
            <MessageSquare size={14} className="mt-0.5 text-texto-terciario" />
            <div>
              <div className="text-texto-primario font-medium">{visita.contacto_nombre}</div>
              {contacto?.telefono && (
                <div className="text-xs text-texto-terciario"><TextoTelefono valor={contacto.telefono} /></div>
              )}
            </div>
          </div>
          {visita.direccion_texto && (
            <div className="flex items-start gap-2 text-sm">
              <MapPin size={14} className="mt-0.5 text-texto-terciario" />
              <span className="text-texto-secundario">{visita.direccion_texto}</span>
            </div>
          )}
          {visita.motivo && (
            <div className="text-sm text-texto-secundario pl-6">
              <span className="text-texto-terciario">Motivo: </span>{visita.motivo}
            </div>
          )}
        </div>

        {/* ── Fecha y duración editables ── */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-3 border-t border-white/[0.07]">
          <div>
            <label className="block text-[11px] font-medium text-texto-terciario uppercase tracking-wider mb-1.5">
              <CalendarClock size={12} className="inline mr-1" />
              Fecha y hora
            </label>
            <input
              type="datetime-local"
              value={fechaHora}
              onChange={(e) => setFechaHora(e.target.value)}
              className="w-full h-9 px-3 text-sm rounded-md bg-transparent border border-borde-sutil text-texto-primario focus:outline-none focus:border-borde-fuerte"
            />
          </div>
          <div>
            <label className="block text-[11px] font-medium text-texto-terciario uppercase tracking-wider mb-1.5">
              Duración (min)
            </label>
            <input
              type="number"
              value={duracion}
              onChange={(e) => setDuracion(Number(e.target.value) || 60)}
              min={15}
              step={15}
              className="w-full h-9 px-3 text-sm rounded-md bg-transparent border border-borde-sutil text-texto-primario focus:outline-none focus:border-borde-fuerte"
            />
          </div>
        </div>

        {/* ── Sección plantilla WhatsApp ── */}
        <div className="pt-3 border-t border-white/[0.07]">
          {cargando ? (
            <div className="flex items-center gap-2 text-sm text-texto-terciario">
              <Loader2 size={14} className="animate-spin" />
              Cargando datos del contacto…
            </div>
          ) : !conversacionId || !canal ? (
            <div className="flex items-start gap-2 text-sm rounded-md p-3"
              style={{ background: 'var(--insignia-advertencia-suave, rgba(234,179,8,0.1))', border: '1px solid var(--insignia-advertencia-borde, rgba(234,179,8,0.3))' }}>
              <AlertTriangle size={14} className="mt-0.5 text-insignia-advertencia" />
              <span className="text-texto-secundario">
                No hay conversación de WhatsApp activa para este contacto. Podés confirmar sin enviar plantilla.
              </span>
            </div>
          ) : (
            <div>
              <label className="block text-[11px] font-medium text-texto-terciario uppercase tracking-wider mb-1.5">
                Plantilla de confirmación
              </label>
              <Boton
                variante="secundario"
                onClick={() => setMostrarPlantillas(true)}
                icono={<Send size={14} />}
                disabled={enviando}
              >
                Elegir plantilla y enviar
              </Boton>
              <p className="mt-1.5 text-xs text-texto-terciario">
                Se enviará al cliente por WhatsApp y la visita quedará confirmada.
              </p>
            </div>
          )}
        </div>

        {/* ── Selector de plantillas (panel flotante) ── */}
        {canal && (
          <SelectorPlantillasWA
            canalId={canal.id}
            abierto={mostrarPlantillas}
            onCerrar={() => setMostrarPlantillas(false)}
            onEnviarPlantilla={handleEnviarPlantilla}
            enviando={enviando}
            contexto="visitas"
            contacto={datosContactoPreview}
            empresaNombre={empresaNombre}
            entidades={{
              visita: {
                fecha_programada: fechaISO,
                duracion_estimada_min: duracion,
                direccion_texto: visita.direccion_texto,
                motivo: visita.motivo,
              },
            }}
          />
        )}
      </div>
    </Modal>
  )
}
