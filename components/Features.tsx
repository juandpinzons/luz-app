export default function Features() {
  return (
    <section id="features" className="bg-black text-white py-24 px-6">
      <div className="max-w-5xl mx-auto grid md:grid-cols-3 gap-8">
        <div className="rounded-2xl border border-zinc-800 p-8">
          <h3 className="text-xl font-semibold mb-3">
            Conversaciones sin prisa
          </h3>

          <p className="text-zinc-400">
            LUZ te escucha sin juzgar y sin apurarte a llegar a ninguna parte.
          </p>
        </div>

        <div className="rounded-2xl border border-zinc-800 p-8">
          <h3 className="text-xl font-semibold mb-3">
            Recuerdos que se guardan solos
          </h3>

          <p className="text-zinc-400">
            No hace falta que anotes nada — LUZ recuerda lo que le cuentas.
          </p>
        </div>

        <div className="rounded-2xl border border-zinc-800 p-8">
          <h3 className="text-xl font-semibold mb-3">
            Comprensión que crece contigo
          </h3>

          <p className="text-zinc-400">
            LUZ reconoce patrones en lo que compartimos y te ayuda a verte con más claridad.
          </p>
        </div>
      </div>
    </section>
  );
}