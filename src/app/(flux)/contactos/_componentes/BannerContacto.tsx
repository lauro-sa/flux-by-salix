'use client'

import { useState, useRef, useEffect } from 'react'
import Image from 'next/image'
import { motion } from 'framer-motion'
import {
  Building2, Building, User, Truck, UserPlus, BadgeCheck, ChevronDown, MoreVertical,
} from 'lucide-react'
import { Boton } from '@/componentes/ui/Boton'
import { Tooltip } from '@/componentes/ui/Tooltip'
import { OpcionMenu } from '@/componentes/ui/OpcionMenu'
import { COLOR_TIPO_CONTACTO } from '@/lib/colores_entidad'
import type { TipoContacto } from '@/tipos'

// Iconos por tipo
const ICONOS_TIPO: Record<string, typeof User> = {
  persona: User, empresa: Building2, edificio: Building,
  proveedor: Truck, lead: UserPlus, equipo: BadgeCheck,
}

/** Colores sólidos para el degradado del banner */
const COLORES_BANNER: Record<string, [string, string]> = {
  persona:   ['#5b5bd6', '#7c7ce0'],  // índigo
  empresa:   ['#2563eb', '#4f8af7'],  // azul
  edificio:  ['#0e7490', '#0891b2'],  // cyan/verdecito
  proveedor: ['#c2410c', '#ea580c'],  // naranja
  lead:      ['#b45309', '#d97706'],  // ámbar
  equipo:    ['#047857', '#059669'],  // verde oscuro → verde
}

interface PropsBannerContacto {
  /** Nombre completo del contacto (para las iniciales del avatar) */
  nombre: string
  /** Código del contacto (C-0001). Null si es nuevo. */
  codigo: string | null
  /** URL de foto de perfil */
  avatarUrl?: string | null
  /** Tipo de contacto activo */
  tipoActivo: TipoContacto | null
  /** Clave del tipo activo */
  claveTipo: string
  /** Lista de tipos disponibles (para el selector) */
  tiposContacto: TipoContacto[]
  /** Si se puede cambiar el tipo (true en creación, false en edición normalmente) */
  puedeEditar?: boolean
  /** Callback al cambiar tipo */
  onCambiarTipo?: (tipoId: string) => void
  /** Callback al subir foto */
  onSubirFoto?: (archivo: File) => void
  /** Acciones del menú de 3 puntitos */
  acciones?: { id: string; etiqueta: string; icono?: React.ReactNode; peligro?: boolean; onClick: () => void }[]
}

/**
 * BannerContacto — Cabecero visual con degradado por tipo, avatar glass y selector.
 * Se usa en: /contactos/nuevo y /contactos/[id].
 */
export function BannerContacto({
  nombre,
  codigo,
  tipoActivo,
  claveTipo,
  tiposContacto,
  puedeEditar = true,
  onCambiarTipo,
  avatarUrl,
  onSubirFoto,
  acciones,
}: PropsBannerContacto) {
  const refInputFoto = useRef<HTMLInputElement>(null)
  const [menuAbierto, setMenuAbierto] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  // Cerrar menú al click fuera
  useEffect(() => {
    if (!menuAbierto) return
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuAbierto(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [menuAbierto])
  const colores = COLORES_BANNER[claveTipo] || COLORES_BANNER.persona
  const esPersona = ['persona', 'lead', 'equipo'].includes(claveTipo)
  const tieneNombre = nombre.trim().length > 0
  const iniciales = obtenerIniciales(nombre || '?')

  // Icono del tipo (edificio usa Building, empresa Building2, etc.)
  const ICONOS_AVATAR: Record<string, typeof User> = {
    persona: User, empresa: Building2, edificio: Building,
    proveedor: Truck, lead: UserPlus, equipo: BadgeCheck,
  }
  const IconoAvatar = ICONOS_AVATAR[claveTipo] || User

  // Qué mostrar en el avatar: foto > iniciales (solo personas con nombre) > icono del tipo
  const contenidoAvatar = esPersona && tieneNombre ? iniciales : null

  return (
    <div className="relative mx-4 sm:mx-6 mt-4 mb-10">
      {/* Degradado de fondo */}
      <motion.div
        key={claveTipo}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3 }}
        className="rounded-xl overflow-hidden"
        style={{
          height: 110,
          background: `linear-gradient(135deg, ${colores[0]} 0%, ${colores[1]} 100%)`,
        }}
      >
        {/* Código arriba derecha — siempre visible */}
        <div className="absolute top-3 right-4">
          <span className={`text-xl font-mono font-bold tracking-wider ${codigo ? 'text-white/60' : 'text-white/25'}`}>
            {codigo || 'C-····'}
          </span>
        </div>

        {/* Selector de tipo + menú — abajo derecha */}
        <div className="absolute bottom-3 right-4 flex items-center gap-1.5">
          {tipoActivo && (
            <SelectorTipo
              tipoActivo={tipoActivo}
              claveTipo={claveTipo}
              tiposContacto={tiposContacto}
              puedeEditar={puedeEditar}
              onCambiar={onCambiarTipo}
            />
          )}
          {acciones && acciones.length > 0 && (
            <div ref={menuRef} className="relative">
              <Boton variante="fantasma" tamano="xs" soloIcono titulo="Más opciones" icono={<MoreVertical size={14} />} onClick={() => setMenuAbierto(!menuAbierto)} className="bg-white/10 hover:bg-white/20 backdrop-blur-sm text-white/80" />

              {menuAbierto && (
                <div className="absolute top-full right-0 mt-1 py-1 rounded-lg border border-borde-sutil shadow-lg z-50 min-w-40 overflow-hidden"
                  style={{ backgroundColor: 'var(--superficie-elevada)' }}>
                  {acciones.map(acc => (
                    <OpcionMenu key={acc.id} icono={acc.icono} peligro={acc.peligro} onClick={() => { acc.onClick(); setMenuAbierto(false) }}>
                      {acc.etiqueta}
                    </OpcionMenu>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </motion.div>

      {/* Avatar glass — sobresale del banner, clickeable para subir foto */}
      <div className="absolute -bottom-9 left-5">
        <Tooltip contenido="Cambiar foto" deshabilitado={!onSubirFoto}>
        <button
          type="button"
          onClick={() => onSubirFoto && refInputFoto.current?.click()}
          className={`rounded-full flex items-center justify-center font-bold border-none focus-visible:outline-2 focus-visible:outline-white focus-visible:-outline-offset-2 ${onSubirFoto ? 'cursor-pointer hover:opacity-90' : 'cursor-default'} transition-opacity`}
          style={{
            width: 80,
            height: 80,
            fontSize: 'var(--texto-2xl)',
            letterSpacing: 1,
            backgroundColor: avatarUrl ? 'transparent' : `color-mix(in srgb, ${colores[0]} 55%, transparent)`,
            backdropFilter: avatarUrl ? undefined : 'blur(20px) saturate(1.8)',
            WebkitBackdropFilter: avatarUrl ? undefined : 'blur(20px) saturate(1.8)',
            border: '3px solid color-mix(in srgb, var(--texto-inverso) 18%, transparent)',
            color: 'color-mix(in srgb, var(--texto-inverso) 90%, transparent)',
            boxShadow: 'var(--sombra-lg)',
            overflow: 'hidden',
          }}
        >
          {avatarUrl ? (
            <Image src={avatarUrl} alt={nombre} width={72} height={72} className="w-full h-full object-cover" unoptimized={avatarUrl.startsWith('data:')} />
          ) : contenidoAvatar ? (
            contenidoAvatar
          ) : (
            <IconoAvatar size={30} />
          )}
        </button>
        </Tooltip>
        {onSubirFoto && (
          <input ref={refInputFoto} type="file" accept="image/*" className="hidden"
            onChange={e => { const f = e.target.files?.[0]; if (f) onSubirFoto(f); e.target.value = '' }} />
        )}
      </div>
    </div>
  )
}

// ─── Selector de tipo (dropdown compacto dentro del banner) ───

function SelectorTipo({
  tipoActivo,
  claveTipo,
  tiposContacto,
  puedeEditar,
  onCambiar,
}: {
  tipoActivo: TipoContacto
  claveTipo: string
  tiposContacto: TipoContacto[]
  puedeEditar: boolean
  onCambiar?: (tipoId: string) => void
}) {
  const [abierto, setAbierto] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const Icono = ICONOS_TIPO[claveTipo] || User

  // Cerrar al click fuera
  useEffect(() => {
    if (!abierto) return
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setAbierto(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [abierto])

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => puedeEditar && setAbierto(!abierto)}
        className={[
          'flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-colors border-none focus-visible:outline-2 focus-visible:outline-white focus-visible:-outline-offset-2',
          'bg-white/10 backdrop-blur-sm text-white/90',
          puedeEditar ? 'cursor-pointer hover:bg-white/20' : 'cursor-default',
        ].join(' ')}
      >
        <Icono size={13} />
        <span>{tipoActivo.etiqueta}</span>
        {puedeEditar && <ChevronDown size={12} className={`transition-transform ${abierto ? 'rotate-180' : ''}`} />}
      </button>

      {abierto && (
        <div className="absolute top-full right-0 mt-1 py-1 rounded-lg border border-borde-sutil shadow-lg z-50 min-w-36 overflow-hidden"
          style={{ backgroundColor: 'var(--superficie-elevada)' }}>
          {tiposContacto.filter(t => t.clave !== 'equipo').map(tipo => {
            const Ic = ICONOS_TIPO[tipo.clave] || User
            const activo = tipo.id === tipoActivo.id
            return (
              <OpcionMenu key={tipo.id} icono={<Ic size={14} />} activo={activo} onClick={() => { onCambiar?.(tipo.id); setAbierto(false) }}>
                {tipo.etiqueta}
              </OpcionMenu>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ─── Helper ───

function obtenerIniciales(nombre: string): string {
  const partes = nombre.trim().split(/\s+/).filter(Boolean)
  if (partes.length === 0) return '?'
  if (partes.length >= 2) return (partes[0][0] + partes[partes.length - 1][0]).toUpperCase()
  return nombre.slice(0, 2).toUpperCase()
}

