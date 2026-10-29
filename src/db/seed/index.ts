import { existsSync } from "node:fs";
import path from "node:path";
import type { Database } from "../client";
import { seedKnowledgeBase } from "./knowledge-base";
import { seedLegacyTickets } from "./legacy-tickets";
import { seedUsers } from "./users";

export async function seedDatabase(database: Database): Promise<void> {
  await seedUsers(database);
  await seedLegacyTickets(database);
  await seedKnowledgeBase(database);
}

async function runSeed(): Promise<void> {
  if (existsSync(".env")) {
    process.loadEnvFile(".env");
  }
  const { db, pool } = await import("../client");
  try {
    await seedDatabase(db);
    console.log("Seed completed");
  } catch (error) {
    console.error("Seed failed", {
      error: error instanceof Error ? error.message : "Unknown error",
    });
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

const entryPoint = process.argv[1];
const seedScriptPath = path.resolve("src/db/seed/index.ts");
if (entryPoint && path.resolve(entryPoint) === seedScriptPath) {
  void runSeed();
}
