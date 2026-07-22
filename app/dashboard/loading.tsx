import { Skeleton } from "@/components/ui/skeleton";

/** Se muestra mientras `DashboardPage` resuelve `LifeGraphContext` y el resumen — antes de esto, la pantalla se quedaba en blanco sin ninguna señal. */
export default function DashboardLoading() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-black px-6 text-white">
      <div className="w-full max-w-xl">
        <div className="space-y-3">
          <Skeleton className="h-6 w-3/4" />
          <Skeleton className="h-6 w-1/2" />
          <Skeleton className="h-6 w-2/3" />
        </div>

        <Skeleton className="mt-10 h-12 w-56 rounded-full" />
      </div>
    </main>
  );
}
