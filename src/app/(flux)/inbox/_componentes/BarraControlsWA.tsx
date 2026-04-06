'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import { motion } from 'framer-motion'
import {
  User, UserCheck, UserPlus, Bot, Sparkles, Bell, BellOff,
  ChevronDown, Building2, Check,
} from 'lucide-react'
import { Popover } from '@/componentes/ui/Popover'
import { Tooltip } from '@/componentes/ui/Tooltip'
import { Avatar } from '@/componentes/ui/Avatar'
import { useAuth } from '@/hooks/useAuth'
import { crearClienteNavegador } from '@/lib/supabase/cliente'
import type { ConversacionConDetalles, Conversacion, EtapaConversacion } from '@/tipos/inbox'

/**
 * BarraControlsWA — Fila de controles interactivos (píldoras) debajo del header del chat WA.
 * Muestra: Agente, Sector, Contacto vinculado, Bot, IA, Seguir, y Etapa del pipeline.
 * Se usa en: PanelWhatsApp (justo debajo del header, antes de los mensajes).
 */

// ─── Props ───

interface PropiedadesBarraControlsWA {
  conversacion: ConversacionConDetalles
  onCambio: (cambios: Partial<Conversacion>) => void
  esMovil?: boolean
  onAbrirInfo?: () => void
}

// ─── Tipos auxiliares ───

interface MiembroEquipo {
  id: string
  usuario_id: string
  nombre: string
  apellido: string
  avatar_url: string | null
  puesto: string | null
  sector: string | null
}

interface SectorItem {
  id: string
  nombre: string
  color: string
}

type EstadoBot = 'activo' | 'pausado' | 'inactivo'

// ─── Utilidades ───

/** Determina el estado de bot/IA a partir de activo + pausado_hasta */
function calcularEstado(activo: boolean, pausadoHasta: string | null): EstadoBot {
  if (activo) return 'activo'
  if (pausadoHasta && new Date(pausadoHasta) > new Date()) return 'pausado'
  return 'inactivo'
}

/** Color del indicador según estado */
function colorIndicador(estado: EstadoBot, tipo: 'bot' | 'ia'): string {
  if (estado === 'activo') return tipo === 'ia' ? '#8b5cf6' : '#22c55e'
  if (estado === 'pausado') return '#f59e0b'
  return '#9ca3af'
}

// ─── Componente principal ───

export function BarraControlsWA({
  conversacion,
  onCambio,
  esMovil = false,
  onAbrirInfo,
}: PropiedadesBarraControlsWA) {
  const { usuario } = useAuth()

  // ─── Estado local ───
  const [miembros, setMiembros] = useState<MiembroEquipo[]>([])
  const [sectores, setSectores] = useState<SectorItem[]>([])
  const [etapas, setEtapas] = useState<EtapaConversacion[]>([])
  const [siguiendo, setSiguiendo] = useState(false)
  const [cargandoSeguir, setCargandoSeguir] = useState(false)

  // ─── Estados derivados de bot e IA ───
  const estadoBot = useMemo(
    () => calcularEstado(conversacion.chatbot_activo, conversacion.chatbot_pausado_hasta),
    [conversacion.chatbot_activo, conversacion.chatbot_pausado_hasta],
  )
  const estadoIA = useMemo(
    () => calcularEstado(conversacion.agente_ia_activo, conversacion.ia_pausado_hasta),
    [conversacion.agente_ia_activo, conversacion.ia_pausado_hasta],
  )

  // ─── Comprobar si el usuario sigue la conversación ───
  useEffect(() => {
    if (!conversacion.id || !usuario?.id) return
    // Usamos _seguida si viene del JOIN
    if (conversacion._seguida !== undefined) {
      setSiguiendo(conversacion._seguida)
      return
    }
    // Fallback: consultar endpoint
    fetch(`/api/inbox/conversaciones/${conversacion.id}/seguidores`)
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data?.seguidores) {
          setSiguiendo(data.seguidores.some((s: { usuario_id: string }) => s.usuario_id === usuario?.id))
        }
      })
      .catch(() => {})
  }, [conversacion.id, conversacion._seguida, usuario?.id])

  // ─── PATCH conversación — helper reutilizable ───
  const patchConversacion = useCallback(async (cambios: Partial<Conversacion>) => {
    onCambio(cambios)
    try {
      await fetch(`/api/inbox/conversaciones/${conversacion.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(cambios),
      })
    } catch {
      // El padre ya hizo optimistic update; si falla se podría revertir
    }
  }, [conversacion.id, onCambio])

  // ─── Cargar miembros al abrir popover agente ───
  const empresaId = usuario?.app_metadata?.empresa_activa_id
  const cargarMiembros = useCallback(async () => {
    if (miembros.length > 0 || !empresaId) return
    const supabase = crearClienteNavegador()
    // Paso 1: obtener miembros activos con puesto, sector y rol
    const { data: miembrosData } = await supabase
      .from('miembros')
      .select('id, usuario_id, puesto_nombre, sector, rol')
      .eq('empresa_id', empresaId)
      .eq('activo', true)
    if (!miembrosData || miembrosData.length === 0) return

    // Paso 2: obtener perfiles con nombres
    const ids = miembrosData.map(m => m.usuario_id)
    const { data: perfiles } = await supabase
      .from('perfiles')
      .select('id, nombre, apellido, avatar_url')
      .in('id', ids)

    // Paso 3: obtener sectores primarios de cada miembro
    const miembroIds = miembrosData.map(m => m.id)
    const { data: miembrosSectores } = await supabase
      .from('miembros_sectores')
      .select('miembro_id, sectores(nombre)')
      .in('miembro_id', miembroIds)
      .eq('es_primario', true)

    if (perfiles) {
      setMiembros(perfiles.map(p => {
        const miembro = miembrosData.find(m => m.usuario_id === p.id)
        // Buscar sector primario
        const ms = miembrosSectores?.find(s => s.miembro_id === miembro?.id)
        const sectorNombre = (ms?.sectores as unknown as { nombre: string } | null)?.nombre
          || (miembro?.sector as string)
          || null
        const rol = miembro?.rol as string || null
        return {
          id: p.id,
          usuario_id: p.id,
          nombre: p.nombre || '',
          apellido: p.apellido || '',
          avatar_url: p.avatar_url || null,
          puesto: (miembro?.puesto_nombre as string) || null,
          sector: sectorNombre || (rol && rol !== 'empleado' ? rol : null),
        }
      }))
    }
  }, [miembros.length, empresaId])

  // ─── Cargar sectores al abrir popover sector ───
  const cargarSectores = useCallback(async () => {
    if (sectores.length > 0 || !empresaId) return
    const supabase = crearClienteNavegador()
    const { data } = await supabase
      .from('sectores')
      .select('id, nombre, color')
      .eq('empresa_id', empresaId)
      .order('orden')
    if (data) setSectores(data as SectorItem[])
  }, [sectores.length, empresaId])

  // ─── Cargar etapas al abrir popover etapa ───
  const cargarEtapas = useCallback(async () => {
    if (etapas.length > 0) return
    try {
      const res = await fetch('/api/inbox/etapas?tipo_canal=whatsapp')
      if (res.ok) {
        const data = await res.json()
        setEtapas(data.etapas || data || [])
      }
    } catch {}
  }, [etapas.length])

  // ─── Toggle seguir ───
  const toggleSeguir = useCallback(async () => {
    if (cargandoSeguir) return
    setCargandoSeguir(true)
    const nuevoValor = !siguiendo
    setSiguiendo(nuevoValor)
    try {
      await fetch(`/api/inbox/conversaciones/${conversacion.id}/seguidores`, {
        method: nuevoValor ? 'POST' : 'DELETE',
        headers: { 'Content-Type': 'application/json' },
      })
    } catch {
      setSiguiendo(!nuevoValor)
    } finally {
      setCargandoSeguir(false)
    }
  }, [conversacion.id, siguiendo, cargandoSeguir])

  // ─── Determinar si el usuario es el agente asignado ───
  const esAgenteAsignado = usuario?.id === conversacion.asignado_a

  // ─── Cargar etapas al montar (para resolver nombre de la etapa actual) ───
  useEffect(() => {
    if (etapas.length > 0) return
    fetch('/api/inbox/etapas?tipo_canal=whatsapp')
      .then(r => r.json())
      .then(data => setEtapas(data.etapas || data || []))
      .catch(() => {})
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Etapa actual (buscar nombre de la lista de etapas) ───
  const etapaActual = useMemo(() => {
    if (!conversacion.etapa_id) return null
    // Primero buscar en las etapas cargadas
    const etapaCargada = etapas.find(e => e.id === conversacion.etapa_id)
    if (etapaCargada) {
      return { id: etapaCargada.id, etiqueta: etapaCargada.etiqueta, color: etapaCargada.color }
    }
    // Fallback a datos denormalizados de la conversación
    return {
      id: conversacion.etapa_id,
      etiqueta: conversacion.etapa_etiqueta || 'Cargando...',
      color: conversacion.etapa_color || '#6b7280',
    }
  }, [conversacion.etapa_id, conversacion.etapa_etiqueta, conversacion.etapa_color, etapas])

  // ─── Iniciales del agente ───
  const inicialesAgente = conversacion.asignado_a_nombre
    ? conversacion.asignado_a_nombre.split(' ').map(p => p[0]?.toUpperCase() || '').join('').slice(0, 2)
    : null

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: 'easeOut' }}
      className="inline-flex items-center gap-1 px-2 py-1 rounded-2xl"
      style={{
        background: 'color-mix(in srgb, var(--superficie-tarjeta) 80%, transparent)',
        backdropFilter: 'blur(12px) saturate(1.3)',
        WebkitBackdropFilter: 'blur(12px) saturate(1.3)',
        border: '1px solid color-mix(in srgb, var(--borde-sutil) 60%, transparent)',
        boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
      }}
    >
        {/* Pildora Agente */}
        <Popover
          alineacion="inicio"
          ancho={260}
          altoMaximo={320}
          contenido={
            <div className="py-1">
              <p className="px-3 py-1.5 text-xxs font-medium" style={{ color: 'var(--texto-terciario)' }}>
                Agente responsable de esta conversacion
              </p>
              {/* Sin agente */}
              <button
                type="button"
                className="w-full flex items-center gap-2 px-3 py-2 text-xs hover:bg-[var(--superficie-hover)] transition-colors cursor-pointer"
                style={{ color: 'var(--texto-secundario)', border: 'none', background: 'transparent' }}
                onClick={() => patchConversacion({ asignado_a: null, asignado_a_nombre: null })}
              >
                <div className="size-6 rounded-full flex items-center justify-center" style={{ background: 'var(--superficie-hover)' }}>
                  <User size={12} />
                </div>
                <span>Sin agente</span>
                {!conversacion.asignado_a && <Check size={14} className="ml-auto" style={{ color: 'var(--insignia-exito)' }} />}
              </button>
              {miembros.length === 0 && (
                <p className="px-3 py-2 text-xxs" style={{ color: 'var(--texto-terciario)' }}>Cargando miembros...</p>
              )}
              {(() => {
                // Agrupar miembros por sector
                const grupos = new Map<string, MiembroEquipo[]>()
                for (const m of miembros) {
                  const grupo = m.sector || 'Sin sector'
                  if (!grupos.has(grupo)) grupos.set(grupo, [])
                  grupos.get(grupo)!.push(m)
                }
                return Array.from(grupos.entries()).map(([sector, miembrosGrupo]) => (
                  <div key={sector}>
                    <p className="px-3 pt-2 pb-1 text-xxs font-semibold uppercase tracking-wider" style={{ color: 'var(--texto-terciario)' }}>
                      {sector}
                    </p>
                    {miembrosGrupo.map((m) => (
                      <button
                        type="button"
                        key={m.usuario_id}
                        className="w-full flex items-center gap-2 px-3 py-2 text-xs text-left hover:bg-[var(--superficie-hover)] transition-colors cursor-pointer"
                        style={{ color: 'var(--texto-primario)', border: 'none', background: 'transparent' }}
                        onClick={() => patchConversacion({
                          asignado_a: m.usuario_id,
                          asignado_a_nombre: `${m.nombre} ${m.apellido}`.trim(),
                        })}
                      >
                        <Avatar nombre={`${m.nombre} ${m.apellido}`} foto={m.avatar_url} tamano="xs" />
                        <div className="flex-1 min-w-0 text-left">
                          <span className="truncate block">{m.nombre} {m.apellido}</span>
                          {m.puesto && (
                            <span className="text-xxs block truncate" style={{ color: 'var(--texto-terciario)' }}>
                              {m.puesto}
                            </span>
                          )}
                        </div>
                        {conversacion.asignado_a === m.usuario_id && (
                          <Check size={14} className="ml-auto flex-shrink-0" style={{ color: 'var(--insignia-exito)' }} />
                        )}
                      </button>
                    ))}
                  </div>
                ))
              })()}
            </div>
          }
          onCambio={(abierto) => { if (abierto) cargarMiembros() }}
        >
          <Tooltip contenido={conversacion.asignado_a_nombre || 'Sin agente'}>
            <div
              className="h-7 px-2.5 rounded-full flex items-center gap-1.5 text-xs font-medium cursor-pointer transition-colors"
              style={{
                background: conversacion.asignado_a
                  ? 'color-mix(in srgb, #0ea5e9 15%, transparent)'
                  : 'var(--superficie-hover)',
                color: conversacion.asignado_a ? '#0ea5e9' : 'var(--texto-terciario)',
              }}
            >
              <User size={12} />
              <span>{inicialesAgente || 'Sin'}</span>
            </div>
          </Tooltip>
        </Popover>

        {/* Pildora Sector */}
        <Popover
          alineacion="inicio"
          ancho={240}
          altoMaximo={300}
          contenido={
            <div className="py-1">
              <p className="px-3 py-1.5 text-xxs font-medium" style={{ color: 'var(--texto-terciario)' }}>
                Sector asignado
              </p>
              <button
                type="button"
                className="w-full flex items-center gap-2 px-3 py-2 text-xs hover:bg-[var(--superficie-hover)] transition-colors cursor-pointer"
                style={{ color: 'var(--texto-secundario)', border: 'none', background: 'transparent' }}
                onClick={() => patchConversacion({ sector_id: null, sector_nombre: null, sector_color: null })}
              >
                <div className="size-3 rounded-full" style={{ background: '#9ca3af' }} />
                <span>Sin sector</span>
                {!conversacion.sector_id && <Check size={14} className="ml-auto" style={{ color: 'var(--insignia-exito)' }} />}
              </button>
              {sectores.length === 0 && (
                <p className="px-3 py-2 text-xxs" style={{ color: 'var(--texto-terciario)' }}>Cargando sectores...</p>
              )}
              {sectores.map((s) => (
                <button
                  type="button"
                  key={s.id}
                  className="w-full flex items-center gap-2 px-3 py-2 text-xs hover:bg-[var(--superficie-hover)] transition-colors cursor-pointer"
                  style={{ color: 'var(--texto-primario)', border: 'none', background: 'transparent' }}
                  onClick={() => patchConversacion({ sector_id: s.id, sector_nombre: s.nombre, sector_color: s.color })}
                >
                  <div className="size-3 rounded-full flex-shrink-0" style={{ background: s.color }} />
                  <span className="truncate">{s.nombre}</span>
                  {conversacion.sector_id === s.id && (
                    <Check size={14} className="ml-auto flex-shrink-0" style={{ color: 'var(--insignia-exito)' }} />
                  )}
                </button>
              ))}
            </div>
          }
          onCambio={(abierto) => { if (abierto) cargarSectores() }}
        >
          <Tooltip contenido={conversacion.sector_nombre || 'Sin sector'}>
            <div
              className="h-7 px-2.5 rounded-full flex items-center gap-1.5 text-xs font-medium cursor-pointer transition-colors"
              style={{
                background: conversacion.sector_id
                  ? `color-mix(in srgb, ${conversacion.sector_color || '#6366f1'} 15%, transparent)`
                  : 'var(--superficie-hover)',
                color: conversacion.sector_id ? (conversacion.sector_color || '#6366f1') : 'var(--texto-terciario)',
              }}
            >
              <Building2 size={12} />
              <span className="truncate max-w-[60px]">{conversacion.sector_nombre || 'Sin'}</span>
            </div>
          </Tooltip>
        </Popover>

        {/* Separador izq */}
        <div className="w-px h-5 mx-0.5 flex-shrink-0" style={{ background: 'color-mix(in srgb, var(--borde-sutil) 60%, transparent)' }} />

        {/* Etapa — centrada */}
        <Popover
          alineacion="centro"
          ancho={240}
          altoMaximo={360}
          contenido={
            <div className="py-1">
              <p className="px-3 py-1.5 text-xxs font-medium" style={{ color: 'var(--texto-terciario)' }}>Etapa del pipeline</p>
              <button type="button" className="w-full flex items-center gap-2 px-3 py-2 text-xs hover:bg-[var(--superficie-hover)] transition-colors cursor-pointer"
                style={{ color: 'var(--texto-secundario)', border: 'none', background: 'transparent' }}
                onClick={() => patchConversacion({ etapa_id: null })}>
                <div className="size-3 rounded-full" style={{ background: '#9ca3af' }} />
                <span>Sin etapa</span>
                {!conversacion.etapa_id && <Check size={14} className="ml-auto" style={{ color: 'var(--insignia-exito)' }} />}
              </button>
              {etapas.filter(e => e.activa).map((e) => (
                <button type="button" key={e.id} className="w-full flex items-center gap-2 px-3 py-2 text-xs hover:bg-[var(--superficie-hover)] transition-colors cursor-pointer"
                  style={{ color: 'var(--texto-primario)', border: 'none', background: 'transparent' }}
                  onClick={() => patchConversacion({ etapa_id: e.id })}>
                  <div className="size-3 rounded-full flex-shrink-0" style={{ background: e.color }} />
                  <span>{e.icono} {e.etiqueta}</span>
                  {conversacion.etapa_id === e.id && <Check size={14} className="ml-auto flex-shrink-0" style={{ color: 'var(--insignia-exito)' }} />}
                </button>
              ))}
            </div>
          }
          onCambio={(abierto) => { if (abierto) cargarEtapas() }}
        >
          <motion.button
            className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold cursor-pointer"
            style={{ background: etapaActual ? etapaActual.color : '#9ca3af', color: '#fff' }}
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
          >
            {etapaActual ? etapaActual.etiqueta : 'Sin etapa'}
            <ChevronDown size={11} />
          </motion.button>
        </Popover>

        {/* Separador der */}
        <div className="w-px h-5 mx-0.5 flex-shrink-0" style={{ background: 'color-mix(in srgb, var(--borde-sutil) 60%, transparent)' }} />

        {/* Bot */}
        <Popover
          alineacion="centro"
          ancho={200}
          contenido={
            <div className="py-1">
              <p className="px-3 py-1.5 text-xxs font-medium" style={{ color: 'var(--texto-terciario)' }}>
                Estado del chatbot
              </p>
              {([
                { etiqueta: 'Activo', estado: 'activo' as const, cambios: { chatbot_activo: true, chatbot_pausado_hasta: null, agente_ia_activo: false, ia_pausado_hasta: null } },
                { etiqueta: 'Pausado 1h', estado: 'pausado' as const, cambios: { chatbot_activo: false, chatbot_pausado_hasta: new Date(Date.now() + 3600_000).toISOString() } },
                { etiqueta: 'Pausado 24h', estado: 'pausado' as const, cambios: { chatbot_activo: false, chatbot_pausado_hasta: new Date(Date.now() + 86400_000).toISOString() } },
                { etiqueta: 'Inactivo', estado: 'inactivo' as const, cambios: { chatbot_activo: false, chatbot_pausado_hasta: null } },
              ]).map((opcion) => (
                <button
                  key={opcion.etiqueta}
                  className="w-full flex items-center gap-2 px-3 py-2 text-xs hover:bg-[var(--superficie-hover)] transition-colors cursor-pointer"
                  style={{ color: 'var(--texto-primario)', border: 'none', background: 'transparent' }}
                  onClick={() => patchConversacion(opcion.cambios)}
                >
                  <div className="size-2 rounded-full flex-shrink-0" style={{ background: colorIndicador(opcion.estado, 'bot') }} />
                  <span>{opcion.etiqueta}</span>
                </button>
              ))}
            </div>
          }
        >
          <Tooltip contenido={`Bot: ${estadoBot}`}>
            <div
              className="h-7 rounded-full flex items-center gap-1.5 cursor-pointer transition-colors"
              style={{
                padding: esMovil ? '0 0.4rem' : '0 0.625rem',
                background: estadoBot !== 'inactivo'
                  ? `color-mix(in srgb, ${colorIndicador(estadoBot, 'bot')} 15%, transparent)`
                  : 'var(--superficie-hover)',
                color: estadoBot !== 'inactivo' ? colorIndicador(estadoBot, 'bot') : 'var(--texto-terciario)',
              }}
            >
              <Bot size={12} />
              {!esMovil && <span className="text-xs font-medium">Bot</span>}
            </div>
          </Tooltip>
        </Popover>

        {/* Pildora IA */}
        <Popover
          alineacion="centro"
          ancho={200}
          contenido={
            <div className="py-1">
              <p className="px-3 py-1.5 text-xxs font-medium" style={{ color: 'var(--texto-terciario)' }}>
                Estado del agente IA
              </p>
              {([
                { etiqueta: 'Activo', estado: 'activo' as const, cambios: { agente_ia_activo: true, ia_pausado_hasta: null, chatbot_activo: false, chatbot_pausado_hasta: null } },
                { etiqueta: 'Pausado 1h', estado: 'pausado' as const, cambios: { agente_ia_activo: false, ia_pausado_hasta: new Date(Date.now() + 3600_000).toISOString() } },
                { etiqueta: 'Pausado 8h', estado: 'pausado' as const, cambios: { agente_ia_activo: false, ia_pausado_hasta: new Date(Date.now() + 28800_000).toISOString() } },
                { etiqueta: 'Inactivo', estado: 'inactivo' as const, cambios: { agente_ia_activo: false, ia_pausado_hasta: null } },
              ]).map((opcion) => (
                <button
                  key={opcion.etiqueta}
                  className="w-full flex items-center gap-2 px-3 py-2 text-xs hover:bg-[var(--superficie-hover)] transition-colors cursor-pointer"
                  style={{ color: 'var(--texto-primario)', border: 'none', background: 'transparent' }}
                  onClick={() => patchConversacion(opcion.cambios)}
                >
                  <div
                    className="size-2 rounded-full flex-shrink-0"
                    style={{ background: colorIndicador(opcion.estado, 'ia') }}
                  />
                  <span>{opcion.etiqueta}</span>
                </button>
              ))}
            </div>
          }
        >
          <Tooltip contenido={`IA: ${estadoIA}`}>
            <div
              className="h-7 rounded-full flex items-center gap-1.5 cursor-pointer transition-colors"
              style={{
                padding: esMovil ? '0 0.4rem' : '0 0.625rem',
                background: estadoIA !== 'inactivo'
                  ? `color-mix(in srgb, ${colorIndicador(estadoIA, 'ia')} 15%, transparent)`
                  : 'var(--superficie-hover)',
                color: estadoIA !== 'inactivo' ? colorIndicador(estadoIA, 'ia') : 'var(--texto-terciario)',
              }}
            >
              <Sparkles size={12} />
              {!esMovil && <span className="text-xs font-medium">IA</span>}
            </div>
          </Tooltip>
        </Popover>

        {/* Seguir */}
        {!esAgenteAsignado && (
          <Tooltip contenido={siguiendo ? 'Dejar de seguir' : 'Seguir conversacion'}>
            <div
              className="size-7 rounded-full flex items-center justify-center cursor-pointer transition-colors"
              style={{
                background: siguiendo ? 'color-mix(in srgb, var(--texto-marca) 15%, transparent)' : 'var(--superficie-hover)',
                color: siguiendo ? 'var(--texto-marca)' : 'var(--texto-terciario)',
              }}
              onClick={toggleSeguir}
            >
              {siguiendo ? <Bell size={13} /> : <BellOff size={13} />}
            </div>
          </Tooltip>
        )}

    </motion.div>
  )
}

// ─── Pildora genérica reutilizable ───

interface PropiedadesPildora {
  children: React.ReactNode
  activa?: boolean
  colorTinte?: string
}

/**
 * PildoraControl — Botón tipo pill reutilizable para la barra de controles.
 * Muestra un fondo tintado cuando está activa, gris cuando no.
 */
function PildoraControl({ children, activa = false, colorTinte }: PropiedadesPildora) {
  const bgColor = activa && colorTinte
    ? `color-mix(in srgb, ${colorTinte} 12%, transparent)`
    : 'var(--superficie-hover)'
  const textColor = activa && colorTinte
    ? colorTinte
    : 'var(--texto-secundario)'

  return (
    <div
      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium cursor-pointer transition-all min-h-[36px] select-none hover:brightness-95"
      style={{
        background: bgColor,
        color: textColor,
      }}
    >
      {children}
    </div>
  )
}
