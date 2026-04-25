'use client'

import { useState, useCallback, useMemo } from 'react'
import {
  Mail, Phone, CreditCard, Briefcase, Heart,
  Pencil, X, Building, Calendar, Cake, MapPin,
  DollarSign, CalendarDays, User, MessageSquare, Check,
} from 'lucide-react'
import { Input } from '@/componentes/ui/Input'
import { FORMATOS_NOMBRE_REMITENTE, type FormatoNombreRemitente } from '@/lib/nombre-remitente'
import { Avatar } from '@/componentes/ui/Avatar'
import { Boton } from '@/componentes/ui/Boton'
import { Insignia } from '@/componentes/ui/Insignia'
import { Tarjeta } from '@/componentes/ui/Tarjeta'
import { TextoTelefono } from '@/componentes/ui/TextoTelefono'
import { useFormato } from '@/hooks/useFormato'
import { useCambiosSinGuardar } from '@/hooks/useCambiosPendientes'
import { useMiCuenta } from '../page'
import { DELAY_CARGA } from '@/lib/constantes/timeouts'

/**
 * SeccionPerfil — vista rica del perfil personal.
 * Usa useMiCuenta() para datos compartidos (sin recargar al cambiar tab).
 */

const ETIQUETA_ROL: Record<string, string> = {
  propietario: 'Propietario', administrador: 'Admin', gestor: 'Gestor',
  vendedor: 'Vendedor', supervisor: 'Supervisor', colaborador: 'Colaborador', invitado: 'Invitado',
}

const COLOR_ROL: Record<string, 'primario' | 'violeta' | 'info' | 'naranja' | 'cyan' | 'neutro' | 'advertencia'> = {
  propietario: 'primario', administrador: 'violeta', gestor: 'info',
  vendedor: 'naranja', supervisor: 'cyan', colaborador: 'neutro', invitado: 'advertencia',
}

const ETIQUETA_COMP: Record<string, string> = {
  por_dia: 'Cobra por día', por_hora: 'Cobra por hora', fijo: 'Sueldo fijo', fija: 'Sueldo fijo',
}

const ETIQUETA_FREQ: Record<string, string> = {
  semanal: 'Semanal', quincenal: 'Quincenal', mensual: 'Mensual', eventual: 'Eventual',
}

function diasHastaCumple(fechaNac: string | null): number | null {
  if (!fechaNac) return null
  const hoy = new Date()
  const nac = new Date(fechaNac)
  const cumpleEsteAnio = new Date(hoy.getFullYear(), nac.getMonth(), nac.getDate())
  if (cumpleEsteAnio < hoy) cumpleEsteAnio.setFullYear(hoy.getFullYear() + 1)
  return Math.ceil((cumpleEsteAnio.getTime() - hoy.getTime()) / 86400000)
}

function calcularEdad(fechaNac: string | null): number | null {
  if (!fechaNac) return null
  return Math.floor((Date.now() - new Date(fechaNac).getTime()) / 31557600000)
}

export function SeccionPerfil() {
  const ctx = useMiCuenta()
  const fmt = useFormato()

  /* Teléfono editable */
  const [telLocal, setTelLocal] = useState(ctx.telefono)
  const [guardandoTel, setGuardandoTel] = useState(false)
  const [telGuardado, setTelGuardado] = useState(false)

  /* Emergencia edición */
  const [editandoEm, setEditandoEm] = useState(false)
  const [emLocal, setEmLocal] = useState(ctx.emergencia)
  const [erroresEm, setErroresEm] = useState<Record<string, string>>({})
  const [guardandoEm, setGuardandoEm] = useState(false)

  const guardarTel = useCallback(async () => {
    setGuardandoTel(true)
    const ok = await ctx.guardarTelefono(telLocal)
    setGuardandoTel(false)
    if (ok) { ctx.setTelefono(telLocal); setTelGuardado(true); setTimeout(() => setTelGuardado(false), DELAY_CARGA) }
  }, [telLocal, ctx])

  const iniciarEdicionEm = () => { setEmLocal({ ...ctx.emergencia }); setErroresEm({}); setEditandoEm(true) }
  const cancelarEdicionEm = useCallback(() => {
    setEmLocal({ ...ctx.emergencia }); setErroresEm({}); setEditandoEm(false)
  }, [ctx.emergencia])

  const guardarEm = useCallback(async () => {
    const e: Record<string, string> = {}
    if (!emLocal.nombre.trim()) e.nombre = 'Obligatorio'
    if (!emLocal.relacion.trim()) e.relacion = 'Obligatorio'
    if (!emLocal.telefono.trim()) e.telefono = 'Obligatorio'
    else if (!/^\+?[\d\s\-()]{7,}$/.test(emLocal.telefono.trim())) e.telefono = 'Número inválido'
    setErroresEm(e)
    if (Object.keys(e).length > 0) return
    setGuardandoEm(true)
    const datos = { nombre: emLocal.nombre.trim(), telefono: emLocal.telefono.trim(), relacion: emLocal.relacion.trim() }
    const ok = await ctx.guardarEmergencia(datos)
    setGuardandoEm(false)
    if (ok) setEditandoEm(false)
  }, [emLocal, ctx])

  // Detectar si el form de emergencia tiene cambios respecto al dato persistido.
  const cambiosEmergencia = useMemo(() => {
    if (!editandoEm) return []
    const diffs: { campo: string; valor?: string }[] = []
    if ((emLocal.nombre || '') !== (ctx.emergencia.nombre || '')) {
      diffs.push({ campo: 'Nombre de contacto de emergencia', valor: emLocal.nombre || '(vacío)' })
    }
    if ((emLocal.relacion || '') !== (ctx.emergencia.relacion || '')) {
      diffs.push({ campo: 'Relación', valor: emLocal.relacion || '(vacío)' })
    }
    if ((emLocal.telefono || '') !== (ctx.emergencia.telefono || '')) {
      diffs.push({ campo: 'Teléfono de emergencia', valor: emLocal.telefono || '(vacío)' })
    }
    return diffs
  }, [editandoEm, emLocal, ctx.emergencia])

  // Al editar contacto de emergencia con cambios sin guardar, pedir confirmación al navegar.
  useCambiosSinGuardar({
    id: 'perfil-emergencia',
    dirty: cambiosEmergencia.length > 0,
    titulo: 'Contacto de emergencia',
    cambios: cambiosEmergencia,
    onGuardar: async () => { await guardarEm() },
    onDescartar: () => { cancelarEdicionEm() },
  })

  const nombreCompleto = [ctx.nombre, ctx.apellido].filter(Boolean).join(' ') || 'Usuario'
  const edad = calcularEdad(ctx.fechaNacimiento)
  const diasCumple = diasHastaCumple(ctx.fechaNacimiento)

  if (ctx.cargando) {
    return <div className="flex items-center justify-center py-20"><span className="text-sm text-texto-terciario">Cargando perfil...</span></div>
  }

  return (
    <div className="space-y-5">

      {/* ══════════════════════════════════════
          HEADER — Avatar + info principal
         ══════════════════════════════════════ */}
      <div className="flex items-start gap-4">
        <Avatar nombre={nombreCompleto} foto={ctx.avatarUrl} tamano="xl" />
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-xl font-bold text-texto-primario">{nombreCompleto}</h2>
              <div className="flex flex-wrap items-center gap-2 mt-1.5">
                {ctx.rol && <Insignia color={COLOR_ROL[ctx.rol] || 'neutro'}>{ETIQUETA_ROL[ctx.rol] || ctx.rol}</Insignia>}
                {ctx.puestoNombre && (
                  <span className="text-sm text-texto-secundario flex items-center gap-1.5">
                    <Briefcase size={13} className="text-texto-terciario" /> {ctx.puestoNombre}
                  </span>
                )}
                {ctx.sectorNombre && (
                  <span className="text-sm text-texto-secundario flex items-center gap-1.5">
                    <Building size={13} className="text-texto-terciario" /> {ctx.sectorNombre}
                  </span>
                )}
              </div>
            </div>
            {ctx.numeroEmpleado && (
              <span className="text-2xl font-bold font-mono text-texto-terciario/25 shrink-0">#{ctx.numeroEmpleado}</span>
            )}
          </div>

          {/* Sub-datos en línea */}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-sm text-texto-secundario">
            {diasCumple === 0 && (
              <span className="flex items-center gap-1.5 text-insignia-advertencia font-medium animate-pulse">
                <Cake size={13} /> ¡Hoy es tu cumpleaños!
              </span>
            )}
            {diasCumple !== null && diasCumple > 0 && diasCumple <= 7 && (
              <span className="flex items-center gap-1.5 text-insignia-advertencia/70">
                <Cake size={13} /> Cumpleaños en {diasCumple} {diasCumple === 1 ? 'día' : 'días'}
              </span>
            )}
            {edad !== null && (diasCumple === null || diasCumple > 7) && (
              <span className="flex items-center gap-1.5">
                <User size={13} className="text-texto-terciario" /> {edad} años
              </span>
            )}
            {ctx.unidoEn && (
              <span className="flex items-center gap-1.5">
                <Calendar size={13} className="text-texto-terciario" /> Desde {fmt.fecha(ctx.unidoEn)}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* ══════════════════════════════════════
          TARJETAS DE INFORMACIÓN
         ══════════════════════════════════════ */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {/* Correo de acceso */}
        <Tarjeta compacta>
          <div className="flex items-center gap-3">
            <div className="size-9 rounded-card bg-insignia-info-fondo flex items-center justify-center shrink-0">
              <Mail size={16} className="text-insignia-info-texto" />
            </div>
            <div className="min-w-0">
              <p className="text-xxs text-texto-terciario uppercase tracking-wide">Correo de acceso</p>
              <p className="text-sm font-medium text-texto-primario truncate">{ctx.correoAcceso}</p>
            </div>
          </div>
        </Tarjeta>

        {/* Documento */}
        {ctx.documentoNumero && (
          <Tarjeta compacta>
            <div className="flex items-center gap-3">
              <div className="size-9 rounded-card bg-insignia-cyan-fondo flex items-center justify-center shrink-0">
                <CreditCard size={16} className="text-insignia-cyan-texto" />
              </div>
              <div className="min-w-0">
                <p className="text-xxs text-texto-terciario uppercase tracking-wide">Documento</p>
                <p className="text-sm font-medium text-texto-primario">{ctx.documentoNumero}</p>
              </div>
            </div>
          </Tarjeta>
        )}

        {/* Fecha de nacimiento */}
        {ctx.fechaNacimiento && (
          <Tarjeta compacta>
            <div className="flex items-center gap-3">
              <div className="size-9 rounded-card bg-insignia-rosa-fondo flex items-center justify-center shrink-0">
                <Cake size={16} className="text-insignia-rosa-texto" />
              </div>
              <div className="min-w-0">
                <p className="text-xxs text-texto-terciario uppercase tracking-wide">Nacimiento</p>
                <p className="text-sm font-medium text-texto-primario">
                  {fmt.fecha(ctx.fechaNacimiento)}
                  {edad !== null && <span className="text-texto-terciario font-normal"> · {edad} años</span>}
                </p>
              </div>
            </div>
          </Tarjeta>
        )}

        {/* Domicilio */}
        {ctx.domicilio && (
          <Tarjeta compacta>
            <div className="flex items-center gap-3">
              <div className="size-9 rounded-card bg-insignia-naranja-fondo flex items-center justify-center shrink-0">
                <MapPin size={16} className="text-insignia-naranja-texto" />
              </div>
              <div className="min-w-0">
                <p className="text-xxs text-texto-terciario uppercase tracking-wide">Domicilio</p>
                <p className="text-sm font-medium text-texto-primario truncate">{ctx.domicilio}</p>
              </div>
            </div>
          </Tarjeta>
        )}

        {/* Correo empresa */}
        {ctx.correoEmpresa && (
          <Tarjeta compacta>
            <div className="flex items-center gap-3">
              <div className="size-9 rounded-card bg-insignia-violeta-fondo flex items-center justify-center shrink-0">
                <Briefcase size={16} className="text-insignia-violeta-texto" />
              </div>
              <div className="min-w-0">
                <p className="text-xxs text-texto-terciario uppercase tracking-wide">Correo empresa</p>
                <p className="text-sm font-medium text-texto-primario truncate">{ctx.correoEmpresa}</p>
              </div>
            </div>
          </Tarjeta>
        )}

        {/* WhatsApp empresa */}
        {ctx.telefonoEmpresa && (
          <Tarjeta compacta>
            <div className="flex items-center gap-3">
              <div className="size-9 rounded-card bg-insignia-exito-fondo flex items-center justify-center shrink-0">
                <Phone size={16} className="text-insignia-exito-texto" />
              </div>
              <div className="min-w-0">
                <p className="text-xxs text-texto-terciario uppercase tracking-wide">WhatsApp empresa</p>
                <p className="text-sm font-medium text-texto-primario"><TextoTelefono valor={ctx.telefonoEmpresa} /></p>
              </div>
            </div>
          </Tarjeta>
        )}
      </div>

      {/* ══════════════════════════════════════
          COMPENSACIÓN
         ══════════════════════════════════════ */}
      {ctx.compensacionTipo && (
        <Tarjeta titulo="Compensación">
          <div className="flex items-center justify-between">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Insignia color={ctx.compensacionTipo === 'por_dia' ? 'info' : ctx.compensacionTipo === 'por_hora' ? 'cyan' : 'primario'}>
                  {ETIQUETA_COMP[ctx.compensacionTipo] || ctx.compensacionTipo}
                </Insignia>
                <Insignia color="neutro">{ETIQUETA_FREQ[ctx.compensacionFrecuencia] || ctx.compensacionFrecuencia}</Insignia>
                <Insignia color="neutro">
                  {ctx.diasTrabajo === 7 ? '7/7' : ctx.diasTrabajo === 6 ? 'L-S' : ctx.diasTrabajo === 5 ? 'L-V' : `${ctx.diasTrabajo} días`}
                </Insignia>
              </div>
              <p className="text-xxs text-texto-terciario uppercase tracking-wide">
                {ctx.compensacionTipo === 'por_dia' ? 'Tarifa diaria' : ctx.compensacionTipo === 'por_hora' ? 'Tarifa por hora' : 'Sueldo'}
              </p>
            </div>
            <div className="text-right">
              <span className="text-3xl font-bold text-texto-primario">{fmt.moneda(Number(ctx.compensacionMonto))}</span>
            </div>
          </div>
        </Tarjeta>
      )}

      {/* ══════════════════════════════════════
          MI TELÉFONO (editable)
         ══════════════════════════════════════ */}
      <Tarjeta titulo="Mi teléfono">
        <div className="flex items-end gap-3">
          <div className="flex-1">
            <Input
              tipo="tel" etiqueta="WhatsApp personal" value={telLocal}
              onChange={(e) => { setTelLocal(e.target.value); setTelGuardado(false) }}
              onBlur={guardarTel} icono={<Phone size={16} />} placeholder="+54 11 1234-5678"
            />
          </div>
          {guardandoTel && <span className="text-xs text-texto-terciario pb-2.5">Guardando...</span>}
          {telGuardado && <span className="text-xs text-insignia-exito pb-2.5">Guardado</span>}
        </div>
      </Tarjeta>

      {/* ══════════════════════════════════════
          NOMBRE EN COMUNICACIONES
         ══════════════════════════════════════ */}
      <Tarjeta titulo="Nombre en comunicaciones" subtitulo="Cómo aparece tu nombre al enviar correos, WhatsApp, etc.">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {FORMATOS_NOMBRE_REMITENTE.map((fmt) => {
            const ejemplo = fmt.ejemplo({ nombre: ctx.nombre, apellido: ctx.apellido, sector: ctx.sectorNombre || undefined })
            const activo = ctx.formatoNombreRemitente === fmt.valor
            return (
              <Boton
                key={fmt.valor}
                variante={activo ? 'secundario' : 'fantasma'}
                type="button"
                onClick={async () => {
                  ctx.setFormatoNombreRemitente(fmt.valor)
                  await ctx.guardarFormatoNombre(fmt.valor)
                }}
                className={`!justify-start !text-left ${
                  activo
                    ? '!border-texto-marca !bg-texto-marca/5'
                    : '!border-borde-sutil'
                }`}
              >
                <div className="size-8 rounded-card bg-superficie-elevada flex items-center justify-center shrink-0">
                  {activo ? <Check size={14} className="text-texto-marca" /> : <MessageSquare size={14} className="text-texto-terciario" />}
                </div>
                <div className="min-w-0">
                  <span className={`text-sm font-medium truncate block ${activo ? 'text-texto-marca' : 'text-texto-primario'}`}>
                    {ejemplo}
                  </span>
                  <span className="text-xxs text-texto-terciario">{fmt.descripcion}</span>
                </div>
              </Boton>
            )
          })}
        </div>
      </Tarjeta>

      {/* ══════════════════════════════════════
          CONTACTO DE EMERGENCIA
         ══════════════════════════════════════ */}
      <Tarjeta
        titulo="Contacto de emergencia"
        acciones={!editandoEm ? (
          <Boton variante="secundario" tamano="sm" icono={<Pencil size={12} />} onClick={iniciarEdicionEm}>
            {ctx.emergencia.nombre ? 'Editar' : 'Agregar'}
          </Boton>
        ) : undefined}
      >
        {!editandoEm ? (
          ctx.emergencia.nombre ? (
            <div className="flex items-start gap-3">
              <div className="size-9 rounded-card bg-insignia-rosa-fondo flex items-center justify-center shrink-0">
                <Heart size={16} className="text-insignia-rosa-texto" />
              </div>
              <div className="space-y-0.5">
                <p className="text-sm font-medium text-texto-primario">{ctx.emergencia.nombre}</p>
                {ctx.emergencia.relacion && <p className="text-xs text-texto-terciario">{ctx.emergencia.relacion}</p>}
                {ctx.emergencia.telefono && (
                  <p className="text-sm text-texto-secundario flex items-center gap-1.5 mt-1">
                    <Phone size={13} className="text-texto-terciario" /> <TextoTelefono valor={ctx.emergencia.telefono} />
                  </p>
                )}
              </div>
            </div>
          ) : (
            <p className="text-sm text-texto-terciario">No tenés un contacto de emergencia cargado.</p>
          )
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input tipo="text" formato="nombre_persona" etiqueta="Nombre completo"
                value={emLocal.nombre} onChange={(e) => setEmLocal(p => ({ ...p, nombre: e.target.value }))}
                icono={<Heart size={16} />} placeholder="Ej: María López" error={erroresEm.nombre} />
              <Input tipo="text" etiqueta="Relación"
                value={emLocal.relacion} onChange={(e) => setEmLocal(p => ({ ...p, relacion: e.target.value }))}
                placeholder="Ej: Madre, Pareja, Hermano" error={erroresEm.relacion} />
            </div>
            <Input tipo="tel" etiqueta="Teléfono"
              value={emLocal.telefono} onChange={(e) => setEmLocal(p => ({ ...p, telefono: e.target.value }))}
              icono={<Phone size={16} />} placeholder="+54 11 1234-5678" error={erroresEm.telefono} />
            <div className="flex items-center gap-2 pt-1">
              <Boton variante="primario" onClick={guardarEm} disabled={guardandoEm} cargando={guardandoEm}>
                Guardar
              </Boton>
              <Boton variante="secundario" icono={<X size={14} />} onClick={cancelarEdicionEm}>
                Cancelar
              </Boton>
            </div>
          </div>
        )}
      </Tarjeta>
    </div>
  )
}
