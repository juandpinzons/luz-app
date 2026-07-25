import { Skeleton } from "@/components/ui/skeleton";

/**
 * Antes, esta ruta heredaba el `loading.tsx` de `/conversations`
 * (skeleton de filas de lista) mientras cargaba — forma equivocada
 * para una vista de burbujas, con un salto de layout real al llegar
 * el contenido. Misma geometría que `/chat` usa para su propio
 * skeleton de historial (`app/chat/page.tsx`).
 */
export default function ConversationDetailLoading() {
  return (
    <main className="flex h-full flex-col bg-black text-white">
      <header className="flex items-center justify-end border-b border-zinc-800 px-8 py-5">
        <Skeleton className="h-4 w-20" />
      </header>

      <section className="min-h-0 flex-1 overflow-y-auto px-6 py-8">
        <div className="mx-auto w-full max-w-3xl space-y-4">
          <Skeleton className="ml-auto h-11 w-40" />
          <Skeleton className="mr-auto h-16 w-64" />
          <Skeleton className="ml-auto h-11 w-52" />
          <Skeleton className="mr-auto h-11 w-48" />
        </div>
      </section>
    </main>
  );
}
