import { rm } from "node:fs/promises";
import path from "node:path";

export default async function globalTeardown(): Promise<void> {
  await rm(path.join(process.cwd(), ".locks", "db-test"), {
    recursive: true,
    force: true,
  });
}
