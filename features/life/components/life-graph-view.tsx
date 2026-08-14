"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type {
  LifeGraphBranch,
  LifeGraphItem,
  LifeGraphSummary,
} from "../services/build-life-graph";
import type { RelationshipWithDisplayName } from "../services/list-all-relationships";
import type { Memory } from "../../../core/memory-engine";
import { RELATIONSHIP_TYPE_LABELS } from "../labels";

const VIEW_SIZE = 600;
const CENTER = VIEW_SIZE / 2;
const RADIUS = 190;
const MIN_ZOOM = 60;
const MAX_ZOOM = 150;
const ZOOM_STEP = 15;

/** Posición para el SVG (líneas) -- coordenadas fijas 0-600, el propio `viewBox` ya las escala al tamaño real. */
function polarPosition(index: number, total: number) {
  const angle = (index / total) * Math.PI * 2 - Math.PI / 2;
  return {
    x: CENTER + RADIUS * Math.cos(angle),
    y: CENTER + RADIUS * Math.sin(angle),
  };
}

/**
 * Posición para los `BranchButton` (HTML, no SVG) -- en porcentaje del
 * contenedor, no píxeles absolutos del espacio 0-600. Un `<button>`
 * posicionado con `left`/`top` en px fijos no escala cuando el
 * contenedor se angosta (móvil): el mapa se veía correcto en desktop
 * (contenedor = 600px) pero los nodos se salían del borde en una
 * pantalla de iPhone (contenedor real ≈ 320-390px), donde el `viewBox`
 * del SVG sí escalaba sus líneas pero este overlay HTML no. Mismo
 * ángulo/radio, solo expresado como fracción del contenedor en vez de
 * unidades absolutas.
 */
function polarPositionPercent(index: number, total: number) {
  const { x, y } = polarPosition(index, total);
  return { x: (x / VIEW_SIZE) * 100, y: (y / VIEW_SIZE) * 100 };
}

function formatRelativeTime(date: Date): string {
  const diffMinutes = Math.floor((Date.now() - date.getTime()) / 60_000);
  if (diffMinutes < 1) return "hace un momento";
  if (diffMinutes < 60) return `hace ${diffMinutes} min`;
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `hace ${diffHours} h`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays === 1) return "ayer";
  if (diffDays < 30) return `hace ${diffDays} días`;
  const diffMonths = Math.floor(diffDays / 30);
  return `hace ${diffMonths} ${diffMonths === 1 ? "mes" : "meses"}`;
}

interface LifeGraphViewProps {
  personName: string;
  summary: LifeGraphSummary;
  /** El render de la vista de lista ya existente -- este componente nunca reimplementa esa parte, solo la envuelve con el toggle. */
  listView: React.ReactNode;
}

/**
 * Mapa mental de la vida de la persona -- capa visual nueva sobre datos
 * que `/life` ya mostraba en forma de lista (`listView` sigue siendo
 * exactamente esa lista, sin tocar). Layout radial fijo, sin física ni
 * librería nueva: los ángulos se calculan una vez con trigonometría
 * simple, no hay simulación de fuerzas que mantener ni depurar.
 *
 * "Vista lista" existe porque un mapa no es siempre la forma más clara
 * de leer la misma información -- ninguna de las dos es la fuente de
 * verdad, ambas leen `summary`.
 */
/**
 * Cuánto esperar antes de cada `router.refresh()` automático al montar
 * `/life` -- ver el `useEffect` de abajo para el porqué. Tres intentos
 * a distintos espaciados en vez de un intervalo fijo: cubre tanto el
 * caso rápido (una extracción de Life Capture que termina en 3-4s)
 * como uno más lento, sin seguir sondeando indefinidamente después de
 * los 15s si para entonces sigue sin aparecer -- en ese punto un
 * refresh más no va a cambiar nada que un `router.refresh()` manual no
 * pueda ya resolver.
 */
const AUTO_REFRESH_DELAYS_MS = [3000, 7000, 15000];

export function LifeGraphView({ personName, summary, listView }: LifeGraphViewProps) {
  const router = useRouter();
  const [mode, setMode] = useState<"map" | "list">("map");
  const [zoom, setZoom] = useState(100);
  const [selectedBranchId, setSelectedBranchId] = useState<LifeGraphBranch["id"] | null>(null);
  const [showRelationships, setShowRelationships] = useState(true);
  const [showMemories, setShowMemories] = useState(true);

  /**
   * El mapa puede aparecer "sin actualizar" justo después de chatear:
   * `sendMessage` (`features/chat/services/send-message.ts`) captura
   * Goals/Projects/Habits/Relationships en un `after()` que corre
   * DESPUÉS de que la respuesta del chat ya se envió, y esa captura
   * hace su propia llamada a IA antes de escribir en la base de datos
   * -- si la persona navega a `/life` apenas ve la respuesta, la fila
   * puede genuinamente no existir todavía (no es un problema de caché:
   * `/life` ya se renderiza dinámico en cada visita, sin ningún
   * `revalidatePath`/`revalidateTag` en el repo). `router.refresh()`
   * vuelve a ejecutar el Server Component (`app/life/page.tsx`) sin
   * perder el estado local de este componente (zoom, rama
   * seleccionada) -- nunca recarga la página completa.
   */
  useEffect(() => {
    const timers = AUTO_REFRESH_DELAYS_MS.map((delay) => setTimeout(() => router.refresh(), delay));
    return () => {
      for (const timer of timers) clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- a propósito: una sola tanda de reintentos al montar, no en cada cambio de `router`.
  }, []);

  const branches = summary.branches;
  const positions = useMemo(
    () => branches.map((_, index) => polarPosition(index, branches.length)),
    [branches],
  );
  const percentPositions = useMemo(
    () => branches.map((_, index) => polarPositionPercent(index, branches.length)),
    [branches],
  );

  const selectedBranch = branches.find((branch) => branch.id === selectedBranchId) ?? null;
  /** Total real de la rama "recuerdos" -- `summary.timeline` es la lista ya recortada para exhibición, `.length` de esa lista NO es el total (mismo bug que ya se corrigió en `BranchDetailPanel`). */
  const memoriesTotal = branches.find((branch) => branch.id === "recuerdos")?.count ?? summary.timeline.length;

  if (mode === "list") {
    return (
      <div>
        <ViewToggle mode={mode} onChange={setMode} />
        {listView}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 lg:flex-row">
      <div className="flex-1">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <ViewToggle mode={mode} onChange={setMode} />
          <div className="flex items-center gap-2 text-sm text-zinc-400">
            <button
              type="button"
              onClick={() => setZoom((z) => Math.max(MIN_ZOOM, z - ZOOM_STEP))}
              className="flex h-8 w-8 items-center justify-center rounded-full border border-zinc-700 transition hover:border-zinc-500 hover:text-white focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-luz"
              aria-label="Alejar"
            >
              −
            </button>
            <span className="w-12 text-center tabular-nums">{zoom}%</span>
            <button
              type="button"
              onClick={() => setZoom((z) => Math.min(MAX_ZOOM, z + ZOOM_STEP))}
              className="flex h-8 w-8 items-center justify-center rounded-full border border-zinc-700 transition hover:border-zinc-500 hover:text-white focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-luz"
              aria-label="Acercar"
            >
              +
            </button>
            <button
              type="button"
              onClick={() => setZoom(100)}
              className="rounded-full border border-zinc-700 px-3 py-1.5 transition hover:border-zinc-500 hover:text-white focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-luz"
            >
              Recentrar
            </button>
          </div>
        </div>

        <div className="mt-6 overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-950/40">
          <div
            className="relative mx-auto aspect-square w-full animate-fade-in transition-transform duration-300"
            style={{
              maxWidth: VIEW_SIZE,
              transform: `scale(${zoom / 100})`,
              transformOrigin: "top center",
            }}
          >
            <svg
              viewBox={`0 0 ${VIEW_SIZE} ${VIEW_SIZE}`}
              className="absolute inset-0 h-full w-full"
              role="img"
              aria-label={`Mapa de la vida de ${personName}: ${branches.map((b) => b.label).join(", ")}`}
            >
              {branches.map((branch, index) => (
                <line
                  key={branch.id}
                  x1={CENTER}
                  y1={CENTER}
                  x2={positions[index].x}
                  y2={positions[index].y}
                  stroke="var(--color-luz)"
                  strokeOpacity={0.35}
                  strokeWidth={1.5}
                />
              ))}
            </svg>

            <div className="absolute inset-0">
              <BranchButton
                label={personName}
                x={50}
                y={50}
                primary
                onClick={() => setSelectedBranchId(null)}
              />
              {branches.map((branch, index) => (
                <BranchButton
                  key={branch.id}
                  label={branch.label}
                  count={branch.count}
                  x={percentPositions[index].x}
                  y={percentPositions[index].y}
                  active={branch.id === selectedBranchId}
                  onClick={() =>
                    setSelectedBranchId((current) => (current === branch.id ? null : branch.id))
                  }
                />
              ))}
            </div>
          </div>
        </div>

        {selectedBranch && (
          <BranchDetailPanel branch={selectedBranch} onClose={() => setSelectedBranchId(null)} />
        )}

        {!selectedBranch && (
          <p className="mt-6 text-center text-sm text-zinc-600">
            Este mapa crece contigo. Cada conversación construye más claridad sobre tu vida.
          </p>
        )}
      </div>

      <div className="flex w-full flex-col gap-4 lg:w-72 lg:flex-shrink-0">
        {showRelationships && summary.relationships.length > 0 && (
          <SidePanel
            title="Relaciones"
            count={summary.relationships.length}
            onClose={() => setShowRelationships(false)}
          >
            <ul className="space-y-3">
              {summary.relationships.slice(0, 6).map((relationship) => (
                <RelationshipRow key={relationship.id} relationship={relationship} />
              ))}
            </ul>
          </SidePanel>
        )}

        {showMemories && summary.timeline.length > 0 && (
          <SidePanel
            title="Recuerdos"
            count={memoriesTotal}
            onClose={() => setShowMemories(false)}
          >
            <ul className="space-y-3">
              {summary.timeline.slice(0, 5).map((memory) => (
                <MemoryRow key={memory.id} memory={memory} />
              ))}
            </ul>
            <Link
              href="/memories"
              className="mt-1 inline-block text-xs text-zinc-500 underline decoration-zinc-700 underline-offset-4 transition hover:text-zinc-300"
            >
              Ver todos
            </Link>
          </SidePanel>
        )}
      </div>
    </div>
  );
}

function ViewToggle({
  mode,
  onChange,
}: {
  mode: "map" | "list";
  onChange: (mode: "map" | "list") => void;
}) {
  return (
    <div className="inline-flex rounded-full border border-zinc-800 p-0.5 text-sm">
      <button
        type="button"
        onClick={() => onChange("map")}
        className={
          mode === "map"
            ? "rounded-full bg-zinc-800 px-3 py-1.5 text-white"
            : "rounded-full px-3 py-1.5 text-zinc-500 transition hover:text-white"
        }
      >
        Vista mapa
      </button>
      <button
        type="button"
        onClick={() => onChange("list")}
        className={
          mode === "list"
            ? "rounded-full bg-zinc-800 px-3 py-1.5 text-white"
            : "rounded-full px-3 py-1.5 text-zinc-500 transition hover:text-white"
        }
      >
        Vista lista
      </button>
    </div>
  );
}

function BranchButton({
  label,
  count,
  x,
  y,
  primary = false,
  active = false,
  onClick,
}: {
  label: string;
  count?: number;
  /** Porcentaje del contenedor (0-100), no píxeles -- ver `polarPositionPercent`. */
  x: number;
  y: number;
  primary?: boolean;
  active?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{ left: `${x}%`, top: `${y}%` }}
      className={
        (primary
          ? "-translate-x-1/2 -translate-y-1/2 rounded-full bg-white px-4 py-2.5 text-sm font-medium text-black shadow-[0_0_30px_rgba(227,177,104,0.25)] sm:px-6 sm:py-3 sm:text-base"
          : active
            ? "-translate-x-1/2 -translate-y-1/2 rounded-full border border-luz bg-zinc-900 px-3 py-2 text-xs text-white shadow-[0_0_18px_rgba(227,177,104,0.3)] sm:px-4 sm:py-2.5 sm:text-sm"
            : "-translate-x-1/2 -translate-y-1/2 rounded-full border border-zinc-700 bg-black px-3 py-2 text-xs text-zinc-200 transition hover:border-luz/60 hover:text-white sm:px-4 sm:py-2.5 sm:text-sm") +
        " absolute flex items-center gap-1.5 whitespace-nowrap focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-luz"
      }
    >
      {label}
      {typeof count === "number" && (
        <span className="text-xs text-zinc-500">{count}</span>
      )}
    </button>
  );
}

function BranchDetailPanel({
  branch,
  onClose,
}: {
  branch: LifeGraphBranch;
  onClose: () => void;
}) {
  return (
    <section className="animate-fade-in mt-6 rounded-2xl border border-zinc-800 bg-zinc-900/40 p-5">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-medium text-zinc-300">{branch.label}</h2>
        <button
          type="button"
          onClick={onClose}
          aria-label="Cerrar"
          className="text-zinc-500 transition hover:text-white focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-luz"
        >
          ✕
        </button>
      </div>

      {/*
        Desglose real por categoría (`Memory.type`/`Insight.type`) --
        lo que le faltaba a "Recuerdos"/"Lo que he entendido" para
        sentirse tan específico de esta persona como ya lo son
        "Objetivos"/"Relaciones" (que sí distinguen tipo por subtítulo).
        Solo se muestra cuando la rama trae categorías reales.
      */}
      {branch.categories && branch.categories.length > 0 && (
        <ul className="mt-3 flex flex-wrap gap-2">
          {branch.categories.map((category) => (
            <li
              key={category.label}
              className="rounded-full border border-zinc-700 px-3 py-1 text-xs text-zinc-400"
            >
              {category.label} <span className="text-zinc-600">{category.count}</span>
            </li>
          ))}
        </ul>
      )}

      {branch.items.length === 0 ? (
        <p className="mt-3 text-sm text-zinc-500">
          Todavía no hay nada aquí -- se va a ir llenando a medida que hablemos de esto.
        </p>
      ) : (
        <>
          <ul className="mt-3 space-y-2">
            {branch.items.map((item) => (
              <ItemRow key={item.id} item={item} />
            ))}
          </ul>
          {/* `count` es el total real; `items` puede venir recortado a un tope de exhibición -- aclarar la diferencia en vez de dejar que parezca que "solo hay 5" cuando en realidad hay más. */}
          {branch.count > branch.items.length && (
            <p className="mt-2 text-xs text-zinc-600">
              Mostrando {branch.items.length} de {branch.count}.
            </p>
          )}
        </>
      )}
    </section>
  );
}

function ItemRow({ item }: { item: LifeGraphItem }) {
  const border = item.celebrated
    ? "border-luz/30 hover:border-luz/60"
    : "border-zinc-800 hover:border-zinc-600";
  const opacity = item.muted ? "opacity-60 hover:opacity-100" : "";

  return (
    <li>
      <Link
        href={item.href}
        className={`flex items-center justify-between gap-3 rounded-lg border ${border} ${opacity} px-4 py-3 text-sm transition focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-luz`}
      >
        <span className="text-zinc-200">{item.title}</span>
        {item.subtitle && <span className="flex-shrink-0 text-xs text-zinc-500">{item.subtitle}</span>}
      </Link>
    </li>
  );
}

function SidePanel({
  title,
  count,
  onClose,
  children,
}: {
  title: string;
  count: number;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="animate-fade-in rounded-2xl border border-zinc-800 bg-zinc-900/40 p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-medium text-zinc-300">
          {title} <span className="text-xs text-zinc-600">{count}</span>
        </h2>
        <button
          type="button"
          onClick={onClose}
          aria-label={`Ocultar ${title}`}
          className="text-zinc-600 transition hover:text-white focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-luz"
        >
          ✕
        </button>
      </div>
      <div className="mt-3">{children}</div>
    </div>
  );
}

function RelationshipRow({ relationship }: { relationship: RelationshipWithDisplayName }) {
  return (
    <li>
      <Link
        href={`/life/relationships/${relationship.id}`}
        className="flex items-center gap-3 rounded-lg px-1 py-1 transition hover:bg-zinc-800/40 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-luz"
      >
        <span
          aria-hidden="true"
          className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-zinc-800 text-xs font-medium text-zinc-300"
        >
          {relationship.otherPersonName.charAt(0).toUpperCase()}
        </span>
        <span className="min-w-0">
          <span className="block truncate text-sm text-zinc-200">
            {relationship.otherPersonName}
          </span>
          <span className="block text-xs text-zinc-500">{RELATIONSHIP_TYPE_LABELS[relationship.type]}</span>
        </span>
      </Link>
    </li>
  );
}

function MemoryRow({ memory }: { memory: Memory }) {
  return (
    <li className="text-sm">
      <p className="text-zinc-500">
        {formatRelativeTime(memory.occurredAt ?? memory.createdAt)}
      </p>
      <p className="mt-0.5 text-zinc-300">&ldquo;{memory.content}&rdquo;</p>
    </li>
  );
}
