import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getLifeGraphContext } from "@/auth/user-context";
import { db } from "@/core/db/client";
import { listDailyMetrics } from "@/core/wearable-metrics/repository";
import { getWearableSnapshot } from "@/features/reality/application/get-wearable-snapshot";

/**
 * Mismo criterio visual que `/calendar`/`/gmail` (mismo cimiento,
 * `features/reality/`), pero sin flujo de conexión en vivo: Wearable
 * Foundation es import-based (ver `features/reality/README.md`,
 * "Wearable Foundation" -- no existe una API self-serve de Garmin para
 * una persona individual). El estado "conectado" de esta página
 * refleja si ya hay `wearable_daily_metrics` persistidas, no una
 * sesión OAuth activa.
 */
export default async function GarminPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  const lifeGraphContext = await getLifeGraphContext();
  if (!lifeGraphContext) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-black px-6 text-center text-white">
        <p className="text-zinc-400">No se pudo cargar tu perfil. Intenta de nuevo en unos segundos.</p>
      </main>
    );
  }

  const dailyMetrics = await listDailyMetrics(db, lifeGraphContext.lifeGraphId, "garmin");
  const snapshot = getWearableSnapshot(dailyMetrics);

  if (!snapshot.hasData) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center bg-black px-6 text-center text-white">
        <p className="text-2xl font-light">Ningún reloj conectado</p>
        <p className="mt-3 max-w-sm text-zinc-400">
          Conecta tu Garmin para que LUZ entienda cómo duermes, tu nivel de estrés y qué tan activo estás -- nunca solo
          lo que le cuentas, también lo que tu cuerpo dice.
        </p>
        <a
          href="mailto:hola@joinluz.com?subject=Conectar%20mi%20Garmin"
          className="mt-8 inline-block rounded-full bg-white px-8 py-3 font-medium text-black transition hover:bg-zinc-200"
        >
          Conectar Garmin
        </a>
      </main>
    );
  }

  const { latestDay, trend } = snapshot;

  return (
    <main className="flex min-h-screen flex-col items-center bg-black px-6 py-16 text-white">
      <div className="w-full max-w-lg">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-2xl font-light">Tu reloj</p>
            <p className="mt-1 text-sm text-zinc-500">Garmin -- conectado</p>
          </div>
          <span className="rounded-full border border-emerald-900/50 bg-emerald-950/20 px-3 py-1 text-xs text-emerald-300">
            Sincronizado
          </span>
        </div>

        {latestDay && (
          <section className="mt-8 grid grid-cols-2 gap-3">
            <StatCard label="Pasos hoy" value={latestDay.steps?.toLocaleString("es-CO") ?? "--"} />
            <StatCard
              label="FC en reposo"
              value={latestDay.restingHeartRateBpm ? `${latestDay.restingHeartRateBpm} bpm` : "--"}
            />
            <StatCard
              label="Sueño anoche"
              value={latestDay.sleep ? formatMinutes(latestDay.sleep.totalMinutes) : "--"}
              alert={snapshot.lowSleepAlert}
            />
            <StatCard
              label="Estrés promedio"
              value={latestDay.averageStressLevel !== undefined ? `${latestDay.averageStressLevel}/100` : "--"}
              alert={snapshot.elevatedStressAlert}
            />
          </section>
        )}

        {(snapshot.lowSleepAlert || snapshot.elevatedStressAlert) && (
          <div className="mt-6 rounded-2xl border border-amber-900/50 bg-amber-950/20 px-5 py-4 text-sm text-amber-300">
            {snapshot.lowSleepAlert && <p>Dormiste menos de lo habitual anoche.</p>}
            {snapshot.elevatedStressAlert && <p>Tu estrés promedio de hoy está más alto de lo usual.</p>}
          </div>
        )}

        {trend && (
          <section className="mt-8">
            <h2 className="text-sm font-medium text-zinc-400">Promedio de los últimos {trend.windowDays} días</h2>
            <div className="mt-3 grid grid-cols-3 gap-3 text-sm">
              <TrendItem label="Pasos" value={trend.averageSteps?.toLocaleString("es-CO")} />
              <TrendItem label="Sueño" value={trend.averageSleepMinutes ? formatMinutes(trend.averageSleepMinutes) : undefined} />
              <TrendItem label="Estrés" value={trend.averageStressLevel !== undefined ? `${trend.averageStressLevel}/100` : undefined} />
            </div>
          </section>
        )}

        <section className="mt-8">
          <h2 className="text-sm font-medium text-zinc-400">Últimos días</h2>
          <ul className="mt-3 space-y-2">
            {dailyMetrics.slice(0, 7).map((day) => (
              <li
                key={day.date}
                className="flex items-center justify-between rounded-xl border border-zinc-800 px-4 py-3 text-sm"
              >
                <span className="text-zinc-400">{day.date}</span>
                <span className="flex gap-4 text-zinc-300">
                  {day.steps !== undefined && <span>{day.steps.toLocaleString("es-CO")} pasos</span>}
                  {day.sleep && <span>{formatMinutes(day.sleep.totalMinutes)} sueño</span>}
                </span>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </main>
  );
}

function formatMinutes(totalMinutes: number): string {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${hours}h ${minutes}min`;
}

function StatCard({ label, value, alert }: { label: string; value: string; alert?: boolean }) {
  return (
    <div
      className={
        alert
          ? "rounded-2xl border border-amber-900/50 bg-amber-950/10 px-4 py-4"
          : "rounded-2xl border border-zinc-800 px-4 py-4"
      }
    >
      <p className="text-xs text-zinc-500">{label}</p>
      <p className="mt-1 text-xl font-light text-white">{value}</p>
    </div>
  );
}

function TrendItem({ label, value }: { label: string; value?: string }) {
  return (
    <div className="rounded-xl border border-zinc-800 px-3 py-3 text-center">
      <p className="text-xs text-zinc-500">{label}</p>
      <p className="mt-1 text-white">{value ?? "--"}</p>
    </div>
  );
}
