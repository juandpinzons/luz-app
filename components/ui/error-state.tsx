/** Markup compartido por los error.tsx de cada ruta — la lógica de logging queda en cada archivo, solo el visual se consolida acá. */
export function ErrorState({
  title,
  description,
  onRetry,
  fullHeight = true,
}: {
  title: string;
  description: string;
  onRetry: () => void;
  fullHeight?: boolean;
}) {
  return (
    <main
      className={`flex ${fullHeight ? "h-screen" : "min-h-screen"} flex-col items-center justify-center bg-black px-6 text-center text-white`}
    >
      <h2 className="text-2xl font-light">{title}</h2>
      <p className="mt-3 text-zinc-400">{description}</p>
      <button
        onClick={onRetry}
        className="mt-8 rounded-full bg-white px-8 py-3 font-medium text-black transition hover:bg-zinc-200"
      >
        Intentar de nuevo
      </button>
    </main>
  );
}
