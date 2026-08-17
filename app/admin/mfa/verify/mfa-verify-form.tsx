"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function MfaVerifyForm() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const response = await fetch("/api/admin/mfa/challenge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.error ?? "Código incorrecto.");
        return;
      }
      router.push("/admin");
      router.refresh();
    } catch {
      setError("Error de red -- intenta de nuevo.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mt-6 space-y-4">
      <input
        type="text"
        inputMode="numeric"
        maxLength={6}
        autoFocus
        value={code}
        onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
        className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-4 py-3 text-center font-mono text-lg tracking-widest text-white"
        placeholder="000000"
      />
      {error && <p className="text-sm text-red-400">{error}</p>}
      <button
        type="submit"
        disabled={code.length !== 6 || submitting}
        className="w-full rounded-lg bg-white px-4 py-3 font-medium text-black disabled:cursor-not-allowed disabled:opacity-40"
      >
        {submitting ? "Verificando..." : "Continuar"}
      </button>
    </form>
  );
}
