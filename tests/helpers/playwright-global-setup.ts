import { seedDatabase } from "../../src/db/seed";
import {
  createTestDatabase,
  createTestDatabaseIfMissing,
  migrateTestDatabase,
  truncateAllTables,
} from "./test-db";
import { acquireDbLock } from "./with-db-lock";

export default async function globalSetup(): Promise<void> {
  const release = await acquireDbLock();
  try {
    await createTestDatabaseIfMissing();
    const { db, pool } = createTestDatabase();
    try {
      await migrateTestDatabase(db);
      await truncateAllTables(pool);
      await seedDatabase(db);
    } finally {
      await pool.end();
    }
  } catch (error) {
    await release();
    throw error;
  }
}
