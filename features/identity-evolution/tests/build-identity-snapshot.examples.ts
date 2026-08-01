import { buildIdentitySnapshot, type BuildIdentitySnapshotInput } from "../application/build-identity-snapshot";
import type { IdentitySnapshot } from "../domain/identity-snapshot";
import {
  daySeries,
  eventSeries,
  LIFE_GRAPH_ID,
  makeThemeInput,
  NOW,
  PERSON_ID,
} from "./fixtures";

/**
 * Script standalone con datos sintéticos, ejecutable con
 * `npx tsx features/identity-evolution/tests/build-identity-snapshot.examples.ts`
 * -- mismo criterio que `features/narrative/tests/build-narrative-state.examples.ts`
 * (no hay framework de unit tests en este repo). No forma parte de
 * `smoke/runner.ts` -- no toca HTTP ni base de datos.
 *
 * Cubre los ocho escenarios de la misión (recuperación de adicción,
 * cambio de carrera, viaje de fundador de startup, recuperación de
 * relación, paternidad, graduación universitaria, enfermedad de largo
 * plazo, transición mayor de vida) más verificaciones estructurales
 * (cuenta vacía, determinismo, nunca se borra nada, límites 0-100).
 */

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

let hasFailure = false;

function runScenario(name: string, run: () => void) {
  try {
    run();
    console.log(`PASS  ${name}`);
  } catch (error) {
    hasFailure = true;
    console.log(`FAIL  ${name}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

function snapshot(overrides: {
  dimensionEvents?: BuildIdentitySnapshotInput["dimensionEvents"];
  themes?: BuildIdentitySnapshotInput["themes"];
  now?: Date;
}): IdentitySnapshot {
  return buildIdentitySnapshot({
    lifeGraphId: LIFE_GRAPH_ID,
    personId: PERSON_ID,
    now: overrides.now ?? NOW,
    dimensionEvents: overrides.dimensionEvents ?? [],
    themes: overrides.themes ?? [],
  });
}

function findTheme(state: IdentitySnapshot, label: string) {
  const theme = state.themes.find((t) => t.label === label);
  assert(theme, `se esperaba encontrar el tema "${label}"`);
  return theme!;
}

function findDimension(state: IdentitySnapshot, domain: string) {
  const dimension = state.dimensions.find((d) => d.domain === domain);
  assert(dimension, `se esperaba encontrar la dimensión "${domain}"`);
  return dimension!;
}

// ---------------------------------------------------------------------------
// 1. Recovery from addiction -- pico real hace 6-12 meses, silencio total
//    desde entonces. La historia nunca desaparece; deja de dominar.
// ---------------------------------------------------------------------------

runScenario("recovery from addiction -- dormant, nunca desaparece, sigue en resolvedChapters", () => {
  const theme = makeThemeInput({
    conceptId: "concept-ketamina",
    label: "Recuperación de ketamina",
    domain: "health",
    eventDaysAgo: daySeries(360, 185, 5),
  });

  const state = snapshot({
    dimensionEvents: eventSeries({ kind: "belief_strengthened", domain: "health", fromDaysAgo: 360, toDaysAgo: 185, stepDays: 5 }),
    themes: [theme],
  });

  const found = findTheme(state, "Recuperación de ketamina");
  assert(found.peakWeight >= 40, `se esperaba un pico histórico real, llegó a ${found.peakWeight}`);
  assert(found.weight < found.peakWeight, "el peso actual debía ser menor que el pico histórico");
  assert(found.momentum === "dormant", `se esperaba momentum "dormant", fue "${found.momentum}"`);
  assert(
    state.resolvedChapters.some((ref) => ref.key === found.themeKey),
    "debía aparecer en resolvedChapters",
  );
  assert(
    state.deemphasized.some((ref) => ref.key === found.themeKey),
    "debía aparecer en deemphasized (fue significativo, ya no domina)",
  );
  assert(
    !state.primaryIdentity || state.primaryIdentity.key !== found.themeKey,
    "no debía ganar primaryIdentity hoy",
  );
});

// ---------------------------------------------------------------------------
// 2. Career change -- un tema de carrera viejo se apaga, uno nuevo dentro
//    del MISMO dominio emerge. El dominio "career" sigue vivo; el tema
//    específico migra.
// ---------------------------------------------------------------------------

runScenario("career change -- tema viejo declina/dormant, tema nuevo emerging, dominio career sigue vivo", () => {
  const oldTheme = makeThemeInput({
    conceptId: "concept-marketing-acme",
    label: "Marketing en Acme",
    domain: "career",
    eventDaysAgo: daySeries(300, 150, 6),
  });
  const newTheme = makeThemeInput({
    conceptId: "concept-liderando-luz",
    label: "Liderando ingeniería en LUZ",
    domain: "career",
    eventDaysAgo: daySeries(55, 2, 3),
  });

  const state = snapshot({
    dimensionEvents: [
      ...eventSeries({ kind: "belief_strengthened", domain: "career", fromDaysAgo: 300, toDaysAgo: 150, stepDays: 6 }),
      ...eventSeries({ kind: "belief_strengthened", domain: "career", fromDaysAgo: 55, toDaysAgo: 2, stepDays: 3 }),
    ],
    themes: [oldTheme, newTheme],
  });

  const foundOld = findTheme(state, "Marketing en Acme");
  const foundNew = findTheme(state, "Liderando ingeniería en LUZ");

  assert(
    foundOld.momentum === "dormant" || foundOld.momentum === "declining",
    `se esperaba que el tema viejo estuviera apagándose, fue "${foundOld.momentum}"`,
  );
  assert(foundNew.momentum === "emerging", `se esperaba momentum "emerging" para el tema nuevo, fue "${foundNew.momentum}"`);
  assert(foundNew.weight > foundOld.weight, "el tema nuevo debía pesar más que el viejo hoy");

  const career = findDimension(state, "career");
  assert(career.weight > 0, "el dominio career debía seguir vivo (evidencia reciente real)");
});

// ---------------------------------------------------------------------------
// 3. Startup founder journey -- crecimiento sostenido y denso durante
//    mucho tiempo, todavía activo hoy: debía asentarse en "stable" en
//    peso alto, no quedarse "emerging" para siempre.
// ---------------------------------------------------------------------------

runScenario("startup founder journey -- crecimiento sostenido se asienta en stable, peso alto", () => {
  const theme = makeThemeInput({
    conceptId: "concept-construyendo-luz",
    label: "Construyendo LUZ",
    domain: "career",
    eventDaysAgo: daySeries(220, 1, 3),
  });

  const state = snapshot({ themes: [theme] });
  const found = findTheme(state, "Construyendo LUZ");

  assert(found.weight >= 80, `se esperaba peso alto por compromiso sostenido, fue ${found.weight}`);
  assert(found.momentum === "stable", `un crecimiento ya asentado debía leer "stable", fue "${found.momentum}"`);
  assert(
    state.primaryIdentity?.key === found.themeKey,
    "con compromiso sostenido y denso, debía ganar primaryIdentity",
  );
});

// ---------------------------------------------------------------------------
// 4. Relationship recovery -- pico real, silencio real (> 60 días), y
//    ahora vuelve a crecer: un regreso, no un tema nuevo.
// ---------------------------------------------------------------------------

runScenario("relationship recovery -- renewing tras silencio real, no emerging", () => {
  const theme = makeThemeInput({
    conceptId: "concept-reconciliacion-camila",
    label: "Reconciliación con Camila",
    domain: "relationships",
    eventDaysAgo: [
      ...daySeries(260, 200, 6), // pico real, hace 200-260 días
      // silencio real entre día 200 y día 25 (175 días de nada)
      ...daySeries(25, 1, 4), // vuelve a crecer, últimos 25 días
    ],
  });

  const state = snapshot({ themes: [theme] });
  const found = findTheme(state, "Reconciliación con Camila");

  assert(found.peakWeight >= 40, `se esperaba un pico histórico real, llegó a ${found.peakWeight}`);
  assert(found.momentum === "renewing", `se esperaba momentum "renewing", fue "${found.momentum}"`);
});

// ---------------------------------------------------------------------------
// 5. Parenthood -- tema completamente nuevo, sin historial previo, con
//    evidencia densa reciente: emerging, nunca renewing (nada de qué
//    "regresar").
// ---------------------------------------------------------------------------

runScenario("parenthood -- emerging, sin historial previo, nunca renewing", () => {
  const theme = makeThemeInput({
    conceptId: "concept-ser-papa",
    label: "Ser papá",
    domain: "relationships",
    eventDaysAgo: daySeries(25, 1, 2),
  });

  const state = snapshot({ themes: [theme] });
  const found = findTheme(state, "Ser papá");

  assert(found.earliestEvidenceAgeDays !== null && found.earliestEvidenceAgeDays <= 25, "sin historial previo a hace 25 días");
  assert(found.momentum === "emerging", `se esperaba momentum "emerging", fue "${found.momentum}"`);
});

// ---------------------------------------------------------------------------
// 6. University graduation -- historia larga y sostenida que llega a un
//    cierre real y luego calla: debía enfriarse (declining o dormant),
//    nunca seguir "stable" como si nada hubiera cambiado.
// ---------------------------------------------------------------------------

runScenario("university graduation -- se enfría tras el cierre, nunca sigue stable", () => {
  const theme = makeThemeInput({
    conceptId: "concept-universidad",
    label: "Terminando la universidad",
    domain: "personal_growth",
    eventDaysAgo: daySeries(300, 40, 4), // sostenido hasta la graduación (hace 40 días)
    // silencio total en los últimos 40 días -- ya se graduó
  });

  const state = snapshot({ themes: [theme] });
  const found = findTheme(state, "Terminando la universidad");

  assert(found.peakWeight >= 40, `se esperaba un pico histórico real, llegó a ${found.peakWeight}`);
  assert(found.weight < found.peakWeight, "el peso debía haber bajado desde el pico");
  assert(
    found.momentum === "declining" || found.momentum === "dormant",
    `se esperaba "declining" o "dormant" tras el cierre, fue "${found.momentum}"`,
  );
});

// ---------------------------------------------------------------------------
// 7. Long-term illness -- evidencia sostenida y moderada durante mucho
//    tiempo, sin saltos dramáticos: stable, nunca mal-clasificada como
//    declining/renewing por ruido normal.
// ---------------------------------------------------------------------------

runScenario("long-term illness -- evidencia sostenida y moderada lee stable, no ruido", () => {
  const theme = makeThemeInput({
    conceptId: "concept-tratamiento-largo",
    label: "Tratamiento de largo plazo",
    domain: "health",
    eventDaysAgo: daySeries(300, 1, 7),
  });

  const state = snapshot({ themes: [theme] });
  const found = findTheme(state, "Tratamiento de largo plazo");

  assert(found.momentum === "stable", `evidencia sostenida sin saltos debía leer "stable", fue "${found.momentum}" (delta=${found.delta}, weight=${found.weight}, checkpoint=${found.weightAtComparisonCheckpoint})`);
  assert(found.confidence.timeSpreadWeeks >= 10, "una historia de 300 días debía repartirse en muchas semanas distintas");
});

// ---------------------------------------------------------------------------
// 8. Major life transition -- la identidad principal cambia de dueño: un
//    tema que lideraba hace 45 días pierde el puesto #1 frente a otro que
//    está emergiendo ahora. trajectory debía leer "transitioning".
// ---------------------------------------------------------------------------

runScenario("major life transition -- trajectory transitioning cuando el #1 cambia de dueño", () => {
  const decliningPrimary = makeThemeInput({
    conceptId: "concept-recuperacion",
    label: "Recuperación",
    domain: "health",
    eventDaysAgo: daySeries(300, 50, 4), // fuerte hasta hace 50 días, luego calla
  });
  const risingChallenger = makeThemeInput({
    conceptId: "concept-construyendo-luz-2",
    label: "Construyendo LUZ",
    domain: "career",
    eventDaysAgo: daySeries(40, 1, 2), // crece fuerte en los últimos 40 días
  });

  const state = snapshot({ themes: [decliningPrimary, risingChallenger] });

  assert(state.trajectory.state === "transitioning", `se esperaba trajectory "transitioning", fue "${state.trajectory.state}"`);
  assert(state.recentShifts.length >= 1, "se esperaba al menos un IdentityShift real");
  assert(
    state.primaryIdentity?.label === "Construyendo LUZ",
    `se esperaba que "Construyendo LUZ" liderara hoy, primaryIdentity fue "${state.primaryIdentity?.label}"`,
  );
});

// ---------------------------------------------------------------------------
// Verificaciones estructurales
// ---------------------------------------------------------------------------

runScenario("cuenta vacía -- las 8 dimensiones existen, sin crash, sin identidad fabricada", () => {
  const state = snapshot({});

  assert(state.dimensions.length === 8, `se esperaban 8 dimensiones, hubo ${state.dimensions.length}`);
  assert(state.themes.length === 0, "sin conceptos, sin temas");
  assert(state.primaryIdentity === null, "nunca se fabrica una identidad principal sin evidencia");
  assert(state.secondaryIdentity === null, "nunca se fabrica una identidad secundaria sin evidencia");
  assert(state.trajectory.state === "insufficient_evidence", "sin evidencia real, trajectory debía ser insufficient_evidence");
  for (const dimension of state.dimensions) {
    assert(dimension.weight === 0, `dimensión ${dimension.domain} debía pesar 0`);
    assert(dimension.momentum === "stable", `dimensión ${dimension.domain} debía leer "stable" en ausencia total`);
  }
});

runScenario("determinismo -- misma entrada, mismo now, mismo resultado byte a byte", () => {
  const themes = [
    makeThemeInput({ conceptId: "concept-a", label: "Tema A", domain: "career", eventDaysAgo: daySeries(80, 1, 5) }),
    makeThemeInput({ conceptId: "concept-b", label: "Tema B", domain: "health", eventDaysAgo: daySeries(300, 200, 6) }),
  ];
  const dimensionEvents = eventSeries({ kind: "belief_strengthened", domain: "career", fromDaysAgo: 80, toDaysAgo: 1, stepDays: 5 });

  const first = snapshot({ themes, dimensionEvents });
  const second = snapshot({ themes, dimensionEvents });

  assert(JSON.stringify(first) === JSON.stringify(second), "dos corridas con la misma entrada debían producir el mismo JSON");
});

runScenario("nunca se borra nada -- un tema totalmente dormido sigue en themes[]", () => {
  const theme = makeThemeInput({
    conceptId: "concept-viejo-capitulo",
    label: "Capítulo viejo",
    domain: "leisure",
    eventDaysAgo: daySeries(360, 200, 5),
  });

  const state = snapshot({ themes: [theme] });
  assert(state.themes.length === 1, "el tema debía seguir presente en themes[] aunque esté en weight bajo");
  assert(state.themes[0]!.label === "Capítulo viejo", "la evidencia original nunca se sintetiza en otra cosa");
});

runScenario("límites -- weight nunca excede 100 incluso con evidencia extrema", () => {
  const theme = makeThemeInput({
    conceptId: "concept-extremo",
    label: "Tema extremo",
    domain: "career",
    eventDaysAgo: daySeries(89, 0, 1),
  });

  const state = snapshot({ themes: [theme] });
  const found = findTheme(state, "Tema extremo");
  assert(found.weight <= 100 && found.weight >= 0, `weight fuera de rango: ${found.weight}`);
  assert(found.peakWeight <= 100 && found.peakWeight >= 0, `peakWeight fuera de rango: ${found.peakWeight}`);
  assert(found.confidence.score <= 100 && found.confidence.score >= 0, `confidence.score fuera de rango: ${found.confidence.score}`);
});

if (hasFailure) {
  console.log("\nFALLARON uno o más escenarios.");
  process.exit(1);
} else {
  console.log("\nTodos los escenarios pasaron.");
}
