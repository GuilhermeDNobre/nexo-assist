import { existsSync } from "node:fs";
import path from "node:path";
import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Client, Pool } from "pg";
import * as schema from "../../src/db/schema";
import { withDbLock } from "./with-db-lock";

if (existsSync(".env")) {
  process.loadEnvFile(".env");
}

const TEST_SCHEMAS = ["app", "legacy", "kb"];

export type TestDatabase = {
  db: NodePgDatabase<typeof schema>;
  pool: Pool;
};

export function getTestDatabaseUrl(): string {
  const url = process.env.DATABASE_URL_TEST;
  if (!url) {
    throw new Error("DATABASE_URL_TEST is required to run database tests");
  }
  return url;
}

export async function createTestDatabaseIfMissing(): Promise<void> {
  const url = new URL(getTestDatabaseUrl());
  const databaseName = url.pathname.replace(/^\//, "");
  if (!databaseName) {
    throw new Error("DATABASE_URL_TEST must include a database name");
  }
  const adminUrl = new URL(url);
  adminUrl.pathname = "/postgres";
  const adminClient = new Client({ connectionString: adminUrl.toString() });
  await adminClient.connect();
  try {
    const result = await adminClient.query<{ exists: boolean }>(
      "SELECT EXISTS(SELECT 1 FROM pg_database WHERE datname = $1) AS exists",
      [databaseName],
    );
    if (!result.rows[0]?.exists) {
      const quotedName = adminClient.escapeIdentifier(databaseName);
      await adminClient.query(`CREATE DATABASE ${quotedName}`);
    }
  } finally {
    await adminClient.end();
  }
}

export function createTestDatabase(): TestDatabase {
  const pool = new Pool({ connectionString: getTestDatabaseUrl() });
  const db = drizzle(pool, { schema });
  return { db, pool };
}

export async function migrateTestDatabase(
  database: NodePgDatabase<typeof schema>,
): Promise<void> {
  await migrate(database, {
    migrationsFolder: path.join(process.cwd(), "drizzle"),
  });
}

export async function truncateAllTables(pool: Pool): Promise<void> {
  const result = await pool.query<{ schema_name: string; table_name: string }>(
    `SELECT table_schema AS schema_name, table_name
       FROM information_schema.tables
      WHERE table_schema = ANY($1::text[])
        AND table_type = 'BASE TABLE'`,
    [TEST_SCHEMAS],
  );
  if (result.rows.length === 0) {
    return;
  }
  const tables = result.rows
    .map((row) => `"${row.schema_name}"."${row.table_name}"`)
    .join(", ");
  await pool.query(`TRUNCATE TABLE ${tables} RESTART IDENTITY CASCADE`);
}

export async function withTestDatabase<T>(
  run: (context: TestDatabase) => Promise<T>,
): Promise<T> {
  return withDbLock(async () => {
    await createTestDatabaseIfMissing();
    const context = createTestDatabase();
    try {
      await migrateTestDatabase(context.db);
      await truncateAllTables(context.pool);
      return await run(context);
    } finally {
      await context.pool.end();
    }
  });
}
