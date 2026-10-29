import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { getServerEnv } from "../env";
import * as schema from "./schema";

const serverEnv = getServerEnv();

export const pool = new Pool({ connectionString: serverEnv.DATABASE_URL });

export const db = drizzle(pool, { schema });

export type Database = NodePgDatabase<typeof schema>;
