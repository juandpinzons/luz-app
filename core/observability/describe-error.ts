/**
 * Extrae el detalle real de un error para `logger.log` — nunca solo
 * `error.message`. Un error de Postgres (vía `postgres`/`postgres-js`,
 * que usa `core/db/client.ts`) trae `code` (SQLSTATE — p. ej. `42P01`
 * "relation does not exist", `28P01` credenciales inválidas, `42501`
 * permisos insuficientes), `detail`, `hint`, `schema_name`,
 * `table_name`, `column_name` — información que distingue "no existe
 * la tabla" de "no hay permiso" de "la conexión falló", que un
 * `error.message` genérico puede no dejar claro. Nunca se asume cuál
 * de los dos era antes de tener esto — por eso existe esta función.
 */
export function describeError(error: unknown): Record<string, unknown> {
  if (!(error instanceof Error)) {
    return { errorRaw: String(error) };
  }

  const pgError = error as Error & {
    code?: string;
    detail?: string;
    hint?: string;
    severity?: string;
    schema_name?: string;
    table_name?: string;
    column_name?: string;
    routine?: string;
    query?: string;
    parameters?: unknown;
    cause?: unknown;
  };

  return {
    errorName: pgError.name,
    errorMessage: pgError.message,
    // SQLSTATE de Postgres, si el error vino del driver — no confundir
    // con un status HTTP.
    errorCode: pgError.code,
    errorDetail: pgError.detail,
    errorHint: pgError.hint,
    errorSeverity: pgError.severity,
    errorSchema: pgError.schema_name,
    errorTable: pgError.table_name,
    errorColumn: pgError.column_name,
    errorRoutine: pgError.routine,
    // Algunas versiones de postgres-js adjuntan el SQL real que falló.
    errorQuery: pgError.query,
    errorParameters: pgError.parameters,
    errorCause:
      pgError.cause instanceof Error ? pgError.cause.message : pgError.cause,
    errorStack: pgError.stack,
  };
}
