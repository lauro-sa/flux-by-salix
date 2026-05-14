# 💰 Cómo usar Nóminas en Flux

Una guía paso a paso para liquidar el sueldo de tu equipo: armar contratos, configurar premios y descuentos, calcular el recibo y enviarlo por correo. Sin saber contabilidad ni tener que abrir una planilla.

---

## 🤔 ¿Qué es el módulo Nóminas?

Nóminas es el lugar donde Flux maneja **todo lo relacionado con el pago a tus empleados**: cuánto cobra cada uno, cómo se calcula su sueldo en cada período, qué premios o descuentos se le aplican, qué adelantos arrastra, y cómo se les envía el recibo.

Pensalo como **el sucesor moderno de la planilla de Excel** que tantas empresas usan para liquidar sueldos. Solo que acá:

- Los datos los toma Flux **directo de los fichajes** que ya tenés cargados.
- Los premios (presentismo, antigüedad) **se aplican solos** cuando se cumple la condición.
- Los adelantos **se descuentan automáticamente** del recibo del período correspondiente.
- El recibo se imprime en un **PDF profesional** y se envía por correo con un solo click.

Si todavía no instalaste el módulo, tu menú lateral no va a tener la sección "Nóminas". Pedile al propietario de tu empresa que lo active.

---

## 🚀 Paso 1: Entrar al módulo

1. En el menú lateral izquierdo, buscá la sección **"Admin"**.
2. Click en **"Nóminas"**.
3. Se abre la pantalla principal con cuatro pestañas:
   - **Liquidaciones** — cálculo del sueldo del período actual de todos los empleados.
   - **Adelantos** — futuro panel de gestión global de adelantos (por ahora vacío).
   - **Empleados** — listado de todos los empleados con su contrato vigente.
   - **Configuración** — catálogo de conceptos (presentismo, premios, descuentos).

La primera vez que entres, vas a estar en *Liquidaciones* viendo los empleados del mes actual.

---

## ⚙️ Paso 2: Configurar conceptos (una sola vez, al principio)

Los **conceptos** son las reglas de premios y descuentos que se aplican al sueldo: presentismo, premios por puntualidad, descuentos por uniforme, etc.

Cuando instalás el módulo, Flux te crea automáticamente cuatro conceptos sugeridos:

| Concepto | Tipo | Cómo se aplica |
|---|---|---|
| **Presentismo** | Haber | 10% del sueldo básico, si no hubo ausencias |
| **Premio puntualidad** | Haber | Monto fijo, si no hubo tardanzas |
| **Antigüedad** | Haber | Manual (el operador escribe el monto) |
| **Descuento por uniforme** | Descuento | Manual |

### Crear un concepto propio

1. Andá a **Nóminas → Configuración**.
2. Click en **"Nuevo concepto"** arriba a la derecha.
3. Se abre un editor con tres bloques.

#### Identidad

- **Nombre:** lo que va a aparecer en el recibo (ej: *"Bono fin de año"*).
- **Tipo:** elegí *Haber* (suma) o *Descuento* (resta).
- **Categoría:** ayuda a agrupar visualmente — presentismo, premio, bono, etc.
- **Color e ícono:** para identificarlo rápido en listados.

#### Cálculo del haber

Acá decidís **cómo se calcula el monto**:

| Modo | Para qué sirve | Ejemplo |
|---|---|---|
| **Monto fijo** | Un valor en pesos exacto | $25.000 de bono |
| **% del básico** | Porcentaje del sueldo base | 10% de presentismo |
| **Por día** | Multiplica por días trabajados | $500 por día de asistencia |
| **Por evento** | El operador lo agrega manual | $5.000 por venta cerrada |
| **Manual** | El motor no lo aplica solo; lo escribís a mano en cada recibo | Adicional por horas extra |

#### Comportamiento (cuándo se aplica)

- **Automático:** si está activado, el motor lo aplica solo en cada recibo si cumple la condición. Si lo dejás manual, el operador decide cada vez.
- **Recurrente:** el concepto vuelve a aparecer en cada nuevo período.
- **Condición:** el corazón del concepto automático. Elegí entre:

| Condición | Cuándo se cumple |
|---|---|
| **Siempre** | En todos los recibos del contrato |
| **Sin ausencias** | Si el empleado no faltó ningún día del período |
| **Sin tardanzas** | Si no llegó tarde ningún día |
| **Mínimo X días** | Si trabajó al menos X días en el período |
| **Antigüedad mínima** | Si el contrato lleva al menos X meses vigente |

Click en **"Guardar"** y el concepto queda disponible para asignar a los contratos.

---

## 👥 Paso 3: Crear el contrato laboral del empleado

Antes de poder liquidar el sueldo, cada empleado necesita un **contrato vigente** que diga cuánto cobra, con qué modalidad y bajo qué condiciones.

> 💡 Si ya tenías sueldos cargados en Flux antes de instalar Nóminas, Flux te crea los contratos automáticamente con la información que ya tenía.

### Crear o cambiar un contrato

1. Andá a **Nóminas → Empleados**.
2. Click en el empleado que querés modificar → te lleva a su ficha laboral.
3. En la pestaña **"Contrato vigente"**, click en **"Nuevo contrato"**.
4. Se abre el editor con los siguientes bloques.

#### Identidad

- **Sector y turno:** dónde trabaja y qué horario tiene. Salen de la configuración general de la empresa.
- **Condición:** el tipo legal del contrato (*tiempo indeterminado*, *plazo fijo*, *temporal*, *pasantía*).

#### Cálculo del haber

- **Modalidad de cálculo:** cómo se calcula el sueldo base.
  - *Por hora* o *por día*: se multiplica por las horas/días trabajados según fichajes.
  - *Fijo semanal/quincenal/mensual*: monto fijo que se prorratea si el período pedido no coincide con la frecuencia.
- **Monto base:** el valor en pesos.
- **Frecuencia de pago:** cada cuánto se paga.
- **Fecha de inicio:** desde cuándo rige este contrato.

#### Régimen y documentos

- **Régimen fiscal:** *informal*, *monotributo* o *relación de dependencia* (los regímenes formales se desarrollan más adelante).
- **PDF del contrato:** opcional, link al documento legal firmado.
- **Motivo del cambio:** ej. *"Aumento de sueldo"*.
- **Notas:** detalles internos.

#### Conceptos aplicables

Tags con los conceptos del catálogo. Tocá los que correspondan al empleado. Por ejemplo:

- *Presentismo* ✓
- *Premio puntualidad* ✓
- *Descuento por uniforme* ✓

Si el empleado ya tenía un contrato vigente, los conceptos **se heredan automáticamente** del anterior. Solo cambialos si tenés que.

5. Click en **"Crear contrato"**.
6. Flux **cierra el contrato anterior** poniendo fecha de fin = día previo al nuevo, y crea el nuevo como vigente.

> 🔒 Los contratos viejos quedan en el **Historial** del empleado. Nunca se pierden — son la trazabilidad legal de su sueldo en el tiempo.

---

## 🏷️ Paso 4: Ajustar conceptos por empleado (override)

A veces un concepto general no aplica igual a todos. Por ejemplo, *Presentismo* es 10% para casi todos, pero a un empleado le acordaste 15%.

1. Andá a la ficha del empleado → pestaña **"Conceptos"**.
2. Vas a ver una lista con los conceptos asignados y su valor por defecto.
3. En la columna **Override**, escribí el valor distinto para ese empleado.
4. Click en **"Guardar cambios"**.

El override solo afecta a ese empleado. El resto sigue con el valor del catálogo.

---

## 💵 Paso 5: Cargar un adelanto

Cuando un empleado pide plata adelantada o le tenés que descontar algo extraordinario, lo cargás como **adelanto**.

1. En la ficha del empleado → pestaña **"Liquidaciones"** → bloque *Adelantos*.
2. Click en **"Nuevo adelanto"**.
3. Llená los datos:
   - **Monto total:** lo que le diste o le vas a descontar.
   - **Cantidad de cuotas:** en cuántos períodos se descuenta (1 si es un descuento puntual).
   - **Frecuencia de descuento:** mensual, quincenal, etc.
   - **Fecha de inicio:** cuándo arranca el descuento.
4. Click en **"Crear"**.

Flux genera automáticamente las cuotas con sus fechas y las irá descontando del recibo de cada período que corresponda.

> 💡 **Diferencia entre adelanto y descuento puntual:**
> - *Adelanto:* le diste plata, se la descontás en cuotas.
> - *Descuento:* le sacás plata por una sola vez (ej. rotura de herramienta).

---

## 🧮 Paso 6: Liquidar el período

Acá es donde Flux hace la magia. Vas a la pestaña **Liquidaciones** y ves a todos los empleados con su cálculo listo.

### Cómo se calcula cada recibo

El **motor de cálculo** arma el recibo solo, con esta lógica:

1. **Busca el contrato vigente** del empleado al final del período.
2. **Lee los fichajes** de ese período y calcula días trabajados, ausencias, tardanzas y horas netas.
3. **Calcula el monto base** según la modalidad del contrato.
4. **Aplica los conceptos automáticos** uno por uno, evaluando si cumplen su condición.
5. **Suma adelantos pendientes** del período (más cualquier cuota atrasada que haya quedado de meses anteriores).
6. **Calcula el neto** = haberes − descuentos.

Lo que ves en pantalla es el **desglose completo**: monto base, conceptos aplicados, adelantos, neto a transferir.

### Pagar a un empleado

1. Click en el empleado de la lista → te lleva a su recibo del período.
2. Revisá el desglose. Si todo está bien:
3. Click en el botón verde **"Marcar como pagado"** o **"Pagar $XXX"**.
4. Confirmá el monto real abonado (puede diferir del sugerido si negociaste algo distinto).
5. Click en **"Confirmar pago"**.

Flux registra el pago con un **snapshot inmutable** del contrato y todos los conceptos aplicados. Eso significa que aunque después borres el contrato o cambies un concepto, el recibo histórico **no se rompe nunca**.

### Si el neto da negativo o cero

A veces, con muchos descuentos y adelantos, el neto queda en cero o negativo. Flux te muestra un mensaje claro:

- **Neto = 0:** el empleado no cobra este período, pero tampoco debe.
- **Neto negativo:** quedó debiendo. Podés *arrastrar el saldo* al próximo período o *cancelarlo con trabajo extra*.

---

## 📄 Paso 7: Descargar el recibo PDF

Una vez que confirmás el pago, podés **descargar el recibo en PDF** profesional con todos los datos.

1. En la lista de pagos del empleado, al lado de cada pago aparece el ícono de **descarga** (⬇).
2. Click ahí.
3. Se abre el PDF en una pestaña nueva, listo para imprimir, guardar o enviar por WhatsApp manualmente.

El PDF incluye:

- 🏢 Encabezado con razón social, CUIT, logo de tu empresa.
- 👤 Datos del empleado: nombre, legajo, documento, sector, turno.
- 📅 Período liquidado: días trabajados, ausencias, tardanzas, modalidad.
- ➕ Tabla de haberes: monto base + cada concepto aplicado.
- ➖ Tabla de descuentos: conceptos negativos + adelantos.
- 💰 **Neto destacado** en grande.
- ✍️ Espacio para firma del empleado y del empleador.

---

## 📨 Paso 8: Enviar los recibos por correo

Cuando ya pagaste el sueldo, queda enviar el comprobante. Lo hacés en lote.

1. En **Nóminas → Liquidaciones**, click en **"Enviar recibos"** (botón arriba a la derecha).
2. Se abre la ventana de envío.
3. Elegí el canal de **correo** desde donde se envía (uno de tus canales conectados).
4. Revisá el **preview** del correo y la lista de destinatarios.
5. Click en **"Enviar"**.

Flux le manda un correo a cada empleado con:

- El cuerpo personalizado (variables como su nombre, días trabajados, etc.).
- **El PDF del recibo adjunto** automáticamente, si el pago ya está grabado.

Si querés modificar el texto del correo, podés editar la plantilla en *Inbox → Configuración → Plantillas → Recibo de nómina*.

> 📱 **WhatsApp:** todavía no se puede adjuntar PDF a un mensaje de plantilla (limitación de Meta). Vas a poder mandar el aviso por WhatsApp, pero el archivo PDF lo entregás por correo o lo descargás y lo mandás a mano.

---

## 🎯 Ejemplo completo: liquidación quincenal

**Situación:** Tenés a *Gloria*, jornalera $30.000/día con presentismo del 10% y un adelanto activo de $60.000 en 2 cuotas quincenales. Hay que liquidarle la primera quincena de abril.

### Lo que hace Flux por vos

1. Lee los fichajes de Gloria del 1 al 15 de abril → trabajó 10 días, sin ausencias.
2. Monto base: 10 días × $30.000 = **$300.000**.
3. Presentismo (sin ausencias ✓): 10% de $300.000 = **+$30.000**.
4. Cuota de adelanto: **−$30.000**.
5. **Neto: $300.000 + $30.000 − $30.000 = $300.000**.

### Lo que hacés vos

1. Andás a Nóminas → Liquidaciones → clickeás a Gloria.
2. Ves el desglose arriba. Confirmás el neto.
3. Click en **"Pagar $300.000"** → confirmás el monto.
4. Click en el ícono de descarga ⬇ → se abre el recibo PDF.
5. (Opcional) Click en **"Enviar recibos"** → Gloria recibe el correo con el PDF.

**Tiempo total: menos de un minuto por empleado.**

---

## ❓ Preguntas frecuentes

### ¿Qué pasa si un empleado no tiene cuenta de Flux?

Funciona igual. Lo cargás como empleado sin cuenta (desde *Usuarios → Agregar empleado* sin email). Sus datos personales se guardan en el contacto-equipo y Nóminas lo trata como a cualquier otro.

### ¿Puedo cambiar el monto de un pago ya hecho?

Sí. En la lista de pagos del período, click en el ícono de lápiz ✏ al lado del pago. Editás el monto y se guarda la corrección con auditoría (queda registrado quién lo cambió y cuándo).

### ¿Y si me equivoco y necesito anular un pago?

Click en el ícono de basura 🗑 → se marca como eliminado. Las cuotas de adelantos descontadas en ese pago vuelven a estado *pendiente* y se aplican al próximo recibo.

### ¿Por qué algunos conceptos aparecen "sugeridos" y otros se aplican solos?

Los conceptos **automáticos** que cumplen su condición se aplican solos. Los que **no cumplen** la condición (ej. *Presentismo* cuando hubo una ausencia) o que son **manuales** quedan como sugerencia — el operador decide si los agrega manualmente al recibo.

### ¿Cómo manejo aumentos de sueldo?

Creás un **nuevo contrato** con la fecha de inicio del aumento. Flux automáticamente cierra el contrato anterior con fecha de fin = día previo. Si el aumento cae a mitad del período, el motor toma el contrato vigente al final del período (con el nuevo valor) — para prorrateo más fino, podés liquidar la primera mitad con el contrato viejo y la segunda con el nuevo en dos pagos separados.

### ¿Y las retenciones de jubilación, IPS y obra social?

Por ahora Nóminas opera en **régimen informal** (sin retenciones automáticas). El régimen formal con alícuotas configurables y recibo legal AFIP/IPS se desarrolla en una próxima fase. Si necesitás retenciones, agregalas como conceptos manuales tipo "Descuento" con monto fijo.

---

## ✨ Tips prácticos

- **Configurá los conceptos al principio**, antes de cargar empleados. Te ahorra ir empleado por empleado después.
- **Asigná solo los conceptos que aplican** a cada contrato. Si un empleado no cobra presentismo, no lo tilds en su contrato.
- **Revisá las "sugerencias"** del motor antes de confirmar. Son conceptos que no se aplicaron solos por algún motivo — si te parece que sí corresponde, agregalo manualmente.
- **Los recibos son inmutables**: cuando confirmás un pago, el contrato queda *congelado* en ese recibo. Es la trazabilidad legal de cuánto le pagaste a quién y bajo qué condiciones.
- **Si cambiás conceptos del catálogo** (ej. subís el porcentaje de presentismo), los **recibos viejos no se tocan**: solo los nuevos toman el valor actualizado.

---

*Guía del módulo Nóminas — Flux by Salix. Última actualización: 2026-05-14.*
