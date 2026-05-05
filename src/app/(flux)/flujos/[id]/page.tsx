import PaginaEditorPlaceholder from './_componentes/PaginaEditorPlaceholder'

/**
 * /flujos/[id] — Editor visual del flujo.
 *
 * Sub-PR 19.1: placeholder con redirect + toast. El editor real
 * (canvas vertical de pasos, panel lateral, dnd-kit) llega en 19.2.
 * Mantenemos la ruta para que click-en-fila del listado, "Crear y editar"
 * del modal y "Duplicar" puedan navegar acá sin romper. Cuando 19.2
 * aterrice, este archivo se reemplaza por el editor de verdad.
 *
 * Decisión D2 del plan de scope: redirect + toast en lugar de página
 * estática vacía. Razón: el smoke E2E natural del backend ("creo flujo,
 * me lleva al editor, vuelvo, lo veo en el listado") tiene que poder
 * ejecutarse sin obligar al usuario a apretar "Volver" manualmente.
 */
export default async function PaginaFlujoEditor({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  // Resolvemos el id solo para que Next no se queje del prop no usado;
  // el placeholder no lo necesita pero el editor real de 19.2 sí.
  await params
  return <PaginaEditorPlaceholder />
}
