# Detector de Vistas Guardadas — Lógica y UX

## Concepto

Cuando el usuario está en una tabla/listado y cambia filtros, orden o búsqueda, el sistema detecta automáticamente si el estado actual:
1. Es el estado por defecto (no mostrar nada)
2. Coincide con una vista guardada (mostrar nombre de la vista)
3. Es un estado nuevo sin guardar (mostrar ícono de guardar)

---

## Los 3 estados posibles

### Estado 1: Sin cambios (default)
- El usuario no tocó nada, o limpió todos los filtros
- No se muestra ningún ícono especial
- La tabla muestra los datos con los filtros por defecto del módulo

### Estado 2: Coincide con una vista guardada
- El usuario aplicó una vista guardada, O cambió filtros manualmente y casualmente coincide con una vista que ya tenía guardada
- Se muestra el nombre de la vista activa (ej: "Clientes Activos") con ícono de bookmark lleno
- El usuario sabe que está viendo una vista guardada

### Estado 3: Cambios sin guardar
- El usuario cambió filtros/orden/búsqueda y el resultado NO coincide con ninguna vista guardada ni con el default
- Se muestra ícono de "guardar vista" (bookmark con +)
- Al hacer clic, puede ponerle nombre y guardarla

---

## Qué se compara

Se define un objeto "estado" que contiene SOLO los campos que definen qué datos se están viendo:

```
estadoActual = {
  busqueda: "texto que escribió",
  filtro1: "valor seleccionado",
  filtro2: "otro valor",
  orden: "campo_direccion"
}
```

Se compara contra:

1. **Estado default** del módulo (los valores iniciales cuando no se tocó nada):
```
estadoDefault = {
  busqueda: "",
  filtro1: "todos",
  filtro2: "todos",
  orden: "reciente"
}
```

2. **Estado de cada vista guardada** (lo que se guardó cuando el usuario creó la vista):
```
vistaGuardada.estado = {
  busqueda: "",
  filtro1: "cliente",
  filtro2: "activo",
  orden: "nombre_asc"
}
```

---

## Algoritmo de detección

```
PASO 1: ¿Hay filtros activos?
  → Comparar estadoActual con estadoDefault
  → Si son iguales → Estado 1 (default, no mostrar nada)
  → Si son distintos → seguir al paso 2

PASO 2: ¿Coincide con alguna vista guardada?
  → Recorrer todas las vistas del usuario para este módulo
  → Comparar estadoActual con cada vista.estado
  → Si encuentra coincidencia exacta → Estado 2 (mostrar nombre de vista)
  → Si no coincide con ninguna → Estado 3 (mostrar ícono guardar)
```

La comparación es por **igualdad exacta** de todos los campos. Se puede hacer con JSON.stringify o comparando campo por campo. Lo importante es que TODOS los campos deben coincidir.

---

## Qué se guarda en una vista

SOLO los campos que afectan qué datos se muestran:
- Búsqueda (texto)
- Filtros (cada select/toggle de filtro)
- Orden (campo + dirección asc/desc)

NO se guarda en la vista:
- Columnas visibles (eso es preferencia visual, se guarda aparte)
- Anchos de columnas
- Página actual
- Opciones de apariencia (bordes, colores, etc.)

La razón: al cambiar de vista "Clientes" a "Proveedores", querés que cambien los datos pero no que se te muevan las columnas que tenías configuradas.

---

## Estructura de una vista guardada

```
{
  id: "identificador único",
  nombre: "Clientes Activos",
  predefinida: false,
  estado: {
    busqueda: "",
    filtro1: "cliente",
    filtro2: "activo",
    orden: "nombre_asc"
  }
}
```

- **id**: identificador único (timestamp, uuid, lo que sea)
- **nombre**: lo que el usuario escribió al guardar
- **predefinida**: si es true, se aplica automáticamente al entrar al módulo (solo una por módulo)
- **estado**: snapshot exacto de todos los filtros al momento de guardar

---

## Acciones del usuario sobre vistas

### Guardar nueva
1. El usuario cambia filtros → aparece ícono de guardar
2. Clic en guardar → input para nombre → "Clientes Activos"
3. Se crea vista con el estado actual
4. Ahora el detector reconoce el estado → pasa de "sin guardar" a "vista activa"

### Aplicar vista existente
1. El usuario hace clic en una vista guardada
2. Se aplican todos los campos del estado guardado (setBusqueda, setFiltro1, etc.)
3. Los datos se recargan con los nuevos filtros
4. El detector reconoce coincidencia → muestra nombre de vista

### Sobrescribir vista
1. El usuario tiene una vista aplicada, cambia un filtro más
2. Ahora no coincide → aparece ícono de guardar
3. Opción de "sobrescribir" la vista anterior con el nuevo estado

### Eliminar vista
1. Hover o menú contextual sobre chip de vista → botón eliminar
2. Se borra la vista
3. Si el estado actual coincidía con esa vista, ahora pasa a "sin guardar"

### Marcar como predefinida
1. Toggle en la vista → predefinida = true
2. Al entrar al módulo, se aplica automáticamente
3. Solo una vista puede ser predefinida por módulo (al marcar una, se desmarca la anterior)

### Resetear a default
1. Botón "Por defecto" o "Limpiar"
2. Se aplica estadoDefault → setBusqueda(''), setFiltro1('todos'), etc.
3. El detector reconoce que es el default → no muestra nada

---

## Dónde vive el detector en la UI

El detector NO es visible como componente propio. Sus resultados se usan en la barra de la tabla:

```
┌─ Barra de tabla ──────────────────────────────────────────┐
│ 🔍 [búsqueda...] [Tipo ▾] [Estado ▾]                     │
│                                                            │
│  Si Estado 2 (vista activa):                              │
│    [★ Clientes Activos]  ← chip con nombre                │
│                                                            │
│  Si Estado 3 (sin guardar):                               │
│    [+ Guardar vista]  ← botón para guardar                │
│                                                            │
│  Siempre disponible:                                      │
│    [Vista1] [Vista2] [Vista3]  ← chips de vistas          │
│    [Por defecto]  ← resetear                              │
└───────────────────────────────────────────────────────────┘
```

---

## Cuándo se ejecuta la detección

Se ejecuta **reactivamente** cada vez que cambia cualquiera de estos:
- El estado actual (cualquier filtro, búsqueda u orden)
- La lista de vistas guardadas (al crear, eliminar o sobrescribir)

No es un polling ni un timer. Es un cálculo derivado del estado.

---

## Resumen en una frase

> El detector compara el estado actual de filtros/orden/búsqueda contra el default y contra cada vista guardada. Si es igual al default → nada. Si coincide con una vista → muestra su nombre. Si no coincide con nada → muestra "guardar".
