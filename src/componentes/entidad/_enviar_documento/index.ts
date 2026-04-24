// Barrel de sub-componentes internos del modal de envío de documentos

export { ChipEmail } from './ChipEmail'
export { InputEmailChips } from './InputEmailChips'
export { InputAsuntoVariables } from './InputAsuntoVariables'
export { PopoverProgramar } from './PopoverProgramar'
export { useEnvioDocumento } from './useEnvioDocumento'
export { iconoArchivo, formatoTamano, diaSiguienteCorto, formatoFechaProgramada } from './ayudantes'

// Re-exportar todos los tipos
export type {
  CanalCorreoEmpresa,
  PlantillaCorreo,
  AdjuntoDocumento,
  DatosEnvioDocumento,
  ContactoSugerido,
  DatosBorradorCorreo,
  DatosPlantillaCorreo,
  SnapshotCorreo,
  PropiedadesModalEnviarDocumento,
} from './tipos'
