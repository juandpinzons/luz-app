import { Skeleton } from "@/components/ui/skeleton";

/** Se muestra mientras `MemoriesPage` resuelve `searchMemories` — antes de esto, la página se quedaba en blanco sin ninguna señal (único hueco real entre las rutas con skeleton ya construido: dashboard, conversaciones y chat lo tenían, esta no). */
export default function MemoriesLoading() {
  return (
    <main className="min-h-full px-6 py-10 text-white">
      <div className="mx-auto w-full max-w-2xl">
        <Skeleton className="h-5 w-32" />
        <Skeleton className="mt-6 h-12 w-full" />

        <div className="mt-8 space-y-8">
          {Array.from({ length: 2 }).map((_, groupIndex) => (
            <div key={groupIndex}>
              <Skeleton className="h-4 w-24" />
              <div className="mt-3 space-y-2">
                {Array.from({ length: 3 }).map((_, index) => (
                  <Skeleton key={index} className="h-[60px] w-full" />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
