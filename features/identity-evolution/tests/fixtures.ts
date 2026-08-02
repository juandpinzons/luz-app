import { createEntityId } from "../../../core/life/value-objects/entity-id";
import type { LifeDomainType } from "../../../core/life/value-objects/life-domain-type";
import type { EvolutionEvent, EvolutionEventKind } from "../../../core/temporal-evolution";
import type { IdentityThemeEvidenceInput } from "../services/build-themes";

/** Reloj fijo -- todo escenario ancla `now` aquí para que el resultado sea reproducible byte a byte entre corridas. */
export const NOW = new Date("2026-08-01T12:00:00.000Z");

export function daysAgo(n: number): Date {
  return new Date(NOW.getTime() - n * 24 * 60 * 60 * 1000);
}

let refCounter = 0;
function nextRef(prefix: string): string {
  refCounter += 1;
  return `${prefix}-${refCounter}`;
}

export function makeEvolutionEvent(params: {
  kind: EvolutionEventKind;
  occurredAt: Date;
  domain?: LifeDomainType;
  description?: string;
}): EvolutionEvent {
  return {
    kind: params.kind,
    refType: params.kind === "insight_discovered" ? "insight" : "belief",
    refId: createEntityId(nextRef(params.kind)),
    domain: params.domain,
    description: params.description ?? `evento sintético: ${params.kind}`,
    occurredAt: params.occurredAt,
  };
}

/**
 * Serie de eventos igualmente espaciados entre `fromDaysAgo` (más
 * viejo) y `toDaysAgo` (más reciente) -- la forma más simple de simular
 * "habló de esto cada N días durante un período real", que es como se
 * construyen la mayoría de los escenarios de la misión.
 */
export function eventSeries(params: {
  kind: EvolutionEventKind;
  domain?: LifeDomainType;
  fromDaysAgo: number;
  toDaysAgo: number;
  stepDays?: number;
}): EvolutionEvent[] {
  const step = Math.max(1, params.stepDays ?? 4);
  const events: EvolutionEvent[] = [];
  for (let d = params.fromDaysAgo; d >= params.toDaysAgo; d -= step) {
    events.push(makeEvolutionEvent({ kind: params.kind, domain: params.domain, occurredAt: daysAgo(d) }));
  }
  return events;
}

export function makeThemeInput(params: {
  conceptId: string;
  label: string;
  domain?: LifeDomainType;
  eventDaysAgo: readonly number[];
}): IdentityThemeEvidenceInput {
  return {
    conceptId: createEntityId(params.conceptId),
    label: params.label,
    domain: params.domain,
    events: params.eventDaysAgo.map((d) => ({ occurredAt: daysAgo(d) })),
  };
}

/** Días igualmente espaciados entre `fromDaysAgo` y `toDaysAgo` -- para pasar directo a `makeThemeInput({ eventDaysAgo: ... })`. */
export function daySeries(fromDaysAgo: number, toDaysAgo: number, stepDays = 5): number[] {
  const step = Math.max(1, stepDays);
  const days: number[] = [];
  for (let d = fromDaysAgo; d >= toDaysAgo; d -= step) days.push(d);
  return days;
}

export const LIFE_GRAPH_ID = createEntityId("lg-synthetic");
export const PERSON_ID = createEntityId("person-synthetic");
