'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { Modal } from '@/componentes/ui/Modal'
import { Boton } from '@/componentes/ui/Boton'
import { Avatar } from '@/componentes/ui/Avatar'
import { Input } from '@/componentes/ui/Input'
import { Hash, Lock, Users, X, Building2, Search, MessageCircle } from 'lucide-react'
import { useToast } from '@/componentes/feedback/Toast'
import { crearClienteNavegador } from '@/lib/supabase/cliente'
import type { TipoCanalInterno } from '@/tipos/inbox'
import { useTraduccion } from '@/lib/i18n'

/**
 * Modal para crear canal, grupo o DM interno.
 * Carga usuarios directamente de Supabase (miembros + perfiles).
 * Soporta selección de miembros individuales y por sector.
 */

interface PropiedadesModal {
  abierto: boolean
  onCerrar: () => void
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onCreado: (canal?: any) => void
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
}

const TIPOS_CANAL: { clave: TipoCanalInterno; etiqueta: string; icono: React.ReactNode; desc: string }[] = [
  { clave: 'directo', etiqueta: 'Mensaje directo', icono: <MessageCircle size={14} />, desc: '1 a 1 con alguien' },
  { clave: 'grupo', etiqueta: 'Grupo', icono: <Users size={14} />, desc: 'Cualquiera puede salir' },
  { clave: 'publico', etiqueta: 'Canal público', icono: <Hash size={14} />, desc: 'Visible para todos' },
  { clave: 'privado', etiqueta: 'Canal privado', icono: <Lock size={14} />, desc: 'Solo invitados' },
]

export function ModalCrearCanalInterno({ abierto, onCerrar, onCreado }: PropiedadesModal) {
  const { t } = useTraduccion()
  const { mostrar } = useToast()
  const supabase = useMemo(() => crearClienteNavegador(), [])
  const [tipo, setTipo] = useState<TipoCanalInterno>('directo')
  const [nombre, setNombre] = useState('')
  const [descripcion, setDescripcion] = useState('')
  const [busqueda, setBusqueda] = useState('')
  const [miembrosSeleccionados, setMiembrosSeleccionados] = useState<UsuarioBuscable[]>([])
  const [sectoresSeleccionados, setSectoresSeleccionados] = useState<SectorBuscable[]>([])
  const [usuarios, setUsuarios] = useState<UsuarioBuscable[]>([])
  const [sectores, setSectores] = useState<SectorBuscable[]>([])
  const [cargando, setCargando] = useState(false)
  const [creando, setCreando] = useState(false)
  const [usuarioActualId, setUsuarioActualId] = useState('')

  // Cargar usuarios y sectores al abrir
  useEffect(() => {
    if (!abierto) return
    const cargar = async () => {
      setCargando(true)
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return
        setUsuarioActualId(user.id)
        const empresaId = user.app_metadata?.empresa_activa_id
        if (!empresaId) return

        // Cargar miembros activos
        const { data: miembros } = await supabase
          .from('miembros')
          .select('usuario_id')
          .eq('empresa_id', empresaId)
          .eq('activo', true)

        if (miembros && miembros.length > 0) {
          const ids = miembros.map(m => m.usuario_id).filter(id => id !== user.id)
          const { data: perfiles } = await supabase
            .from('perfiles')
            .select('id, nombre, apellido, avatar_url')
            .in('id', ids)

          setUsuarios(
            (perfiles || []).map(p => ({
              id: p.id,
              nombre: p.nombre || '',
              apellido: p.apellido || '',
              avatar_url: p.avatar_url,
            }))
          )
        }

        // Cargar sectores
        const { data: sectoresData } = await supabase
          .from('sectores')
          .select('id, nombre, color')
          .eq('empresa_id', empresaId)
          .eq('activo', true)
          .order('orden')

        setSectores(
          (sectoresData || []).map(s => ({
            id: s.id,
            nombre: s.nombre,
            color: s.color || '#6366f1',
          }))
        )
      } catch { /* silenciar */ }
      setCargando(false)
    }
    cargar()
  }, [abierto, supabase])

  // Reset al cerrar
  useEffect(() => {
    if (!abierto) {
      setTipo('directo')
      setNombre('')
      setDescripcion('')
      setBusqueda('')
      setMiembrosSeleccionados([])
      setSectoresSeleccionados([])
    }
  }, [abierto])

  const toggleMiembro = useCallback((usuario: UsuarioBuscable) => {
    if (tipo === 'directo') {
      // DM: solo un usuario
      setMiembrosSeleccionados(prev =>
        prev.some(m => m.id === usuario.id) ? [] : [usuario]
      )
      return
    }
    setMiembrosSeleccionados(prev => {
      const existe = prev.some(m => m.id === usuario.id)
      return existe ? prev.filter(m => m.id !== usuario.id) : [...prev, usuario]
    })
  }, [tipo])

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
    if (tipo !== 'directo' && !nombre.trim()) {
      mostrar('error', 'El nombre es requerido')
      return
    }
    if (miembrosSeleccionados.length === 0 && sectoresSeleccionados.length === 0) {
      mostrar('error', 'Seleccioná al menos un miembro')
      return
    }

    setCreando(true)
    try {
      // Para DM: usar el nombre del otro usuario
      const nombreFinal = tipo === 'directo'
        ? `${miembrosSeleccionados[0]?.nombre} ${miembrosSeleccionados[0]?.apellido}`.trim()
        : nombre.trim()

      const res = await fetch('/api/inbox/internos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nombre: nombreFinal,
          descripcion: descripcion.trim() || undefined,
          tipo,
          miembros: miembrosSeleccionados.map(m => m.id),
          sector_ids: sectoresSeleccionados.map(s => s.id),
        }),
      })

      if (res.ok) {
        const data = await res.json()
        const tipoLabel = tipo === 'directo' ? 'Conversación iniciada' : tipo === 'grupo' ? 'Grupo creado' : 'Canal creado'
        mostrar('exito', tipoLabel)
        onCreado(data.canal || undefined)
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

  const esDM = tipo === 'directo'

  return (
    <Modal abierto={abierto} onCerrar={onCerrar} titulo={esDM ? 'Nuevo mensaje' : 'Crear canal o grupo'} tamano="md">
      <div className="space-y-4">
        {/* Selector de tipo */}
        <div>
          <label className="text-xs font-medium mb-1.5 block" style={{ color: 'var(--texto-secundario)' }}>Tipo</label>
          <div className="grid grid-cols-2 gap-2">
            {TIPOS_CANAL.map(t => (
              <Boton
                key={t.clave}
                variante={tipo === t.clave ? 'primario' : 'secundario'}
                tamano="sm"
                onClick={() => {
                  setTipo(t.clave)
                  if (t.clave === 'directo') {
                    // Limpiar selección múltiple al cambiar a DM
                    setMiembrosSeleccionados(prev => prev.slice(0, 1))
                    setSectoresSeleccionados([])
                  }
                }}
                className="text-left"
                style={{
                  border: tipo === t.clave ? '2px solid var(--texto-marca)' : '1px solid var(--borde-sutil)',
                  background: tipo === t.clave ? 'var(--superficie-seleccionada)' : 'var(--superficie-tarjeta)',
                  color: tipo === t.clave ? 'var(--texto-marca)' : 'var(--texto-secundario)',
                }}
              >
                <span className="flex items-center gap-2">
                  {t.icono}
                  <span>
                    <span className="font-medium">{t.etiqueta}</span>
                    <p className="text-xxs" style={{ color: 'var(--texto-terciario)' }}>{t.desc}</p>
                  </span>
                </span>
              </Boton>
            ))}
          </div>
        </div>

        {/* Nombre y descripción (no para DM) */}
        {!esDM && (
          <div className="space-y-2">
            <Input
              etiqueta="Nombre"
              value={nombre}
              onChange={e => setNombre(e.target.value)}
              placeholder={tipo === 'grupo' ? 'Nombre del grupo' : 'Nombre del canal'}
              formato={null}
            />
            {(tipo === 'publico' || tipo === 'privado') && (
              <Input
                etiqueta="Descripción"
                value={descripcion}
                onChange={e => setDescripcion(e.target.value)}
                placeholder="Descripción (opcional)"
                formato={null}
              />
            )}
          </div>
        )}

        {/* Buscador de miembros */}
        <div>
          <label className="text-xs font-medium mb-1.5 block" style={{ color: 'var(--texto-secundario)' }}>
            {esDM ? '¿Con quién querés hablar?' : 'Miembros'}
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
                  <Boton variante="fantasma" tamano="xs" soloIcono titulo="Quitar" icono={<X size={10} />} onClick={() => toggleSector(s)} aria-label={`Quitar sector ${s.nombre}`} />
                </span>
              ))}
              {miembrosSeleccionados.map(m => (
                <span
                  key={`m-${m.id}`}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs"
                  style={{ background: 'var(--superficie-hover)', color: 'var(--texto-secundario)' }}
                >
                  {m.nombre} {m.apellido}
                  <Boton variante="fantasma" tamano="xs" soloIcono titulo="Quitar" icono={<X size={10} />} onClick={() => toggleMiembro(m)} aria-label={`Quitar ${m.nombre}`} />
                </span>
              ))}
            </div>
          )}

          {/* Input de búsqueda */}
          <div className="mb-2">
            <Input
              tipo="search"
              value={busqueda}
              onChange={e => setBusqueda(e.target.value)}
              placeholder="Buscar personas..."
              icono={<Search size={14} />}
              formato={null}
              autoFocus
            />
          </div>

          {/* Lista de sectores (no para DM) */}
          {!esDM && sectoresFiltrados.length > 0 && (
            <div className="mb-2">
              <p className="text-xxs font-semibold uppercase px-1 mb-1" style={{ color: 'var(--texto-terciario)' }}>Sectores</p>
              <div className="max-h-24 overflow-y-auto space-y-0.5">
                {sectoresFiltrados.map(s => {
                  const sel = sectoresSeleccionados.some(ss => ss.id === s.id)
                  return (
                    <Boton
                      key={s.id}
                      variante="fantasma"
                      tamano="sm"
                      onClick={() => toggleSector(s)}
                      className="w-full"
                      style={{
                        background: sel ? 'var(--superficie-seleccionada)' : 'transparent',
                        color: sel ? 'var(--texto-marca)' : 'var(--texto-secundario)',
                      }}
                    >
                      <span className="flex items-center gap-2 w-full">
                        <span className="w-3 h-3 rounded-sm flex-shrink-0" style={{ background: s.color }} />
                        <span className="flex-1 text-left text-xs">{s.nombre}</span>
                        {sel && <span style={{ color: 'var(--texto-marca)' }}>✓</span>}
                      </span>
                    </Boton>
                  )
                })}
              </div>
            </div>
          )}

          {/* Lista de usuarios */}
          <div>
            <p className="text-xxs font-semibold uppercase px-1 mb-1" style={{ color: 'var(--texto-terciario)' }}>Personas</p>
            <div className="max-h-48 overflow-y-auto space-y-0.5">
              {cargando ? (
                <p className="text-xs px-2 py-4 text-center" style={{ color: 'var(--texto-terciario)' }}>Cargando...</p>
              ) : usuariosFiltrados.length === 0 ? (
                <p className="text-xs px-2 py-4 text-center" style={{ color: 'var(--texto-terciario)' }}>
                  {busqueda ? 'Sin resultados' : 'No hay usuarios disponibles'}
                </p>
              ) : (
                usuariosFiltrados.map(u => {
                  const sel = miembrosSeleccionados.some(m => m.id === u.id)
                  return (
                    <Boton
                      key={u.id}
                      variante="fantasma"
                      tamano="sm"
                      onClick={() => toggleMiembro(u)}
                      className="w-full"
                      style={{
                        background: sel ? 'var(--superficie-seleccionada)' : 'transparent',
                        color: sel ? 'var(--texto-marca)' : 'var(--texto-secundario)',
                      }}
                    >
                      <span className="flex items-center gap-2 w-full">
                        <Avatar nombre={`${u.nombre} ${u.apellido}`} tamano="xs" />
                        <span className="flex-1 text-left text-xs">{u.nombre} {u.apellido}</span>
                        {sel && <span style={{ color: 'var(--texto-marca)' }}>✓</span>}
                      </span>
                    </Boton>
                  )
                })
              )}
            </div>
          </div>
        </div>

        {/* Botón crear */}
        <div className="flex justify-end gap-2 pt-2">
          <Boton variante="fantasma" tamano="sm" onClick={onCerrar}>{t('comun.cancelar')}</Boton>
          <Boton variante="primario" tamano="sm" onClick={crear} cargando={creando}>
            {esDM ? 'Iniciar conversación' : `Crear ${tipo === 'grupo' ? 'grupo' : 'canal'}`}
          </Boton>
        </div>
      </div>
    </Modal>
  )
}
