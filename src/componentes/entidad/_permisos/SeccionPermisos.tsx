'use client'

/**
 * SeccionPermisos — Panel de gestion de permisos con vista de matriz.
 * Solo visible para propietarios. Se integra en el perfil de cada usuario.
 *
 * Orquestador: delega la UI a sub-componentes y la logica al hook usePermisos.
 */

import { useState, useCallback } from 'react'
import { useRol } from '@/hooks/useRol'
import { CATEGORIAS_MODULOS } from '@/tipos'
import type { PermisosMapa } from '@/tipos'
import { usePermisos } from './usePermisos'
import { EncabezadoPermisos } from './EncabezadoPermisos'
import { ResumenPermisos } from './ResumenPermisos'
import { MatrizCategoria } from './MatrizCategoria'
import { HistorialAuditoria } from './HistorialAuditoria'
import { ModalRevocacion } from './ModalRevocacion'
import type { PropiedadesSeccionPermisos } from './tipos'

function SeccionPermisos({
  miembroId,
  rol,
  permisosCustomIniciales,
  auditoriaInicial = [],
  onGuardar,
  onRevocar,
}: PropiedadesSeccionPermisos) {
  const { esPropietario, esAdmin } = useRol()
  const [modalRevocar, setModalRevocar] = useState(false)

  const {
    permisos,
    usaCustom,
    guardando,
    estadisticas,
    toggleAccion,
    todoModulo,
    nadaModulo,
    toggleColumna,
    aplicarPreset,
    aplicarPresetCategoria,
    restablecer,
    guardar,
  } = usePermisos({ miembroId, rol, permisosCustomIniciales, onGuardar })

  // Revocar todo: delega al padre y limpia estado local
  const confirmarRevocacion = useCallback(async (motivo: string) => {
    await onRevocar(motivo)
    // El hook se sincronizara via permisosCustomIniciales al re-render del padre
    setModalRevocar(false)
  }, [onRevocar])

  // No mostrar si no es propietario ni admin, o si el miembro es propietario
  if ((!esPropietario && !esAdmin) || rol === 'propietario') return null

  return (
    <section className="space-y-5">
      {/* Zona 1 — Encabezado */}
      <EncabezadoPermisos
        rol={rol}
        usaCustom={usaCustom}
        guardando={guardando}
        onRestablecer={restablecer}
        onRevocar={() => setModalRevocar(true)}
        onGuardar={guardar}
      />

      {/* Zona 2 — Resumen */}
      <ResumenPermisos
        estadisticas={estadisticas}
        rol={rol}
        onPreset={aplicarPreset}
      />

      {/* Zona 3 — Matrices por categoria */}
      <div className="space-y-3">
        {Object.entries(CATEGORIAS_MODULOS).map(([key, categoria]) => (
          <MatrizCategoria
            key={key}
            categoriaKey={key}
            nombre={categoria.nombre}
            modulos={categoria.modulos}
            permisos={permisos}
            onToggleAccion={toggleAccion}
            onTodoModulo={todoModulo}
            onNadaModulo={nadaModulo}
            onPresetCategoria={aplicarPresetCategoria}
            onToggleColumna={toggleColumna}
          />
        ))}
      </div>

      {/* Historial de auditoria */}
      <HistorialAuditoria entradas={auditoriaInicial} />

      {/* Modal de revocacion de emergencia */}
      <ModalRevocacion
        abierto={modalRevocar}
        onCerrar={() => setModalRevocar(false)}
        onConfirmar={confirmarRevocacion}
      />
    </section>
  )
}

export { SeccionPermisos }
