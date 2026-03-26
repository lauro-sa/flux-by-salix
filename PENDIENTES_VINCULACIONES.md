# Pendientes: Sistema de Vinculaciones Mejorado

> Usar este documento como brief para el próximo chat. Ya está la base hecha, falta mejorar la UX.

---

## Estado actual

- **API**: `POST/PATCH/DELETE /api/contactos/vinculaciones` — ya cambiada a UNIDIRECCIONAL (una sola fila por vínculo)
- **BD**: tabla `contacto_vinculaciones` con `contacto_id` (dueño) → `vinculado_id` (vinculado)
- **API detalle**: `GET /api/contactos/[id]` ya devuelve `vinculaciones` (mis vinculados) y `vinculaciones_inversas` (donde me vincularon, filtradas)
- **Componente**: `VinculacionesContacto.tsx` en `src/app/(flux)/contactos/_componentes/` — funcional pero básico

---

## Cambios necesarios

### 1. Vinculación unidireccional (YA HECHO)
- Al vincular A→B: solo se crea UNA fila (contacto_id=A, vinculado_id=B)
- A ve a B en "Contactos vinculados" (puede editar puesto, desvincular, toggle recibe docs)
- B ve a A en "Vinculado en" (read-only, para desvincular debe ir a A)

### 2. Buscador jerárquico al vincular
Cuando buscás "TechCorp", debe aparecer:
```
TechCorp Argentina SA (Empresa)
  ├── María García (Gerente Comercial)
  └── Roberto Fernández (Técnico Senior)
```
- Los "hijos" son los contactos que TechCorp tiene en SUS `vinculados[]`
- También mostrar hijos de edificios, proveedores (cualquier contenedor)
- Poder vincular directamente a un hijo sin abrir la empresa

**Implementación**: en el buscador del modal de vinculación, después de buscar contactos, para cada resultado que sea empresa/edificio/proveedor, hacer una sub-query de sus vinculados y mostrarlos indentados.

### 3. Modal de edición rápida
Al tocar un contacto vinculado, abrir un modal con:
- Nombre completo (editable)
- Correo (editable)
- Teléfono (editable)
- WhatsApp (editable)
- Puesto/rol contextual (editable, con sugerencias)
- Toggle recibe documentos
- Botón "Ver ficha completa" → navega a /contactos/[id]
- Botón "Desvincular"

Los cambios en nombre/correo/teléfono se guardan en el contacto (PATCH /api/contactos/[id]).
Los cambios en puesto/recibe_documentos se guardan en la vinculación (PATCH /api/contactos/vinculaciones).

### 4. Crear contacto inline al vincular
Si buscás y no encontrás:
- Mostrar botón "Crear [texto buscado] como nuevo contacto"
- Al tocar, abrir el mismo modal de edición rápida pero en modo creación
- Pedir: tipo de contacto, nombre, correo/teléfono (mínimo)
- Al guardar: POST /api/contactos (crea el contacto) + POST /api/contactos/vinculaciones (lo vincula)
- El contacto queda creado y vinculado en un solo paso

### 5. Tarjetas de vinculados mejoradas (estilo screenshot)
Cada vinculado debe mostrar en una tarjeta:
- Avatar con color del tipo + icono (empresa/edificio) o iniciales (persona)
- Nombre completo
- Badges: Tipo (Persona/Empresa), Puesto si tiene
- Teléfono
- Correo
- Botón X para desvincular (solo en "Contactos vinculados", no en "Vinculado en")
- Click en la tarjeta → abre modal de edición rápida

### 6. Secciones en la ficha del contacto
**"Contactos vinculados" (N)**
- Descripción: "Contactos vinculados a [nombre]. Podés desvincularlos y cambiar el puesto."
- Tarjetas de vinculados (editables)

**"Vinculado en" (N)**
- Descripción: "Contactos donde [nombre] está vinculado. Para desvincular, entrá al contacto de origen."
- Tarjetas read-only (sin X, sin editar puesto)

---

## Archivos a modificar

1. `src/app/(flux)/contactos/_componentes/VinculacionesContacto.tsx` — reescribir completo
2. `src/app/api/contactos/vinculaciones/route.ts` — YA actualizado a unidireccional
3. `src/app/api/contactos/[id]/route.ts` — la query de inversas YA filtra correctamente
4. Posiblemente crear un nuevo endpoint para buscar hijos de un contacto contenedor

---

## Referencia
Ver `INFORMES DEL OTRO Sofware/INFORME_VINCULACIONES_CONTACTOS.md` para el detalle completo del sistema original.
