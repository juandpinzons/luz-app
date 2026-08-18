"use client";

import { Capacitor } from "@capacitor/core";
import { PushNotifications } from "@capacitor/push-notifications";
import { useEffect } from "react";

/**
 * Persistido a nivel de módulo (no de componente): cada sección tiene
 * su propio `layout.tsx` (`app/{dashboard,chat,life,memories}/layout.tsx`),
 * así que `AppShell` -- y este componente con él -- se desmonta y
 * vuelve a montar en CADA navegación entre Hoy/Vida/Recuerdos/
 * Conversación (a diferencia de `NativeShellSetup`, que vive en el
 * layout raíz y monta una sola vez). Sin este flag, pedir permiso +
 * registrar + hacer POST a `/api/push/register` se repetiría en cada
 * una de esas navegaciones -- inofensivo (todo es idempotente del lado
 * del servidor) pero puro desperdicio de red/DB en el camino más
 * transitado de la app. El módulo sobrevive mientras la WebView no
 * recargue del todo, que es exactamente el alcance que hace falta.
 */
let hasRegisteredThisSession = false;

/**
 * Sin UI propia -- solo un efecto de montaje. Se llama tras el login y
 * en cada arranque en frío a propósito -- Apple puede rotar el token
 * en silencio, así que "ya lo registré una vez" nunca es suficiente
 * garantía (ver `app/api/push/register/route.ts`).
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
    if (!Capacitor.isNativePlatform() || hasRegisteredThisSession) {
      return;
    }
    hasRegisteredThisSession = true;

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

    register().catch(() => {
      // Fallo de permiso/registro nativo -- nunca debe romper la pantalla; sin token registrado, esta persona simplemente no recibe push hasta el próximo arranque en frío.
    });

    return () => {
      cancelled = true;
      registrationListener.then((handle) => handle.remove());
    };
  }, []);

  return null;
}
