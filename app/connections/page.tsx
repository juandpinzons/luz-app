import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getLifeGraphContext } from "@/auth/user-context";
import { CalendarIcon, EnvelopeIcon, WatchIcon } from "@/components/ui/icons";
import { db } from "@/core/db/client";
import { getStoredEmailConnection } from "@/core/email-connections/repository";
import { getStoredCalendarConnection } from "@/core/calendar-connections/repository";
import { listDailyMetrics } from "@/core/wearable-metrics/repository";
import { getWearableSnapshot } from "@/features/reality/application/get-wearable-snapshot";

/**
 * Auditoría de interfaz (2026-08-15, feedback directo): Gmail/Calendario/
 * Garmin vivían como tres enlaces de texto sueltos al fondo de `/dashboard`
 * -- fáciles de no ver nunca si no sabías que existían. Un solo lugar que
 * responde "¿qué tengo conectado?" sin tener que visitar cada pantalla.
 *
 * Deliberadamente NO usa `getLiveCalendarContext`/`getLiveEmailContext` --
 * esas hacen una sincronización real (red) en cada carga, correcto para
 * `/calendar`/`/gmail`, que sí necesitan datos frescos, pero desperdiciado
 * acá: este resumen solo necesita saber si existe una conexión guardada y
 * en qué estado, no traer el snapshot completo. Nunca un cuarto camino que
 * pueda desincronizarse de esos dos -- mismo `getStoredXConnection` que
 * ellos mismos usan como primer paso.
 */
export default async function ConnectionsPage() {
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

  const [storedEmail, storedCalendar, dailyMetrics] = await Promise.all([
    getStoredEmailConnection(db, lifeGraphContext.lifeGraphId, "gmail"),
    getStoredCalendarConnection(db, lifeGraphContext.lifeGraphId, "apple"),
    listDailyMetrics(db, lifeGraphContext.lifeGraphId, "garmin"),
  ]);
  const wearable = getWearableSnapshot(dailyMetrics);

  const emailConnected = storedEmail !== null && storedEmail.connection.status !== "disconnected";
  const calendarConnected = storedCalendar !== null && storedCalendar.connection.status !== "disconnected";

  const rows: {
    key: string;
    name: string;
    description: string;
    href: string;
    connected: boolean;
    needsReauth: boolean;
    icon: React.ReactNode;
  }[] = [
    {
      key: "calendar",
      name: "Calendario",
      description: "Qué tienes ocupado y libre.",
      href: "/calendar",
      connected: calendarConnected,
      needsReauth: storedCalendar?.connection.status === "needs_reauth",
      icon: <CalendarIcon className="h-5 w-5" />,
    },
    {
      key: "gmail",
      name: "Gmail",
      description: "Qué correos son nuevos, importantes o esperan respuesta.",
      href: "/gmail",
      connected: emailConnected,
      needsReauth: storedEmail?.connection.status === "needs_reauth",
      icon: <EnvelopeIcon className="h-5 w-5" />,
    },
    {
      key: "garmin",
      name: "Garmin",
      description: "Cómo duermes, tu nivel de estrés y qué tan activo estás.",
      href: "/garmin",
      connected: wearable.hasData,
      needsReauth: false,
      icon: <WatchIcon className="h-5 w-5" />,
    },
  ];

  return (
    <main className="flex min-h-screen flex-col items-center bg-black px-6 py-16 text-white">
      <div className="w-full max-w-lg">
        <Link href="/dashboard" className="text-sm text-zinc-500 transition hover:text-zinc-300">
          ← Hoy
        </Link>

        <h1 className="mt-4 text-2xl font-light">Conexiones</h1>
        <p className="mt-2 text-sm text-zinc-500">
          Lo que LUZ puede ver de tu vida real fuera de la conversación, además de lo que le cuentas.
        </p>

        <ul className="mt-8 space-y-3">
          {rows.map((row) => (
            <li key={row.key}>
              <Link
                href={row.href}
                className="flex items-center gap-4 rounded-2xl border border-zinc-800 px-5 py-4 transition hover:border-zinc-600"
              >
                <span className="flex-shrink-0 text-zinc-400">{row.icon}</span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium text-white">{row.name}</span>
                  <span className="block truncate text-xs text-zinc-500">{row.description}</span>
                </span>
                <span
                  className={
                    row.needsReauth
                      ? "flex-shrink-0 text-xs text-amber-400"
                      : row.connected
                        ? "flex-shrink-0 text-xs text-luz"
                        : "flex-shrink-0 text-xs text-zinc-600"
                  }
                >
                  {row.needsReauth ? "Reconectar" : row.connected ? "Conectado" : "Conectar"}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </main>
  );
}
