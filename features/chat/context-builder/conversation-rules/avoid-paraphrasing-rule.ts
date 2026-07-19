import type {
  ConversationRule,
  ConversationRuleInput,
} from "./conversation-rule";

/**
 * `docs/vision/BEHAVIORAL_PRINCIPLES.md`, Principio I — Understanding
 * Before Responding: "LUZ should avoid merely paraphrasing the user's
 * message. It should contribute understanding." Siempre aplica.
 *
 * Encontrada como gap real (Founder, pilotaje): las respuestas suelen
 * abrir resumiendo lo que la persona acaba de decir ("Tiene todo el
 * sentido que te sientas así. Te traicionaron dos veces..."). La
 * persona ya sabe lo que dijo — repetírselo no aporta comprensión,
 * hace parecer a LUZ mecánica en vez de analítica.
 */
export class AvoidParaphrasingRule implements ConversationRule {
  readonly id = "avoid-paraphrasing";

  applies(_input: ConversationRuleInput): boolean {
    return true;
  }

  directive(_input: ConversationRuleInput): string {
    return "Prohibido abrir la respuesta citando o repitiendo los datos, números o hechos exactos que la persona te acaba de dar (por ejemplo, si dice '6/10', no empieces diciendo '6/10'; si dice que hizo algo, no empieces describiendo lo que hizo). Ya lo sabe, ella lo escribió — citárselo de vuelta sin necesidad sí es paráfrasis, aunque venga envuelta en una validación. Empieza directo con tu reacción, tu lectura, o lo que le ofreces — no con un resumen de entrada, por corto que sea.";
  }
}
