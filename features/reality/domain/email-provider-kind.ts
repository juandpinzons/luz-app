/** Reubicado a core/email-connections/domain/ (auditoría de arquitectura, 2026-08-15) --
 *  core/email-connections/repository.ts es quien persiste esta forma, y core/ no puede
 *  importar de features/. Re-export para que ningún consumidor de features/reality/domain
 *  tenga que cambiar. */
export type { EmailProviderKind } from "../../../core/email-connections/domain";
export { EMAIL_PROVIDER_KINDS } from "../../../core/email-connections/domain";
