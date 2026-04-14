'use client'

import { useState, useMemo, useRef, useEffect, useLayoutEffect } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Search, ChevronDown } from 'lucide-react'
import { Tooltip } from '@/componentes/ui/Tooltip'
import * as iconosLucide from 'lucide-react'

/**
 * SelectorIcono — componente reutilizable para seleccionar íconos de Lucide.
 * Muestra íconos organizados por categorías, con buscador siempre visible.
 * Se usa en: sectores, puestos, etapas de pipeline, tipos de actividades, tipos de evento, etc.
 */

interface PropiedadesSelectorIcono {
  valor: string
  onChange: (icono: string) => void
  etiqueta?: string
  tamano?: number
}

// Categorías de íconos — cada una con nombre y lista de íconos relevantes
const CATEGORIAS_ICONOS: { nombre: string; iconos: string[] }[] = [
  {
    nombre: 'General',
    iconos: [
      'Star', 'Heart', 'Zap', 'Target', 'Award', 'Trophy', 'Medal',
      'Flag', 'Bookmark', 'Tag', 'Hash', 'AtSign', 'Check', 'CheckCircle',
      'Plus', 'PlusCircle', 'Sparkles', 'Flame', 'Crown', 'Gem', 'Diamond',
    ],
  },
  {
    nombre: 'Personas',
    iconos: [
      'User', 'Users', 'UserCog', 'UserPlus', 'UserCheck', 'UserX',
      'Contact', 'Handshake', 'HeartHandshake', 'Baby', 'Accessibility',
    ],
  },
  {
    nombre: 'Comunicación',
    iconos: [
      'Phone', 'PhoneCall', 'PhoneIncoming', 'PhoneOutgoing',
      'Mail', 'Inbox', 'Send', 'Forward',
      'MessageSquare', 'MessageCircle', 'MessagesSquare',
      'Megaphone', 'Bell', 'BellRing', 'AtSign',
      'Video', 'Voicemail', 'Radio',
    ],
  },
  {
    nombre: 'Comercio y finanzas',
    iconos: [
      'ShoppingCart', 'ShoppingBag', 'Store', 'CreditCard', 'Wallet',
      'DollarSign', 'Banknote', 'Receipt', 'BadgeDollarSign',
      'CircleDollarSign', 'PiggyBank', 'Landmark', 'TrendingUp',
      'TrendingDown', 'BarChart3', 'LineChart', 'PieChart',
      'ArrowUpRight', 'ArrowDownRight', 'Calculator',
    ],
  },
  {
    nombre: 'Empresa y oficina',
    iconos: [
      'Building', 'Building2', 'Factory', 'Warehouse', 'Briefcase',
      'ClipboardList', 'ClipboardCheck', 'FileText', 'Files',
      'FolderOpen', 'Folder', 'Archive', 'Printer', 'Stamp',
      'Presentation', 'Table', 'Kanban', 'LayoutGrid',
    ],
  },
  {
    nombre: 'Herramientas y oficios',
    iconos: [
      'Wrench', 'Hammer', 'Screwdriver', 'Drill', 'Nut',
      'Settings', 'Cog', 'SlidersHorizontal',
      'Paintbrush', 'PaintBucket', 'Palette', 'Brush',
      'Scissors', 'Ruler', 'Pencil', 'PenLine', 'Eraser',
      'Pipette', 'Axe', 'Shovel', 'HardHat',
    ],
  },
  {
    nombre: 'Construcción e industria',
    iconos: [
      'Construction', 'Hammer', 'Wrench', 'HardHat',
      'Building2', 'Factory', 'Warehouse', 'Landmark',
      'Blocks', 'Box', 'Boxes', 'Container',
      'Plug', 'Zap', 'Lightbulb', 'Lamp', 'Power',
      'Gauge', 'Thermometer', 'Droplets', 'Flame',
    ],
  },
  {
    nombre: 'Transporte y logística',
    iconos: [
      'Truck', 'Car', 'Bus', 'Bike', 'Ship', 'Plane',
      'Package', 'PackageCheck', 'PackageOpen', 'PackageSearch',
      'MapPin', 'Map', 'Navigation', 'Compass', 'Route',
      'Milestone', 'Signpost', 'Fuel', 'Anchor',
    ],
  },
  {
    nombre: 'Tecnología',
    iconos: [
      'Monitor', 'Laptop', 'Smartphone', 'Tablet',
      'Code', 'Terminal', 'Braces', 'Binary',
      'Cpu', 'Server', 'Database', 'HardDrive', 'Cloud',
      'Wifi', 'Globe', 'Link', 'ExternalLink', 'QrCode',
      'Bot', 'BrainCircuit', 'CircuitBoard',
    ],
  },
  {
    nombre: 'Salud y bienestar',
    iconos: [
      'Heart', 'HeartPulse', 'Activity', 'Stethoscope',
      'Pill', 'Syringe', 'Thermometer', 'Cross',
      'ShieldPlus', 'Ambulance', 'Hospital',
      'Apple', 'Dumbbell', 'PersonStanding',
    ],
  },
  {
    nombre: 'Educación',
    iconos: [
      'GraduationCap', 'BookOpen', 'Book', 'Library', 'School',
      'Lightbulb', 'BrainCircuit', 'Microscope', 'TestTube',
      'FlaskConical', 'Atom', 'Telescope',
      'NotebookPen', 'PenLine', 'FileQuestion',
    ],
  },
  {
    nombre: 'Alimentos y gastronomía',
    iconos: [
      'UtensilsCrossed', 'ChefHat', 'CookingPot', 'Soup',
      'Coffee', 'Wine', 'Beer', 'GlassWater', 'Cup',
      'Apple', 'Cherry', 'Grape', 'Banana', 'Carrot',
      'Wheat', 'Egg', 'IceCream', 'Cake', 'Pizza',
    ],
  },
  {
    nombre: 'Naturaleza y campo',
    iconos: [
      'TreePine', 'Trees', 'Flower', 'Flower2', 'Leaf', 'Clover', 'Sprout',
      'Sun', 'Moon', 'CloudSun', 'Snowflake', 'Wind', 'Waves',
      'Mountain', 'MountainSnow', 'Tent',
      'Bug', 'Bird', 'Fish', 'PawPrint', 'Dog', 'Cat', 'Rabbit',
      'Tractor', 'Fence',
    ],
  },
  {
    nombre: 'Seguridad',
    iconos: [
      'Shield', 'ShieldCheck', 'ShieldAlert', 'Lock', 'Unlock',
      'Key', 'KeyRound', 'Fingerprint', 'ScanFace', 'Eye', 'EyeOff',
      'AlertTriangle', 'AlertCircle', 'Ban', 'ShieldOff',
    ],
  },
  {
    nombre: 'Tiempo y calendario',
    iconos: [
      'Clock', 'Timer', 'Hourglass', 'Watch', 'AlarmClock',
      'Calendar', 'CalendarDays', 'CalendarCheck', 'CalendarClock',
      'History', 'TimerReset', 'Stopwatch',
    ],
  },
  {
    nombre: 'Media y creatividad',
    iconos: [
      'Camera', 'Image', 'Film', 'Clapperboard', 'Music', 'Headphones',
      'Mic', 'Volume2', 'Radio', 'Tv', 'MonitorPlay',
      'Palette', 'Brush', 'Figma', 'Pen', 'Type',
      'Shapes', 'Circle', 'Square', 'Triangle', 'Hexagon',
    ],
  },
  {
    nombre: 'Viaje y ocio',
    iconos: [
      'Plane', 'Hotel', 'Luggage', 'Tent', 'Compass',
      'Map', 'Globe', 'Palmtree', 'Umbrella', 'Ticket',
      'Gamepad2', 'Dice5', 'Puzzle', 'Drama',
    ],
  },
]

// Todos los íconos populares (la unión de las categorías, sin duplicados)
const ICONOS_POPULARES = [...new Set(CATEGORIAS_ICONOS.flatMap(c => c.iconos))]

/** Mapa de traducciones ES/PT → nombre Lucide para búsqueda multi-idioma */
const TRADUCCIONES_ICONOS: Record<string, string[]> = {
  // ── General ──
  'estrella': ['Star', 'Sparkles'],
  'favorito': ['Star', 'Heart', 'Bookmark'],
  'corazon': ['Heart', 'HeartHandshake', 'HeartPulse'],
  'rayo': ['Zap', 'Bolt'],
  'energia': ['Zap', 'Battery', 'Plug', 'Power'],
  'objetivo': ['Target', 'Crosshair'],
  'meta': ['Target', 'Flag'],
  'premio': ['Award', 'Trophy', 'Medal', 'Crown'],
  'trofeo': ['Trophy', 'Award'],
  'corona': ['Crown'],
  'gema': ['Gem', 'Diamond'],
  'diamante': ['Diamond', 'Gem'],
  'etiqueta': ['Tag', 'Hash'],
  'marcador': ['Bookmark', 'Flag'],
  'fuego': ['Flame', 'Fire'],
  'llama': ['Flame'],

  // ── Personas ──
  'usuario': ['User', 'UserCog', 'Users', 'UserPlus'],
  'persona': ['User', 'Users', 'UserCog', 'PersonStanding'],
  'personas': ['Users', 'User'],
  'gente': ['Users'],
  'equipo': ['Users', 'UserCog'],
  'contacto': ['Contact', 'User', 'Phone'],
  'cliente': ['User', 'Users', 'Handshake'],
  'bebe': ['Baby'],

  // ── Comunicación ──
  'telefono': ['Phone', 'Smartphone', 'PhoneCall'],
  'celular': ['Smartphone', 'Phone'],
  'llamada': ['Phone', 'PhoneCall', 'PhoneIncoming', 'PhoneOutgoing'],
  'correo': ['Mail', 'Inbox', 'Send'],
  'email': ['Mail', 'Inbox', 'Send'],
  'mensaje': ['MessageSquare', 'MessageCircle', 'Mail', 'MessagesSquare'],
  'chat': ['MessageSquare', 'MessageCircle', 'MessagesSquare'],
  'notificacion': ['Bell', 'BellRing'],
  'alarma': ['Bell', 'AlarmClock', 'BellRing'],
  'alerta': ['AlertTriangle', 'AlertCircle', 'Bell'],
  'megafono': ['Megaphone'],
  'enviar': ['Send', 'Forward'],

  // ── Comercio y finanzas ──
  'dinero': ['DollarSign', 'Wallet', 'CreditCard', 'Banknote', 'CircleDollarSign'],
  'plata': ['DollarSign', 'Wallet', 'Banknote'],
  'dolar': ['DollarSign', 'BadgeDollarSign', 'CircleDollarSign'],
  'billetera': ['Wallet'],
  'tarjeta': ['CreditCard'],
  'pago': ['CreditCard', 'Wallet', 'DollarSign', 'Banknote'],
  'factura': ['Receipt', 'FileText'],
  'recibo': ['Receipt'],
  'tienda': ['Store', 'ShoppingBag', 'ShoppingCart'],
  'compras': ['ShoppingCart', 'ShoppingBag', 'Store'],
  'carrito': ['ShoppingCart'],
  'bolsa': ['ShoppingBag'],
  'venta': ['ShoppingCart', 'DollarSign', 'TrendingUp', 'BadgeDollarSign'],
  'grafico': ['BarChart3', 'LineChart', 'PieChart', 'TrendingUp'],
  'estadistica': ['BarChart3', 'LineChart', 'PieChart'],
  'tendencia': ['TrendingUp', 'TrendingDown'],
  'calculadora': ['Calculator'],
  'banco': ['Landmark', 'PiggyBank'],
  'ahorro': ['PiggyBank', 'Wallet'],
  'presupuesto': ['Calculator', 'Receipt', 'FileText'],

  // ── Empresa y oficina ──
  'edificio': ['Building', 'Building2'],
  'empresa': ['Building', 'Building2', 'Factory', 'Briefcase'],
  'oficina': ['Building', 'Building2', 'Briefcase'],
  'fabrica': ['Factory'],
  'almacen': ['Warehouse', 'Box', 'Package'],
  'maletin': ['Briefcase'],
  'portafolio': ['Briefcase'],
  'archivo': ['FileText', 'File', 'Files', 'Archive'],
  'documento': ['FileText', 'File', 'Files', 'FolderOpen', 'ClipboardList'],
  'carpeta': ['Folder', 'FolderOpen'],
  'reporte': ['BarChart3', 'FileText', 'ClipboardList'],
  'informe': ['BarChart3', 'FileText'],
  'inventario': ['ClipboardList', 'Package', 'Box', 'PackageSearch'],
  'producto': ['Package', 'Box', 'ShoppingBag'],
  'impresora': ['Printer'],
  'sello': ['Stamp'],
  'tabla': ['Table', 'LayoutGrid'],
  'kanban': ['Kanban'],
  'presentacion': ['Presentation'],

  // ── Herramientas y oficios ──
  'herramienta': ['Wrench', 'Settings', 'Hammer', 'Screwdriver'],
  'llave': ['Key', 'Wrench', 'KeyRound'],
  'martillo': ['Hammer'],
  'destornillador': ['Screwdriver'],
  'taladro': ['Drill'],
  'tuerca': ['Nut', 'Cog'],
  'configuracion': ['Settings', 'Cog', 'SlidersHorizontal'],
  'ajustes': ['Settings', 'SlidersHorizontal'],
  'pintura': ['Palette', 'Brush', 'PaintBucket', 'Paintbrush'],
  'pincel': ['Brush', 'Paintbrush'],
  'balde': ['PaintBucket'],
  'tijera': ['Scissors'],
  'regla': ['Ruler'],
  'lapiz': ['Pencil', 'PenLine'],
  'borrador': ['Eraser'],
  'hacha': ['Axe'],
  'pala': ['Shovel'],
  'casco': ['HardHat'],
  'taller': ['Wrench', 'Hammer', 'Factory'],
  'mantenimiento': ['Wrench', 'Settings', 'Hammer'],
  'reparacion': ['Wrench', 'Hammer', 'Screwdriver', 'Settings'],
  'reparar': ['Wrench', 'Hammer', 'Screwdriver'],
  'arreglar': ['Wrench', 'Hammer', 'Screwdriver'],
  'mecanico': ['Wrench', 'Cog', 'Car'],
  'plomero': ['Droplets', 'Wrench', 'Pipette'],
  'plomeria': ['Droplets', 'Wrench', 'Pipette'],
  'electricista': ['Zap', 'Plug', 'Lightbulb', 'Power'],
  'electricidad': ['Zap', 'Plug', 'Power', 'CircuitBoard'],

  // ── Construcción e industria ──
  'construccion': ['Construction', 'Hammer', 'HardHat', 'Building2'],
  'obra': ['Construction', 'Hammer', 'HardHat'],
  'cemento': ['Blocks', 'Construction'],
  'ladrillo': ['Blocks', 'Construction'],
  'contenedor': ['Container', 'Box'],
  'caja': ['Box', 'Package', 'Archive', 'Boxes'],
  'enchufe': ['Plug', 'Power'],
  'termometro': ['Thermometer'],
  'agua': ['Droplets', 'GlassWater', 'Waves'],
  'gota': ['Droplets'],

  // ── Transporte y logística ──
  'camion': ['Truck'],
  'auto': ['Car'],
  'coche': ['Car'],
  'vehiculo': ['Car', 'Truck', 'Bus'],
  'bus': ['Bus'],
  'bicicleta': ['Bike'],
  'barco': ['Ship', 'Anchor'],
  'avion': ['Plane'],
  'transporte': ['Truck', 'Car', 'Bus', 'Ship', 'Plane'],
  'paquete': ['Package', 'PackageCheck', 'PackageOpen', 'PackageSearch'],
  'envio': ['Truck', 'Package', 'Send'],
  'logistica': ['Truck', 'Package', 'Route', 'Map'],
  'mapa': ['Map', 'MapPin', 'Navigation'],
  'ubicacion': ['MapPin', 'Navigation', 'Compass'],
  'direccion': ['MapPin', 'Navigation', 'Signpost'],
  'ruta': ['Route', 'Navigation', 'Map', 'Milestone'],
  'combustible': ['Fuel'],
  'gasolina': ['Fuel'],
  'ancla': ['Anchor'],

  // ── Tecnología ──
  'computadora': ['Monitor', 'Laptop', 'Cpu'],
  'pantalla': ['Monitor', 'Tv'],
  'codigo': ['Code', 'Terminal', 'Braces'],
  'programacion': ['Code', 'Terminal', 'Binary'],
  'servidor': ['Server', 'Database', 'HardDrive'],
  'base de datos': ['Database'],
  'datos': ['Database', 'Server'],
  'nube': ['Cloud'],
  'internet': ['Globe', 'Wifi'],
  'web': ['Globe', 'Globe2', 'Link'],
  'enlace': ['Link', 'ExternalLink'],
  'qr': ['QrCode'],
  'robot': ['Bot', 'BrainCircuit'],
  'inteligencia artificial': ['BrainCircuit', 'Bot', 'Cpu'],
  'ia': ['BrainCircuit', 'Bot'],

  // ── Salud y bienestar ──
  'salud': ['Heart', 'Activity', 'Stethoscope', 'HeartPulse'],
  'medicina': ['Stethoscope', 'Pill', 'Heart', 'Syringe'],
  'doctor': ['Stethoscope', 'Hospital'],
  'medico': ['Stethoscope', 'Hospital', 'ShieldPlus'],
  'hospital': ['Hospital', 'Cross', 'Ambulance'],
  'ambulancia': ['Ambulance'],
  'pastilla': ['Pill'],
  'vacuna': ['Syringe'],
  'jeringa': ['Syringe'],
  'ejercicio': ['Dumbbell', 'PersonStanding'],
  'deporte': ['Dumbbell', 'Trophy', 'Medal'],
  'gym': ['Dumbbell'],
  'manzana': ['Apple'],
  'veterinaria': ['PawPrint', 'Dog', 'Cat', 'Stethoscope'],
  'mascota': ['PawPrint', 'Dog', 'Cat', 'Rabbit'],
  'perro': ['Dog', 'PawPrint'],
  'gato': ['Cat', 'PawPrint'],

  // ── Educación ──
  'educacion': ['GraduationCap', 'BookOpen', 'School'],
  'libro': ['BookOpen', 'Book', 'Library'],
  'escuela': ['School', 'GraduationCap'],
  'universidad': ['GraduationCap', 'Library'],
  'idea': ['Lightbulb', 'Sparkles'],
  'luz': ['Lightbulb', 'Sun', 'Lamp'],
  'foco': ['Lightbulb'],
  'microscopio': ['Microscope'],
  'ciencia': ['FlaskConical', 'TestTube', 'Atom', 'Microscope'],
  'laboratorio': ['FlaskConical', 'TestTube', 'Microscope'],
  'quimica': ['FlaskConical', 'TestTube', 'Atom'],
  'telescopio': ['Telescope'],
  'cuaderno': ['NotebookPen', 'BookOpen'],

  // ── Alimentos y gastronomía ──
  'comida': ['UtensilsCrossed', 'ChefHat', 'CookingPot', 'Pizza'],
  'restaurante': ['UtensilsCrossed', 'ChefHat', 'Store'],
  'cocina': ['UtensilsCrossed', 'ChefHat', 'CookingPot'],
  'chef': ['ChefHat', 'UtensilsCrossed'],
  'cubiertos': ['UtensilsCrossed'],
  'cafe': ['Coffee'],
  'vino': ['Wine'],
  'cerveza': ['Beer'],
  'bebida': ['GlassWater', 'Coffee', 'Wine', 'Beer', 'Cup'],
  'helado': ['IceCream'],
  'torta': ['Cake'],
  'pizza': ['Pizza'],
  'panaderia': ['Wheat', 'Cake', 'ChefHat'],
  'trigo': ['Wheat'],

  // ── Naturaleza y campo ──
  'arbol': ['TreePine', 'Trees'],
  'planta': ['Flower', 'Leaf', 'Sprout', 'Clover'],
  'flor': ['Flower', 'Flower2', 'Cherry'],
  'hoja': ['Leaf', 'Clover'],
  'naturaleza': ['TreePine', 'Trees', 'Mountain', 'Leaf'],
  'sol': ['Sun', 'CloudSun'],
  'luna': ['Moon'],
  'clima': ['CloudSun', 'Sun', 'Snowflake', 'Wind'],
  'lluvia': ['CloudRain', 'Droplets'],
  'nieve': ['Snowflake'],
  'viento': ['Wind'],
  'montana': ['Mountain', 'MountainSnow'],
  'campo': ['Tractor', 'Fence', 'TreePine', 'Wheat', 'Sprout'],
  'agricultura': ['Tractor', 'Wheat', 'Sprout', 'Leaf', 'Fence'],
  'granja': ['Tractor', 'Fence', 'Wheat', 'Barn'],
  'tractor': ['Tractor'],
  'jardin': ['Flower', 'Flower2', 'Leaf', 'Sprout', 'Trees'],
  'jardineria': ['Flower', 'Leaf', 'Shovel', 'Sprout'],
  'camping': ['Tent', 'Mountain', 'Compass'],
  'animal': ['PawPrint', 'Dog', 'Cat', 'Bird', 'Fish', 'Bug', 'Rabbit'],
  'insecto': ['Bug'],
  'pajaro': ['Bird'],
  'pez': ['Fish'],
  'oceano': ['Waves', 'Fish', 'Anchor', 'Ship'],
  'mar': ['Waves', 'Fish', 'Anchor'],
  'olas': ['Waves'],

  // ── Seguridad ──
  'seguridad': ['Shield', 'Lock', 'ShieldCheck', 'Key'],
  'escudo': ['Shield', 'ShieldCheck', 'ShieldAlert'],
  'candado': ['Lock', 'Unlock'],
  'ojo': ['Eye', 'EyeOff'],
  'ver': ['Eye'],
  'ocultar': ['EyeOff'],
  'huella': ['Fingerprint'],
  'prohibido': ['Ban', 'ShieldOff'],

  // ── Tiempo y calendario ──
  'reloj': ['Clock', 'Timer', 'Watch', 'AlarmClock'],
  'hora': ['Clock', 'Timer'],
  'tiempo': ['Clock', 'Timer', 'Hourglass'],
  'calendario': ['Calendar', 'CalendarDays', 'CalendarCheck', 'CalendarClock'],
  'fecha': ['Calendar', 'CalendarDays'],
  'agenda': ['Calendar', 'CalendarDays', 'CalendarClock'],
  'historial': ['History', 'TimerReset'],
  'cronometro': ['Stopwatch', 'Timer'],

  // ── Media y creatividad ──
  'foto': ['Camera', 'Image'],
  'camara': ['Camera', 'Video'],
  'imagen': ['Image', 'Camera'],
  'pelicula': ['Film', 'Clapperboard'],
  'video': ['Video', 'Film', 'Clapperboard', 'MonitorPlay'],
  'musica': ['Music', 'Headphones', 'Mic'],
  'auriculares': ['Headphones'],
  'microfono': ['Mic'],
  'arte': ['Palette', 'Brush', 'PaintBucket'],
  'color': ['Palette', 'Brush', 'Pipette'],
  'diseno': ['Palette', 'Pen', 'Shapes', 'Figma'],
  'tipografia': ['Type'],
  'forma': ['Shapes', 'Circle', 'Square', 'Triangle', 'Hexagon'],
  'circulo': ['Circle'],
  'cuadrado': ['Square'],
  'triangulo': ['Triangle'],

  // ── Viaje y ocio ──
  'viaje': ['Plane', 'Luggage', 'Globe', 'Map', 'Compass'],
  'hotel': ['Hotel', 'Bed'],
  'equipaje': ['Luggage'],
  'maleta': ['Luggage', 'Briefcase'],
  'turismo': ['Plane', 'Globe', 'Map', 'Palmtree'],
  'palmera': ['Palmtree'],
  'paraguas': ['Umbrella'],
  'ticket': ['Ticket'],
  'entrada': ['Ticket'],
  'juego': ['Gamepad2', 'Dice5', 'Puzzle'],
  'dado': ['Dice5'],
  'rompecabezas': ['Puzzle'],
  'teatro': ['Drama'],

  // ── Acciones comunes ──
  'agregar': ['Plus', 'PlusCircle'],
  'nuevo': ['Plus', 'PlusCircle', 'FilePlus'],
  'eliminar': ['Trash2', 'X', 'XCircle'],
  'basura': ['Trash2'],
  'editar': ['Pencil', 'PenLine'],
  'guardar': ['Save', 'Download'],
  'descargar': ['Download', 'ArrowDown'],
  'subir': ['Upload', 'ArrowUp'],
  'compartir': ['Share', 'Share2', 'Forward'],
  'buscar': ['Search', 'SearchCheck'],
  'busqueda': ['Search'],
  'lupa': ['Search'],
  'informacion': ['Info', 'HelpCircle'],
  'ayuda': ['HelpCircle', 'Info', 'LifeBuoy'],
  'exito': ['CheckCircle', 'Check', 'ThumbsUp'],
  'error': ['XCircle', 'AlertCircle', 'X'],
  'flecha': ['ArrowRight', 'ArrowUp', 'ArrowDown', 'MoveRight'],

  // ── Roles y áreas ──
  'soporte': ['HeadphonesIcon', 'LifeBuoy', 'HelpCircle', 'Headphones'],
  'marketing': ['Megaphone', 'TrendingUp', 'BarChart3'],
  'publicidad': ['Megaphone', 'Newspaper'],
  'recursos humanos': ['Users', 'UserCog', 'Briefcase'],
  'legal': ['Scale', 'Gavel', 'FileText'],
  'contabilidad': ['Calculator', 'DollarSign', 'FileText'],
  'peluqueria': ['Scissors', 'Brush'],
  'estetica': ['Scissors', 'Sparkles', 'Heart'],
  'belleza': ['Scissors', 'Sparkles', 'Heart'],
  'limpieza': ['Sparkles', 'Droplets', 'SprayCan'],
  'mudanza': ['Truck', 'Package', 'Box', 'Boxes'],
  'inmobiliaria': ['Building', 'Building2', 'Home', 'Key'],
  'casa': ['House', 'Home'],
  'hogar': ['House', 'Home'],
  'inicio': ['Home', 'House'],
  'cohete': ['Rocket'],
  'lanzamiento': ['Rocket', 'Send'],
  'bandera': ['Flag', 'FlagTriangleRight'],
  'actividad': ['Activity', 'Pulse'],
  'velocidad': ['Gauge', 'Zap'],
  'indicador': ['Gauge', 'Activity'],

  // ── PT (portugués) ──
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
  'ferramenta': ['Wrench', 'Hammer', 'Settings'],
  'cozinha': ['UtensilsCrossed', 'ChefHat', 'CookingPot'],
  'arvore': ['TreePine', 'Trees'],
  'fazenda': ['Tractor', 'Fence', 'Wheat'],
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
  const [busqueda, setBusqueda] = useState('')
  const contenedorRef = useRef<HTMLDivElement>(null)
  const botonRef = useRef<HTMLButtonElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const [posicion, setPosicion] = useState({ top: 0, left: 0, width: 0 })

  // Calcular posición del dropdown relativa al viewport
  useLayoutEffect(() => {
    if (!abierto || !botonRef.current) return
    const rect = botonRef.current.getBoundingClientRect()
    setPosicion({ top: rect.bottom + 4, left: rect.left, width: rect.width })
  }, [abierto])

  // Cerrar al hacer click afuera
  useEffect(() => {
    if (!abierto) return
    const handler = (e: MouseEvent) => {
      const target = e.target as Node
      if (contenedorRef.current?.contains(target)) return
      if (dropdownRef.current?.contains(target)) return
      setAbierto(false)
      setBusqueda('')
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [abierto])

  // Reposicionar al hacer scroll o resize
  useEffect(() => {
    if (!abierto) return
    const handler = () => {
      if (botonRef.current) {
        const rect = botonRef.current.getBoundingClientRect()
        setPosicion({ top: rect.bottom + 4, left: rect.left, width: rect.width })
      }
    }
    window.addEventListener('scroll', handler, true)
    window.addEventListener('resize', handler)
    return () => {
      window.removeEventListener('scroll', handler, true)
      window.removeEventListener('resize', handler)
    }
  }, [abierto])

  // Auto-focus buscador al abrir
  useEffect(() => {
    if (abierto) {
      requestAnimationFrame(() => inputRef.current?.focus())
    }
  }, [abierto])

  // Íconos filtrados — busca en nombre inglés + traducciones ES/PT
  const iconosFiltrados = useMemo(() => {
    if (!busqueda) return null // null = mostrar categorías

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
    const todos = obtenerTodosLosIconos()
    const desdeNombre = todos.filter(nombre =>
      nombre.toLowerCase().includes(busquedaLower)
    )

    // Combinar: traducciones primero, después por nombre, sin duplicados
    const resultado = [...desdeTraduccion]
    for (const nombre of desdeNombre) {
      if (!desdeTraduccion.has(nombre)) resultado.push(nombre)
    }

    return resultado
  }, [busqueda])

  const IconoActual = obtenerIcono(valor)

  const renderGridIconos = (nombres: string[]) => (
    <div className="grid grid-cols-8 gap-1">
      {nombres.map(nombre => {
        const Icono = obtenerIcono(nombre)
        if (!Icono) return null
        const seleccionado = valor === nombre
        return (
          <Tooltip key={nombre} contenido={nombre}>
            <button
              onClick={() => { onChange(nombre); setAbierto(false); setBusqueda('') }}
              className={[
                'w-8 h-8 rounded-md flex items-center justify-center transition-all cursor-pointer border-none',
                seleccionado
                  ? 'bg-texto-marca/20 text-texto-marca ring-1 ring-texto-marca'
                  : 'bg-transparent text-texto-secundario hover:bg-superficie-hover hover:text-texto-primario',
              ].join(' ')}
            >
              <Icono size={16} />
            </button>
          </Tooltip>
        )
      })}
    </div>
  )

  return (
    <div ref={contenedorRef} className="relative">
      {etiqueta && (
        <label className="text-sm font-medium text-texto-secundario block mb-1">{etiqueta}</label>
      )}

      {/* Botón que muestra el ícono actual */}
      <button
        ref={botonRef}
        onClick={() => setAbierto(!abierto)}
        className="flex items-center gap-2 px-3 py-2 rounded-md border border-borde-fuerte bg-superficie-tarjeta hover:bg-superficie-hover transition-colors cursor-pointer text-sm text-texto-primario w-full"
      >
        <div className="w-7 h-7 rounded-md bg-superficie-hover flex items-center justify-center shrink-0">
          {IconoActual ? <IconoActual size={tamano} className="text-texto-marca" /> : <span className="text-xs text-texto-terciario">?</span>}
        </div>
        <span className="flex-1 text-left text-texto-secundario truncate">{valor || 'Seleccionar ícono'}</span>
        <ChevronDown size={14} className={`text-texto-terciario transition-transform ${abierto ? 'rotate-180' : ''}`} />
      </button>

      {/* Dropdown — portal para evitar clipping en modales */}
      {typeof window !== 'undefined' && createPortal(
      <AnimatePresence>
        {abierto && (
          <motion.div
            ref={dropdownRef}
            initial={{ opacity: 0, y: 4, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 4, scale: 0.97 }}
            transition={{ duration: 0.12 }}
            className="fixed border border-borde-sutil rounded-xl shadow-lg overflow-hidden bg-superficie-elevada"
            style={{
              top: posicion.top,
              left: posicion.left,
              width: Math.max(posicion.width, 340),
              zIndex: 'var(--z-popover)' as unknown as number,
            }}
          >
            {/* Buscador — siempre visible */}
            <div className="p-2 border-b border-borde-sutil">
              <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-md bg-superficie-tarjeta border border-borde-fuerte">
                <Search size={14} className="text-texto-terciario shrink-0" />
                <input
                  ref={inputRef}
                  type="text"
                  placeholder="Buscar ícono... (ej: martillo, cocina, campo)"
                  value={busqueda}
                  onChange={(e) => setBusqueda(e.target.value)}
                  className="flex-1 bg-transparent border-none outline-none text-sm text-texto-primario placeholder:text-texto-placeholder"
                />
              </div>
            </div>

            {/* Contenido */}
            <div className="p-2 overflow-y-auto max-h-72">
              {iconosFiltrados !== null ? (
                // Modo búsqueda: lista plana de resultados
                iconosFiltrados.length === 0 ? (
                  <p className="text-xs text-texto-terciario text-center py-4">No se encontraron íconos para &ldquo;{busqueda}&rdquo;</p>
                ) : (
                  renderGridIconos(iconosFiltrados.slice(0, 500))
                )
              ) : (
                // Modo categorías
                <div className="space-y-3">
                  {CATEGORIAS_ICONOS.map(cat => (
                    <div key={cat.nombre}>
                      <p className="text-xxs font-semibold text-texto-terciario uppercase tracking-wider mb-1.5 px-1">
                        {cat.nombre}
                      </p>
                      {renderGridIconos(cat.iconos)}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>,
      document.body
      )}
    </div>
  )
}

export { SelectorIcono, obtenerIcono, obtenerTodosLosIconos }
