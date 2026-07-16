import { signIn } from "@/auth";

export default function LoginPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-black px-6 text-white">
      <h1 className="text-3xl font-light tracking-[0.2em]">LUZ</h1>

      <p className="mt-4 text-zinc-400">Inicia sesión para continuar.</p>

      <form
        className="mt-10"
        action={async () => {
          "use server";
          await signIn("google", { redirectTo: "/chat" });
        }}
      >
        <button
          type="submit"
          className="rounded-full bg-white px-8 py-3 font-medium text-black transition hover:bg-zinc-200"
        >
          Continuar con Google
        </button>
      </form>
    </main>
  );
}
