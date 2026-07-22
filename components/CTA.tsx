import Link from "next/link";

export default function CTA() {
  return (
    <section className="bg-black text-white py-24">
      <div className="text-center">
        <h2 className="text-4xl font-light">
          Empieza hoy.
        </h2>

        <p className="mt-4 text-zinc-400">
          Tu espacio para pensar con calma ya está aquí.
        </p>

        <Link
          href="/chat"
          className="mt-8 inline-block rounded-full bg-white text-black px-8 py-3 hover:bg-zinc-200 transition"
        >
          Abrir LUZ
        </Link>
      </div>
    </section>
  );
}