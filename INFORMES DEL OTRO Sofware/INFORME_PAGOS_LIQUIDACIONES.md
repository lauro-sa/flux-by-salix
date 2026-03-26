# Informe: Sistema de Pagos, Liquidaciones y Compensación de Empleados

## 1. VISIÓN GENERAL

El sistema maneja **dos dominios de pagos** independientes:

1. **Nómina de empleados** — Registro de sueldos, cálculo basado en asistencias, comprobantes
2. **Cobros de documentos** — Cuotas de presupuestos/facturas, condiciones de pago, portal de clientes

---

## 2. NÓMINA DE EMPLEADOS

### 2.1 Configuración por empleado

Cada usuario/empleado tiene 4 campos clave de compensación:

| Campo | Opciones | Descripción |
|-------|----------|-------------|
| `nominaTipo` | `fija` / `por_dia` | Sueldo fijo mensual o pago por día trabajado |
| `nominaMonto` | número | Monto del sueldo fijo, o monto por día |
| `nominaFrecuencia` | `semanal` / `quincenal` / `mensual` / `eventual` | Cada cuánto se le paga |
| `nominaDiasLaborales` | `5` / `6` / `7` | Cuántos días trabaja por semana (Lun-Vie, Lun-Sáb, Todos) |

**Ejemplos:**
- Empleado con sueldo fijo mensual de $500.000, trabaja Lun-Vie → `fija`, `500000`, `mensual`, `5`
- Jornalero que cobra $20.000/día, se le paga semanal, trabaja Lun-Sáb → `por_dia`, `20000`, `semanal`, `6`

### 2.2 Cálculo automático del período de pago

El sistema calcula automáticamente las fechas del período según la frecuencia:

| Frecuencia | Período |
|------------|---------|
| **Semanal** | Lunes a domingo de la semana actual |
| **Quincenal** | Del 1 al 15, o del 16 al último día del mes |
| **Mensual** | Del 1 al último día del mes |
| **Eventual** | Mes completo (por defecto) |

Se puede navegar a períodos anteriores y futuros.

### 2.3 Cálculo del monto sugerido (conectado a asistencias)

Cuando el admin va a registrar un pago, el sistema **cruza automáticamente** los registros de asistencia del período para calcular:

1. **Días hábiles del período** — Cuenta los días del rango excluyendo días francos (según `nominaDiasLaborales`)
2. **Días efectivamente trabajados** — Consulta los registros de asistencia (entrada/salida) del empleado en ese rango
3. **Días ausentes** — Hábiles menos trabajados
4. **Tardanzas** — Registros de asistencia marcados como tipo `tardanza`
5. **Monto sugerido**:
   - Si es `por_dia`: `nominaMonto × díasTrabajados` (ej: $20.000 × 22 días = $440.000)
   - Si es `fija`: el monto fijo directamente (no varía por días)

**Esto es solo una sugerencia** — el admin puede ajustar el monto final libremente (por bonos, descuentos, adelantos, etc.).

### 2.4 Registro de un pago

Cada pago registrado contiene:

```
{
  concepto: "Mes de Febrero 2026" / "1ra Quincena Marzo" / texto libre
  montoAbonado: número (lo que efectivamente se pagó)
  fechaInicioPeriodo: "2026-02-01"
  fechaFinPeriodo: "2026-02-28"
  comprobanteUrl: URL del recibo/comprobante subido (opcional)
  notas: texto libre

  resumenCalculo: {
    diasHabiles: 21
    diasTrabajados: 20
    diasAusentes: 1
    tardanzas: 2
    montoSugerido: 440000
  }

  // Auditoría
  creadoPor: ID del admin que registró
  creadoPorNombre: "Juan Pérez"
  fechaCreacion: timestamp
  editadoPor: ID del último que editó
  fechaEdicion: timestamp
}
```

### 2.5 Flujo completo de pago de nómina

```
1. Admin abre el perfil del empleado → pestaña "Pagos"
2. Ve la configuración de nómina (tipo, monto, frecuencia)
3. Ve el resumen del período actual (días trabajados vs hábiles, monto sugerido)
4. Click en "Registrar pago" → se abre modal
5. El modal viene pre-llenado con:
   - Período calculado automáticamente
   - Resumen de asistencias del período
   - Monto sugerido (editable)
6. Admin ajusta el monto si quiere, agrega concepto, sube comprobante
7. Guarda → el pago queda en el historial del empleado
8. En la pestaña Pagos se ve la lista de todos los pagos con fechas, montos y comprobantes
```

### 2.6 Permisos

| Acción | Quién puede |
|--------|-------------|
| Ver pagos propios | El mismo empleado |
| Ver pagos de todos | Administradores |
| Registrar/editar pagos | Solo administradores |
| Eliminar pagos | Solo propietario de la empresa |

### 2.7 Lo que NO tiene implementado (oportunidad de mejora)

- **Horas extra**: no se calculan automáticamente (el sistema registra horas totales en asistencias pero no las separa en normales vs extras)
- **Bonificaciones/descuentos itemizados**: no hay campos para desglosar (bono, descuento, adelanto como líneas separadas). El admin solo ajusta el monto final manualmente
- **Historial de cambios salariales**: no se registra cuándo cambió el sueldo base
- **Recibos de sueldo generados**: no genera PDF de recibo automáticamente
- **Aportes/contribuciones/impuestos**: no calcula cargas sociales ni retenciones
- **Vacaciones/licencias**: no tiene módulo de licencias que afecte el cálculo
- **Anticipos/adelantos**: no hay sistema formal, se hacen como un pago más con nota

---

## 3. COBROS DE DOCUMENTOS (Presupuestos/Facturas)

### 3.1 Condiciones de pago configurables

Cada empresa configura sus condiciones de pago reutilizables:

**Tipo plazo fijo:**
- Contado (0 días)
- 30 días, 60 días, 90 días, etc.
- Al vencimiento se calcula desde la fecha de emisión

**Tipo hitos (cuotas):**
- Configurable en N cuotas con porcentaje y días desde emisión
- Ejemplo: "50% a la firma (día 0) + 50% a la entrega (día 30)"

```
condicionesPago: [
  { label: "Contado", tipo: "plazo_fijo", diasVencimiento: 0, predeterminado: true },
  { label: "30 días", tipo: "plazo_fijo", diasVencimiento: 30 },
  { label: "2 cuotas 50-50", tipo: "hitos", hitos: [
      { descripcion: "50% a la firma", porcentaje: 50, diasDesdeEmision: 0 },
      { descripcion: "50% a la entrega", porcentaje: 50, diasDesdeEmision: 30 }
  ]}
]
```

### 3.2 Cuotas de pago en documentos

Cuando se crea un documento con condición de pago tipo hitos, el sistema genera automáticamente las cuotas:

```
cuotasPago: [
  {
    numero: 1
    monto: 50000
    porcentaje: 50
    descripcion: "50% a la firma"
    estado: "pendiente" | "cobrada" | "vencida" | "parcial"
    fechaVencimiento: fecha calculada
    fechaCobro: timestamp (cuando se confirmó el cobro)
    cobradoPorNombre: "Admin que confirmó"
  },
  { numero: 2, ... }
]
```

### 3.3 Portal público de pago

Los clientes pueden pagar desde un link público (sin autenticación):

```
1. Cliente recibe link del documento por email/WhatsApp
2. Abre el portal → ve el documento con las cuotas pendientes
3. Sube comprobante de pago (foto/PDF de transferencia)
4. IA verifica automáticamente el comprobante (extrae monto, banco, fecha)
5. El sistema marca como "pendiente de confirmación"
6. El admin del CRM recibe notificación → confirma o rechaza
7. Si confirma: cuota pasa a "cobrada", se acumula al total pagado
8. Si todas las cuotas están cobradas: documento pasa a "pagado"
```

### 3.4 Verificación IA de comprobantes

Cuando el cliente sube un comprobante en el portal:
- IA analiza la imagen/PDF y extrae: monto, banco, fecha, referencia
- Clasifica: `confirmado` (coincide), `revision` (dudoso), `rechazado` (no coincide)
- El admin siempre tiene la última palabra

---

## 4. CONEXIÓN ENTRE ASISTENCIAS Y PAGOS

```
ASISTENCIAS (entrada/salida diaria)
        ↓
  Se consultan por rango de fechas
        ↓
CÁLCULO DE PERÍODO (según frecuencia del empleado)
        ↓
  Días hábiles vs días trabajados vs tardanzas
        ↓
MONTO SUGERIDO (automático)
        ↓
  Admin ajusta y confirma
        ↓
PAGO REGISTRADO (con comprobante y auditoría)
```

---

## 5. MEJORAS SUGERIDAS PARA EL NUEVO SOFTWARE

### 5.1 Desglose de liquidación itemizado
En lugar de un solo monto, crear líneas de liquidación:
```
líneas: [
  { concepto: "Sueldo base", monto: 500000 },
  { concepto: "Horas extra (12h × $3500)", monto: 42000 },
  { concepto: "Bono presentismo", monto: 25000 },
  { concepto: "Descuento adelanto", monto: -50000 },
  { concepto: "Descuento ausencias (2 días)", monto: -40000 },
]
total: 477000
```

### 5.2 Cálculo automático de horas extra
- Si el empleado trabaja más de 8h (o el horario configurado), calcular horas extra
- Multiplicadores configurables: 1.5x (diurnas), 2x (nocturnas/feriados)

### 5.3 Sistema de adelantos formales
- Registro de adelantos como entidad separada
- Descuento automático en la próxima liquidación
- Saldo pendiente visible

### 5.4 Historial de cambios salariales
- Registrar cada cambio de `nominaMonto` con fecha efectiva
- Para auditoría y cálculos retroactivos

### 5.5 Generación de recibo de sueldo en PDF
- Template configurable por empresa
- Desglose completo (sueldo base, extras, descuentos, neto)
- Firma digital del empleador

### 5.6 Módulo de licencias/vacaciones
- Tipos: vacaciones, enfermedad, maternidad, estudio, etc.
- Días disponibles vs usados
- Impacto automático en el cálculo de nómina

### 5.7 Aportes y retenciones
- Configurar cargas sociales por país (jubilación, obra social, sindicato)
- Cálculo automático sobre el bruto
- Neto = Bruto - Retenciones empleado
- Costo empresa = Bruto + Contribuciones patronales
