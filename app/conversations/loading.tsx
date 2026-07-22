import { Skeleton } from "@/components/ui/skeleton";

/** Se muestra mientras `ConversationsPage` (Server Component) resuelve `listConversations` — antes de esto, la página bloqueaba sin ninguna señal. */
export default function ConversationsLoading() {
  return (
    <main className="min-h-screen bg-black px-6 py-10 text-white">
      <div className="mx-auto w-full max-w-2xl">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-light tracking-[0.25em]">HISTORIAL</h1>
        </div>

        <Skeleton className="mt-6 h-12 w-full" />

        <div className="mt-8 space-y-3">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-[72px] w-full" />
          ))}
        </div>
      </div>
    </main>
  );
}
