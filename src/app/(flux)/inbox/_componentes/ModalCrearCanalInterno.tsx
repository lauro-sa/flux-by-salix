'use client'

import { useState, useEffect, useCallback } from 'react'
import { Modal } from '@/componentes/ui/Modal'
import { Boton } from '@/componentes/ui/Boton'
import { Avatar } from '@/componentes/ui/Avatar'
import { Hash, Lock, Users, MessageCircle, X, Building2, Search } from 'lucide-react'
import { useToast } from '@/componentes/feedback/Toast'
import type { TipoCanalInterno } from '@/tipos/inbox'

/**
 * Modal para crear canal, grupo o DM interno.
 * Soporta selección de miembros individuales y por sector.
 */

interface PropiedadesModal {
  abierto: boolean
  onCerrar: () => void
  onCreado: () => void
}

interface UsuarioBuscable {
  id: string
  nombre: string
  apellido: string
  avatar_url: string | null
}

interface SectorBuscable {
  id: string
  nombre: string
  color: string
  cantidadMiembros: number
}

export function ModalCrearCanalInterno({ abierto, onCerrar, onCreado }: PropiedadesModal) {
  const { mostrar } = useToast()
  const [tipo, setTipo] = useState<TipoCanalInterno>('grupo')
  const [nombre, setNombre] = useState('')
  const [descripcion, setDescripcion] = useState('')
  const [busqueda, setBusqueda] = useState('')
  const [miembrosSeleccionados, setMiembrosSeleccionados] = useState<UsuarioBuscable[]>([])
  const [sectoresSeleccionados, setSectoresSeleccionados] = useState<SectorBuscable[]>([])
  const [usuarios, setUsuarios] = useState<UsuarioBuscable[]>([])
  const [sectores, setSectores] = useState<SectorBuscable[]>([])
  const [cargando, setCargando] = useState(false)
  const [creando, setCreando] = useState(false)

  // Cargar usuarios y sectores al abrir
  useEffect(() => {
    if (!abierto) return
    const cargar = async () => {
      setCargando(true)
      try {
        const [resUsuarios, resSectores] = await Promise.all([
          fetch('/api/miembros?activo=true'),
          fetch('/api/configuracion/estructura'),
        ])
        const dataUsuarios = await resUsuarios.json()
        const dataSectores = await resSectores.json()

        setUsuarios(
          (dataUsuarios.miembros || []).map((m: Record<string, unknown>) => ({
            id: m.usuario_id as string,
            nombre: m.nombre as string || '',
            apellido: m.apellido as string || '',
            avatar_url: m.avatar_url as string | null,
          }))
        )

        setSectores(
          (dataSectores.sectores || []).map((s: Record<string, unknown>) => ({
            id: s.id as string,
            nombre: s.nombre as string,
            color: s.color as string || '#6366f1',
            cantidadMiembros: 0,
          }))
        )
      } catch { /* silenciar */ }
      setCargando(false)
    }
    cargar()
  }, [abierto])

  // Reset al cerrar
  useEffect(() => {
    if (!abierto) {
      setTipo('grupo')
      setNombre('')
      setDescripcion('')
      setBusqueda('')
      setMiembrosSeleccionados([])
      setSectoresSeleccionados([])
    }
  }, [abierto])

  const toggleMiembro = useCallback((usuario: UsuarioBuscable) => {
    setMiembrosSeleccionados(prev => {
      const existe = prev.some(m => m.id === usuario.id)
      return existe ? prev.filter(m => m.id !== usuario.id) : [...prev, usuario]
    })
  }, [])

  const toggleSector = useCallback((sector: SectorBuscable) => {
    setSectoresSeleccionados(prev => {
      const existe = prev.some(s => s.id === sector.id)
      return existe ? prev.filter(s => s.id !== sector.id) : [...prev, sector]
    })
  }, [])

  const usuariosFiltrados = busqueda
    ? usuarios.filter(u =>
        `${u.nombre} ${u.apellido}`.toLowerCase().includes(busqueda.toLowerCase())
      )
    : usuarios

  const sectoresFiltrados = busqueda
    ? sectores.filter(s => s.nombre.toLowerCase().includes(busqueda.toLowerCase()))
    : sectores

  const crear = async () => {
    if (!nombre.trim() && tipo !== 'directo') {
      mostrar('error', 'El nombre es requerido')
      return
    }
    if (miembrosSeleccionados.length === 0 && sectoresSeleccionados.length === 0) {
      mostrar('error', 'Seleccioná al menos un miembro o sector')
      return
    }

    setCreando(true)
    try {
      const res = await fetch('/api/inbox/internos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nombre: nombre.trim(),
          descripcion: descripcion.trim() || undefined,
          tipo,
          miembros: miembrosSeleccionados.map(m => m.id),
          sector_ids: sectoresSeleccionados.map(s => s.id),
        }),
      })

      if (res.ok) {
        mostrar('exito', tipo === 'grupo' ? 'Grupo creado' : 'Canal creado')
        onCreado()
        onCerrar()
      } else {
        const data = await res.json()
        mostrar('error', data.error || 'Error al crear')
      }
    } catch {
      mostrar('error', 'Error de conexión')
    }
    setCreando(false)
  }

  const TIPOS_CANAL: { clave: TipoCanalInterno; etiqueta: string; icono: React.ReactNode; desc: string }[] = [
    { clave: 'grupo', etiqueta: 'Grupo', icono: <Users size={14} />, desc: 'Cualquiera puede salir' },
    { clave: 'publico', etiqueta: 'Canal público', icono: <Hash size={14} />, desc: 'Visible para todos (admin)' },
    { clave: 'privado', etiqueta: 'Canal privado', icono: <Lock size={14} />, desc: 'Solo invitados (admin)' },
  ]

  return (
    <Modal abierto={abierto} onCerrar={onCerrar} titulo="Crear canal o grupo" tamano="md">
      <div className="space-y-4">
        {/* Selector de tipo */}
        <div>
          <label className="text-xs font-medium mb-1.5 block" style={{ color: 'var(--texto-secundario)' }}>Tipo</label>
          <div className="flex gap-2">
            {TIPOS_CANAL.map(t => (
              <button
                key={t.clave}
                onClick={() => setTipo(t.clave)}
                className="flex-1 flex flex-col items-center gap-1 p-3 rounded-lg text-xs transition-colors"
                style={{
                  border: tipo === t.clave ? '2px solid var(--texto-marca)' : '1px solid var(--borde-sutil)',
                  background: tipo === t.clave ? 'var(--superficie-seleccionada)' : 'var(--superficie-tarjeta)',
                  color: tipo === t.clave ? 'var(--texto-marca)' : 'var(--texto-secundario)',
                }}
              >
                {t.icono}
                <span className="font-medium">{t.etiqueta}</span>
                <span className="text-xxs" style={{ color: 'var(--texto-terciario)' }}>{t.desc}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Nombre y descripción */}
        <div className="space-y-2">
          <div>
            <label className="text-xs font-medium mb-1 block" style={{ color: 'var(--texto-secundario)' }}>Nombre</label>
            <input
              value={nombre}
              onChange={e => setNombre(e.target.value)}
              placeholder={tipo === 'grupo' ? 'Nombre del grupo' : 'Nombre del canal'}
              className="w-full px-3 py-2 rounded-lg text-sm"
              style={{ background: 'var(--superficie-app)', color: 'var(--texto-primario)', border: '1px solid var(--borde-sutil)' }}
            />
          </div>
          {tipo !== 'grupo' && (
            <div>
              <label className="text-xs font-medium mb-1 block" style={{ color: 'var(--texto-secundario)' }}>Descripción</label>
              <input
                value={descripcion}
                onChange={e => setDescripcion(e.target.value)}
                placeholder="Descripción (opcional)"
                className="w-full px-3 py-2 rounded-lg text-sm"
                style={{ background: 'var(--superficie-app)', color: 'var(--texto-primario)', border: '1px solid var(--borde-sutil)' }}
              />
            </div>
          )}
        </div>

        {/* Buscador de miembros */}
        <div>
          <label className="text-xs font-medium mb-1.5 block" style={{ color: 'var(--texto-secundario)' }}>
            Miembros
          </label>

          {/* Chips de seleccionados */}
          {(miembrosSeleccionados.length > 0 || sectoresSeleccionados.length > 0) && (
            <div className="flex flex-wrap gap-1 mb-2">
              {sectoresSeleccionados.map(s => (
                <span
                  key={`s-${s.id}`}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs"
                  style={{ background: 'var(--insignia-info-fondo)', color: 'var(--insignia-info-texto)' }}
                >
                  <Building2 size={10} /> {s.nombre}
                  <button onClick={() => toggleSector(s)} aria-label={`Quitar sector ${s.nombre}`}><X size={10} /></button>
                </span>
              ))}
              {miembrosSeleccionados.map(m => (
                <span
                  key={`m-${m.id}`}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs"
                  style={{ background: 'var(--superficie-hover)', color: 'var(--texto-secundario)' }}
                >
                  {m.nombre} {m.apellido}
                  <button onClick={() => toggleMiembro(m)} aria-label={`Quitar ${m.nombre}`}><X size={10} /></button>
                </span>
              ))}
            </div>
          )}

          {/* Input de búsqueda */}
          <div className="relative mb-2">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2" style={{ color: 'var(--texto-terciario)' }} />
            <input
              type="text"
              value={busqueda}
              onChange={e => setBusqueda(e.target.value)}
              placeholder="Buscar personas o sectores..."
              className="w-full pl-8 pr-3 py-2 rounded-lg text-sm"
              style={{
                background: 'var(--superficie-app)',
                color: 'var(--texto-primario)',
                border: '1px solid var(--borde-sutil)',
              }}
            />
          </div>

          {/* Lista de sectores */}
          {sectoresFiltrados.length > 0 && (
            <div className="mb-2">
              <p className="text-xxs font-semibold uppercase px-1 mb-1" style={{ color: 'var(--texto-terciario)' }}>Sectores</p>
              <div className="max-h-24 overflow-y-auto space-y-0.5">
                {sectoresFiltrados.map(s => {
                  const sel = sectoresSeleccionados.some(ss => ss.id === s.id)
                  return (
                    <button
                      key={s.id}
                      onClick={() => toggleSector(s)}
                      className="w-full flex items-center gap-2 px-2 py-1.5 rounded text-xs transition-colors"
                      style={{
                        background: sel ? 'var(--superficie-seleccionada)' : 'transparent',
                        color: sel ? 'var(--texto-marca)' : 'var(--texto-secundario)',
                      }}
                    >
                      <div className="w-3 h-3 rounded-sm" style={{ background: s.color }} />
                      <span className="flex-1 text-left">{s.nombre}</span>
                      {sel && <span style={{ color: 'var(--texto-marca)' }}>✓</span>}
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {/* Lista de usuarios */}
          <div>
            <p className="text-xxs font-semibold uppercase px-1 mb-1" style={{ color: 'var(--texto-terciario)' }}>Personas</p>
            <div className="max-h-40 overflow-y-auto space-y-0.5">
              {cargando ? (
                <p className="text-xs px-2 py-4 text-center" style={{ color: 'var(--texto-terciario)' }}>Cargando...</p>
              ) : usuariosFiltrados.length === 0 ? (
                <p className="text-xs px-2 py-4 text-center" style={{ color: 'var(--texto-terciario)' }}>Sin resultados</p>
              ) : (
                usuariosFiltrados.map(u => {
                  const sel = miembrosSeleccionados.some(m => m.id === u.id)
                  return (
                    <button
                      key={u.id}
                      onClick={() => toggleMiembro(u)}
                      className="w-full flex items-center gap-2 px-2 py-1.5 rounded text-xs transition-colors"
                      style={{
                        background: sel ? 'var(--superficie-seleccionada)' : 'transparent',
                        color: sel ? 'var(--texto-marca)' : 'var(--texto-secundario)',
                      }}
                    >
                      <Avatar nombre={`${u.nombre} ${u.apellido}`} tamano="xs" />
                      <span className="flex-1 text-left">{u.nombre} {u.apellido}</span>
                      {sel && <span style={{ color: 'var(--texto-marca)' }}>✓</span>}
                    </button>
                  )
                })
              )}
            </div>
          </div>
        </div>

        {/* Botón crear */}
        <div className="flex justify-end gap-2 pt-2">
          <Boton variante="fantasma" tamano="sm" onClick={onCerrar}>Cancelar</Boton>
          <Boton variante="primario" tamano="sm" onClick={crear} cargando={creando}>
            Crear {tipo === 'grupo' ? 'grupo' : 'canal'}
          </Boton>
        </div>
      </div>
    </Modal>
  )
}
