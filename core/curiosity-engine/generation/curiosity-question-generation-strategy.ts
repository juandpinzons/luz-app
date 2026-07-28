import type { LifeDomainType } from "../../life/value-objects/life-domain-type";

export interface CuriosityQuestionGenerationInput {
  domain: LifeDomainType;
  domainLabel: string;
  /** Frases breves de lo que ya se sabe de la persona en OTRAS áreas -- ancla la pregunta a alguien real, no a un cuestionario genérico. Puede venir vacío (persona muy nueva). */
  knownAboutPerson: string[];
}

export interface ProposedCuriosityQuestion {
  question: string;
  rationale: string;
}

/**
 * Propone, nunca decide (Principio 8) -- el gate real (si hace falta
 * una pregunta nueva o no) vive en `generateCuriosityQuestion`, esta
 * estrategia solo redacta.
 */
export interface CuriosityQuestionGenerationStrategy {
  proposeQuestion(
    input: CuriosityQuestionGenerationInput,
  ): Promise<ProposedCuriosityQuestion | null>;
}
