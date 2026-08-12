import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getLifeGraphContext } from "@/auth/user-context";
import { db } from "@/core/db/client";
import { LIFE_DOMAIN_LABEL } from "@/core/life";
import {
  deriveBeliefTrend,
  DrizzleBeliefRepository,
  type BeliefHistoryEntry,
  type BeliefTrend,
} from "@/core/belief-engine";
import { describeError } from "@/core/observability/describe-error";
import { createRequestId, logger } from "@/core/observability/logger";
import { GROWING_BELIEF_MAX_CONFIDENCE } from "@/features/chat/services/assemble-reality-snapshot";
import { BELIEF_TREND_LABELS } from "@/features/life/labels";
import {
  buildIdentityModel,
  type PersonIdentityModel,
} from "@/features/identity/services/build-identity-model";

/**
 * War Room 2026-08-09 -- `deriveBeliefTrend`/`getHistoryForBeliefs` ya
 * eran reales (único consumidor hasta hoy: la vista de detalle de UNA
 * creencia, `app/life/[kind]/[id]/page.tsx`). Nunca antes en el
 * resumen donde el Founder de verdad la encuentra primero
 * (`UX_ARCHITECTURE_REFINEMENT_V1.md` §5, item 3: "la versión
 * genérica todavía no existe"). Una sola consulta por lote
 * (`getHistoryForBeliefs`, ya real), nunca N consultas para N
 * creencias visibles. Solo beliefs -- concepts no tiene ninguna tabla
 * de historial equivalente (`concept_history` no existe), así que
 * "tendencia de concepto" no es una capacidad real todavía; no se
 * fabrica una aquí.
 */
function groupHistoryByBelief(
  history: readonly BeliefHistoryEntry[],
): Map<string, BeliefHistoryEntry[]> {
  const byBelief = new Map<string, BeliefHistoryEntry[]>();
  for (const entry of history) {
    const list = byBelief.get(entry.beliefId) ?? [];
    list.push(entry);
    byBelief.set(entry.beliefId, list);
  }
  return byBelief;
}

const ROUTE = "/life/identity";

const DATE_FORMAT = new Intl.DateTimeFormat("es-CO", {
  day: "numeric",
  month: "long",
  timeZone: "America/Bogota",
});

function domainMovementLine(
  label: string,
  domains: PersonIdentityModel["recentEvolution"]["improvedDomains"],
): string | null {
  if (domains.length === 0) return null;
  const names = domains.map((entry) => LIFE_DOMAIN_LABEL[entry.domain]).join(", ");
  return `${label}: ${names}.`;
}

/**
 * Síntesis de quién es la persona para LUZ, solo lectura -- ensamblada
 * en el momento vía `buildIdentityModel` (Belief Engine + Concept Graph
 * + Contradiction Engine + Importance Engine + Knowledge Gaps +
 * Temporal Evolution + Reasoning Engine ya construidos, nunca un motor
 * nuevo). Este bloque no crea ninguna capacidad nueva -- conecta una
 * capacidad ya escrita (`features/identity/services/build-identity-
 * model.ts`, hasta hoy sin ningún consumidor real) a una superficie
 * visible, mismo criterio que ADR-0018: "visible memory" antes que más
 * arquitectura.
 */
export default async function LifeIdentityPage() {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  const requestId = createRequestId();

  let lifeGraphContext = null;
  try {
    lifeGraphContext = await getLifeGraphContext();
  } catch (error) {
    logger.log({
      event: "life_identity.life_graph_context_failed",
      severity: "error",
      requestId,
      route: ROUTE,
      userId: session.user.id,
      ...describeError(error),
    });
  }

  let model: PersonIdentityModel | null = null;
  if (lifeGraphContext) {
    try {
      model = await buildIdentityModel(db, lifeGraphContext);
    } catch (error) {
      logger.log({
        event: "life_identity.build_identity_model_failed",
        severity: "error",
        requestId,
        route: ROUTE,
        userId: session.user.id,
        lifeGraphId: lifeGraphContext.lifeGraphId,
        ...describeError(error),
      });
    }
  }

  let trendByBeliefId = new Map<string, BeliefTrend>();
  if (lifeGraphContext && model && model.topBeliefs.length > 0) {
    try {
      const history = await new DrizzleBeliefRepository(db).getHistoryForBeliefs(
        lifeGraphContext,
        model.topBeliefs.map((belief) => belief.id),
      );
      const byBelief = groupHistoryByBelief(history);
      trendByBeliefId = new Map(
        model.topBeliefs.map((belief) => [
          belief.id,
          deriveBeliefTrend(byBelief.get(belief.id) ?? []),
        ]),
      );
    } catch (error) {
      logger.log({
        event: "life_identity.belief_trends_failed",
        severity: "error",
        requestId,
        route: ROUTE,
        userId: session.user.id,
        lifeGraphId: lifeGraphContext.lifeGraphId,
        ...describeError(error),
      });
    }
  }

  const domainsWithSignal =
    model?.domainUnderstanding.filter((entry) => entry.coverageScore > 0) ?? [];
  const hasAnything =
    model !== null &&
    (domainsWithSignal.length > 0 ||
      model.topBeliefs.length > 0 ||
      model.topConcepts.length > 0 ||
      model.openContradictions.length > 0 ||
      model.topReasoningConclusions.length > 0 ||
      model.pendingPredictions.length > 0);

  const improvedLine = model
    ? domainMovementLine("Mejorando", model.recentEvolution.improvedDomains)
    : null;
  const worsenedLine = model
    ? domainMovementLine("Necesita atención", model.recentEvolution.worsenedDomains)
    : null;

  return (
    <main className="min-h-full px-6 py-10 text-white">
      <div className="mx-auto w-full max-w-2xl">
        <Link
          href="/life"
          className="rounded text-sm text-zinc-500 underline decoration-zinc-700 underline-offset-4 transition hover:text-zinc-300 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-luz"
        >
          ← Vida
        </Link>

        <h1 className="animate-fade-in mt-4 text-xl font-light tracking-[0.25em] text-white">
          IDENTIDAD
        </h1>
        <p className="animate-fade-in mt-2 text-sm text-zinc-500" style={{ animationDelay: "40ms" }}>
          Lo que LUZ ha llegado a entender de ti, con lo que lo respalda.
        </p>

        {!hasAnything && (
          <p className="animate-fade-in mt-10 text-sm text-zinc-500">
            No es que no te haya escuchado — es que todavía no he
            hablado contigo lo suficiente sobre las mismas cosas para
            poder decirte, con seguridad, quién eres para mí. Eso se
            construye con el tiempo, no de una sola vez. Sigamos
            hablando y esto se va a ir llenando.
          </p>
        )}

        {domainsWithSignal.length > 0 && (
          <section className="animate-fade-in mt-8" style={{ animationDelay: "80ms" }}>
            <h2 className="text-sm font-medium text-zinc-400">Áreas de tu vida</h2>
            <ul className="mt-3 space-y-3">
              {domainsWithSignal.map((entry, index) => (
                <li
                  key={entry.domain}
                  className="animate-fade-in"
                  style={{ animationDelay: `${100 + index * 30}ms` }}
                >
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-zinc-300">{entry.label}</span>
                    <span className="text-xs text-zinc-500">{entry.coverageScore}/100</span>
                  </div>
                  <div className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-zinc-800">
                    <div
                      className="h-full rounded-full bg-luz/70"
                      style={{ width: `${entry.coverageScore}%` }}
                    />
                  </div>
                </li>
              ))}
            </ul>
          </section>
        )}

        {(improvedLine || worsenedLine || (model && model.recentEvolution.newBeliefsCount > 0)) && (
          <section className="animate-fade-in mt-8" style={{ animationDelay: "120ms" }}>
            <h2 className="text-sm font-medium text-zinc-400">
              Últimos {model?.recentEvolution.windowDays} días
            </h2>
            <div className="mt-3 rounded-2xl border border-luz/25 bg-zinc-900/60 px-5 py-4 text-sm text-zinc-200">
              {improvedLine && <p>{improvedLine}</p>}
              {worsenedLine && <p className={improvedLine ? "mt-1" : ""}>{worsenedLine}</p>}
              {model && model.recentEvolution.newBeliefsCount > 0 && (
                <p className={improvedLine || worsenedLine ? "mt-1" : ""}>
                  {model.recentEvolution.newBeliefsCount === 1
                    ? "Entendí algo nuevo sobre ti."
                    : `Entendí ${model.recentEvolution.newBeliefsCount} cosas nuevas sobre ti.`}
                </p>
              )}
            </div>
          </section>
        )}

        {model && model.topBeliefs.length > 0 && (
          <section className="animate-fade-in mt-8" style={{ animationDelay: "160ms" }}>
            <h2 className="text-sm font-medium text-zinc-400">Lo que más creo saber de ti</h2>
            {/*
              Auditoría de Experiencia V1 (hallazgo H6): antes, el número
              de confianza era la única señal -- una creencia todavía en
              formación (misma banda que `growingBeliefs`, nunca afirmada
              como hecho en el prompt de IA) se veía igual que una ya
              asentada. La persona debe reconocerse en lo que LUZ refleja
              (Principio 7, Evolución compartida), no recibir más
              seguridad de la que LUZ realmente tiene todavía.
            */}
            <ul className="mt-3 space-y-2">
              {model.topBeliefs.map((belief) => (
                <li key={belief.id}>
                  <Link
                    href={`/life/beliefs/${belief.id}`}
                    className="flex items-center justify-between gap-3 rounded-lg border border-zinc-800 px-4 py-3 text-sm transition hover:border-zinc-600 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-luz"
                  >
                    <span className="text-zinc-200">{belief.statement}</span>
                    <span className="flex flex-shrink-0 items-center gap-2 text-xs text-zinc-500">
                      {belief.confidence.score <= GROWING_BELIEF_MAX_CONFIDENCE && (
                        <span className="rounded-full border border-zinc-700 px-2 py-0.5">
                          en formación
                        </span>
                      )}
                      {/*
                        War Room 2026-08-09: `deriveBeliefTrend` ya
                        existía, nunca antes en este resumen -- "new"
                        no se muestra (es el estado por defecto de casi
                        toda creencia con poca historia, no dice nada
                        que "en formación" no diga ya mejor).
                      */}
                      {(() => {
                        const trend = trendByBeliefId.get(belief.id);
                        return trend && trend !== "new" ? (
                          <span>{BELIEF_TREND_LABELS[trend]}</span>
                        ) : null;
                      })()}
                      {belief.confidence.score}/100
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        {model && model.topConcepts.length > 0 && (
          <section className="animate-fade-in mt-8" style={{ animationDelay: "200ms" }}>
            <h2 className="text-sm font-medium text-zinc-400">Lo que más aparece en tu vida</h2>
            <div className="mt-3 flex flex-wrap gap-3">
              {model.topConcepts.map((concept) => (
                <Link
                  key={concept.id}
                  href={`/life/concepts/${concept.id}`}
                  className="rounded-xl border border-zinc-800 px-4 py-3 text-sm text-zinc-200 transition hover:border-zinc-600 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-luz"
                >
                  {concept.label}
                </Link>
              ))}
            </div>
          </section>
        )}

        {/*
          UX_ARCHITECTURE_REFINEMENT_V1.md §2 ("el segundo ofensor" de
          densidad, nunca corregido hasta hoy): predicciones,
          conclusiones de razonamiento y tensiones abiertas comparten
          la misma naturaleza -- "cosas que LUZ infirió," que merecen
          su propia explicación antes de aceptarse, no apilarse en
          línea por defecto igual que áreas/creencias/conceptos
          (contenido más directo). Una sola expansión, no tres
          separadas -- el punto es "un paso más," no tres pasos
          distintos. `<details>` nativo, cero JS de cliente: cierra el
          mismo criterio que ya usa el resto de esta página (formularios
          GET, sin estado de cliente en `/memories`).
        */}
        {model &&
          (model.pendingPredictions.length > 0 ||
            model.topReasoningConclusions.length > 0 ||
            model.openContradictions.length > 0) && (
            <details className="animate-fade-in group mt-8" style={{ animationDelay: "240ms" }}>
              <summary className="cursor-pointer text-sm font-medium text-zinc-400 hover:text-zinc-200">
                Cómo llegué a esto
              </summary>

              <div className="mt-4 space-y-8">
                {model.pendingPredictions.length > 0 && (
                  <section>
                    <h2 className="text-sm font-medium text-zinc-400">Podría venir</h2>
                    <ul className="mt-3 space-y-2">
                      {model.pendingPredictions.map((prediction, index) => (
                        <li
                          key={`${prediction.triggeredAt.getTime()}-${index}`}
                          className="rounded-lg border border-zinc-800 px-4 py-3 text-sm text-zinc-300"
                        >
                          {prediction.description}
                        </li>
                      ))}
                    </ul>
                  </section>
                )}

                {model.topReasoningConclusions.length > 0 && (
                  <section>
                    <h2 className="text-sm font-medium text-zinc-400">Conexiones que he hecho</h2>
                    <ul className="mt-3 space-y-2">
                      {model.topReasoningConclusions.map((conclusion) => (
                        <li
                          key={conclusion.id}
                          className="rounded-lg border border-zinc-800 px-4 py-3 text-sm text-zinc-300"
                        >
                          {conclusion.statement}
                        </li>
                      ))}
                    </ul>
                  </section>
                )}

                {model.openContradictions.length > 0 && (
                  <section>
                    <h2 className="text-sm font-medium text-zinc-400">Tensiones que noto</h2>
                    <ul className="mt-3 space-y-2">
                      {model.openContradictions.map((contradiction) => (
                        <li
                          key={contradiction.id}
                          className="rounded-lg border border-zinc-800 px-4 py-3 text-sm text-zinc-300"
                        >
                          {contradiction.description}
                        </li>
                      ))}
                    </ul>
                  </section>
                )}
              </div>
            </details>
          )}

        {model && (
          <p className="animate-fade-in mt-10 text-xs text-zinc-600" style={{ animationDelay: "320ms" }}>
            Actualizado {DATE_FORMAT.format(model.generatedAt)}.
          </p>
        )}
      </div>
    </main>
  );
}
