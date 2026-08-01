import type { Database } from "../../../core/db/client";
import { DrizzleConceptRepository } from "../../../core/concept-graph";
import type { LifeGraphContext } from "../../../core/life/life-graph-context";
import { describeEvolution } from "../../identity/services/describe-evolution";
import type { IdentitySnapshot } from "../domain/identity-snapshot";
import { buildIdentitySnapshot } from "./build-identity-snapshot";

/**
 * Único archivo de todo el módulo que toca `Database`/un repositorio --
 * la frontera anti-corrupción entre `core/`/`features/identity/` reales
 * y el builder puro (`build-identity-snapshot.ts`), mismo rol que
 * `describeEvolution`/`assembleRealitySnapshot` cumplen para sus
 * propios módulos.
 *
 * Reutiliza `describeEvolution` (`features/identity/services/`, sin
 * modificarlo) en vez de volver a consultar `core/belief-engine`
 * directamente: `describeEvolution(db, context, N).timeline` ya
 * construye la línea de tiempo COMPLETA (no acotada por `N` -- ese
 * parámetro solo recorta `.summary`, ver su propio docblock), así que
 * es exactamente la evidencia de nivel dimensión que este módulo
 * necesita, sin duplicar la consulta a `belief_history`/`beliefs`. Solo
 * se añade una consulta nueva y real: `Concept`/`ConceptEvidence`
 * (`core/concept-graph`), que ningún ensamblador existente pedía
 * todavía -- la evidencia de nivel tema.
 *
 * Deliberadamente NO usa `buildIdentityModel` (`PersonIdentityModel`):
 * ese objeto es una foto del estado ACTUAL (top-8 creencias, evolución
 * de los últimos 30 días) pensada para mostrarse tal cual; este módulo
 * necesita la historia completa dentro de `LOOKBACK_DAYS` para poder
 * comparar "hoy" contra "hace `comparisonWindowDays`", que
 * `PersonIdentityModel` no expone. Tampoco mina `openContradictions`/
 * `pendingPredictions`/`topReasoningConclusions` en v1 -- ver
 * "Extensiones futuras" en el README para el razonamiento completo.
 */
export async function assembleIdentityEvolution(
  db: Database,
  context: LifeGraphContext,
  now: Date = new Date(),
): Promise<IdentitySnapshot> {
  const conceptRepository = new DrizzleConceptRepository(db);

  const [evolution, concepts] = await Promise.all([
    describeEvolution(db, context, 30),
    conceptRepository.list(context),
  ]);

  const themes = await Promise.all(
    concepts.map(async (concept) => ({
      conceptId: concept.id,
      label: concept.label,
      domain: concept.domain,
      events: (await conceptRepository.listEvidence(context, concept.id)).map((evidence) => ({
        occurredAt: evidence.createdAt,
      })),
    })),
  );

  return buildIdentitySnapshot({
    lifeGraphId: context.lifeGraphId,
    personId: context.personId,
    now,
    dimensionEvents: evolution.timeline,
    themes,
  });
}
