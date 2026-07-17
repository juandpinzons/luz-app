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
] as const;

export type ExternalSignalSource = (typeof EXTERNAL_SIGNAL_SOURCES)[number];

export interface ExternalSignal {
  source: ExternalSignalSource;
  content: string;
  occurredAt: Date;
}

export interface ExternalSignalSnapshot {
  signals: ExternalSignal[];
}
