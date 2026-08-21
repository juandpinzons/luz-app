import type { EntityId } from "../../life/value-objects/entity-id";
import type { LifeDomainType } from "../../life/value-objects/life-domain-type";

/**
 * `pending` -- generada, todavía es un vacío real (nadie la resolvió
 * todavía). `resolved` -- el área que apuntaba ganó cobertura real
 * desde que se creó (nueva señal real, con o sin relación directa a
 * esta pregunta -- Principio 1: nunca se finge saber que la persona
 * "respondió" literalmente, solo que el vacío que la motivó ya no es
 * tan vacío). `dismissed` -- superada por una pregunta más reciente
 * antes de resolverse (nunca hay más de una `pending` a la vez, ver
 * `CuriosityQuestionRepository.getPending`).
 */
export const CURIOSITY_QUESTION_STATUSES = ["pending", "resolved", "dismissed"] as const;
export type CuriosityQuestionStatus = (typeof CURIOSITY_QUESTION_STATUSES)[number];

/**
 * Una pregunta concreta y específica que LUZ querría hacerle a la
 * persona sobre un área de su vida que todavía entiende poco
 * (`core/knowledge-gaps`) -- la diferencia real entre
 * `CuriosityStrategyRule` (antes: una instrucción vaga para que el LLM
 * improvisara algo en el momento) y curiosidad genuina (una pregunta ya
 * pensada, concreta, que no cambia de redacción cada vez que se
 * ofrece). `coverageScoreAtCreation` existe para poder decidir después,
 * de forma objetiva, si el vacío que la motivó sigue vigente
 * (`resolveStaleCuriosityQuestions`) sin necesitar saber si la pregunta
 * en sí fue verbalizada -- LUZ no tiene manera de confirmar eso hoy, y
 * fingir que sí violaría el Principio 3 (explicabilidad).
 */
export interface CuriosityQuestion {
  id: EntityId;
  lifeGraphId: EntityId;
  domain: LifeDomainType;
  question: string;
  rationale: string;
  status: CuriosityQuestionStatus;
  coverageScoreAtCreation: number;
  /** Cuántas veces `CuriosityStrategyRule` de verdad incluyó esta pregunta como candidata en un turno -- ver `core/db/schema/curiosity-engine.ts` para el porqué (Principio 3, explicabilidad). */
  timesOffered: number;
  createdAt: Date;
  updatedAt: Date;
  resolvedAt?: Date;
}
