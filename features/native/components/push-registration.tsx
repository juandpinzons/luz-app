"use client";

import { Capacitor } from "@capacitor/core";
import { PushNotifications } from "@capacitor/push-notifications";
import { useEffect } from "react";

/**
 * Sin UI propia -- solo un efecto de montaje, montado una vez en
 * `components/app-shell.tsx` (corre en cada carga de una pantalla ya
 * autenticada: Hoy, Vida, Recuerdos, Conversación). Se llama tras el
 * login y en cada arranque en frío a propósito -- Apple puede rotar el
 * token en silencio, así que "ya lo registré una vez" nunca es
 * suficiente garantía (ver `app/api/push/register/route.ts`).
 *
 * **Límite real, documentado a propósito**: no hay forma confiable de
 * saber desde JS si este binario es un build de desarrollo/TestFlight
 * (APNs sandbox) o de App Store (APNs producción) -- Capacitor no
 * expone eso, y la arquitectura de "la WebView siempre carga la misma
 * URL remota" (ver `native/capacitor.config.ts`) significa que el
 * mismo bundle de JS sirve a los tres canales de distribución por
 * igual. Se asume `"production"` -- correcto para builds reales de App
 * Store, incorrecto para desarrollo/TestFlight hasta que exista un
 * plugin nativo chico que lea el perfil de aprovisionamiento (o una
 * bandera fijada a mano al crear el proyecto Xcode). No inventado como
 * si funcionara -- documentado como lo que realmente es.
 */
export function PushRegistration() {
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) {
      return;
    }

    let cancelled = false;

    async function register() {
      const permission = await PushNotifications.requestPermissions();
      if (permission.receive !== "granted" || cancelled) {
        return;
      }
      await PushNotifications.register();
    }

    const registrationListener = PushNotifications.addListener("registration", (token) => {
      fetch("/api/push/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          deviceToken: token.value,
          platform: "ios",
          environment: "production",
        }),
      }).catch(() => {
        // Un fallo de red al registrar el token no debe romper la
        // pantalla -- el próximo arranque en frío lo vuelve a intentar.
      });
    });

    register();

    return () => {
      cancelled = true;
      registrationListener.then((handle) => handle.remove());
    };
  }, []);

  return null;
}
