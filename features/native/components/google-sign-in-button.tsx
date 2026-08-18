"use client";

import { App } from "@capacitor/app";
import { Browser } from "@capacitor/browser";
import { Capacitor } from "@capacitor/core";
import { useEffect, useState } from "react";
import { SubmitButton } from "@/components/ui/submit-button";
import { useIsNative } from "@/features/native/use-is-native";

const BUTTON_CLASSNAME =
  "rounded-full bg-white px-8 py-3 font-medium text-black transition hover:bg-zinc-200 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-luz disabled:opacity-60";

interface GoogleSignInButtonProps {
  /** El mismo Server Action que ya usaba `app/login/page.tsx` -- se sigue usando tal cual fuera de la app nativa, ningún cambio al login web. */
  webSignInAction: () => Promise<void>;
}

/**
 * Google bloquea el consentimiento OAuth dentro de un WKWebView
 * embebido (política "disallowed_useragent") -- dentro de la app
 * nativa, el login corre en el navegador de sistema (`Browser.open()`,
 * `ASWebAuthenticationSession` por debajo en iOS), NUNCA en la WebView
 * propia de la app. Ver `app/api/mobile-auth/{start,callback,consume}/route.ts`
 * para el resto del puente completo -- este componente es solo el
 * disparador y el receptor del Universal Link de vuelta.
 *
 * `useIsNative()` resuelve a `false` en el servidor (nunca puede saber
 * si esto se va a renderizar dentro de Capacitor) y al valor real tras
 * hidratar, sin mismatch -- ver ese hook para el porqué de
 * `useSyncExternalStore` en vez de `useState`+`useEffect`.
 */
export function GoogleSignInButton({ webSignInAction }: GoogleSignInButtonProps) {
  const isNative = useIsNative();
  const [isConnecting, setIsConnecting] = useState(false);

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) {
      return;
    }

    // El Universal Link de vuelta (`/mobile/bridge?exchange_code=...`,
    // `app/mobile/bridge/page.tsx`) -- en el camino feliz, iOS lo
    // entrega acá ANTES de que el navegador de sistema llegue a
    // renderizarlo. La WebView PROPIA de la app navega de verdad a
    // `/consume` (nunca un `fetch` en segundo plano) para que el
    // `Set-Cookie` real de sesión se persista en su propio cookie jar.
    const listenerPromise = App.addListener("appUrlOpen", ({ url }) => {
      let exchangeCode: string | null = null;
      try {
        exchangeCode = new URL(url).searchParams.get("exchange_code");
      } catch {
        return;
      }
      if (!exchangeCode) return;

      Browser.close().catch(() => {
        // El navegador de sistema puede ya estar cerrándose por su cuenta -- nunca bloquear el login por esto.
      });
      window.location.href = `/api/mobile-auth/consume?exchange_code=${encodeURIComponent(exchangeCode)}`;
    });

    return () => {
      listenerPromise.then((handle) => handle.remove());
    };
  }, []);

  async function handleNativeSignIn() {
    setIsConnecting(true);
    await Browser.open({ url: new URL("/api/mobile-auth/start", window.location.origin).toString() });
  }

  if (isNative) {
    return (
      <button type="button" onClick={handleNativeSignIn} disabled={isConnecting} className={BUTTON_CLASSNAME}>
        {isConnecting ? "Conectando…" : "Continuar con Google"}
      </button>
    );
  }

  return (
    <form action={webSignInAction}>
      <SubmitButton pendingLabel="Conectando…" className={BUTTON_CLASSNAME}>
        Continuar con Google
      </SubmitButton>
    </form>
  );
}
