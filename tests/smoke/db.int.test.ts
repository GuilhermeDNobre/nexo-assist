import { sql } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { users } from "../../src/db/schema/app";
import {
  analystLevelEnum,
  authorTypeEnum,
  conversationOutcomeEnum,
  conversationStateEnum,
  draftActionEnum,
  draftStatusEnum,
  handoffEndActionEnum,
  summarySourceEnum,
  ticketCategoryEnum,
  ticketPriorityEnum,
  ticketStatusEnum,
  ticketTypeEnum,
  transferReasonEnum,
  userRoleEnum,
} from "../../src/db/schema/enums";
import { articles } from "../../src/db/schema/kb";
import { SEED_USER_IDS, seedUsers } from "../../src/db/seed/users";
import { withTestDatabase } from "../helpers/test-db";

const EXPECTED_TABLES = [
  "app.users",
  "app.conversations",
  "app.messages",
  "app.decisions",
  "app.drafts",
  "app.handoffs",
  "app.usage_ledger",
  "legacy.tickets",
  "legacy.ticket_events",
  "legacy.idempotency_keys",
  "kb.articles",
];

const EXPECTED_COLUMNS = [
  "app.conversations.active_ticket_number",
  "app.conversations.last_outcome",
  "app.handoffs.ticket_number",
  "app.handoffs.target_level",
  "app.handoffs.summary_source",
  "app.messages.counts_toward_limit",
  "legacy.idempotency_keys.key",
  "legacy.idempotency_keys.employee_id",
  "legacy.idempotency_keys.response",
  "legacy.idempotency_keys.created_at",
];

describe("database smoke test", () => {
  it("applies migrations and creates the app, legacy and kb schemas", async () => {
    await withTestDatabase(async ({ pool }) => {
      const result = await pool.query<{ schema_name: string }>(
        "SELECT schema_name FROM information_schema.schemata WHERE schema_name = ANY($1::text[])",
        [["app", "legacy", "kb"]],
      );

      expect(result.rows.map((row) => row.schema_name).sort()).toEqual([
        "app",
        "kb",
        "legacy",
      ]);
    });
  });

  it("creates every table from the tech spec", async () => {
    await withTestDatabase(async ({ pool }) => {
      const result = await pool.query<{
        table_schema: string;
        table_name: string;
      }>(
        `SELECT table_schema, table_name
           FROM information_schema.tables
          WHERE table_schema = ANY($1::text[])
            AND table_type = 'BASE TABLE'`,
        [["app", "legacy", "kb"]],
      );
      const tables = result.rows
        .map((row) => `${row.table_schema}.${row.table_name}`)
        .sort();

      expect(tables).toEqual([...EXPECTED_TABLES].sort());
    });
  });

  it("creates the linking columns required by the tech spec", async () => {
    await withTestDatabase(async ({ pool }) => {
      const result = await pool.query<{
        table_schema: string;
        table_name: string;
        column_name: string;
      }>(
        `SELECT table_schema, table_name, column_name
           FROM information_schema.columns
          WHERE table_schema = ANY($1::text[])`,
        [["app", "legacy", "kb"]],
      );
      const columns = result.rows.map(
        (row) => `${row.table_schema}.${row.table_name}.${row.column_name}`,
      );

      for (const column of EXPECTED_COLUMNS) {
        expect(columns, `missing column ${column}`).toContain(column);
      }
    });
  });

  it("seeds users with the fixed SEED_USER_IDS", async () => {
    await withTestDatabase(async ({ db }) => {
      await seedUsers(db);

      const rows = await db
        .select({ id: users.id, email: users.email, role: users.role })
        .from(users);

      expect(rows).toHaveLength(Object.keys(SEED_USER_IDS).length);
      expect(rows.map((row) => row.id)).toEqual(
        expect.arrayContaining(Object.values(SEED_USER_IDS)),
      );
      expect(rows).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            id: SEED_USER_IDS.anaSouza,
            email: "ana.souza@nexo.com.br",
            role: "employee",
          }),
          expect.objectContaining({
            id: SEED_USER_IDS.rafaelLima,
            email: "rafael.lima@nexo.com.br",
            role: "analyst",
          }),
        ]),
      );
    });
  });

  it("populates the generated kb.articles.search column", async () => {
    await withTestDatabase(async ({ db }) => {
      await db.insert(articles).values({
        title: "VPN erro 809",
        body: "Reinicie o cliente VPN e tente conectar novamente.",
      });

      const rows = await db.select({
        search: sql<string>`${articles.search}::text`,
        matches: sql<boolean>`${articles.search} @@ to_tsquery('portuguese', 'vpn')`,
      }).from(articles);

      expect(rows[0]?.search).toContain("vpn");
      expect(rows[0]?.matches).toBe(true);
    });
  });

  it("registers enum values in the database that match the TS types", async () => {
    const expectedEnums = [
      { schema: "app", type: "user_role", values: userRoleEnum.enumValues },
      { schema: "app", type: "analyst_level", values: analystLevelEnum.enumValues },
      { schema: "app", type: "conversation_state", values: conversationStateEnum.enumValues },
      { schema: "app", type: "conversation_outcome", values: conversationOutcomeEnum.enumValues },
      { schema: "app", type: "author_type", values: authorTypeEnum.enumValues },
      { schema: "app", type: "draft_action", values: draftActionEnum.enumValues },
      { schema: "app", type: "draft_status", values: draftStatusEnum.enumValues },
      { schema: "app", type: "transfer_reason", values: transferReasonEnum.enumValues },
      { schema: "app", type: "summary_source", values: summarySourceEnum.enumValues },
      { schema: "app", type: "handoff_end_action", values: handoffEndActionEnum.enumValues },
      { schema: "legacy", type: "ticket_type", values: ticketTypeEnum.enumValues },
      { schema: "legacy", type: "ticket_category", values: ticketCategoryEnum.enumValues },
      { schema: "legacy", type: "ticket_priority", values: ticketPriorityEnum.enumValues },
      { schema: "legacy", type: "ticket_status", values: ticketStatusEnum.enumValues },
    ];

    await withTestDatabase(async ({ pool }) => {
      const result = await pool.query<{
        schema_name: string;
        type_name: string;
        enumlabel: string;
      }>(
        `SELECT n.nspname AS schema_name, t.typname AS type_name, e.enumlabel
           FROM pg_enum e
           JOIN pg_type t ON t.oid = e.enumtypid
           JOIN pg_namespace n ON n.oid = t.typnamespace
          WHERE n.nspname IN ('app', 'legacy')
          ORDER BY n.nspname, t.typname, e.enumsortorder`,
      );

      const valuesFor = (schema: string, type: string) =>
        result.rows
          .filter(
            (row) => row.schema_name === schema && row.type_name === type,
          )
          .map((row) => row.enumlabel);

      for (const expected of expectedEnums) {
        expect(valuesFor(expected.schema, expected.type)).toEqual([
          ...expected.values,
        ]);
      }
    });
  });
});
