import { pgTable, uuid, text, boolean, timestamp, jsonb, uniqueIndex, index, numeric, integer, date, doublePrecision, check, primaryKey } from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'

/**
 * Schema de Drizzle ORM para Flux by Salix.
 * Tablas globales (sin RLS) para auth y multi-tenant.
 * Tablas de negocio con empresa_id + RLS.
 */

// Empresas — cada organización en Flux
export const empresas = pgTable('empresas', {
  id: uuid('id').primaryKey().defaultRandom(),
  nombre: text('nombre').notNull(),
  slug: text('slug').notNull().unique(),
  logo_url: text('logo_url'),
  pais: text('pais'), // país principal (legacy)
  paises: text('paises').array().notNull().default(sql`'{}'`), // países donde opera la empresa
  color_marca: text('color_marca'),
  descripcion: text('descripcion'),
  datos_fiscales: jsonb('datos_fiscales').notNull().default(sql`'{}'`), // datos fiscales dinámicos según país (cuit, condicion_iva, etc.)
  datos_bancarios: jsonb('datos_bancarios').notNull().default(sql`'{}'`), // {banco, titular, numero_cuenta, cbu, alias}
  creado_en: timestamp('creado_en', { withTimezone: true }).defaultNow().notNull(),
})

// Perfiles — datos del usuario, FK a auth.users
export const perfiles = pgTable('perfiles', {
  id: uuid('id').primaryKey(), // FK a auth.users.id (se setea manualmente)
  nombre: text('nombre').notNull(),
  apellido: text('apellido').notNull(),
  avatar_url: text('avatar_url'),
  telefono: text('telefono'),
  creado_en: timestamp('creado_en', { withTimezone: true }).defaultNow().notNull(),
  actualizado_en: timestamp('actualizado_en', { withTimezone: true }).defaultNow().notNull(),
})

// Miembros — relación usuario↔empresa con rol y estado de activación
export const miembros = pgTable('miembros', {
  id: uuid('id').primaryKey().defaultRandom(),
  usuario_id: uuid('usuario_id').notNull(),
  empresa_id: uuid('empresa_id').notNull().references(() => empresas.id, { onDelete: 'cascade' }),
  rol: text('rol').notNull().default('empleado'),
  activo: boolean('activo').notNull().default(false),
  permisos_custom: jsonb('permisos_custom'),
  unido_en: timestamp('unido_en', { withTimezone: true }).defaultNow().notNull(),
  // Compensación / nómina
  compensacion_tipo: text('compensacion_tipo').default('fijo'), // 'fijo' | 'por_dia' | 'por_hora'
  compensacion_monto: numeric('compensacion_monto').default('0'),
  compensacion_frecuencia: text('compensacion_frecuencia').default('mensual'), // 'semanal' | 'quincenal' | 'mensual' | 'eventual'
  dias_trabajo: integer('dias_trabajo').default(5), // 1-7 días por semana
}, (tabla) => [
  uniqueIndex('miembros_usuario_empresa_idx').on(tabla.usuario_id, tabla.empresa_id),
  index('miembros_empresa_idx').on(tabla.empresa_id),
])

// Invitaciones — tokens para unirse a una empresa
export const invitaciones = pgTable('invitaciones', {
  id: uuid('id').primaryKey().defaultRandom(),
  token: text('token').notNull().unique(),
  empresa_id: uuid('empresa_id').notNull().references(() => empresas.id, { onDelete: 'cascade' }),
  rol: text('rol').notNull().default('empleado'),
  correo: text('correo').notNull(),
  creado_por: uuid('creado_por').notNull(),
  usado: boolean('usado').notNull().default(false),
  creado_en: timestamp('creado_en', { withTimezone: true }).defaultNow().notNull(),
  expira_en: timestamp('expira_en', { withTimezone: true }).notNull(),
}, (tabla) => [
  index('invitaciones_token_idx').on(tabla.token),
  index('invitaciones_empresa_idx').on(tabla.empresa_id),
])

// Vistas guardadas — snapshots de filtros/búsqueda/orden por usuario y módulo
export const vistas_guardadas = pgTable('vistas_guardadas', {
  id: uuid('id').primaryKey().defaultRandom(),
  usuario_id: uuid('usuario_id').notNull(),
  empresa_id: uuid('empresa_id').notNull().references(() => empresas.id, { onDelete: 'cascade' }),
  modulo: text('modulo').notNull(),
  nombre: text('nombre').notNull(),
  predefinida: boolean('predefinida').notNull().default(false),
  estado: jsonb('estado').notNull().default({}),
  creado_en: timestamp('creado_en', { withTimezone: true }).defaultNow().notNull(),
  actualizado_en: timestamp('actualizado_en', { withTimezone: true }).defaultNow().notNull(),
}, (tabla) => [
  index('vistas_guardadas_usuario_modulo_idx').on(tabla.usuario_id, tabla.empresa_id, tabla.modulo),
])

// Permisos Auditoria — registro de cambios en permisos de miembros
export const permisos_auditoria = pgTable('permisos_auditoria', {
  id: uuid('id').primaryKey().defaultRandom(),
  empresa_id: uuid('empresa_id').notNull().references(() => empresas.id, { onDelete: 'cascade' }),
  miembro_id: uuid('miembro_id').notNull().references(() => miembros.id, { onDelete: 'cascade' }),
  modulo: text('modulo'), // null = cambio global (revocacion total, restablecer)
  accion_tipo: text('accion_tipo').notNull(), // 'editar_permisos' | 'revocar_todo' | 'restablecer_rol'
  permisos_antes: jsonb('permisos_antes'), // snapshot de permisos antes del cambio
  permisos_despues: jsonb('permisos_despues'), // snapshot de permisos despues del cambio
  motivo: text('motivo'), // obligatorio en revocacion de emergencia
  editado_por: uuid('editado_por').notNull(), // usuario_id del propietario que hizo el cambio
  editado_en: timestamp('editado_en', { withTimezone: true }).defaultNow().notNull(),
}, (tabla) => [
  index('permisos_auditoria_miembro_idx').on(tabla.miembro_id),
  index('permisos_auditoria_empresa_idx').on(tabla.empresa_id),
])

// Pagos de nómina — registros de liquidación por miembro
export const pagos_nomina = pgTable('pagos_nomina', {
  id: uuid('id').primaryKey().defaultRandom(),
  empresa_id: uuid('empresa_id').notNull().references(() => empresas.id, { onDelete: 'cascade' }),
  miembro_id: uuid('miembro_id').notNull().references(() => miembros.id, { onDelete: 'cascade' }),
  // Período
  fecha_inicio_periodo: date('fecha_inicio_periodo').notNull(),
  fecha_fin_periodo: date('fecha_fin_periodo').notNull(),
  concepto: text('concepto').notNull(),
  // Montos
  monto_sugerido: numeric('monto_sugerido').notNull().default('0'),
  monto_abonado: numeric('monto_abonado').notNull().default('0'),
  // Estadísticas snapshot
  dias_habiles: integer('dias_habiles').notNull().default(0),
  dias_trabajados: integer('dias_trabajados').notNull().default(0),
  dias_ausentes: integer('dias_ausentes').notNull().default(0),
  tardanzas: integer('tardanzas').notNull().default(0),
  // Comprobante y notas
  comprobante_url: text('comprobante_url'),
  notas: text('notas'),
  // Auditoría
  creado_por: uuid('creado_por').notNull(),
  creado_por_nombre: text('creado_por_nombre').notNull(),
  creado_en: timestamp('creado_en', { withTimezone: true }).defaultNow().notNull(),
  editado_por: uuid('editado_por'),
  editado_en: timestamp('editado_en', { withTimezone: true }),
  // Soft delete
  eliminado: boolean('eliminado').notNull().default(false),
  eliminado_en: timestamp('eliminado_en', { withTimezone: true }),
  eliminado_por: uuid('eliminado_por'),
}, (tabla) => [
  index('pagos_nomina_empresa_idx').on(tabla.empresa_id),
  index('pagos_nomina_miembro_idx').on(tabla.miembro_id),
  index('pagos_nomina_periodo_idx').on(tabla.empresa_id, tabla.miembro_id, tabla.fecha_inicio_periodo),
])

// ═══════════════════════════════════════════════════════════════
// SISTEMA DE CONTACTOS
// ═══════════════════════════════════════════════════════════════

// Tipos de contacto — configurables por empresa (persona, empresa, edificio, etc.)
export const tipos_contacto = pgTable('tipos_contacto', {
  id: uuid('id').primaryKey().defaultRandom(),
  empresa_id: uuid('empresa_id').notNull().references(() => empresas.id, { onDelete: 'cascade' }),
  clave: text('clave').notNull(),
  etiqueta: text('etiqueta').notNull(),
  icono: text('icono').notNull().default('user'),
  color: text('color').notNull().default('primario'),
  puede_tener_hijos: boolean('puede_tener_hijos').notNull().default(false),
  es_predefinido: boolean('es_predefinido').notNull().default(false),
  orden: integer('orden').notNull().default(0),
  activo: boolean('activo').notNull().default(true),
  creado_en: timestamp('creado_en', { withTimezone: true }).defaultNow().notNull(),
}, (tabla) => [
  uniqueIndex('tipos_contacto_empresa_clave_idx').on(tabla.empresa_id, tabla.clave),
  index('tipos_contacto_empresa_idx').on(tabla.empresa_id),
])

// Tipos de relación — configurables por empresa (empleado_de, administra, etc.)
export const tipos_relacion = pgTable('tipos_relacion', {
  id: uuid('id').primaryKey().defaultRandom(),
  empresa_id: uuid('empresa_id').notNull().references(() => empresas.id, { onDelete: 'cascade' }),
  clave: text('clave').notNull(),
  etiqueta: text('etiqueta').notNull(),
  etiqueta_inversa: text('etiqueta_inversa').notNull(),
  es_predefinido: boolean('es_predefinido').notNull().default(false),
  activo: boolean('activo').notNull().default(true),
  creado_en: timestamp('creado_en', { withTimezone: true }).defaultNow().notNull(),
}, (tabla) => [
  uniqueIndex('tipos_relacion_empresa_clave_idx').on(tabla.empresa_id, tabla.clave),
  index('tipos_relacion_empresa_idx').on(tabla.empresa_id),
])

// Campos fiscales por país — tabla global de referencia (sin empresa_id)
export const campos_fiscales_pais = pgTable('campos_fiscales_pais', {
  id: uuid('id').primaryKey().defaultRandom(),
  pais: text('pais').notNull(),
  clave: text('clave').notNull(),
  etiqueta: text('etiqueta').notNull(),
  tipo_campo: text('tipo_campo').notNull().default('texto'), // 'texto', 'select', 'numero'
  opciones: jsonb('opciones'), // para selects
  obligatorio: boolean('obligatorio').notNull().default(false),
  patron_validacion: text('patron_validacion'), // regex
  mascara: text('mascara'), // máscara de input
  orden: integer('orden').notNull().default(0),
  aplica_a: text('aplica_a').array().notNull().default(sql`'{}'`), // tipos de contacto
  es_identificacion: boolean('es_identificacion').notNull().default(false), // true = campo de identidad (DNI, CUIT, RFC, etc.)
}, (tabla) => [
  uniqueIndex('campos_fiscales_pais_clave_idx').on(tabla.pais, tabla.clave),
])

// Contactos — tabla principal de CRM
export const contactos = pgTable('contactos', {
  id: uuid('id').primaryKey().defaultRandom(),
  empresa_id: uuid('empresa_id').notNull().references(() => empresas.id, { onDelete: 'cascade' }),
  tipo_contacto_id: uuid('tipo_contacto_id').notNull().references(() => tipos_contacto.id),
  codigo: text('codigo').notNull(),

  // Identidad
  nombre: text('nombre').notNull(),
  apellido: text('apellido'),
  titulo: text('titulo'), // Sr., Dra., Ing.

  // Contacto directo
  correo: text('correo'),
  telefono: text('telefono'),
  whatsapp: text('whatsapp'),
  web: text('web'),

  // Laboral
  cargo: text('cargo'),
  rubro: text('rubro'),

  // Comercial
  moneda: text('moneda').default('ARS'),
  idioma: text('idioma').default('es'),
  zona_horaria: text('zona_horaria'),
  limite_credito: numeric('limite_credito'),
  plazo_pago_cliente: text('plazo_pago_cliente'),
  plazo_pago_proveedor: text('plazo_pago_proveedor'),
  rank_cliente: integer('rank_cliente'),
  rank_proveedor: integer('rank_proveedor'),

  // Identificación fiscal
  pais_fiscal: text('pais_fiscal'), // código de país (AR, MX, CO, ES) — determina qué campos fiscales aplican
  tipo_identificacion: text('tipo_identificacion'),
  numero_identificacion: text('numero_identificacion'),
  datos_fiscales: jsonb('datos_fiscales').default({}), // campos específicos del país

  // Etiquetas (array nativo)
  etiquetas: text('etiquetas').array().default(sql`'{}'`),

  // Notas
  notas: text('notas'),

  // Estado
  activo: boolean('activo').notNull().default(true),
  en_papelera: boolean('en_papelera').notNull().default(false),
  papelera_en: timestamp('papelera_en', { withTimezone: true }),
  es_provisorio: boolean('es_provisorio').notNull().default(false),

  // Origen
  origen: text('origen').notNull().default('manual'),

  // Vínculo con usuario (tipo 'equipo' se sincroniza con miembro)
  miembro_id: uuid('miembro_id').references(() => miembros.id, { onDelete: 'set null' }),

  // Auditoría
  creado_por: uuid('creado_por').notNull(),
  editado_por: uuid('editado_por'),
  creado_en: timestamp('creado_en', { withTimezone: true }).defaultNow().notNull(),
  actualizado_en: timestamp('actualizado_en', { withTimezone: true }).defaultNow().notNull(),
}, (tabla) => [
  uniqueIndex('contactos_empresa_codigo_idx').on(tabla.empresa_id, tabla.codigo),
  index('contactos_empresa_idx').on(tabla.empresa_id),
  index('contactos_tipo_idx').on(tabla.empresa_id, tabla.tipo_contacto_id),
  index('contactos_correo_idx').on(tabla.empresa_id, tabla.correo),
  index('contactos_telefono_idx').on(tabla.empresa_id, tabla.telefono),
  index('contactos_whatsapp_idx').on(tabla.empresa_id, tabla.whatsapp),
  index('contactos_miembro_idx').on(tabla.miembro_id),
])

// Vinculaciones entre contactos — tabla intermedia bidireccional
export const contacto_vinculaciones = pgTable('contacto_vinculaciones', {
  id: uuid('id').primaryKey().defaultRandom(),
  empresa_id: uuid('empresa_id').notNull().references(() => empresas.id, { onDelete: 'cascade' }),
  contacto_id: uuid('contacto_id').notNull().references(() => contactos.id, { onDelete: 'cascade' }),
  vinculado_id: uuid('vinculado_id').notNull().references(() => contactos.id, { onDelete: 'cascade' }),
  tipo_relacion_id: uuid('tipo_relacion_id').references(() => tipos_relacion.id, { onDelete: 'set null' }),
  puesto: text('puesto'), // rol contextual libre
  recibe_documentos: boolean('recibe_documentos').notNull().default(false),
  creado_en: timestamp('creado_en', { withTimezone: true }).defaultNow().notNull(),
}, (tabla) => [
  uniqueIndex('vinculaciones_unica_idx').on(tabla.contacto_id, tabla.vinculado_id),
  index('vinculaciones_contacto_idx').on(tabla.contacto_id),
  index('vinculaciones_vinculado_idx').on(tabla.vinculado_id),
  index('vinculaciones_empresa_idx').on(tabla.empresa_id),
  check('no_auto_vinculacion', sql`contacto_id <> vinculado_id`),
])

// Direcciones de contacto
export const contacto_direcciones = pgTable('contacto_direcciones', {
  id: uuid('id').primaryKey().defaultRandom(),
  contacto_id: uuid('contacto_id').notNull().references(() => contactos.id, { onDelete: 'cascade' }),
  tipo: text('tipo').notNull().default('principal'), // 'principal', 'fiscal', 'entrega', 'otra'
  calle: text('calle'),
  numero: text('numero'),
  piso: text('piso'),
  departamento: text('departamento'),
  barrio: text('barrio'),
  ciudad: text('ciudad'),
  provincia: text('provincia'),
  codigo_postal: text('codigo_postal'),
  pais: text('pais'),
  timbre: text('timbre'),
  lat: doublePrecision('lat'),
  lng: doublePrecision('lng'),
  texto: text('texto'), // dirección completa formateada
  es_principal: boolean('es_principal').notNull().default(false),
  creado_en: timestamp('creado_en', { withTimezone: true }).defaultNow().notNull(),
}, (tabla) => [
  index('direcciones_contacto_idx').on(tabla.contacto_id),
])

// Responsables asignados a un contacto
export const contacto_responsables = pgTable('contacto_responsables', {
  contacto_id: uuid('contacto_id').notNull().references(() => contactos.id, { onDelete: 'cascade' }),
  usuario_id: uuid('usuario_id').notNull(),
  asignado_en: timestamp('asignado_en', { withTimezone: true }).defaultNow().notNull(),
}, (tabla) => [
  primaryKey({ columns: [tabla.contacto_id, tabla.usuario_id] }),
  index('responsables_usuario_idx').on(tabla.usuario_id),
])

// Seguidores de contacto — reciben notificaciones
export const contacto_seguidores = pgTable('contacto_seguidores', {
  contacto_id: uuid('contacto_id').notNull().references(() => contactos.id, { onDelete: 'cascade' }),
  usuario_id: uuid('usuario_id').notNull(),
  modo_copia: text('modo_copia'), // null = solo notificación, 'CC', 'CCO'
  agregado_en: timestamp('agregado_en', { withTimezone: true }).defaultNow().notNull(),
}, (tabla) => [
  primaryKey({ columns: [tabla.contacto_id, tabla.usuario_id] }),
  index('seguidores_usuario_idx').on(tabla.usuario_id),
])

// Secuencias — generador de códigos atómicos por empresa y entidad
export const secuencias = pgTable('secuencias', {
  empresa_id: uuid('empresa_id').notNull().references(() => empresas.id, { onDelete: 'cascade' }),
  entidad: text('entidad').notNull(), // 'contacto', 'presupuesto', 'factura', etc.
  prefijo: text('prefijo').notNull().default('C'),
  siguiente: integer('siguiente').notNull().default(1),
  digitos: integer('digitos').notNull().default(4),
}, (tabla) => [
  primaryKey({ columns: [tabla.empresa_id, tabla.entidad] }),
])

// ═══════════════════════════════════════════════════════════════
// SISTEMA DE PRESUPUESTOS
// ═══════════════════════════════════════════════════════════════

// Presupuestos — cotizaciones comerciales vinculadas a contactos
export const presupuestos = pgTable('presupuestos', {
  id: uuid('id').primaryKey().defaultRandom(),
  empresa_id: uuid('empresa_id').notNull().references(() => empresas.id, { onDelete: 'cascade' }),
  numero: text('numero').notNull(), // P-0001 (generado por secuencia)
  estado: text('estado').notNull().default('borrador'), // borrador, enviado, aceptado, rechazado, vencido, cancelado

  // Contacto vinculado (snapshot al crear)
  contacto_id: uuid('contacto_id').references(() => contactos.id, { onDelete: 'set null' }),
  contacto_nombre: text('contacto_nombre'),
  contacto_apellido: text('contacto_apellido'),
  contacto_tipo: text('contacto_tipo'), // persona, empresa, etc.
  contacto_identificacion: text('contacto_identificacion'), // CUIT, DNI, etc.
  contacto_condicion_iva: text('contacto_condicion_iva'),
  contacto_direccion: text('contacto_direccion'),
  contacto_correo: text('contacto_correo'),
  contacto_telefono: text('contacto_telefono'),

  // Dirigido a (persona dentro de empresa, opcional)
  atencion_contacto_id: uuid('atencion_contacto_id').references(() => contactos.id, { onDelete: 'set null' }),
  atencion_nombre: text('atencion_nombre'),
  atencion_correo: text('atencion_correo'),
  atencion_cargo: text('atencion_cargo'),

  // Referencia interna opcional
  referencia: text('referencia'),

  // Moneda y condiciones de pago
  moneda: text('moneda').notNull().default('ARS'),
  cotizacion_cambio: numeric('cotizacion_cambio').default('1'), // tipo de cambio
  condicion_pago_id: text('condicion_pago_id'),
  condicion_pago_label: text('condicion_pago_label'),
  condicion_pago_tipo: text('condicion_pago_tipo'), // plazo_fijo, hitos

  // Fechas
  fecha_emision: timestamp('fecha_emision', { withTimezone: true }).defaultNow().notNull(),
  dias_vencimiento: integer('dias_vencimiento').notNull().default(30),
  fecha_vencimiento: timestamp('fecha_vencimiento', { withTimezone: true }),

  // Totales (calculados desde líneas)
  subtotal_neto: numeric('subtotal_neto').notNull().default('0'),
  total_impuestos: numeric('total_impuestos').notNull().default('0'),
  descuento_global: numeric('descuento_global').notNull().default('0'), // porcentaje
  descuento_global_monto: numeric('descuento_global_monto').notNull().default('0'),
  total_final: numeric('total_final').notNull().default('0'),

  // Columnas visibles en la tabla de líneas (configurable por presupuesto)
  columnas_lineas: jsonb('columnas_lineas').default(sql`'["producto","descripcion","cantidad","unidad","precio_unitario","descuento","impuesto","subtotal"]'`),

  // Notas y condiciones (HTML rico)
  notas_html: text('notas_html'),
  condiciones_html: text('condiciones_html'),
  nota_plan_pago: text('nota_plan_pago'),

  // PDF
  pdf_url: text('pdf_url'),
  pdf_miniatura_url: text('pdf_miniatura_url'),
  pdf_storage_path: text('pdf_storage_path'),
  pdf_generado_en: timestamp('pdf_generado_en', { withTimezone: true }),
  // PDF firmado (certificado de aceptación)
  pdf_firmado_url: text('pdf_firmado_url'),
  pdf_firmado_storage_path: text('pdf_firmado_storage_path'),

  // Vinculación con documento origen (para cadena presupuesto → factura)
  origen_documento_id: uuid('origen_documento_id'),
  origen_documento_numero: text('origen_documento_numero'),

  // Auditoría
  creado_por: uuid('creado_por').notNull(),
  creado_por_nombre: text('creado_por_nombre'),
  editado_por: uuid('editado_por'),
  editado_por_nombre: text('editado_por_nombre'),
  creado_en: timestamp('creado_en', { withTimezone: true }).defaultNow().notNull(),
  actualizado_en: timestamp('actualizado_en', { withTimezone: true }).defaultNow().notNull(),

  // Soft delete
  activo: boolean('activo').notNull().default(true),
  en_papelera: boolean('en_papelera').notNull().default(false),
  papelera_en: timestamp('papelera_en', { withTimezone: true }),
}, (tabla) => [
  uniqueIndex('presupuestos_empresa_numero_idx').on(tabla.empresa_id, tabla.numero),
  index('presupuestos_empresa_idx').on(tabla.empresa_id),
  index('presupuestos_contacto_idx').on(tabla.contacto_id),
  index('presupuestos_estado_idx').on(tabla.empresa_id, tabla.estado),
  index('presupuestos_fecha_idx').on(tabla.empresa_id, tabla.fecha_emision),
])

// Líneas de presupuesto — productos, servicios, secciones, notas, descuentos
export const lineas_presupuesto = pgTable('lineas_presupuesto', {
  id: uuid('id').primaryKey().defaultRandom(),
  presupuesto_id: uuid('presupuesto_id').notNull().references(() => presupuestos.id, { onDelete: 'cascade' }),
  empresa_id: uuid('empresa_id').notNull().references(() => empresas.id, { onDelete: 'cascade' }),

  // Tipo de línea: producto (calculable), seccion (separador visual), nota (texto libre), descuento (monto fijo)
  tipo_linea: text('tipo_linea').notNull().default('producto'), // producto, seccion, nota, descuento
  orden: integer('orden').notNull().default(0),

  // Datos del producto/servicio (solo tipo_linea = 'producto')
  codigo_producto: text('codigo_producto'),
  descripcion: text('descripcion'),
  descripcion_detalle: text('descripcion_detalle'), // descripción extendida
  cantidad: numeric('cantidad').default('1'),
  unidad: text('unidad'), // hs, un, kg, m2, etc.
  precio_unitario: numeric('precio_unitario').default('0'),
  descuento: numeric('descuento').default('0'), // porcentaje por línea
  impuesto_label: text('impuesto_label'), // "IVA 21%"
  impuesto_porcentaje: numeric('impuesto_porcentaje').default('0'),

  // Calculados
  subtotal: numeric('subtotal').default('0'), // cantidad * precio * (1 - descuento/100)
  impuesto_monto: numeric('impuesto_monto').default('0'),
  total: numeric('total').default('0'),

  // Para tipo_linea = 'descuento' (monto fijo negativo)
  monto: numeric('monto'),

  creado_en: timestamp('creado_en', { withTimezone: true }).defaultNow().notNull(),
}, (tabla) => [
  index('lineas_presupuesto_presupuesto_idx').on(tabla.presupuesto_id),
  index('lineas_presupuesto_empresa_idx').on(tabla.empresa_id),
  index('lineas_presupuesto_orden_idx').on(tabla.presupuesto_id, tabla.orden),
])

// Historial de estados de presupuesto
export const presupuesto_historial = pgTable('presupuesto_historial', {
  id: uuid('id').primaryKey().defaultRandom(),
  presupuesto_id: uuid('presupuesto_id').notNull().references(() => presupuestos.id, { onDelete: 'cascade' }),
  empresa_id: uuid('empresa_id').notNull().references(() => empresas.id, { onDelete: 'cascade' }),
  estado: text('estado').notNull(),
  usuario_id: uuid('usuario_id').notNull(),
  usuario_nombre: text('usuario_nombre'),
  fecha: timestamp('fecha', { withTimezone: true }).defaultNow().notNull(),
  notas: text('notas'), // motivo de rechazo, etc.
}, (tabla) => [
  index('presupuesto_historial_presupuesto_idx').on(tabla.presupuesto_id),
])

// Cuotas de pago de presupuesto (para condición tipo 'hitos')
export const presupuesto_cuotas = pgTable('presupuesto_cuotas', {
  id: uuid('id').primaryKey().defaultRandom(),
  presupuesto_id: uuid('presupuesto_id').notNull().references(() => presupuestos.id, { onDelete: 'cascade' }),
  empresa_id: uuid('empresa_id').notNull().references(() => empresas.id, { onDelete: 'cascade' }),
  numero: integer('numero').notNull(),
  descripcion: text('descripcion'),
  porcentaje: numeric('porcentaje').notNull(),
  monto: numeric('monto').notNull().default('0'),
  dias_desde_emision: integer('dias_desde_emision').default(0),
  estado: text('estado').notNull().default('pendiente'), // pendiente, cobrada
  fecha_cobro: timestamp('fecha_cobro', { withTimezone: true }),
  cobrado_por_nombre: text('cobrado_por_nombre'),
}, (tabla) => [
  index('presupuesto_cuotas_presupuesto_idx').on(tabla.presupuesto_id),
])

// Configuración de presupuestos por empresa (JSONB flexible)
export const config_presupuestos = pgTable('config_presupuestos', {
  empresa_id: uuid('empresa_id').primaryKey().references(() => empresas.id, { onDelete: 'cascade' }),

  // Impuestos disponibles
  impuestos: jsonb('impuestos').notNull().default(sql`'[{"id":"iva21","label":"IVA 21%","porcentaje":21,"activo":true},{"id":"iva105","label":"IVA 10.5%","porcentaje":10.5,"activo":true},{"id":"exento","label":"Exento","porcentaje":0,"activo":true}]'`),

  // Monedas disponibles
  monedas: jsonb('monedas').notNull().default(sql`'[{"id":"ARS","label":"Peso Argentino","simbolo":"$","activo":true},{"id":"USD","label":"Dólar","simbolo":"US$","activo":true},{"id":"EUR","label":"Euro","simbolo":"€","activo":true}]'`),
  moneda_predeterminada: text('moneda_predeterminada').notNull().default('ARS'),

  // Condiciones de pago
  condiciones_pago: jsonb('condiciones_pago').notNull().default(sql`'[{"id":"contado","label":"Contado","tipo":"plazo_fijo","diasVencimiento":0,"hitos":[],"notaPlanPago":"Pago al contado","predeterminado":false},{"id":"15dias","label":"15 días","tipo":"plazo_fijo","diasVencimiento":15,"hitos":[],"notaPlanPago":"Pago dentro de 15 días","predeterminado":false},{"id":"30dias","label":"30 días","tipo":"plazo_fijo","diasVencimiento":30,"hitos":[],"notaPlanPago":"Pago dentro de 30 días","predeterminado":true},{"id":"50_50","label":"50% adelanto + 50% al finalizar","tipo":"hitos","diasVencimiento":0,"hitos":[{"id":"h1","porcentaje":50,"descripcion":"Adelanto","diasDesdeEmision":0},{"id":"h2","porcentaje":50,"descripcion":"Al finalizar","diasDesdeEmision":0}],"predeterminado":false}]'`),

  // Días de vencimiento por defecto
  dias_vencimiento_predeterminado: integer('dias_vencimiento_predeterminado').notNull().default(30),

  // Condiciones y notas por defecto
  condiciones_predeterminadas: text('condiciones_predeterminadas'),
  notas_predeterminadas: text('notas_predeterminadas'),

  // Unidades de medida disponibles
  unidades: jsonb('unidades').notNull().default(sql`'[{"id":"un","label":"Unidad","abreviatura":"un"},{"id":"hs","label":"Hora","abreviatura":"hs"},{"id":"kg","label":"Kilogramo","abreviatura":"kg"},{"id":"m","label":"Metro","abreviatura":"m"},{"id":"m2","label":"Metro cuadrado","abreviatura":"m²"},{"id":"lt","label":"Litro","abreviatura":"lt"},{"id":"gl","label":"Global","abreviatura":"gl"}]'`),

  // Columnas por defecto para la tabla de líneas
  columnas_lineas_default: jsonb('columnas_lineas_default').default(sql`'["producto","descripcion","cantidad","unidad","precio_unitario","descuento","impuesto","subtotal"]'`),

  actualizado_en: timestamp('actualizado_en', { withTimezone: true }).defaultNow().notNull(),
})

// ═══════════════════════════════════════════════════════════════
// SISTEMA DE MÓDULOS / APLICACIONES
// ═══════════════════════════════════════════════════════════════

// Catálogo maestro de módulos disponibles en Flux (tabla global, sin RLS)
export const catalogo_modulos = pgTable('catalogo_modulos', {
  id: uuid('id').primaryKey().defaultRandom(),
  slug: text('slug').notNull().unique(),
  nombre: text('nombre').notNull(),
  descripcion: text('descripcion').notNull().default(''),
  icono: text('icono').notNull().default('box'),
  categoria: text('categoria').notNull().default('operacional'), // base, operacional, documentos, comunicacion, admin, premium
  es_base: boolean('es_base').notNull().default(false),
  requiere: text('requiere').array().notNull().default(sql`'{}'`),
  orden: integer('orden').notNull().default(0),
  precio_mensual_usd: numeric('precio_mensual_usd').default('0'),
  precio_anual_usd: numeric('precio_anual_usd').default('0'),
  tier: text('tier').notNull().default('free'), // free, starter, pro, enterprise
  version: text('version').notNull().default('1.0.0'),
  destacado: boolean('destacado').notNull().default(false),
  visible: boolean('visible').notNull().default(true),
  creado_en: timestamp('creado_en', { withTimezone: true }).defaultNow().notNull(),
})

// Módulos instalados por empresa
export const modulos_empresa = pgTable('modulos_empresa', {
  id: uuid('id').primaryKey().defaultRandom(),
  empresa_id: uuid('empresa_id').notNull().references(() => empresas.id, { onDelete: 'cascade' }),
  modulo: text('modulo').notNull(), // slug del catálogo
  activo: boolean('activo').notNull().default(true),
  activado_en: timestamp('activado_en', { withTimezone: true }).defaultNow(),
  desactivado_en: timestamp('desactivado_en', { withTimezone: true }),
  config: jsonb('config').notNull().default(sql`'{}'`),
  catalogo_modulo_id: uuid('catalogo_modulo_id').references(() => catalogo_modulos.id),
  instalado_por: uuid('instalado_por'),
  version: text('version').default('1.0.0'),
  purga_programada_en: timestamp('purga_programada_en', { withTimezone: true }),
  purgado: boolean('purgado').notNull().default(false),
  notificacion_purga_enviada: boolean('notificacion_purga_enviada').notNull().default(false),
}, (tabla) => [
  uniqueIndex('modulos_empresa_unico_idx').on(tabla.empresa_id, tabla.modulo),
  index('modulos_empresa_empresa_idx').on(tabla.empresa_id),
])

// Suscripciones por empresa (preparada para Stripe)
export const suscripciones = pgTable('suscripciones', {
  id: uuid('id').primaryKey().defaultRandom(),
  empresa_id: uuid('empresa_id').notNull().references(() => empresas.id, { onDelete: 'cascade' }),
  plan: text('plan').notNull().default('free'), // free, starter, pro, enterprise
  estado: text('estado').notNull().default('activa'), // activa, trial, vencida, cancelada
  stripe_customer_id: text('stripe_customer_id'),
  stripe_subscription_id: text('stripe_subscription_id'),
  inicio_en: timestamp('inicio_en', { withTimezone: true }).defaultNow().notNull(),
  vence_en: timestamp('vence_en', { withTimezone: true }),
  trial_hasta: timestamp('trial_hasta', { withTimezone: true }),
  cancelado_en: timestamp('cancelado_en', { withTimezone: true }),
  limite_usuarios: integer('limite_usuarios'),
  limite_contactos: integer('limite_contactos'),
  limite_storage_mb: integer('limite_storage_mb'),
  creado_en: timestamp('creado_en', { withTimezone: true }).defaultNow().notNull(),
  actualizado_en: timestamp('actualizado_en', { withTimezone: true }).defaultNow().notNull(),
}, (tabla) => [
  uniqueIndex('suscripciones_empresa_unica_idx').on(tabla.empresa_id),
])

// Portal — tokens de acceso público para que clientes vean presupuestos sin auth
export const portal_tokens = pgTable('portal_tokens', {
  id: uuid('id').primaryKey().defaultRandom(),
  token: text('token').notNull().unique(),
  presupuesto_id: uuid('presupuesto_id').notNull().references(() => presupuestos.id, { onDelete: 'cascade' }),
  empresa_id: uuid('empresa_id').notNull().references(() => empresas.id, { onDelete: 'cascade' }),
  creado_por: uuid('creado_por').notNull(),
  creado_en: timestamp('creado_en', { withTimezone: true }).defaultNow().notNull(),
  expira_en: timestamp('expira_en', { withTimezone: true }).notNull(),
  visto_en: timestamp('visto_en', { withTimezone: true }),
  veces_visto: integer('veces_visto').notNull().default(0),
  activo: boolean('activo').notNull().default(true),
  // PDF firmado (certificado de aceptación)
  pdf_firmado_url: text('pdf_firmado_url'),
  pdf_firmado_storage_path: text('pdf_firmado_storage_path'),
}, (tabla) => [
  index('portal_tokens_token_idx').on(tabla.token),
  index('portal_tokens_presupuesto_idx').on(tabla.presupuesto_id),
  index('portal_tokens_empresa_idx').on(tabla.empresa_id),
])

// ═══════════════════════════════════════════════════════════════
// CHATTER — Mensajes y eventos vinculados a cualquier entidad
// ═══════════════════════════════════════════════════════════════

export const chatter = pgTable('chatter', {
  id: uuid('id').primaryKey().defaultRandom(),
  empresa_id: uuid('empresa_id').notNull().references(() => empresas.id, { onDelete: 'cascade' }),

  // Vínculo polimórfico
  entidad_tipo: text('entidad_tipo').notNull(), // 'presupuesto', 'contacto', 'orden', etc.
  entidad_id: uuid('entidad_id').notNull(),

  // Tipo de entrada
  tipo: text('tipo').notNull().default('mensaje'), // 'mensaje' | 'sistema' | 'nota_interna'

  // Contenido
  contenido: text('contenido').notNull(),

  // Autor
  autor_id: text('autor_id'), // uuid o 'portal', 'sistema', 'ia'
  autor_nombre: text('autor_nombre').notNull(),
  autor_avatar_url: text('autor_avatar_url'),

  // Adjuntos [{url, nombre, tipo, tamano}]
  adjuntos: jsonb('adjuntos').notNull().default(sql`'[]'`),

  // Metadata flexible {accion, detalles, ...}
  metadata: jsonb('metadata').notNull().default(sql`'{}'`),

  // Timestamps
  creado_en: timestamp('creado_en', { withTimezone: true }).defaultNow().notNull(),
  editado_en: timestamp('editado_en', { withTimezone: true }),
}, (tabla) => [
  index('chatter_entidad_idx').on(tabla.entidad_tipo, tabla.entidad_id),
  index('chatter_empresa_idx').on(tabla.empresa_id),
  index('chatter_fecha_idx').on(tabla.entidad_tipo, tabla.entidad_id, tabla.creado_en),
])

// ═══════════════════════════════════════════════════════════════
// SISTEMA DE PRODUCTOS Y SERVICIOS
// ═══════════════════════════════════════════════════════════════

// Productos — catálogo de productos y servicios por empresa
export const productos = pgTable('productos', {
  id: uuid('id').primaryKey().defaultRandom(),
  empresa_id: uuid('empresa_id').notNull().references(() => empresas.id, { onDelete: 'cascade' }),
  codigo: text('codigo').notNull(),
  nombre: text('nombre').notNull(),
  tipo: text('tipo').notNull().default('producto'), // 'producto' | 'servicio'

  // Categorización
  categoria: text('categoria'),
  favorito: boolean('favorito').notNull().default(false),
  referencia_interna: text('referencia_interna'),
  codigo_barras: text('codigo_barras'),
  imagen_url: text('imagen_url'),

  // Precios e impuestos
  precio_unitario: numeric('precio_unitario'),
  moneda: text('moneda'),
  costo: numeric('costo'),
  desglose_costos: jsonb('desglose_costos').notNull().default(sql`'[]'`),
  impuesto_id: text('impuesto_id'),
  impuesto_compra_id: text('impuesto_compra_id'),
  unidad: text('unidad').notNull().default('unidad'),

  // Descripciones
  descripcion: text('descripcion'),
  descripcion_venta: text('descripcion_venta'),
  notas_internas: text('notas_internas'),

  // Logística (solo tipo = 'producto')
  peso: numeric('peso'),
  volumen: numeric('volumen'),

  // Capacidades
  puede_venderse: boolean('puede_venderse').notNull().default(true),
  puede_comprarse: boolean('puede_comprarse').notNull().default(false),
  activo: boolean('activo').notNull().default(true),

  // Soft delete
  en_papelera: boolean('en_papelera').notNull().default(false),
  papelera_en: timestamp('papelera_en', { withTimezone: true }),

  // Auditoría
  creado_por: uuid('creado_por').notNull(),
  creado_por_nombre: text('creado_por_nombre'),
  editado_por: uuid('editado_por'),
  editado_por_nombre: text('editado_por_nombre'),
  creado_en: timestamp('creado_en', { withTimezone: true }).defaultNow().notNull(),
  actualizado_en: timestamp('actualizado_en', { withTimezone: true }).defaultNow().notNull(),
}, (tabla) => [
  uniqueIndex('productos_empresa_codigo_idx').on(tabla.empresa_id, tabla.codigo),
  index('productos_empresa_idx').on(tabla.empresa_id),
  index('productos_tipo_idx').on(tabla.empresa_id, tabla.tipo),
  index('productos_categoria_idx').on(tabla.empresa_id, tabla.categoria),
  index('productos_activo_idx').on(tabla.empresa_id, tabla.activo),
  index('productos_papelera_idx').on(tabla.empresa_id, tabla.en_papelera),
])

// Configuración de productos por empresa (JSONB flexible)
export const config_productos = pgTable('config_productos', {
  empresa_id: uuid('empresa_id').primaryKey().references(() => empresas.id, { onDelete: 'cascade' }),

  // Categorías de producto/servicio
  categorias: jsonb('categorias').notNull().default(sql`'[{"id":"general","label":"General"},{"id":"tecnologia","label":"Tecnología"},{"id":"limpieza","label":"Limpieza"},{"id":"mantenimiento","label":"Mantenimiento"},{"id":"consultoria","label":"Consultoría"},{"id":"insumos","label":"Insumos"}]'`),

  // Unidades de medida
  unidades: jsonb('unidades').notNull().default(sql`'[{"id":"unidad","label":"Unidad","abreviatura":"un"},{"id":"hora","label":"Hora","abreviatura":"hs"},{"id":"servicio","label":"Servicio","abreviatura":"srv"},{"id":"metro","label":"Metro","abreviatura":"m"},{"id":"kg","label":"Kilogramo","abreviatura":"kg"},{"id":"litro","label":"Litro","abreviatura":"lt"},{"id":"dia","label":"Día","abreviatura":"día"},{"id":"mes","label":"Mes","abreviatura":"mes"},{"id":"global","label":"Global","abreviatura":"gl"},{"id":"m2","label":"Metro cuadrado","abreviatura":"m²"}]'`),

  // Prefijos de código (cada uno con su secuencia independiente)
  prefijos: jsonb('prefijos').notNull().default(sql`'[{"id":"producto","prefijo":"PRD","label":"Producto","siguiente":1},{"id":"servicio","prefijo":"SRV","label":"Servicio","siguiente":1}]'`),

  // Categorías de desglose de costos
  categorias_costo: jsonb('categorias_costo').notNull().default(sql`'[{"id":"mano_obra","label":"Mano de obra"},{"id":"materiales","label":"Materiales"},{"id":"flete","label":"Flete"},{"id":"otros","label":"Otros"}]'`),

  actualizado_en: timestamp('actualizado_en', { withTimezone: true }).defaultNow().notNull(),
})
