/**
 * STUB temporal — la implementación real está en construcción en otro chat.
 *
 * `enriquecerListadoPresupuestos` agrega información derivada al listado
 * (nombre del contacto resuelto, estado descriptivo, sumas de cuotas, etc.).
 * Mientras no se commitee la versión real: pass-through. El listado se
 * muestra con los campos crudos de la tabla `presupuestos` sin
 * enriquecer.
 */
export async function enriquecerListadoPresupuestos<T>(
  _admin: unknown,
  _empresaId: string,
  data: T[],
): Promise<T[]> {
  return data
}
