const ERROR_LABEL: Record<string, string> = {
  denied: "No completaste el consentimiento en Google.",
  invalid_state: "La conexión expiró o no se pudo verificar. Intenta de nuevo desde la app.",
  not_configured: "La conexión con Google no está configurada todavía.",
  connect_failed: "No pudimos completar el inicio de sesión. Intenta de nuevo.",
};

/**
 * Fallback real del Universal Link (`app/api/mobile-auth/callback/route.ts`)
 * -- en el camino feliz, iOS intercepta esta URL ANTES de que el
 * navegador de sistema llegue a renderizarla, y la app nativa la
 * consume directo (ver `auth/schema.ts::mobileSessionHandoffs`). Esta
 * página solo se ve de verdad si el enlace se abre fuera de la app
 * (Associated Domains sin configurar, o la app no está instalada) --
 * nunca queda en blanco.
 */
export default async function MobileBridgePage({
  searchParams,
}: {
  searchParams: Promise<{ exchange_code?: string; error?: string }>;
}) {
  const { exchange_code: exchangeCode, error } = await searchParams;

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-black px-6 text-center text-white">
      <p className="text-sm font-light tracking-[0.25em] text-[#e3b168]">LUZ</p>
      <p className="mt-6 text-2xl font-light">
        {error ? "Algo no salió bien" : "Abre esto en la app LUZ"}
      </p>
      <p className="mt-3 max-w-sm text-zinc-400">
        {error
          ? (ERROR_LABEL[error] ?? "No se pudo completar el inicio de sesión.")
          : exchangeCode
            ? "Este enlace termina el inicio de sesión dentro de la app -- si lo abriste desde el navegador, vuelve a intentarlo desde LUZ."
            : "Este enlace es parte del inicio de sesión de la app LUZ."}
      </p>
    </main>
  );
}
