import type { AIProvider } from "../ai";
import type { Context } from "../features/chat/context-builder";
import type { RealitySnapshot } from "../core/reality";

/**
 * Un experimento cambia exactamente UN factor por variante, manteniendo
 * todo lo demás -- RealitySnapshot base, Conversation Rules, Voice,
 * modelo, mensaje del usuario -- idéntico por construcción (`baseline`
 * se pasa una sola vez; cada variante solo transforma lo que le toca).
 * `factor` es texto libre y corto (ej. "sin identidad" / "con
 * identidad") -- lo único que debería poder explicar la diferencia
 * entre dos respuestas, si el experimento está bien diseñado.
 */
export interface ExperimentVariant {
  name: string;
  factor: string;
  /**
   * Recibe el `RealitySnapshot` base y devuelve el que usará esta
   * variante -- nunca muta `baseline`, siempre devuelve una copia. La
   * mayoría de los experimentos solo tocan una sección (ej.
   * `concepts`); todo lo demás debe copiarse tal cual.
   */
  buildSnapshot: (baseline: RealitySnapshot) => RealitySnapshot;
}

export interface Experiment {
  name: string;
  /** Qué pregunta responde este experimento -- va en el reporte, para que quede registrado por qué se corrió. */
  question: string;
  baseline: RealitySnapshot;
  variants: ExperimentVariant[];
  /** Lo único que varía en la conversación misma -- se mantiene igual entre variantes, como pediste. */
  userMessage: string;
  /** Turnos previos, si el escenario los necesita -- vacío por defecto (mensaje aislado, más fácil de leer). */
  priorTurns?: { role: "user" | "assistant"; content: string }[];
  /** `false` por defecto -- la mayoría de los experimentos evalúan una respuesta a mitad de conversación, no el primer contacto. */
  isFirstContact?: boolean;
}

export interface HeuristicScores {
  characterCount: number;
  wordCount: number;
  lineCount: number;
  /** ¿Respetó el límite duro de Voice (`voice.maxLines`)? Nunca inventado -- el mismo número que ya decidió Voice Engine para este turno. */
  withinVoiceLineLimit: boolean;
  /**
   * Cuántos tokens de contenido "conocido" (memoria, concepto, vida
   * activa -- todo lo que el snapshot ya traía) aparecen literalmente
   * en la respuesta. Misma técnica de tokens compartidos que ya usa
   * `select-contextual-memories.ts` -- léxico, no semántico: mide piso,
   * no techo (una respuesta puede usar el contexto sin citar ninguna
   * palabra literal, y este número no lo vería).
   */
  knownContentTokenMatches: number;
}

export interface JudgeScore {
  score: number;
  justification: string;
}

export interface JudgeScores {
  personalizacion: JudgeScore;
  usoDeContexto: JudgeScore;
  coherenciaConHistorial: JudgeScore;
  referenciasLargoPlazo: JudgeScore;
  naturalidad: JudgeScore;
}

export interface RepetitionResult {
  repetitionIndex: number;
  response: string;
  durationMs: number;
  heuristics: HeuristicScores;
  judge: JudgeScores | null;
}

export interface VariantResult {
  variant: ExperimentVariant;
  systemPromptPreview: string;
  repetitions: RepetitionResult[];
}

export interface ExperimentResult {
  experiment: Experiment;
  provider: string;
  dryRun: boolean;
  variantResults: VariantResult[];
  runAt: Date;
}

/** Lo mínimo que el harness necesita del proveedor real -- nunca más que `AIProvider` (`ai/provider.ts`), nunca menos. Ver `ai-provider-mock.ts` para la implementación de `--dry-run`. */
export type EvaluationProvider = Pick<AIProvider, "name" | "generateReply" | "generateStructured">;

export type { Context };
