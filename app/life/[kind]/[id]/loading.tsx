import { Skeleton } from "@/components/ui/skeleton";

/** Se muestra mientras `LifeDetailPage` resuelve la entidad y sus memorias relacionadas. */
export default function LifeDetailLoading() {
  return (
    <main className="min-h-full px-6 py-10 text-white">
      <div className="mx-auto w-full max-w-2xl">
        <Skeleton className="h-5 w-16" />

        <Skeleton className="mt-4 h-8 w-2/3" />
        <Skeleton className="mt-2 h-4 w-24" />

        <div className="mt-10">
          <Skeleton className="h-4 w-56" />
          <div className="mt-3 space-y-2">
            {Array.from({ length: 2 }).map((_, index) => (
              <Skeleton key={index} className="h-[60px] w-full" />
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}
