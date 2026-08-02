import type { ConversationStrategyDirective } from "../entities/conversation-strategy-directive";
import type { ConversationStrategyType } from "../value-objects/conversation-strategy-type";
import type {
  ConversationStrategyRule,
  ConversationStrategyRuleInput,
} from "./conversation-strategy-rule";

const KIND_LABEL: Record<"goal" | "project", string> = {
  goal: "objetivo",
  project: "proyecto",
};

/**
 * Cierres reales (`docs/product/ALPHA_EXPERIENCE_V1_DESIGN.md` §3.6,
 * `AcknowledgeClosureRule`, adaptada a Conversation Strategy -- mismo
 * motivo que `ReopenStrategyRule`: exclusión mutua real, no
 * coordinada a mano). Reconoce que un Goal/Project se completó
 * (`RealitySnapshot.closures`, ya filtrado por `seen_prompts` y por
 * una ventana de recencia real -- ver `listRecentlyCompletedGoals`)
 * -- el hecho específico, nunca un "felicidades" genérico: sin
 * representación de "arco" (el modelo de datos solo tiene `status` +
 * fechas, ver `ALPHA_EXPERIENCE_V1_DESIGN.md` §1.4), el reconocimiento
 * es del cierre, no de la narrativa completa detrás.
 *
 * Prioridad 47, justo por encima de `CelebrateStrategyRule` (45): un
 * cierre real y específico, ya verificado contra `seen_prompts`, le
 * gana a una memoria reciente genérica cuando ambos podrían aplicar el
 * mismo turno -- sin esto, un Goal completado y capturado como memoria
 * podría disparar las dos posturas a la vez, cada una con su propia
 * redacción.
 */
export class AcknowledgeClosureStrategyRule implements ConversationStrategyRule {
  readonly id: ConversationStrategyType = "acknowledge_closure";
  readonly priority = 47;

  appliesTo(input: ConversationStrategyRuleInput): boolean {
    if (input.isFirstContact) {
      return false;
    }
    return input.realitySnapshot.closures.items.length > 0;
  }

  explain(input: ConversationStrategyRuleInput): ConversationStrategyDirective {
    const closure = input.realitySnapshot.closures.items[0];

    if (!closure) {
      throw new Error(
        "AcknowledgeClosureStrategyRule.explain(): llamado sin que appliesTo() haya sido true primero.",
      );
    }

    return {
      strategy: this.id,
      reason: `Un ${KIND_LABEL[closure.kind]} real se completó y todavía no se reconoció: "${closure.title}".`,
      primaryObjective:
        `Reconoce específicamente que "${closure.title}" se cerró -- fue un ${KIND_LABEL[closure.kind]} real, no solo una tarea, y merece nombrarse como tal antes de seguir con cualquier otra cosa.`,
      avoid:
        "Un 'felicidades' genérico que serviría para cualquier cierre, o inventar una narrativa sobre el esfuerzo que el dato no respalda.",
    };
  }
}
