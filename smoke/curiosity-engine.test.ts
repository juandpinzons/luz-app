import { db } from "../core/db/client";
import {
  CURIOSITY_GAP_THRESHOLD,
  DrizzleCuriosityQuestionRepository,
  generateCuriosityQuestion,
  resolveStaleCuriosityQuestions,
  type CuriosityQuestionGenerationStrategy,
  type ProposedCuriosityQuestion,
} from "../core/curiosity-engine";
import type { DomainCoverage } from "../core/knowledge-gaps";
import type { SmokeContext, SmokeFlow } from "./types";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

/** Estrategia de IA falsa -- mismo criterio que `FakeReasoningStrategy`/`FakeContradictionDetectionStrategy`. */
class FakeCuriosityQuestionGenerationStrategy implements CuriosityQuestionGenerationStrategy {
  callCount = 0;

  constructor(private readonly response: ProposedCuriosityQuestion | null) {}

  async proposeQuestion(): Promise<ProposedCuriosityQuestion | null> {
    this.callCount += 1;
    return this.response;
  }
}

export const curiosityEngineFlow: SmokeFlow = {
  name: "curiosity-engine",
  async run(ctx: SmokeContext) {
    const context = ctx.lifeGraphContext;
    const repository = new DrizzleCuriosityQuestionRepository(db);

    // Fixture 1: cobertura ya por encima del umbral -- el vacío no es
    // real, generateCuriosityQuestion debe volver sin llamar a la
    // estrategia (ningún gasto de IA sobre un área ya cubierta).
    const wellCoveredStrategy = new FakeCuriosityQuestionGenerationStrategy({
      question: "Smoke: no debería usarse",
      rationale: "Smoke: no debería usarse",
    });
    const noneNeeded = await generateCuriosityQuestion(repository, wellCoveredStrategy, context, {
      weakestDomain: { domain: "career", label: "Carrera", coverageScore: CURIOSITY_GAP_THRESHOLD },
      knownAboutPerson: [],
    });
    assert(noneNeeded === null, "cobertura >= umbral no debería generar ninguna pregunta");
    assert(wellCoveredStrategy.callCount === 0, "cobertura >= umbral nunca debería llamar a la estrategia");

    // Fixture 2: vacío real, sin pregunta pendiente todavía -- debe
    // proponer y persistir con status 'pending'.
    const proposingStrategy = new FakeCuriosityQuestionGenerationStrategy({
      question: "Smoke: ¿qué es lo que más disfrutas de tu trabajo ahora mismo?",
      rationale: "Smoke: carrera sigue sin ningún goal/project/habit clasificado ahí",
    });
    const created = await generateCuriosityQuestion(repository, proposingStrategy, context, {
      weakestDomain: { domain: "career", label: "Carrera", coverageScore: 10 },
      knownAboutPerson: ["Smoke: le gusta correr los fines de semana"],
    });
    assert(created !== null, "un vacío real sin pendiente debería producir una pregunta persistida");
    assert(created.status === "pending", `status incorrecto: ${created?.status}`);
    assert(created.domain === "career", `domain incorrecto: ${created?.domain}`);
    assert(created.coverageScoreAtCreation === 10, "coverageScoreAtCreation no coincide con lo recibido");

    // Fixture 3: ya hay una 'pending' (la de la Fixture 2) -- a lo sumo
    // una a la vez, nunca un backlog. No debe llamar a la estrategia de
    // nuevo.
    const secondStrategy = new FakeCuriosityQuestionGenerationStrategy({
      question: "Smoke: segunda pregunta que nunca debería crearse",
      rationale: "Smoke",
    });
    const blocked = await generateCuriosityQuestion(repository, secondStrategy, context, {
      weakestDomain: { domain: "health", label: "Salud", coverageScore: 5 },
      knownAboutPerson: [],
    });
    assert(blocked === null, "con una pregunta 'pending' ya existente, no debería generarse una segunda");
    assert(secondStrategy.callCount === 0, "con una pendiente ya existente, nunca debería llamarse a la estrategia");

    // Fixture 4: resolveStaleCuriosityQuestions -- el dominio de la
    // pendiente (career) ya ganó cobertura real (>= umbral): debe
    // quedar 'resolved', nunca por asumir que se verbalizó.
    const coverageNowResolved: DomainCoverage[] = [
      { domain: "career", coverageScore: CURIOSITY_GAP_THRESHOLD },
      { domain: "health", coverageScore: 50 },
    ];
    await resolveStaleCuriosityQuestions(repository, context, coverageNowResolved);
    const afterResolve = await repository.getPending(context);
    assert(afterResolve === null, "tras ganar cobertura real, la pregunta ya no debería seguir 'pending'");

    // Fixture 5: una nueva pendiente sobre 'career', pero ahora otro
    // dominio (health) es claramente más urgente -- debe quedar
    // 'dismissed', superada, para que el siguiente ciclo apunte al
    // vacío real actual.
    const dismissStrategy = new FakeCuriosityQuestionGenerationStrategy({
      question: "Smoke: pregunta que será superada",
      rationale: "Smoke",
    });
    const secondPending = await generateCuriosityQuestion(repository, dismissStrategy, context, {
      weakestDomain: { domain: "career", label: "Carrera", coverageScore: 15 },
      knownAboutPerson: [],
    });
    assert(secondPending !== null, "se esperaba una nueva pregunta pendiente para esta fixture");

    const coverageNowDismissed: DomainCoverage[] = [
      { domain: "career", coverageScore: 15 },
      { domain: "health", coverageScore: 3 },
    ];
    await resolveStaleCuriosityQuestions(repository, context, coverageNowDismissed);
    const afterDismiss = await repository.getPending(context);
    assert(
      afterDismiss === null,
      "con otro dominio ahora más urgente, la pregunta anterior ya no debería seguir 'pending'",
    );
  },
};
