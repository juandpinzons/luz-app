/**
 * Sin framework de unit tests en este repo -- script standalone,
 * `npx tsx features/conversational-variety/tests/compute-conversation-variety.examples.ts`.
 * No forma parte de `smoke/runner.ts` (esa suite corre contra Postgres
 * real; esto prueba la función pura contra fixtures sintéticas, cero
 * IO). Mismo patrón que `features/identity-evolution/tests/`.
 */
import { computeConversationVariety } from "../services/compute-conversation-variety";
import { daysAgo, makeEntries, NOW } from "./fixtures";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

let passed = 0;

function scenario(name: string, run: () => void): void {
  run();
  passed += 1;
  console.log(`✓ ${name}`);
}

scenario("ventana vacía -- nunca se fabrica un dominio dominante", () => {
  const snapshot = computeConversationVariety([], NOW);
  assert(snapshot.windowSize === 0, "windowSize debería ser 0");
  assert(snapshot.dominantDomain === null, "dominantDomain debería ser null");
  assert(snapshot.fatiguedDomain === null, "fatiguedDomain debería ser null");
  assert(!snapshot.isMonotonous, "una ventana vacía nunca es monótona");
  assert(snapshot.diversityScore === 0, "diversityScore debería ser 0");
});

scenario("ventana diversa (8 dominios distintos) -- nunca monótona", () => {
  const entries = makeEntries([
    "career",
    "health",
    "finances",
    "relationships",
    "personal_growth",
    "leisure",
    "home",
    "spirituality",
  ]);
  const snapshot = computeConversationVariety(entries, NOW);
  assert(!snapshot.isMonotonous, "8 dominios distintos en 8 conversaciones no debería ser monótono");
  assert(snapshot.fatiguedDomain === null, "sin monotonía, fatiguedDomain debería ser null");
  assert(
    Math.abs(snapshot.diversityScore - 8 / 9) < 1e-9,
    `diversityScore debería ser 8/9, dio ${snapshot.diversityScore}`,
  );
  assert(snapshot.dominantDomainStreak === 1, "sin repetición consecutiva, la racha debería ser 1");
});

scenario("monotonía por SHARE -- dominante sin racha consecutiva de 4", () => {
  // más reciente primero: career, health, career, finances, career, leisure, career, career
  const entries = makeEntries([
    "career",
    "health",
    "career",
    "finances",
    "career",
    "leisure",
    "career",
    "career",
  ]);
  const snapshot = computeConversationVariety(entries, NOW);
  assert(snapshot.windowSize === 8, "windowSize debería ser 8");
  assert(snapshot.dominantDomain?.domain === "career", "el dominio dominante debería ser 'career'");
  assert(
    Math.abs((snapshot.dominantDomain?.shareOfWindow ?? 0) - 5 / 8) < 1e-9,
    "career debería tener share 5/8",
  );
  assert(snapshot.dominantDomainStreak === 1, "la racha desde la más reciente debería ser 1 (se corta en 'health')");
  assert(snapshot.isMonotonous, "share >= 0.5 con windowSize >= 6 debería ser monótono aunque la racha sea corta");
  assert(snapshot.fatiguedDomain?.domain === "career", "fatiguedDomain debería ser 'career'");
});

scenario("monotonía por RACHA -- ventana chica, share alto pero por debajo del piso de tamaño", () => {
  const entries = makeEntries(["health", "health", "health", "health", "career"]);
  const snapshot = computeConversationVariety(entries, NOW);
  assert(snapshot.windowSize === 5, "windowSize debería ser 5 (< MIN_WINDOW_FOR_SHARE_CHECK)");
  assert(snapshot.dominantDomainStreak === 4, "4 conversaciones seguidas de 'health' -- racha debería ser 4");
  assert(
    snapshot.isMonotonous,
    "una racha de 4 debería disparar monotonía aunque la ventana sea demasiado chica para el chequeo de share",
  );
  assert(snapshot.fatiguedDomain?.domain === "health", "fatiguedDomain debería ser 'health'");
});

scenario("NO monótono -- ventana chica, share alto, racha corta (falso positivo evitado)", () => {
  const entries = makeEntries(["career", "health", "career"]);
  const snapshot = computeConversationVariety(entries, NOW);
  assert(snapshot.windowSize === 3, "windowSize debería ser 3");
  assert(snapshot.dominantDomainStreak === 1, "la racha desde la más reciente debería ser 1");
  assert(
    !snapshot.isMonotonous,
    "2 de 3 conversaciones sobre lo mismo, en una ventana chica y sin racha, no debería ser monótono -- coincidencia orgánica, no obsesión",
  );
});

scenario("NO monótono -- justo por debajo de ambos umbrales", () => {
  const entries = makeEntries([
    "career",
    "career",
    "career",
    "health",
    "finances",
    "leisure",
    "relationships",
  ]);
  const snapshot = computeConversationVariety(entries, NOW);
  assert(snapshot.windowSize === 7, "windowSize debería ser 7 (>= MIN_WINDOW_FOR_SHARE_CHECK)");
  assert(snapshot.dominantDomainStreak === 3, "3 seguidas -- por debajo del umbral de racha (4)");
  assert(
    Math.abs((snapshot.dominantDomain?.shareOfWindow ?? 0) - 3 / 7) < 1e-9,
    "career debería tener share 3/7, por debajo del umbral de share (0.5)",
  );
  assert(!snapshot.isMonotonous, "ni el share ni la racha cruzan su umbral -- no debería ser monótono");
});

scenario("'general' participa como cualquier otra categoría", () => {
  const entries = makeEntries(["general", "general", "general", "general", "career"]);
  const snapshot = computeConversationVariety(entries, NOW);
  assert(snapshot.dominantDomain?.domain === "general", "'general' debería poder ser el dominio dominante");
  assert(snapshot.isMonotonous, "una racha de 4 de 'general' también dispara monotonía");
});

scenario("daysSinceLastConversation -- exacto por dominio, null para ausentes", () => {
  const entries = [
    { category: "career" as const, occurredAt: daysAgo(1) },
    { category: "health" as const, occurredAt: daysAgo(10) },
    { category: "career" as const, occurredAt: daysAgo(20) },
  ];
  const snapshot = computeConversationVariety(entries, NOW);
  const career = snapshot.frequencies.find((f) => f.domain === "career");
  const health = snapshot.frequencies.find((f) => f.domain === "health");
  const finances = snapshot.frequencies.find((f) => f.domain === "finances");
  assert(career?.daysSinceLastConversation === 1, `career debería ser 1 día, dio ${career?.daysSinceLastConversation}`);
  assert(health?.daysSinceLastConversation === 10, `health debería ser 10 días, dio ${health?.daysSinceLastConversation}`);
  assert(finances === undefined, "un dominio ausente de la ventana no debería aparecer en frequencies -- ausencia real, nunca Infinity");
});

scenario("determinismo -- misma entrada, mismo now, mismo resultado", () => {
  const entries = makeEntries(["career", "career", "health", "finances", "career", "leisure"]);
  const a = computeConversationVariety(entries, NOW);
  const b = computeConversationVariety(entries, NOW);
  assert(JSON.stringify(a) === JSON.stringify(b), "dos corridas con la misma entrada deberían producir el mismo JSON");
});

console.log(`\n${passed} escenarios de Conversational Variety V1 pasando.`);
