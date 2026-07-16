import { defineConfig } from "drizzle-kit";
import { env } from "./core/config/env";

export default defineConfig({
  dialect: "postgresql",
  // core/db/schema = dominio (users, conversations, memoria, etc.).
  // auth/schema = tablas exigidas por Auth.js (Identity Layer).
  // Separadas a propósito (ver auth/schema.ts), unidas aquí solo para
  // que drizzle-kit genere una única migración consistente.
  schema: ["./core/db/schema/index.ts", "./auth/schema.ts"],
  out: "./core/db/migrations",
  dbCredentials: {
    url: env.DATABASE_URL,
  },
  strict: true,
  verbose: true,
});
