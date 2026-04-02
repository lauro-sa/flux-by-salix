'use client'

import { motion } from 'framer-motion'
import { EncabezadoSeccion } from '@/componentes/ui/EncabezadoSeccion'
import {
  FileText, Users, BarChart3, Clock, Shield,
  Send, ListChecks, Bot, ImagePlus, Filter,
} from 'lucide-react'

/**
 * SeccionCampanasWhatsApp — Detalle de funcionalidades de WhatsApp marketing.
 * Se renderiza dentro de PlantillaConfiguracion cuando se selecciona esta sección.
 */

interface Funcionalidad {
  icono: React.ReactNode
  titulo: string
  descripcion: string
}

const funcionalidades: Funcionalidad[] = [
  {
    icono: <FileText size={20} />,
    titulo: 'Plantillas aprobadas por Meta',
    descripcion: 'Creá y gestioná plantillas de mensaje directamente desde Flux. Las plantillas se envían a Meta para aprobación y podés ver el estado en tiempo real (pendiente, aprobada, rechazada). Soporte para plantillas con variables, botones y multimedia.',
  },
  {
    icono: <Users size={20} />,
    titulo: 'Listas de difusión',
    descripcion: 'Armá listas de destinatarios filtrando contactos por etiquetas, tipo, etapa del pipeline o campos personalizados. A diferencia de los grupos de WhatsApp, cada contacto recibe el mensaje como conversación individual.',
  },
  {
    icono: <Send size={20} />,
    titulo: 'Envío masivo con cola inteligente',
    descripcion: 'Enviá a cientos de contactos respetando los rate limits de la API de WhatsApp Business. Cola con reintentos automáticos para mensajes que fallen. Progreso en tiempo real del envío.',
  },
  {
    icono: <Clock size={20} />,
    titulo: 'Programación de campañas',
    descripcion: 'Programá envíos para una fecha y hora específica. Ideal para promociones, recordatorios de eventos, o comunicaciones masivas planificadas.',
  },
  {
    icono: <ImagePlus size={20} />,
    titulo: 'Mensajes multimedia',
    descripcion: 'Enviá imágenes, PDFs, videos o documentos junto con tu mensaje. Perfecto para catálogos de productos, listas de precios, folletos o invitaciones a eventos.',
  },
  {
    icono: <ListChecks size={20} />,
    titulo: 'Botones interactivos',
    descripcion: 'Plantillas con botones de respuesta rápida (hasta 3 opciones) o botones de llamada a la acción (visitar web, llamar). Trackeo de cuál botón tocó cada contacto.',
  },
  {
    icono: <BarChart3 size={20} />,
    titulo: 'Métricas de campaña',
    descripcion: 'Dashboard con mensajes enviados, entregados, leídos y respondidos. Tasa de lectura vs entrega. Desglose por plantilla y por segmento. Comparativa entre campañas.',
  },
  {
    icono: <Filter size={20} />,
    titulo: 'Filtros de exclusión',
    descripcion: 'Excluí automáticamente contactos que pidieron no recibir mensajes, que bloquearon el número, o que ya fueron contactados recientemente. Respetá ventanas de no-contacto configurables.',
  },
  {
    icono: <Bot size={20} />,
    titulo: 'Respuestas con agente IA',
    descripcion: 'Cuando un contacto responde a una campaña, el agente IA puede tomar la conversación automáticamente o asignarla a un agente humano según reglas configurables.',
  },
  {
    icono: <Shield size={20} />,
    titulo: 'Cumplimiento y opt-out',
    descripcion: 'Gestión de opt-in/opt-out obligatorio. Registro de consentimiento por contacto. Respeto del límite de mensajes por número que impone Meta. Protección contra bloqueo del número.',
  },
]

function SeccionCampanasWhatsApp() {
  return (
    <div className="flex flex-col gap-6">
      <EncabezadoSeccion
        titulo="Campañas de WhatsApp"
        descripcion="Enviá mensajes masivos a tus contactos usando la API oficial de WhatsApp Business. Plantillas aprobadas, seguimiento de entrega y lectura, y respuestas gestionadas por tu equipo o el agente IA."
      />

      {/* Grid de funcionalidades */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {funcionalidades.map((func, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25, delay: i * 0.03 }}
            className="rounded-lg border border-borde-sutil bg-superficie-tarjeta p-4 flex gap-3"
          >
            <div
              className="w-8 h-8 rounded-md flex items-center justify-center shrink-0 mt-0.5"
              style={{
                backgroundColor: 'color-mix(in srgb, var(--canal-whatsapp) 12%, transparent)',
                color: 'var(--canal-whatsapp)',
              }}
            >
              {func.icono}
            </div>
            <div>
              <h3 className="text-sm font-semibold text-texto-primario mb-0.5">{func.titulo}</h3>
              <p className="text-xs text-texto-terciario leading-relaxed">{func.descripcion}</p>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Nota técnica */}
      <div className="rounded-lg bg-superficie-elevada border border-borde-sutil p-4">
        <h4 className="text-sm font-semibold text-texto-primario mb-2">Nota técnica</h4>
        <ul className="text-xs text-texto-terciario space-y-1.5 list-disc list-inside leading-relaxed">
          <li>Usa la misma integración de WhatsApp Business API que ya tiene Flux para el inbox.</li>
          <li>Las plantillas de marketing requieren aprobación de Meta (24-48hs). Solo se pueden enviar plantillas aprobadas.</li>
          <li>Meta cobra por mensaje de marketing enviado — cada empresa configura su presupuesto.</li>
          <li>Los mensajes masivos se envían con un delay entre cada uno para respetar rate limits (máximo ~80 msgs/segundo).</li>
          <li>Si un contacto responde dentro de las 24hs, se abre una ventana de conversación gratuita en el inbox.</li>
        </ul>
      </div>
    </div>
  )
}

export { SeccionCampanasWhatsApp }
