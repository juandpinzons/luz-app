import type { EntityId } from "../../life/value-objects/entity-id";
import type { Confidence } from "../value-objects/confidence";
import type { InsightStatus } from "../value-objects/insight-status";
import type { InsightType } from "../value-objects/insight-type";

/**
 * Conocimiento derivado — "qué significa", a diferencia de Memory
 * ("qué pasó"). Su propio aggregate root, igual que `Memory`: Knowledge
 * opera SOBRE un LifeGraph, nunca es miembro del aggregate `LifeGraph`
 * (ADR-0011). `confidence` siempre está presente porque un `Insight`
 * solo existe una vez que la etapa Validate la asignó — nunca se
 * persiste un insight sin validar.
 */
export interface Insight {
  id: EntityId;
  lifeGraphId: EntityId;
  type: InsightType;
  description: string;
  confidence: Confidence;
  status: InsightStatus;
  createdAt: Date;
  updatedAt: Date;
  validatedAt?: Date;
}
