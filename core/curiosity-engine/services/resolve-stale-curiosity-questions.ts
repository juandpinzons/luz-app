import type { LifeGraphContext } from "../../life/life-graph-context";
import type { DomainCoverage } from "../../knowledge-gaps";
import { CURIOSITY_GAP_THRESHOLD } from "./generate-curiosity-question";
import type { CuriosityQuestionRepository } from "../repositories/curiosity-question.repository";

/**
 * Revisa la `CuriosityQuestion` `pending` (si hay una) contra la
 * cobertura ACTUAL de dominios -- nunca contra si la pregunta se
 * verbalizó (LUZ no tiene manera de confirmar eso, Principio 3). Dos
 * salidas objetivas, ambas basadas en señal real:
 *
 * 1. El área que motivó la pregunta ya ganó cobertura real (llegó a
 *    `CURIOSITY_GAP_THRESHOLD`) -- se marca `resolved`.
 * 2. Otra área es ahora claramente más urgente (menos cubierta que la
 *    que motivó esta pregunta) -- se marca `dismissed`, superada, para
 *    que el próximo ciclo genere una nueva sobre el vacío real actual.
 *
 * Si ninguna de las dos aplica, la pregunta sigue siendo la correcta y
 * no se toca.
 */
export async function resolveStaleCuriosityQuestions(
  repository: CuriosityQuestionRepository,
  context: LifeGraphContext,
  currentDomainCoverage: DomainCoverage[],
): Promise<void> {
  const pending = await repository.getPending(context);
  if (!pending) {
    return;
  }

  const currentForDomain = currentDomainCoverage.find(
    (entry) => entry.domain === pending.domain,
  )?.coverageScore;
  if (currentForDomain === undefined) {
    return;
  }

  const now = new Date();

  if (currentForDomain >= CURIOSITY_GAP_THRESHOLD) {
    await repository.updateStatus(context, pending.id, "resolved", now);
    return;
  }

  const nowWeakest = [...currentDomainCoverage].sort(
    (a, b) => a.coverageScore - b.coverageScore,
  )[0];
  if (nowWeakest && nowWeakest.domain !== pending.domain && nowWeakest.coverageScore < currentForDomain) {
    await repository.updateStatus(context, pending.id, "dismissed", now);
  }
}
