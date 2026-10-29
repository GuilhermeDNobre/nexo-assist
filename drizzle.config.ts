import { existsSync } from "node:fs";
import { defineConfig } from "drizzle-kit";

if (existsSync(".env")) {
  process.loadEnvFile(".env");
}

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/db/schema/index.ts",
  out: "./drizzle",
  schemaFilter: ["app", "legacy", "kb"],
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "postgresql://nexo:nexo@localhost:5432/nexo",
  },
  strict: true,
  verbose: true,
});
