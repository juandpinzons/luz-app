"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export function MfaSetupForm() {
  const router = useRouter();
  const [secret, setSecret] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetch("/api/admin/mfa/enroll", { method: "POST" })
      .then((r) => r.json())
      .then((data) => {
        if (data.secret) setSecret(data.secret);
        else setError(data.error ?? "No se pudo generar el secreto.");
      })
      .catch(() => setError("No se pudo generar el secreto."));
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const response = await fetch("/api/admin/mfa/verify-enrollment", {
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

  if (!secret) {
    return <p className="mt-6 text-sm text-zinc-500">{error ?? "Generando secreto..."}</p>;
  }

  return (
    <form onSubmit={handleSubmit} className="mt-6 space-y-4">
      <div>
        <p className="text-xs text-zinc-500">
          Agrega esta clave manualmente en tu app de autenticación (tipo: &ldquo;basada en tiempo&rdquo;):
        </p>
        <p className="mt-2 break-all rounded-lg border border-zinc-800 bg-zinc-950 px-4 py-3 font-mono text-sm text-white">
          {secret}
        </p>
      </div>
      <div>
        <label className="text-xs text-zinc-500" htmlFor="mfa-code">
          Código de 6 dígitos que muestra la app ahora mismo
        </label>
        <input
          id="mfa-code"
          type="text"
          inputMode="numeric"
          maxLength={6}
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
          className="mt-1 w-full rounded-lg border border-zinc-800 bg-zinc-950 px-4 py-3 text-center font-mono text-lg tracking-widest text-white"
          placeholder="000000"
        />
      </div>
      {error && <p className="text-sm text-red-400">{error}</p>}
      <button
        type="submit"
        disabled={code.length !== 6 || submitting}
        className="w-full rounded-lg bg-white px-4 py-3 font-medium text-black disabled:cursor-not-allowed disabled:opacity-40"
      >
        {submitting ? "Verificando..." : "Confirmar y activar"}
      </button>
    </form>
  );
}
