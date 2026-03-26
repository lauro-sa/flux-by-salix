# Informe: Sistema de Sectores y Puestos de Trabajo — SalixCRM

## 1. CONCEPTOS GENERALES

El sistema gestiona la **estructura organizacional** de una empresa mediante dos entidades independientes pero relacionadas:

- **Sectores** (departamentos): estructura jerárquica tipo árbol (organigrama)
- **Puestos** (cargos/roles laborales): catálogo de posiciones que pueden estar asociadas a sectores específicos o ser globales

---

## 2. SECTORES (Departamentos)

### 2.1 Estructura de datos

Cada sector tiene:

```
{
  id: string único autogenerado
  nombre: string ("Comercio", "Tecnología", etc.)
  color: string hex ("#f59e0b")
  activo: boolean
  orden: number (para ordenar visualmente)
  padreId: string | null (ID del sector padre — esto crea la jerarquía)
  jefeId: string | null (ID del usuario que es jefe del sector)
  jefeNombre: string | null (nombre cacheado del jefe)
  esPredefinido: boolean (si vino de fábrica o lo creó el usuario)
}
```

### 2.2 Jerarquía tipo árbol

- Un sector puede tener un **padreId** que apunta a otro sector, creando relaciones padre-hijo
- Esto permite anidar sectores: `Empresa → Comercio → Ventas Mayoristas → Zona Norte`
- Los sectores **raíz** son los que tienen `padreId: null`
- No hay límite de profundidad de anidamiento
- **Prevención de referencias circulares**: al asignar un padre, se excluye a sí mismo y a todos sus descendientes del selector

### 2.3 Sectores predefinidos (de fábrica)

Vienen 7 sectores por defecto al crear una empresa:

| Sector | Color |
|--------|-------|
| General | Gris |
| Comercio | Ámbar |
| Industria | Azul |
| Servicios | Violeta |
| Tecnología | Cyan |
| Salud | Esmeralda |
| Educación | Índigo |

Todos son editables (nombre, color, jerarquía) y eliminables. Se pueden restablecer a los valores de fábrica.

### 2.4 Jefe de sector

- Cada sector puede tener **un jefe asignado** (usuario activo de la empresa)
- El jefe se selecciona de un dropdown de usuarios activos
- Un mismo usuario puede ser jefe de **múltiples sectores**
- Si el jefe se desactiva como usuario, queda referenciado pero se debería limpiar

### 2.5 Asignación de usuarios a sectores

- Un usuario puede pertenecer a **múltiples sectores** simultáneamente
- Se designa un **sector primario** (para reportes, filtros por defecto, etc.)
- Campos en el usuario:
  ```
  sectorIds: ["sec_123", "sec_456"]       // Array de IDs de sectores
  sectorNombres: { "sec_123": "Comercio", "sec_456": "Tecnología" }  // Mapa nombre
  sectorPrimarioId: "sec_123"             // Sector principal
  ```
- Compatibilidad con formato legacy de un solo sector (`sectorId` / `sectorNombre`)

### 2.6 Eliminación de sectores — Alertas de seguridad

Cuando se intenta eliminar un sector:

1. El sistema **cuenta cuántas personas** están asignadas a ese sector
2. El sistema **cuenta cuántos sub-sectores** (hijos) tiene
3. Se muestra una **alerta con el impacto**:
   - "Este sector tiene X personas y Y sub-sectores"
4. Se ofrecen **opciones**:
   - **Mover personas** a otro sector (selector de destino)
   - **Dejar sin asignar** (se les quita el sector)
5. Los **sub-sectores se promueven** automáticamente a nivel raíz (no se eliminan en cascada)
6. Solo después de elegir qué hacer con las personas se permite confirmar la eliminación

### 2.7 Estadísticas visibles

La UI muestra en todo momento:
- Total de sectores activos
- Total de usuarios asignados a algún sector
- **Usuarios sin asignar** (con badge de advertencia si hay alguno)

---

## 3. PUESTOS DE TRABAJO (Cargos)

### 3.1 Estructura de datos

```
{
  id: string único autogenerado
  nombre: string ("Director Comercial", "Vendedor", etc.)
  descripcion: string (opcional, breve descripción del puesto)
  color: string hex
  activo: boolean
  orden: number
  sectorIds: string[] (sectores donde aplica — vacío = todos los sectores)
}
```

### 3.2 Relación con sectores

- Un puesto puede estar **vinculado a sectores específicos** (ej: "Vendedor" solo en "Comercio")
- Si `sectorIds` está vacío → el puesto está **disponible en todos los sectores**
- Esto es un filtro de conveniencia, no una restricción dura

### 3.3 Puestos predefinidos

El catálogo viene vacío por defecto — cada empresa crea los suyos. Se pueden restablecer valores de fábrica si se configuraron.

### 3.4 Eliminación de puestos — Alertas de seguridad

El sistema busca **contactos** que usen ese puesto (en campos `cargo` y `rubro`):

1. Muestra la **cantidad de contactos afectados** (hasta 50, luego "50+")
2. Muestra la **lista con nombres y correos** de los afectados
3. Ofrece **dos opciones**:
   - **Eliminar completamente**: se borra el puesto de todos los contactos
   - **Reemplazar con otro**: se puede elegir un puesto existente o escribir uno nuevo
4. Solo después de elegir se confirma

### 3.5 Restablecimiento a valores de fábrica

Si se restablecen los puestos por defecto:
- Se muestra qué puestos **desaparecerían** (los que el usuario creó y no están en la lista de fábrica)
- Para cada puesto que desaparece: opción de **mantener / eliminar / reemplazar**
- Se muestra cuántos contactos usa cada puesto afectado

---

## 4. VISUALIZACIÓN DEL ORGANIGRAMA (Árbol)

### 4.1 Vista de árbol jerárquico

- Se renderiza como un **árbol visual indentado**
- Cada nivel de anidamiento agrega indentación progresiva
- Conexiones padre-hijo se muestran con líneas visuales
- Sectores raíz al nivel 0, hijos indentados progresivamente

### 4.2 Cada nodo del árbol muestra:

- **Nombre** del sector con su **color** (chip/badge)
- **Jefe** asignado (avatar + nombre) o "Sin jefe"
- **Cantidad de miembros**
- **Acciones** (al hacer hover en desktop, siempre visibles en mobile):
  - Editar sector
  - Agregar sub-sector (hijo)
  - Ver/gestionar miembros
  - Eliminar sector

### 4.3 Edición inline

Al editar un sector se abre un panel inline con:
- Input de nombre
- Selector de color (12 colores predefinidos + input hex personalizado)
- Selector de sector padre (con prevención de referencia circular)
- Selector de jefe (dropdown de usuarios activos)
- Botones Aplicar / Cancelar

### 4.4 Gestión de miembros desde el árbol

- Click en "miembros" de un sector → se expande la lista de usuarios asignados
- Buscador para agregar usuarios al sector
- Botón para mover usuarios entre sectores
- Se muestra el rol/puesto de cada miembro y sus otros sectores

---

## 5. INTEGRACIÓN CON OTROS MÓDULOS

### 5.1 Usuarios

- El perfil de usuario muestra sus sectores y su sector primario
- Filtro de usuarios por sector en la vista de lista
- Al buscar usuarios, los tokens de búsqueda incluyen nombres de sectores

### 5.2 Asistencias

- Filtro de asistencias por sector y por jefe de sector
- Un jefe puede ver las asistencias de los miembros de sus sectores

### 5.3 Contactos

- Los contactos tienen campos `cargo` y `rubro` que se vinculan al catálogo de puestos
- Se usa para buscar impacto al eliminar puestos

---

## 6. TIEMPO REAL

- Los sectores y puestos se cargan con **listeners en tiempo real** (cualquier cambio se refleja inmediatamente en todas las pantallas abiertas)
- No se necesita recargar la página para ver cambios de otro usuario

---

## 7. RESUMEN DE REGLAS DE NEGOCIO

| Regla | Detalle |
|-------|---------|
| Un usuario puede estar en N sectores | Sí, con uno marcado como primario |
| Un usuario puede ser jefe de N sectores | Sí |
| Un sector puede tener N sub-sectores | Sí, sin límite de profundidad |
| Un sector puede tener solo 1 jefe | Sí |
| Los sectores vienen predefinidos | 7 de fábrica, editables y eliminables |
| Los puestos vienen predefinidos | No, cada empresa crea los suyos |
| Un puesto puede estar en N sectores | Sí, o en todos si no se especifica |
| Eliminar sector con personas | Alerta + opción de mover o desasignar |
| Eliminar puesto con contactos | Alerta + opción de reemplazar o eliminar |
| Eliminar sector padre | Hijos se promueven a raíz, no se eliminan |
| Referencias circulares en jerarquía | Prevenidas por validación |
| Cambios en tiempo real | Sí, listeners reactivos |
