import type {
  DueLifeItem,
  LifeDashboardSnapshot,
  StalledLifeItem,
} from "./build-life-dashboard-snapshot";
import type { LifeObservation, ObservationEntityRef } from "./build-life-observations";

/**
 * Capa de recomendaciones (mandato 2026-07-29: "no crear más tipos de
 * observación -- transformar observaciones en follow-ups accionables").
 * Vive junto a `build-life-observations.ts` en `features/dashboard/`:
 * ningún motor nuevo, cero ADR modificado, cero contrato de
 * Context/Memory/Knowledge Engine tocado.
 *
 * Únicas dos fuentes permitidas, nada más:
 *  (1) el `LifeObservation[]` que `buildLifeObservations` ya produjo.
 *  (2) `snapshot.overdue`/`snapshot.stalled` -- solo para `Project`,
 *      el único caso que la capa de observaciones no cubre todavía
 *      (`goal_at_risk` solo mira Goals; no existe un `project_at_risk`
 *      como tipo de observación). Ningún otro campo del snapshot se
 *      usa: `domains`/`totals`/`relationships` ya están completamente
 *      representados dentro de las observaciones correspondientes.
 * Ninguna consulta nueva, ningún repositorio, ninguna IA -- todo lo
 * que sigue es indexación y combinación en memoria de datos que ya
 * llegaron por otro lado.
 *
 * Nota de alcance conocida, deliberadamente no resuelta aquí: un
 * Habit activo pero estancado (>= `STALLED_THRESHOLD_DAYS`, sin
 * llegar a `active: false`) no produce ningún `LifeObservation` hoy
 * (comentario explícito en `build-life-observations.ts`), y por lo
 * tanto tampoco ninguna recomendación -- mismo criterio que esta
 * misma auditoría ya aplicó antes: un gap real, documentado, no
 * parcheado inventando un tipo nuevo sin mandato explícito para
 * hacerlo.
 */

// ---------------------------------------------------------------------------
// Modelo
// ---------------------------------------------------------------------------

/** Mismo shape que ya usa la capa de observaciones -- una recomendación nunca inventa una segunda forma de nombrar una fila real. */
export type DashboardEntityReference = ObservationEntityRef;

export const RECOMMENDATION_TYPES = [
  "GOAL_REVIEW",
  "PROJECT_REVIEW",
  "HABIT_RESTART",
  "RECONNECT_PERSON",
  "REVIEW_CONTRADICTION",
  "FOCUS_DOMAIN",
  "COMPLETE_OVERDUE",
  "CELEBRATE_PROGRESS",
  /** Definido por completitud, nunca construido por este archivo -- mismo criterio que `overloaded_schedule` en la capa de observaciones (type listo, generador dormido hasta que haya un caso real que lo justifique). */
  "NO_ACTION",
] as const;

export type RecommendationType = (typeof RECOMMENDATION_TYPES)[number];

export const RECOMMENDATION_PRIORITIES = ["low", "medium", "high", "critical"] as const;

export type RecommendationPriority = (typeof RECOMMENDATION_PRIORITIES)[number];

/**
 * Un nivel más que `ObservationPriority` ("low"/"medium"/"high"):
 * "critical" nunca viene de una sola observación -- solo existe
 * cuando dos o más señales distintas terminan apuntando a la misma
 * entidad (ver `derivePriority`). Le da un uso real al requisito de
 * ranking "number of supporting observations" en vez de ser un campo
 * decorativo.
 */
const PRIORITY_RANK: Record<RecommendationPriority, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
};

export const DASHBOARD_ACTION_KINDS = [
  "open_entity",
  "update_status",
  "schedule_check_in",
  "acknowledge",
] as const;

export type DashboardActionKind = (typeof DASHBOARD_ACTION_KINDS)[number];

export interface DashboardAction {
  kind: DashboardActionKind;
  /** Ausente solo para `acknowledge` sin una entidad puntual -- hoy no ocurre, porque `NO_ACTION` nunca se construye. */
  targetEntity?: DashboardEntityReference;
  /** Campos que la persona podría revisar/actualizar -- nunca un valor propuesto, esa decisión sigue siendo humana. */
  suggestedFields?: string[];
}

export interface FollowUpRecommendation {
  id: string;
  type: RecommendationType;
  priority: RecommendationPriority;
  title: string;
  explanation: string;
  /** Tokens `clave=valor`, no prosa -- ver evidence de cada `LifeObservation` fuente. */
  evidence: string[];
  relatedEntities: DashboardEntityReference[];
  suggestedAction: DashboardAction;
  confidence: number;
}

// ---------------------------------------------------------------------------
// Candidatos internos (pre-merge) -- nunca expuestos fuera de este archivo.
// ---------------------------------------------------------------------------

interface RecommendationCandidate {
  type: RecommendationType;
  primaryEntity: DashboardEntityReference;
  relatedEntities: DashboardEntityReference[];
  evidence: string[];
  /** Días desde el hecho que respalda la recomendación -- menor = más reciente. 0 para hechos estructurales sin fecha (contradicción, dominio inactivo). */
  recencyDays: number;
  sourcePriority: "low" | "medium" | "high";
}

function entityKey(ref: DashboardEntityReference): string {
  return ref.kind === "domain" ? `domain:${ref.domain}` : `${ref.kind}:${ref.id}`;
}

function formatEvidenceValue(value: string | number | boolean | Date): string {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value);
}

function evidenceTokens(observation: LifeObservation): string[] {
  return Object.entries(observation.evidence).map(
    ([key, value]) => `${key}=${formatEvidenceValue(value)}`,
  );
}

function numericEvidence(observation: LifeObservation, key: string): number | undefined {
  const value = observation.evidence[key];
  return typeof value === "number" ? value : undefined;
}

function daysAgo(date: Date, now: Date): number {
  return Math.floor((now.getTime() - date.getTime()) / (24 * 60 * 60 * 1000));
}

/**
 * Une cada `LifeObservation` con el/los candidatos de recomendación
 * que le corresponden. El `switch` exhaustivo (`never` en el
 * `default`) es deliberado: si alguien agrega un `LifeObservationType`
 * nuevo sin actualizar este archivo, deja de compilar en vez de
 * ignorar el caso en silencio -- barata de mantener, dado el mandato
 * explícito de esta tarea de no tocar la capa de observaciones.
 */
function candidatesFromObservation(observation: LifeObservation): RecommendationCandidate[] {
  switch (observation.type) {
    case "goal_at_risk": {
      const goalRef = observation.entities.find((entity) => entity.kind === "goal");
      if (!goalRef) return [];
      const daysOverdue = numericEvidence(observation, "daysOverdue");
      const isOverdue = daysOverdue !== undefined;
      return [
        {
          type: isOverdue ? "COMPLETE_OVERDUE" : "GOAL_REVIEW",
          primaryEntity: goalRef,
          relatedEntities: [goalRef],
          evidence: evidenceTokens(observation),
          recencyDays: isOverdue ? daysOverdue : (numericEvidence(observation, "daysSinceUpdate") ?? 0),
          sourcePriority: observation.priority,
        },
      ];
    }

    case "goal_progressing": {
      const goalRef = observation.entities.find((entity) => entity.kind === "goal");
      if (!goalRef) return [];
      return [celebrate(goalRef, observation)];
    }

    case "habit_consistent": {
      const habitRef = observation.entities.find((entity) => entity.kind === "habit");
      if (!habitRef) return [];
      return [celebrate(habitRef, observation)];
    }

    case "strong_relationship": {
      const personRef = observation.entities.find((entity) => entity.kind === "person");
      if (!personRef) return [];
      return [celebrate(personRef, observation)];
    }

    case "high_growth_domain": {
      const domainRef = observation.entities.find((entity) => entity.kind === "domain");
      if (!domainRef) return [];
      return [celebrate(domainRef, observation)];
    }

    case "habit_abandoned": {
      const habitRef = observation.entities.find((entity) => entity.kind === "habit");
      if (!habitRef) return [];
      return [
        {
          type: "HABIT_RESTART",
          primaryEntity: habitRef,
          relatedEntities: [habitRef],
          evidence: evidenceTokens(observation),
          recencyDays: numericEvidence(observation, "daysSinceUpdate") ?? 0,
          sourcePriority: observation.priority,
        },
      ];
    }

    case "neglected_relationship": {
      const personRef = observation.entities.find((entity) => entity.kind === "person");
      if (!personRef) return [];
      return [
        {
          type: "RECONNECT_PERSON",
          primaryEntity: personRef,
          relatedEntities: observation.entities,
          evidence: evidenceTokens(observation),
          recencyDays: numericEvidence(observation, "daysSinceUpdate") ?? 0,
          sourcePriority: observation.priority,
        },
      ];
    }

    case "inactive_domain": {
      const domainRef = observation.entities.find((entity) => entity.kind === "domain");
      if (!domainRef) return [];
      return [
        {
          type: "FOCUS_DOMAIN",
          primaryEntity: domainRef,
          relatedEntities: [domainRef],
          evidence: evidenceTokens(observation),
          recencyDays: 0,
          sourcePriority: observation.priority,
        },
      ];
    }

    case "contradiction_detected": {
      // Ancla en el Goal (el sujeto real de la contradicción, ver
      // `build-life-observations.ts`) -- una sola recomendación por
      // contradicción, nunca una por cada entidad en conflicto,
      // porque son el mismo hallazgo visto desde distintos ángulos,
      // no hallazgos independientes.
      const goalRef = observation.entities.find((entity) => entity.kind === "goal");
      if (!goalRef) return [];
      return [
        {
          type: "REVIEW_CONTRADICTION",
          primaryEntity: goalRef,
          relatedEntities: observation.entities,
          evidence: evidenceTokens(observation),
          recencyDays: 0,
          sourcePriority: observation.priority,
        },
      ];
    }

    // `core/life` no modela calendario todavía (ver `build-life-observations.ts`) -- nunca produce observaciones, por lo tanto nunca produce candidatos.
    case "overloaded_schedule":
      return [];

    default: {
      const exhaustiveCheck: never = observation.type;
      return exhaustiveCheck;
    }
  }
}

function celebrate(primary: DashboardEntityReference, observation: LifeObservation): RecommendationCandidate {
  return {
    type: "CELEBRATE_PROGRESS",
    primaryEntity: primary,
    relatedEntities: observation.entities,
    evidence: evidenceTokens(observation),
    recencyDays: numericEvidence(observation, "daysSinceUpdate") ?? 0,
    sourcePriority: observation.priority,
  };
}

/**
 * Único hueco que la capa de observaciones deja sin cubrir: `Project`
 * no tiene ningún `LifeObservationType` propio (`goal_at_risk` es
 * exclusivo de Goal). `snapshot.overdue`/`snapshot.stalled` ya traían
 * ese dato calculado -- level con el mismo criterio de "una sola
 * consulta, cero repetida" que ya regía en `build-life-dashboard-snapshot.ts`,
 * esto es indexar en memoria un resultado que ya existe, no una
 * consulta nueva.
 */
function candidatesFromSnapshot(snapshot: LifeDashboardSnapshot): RecommendationCandidate[] {
  const candidates: RecommendationCandidate[] = [];

  const projectOverdue = snapshot.overdue.filter((item): item is DueLifeItem => item.kind === "project");
  for (const item of projectOverdue) {
    const ref: DashboardEntityReference = { kind: "project", id: item.id, title: item.title };
    candidates.push({
      type: "COMPLETE_OVERDUE",
      primaryEntity: ref,
      relatedEntities: [ref],
      evidence: [`dueDate=${item.dueDate.toISOString().slice(0, 10)}`],
      recencyDays: daysAgo(item.dueDate, snapshot.generatedAt),
      sourcePriority: "high",
    });
  }

  const projectStalled = snapshot.stalled.filter(
    (item): item is StalledLifeItem => item.kind === "project",
  );
  for (const item of projectStalled) {
    const ref: DashboardEntityReference = { kind: "project", id: item.id, title: item.title };
    candidates.push({
      type: "PROJECT_REVIEW",
      primaryEntity: ref,
      relatedEntities: [ref],
      evidence: [`daysSinceUpdate=${item.daysSinceUpdate}`],
      recencyDays: item.daysSinceUpdate,
      sourcePriority: "medium",
    });
  }

  return candidates;
}

// ---------------------------------------------------------------------------
// Merge + ranking
// ---------------------------------------------------------------------------

/**
 * Orden de severidad para decidir qué tipo "gana" cuando dos o más
 * candidatos de tipos distintos apuntan a la misma entidad (p. ej. un
 * Project vencido Y estancado a la vez: `COMPLETE_OVERDUE` +
 * `PROJECT_REVIEW`) -- el número menor gana. Nunca se promedian ni se
 * combinan dos `type`, uno de los hechos reales manda y el otro queda
 * como evidencia adicional.
 */
const TYPE_SEVERITY: Record<RecommendationType, number> = {
  REVIEW_CONTRADICTION: 0,
  COMPLETE_OVERDUE: 1,
  RECONNECT_PERSON: 2,
  HABIT_RESTART: 3,
  GOAL_REVIEW: 4,
  PROJECT_REVIEW: 4,
  FOCUS_DOMAIN: 5,
  CELEBRATE_PROGRESS: 6,
  NO_ACTION: 7,
};

/**
 * Cuán directamente observable es el hecho detrás de cada tipo --
 * nunca una opinión, siempre "¿qué tan dura es la evidencia?". Un
 * booleano real (`active`, un `goalId` vencido) pesa más que una
 * heurística de `updatedAt` como proxy de abandono (documentada como
 * limitación honesta en `build-life-observations.ts`).
 */
const BASE_CONFIDENCE: Record<RecommendationType, number> = {
  REVIEW_CONTRADICTION: 0.95,
  COMPLETE_OVERDUE: 0.95,
  HABIT_RESTART: 0.9,
  FOCUS_DOMAIN: 0.85,
  CELEBRATE_PROGRESS: 0.85,
  GOAL_REVIEW: 0.8,
  PROJECT_REVIEW: 0.8,
  RECONNECT_PERSON: 0.7,
  NO_ACTION: 1,
};

const TITLE_BY_TYPE: Record<RecommendationType, string> = {
  GOAL_REVIEW: "Revisar objetivo",
  PROJECT_REVIEW: "Revisar proyecto",
  HABIT_RESTART: "Reiniciar hábito",
  RECONNECT_PERSON: "Reconectar con persona",
  REVIEW_CONTRADICTION: "Resolver contradicción",
  FOCUS_DOMAIN: "Enfocar dominio",
  COMPLETE_OVERDUE: "Completar vencido",
  CELEBRATE_PROGRESS: "Celebrar progreso",
  NO_ACTION: "Sin acción necesaria",
};

const ACTION_KIND_BY_TYPE: Record<RecommendationType, DashboardActionKind> = {
  GOAL_REVIEW: "open_entity",
  PROJECT_REVIEW: "open_entity",
  HABIT_RESTART: "update_status",
  RECONNECT_PERSON: "schedule_check_in",
  REVIEW_CONTRADICTION: "open_entity",
  FOCUS_DOMAIN: "open_entity",
  COMPLETE_OVERDUE: "update_status",
  CELEBRATE_PROGRESS: "acknowledge",
  NO_ACTION: "acknowledge",
};

/** Solo los tipos donde tiene sentido sugerir qué campo mirar -- nunca un valor, esa decisión es humana. */
const SUGGESTED_FIELDS_BY_TYPE: Partial<Record<RecommendationType, string[]>> = {
  GOAL_REVIEW: ["status", "targetDate"],
  PROJECT_REVIEW: ["status", "dueDate"],
  HABIT_RESTART: ["active"],
  REVIEW_CONTRADICTION: ["status"],
  COMPLETE_OVERDUE: ["status", "targetDate", "dueDate"],
};

function dedupeEntities(entities: DashboardEntityReference[]): DashboardEntityReference[] {
  const seen = new Set<string>();
  const result: DashboardEntityReference[] = [];
  for (const entity of entities) {
    const key = entityKey(entity);
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(entity);
  }
  return result;
}

function dedupeStrings(values: string[]): string[] {
  return [...new Set(values)];
}

/**
 * "critical" es el único nivel que ninguna observación puede traer
 * por sí sola (`ObservationPriority` no lo tiene) -- solo aparece
 * cuando el tipo ganador ya era "high" Y hay 2+ señales distintas
 * respaldándolo. Le da peso real a "number of supporting observations"
 * en vez de dejarlo como un campo que nunca mueve nada.
 */
function derivePriority(group: RecommendationCandidate[]): RecommendationPriority {
  const hasHigh = group.some((candidate) => candidate.sourcePriority === "high");
  const hasMedium = group.some((candidate) => candidate.sourcePriority === "medium");
  if (hasHigh && group.length >= 2) return "critical";
  if (hasHigh) return "high";
  if (hasMedium) return "medium";
  return "low";
}

/** Base fija por tipo + 0.05 por cada señal adicional que corrobora la misma entidad, tope en 1 -- nunca un puntaje inventado sin regla explícita. */
function deriveConfidence(type: RecommendationType, supportingCount: number): number {
  const base = BASE_CONFIDENCE[type];
  const bonus = 0.05 * (supportingCount - 1);
  return Math.min(1, Number((base + bonus).toFixed(2)));
}

function buildExplanation(
  type: RecommendationType,
  primaryEntity: DashboardEntityReference,
  evidence: string[],
  supportingCount: number,
): string {
  const compounding = supportingCount > 1 ? ` (${supportingCount} señales)` : "";
  const evidenceSummary = evidence.length > 0 ? ` [${evidence.slice(0, 3).join(", ")}]` : "";
  return `${TITLE_BY_TYPE[type]}: "${primaryEntity.title}"${compounding}${evidenceSummary}.`;
}

function buildAction(type: RecommendationType, primaryEntity: DashboardEntityReference): DashboardAction {
  return {
    kind: ACTION_KIND_BY_TYPE[type],
    targetEntity: primaryEntity,
    suggestedFields: SUGGESTED_FIELDS_BY_TYPE[type],
  };
}

interface RankedRecommendation {
  recommendation: FollowUpRecommendation;
  recencyDays: number;
  supportingCount: number;
}

function mergeGroup(key: string, group: RecommendationCandidate[]): RankedRecommendation {
  const winnerType = [...group].sort((a, b) => TYPE_SEVERITY[a.type] - TYPE_SEVERITY[b.type])[0].type;
  const relatedEntities = dedupeEntities(group.flatMap((candidate) => candidate.relatedEntities));
  const evidence = dedupeStrings(group.flatMap((candidate) => candidate.evidence));
  const recencyDays = Math.min(...group.map((candidate) => candidate.recencyDays));
  const supportingCount = group.length;
  const priority = derivePriority(group);
  const confidence = deriveConfidence(winnerType, supportingCount);
  const primaryEntity = group[0].primaryEntity;

  return {
    recommendation: {
      id: `${winnerType}:${key}`,
      type: winnerType,
      priority,
      title: TITLE_BY_TYPE[winnerType],
      explanation: buildExplanation(winnerType, primaryEntity, evidence, supportingCount),
      evidence,
      relatedEntities,
      suggestedAction: buildAction(winnerType, primaryEntity),
      confidence,
    },
    recencyDays,
    supportingCount,
  };
}

/**
 * Agrupa por entidad primaria ("merge recommendations pointing to the
 * same entity") y arma una `FollowUpRecommendation` por grupo. Dos
 * candidatos de tipos distintos sobre la MISMA entidad (p. ej. un
 * Project vencido y además estancado) se combinan en una sola
 * recomendación; entidades distintas (aunque relacionadas, como el
 * Goal y el Project de una contradicción) se quedan como
 * recomendaciones separadas -- "misma entidad" es literal, no
 * "entidad relacionada".
 */
function mergeCandidates(candidates: RecommendationCandidate[]): RankedRecommendation[] {
  const groups = new Map<string, RecommendationCandidate[]>();
  for (const candidate of candidates) {
    const key = entityKey(candidate.primaryEntity);
    const group = groups.get(key) ?? [];
    group.push(candidate);
    groups.set(key, group);
  }

  const merged: RankedRecommendation[] = [];
  for (const [key, group] of groups) {
    merged.push(mergeGroup(key, group));
  }
  return merged;
}

function sortRanked(ranked: RankedRecommendation[]): RankedRecommendation[] {
  return [...ranked].sort((a, b) => {
    const priorityDiff =
      PRIORITY_RANK[a.recommendation.priority] - PRIORITY_RANK[b.recommendation.priority];
    if (priorityDiff !== 0) return priorityDiff;

    const confidenceDiff = b.recommendation.confidence - a.recommendation.confidence;
    if (confidenceDiff !== 0) return confidenceDiff;

    const recencyDiff = a.recencyDays - b.recencyDays;
    if (recencyDiff !== 0) return recencyDiff;

    return b.supportingCount - a.supportingCount;
  });
}

// ---------------------------------------------------------------------------
// Entrada pública
// ---------------------------------------------------------------------------

/**
 * `observations` ya viene de `buildLifeObservations`; `snapshot` es el
 * mismo `LifeDashboardSnapshot` que ya se calculó una sola vez en
 * `buildLifeDashboardSnapshot` -- ninguno de los dos dispara una
 * consulta nueva aquí, ambos ya están en memoria cuando se llama a
 * esta función. Determinístico de punta a punta: mismo par de
 * entradas siempre produce el mismo arreglo, mismo orden.
 */
export function buildFollowUpRecommendations(
  observations: LifeObservation[],
  snapshot: LifeDashboardSnapshot,
): FollowUpRecommendation[] {
  const candidates = [
    ...observations.flatMap(candidatesFromObservation),
    ...candidatesFromSnapshot(snapshot),
  ];

  const ranked = sortRanked(mergeCandidates(candidates));
  return ranked.map((entry) => entry.recommendation);
}
