'use client'

/**
 * PanelNotas — Panel lateral de notas rápidas.
 * Desktop: panel lateral derecho (420px) con animación slide-in.
 * Mobile: pantalla completa con slide-up.
 *
 * Features:
 * - 3 pestañas: Todas, Mis notas, Compartidas (default: Todas)
 * - Propias = color amber, compartidas = color azul
 * - Crear nota con +, editar al tocar, menú ⋯ para acciones
 * - Compartir con miembros (solo leer / leer y editar)
 * - Mini avatares con iniciales de los compartidos
 * - Dictado por voz (GrabadorAudio + Whisper)
 * - Punto rojo en compartidas con cambios no leídos
 * - Ordenadas por última modificación
 * - Confirmación antes de eliminar
 * - ID visible para referencia (Salix IA / WhatsApp)
 *
 * Se usa en: BotonFlotanteNotas.
 */

import { useState, useRef, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  X, Plus, StickyNote, Pin, PinOff, Trash2, Mic,
  Loader2, Users, ChevronLeft, MoreHorizontal,
  Eye, Pencil, Hash
} from 'lucide-react'
import { useEsMovil } from '@/hooks/useEsMovil'
import { useAuth } from '@/hooks/useAuth'
import { useEmpresa } from '@/hooks/useEmpresa'
import { useFormato } from '@/hooks/useFormato'
import { GrabadorAudio } from '@/componentes/mensajeria/GrabadorAudio'
import type { NotaRapida } from '@/hooks/useNotasRapidas'

// ─── Tipos ───

type Pestana = 'todas' | 'propias' | 'compartidas'

interface PropiedadesPanelNotas {
  abierto: boolean
  onCerrar: () => void
  notas: {
    propias: NotaRapida[]
    compartidas: NotaRapida[]
    cargando: boolean
    tiene_cambios_sin_leer: boolean
    crear: (datos: { titulo?: string; contenido?: string; color?: string; compartir_con?: string[] }) => Promise<NotaRapida | null>
    actualizar: (id: string, datos: Partial<NotaRapida>) => Promise<NotaRapida | null>
    eliminar: (id: string) => Promise<boolean>
    compartir: (nota_id: string, usuario_id: string, puede_editar?: boolean) => Promise<boolean>
    dejarDeCompartir: (nota_id: string, usuario_id: string) => Promise<boolean>
    marcarLeida: (nota_id: string) => Promise<void>
    cargar: () => Promise<void>
  }
}

interface MiembroAPI {
  id: string
  usuario_id: string
  nombre: string
  apellido: string
}

// ─── Colores fijos por tipo ───
const COLOR_PROPIA = 'bg-amber-500/12 border-amber-500/25 hover:bg-amber-500/18'
const COLOR_COMPARTIDA = 'bg-insignia-info/12 border-insignia-info/25 hover:bg-insignia-info/18'

// ─── Colores selectables ───
const COLORES_NOTA = [
  { id: 'amarillo', punto: 'bg-amber-400' },
  { id: 'azul', punto: 'bg-blue-400' },
  { id: 'verde', punto: 'bg-emerald-400' },
  { id: 'rosa', punto: 'bg-pink-400' },
  { id: 'morado', punto: 'bg-violet-400' },
] as const

// ─── Mini avatar para compartidos ───
function MiniAvatarNota({ nombre }: { nombre: string }) {
  const limpio = nombre.replace(/[\p{Emoji_Presentation}\p{Extended_Pictographic}\u200d\ufe0f]/gu, '').trim()
  const partes = limpio.split(/\s+/).filter(Boolean)
  const iniciales = partes.length >= 2
    ? (partes[0][0] + partes[1][0]).toUpperCase()
    : limpio.slice(0, 2).toUpperCase()

  return (
    <div
      className="size-5 rounded-full flex items-center justify-center
        bg-texto-marca/15 border border-texto-marca/30
        text-texto-marca text-[9px] font-semibold leading-none shrink-0"
      title={nombre}
    >
      {iniciales || '?'}
    </div>
  )
}

// ─── Stack de avatares compartidos ───
function AvatarsCompartidos({ nombres }: { nombres: string[] }) {
  if (nombres.length === 0) return null
  const visibles = nombres.slice(0, 3)
  const extra = nombres.length - 3

  return (
    <div className="flex items-center -space-x-1.5">
      {visibles.map((n, i) => (
        <MiniAvatarNota key={i} nombre={n} />
      ))}
      {extra > 0 && (
        <div
          className="size-5 rounded-full flex items-center justify-center
            bg-white/[0.08] border border-borde-sutil
            text-texto-terciario text-[9px] font-medium leading-none shrink-0"
        >
          +{extra}
        </div>
      )}
    </div>
  )
}

// ─── ID corto para referencia ───
function idCorto(id: string): string {
  return id.slice(0, 8)
}

// ─── Extraer título y cuerpo del contenido (estilo Apple Notes) ───
// La primera línea es el título, el resto es el cuerpo.
function extraerTituloYCuerpo(texto: string): { titulo: string; cuerpo: string } {
  const primeraLinea = texto.indexOf('\n')
  if (primeraLinea === -1) return { titulo: texto.trim(), cuerpo: '' }
  return {
    titulo: texto.slice(0, primeraLinea).trim(),
    cuerpo: texto.slice(primeraLinea + 1),
  }
}

// ─── Componente principal ───

function PanelNotas({ abierto, onCerrar, notas }: PropiedadesPanelNotas) {
  const esMovil = useEsMovil()
  const { usuario } = useAuth()
  const { empresa } = useEmpresa()
  const { fechaRelativa, fecha: fmtFecha, hora: fmtHora } = useFormato()

  const [pestana, setPestana] = useState<Pestana>('todas')

  // Cuando el panel se abre vía evento global (chip de notas con cambios en
  // el dashboard, etc.), cambiar a la pestaña de compartidas donde aparecen
  // las notas con cambios no leídos.
  useEffect(() => {
    const mostrarCompartidas = () => setPestana('compartidas')
    window.addEventListener('flux:abrir-notas', mostrarCompartidas)
    return () => window.removeEventListener('flux:abrir-notas', mostrarCompartidas)
  }, [])
  const [notaActiva, setNotaActiva] = useState<NotaRapida | null>(null)
  const [editando, setEditando] = useState(false)
  // Primera línea = título (bold/grande), resto = cuerpo (estilo Apple Notes)
  const [tituloEditor, setTituloEditor] = useState('')
  const [cuerpoEditor, setCuerpoEditor] = useState('')
  const [colorActivo, setColorActivo] = useState('amarillo')
  const [guardando, setGuardando] = useState(false)
  const [creando, setCreando] = useState(false)

  // Confirmación de eliminar
  const [confirmarEliminarId, setConfirmarEliminarId] = useState<string | null>(null)

  // Menú contextual
  const [menuAbiertoId, setMenuAbiertoId] = useState<string | null>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  // Compartir
  const [mostrarCompartir, setMostrarCompartir] = useState(false)
  const [miembros, setMiembros] = useState<MiembroAPI[]>([])
  const [cargandoMiembros, setCargandoMiembros] = useState(false)
  const [nombresMiembros, setNombresMiembros] = useState<Record<string, string>>({})
  const [busquedaMiembro, setBusquedaMiembro] = useState('')

  // Dictado
  const [grabando, setGrabando] = useState(false)
  const [transcribiendo, setTranscribiendo] = useState(false)

  const inputRef = useRef<HTMLTextAreaElement>(null)
  const timerGuardadoRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Cargar miembros via API route (service role, sin problemas de RLS)
  const cargarMiembros = useCallback(async () => {
    if (miembros.length > 0) return // ya cargados
    setCargandoMiembros(true)
    try {
      const res = await fetch('/api/notas-rapidas/miembros')
      if (res.ok) {
        const data: MiembroAPI[] = await res.json()
        setMiembros(data)
        const mapa: Record<string, string> = {}
        for (const m of data) {
          mapa[m.usuario_id] = `${m.nombre} ${m.apellido}`
        }
        // También agregar el usuario actual
        if (usuario) {
          // El usuario actual no viene en la API (se filtra), pero lo necesitamos para avatares propios
        }
        setNombresMiembros(mapa)
      }
    } catch {
      // silenciar
    } finally {
      setCargandoMiembros(false)
    }
  }, [miembros.length, usuario])

  // Cargar miembros al abrir el panel
  useEffect(() => {
    if (abierto && empresa && miembros.length === 0) {
      cargarMiembros()
    }
  }, [abierto, empresa, miembros.length, cargarMiembros])

  // Cerrar menú al click fuera
  useEffect(() => {
    if (!menuAbiertoId) return
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuAbiertoId(null)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [menuAbiertoId])

  // ─── Funciones de notas ───

  const abrirNota = useCallback((nota: NotaRapida) => {
    setNotaActiva(nota)
    setTituloEditor(nota.titulo || '')
    setCuerpoEditor(nota.contenido || '')
    setColorActivo(nota.color)
    setEditando(true)
    setMostrarCompartir(false)
    setMenuAbiertoId(null)
    setConfirmarEliminarId(null)
    if (nota._compartida && nota._tiene_cambios) {
      notas.marcarLeida(nota.id)
    }
  }, [notas])

  const crearNueva = useCallback(async () => {
    setCreando(true)
    const nueva = await notas.crear({ titulo: '', contenido: '', color: 'amarillo' })
    if (nueva) {
      abrirNota(nueva)
      setTimeout(() => inputRef.current?.focus(), 100)
    }
    setCreando(false)
  }, [notas, abrirNota])

  // Autoguardar
  const autoguardar = useCallback((t: string, c: string, color: string) => {
    if (!notaActiva) return
    if (timerGuardadoRef.current) clearTimeout(timerGuardadoRef.current)
    timerGuardadoRef.current = setTimeout(async () => {
      setGuardando(true)
      await notas.actualizar(notaActiva.id, { titulo: t, contenido: c, color })
      setGuardando(false)
    }, 800)
  }, [notaActiva, notas])

  const handleCambiarTitulo = (v: string) => {
    // Si pegan texto con saltos de línea en el título, mover el excedente al cuerpo
    if (v.includes('\n')) {
      const lineas = v.split('\n')
      const nuevoTitulo = lineas[0]
      const restoAlCuerpo = lineas.slice(1).join('\n') + (cuerpoEditor ? '\n' + cuerpoEditor : '')
      setTituloEditor(nuevoTitulo)
      setCuerpoEditor(restoAlCuerpo)
      autoguardar(nuevoTitulo, restoAlCuerpo, colorActivo)
    } else {
      setTituloEditor(v)
      autoguardar(v, cuerpoEditor, colorActivo)
    }
  }
  const handleCambiarCuerpo = (v: string) => { setCuerpoEditor(v); autoguardar(tituloEditor, v, colorActivo) }
  const handleCambiarColor = (color: string) => { setColorActivo(color); autoguardar(tituloEditor, cuerpoEditor, color) }

  // Enter en el campo título → mover foco al cuerpo
  const handleTituloKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      inputRef.current?.focus()
    }
  }

  // Eliminar con confirmación
  const handleEliminar = async (id: string) => {
    setMenuAbiertoId(null)
    setConfirmarEliminarId(null)
    await notas.eliminar(id)
    if (notaActiva?.id === id) { setNotaActiva(null); setEditando(false) }
  }

  const handleFijar = async (nota: NotaRapida) => {
    setMenuAbiertoId(null)
    await notas.actualizar(nota.id, { fijada: !nota.fijada })
  }

  const volverALista = () => {
    if (timerGuardadoRef.current) {
      clearTimeout(timerGuardadoRef.current)
      if (notaActiva) {
        notas.actualizar(notaActiva.id, { titulo: tituloEditor, contenido: cuerpoEditor, color: colorActivo })
      }
    }
    setNotaActiva(null)
    setEditando(false)
    setMostrarCompartir(false)
    setConfirmarEliminarId(null)
  }

  // Sincronizar notaActiva cuando cambian las notas del hook (después de compartir, etc.)
  useEffect(() => {
    if (!notaActiva || !editando) return
    const actualizada = [...notas.propias, ...notas.compartidas].find((n) => n.id === notaActiva.id)
    if (actualizada) {
      setNotaActiva(actualizada)
    }
  }, [notas.propias, notas.compartidas, notaActiva?.id, editando])

  // Compartir
  const toggleCompartir = async (usuario_id: string, puede_editar: boolean) => {
    if (!notaActiva) return
    const yaCompartido = notaActiva._compartidos_con?.some((c) => c.usuario_id === usuario_id)
    if (yaCompartido) {
      await notas.dejarDeCompartir(notaActiva.id, usuario_id)
    } else {
      await notas.compartir(notaActiva.id, usuario_id, puede_editar)
    }
  }

  const cambiarPermiso = async (usuario_id: string, puede_editar: boolean) => {
    if (!notaActiva) return
    await notas.dejarDeCompartir(notaActiva.id, usuario_id)
    await notas.compartir(notaActiva.id, usuario_id, puede_editar)
  }

  // Dictado
  const handleGrabacionCompleta = useCallback(async (audio: Blob) => {
    setGrabando(false)
    setTranscribiendo(true)
    try {
      const formData = new FormData()
      formData.append('audio', audio, 'audio.webm')
      const res = await fetch('/api/salix-ia/transcribir', { method: 'POST', body: formData })
      if (!res.ok) throw new Error('Error')
      const { texto: textoTranscrito } = await res.json()
      if (textoTranscrito) {
        // Si no hay título, la transcripción se convierte en título
        if (!tituloEditor) {
          const { titulo, cuerpo } = extraerTituloYCuerpo(textoTranscrito)
          setTituloEditor(titulo)
          setCuerpoEditor(cuerpo)
          autoguardar(titulo, cuerpo, colorActivo)
        } else {
          const nuevo = cuerpoEditor ? `${cuerpoEditor}\n${textoTranscrito}` : textoTranscrito
          setCuerpoEditor(nuevo)
          autoguardar(tituloEditor, nuevo, colorActivo)
        }
      }
    } catch {
      // Error de transcripción — silenciar, el usuario puede reintentar
    } finally {
      setTranscribiendo(false)
    }
  }, [tituloEditor, cuerpoEditor, colorActivo, autoguardar])

  useEffect(() => {
    if (editando && inputRef.current && !grabando) {
      setTimeout(() => inputRef.current?.focus(), 300)
    }
  }, [editando, grabando])

  // ─── Filtrado y orden ───

  const todasLasNotas = [...notas.propias, ...notas.compartidas]
    .sort((a, b) => new Date(b.actualizado_en).getTime() - new Date(a.actualizado_en).getTime())

  const listaFiltrada = pestana === 'todas'
    ? todasLasNotas
    : pestana === 'propias'
      ? [...notas.propias].sort((a, b) => new Date(b.actualizado_en).getTime() - new Date(a.actualizado_en).getTime())
      : [...notas.compartidas].sort((a, b) => new Date(b.actualizado_en).getTime() - new Date(a.actualizado_en).getTime())

  const cantCompartidasConCambios = notas.compartidas.filter((n) => n._tiene_cambios).length

  const nombresCompartidos = (nota: NotaRapida): string[] => {
    if (!nota._compartidos_con || nota._compartidos_con.length === 0) return []
    return nota._compartidos_con.map((c) => nombresMiembros[c.usuario_id] || '?')
  }

  // ─── Menú contextual ⋯ ───

  const renderMenu = (nota: NotaRapida) => {
    const esPropietario = nota.creador_id === usuario?.id
    if (!esPropietario) return null

    return (
      <div className="relative" ref={menuAbiertoId === nota.id ? menuRef : undefined}>
        <button
          onClick={(e) => { e.stopPropagation(); setMenuAbiertoId(menuAbiertoId === nota.id ? null : nota.id) }}
          className="p-1 rounded-boton text-texto-terciario hover:text-texto-primario hover:bg-white/[0.08] transition-colors"
        >
          <MoreHorizontal className="size-4" />
        </button>

        <AnimatePresence>
          {menuAbiertoId === nota.id && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: -4 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: -4 }}
              transition={{ duration: 0.12 }}
              className="absolute right-0 top-full mt-1 z-50 w-48 rounded-popover bg-superficie-elevada border border-white/[0.1] shadow-xl py-1"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                onClick={() => { setMenuAbiertoId(null); abrirNota(nota); setMostrarCompartir(true); cargarMiembros() }}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-texto-primario hover:bg-white/[0.06] transition-colors"
              >
                <Users className="size-3.5" />
                Compartir con...
              </button>
              <button
                onClick={() => handleFijar(nota)}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-texto-primario hover:bg-white/[0.06] transition-colors"
              >
                {nota.fijada ? <PinOff className="size-3.5" /> : <Pin className="size-3.5" />}
                {nota.fijada ? 'Desfijar' : 'Fijar arriba'}
              </button>

              {/* ID de referencia */}
              <div className="border-t border-white/[0.07] my-1" />
              <div className="flex items-center gap-2 px-3 py-1.5 text-[10px] text-texto-terciario">
                <Hash className="size-3" />
                <span className="font-mono select-all">{idCorto(nota.id)}</span>
              </div>

              <div className="border-t border-white/[0.07] my-1" />
              <button
                onClick={() => { setMenuAbiertoId(null); setConfirmarEliminarId(nota.id) }}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-estado-error hover:bg-estado-error/10 transition-colors"
              >
                <Trash2 className="size-3.5" />
                Eliminar
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    )
  }

  // ─── Confirmación de eliminar ───

  const renderConfirmacion = () => {
    if (!confirmarEliminarId) return null
    const nota = todasLasNotas.find((n) => n.id === confirmarEliminarId)
    if (!nota) return null

    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[80] flex items-center justify-center bg-black/40"
        onClick={() => setConfirmarEliminarId(null)}
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          onClick={(e) => e.stopPropagation()}
          className="bg-superficie-elevada border border-white/[0.1] rounded-popover shadow-2xl p-5 mx-4 max-w-sm w-full space-y-4"
        >
          <div className="space-y-1">
            <h4 className="text-sm font-semibold text-texto-primario">Eliminar nota</h4>
            <p className="text-xs text-texto-secundario leading-relaxed">
              ¿Estás seguro de que querés eliminar
              {nota.titulo ? ` "${nota.titulo}"` : ' esta nota'}?
              {(nota._compartidos_con?.length ?? 0) > 0 && (
                <> Esta nota está compartida con {nota._compartidos_con!.length} persona{nota._compartidos_con!.length > 1 ? 's' : ''} y se eliminará para todos.</>
              )}
            </p>
          </div>
          <div className="flex items-center justify-end gap-2">
            <button
              onClick={() => setConfirmarEliminarId(null)}
              className="px-3 py-1.5 rounded-card text-xs text-texto-secundario hover:text-texto-primario hover:bg-white/[0.06] transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={() => handleEliminar(confirmarEliminarId)}
              className="px-3 py-1.5 rounded-card text-xs font-medium text-white bg-estado-error hover:bg-estado-error/90 transition-colors"
            >
              Eliminar
            </button>
          </div>
        </motion.div>
      </motion.div>
    )
  }

  // ─── Lista de notas ───

  const renderLista = () => (
    <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2.5 scrollbar-auto-oculto">
      {notas.cargando ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="size-5 animate-spin text-texto-terciario" />
        </div>
      ) : listaFiltrada.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center gap-3">
          <div className="size-14 rounded-modal bg-amber-500/10 flex items-center justify-center">
            <StickyNote className="size-7 text-amber-400" />
          </div>
          <div>
            <p className="text-sm font-medium text-texto-primario">
              {pestana === 'compartidas' ? 'Sin notas compartidas' : 'Sin notas aún'}
            </p>
            <p className="text-xs text-texto-terciario mt-1 max-w-[240px]">
              {pestana === 'compartidas'
                ? 'Cuando alguien comparta una nota contigo, aparecerá acá'
                : 'Tocá + para crear tu primera nota'}
            </p>
          </div>
        </div>
      ) : (
        listaFiltrada.map((nota) => {
          const esCompartida = !!nota._compartida
          const colorClase = esCompartida ? COLOR_COMPARTIDA : COLOR_PROPIA
          const nombres = esCompartida ? [] : nombresCompartidos(nota)

          return (
            <motion.div
              key={nota.id}
              layout
              className={`rounded-card border transition-colors ${colorClase} relative group`}
            >
              <button
                onClick={() => abrirNota(nota)}
                className="w-full text-left px-3.5 py-3 pr-10"
              >
                {/* Indicador de cambios */}
                {nota._tiene_cambios && (
                  <span className="absolute top-3 right-9 size-2 rounded-full bg-insignia-peligro" />
                )}

                {/* Fijada */}
                {nota.fijada && (
                  <Pin className="absolute top-3 left-2 size-3 text-amber-400/60 rotate-45" />
                )}

                {/* Título */}
                <p className="text-sm font-semibold text-texto-primario truncate">
                  {nota.titulo || 'Sin título'}
                </p>

                {/* Preview del contenido — respeta saltos de línea, hasta 4 líneas */}
                <div className="mt-1 text-xs text-texto-secundario leading-relaxed line-clamp-4 whitespace-pre-line">
                  {nota.contenido || 'Nota vacía'}
                </div>

                {/* Footer: fecha + badges + avatares */}
                <div className="flex items-center gap-2 mt-2.5 flex-wrap">
                  <span className="text-[10px] text-texto-terciario" title={fmtFecha(new Date(nota.actualizado_en)) + ' ' + fmtHora(new Date(nota.actualizado_en))}>
                    {fechaRelativa(nota.actualizado_en)} · {fmtHora(new Date(nota.actualizado_en))}
                  </span>

                  {/* Badge compartida conmigo */}
                  {esCompartida && (
                    <span className="inline-flex items-center gap-1 text-[10px] text-insignia-info bg-insignia-info/10 px-1.5 py-0.5 rounded-full">
                      <Users className="size-2.5" />
                      Compartida
                    </span>
                  )}

                  {/* Avatares de compartidos (notas propias) */}
                  {nombres.length > 0 && <AvatarsCompartidos nombres={nombres} />}
                </div>
              </button>

              {/* Menú ⋯ */}
              <div className="absolute top-2.5 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                {renderMenu(nota)}
              </div>
            </motion.div>
          )
        })
      )}

      {/* Confirmación de eliminar */}
      <AnimatePresence>
        {renderConfirmacion()}
      </AnimatePresence>
    </div>
  )

  // ─── Editor de nota ───

  const renderEditor = () => {
    const esPropietario = notaActiva?.creador_id === usuario?.id
    const puedeEditar = esPropietario || notaActiva?._puede_editar

    // Nombres de compartidos para mostrar en el header
    const nombresActivos = esPropietario
      ? nombresCompartidos(notaActiva!)
      : []

    return (
      <div className="flex flex-col h-full">
        {/* Header */}
        <div className="flex items-center justify-between px-3 py-2.5 border-b border-white/[0.07]">
          <div className="flex items-center gap-2 min-w-0">
            <button
              onClick={volverALista}
              className="flex items-center gap-1 text-sm text-texto-secundario hover:text-texto-primario transition-colors shrink-0"
            >
              <ChevronLeft className="size-4" />
              Notas
            </button>

            {/* Avatares de compartidos — visibles mientras escribís */}
            {nombresActivos.length > 0 && (
              <div className="flex items-center gap-1.5 ml-1">
                <AvatarsCompartidos nombres={nombresActivos} />
              </div>
            )}
          </div>

          <div className="flex items-center gap-1 shrink-0">
            {guardando && <span className="text-[10px] text-texto-terciario mr-1">Guardando...</span>}

            {/* ID corto */}
            {notaActiva && (
              <span className="text-[10px] text-texto-terciario font-mono mr-1 select-all" title={`ID: ${notaActiva.id}`}>
                #{idCorto(notaActiva.id)}
              </span>
            )}

            {esPropietario && (
              <>
                <button
                  onClick={() => { setMostrarCompartir(!mostrarCompartir); if (!mostrarCompartir) cargarMiembros() }}
                  className="p-1.5 rounded-card text-texto-terciario hover:text-texto-primario hover:bg-white/[0.06] transition-colors"
                  title="Compartir"
                >
                  <Users className="size-4" />
                </button>
                <button
                  onClick={() => handleFijar(notaActiva!)}
                  className="p-1.5 rounded-card text-texto-terciario hover:text-texto-primario hover:bg-white/[0.06] transition-colors"
                >
                  {notaActiva?.fijada ? <PinOff className="size-4" /> : <Pin className="size-4" />}
                </button>
                <button
                  onClick={() => setConfirmarEliminarId(notaActiva!.id)}
                  className="p-1.5 rounded-card text-texto-terciario hover:text-estado-error hover:bg-estado-error/10 transition-colors"
                >
                  <Trash2 className="size-4" />
                </button>
              </>
            )}
          </div>
        </div>

        {/* Panel de compartir */}
        <AnimatePresence>
          {mostrarCompartir && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden border-b border-white/[0.07]"
            >
              <div className="px-3 py-3 space-y-2.5">
                {/* Píldoras de usuarios ya compartidos */}
                {(notaActiva?._compartidos_con?.length ?? 0) > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {notaActiva!._compartidos_con!.map((c) => {
                      const nombre = nombresMiembros[c.usuario_id] || '?'
                      return (
                        <span
                          key={c.usuario_id}
                          className="inline-flex items-center gap-1.5 rounded-boton font-medium border border-texto-marca/30 bg-texto-marca/10 text-texto-marca pl-1.5 pr-1 py-0.5"
                        >
                          <span className="size-4 rounded-full bg-texto-marca/20 flex items-center justify-center text-[10px] font-bold shrink-0">
                            {nombre.charAt(0).toUpperCase()}
                          </span>
                          <span className="text-xs">{nombre}</span>
                          <span className="text-[9px] text-texto-marca/60 mx-0.5">
                            {c.puede_editar ? '✏️' : '👁️'}
                          </span>
                          <button
                            onClick={() => toggleCompartir(c.usuario_id, true)}
                            className="size-4 rounded flex items-center justify-center text-texto-marca/40 hover:text-estado-error hover:bg-estado-error/10 transition-colors"
                          >
                            <X size={10} />
                          </button>
                        </span>
                      )
                    })}
                  </div>
                )}

                {/* Buscador — glass con focus violet */}
                <div className="salix-input-wrapper">
                  <input
                    value={busquedaMiembro}
                    onChange={(e) => setBusquedaMiembro(e.target.value)}
                    placeholder="Buscar miembro..."
                    className="w-full px-2.5 py-2 bg-transparent text-sm text-white placeholder:text-white/40 outline-none"
                  />
                </div>

                {/* Lista de miembros filtrada */}
                {cargandoMiembros ? (
                  <div className="flex items-center gap-2 py-2">
                    <Loader2 className="size-3.5 animate-spin text-texto-terciario" />
                    <span className="text-xs text-texto-terciario">Cargando equipo...</span>
                  </div>
                ) : (
                  <div className="space-y-1 max-h-[180px] overflow-y-auto scrollbar-auto-oculto">
                    {miembros
                      .filter((m) => {
                        if (!busquedaMiembro) return true
                        const nombre = `${m.nombre} ${m.apellido}`.toLowerCase()
                        return nombre.includes(busquedaMiembro.toLowerCase())
                      })
                      .map((m) => {
                        const nombre = `${m.nombre} ${m.apellido}`
                        const compartido = notaActiva?._compartidos_con?.find((c) => c.usuario_id === m.usuario_id)
                        const yaCompartido = !!compartido

                        return (
                          <div
                            key={m.id}
                            className={`flex items-center justify-between px-2.5 py-2 rounded-card transition-colors ${
                              yaCompartido
                                ? 'bg-texto-marca/8 border border-texto-marca/20'
                                : 'border border-transparent hover:bg-white/[0.06] cursor-pointer'
                            }`}
                            onClick={() => {
                              if (!yaCompartido) { toggleCompartir(m.usuario_id, true); setBusquedaMiembro('') }
                            }}
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <MiniAvatarNota nombre={nombre} />
                              <span className="text-sm text-texto-primario truncate">{nombre}</span>
                            </div>

                            {yaCompartido ? (
                              <div className="flex items-center gap-0.5 shrink-0">
                                <button
                                  onClick={(e) => { e.stopPropagation(); cambiarPermiso(m.usuario_id, false) }}
                                  className={`p-1.5 rounded-boton transition-colors ${
                                    !compartido!.puede_editar
                                      ? 'bg-white/[0.1] text-texto-primario'
                                      : 'text-texto-terciario hover:bg-white/[0.06]'
                                  }`}
                                  title="Solo lectura"
                                >
                                  <Eye className="size-3.5" />
                                </button>
                                <button
                                  onClick={(e) => { e.stopPropagation(); cambiarPermiso(m.usuario_id, true) }}
                                  className={`p-1.5 rounded-boton transition-colors ${
                                    compartido!.puede_editar
                                      ? 'bg-insignia-exito/15 text-insignia-exito'
                                      : 'text-texto-terciario hover:bg-white/[0.06]'
                                  }`}
                                  title="Puede editar"
                                >
                                  <Pencil className="size-3.5" />
                                </button>
                              </div>
                            ) : (
                              <span className="text-[10px] text-texto-terciario">Compartir</span>
                            )}
                          </div>
                        )
                      })}
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Colores + fechas */}
        <div className="flex items-center justify-between px-3 py-2 border-b border-white/[0.07]">
          <div className="flex items-center gap-1.5">
            {COLORES_NOTA.map((c) => (
              <button
                key={c.id}
                onClick={() => puedeEditar && handleCambiarColor(c.id)}
                className={`size-5 rounded-full transition-all ${c.punto} ${
                  colorActivo === c.id ? 'ring-2 ring-white/80 scale-110' : 'opacity-50 hover:opacity-90'
                }`}
              />
            ))}
          </div>
          {notaActiva && (
            <div className="text-[10px] text-texto-terciario text-right leading-relaxed">
              <span title={fmtFecha(new Date(notaActiva.creado_en)) + ' ' + fmtHora(new Date(notaActiva.creado_en))}>
                Creada {fechaRelativa(notaActiva.creado_en)} {fmtHora(new Date(notaActiva.creado_en))}
              </span>
              {notaActiva.actualizado_en !== notaActiva.creado_en && (
                <>
                  <br />
                  <span title={fmtFecha(new Date(notaActiva.actualizado_en)) + ' ' + fmtHora(new Date(notaActiva.actualizado_en))}>
                    Editada {fechaRelativa(notaActiva.actualizado_en)} {fmtHora(new Date(notaActiva.actualizado_en))}
                  </span>
                </>
              )}
            </div>
          )}
        </div>

        {/* Título (primera línea, grande y bold) */}
        <input
          value={tituloEditor}
          onChange={(e) => puedeEditar && handleCambiarTitulo(e.target.value)}
          onKeyDown={handleTituloKeyDown}
          placeholder="Título"
          readOnly={!puedeEditar}
          className="px-4 pt-3 pb-1 bg-transparent text-lg font-bold text-texto-primario placeholder:text-texto-terciario/50 outline-none w-full"
        />

        {/* Cuerpo */}
        <div className="flex-1 relative">
          <textarea
            ref={inputRef}
            value={cuerpoEditor}
            onChange={(e) => puedeEditar && handleCambiarCuerpo(e.target.value)}
            placeholder="Escribí tu nota..."
            readOnly={!puedeEditar}
            className="w-full h-full px-4 py-2 bg-transparent text-sm text-texto-primario placeholder:text-texto-terciario resize-none outline-none leading-relaxed scrollbar-auto-oculto"
          />
          {transcribiendo && (
            <div className="absolute bottom-3 left-4 flex items-center gap-2">
              <Loader2 className="size-3.5 animate-spin text-texto-marca" />
              <span className="text-xs text-texto-terciario">Transcribiendo...</span>
            </div>
          )}
        </div>

        {/* Barra inferior: dictado */}
        {puedeEditar && (
          <div className="px-3 pb-3 pt-2 border-t border-white/[0.07]">
            <GrabadorAudio
              activo={grabando}
              onGrabacionCompleta={handleGrabacionCompleta}
              onCancelar={() => setGrabando(false)}
            />
            {!grabando && (
              <div className="flex items-center justify-between">
                <button
                  onClick={() => setGrabando(true)}
                  disabled={transcribiendo}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-card text-xs text-texto-terciario hover:text-amber-400 hover:bg-amber-400/10 disabled:opacity-30 transition-colors"
                >
                  <Mic className="size-3.5" />
                  Dictar
                </button>
                <span className="text-[10px] text-texto-terciario">
                  {(tituloEditor.length + cuerpoEditor.length) > 0 ? `${tituloEditor.length + cuerpoEditor.length} caracteres` : ''}
                </span>
              </div>
            )}
          </div>
        )}

        {/* Confirmación de eliminar (dentro del editor) */}
        <AnimatePresence>
          {renderConfirmacion()}
        </AnimatePresence>
      </div>
    )
  }

  // ─── Contenido principal ───

  const PESTANAS: { id: Pestana; label: string }[] = [
    { id: 'todas', label: 'Todas' },
    { id: 'propias', label: 'Mis notas' },
    { id: 'compartidas', label: 'Compartidas' },
  ]

  const contenidoPanel = (
    <div className="flex flex-col h-full">
      {editando && notaActiva ? (
        renderEditor()
      ) : (
        <>
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.07]">
            <div className="flex items-center gap-2">
              <div className="size-8 rounded-card bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center">
                <StickyNote className="size-4 text-white" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-texto-primario">Notas rápidas</h3>
                <p className="text-[11px] text-texto-terciario">
                  {todasLasNotas.length} {todasLasNotas.length === 1 ? 'nota' : 'notas'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={crearNueva}
                disabled={creando}
                className="p-1.5 rounded-card text-texto-terciario hover:text-texto-primario hover:bg-white/[0.06] transition-colors disabled:opacity-30"
                title="Nueva nota"
              >
                {creando ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
              </button>
              <button
                onClick={onCerrar}
                className="p-1.5 rounded-card text-texto-terciario hover:text-texto-primario hover:bg-white/[0.06] transition-colors"
              >
                <X className="size-4" />
              </button>
            </div>
          </div>

          {/* Pestañas */}
          <div className="flex border-b border-white/[0.07]">
            {PESTANAS.map((p) => (
              <button
                key={p.id}
                onClick={() => setPestana(p.id)}
                className={`flex-1 py-2.5 text-xs font-medium text-center transition-colors relative ${
                  pestana === p.id ? 'text-texto-primario' : 'text-texto-terciario hover:text-texto-secundario'
                }`}
              >
                <span className="flex items-center justify-center gap-1.5">
                  {p.label}
                  {p.id === 'compartidas' && cantCompartidasConCambios > 0 && (
                    <span className="size-4 rounded-full bg-insignia-peligro text-[10px] text-white flex items-center justify-center font-bold">
                      {cantCompartidasConCambios}
                    </span>
                  )}
                </span>
                {pestana === p.id && (
                  <motion.div
                    layoutId="pestana-notas"
                    className="absolute bottom-0 left-2 right-2 h-0.5 bg-amber-400 rounded-full"
                  />
                )}
              </button>
            ))}
          </div>

          {/* Lista */}
          {renderLista()}
        </>
      )}
    </div>
  )

  // Mobile: pantalla completa (slide-up) para mejor experiencia táctil
  if (esMovil) {
    return createPortal(
      <AnimatePresence>
        {abierto && (
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300, mass: 0.8 }}
            className="salix-glass salix-panel fixed inset-0 z-[80] flex flex-col"
            style={{
              paddingTop: 'env(safe-area-inset-top, 0px)',
              paddingBottom: 'env(safe-area-inset-bottom, 0px)',
              height: 'calc(var(--vh, 1vh) * 100)',
            }}
          >
            {contenidoPanel}
          </motion.div>
        )}
      </AnimatePresence>,
      document.body
    )
  }

  // Desktop: Panel lateral derecho — portal para escapar del transform del contenedor flotante
  return createPortal(
    <AnimatePresence>
      {abierto && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onCerrar}
            className="fixed inset-0 bg-black/20 z-[68]"
          />
          <motion.div
            initial={{ x: '100%', opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: '100%', opacity: 0 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="salix-glass salix-panel fixed top-0 right-0 h-full w-[420px] max-w-[90vw] z-[69] flex flex-col border-l border-white/[0.07] shadow-2xl"
          >
            {contenidoPanel}
          </motion.div>
        </>
      )}
    </AnimatePresence>,
    document.body
  )
}

export { PanelNotas }
