'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Avatar } from '@/componentes/ui/Avatar'
import { Boton } from '@/componentes/ui/Boton'
import { Insignia } from '@/componentes/ui/Insignia'
import {
  X, Phone, Mail, MessageCircle, MapPin, Building2, Briefcase,
  ExternalLink, Clock, FileText, Image, Paperclip, ChevronDown, ChevronUp,
  Link2,
} from 'lucide-react'
import type { Conversacion } from '@/tipos/inbox'

/**
 * Panel derecho colapsable — info del contacto vinculado a la conversación.
 * Muestra: datos de contacto, historial de conversaciones, archivos compartidos.
 */

interface PropiedadesPanelInfo {
  conversacion: Conversacion | null
  abierto: boolean
  onCerrar: () => void
}

interface DatosContacto {
  id: string
  nombre: string
  apellido: string | null
  correo: string | null
  telefono: string | null
  whatsapp: string | null
  cargo: string | null
  rubro: string | null
  avatar_url: string | null
  tipo_contacto?: { etiqueta: string; color: string }
  direccion_principal?: string | null
}

export function PanelInfoContacto({ conversacion, abierto, onCerrar }: PropiedadesPanelInfo) {
  const [contacto, setContacto] = useState<DatosContacto | null>(null)
  const [seccionAbierta, setSeccionAbierta] = useState<string>('datos')
  const [cargando, setCargando] = useState(false)

  // Cargar contacto cuando cambia la conversación
  // useEffect se implementará con fetch real al contacto

  const toggleSeccion = (seccion: string) => {
    setSeccionAbierta(seccionAbierta === seccion ? '' : seccion)
  }

  return (
    <AnimatePresence>
      {abierto && (
        <motion.div
          initial={{ width: 0, opacity: 0 }}
          animate={{ width: 320, opacity: 1 }}
          exit={{ width: 0, opacity: 0 }}
          transition={{ duration: 0.2, ease: 'easeInOut' }}
          className="h-full overflow-hidden flex-shrink-0"
          style={{
            borderLeft: '1px solid var(--borde-sutil)',
            background: 'var(--superficie-tarjeta)',
          }}
        >
          <div className="h-full overflow-y-auto">
            {/* Header */}
            <div
              className="flex items-center justify-between p-3"
              style={{ borderBottom: '1px solid var(--borde-sutil)' }}
            >
              <span className="text-sm font-semibold" style={{ color: 'var(--texto-primario)' }}>
                Info del contacto
              </span>
              <button
                onClick={onCerrar}
                className="p-1 rounded-md transition-colors"
                style={{ color: 'var(--texto-terciario)' }}
              >
                <X size={16} />
              </button>
            </div>

            {!conversacion?.contacto_id ? (
              // Sin contacto vinculado
              <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
                <div
                  className="w-12 h-12 rounded-full flex items-center justify-center mb-3"
                  style={{ background: 'var(--superficie-hover)' }}
                >
                  <Link2 size={20} style={{ color: 'var(--texto-terciario)' }} />
                </div>
                <p className="text-sm" style={{ color: 'var(--texto-secundario)' }}>
                  Sin contacto vinculado
                </p>
                <p className="text-xs mt-1 mb-4" style={{ color: 'var(--texto-terciario)' }}>
                  Vinculá esta conversación a un contacto existente.
                </p>
                <Boton variante="secundario" tamano="sm">
                  Vincular contacto
                </Boton>
              </div>
            ) : (
              <div className="p-3 space-y-3">
                {/* Avatar y nombre */}
                <div className="flex flex-col items-center text-center pt-2">
                  <Avatar
                    nombre={conversacion.contacto_nombre || '?'}
                    tamano="lg"
                  />
                  <h3
                    className="text-sm font-semibold mt-2"
                    style={{ color: 'var(--texto-primario)' }}
                  >
                    {conversacion.contacto_nombre || 'Sin nombre'}
                  </h3>
                  {contacto?.cargo && (
                    <p className="text-xs" style={{ color: 'var(--texto-secundario)' }}>
                      {contacto.cargo}
                    </p>
                  )}
                  {contacto?.tipo_contacto && (
                    <Insignia color={contacto.tipo_contacto.color as 'primario'} tamano="sm">
                      {contacto.tipo_contacto.etiqueta}
                    </Insignia>
                  )}
                </div>

                {/* Acciones rápidas */}
                <div className="flex items-center justify-center gap-2">
                  {conversacion.identificador_externo && (
                    <button
                      className="p-2 rounded-lg transition-colors"
                      style={{ background: 'var(--superficie-hover)', color: 'var(--canal-whatsapp)' }}
                      title="WhatsApp"
                    >
                      <MessageCircle size={16} />
                    </button>
                  )}
                  {contacto?.telefono && (
                    <button
                      className="p-2 rounded-lg transition-colors"
                      style={{ background: 'var(--superficie-hover)', color: 'var(--texto-marca)' }}
                      title="Llamar"
                    >
                      <Phone size={16} />
                    </button>
                  )}
                  {contacto?.correo && (
                    <button
                      className="p-2 rounded-lg transition-colors"
                      style={{ background: 'var(--superficie-hover)', color: 'var(--canal-correo)' }}
                      title="Correo"
                    >
                      <Mail size={16} />
                    </button>
                  )}
                  <a
                    href={`/contactos/${conversacion.contacto_id}`}
                    className="p-2 rounded-lg transition-colors"
                    style={{ background: 'var(--superficie-hover)', color: 'var(--texto-secundario)' }}
                    title="Ver contacto completo"
                  >
                    <ExternalLink size={16} />
                  </a>
                </div>

                {/* Sección: Datos */}
                <SeccionColapsable
                  titulo="Datos de contacto"
                  abierta={seccionAbierta === 'datos'}
                  onToggle={() => toggleSeccion('datos')}
                >
                  <div className="space-y-2">
                    {contacto?.correo && (
                      <DatoContacto icono={<Mail size={12} />} valor={contacto.correo} />
                    )}
                    {contacto?.telefono && (
                      <DatoContacto icono={<Phone size={12} />} valor={contacto.telefono} />
                    )}
                    {contacto?.whatsapp && (
                      <DatoContacto icono={<MessageCircle size={12} />} valor={contacto.whatsapp} />
                    )}
                    {contacto?.rubro && (
                      <DatoContacto icono={<Building2 size={12} />} valor={contacto.rubro} />
                    )}
                    {contacto?.cargo && (
                      <DatoContacto icono={<Briefcase size={12} />} valor={contacto.cargo} />
                    )}
                    {contacto?.direccion_principal && (
                      <DatoContacto icono={<MapPin size={12} />} valor={contacto.direccion_principal} />
                    )}
                    {!contacto && (
                      <p className="text-xs" style={{ color: 'var(--texto-terciario)' }}>
                        Cargando datos...
                      </p>
                    )}
                  </div>
                </SeccionColapsable>

                {/* Sección: Historial */}
                <SeccionColapsable
                  titulo="Historial"
                  abierta={seccionAbierta === 'historial'}
                  onToggle={() => toggleSeccion('historial')}
                >
                  <p className="text-xs" style={{ color: 'var(--texto-terciario)' }}>
                    Conversaciones anteriores con este contacto aparecerán acá.
                  </p>
                </SeccionColapsable>

                {/* Sección: Archivos */}
                <SeccionColapsable
                  titulo="Archivos compartidos"
                  abierta={seccionAbierta === 'archivos'}
                  onToggle={() => toggleSeccion('archivos')}
                >
                  <p className="text-xs" style={{ color: 'var(--texto-terciario)' }}>
                    Imágenes, documentos y archivos de esta conversación.
                  </p>
                </SeccionColapsable>
              </div>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

// Componente auxiliar: sección colapsable
function SeccionColapsable({
  titulo,
  abierta,
  onToggle,
  children,
}: {
  titulo: string
  abierta: boolean
  onToggle: () => void
  children: React.ReactNode
}) {
  return (
    <div style={{ borderTop: '1px solid var(--borde-sutil)' }}>
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between py-2 text-xs font-medium"
        style={{ color: 'var(--texto-secundario)' }}
      >
        {titulo}
        {abierta ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
      </button>
      <AnimatePresence>
        {abierta && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden pb-2"
          >
            {children}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// Componente auxiliar: línea de dato
function DatoContacto({ icono, valor }: { icono: React.ReactNode; valor: string }) {
  return (
    <div className="flex items-center gap-2">
      <span style={{ color: 'var(--texto-terciario)' }}>{icono}</span>
      <span className="text-xs truncate" style={{ color: 'var(--texto-secundario)' }}>
        {valor}
      </span>
    </div>
  )
}
