'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  LayoutGrid, Check, Download, Trash2, Lock, AlertTriangle, ArrowLeft, CheckCircle2,
  Mail, Users, Zap, Calendar, MapPin, Route, Package,
  FileText, FileBarChart, Wrench, Clock, Shield, Rocket,
  MessageCircle, Brain, Globe, Sparkles, BarChart3, Landmark,
  UsersRound, Megaphone, Workflow, KanbanSquare, Bot, MessageSquareCode,
  type LucideIcon,
} from 'lucide-react'
import { Boton } from '@/componentes/ui/Boton'
import { Modal } from '@/componentes/ui/Modal'
import { useModulos } from '@/hooks/useModulos'
import { useRol } from '@/hooks/useRol'
import { useToast } from '@/componentes/feedback/Toast'
import { useTraduccion } from '@/lib/i18n'
import { IconoWhatsApp } from '@/componentes/iconos/IconoWhatsApp'
import type { ModuloConEstado, CategoriaModulo } from '@/tipos'

/**
 * Página de Aplicaciones — tienda de módulos de Flux.
 * Pantalla completa, grid compacto por categoría, sección próximamente.
 */

const ICONOS_MODULO: Record<string, LucideIcon> = {
  'mail': Mail, 'users': Users, 'zap': Zap, 'calendar': Calendar,
  'map-pin': MapPin, 'route': Route, 'package': Package,
  'file-text': FileText, 'file-bar-chart': FileBarChart, 'wrench': Wrench,
  'clock': Clock, 'shield': Shield, 'message-circle': MessageCircle,
  'brain': Brain, 'globe': Globe, 'whatsapp': IconoWhatsApp as unknown as LucideIcon,
  'megaphone': Megaphone, 'kanban': KanbanSquare, 'landmark': Landmark,
  'users-round': UsersRound, 'workflow': Workflow, 'bar-chart-3': BarChart3,
  'bot': Bot, 'sparkles': Sparkles, 'message-square-code': MessageSquareCode,
}

const ICONOS_CATEGORIA: Record<string, LucideIcon> = {
  base: LayoutGrid, operacional: Zap, documentos: FileText,
  comunicacion: MessageCircle, admin: Shield, premium: Sparkles,
  proximamente: Rocket,
}

// Las etiquetas de categoría se resuelven con t() en el componente

const ORDEN_CATEGORIAS: CategoriaModulo[] = ['premium', 'base', 'operacional', 'documentos', 'comunicacion', 'admin', 'proximamente']

// ═══════════════════════════════════════════════════
// EfectoActivacion
// ═══════════════════════════════════════════════════

/** Overlay fullscreen: anillos expansivos desde el centro de la pantalla tras instalar */
function EfectoActivacion({ activo }: { activo: boolean }) {
  return (
    <AnimatePresence>
      {activo && (
        <div className="fixed inset-0 pointer-events-none flex items-center justify-center" style={{ zIndex: 9999 }}>
          {/* Anillos que se expanden */}
          {[0, 0.12, 0.24].map((delay, i) => (
            <motion.div
              key={`anillo-${i}`}
              className="absolute rounded-2xl border-2 border-texto-marca"
              initial={{ width: 80, height: 60, opacity: 0.5, borderRadius: 12 }}
              animate={{ width: 800, height: 600, opacity: 0, borderRadius: 400 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 1, delay, ease: [0.22, 1, 0.36, 1] }}
            />
          ))}

          {/* Destello central */}
          <motion.div
            className="absolute rounded-full bg-texto-marca"
            initial={{ width: 8, height: 8, opacity: 0.8 }}
            animate={{ width: 40, height: 40, opacity: 0 }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
          />

          {/* Check de confirmación */}
          <motion.div
            className="absolute flex items-center justify-center w-14 h-14 rounded-full bg-insignia-exito"
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: [0, 1.2, 1], opacity: [0, 1, 1] }}
            exit={{ scale: 0, opacity: 0 }}
            transition={{ duration: 0.4, delay: 0.15, ease: [0.22, 1, 0.36, 1] }}
          >
            <Check size={28} className="text-white" strokeWidth={3} />
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}

// ═══════════════════════════════════════════════════
// Tarjeta de módulo
// ═══════════════════════════════════════════════════

function TarjetaModulo({ modulo, onClick }: { modulo: ModuloConEstado; onClick: () => void }) {
  const Icono = ICONOS_MODULO[modulo.icono] || LayoutGrid
  const estaActivo = modulo.es_base || (modulo.instalado && modulo.activo)
  const esPremium = modulo.categoria === 'premium'
  const esProximamente = modulo.categoria === 'proximamente'
  const desactivadoConPurga = modulo.instalado && !modulo.activo && modulo.dias_restantes_purga !== null

  return (
    <motion.button
      layout
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      whileHover={{ scale: esProximamente ? 1 : 1.06 }}
      whileTap={{ scale: esProximamente ? 1 : 0.95 }}
      onClick={esProximamente ? undefined : onClick}
      className={`flex flex-col items-center gap-1.5 bg-transparent border-none p-0 group ${esProximamente ? 'cursor-default' : 'cursor-pointer'}`}
    >
      <div className="relative">
        {/* Badge ADD-ON */}
        {esPremium && !estaActivo && (
          <div className="absolute -top-2 left-1/2 -translate-x-1/2 z-10 px-1.5 py-px rounded text-xxs font-bold uppercase tracking-wider bg-texto-marca/20 text-texto-marca border border-texto-marca/25">
            add-on
          </div>
        )}

        {/* Ícono */}
        <div className={`
          w-16 h-16 rounded-xl flex items-center justify-center transition-all border
          ${esProximamente
            ? 'bg-superficie-elevada/50 border-borde-sutil/50 text-texto-terciario/40'
            : estaActivo
              ? 'bg-texto-marca/8 border-texto-marca/20 text-texto-marca'
              : desactivadoConPurga
                ? 'bg-insignia-advertencia/8 border-insignia-advertencia/20 text-insignia-advertencia'
                : 'bg-superficie-elevada border-borde-sutil text-texto-terciario group-hover:border-borde-fuerte group-hover:text-texto-secundario'
          }
        `}>
          <Icono size={26} strokeWidth={1.5} />
        </div>

        {/* Check instalado */}
        {estaActivo && (
          <div className="absolute -bottom-0.5 -right-0.5 w-[18px] h-[18px] rounded-full bg-insignia-exito flex items-center justify-center shadow-sm border-[1.5px] border-superficie-app">
            <Check size={10} className="text-white" strokeWidth={3} />
          </div>
        )}

        {/* Badge purga */}
        {desactivadoConPurga && (
          <div className="absolute -bottom-0.5 -right-0.5 w-[18px] h-[18px] rounded-full bg-insignia-advertencia flex items-center justify-center shadow-sm border-[1.5px] border-superficie-app">
            <AlertTriangle size={9} className="text-white" strokeWidth={2.5} />
          </div>
        )}
      </div>

      {/* Nombre */}
      <span className={`text-xs font-medium text-center leading-tight max-w-[90px] ${
        esProximamente ? 'text-texto-terciario/50' : estaActivo ? 'text-texto-primario' : 'text-texto-secundario'
      }`}>
        {modulo.nombre}
      </span>

      {/* Pronto */}
      {esProximamente && (
        <span className="text-xxs font-semibold uppercase tracking-wider text-texto-terciario/40 -mt-1">
          Pronto
        </span>
      )}

      {desactivadoConPurga && (
        <span className="text-xxs text-insignia-advertencia -mt-1">{modulo.dias_restantes_purga}d</span>
      )}
    </motion.button>
  )
}

// ═══════════════════════════════════════════════════
// Modal detalle — como la foto: ícono+nombre horizontal, features con checks
// ═══════════════════════════════════════════════════

function ModalModulo({
  modulo, abierto, onCerrar, onInstalar, onDesinstalar, puedeGestionar,
}: {
  modulo: ModuloConEstado | null; abierto: boolean; onCerrar: () => void
  onInstalar: (slug: string) => void; onDesinstalar: (slug: string) => void
  puedeGestionar: boolean
}) {
  const [cargando, setCargando] = useState(false)
  const [recienDesinstalado, setRecienDesinstalado] = useState(false)
  const { t } = useTraduccion()
  if (!modulo) return null

  const Icono = ICONOS_MODULO[modulo.icono] || LayoutGrid
  const estaActivo = modulo.es_base || (modulo.instalado && modulo.activo)
  const desactivadoConPurga = modulo.instalado && !modulo.activo && modulo.dias_restantes_purga !== null

  const manejarInstalar = async () => { setCargando(true); await onInstalar(modulo.slug); setCargando(false) }
  const manejarDesinstalar = async () => {
    setCargando(true)
    await onDesinstalar(modulo.slug)
    setCargando(false)
    setRecienDesinstalado(true)
  }

  /** Módulos que aún no están listos para instalarse */
  const SLUGS_PROXIMAMENTE = ['automatizaciones']

  const accion = () => {
    if (modulo.es_base) return null
    if (SLUGS_PROXIMAMENTE.includes(modulo.slug) && !estaActivo) {
      return <Boton variante="secundario" tamano="md" icono={<Lock size={16} />} disabled>Próximamente</Boton>
    }
    if (estaActivo) {
      return <Boton variante="peligro" tamano="md" icono={<Trash2 size={16} />} onClick={manejarDesinstalar} cargando={cargando} disabled={!puedeGestionar}>{t('aplicaciones.desinstalar')}</Boton>
    }
    return <Boton variante="primario" tamano="md" icono={<Download size={16} />} onClick={manejarInstalar} cargando={cargando} disabled={!puedeGestionar}>{desactivadoConPurga ? 'Reinstalar' : t('aplicaciones.instalar')}</Boton>
  }

  /* Estado visual del ícono del módulo */
  const claseIcono = recienDesinstalado || desactivadoConPurga
    ? 'bg-insignia-advertencia/8 text-insignia-advertencia border border-insignia-advertencia/20'
    : estaActivo
      ? 'bg-texto-marca/10 text-texto-marca'
      : 'bg-superficie-elevada text-texto-terciario'

  return (
    <Modal
      abierto={abierto}
      onCerrar={() => { onCerrar(); setRecienDesinstalado(false) }}
      titulo={modulo.nombre}
      tamano="md"
      acciones={
        <div className="flex items-center gap-3 w-full">
          <Boton variante="secundario" tamano="md" onClick={() => { onCerrar(); setRecienDesinstalado(false) }}>{t('comun.cerrar')}</Boton>
          {accion()}
        </div>
      }
    >
      <div className="flex flex-col gap-5 relative">
        {/* Header: ícono + nombre + badge */}
        <div className="flex items-center gap-4">
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={recienDesinstalado
              ? { scale: [1, 0.85, 1], opacity: 1 }
              : { scale: 1, opacity: 1 }
            }
            transition={recienDesinstalado
              ? { duration: 0.4, ease: [0.22, 1, 0.36, 1] }
              : { type: 'spring', damping: 15 }
            }
            className={`shrink-0 w-16 h-16 rounded-2xl flex items-center justify-center transition-colors duration-500 ${claseIcono}`}
          >
            <Icono size={32} strokeWidth={1.5} />
          </motion.div>
          <div>
            <h3 className="text-lg font-semibold text-texto-primario">{modulo.nombre}</h3>
            <div className="flex items-center gap-2 mt-1">
              <AnimatePresence mode="wait">
                {estaActivo && !recienDesinstalado && (
                  <motion.span
                    key="instalado"
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.8 }}
                    className="inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-wider text-insignia-exito bg-insignia-exito/10 px-2 py-0.5 rounded-full"
                  >
                    <Check size={11} /> {t('aplicaciones.instalado')}
                  </motion.span>
                )}
                {(recienDesinstalado || desactivadoConPurga) && (
                  <motion.span
                    key="desinstalado"
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-wider text-insignia-advertencia bg-insignia-advertencia/10 px-2 py-0.5 rounded-full"
                  >
                    <AlertTriangle size={11} /> Desinstalado
                  </motion.span>
                )}
              </AnimatePresence>
              {modulo.es_base && (
                <span className="text-xs text-texto-terciario bg-superficie-elevada px-2 py-0.5 rounded-full">Incluido</span>
              )}
              {modulo.precio_mensual_usd > 0 && (
                <span className="text-xs font-medium text-texto-marca bg-texto-marca/10 px-2 py-0.5 rounded-full">US${modulo.precio_mensual_usd}/mes</span>
              )}
            </div>
          </div>
        </div>

        {/* Descripción — se atenúa al desinstalar */}
        <motion.p
          animate={{ opacity: recienDesinstalado ? 0.4 : 1 }}
          transition={{ duration: 0.4 }}
          className="text-sm text-texto-primario font-medium"
        >
          {modulo.descripcion}
        </motion.p>

        {/* Features con checks — se atenúan al desinstalar */}
        {modulo.features && modulo.features.length > 0 && (
          <motion.div
            animate={{ opacity: recienDesinstalado ? 0.3 : 1 }}
            transition={{ duration: 0.5 }}
            className="rounded-xl border border-borde-sutil p-4 flex flex-col gap-3"
          >
            {modulo.features.map((feature, i) => (
              <div key={i} className="flex items-start gap-3">
                <CheckCircle2 size={18} className="text-texto-marca shrink-0 mt-0.5" strokeWidth={1.5} />
                <p className="text-sm text-texto-secundario leading-relaxed">{feature}</p>
              </div>
            ))}
          </motion.div>
        )}

        {/* Alerta de purga — aparece al desinstalar */}
        <AnimatePresence>
          {(desactivadoConPurga || recienDesinstalado) && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
              className="overflow-hidden"
            >
              <div className="flex items-start gap-2.5 p-3 rounded-lg bg-insignia-advertencia/10 border border-insignia-advertencia/20">
                <AlertTriangle size={16} className="text-insignia-advertencia shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-medium text-insignia-advertencia">Datos en período de gracia</p>
                  <p className="text-xs text-texto-secundario mt-0.5">
                    Tenés {modulo.dias_restantes_purga ?? 30} días para reinstalar antes de que se eliminen los datos.
                  </p>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {!puedeGestionar && !modulo.es_base && (
          <p className="text-xs text-texto-terciario">Solo el propietario o administrador puede gestionar módulos.</p>
        )}
      </div>
    </Modal>
  )
}

// ═══════════════════════════════════════════════════
// Página principal
// ═══════════════════════════════════════════════════

export default function PaginaAplicaciones() {
  const router = useRouter()
  const { t } = useTraduccion()
  const { modulos, cargando, instalar, desinstalar } = useModulos()
  const { esPropietario, esAdmin } = useRol()
  const { mostrar } = useToast()

  const [moduloSeleccionado, setModuloSeleccionado] = useState<ModuloConEstado | null>(null)
  const [activacionExitosa, setEfectoActivacionActivo] = useState(false)
  const puedeGestionar = esPropietario || esAdmin

  const modulosPorCategoria = useMemo(() => {
    const mapa = new Map<CategoriaModulo, ModuloConEstado[]>()
    for (const cat of ORDEN_CATEGORIAS) {
      const items = modulos.filter(m => m.categoria === cat)
      if (items.length > 0) mapa.set(cat, items)
    }
    return mapa
  }, [modulos])

  const manejarInstalar = async (slug: string) => {
    const resultado = await instalar(slug)
    if (resultado.error) {
      mostrar('error', resultado.error)
    } else {
      /* Cerrar modal primero — se achica con su animación exit */
      setModuloSeleccionado(null)
      /* Disparar anillos desde el centro */
      setTimeout(() => {
        setEfectoActivacionActivo(true)
        setTimeout(() => setEfectoActivacionActivo(false), 1400)
      }, 100)
      mostrar('exito', 'Módulo instalado correctamente')
    }
  }

  const manejarDesinstalar = async (slug: string) => {
    const resultado = await desinstalar(slug)
    if (resultado.error) {
      mostrar('error', resultado.error)
    } else {
      mostrar('info', 'Módulo desinstalado · 30 días para recuperar datos')
      setModuloSeleccionado(prev => prev ? { ...prev, instalado: true, activo: false, dias_restantes_purga: 30, purga_programada_en: new Date(Date.now() + 30 * 86400000).toISOString() } : null)
    }
  }

  return (
    <div className="min-h-dvh flex flex-col">
      {/* Header */}
      <div className="shrink-0 w-full max-w-3xl mx-auto px-6 pt-8 pb-2">
        <button
          onClick={() => router.back()}
          className="flex items-center gap-2 text-sm text-texto-terciario hover:text-texto-primario transition-colors bg-transparent border-none cursor-pointer mb-5"
        >
          <ArrowLeft size={16} />
          {t('comun.volver')}
        </button>
        <h1 className="text-2xl font-bold text-texto-primario">{t('aplicaciones.titulo')}</h1>
        <p className="text-sm text-texto-secundario mt-1">
          Instalá y gestioná los módulos de tu espacio de trabajo
        </p>
      </div>

      {/* Contenido */}
      {cargando ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-texto-marca border-t-transparent" />
        </div>
      ) : (
        <div className="flex-1 w-full max-w-3xl mx-auto px-6 py-6">
          {Array.from(modulosPorCategoria.entries()).map(([categoria, items]) => {
            const IconoCat = ICONOS_CATEGORIA[categoria] || LayoutGrid
            const esCatProximamente = categoria === 'proximamente'
            return (
              <div key={categoria} className="mb-6">
                {/* Header categoría */}
                <div className="flex items-center gap-2 mb-3.5">
                  <IconoCat size={14} strokeWidth={2} className={categoria === 'premium' ? 'text-texto-marca' : 'text-texto-terciario'} />
                  <h2 className={`text-xs font-bold uppercase tracking-[0.15em] ${
                    categoria === 'premium' ? 'text-texto-marca' : 'text-texto-terciario'
                  }`}>
                    {t(`aplicaciones.categorias.${categoria}`)}
                  </h2>
                  <div className="flex-1 h-px bg-borde-sutil" />
                </div>

                {/* Grid — 4 columnas, compacto */}
                <div className="flex flex-wrap" style={{ gap: '16px 0' }}>
                  <AnimatePresence mode="popLayout">
                    {items.map(modulo => (
                      <div key={modulo.slug} className="w-1/4 flex justify-center">
                        <TarjetaModulo
                          modulo={modulo}
                          onClick={() => setModuloSeleccionado(modulo)}
                        />
                      </div>
                    ))}
                  </AnimatePresence>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Modal */}
      <ModalModulo
        modulo={moduloSeleccionado}
        abierto={!!moduloSeleccionado}
        onCerrar={() => setModuloSeleccionado(null)}
        onInstalar={manejarInstalar}
        onDesinstalar={manejarDesinstalar}
        puedeGestionar={puedeGestionar}
      />

      {/* Efecto de activación — fuera del modal, fullscreen */}
      <EfectoActivacion activo={activacionExitosa} />
    </div>
  )
}
