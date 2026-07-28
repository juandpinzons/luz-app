import { Skeleton } from "@/components/ui/skeleton";

/** Se muestra mientras `LifeIdentityPage` resuelve `buildIdentityModel`. */
export default function LifeIdentityLoading() {
  return (
    <main className="min-h-full px-6 py-10">
      <div className="mx-auto w-full max-w-2xl space-y-10">
        <Skeleton className="h-5 w-16" />
        <Skeleton className="h-6 w-40" />

        {Array.from({ length: 3 }).map((_, sectionIndex) => (
          <div key={sectionIndex}>
            <Skeleton className="h-4 w-48" />
            <div className="mt-3 space-y-2">
              {Array.from({ length: 2 }).map((_, index) => (
                <Skeleton key={index} className="h-[52px] w-full" />
              ))}
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}
