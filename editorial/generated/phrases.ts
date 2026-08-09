/**
 * GENERADO por editorial/build-phrases.mjs -- no editar a mano.
 * Fuente real: editorial/<categoria>/phrases.yaml (ver editorial/README.md).
 * Volver a correr `node editorial/build-phrases.mjs` después de
 * cualquier cambio a los YAML -- este archivo no se regenera solo.
 * 99 frases totales, 11 categorías.
 */
export type EditorialCategory = "busy_day" | "celebration" | "curiosity" | "identity" | "morning" | "night" | "observation" | "progress" | "reflection" | "silence" | "welcome_back";

export interface EditorialPhrase {
  id: string;
  text: string;
  category: EditorialCategory;
  tone: string;
  energy: string;
  length: string;
  repeatAfterDays: number;
}

export const BUSY_DAY_PHRASES: EditorialPhrase[] = [
  { id: "busy_day_001", text: "Veo un día bastante ocupado. ¿Lo organizamos juntos?", category: "busy_day", tone: "grounded", energy: "medium", length: "medium", repeatAfterDays: 30 },
  { id: "busy_day_002", text: "Hay varias cosas esperando por ti. Empecemos por una.", category: "busy_day", tone: "grounded", energy: "medium", length: "medium", repeatAfterDays: 30 },
  { id: "busy_day_003", text: "No todo necesita resolverse esta mañana.", category: "busy_day", tone: "calm", energy: "low", length: "short", repeatAfterDays: 30 },
  { id: "busy_day_004", text: "Priorizamos una cosa a la vez.", category: "busy_day", tone: "grounded", energy: "medium", length: "short", repeatAfterDays: 30 },
  { id: "busy_day_005", text: "Hagamos espacio para lo importante.", category: "busy_day", tone: "grounded", energy: "medium", length: "short", repeatAfterDays: 30 },
  { id: "busy_day_006", text: "Podemos ordenar el día antes de empezar.", category: "busy_day", tone: "grounded", energy: "medium", length: "medium", repeatAfterDays: 30 },
  { id: "busy_day_007", text: "Respiremos primero, luego decidimos.", category: "busy_day", tone: "calm", energy: "low", length: "short", repeatAfterDays: 30 },
  { id: "busy_day_008", text: "No tienes que cargar con todo al mismo tiempo.", category: "busy_day", tone: "calm", energy: "low", length: "medium", repeatAfterDays: 30 },
  { id: "busy_day_009", text: "Un paso primero, el resto puede esperar.", category: "busy_day", tone: "calm", energy: "low", length: "medium", repeatAfterDays: 30 },
  { id: "busy_day_010", text: "Hoy hay bastante por delante. Empecemos por una cosa.", category: "busy_day", tone: "grounded", energy: "medium", length: "medium", repeatAfterDays: 30 },
];

export const CELEBRATION_PHRASES: EditorialPhrase[] = [

];

export const CURIOSITY_PHRASES: EditorialPhrase[] = [
  { id: "curiosity_001", text: "¿Qué te gustaría que hoy fuera diferente?", category: "curiosity", tone: "curious", energy: "low", length: "medium", repeatAfterDays: 30 },
  { id: "curiosity_002", text: "¿Qué esperas de este día?", category: "curiosity", tone: "curious", energy: "low", length: "short", repeatAfterDays: 30 },
  { id: "curiosity_003", text: "Si hoy solo pudieras lograr una cosa, ¿cuál sería?", category: "curiosity", tone: "curious", energy: "low", length: "medium", repeatAfterDays: 30 },
  { id: "curiosity_004", text: "¿Qué pequeño momento te gustaría recordar esta noche?", category: "curiosity", tone: "curious", energy: "low", length: "medium", repeatAfterDays: 30 },
  { id: "curiosity_005", text: "¿Qué te ilusiona hoy?", category: "curiosity", tone: "curious", energy: "low", length: "short", repeatAfterDays: 30 },
  { id: "curiosity_006", text: "¿Qué necesitas hoy que nadie te ha preguntado?", category: "curiosity", tone: "curious", energy: "low", length: "medium", repeatAfterDays: 30 },
  { id: "curiosity_007", text: "¿Cómo te gustaría sentirte al terminar el día?", category: "curiosity", tone: "curious", energy: "low", length: "medium", repeatAfterDays: 30 },
  { id: "curiosity_008", text: "¿Hay algo que llevas un tiempo queriendo decir?", category: "curiosity", tone: "curious", energy: "low", length: "medium", repeatAfterDays: 30 },
  { id: "curiosity_009", text: "¿Qué parte de hoy no quieres apurar?", category: "curiosity", tone: "curious", energy: "low", length: "medium", repeatAfterDays: 30 },
];

export const IDENTITY_PHRASES: EditorialPhrase[] = [
  { id: "identity_001", text: "No estoy aquí para cambiarte. Estoy aquí para verte.", category: "identity", tone: "grounded", energy: "low", length: "medium", repeatAfterDays: 30 },
  { id: "identity_002", text: "No mido tus días. Los acompaño.", category: "identity", tone: "grounded", energy: "low", length: "short", repeatAfterDays: 30 },
  { id: "identity_003", text: "Tu historia no necesita apuro para ser importante.", category: "identity", tone: "grounded", energy: "low", length: "medium", repeatAfterDays: 30 },
  { id: "identity_004", text: "Acompañar bien a veces solo significa quedarse.", category: "identity", tone: "quiet", energy: "low", length: "short", repeatAfterDays: 30 },
];

export const MORNING_PHRASES: EditorialPhrase[] = [
  { id: "morning_001", text: "Buenos días. ¿Cómo amaneciste hoy?", category: "morning", tone: "warm", energy: "low", length: "short", repeatAfterDays: 30 },
  { id: "morning_002", text: "Me alegra volver a verte.", category: "morning", tone: "warm", energy: "low", length: "short", repeatAfterDays: 30 },
  { id: "morning_003", text: "Hoy comenzamos de nuevo.", category: "morning", tone: "calm", energy: "low", length: "short", repeatAfterDays: 30 },
  { id: "morning_004", text: "Un día más para seguir construyendo tu historia.", category: "morning", tone: "grounded", energy: "low", length: "medium", repeatAfterDays: 30 },
  { id: "morning_005", text: "Espero que hoy encuentres un momento para ti.", category: "morning", tone: "warm", energy: "low", length: "medium", repeatAfterDays: 30 },
  { id: "morning_006", text: "Estoy aquí cuando quieras empezar.", category: "morning", tone: "calm", energy: "low", length: "short", repeatAfterDays: 30 },
  { id: "morning_007", text: "No hace falta tener todo resuelto para comenzar.", category: "morning", tone: "calm", energy: "low", length: "medium", repeatAfterDays: 30 },
  { id: "morning_008", text: "Ojalá hoy encuentres algo que te haga sonreír.", category: "morning", tone: "warm", energy: "low", length: "medium", repeatAfterDays: 30 },
  { id: "morning_009", text: "Cada día tiene algo que enseñarnos.", category: "morning", tone: "grounded", energy: "low", length: "short", repeatAfterDays: 30 },
  { id: "morning_010", text: "Vamos paso a paso.", category: "morning", tone: "calm", energy: "low", length: "short", repeatAfterDays: 30 },
  { id: "morning_011", text: "Buenos días. Empecemos con calma.", category: "morning", tone: "calm", energy: "low", length: "short", repeatAfterDays: 30 },
  { id: "morning_012", text: "Aquí estoy, como todas las mañanas.", category: "morning", tone: "calm", energy: "low", length: "short", repeatAfterDays: 30 },
  { id: "morning_013", text: "Otra mañana. Me alegra compartirla contigo.", category: "morning", tone: "warm", energy: "low", length: "short", repeatAfterDays: 30 },
  { id: "morning_014", text: "No hace falta saber cómo terminará el día para empezarlo.", category: "morning", tone: "calm", energy: "low", length: "medium", repeatAfterDays: 30 },
];

export const NIGHT_PHRASES: EditorialPhrase[] = [
  { id: "night_001", text: "Gracias por compartir otro día conmigo.", category: "night", tone: "warm", energy: "low", length: "short", repeatAfterDays: 30 },
  { id: "night_002", text: "Ojalá puedas descansar bien esta noche.", category: "night", tone: "warm", energy: "low", length: "short", repeatAfterDays: 30 },
  { id: "night_003", text: "Todo día merece un cierre tranquilo.", category: "night", tone: "calm", energy: "low", length: "short", repeatAfterDays: 30 },
  { id: "night_004", text: "Mañana tendremos otra oportunidad.", category: "night", tone: "calm", energy: "low", length: "short", repeatAfterDays: 30 },
  { id: "night_005", text: "Descansa. Yo seguiré aquí.", category: "night", tone: "quiet", energy: "low", length: "short", repeatAfterDays: 30 },
  { id: "night_006", text: "El día ya hizo su parte. Ahora toca soltar.", category: "night", tone: "calm", energy: "low", length: "medium", repeatAfterDays: 30 },
  { id: "night_007", text: "No hace falta cerrar todos los pendientes para descansar.", category: "night", tone: "calm", energy: "low", length: "medium", repeatAfterDays: 30 },
  { id: "night_008", text: "Buenas noches. Aquí estará todo mañana.", category: "night", tone: "calm", energy: "low", length: "short", repeatAfterDays: 30 },
];

export const OBSERVATION_PHRASES: EditorialPhrase[] = [
  { id: "observation_001", text: "Hoy parece uno de esos días que empiezan despacio.", category: "observation", tone: "quiet", energy: "low", length: "medium", repeatAfterDays: 30 },
  { id: "observation_002", text: "El mundo ya empezó hace rato. Nosotros podemos empezar ahora.", category: "observation", tone: "grounded", energy: "low", length: "medium", repeatAfterDays: 30 },
  { id: "observation_003", text: "Hay mañanas que solo piden calma.", category: "observation", tone: "calm", energy: "low", length: "short", repeatAfterDays: 30 },
  { id: "observation_004", text: "Todo afuera se mueve. Aquí podemos ir más despacio.", category: "observation", tone: "calm", energy: "low", length: "medium", repeatAfterDays: 30 },
  { id: "observation_005", text: "Hay días que simplemente pasan despacio.", category: "observation", tone: "quiet", energy: "low", length: "short", repeatAfterDays: 30 },
  { id: "observation_006", text: "Se nota que hoy va más lento que otros días.", category: "observation", tone: "quiet", energy: "low", length: "medium", repeatAfterDays: 30 },
  { id: "observation_007", text: "Todo parece más quieto de lo normal hoy.", category: "observation", tone: "quiet", energy: "low", length: "medium", repeatAfterDays: 30 },
  { id: "observation_008", text: "Este momento no pide nada. Solo está pasando.", category: "observation", tone: "quiet", energy: "low", length: "medium", repeatAfterDays: 30 },
];

export const PROGRESS_PHRASES: EditorialPhrase[] = [
  { id: "progress_001", text: "Me gusta ver cómo has mantenido el rumbo.", category: "progress", tone: "warm", energy: "low", length: "medium", repeatAfterDays: 30 },
  { id: "progress_002", text: "Hay pequeñas victorias que vale la pena recordar.", category: "progress", tone: "warm", energy: "low", length: "medium", repeatAfterDays: 30 },
  { id: "progress_003", text: "Has sido constante estos días.", category: "progress", tone: "grounded", energy: "low", length: "short", repeatAfterDays: 30 },
  { id: "progress_004", text: "A veces el progreso es tan silencioso que pasa desapercibido.", category: "progress", tone: "quiet", energy: "low", length: "medium", repeatAfterDays: 30 },
  { id: "progress_005", text: "Lo que construyes hoy también contará mañana.", category: "progress", tone: "grounded", energy: "low", length: "medium", repeatAfterDays: 30 },
  { id: "progress_006", text: "Me alegra acompañarte en este proceso.", category: "progress", tone: "warm", energy: "low", length: "short", repeatAfterDays: 30 },
  { id: "progress_007", text: "Se nota el esfuerzo, aunque no siempre se diga.", category: "progress", tone: "warm", energy: "low", length: "medium", repeatAfterDays: 30 },
  { id: "progress_008", text: "Has sostenido más de lo que quizá recuerdas.", category: "progress", tone: "warm", energy: "low", length: "medium", repeatAfterDays: 30 },
  { id: "progress_009", text: "Sigues aquí. Eso ya dice mucho.", category: "progress", tone: "grounded", energy: "low", length: "short", repeatAfterDays: 30 },
];

export const REFLECTION_PHRASES: EditorialPhrase[] = [
  { id: "reflection_001", text: "La vida también ocurre entre los grandes momentos.", category: "reflection", tone: "grounded", energy: "low", length: "medium", repeatAfterDays: 30 },
  { id: "reflection_002", text: "No todo tiene que ser extraordinario para ser valioso.", category: "reflection", tone: "grounded", energy: "low", length: "medium", repeatAfterDays: 30 },
  { id: "reflection_003", text: "A veces avanzar también significa descansar.", category: "reflection", tone: "calm", energy: "low", length: "short", repeatAfterDays: 30 },
  { id: "reflection_004", text: "Hoy también cuenta.", category: "reflection", tone: "quiet", energy: "low", length: "short", repeatAfterDays: 30 },
  { id: "reflection_005", text: "Hay días para correr y días para observar.", category: "reflection", tone: "grounded", energy: "low", length: "medium", repeatAfterDays: 30 },
  { id: "reflection_006", text: "Lo importante no siempre hace ruido.", category: "reflection", tone: "quiet", energy: "low", length: "short", repeatAfterDays: 30 },
  { id: "reflection_007", text: "Todo proceso tiene un ritmo distinto.", category: "reflection", tone: "grounded", energy: "low", length: "short", repeatAfterDays: 30 },
  { id: "reflection_008", text: "La calma también es una forma de avanzar.", category: "reflection", tone: "calm", energy: "low", length: "medium", repeatAfterDays: 30 },
  { id: "reflection_009", text: "La vida no siempre necesita respuestas inmediatas.", category: "reflection", tone: "grounded", energy: "low", length: "medium", repeatAfterDays: 30 },
  { id: "reflection_010", text: "Quizá hoy sea un buen día para escucharte un poco más.", category: "reflection", tone: "warm", energy: "low", length: "medium", repeatAfterDays: 30 },
  { id: "reflection_011", text: "No hace falta entenderlo todo hoy.", category: "reflection", tone: "calm", energy: "low", length: "short", repeatAfterDays: 30 },
  { id: "reflection_012", text: "El silencio también dice algo.", category: "reflection", tone: "quiet", energy: "low", length: "short", repeatAfterDays: 30 },
  { id: "reflection_013", text: "Algunos días se viven mejor sin explicarlos.", category: "reflection", tone: "quiet", energy: "low", length: "medium", repeatAfterDays: 30 },
  { id: "reflection_014", text: "Qué curioso todo lo que puede cambiar un día cualquiera.", category: "reflection", tone: "curious", energy: "low", length: "medium", repeatAfterDays: 30 },
  { id: "reflection_015", text: "A veces olvidamos que hoy también será un recuerdo.", category: "reflection", tone: "grounded", energy: "low", length: "medium", repeatAfterDays: 30 },
  { id: "reflection_016", text: "No todos los días tienen que dejar una gran historia.", category: "reflection", tone: "calm", energy: "low", length: "medium", repeatAfterDays: 30 },
  { id: "reflection_017", text: "Ojalá hoy encuentres un momento que valga la pena recordar.", category: "reflection", tone: "warm", energy: "low", length: "medium", repeatAfterDays: 30 },
  { id: "reflection_018", text: "Hay belleza en los días tranquilos.", category: "reflection", tone: "quiet", energy: "low", length: "short", repeatAfterDays: 30 },
  { id: "reflection_019", text: "Nunca se sabe qué día vamos a recordar después.", category: "reflection", tone: "curious", energy: "low", length: "medium", repeatAfterDays: 30 },
  { id: "reflection_020", text: "Hay algo distinto en cada día, aunque se parezcan.", category: "reflection", tone: "quiet", energy: "low", length: "medium", repeatAfterDays: 30 },
  { id: "reflection_021", text: "El tiempo no avisa cuándo está pasando algo importante.", category: "reflection", tone: "grounded", energy: "low", length: "medium", repeatAfterDays: 30 },
  { id: "reflection_022", text: "Esto también es vivir, aunque no lo parezca.", category: "reflection", tone: "grounded", energy: "low", length: "medium", repeatAfterDays: 30 },
];

export const SILENCE_PHRASES: EditorialPhrase[] = [
  { id: "silence_001", text: "Me alegra verte. Nada más.", category: "silence", tone: "warm", energy: "low", length: "short", repeatAfterDays: 30 },
  { id: "silence_002", text: "Qué bueno coincidir otra vez.", category: "silence", tone: "warm", energy: "low", length: "short", repeatAfterDays: 30 },
  { id: "silence_003", text: "Aquí estoy.", category: "silence", tone: "quiet", energy: "low", length: "short", repeatAfterDays: 30 },
  { id: "silence_004", text: "Bienvenido.", category: "silence", tone: "warm", energy: "low", length: "short", repeatAfterDays: 30 },
  { id: "silence_005", text: "Qué bueno encontrarnos otra vez.", category: "silence", tone: "warm", energy: "low", length: "short", repeatAfterDays: 30 },
  { id: "silence_006", text: "Me alegra compartir este momento contigo.", category: "silence", tone: "warm", energy: "low", length: "short", repeatAfterDays: 30 },
];

export const WELCOME_BACK_PHRASES: EditorialPhrase[] = [
  { id: "welcome_back_001", text: "Me alegra volver a encontrarte.", category: "welcome_back", tone: "warm", energy: "low", length: "short", repeatAfterDays: 30 },
  { id: "welcome_back_002", text: "Han pasado algunos días. ¿Cómo te ha tratado la vida?", category: "welcome_back", tone: "warm", energy: "low", length: "medium", repeatAfterDays: 30 },
  { id: "welcome_back_003", text: "Me preguntaba cómo ibas.", category: "welcome_back", tone: "warm", energy: "low", length: "short", repeatAfterDays: 30 },
  { id: "welcome_back_004", text: "No importa cuánto tiempo pase, siempre podemos retomar.", category: "welcome_back", tone: "grounded", energy: "low", length: "medium", repeatAfterDays: 30 },
  { id: "welcome_back_005", text: "Bienvenido de nuevo.", category: "welcome_back", tone: "warm", energy: "low", length: "short", repeatAfterDays: 30 },
  { id: "welcome_back_006", text: "No hace falta ponerte al día de golpe.", category: "welcome_back", tone: "calm", energy: "low", length: "medium", repeatAfterDays: 30 },
  { id: "welcome_back_007", text: "Aquí sigo, justo donde me dejaste.", category: "welcome_back", tone: "grounded", energy: "low", length: "short", repeatAfterDays: 30 },
  { id: "welcome_back_008", text: "El tiempo nunca pasa igual para todos. Bienvenido, cuando sea.", category: "welcome_back", tone: "warm", energy: "low", length: "medium", repeatAfterDays: 30 },
  { id: "welcome_back_009", text: "Cuánto tiempo. Qué bueno tenerte de vuelta.", category: "welcome_back", tone: "warm", energy: "low", length: "short", repeatAfterDays: 30 },
];

export const ALL_EDITORIAL_PHRASES: EditorialPhrase[] = [
  ...BUSY_DAY_PHRASES,
  ...CELEBRATION_PHRASES,
  ...CURIOSITY_PHRASES,
  ...IDENTITY_PHRASES,
  ...MORNING_PHRASES,
  ...NIGHT_PHRASES,
  ...OBSERVATION_PHRASES,
  ...PROGRESS_PHRASES,
  ...REFLECTION_PHRASES,
  ...SILENCE_PHRASES,
  ...WELCOME_BACK_PHRASES,
];
