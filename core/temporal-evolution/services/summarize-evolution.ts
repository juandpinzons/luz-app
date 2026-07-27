import type { LifeDomainType } from "../../life/value-objects/life-domain-type";
import type { EvolutionEvent } from "../entities/evolution-event";

export interface DomainChangeCount {
  domain: LifeDomainType;
  occurrences: number;
}

/** Responde directamente "¿qué mejoró?", "¿qué empeoró?", "¿qué patrones aparecen?" (instrucción del bloque de trabajo) sobre una ventana de tiempo concreta. */
export interface EvolutionSummary {
  windowDays: number;
  improvedDomains: DomainChangeCount[];
  worsenedDomains: DomainChangeCount[];
  newBeliefsCount: number;
}

function countByDomain(events: EvolutionEvent[]): DomainChangeCount[] {
  const counts = new Map<LifeDomainType, number>();
  for (const event of events) {
    if (!event.domain) continue;
    counts.set(event.domain, (counts.get(event.domain) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([domain, occurrences]) => ({ domain, occurrences }))
    .sort((a, b) => b.occurrences - a.occurrences);
}

/** Pura -- opera sobre lo que ya devolvió `buildEvolutionTimeline`, nunca vuelve a tocar la base de datos. */
export function summarizeEvolution(
  events: EvolutionEvent[],
  windowDays: number,
  now: Date = new Date(),
): EvolutionSummary {
  const windowMs = windowDays * 24 * 60 * 60 * 1000;
  const withinWindow = events.filter(
    (event) => now.getTime() - event.occurredAt.getTime() <= windowMs,
  );

  return {
    windowDays,
    improvedDomains: countByDomain(
      withinWindow.filter((event) => event.kind === "belief_strengthened"),
    ),
    worsenedDomains: countByDomain(
      withinWindow.filter((event) => event.kind === "belief_weakened"),
    ),
    newBeliefsCount: withinWindow.filter((event) => event.kind === "belief_created").length,
  };
}
