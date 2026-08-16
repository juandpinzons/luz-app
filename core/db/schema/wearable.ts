import { index, integer, pgTable, text, timestamp, uniqueIndex, uuid, type AnyPgColumn } from "drizzle-orm/pg-core";
import type { WearableProviderKind } from "../../wearable-metrics/domain";
import { lifeGraphs } from "./life-graph";

/**
 * Persistencia real de `DailyWearableMetrics` (`features/reality/domain/`)
 * -- a diferencia de Calendar/Gmail Foundation (que deliberadamente no
 * persisten nada porque siempre pueden volver a preguntarle al
 * proveedor en vivo), Wearable Foundation sí necesita persistir: la
 * fuente hoy es un archivo que la persona exportó una vez desde Garmin
 * Connect, no un servidor vivo al que se le pueda volver a preguntar.
 * Sin esta tabla, cada lectura tendría que volver a pedir el archivo,
 * algo estructuralmente imposible fuera del momento de importar.
 *
 * `provider` es `text().$type<>()`, no un enum de Postgres -- mismo
 * criterio que `calendarConnections.providerKind`/
 * `emailConnections.providerKind`: se espera que la lista de
 * proveedores crezca (Fitbit, Apple Health, Oura), y un enum de
 * Postgres exigiría una migración por cada uno.
 *
 * `date` es un día calendario (zona horaria ya resuelta por el
 * proveedor), guardado como `timestamp` a medianoche UTC por
 * consistencia con el resto del schema (sin precedente de una columna
 * `date` pura en este repo) -- comparar/ordenar siempre por día, nunca
 * por hora.
 *
 * Único índice compuesto (`lifeGraphId`, `provider`, `date`):
 * reimportar el mismo día (mismo archivo dos veces, o dos exports que
 * se solapan) actualiza la fila existente, nunca acumula duplicados.
 */
export const wearableDailyMetrics = pgTable(
  "wearable_daily_metrics",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    lifeGraphId: uuid("life_graph_id")
      .notNull()
      .references((): AnyPgColumn => lifeGraphs.id, { onDelete: "cascade" }),
    provider: text("provider").notNull().$type<WearableProviderKind>(),
    date: timestamp("date", { withTimezone: true }).notNull(),
    steps: integer("steps"),
    restingHeartRateBpm: integer("resting_heart_rate_bpm"),
    averageStressLevel: integer("average_stress_level"),
    sleepTotalMinutes: integer("sleep_total_minutes"),
    sleepDeepMinutes: integer("sleep_deep_minutes"),
    sleepLightMinutes: integer("sleep_light_minutes"),
    sleepRemMinutes: integer("sleep_rem_minutes"),
    sleepAwakeMinutes: integer("sleep_awake_minutes"),
    sleepQualityScore: integer("sleep_quality_score"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("wearable_daily_metrics_life_graph_provider_date_idx").on(
      table.lifeGraphId,
      table.provider,
      table.date,
    ),
    index("wearable_daily_metrics_life_graph_date_idx").on(table.lifeGraphId, table.date),
  ],
);

export type WearableDailyMetricsRow = typeof wearableDailyMetrics.$inferSelect;
export type NewWearableDailyMetricsRow = typeof wearableDailyMetrics.$inferInsert;
