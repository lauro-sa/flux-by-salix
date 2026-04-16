'use client'

import { useState, useEffect, useCallback } from 'react'
import { RECURRENCIA_DEFAULT, type ConfigRecurrencia } from '@/componentes/ui/SelectorRecurrencia'
import { useToast } from '@/componentes/feedback/Toast'
import { type Recordatorio, mañanaISO, hoyISO } from './tipos'

/**
 * useRecordatorios — Hook que encapsula toda la lógica de estado y CRUD
 * para la mini-app de recordatorios del header.
 */
export function useRecordatorios() {
  const { mostrar } = useToast()
  const [abierto, setAbierto] = useState(false)
  const [tab, setTab] = useState('crear')
  const [activos, setActivos] = useState<Recordatorio[]>([])
  const [completados, setCompletados] = useState<Recordatorio[]>([])
  const [cargando, setCargando] = useState(false)

  /* ─── Estado del formulario ─── */
  const [titulo, setTitulo] = useState('')
  const [descripcion, setDescripcion] = useState('')
  const [fecha, setFecha] = useState<string | null>(mañanaISO())
  const [usarHora, setUsarHora] = useState(false)
  const [hora, setHora] = useState<string | null>('09:00')
  const [recurrencia, setRecurrencia] = useState<ConfigRecurrencia>(RECURRENCIA_DEFAULT)
  const [alertaModal, setAlertaModal] = useState(false)
  const [notificarWhatsApp, setNotificarWhatsApp] = useState(true)
  const [creando, setCreando] = useState(false)
  const [mostrarNota, setMostrarNota] = useState(false)

  /* ─── Modo edición ─── */
  const [editandoId, setEditandoId] = useState<string | null>(null)

  /* ─── Previews ─── */
  const [previewModal, setPreviewModal] = useState(false)
  const [previewToast, setPreviewToast] = useState(false)

  /* ─── Eliminar recurrente ─── */
  const [confirmarEliminar, setConfirmarEliminar] = useState<Recordatorio | null>(null)

  /* ─── Cargar recordatorios ─── */
  const cargar = useCallback(async () => {
    setCargando(true)
    try {
      const [resActivos, resCompletados] = await Promise.all([
        fetch('/api/recordatorios?estado=activos&limite=20'),
        fetch('/api/recordatorios?estado=completados&limite=20'),
      ])
      if (resActivos.ok) {
        const data = await resActivos.json()
        setActivos(data.recordatorios || [])
      }
      if (resCompletados.ok) {
        const data = await resCompletados.json()
        setCompletados(data.recordatorios || [])
      }
    } catch { mostrar('error', 'Error al procesar recordatorio') }
    setCargando(false)
  }, [])

  useEffect(() => {
    if (abierto) cargar()
  }, [abierto, cargar])

  /* ─── Limpiar formulario ─── */
  const limpiarFormulario = () => {
    setTitulo('')
    setDescripcion('')
    setFecha(mañanaISO())
    setUsarHora(false)
    setHora('09:00')
    setRecurrencia(RECURRENCIA_DEFAULT)
    setAlertaModal(false)
    setNotificarWhatsApp(true)
    setMostrarNota(false)
    setEditandoId(null)
  }

  /* ─── Abrir recordatorio existente para editar ─── */
  const editarRecordatorio = (r: Recordatorio) => {
    setEditandoId(r.id)
    setTitulo(r.titulo)
    setDescripcion(r.descripcion || '')
    setFecha(r.fecha)
    setUsarHora(!!r.hora)
    setHora(r.hora || '09:00')
    setRecurrencia(r.recurrencia || { frecuencia: r.repetir as ConfigRecurrencia['frecuencia'] })
    setAlertaModal(r.alerta_modal || false)
    setNotificarWhatsApp(r.notificar_whatsapp !== false)
    setMostrarNota(!!r.descripcion)
    setTab('crear')
  }

  /* ─── Crear recordatorio ─── */
  const crear = async () => {
    if (!titulo.trim() || !fecha) return
    setCreando(true)
    try {
      if (editandoId) {
        // Modo edición → PATCH
        const res = await fetch('/api/recordatorios', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: editandoId,
            titulo: titulo.trim(),
            descripcion: descripcion.trim() || null,
            fecha,
            hora: usarHora ? hora : null,
            repetir: recurrencia.frecuencia,
            recurrencia: recurrencia.frecuencia !== 'ninguno' ? recurrencia : null,
            alerta_modal: alertaModal,
            notificar_whatsapp: notificarWhatsApp,
          }),
        })
        if (res.ok) {
          limpiarFormulario()
          setTab('activos')
          cargar()
          mostrar('exito', 'Recordatorio actualizado')
        }
      } else {
        // Modo crear → POST
        const res = await fetch('/api/recordatorios', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            titulo: titulo.trim(),
            descripcion: descripcion.trim() || null,
            fecha,
            hora: usarHora ? hora : null,
            repetir: recurrencia.frecuencia,
            recurrencia: recurrencia.frecuencia !== 'ninguno' ? recurrencia : null,
            alerta_modal: alertaModal,
            notificar_whatsapp: notificarWhatsApp,
          }),
        })
        if (res.ok) {
          limpiarFormulario()
          setTab('activos')
          cargar()
          mostrar('exito', 'Recordatorio creado')
        }
      }
    } catch { mostrar('error', 'Error al procesar recordatorio') }
    setCreando(false)
  }

  /* ─── Completar / descompletar ─── */
  const toggleCompletar = async (id: string, completado: boolean) => {
    try {
      await fetch('/api/recordatorios', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, completado }),
      })
      cargar()
      mostrar('exito', completado ? 'Recordatorio completado' : 'Recordatorio reactivado')
    } catch { mostrar('error', 'Error al actualizar recordatorio') }
  }

  /* ─── Eliminar ─── */
  const intentarEliminar = (r: Recordatorio) => {
    if (r.repetir !== 'ninguno') {
      setAbierto(false)
      setTimeout(() => setConfirmarEliminar(r), 200)
    } else {
      eliminarDirecto(r.id)
    }
  }

  const eliminarDirecto = async (id: string) => {
    try {
      await fetch('/api/recordatorios', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      })
      cargar()
      mostrar('exito', 'Recordatorio eliminado')
    } catch { mostrar('error', 'Error al eliminar recordatorio') }
    setConfirmarEliminar(null)
  }

  /* ─── Conteo de vencidos ─── */
  const vencidos = activos.filter((r) => r.fecha < hoyISO()).length

  return {
    /* Estado general */
    abierto, setAbierto,
    tab, setTab,
    activos, completados,
    cargando, vencidos,

    /* Formulario */
    titulo, setTitulo,
    descripcion, setDescripcion,
    fecha, setFecha,
    usarHora, setUsarHora,
    hora, setHora,
    recurrencia, setRecurrencia,
    alertaModal, setAlertaModal,
    notificarWhatsApp, setNotificarWhatsApp,
    creando, mostrarNota, setMostrarNota,
    editandoId, limpiarFormulario,

    /* Previews */
    previewModal, setPreviewModal,
    previewToast, setPreviewToast,

    /* Eliminar recurrente */
    confirmarEliminar, setConfirmarEliminar,

    /* Acciones */
    crear, toggleCompletar, intentarEliminar, eliminarDirecto, editarRecordatorio,
  }
}

/** Tipo de retorno del hook, útil para tipar props de sub-componentes */
export type UseRecordatoriosRetorno = ReturnType<typeof useRecordatorios>
