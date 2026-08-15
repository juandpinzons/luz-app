/**
 * Determinista, mismo criterio que `isAggregationQuery`
 * (`detect-aggregation-intent.ts`) y `UNDERSTANDING_SIGNALS` --
 * coincidencia de palabra clave, nunca una llamada a IA solo para
 * clasificar esto. Dos listas, no una: "genera algo" solo o "una
 * imagen de mi semana" (sin pedir generarla) no deberían disparar
 * generación de imagen real -- se exige un verbo de creación Y un
 * sustantivo de imagen en el mismo mensaje.
 */
const ACTION_VERBS: readonly string[] = [
  "genera",
  "generame",
  "génera",
  "génerame",
  "generar",
  "crea",
  "créame",
  "creame",
  "crear",
  "dibuja",
  "dibújame",
  "dibujame",
  "dibujar",
  "haz",
  "hazme",
  "pinta",
  "píntame",
  "pintame",
  "ilustra",
  "ilústrame",
  "ilustrame",
  "muéstrame",
  "muestrame",
  "create",
  "generate",
  "draw",
  "make me",
  "paint",
  "illustrate",
  "show me",
];

const IMAGE_NOUNS: readonly string[] = [
  "imagen",
  "foto",
  "fotografía",
  "fotografia",
  "dibujo",
  "ilustración",
  "ilustracion",
  "pintura",
  "cuadro",
  "image",
  "picture",
  "photo",
  "drawing",
  "illustration",
  "painting",
];

/** Extrae "lo que hay que dibujar" del texto después del sustantivo de imagen -- "de"/"del"/"sobre"/"of", si está. */
const SUBJECT_PATTERN =
  /\b(?:imagen|foto|fotograf[ií]a|dibujo|ilustraci[oó]n|pintura|cuadro|image|picture|photo|drawing|illustration|painting)\b\s*(?:de|del|de la|de un|de una|sobre|of)?\s*(.+)/i;

/**
 * `null` si el mensaje no pide generar una imagen. Si la pide, devuelve
 * el prompt a usar -- el texto después del sustantivo de imagen
 * ("genera una imagen de **un gato astronauta**" -> "un gato
 * astronauta"), o el mensaje completo si esa extracción no deja nada
 * usable ("hazme un dibujo" sin más -- mejor pasar el mensaje entero
 * que un prompt vacío al proveedor real).
 */
export function detectImageGenerationRequest(message: string): string | null {
  const lower = message.toLowerCase();

  const hasVerb = ACTION_VERBS.some((verb) => lower.includes(verb));
  const hasNoun = IMAGE_NOUNS.some((noun) => lower.includes(noun));
  if (!hasVerb || !hasNoun) return null;

  const match = message.match(SUBJECT_PATTERN);
  const extracted = match?.[1]?.trim().replace(/[.?!]+$/, "");

  return extracted && extracted.length > 0 ? extracted : message.trim();
}
