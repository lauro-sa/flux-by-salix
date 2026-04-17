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
 * ║  {{presupuesto.total_final}}  →  "$ 150.000,00"              ║
 * ║  {{fecha.hoy}}  →  "26/03/2026"                               ║
 * ║                                                                ║
 * ║  ACTIVAR EN LA APP:                                           ║
 * ║  import '@/lib/variables/entidades' (en layout.tsx o similar) ║
 * ╚══════════════════════════════════════════════════════════════════╝
 */

import { createElement } from 'react'
import {
  User, UserCheck, Building2, FileText, Package, CalendarDays,
  MapPin, MessageSquare, Clock, Briefcase, DollarSign,
  Settings, Globe,
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
    { clave: 'tipo', etiqueta: 'Tipo de contacto', descripcion: 'Empresa, Persona, Edificio, etc.', tipo_dato: 'texto', origen: 'relacion', grupo: 'basico' },
    { clave: 'titulo', etiqueta: 'Título', descripcion: 'Sr., Dra., Ing.', tipo_dato: 'texto', origen: 'columna', grupo: 'basico' },
    { clave: 'cargo', etiqueta: 'Cargo', tipo_dato: 'texto', origen: 'columna', grupo: 'basico' },
    { clave: 'rubro', etiqueta: 'Rubro', tipo_dato: 'texto', origen: 'columna', grupo: 'basico' },

    // Contacto directo
    { clave: 'correo', etiqueta: 'Correo electrónico', tipo_dato: 'email', origen: 'columna', grupo: 'contacto' },
    { clave: 'telefono', etiqueta: 'Teléfono', tipo_dato: 'telefono', origen: 'columna', grupo: 'contacto' },
    { clave: 'whatsapp', etiqueta: 'WhatsApp', tipo_dato: 'telefono', origen: 'columna', grupo: 'contacto' },
    { clave: 'web', etiqueta: 'Sitio web', tipo_dato: 'url', origen: 'columna', grupo: 'contacto' },

    // Identificación fiscal
    { clave: 'tipo_identificacion', etiqueta: 'Tipo de identificación', descripcion: 'CUIT, DNI, RUT, etc.', tipo_dato: 'texto', origen: 'columna', grupo: 'detalles' },
    { clave: 'numero_identificacion', etiqueta: 'Número de identificación', descripcion: 'Número de CUIT, DNI, etc.', tipo_dato: 'texto', origen: 'columna', grupo: 'detalles' },
    { clave: 'pais_fiscal', etiqueta: 'País fiscal', tipo_dato: 'texto', origen: 'columna', grupo: 'detalles' },

    // Ubicación (dirección principal — viene de contacto_direcciones)
    { clave: 'direccion', etiqueta: 'Dirección completa', descripcion: 'Dirección principal formateada', tipo_dato: 'texto', origen: 'relacion', grupo: 'ubicacion' },
    { clave: 'calle', etiqueta: 'Calle', tipo_dato: 'texto', origen: 'relacion', grupo: 'ubicacion' },
    { clave: 'numero_calle', etiqueta: 'Altura', descripcion: 'Número de la calle', tipo_dato: 'texto', origen: 'relacion', grupo: 'ubicacion' },
    { clave: 'calle_altura', etiqueta: 'Calle y altura', descripcion: 'Calle + número combinados', tipo_dato: 'texto', origen: 'calculado', grupo: 'ubicacion',
      calcular: (d) => [d.calle, d.numero_calle].filter(Boolean).join(' ') },
    { clave: 'piso', etiqueta: 'Piso / Dpto', tipo_dato: 'texto', origen: 'relacion', grupo: 'ubicacion' },
    { clave: 'barrio', etiqueta: 'Barrio', tipo_dato: 'texto', origen: 'relacion', grupo: 'ubicacion' },
    { clave: 'ciudad', etiqueta: 'Ciudad', tipo_dato: 'texto', origen: 'relacion', grupo: 'ubicacion' },
    { clave: 'provincia', etiqueta: 'Provincia', tipo_dato: 'texto', origen: 'relacion', grupo: 'ubicacion' },
    { clave: 'pais', etiqueta: 'País', tipo_dato: 'texto', origen: 'relacion', grupo: 'ubicacion' },
    { clave: 'codigo_postal', etiqueta: 'Código postal', tipo_dato: 'texto', origen: 'relacion', grupo: 'ubicacion' },
    { clave: 'timbre', etiqueta: 'Timbre', tipo_dato: 'texto', origen: 'relacion', grupo: 'ubicacion' },

    // Comercial
    { clave: 'moneda', etiqueta: 'Moneda', tipo_dato: 'texto', origen: 'columna', grupo: 'detalles' },
    { clave: 'idioma', etiqueta: 'Idioma', tipo_dato: 'texto', origen: 'columna', grupo: 'detalles' },

    // Notas
    { clave: 'notas', etiqueta: 'Notas', tipo_dato: 'texto', origen: 'columna', grupo: 'detalles' },

    // Fechas
    { clave: 'creado_en', etiqueta: 'Fecha de creación', tipo_dato: 'fecha', origen: 'columna', grupo: 'fechas' },
  ],
})

// ─────────────────────────────────────────────────────
// EMPRESA — Datos de la empresa (tenant)
// Columnas en BD: nombre, slug, logo_url, pais, paises, color_marca, descripcion,
// datos_fiscales (jsonb), datos_bancarios (jsonb), ubicacion, correo, telefono, pagina_web
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
    { clave: 'correo', etiqueta: 'Correo de contacto', tipo_dato: 'email', origen: 'columna', grupo: 'contacto' },
    { clave: 'telefono', etiqueta: 'Teléfono', tipo_dato: 'telefono', origen: 'columna', grupo: 'contacto' },
    { clave: 'pagina_web', etiqueta: 'Sitio web', tipo_dato: 'url', origen: 'columna', grupo: 'contacto' },
    { clave: 'ubicacion', etiqueta: 'Dirección', tipo_dato: 'texto', origen: 'columna', grupo: 'ubicacion' },
  ],
})

// ─────────────────────────────────────────────────────
// PRESUPUESTO — Datos del presupuesto/cotización
// Columnas BD: numero, estado, moneda, subtotal_neto, total_impuestos, total_final,
// descuento_global (%), descuento_global_monto, referencia, notas_html, condiciones_html,
// nota_plan_pago, fecha_emision, fecha_vencimiento, contacto_nombre/apellido/correo/telefono
// ─────────────────────────────────────────────────────
registrarEntidad({
  clave: 'presupuesto',
  etiqueta: 'Presupuesto',
  icono: icono(FileText),
  variables: [
    // Básico
    { clave: 'numero', etiqueta: 'Número', descripcion: 'Ej: Pres 26-001', tipo_dato: 'texto', origen: 'columna', grupo: 'basico' },
    { clave: 'estado', etiqueta: 'Estado', descripcion: 'borrador, enviado, confirmado, etc.', tipo_dato: 'texto', origen: 'columna', grupo: 'basico' },
    { clave: 'referencia', etiqueta: 'Referencia interna', tipo_dato: 'texto', origen: 'columna', grupo: 'basico' },

    // Financiero
    { clave: 'subtotal_neto', etiqueta: 'Subtotal neto (sin IVA)', tipo_dato: 'moneda', origen: 'columna', grupo: 'financiero' },
    { clave: 'total_impuestos', etiqueta: 'Total impuestos', tipo_dato: 'moneda', origen: 'columna', grupo: 'financiero' },
    { clave: 'total_final', etiqueta: 'Total final', tipo_dato: 'moneda', origen: 'columna', grupo: 'financiero' },
    { clave: 'moneda', etiqueta: 'Moneda', tipo_dato: 'texto', origen: 'columna', grupo: 'financiero' },
    { clave: 'cotizacion_cambio', etiqueta: 'Tipo de cambio', tipo_dato: 'numero', origen: 'columna', grupo: 'financiero' },
    { clave: 'descuento_global', etiqueta: 'Descuento global (%)', tipo_dato: 'porcentaje', origen: 'columna', grupo: 'financiero' },
    { clave: 'descuento_global_monto', etiqueta: 'Descuento global (monto)', tipo_dato: 'moneda', origen: 'columna', grupo: 'financiero' },

    // Condiciones de pago
    { clave: 'condicion_pago_label', etiqueta: 'Condición de pago', tipo_dato: 'texto', origen: 'columna', grupo: 'pagos' },
    { clave: 'condicion_pago_tipo', etiqueta: 'Tipo de condición', descripcion: 'plazo_fijo o hitos', tipo_dato: 'texto', origen: 'columna', grupo: 'pagos' },
    { clave: 'dias_vencimiento', etiqueta: 'Días de vencimiento', tipo_dato: 'numero', origen: 'columna', grupo: 'pagos' },
    { clave: 'nota_plan_pago', etiqueta: 'Nota del plan de pago', tipo_dato: 'texto', origen: 'columna', grupo: 'pagos' },

    // Cuotas — semánticas (se calculan desde los datos de cuotas)
    { clave: 'cantidad_cuotas', etiqueta: 'Cantidad de cuotas', tipo_dato: 'numero', origen: 'relacion', grupo: 'pagos' },
    { clave: 'adelanto_porcentaje', etiqueta: 'Adelanto — porcentaje', descripcion: 'Primera cuota (siempre)', tipo_dato: 'porcentaje', origen: 'calculado', grupo: 'pagos',
      calcular: (d) => d.cuota_1_porcentaje || '' },
    { clave: 'adelanto_monto', etiqueta: 'Adelanto — monto', descripcion: 'Monto de la primera cuota', tipo_dato: 'moneda', origen: 'calculado', grupo: 'pagos',
      calcular: (d) => d.cuota_1_monto || '' },
    { clave: 'adelanto_descripcion', etiqueta: 'Adelanto — descripción', tipo_dato: 'texto', origen: 'calculado', grupo: 'pagos',
      calcular: (d) => d.cuota_1_descripcion || '' },
    { clave: 'pago_final_porcentaje', etiqueta: 'Pago final — porcentaje', descripcion: 'Última cuota (siempre)', tipo_dato: 'porcentaje', origen: 'calculado', grupo: 'pagos',
      calcular: (d) => {
        const n = Number(d.cantidad_cuotas) || 0
        if (n <= 0) return ''
        return d[`cuota_${n}_porcentaje`] || ''
      } },
    { clave: 'pago_final_monto', etiqueta: 'Pago final — monto', descripcion: 'Monto de la última cuota', tipo_dato: 'moneda', origen: 'calculado', grupo: 'pagos',
      calcular: (d) => {
        const n = Number(d.cantidad_cuotas) || 0
        if (n <= 0) return ''
        return d[`cuota_${n}_monto`] || ''
      } },
    { clave: 'pago_final_descripcion', etiqueta: 'Pago final — descripción', tipo_dato: 'texto', origen: 'calculado', grupo: 'pagos',
      calcular: (d) => {
        const n = Number(d.cantidad_cuotas) || 0
        if (n <= 0) return ''
        return d[`cuota_${n}_descripcion`] || ''
      } },
    { clave: 'cuotas_intermedias', etiqueta: 'Cuotas intermedias', descripcion: 'Cantidad de pagos entre adelanto y final', tipo_dato: 'numero', origen: 'calculado', grupo: 'pagos',
      calcular: (d) => Math.max(0, (Number(d.cantidad_cuotas) || 0) - 2) },

    // Cuotas — por número (acceso directo a cada cuota)
    { clave: 'cuota_1_descripcion', etiqueta: 'Cuota 1 — descripción', tipo_dato: 'texto', origen: 'relacion', grupo: 'pagos' },
    { clave: 'cuota_1_porcentaje', etiqueta: 'Cuota 1 — porcentaje', tipo_dato: 'porcentaje', origen: 'relacion', grupo: 'pagos' },
    { clave: 'cuota_1_monto', etiqueta: 'Cuota 1 — monto', tipo_dato: 'moneda', origen: 'relacion', grupo: 'pagos' },
    { clave: 'cuota_2_descripcion', etiqueta: 'Cuota 2 — descripción', tipo_dato: 'texto', origen: 'relacion', grupo: 'pagos' },
    { clave: 'cuota_2_porcentaje', etiqueta: 'Cuota 2 — porcentaje', tipo_dato: 'porcentaje', origen: 'relacion', grupo: 'pagos' },
    { clave: 'cuota_2_monto', etiqueta: 'Cuota 2 — monto', tipo_dato: 'moneda', origen: 'relacion', grupo: 'pagos' },
    { clave: 'cuota_3_descripcion', etiqueta: 'Cuota 3 — descripción', tipo_dato: 'texto', origen: 'relacion', grupo: 'pagos' },
    { clave: 'cuota_3_porcentaje', etiqueta: 'Cuota 3 — porcentaje', tipo_dato: 'porcentaje', origen: 'relacion', grupo: 'pagos' },
    { clave: 'cuota_3_monto', etiqueta: 'Cuota 3 — monto', tipo_dato: 'moneda', origen: 'relacion', grupo: 'pagos' },

    // Fechas
    { clave: 'fecha_emision', etiqueta: 'Fecha de emisión', tipo_dato: 'fecha', origen: 'columna', grupo: 'fechas' },
    { clave: 'fecha_emision_original', etiqueta: 'Fecha de emisión original', descripcion: 'Se llena al re-emitir', tipo_dato: 'fecha', origen: 'columna', grupo: 'fechas' },
    { clave: 'fecha_aceptacion', etiqueta: 'Fecha de aceptación', tipo_dato: 'fecha', origen: 'columna', grupo: 'fechas' },
    { clave: 'fecha_vencimiento', etiqueta: 'Fecha de vencimiento', tipo_dato: 'fecha', origen: 'columna', grupo: 'fechas' },

    // Auditoría
    { clave: 'creado_por_nombre', etiqueta: 'Creado por', tipo_dato: 'texto', origen: 'columna', grupo: 'detalles' },
    { clave: 'editado_por_nombre', etiqueta: 'Editado por', tipo_dato: 'texto', origen: 'columna', grupo: 'detalles' },

    // Relación (snapshots del contacto)
    { clave: 'contacto_nombre', etiqueta: 'Nombre del cliente', tipo_dato: 'texto', origen: 'columna', grupo: 'relacion' },
    { clave: 'contacto_correo', etiqueta: 'Correo del cliente', tipo_dato: 'email', origen: 'columna', grupo: 'relacion' },
    { clave: 'contacto_telefono', etiqueta: 'Teléfono del cliente', tipo_dato: 'telefono', origen: 'columna', grupo: 'relacion' },
    { clave: 'contacto_direccion', etiqueta: 'Dirección del cliente', tipo_dato: 'texto', origen: 'columna', grupo: 'relacion' },
    { clave: 'contacto_identificacion', etiqueta: 'Identificación del cliente', descripcion: 'CUIT/DNI', tipo_dato: 'texto', origen: 'columna', grupo: 'relacion' },
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

    // Ubicación (dirección principal del dirigido a)
    { clave: 'direccion', etiqueta: 'Dirección completa', tipo_dato: 'texto', origen: 'relacion', grupo: 'ubicacion' },
    { clave: 'calle', etiqueta: 'Calle', tipo_dato: 'texto', origen: 'relacion', grupo: 'ubicacion' },
    { clave: 'numero_calle', etiqueta: 'Altura', descripcion: 'Número de la calle', tipo_dato: 'texto', origen: 'relacion', grupo: 'ubicacion' },
    { clave: 'calle_altura', etiqueta: 'Calle y altura', descripcion: 'Calle + número combinados', tipo_dato: 'texto', origen: 'calculado', grupo: 'ubicacion',
      calcular: (d) => [d.calle, d.numero_calle].filter(Boolean).join(' ') },
    { clave: 'piso', etiqueta: 'Piso / Dpto', tipo_dato: 'texto', origen: 'relacion', grupo: 'ubicacion' },
    { clave: 'barrio', etiqueta: 'Barrio', tipo_dato: 'texto', origen: 'relacion', grupo: 'ubicacion' },
    { clave: 'ciudad', etiqueta: 'Ciudad', tipo_dato: 'texto', origen: 'relacion', grupo: 'ubicacion' },
    { clave: 'provincia', etiqueta: 'Provincia', tipo_dato: 'texto', origen: 'relacion', grupo: 'ubicacion' },
    { clave: 'pais', etiqueta: 'País', tipo_dato: 'texto', origen: 'relacion', grupo: 'ubicacion' },
    { clave: 'codigo_postal', etiqueta: 'Código postal', tipo_dato: 'texto', origen: 'relacion', grupo: 'ubicacion' },

    // Relación
    { clave: 'empresa_nombre', etiqueta: 'Empresa / Contacto padre', descripcion: 'Nombre del contacto contenedor', tipo_dato: 'texto', origen: 'relacion', grupo: 'relacion' },
  ],
})

// FACTURA — tabla no existe todavía, se agregará cuando se implemente el módulo

// ─────────────────────────────────────────────────────
// PRODUCTO — Datos del producto
// ─────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────
// PRODUCTO — Datos del producto
// Columnas BD: nombre, codigo, tipo, categoria, referencia_interna, codigo_barras,
// precio_unitario, costo, moneda, unidad, descripcion, descripcion_venta, notas_internas
// ─────────────────────────────────────────────────────
registrarEntidad({
  clave: 'producto',
  etiqueta: 'Producto',
  icono: icono(Package),
  variables: [
    { clave: 'nombre', etiqueta: 'Nombre', tipo_dato: 'texto', origen: 'columna', grupo: 'basico' },
    { clave: 'codigo', etiqueta: 'Código', tipo_dato: 'texto', origen: 'columna', grupo: 'basico' },
    { clave: 'descripcion', etiqueta: 'Descripción', tipo_dato: 'texto', origen: 'columna', grupo: 'basico' },
    { clave: 'descripcion_venta', etiqueta: 'Descripción de venta', tipo_dato: 'texto', origen: 'columna', grupo: 'basico' },
    { clave: 'categoria', etiqueta: 'Categoría', tipo_dato: 'texto', origen: 'columna', grupo: 'basico' },
    { clave: 'tipo', etiqueta: 'Tipo', descripcion: 'producto, servicio, etc.', tipo_dato: 'texto', origen: 'columna', grupo: 'basico' },
    { clave: 'referencia_interna', etiqueta: 'Referencia interna', tipo_dato: 'texto', origen: 'columna', grupo: 'basico' },

    { clave: 'costo', etiqueta: 'Precio de costo', tipo_dato: 'moneda', origen: 'columna', grupo: 'financiero' },
    { clave: 'precio_unitario', etiqueta: 'Precio de venta', tipo_dato: 'moneda', origen: 'columna', grupo: 'financiero' },
    { clave: 'moneda', etiqueta: 'Moneda', tipo_dato: 'texto', origen: 'columna', grupo: 'financiero' },
    { clave: 'margen', etiqueta: 'Margen de ganancia', tipo_dato: 'porcentaje', origen: 'calculado', grupo: 'financiero',
      calcular: (d) => {
        const costoVal = Number(d.costo) || 0
        const venta = Number(d.precio_unitario) || 0
        if (costoVal === 0) return 0
        return Math.round(((venta - costoVal) / costoVal) * 100)
      } },

    { clave: 'unidad', etiqueta: 'Unidad de medida', tipo_dato: 'texto', origen: 'columna', grupo: 'detalles' },
  ],
})

// ─────────────────────────────────────────────────────
// ACTIVIDAD — Tareas y seguimientos
// ─────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────
// ACTIVIDAD — Tareas y seguimientos
// Columnas BD: titulo, descripcion, tipo_clave, estado_clave, prioridad,
// fecha_vencimiento, fecha_completada, asignados (jsonb), creado_por_nombre
// ─────────────────────────────────────────────────────
registrarEntidad({
  clave: 'actividad',
  etiqueta: 'Actividad',
  icono: icono(CalendarDays),
  variables: [
    { clave: 'titulo', etiqueta: 'Título', tipo_dato: 'texto', origen: 'columna', grupo: 'basico' },
    { clave: 'descripcion', etiqueta: 'Descripción', tipo_dato: 'texto', origen: 'columna', grupo: 'basico' },
    { clave: 'tipo_clave', etiqueta: 'Tipo', descripcion: 'llamada, reunion, tarea, etc.', tipo_dato: 'texto', origen: 'columna', grupo: 'basico' },
    { clave: 'prioridad', etiqueta: 'Prioridad', tipo_dato: 'texto', origen: 'columna', grupo: 'basico' },
    { clave: 'estado_clave', etiqueta: 'Estado', tipo_dato: 'texto', origen: 'columna', grupo: 'estado' },

    { clave: 'fecha_vencimiento', etiqueta: 'Fecha de vencimiento', tipo_dato: 'fecha', origen: 'columna', grupo: 'fechas' },
    { clave: 'fecha_completada', etiqueta: 'Fecha completada', tipo_dato: 'fecha', origen: 'columna', grupo: 'fechas' },

    { clave: 'creado_por_nombre', etiqueta: 'Creado por', tipo_dato: 'texto', origen: 'columna', grupo: 'relacion' },
  ],
})

// ─────────────────────────────────────────────────────
// VISITA — Visitas programadas
// ─────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────
// VISITA — Visitas programadas
// Columnas BD: estado, motivo, resultado, fecha_programada, fecha_completada,
// duracion_estimada_min, duracion_real_min, direccion_texto, notas,
// contacto_nombre, asignado_nombre, prioridad
// ─────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────
// VISITA — Visitas programadas
// Columnas BD: estado, motivo, resultado, notas, temperatura, prioridad,
// fecha_programada, fecha_inicio, fecha_llegada, fecha_completada,
// duracion_estimada_min, duracion_real_min, direccion_texto,
// contacto_nombre, asignado_nombre, recibe_nombre, recibe_telefono
// ─────────────────────────────────────────────────────
registrarEntidad({
  clave: 'visita',
  etiqueta: 'Visita',
  icono: icono(MapPin),
  variables: [
    // Básico
    { clave: 'estado', etiqueta: 'Estado', descripcion: 'programada, en_camino, en_sitio, completada, cancelada', tipo_dato: 'texto', origen: 'columna', grupo: 'basico' },
    { clave: 'motivo', etiqueta: 'Motivo', tipo_dato: 'texto', origen: 'columna', grupo: 'basico' },
    { clave: 'resultado', etiqueta: 'Resultado', tipo_dato: 'texto', origen: 'columna', grupo: 'basico' },
    { clave: 'prioridad', etiqueta: 'Prioridad', tipo_dato: 'texto', origen: 'columna', grupo: 'basico' },
    { clave: 'temperatura', etiqueta: 'Temperatura', descripcion: 'frío, tibio, caliente', tipo_dato: 'texto', origen: 'columna', grupo: 'basico' },
    { clave: 'notas', etiqueta: 'Notas', tipo_dato: 'texto', origen: 'columna', grupo: 'basico' },

    // Fechas y tiempos
    { clave: 'fecha_programada', etiqueta: 'Fecha programada', tipo_dato: 'fecha_hora', origen: 'columna', grupo: 'fechas' },
    { clave: 'fecha_inicio', etiqueta: 'Fecha en camino', descripcion: 'Cuando arrancó hacia el lugar', tipo_dato: 'fecha_hora', origen: 'columna', grupo: 'fechas' },
    { clave: 'fecha_llegada', etiqueta: 'Fecha de llegada', descripcion: 'Cuando llegó al sitio', tipo_dato: 'fecha_hora', origen: 'columna', grupo: 'fechas' },
    { clave: 'fecha_completada', etiqueta: 'Fecha completada', tipo_dato: 'fecha_hora', origen: 'columna', grupo: 'fechas' },
    { clave: 'duracion_estimada_min', etiqueta: 'Duración estimada (min)', tipo_dato: 'numero', origen: 'columna', grupo: 'detalles' },
    { clave: 'duracion_real_min', etiqueta: 'Duración real (min)', tipo_dato: 'numero', origen: 'columna', grupo: 'detalles' },

    // Ubicación
    { clave: 'direccion_texto', etiqueta: 'Dirección', tipo_dato: 'texto', origen: 'columna', grupo: 'ubicacion' },

    // Personas
    { clave: 'asignado_nombre', etiqueta: 'Técnico asignado', tipo_dato: 'texto', origen: 'columna', grupo: 'relacion' },
    { clave: 'contacto_nombre', etiqueta: 'Contacto', tipo_dato: 'texto', origen: 'columna', grupo: 'relacion' },
    { clave: 'recibe_nombre', etiqueta: 'Recibe (persona)', descripcion: 'Quien recibe al visitador', tipo_dato: 'texto', origen: 'columna', grupo: 'relacion' },
    { clave: 'recibe_telefono', etiqueta: 'Teléfono de quien recibe', tipo_dato: 'telefono', origen: 'columna', grupo: 'relacion' },
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
// ─────────────────────────────────────────────────────
// CONVERSACIÓN — Datos del inbox omnicanal
// Columnas BD: tipo_canal, estado, asunto, contacto_nombre,
// asignado_a_nombre, ultimo_mensaje_texto, ultimo_mensaje_en
// ─────────────────────────────────────────────────────
registrarEntidad({
  clave: 'conversacion',
  etiqueta: 'Conversación',
  icono: icono(MessageSquare),
  variables: [
    { clave: 'tipo_canal', etiqueta: 'Canal', descripcion: 'whatsapp, correo o interno', tipo_dato: 'texto', origen: 'columna', grupo: 'basico' },
    { clave: 'estado', etiqueta: 'Estado', tipo_dato: 'texto', origen: 'columna', grupo: 'basico' },
    { clave: 'asunto', etiqueta: 'Asunto', tipo_dato: 'texto', origen: 'columna', grupo: 'basico' },
    { clave: 'ultimo_mensaje_texto', etiqueta: 'Último mensaje', tipo_dato: 'texto', origen: 'columna', grupo: 'basico' },
    { clave: 'ultimo_mensaje_en', etiqueta: 'Fecha último mensaje', tipo_dato: 'fecha_hora', origen: 'columna', grupo: 'fechas' },

    { clave: 'asignado_a_nombre', etiqueta: 'Asignado a', tipo_dato: 'texto', origen: 'columna', grupo: 'relacion' },
    { clave: 'contacto_nombre', etiqueta: 'Contacto', tipo_dato: 'texto', origen: 'columna', grupo: 'relacion' },
  ],
})

// ─────────────────────────────────────────────────────
// ASISTENCIA — Registro de fichaje
// ─────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────
// ASISTENCIA — Registro de fichaje
// Columnas BD: fecha, estado, hora_entrada, hora_salida, inicio_almuerzo, fin_almuerzo,
// tipo, metodo_registro, notas
// ─────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────
// ASISTENCIA — Registro de fichaje (un registro = un día)
// Columnas BD: fecha, estado, hora_entrada, hora_salida, inicio_almuerzo, fin_almuerzo,
// salida_particular, vuelta_particular, tipo, puntualidad_min, metodo_registro,
// terminal_nombre, notas, cierre_automatico
// Para totales por período (semana/quincena/mes) → ver Nómina
// ─────────────────────────────────────────────────────
registrarEntidad({
  clave: 'asistencia',
  etiqueta: 'Asistencia',
  icono: icono(Clock),
  variables: [
    // Básico
    { clave: 'fecha', etiqueta: 'Fecha', tipo_dato: 'fecha', origen: 'columna', grupo: 'basico' },
    { clave: 'estado', etiqueta: 'Estado', descripcion: 'activo, almuerzo, cerrado, etc.', tipo_dato: 'texto', origen: 'columna', grupo: 'basico' },
    { clave: 'tipo', etiqueta: 'Tipo', descripcion: 'normal, tardanza, adelanto, feriado', tipo_dato: 'texto', origen: 'columna', grupo: 'basico' },

    // Horarios
    { clave: 'hora_entrada', etiqueta: 'Hora de entrada', tipo_dato: 'fecha_hora', origen: 'columna', grupo: 'basico' },
    { clave: 'hora_salida', etiqueta: 'Hora de salida', tipo_dato: 'fecha_hora', origen: 'columna', grupo: 'basico' },
    { clave: 'inicio_almuerzo', etiqueta: 'Inicio almuerzo', tipo_dato: 'fecha_hora', origen: 'columna', grupo: 'basico' },
    { clave: 'fin_almuerzo', etiqueta: 'Fin almuerzo', tipo_dato: 'fecha_hora', origen: 'columna', grupo: 'basico' },
    { clave: 'salida_particular', etiqueta: 'Salida particular', tipo_dato: 'fecha_hora', origen: 'columna', grupo: 'basico' },
    { clave: 'vuelta_particular', etiqueta: 'Vuelta particular', tipo_dato: 'fecha_hora', origen: 'columna', grupo: 'basico' },

    // Calculadas del día
    { clave: 'horas_brutas', etiqueta: 'Horas brutas del día', descripcion: 'Desde entrada hasta salida', tipo_dato: 'texto', origen: 'calculado', grupo: 'detalles',
      calcular: (d) => {
        if (!d.hora_entrada || !d.hora_salida) return ''
        const ms = new Date(d.hora_salida as string).getTime() - new Date(d.hora_entrada as string).getTime()
        if (ms <= 0) return ''
        const h = Math.floor(ms / 3600000); const m = Math.floor((ms % 3600000) / 60000)
        return `${h}h ${m}min`
      } },
    { clave: 'horas_almuerzo', etiqueta: 'Tiempo de almuerzo', tipo_dato: 'texto', origen: 'calculado', grupo: 'detalles',
      calcular: (d) => {
        if (!d.inicio_almuerzo || !d.fin_almuerzo) return ''
        const ms = new Date(d.fin_almuerzo as string).getTime() - new Date(d.inicio_almuerzo as string).getTime()
        if (ms <= 0) return ''
        const h = Math.floor(ms / 3600000); const m = Math.floor((ms % 3600000) / 60000)
        return h > 0 ? `${h}h ${m}min` : `${m}min`
      } },
    { clave: 'horas_particular', etiqueta: 'Tiempo salida particular', tipo_dato: 'texto', origen: 'calculado', grupo: 'detalles',
      calcular: (d) => {
        if (!d.salida_particular || !d.vuelta_particular) return ''
        const ms = new Date(d.vuelta_particular as string).getTime() - new Date(d.salida_particular as string).getTime()
        if (ms <= 0) return ''
        const h = Math.floor(ms / 3600000); const m = Math.floor((ms % 3600000) / 60000)
        return h > 0 ? `${h}h ${m}min` : `${m}min`
      } },
    { clave: 'horas_netas', etiqueta: 'Horas netas trabajadas', descripcion: 'Brutas menos almuerzo y particular', tipo_dato: 'texto', origen: 'calculado', grupo: 'detalles',
      calcular: (d) => {
        if (!d.hora_entrada || !d.hora_salida) return ''
        let ms = new Date(d.hora_salida as string).getTime() - new Date(d.hora_entrada as string).getTime()
        if (d.inicio_almuerzo && d.fin_almuerzo) ms -= (new Date(d.fin_almuerzo as string).getTime() - new Date(d.inicio_almuerzo as string).getTime())
        if (d.salida_particular && d.vuelta_particular) ms -= (new Date(d.vuelta_particular as string).getTime() - new Date(d.salida_particular as string).getTime())
        if (ms <= 0) return ''
        const h = Math.floor(ms / 3600000); const m = Math.floor((ms % 3600000) / 60000)
        return `${h}h ${m}min`
      } },
    { clave: 'puntualidad_min', etiqueta: 'Puntualidad (minutos)', descripcion: 'Positivo = llegó antes, negativo = tarde', tipo_dato: 'numero', origen: 'columna', grupo: 'detalles' },
    { clave: 'cierre_automatico', etiqueta: 'Cierre automático', descripcion: 'Si el sistema cerró la jornada', tipo_dato: 'booleano', origen: 'columna', grupo: 'detalles' },

    // Otros
    { clave: 'metodo_registro', etiqueta: 'Método de registro', tipo_dato: 'texto', origen: 'columna', grupo: 'detalles' },
    { clave: 'terminal_nombre', etiqueta: 'Terminal', descripcion: 'Kiosco o dispositivo usado', tipo_dato: 'texto', origen: 'columna', grupo: 'detalles' },
    { clave: 'notas', etiqueta: 'Notas', tipo_dato: 'texto', origen: 'columna', grupo: 'detalles' },
  ],
})

// INFORME — tabla no existe todavía, se agregará cuando se implemente el módulo

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
// ─────────────────────────────────────────────────────
// NÓMINA — Datos del pago de nómina
// Columnas BD (pagos_nomina): concepto, monto_sugerido, monto_abonado,
// fecha_inicio_periodo, fecha_fin_periodo, dias_habiles, dias_trabajados,
// dias_ausentes, tardanzas, notas, creado_por_nombre
// ─────────────────────────────────────────────────────
registrarEntidad({
  clave: 'nomina',
  etiqueta: 'Nómina',
  icono: icono(DollarSign),
  variables: [
    { clave: 'concepto', etiqueta: 'Concepto', tipo_dato: 'texto', origen: 'columna', grupo: 'basico' },
    { clave: 'fecha_inicio_periodo', etiqueta: 'Inicio del período', tipo_dato: 'fecha', origen: 'columna', grupo: 'fechas' },
    { clave: 'fecha_fin_periodo', etiqueta: 'Fin del período', tipo_dato: 'fecha', origen: 'columna', grupo: 'fechas' },

    { clave: 'dias_habiles', etiqueta: 'Días hábiles', tipo_dato: 'numero', origen: 'columna', grupo: 'detalles' },
    { clave: 'dias_trabajados', etiqueta: 'Días trabajados', tipo_dato: 'numero', origen: 'columna', grupo: 'detalles' },
    { clave: 'dias_ausentes', etiqueta: 'Días ausentes', tipo_dato: 'numero', origen: 'columna', grupo: 'detalles' },
    { clave: 'tardanzas', etiqueta: 'Tardanzas', tipo_dato: 'numero', origen: 'columna', grupo: 'detalles' },

    { clave: 'monto_sugerido', etiqueta: 'Monto sugerido', tipo_dato: 'moneda', origen: 'columna', grupo: 'financiero' },
    { clave: 'monto_abonado', etiqueta: 'Monto abonado', tipo_dato: 'moneda', origen: 'columna', grupo: 'financiero' },
    { clave: 'notas', etiqueta: 'Notas', tipo_dato: 'texto', origen: 'columna', grupo: 'detalles' },

    { clave: 'creado_por_nombre', etiqueta: 'Creado por', tipo_dato: 'texto', origen: 'columna', grupo: 'relacion' },
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
