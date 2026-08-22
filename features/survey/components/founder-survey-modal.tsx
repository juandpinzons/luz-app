"use client";

import { useState } from "react";
import { FOUNDER_SURVEY_CONCEPTS, type FounderSurveyConcept } from "@/features/survey/founder-survey-2026-08-22";

const RATINGS = [1, 2, 3, 4, 5] as const;

/**
 * Encuesta puntual del Founder, un solo día (sábado 22 de agosto de
 * 2026) -- solo se monta cuando `AppShell` ya confirmó del lado del
 * servidor que es el día correcto Y que esta persona todavía no
 * respondió (`isFounderSurveyDay`/`hasRespondedToFounderSurvey`), así
 * que este componente nunca necesita repetir esa lógica: si está
 * montado, debe mostrarse.
 *
 * "Ahora no" solo oculta el modal en ESTA sesión de React (estado
 * local) -- no queda ninguna respuesta guardada, así que una
 * navegación nueva (o recargar la página) lo vuelve a mostrar mientras
 * siga siendo el día de la encuesta. A propósito: dos preguntas cortas
 * no ameritan un mecanismo de "recuérdame que dije que no".
 */
export function FounderSurveyModal() {
  const [dismissed, setDismissed] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [rating, setRating] = useState<number | null>(null);
  const [concepts, setConcepts] = useState<Set<FounderSurveyConcept>>(new Set());
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (dismissed || submitted) return null;

  function toggleConcept(concept: FounderSurveyConcept) {
    setConcepts((prev) => {
      const next = new Set(prev);
      if (next.has(concept)) {
        next.delete(concept);
      } else {
        next.add(concept);
      }
      return next;
    });
  }

  async function handleSubmit() {
    if (rating === null) return;
    setIsSubmitting(true);
    setError(null);

    try {
      const response = await fetch("/api/survey/founder-2026-08-22", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rating, concepts: Array.from(concepts) }),
      });
      if (!response.ok) {
        throw new Error("No se pudo enviar.");
      }
      setSubmitted(true);
    } catch {
      setError("No se pudo enviar. Intenta de nuevo.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 px-6 py-10">
      <div className="w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-950 p-6 text-white">
        <p className="text-sm font-light tracking-[0.25em] text-luz">LUZ</p>
        <h2 className="mt-3 text-xl font-light">Un momento -- dos preguntas rápidas</h2>

        <div className="mt-6">
          <p className="text-sm text-zinc-300">Del 1 al 5, ¿qué calificación le darías a LUZ?</p>
          <div className="mt-3 flex gap-2">
            {RATINGS.map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setRating(value)}
                aria-pressed={rating === value}
                className={
                  rating === value
                    ? "flex h-11 w-11 items-center justify-center rounded-full bg-luz text-black"
                    : "flex h-11 w-11 items-center justify-center rounded-full border border-zinc-700 text-zinc-300 transition hover:border-luz focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-luz"
                }
              >
                {value}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-6">
          <p className="text-sm text-zinc-300">
            Si tuvieras que definir LUZ en uno de los siguientes conceptos (puedes elegir varios):
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {FOUNDER_SURVEY_CONCEPTS.map((concept) => {
              const isSelected = concepts.has(concept);
              return (
                <button
                  key={concept}
                  type="button"
                  onClick={() => toggleConcept(concept)}
                  aria-pressed={isSelected}
                  className={
                    isSelected
                      ? "rounded-full bg-luz px-3 py-1.5 text-sm text-black"
                      : "rounded-full border border-zinc-700 px-3 py-1.5 text-sm text-zinc-300 transition hover:border-luz focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-luz"
                  }
                >
                  {concept}
                </button>
              );
            })}
          </div>
        </div>

        {error && <p className="mt-4 text-sm text-red-400">{error}</p>}

        <div className="mt-8 flex items-center justify-between">
          <button
            type="button"
            onClick={() => setDismissed(true)}
            className="text-sm text-zinc-500 transition hover:text-zinc-300 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-luz"
          >
            Ahora no
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={rating === null || isSubmitting}
            className="rounded-full bg-white px-6 py-2.5 font-medium text-black transition hover:bg-zinc-200 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-luz disabled:opacity-40"
          >
            {isSubmitting ? "Enviando…" : "Enviar"}
          </button>
        </div>
      </div>
    </div>
  );
}
