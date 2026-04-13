/**
 * ╔══════════════════════════════════════════════════════════════════╗
 * ║  REGISTRO DE VARIABLES DINÁMICAS — Flux by Salix               ║
 * ╠══════════════════════════════════════════════════════════════════╣
 * ║                                                                ║
 * ║  Este archivo es LA FUENTE DE VERDAD de todas las variables    ║
 * ║  disponibles en el SelectorVariables (el popover con {{...}}). ║
 * ║                                                                ║
 * ║  Cada vez que se agrega una tabla o campo al schema de         ║
 * ║  Drizzle, se debe agregar aquí para que aparezca               ║
 * ║  automáticamente en el selector de variables de toda la app.   ║
 * ║                                                                ║
 * ╠══════════════════════════════════════════════════════════════════╣
 * ║  CÓMO AGREGAR UNA VARIABLE NUEVA A UNA ENTIDAD EXISTENTE:     ║
 * ║                                                                ║
 * ║  Buscar la entidad (ej: 'contacto') y agregar al array:       ║
 * ║                                                                ║
 * ║  { clave: 'rubro',                    ← nombre en BD/código   ║
 * ║    etiqueta: 'Rubro o industria',     ← lo que ve el usuario  ║
 * ║    tipo_dato: 'texto',                ← texto/moneda/fecha... ║
 * ║    origen: 'columna',                 ← columna/calculado     ║
 * ║    grupo: 'basico' }                  ← grupo visual          ║
 * ║                                                                ║
 * ╠══════════════════════════════════════════════════════════════════╣
 * ║  CÓMO AGREGAR UNA ENTIDAD NUEVA (tabla nueva):                ║
 * ║                                                                ║
 * ║  registrarEntidad({                                            ║
 * ║    clave: 'mi_entidad',          ← clave única                ║
 * ║    etiqueta: 'Mi Entidad',       ← nombre en español          ║
 * ║    icono: icono(LucideIcon),     ← ícono de Lucide            ║
 * ║    variables: [ ... ]            ← array de variables          ║
 * ║  })                                                            ║
 * ║                                                                ║
 * ╠══════════════════════════════════════════════════════════════════╣
 * ║  TIPOS DE DATO (tipo_dato):                                   ║
 * ║  'texto' | 'numero' | 'moneda' | 'porcentaje' | 'fecha'      ║
 * ║  'fecha_hora' | 'booleano' | 'email' | 'telefono' | 'url'    ║
 * ║                                                                ║
 * ║  ORÍGENES (origen):                                           ║
 * ║  'columna'   → campo directo de la tabla en BD                ║
 * ║  'calculado'  → se calcula con función (agregar calcular:)    ║
 * ║  'relacion'   → viene de tabla relacionada (JOIN)             ║
 * ║                                                                ║
 * ║  GRUPOS (grupo): agrupa visualmente en el selector            ║
 * ║  'basico' | 'contacto' | 'ubicacion' | 'financiero'          ║
 * ║  'fechas' | 'estado' | 'pagos' | 'detalles' | 'relacion'    ║
 * ║                                                                ║
 * ╠══════════════════════════════════════════════════════════════════╣
 * ║  USO EN PLANTILLAS:                                           ║
 * ║  {{contacto.nombre}}  →  "Juan"                               ║
 * ║  {{presupuesto.total_con_iva}}  →  "$ 150.000,00"            ║
 * ║  {{fecha.hoy}}  →  "26/03/2026"                               ║
 * ║                                                                ║
 * ║  ACTIVAR EN LA APP:                                           ║
 * ║  import '@/lib/variables/entidades' (en layout.tsx o similar) ║
 * ╚══════════════════════════════════════════════════════════════════╝
 */

import { createElement } from 'react'
import {
  User, UserCheck, Building2, FileText, Package, CalendarDays,
  MapPin, MessageSquare, Clock, Briefcase, Receipt, DollarSign,
  BarChart3, Settings, Globe,
} from 'lucide-react'
import { registrarEntidad } from './registro'
import type { DefinicionVariable } from './tipos'

// Helper para crear ícono como ReactNode
const icono = (componente: React.ElementType) => createElement(componente, { size: 16 })

// ─────────────────────────────────────────────────────
// CONTACTO — Datos del contacto (cliente, proveedor, etc.)
// ─────────────────────────────────────────────────────
registrarEntidad({
  clave: 'contacto',
  etiqueta: 'Contacto',
  icono: icono(User),
  variables: [
    // Básico
    { clave: 'nombre', etiqueta: 'Nombre', tipo_dato: 'texto', origen: 'columna', grupo: 'basico' },
    { clave: 'apellido', etiqueta: 'Apellido', tipo_dato: 'texto', origen: 'columna', grupo: 'basico' },
    { clave: 'nombre_completo', etiqueta: 'Nombre completo', descripcion: 'Nombre y apellido', tipo_dato: 'texto', origen: 'calculado', grupo: 'basico',
      calcular: (d) => [d.nombre, d.apellido].filter(Boolean).join(' ') },
    { clave: 'codigo', etiqueta: 'Código', descripcion: 'Código secuencial (C-0001)', tipo_dato: 'texto', origen: 'columna', grupo: 'basico' },
    { clave: 'tipo', etiqueta: 'Tipo', descripcion: 'cliente, proveedor, prospecto, etc.', tipo_dato: 'texto', origen: 'columna', grupo: 'basico' },
    { clave: 'etapa', etiqueta: 'Etapa', descripcion: 'Etapa del pipeline', tipo_dato: 'texto', origen: 'columna', grupo: 'basico' },

    // Contacto
    { clave: 'correo', etiqueta: 'Correo electrónico', tipo_dato: 'email', origen: 'columna', grupo: 'contacto' },
    { clave: 'telefono', etiqueta: 'Teléfono', tipo_dato: 'telefono', origen: 'columna', grupo: 'contacto' },
    { clave: 'whatsapp', etiqueta: 'WhatsApp', tipo_dato: 'telefono', origen: 'columna', grupo: 'contacto' },

    // Identificación
    { clave: 'cuit', etiqueta: 'CUIT', tipo_dato: 'texto', origen: 'columna', grupo: 'detalles' },
    { clave: 'dni', etiqueta: 'DNI', tipo_dato: 'texto', origen: 'columna', grupo: 'detalles' },

    // Ubicación (dirección principal)
    { clave: 'calle', etiqueta: 'Calle', tipo_dato: 'texto', origen: 'columna', grupo: 'ubicacion' },
    { clave: 'numero', etiqueta: 'Número', tipo_dato: 'texto', origen: 'columna', grupo: 'ubicacion' },
    { clave: 'piso', etiqueta: 'Piso / Dpto', tipo_dato: 'texto', origen: 'columna', grupo: 'ubicacion' },
    { clave: 'barrio', etiqueta: 'Barrio', tipo_dato: 'texto', origen: 'columna', grupo: 'ubicacion' },
    { clave: 'ciudad', etiqueta: 'Ciudad', tipo_dato: 'texto', origen: 'columna', grupo: 'ubicacion' },
    { clave: 'provincia', etiqueta: 'Provincia', tipo_dato: 'texto', origen: 'columna', grupo: 'ubicacion' },
    { clave: 'pais', etiqueta: 'País', tipo_dato: 'texto', origen: 'columna', grupo: 'ubicacion' },
    { clave: 'codigo_postal', etiqueta: 'Código postal', tipo_dato: 'texto', origen: 'columna', grupo: 'ubicacion' },
    { clave: 'direccion_completa', etiqueta: 'Dirección completa', descripcion: 'Calle, número, ciudad, provincia', tipo_dato: 'texto', origen: 'calculado', grupo: 'ubicacion',
      calcular: (d) => [d.calle, d.numero, d.piso, d.barrio, d.ciudad, d.provincia, d.codigo_postal].filter(Boolean).join(', ') },

    // Relación
    { clave: 'empresa_nombre', etiqueta: 'Empresa del contacto', descripcion: 'Nombre de la empresa a la que pertenece', tipo_dato: 'texto', origen: 'relacion', grupo: 'relacion' },
    { clave: 'empresa_cuit', etiqueta: 'CUIT de la empresa', tipo_dato: 'texto', origen: 'relacion', grupo: 'relacion' },

    // Fechas
    { clave: 'creado_en', etiqueta: 'Fecha de creación', tipo_dato: 'fecha', origen: 'columna', grupo: 'fechas' },
  ],
})

// ─────────────────────────────────────────────────────
// EMPRESA — Datos de la empresa (tenant)
// ─────────────────────────────────────────────────────
registrarEntidad({
  clave: 'empresa',
  etiqueta: 'Empresa',
  icono: icono(Building2),
  variables: [
    { clave: 'nombre', etiqueta: 'Nombre de la empresa', tipo_dato: 'texto', origen: 'columna', grupo: 'basico' },
    { clave: 'slug', etiqueta: 'Slug', descripcion: 'Subdominio de la empresa', tipo_dato: 'texto', origen: 'columna', grupo: 'basico' },
    { clave: 'pais', etiqueta: 'País', tipo_dato: 'texto', origen: 'columna', grupo: 'basico' },
    { clave: 'logo_url', etiqueta: 'URL del logo', tipo_dato: 'url', origen: 'columna', grupo: 'basico' },
    { clave: 'correo_contacto', etiqueta: 'Correo de contacto', tipo_dato: 'email', origen: 'columna', grupo: 'contacto' },
    { clave: 'telefono', etiqueta: 'Teléfono', tipo_dato: 'telefono', origen: 'columna', grupo: 'contacto' },
    { clave: 'direccion', etiqueta: 'Dirección', tipo_dato: 'texto', origen: 'columna', grupo: 'ubicacion' },
    { clave: 'cuit', etiqueta: 'CUIT', tipo_dato: 'texto', origen: 'columna', grupo: 'detalles' },
    { clave: 'razon_social', etiqueta: 'Razón social', tipo_dato: 'texto', origen: 'columna', grupo: 'detalles' },
    { clave: 'sitio_web', etiqueta: 'Sitio web', tipo_dato: 'url', origen: 'columna', grupo: 'contacto' },
  ],
})

// ─────────────────────────────────────────────────────
// PRESUPUESTO — Datos del presupuesto/cotización
// ─────────────────────────────────────────────────────
registrarEntidad({
  clave: 'presupuesto',
  etiqueta: 'Presupuesto',
  icono: icono(FileText),
  variables: [
    // Básico
    { clave: 'numero', etiqueta: 'Número', descripcion: 'Número formateado (PRE-2026-00001)', tipo_dato: 'texto', origen: 'columna', grupo: 'basico' },
    { clave: 'estado', etiqueta: 'Estado', descripcion: 'borrador, enviado, confirmado, etc.', tipo_dato: 'texto', origen: 'columna', grupo: 'basico' },

    // Financiero
    { clave: 'total_neto', etiqueta: 'Total neto (sin IVA)', tipo_dato: 'moneda', origen: 'columna', grupo: 'financiero' },
    { clave: 'total_impuestos', etiqueta: 'Total impuestos', tipo_dato: 'moneda', origen: 'columna', grupo: 'financiero' },
    { clave: 'total_con_iva', etiqueta: 'Total con IVA', tipo_dato: 'moneda', origen: 'calculado', grupo: 'financiero',
      calcular: (d) => (Number(d.total_neto) || 0) + (Number(d.total_impuestos) || 0) },
    { clave: 'moneda', etiqueta: 'Moneda', tipo_dato: 'texto', origen: 'columna', grupo: 'financiero' },
    { clave: 'descuento_total', etiqueta: 'Descuento total', tipo_dato: 'moneda', origen: 'columna', grupo: 'financiero' },

    // Pagos e hitos
    { clave: 'porcentaje_adelanto', etiqueta: 'Porcentaje adelanto', tipo_dato: 'porcentaje', origen: 'columna', grupo: 'pagos' },
    { clave: 'monto_adelanto', etiqueta: 'Monto adelanto', descripcion: 'Calculado según % sobre el total', tipo_dato: 'moneda', origen: 'calculado', grupo: 'pagos',
      calcular: (d) => ((Number(d.total_neto) || 0) + (Number(d.total_impuestos) || 0)) * ((Number(d.porcentaje_adelanto) || 0) / 100) },
    { clave: 'monto_restante', etiqueta: 'Monto restante', descripcion: 'Total menos adelanto', tipo_dato: 'moneda', origen: 'calculado', grupo: 'pagos',
      calcular: (d) => {
        const total = (Number(d.total_neto) || 0) + (Number(d.total_impuestos) || 0)
        const adelanto = total * ((Number(d.porcentaje_adelanto) || 0) / 100)
        return total - adelanto
      } },
    { clave: 'pagado', etiqueta: 'Total pagado', tipo_dato: 'moneda', origen: 'columna', grupo: 'pagos' },
    { clave: 'saldo_pendiente', etiqueta: 'Saldo pendiente', descripcion: 'Total menos lo pagado', tipo_dato: 'moneda', origen: 'calculado', grupo: 'pagos',
      calcular: (d) => ((Number(d.total_neto) || 0) + (Number(d.total_impuestos) || 0)) - (Number(d.pagado) || 0) },
    { clave: 'cantidad_hitos', etiqueta: 'Cantidad de hitos de pago', tipo_dato: 'numero', origen: 'columna', grupo: 'pagos' },

    // Notas y condiciones
    { clave: 'notas', etiqueta: 'Notas', tipo_dato: 'texto', origen: 'columna', grupo: 'detalles' },
    { clave: 'terminos_condiciones', etiqueta: 'Términos y condiciones', tipo_dato: 'texto', origen: 'columna', grupo: 'detalles' },

    // Fechas
    { clave: 'fecha_emision', etiqueta: 'Fecha de emisión', tipo_dato: 'fecha', origen: 'columna', grupo: 'fechas' },
    { clave: 'fecha_vencimiento', etiqueta: 'Fecha de vencimiento', tipo_dato: 'fecha', origen: 'columna', grupo: 'fechas' },

    // Relación
    { clave: 'contacto_nombre', etiqueta: 'Nombre del cliente', tipo_dato: 'texto', origen: 'relacion', grupo: 'relacion' },
    { clave: 'contacto_correo', etiqueta: 'Correo del cliente', tipo_dato: 'email', origen: 'relacion', grupo: 'relacion' },
    { clave: 'contacto_telefono', etiqueta: 'Teléfono del cliente', tipo_dato: 'telefono', origen: 'relacion', grupo: 'relacion' },
  ],
})

// ─────────────────────────────────────────────────────
// DIRIGIDO A — Contacto vinculado / persona de atención en documentos
// Tiene todas las variables de un contacto + cargo
// ─────────────────────────────────────────────────────
registrarEntidad({
  clave: 'dirigido_a',
  etiqueta: 'Dirigido a',
  icono: icono(UserCheck),
  variables: [
    // Básico
    { clave: 'nombre', etiqueta: 'Nombre', tipo_dato: 'texto', origen: 'relacion', grupo: 'basico' },
    { clave: 'apellido', etiqueta: 'Apellido', tipo_dato: 'texto', origen: 'relacion', grupo: 'basico' },
    { clave: 'nombre_completo', etiqueta: 'Nombre completo', tipo_dato: 'texto', origen: 'calculado', grupo: 'basico',
      calcular: (d) => [d.nombre, d.apellido].filter(Boolean).join(' ') },
    { clave: 'cargo', etiqueta: 'Cargo / Puesto', tipo_dato: 'texto', origen: 'relacion', grupo: 'basico' },

    // Contacto
    { clave: 'correo', etiqueta: 'Correo electrónico', tipo_dato: 'email', origen: 'relacion', grupo: 'contacto' },
    { clave: 'telefono', etiqueta: 'Teléfono', tipo_dato: 'telefono', origen: 'relacion', grupo: 'contacto' },
    { clave: 'whatsapp', etiqueta: 'WhatsApp', tipo_dato: 'telefono', origen: 'relacion', grupo: 'contacto' },

    // Identificación
    { clave: 'cuit', etiqueta: 'CUIT', tipo_dato: 'texto', origen: 'relacion', grupo: 'detalles' },
    { clave: 'dni', etiqueta: 'DNI', tipo_dato: 'texto', origen: 'relacion', grupo: 'detalles' },

    // Ubicación
    { clave: 'direccion_completa', etiqueta: 'Dirección completa', tipo_dato: 'texto', origen: 'calculado', grupo: 'ubicacion',
      calcular: (d) => [d.calle, d.numero, d.piso, d.barrio, d.ciudad, d.provincia, d.codigo_postal].filter(Boolean).join(', ') },
    { clave: 'ciudad', etiqueta: 'Ciudad', tipo_dato: 'texto', origen: 'relacion', grupo: 'ubicacion' },
    { clave: 'provincia', etiqueta: 'Provincia', tipo_dato: 'texto', origen: 'relacion', grupo: 'ubicacion' },

    // Relación
    { clave: 'empresa_nombre', etiqueta: 'Empresa vinculada', tipo_dato: 'texto', origen: 'relacion', grupo: 'relacion' },
  ],
})

// ─────────────────────────────────────────────────────
// FACTURA — Datos de factura (hereda mucho de presupuesto)
// ─────────────────────────────────────────────────────
registrarEntidad({
  clave: 'factura',
  etiqueta: 'Factura',
  icono: icono(Receipt),
  variables: [
    { clave: 'numero', etiqueta: 'Número', tipo_dato: 'texto', origen: 'columna', grupo: 'basico' },
    { clave: 'estado', etiqueta: 'Estado', tipo_dato: 'texto', origen: 'columna', grupo: 'basico' },
    { clave: 'letra_comprobante', etiqueta: 'Letra comprobante', descripcion: 'A, B o C', tipo_dato: 'texto', origen: 'columna', grupo: 'basico' },
    { clave: 'punto_venta', etiqueta: 'Punto de venta', tipo_dato: 'texto', origen: 'columna', grupo: 'basico' },

    { clave: 'total_neto', etiqueta: 'Total neto (sin IVA)', tipo_dato: 'moneda', origen: 'columna', grupo: 'financiero' },
    { clave: 'total_impuestos', etiqueta: 'Total impuestos', tipo_dato: 'moneda', origen: 'columna', grupo: 'financiero' },
    { clave: 'total_con_iva', etiqueta: 'Total con IVA', tipo_dato: 'moneda', origen: 'calculado', grupo: 'financiero',
      calcular: (d) => (Number(d.total_neto) || 0) + (Number(d.total_impuestos) || 0) },
    { clave: 'moneda', etiqueta: 'Moneda', tipo_dato: 'texto', origen: 'columna', grupo: 'financiero' },

    { clave: 'pagado', etiqueta: 'Total pagado', tipo_dato: 'moneda', origen: 'columna', grupo: 'pagos' },
    { clave: 'saldo_pendiente', etiqueta: 'Saldo pendiente', tipo_dato: 'moneda', origen: 'calculado', grupo: 'pagos',
      calcular: (d) => ((Number(d.total_neto) || 0) + (Number(d.total_impuestos) || 0)) - (Number(d.pagado) || 0) },

    { clave: 'fecha_emision', etiqueta: 'Fecha de emisión', tipo_dato: 'fecha', origen: 'columna', grupo: 'fechas' },
    { clave: 'fecha_vencimiento', etiqueta: 'Fecha de vencimiento', tipo_dato: 'fecha', origen: 'columna', grupo: 'fechas' },

    { clave: 'cuit_emisor', etiqueta: 'CUIT emisor', tipo_dato: 'texto', origen: 'columna', grupo: 'detalles' },
    { clave: 'cuit_receptor', etiqueta: 'CUIT receptor', tipo_dato: 'texto', origen: 'columna', grupo: 'detalles' },
    { clave: 'notas', etiqueta: 'Notas', tipo_dato: 'texto', origen: 'columna', grupo: 'detalles' },

    { clave: 'contacto_nombre', etiqueta: 'Nombre del cliente', tipo_dato: 'texto', origen: 'relacion', grupo: 'relacion' },
    { clave: 'contacto_correo', etiqueta: 'Correo del cliente', tipo_dato: 'email', origen: 'relacion', grupo: 'relacion' },
  ],
})

// ─────────────────────────────────────────────────────
// PRODUCTO — Datos del producto
// ─────────────────────────────────────────────────────
registrarEntidad({
  clave: 'producto',
  etiqueta: 'Producto',
  icono: icono(Package),
  variables: [
    { clave: 'nombre', etiqueta: 'Nombre', tipo_dato: 'texto', origen: 'columna', grupo: 'basico' },
    { clave: 'codigo', etiqueta: 'Código', tipo_dato: 'texto', origen: 'columna', grupo: 'basico' },
    { clave: 'descripcion', etiqueta: 'Descripción', tipo_dato: 'texto', origen: 'columna', grupo: 'basico' },
    { clave: 'categoria', etiqueta: 'Categoría', tipo_dato: 'texto', origen: 'columna', grupo: 'basico' },
    { clave: 'subcategoria', etiqueta: 'Subcategoría', tipo_dato: 'texto', origen: 'columna', grupo: 'basico' },

    { clave: 'precio_costo', etiqueta: 'Precio de costo', tipo_dato: 'moneda', origen: 'columna', grupo: 'financiero' },
    { clave: 'precio_venta', etiqueta: 'Precio de venta', tipo_dato: 'moneda', origen: 'columna', grupo: 'financiero' },
    { clave: 'margen', etiqueta: 'Margen de ganancia', tipo_dato: 'porcentaje', origen: 'calculado', grupo: 'financiero',
      calcular: (d) => {
        const costo = Number(d.precio_costo) || 0
        const venta = Number(d.precio_venta) || 0
        if (costo === 0) return 0
        return Math.round(((venta - costo) / costo) * 100)
      } },

    { clave: 'stock', etiqueta: 'Stock actual', tipo_dato: 'numero', origen: 'columna', grupo: 'detalles' },
    { clave: 'unidad_medida', etiqueta: 'Unidad de medida', tipo_dato: 'texto', origen: 'columna', grupo: 'detalles' },
  ],
})

// ─────────────────────────────────────────────────────
// ACTIVIDAD — Tareas y seguimientos
// ─────────────────────────────────────────────────────
registrarEntidad({
  clave: 'actividad',
  etiqueta: 'Actividad',
  icono: icono(CalendarDays),
  variables: [
    { clave: 'titulo', etiqueta: 'Título', tipo_dato: 'texto', origen: 'columna', grupo: 'basico' },
    { clave: 'descripcion', etiqueta: 'Descripción', tipo_dato: 'texto', origen: 'columna', grupo: 'basico' },
    { clave: 'tipo', etiqueta: 'Tipo', tipo_dato: 'texto', origen: 'columna', grupo: 'basico' },
    { clave: 'prioridad', etiqueta: 'Prioridad', tipo_dato: 'texto', origen: 'columna', grupo: 'basico' },
    { clave: 'estado', etiqueta: 'Estado', tipo_dato: 'texto', origen: 'columna', grupo: 'estado' },

    { clave: 'fecha_vencimiento', etiqueta: 'Fecha de vencimiento', tipo_dato: 'fecha', origen: 'columna', grupo: 'fechas' },
    { clave: 'fecha_completada', etiqueta: 'Fecha completada', tipo_dato: 'fecha', origen: 'columna', grupo: 'fechas' },

    { clave: 'asignados', etiqueta: 'Responsables', tipo_dato: 'texto', origen: 'relacion', grupo: 'relacion' },
    { clave: 'contacto_nombre', etiqueta: 'Contacto vinculado', tipo_dato: 'texto', origen: 'relacion', grupo: 'relacion' },
  ],
})

// ─────────────────────────────────────────────────────
// VISITA — Visitas programadas
// ─────────────────────────────────────────────────────
registrarEntidad({
  clave: 'visita',
  etiqueta: 'Visita',
  icono: icono(MapPin),
  variables: [
    { clave: 'codigo', etiqueta: 'Código', descripcion: 'VT-0001', tipo_dato: 'texto', origen: 'columna', grupo: 'basico' },
    { clave: 'estado', etiqueta: 'Estado', tipo_dato: 'texto', origen: 'columna', grupo: 'basico' },
    { clave: 'motivo', etiqueta: 'Motivo', tipo_dato: 'texto', origen: 'columna', grupo: 'basico' },
    { clave: 'resultado', etiqueta: 'Resultado', tipo_dato: 'texto', origen: 'columna', grupo: 'basico' },

    { clave: 'fecha_programada', etiqueta: 'Fecha programada', tipo_dato: 'fecha_hora', origen: 'columna', grupo: 'fechas' },
    { clave: 'fecha_realizada', etiqueta: 'Fecha realizada', tipo_dato: 'fecha_hora', origen: 'columna', grupo: 'fechas' },
    { clave: 'duracion_estimada', etiqueta: 'Duración estimada (min)', tipo_dato: 'numero', origen: 'columna', grupo: 'detalles' },
    { clave: 'duracion_real', etiqueta: 'Duración real (min)', tipo_dato: 'numero', origen: 'columna', grupo: 'detalles' },

    { clave: 'direccion', etiqueta: 'Dirección', tipo_dato: 'texto', origen: 'columna', grupo: 'ubicacion' },
    { clave: 'notas', etiqueta: 'Notas', tipo_dato: 'texto', origen: 'columna', grupo: 'detalles' },

    { clave: 'tecnico_nombre', etiqueta: 'Técnico asignado', tipo_dato: 'texto', origen: 'relacion', grupo: 'relacion' },
    { clave: 'contacto_nombre', etiqueta: 'Contacto vinculado', tipo_dato: 'texto', origen: 'relacion', grupo: 'relacion' },
    { clave: 'contacto_telefono', etiqueta: 'Teléfono del contacto', tipo_dato: 'telefono', origen: 'relacion', grupo: 'relacion' },
  ],
})

// ─────────────────────────────────────────────────────
// ORDEN DE TRABAJO — Proyectos multi-etapa
// ─────────────────────────────────────────────────────
registrarEntidad({
  clave: 'orden',
  etiqueta: 'Orden de trabajo',
  icono: icono(Briefcase),
  variables: [
    { clave: 'numero', etiqueta: 'Número', tipo_dato: 'texto', origen: 'columna', grupo: 'basico' },
    { clave: 'titulo', etiqueta: 'Título', tipo_dato: 'texto', origen: 'columna', grupo: 'basico' },
    { clave: 'descripcion', etiqueta: 'Descripción', tipo_dato: 'texto', origen: 'columna', grupo: 'basico' },
    { clave: 'estado', etiqueta: 'Estado', tipo_dato: 'texto', origen: 'columna', grupo: 'estado' },
    { clave: 'prioridad', etiqueta: 'Prioridad', tipo_dato: 'texto', origen: 'columna', grupo: 'basico' },

    { clave: 'fecha_inicio', etiqueta: 'Fecha de inicio', tipo_dato: 'fecha', origen: 'columna', grupo: 'fechas' },
    { clave: 'fecha_fin_estimada', etiqueta: 'Fecha fin estimada', tipo_dato: 'fecha', origen: 'columna', grupo: 'fechas' },
    { clave: 'fecha_fin_real', etiqueta: 'Fecha fin real', tipo_dato: 'fecha', origen: 'columna', grupo: 'fechas' },

    { clave: 'contacto_nombre', etiqueta: 'Cliente', tipo_dato: 'texto', origen: 'relacion', grupo: 'relacion' },
    { clave: 'asignado_nombre', etiqueta: 'Responsable', tipo_dato: 'texto', origen: 'relacion', grupo: 'relacion' },
  ],
})

// ─────────────────────────────────────────────────────
// CONVERSACIÓN — Datos del inbox omnicanal
// ─────────────────────────────────────────────────────
registrarEntidad({
  clave: 'conversacion',
  etiqueta: 'Conversación',
  icono: icono(MessageSquare),
  variables: [
    { clave: 'canal', etiqueta: 'Canal', descripcion: 'whatsapp, correo o interno', tipo_dato: 'texto', origen: 'columna', grupo: 'basico' },
    { clave: 'etapa', etiqueta: 'Etapa', tipo_dato: 'texto', origen: 'columna', grupo: 'basico' },
    { clave: 'ultimo_mensaje', etiqueta: 'Último mensaje', tipo_dato: 'texto', origen: 'columna', grupo: 'basico' },
    { clave: 'ultimo_mensaje_en', etiqueta: 'Fecha último mensaje', tipo_dato: 'fecha_hora', origen: 'columna', grupo: 'fechas' },

    { clave: 'asignado_nombre', etiqueta: 'Asignado a', tipo_dato: 'texto', origen: 'relacion', grupo: 'relacion' },
    { clave: 'contacto_nombre', etiqueta: 'Contacto', tipo_dato: 'texto', origen: 'relacion', grupo: 'relacion' },
    { clave: 'contacto_telefono', etiqueta: 'Teléfono del contacto', tipo_dato: 'telefono', origen: 'relacion', grupo: 'relacion' },
  ],
})

// ─────────────────────────────────────────────────────
// ASISTENCIA — Registro de fichaje
// ─────────────────────────────────────────────────────
registrarEntidad({
  clave: 'asistencia',
  etiqueta: 'Asistencia',
  icono: icono(Clock),
  variables: [
    { clave: 'fecha', etiqueta: 'Fecha', tipo_dato: 'fecha', origen: 'columna', grupo: 'basico' },
    { clave: 'estado', etiqueta: 'Estado', descripcion: 'activo, almuerzo, cerrado, etc.', tipo_dato: 'texto', origen: 'columna', grupo: 'basico' },
    { clave: 'entrada', etiqueta: 'Hora de entrada', tipo_dato: 'fecha_hora', origen: 'columna', grupo: 'basico' },
    { clave: 'salida', etiqueta: 'Hora de salida', tipo_dato: 'fecha_hora', origen: 'columna', grupo: 'basico' },
    { clave: 'metodo_registro', etiqueta: 'Método de registro', tipo_dato: 'texto', origen: 'columna', grupo: 'detalles' },
    { clave: 'tipo', etiqueta: 'Tipo', descripcion: 'normal, tardanza, adelanto, feriado', tipo_dato: 'texto', origen: 'columna', grupo: 'detalles' },

    { clave: 'usuario_nombre', etiqueta: 'Nombre del empleado', tipo_dato: 'texto', origen: 'relacion', grupo: 'relacion' },
  ],
})

// ─────────────────────────────────────────────────────
// INFORME — Reportes generados
// ─────────────────────────────────────────────────────
registrarEntidad({
  clave: 'informe',
  etiqueta: 'Informe',
  icono: icono(BarChart3),
  variables: [
    { clave: 'numero', etiqueta: 'Número', tipo_dato: 'texto', origen: 'columna', grupo: 'basico' },
    { clave: 'titulo', etiqueta: 'Título', tipo_dato: 'texto', origen: 'columna', grupo: 'basico' },
    { clave: 'estado', etiqueta: 'Estado', tipo_dato: 'texto', origen: 'columna', grupo: 'basico' },
    { clave: 'notas', etiqueta: 'Notas', tipo_dato: 'texto', origen: 'columna', grupo: 'detalles' },
    { clave: 'fecha_emision', etiqueta: 'Fecha de emisión', tipo_dato: 'fecha', origen: 'columna', grupo: 'fechas' },
    { clave: 'contacto_nombre', etiqueta: 'Cliente', tipo_dato: 'texto', origen: 'relacion', grupo: 'relacion' },
  ],
})

// ─────────────────────────────────────────────────────
// USUARIO — Datos del usuario actual (quien usa la app)
// ─────────────────────────────────────────────────────
registrarEntidad({
  clave: 'usuario',
  etiqueta: 'Usuario actual',
  icono: icono(Settings),
  variables: [
    { clave: 'nombre', etiqueta: 'Nombre', tipo_dato: 'texto', origen: 'columna', grupo: 'basico' },
    { clave: 'apellido', etiqueta: 'Apellido', tipo_dato: 'texto', origen: 'columna', grupo: 'basico' },
    { clave: 'nombre_completo', etiqueta: 'Nombre completo', tipo_dato: 'texto', origen: 'calculado', grupo: 'basico',
      calcular: (d) => [d.nombre, d.apellido].filter(Boolean).join(' ') },
    { clave: 'correo', etiqueta: 'Correo electrónico', tipo_dato: 'email', origen: 'columna', grupo: 'contacto' },
    { clave: 'telefono', etiqueta: 'Teléfono', tipo_dato: 'telefono', origen: 'columna', grupo: 'contacto' },
    { clave: 'rol', etiqueta: 'Rol', tipo_dato: 'texto', origen: 'columna', grupo: 'basico' },
  ],
})

// ─────────────────────────────────────────────────────
// NÓMINA — Datos del recibo de haberes / nómina
// ─────────────────────────────────────────────────────
registrarEntidad({
  clave: 'nomina',
  etiqueta: 'Nómina',
  icono: icono(DollarSign),
  variables: [
    // Empleado
    { clave: 'nombre_empleado', etiqueta: 'Nombre del empleado', tipo_dato: 'texto', origen: 'relacion', grupo: 'basico' },
    { clave: 'correo_empleado', etiqueta: 'Correo del empleado', tipo_dato: 'email', origen: 'relacion', grupo: 'basico' },

    // Período
    { clave: 'periodo', etiqueta: 'Período', descripcion: 'Ej: Quincena 1-15 de Abril 2026', tipo_dato: 'texto', origen: 'calculado', grupo: 'basico' },

    // Asistencia
    { clave: 'dias_trabajados', etiqueta: 'Días trabajados', tipo_dato: 'numero', origen: 'columna', grupo: 'detalles' },
    { clave: 'dias_laborales', etiqueta: 'Días laborales del período', tipo_dato: 'numero', origen: 'columna', grupo: 'detalles' },
    { clave: 'dias_ausentes', etiqueta: 'Días ausentes', tipo_dato: 'numero', origen: 'columna', grupo: 'detalles' },
    { clave: 'dias_tardanza', etiqueta: 'Días con tardanza', tipo_dato: 'numero', origen: 'columna', grupo: 'detalles' },
    { clave: 'porcentaje_asistencia', etiqueta: 'Porcentaje de asistencia', descripcion: 'Ej: 95%', tipo_dato: 'texto', origen: 'calculado', grupo: 'detalles' },

    // Horas detalladas
    { clave: 'horas_brutas', etiqueta: 'Horas brutas (sin descontar)', descripcion: 'Tiempo total en oficina', tipo_dato: 'texto', origen: 'calculado', grupo: 'detalles' },
    { clave: 'horas_netas', etiqueta: 'Horas netas trabajadas', descripcion: 'Descontando almuerzo y salidas', tipo_dato: 'texto', origen: 'calculado', grupo: 'detalles' },
    { clave: 'horas_almuerzo', etiqueta: 'Horas de almuerzo', tipo_dato: 'texto', origen: 'calculado', grupo: 'detalles' },
    { clave: 'horas_particular', etiqueta: 'Horas de salidas particulares', descripcion: 'Trámites personales', tipo_dato: 'texto', origen: 'calculado', grupo: 'detalles' },
    { clave: 'promedio_diario', etiqueta: 'Promedio horas por día', descripcion: 'Ej: 7h 15min', tipo_dato: 'texto', origen: 'calculado', grupo: 'detalles' },
    { clave: 'dias_con_salida_particular', etiqueta: 'Días con salida particular', tipo_dato: 'numero', origen: 'columna', grupo: 'detalles' },

    // Config almuerzo
    { clave: 'descuenta_almuerzo', etiqueta: '¿Se descuenta almuerzo?', tipo_dato: 'texto', origen: 'calculado', grupo: 'detalles' },

    // Compensación
    { clave: 'compensacion_tipo', etiqueta: 'Tipo de compensación', descripcion: 'Mensual fijo / Por día / Por hora', tipo_dato: 'texto', origen: 'columna', grupo: 'financiero' },
    { clave: 'compensacion_detalle', etiqueta: 'Detalle de compensación', descripcion: 'Ej: $200.000 mensual × 15/22 días', tipo_dato: 'texto', origen: 'calculado', grupo: 'financiero' },
    { clave: 'monto_bruto', etiqueta: 'Monto a pagar', tipo_dato: 'moneda', origen: 'columna', grupo: 'financiero' },
  ],
})

// ─────────────────────────────────────────────────────
// FECHA — Variables de fecha/hora actual (útiles en plantillas)
// ─────────────────────────────────────────────────────

/** Helper para crear variables de fecha calculadas */
const variablesFecha: DefinicionVariable[] = [
  { clave: 'hoy', etiqueta: 'Fecha de hoy', tipo_dato: 'fecha', origen: 'calculado', grupo: 'basico',
    calcular: () => new Date() },
  { clave: 'hora', etiqueta: 'Hora actual', tipo_dato: 'texto', origen: 'calculado', grupo: 'basico',
    calcular: (d) => new Date().toLocaleTimeString((d?._locale as string) || 'es-AR', { hour: '2-digit', minute: '2-digit', hour12: (d?._formatoHora as string) === '12h' }) },
  { clave: 'dia_semana', etiqueta: 'Día de la semana', tipo_dato: 'texto', origen: 'calculado', grupo: 'basico',
    calcular: (d) => new Date().toLocaleDateString((d?._locale as string) || 'es-AR', { weekday: 'long' }) },
  { clave: 'mes', etiqueta: 'Mes actual', tipo_dato: 'texto', origen: 'calculado', grupo: 'basico',
    calcular: (d) => new Date().toLocaleDateString((d?._locale as string) || 'es-AR', { month: 'long' }) },
  { clave: 'ano', etiqueta: 'Año actual', tipo_dato: 'texto', origen: 'calculado', grupo: 'basico',
    calcular: () => new Date().getFullYear().toString() },
]

registrarEntidad({
  clave: 'fecha',
  etiqueta: 'Fecha y hora',
  icono: icono(Globe),
  variables: variablesFecha,
})
