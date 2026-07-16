import Link from "next/link";

export default function Hero() {
  return (
    <main className="min-h-screen bg-black text-white flex items-center justify-center">
      <div className="text-center px-6">
        <h1 className="text-7xl font-light tracking-[0.3em]">
          LUZ
        </h1>

        <p className="mt-6 text-2xl text-zinc-300">
          Presencia, sin presión.
        </p>

        <p className="mt-8 max-w-xl mx-auto text-zinc-500 leading-8">
          Un compañero de inteligencia artificial diseñado para ayudarte a
          pensar con claridad, escribir sin juicio y encontrar un momento de
          calma cuando lo necesites.
        </p>

        <div className="mt-12 flex justify-center gap-4">
          <Link
            href="/chat"
            className="rounded-full bg-white text-black px-8 py-3 font-medium transition hover:bg-zinc-200"
          >
            Comenzar
          </Link>

          <button className="rounded-full border border-zinc-700 px-8 py-3 transition hover:bg-zinc-900">
            Conocer más
          </button>
        </div>
      </div>
    </main>
  );
}