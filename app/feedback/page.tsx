"use client";

import Link from "next/link";
import { useState } from "react";
import type { SubmitFeedbackResponse } from "@/features/feedback/types";

type RemembersMe = "yes" | "no" | "unsure";
type ResponseLength = "too_long" | "just_right" | "too_short";

const HELPFULNESS_SCALE = [1, 2, 3, 4, 5] as const;

const REMEMBERS_ME_OPTIONS: { value: RemembersMe; label: string }[] = [
  { value: "yes", label: "Sí" },
  { value: "no", label: "No" },
  { value: "unsure", label: "Aún no sé" },
];

/** Opcional a propósito, a diferencia de `helpfulness`/`remembersMe` -- ver RESPONSE_READING_GUIDELINES_V1.md, cierre. */
const RESPONSE_LENGTH_OPTIONS: { value: ResponseLength; label: string }[] = [
  { value: "too_long", label: "Muy larga" },
  { value: "just_right", label: "Justa" },
  { value: "too_short", label: "Muy corta" },
];

export default function FeedbackPage() {
  const [helpfulness, setHelpfulness] = useState<number | null>(null);
  const [remembersMe, setRemembersMe] = useState<RemembersMe | null>(null);
  const [responseLength, setResponseLength] = useState<ResponseLength | null>(null);
  const [comment, setComment] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  const canSubmit = helpfulness !== null && remembersMe !== null && !isSubmitting;

  async function handleSubmit() {
    if (!canSubmit || helpfulness === null || remembersMe === null) return;

    setIsSubmitting(true);
    setError(null);

    try {
      const response = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          helpfulness,
          remembersMe,
          responseLength: responseLength ?? undefined,
          comment: comment.trim() || undefined,
        }),
      });

      if (!response.ok) {
        throw new Error("No se pudo enviar tu feedback.");
      }

      const data: SubmitFeedbackResponse = await response.json();
      if (!data.id) {
        throw new Error("No se pudo enviar tu feedback.");
      }

      setSubmitted(true);
    } catch {
      setError("Algo falló al enviar. ¿Intentamos de nuevo?");
    } finally {
      setIsSubmitting(false);
    }
  }

  if (submitted) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center bg-black px-6 text-center text-white">
        <p className="text-2xl font-light">Gracias por contármelo.</p>
        <p className="mt-3 text-zinc-400">
          Esto me ayuda a acompañarte mejor.
        </p>
        <Link
          href="/chat"
          className="mt-10 inline-block rounded-full bg-white px-8 py-3 font-medium text-black transition hover:bg-zinc-200"
        >
          Volver a la conversación
        </Link>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen flex-col items-center bg-black px-6 py-16 text-white">
      <div className="w-full max-w-lg">
        <p className="text-2xl font-light">¿Cómo vamos?</p>
        <p className="mt-2 text-zinc-400">
          Esto es opcional y toma un minuto — me ayuda a acompañarte mejor.
        </p>

        <div className="mt-10">
          <p className="text-sm text-zinc-300">
            ¿Qué tan útil he sido esta semana?
          </p>
          <div className="mt-3 flex gap-2">
            {HELPFULNESS_SCALE.map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setHelpfulness(value)}
                aria-pressed={helpfulness === value}
                className={
                  helpfulness === value
                    ? "flex h-11 w-11 items-center justify-center rounded-full bg-white font-medium text-black"
                    : "flex h-11 w-11 items-center justify-center rounded-full ring-1 ring-zinc-700 text-zinc-300 transition hover:ring-zinc-500"
                }
              >
                {value}
              </button>
            ))}
          </div>
          <div className="mt-2 flex justify-between text-xs text-zinc-500">
            <span>Nada útil</span>
            <span>Muy útil</span>
          </div>
        </div>

        <div className="mt-10">
          <p className="text-sm text-zinc-300">
            ¿Sientes que te recuerdo con el tiempo?
          </p>
          <div className="mt-3 flex gap-2">
            {REMEMBERS_ME_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setRemembersMe(option.value)}
                aria-pressed={remembersMe === option.value}
                className={
                  remembersMe === option.value
                    ? "rounded-full bg-white px-5 py-2 font-medium text-black"
                    : "rounded-full px-5 py-2 ring-1 ring-zinc-700 text-zinc-300 transition hover:ring-zinc-500"
                }
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-10">
          <p className="text-sm text-zinc-300">
            ¿Cómo se sintió la extensión de mis respuestas? (opcional)
          </p>
          <div className="mt-3 flex gap-2">
            {RESPONSE_LENGTH_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() =>
                  setResponseLength((prev) => (prev === option.value ? null : option.value))
                }
                aria-pressed={responseLength === option.value}
                className={
                  responseLength === option.value
                    ? "rounded-full bg-white px-5 py-2 font-medium text-black"
                    : "rounded-full px-5 py-2 ring-1 ring-zinc-700 text-zinc-300 transition hover:ring-zinc-500"
                }
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-10">
          <label htmlFor="feedback-comment" className="text-sm text-zinc-300">
            ¿Qué te gustaría que hiciera diferente? (opcional)
          </label>
          <textarea
            id="feedback-comment"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Cuéntame con confianza…"
            rows={4}
            maxLength={2000}
            className="mt-3 w-full resize-none rounded-xl bg-zinc-900 px-5 py-4 outline-none ring-1 ring-zinc-800 focus:ring-white"
          />
        </div>

        {error && <p className="mt-4 text-sm text-red-400">{error}</p>}

        <button
          type="button"
          onClick={handleSubmit}
          disabled={!canSubmit}
          className="mt-8 rounded-full bg-white px-8 py-3 font-medium text-black transition hover:bg-zinc-200 disabled:opacity-40 disabled:hover:bg-white"
        >
          {isSubmitting ? "Enviando…" : "Enviar"}
        </button>
      </div>
    </main>
  );
}
