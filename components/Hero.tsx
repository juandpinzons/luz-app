import Link from "next/link";
import { LUZ_IDENTITY } from "../core/persona";

/**
 * `essence`/`publicSummary` vienen de `core/persona` (Sprint
 * "Identity, Presence & Product Experience") — antes vivían
 * hardcodeados aquí, sin relación con lo que el chat dice si le
 * preguntan lo mismo. Una sola fuente para ambos.
 */
export default function Hero() {
  return (
    <main className="min-h-screen bg-black text-white flex items-center justify-center">
      <div className="text-center px-6">
        <h1 className="animate-fade-in text-7xl font-light tracking-[0.3em] text-luz/90">
          {LUZ_IDENTITY.name}
        </h1>

        <p
          className="animate-fade-in mt-6 text-2xl text-zinc-300"
          style={{ animationDelay: "80ms" }}
        >
          {LUZ_IDENTITY.essence}
        </p>

        <p
          className="animate-fade-in mt-8 max-w-xl mx-auto text-zinc-500 leading-8"
          style={{ animationDelay: "160ms" }}
        >
          {LUZ_IDENTITY.publicSummary}
        </p>

        <div
          className="animate-fade-in mt-12 flex justify-center gap-4"
          style={{ animationDelay: "240ms" }}
        >
          <Link
            href="/dashboard"
            className="rounded-full bg-white text-black px-8 py-3 font-medium transition hover:bg-zinc-200 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-luz"
          >
            Comenzar
          </Link>

          <a
            href="#features"
            className="rounded-full border border-zinc-700 px-8 py-3 transition hover:bg-zinc-900 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-luz"
          >
            Conocer más
          </a>
        </div>
      </div>
    </main>
  );
}