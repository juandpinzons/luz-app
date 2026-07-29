import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { db } from "@/core/db/client";
import { users } from "@/core/db/schema";
import { submitFeedback } from "@/features/feedback/services/submit-feedback";

/**
 * TEMPORAL -- root-causing el bug de "¿Cómo vamos?" (feedback) contra
 * el estado real de producción. Gateado por un secreto de un solo uso
 * (DIAG_SECRET), no por sesión -- se elimina en el mismo bloque de
 * trabajo, no queda como deuda técnica.
 */
function isAuthorized(request: Request): boolean {
  const secret = process.env.DIAG_SECRET;
  if (!secret) return false;
  return request.headers.get("x-diag-secret") === secret;
}

export async function GET(request: Request): Promise<Response> {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }

  const report: Record<string, unknown> = {};

  try {
    const migrations = await db.execute(
      sql`select hash, created_at from drizzle.__drizzle_migrations order by created_at`,
    );
    report.migrations = migrations;
  } catch (e) {
    report.migrationsError = e instanceof Error ? e.message : String(e);
  }

  try {
    const t = await db.execute(
      sql`select to_regclass('public.feedback_responses') as t`,
    );
    report.feedbackTableExists = t;
  } catch (e) {
    report.feedbackTableError = e instanceof Error ? e.message : String(e);
  }

  try {
    const count = await db.execute(sql`select count(*) from feedback_responses`);
    report.feedbackCount = count;
  } catch (e) {
    report.feedbackCountError = e instanceof Error ? e.message : String(e);
  }

  try {
    const recentErrors = await db.execute(
      sql`select route, message, created_at from events where type = 'error' and (route ilike '%feedback%' or message ilike '%feedback%') order by created_at desc limit 15`,
    );
    report.feedbackRelatedErrors = recentErrors;
  } catch (e) {
    report.feedbackRelatedErrorsError = e instanceof Error ? e.message : String(e);
  }

  try {
    const allRecentErrors = await db.execute(
      sql`select route, message, created_at from events where type = 'error' order by created_at desc limit 10`,
    );
    report.recentErrorsAnyRoute = allRecentErrors;
  } catch (e) {
    report.recentErrorsAnyRouteError = e instanceof Error ? e.message : String(e);
  }

  return NextResponse.json(report);
}

/**
 * Aplica manualmente la migración 0010 (feedback_responses), huérfana
 * en prod porque el `migrate` de drizzle avanza un cursor por
 * timestamp: al forzar 0011 fuera de orden el 2026-07-24, el cursor
 * quedó por delante del `when` de 0010, así que todo `drizzle-kit
 * migrate` futuro la salta para siempre. Idempotente a propósito
 * (puede llamarse más de una vez sin romper nada).
 */
export async function POST(request: Request): Promise<Response> {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }

  const steps: Record<string, string> = {};

  try {
    await db.execute(sql`
      do $$
      begin
        if not exists (select 1 from pg_type where typname = 'feedback_remembers_me') then
          create type "public"."feedback_remembers_me" as enum('yes', 'no', 'unsure');
        end if;
      end
      $$;
    `);
    steps.enum = "ok";
  } catch (e) {
    steps.enum = `error: ${e instanceof Error ? e.message : String(e)}`;
  }

  try {
    await db.execute(sql`
      create table if not exists "feedback_responses" (
        "id" uuid primary key default gen_random_uuid() not null,
        "user_id" uuid not null,
        "helpfulness" integer not null,
        "remembers_me" "feedback_remembers_me" not null,
        "comment" text,
        "created_at" timestamp with time zone default now() not null
      );
    `);
    steps.table = "ok";
  } catch (e) {
    steps.table = `error: ${e instanceof Error ? e.message : String(e)}`;
  }

  try {
    await db.execute(sql`
      do $$
      begin
        if not exists (
          select 1 from information_schema.table_constraints
          where constraint_name = 'feedback_responses_user_id_users_id_fk'
        ) then
          alter table "feedback_responses"
            add constraint "feedback_responses_user_id_users_id_fk"
            foreign key ("user_id") references "public"."users"("id")
            on delete cascade on update no action;
        end if;
      end
      $$;
    `);
    steps.fk = "ok";
  } catch (e) {
    steps.fk = `error: ${e instanceof Error ? e.message : String(e)}`;
  }

  try {
    await db.execute(
      sql`create index if not exists "feedback_responses_user_id_idx" on "feedback_responses" using btree ("user_id")`,
    );
    await db.execute(
      sql`create index if not exists "feedback_responses_created_at_idx" on "feedback_responses" using btree ("created_at")`,
    );
    steps.indexes = "ok";
  } catch (e) {
    steps.indexes = `error: ${e instanceof Error ? e.message : String(e)}`;
  }

  try {
    await db.execute(sql`
      insert into drizzle.__drizzle_migrations (hash, created_at)
      values (
        'eafe11549cf908021357532364f7f3e0f790d8e8d2fc2cacea5e92710f1a378c',
        1784489467988
      )
      on conflict do nothing;
    `);
    steps.bookkeeping = "ok";
  } catch (e) {
    steps.bookkeeping = `error: ${e instanceof Error ? e.message : String(e)}`;
  }

  try {
    const check = await db.execute(
      sql`select to_regclass('public.feedback_responses') as t`,
    );
    steps.verify = JSON.stringify(check);
  } catch (e) {
    steps.verify = `error: ${e instanceof Error ? e.message : String(e)}`;
  }

  return NextResponse.json(steps);
}

/**
 * Prueba extremo a extremo con la función real de la aplicación
 * (no SQL a mano): toma un usuario real existente, llama a
 * `submitFeedback` -- el mismo código que corre `POST /api/feedback`
 * -- y confirma que la fila queda visible con la misma consulta que
 * usa `app/admin/page.tsx`. Se limpia con DELETE inmediatamente
 * después de verificar.
 */
export async function PUT(request: Request): Promise<Response> {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }

  const [someUser] = await db.select({ id: users.id }).from(users).limit(1);
  if (!someUser) {
    return NextResponse.json({ error: "No hay usuarios reales para probar." }, { status: 400 });
  }

  const result = await submitFeedback(
    { userId: someUser.id },
    { helpfulness: 5, remembersMe: "yes", comment: "__internal_diag_e2e_probe__" },
  );

  const visibleRow = await db.execute(
    sql`select id, helpfulness, remembers_me, comment, created_at from feedback_responses where id = ${result.id}`,
  );

  return NextResponse.json({ inserted: result, visibleViaAdminQuery: visibleRow });
}

export async function DELETE(request: Request): Promise<Response> {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }

  const deleted = await db.execute(
    sql`delete from feedback_responses where comment = '__internal_diag_e2e_probe__' returning id`,
  );

  return NextResponse.json({ deleted });
}
