'use client'

import { motion } from 'framer-motion'
import { EncabezadoSeccion } from '@/componentes/ui/EncabezadoSeccion'
import {
  Code, MousePointerClick, Users, BarChart3,
  Globe, Eye, Timer, Fingerprint, LayoutDashboard, Zap, ShieldCheck,
} from 'lucide-react'

/**
 * SeccionTracking — Detalle del sistema de pixel/snippet de seguimiento web.
 * Se renderiza dentro de PlantillaConfiguracion cuando se selecciona esta sección.
 */

interface Funcionalidad {
  icono: React.ReactNode
  titulo: string
  descripcion: string
}

const funcionalidades: Funcionalidad[] = [
  {
    icono: <Code size={20} />,
    titulo: 'Snippet de instalación',
    descripcion: 'Cada empresa recibe un código JavaScript único para pegar en su sitio web. Una sola línea tipo <script src="https://fluxsalix.com/t.js" data-flux="ID"></script>. Compatible con cualquier web: WordPress, Wix, HTML estático, React, etc.',
  },
  {
    icono: <Eye size={20} />,
    titulo: 'Seguimiento de páginas',
    descripcion: 'Registra automáticamente cada página visitada: URL, título, tiempo de permanencia, scroll depth. Sin configuración adicional, funciona desde el momento en que se instala el snippet.',
  },
  {
    icono: <MousePointerClick size={20} />,
    titulo: 'Eventos de clic personalizados',
    descripcion: 'Marcá botones o enlaces importantes con el atributo data-flux-evento="nombre" y Flux registra cada clic. Ideal para rastrear CTAs como "Cotizar", "Contactar", "Descargar catálogo".',
  },
  {
    icono: <Zap size={20} />,
    titulo: 'Captura de formularios',
    descripcion: 'Detecta automáticamente formularios enviados en tu web. Si el visitante ingresa su email, Flux lo vincula con su ficha de contacto existente o crea uno nuevo como prospecto.',
  },
  {
    icono: <Fingerprint size={20} />,
    titulo: 'Identificación de visitantes',
    descripcion: 'Visitantes anónimos se rastrean con una cookie. Cuando un visitante se identifica (formulario, clic en enlace de campaña), todo su historial previo se vincula a su contacto en Flux.',
  },
  {
    icono: <Users size={20} />,
    titulo: 'Vinculación con contactos',
    descripcion: 'En la ficha de cada contacto aparece su actividad web: qué páginas visitó, cuántas veces, cuándo fue la última visita. El vendedor ve si un prospecto estuvo mirando la página de precios antes de llamar.',
  },
  {
    icono: <LayoutDashboard size={20} />,
    titulo: 'Dashboard de analíticas',
    descripcion: 'Panel con métricas clave: visitantes únicos, páginas más vistas, fuentes de tráfico, eventos más frecuentes, tasa de conversión de formularios. Filtros por rango de fechas y segmentos.',
  },
  {
    icono: <Globe size={20} />,
    titulo: 'Fuentes de tráfico',
    descripcion: 'Detecta de dónde vienen tus visitantes: Google, redes sociales, campañas de correo, WhatsApp, tráfico directo. Atribución automática de conversiones a la fuente original.',
  },
  {
    icono: <Timer size={20} />,
    titulo: 'Alertas en tiempo real',
    descripcion: 'Notificaciones cuando un contacto importante visita tu web. Configurá alertas por contacto, por página ("alguien vio la página de precios") o por evento ("alguien pidió una demo").',
  },
  {
    icono: <BarChart3 size={20} />,
    titulo: 'Embudos de conversión',
    descripcion: 'Definí embudos personalizados (ej: Home → Servicios → Precios → Contacto) y medí cuántos visitantes completan cada paso. Identificá dónde se pierden los prospectos.',
  },
  {
    icono: <ShieldCheck size={20} />,
    titulo: 'Privacidad y cumplimiento',
    descripcion: 'Banner de cookies configurable incluido. Respeto de Do Not Track. Datos almacenados en la infraestructura de Flux (Supabase), no en terceros. Cumplimiento GDPR con consentimiento explícito.',
  },
]

function SeccionTracking() {
  return (
    <div className="flex flex-col gap-6">
      <EncabezadoSeccion
        titulo="Tracking Web"
        descripcion="Instalá un pixel de seguimiento en tu sitio web y conectá la actividad de tus visitantes con sus fichas de contacto en Flux. Sabé quién visita tu web, qué mira y cuándo vuelve."
      />

      {/* Ejemplo de snippet */}
      <div className="rounded-card bg-superficie-elevada border border-borde-sutil p-4">
        <h4 className="text-sm font-semibold text-texto-primario mb-3 flex items-center gap-2">
          <Code size={14} className="text-texto-marca" />
          Ejemplo del snippet
        </h4>
        <div className="rounded-boton bg-[#1e1e2e] p-3 font-mono text-xs text-[#cdd6f4] overflow-x-auto">
          <span className="text-[#89b4fa]">{'<!-- Flux Tracking - Pegar antes de </body> -->'}</span>
          <br />
          <span className="text-[#cba6f7]">{'<script'}</span>
          {' '}
          <span className="text-[#89dceb]">src</span>
          <span className="text-[#f38ba8]">=</span>
          <span className="text-[#a6e3a1]">{'"https://fluxsalix.com/t.js"'}</span>
          <br />
          {'  '}
          <span className="text-[#89dceb]">data-flux</span>
          <span className="text-[#f38ba8]">=</span>
          <span className="text-[#a6e3a1]">{'"TU_EMPRESA_ID"'}</span>
          <span className="text-[#cba6f7]">{'>'}</span>
          <span className="text-[#cba6f7]">{'</script>'}</span>
        </div>
        <p className="text-xs text-texto-terciario mt-2">
          Cada empresa tiene su ID único. El script pesa menos de 5KB y no afecta la velocidad de carga.
        </p>
      </div>

      {/* Ejemplo de evento */}
      <div className="rounded-card bg-superficie-elevada border border-borde-sutil p-4">
        <h4 className="text-sm font-semibold text-texto-primario mb-3 flex items-center gap-2">
          <MousePointerClick size={14} className="text-texto-marca" />
          Ejemplo de evento personalizado
        </h4>
        <div className="rounded-boton bg-[#1e1e2e] p-3 font-mono text-xs text-[#cdd6f4] overflow-x-auto">
          <span className="text-[#89b4fa]">{'<!-- Botón con tracking automático -->'}</span>
          <br />
          <span className="text-[#cba6f7]">{'<button'}</span>
          {' '}
          <span className="text-[#89dceb]">data-flux-evento</span>
          <span className="text-[#f38ba8]">=</span>
          <span className="text-[#a6e3a1]">{'"solicitar_cotizacion"'}</span>
          <span className="text-[#cba6f7]">{'>'}</span>
          <br />
          {'  Pedir cotización'}
          <br />
          <span className="text-[#cba6f7]">{'</button>'}</span>
        </div>
        <p className="text-xs text-texto-terciario mt-2">
          Agregá data-flux-evento a cualquier elemento y Flux registra cada interacción automáticamente.
        </p>
      </div>

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
                backgroundColor: 'color-mix(in srgb, var(--texto-marca) 12%, transparent)',
                color: 'var(--texto-marca)',
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
          <li>El script se sirve desde un CDN (Vercel Edge o Cloudflare) para máxima velocidad global.</li>
          <li>Los eventos se envían en lotes (batch) cada 5 segundos para minimizar requests.</li>
          <li>API de ingesta con rate limiting por empresa para evitar abuso.</li>
          <li>Los datos se almacenan en Supabase con retención configurable (30, 90, 365 días).</li>
          <li>La vinculación anónimo → contacto usa una combinación de cookie + email hash.</li>
          <li>El dashboard usa agregaciones precalculadas para rendimiento en empresas con alto tráfico.</li>
        </ul>
      </div>
    </div>
  )
}

export { SeccionTracking }
