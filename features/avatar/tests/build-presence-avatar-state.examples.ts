import { buildPresenceAvatarState } from "../application/build-presence-avatar-state";
import { deriveMood } from "../services/derive-mood";
import {
  emergingIdentity,
  emptyIdentity,
  makeExperienceCard,
  makeExperienceState,
  makeNarrativeArc,
  makeNarrativeMoment,
  makeNarrativeState,
  makePresenceState,
  makeRecommendation,
  NOW,
  stableHappyIdentity,
} from "./fixtures";

/**
 * Script standalone con datos sintéticos, ejecutable con
 * `npx tsx features/avatar/tests/build-presence-avatar-state.examples.ts`
 * -- mismo criterio que el resto del repo (no hay framework de unit
 * tests). No forma parte de `smoke/runner.ts` -- no toca HTTP ni base
 * de datos.
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

const CALM_INPUT = {
  presence: makePresenceState(),
  experience: makeExperienceState(),
  narrative: makeNarrativeState(),
  identity: emptyIdentity(),
  now: NOW,
};

// ---------------------------------------------------------------------------
// Reglas de mood, en orden de prioridad
// ---------------------------------------------------------------------------

runScenario("urgencia crítica real -> attentive, intensidad máxima", () => {
  const mood = deriveMood({
    ...CALM_INPUT,
    presence: makePresenceState({ urgency: "critical", attentionNeeded: [makeRecommendation({ title: "Hábito en riesgo" })] }),
  });
  assert(mood.emotion === "attentive", `se esperaba "attentive", fue "${mood.emotion}"`);
  assert(mood.intensity === 1, `se esperaba intensidad 1, fue ${mood.intensity}`);
  assert(mood.gaze === "highlight" && mood.focusRef?.title === "Hábito en riesgo", "el foco debía apuntar a la recomendación real");
});

runScenario("celebración real en Narrative -> celebrating", () => {
  const mood = deriveMood({
    ...CALM_INPUT,
    narrative: makeNarrativeState({ celebrationCandidates: [makeNarrativeMoment({ title: "Cumpleaños de Camila", score: 4 })] }),
  });
  assert(mood.emotion === "celebrating", `se esperaba "celebrating", fue "${mood.emotion}"`);
  assert(mood.focusRef?.title === "Cumpleaños de Camila", "el foco debía apuntar al momento real");
});

runScenario("celebración real en Experience (sin Narrative) -> celebrating", () => {
  const mood = deriveMood({
    ...CALM_INPUT,
    experience: makeExperienceState({ primary: makeExperienceCard({ category: "celebration", title: "Proyecto completado", importance: 4 }) }),
  });
  assert(mood.emotion === "celebrating", `se esperaba "celebrating", fue "${mood.emotion}"`);
  assert(mood.focusRef?.title === "Proyecto completado", "el foco debía apuntar a la tarjeta real");
});

runScenario("prioridad: urgencia crítica gana sobre una celebración real", () => {
  const mood = deriveMood({
    ...CALM_INPUT,
    presence: makePresenceState({ urgency: "critical", attentionNeeded: [makeRecommendation()] }),
    narrative: makeNarrativeState({ celebrationCandidates: [makeNarrativeMoment()] }),
  });
  assert(mood.emotion === "attentive", `una urgencia crítica real debía ganar, fue "${mood.emotion}"`);
});

runScenario("prioridad: una celebración real gana sobre urgencia alta (no crítica)", () => {
  const mood = deriveMood({
    ...CALM_INPUT,
    presence: makePresenceState({ urgency: "high", attentionNeeded: [makeRecommendation()] }),
    narrative: makeNarrativeState({ celebrationCandidates: [makeNarrativeMoment()] }),
  });
  assert(mood.emotion === "celebrating", `una celebración real debía ganar sobre urgencia alta, fue "${mood.emotion}"`);
});

runScenario("urgencia alta real -> attentive, intensidad moderada", () => {
  const mood = deriveMood({
    ...CALM_INPUT,
    presence: makePresenceState({ urgency: "high", attentionNeeded: [makeRecommendation()] }),
  });
  assert(mood.emotion === "attentive", `se esperaba "attentive", fue "${mood.emotion}"`);
  assert(mood.intensity === 0.6, `se esperaba intensidad 0.6, fue ${mood.intensity}`);
});

runScenario("identidad emergente real -> curious", () => {
  const mood = deriveMood({ ...CALM_INPUT, identity: emergingIdentity() });
  assert(mood.emotion === "curious", `se esperaba "curious", fue "${mood.emotion}"`);
  assert(mood.focusRef?.title === "Construyendo LUZ", "el foco debía apuntar al tema emergente real");
});

runScenario("eco temporal real en Narrative (sin identidad emergente) -> curious", () => {
  const mood = deriveMood({
    ...CALM_INPUT,
    narrative: makeNarrativeState({ currentActiveStory: makeNarrativeArc({ echo: { sourceThreadId: "loop-0", intervalMonths: 12 } }) }),
  });
  assert(mood.emotion === "curious", `se esperaba "curious", fue "${mood.emotion}"`);
});

runScenario("Presence ya preparó un reconocimiento real -> happy", () => {
  const mood = deriveMood({ ...CALM_INPUT, presence: makePresenceState({ encouragement: "Llevas 5 días seguidos con tu hábito." }) });
  assert(mood.emotion === "happy", `se esperaba "happy", fue "${mood.emotion}"`);
});

runScenario("identidad principal real en momentum positivo (sin nada más) -> happy", () => {
  const mood = deriveMood({ ...CALM_INPUT, identity: stableHappyIdentity() });
  assert(mood.emotion === "happy", `se esperaba "happy", fue "${mood.emotion}"`);
});

runScenario("sin ninguna señal real -> calm, nunca fabricado", () => {
  const mood = deriveMood(CALM_INPUT);
  assert(mood.emotion === "calm", `se esperaba "calm", fue "${mood.emotion}"`);
  assert(mood.focusRef === null, "calm nunca debía traer un foco inventado");
});

// ---------------------------------------------------------------------------
// Interacción en vivo -- siempre gana sobre el mood de fondo
// ---------------------------------------------------------------------------

runScenario("interacción: la IA respondiendo siempre gana -> animation think", () => {
  const state = buildPresenceAvatarState({
    ...CALM_INPUT,
    presence: makePresenceState({ urgency: "critical", attentionNeeded: [makeRecommendation()] }),
    interaction: { isAiResponding: true, isUserTyping: false, msSinceLastActivity: 0, localHour: 12 },
  });
  assert(state.animation === "think", `se esperaba animation "think" incluso con urgencia crítica de fondo, fue "${state.animation}"`);
  assert(state.emotion === "attentive", "la EMOCIÓN de fondo debía seguir siendo la real (attentive), solo cambia la animación");
});

runScenario("interacción: la persona escribiendo -> animation listen, mirada siempre en el usuario", () => {
  const state = buildPresenceAvatarState({
    ...CALM_INPUT,
    identity: emergingIdentity(),
    interaction: { isAiResponding: false, isUserTyping: true, msSinceLastActivity: 0, localHour: 12 },
  });
  assert(state.animation === "listen", `se esperaba "listen", fue "${state.animation}"`);
  assert(state.gaze === "user", `escuchar siempre mira al usuario, fue "${state.gaze}"`);
});

runScenario("interacción: silencio real de noche -> animation sleep, emotion calm", () => {
  const state = buildPresenceAvatarState({
    ...CALM_INPUT,
    identity: stableHappyIdentity(),
    interaction: { isAiResponding: false, isUserTyping: false, msSinceLastActivity: 10 * 60 * 1000, localHour: 3 },
  });
  assert(state.animation === "sleep", `se esperaba "sleep", fue "${state.animation}"`);
  assert(state.emotion === "calm", `dormir con una emoción activa no es coherente, fue "${state.emotion}"`);
});

runScenario("sin interacción real Y sin historial (primer render) -> el gesto de entrada se dispara", () => {
  const state = buildPresenceAvatarState({
    ...CALM_INPUT,
    narrative: makeNarrativeState({ celebrationCandidates: [makeNarrativeMoment()] }),
  });
  assert(state.animation === "jump", `primer render con una celebración real de fondo debía animar "jump", fue "${state.animation}"`);
});

// ---------------------------------------------------------------------------
// Duración / repetición de gestos -- "¿cuánto dura una sonrisa?"
// ---------------------------------------------------------------------------

runScenario("un gesto NUNCA se repite en cada render mientras la emoción no cambia", () => {
  const input = {
    ...CALM_INPUT,
    narrative: makeNarrativeState({ celebrationCandidates: [makeNarrativeMoment()] }),
  };
  const first = buildPresenceAvatarState({ ...input, interaction: { isAiResponding: false, isUserTyping: false, msSinceLastActivity: 0, localHour: 12 } });
  assert(first.animation === "jump", `primera entrada a "celebrating" debía disparar "jump", fue "${first.animation}"`);

  const second = buildPresenceAvatarState({
    ...input,
    interaction: { isAiResponding: false, isUserTyping: false, msSinceLastActivity: 0, localHour: 12, previousEmotion: first.emotion },
  });
  assert(second.animation === "idle", `la MISMA emoción sostenida nunca debía repetir el gesto, fue "${second.animation}"`);
  assert(second.emotion === "celebrating", "la cara debía seguir mostrando la emoción real mientras el cuerpo vuelve a idle");
});

runScenario("un cambio real de emoción SÍ dispara un nuevo gesto", () => {
  const state = buildPresenceAvatarState({
    ...CALM_INPUT,
    presence: makePresenceState({ urgency: "critical", attentionNeeded: [makeRecommendation()] }),
    interaction: { isAiResponding: false, isUserTyping: false, msSinceLastActivity: 0, localHour: 12, previousEmotion: "celebrating" },
  });
  assert(state.emotion === "attentive", `se esperaba "attentive", fue "${state.emotion}"`);
  assert(state.animation === "nod", `pasar de celebrating a attentive debía disparar "nod", fue "${state.animation}"`);
});

// ---------------------------------------------------------------------------
// Interrupción -- "¿qué interrumpe qué?" / "¿qué pasa si escribe durante una celebración?"
// ---------------------------------------------------------------------------

runScenario("la persona escribiendo interrumpe un gesto en curso, sin esperar a que termine", () => {
  const state = buildPresenceAvatarState({
    ...CALM_INPUT,
    narrative: makeNarrativeState({ celebrationCandidates: [makeNarrativeMoment()] }),
    interaction: { isAiResponding: false, isUserTyping: true, msSinceLastActivity: 0, localHour: 12 },
  });
  assert(state.animation === "listen", `escribir siempre interrumpe un gesto, fue "${state.animation}"`);
  assert(state.emotion === "celebrating", "la cara debía seguir feliz mientras el cuerpo escucha -- escuchar no borra el mood real");
});

runScenario("la IA respondiendo interrumpe incluso un gesto recién disparado", () => {
  const state = buildPresenceAvatarState({
    ...CALM_INPUT,
    narrative: makeNarrativeState({ celebrationCandidates: [makeNarrativeMoment()] }),
    interaction: { isAiResponding: true, isUserTyping: false, msSinceLastActivity: 0, localHour: 12 },
  });
  assert(state.animation === "think", `la IA respondiendo siempre gana, fue "${state.animation}"`);
});

// ---------------------------------------------------------------------------
// "Qué nunca debe ocurrir" -- invariantes explícitos
// ---------------------------------------------------------------------------

runScenario("nunca se duerme sobre una urgencia crítica real", () => {
  const state = buildPresenceAvatarState({
    ...CALM_INPUT,
    presence: makePresenceState({ urgency: "critical", attentionNeeded: [makeRecommendation()] }),
    interaction: { isAiResponding: false, isUserTyping: false, msSinceLastActivity: 10 * 60 * 1000, localHour: 3 },
  });
  assert(state.animation !== "sleep", `una urgencia crítica real nunca debía dejarse "dormir", fue "${state.animation}"`);
  assert(state.emotion === "attentive", `se esperaba que la emoción real (attentive) se mantuviera, fue "${state.emotion}"`);
});

runScenario("movimiento reducido -- nunca un gesto, sin importar el mood", () => {
  const state = buildPresenceAvatarState({
    ...CALM_INPUT,
    narrative: makeNarrativeState({ celebrationCandidates: [makeNarrativeMoment()] }),
    interaction: { isAiResponding: false, isUserTyping: false, msSinceLastActivity: 0, localHour: 12, reducedMotion: true },
  });
  assert(state.animation === "idle", `con movimiento reducido nunca debía animar un gesto, fue "${state.animation}"`);
  assert(state.emotion === "celebrating", "la emoción real sigue intacta -- solo se suprime el movimiento expresivo, no el mood");
});

// ---------------------------------------------------------------------------
// Determinismo
// ---------------------------------------------------------------------------

runScenario("determinismo -- misma entrada, mismo resultado byte a byte", () => {
  const input = {
    ...CALM_INPUT,
    presence: makePresenceState({ urgency: "high", attentionNeeded: [makeRecommendation()] }),
    interaction: { isAiResponding: false, isUserTyping: false, msSinceLastActivity: 1000, localHour: 14 },
  };
  const first = buildPresenceAvatarState(input);
  const second = buildPresenceAvatarState(input);
  assert(JSON.stringify(first) === JSON.stringify(second), "dos corridas con la misma entrada debían producir el mismo JSON");
});

if (hasFailure) {
  console.log("\nFALLARON uno o más escenarios.");
  process.exit(1);
} else {
  console.log("\nTodos los escenarios pasaron.");
}
