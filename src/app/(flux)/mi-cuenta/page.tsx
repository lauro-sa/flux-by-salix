'use client'

import { useState, useEffect, useCallback, createContext, useContext } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { User, Shield, Bell, Palette } from 'lucide-react'
import { PlantillaConfiguracion } from '@/componentes/entidad/PlantillaConfiguracion'
import type { SeccionConfig } from '@/componentes/entidad/PlantillaConfiguracion'
import { useAuth } from '@/hooks/useAuth'
import { useEmpresa } from '@/hooks/useEmpresa'
import { crearClienteNavegador } from '@/lib/supabase/cliente'
import { formatearTelefono } from '@/lib/formato'
import { SeccionPerfil } from './secciones/SeccionPerfil'
import { SeccionSeguridad } from './secciones/SeccionSeguridad'
import { SeccionNotificaciones } from './secciones/SeccionNotificaciones'
import { SeccionApariencia } from './secciones/SeccionApariencia'

/**
 * Contexto de Mi Cuenta — carga datos una sola vez y los comparte entre secciones.
 * Evita recargas al cambiar de pestaña.
 */

export interface DatosMiCuenta {
  /* Perfil */
  nombre: string
  apellido: string
  avatarUrl: string | null
  telefono: string
  correoEmpresa: string
  telefonoEmpresa: string
  documentoNumero: string
  fechaNacimiento: string | null
  domicilio: string | null
  /* Miembro */
  rol: string
  miembroId: string
  puestoNombre: string
  sectorNombre: string
  unidoEn: string
  numeroEmpleado: string
  compensacionTipo: string
  compensacionMonto: string
  compensacionFrecuencia: string
  diasTrabajo: number
  /* Contacto de emergencia */
  emergencia: { nombre: string; telefono: string; relacion: string }
  /* Auth */
  correoAcceso: string
  /* Métodos */
  setTelefono: (v: string) => void
  setEmergencia: (v: { nombre: string; telefono: string; relacion: string }) => void
  guardarTelefono: (tel: string) => Promise<boolean>
  guardarEmergencia: (datos: { nombre: string; telefono: string; relacion: string }) => Promise<boolean>
  cargando: boolean
}

const ContextoMiCuenta = createContext<DatosMiCuenta | null>(null)

export function useMiCuenta() {
  const ctx = useContext(ContextoMiCuenta)
  if (!ctx) throw new Error('useMiCuenta debe usarse dentro de PaginaMiCuenta')
  return ctx
}

export default function PaginaMiCuenta() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const seccionInicial = searchParams.get('seccion') || 'perfil'
  const [seccionActiva, setSeccionActiva] = useState(seccionInicial)

  const { usuario } = useAuth()
  const { empresa } = useEmpresa()

  /* Estado compartido */
  const [cargando, setCargando] = useState(true)
  const [nombre, setNombre] = useState('')
  const [apellido, setApellido] = useState('')
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const [telefono, setTelefono] = useState('')
  const [correoEmpresa, setCorreoEmpresa] = useState('')
  const [telefonoEmpresa, setTelefonoEmpresa] = useState('')
  const [documentoNumero, setDocumentoNumero] = useState('')
  const [rol, setRol] = useState('')
  const [miembroId, setMiembroId] = useState('')
  const [puestoNombre, setPuestoNombre] = useState('')
  const [sectorNombre, setSectorNombre] = useState('')
  const [unidoEn, setUnidoEn] = useState('')
  const [numeroEmpleado, setNumeroEmpleado] = useState('')
  const [fechaNacimiento, setFechaNacimiento] = useState<string | null>(null)
  const [domicilio, setDomicilio] = useState<string | null>(null)
  const [compensacionTipo, setCompensacionTipo] = useState('')
  const [compensacionMonto, setCompensacionMonto] = useState('')
  const [compensacionFrecuencia, setCompensacionFrecuencia] = useState('')
  const [diasTrabajo, setDiasTrabajo] = useState(5)
  const [emergencia, setEmergencia] = useState({ nombre: '', telefono: '', relacion: '' })

  /* Carga única de datos */
  useEffect(() => {
    if (!usuario || !empresa) return

    const cargar = async () => {
      setCargando(true)
      const supabase = crearClienteNavegador()

      /* Perfil */
      const { data: perfil } = await supabase
        .from('perfiles')
        .select('nombre, apellido, avatar_url, telefono, correo_empresa, telefono_empresa, documento_numero, fecha_nacimiento, domicilio')
        .eq('id', usuario.id)
        .single()

      if (perfil) {
        setNombre(perfil.nombre || '')
        setApellido(perfil.apellido || '')
        setAvatarUrl(perfil.avatar_url || null)
        setTelefono(perfil.telefono ? formatearTelefono(perfil.telefono) : '')
        setTelefonoEmpresa(perfil.telefono_empresa ? formatearTelefono(perfil.telefono_empresa) : '')
        setCorreoEmpresa(perfil.correo_empresa || '')
        setDocumentoNumero(perfil.documento_numero || '')
        setFechaNacimiento(perfil.fecha_nacimiento || null)
        setDomicilio(perfil.domicilio || null)
      }

      /* Miembro */
      const { data: miembro } = await supabase
        .from('miembros')
        .select('id, rol, unido_en, numero_empleado, puesto_id, compensacion_tipo, compensacion_monto, compensacion_frecuencia, dias_trabajo')
        .eq('usuario_id', usuario.id)
        .eq('empresa_id', empresa.id)
        .single()

      if (miembro) {
        setRol(miembro.rol)
        setMiembroId(miembro.id)
        setUnidoEn(miembro.unido_en || '')
        setNumeroEmpleado(String(miembro.numero_empleado || '1').padStart(3, '0'))
        setCompensacionTipo(miembro.compensacion_tipo || '')
        setCompensacionMonto(miembro.compensacion_monto || '0')
        setCompensacionFrecuencia(miembro.compensacion_frecuencia || 'mensual')
        setDiasTrabajo(miembro.dias_trabajo || 5)

        /* Puesto */
        if (miembro.puesto_id) {
          const { data: puesto } = await supabase
            .from('puestos').select('nombre').eq('id', miembro.puesto_id).single()
          if (puesto) setPuestoNombre(puesto.nombre)
        }

        /* Sector */
        const { data: ms } = await supabase
          .from('miembros_sectores').select('sector_id')
          .eq('miembro_id', miembro.id).eq('es_primario', true).single()
        if (ms) {
          const { data: sector } = await supabase
            .from('sectores').select('nombre').eq('id', ms.sector_id).single()
          if (sector) setSectorNombre(sector.nombre)
        }

        /* Contacto de emergencia */
        const { data: ce } = await supabase
          .from('contactos_emergencia').select('nombre, relacion, telefono')
          .eq('miembro_id', miembro.id).single()
        if (ce) {
          setEmergencia({ nombre: ce.nombre || '', telefono: ce.telefono || '', relacion: ce.relacion || '' })
        }
      }

      setCargando(false)
    }

    cargar()
  }, [usuario, empresa])

  /* Métodos de guardado */
  const guardarTelefono = useCallback(async (tel: string) => {
    if (!usuario) return false
    const res = await fetch('/api/perfiles/actualizar', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ perfil_id: usuario.id, telefono: tel }),
    })
    return res.ok
  }, [usuario])

  const guardarEmergenciaFn = useCallback(async (datos: { nombre: string; telefono: string; relacion: string }) => {
    if (!miembroId) return false
    const supabase = crearClienteNavegador()

    const { data: existente } = await supabase
      .from('contactos_emergencia').select('id').eq('miembro_id', miembroId).single()

    const resultado = existente
      ? await supabase.from('contactos_emergencia').update(datos).eq('miembro_id', miembroId)
      : await supabase.from('contactos_emergencia').insert({ miembro_id: miembroId, ...datos })

    if (!resultado.error) {
      setEmergencia({ ...datos })
      return true
    }
    return false
  }, [miembroId])

  const secciones: SeccionConfig[] = [
    { id: 'perfil', etiqueta: 'Perfil', icono: <User size={16} /> },
    { id: 'seguridad', etiqueta: 'Seguridad', icono: <Shield size={16} /> },
    { id: 'notificaciones', etiqueta: 'Notificaciones', icono: <Bell size={16} /> },
    { id: 'apariencia', etiqueta: 'Apariencia', icono: <Palette size={16} /> },
  ]

  const valor: DatosMiCuenta = {
    nombre, apellido, avatarUrl, telefono, correoEmpresa, telefonoEmpresa,
    documentoNumero, fechaNacimiento, domicilio,
    rol, miembroId, puestoNombre, sectorNombre, unidoEn, numeroEmpleado,
    compensacionTipo, compensacionMonto, compensacionFrecuencia, diasTrabajo,
    emergencia, correoAcceso: usuario?.email || '',
    setTelefono, setEmergencia,
    guardarTelefono, guardarEmergencia: guardarEmergenciaFn,
    cargando,
  }

  return (
    <ContextoMiCuenta.Provider value={valor}>
      <PlantillaConfiguracion
        titulo="Mi cuenta"
        descripcion="Tu perfil, seguridad, notificaciones y personalización visual."
        iconoHeader={<User size={22} style={{ color: 'var(--texto-marca)' }} />}
        volverTexto="Inicio"
        onVolver={() => router.push('/')}
        secciones={secciones}
        seccionActiva={seccionActiva}
        onCambiarSeccion={setSeccionActiva}
      >
        {seccionActiva === 'perfil' && <SeccionPerfil />}
        {seccionActiva === 'seguridad' && <SeccionSeguridad />}
        {seccionActiva === 'notificaciones' && <SeccionNotificaciones />}
        {seccionActiva === 'apariencia' && <SeccionApariencia />}
      </PlantillaConfiguracion>
    </ContextoMiCuenta.Provider>
  )
}
