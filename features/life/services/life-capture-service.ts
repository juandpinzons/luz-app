import { z } from "zod";
import { getAIProvider } from "../../../ai";
import type { Database } from "../../../core/db/client";
import {
  LIFE_DOMAIN_TYPES,
  RELATIONSHIP_TYPES,
  findOrCreateGoal,
  findOrCreateHabit,
  findOrCreateProject,
  findOrCreateRelationship,
  type LifeGraphContext,
} from "../../../core/life";
import type { Memory } from "../../../core/memory-engine";
import { describeError } from "../../../core/observability/describe-error";
import { logger } from "../../../core/observability/logger";
import { recordEvent } from "../../../core/observability/record-event";

const lifeDomainSchema = z.enum(LIFE_DOMAIN_TYPES).nullable();

const goalOrProjectSchema = z.object({
  found: z.boolean(),
  kind: z.enum(["goal", "project"]).nullable(),
  title: z.string().min(1).max(120).nullable(),
  domain: lifeDomainSchema,
});

const habitSchema = z.object({
  found: z.boolean(),
  title: z.string().min(1).max(120).nullable(),
  domain: lifeDomainSchema,
});

const relationshipSchema = z.object({
  found: z.boolean(),
  personName: z.string().min(1).max(80).nullable(),
  type: z.enum(RELATIONSHIP_TYPES).nullable(),
});

/**
 * Único punto donde una Memory clasificada se convierte en una fila
 * real de `core/life` — disparado únicamente por lo que el Memory
 * Engine ya produjo (`memory.type`), nunca por un análisis
 * independiente del mensaje/respuesta en crudo. Reemplaza a
 * `features/chat/services/extract-life-entities.ts` (retirado): ese
 * flujo decidía "¿es esto un Goal?" con su propia llamada de IA,
 * duplicando el juicio que `DeterministicMemoryClassifier` ya hace —
 * exactamente el "pipeline paralelo" que esto existe para eliminar.
 * Un solo origen de verdad: Conversación → Memory Engine → Life.
 *
 * La llamada de IA que sí ocurre acá NUNCA redecide el tipo — solo
 * extrae campos estructurados (título, a quién se refiere) de un
 * contenido que el Memory Engine ya clasificó con confianza
 * suficiente. Si ni así encuentra algo claro, no crea nada (`found:
 * false`) — mismo criterio de "no inventar" que ya regía la extracción
 * anterior.
 *
 * Investigación real (2026-08-15, cuenta del Founder en producción):
 * este función ANTES exigía además `memory.rank.score >=
 * MIN_SCORE_WITH_UNDERSTANDING_SIGNAL` (45) -- ese umbral mide una
 * pregunta distinta ("¿esta memoria revela algo profundo?", ver
 * `UNDERSTANDING_SIGNALS`), no "¿el clasificador determinista está
 * seguro de que esto es un Goal/Relationship real?", que es lo único
 * que `memory.type` ya responde por su cuenta. Evidencia real: 13
 * memorias reales de tipo `relationship` (pareja, familia, un amigo
 * nombrado) nunca se capturaron porque ninguna cruzó rank_score 45 --
 * `relationship_change` (la única categoría de `UNDERSTANDING_SIGNALS`
 * relacionada) está deliberadamente acotada a crisis/reconciliación
 * ("nos distanciamos", "me fue infiel"), nunca a una mención rutinaria
 * de una relación real. Quitado -- `memory.type` ya es la señal de
 * confianza correcta para esta decisión, el score gate solo bloqueaba
 * exactamente el contenido que este código existe para capturar.
 *
 * Nunca lanza: cualquier fallo (IA o escritura) se traga acá y se
 * loguea con detalle real (`describeError`) — la conversación nunca
 * depende de que esto funcione, mismo criterio que ya protege la
 * captura de Memory Engine en `send-message.ts`.
 */
export async function captureLifeEntityFromMemory(
  db: Database,
  context: LifeGraphContext,
  memory: Memory,
): Promise<void> {
  try {
    switch (memory.type) {
      case "goal":
        await captureGoalOrProject(db, context, memory.content);
        break;
      case "pattern":
        await captureHabit(db, context, memory.content);
        break;
      case "relationship":
        await captureRelationship(db, context, memory.content);
        break;
      default:
        // fact/ritual/preference/event/intention: sin mapeo a una
        // entidad de Life en V1 — no toda Memory debe convertirse en
        // algo, ver docs/product/ALPHA_EXPERIENCE_V1_DESIGN.md §1.4.
        return;
    }
  } catch (error) {
    // Detalle completo (incluye `errorStack`/`errorQuery`) solo a
    // consola -- nunca a `events.metadata`: cardinalidad no acotada (un
    // stack es distinto cada vez). `describeError` ya ni siquiera
    // devuelve los valores de parámetros SQL (podían traer contenido
    // real del usuario, invariante de privacidad del dominio) --
    // endurecido 2026-08-14. Ver auditoría 2026-07-25 en
    // OBSERVABILITY_PLAN.md.
    const detail = describeError(error);
    logger.log({
      event: "background.life_capture.failed",
      severity: "error",
      lifeGraphId: context.lifeGraphId,
      memoryId: memory.id,
      memoryType: memory.type,
      ...detail,
    });

    // `recordEvent` persiste en `events` (consultable por
    // `obs:report`) -- solo el subconjunto acotado y seguro: nombre,
    // código SQLSTATE y mensaje, no el stack ni los parámetros.
    await recordEvent(db, {
      type: "error",
      route: "background.life_capture",
      message: error instanceof Error ? error.message : String(error),
      metadata: {
        lifeGraphId: context.lifeGraphId,
        memoryId: memory.id,
        memoryType: memory.type,
        errorName: detail.errorName,
        errorCode: detail.errorCode,
      },
    });
  }
}

const GOAL_OR_PROJECT_PROMPT = `Esta memoria ya fue clasificada como una declaración de tipo "goal" (objetivo/aspiración). Tu único trabajo es extraer un título limpio y decidir si describe mejor un Objetivo (una aspiración, sin esfuerzo delimitado concreto) o un Proyecto (un esfuerzo concreto, con alcance más definido) — nunca decidir si es o no una declaración real, eso ya se decidió.

Si el texto no trae suficiente claridad para un título limpio, responde found: false. Nunca inventes un título que no esté respaldado por el texto.`;

async function captureGoalOrProject(
  db: Database,
  context: LifeGraphContext,
  content: string,
): Promise<void> {
  const extracted = await getAIProvider().generateStructured(
    [
      { role: "system", content: GOAL_OR_PROJECT_PROMPT },
      { role: "user", content },
    ],
    { name: "life_capture_goal_or_project", schema: goalOrProjectSchema },
  );

  if (!extracted.found || !extracted.title || !extracted.kind) {
    return;
  }

  if (extracted.kind === "project") {
    await findOrCreateProject(db, context, {
      title: extracted.title,
      domain: extracted.domain ?? undefined,
    });
  } else {
    await findOrCreateGoal(db, context, {
      title: extracted.title,
      domain: extracted.domain ?? undefined,
    });
  }
}

const HABIT_PROMPT = `Esta memoria ya fue clasificada como un patrón de comportamiento recurrente. Tu único trabajo es extraer un título limpio para el Hábito que describe — nunca decidir si es o no un patrón real, eso ya se decidió.

Si el texto no trae suficiente claridad para un título limpio, responde found: false.`;

async function captureHabit(
  db: Database,
  context: LifeGraphContext,
  content: string,
): Promise<void> {
  const extracted = await getAIProvider().generateStructured(
    [
      { role: "system", content: HABIT_PROMPT },
      { role: "user", content },
    ],
    { name: "life_capture_habit", schema: habitSchema },
  );

  if (!extracted.found || !extracted.title) {
    return;
  }

  await findOrCreateHabit(db, context, {
    title: extracted.title,
    domain: extracted.domain ?? undefined,
  });
}

const RELATIONSHIP_PROMPT = `Esta memoria ya fue clasificada como referida a una relación con otra persona. Tu único trabajo es extraer el nombre de esa persona y el tipo de vínculo — nunca decidir si describe o no una relación real, eso ya se decidió.

Si el texto no nombra a una persona identificable, responde found: false. Nunca inventes un nombre que no esté en el texto.`;

async function captureRelationship(
  db: Database,
  context: LifeGraphContext,
  content: string,
): Promise<void> {
  const extracted = await getAIProvider().generateStructured(
    [
      { role: "system", content: RELATIONSHIP_PROMPT },
      { role: "user", content },
    ],
    { name: "life_capture_relationship", schema: relationshipSchema },
  );

  if (!extracted.found || !extracted.personName || !extracted.type) {
    return;
  }

  await findOrCreateRelationship(db, context, {
    otherPersonName: extracted.personName,
    type: extracted.type,
  });
}
