import type { EntityId } from "../../life/value-objects/entity-id";
import type { LifeDomainType } from "../../life/value-objects/life-domain-type";

export const CONTRADICTION_STATUSES = [
  "open",
  "acknowledged",
  "resolved",
  "dismissed",
] as const;
export type ContradictionStatus = (typeof CONTRADICTION_STATUSES)[number];

/**
 * Referencia neutral a un extremo de la contradicción -- `refType` es
 * texto libre a propósito (`"belief"`, `"goal"`, `"habit"`...):
 * `core/contradiction-engine` nunca importa los tipos reales de
 * `core/life`/`core/belief-engine`/`core/knowledge-engine` (mismo
 * límite anti-corrupción que ya aplica `core/reality`, ADR-0013). Quien
 * ensambla los candidatos (capa de aplicación) es quien conoce el tipo
 * real y lo traduce a esta forma neutral.
 */
export interface ContradictionRef {
  refType: string;
  refId: EntityId;
}

/**
 * Una tensión detectada entre dos elementos ya conocidos de la
 * persona -- nunca para juzgar, para comprenderla mejor (instrucción
 * explícita del bloque de trabajo). `description` siempre explica el
 * POR QUÉ en términos neutrales, nunca como una acusación.
 */
export interface Contradiction {
  id: EntityId;
  lifeGraphId: EntityId;
  kind: string;
  left: ContradictionRef;
  right: ContradictionRef;
  description: string;
  domain?: LifeDomainType;
  status: ContradictionStatus;
  resolutionNote?: string;
  detectedAt: Date;
  resolvedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}
