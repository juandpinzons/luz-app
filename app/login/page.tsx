import { signIn } from "@/auth";
import { PresenceDot } from "@/components/ui/presence-dot";
import { SubmitButton } from "@/components/ui/submit-button";

/**
 * `callbackUrl` llega cuando `proxy.ts` redirigió aquí desde una
 * ruta protegida (ver proxy.ts) — nunca en una visita voluntaria a
 * /login. Esa distinción importa: alguien que ya estaba adentro y de
 * repente ve "inicia sesión" no perdió nada, solo tuvo un hipo de
 * sesión — el mensaje genérico ("Inicia sesión para continuar") no
 * dice eso, y para alguien no técnico puede leerse como "perdiste tu
 * conversación". Aterriza de vuelta en `callbackUrl` (no siempre en
 * /dashboard) para que, al volver a entrar, siga donde estaba.
 */
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string }>;
}) {
  const { callbackUrl } = await searchParams;
  const redirectTo = callbackUrl && callbackUrl.startsWith("/") ? callbackUrl : "/dashboard";

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-black px-6 text-white">
      <h1 className="animate-fade-in flex items-center gap-2 text-3xl font-light tracking-[0.2em]">
        LUZ
        <PresenceDot />
      </h1>

      <p
        className="animate-fade-in mt-4 max-w-sm text-center text-zinc-400"
        style={{ animationDelay: "80ms" }}
      >
        {callbackUrl
          ? "Tu sesión se refrescó. No perdiste nada — solo toca el botón para continuar donde estabas."
          : "Un paso más, y estoy aquí."}
      </p>

      <form
        className="animate-fade-in mt-10"
        style={{ animationDelay: "160ms" }}
        action={async () => {
          "use server";
          await signIn("google", { redirectTo });
        }}
      >
        <SubmitButton
          pendingLabel="Conectando…"
          className="rounded-full bg-white px-8 py-3 font-medium text-black transition hover:bg-zinc-200 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-luz disabled:opacity-60"
        >
          Continuar con Google
        </SubmitButton>
      </form>
    </main>
  );
}
