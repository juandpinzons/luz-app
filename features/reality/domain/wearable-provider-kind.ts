/** Reubicado a core/wearable-metrics/domain/ (auditoría de arquitectura, 2026-08-15) --
 *  core/wearable-metrics/repository.ts es quien persiste esta forma, y core/ no puede
 *  importar de features/. Re-export para que ningún consumidor de features/reality/domain
 *  tenga que cambiar. */
export type { WearableProviderKind } from "../../../core/wearable-metrics/domain";
export { WEARABLE_PROVIDER_KINDS } from "../../../core/wearable-metrics/domain";
