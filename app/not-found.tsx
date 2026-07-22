import Link from "next/link";

/**
 * Captura todo `notFound()` de una ruta sin su propio `not-found.tsx`
 * más cercano — incluye los que ya lanza
 * `app/conversations/[id]/page.tsx` (id inválido, ajeno o inexistente,
 * las tres indistinguibles a propósito). Antes de esto caían en la
 * página 404 genérica de Next, rota respecto al tema de LUZ.
 */
export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-black px-6 text-center text-white">
      <h2 className="text-2xl font-light">No encontramos esto.</h2>
      <p className="mt-3 text-zinc-400">
        Puede que el enlace esté vencido o que la conversación ya no exista.
      </p>
      <Link
        href="/dashboard"
        className="mt-8 inline-block rounded-full bg-white px-8 py-3 font-medium text-black transition hover:bg-zinc-200"
      >
        Volver al inicio
      </Link>
    </main>
  );
}
