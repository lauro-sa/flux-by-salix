---
name: Reiniciar servidor automáticamente
description: Siempre reiniciar el dev server yo mismo después de cambios, no pedirle al usuario que lo haga
type: feedback
---

Siempre reiniciar el dev server automáticamente después de hacer cambios significativos en archivos.

**Why:** El usuario no quiere que le diga "reiniciá el server", quiere que lo haga yo directamente.

**How to apply:** Después de cambios en múltiples archivos .tsx o cambios de estructura, matar el proceso en el puerto 3000 y relanzar `npm run dev` en background.
