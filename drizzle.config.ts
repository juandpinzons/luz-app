import { defineConfig } from "drizzle-kit";
import { env } from "./core/config/env";

export default defineConfig({
  dialect: "postgresql",
  schema: "./core/db/schema/index.ts",
  out: "./core/db/migrations",
  dbCredentials: {
    url: env.DATABASE_URL,
  },
  strict: true,
  verbose: true,
});
