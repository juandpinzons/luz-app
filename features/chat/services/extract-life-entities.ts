import { z } from "zod";
import { getAIProvider } from "../../../ai";
import type { Database } from "../../../core/db/client";
import {
  LIFE_DOMAIN_TYPES,
  findOrCreateGoal,
  findOrCreateHabit,
  findOrCreateProject,
  type LifeGraphContext,
} from "../../../core/life";

const lifeDomainSchema = z.enum(LIFE_DOMAIN_TYPES).nullable();

const extractionSchema = z.object({
  goal: z
    .object({ title: z.string().min(1).max(120), domain: lifeDomainSchema })
    .nullable(),
  project: z
    .object({ title: z.string().min(1).max(120), domain: lifeDomainSchema })
    .nullable(),
  habit: z
    .object({ title: z.string().min(1).max(120), domain: lifeDomainSchema })
    .nullable(),
});

const SYSTEM_PROMPT = `Analiza este intercambio y decide si la persona declaró, de forma explícita y clara, un Objetivo nuevo, un Proyecto nuevo, o un Hábito nuevo — algo que quiere lograr, un esfuerzo concreto que está emprendiendo, o un comportamiento recurrente que reconoce sobre sí misma.

Completa un campo únicamente cuando la declaración sea clara y explícita. Deja el campo en null si:
- es solo una mención de pasada, no una declaración real;
- es hipotético ("tal vez algún día...") o dudoso;
- ya se había mencionado antes en esta misma conversación;
- se trata de otra persona, no de quien habla;
- no estás seguro.

Nunca inventes ni completes con algo que no esté dicho. La mayoría de los mensajes no declaran nada de esto — dejar los tres campos en null es el resultado correcto casi siempre.`;

export interface ExtractLifeEntitiesInput {
  context: LifeGraphContext;
  userMessage: string;
  assistantReply: string;
}

/**
 * Convierte una declaración clara en la conversación (un Objetivo, un
 * Proyecto o un Hábito nuevo) en una fila real de `core/life` — el paso
 * que le da a LUZ una representación persistente de la vida de la
 * persona, más allá de la evidencia dispersa que ya captura Memoria.
 * Mismo criterio de contención que `generate-title.ts`: se llama vía
 * `after()` desde `finalizeReply` (nunca bloquea la respuesta), y
 * cualquier fallo — del proveedor de IA o de la escritura en base de
 * datos — se traga acá. La conversación nunca depende de que esto
 * funcione.
 *
 * A diferencia del título (que solo se genera una vez, en el primer
 * intercambio), esta extracción corre en CADA mensaje — un Objetivo
 * puede declararse en cualquier punto de la conversación, no solo al
 * principio. `findOrCreate*` (core/life/services/) evita filas
 * duplicadas si la persona menciona lo mismo más de una vez.
 */
export async function extractLifeEntities(
  db: Database,
  input: ExtractLifeEntitiesInput,
): Promise<void> {
  try {
    const aiProvider = getAIProvider();
    const extracted = await aiProvider.generateStructured(
      [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: input.userMessage },
        { role: "assistant", content: input.assistantReply },
      ],
      { name: "life_entity_extraction", schema: extractionSchema },
    );

    if (extracted.goal) {
      await findOrCreateGoal(db, input.context, {
        title: extracted.goal.title,
        domain: extracted.goal.domain ?? undefined,
      });
    }

    if (extracted.project) {
      await findOrCreateProject(db, input.context, {
        title: extracted.project.title,
        domain: extracted.project.domain ?? undefined,
      });
    }

    if (extracted.habit) {
      await findOrCreateHabit(db, input.context, {
        title: extracted.habit.title,
        domain: extracted.habit.domain ?? undefined,
      });
    }
  } catch (error) {
    console.error(
      "[extract-life-entities] no se pudo extraer/persistir:",
      error instanceof Error ? error.message : error,
    );
  }
}
