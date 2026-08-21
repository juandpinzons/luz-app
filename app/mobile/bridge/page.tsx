const LOGIN_ERROR_LABEL: Record<string, string> = {
  denied: "No completaste el consentimiento en Google.",
  invalid_state: "La conexión expiró o no se pudo verificar. Intenta de nuevo desde la app.",
  not_configured: "La conexión con Google no está configurada todavía.",
  connect_failed: "No pudimos completar el inicio de sesión. Intenta de nuevo.",
};

const GMAIL_CONNECT_ERROR_LABEL: Record<string, string> = {
  denied: "No completaste el consentimiento en Google.",
  invalid_state: "La conexión expiró o no se pudo verificar. Intenta de nuevo desde la app.",
  not_configured: "La conexión con Google no está configurada todavía.",
  no_profile: "No se pudo cargar tu perfil. Intenta de nuevo en unos segundos.",
  connect_failed: "No pudimos conectar con Gmail. Intenta de nuevo.",
};

/**
 * Fallback real del Universal Link -- en el camino feliz, iOS
 * intercepta esta URL ANTES de que el navegador de sistema llegue a
 * renderizarla, y la app nativa la consume directo. Esta página solo
 * se ve de verdad si el enlace se abre fuera de la app (Associated
 * Domains sin configurar, o la app no está instalada) -- nunca queda
 * en blanco.
 *
 * Dos propósitos comparten este mismo path (el único que
 * `app/.well-known/apple-app-site-association` intercepta hoy --
 * ampliar esa lista es una decisión de producto aparte, no algo que
 * se deba hacer solo para sumar un segundo destino):
 * - Login nativo (`app/api/mobile-auth/callback/route.ts`,
 *   `exchange_code`) -- consume un código real hacia
 *   `/api/mobile-auth/consume`, `auth/schema.ts::mobileSessionHandoffs`.
 * - Conexión de Gmail (`app/api/gmail/callback/route.ts`,
 *   `purpose=gmail_connect`) -- para cuando esto se ve llega, los
 *   tokens de Gmail ya quedaron guardados en el servidor; no hay nada
 *   más que consumir, solo volver a mostrar `/gmail` dentro de la app
 *   (ver el listener en `features/gmail/components/connect-gmail-button.tsx`).
 */
export default async function MobileBridgePage({
  searchParams,
}: {
  searchParams: Promise<{ exchange_code?: string; error?: string; purpose?: string; status?: string; reason?: string }>;
}) {
  const { exchange_code: exchangeCode, error, purpose, status, reason } = await searchParams;

  if (purpose === "gmail_connect") {
    const isError = status === "error";
    return (
      <main className="flex min-h-screen flex-col items-center justify-center bg-black px-6 text-center text-white">
        <p className="text-sm font-light tracking-[0.25em] text-[#e3b168]">LUZ</p>
        <p className="mt-6 text-2xl font-light">{isError ? "Algo no salió bien" : "Volviendo a LUZ..."}</p>
        <p className="mt-3 max-w-sm text-zinc-400">
          {isError
            ? (GMAIL_CONNECT_ERROR_LABEL[reason ?? ""] ?? "No se pudo conectar tu correo.")
            : "Gmail se conectó correctamente -- si lo abriste desde el navegador, vuelve a la app LUZ."}
        </p>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-black px-6 text-center text-white">
      <p className="text-sm font-light tracking-[0.25em] text-[#e3b168]">LUZ</p>
      <p className="mt-6 text-2xl font-light">
        {error ? "Algo no salió bien" : "Abre esto en la app LUZ"}
      </p>
      <p className="mt-3 max-w-sm text-zinc-400">
        {error
          ? (LOGIN_ERROR_LABEL[error] ?? "No se pudo completar el inicio de sesión.")
          : exchangeCode
            ? "Este enlace termina el inicio de sesión dentro de la app -- si lo abriste desde el navegador, vuelve a intentarlo desde LUZ."
            : "Este enlace es parte del inicio de sesión de la app LUZ."}
      </p>
    </main>
  );
}
