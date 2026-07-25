import { Skeleton } from "@/components/ui/skeleton";

/** Se muestra mientras `LifePage` resuelve Goals/Projects/Habits/Relationships/Timeline — antes de esto, la página se quedaba en blanco sin ninguna señal. */
export default function LifeLoading() {
  return (
    <main className="min-h-full px-6 py-10">
      <div className="mx-auto w-full max-w-3xl space-y-10">
        <Skeleton className="h-5 w-16" />

        {Array.from({ length: 2 }).map((_, sectionIndex) => (
          <div key={sectionIndex}>
            <Skeleton className="h-4 w-20" />
            <div className="mt-3 flex flex-wrap gap-3">
              {Array.from({ length: 3 }).map((_, index) => (
                <Skeleton key={index} className="h-14 w-40" />
              ))}
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}
