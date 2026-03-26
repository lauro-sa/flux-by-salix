'use client'

import { useState, useMemo, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Search, ChevronDown } from 'lucide-react'
import * as iconosLucide from 'lucide-react'

/**
 * SelectorIcono — componente reutilizable para seleccionar íconos de Lucide.
 * Muestra íconos populares por defecto, expandible para buscar entre todos.
 * Se usa en: sectores, puestos, etapas de pipeline, tipos de actividades, etc.
 */

interface PropiedadesSelectorIcono {
  valor: string
  onChange: (icono: string) => void
  etiqueta?: string
  tamano?: number
}

// Íconos populares/frecuentes para contextos empresariales — se muestran primero
const ICONOS_POPULARES = [
  'Building', 'Building2', 'Users', 'UserCog', 'Briefcase',
  'ShoppingCart', 'Store', 'Factory', 'Wrench', 'Settings',
  'HeadphonesIcon', 'Phone', 'Mail', 'MessageSquare', 'Globe',
  'BarChart3', 'TrendingUp', 'DollarSign', 'CreditCard', 'Wallet',
  'Shield', 'Lock', 'Key', 'Eye', 'Search',
  'FileText', 'FolderOpen', 'Archive', 'Database', 'Server',
  'Code', 'Terminal', 'Cpu', 'Monitor', 'Smartphone',
  'Truck', 'Package', 'MapPin', 'Navigation', 'Route',
  'Heart', 'Star', 'Zap', 'Target', 'Award',
  'GraduationCap', 'BookOpen', 'Lightbulb', 'Rocket', 'Flag',
  'Calendar', 'Clock', 'Timer', 'Gauge', 'Activity',
  'Palette', 'Camera', 'Music', 'Video', 'Image',
]

/** Mapa de traducciones ES/PT → nombre Lucide para búsqueda multi-idioma */
const TRADUCCIONES_ICONOS: Record<string, string[]> = {
  // ES → nombres Lucide
  'reloj': ['Clock', 'Timer', 'Watch'],
  'hora': ['Clock', 'Timer'],
  'tiempo': ['Clock', 'Timer', 'Hourglass'],
  'casa': ['House', 'Home'],
  'hogar': ['House', 'Home'],
  'inicio': ['Home', 'House'],
  'usuario': ['User', 'UserCog', 'Users', 'UserPlus'],
  'persona': ['User', 'Users', 'UserCog'],
  'personas': ['Users', 'User'],
  'gente': ['Users'],
  'equipo': ['Users', 'UserCog'],
  'edificio': ['Building', 'Building2'],
  'empresa': ['Building', 'Building2', 'Factory'],
  'oficina': ['Building', 'Building2'],
  'fabrica': ['Factory'],
  'tienda': ['Store', 'ShoppingBag', 'ShoppingCart'],
  'compras': ['ShoppingCart', 'ShoppingBag', 'Store'],
  'carrito': ['ShoppingCart'],
  'bolsa': ['ShoppingBag'],
  'dinero': ['DollarSign', 'Wallet', 'CreditCard', 'Banknote'],
  'plata': ['DollarSign', 'Wallet', 'Banknote'],
  'dolar': ['DollarSign'],
  'billetera': ['Wallet'],
  'tarjeta': ['CreditCard'],
  'pago': ['CreditCard', 'Wallet', 'DollarSign'],
  'correo': ['Mail', 'Inbox', 'Send'],
  'email': ['Mail', 'Inbox', 'Send'],
  'mensaje': ['MessageSquare', 'MessageCircle', 'Mail'],
  'chat': ['MessageSquare', 'MessageCircle'],
  'telefono': ['Phone', 'Smartphone'],
  'celular': ['Smartphone', 'Phone'],
  'llamada': ['Phone', 'PhoneCall'],
  'mundo': ['Globe', 'Globe2', 'Earth'],
  'web': ['Globe', 'Globe2', 'Link'],
  'internet': ['Globe', 'Wifi'],
  'enlace': ['Link', 'ExternalLink'],
  'buscar': ['Search', 'SearchCheck'],
  'busqueda': ['Search'],
  'lupa': ['Search'],
  'configuracion': ['Settings', 'Cog', 'SlidersHorizontal'],
  'ajustes': ['Settings', 'SlidersHorizontal'],
  'herramienta': ['Wrench', 'Settings', 'Tool'],
  'llave': ['Key', 'Wrench'],
  'seguridad': ['Shield', 'Lock', 'ShieldCheck'],
  'escudo': ['Shield', 'ShieldCheck'],
  'candado': ['Lock', 'Unlock'],
  'ojo': ['Eye', 'EyeOff'],
  'ver': ['Eye'],
  'ocultar': ['EyeOff'],
  'archivo': ['FileText', 'File', 'Files'],
  'documento': ['FileText', 'File', 'Files', 'FolderOpen'],
  'carpeta': ['Folder', 'FolderOpen'],
  'calendario': ['Calendar', 'CalendarDays'],
  'fecha': ['Calendar', 'CalendarDays'],
  'agenda': ['Calendar', 'CalendarDays'],
  'estrella': ['Star', 'Sparkles'],
  'favorito': ['Star', 'Heart', 'Bookmark'],
  'corazon': ['Heart', 'HeartHandshake'],
  'salud': ['Heart', 'Activity', 'Stethoscope'],
  'medicina': ['Stethoscope', 'Pill', 'Heart'],
  'grafico': ['BarChart3', 'LineChart', 'PieChart', 'TrendingUp'],
  'estadistica': ['BarChart3', 'LineChart', 'PieChart'],
  'reporte': ['BarChart3', 'FileText', 'ClipboardList'],
  'informe': ['BarChart3', 'FileText'],
  'tendencia': ['TrendingUp', 'TrendingDown'],
  'mapa': ['Map', 'MapPin', 'Navigation'],
  'ubicacion': ['MapPin', 'Navigation', 'Compass'],
  'direccion': ['MapPin', 'Navigation'],
  'ruta': ['Route', 'Navigation', 'Map'],
  'envio': ['Truck', 'Package', 'Send'],
  'paquete': ['Package', 'Box'],
  'caja': ['Box', 'Package', 'Archive'],
  'camion': ['Truck'],
  'transporte': ['Truck', 'Car', 'Bus'],
  'codigo': ['Code', 'Terminal', 'Braces'],
  'programacion': ['Code', 'Terminal'],
  'computadora': ['Monitor', 'Laptop', 'Cpu'],
  'pantalla': ['Monitor', 'Tv'],
  'servidor': ['Server', 'Database', 'HardDrive'],
  'base de datos': ['Database'],
  'datos': ['Database', 'Server'],
  'rayo': ['Zap', 'Bolt'],
  'energia': ['Zap', 'Battery', 'Plug'],
  'objetivo': ['Target', 'Crosshair'],
  'meta': ['Target', 'Flag'],
  'premio': ['Award', 'Trophy', 'Medal'],
  'trofeo': ['Trophy', 'Award'],
  'educacion': ['GraduationCap', 'BookOpen', 'School'],
  'libro': ['BookOpen', 'Book', 'Library'],
  'escuela': ['School', 'GraduationCap'],
  'idea': ['Lightbulb', 'Sparkles'],
  'luz': ['Lightbulb', 'Sun', 'Lamp'],
  'cohete': ['Rocket'],
  'lanzamiento': ['Rocket', 'Send'],
  'bandera': ['Flag', 'FlagTriangleRight'],
  'foto': ['Camera', 'Image'],
  'camara': ['Camera', 'Video'],
  'imagen': ['Image', 'Camera'],
  'video': ['Video', 'Film', 'Clapperboard'],
  'musica': ['Music', 'Headphones'],
  'arte': ['Palette', 'Brush', 'PaintBucket'],
  'color': ['Palette', 'Brush'],
  'pintura': ['Palette', 'Brush', 'PaintBucket'],
  'actividad': ['Activity', 'Pulse'],
  'velocidad': ['Gauge', 'Zap'],
  'indicador': ['Gauge', 'Activity'],
  'flecha': ['ArrowRight', 'ArrowUp', 'ArrowDown', 'MoveRight'],
  'agregar': ['Plus', 'PlusCircle'],
  'nuevo': ['Plus', 'PlusCircle', 'FilePlus'],
  'eliminar': ['Trash2', 'X', 'XCircle'],
  'basura': ['Trash2'],
  'editar': ['Pencil', 'PenLine', 'Edit'],
  'guardar': ['Save', 'Download'],
  'descargar': ['Download', 'ArrowDown'],
  'subir': ['Upload', 'ArrowUp'],
  'compartir': ['Share', 'Share2', 'Forward'],
  'notificacion': ['Bell', 'BellRing'],
  'alarma': ['Bell', 'AlarmClock', 'BellRing'],
  'alerta': ['AlertTriangle', 'AlertCircle', 'Bell'],
  'informacion': ['Info', 'HelpCircle'],
  'ayuda': ['HelpCircle', 'Info', 'LifeBuoy'],
  'exito': ['CheckCircle', 'Check', 'ThumbsUp'],
  'error': ['XCircle', 'AlertCircle', 'X'],
  'venta': ['ShoppingCart', 'DollarSign', 'TrendingUp'],
  'cliente': ['User', 'Users', 'Handshake'],
  'contacto': ['Contact', 'User', 'Phone'],
  'soporte': ['HeadphonesIcon', 'LifeBuoy', 'HelpCircle'],
  'auriculares': ['HeadphonesIcon', 'Headphones'],
  'marketing': ['Megaphone', 'TrendingUp', 'BarChart3'],
  'publicidad': ['Megaphone', 'Newspaper'],
  'recursos humanos': ['Users', 'UserCog', 'Briefcase'],
  'legal': ['Scale', 'Gavel', 'FileText'],
  'contabilidad': ['Calculator', 'DollarSign', 'FileText'],
  'calculadora': ['Calculator'],
  'logistica': ['Truck', 'Package', 'Route'],
  'almacen': ['Warehouse', 'Box', 'Package'],
  'inventario': ['ClipboardList', 'Package', 'Box'],
  'producto': ['Package', 'Box', 'ShoppingBag'],
  'taller': ['Wrench', 'Hammer', 'Factory'],
  'mantenimiento': ['Wrench', 'Settings', 'Tool'],
  // PT
  'relogio': ['Clock', 'Timer', 'Watch'],
  'pesquisar': ['Search'],
  'configuracoes': ['Settings'],
  'escritorio': ['Building', 'Building2'],
  'loja': ['Store', 'ShoppingBag'],
  'dinheiro': ['DollarSign', 'Wallet', 'Banknote'],
  'correio': ['Mail', 'Inbox'],
  'estrela': ['Star', 'Sparkles'],
  'coracao': ['Heart'],
  'saude': ['Heart', 'Activity'],
  'educacao': ['GraduationCap', 'BookOpen'],
  'livro': ['BookOpen', 'Book'],
}

// Obtener el componente de ícono de Lucide por nombre
function obtenerIcono(nombre: string): React.ComponentType<{ size?: number; className?: string }> | null {
  const iconos = iconosLucide as unknown as Record<string, React.ComponentType<{ size?: number; className?: string }>>
  return iconos[nombre] || null
}

// Obtener todos los nombres de íconos disponibles (filtrar solo componentes)
function obtenerTodosLosIconos(): string[] {
  return Object.keys(iconosLucide).filter(key => {
    if (key === 'default' || key === 'createLucideIcon' || key === 'icons') return false
    if (key.startsWith('__')) return false
    const val = (iconosLucide as unknown as Record<string, unknown>)[key]
    return typeof val === 'object' || typeof val === 'function'
  })
}

function SelectorIcono({ valor, onChange, etiqueta, tamano = 18 }: PropiedadesSelectorIcono) {
  const [abierto, setAbierto] = useState(false)
  const [expandido, setExpandido] = useState(false)
  const [busqueda, setBusqueda] = useState('')
  const contenedorRef = useRef<HTMLDivElement>(null)

  // Cerrar al hacer click afuera
  useEffect(() => {
    if (!abierto) return
    const handler = (e: MouseEvent) => {
      if (contenedorRef.current && !contenedorRef.current.contains(e.target as Node)) {
        setAbierto(false)
        setExpandido(false)
        setBusqueda('')
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [abierto])

  // Íconos filtrados — busca en nombre inglés + traducciones ES/PT
  const iconosFiltrados = useMemo(() => {
    if (!expandido && !busqueda) return ICONOS_POPULARES

    const todos = obtenerTodosLosIconos()

    if (!busqueda) return todos

    const busquedaLower = busqueda.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')

    // Buscar en traducciones primero
    const desdeTraduccion = new Set<string>()
    for (const [palabra, iconos] of Object.entries(TRADUCCIONES_ICONOS)) {
      const palabraNorm = palabra.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      if (palabraNorm.includes(busquedaLower)) {
        iconos.forEach(i => desdeTraduccion.add(i))
      }
    }

    // Buscar también en el nombre original (inglés)
    const desdeNombre = todos.filter(nombre =>
      nombre.toLowerCase().includes(busquedaLower)
    )

    // Combinar: traducciones primero, después por nombre, sin duplicados
    const resultado = [...desdeTraduccion]
    for (const nombre of desdeNombre) {
      if (!desdeTraduccion.has(nombre)) resultado.push(nombre)
    }

    return resultado
  }, [expandido, busqueda])

  const IconoActual = obtenerIcono(valor)

  return (
    <div ref={contenedorRef} className="relative">
      {etiqueta && (
        <label className="text-sm font-medium text-texto-secundario block mb-1">{etiqueta}</label>
      )}

      {/* Botón que muestra el ícono actual */}
      <button
        onClick={() => setAbierto(!abierto)}
        className="flex items-center gap-2 px-3 py-2 rounded-md border border-borde-fuerte bg-superficie-tarjeta hover:bg-superficie-hover transition-colors cursor-pointer text-sm text-texto-primario w-full"
      >
        <div className="w-7 h-7 rounded-md bg-superficie-hover flex items-center justify-center shrink-0">
          {IconoActual ? <IconoActual size={tamano} className="text-texto-marca" /> : <span className="text-xs text-texto-terciario">?</span>}
        </div>
        <span className="flex-1 text-left text-texto-secundario truncate">{valor || 'Seleccionar ícono'}</span>
        <ChevronDown size={14} className={`text-texto-terciario transition-transform ${abierto ? 'rotate-180' : ''}`} />
      </button>

      {/* Dropdown */}
      <AnimatePresence>
        {abierto && (
          <motion.div
            initial={{ opacity: 0, y: 4, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 4, scale: 0.97 }}
            transition={{ duration: 0.12 }}
            className="absolute z-50 left-0 right-0 top-full mt-1 bg-superficie-elevada border border-borde-sutil rounded-xl shadow-lg overflow-hidden"
          >
            {/* Buscador (solo cuando está expandido) */}
            {expandido && (
              <div className="p-2 border-b border-borde-sutil">
                <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-md bg-superficie-tarjeta border border-borde-fuerte">
                  <Search size={14} className="text-texto-terciario shrink-0" />
                  <input
                    type="text"
                    placeholder="Buscar ícono..."
                    value={busqueda}
                    onChange={(e) => setBusqueda(e.target.value)}
                    className="flex-1 bg-transparent border-none outline-none text-sm text-texto-primario placeholder:text-texto-terciario"
                    autoFocus
                  />
                </div>
              </div>
            )}

            {/* Grid de íconos */}
            <div className={`p-2 overflow-y-auto ${expandido ? 'max-h-60' : 'max-h-40'}`}>
              <div className="grid grid-cols-8 gap-1">
                {iconosFiltrados.slice(0, expandido ? 200 : ICONOS_POPULARES.length).map(nombre => {
                  const Icono = obtenerIcono(nombre)
                  if (!Icono) return null

                  const seleccionado = valor === nombre

                  return (
                    <button
                      key={nombre}
                      onClick={() => { onChange(nombre); setAbierto(false); setExpandido(false); setBusqueda('') }}
                      title={nombre}
                      className={[
                        'w-8 h-8 rounded-md flex items-center justify-center transition-all cursor-pointer border-none',
                        seleccionado
                          ? 'bg-texto-marca/20 text-texto-marca ring-1 ring-texto-marca'
                          : 'bg-transparent text-texto-secundario hover:bg-superficie-hover hover:text-texto-primario',
                      ].join(' ')}
                    >
                      <Icono size={16} />
                    </button>
                  )
                })}
              </div>

              {!expandido && iconosFiltrados.length === ICONOS_POPULARES.length && (
                <button
                  onClick={() => setExpandido(true)}
                  className="w-full mt-2 py-1.5 text-xs text-texto-marca font-medium bg-transparent border-none cursor-pointer hover:underline flex items-center justify-center gap-1"
                >
                  Ver todos los íconos
                  <ChevronDown size={12} />
                </button>
              )}

              {expandido && iconosFiltrados.length === 0 && (
                <p className="text-xs text-texto-terciario text-center py-4">No se encontraron íconos</p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export { SelectorIcono, obtenerIcono }
