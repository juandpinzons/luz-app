import { and, eq, sql } from "drizzle-orm";
import { PERSON_TIME_ZONE } from "../../../core/config/person-time-zone";
import type { Database } from "../../../core/db/client";
import { memories } from "../../../core/db/schema";
import type { LifeGraphContext } from "../../../core/life";

export interface MemoryMonthBucket {
  /** "2026-08", clave estable para `?month=` en la URL. */
  month: string;
  /** "agosto 2026", ya formateado para mostrar. */
  label: string;
  count: number;
}

const MONTH_LABEL_FORMATTER = new Intl.DateTimeFormat("es-CO", {
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

function formatMonthLabel(month: string): string {
  const [year, monthNumber] = month.split("-").map(Number);
  const anchor = new Date(Date.UTC(year, monthNumber - 1, 1, 12, 0, 0));
  return MONTH_LABEL_FORMATTER.format(anchor);
}

/**
 * Índice liviano para la franja de meses de `/memories` -- separado a
 * propósito de `searchMemories`/`StructuredMemoryRetrievalStrategy`
 * (ver plan): esa mitad ordena por relevancia, esta pantalla necesita
 * orden cronológico real. Sin cap: acotado por meses distintos con
 * actividad (decenas, no miles, incluso para años de uso), nunca por
 * cantidad de memorias. No toca `content` (cifrado, ADR-0024) -- cero
 * costo de descifrado.
 *
 * El `AT TIME ZONE` es necesario, no cosmético: sin él, una memoria de
 * la 1am UTC del día 1 (aún el mes anterior en Bogotá) se agruparía en
 * el mes equivocado cerca de cada frontera de mes.
 */
export async function getMemoryTimelineIndex(
  db: Database,
  context: LifeGraphContext,
): Promise<MemoryMonthBucket[]> {
  const monthExpr = sql<string>`to_char(date_trunc('month', coalesce(${memories.occurredAt}, ${memories.createdAt}) AT TIME ZONE ${PERSON_TIME_ZONE}), 'YYYY-MM')`;

  const rows = await db
    .select({
      month: monthExpr,
      count: sql<number>`count(*)::int`,
    })
    .from(memories)
    .where(
      and(
        eq(memories.lifeGraphId, context.lifeGraphId),
        eq(memories.status, "active"),
        eq(memories.suppressed, false),
        eq(memories.hiddenFromUser, false),
      ),
    )
    // GROUP BY/ORDER BY por posición (1 = `month`), no repitiendo
    // `monthExpr` -- Drizzle renderiza la misma expresión con
    // calificación de columna distinta según la cláusula
    // (`occurred_at` sin calificar en el SELECT, `memories.occurred_at`
    // en GROUP BY/ORDER BY si se repite el fragmento), y Postgres las
    // trata como dos expresiones distintas ("column must appear in the
    // GROUP BY clause") -- confirmado corriendo esto contra Postgres
    // real. Por posición no hay forma de que difieran.
    .groupBy(sql`1`)
    .orderBy(sql`1 DESC`);

  return rows.map((row) => ({
    month: row.month,
    label: formatMonthLabel(row.month),
    count: row.count,
  }));
}
