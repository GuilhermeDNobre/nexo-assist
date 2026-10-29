import { mkdir, rm } from "node:fs/promises";
import path from "node:path";

const LOCK_TIMEOUT_MS = 120_000;
const RETRY_INTERVAL_MS = 100;
const LOCKS_DIR = path.join(process.cwd(), ".locks");
const LOCK_DIR = path.join(LOCKS_DIR, "db-test");

function isAlreadyExists(error: unknown): boolean {
  return (
    error instanceof Error && (error as NodeJS.ErrnoException).code === "EEXIST"
  );
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

export async function acquireDbLock(): Promise<() => Promise<void>> {
  await mkdir(LOCKS_DIR, { recursive: true });
  const startedAt = Date.now();
  for (;;) {
    try {
      await mkdir(LOCK_DIR);
      return async () => {
        await rm(LOCK_DIR, { recursive: true, force: true });
      };
    } catch (error) {
      if (!isAlreadyExists(error)) {
        throw error;
      }
      if (Date.now() - startedAt >= LOCK_TIMEOUT_MS) {
        throw new Error(`Timed out waiting for database lock at ${LOCK_DIR}`);
      }
      await wait(RETRY_INTERVAL_MS);
    }
  }
}

export async function withDbLock<T>(run: () => Promise<T>): Promise<T> {
  const release = await acquireDbLock();
  try {
    return await run();
  } finally {
    await release();
  }
}
