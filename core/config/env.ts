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

  /**
   * Kimi (Moonshot AI) -- segundo `AIProvider` (`ai/providers/kimi-provider.ts`),
   * opcional a propósito: a diferencia de OpenAI, ningún consumidor real lo
   * usa todavía (registrado, sin actividad -- decisión explícita del
   * Founder), así que el sistema debe seguir arrancando sin estas tres
   * configuradas. `KIMI_MODEL`/`KIMI_BASE_URL` sí tienen default porque son
   * inertes sin `KIMI_API_KEY`: no cuesta nada dejarlos listos.
   */
  KIMI_API_KEY: z.string().min(1).optional(),
  KIMI_MODEL: z.string().min(1).default("kimi-k3"),
  KIMI_BASE_URL: z.string().min(1).default("https://api.moonshot.ai/v1"),

  WORKER_POLL_INTERVAL_MS: z.coerce.number().int().positive().default(5000),

  /**
   * Lista separada por comas de emails con acceso a /admin (Sprint de
   * Observabilidad, Alpha). Vacío por defecto — sin esto configurado,
   * /admin queda cerrado para todos, nunca abierto por accidente.
   */
  ADMIN_EMAILS: z.string().default(""),

  /**
   * Clave de cifrado (AES-256-GCM, `core/security/secret-cipher.ts`)
   * para credenciales de terceros que el dominio necesita guardar en
   * texto reversible -- hoy solo `AppleCalendarCredentials.appSpecificPassword`
   * (`core/calendar-connections/repository.ts`). 32 bytes en base64
   * (`openssl rand -base64 32`). Obligatoria: sin esto, ninguna
   * conexión de calendario puede guardarse ni leerse, nunca cae a
   * texto plano por defecto.
   */
  CALENDAR_CREDENTIALS_ENCRYPTION_KEY: z
    .string()
    .min(1, "CALENDAR_CREDENTIALS_ENCRYPTION_KEY es obligatorio (genera uno con: openssl rand -base64 32).")
    .refine(
      (value) => Buffer.from(value, "base64").length === 32,
      "CALENDAR_CREDENTIALS_ENCRYPTION_KEY debe decodificar a 32 bytes en base64 (genera uno con: openssl rand -base64 32).",
    ),

  /**
   * Clave de cifrado (AES-256-GCM, `core/security/content-cipher.ts`,
   * ADR-0024) para la SUSTANCIA del contenido -- memorias, creencias,
   * insights, conceptos, contradicciones, conclusiones de razonamiento,
   * mensajes de conversación, feedback, embeddings.content, y los
   * tokens OAuth de Auth.js. DISTINTA de
   * `CALENDAR_CREDENTIALS_ENCRYPTION_KEY` a propósito -- comprometer
   * una no debe comprometer la otra. 32 bytes en base64
   * (`openssl rand -base64 32`). Obligatoria: sin esto, nada de lo que
   * una persona dice puede guardarse ni leerse, nunca cae a texto
   * plano por defecto.
   */
  CONTENT_ENCRYPTION_KEY: z
    .string()
    .min(1, "CONTENT_ENCRYPTION_KEY es obligatorio (genera uno con: openssl rand -base64 32).")
    .refine(
      (value) => Buffer.from(value, "base64").length === 32,
      "CONTENT_ENCRYPTION_KEY debe decodificar a 32 bytes en base64 (genera uno con: openssl rand -base64 32).",
    ),

  /**
   * Push notifications vía APNs (misión "shell nativo iOS",
   * 2026-08-18) -- las cuatro, opcionales A PROPÓSITO, mismo criterio
   * que `KIMI_API_KEY`: la APNs Auth Key solo existe una vez que el
   * Founder complete la inscripción en Apple Developer Program (fuera
   * del alcance de este código). Hacerlas obligatorias rompería el
   * arranque de TODO el sistema en producción hasta que eso pase --
   * lección real de esta misma sesión con `CONTENT_ENCRYPTION_KEY`,
   * nunca repetir ese incidente por una función que ni siquiera
   * depende del resto del sistema. `sendPushNotification`
   * (`core/push-notifications/send-push-notification.ts`) se degrada a
   * un no-op logueado si faltan -- nunca falla en silencio total, nunca
   * tumba al llamador.
   */
  APNS_KEY_ID: z.string().min(1).optional(),
  APNS_TEAM_ID: z.string().min(1).optional(),
  APNS_PRIVATE_KEY: z.string().min(1).optional(),
  APNS_BUNDLE_ID: z.string().min(1).optional(),

  /**
   * Cloudflare Turnstile (Auditoría de seguridad, 2026-08-21) --
   * `core/security/verify-turnstile-token.ts`. Opcional a propósito,
   * mismo criterio que `APNS_*`: el site key/secret solo existen una
   * vez que el Founder cree el widget en
   * dash.cloudflare.com/turnstile (fuera del alcance de este código).
   * `verifyTurnstileToken` se degrada a "no verificado" de forma
   * explícita si falta -- ningún llamador debe tratar la ausencia como
   * un `true` silencioso.
   */
  TURNSTILE_SECRET_KEY: z.string().min(1).optional(),
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
