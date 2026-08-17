"use client";

import { useState } from "react";

const MAILTO_HREF = "mailto:hola@joinluz.com?subject=Conectar%20mi%20Garmin";

/**
 * Consentimiento real antes del flujo manual de Garmin (auditoría de
 * privacidad, 2026-08-17) -- antes de esto, `/garmin` era un `mailto:`
 * directo, sin ningún paso de consentimiento. El checkbox debe estar
 * marcado para habilitar el enlace; al hacer click se registra el
 * consentimiento (`POST /api/wearable/consent`) ANTES de abrir el
 * cliente de correo -- si el registro falla, el enlace de todos modos
 * se sigue (no bloquea a la persona por un error nuestro), pero el
 * intento de registrar queda logueado del lado del servidor.
 */
export function GarminConsentGate() {
  const [acknowledged, setAcknowledged] = useState(false);
  const [recording, setRecording] = useState(false);

  async function handleClick() {
    setRecording(true);
    try {
      await fetch("/api/wearable/consent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider: "garmin" }),
      });
    } catch {
      // Ver docblock -- no bloquea el flujo de correo por un error de red.
    } finally {
      setRecording(false);
    }
  }

  return (
    <div className="mt-8 flex flex-col items-center gap-4">
      <label className="flex max-w-sm items-start gap-3 text-left text-sm text-zinc-400">
        <input
          type="checkbox"
          checked={acknowledged}
          onChange={(e) => setAcknowledged(e.target.checked)}
          className="mt-1 h-4 w-4 shrink-0 accent-white"
        />
        <span>
          Entiendo que voy a compartir datos de salud (pasos, sueño, frecuencia
          cardíaca, estrés) enviándolos por correo a un miembro del equipo de
          LUZ, quien los importa manualmente -- no es una conexión automática
          ni cifrada en tránsito por ese canal.
        </span>
      </label>
      <a
        href={acknowledged ? MAILTO_HREF : undefined}
        onClick={acknowledged ? handleClick : (e) => e.preventDefault()}
        aria-disabled={!acknowledged}
        className={
          acknowledged
            ? "inline-block rounded-full bg-white px-8 py-3 font-medium text-black transition hover:bg-zinc-200"
            : "inline-block cursor-not-allowed rounded-full bg-zinc-800 px-8 py-3 font-medium text-zinc-500"
        }
      >
        {recording ? "Registrando..." : "Conectar Garmin"}
      </a>
    </div>
  );
}
