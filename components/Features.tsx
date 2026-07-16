export default function Features() {
  return (
    <section className="bg-black text-white py-24 px-6">
      <div className="max-w-5xl mx-auto grid md:grid-cols-3 gap-8">
        <div className="rounded-2xl border border-zinc-800 p-8">
          <h3 className="text-xl font-semibold mb-3">
            Conversaciones conscientes
          </h3>

          <p className="text-zinc-400">
            Habla con una IA diseñada para acompañarte, no para presionarte.
          </p>
        </div>

        <div className="rounded-2xl border border-zinc-800 p-8">
          <h3 className="text-xl font-semibold mb-3">
            Diario personal
          </h3>

          <p className="text-zinc-400">
            Guarda pensamientos, emociones y reflexiones en un solo lugar.
          </p>
        </div>

        <div className="rounded-2xl border border-zinc-800 p-8">
          <h3 className="text-xl font-semibold mb-3">
            Reflexiones inteligentes
          </h3>

          <p className="text-zinc-400">
            LUZ identifica patrones y te ayuda a comprender mejor tu proceso.
          </p>
        </div>
      </div>
    </section>
  );
}