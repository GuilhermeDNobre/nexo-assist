import {
  boolean,
  index,
  integer,
  jsonb,
  numeric,
  pgSchema,
  real,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import {
  analystLevelEnum,
  authorTypeEnum,
  conversationOutcomeEnum,
  conversationStateEnum,
  draftActionEnum,
  draftStatusEnum,
  handoffEndActionEnum,
  summarySourceEnum,
  transferReasonEnum,
  userRoleEnum,
} from "./enums";

const appSchema = pgSchema("app");

export const users = appSchema.table("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  role: userRoleEnum("role").notNull(),
  analystLevel: analystLevelEnum("analyst_level"),
  deviceOs: text("device_os"),
});

export const conversations = appSchema.table("conversations", {
  id: uuid("id").primaryKey().defaultRandom(),
  employeeId: uuid("employee_id")
    .notNull()
    .unique()
    .references(() => users.id),
  state: conversationStateEnum("state").notNull().default("agent"),
  assignedAnalystId: uuid("assigned_analyst_id").references(() => users.id),
  transferReason: transferReasonEnum("transfer_reason"),
  transferConfidence: real("transfer_confidence"),
  awaitingSince: timestamp("awaiting_since", { withTimezone: true }),
  waitDueAt: timestamp("wait_due_at", { withTimezone: true }),
  activeTicketNumber: text("active_ticket_number"),
  lastOutcome: conversationOutcomeEnum("last_outcome"),
  analystLastReadAt: timestamp("analyst_last_read_at", { withTimezone: true }),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const messages = appSchema.table(
  "messages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    conversationId: uuid("conversation_id")
      .notNull()
      .references(() => conversations.id, { onDelete: "cascade" }),
    authorType: authorTypeEnum("author_type").notNull(),
    authorId: uuid("author_id").references(() => users.id),
    parts: jsonb("parts").$type<unknown[]>().notNull().default([]),
    countsTowardLimit: boolean("counts_toward_limit").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("messages_conversation_idx").on(t.conversationId, t.createdAt)],
);

export const decisions = appSchema.table(
  "decisions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    messageId: uuid("message_id")
      .notNull()
      .references(() => messages.id, { onDelete: "cascade" }),
    conversationId: uuid("conversation_id")
      .notNull()
      .references(() => conversations.id, { onDelete: "cascade" }),
    classifierSource: text("classifier_source").notNull(),
    classification: jsonb("classification").$type<Record<string, unknown>>().notNull(),
    action: text("action").notNull(),
    confidence: real("confidence"),
    ruleApplied: text("rule_applied"),
    rationale: text("rationale"),
    toolCalls: jsonb("tool_calls").$type<unknown[]>().notNull().default([]),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("decisions_conversation_idx").on(t.conversationId)],
);

export const drafts = appSchema.table(
  "drafts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    conversationId: uuid("conversation_id")
      .notNull()
      .references(() => conversations.id, { onDelete: "cascade" }),
    action: draftActionEnum("action").notNull(),
    targetTicketNumber: text("target_ticket_number"),
    payload: jsonb("payload").$type<Record<string, unknown>>().notNull(),
    status: draftStatusEnum("status").notNull().default("pending"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("drafts_conversation_idx").on(t.conversationId, t.status)],
);

export const handoffs = appSchema.table(
  "handoffs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    conversationId: uuid("conversation_id")
      .notNull()
      .references(() => conversations.id, { onDelete: "cascade" }),
    reason: transferReasonEnum("reason").notNull(),
    confidence: real("confidence"),
    summary: text("summary").notNull(),
    summarySource: summarySourceEnum("summary_source").notNull(),
    ticketNumber: text("ticket_number"),
    targetLevel: analystLevelEnum("target_level").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    assumedBy: uuid("assumed_by").references(() => users.id),
    assumedAt: timestamp("assumed_at", { withTimezone: true }),
    endedAt: timestamp("ended_at", { withTimezone: true }),
    endAction: handoffEndActionEnum("end_action"),
  },
  (t) => [index("handoffs_conversation_idx").on(t.conversationId)],
);

export const usageLedger = appSchema.table(
  "usage_ledger",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    conversationId: uuid("conversation_id")
      .notNull()
      .references(() => conversations.id, { onDelete: "cascade" }),
    provider: text("provider").notNull(),
    model: text("model").notNull(),
    inputTokens: integer("input_tokens").notNull(),
    outputTokens: integer("output_tokens").notNull(),
    costUsd: numeric("cost_usd", { precision: 12, scale: 6 }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("usage_ledger_conversation_idx").on(t.conversationId)],
);
