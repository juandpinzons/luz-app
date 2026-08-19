"use client";

import { SignInWithApple } from "@capacitor-community/apple-sign-in";
import { useState } from "react";
import { useIsNative } from "@/features/native/use-is-native";

/**
 * Debe ser IDÉNTICO a `appId` en `native/capacitor.config.ts` y a
 * `APPLE_APP_BUNDLE_ID` en `core/apple-auth/verify-identity-token.ts`.
 */
const APPLE_APP_BUNDLE_ID = "com.joinluz.app";

const BUTTON_CLASSNAME =
  "rounded-full border border-zinc-700 bg-black px-8 py-3 font-medium text-white transition hover:bg-zinc-900 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-luz disabled:opacity-60";

/**
 * Guideline 4.8 de Apple exige Sign in with Apple en cualquier app que
 * ofrezca login con otro proveedor social (Google, ver
 * `google-sign-in-button.tsx`) -- solo aplica al binario que se somete
 * a revisión, nunca al sitio web (que no pasa por App Store Review),
 * así que este componente SOLO renderiza dentro de la app nativa
 * (`useIsNative()`), sin equivalente web -- a diferencia de
 * `GoogleSignInButton`, que sí tiene una rama para el navegador normal.
 *
 * Arquitectura MÁS SIMPLE que el puente de Google
 * (`app/api/mobile-auth/{start,callback}/route.ts`): no hay navegador
 * de sistema ni Universal Link de por medio. `ASAuthorizationAppleIDProvider`
 * (`@capacitor-community/apple-sign-in`, ver `Plugin.swift` del paquete
 * -- `clientId`/`redirectURI` ahí son requeridos por el tipo pero
 * IGNORADOS del todo en iOS nativo, solo importan para el fallback
 * web que esta app nunca usa) autentica con Apple directo en el
 * dispositivo (Face ID/Touch ID/contraseña de Apple ID, una hoja modal
 * dentro de la MISMA app, nunca otra app) y entrega el resultado
 * directo en JS -- todo el flujo es una sola llamada async, sin
 * escuchar ningún evento de regreso.
 *
 * `POST /api/apple-auth/callback` verifica el `identityToken` (JWT
 * firmado por Apple) y devuelve un código de intercambio; el paso
 * final reutiliza el MISMO `/api/mobile-auth/consume` que ya usa
 * Google -- agnóstico de proveedor desde siempre.
 */
export function AppleSignInButton() {
  const isNative = useIsNative();
  const [isConnecting, setIsConnecting] = useState(false);

  if (!isNative) return null;

  async function handleAppleSignIn() {
    setIsConnecting(true);
    try {
      const { response } = await SignInWithApple.authorize({
        clientId: APPLE_APP_BUNDLE_ID,
        redirectURI: new URL("/mobile/bridge", window.location.origin).toString(),
        scopes: "email name",
      });

      const callbackResponse = await fetch("/api/apple-auth/callback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          identityToken: response.identityToken,
          givenName: response.givenName ?? undefined,
          familyName: response.familyName ?? undefined,
        }),
      });

      if (!callbackResponse.ok) {
        throw new Error("El servidor no pudo verificar el inicio de sesión con Apple.");
      }

      const { exchangeCode } = (await callbackResponse.json()) as { exchangeCode: string };
      // Navegación real, nunca en segundo plano -- mismo motivo que
      // `google-sign-in-button.tsx`: solo una navegación real persiste
      // el `Set-Cookie` de sesión en el cookie jar de la WebView.
      window.location.href = `/api/mobile-auth/consume?exchange_code=${encodeURIComponent(exchangeCode)}`;
    } catch {
      // Cubre tanto "la persona canceló la hoja de Apple" (rechazo
      // nativo normal, nunca un error real) como cualquier fallo real
      // -- mismo criterio silencioso que `GoogleSignInButton`, nunca
      // deja el botón atascado.
      setIsConnecting(false);
    }
  }

  return (
    <button type="button" onClick={handleAppleSignIn} disabled={isConnecting} className={BUTTON_CLASSNAME}>
      {isConnecting ? "Conectando…" : "Continuar con Apple"}
    </button>
  );
}
