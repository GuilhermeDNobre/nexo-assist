import { index, jsonb, pgSchema, text, timestamp, uuid } from "drizzle-orm/pg-core";
import {
  ticketCategoryEnum,
  ticketPriorityEnum,
  ticketStatusEnum,
  ticketTypeEnum,
} from "./enums";

const legacySchema = pgSchema("legacy");

export const tickets = legacySchema.table(
  "tickets",
  {
    number: text("number").primaryKey(),
    type: ticketTypeEnum("type").notNull(),
    title: text("title").notNull(),
    description: text("description").notNull(),
    category: ticketCategoryEnum("category").notNull(),
    priority: ticketPriorityEnum("priority").notNull(),
    status: ticketStatusEnum("status").notNull(),
    affected: text("affected").notNull(),
    requesterId: uuid("requester_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
    dueAt: timestamp("due_at", { withTimezone: true }).notNull(),
  },
  (t) => [
    index("tickets_requester_idx").on(t.requesterId),
    index("tickets_status_idx").on(t.status),
  ],
);

export const ticketEvents = legacySchema.table(
  "ticket_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ticketNumber: text("ticket_number")
      .notNull()
      .references(() => tickets.number, { onDelete: "cascade" }),
    kind: text("kind").notNull(),
    body: text("body").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("ticket_events_ticket_idx").on(t.ticketNumber, t.createdAt)],
);

export const idempotencyKeys = legacySchema.table("idempotency_keys", {
  key: text("key").primaryKey(),
  employeeId: uuid("employee_id").notNull(),
  response: jsonb("response").$type<Record<string, unknown>>().notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
