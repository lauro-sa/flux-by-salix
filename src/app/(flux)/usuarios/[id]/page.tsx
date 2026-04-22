'use client'

/**
 * Página de detalle de usuario — /usuarios/[id]
 * Tabs: Resumen | Información | Pagos | Permisos
 * Orquestador: carga datos, maneja estado global, delega render a sub-componentes.
 */

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { User, FileText, Wallet, Shield, FileUp, Fingerprint, PowerOff, ChevronRight } from 'lucide-react'
import { Tarjeta } from '@/componentes/ui/Tarjeta'
import { Boton } from '@/componentes/ui/Boton'
import { Tabs } from '@/componentes/ui/Tabs'
import { ModalAdaptable as Modal } from '@/componentes/ui/ModalAdaptable'
import { ModalConfirmacion } from '@/componentes/ui/ModalConfirmacion'
import { IndicadorGuardado } from '@/componentes/ui/IndicadorGuardado'
import { useAuth } from '@/hooks/useAuth'
import { useEmpresa } from '@/hooks/useEmpresa'
import { useRol } from '@/hooks/useRol'
import { useAutoguardado } from '@/hooks/useAutoguardado'
import { useNavegacion } from '@/hooks/useNavegacion'
import { useTraduccion } from '@/lib/i18n'
import { useFormato } from '@/hooks/useFormato'
import { crearClienteNavegador } from '@/lib/supabase/cliente'
import type { Rol, Miembro, Perfil, PermisosMapa } from '@/tipos'
import { SeccionPermisos } from '@/componentes/entidad/SeccionPermisos'
import Image from 'next/image'

/* Sub-componentes extraídos */
import { type TabPerfil, type Periodo, obtenerPeriodo } from './_componentes/constantes'
import { CabeceraUsuario } from './_componentes/CabeceraUsuario'
import { TabResumen } from './_componentes/TabResumen'
import { TabInformacion } from './_componentes/TabInformacion'
import { TabPagos } from './_componentes/TabPagos'
import { InfoEstadoMiembro } from '@/componentes/entidad/InfoEstadoMiembro'
import { calcularEstadoMiembro } from '@/lib/miembros/estado'

/* ═══════════════════════════════════════════════════
   PÁGINA PRINCIPAL
   ═══════════════════════════════════════════════════ */

export default function PaginaPerfilUsuario() {
  const params = useParams()
  const router = useRouter()
  const miembroId = params.id as string
  const { usuario: usuarioActual } = useAuth()
  const { empresa } = useEmpresa()
  const { setMigajaDinamica } = useNavegacion()
  const { t } = useTraduccion()
  const { esPropietario, esAdmin } = useRol()
  const fmt = useFormato()
  const [supabase] = useState(() => crearClienteNavegador())

  const [tab, setTab] = useState<TabPerfil>('resumen')
  const [cargando, setCargando] = useState(true)
  const [miembro, setMiembro] = useState<Miembro | null>(null)
  const [perfil, setPerfil] = useState<Perfil | null>(null)

  /* ── Estado acciones de usuario ──
     Cada acción administrativa tiene su modal de confirmación propio.
     Mantenemos estados separados para poder cerrar uno sin afectar a otros. */
  const [modalResetPassword, setModalResetPassword] = useState(false)
  const [modalForzarPassword, setModalForzarPassword] = useState(false)
  const [modalForzarLogout, setModalForzarLogout] = useState(false)
  const [modalConfirmarEliminar, setModalConfirmarEliminar] = useState(false)
  const [accionCargando, setAccionCargando] = useState<string | null>(null)

  /* ── Estado sectores, puestos, info bancaria ── */
  const [sectores, setSectores] = useState<{ id: string; nombre: string }[]>([])
  const [puestos, setPuestos] = useState<{ id: string; nombre: string }[]>([])
  const [sectorActualId, setSectorActualId] = useState<string>('')
  const [infoBancaria, setInfoBancaria] = useState<Record<string, unknown> | null>(null)
  const [bancosEmpresa, setBancosEmpresa] = useState<{ id: string; nombre: string }[]>([])

  /* ── Estado contacto emergencia y documentos ── */
  const [contactoEmergencia, setContactoEmergencia] = useState<Record<string, unknown> | null>(null)
  const [documentosUsuario, setDocumentosUsuario] = useState<Record<string, unknown>[]>([])

  /* ── Estado pagos ── */
  const [pagos, setPagos] = useState<Record<string, unknown>[]>([])
  const [cargandoPagos, setCargandoPagos] = useState(false)

  /* ── Estado adelantos ── */
  const [adelantos, setAdelantos] = useState<Record<string, unknown>[]>([])
  const [cargandoAdelantos, setCargandoAdelantos] = useState(false)

  /* ── Asistencias ── */
  const [asistenciasPeriodo, setAsistenciasPeriodo] = useState<Record<string, unknown>[]>([])
  const [cargandoAsistencias, setCargandoAsistencias] = useState(false)
  const [archivosDocLocal, setArchivosDocLocal] = useState<Record<string, { nombre: string; url: string | null; subiendo: boolean; error?: boolean }>>({})
  const [docPreview, setDocPreview] = useState<{ titulo: string; url: string } | null>(null)

  /* ── Estado: invitación vigente + acciones del ciclo de vida ── */
  const [invitacionVigente, setInvitacionVigente] = useState<{ token: string; expira_en: string; usado: boolean } | null>(null)
  const [linkInvitacion, setLinkInvitacion] = useState<string | null>(null)
  const [accionEstadoCargando, setAccionEstadoCargando] = useState<'invitar' | 'reenviar' | 'copiar-link' | 'cancelar-invitacion' | 'reactivar' | 'desactivar' | 'reenviar-acceso' | null>(null)
  const [avisoReenvio, setAvisoReenvio] = useState<{ tipo: 'exito' | 'error'; texto: string } | null>(null)
  /* Modal con 2 opciones al tocar "Desactivar": solo fichaje o desactivar completo */
  const [modalOpcionesDesactivar, setModalOpcionesDesactivar] = useState(false)
  const [opcionDesactivarCargando, setOpcionDesactivarCargando] = useState<'solo-fichaje' | 'completo' | null>(null)
  const [errorDesactivar, setErrorDesactivar] = useState('')

  /* ── Refs para setSnapshot ── */
  const setSnapshotPerfilRef = useRef<(d: Record<string, unknown>) => void>(() => {})
  const setSnapshotMiembroRef = useRef<(d: Record<string, unknown>) => void>(() => {})

  /* ── Carga de datos ── */
  const cargarDatos = useCallback(async () => {
    if (!empresa) return
    setCargando(true)

    const { data: miembroData } = await supabase
      .from('miembros')
      .select('*')
      .eq('id', miembroId)
      .eq('empresa_id', empresa.id)
      .single()

    if (miembroData) {
      setMiembro(miembroData)
      setSnapshotMiembroRef.current(miembroData as unknown as Record<string, unknown>)

      let perfilData: Perfil | null = null

      if (miembroData.usuario_id) {
        // Miembro con cuenta Flux: traer perfil real
        const { data } = await supabase
          .from('perfiles')
          .select('*')
          .eq('id', miembroData.usuario_id)
          .single()
        if (data) perfilData = data as Perfil
      }

      if (!perfilData) {
        // Miembro sin cuenta (solo fichaje/pendiente): derivar perfil "sintético"
        // desde el contacto tipo equipo vinculado a este miembro. Esto permite
        // que la página /usuarios/[id] muestre los datos del empleado aunque
        // todavía no exista en auth.users. Los updates se redirigen al contacto.
        const { data: contacto } = await supabase
          .from('contactos')
          .select('nombre, apellido, correo, telefono, fecha_nacimiento, documento_numero, domicilio')
          .eq('miembro_id', miembroData.id)
          .eq('en_papelera', false)
          .maybeSingle()

        perfilData = {
          id: '', // vacío = perfil sintético; guardarPerfil lo usa como señal
          nombre: contacto?.nombre || '',
          apellido: contacto?.apellido || '',
          avatar_url: null,
          telefono: contacto?.telefono || null,
          creado_en: miembroData.unido_en,
          actualizado_en: miembroData.unido_en,
          correo: contacto?.correo || null,
          correo_empresa: contacto?.correo || null,
          telefono_empresa: null,
          fecha_nacimiento: contacto?.fecha_nacimiento || null,
          genero: null,
          documento_numero: contacto?.documento_numero || null,
          domicilio: contacto?.domicilio || null,
          direccion: null,
        }
      }

      setPerfil(perfilData)
      setSnapshotPerfilRef.current(perfilData as unknown as Record<string, unknown>)

      // Registrar en historial de recientes (fire-and-forget)
      fetch('/api/dashboard/recientes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tipoEntidad: 'miembro',
          entidadId: miembroData.id,
          titulo: [perfilData.nombre, perfilData.apellido].filter(Boolean).join(' ') || 'Usuario',
          subtitulo: miembroData.puesto_nombre || miembroData.rol || undefined,
          accion: 'visto',
        }),
      }).catch(() => {})

      // Sectores de la empresa
      const { data: sectoresData } = await supabase
        .from('sectores')
        .select('id, nombre')
        .eq('empresa_id', empresa.id)
        .eq('activo', true)
        .order('orden')
      if (sectoresData) setSectores(sectoresData)

      // Puestos de la empresa
      const { data: puestosData } = await supabase
        .from('puestos')
        .select('id, nombre')
        .eq('empresa_id', empresa.id)
        .eq('activo', true)
        .order('orden')
      if (puestosData) setPuestos(puestosData)

      // Sector actual del miembro
      const sectorRes = await fetch(`/api/miembros/${miembroId}/sector`)
      if (sectorRes.ok) {
        const sectorData = await sectorRes.json()
        if (sectorData?.sector_id) setSectorActualId(sectorData.sector_id)
      }

      // Info bancaria
      const { data: bancariaData } = await supabase
        .from('info_bancaria')
        .select('*')
        .eq('miembro_id', miembroId)
        .maybeSingle()
      if (bancariaData) setInfoBancaria(bancariaData)

      // Catálogo de bancos
      fetch('/api/bancos').then(r => r.ok ? r.json() : []).then(setBancosEmpresa).catch(() => {})

      // Contacto de emergencia
      const emergenciaRes = await fetch(`/api/miembros/${miembroId}/emergencia`)
      if (emergenciaRes.ok) {
        const emergenciaData = await emergenciaRes.json()
        if (emergenciaData) setContactoEmergencia(emergenciaData)
      }

      // Documentos del usuario
      const { data: docsData } = await supabase
        .from('documentos_usuario')
        .select('*')
        .eq('miembro_id', miembroId)
      if (docsData) setDocumentosUsuario(docsData)
    }

    setCargando(false)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [empresa, miembroId])

  useEffect(() => { cargarDatos() }, [cargarDatos])

  /* ── Cargar invitación vigente por correo del empleado (si existe) ── */
  useEffect(() => {
    if (!empresa || !miembro) { setInvitacionVigente(null); return }
    const correoBuscado = (perfil?.correo_empresa || perfil?.correo || '').toLowerCase().trim()
    if (!correoBuscado) { setInvitacionVigente(null); return }

    supabase
      .from('invitaciones')
      .select('token, expira_en, usado')
      .eq('empresa_id', empresa.id)
      .eq('correo', correoBuscado)
      .eq('usado', false)
      .gt('expira_en', new Date().toISOString())
      .order('creado_en', { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          setInvitacionVigente(data)
          // Reconstruir link (usando slug si lo tiene la empresa)
          const slug = (empresa as { slug?: string }).slug
          const dominio = process.env.NEXT_PUBLIC_APP_DOMAIN || 'salixweb.com'
          const link = slug
            ? `https://${slug}.${dominio}/invitacion?token=${data.token}`
            : `${window.location.origin}/invitacion?token=${data.token}`
          setLinkInvitacion(link)
        } else {
          setInvitacionVigente(null)
          setLinkInvitacion(null)
        }
      })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [empresa, miembro, perfil])

  /* ── Autoguardado ── */
  const guardarPerfil = useCallback(async (datos: Record<string, unknown>) => {
    if (!perfil) return false

    // Perfil sintético (miembro sin cuenta Flux): los cambios se persisten
    // en el contacto tipo equipo vinculado en vez de en `perfiles`. Cuando
    // el empleado reclame su cuenta, el trigger de registro copia estos
    // datos al perfil real.
    if (!perfil.id) {
      const mapaContacto: Record<string, unknown> = {}
      if ('nombre' in datos) mapaContacto.nombre = datos.nombre
      if ('apellido' in datos) mapaContacto.apellido = datos.apellido
      if ('telefono' in datos) mapaContacto.telefono = datos.telefono
      if ('correo_empresa' in datos) mapaContacto.correo = datos.correo_empresa
      if ('correo' in datos) mapaContacto.correo = datos.correo
      if ('fecha_nacimiento' in datos) mapaContacto.fecha_nacimiento = datos.fecha_nacimiento
      if ('documento_numero' in datos) mapaContacto.documento_numero = datos.documento_numero
      if ('domicilio' in datos) mapaContacto.domicilio = datos.domicilio

      if (Object.keys(mapaContacto).length === 0) return true

      const { error } = await supabase
        .from('contactos')
        .update(mapaContacto)
        .eq('miembro_id', miembroId)
      return !error
    }

    try {
      const res = await fetch('/api/perfiles/actualizar', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ perfil_id: perfil.id, ...datos }),
      })
      return res.ok
    } catch {
      return false
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [perfil, miembroId])

  const guardarMiembro = useCallback(async (datos: Record<string, unknown>) => {
    if (!miembro) return false
    const { error } = await supabase.from('miembros').update(datos).eq('id', miembroId)
    return !error
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [miembro, miembroId])

  const { estado: estadoPerfil, guardar: autoGuardarPerfil, setSnapshot: setSnapshotPerfil, flush: flushPerfil } = useAutoguardado({ onGuardar: guardarPerfil })
  const { estado: estadoMiembro, guardarInmediato: guardarMiembroInmediato, setSnapshot: setSnapshotMiembro } = useAutoguardado({ onGuardar: guardarMiembro })

  // Conectar refs
  setSnapshotPerfilRef.current = setSnapshotPerfil
  setSnapshotMiembroRef.current = setSnapshotMiembro

  // Flush datos pendientes al salir
  const flushPerfilRef = useRef(flushPerfil)
  flushPerfilRef.current = flushPerfil
  useEffect(() => {
    return () => { flushPerfilRef.current() }
  }, [])

  const puedeEditar = esPropietario || esAdmin

  /* ── Guardar sector del miembro ── */
  const guardarSector = useCallback(async (sectorId: string) => {
    if (!empresa) return
    setSectorActualId(sectorId)
    await fetch(`/api/miembros/${miembroId}/sector`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sector_id: sectorId || null }),
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [empresa, miembroId])

  /* ── Guardar puesto del miembro ── */
  const guardarPuesto = useCallback(async (puestoId: string) => {
    setMiembro(p => p ? { ...p, puesto_id: puestoId || null } : null)
    await supabase.from('miembros').update({ puesto_id: puestoId || null }).eq('id', miembroId)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [miembroId])

  /* ── Guardar info bancaria ── */
  const guardarInfoBancaria = useCallback(async (campo: string, valor: string) => {
    const datos = { ...infoBancaria, [campo]: valor || null }
    setInfoBancaria(datos)
    if (infoBancaria?.id) {
      await supabase.from('info_bancaria').update({ [campo]: valor || null }).eq('id', infoBancaria.id)
    } else {
      const { data } = await supabase.from('info_bancaria').insert({
        miembro_id: miembroId,
        [campo]: valor || null,
      }).select().single()
      if (data) setInfoBancaria(data)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [miembroId, infoBancaria])

  /* ── Guardar contacto de emergencia ── */
  const guardarEmergencia = useCallback(async (campo: string, valor: string | Record<string, unknown>) => {
    const datos = { ...contactoEmergencia, [campo]: valor || null }
    setContactoEmergencia(datos)
    const res = await fetch(`/api/miembros/${miembroId}/emergencia`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: contactoEmergencia?.id || null,
        ...(contactoEmergencia?.id
          ? { [campo]: valor || null }
          : { nombre: campo === 'nombre' ? valor : '', [campo]: valor || null }
        ),
      }),
    })
    if (res.ok) {
      const data = await res.json()
      if (data) setContactoEmergencia(data)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [miembroId, contactoEmergencia])

  /* ── Acciones de usuario ──
     Cada acción: llama al endpoint, muestra feedback visible ~5s y cierra su modal.
     No levanta excepciones: los errores se reportan por `avisoReenvio` para no romper UX. */
  const ejecutarAccion = useCallback(async (accion: string) => {
    if (!miembroId) return
    setAccionCargando(accion)
    setAvisoReenvio(null)

    try {
      if (accion === 'reset-password') {
        const res = await fetch('/api/miembros/reset-password', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ miembro_id: miembroId }),
        })
        const datos = await res.json().catch(() => ({}))
        if (res.ok) {
          setAvisoReenvio({ tipo: 'exito', texto: `Correo de reseteo enviado a ${datos.correo}` })
        } else {
          setAvisoReenvio({ tipo: 'error', texto: datos?.error || 'No se pudo enviar el correo' })
        }
        setModalResetPassword(false)
      } else if (accion === 'forzar-logout') {
        const res = await fetch('/api/miembros/forzar-logout', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ miembro_id: miembroId }),
        })
        const datos = await res.json().catch(() => ({}))
        if (res.ok) {
          const nombre = `${perfil?.nombre || ''} ${perfil?.apellido || ''}`.trim() || 'el empleado'
          setAvisoReenvio({ tipo: 'exito', texto: `Sesiones cerradas para ${nombre}` })
        } else {
          setAvisoReenvio({ tipo: 'error', texto: datos?.error || 'No se pudo cerrar la sesión' })
        }
        setModalForzarLogout(false)
      } else if (accion === 'forzar-password') {
        // Cierra sesiones + envía correo de recuperación. El admin no define la pass.
        const res = await fetch('/api/miembros/forzar-password', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ miembro_id: miembroId }),
        })
        const datos = await res.json().catch(() => ({}))
        if (res.ok) {
          setAvisoReenvio({ tipo: 'exito', texto: `Se cerró la sesión y se envió correo a ${datos.correo}` })
        } else {
          setAvisoReenvio({ tipo: 'error', texto: datos?.error || 'No se pudo obligar el cambio' })
        }
        setModalForzarPassword(false)
      } else if (accion === 'eliminar') {
        await fetch('/api/miembros/eliminar', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ miembro_id: miembroId }),
        })
        router.push('/usuarios')
        return
      }
    } finally {
      setAccionCargando(null)
      setTimeout(() => setAvisoReenvio(null), 5000)
    }
  }, [miembroId, perfil, router])

  /* ── Cargar pagos ── */
  const cargarPagos = useCallback(async () => {
    if (!empresa || !miembroId) return
    setCargandoPagos(true)
    const { data } = await supabase
      .from('pagos_nomina')
      .select('*')
      .eq('empresa_id', empresa.id)
      .eq('miembro_id', miembroId)
      .order('fecha_inicio_periodo', { ascending: false })
    if (data) setPagos(data)
    setCargandoPagos(false)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [empresa, miembroId])

  useEffect(() => { cargarPagos() }, [cargarPagos])

  /* ── Cargar adelantos ── */
  const cargarAdelantos = useCallback(async () => {
    if (!miembroId) return
    setCargandoAdelantos(true)
    try {
      const res = await fetch(`/api/adelantos?miembro_id=${miembroId}`)
      const data = await res.json()
      setAdelantos(data.adelantos || [])
    } catch { /* silenciar */ }
    setCargandoAdelantos(false)
  }, [miembroId])

  useEffect(() => { cargarAdelantos() }, [cargarAdelantos])

  const crearAdelanto = useCallback(async (datos: {
    monto_total: number
    cuotas_totales: number
    notas: string
    fecha_inicio_descuento: string
  }) => {
    if (!miembro) return
    const frecuencia = (miembro.compensacion_frecuencia as string) || 'mensual'
    await fetch('/api/adelantos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        miembro_id: miembroId,
        monto_total: datos.monto_total,
        cuotas_totales: datos.cuotas_totales,
        fecha_solicitud: new Date().toISOString().split('T')[0],
        fecha_inicio_descuento: datos.fecha_inicio_descuento,
        frecuencia_descuento: frecuencia === 'eventual' ? 'mensual' : frecuencia,
        notas: datos.notas || null,
      }),
    })
    cargarAdelantos()
  }, [miembroId, miembro, cargarAdelantos])

  const cancelarAdelanto = useCallback(async (adelantoId: string) => {
    await fetch(`/api/adelantos/${adelantoId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ estado: 'cancelado' }),
    })
    cargarAdelantos()
  }, [cargarAdelantos])

  /* ── Cargar asistencias reales de un período ── */
  const cargarAsistenciasPeriodo = useCallback(async (inicio: Date, fin: Date) => {
    if (!empresa || !miembroId) return
    setCargandoAsistencias(true)
    const { data } = await supabase
      .from('asistencias')
      .select('*')
      .eq('empresa_id', empresa.id)
      .eq('miembro_id', miembroId)
      .gte('fecha', inicio.toISOString().split('T')[0])
      .lte('fecha', fin.toISOString().split('T')[0])
      .order('fecha', { ascending: true })
    if (data) setAsistenciasPeriodo(data)
    else setAsistenciasPeriodo([])
    setCargandoAsistencias(false)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [empresa, miembroId])

  /* ── Subir comprobante a Supabase Storage ── */
  const subirComprobante = useCallback(async (archivo: File): Promise<string | null> => {
    if (!empresa) return null
    const ext = archivo.name.split('.').pop() || 'pdf'
    const ruta = `${empresa.id}/${miembroId}/${Date.now()}.${ext}`
    const { error } = await supabase.storage
      .from('comprobantes-pago')
      .upload(ruta, archivo, { upsert: false })
    if (error) return null
    const { data: urlData } = supabase.storage
      .from('comprobantes-pago')
      .getPublicUrl(ruta)
    return urlData?.publicUrl || null
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [empresa, miembroId])

  /* ── Registrar pago (callback para TabPagos) ── */
  const registrarPago = useCallback(async (datos: {
    concepto: string
    monto: string
    notas: string
    comprobante: File | null
    periodo: Periodo
  }) => {
    if (!empresa || !miembro || !usuarioActual || !perfil) return

    let comprobanteUrl: string | null = null
    if (datos.comprobante) {
      comprobanteUrl = await subirComprobante(datos.comprobante)
    }

    const fechaFinPeriodo = datos.periodo.fin.toISOString().split('T')[0]

    const { data: pagoInsertado, error } = await supabase.from('pagos_nomina').insert({
      empresa_id: empresa.id,
      miembro_id: miembroId,
      fecha_inicio_periodo: datos.periodo.inicio.toISOString().split('T')[0],
      fecha_fin_periodo: fechaFinPeriodo,
      concepto: datos.concepto || datos.periodo.etiqueta,
      monto_sugerido: montoPagar,
      monto_abonado: parseFloat(datos.monto) || montoPagar,
      dias_habiles: statsPeriodo.habiles,
      dias_trabajados: statsPeriodo.trabajados,
      dias_ausentes: statsPeriodo.ausentes,
      tardanzas: statsPeriodo.tardanzas,
      comprobante_url: comprobanteUrl,
      notas: datos.notas || null,
      creado_por: usuarioActual.id,
      creado_por_nombre: `${perfil.nombre} ${perfil.apellido}`,
    }).select('id').single()

    if (!error && pagoInsertado) {
      // Descontar cuotas de adelantos pendientes
      await fetch('/api/adelantos/descontar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pago_nomina_id: pagoInsertado.id,
          miembro_id: miembroId,
          fecha_fin_periodo: fechaFinPeriodo,
        }),
      }).catch(() => {})
      cargarPagos()
      cargarAdelantos()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [empresa, miembro, miembroId, usuarioActual, perfil, subirComprobante, cargarPagos, cargarAdelantos])

  /* ── Eliminar pago ── */
  const eliminarPago = useCallback(async (pagoId: string) => {
    await supabase.from('pagos_nomina').delete().eq('id', pagoId)
    cargarPagos()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cargarPagos])

  /* ── Acciones del ciclo de vida (invitar / reenviar / copiar / cancelar / activar / reenviar-acceso) ── */
  const manejarAccionEstado = useCallback(async (
    accion: 'invitar' | 'reenviar' | 'copiar-link' | 'cancelar-invitacion' | 'reactivar' | 'desactivar' | 'reenviar-acceso'
  ) => {
    if (!miembro) return
    setAccionEstadoCargando(accion)
    setAvisoReenvio(null)

    try {
      if (accion === 'copiar-link') {
        if (linkInvitacion) {
          await navigator.clipboard.writeText(linkInvitacion)
          // dejar breve feedback visual (el botón muestra Check mientras está "cargando")
          await new Promise(r => setTimeout(r, 900))
        }
        return
      }

      if (accion === 'invitar' || accion === 'reenviar') {
        const correoDestino = (perfil?.correo_empresa || perfil?.correo || '').trim()
        if (!correoDestino) return
        const res = await fetch('/api/invitaciones/crear', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ correo: correoDestino, rol: miembro.rol || 'empleado' }),
        })
        if (res.ok) {
          const datos = await res.json()
          if (datos?.invitacion) {
            setInvitacionVigente({
              token: datos.invitacion.token,
              expira_en: datos.invitacion.expira_en,
              usado: false,
            })
            setLinkInvitacion(datos.link || null)
          }
        }
        return
      }

      if (accion === 'cancelar-invitacion') {
        const correoDestino = (perfil?.correo_empresa || perfil?.correo || '').trim()
        if (!correoDestino) return
        const res = await fetch('/api/invitaciones/cancelar', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ correo: correoDestino }),
        })
        if (res.ok) {
          setInvitacionVigente(null)
          setLinkInvitacion(null)
        }
        return
      }

      if (accion === 'desactivar') {
        // En lugar de desactivar directo, abrimos modal con 2 opciones:
        // pasar a solo fichaje (desvincular cuenta) o desactivar por completo.
        setErrorDesactivar('')
        setModalOpcionesDesactivar(true)
        return
      }

      if (accion === 'reactivar') {
        const res = await fetch('/api/miembros/activar', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ miembro_id: miembroId, activo: true }),
        })
        if (res.ok) setMiembro(m => m ? { ...m, activo: true } : null)
        return
      }

      if (accion === 'reenviar-acceso') {
        // Miembro activo: reenvía correo con link al login usando el canal
        // elegido (canal_notif_correo). El endpoint rechaza si el canal está
        // vacío para no caer silenciosamente al otro correo.
        const res = await fetch('/api/miembros/reenviar-acceso', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ miembro_id: miembroId }),
        })
        const datos = await res.json().catch(() => ({}))
        if (res.ok) {
          setAvisoReenvio({ tipo: 'exito', texto: `Correo de acceso enviado a ${datos.correo}` })
        } else {
          setAvisoReenvio({ tipo: 'error', texto: datos?.error || 'No se pudo enviar el correo' })
        }
        setTimeout(() => setAvisoReenvio(null), 5000)
        return
      }
    } finally {
      setAccionEstadoCargando(null)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [miembro, miembroId, perfil, linkInvitacion])

  /* ── Ejecutar opción del modal de desactivar ── */
  const ejecutarDesactivacion = useCallback(async (
    opcion: 'solo-fichaje' | 'completo',
    forzar = false,
  ) => {
    setOpcionDesactivarCargando(opcion)
    setErrorDesactivar('')
    try {
      if (opcion === 'solo-fichaje') {
        const res = await fetch('/api/miembros/desvincular-cuenta', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ miembro_id: miembroId, forzar }),
        })
        const datos = await res.json()
        if (!res.ok) {
          // Si requiere forzar, el admin confirma y reintentamos
          if (datos?.requiere_forzar && !forzar) {
            const confirmado = window.confirm(
              'Este empleado ya inició sesión en Flux. ¿Querés desvincular su cuenta igualmente? La información del empleado se mantiene, solo pierde el acceso a la app.'
            )
            if (confirmado) return ejecutarDesactivacion(opcion, true)
          }
          setErrorDesactivar(datos?.error || 'Error al pasar a solo fichaje')
          return
        }
        // Recargar datos: el miembro ahora es "solo fichaje"
        await cargarDatos()
        setModalOpcionesDesactivar(false)
      } else {
        // Desactivación completa: miembro.activo = false
        const res = await fetch('/api/miembros/activar', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ miembro_id: miembroId, activo: false }),
        })
        const datos = await res.json().catch(() => ({}))
        if (!res.ok) {
          setErrorDesactivar(datos?.error || 'Error al desactivar')
          return
        }
        setMiembro(m => m ? { ...m, activo: false } : null)
        setModalOpcionesDesactivar(false)
      }
    } finally {
      setOpcionDesactivarCargando(null)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [miembroId, cargarDatos])

  /* Estado derivado del ciclo de vida del empleado */
  const estadoCicloMiembro = useMemo(() => {
    if (!miembro) return 'fichaje' as const
    return calcularEstadoMiembro(
      { usuario_id: miembro.usuario_id ?? null, activo: miembro.activo },
      invitacionVigente,
    )
  }, [miembro, invitacionVigente])

  /* ── Datos derivados ── */
  const nombreCompleto = perfil ? `${perfil.nombre || 'Sin'} ${perfil.apellido || 'nombre'}` : ''

  useEffect(() => {
    if (nombreCompleto && miembroId) {
      setMigajaDinamica(`/usuarios/${miembroId}`, nombreCompleto)
    }
  }, [nombreCompleto, miembroId, setMigajaDinamica])

  const rolActual = (miembro?.rol as Rol) || 'empleado'
  const numeroEmpleado = String(miembro?.numero_empleado || '1').padStart(3, '0')
  const fechaNac = perfil?.fecha_nacimiento ? new Date(perfil.fecha_nacimiento) : null
  const edad = fechaNac ? Math.floor((Date.now() - fechaNac.getTime()) / 31557600000) : null

  /* Compensación */
  const compensacionTipo = (miembro?.compensacion_tipo as string) || 'fijo'
  const compensacionMonto = Number(miembro?.compensacion_monto) || 0
  const compensacionFrecuencia = (miembro?.compensacion_frecuencia as string) || 'mensual'
  const diasTrabajo = Number(miembro?.dias_trabajo) || 5

  const proyeccionMensual = useMemo(() => {
    if (compensacionTipo === 'por_dia') return compensacionMonto * diasTrabajo * 4.33
    if (compensacionTipo === 'por_hora') return compensacionMonto * 8 * diasTrabajo * 4.33
    return compensacionMonto
  }, [compensacionTipo, compensacionMonto, diasTrabajo])

  const proyeccionPorFrecuencia = useMemo(() => {
    if (compensacionTipo === 'fijo') return compensacionMonto
    const montoDiario = compensacionTipo === 'por_hora' ? compensacionMonto * 8 : compensacionMonto
    switch (compensacionFrecuencia) {
      case 'semanal': return montoDiario * diasTrabajo
      case 'quincenal': return montoDiario * Math.round(diasTrabajo * 2.17)
      case 'mensual': return montoDiario * Math.round(diasTrabajo * 4.33)
      case 'eventual': return montoDiario * diasTrabajo * 4.33
      default: return montoDiario * Math.round(diasTrabajo * 4.33)
    }
  }, [compensacionTipo, compensacionMonto, compensacionFrecuencia, diasTrabajo])

  const hoy = new Date()
  const periodoActual = useMemo(() => obtenerPeriodo(hoy, compensacionFrecuencia, fmt.locale), [compensacionFrecuencia, fmt.locale]) // eslint-disable-line react-hooks/exhaustive-deps

  /* Cargar asistencias del mes para el calendario */
  const [asistenciasMesRaw, setAsistenciasMesRaw] = useState<Record<string, unknown>[]>([])

  useEffect(() => {
    if (!empresa || !miembroId) return
    const inicio = new Date(hoy.getFullYear(), hoy.getMonth(), 1)
    const fin = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0)
    supabase
      .from('asistencias')
      .select('*')
      .eq('empresa_id', empresa.id)
      .eq('miembro_id', miembroId)
      .gte('fecha', inicio.toISOString().split('T')[0])
      .lte('fecha', fin.toISOString().split('T')[0])
      .then(({ data }) => { if (data) setAsistenciasMesRaw(data) })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [empresa, miembroId])

  const asistenciasMes = useMemo(() => {
    const resultado: Record<number, 'presente' | 'ausente' | 'tardanza'> = {}
    for (const reg of asistenciasMesRaw) {
      const fecha = new Date(reg.fecha as string)
      const dia = fecha.getDate()
      const estado = reg.estado as string
      if (estado === 'tardanza') resultado[dia] = 'tardanza'
      else if (estado === 'ausente' || estado === 'justificado') resultado[dia] = 'ausente'
      else resultado[dia] = 'presente'
    }
    return resultado
  }, [asistenciasMesRaw])

  const statsAsistencia = useMemo(() => {
    let presentes = 0, ausentes = 0, tardanzas = 0
    Object.values(asistenciasMes).forEach(e => {
      if (e === 'presente') presentes++
      else if (e === 'ausente') ausentes++
      else if (e === 'tardanza') tardanzas++
    })
    return { presentes, ausentes, tardanzas }
  }, [asistenciasMes])

  const diasLaborales = useMemo(() => {
    if (diasTrabajo >= 7) return [0, 1, 2, 3, 4, 5, 6]
    if (diasTrabajo >= 6) return [1, 2, 3, 4, 5, 6]
    return [1, 2, 3, 4, 5]
  }, [diasTrabajo])

  /* Stats del período activo */
  const periodoActivo = periodoActual

  const statsPeriodo = useMemo(() => {
    const datos = asistenciasMesRaw
    const inicio = periodoActivo.inicio
    const fin = periodoActivo.fin

    let habiles = 0
    const iter = new Date(inicio)
    while (iter <= fin) {
      if (diasLaborales.includes(iter.getDay())) habiles++
      iter.setDate(iter.getDate() + 1)
    }

    const fechasTrabajadas = new Set<string>()
    let tardanzasCount = 0
    for (const reg of datos) {
      const fechaStr = reg.fecha as string
      const fecha = new Date(fechaStr)
      if (fecha >= inicio && fecha <= fin) {
        const estado = reg.estado as string
        if (estado === 'presente' || estado === 'tardanza') {
          fechasTrabajadas.add(fechaStr)
        }
        if (estado === 'tardanza') tardanzasCount++
      }
    }

    const trabajados = fechasTrabajadas.size
    const ausentes = Math.max(0, habiles - trabajados)

    return { habiles, trabajados, ausentes, tardanzas: tardanzasCount }
  }, [periodoActivo, asistenciasMesRaw, diasLaborales])

  const diasTrabajadosQuincena = statsPeriodo.trabajados

  const montoPagar = compensacionTipo === 'por_dia'
    ? compensacionMonto * diasTrabajadosQuincena
    : compensacionTipo === 'por_hora'
      ? compensacionMonto * 8 * diasTrabajadosQuincena
      : compensacionMonto

  const estadoIndicador = estadoPerfil !== 'idle' ? estadoPerfil : estadoMiembro

  /* ── Tabs config — "Permisos" solo aplica a empleados con cuenta Flux ── */
  const tabsConfig = [
    { clave: 'resumen', etiqueta: 'Resumen', icono: <User size={15} /> },
    { clave: 'informacion', etiqueta: 'Información', icono: <FileText size={15} /> },
    { clave: 'pagos', etiqueta: 'Pagos', icono: <Wallet size={15} /> },
    ...(miembro?.usuario_id ? [{ clave: 'permisos', etiqueta: 'Permisos', icono: <Shield size={15} /> }] : []),
  ]

  /* ════════════ LOADING / ERROR ════════════ */
  if (cargando) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-6 w-24 bg-superficie-hover rounded" />
          <div className="h-20 bg-superficie-hover rounded-card" />
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map(i => <div key={i} className="h-24 bg-superficie-hover rounded-card" />)}
          </div>
        </div>
      </div>
    )
  }

  if (!miembro || !perfil) {
    return <div className="p-8 text-center text-sm text-texto-terciario">Usuario no encontrado</div>
  }

  /* ════════════ RENDER ════════════ */
  return (
    <div className="p-4 sm:p-6 space-y-5">

      {/* ══════ INDICADOR DE GUARDADO ══════ */}
      {estadoIndicador !== 'idle' && (
        <div className="flex justify-end px-2">
          <IndicadorGuardado estado={estadoIndicador} />
        </div>
      )}

      {/* ══════ HEADER DEL USUARIO ══════ */}
      <CabeceraUsuario
        miembro={miembro}
        perfil={perfil}
        nombreCompleto={nombreCompleto}
        numeroEmpleado={numeroEmpleado}
        edad={edad}
        puedeEditar={puedeEditar}
        esPropietario={esPropietario}
        esAdmin={esAdmin}
        fmt={fmt}
        onActualizarPerfil={guardarPerfil}
        onActualizarMiembro={guardarMiembroInmediato}
        setPerfil={setPerfil}
        setMiembro={setMiembro}
        setModalResetPassword={setModalResetPassword}
        setModalForzarPassword={setModalForzarPassword}
        setModalForzarLogout={setModalForzarLogout}
        setModalConfirmarEliminar={setModalConfirmarEliminar}
        supabase={supabase}
        empresaId={empresa?.id || ''}
        miembroId={miembroId}
      />

      {/* ══════ ESTADO DEL CICLO DE VIDA ══════ */}
      {miembro.rol !== 'propietario' && (
        <div className="space-y-2">
          <InfoEstadoMiembro
            estado={estadoCicloMiembro}
            correo={perfil?.correo_empresa || perfil?.correo || null}
            invitacion={invitacionVigente}
            linkInvitacion={linkInvitacion}
            puedeGestionar={puedeEditar}
            onAccion={manejarAccionEstado}
            cargando={accionEstadoCargando}
          />
          {/* Feedback de reenvío de acceso (visible ~5s) */}
          {avisoReenvio && (
            <div className={`text-xs px-3 py-2 rounded-card border ${
              avisoReenvio.tipo === 'exito'
                ? 'bg-insignia-exito-fondo/40 border-insignia-exito/30 text-insignia-exito-texto'
                : 'bg-insignia-peligro-fondo/40 border-insignia-peligro/30 text-insignia-peligro-texto'
            }`}>
              {avisoReenvio.texto}
            </div>
          )}
        </div>
      )}

      {/* ══════ TABS ══════ */}
      <Tabs
        tabs={tabsConfig}
        activo={tab}
        onChange={(clave) => setTab(clave as TabPerfil)}
      />

      {/* ══════ CONTENIDO DE TABS ══════ */}
      <AnimatePresence mode="wait">
        <motion.div
          key={tab}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.15 }}
        >

          {tab === 'resumen' && (
            <TabResumen
              perfil={perfil}
              miembro={miembro}
              statsAsistencia={statsAsistencia}
              statsPeriodo={statsPeriodo}
              compensacionTipo={compensacionTipo}
              compensacionMonto={compensacionMonto}
              compensacionFrecuencia={compensacionFrecuencia}
              diasTrabajo={diasTrabajo}
              proyeccionMensual={proyeccionMensual}
              montoPagar={montoPagar}
              diasTrabajadosQuincena={diasTrabajadosQuincena}
              periodoActual={periodoActual}
              asistenciasMes={asistenciasMes}
              diasLaborales={diasLaborales}
              contactoEmergencia={contactoEmergencia}
              documentosUsuario={documentosUsuario}
              archivosDocLocal={archivosDocLocal}
              rolActual={rolActual}
              fechaNac={fechaNac}
              edad={edad}
              fmt={fmt}
              t={t}
              setTab={setTab}
              setDocPreview={setDocPreview}
            />
          )}

          {tab === 'informacion' && (
            <TabInformacion
              perfil={perfil}
              miembro={miembro}
              puedeEditar={puedeEditar}
              setPerfil={setPerfil}
              setMiembro={setMiembro}
              autoGuardarPerfil={autoGuardarPerfil}
              guardarPerfil={guardarPerfil}
              guardarMiembroInmediato={guardarMiembroInmediato}
              guardarMiembro={guardarMiembro}
              sectores={sectores}
              puestos={puestos}
              sectorActualId={sectorActualId}
              guardarSector={guardarSector}
              guardarPuesto={guardarPuesto}
              infoBancaria={infoBancaria}
              setInfoBancaria={setInfoBancaria}
              guardarInfoBancaria={guardarInfoBancaria}
              bancosEmpresa={bancosEmpresa}
              setBancosEmpresa={setBancosEmpresa}
              contactoEmergencia={contactoEmergencia}
              setContactoEmergencia={setContactoEmergencia}
              guardarEmergencia={guardarEmergencia}
              documentosUsuario={documentosUsuario}
              setDocumentosUsuario={setDocumentosUsuario}
              archivosDocLocal={archivosDocLocal}
              setArchivosDocLocal={setArchivosDocLocal}
              setDocPreview={setDocPreview}
              rolActual={rolActual}
              edad={edad}
              empresa={empresa as Record<string, unknown> | null}
              miembroId={miembroId}
              fmt={fmt}
              t={t}
              supabase={supabase}
            />
          )}

          {tab === 'pagos' && (
            <TabPagos
              miembro={miembro}
              perfil={perfil}
              puedeEditar={puedeEditar}
              esPropietario={esPropietario}
              esAdmin={esAdmin}
              compensacionTipo={compensacionTipo}
              compensacionMonto={compensacionMonto}
              compensacionFrecuencia={compensacionFrecuencia}
              diasTrabajo={diasTrabajo}
              proyeccionMensual={proyeccionMensual}
              proyeccionPorFrecuencia={proyeccionPorFrecuencia}
              montoPagar={montoPagar}
              statsPeriodo={statsPeriodo}
              periodoActual={periodoActual}
              pagos={pagos}
              cargandoPagos={cargandoPagos}
              cargandoAsistencias={cargandoAsistencias}
              setMiembro={setMiembro}
              guardarMiembroInmediato={guardarMiembroInmediato}
              cargarPagos={cargarPagos}
              cargarAsistenciasPeriodo={cargarAsistenciasPeriodo}
              eliminarPago={eliminarPago}
              registrarPago={registrarPago}
              adelantos={adelantos}
              cargandoAdelantos={cargandoAdelantos}
              crearAdelanto={crearAdelanto}
              cancelarAdelanto={cancelarAdelanto}
              fmt={fmt}
              t={t}
            />
          )}

          {tab === 'permisos' && miembro && (
            <SeccionPermisos
              miembroId={miembro.id as string}
              rol={rolActual}
              permisosCustomIniciales={miembro.permisos_custom ? (miembro.permisos_custom as PermisosMapa) : null}
              nombreMiembro={nombreCompleto}
              onGuardar={async (permisos) => {
                await guardarMiembroInmediato({ permisos_custom: permisos })
                setMiembro(prev => prev ? { ...prev, permisos_custom: permisos } : null)
              }}
              onRevocar={async (motivo) => {
                const res = await fetch(`/api/miembros/${miembro.id}/revocar`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ motivo }),
                })
                if (!res.ok) throw new Error('Error al revocar')
                setMiembro(prev => prev ? { ...prev, permisos_custom: {} } : null)
              }}
            />
          )}

        </motion.div>
      </AnimatePresence>

      {/* ══════ MODALES DE ACCIONES ══════
           Todas las acciones administrativas pasan por ModalConfirmacion para evitar
           clicks accidentales. Orden por severidad creciente: reseteo (suave) →
           obligar (cierra sesión + correo) → logout (cierra sesión) → eliminar. */}

      {/* Enviar reseteo de contraseña (mail con link, sesión sigue viva) */}
      <ModalConfirmacion
        abierto={modalResetPassword}
        onCerrar={() => setModalResetPassword(false)}
        onConfirmar={() => ejecutarAccion('reset-password')}
        titulo={t('usuarios.accion_reset_password_titulo')}
        descripcion={t('usuarios.accion_reset_password_desc').replace('{{nombre}}', nombreCompleto)}
        tipo="info"
        etiquetaConfirmar={t('usuarios.accion_reset_password_titulo')}
        cargando={accionCargando === 'reset-password'}
      />

      {/* Obligar a cambiar contraseña (cierra sesión + envía correo de recuperación) */}
      <ModalConfirmacion
        abierto={modalForzarPassword}
        onCerrar={() => setModalForzarPassword(false)}
        onConfirmar={() => ejecutarAccion('forzar-password')}
        titulo={t('usuarios.accion_forzar_password_titulo')}
        descripcion={t('usuarios.accion_forzar_password_desc').replace('{{nombre}}', nombreCompleto)}
        tipo="advertencia"
        etiquetaConfirmar={t('usuarios.accion_forzar_password_titulo')}
        cargando={accionCargando === 'forzar-password'}
      />

      {/* Forzar cierre de sesión (sin tocar la contraseña) */}
      <ModalConfirmacion
        abierto={modalForzarLogout}
        onCerrar={() => setModalForzarLogout(false)}
        onConfirmar={() => ejecutarAccion('forzar-logout')}
        titulo={t('usuarios.accion_forzar_logout_titulo')}
        descripcion={t('usuarios.accion_forzar_logout_desc').replace('{{nombre}}', nombreCompleto)}
        tipo="advertencia"
        etiquetaConfirmar={t('usuarios.accion_forzar_logout_titulo')}
        cargando={accionCargando === 'forzar-logout'}
      />

      {/* Vista previa de documento */}
      <Modal
        abierto={!!docPreview}
        onCerrar={() => setDocPreview(null)}
        titulo={docPreview?.titulo || ''}
        tamano="xl"
      >
        {docPreview && (
          <div className="flex flex-col items-center gap-4">
            <div className="relative w-full" style={{ height: '60dvh' }}>
              <Image src={docPreview.url} alt={docPreview.titulo} fill sizes="(max-width: 768px) 100vw, 600px" className="object-contain rounded-card" />
            </div>
            <a
              href={docPreview.url}
              download={docPreview.titulo}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-texto-marca hover:underline flex items-center gap-1.5"
            >
              <FileUp size={14} />
              Descargar imagen
            </a>
          </div>
        )}
      </Modal>

      {/* Confirmar eliminación */}
      <ModalConfirmacion
        abierto={modalConfirmarEliminar}
        onCerrar={() => setModalConfirmarEliminar(false)}
        onConfirmar={() => ejecutarAccion('eliminar')}
        titulo={t('usuarios.eliminar_usuario')}
        descripcion={`¿Estás seguro de que querés eliminar a ${nombreCompleto} de la empresa? Esta acción no se puede deshacer. Se borrarán todos sus datos, pagos y documentos.`}
        tipo="peligro"
        etiquetaConfirmar="Eliminar"
        cargando={accionCargando === 'eliminar'}
      />

      {/* ══════ MODAL OPCIONES AL DESACTIVAR ══════ */}
      <Modal
        abierto={modalOpcionesDesactivar}
        onCerrar={() => { if (!opcionDesactivarCargando) setModalOpcionesDesactivar(false) }}
        titulo={`Desactivar a ${perfil?.nombre || 'este empleado'}`}
        tamano="md"
      >
        <div className="space-y-3">
          <p className="text-sm text-texto-secundario leading-relaxed">
            Elegí cómo querés desactivar el acceso. Los datos del empleado (legajo, RFID, fichadas, pagos, compensación) se mantienen intactos en cualquier caso.
          </p>

          {/* Opción 1: Pasar a solo fichaje */}
          <Tarjeta
            compacta
            onClick={opcionDesactivarCargando ? undefined : () => ejecutarDesactivacion('solo-fichaje')}
            className={opcionDesactivarCargando ? 'opacity-50 pointer-events-none' : 'group'}
          >
            <div className="flex items-start gap-3">
              <div className="shrink-0 size-10 rounded-input bg-insignia-cyan-fondo text-insignia-cyan-texto flex items-center justify-center">
                <Fingerprint size={20} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-texto-primario flex items-center gap-2">
                  Pasar a solo fichaje
                  {opcionDesactivarCargando === 'solo-fichaje' && (
                    <span className="text-xs text-texto-terciario">Aplicando…</span>
                  )}
                </p>
                <p className="text-xs text-texto-secundario mt-1 leading-relaxed">
                  Sigue fichando en el kiosco con RFID o PIN. Pierde el acceso a la app Flux. Podés re-invitarlo después cuando quieras.
                </p>
              </div>
              <ChevronRight size={18} className="text-texto-terciario shrink-0 group-hover:text-texto-primario transition-colors" />
            </div>
          </Tarjeta>

          {/* Opción 2: Desactivar por completo */}
          <Tarjeta
            compacta
            onClick={opcionDesactivarCargando ? undefined : () => ejecutarDesactivacion('completo')}
            className={opcionDesactivarCargando ? 'opacity-50 pointer-events-none' : 'group'}
          >
            <div className="flex items-start gap-3">
              <div className="shrink-0 size-10 rounded-input bg-insignia-neutro-fondo text-insignia-neutro-texto flex items-center justify-center">
                <PowerOff size={20} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-texto-primario flex items-center gap-2">
                  Desactivar por completo
                  {opcionDesactivarCargando === 'completo' && (
                    <span className="text-xs text-texto-terciario">Aplicando…</span>
                  )}
                </p>
                <p className="text-xs text-texto-secundario mt-1 leading-relaxed">
                  No puede fichar ni acceder a Flux. Se mantiene todo el historial, podés reactivar cuando quieras.
                </p>
              </div>
              <ChevronRight size={18} className="text-texto-terciario shrink-0 group-hover:text-texto-primario transition-colors" />
            </div>
          </Tarjeta>

          {errorDesactivar && (
            <p className="text-xs text-insignia-peligro pt-1">{errorDesactivar}</p>
          )}

          <div className="flex justify-end pt-2 border-t border-white/[0.07]">
            <Boton
              variante="fantasma"
              tamano="sm"
              onClick={() => setModalOpcionesDesactivar(false)}
              disabled={!!opcionDesactivarCargando}
            >
              {t('comun.cancelar')}
            </Boton>
          </div>
        </div>
      </Modal>
    </div>
  )
}
