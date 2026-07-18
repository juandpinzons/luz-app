import { z } from "zod";

/**
 * Esquema de variables de entorno del dominio.
 *
 * Este módulo pertenece a `core/` y por lo tanto NO debe depender de Next.js,
 * React ni de ningún runtime específico. Solo usa `process.env`, disponible
 * en cualquier entorno Node (web, worker, CLI, futuras APIs).
 */
const envSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),

  DATABASE_URL: z
    .string()
    .min(1, "DATABASE_URL es obligatorio (conexión a PostgreSQL)."),

  OPENAI_API_KEY: z.string().min(1, "OPENAI_API_KEY es obligatorio."),
  OPENAI_MODEL: z.string().min(1, "OPENAI_MODEL es obligatorio."),

  WORKER_POLL_INTERVAL_MS: z.coerce.number().int().positive().default(5000),

  /**
   * Lista separada por comas de emails con acceso a /admin (Sprint de
   * Observabilidad, Alpha). Vacío por defecto — sin esto configurado,
   * /admin queda cerrado para todos, nunca abierto por accidente.
   */
  ADMIN_EMAILS: z.string().default(""),
});

export type Env = z.infer<typeof envSchema>;

function loadEnv(): Env {
  const parsed = envSchema.safeParse(process.env);

  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((issue) => `  - ${issue.path.join(".")}: ${issue.message}`)
      .join("\n");

    throw new Error(
      `Configuración de entorno inválida.\n${issues}\n\nRevisa tu archivo .env contra .env.example.`,
    );
  }

  return parsed.data;
}

/**
 * Configuración de entorno validada y tipada, cargada una sola vez.
 * Cualquier módulo de `core/`, `features/`, `ai/` o `worker/` debe leer
 * la configuración a través de este objeto, nunca de `process.env` directo.
 */
export const env: Env = loadEnv();
