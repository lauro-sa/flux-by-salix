'use client'

import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import {
  Users, FileText, MessageSquare, Mail, Clock,
  Plus, ArrowRight,
  Send, Inbox as InboxIcon, CheckCircle2,
} from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { useEmpresa } from '@/hooks/useEmpresa'
import { useFormato } from '@/hooks/useFormato'
import { useTraduccion } from '@/lib/i18n'
import { Tarjeta } from '@/componentes/ui/Tarjeta'
import { Insignia } from '@/componentes/ui/Insignia'
import { Cargador } from '@/componentes/ui/Cargador'

/**
 * Página de Dashboard — Panel de inicio con resumen de la actividad.
 * Muestra métricas clave, accesos rápidos, actividad reciente y estado del inbox.
 */

// ─── Tipos ───

interface DatosDashboard {
  contactos: {
    total: number
    recientes: Array<{ id: string; nombre: string; apellido?: string; correo?: string; telefono?: string; creado_en: string }>
  }
  presupuestos: {
    total: number
    por_estado: Record<string, number>
    recientes: Array<{ id: string; numero: string; estado: string; contacto_nombre?: string; contacto_apellido?: string; total?: number; creado_en: string }>
  }
  conversaciones: {
    abiertas: number
    por_canal: Record<string, number>
    sin_leer: number
  }
  actividades?: {
    pendientes: Array<{ id: string; titulo: string; tipo_clave: string; estado_clave: string; prioridad: string; fecha_vencimiento: string | null; asignado_nombre: string | null }>
    total_pendientes: number
  }
}

interface MetricasInbox {
  resumen: {
    mensajes_recibidos: number
    mensajes_enviados: number
    conversaciones_nuevas: number
    conversaciones_resueltas: number
    sla_cumplido_pct: number
    tiempo_respuesta_promedio_min: number
    tiempo_resolucion_promedio_hrs: number
  }
  por_agente: Array<{ nombre: string; asignadas: number; resueltas: number; sla_cumplido: number; sla_total: number }>
}

// ─── Helpers ───

function obtenerClaveSaludo(): string {
  const hora = new Date().getHours()
  if (hora < 12) return 'dashboard.saludos.buenos_dias'
  if (hora < 19) return 'dashboard.saludos.buenas_tardes'
  return 'dashboard.saludos.buenas_noches'
}

function obtenerNombreUsuario(usuario: { user_metadata?: Record<string, string> } | null): string {
  if (!usuario?.user_metadata) return ''
  return usuario.user_metadata.nombre || usuario.user_metadata.full_name?.split(' ')[0] || ''
}

const COLOR_ESTADO_PRESUPUESTO: Record<string, 'neutro' | 'info' | 'advertencia' | 'exito' | 'peligro' | 'naranja' | 'violeta'> = {
  borrador: 'neutro',
  enviado: 'violeta',
  aceptado: 'exito',
  rechazado: 'peligro',
  vencido: 'naranja',
  cancelado: 'neutro',
}

// ─── Animaciones ───

const contenedorVariantes = {
  oculto: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.06 },
  },
}

const itemVariantes = {
  oculto: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.3, ease: 'easeOut' as const } },
}

// ─── Componente principal ───

export default function PaginaDashboard() {
  const { t } = useTraduccion()
  const { usuario } = useAuth()
  const { empresa } = useEmpresa()
  const { moneda, fechaRelativa } = useFormato()
  const router = useRouter()

  const [datos, setDatos] = useState<DatosDashboard | null>(null)
  const [metricas, setMetricas] = useState<MetricasInbox | null>(null)
  const [cargando, setCargando] = useState(true)

  const claveSaludo = useMemo(() => obtenerClaveSaludo(), [])
  const nombre = useMemo(() => obtenerNombreUsuario(usuario), [usuario])

  // Cargar datos
  useEffect(() => {
    if (!empresa) return

    const cargar = async () => {
      setCargando(true)
      try {
        const [resDash, resMetricas] = await Promise.all([
          fetch('/api/dashboard'),
          fetch('/api/inbox/metricas?desde=' + new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0]),
        ])

        if (resDash.ok) setDatos(await resDash.json())
        if (resMetricas.ok) setMetricas(await resMetricas.json())
      } catch (err) {
        console.error('Error cargando dashboard:', err)
      } finally {
        setCargando(false)
      }
    }

    cargar()
  }, [empresa])

  if (cargando) {
    return (
      <div className="flex items-center justify-center h-full min-h-[400px]">
        <Cargador tamano="pagina" />
      </div>
    )
  }

  return (
    <motion.div
      className="space-y-8 px-4 sm:px-6 pt-4 sm:pt-5 pb-12"
      variants={contenedorVariantes}
      initial="oculto"
      animate="visible"
    >
      {/* ─── Saludo ─── */}
      <motion.div variants={itemVariantes}>
        <h1 className="text-2xl font-bold text-texto-primario">
          {t(claveSaludo)}{nombre ? `, ${nombre}` : ''}
        </h1>
        <p className="text-sm text-texto-terciario mt-1">
          {empresa ? (empresa as Record<string, unknown>).nombre as string : 'Flux by Salix'}
        </p>
      </motion.div>

      {/* ─── Tarjetas de métricas principales ─── */}
      <motion.div variants={itemVariantes} className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <TarjetaMetrica
          titulo={t('contactos.titulo')}
          valor={datos?.contactos.total ?? 0}
          icono={<Users size={20} strokeWidth={1.5} />}
          color="primario"
          onClick={() => router.push('/contactos')}
        />
        <TarjetaMetrica
          titulo={t('navegacion.presupuestos')}
          valor={datos?.presupuestos.total ?? 0}
          icono={<FileText size={20} strokeWidth={1.5} />}
          color="info"
          detalle={datos?.presupuestos.por_estado.borrador ? `${datos.presupuestos.por_estado.borrador} ${t('dashboard.borradores')}` : undefined}
          onClick={() => router.push('/presupuestos')}
        />
        <TarjetaMetrica
          titulo={t('inbox.conversaciones')}
          valor={datos?.conversaciones.abiertas ?? 0}
          icono={<MessageSquare size={20} strokeWidth={1.5} />}
          color="exito"
          detalle={datos?.conversaciones.sin_leer ? `${datos.conversaciones.sin_leer} ${t('dashboard.sin_leer')}` : undefined}
          onClick={() => router.push('/inbox')}
        />
        <TarjetaMetrica
          titulo={t('dashboard.mensajes_30d')}
          valor={(metricas?.resumen.mensajes_recibidos ?? 0) + (metricas?.resumen.mensajes_enviados ?? 0)}
          icono={<Mail size={20} strokeWidth={1.5} />}
          color="violeta"
          detalle={metricas?.resumen.mensajes_recibidos ? `${metricas.resumen.mensajes_recibidos} ${t('dashboard.recibidos').toLowerCase()}` : undefined}
        />
      </motion.div>

      {/* ─── Accesos rápidos ─── */}
      <motion.div variants={itemVariantes} className="flex flex-wrap gap-2">
        <BotonRapido etiqueta={t('contactos.nuevo')} icono={<Users size={15} />} onClick={() => router.push('/contactos/nuevo')} />
        <BotonRapido etiqueta={t('documentos.tipos.presupuesto')} icono={<FileText size={15} />} onClick={() => router.push('/presupuestos/nuevo')} />
        <BotonRapido etiqueta={t('dashboard.ir_al_inbox')} icono={<MessageSquare size={15} />} onClick={() => router.push('/inbox')} />
      </motion.div>

      {/* ─── Grid de paneles ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* ─── Contactos recientes (columna izquierda) ─── */}
        <motion.div variants={itemVariantes}>
          <Tarjeta
            titulo={`${t('contactos.titulo')} ${t('dashboard.recientes')}`}
            acciones={
              <button
                onClick={() => router.push('/contactos')}
                className="text-xs text-texto-terciario hover:text-texto-primario transition-colors flex items-center gap-1"
              >
                {t('dashboard.ver_todo')} <ArrowRight size={12} />
              </button>
            }
          >
            {datos?.contactos.recientes && datos.contactos.recientes.length > 0 ? (
              <div className="space-y-1">
                {datos.contactos.recientes.map(c => (
                  <div
                    key={c.id}
                    className="flex items-center justify-between py-2 px-1 rounded-md hover:bg-superficie-hover cursor-pointer transition-colors"
                    onClick={() => router.push(`/contactos/${c.id}`)}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="size-8 rounded-full bg-superficie-hover flex items-center justify-center text-xs font-semibold text-texto-secundario shrink-0">
                        {(c.nombre?.[0] || '').toUpperCase()}{(c.apellido?.[0] || '').toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-texto-primario truncate">
                          {[c.nombre, c.apellido].filter(Boolean).join(' ')}
                        </p>
                        <p className="text-xs text-texto-terciario truncate">
                          {c.correo || c.telefono || ''}
                        </p>
                      </div>
                    </div>
                    <span className="text-xxs text-texto-terciario shrink-0 ml-2">{fechaRelativa(c.creado_en)}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-texto-terciario py-4 text-center">{t('contactos.sin_contactos')}</p>
            )}
          </Tarjeta>
        </motion.div>

        {/* ─── Métricas del inbox (columna central) ─── */}
        <motion.div variants={itemVariantes}>
          <Tarjeta
            titulo={t('dashboard.inbox_ultimos_30d')}
            acciones={
              <button
                onClick={() => router.push('/inbox')}
                className="text-xs text-texto-terciario hover:text-texto-primario transition-colors flex items-center gap-1"
              >
                {t('dashboard.ver_todo')} <ArrowRight size={12} />
              </button>
            }
          >
            {metricas ? (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <MiniMetrica
                    etiqueta={t('dashboard.label_recibidos')}
                    valor={metricas.resumen.mensajes_recibidos}
                    icono={<InboxIcon size={14} />}
                  />
                  <MiniMetrica
                    etiqueta={t('dashboard.label_enviados')}
                    valor={metricas.resumen.mensajes_enviados}
                    icono={<Send size={14} />}
                  />
                  <MiniMetrica
                    etiqueta={t('dashboard.label_resueltas')}
                    valor={metricas.resumen.conversaciones_resueltas}
                    icono={<CheckCircle2 size={14} />}
                  />
                  <MiniMetrica
                    etiqueta={t('dashboard.label_tiempo_resp')}
                    valor={`${metricas.resumen.tiempo_respuesta_promedio_min}m`}
                    icono={<Clock size={14} />}
                  />
                </div>

                {/* Barra de SLA */}
                <div>
                  <div className="flex items-center justify-between text-xs mb-1.5">
                    <span className="text-texto-secundario">{t('dashboard.sla_cumplido')}</span>
                    <span className={`font-semibold ${metricas.resumen.sla_cumplido_pct >= 80 ? 'text-insignia-exito-texto' : metricas.resumen.sla_cumplido_pct >= 50 ? 'text-insignia-advertencia-texto' : 'text-insignia-peligro-texto'}`}>
                      {metricas.resumen.sla_cumplido_pct}%
                    </span>
                  </div>
                  <div className="h-2 rounded-full bg-superficie-hover overflow-hidden">
                    <motion.div
                      className={`h-full rounded-full ${metricas.resumen.sla_cumplido_pct >= 80 ? 'bg-insignia-exito-texto' : metricas.resumen.sla_cumplido_pct >= 50 ? 'bg-insignia-advertencia-texto' : 'bg-insignia-peligro-texto'}`}
                      initial={{ width: 0 }}
                      animate={{ width: `${metricas.resumen.sla_cumplido_pct}%` }}
                      transition={{ duration: 0.8, ease: 'easeOut', delay: 0.3 }}
                    />
                  </div>
                </div>

                {/* Agentes */}
                {metricas.por_agente.length > 0 && (
                  <div className="pt-2 border-t border-borde-sutil">
                    <p className="text-xs text-texto-terciario mb-2">{t('dashboard.por_agente')}</p>
                    <div className="space-y-1.5">
                      {metricas.por_agente.slice(0, 3).map(agente => (
                        <div key={agente.nombre} className="flex items-center justify-between text-xs">
                          <span className="text-texto-secundario truncate">{agente.nombre}</span>
                          <div className="flex items-center gap-2 shrink-0">
                            <span className="text-texto-primario font-medium">{agente.resueltas}/{agente.asignadas}</span>
                            {agente.sla_total > 0 && (
                              <Insignia color={agente.sla_cumplido / agente.sla_total >= 0.8 ? 'exito' : 'advertencia'}>
                                {Math.round((agente.sla_cumplido / agente.sla_total) * 100)}%
                              </Insignia>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-sm text-texto-terciario">{t('dashboard.sin_datos_inbox')}</p>
            )}
          </Tarjeta>
        </motion.div>

        {/* ─── Presupuestos recientes ─── */}
        <motion.div variants={itemVariantes}>
          <Tarjeta
            titulo={`${t('navegacion.presupuestos')} ${t('dashboard.recientes')}`}
            acciones={
              <button
                onClick={() => router.push('/presupuestos')}
                className="text-xs text-texto-terciario hover:text-texto-primario transition-colors flex items-center gap-1"
              >
                {t('dashboard.ver_todo')} <ArrowRight size={12} />
              </button>
            }
          >
            {datos?.presupuestos.recientes && datos.presupuestos.recientes.length > 0 ? (
              <div className="space-y-2">
                {datos.presupuestos.recientes.map(p => (
                  <div
                    key={p.id}
                    className="flex items-center justify-between py-2 px-1 rounded-md hover:bg-superficie-hover cursor-pointer transition-colors"
                    onClick={() => router.push(`/presupuestos/${p.id}`)}
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-texto-primario">{p.numero}</span>
                        <Insignia color={COLOR_ESTADO_PRESUPUESTO[p.estado] || 'neutro'}>
                          {p.estado}
                        </Insignia>
                      </div>
                      <p className="text-xs text-texto-terciario truncate mt-0.5">
                        {[p.contacto_nombre, p.contacto_apellido].filter(Boolean).join(' ') || 'Sin contacto'}
                      </p>
                    </div>
                    <div className="text-right shrink-0 ml-3">
                      {p.total != null && (
                        <p className="text-sm font-semibold text-texto-primario">{moneda(p.total)}</p>
                      )}
                      <p className="text-xxs text-texto-terciario">{fechaRelativa(p.creado_en)}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-texto-terciario py-4 text-center">{t('documentos.sin_documentos')}</p>
            )}
          </Tarjeta>
        </motion.div>

        {/* ─── Resumen de presupuestos por estado ─── */}
        <motion.div variants={itemVariantes}>
          <Tarjeta titulo={`${t('navegacion.presupuestos')} ${t('dashboard.por_estado')}`}>
            {datos?.presupuestos.por_estado && Object.keys(datos.presupuestos.por_estado).length > 0 ? (
              <div className="space-y-2.5">
                {Object.entries(datos.presupuestos.por_estado)
                  .sort(([, a], [, b]) => b - a)
                  .map(([estado, cantidad]) => {
                    const porcentaje = datos.presupuestos.total > 0
                      ? Math.round((cantidad / datos.presupuestos.total) * 100)
                      : 0
                    return (
                      <div key={estado}>
                        <div className="flex items-center justify-between text-xs mb-1">
                          <div className="flex items-center gap-2">
                            <Insignia color={COLOR_ESTADO_PRESUPUESTO[estado] || 'neutro'}>
                              {estado}
                            </Insignia>
                          </div>
                          <span className="text-texto-secundario font-medium">{cantidad}</span>
                        </div>
                        <div className="h-1.5 rounded-full bg-superficie-hover overflow-hidden">
                          <motion.div
                            className="h-full rounded-full bg-texto-marca opacity-60"
                            initial={{ width: 0 }}
                            animate={{ width: `${porcentaje}%` }}
                            transition={{ duration: 0.6, ease: 'easeOut', delay: 0.2 }}
                          />
                        </div>
                      </div>
                    )
                  })}
              </div>
            ) : (
              <p className="text-sm text-texto-terciario py-4 text-center">{t('documentos.sin_documentos')}</p>
            )}
          </Tarjeta>
        </motion.div>

        {/* ─── Actividades pendientes ─── */}
        {datos?.actividades && datos.actividades.pendientes.length > 0 && (
          <motion.div variants={itemVariantes}>
            <Tarjeta
              titulo={`Actividades pendientes (${datos.actividades.total_pendientes})`}
              acciones={
                <button
                  onClick={() => router.push('/actividades')}
                  className="text-xs text-texto-terciario hover:text-texto-primario transition-colors flex items-center gap-1"
                >
                  {t('dashboard.ver_todo')} <ArrowRight size={12} />
                </button>
              }
            >
              <div className="space-y-1">
                {datos.actividades.pendientes.map(act => {
                  const vencida = act.fecha_vencimiento && new Date(act.fecha_vencimiento) < new Date()
                  return (
                    <div
                      key={act.id}
                      className="flex items-center justify-between py-2 px-1 rounded-md hover:bg-superficie-hover cursor-pointer transition-colors"
                      onClick={() => router.push('/actividades')}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-texto-primario truncate">{act.titulo}</span>
                          {act.prioridad === 'alta' && (
                            <Insignia color="peligro">Alta</Insignia>
                          )}
                        </div>
                        {act.asignado_nombre && (
                          <p className="text-xs text-texto-terciario truncate mt-0.5">{act.asignado_nombre}</p>
                        )}
                      </div>
                      {act.fecha_vencimiento && (
                        <span className={`text-xs shrink-0 ml-2 ${vencida ? 'text-insignia-peligro-texto font-semibold' : 'text-texto-terciario'}`}>
                          {new Date(act.fecha_vencimiento).toLocaleDateString('es-AR', { day: '2-digit', month: 'short' })}
                        </span>
                      )}
                    </div>
                  )
                })}
              </div>
            </Tarjeta>
          </motion.div>
        )}
      </div>
    </motion.div>
  )
}

// ─── Subcomponentes ───

function TarjetaMetrica({
  titulo,
  valor,
  icono,
  color,
  detalle,
  onClick,
}: {
  titulo: string
  valor: number | string
  icono: React.ReactNode
  color: 'primario' | 'info' | 'exito' | 'violeta'
  detalle?: string
  onClick?: () => void
}) {
  return (
    <Tarjeta onClick={onClick} className="group">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs text-texto-terciario">{titulo}</p>
          <p className="text-2xl font-bold text-texto-primario mt-1">{valor}</p>
          {detalle && (
            <p className="text-xxs text-texto-terciario mt-1">{detalle}</p>
          )}
        </div>
        <div className={`size-9 rounded-lg flex items-center justify-center bg-insignia-${color}-fondo text-insignia-${color}-texto`}>
          {icono}
        </div>
      </div>
    </Tarjeta>
  )
}

function MiniMetrica({
  etiqueta,
  valor,
  icono,
}: {
  etiqueta: string
  valor: number | string
  icono: React.ReactNode
}) {
  return (
    <div className="flex items-center gap-2.5 py-2 px-3 rounded-lg bg-superficie-hover/50">
      <div className="text-texto-terciario">{icono}</div>
      <div>
        <p className="text-lg font-bold text-texto-primario leading-tight">{valor}</p>
        <p className="text-xxs text-texto-terciario">{etiqueta}</p>
      </div>
    </div>
  )
}

function BotonRapido({
  etiqueta,
  icono,
  onClick,
}: {
  etiqueta: string
  icono: React.ReactNode
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-2 px-3.5 py-2 text-xs font-medium text-texto-secundario bg-superficie-tarjeta border border-borde-sutil rounded-lg hover:border-borde-fuerte hover:text-texto-primario transition-all duration-150 cursor-pointer"
    >
      <Plus size={13} strokeWidth={2} />
      {etiqueta}
    </button>
  )
}
