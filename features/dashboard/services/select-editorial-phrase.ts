import crypto from "node:crypto";
import type { Database } from "../../../core/db/client";
import { createEntityId, type EntityId, type LifeGraphContext } from "../../../core/life";
import { DrizzleSeenPromptRepository, SEEN_PROMPT_SUBJECT_TYPES } from "../../../core/seen-prompts";
import { OBSERVATION_PHRASES, SILENCE_PHRASES } from "../../../editorial/generated/phrases";

/**
 * War Room 2026-08-09 -- biblioteca editorial (`editorial/README.md`,
 * 99 frases, escrita 2026-08-02, cero consumidor real hasta hoy).
 * Alcance deliberadamente angosto, no "Conversational Variety V1"
 * completo (quién decide entre frase editorial / línea de continuidad
 * de IA / silencio -- el propio README lo marca como trabajo futuro
 * fuera de alcance): solo `silence`+`observation` (14 frases), y solo
 * para el único hueco real sin ninguna lógica hoy -- ver
 * `app/dashboard/page.tsx`, el caso donde `returningGapDays` es `null`
 * (ni primera visita, ni línea de continuidad de IA, ni regreso tras
 * una pausa real). `busy_day` queda fuera a propósito: sus frases
 * afirman haber detectado un día ocupado, y mostrarlo sin una señal
 * real que lo respalde violaría el principio de cero fabricación
 * (`PRESENCE_PRINCIPLES.md` #9) tanto como inventar un monto.
 */
const CANDIDATE_POOL = [...SILENCE_PHRASES, ...OBSERVATION_PHRASES];
const REPEAT_WINDOW_DAYS = 30;

/**
 * `seen_prompts.subject_id` es `uuid` real -- los ids de esta
 * biblioteca son slugs legibles (`"silence_003"`), no UUIDs. Un hash
 * determinista (mismo id de frase, siempre el mismo resultado) evita
 * tocar el schema solo para admitir un segundo formato de id.
 */
function phraseSubjectId(phraseId: string): EntityId {
  const hash = crypto.createHash("sha256").update(phraseId).digest("hex").slice(0, 32);
  const uuid = `${hash.slice(0, 8)}-${hash.slice(8, 12)}-${hash.slice(12, 16)}-${hash.slice(16, 20)}-${hash.slice(20, 32)}`;
  return createEntityId(uuid);
}

/**
 * Elige una frase editorial no mostrada en los últimos 30 días
 * (`repeat_after`, igual en las 99 frases hoy -- ver
 * `editorial/README.md`, "sin datos reales de frecuencia todavía para
 * diferenciar por categoría"; un umbral compartido es exacto para el
 * dato real de hoy, no una simplificación). Si el pool entero ya se
 * mostró dentro de la ventana (uso diario intensivo, pool chico),
 * repetir es más honesto que quedarse en silencio por un límite
 * artificial de esta función -- mismo criterio que el resto del
 * dominio usa para "silencio real" (nunca fabricado).
 *
 * Nunca lanza -- degradación silenciosa (`null`) ante cualquier falla,
 * mismo criterio que el resto de `app/dashboard/page.tsx`: un momento
 * de calidez que no aparece no debe romper la pantalla.
 */
export async function selectEditorialPhrase(
  db: Database,
  context: LifeGraphContext,
): Promise<string | null> {
  if (CANDIDATE_POOL.length === 0) return null;

  try {
    const repository = new DrizzleSeenPromptRepository(db);
    const since = new Date(Date.now() - REPEAT_WINDOW_DAYS * 24 * 60 * 60 * 1000);
    const recentlySeen = await repository.listSeenSubjectIdsSince(
      context,
      SEEN_PROMPT_SUBJECT_TYPES.editorialPhrase,
      since,
    );

    const eligible = CANDIDATE_POOL.filter(
      (phrase) => !recentlySeen.has(phraseSubjectId(phrase.id)),
    );
    const pool = eligible.length > 0 ? eligible : CANDIDATE_POOL;
    const chosen = pool[Math.floor(Math.random() * pool.length)]!;

    await repository.markSeenAgain(
      context,
      SEEN_PROMPT_SUBJECT_TYPES.editorialPhrase,
      phraseSubjectId(chosen.id),
    );

    return chosen.text;
  } catch {
    return null;
  }
}
