/**
 * Señales externas (calendario, documentos, email, sensores) —
 * ninguna existe como engine todavía (Sprint 18+ en el roadmap). El
 * placeholder existe para que `RealitySnapshot` no necesite un cambio
 * de forma cuando esos engines lleguen; `signals` se espera vacío
 * indefinidamente hasta entonces.
 */
export const EXTERNAL_SIGNAL_SOURCES = [
  "calendar",
  "document",
  "email",
  "sensor",
  "youtube",
] as const;

export type ExternalSignalSource = (typeof EXTERNAL_SIGNAL_SOURCES)[number];

export interface ExternalSignal {
  source: ExternalSignalSource;
  content: string;
  occurredAt: Date;
  /**
   * Para cuándo importa esta señal, si aplica (p. ej. la hora de
   * inicio de un evento de calendario) -- mismo criterio que
   * `LifeStateItem.dueDate`. Alimenta la misma urgencia genérica de
   * `DeterministicContextScoringStrategy` (`core/context-engine`), ya
   * indiferente a la fuente -- ninguna lógica de scoring nueva hace
   * falta para que una reunión en 20 minutos pese más que una de la
   * próxima semana.
   */
  dueDate?: Date;
}

export interface ExternalSignalSnapshot {
  signals: ExternalSignal[];
}
