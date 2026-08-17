import * as Sentry from "@sentry/nextjs";
import { scrubSentryEvent } from "./core/observability/sentry-scrub";

/** Mismo criterio que `sentry.server.config.ts` -- inerte sin DSN. */
Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: 0.1,
  sendDefaultPii: false,
  beforeSend: scrubSentryEvent,
  debug: false,
});
