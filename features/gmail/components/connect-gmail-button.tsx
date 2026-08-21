"use client";

import { App } from "@capacitor/app";
import { Browser } from "@capacitor/browser";
import { Capacitor } from "@capacitor/core";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useIsNative } from "@/features/native/use-is-native";

const DEFAULT_CLASSNAME =
  "mt-8 inline-block rounded-full bg-white px-8 py-3 font-medium text-black transition hover:bg-zinc-200 disabled:opacity-60";

interface ConnectGmailButtonProps {
  /** "Conectar Gmail" (primer connect) o "Reconectar" (token expirado, `needsReauth` en `app/gmail/page.tsx`) -- mismo componente, mismo bloqueo nativo en ambos casos. */
  label?: string;
  className?: string;
}

/**
 * Google bloquea el consentimiento OAuth dentro de un WKWebView
 * embebido ("disallowed_useragent") -- mismo motivo exacto que
 * `GoogleSignInButton` (login nativo), que este componente mirror-ea a
 * propósito: dentro de la app, el consentimiento de Gmail corre en el
 * navegador de sistema (`Browser.open()`), nunca en la WebView propia.
 *
 * A diferencia del login, conectar Gmail es una acción SECUNDARIA de
 * alguien ya autenticado -- por eso hay un paso previo real
 * (`/api/gmail/native/start`, dentro de la WebView, todavía con la
 * cookie de sesión) antes de abrir el navegador de sistema. Ver
 * docblock de `GMAIL_NATIVE_USER_COOKIE`
 * (`app/api/gmail/shared.ts`) para el resto del puente.
 *
 * El listener de `appUrlOpen` de acá SOLO actúa si el Universal Link
 * trae `purpose=gmail_connect` -- un link de login u otro futuro
 * propósito compartiendo `/mobile/bridge` no debe disparar esto.
 * `web` (fuera de la app) sigue siendo el `<Link>` de siempre, sin
 * ningún cambio.
 */
export function ConnectGmailButton({
  label = "Conectar Gmail",
  className = DEFAULT_CLASSNAME,
}: ConnectGmailButtonProps = {}) {
  const isNative = useIsNative();
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) {
      return;
    }

    const listenerPromise = App.addListener("appUrlOpen", ({ url }) => {
      let parsed: URL;
      try {
        parsed = new URL(url);
      } catch {
        return;
      }
      if (parsed.searchParams.get("purpose") !== "gmail_connect") {
        return;
      }

      Browser.close().catch(() => {
        // El navegador de sistema puede ya estar cerrándose por su cuenta -- nunca bloquear por esto.
      });

      // A diferencia del login, no hay ningún código que consumir acá --
      // para cuando este link se abre, los tokens de Gmail ya quedaron
      // guardados en el servidor (`callback/route.ts`). Esto es pura
      // navegación de regreso, dentro de la misma WebView cuya sesión
      // nunca se tocó.
      const status = parsed.searchParams.get("status");
      window.location.href =
        status === "error" ? `/gmail?error=${parsed.searchParams.get("reason") ?? "connect_failed"}` : "/gmail";
    });

    const resumeListenerPromise = App.addListener("appStateChange", ({ isActive }) => {
      if (isActive) setIsConnecting(false);
    });

    return () => {
      listenerPromise.then((handle) => handle.remove());
      resumeListenerPromise.then((handle) => handle.remove());
    };
  }, []);

  async function handleNativeConnect() {
    setIsConnecting(true);
    setError(null);
    try {
      const response = await fetch("/api/gmail/native/start", { method: "POST" });
      if (!response.ok) {
        throw new Error(`native/start devolvió ${response.status}`);
      }
      const { exchangeCode } = (await response.json()) as { exchangeCode: string };
      await Browser.open({
        url: new URL(`/api/gmail/connect?exchangeCode=${exchangeCode}`, window.location.origin).toString(),
      });
    } catch {
      setIsConnecting(false);
      setError("No pudimos iniciar la conexión con Gmail. Intenta de nuevo.");
    }
  }

  if (isNative) {
    return (
      <>
        <button type="button" onClick={handleNativeConnect} disabled={isConnecting} className={className}>
          {isConnecting ? "Conectando…" : label}
        </button>
        {error && <p className="mt-4 text-sm text-red-400">{error}</p>}
      </>
    );
  }

  return (
    <Link href="/api/gmail/connect" className={className}>
      {label}
    </Link>
  );
}
