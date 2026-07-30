"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

/**
 * Formulario de conexión de Apple Calendar -- mismo patrón que
 * `app/feedback/page.tsx` (cliente, `useState`, `fetch` a una ruta de
 * `app/api/`). Apple no ofrece OAuth para CalDAV: la persona genera
 * una contraseña específica de app en appleid.apple.com y la pega
 * aquí -- fricción real, documentada desde Calendar Foundation
 * (`features/reality/README.md`, "Autenticación de Apple"), no algo
 * que esta pantalla pueda evitar.
 *
 * La contraseña viaja solo hasta `/api/calendar/connect` (HTTPS) y
 * nunca se guarda en este componente más tiempo del necesario para el
 * request -- se cifra en el servidor antes de guardarse
 * (`core/security/secret-cipher.ts`).
 */
export default function ConnectCalendarPage() {
  const router = useRouter();
  const [appleId, setAppleId] = useState("");
  const [appSpecificPassword, setAppSpecificPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit = appleId.trim().length > 2 && appSpecificPassword.trim().length > 0 && !isSubmitting;

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!canSubmit) return;

    setIsSubmitting(true);
    setError(null);

    try {
      const response = await fetch("/api/calendar/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ appleId: appleId.trim(), appSpecificPassword: appSpecificPassword.trim() }),
      });

      const data: { ok?: boolean; error?: string } = await response.json();

      if (!response.ok || !data.ok) {
        throw new Error(data.error ?? "No se pudo conectar tu calendario.");
      }

      router.push("/calendar");
      router.refresh();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "No se pudo conectar tu calendario.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="flex min-h-screen flex-col items-center bg-black px-6 py-16 text-white">
      <div className="w-full max-w-md">
        <p className="text-2xl font-light">Conecta tu Apple Calendar</p>
        <p className="mt-2 text-zinc-400">
          LUZ necesita tu Apple ID y una contraseña específica de app -- Apple no ofrece otra forma de conectar
          calendarios (CalDAV) sin OAuth.
        </p>

        <ol className="mt-6 space-y-2 text-sm text-zinc-400">
          <li>1. Entra a appleid.apple.com e inicia sesión.</li>
          <li>2. En &quot;Inicio de sesión y seguridad&quot;, elige &quot;Contraseñas específicas de app&quot;.</li>
          <li>3. Genera una nueva, dale un nombre (p. ej. &quot;LUZ&quot;), y cópiala aquí.</li>
        </ol>

        <form className="mt-8 space-y-4" onSubmit={handleSubmit}>
          <div>
            <label htmlFor="appleId" className="text-sm text-zinc-300">
              Apple ID
            </label>
            <input
              id="appleId"
              type="email"
              autoComplete="username"
              value={appleId}
              onChange={(event) => setAppleId(event.target.value)}
              placeholder="tu-correo@icloud.com"
              className="mt-2 w-full rounded-lg bg-zinc-900 px-4 py-3 text-sm text-white outline-none ring-1 ring-zinc-800 placeholder:text-zinc-600 focus:ring-white focus-visible:ring-luz"
            />
          </div>

          <div>
            <label htmlFor="appSpecificPassword" className="text-sm text-zinc-300">
              Contraseña específica de app
            </label>
            <input
              id="appSpecificPassword"
              type="password"
              autoComplete="new-password"
              value={appSpecificPassword}
              onChange={(event) => setAppSpecificPassword(event.target.value)}
              placeholder="xxxx-xxxx-xxxx-xxxx"
              className="mt-2 w-full rounded-lg bg-zinc-900 px-4 py-3 text-sm text-white outline-none ring-1 ring-zinc-800 placeholder:text-zinc-600 focus:ring-white focus-visible:ring-luz"
            />
          </div>

          {error && <p className="text-sm text-red-400">{error}</p>}

          <button
            type="submit"
            disabled={!canSubmit}
            className="w-full rounded-full bg-white px-8 py-3 font-medium text-black transition hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {isSubmitting ? "Conectando..." : "Conectar calendario"}
          </button>
        </form>

        <Link href="/calendar" className="mt-8 inline-block text-sm text-zinc-500 hover:text-zinc-300">
          ← Volver
        </Link>
      </div>
    </main>
  );
}
