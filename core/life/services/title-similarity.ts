/**
 * Deduplicación por título — heurística deliberadamente simple, no
 * retrieval semántico (`MEMORY_MODEL.md`: la mitad semántica de Memoria
 * tampoco existe todavía). Usada por `find-or-create-*` para evitar que
 * mencionar el mismo Goal/Project/Habit en conversaciones distintas
 * produzca filas duplicadas. Conocida limitación: no detecta
 * parafraseos ("correr una maratón" vs. "prepararme para los 42km").
 */
export function titlesLikelyMatch(a: string, b: string): boolean {
  const normalizedA = a.trim().toLowerCase();
  const normalizedB = b.trim().toLowerCase();

  if (!normalizedA || !normalizedB) return false;

  return (
    normalizedA === normalizedB ||
    normalizedA.includes(normalizedB) ||
    normalizedB.includes(normalizedA)
  );
}
