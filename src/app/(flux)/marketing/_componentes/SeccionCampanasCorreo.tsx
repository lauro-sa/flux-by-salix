'use client'

import { motion } from 'framer-motion'
import { EncabezadoSeccion } from '@/componentes/ui/EncabezadoSeccion'
import {
  Palette, Users, BarChart3, Clock,
  Send, Target, FlaskConical, Layers, Sparkles, Eye,
} from 'lucide-react'

/**
 * SeccionCampanasCorreo — Detalle de funcionalidades de email marketing.
 * Se renderiza dentro de PlantillaConfiguracion cuando se selecciona esta sección.
 */

interface Funcionalidad {
  icono: React.ReactNode
  titulo: string
  descripcion: string
}

const funcionalidades: Funcionalidad[] = [
  {
    icono: <Palette size={20} />,
    titulo: 'Editor de plantillas',
    descripcion: 'Editor visual drag & drop para crear correos atractivos sin escribir HTML. Plantillas prediseñadas por categoría (promoción, newsletter, bienvenida, seguimiento). Variables dinámicas como {{nombre}}, {{empresa}} que se reemplazan por los datos del contacto.',
  },
  {
    icono: <Users size={20} />,
    titulo: 'Segmentación de audiencia',
    descripcion: 'Creá listas de destinatarios filtrando por etiquetas, tipo de contacto, etapa del pipeline, ubicación, último contacto, o cualquier campo personalizado. Guardá segmentos para reutilizarlos en futuras campañas.',
  },
  {
    icono: <Send size={20} />,
    titulo: 'Envío masivo',
    descripcion: 'Enviá a cientos o miles de contactos con rate limiting inteligente para proteger la reputación de tu dominio. Cola de envío con reintentos automáticos. Soporte para dominio propio o servidor SMTP configurado.',
  },
  {
    icono: <Clock size={20} />,
    titulo: 'Programación de envíos',
    descripcion: 'Programá campañas para una fecha y hora específica. Envío inteligente que ajusta la hora según la zona horaria de cada destinatario para maximizar aperturas.',
  },
  {
    icono: <FlaskConical size={20} />,
    titulo: 'A/B Testing',
    descripcion: 'Probá diferentes asuntos, contenidos o remitentes con un porcentaje de tu lista. Flux elige automáticamente la variante ganadora y la envía al resto.',
  },
  {
    icono: <BarChart3 size={20} />,
    titulo: 'Métricas en tiempo real',
    descripcion: 'Dashboard con tasa de apertura, clics en enlaces, rebotes, desuscripciones y spam. Mapa de calor de clics en el correo. Comparativa con campañas anteriores.',
  },
  {
    icono: <Target size={20} />,
    titulo: 'Tracking de conversiones',
    descripcion: 'Cada enlace incluye tracking UTM automático. Si el contacto visita tu web después (con el pixel de tracking), se registra como conversión atribuida a la campaña.',
  },
  {
    icono: <Layers size={20} />,
    titulo: 'Secuencias automatizadas',
    descripcion: 'Creá secuencias de correos que se disparan automáticamente: bienvenida a nuevos contactos, seguimiento post-presupuesto, recordatorio de pago, nurturing de prospectos.',
  },
  {
    icono: <Sparkles size={20} />,
    titulo: 'Asistente IA',
    descripcion: 'Generá asuntos, contenido y CTAs con inteligencia artificial. El asistente analiza campañas anteriores y sugiere mejoras para aumentar engagement.',
  },
  {
    icono: <Eye size={20} />,
    titulo: 'Cumplimiento y reputación',
    descripcion: 'Link de desuscripción obligatorio en cada correo. Gestión de listas negras. Monitoreo de reputación del dominio. Cumplimiento GDPR y CAN-SPAM automático.',
  },
]

function SeccionCampanasCorreo() {
  return (
    <div className="flex flex-col gap-6">
      <EncabezadoSeccion
        titulo="Campañas de Correo"
        descripcion="Email marketing integrado directamente en Flux. Diseñá, segmentá, enviá y medí campañas de correo sin salir de tu sistema. Todo vinculado a tus contactos y al historial de cada cliente."
      />

      {/* Grid de funcionalidades */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {funcionalidades.map((func, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25, delay: i * 0.03 }}
            className="rounded-card border border-borde-sutil bg-superficie-tarjeta p-4 flex gap-3"
          >
            <div
              className="w-8 h-8 rounded-boton flex items-center justify-center shrink-0 mt-0.5"
              style={{
                backgroundColor: 'color-mix(in srgb, var(--canal-correo) 12%, transparent)',
                color: 'var(--canal-correo)',
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
      <div className="rounded-card bg-superficie-elevada border border-borde-sutil p-4">
        <h4 className="text-sm font-semibold text-texto-primario mb-2">Nota técnica</h4>
        <ul className="text-xs text-texto-terciario space-y-1.5 list-disc list-inside leading-relaxed">
          <li>Se integrará con servicios de envío como Amazon SES, Resend o Postmark para garantizar alta entregabilidad.</li>
          <li>Las plantillas se almacenarán como HTML + JSON (para el editor visual) en Supabase Storage.</li>
          <li>Las métricas de apertura usan un pixel 1x1 transparente; los clics se rastrean con URLs intermedias.</li>
          <li>El rate limiting respetará los límites del proveedor SMTP configurado por la empresa.</li>
          <li>Cada envío genera un registro en auditoría con quién envió, a cuántos, y resultados.</li>
        </ul>
      </div>
    </div>
  )
}

export { SeccionCampanasCorreo }
