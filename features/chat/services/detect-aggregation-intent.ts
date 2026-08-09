const AGGREGATION_SIGNALS: readonly string[] = [
  "en total",
  "cuánto he",
  "cuánto llevo",
  "cuánto voy",
  "cuántas veces",
  "cuántos",
  "cuántas",
  "todos mis",
  "todas mis",
  "un resumen",
  "resúmeme",
  "resume",
  "resumir",
  "sumar",
  "sumatoria",
  "acumulado",
  "en promedio",
  "how much have i",
  "how many times",
  "sum up",
  "summarize",
  "add up",
  "all my",
  "in total",
  "on average",
];

/**
 * War Room 2026-08-09 (P1-7/P1-8, ALPHA_BACKLOG.md): "cuánto he
 * gastado" no comparte ningún token con "gasté 30.000 en Uber" -- una
 * pregunta de agregación compite en desventaja contra memorias sin
 * relación pero con mayor rank_score, y el tope de 5 memorias por
 * turno nunca alcanza para sumar varias menciones reales. Esta función
 * solo detecta la intención; `select-contextual-memories.ts` decide
 * qué hacer con eso. Determinista, mismo criterio que
 * `UNDERSTANDING_SIGNALS`/`TYPE_SIGNALS` -- coincidencia de palabra
 * clave, no NLP, nunca una llamada a IA solo para clasificar esto.
 */
export function isAggregationQuery(message: string): boolean {
  const normalized = message.toLowerCase();
  return AGGREGATION_SIGNALS.some((signal) => normalized.includes(signal));
}
