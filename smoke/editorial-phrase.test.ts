import { and, eq } from "drizzle-orm";
import { db } from "../core/db/client";
import { seenPrompts } from "../core/db/schema";
import { selectEditorialPhrase } from "../features/dashboard/services/select-editorial-phrase";
import { OBSERVATION_PHRASES, SILENCE_PHRASES } from "../editorial/generated/phrases";
import type { SmokeFlow } from "./types";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

const KNOWN_TEXTS = new Set([...SILENCE_PHRASES, ...OBSERVATION_PHRASES].map((p) => p.text));

/**
 * War Room 2026-08-09 -- primer consumidor real de la biblioteca
 * editorial (99 frases, escrita 2026-08-02, cero consumidor hasta
 * hoy). Prueba el mecanismo real de selección + "no repetir" contra
 * Postgres real (`seen_prompts`), no un mock de la tabla.
 */
export const editorialPhraseFlow: SmokeFlow = {
  name: "editorial-phrase",
  async run(ctx) {
    const context = ctx.lifeGraphContext;

    // Autocontenido -- `dashboard.test.ts` (y potencialmente otros
    // flujos) golpea la ruta real /dashboard sobre la MISMA cuenta
    // fixture dentro de la misma corrida de `npm run smoke`, y eso ya
    // ejercita `selectEditorialPhrase` de verdad como efecto
    // secundario. Sin este borrado inicial, este test hereda filas de
    // otros flujos y falla por una razón que no es suya -- encontrado
    // corriendo la suite completa, no en aislamiento (`--flow` sí pasaba).
    await db
      .delete(seenPrompts)
      .where(
        and(
          eq(seenPrompts.lifeGraphId, context.lifeGraphId),
          eq(seenPrompts.subjectType, "editorial_phrase"),
        ),
      );

    try {
      const first = await selectEditorialPhrase(db, context);
      assert(first !== null, "debería devolver una frase real con el pool sin usar todavía");
      assert(
        KNOWN_TEXTS.has(first),
        `la frase devuelta debería venir del pool silence+observation, obtuvo: "${first}"`,
      );

      const seenRows = await db
        .select()
        .from(seenPrompts)
        .where(
          and(
            eq(seenPrompts.lifeGraphId, context.lifeGraphId),
            eq(seenPrompts.subjectType, "editorial_phrase"),
          ),
        );
      assert(
        seenRows.length === 1,
        `debería quedar exactamente una fila en seen_prompts tras la primera selección, hubo ${seenRows.length}`,
      );

      // Simula que el pool entero (14 frases) ya se mostró dentro de
      // los últimos 30 días -- el mecanismo de "no repetir" no debe
      // degradar a silencio (`null`) cuando el pool se agota, debe
      // repetir honestamente en vez de fabricar un vacío artificial.
      for (const phrase of [...SILENCE_PHRASES, ...OBSERVATION_PHRASES]) {
        const hash = await import("node:crypto").then((m) =>
          m.createHash("sha256").update(phrase.id).digest("hex").slice(0, 32),
        );
        const subjectId = `${hash.slice(0, 8)}-${hash.slice(8, 12)}-${hash.slice(12, 16)}-${hash.slice(16, 20)}-${hash.slice(20, 32)}`;
        await db
          .insert(seenPrompts)
          .values({ lifeGraphId: context.lifeGraphId, subjectType: "editorial_phrase", subjectId })
          .onConflictDoUpdate({
            target: [seenPrompts.lifeGraphId, seenPrompts.subjectType, seenPrompts.subjectId],
            set: { firstSeenAt: new Date() },
          });
      }

      const afterExhausted = await selectEditorialPhrase(db, context);
      assert(
        afterExhausted !== null && KNOWN_TEXTS.has(afterExhausted),
        `con el pool entero marcado como visto, debería repetir honestamente en vez de devolver null, obtuvo: ${afterExhausted}`,
      );
    } finally {
      await db
        .delete(seenPrompts)
        .where(
          and(
            eq(seenPrompts.lifeGraphId, context.lifeGraphId),
            eq(seenPrompts.subjectType, "editorial_phrase"),
          ),
        );
    }
  },
};
