/**
 * Constantes del editor de plantillas de correo.
 * Opciones de disponibilidad, visibilidad y datos de ejemplo para la vista previa.
 */

// ─── Opciones de "Disponible para" ───

export const OPCIONES_DISPONIBLE = [
  { valor: 'todos', etiqueta: 'Todos los módulos', tipoDocumento: null },
  { valor: 'contactos', etiqueta: 'Contactos', tipoDocumento: null },
  { valor: 'presupuestos', etiqueta: 'Presupuestos', tipoDocumento: 'presupuesto' },
  { valor: 'facturas', etiqueta: 'Facturas', tipoDocumento: 'factura' },
  { valor: 'ordenes', etiqueta: 'Órdenes de trabajo', tipoDocumento: 'orden_trabajo' },
  { valor: 'recibos', etiqueta: 'Recibos', tipoDocumento: 'recibo' },
  { valor: 'informes', etiqueta: 'Informes', tipoDocumento: 'informe' },
  { valor: 'notas_credito', etiqueta: 'Notas de crédito', tipoDocumento: 'nota_credito' },
  { valor: 'notas_debito', etiqueta: 'Notas de débito', tipoDocumento: 'nota_debito' },
  { valor: 'remitos', etiqueta: 'Remitos', tipoDocumento: 'remito' },
]

export const OPCIONES_VISIBILIDAD = [
  { valor: 'todos', etiqueta: 'Todos los usuarios' },
  { valor: 'solo_yo', etiqueta: 'Solo yo' },
  { valor: 'usuarios', etiqueta: 'Usuarios específicos' },
  { valor: 'roles', etiqueta: 'Solo ciertos roles' },
]

// ─── Datos de ejemplo para la vista previa ───

export const DATOS_EJEMPLO: Record<string, Record<string, unknown>> = {
  contacto: {
    nombre: 'Juan', apellido: 'García', nombre_completo: 'Juan García',
    correo: 'juan@ejemplo.com', telefono: '+54 11 1234-5678',
    direccion: 'Av. Corrientes 1234, 3°A, San Nicolás, CABA, Buenos Aires',
    calle: 'Av. Corrientes', numero_calle: '1234', calle_altura: 'Av. Corrientes 1234',
    piso: '3°A', barrio: 'San Nicolás', ciudad: 'CABA', provincia: 'Buenos Aires',
    pais: 'Argentina', codigo_postal: 'C1043AAZ',
  },
  presupuesto: {
    numero: 'P-0001', estado: 'Confirmado', total_final: '$150.000,00',
    subtotal_neto: '$123.966,94', total_impuestos: '$26.033,06',
    fecha_emision: '07/03/2026', moneda: 'ARS',
  },
  empresa: { nombre: 'Mi Empresa S.A.', correo: 'info@miempresa.com', telefono: '+54 11 5050-1234' },
  dirigido_a: {
    nombre: 'María', apellido: 'López', nombre_completo: 'María López',
    correo: 'maria@ejemplo.com', cargo: 'Gerente Comercial',
  },
}

// ─── Colores para avatares ───

export const COLORES_AVATAR = [
  'var(--texto-marca)', '#ef4444', '#f97316', '#eab308', '#22c55e',
  '#06b6d4', '#3b82f6', '#8b5cf6', '#ec4899',
]
