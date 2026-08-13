/**
 * War Room 13-ago-2026 (terremoto de Cali): red de seguridad mínima,
 * agregada bajo presión de tiempo real -- no un clasificador clínico.
 * Mismo criterio determinista que `isAggregationQuery`/
 * `UNDERSTANDING_SIGNALS` (coincidencia de frase, nunca NLP ni una
 * llamada a IA para decidir esto): tiene que disparar siempre que
 * dispara, sin depender de que el modelo "se acuerde" de mencionar
 * ayuda real en un momento así.
 *
 * Alcance deliberado: frases explícitas de intención de
 * suicidio/autolesión, no palabras sueltas ambiguas ("morir", "muerte",
 * "desaparecer") que aparecen todo el tiempo en modismos comunes ("me
 * muero de la risa", "quiero desaparecer de la pena"). El costo de un
 * falso positivo aquí es bajo (una línea de más, cálida, con un número
 * real); el costo de un falso negativo es alto -- por eso la lista es
 * explícita pero no exhaustiva. Debe ampliarse con casos reales, mismo
 * precedente que P1-4/P1-6 (`UNDERSTANDING_SIGNALS`), nunca por
 * anticipación.
 */

/**
 * Señal fuerte: prácticamente nunca aparece en un modismo. Cualquiera
 * de estas, sola, es suficiente.
 */
const STRONG_CRISIS_SIGNALS: readonly string[] = [
  "quiero suicidarme",
  "pensando en suicidarme",
  "voy a suicidarme",
  "suicidarme",
  "suicidio",
  "quitarme la vida",
  "acabar con mi vida",
  "terminar con mi vida",
  "quiero matarme",
  "me quiero matar",
  /**
   * Sin prefijo "quiero"/"me quiero" ("sería mejor matarme", "debería
   * matarme") -- sí colisiona con el modismo "matarme trabajando/
   * estudiando" (trabajar mucho), pero a diferencia de la familia
   * "morir" (`SOFT_CRISIS_SIGNALS`), separar ese modismo de un caso real
   * ("trabajo todo el día y quiero matarme, ya no puedo con esto")
   * exigiría más que coincidencia de substring -- dado el contexto de
   * hoy, se prefiere el falso positivo ocasional sobre el riesgo de
   * silenciar un caso real.
   */
  "matarme",
  "no quiero vivir más",
  "no quiero seguir viviendo",
  "ya no quiero vivir",
  "no quiero existir",
  "no vale la pena seguir viviendo",
  "autolesionarme",
  "me autolesiono",
  "hacerme daño a mí misma",
  "hacerme daño a mí mismo",
  "mejor estaría muerta",
  "mejor estaría muerto",
  "want to kill myself",
  "kill myself",
  "end my life",
  "ending my life",
  "don't want to live anymore",
  "no reason to live",
  "better off dead",
  "planning to kill myself",
  "hurt myself",
  "harm myself",
  "self-harm",
  "self harm",
  "suicidal",
  "suicide",
];

/**
 * Señal "blanda": la familia "morir(me)/muero" -- la forma más común en
 * español real de decir esto ("me quiero morir"), pero también la base
 * del modismo más común del idioma ("me muero de risa/vergüenza/...").
 * Solo cuenta si el mensaje NO contiene además uno de los remates de
 * `IDIOM_SUFFIXES` de abajo.
 */
const SOFT_CRISIS_SIGNALS: readonly string[] = [
  "quiero morirme",
  "me quiero morir",
  "want to die",
];

/** Remates que convierten "morir(me)"/"want to die" en un modismo real, no una señal. */
const IDIOM_SUFFIXES: readonly string[] = [
  "de risa",
  "de la risa",
  "de vergüenza",
  "de la vergüenza",
  "de pena",
  "de la pena",
  "de hambre",
  "de amor",
  "de aburrimiento",
  "de rabia",
  "de ganas",
  "de envidia",
  "de sueño",
  "de frío",
  "de calor",
  "de miedo",
  "de los nervios",
  "of embarrassment",
  "of laughing",
  "of laughter",
  "of boredom",
  "laughing",
];

export function detectCrisisSignal(message: string): boolean {
  const normalized = message.toLowerCase();

  if (STRONG_CRISIS_SIGNALS.some((signal) => normalized.includes(signal))) {
    return true;
  }

  const hasSoftSignal = SOFT_CRISIS_SIGNALS.some((signal) =>
    normalized.includes(signal),
  );
  if (!hasSoftSignal) {
    return false;
  }

  const isKnownIdiom = IDIOM_SUFFIXES.some((suffix) =>
    normalized.includes(suffix),
  );
  return !isKnownIdiom;
}

/**
 * Se agrega SIEMPRE por código, nunca pedida como instrucción al LLM --
 * la única forma de garantizar que aparece es que ninguna generación de
 * IA esté en el camino de decidirlo. Línea 106 (salud mental, gratuita,
 * 24/7, activa hoy para la respuesta al terremoto) y línea 123
 * (emergencias) -- verificadas ambas contra cobertura real de hoy
 * (13-ago-2026), no recordadas de memoria de entrenamiento. Founder:
 * reemplaza/agrega aquí la línea específica de Cali/Valle del Cauca en
 * cuanto la autoridad local publique una -- este archivo es el único
 * lugar que hay que tocar.
 */
export const CRISIS_RESOURCE_MESSAGE =
  "Lo que me cuentas suena muy pesado, y no tienes que cargarlo tú sola/o. Si en este momento estás pensando en hacerte daño, comunícate ya con la Línea 106 (salud mental, gratuita, 24/7) o la Línea 123 en caso de emergencia -- hay personas reales del otro lado, ahora mismo, listas para ayudarte.";
