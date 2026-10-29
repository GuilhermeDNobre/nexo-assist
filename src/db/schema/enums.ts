import { pgSchema } from "drizzle-orm/pg-core";

const appSchema = pgSchema("app");
const legacySchema = pgSchema("legacy");

export const userRoleEnum = appSchema.enum("user_role", ["employee", "analyst"]);
export const analystLevelEnum = appSchema.enum("analyst_level", ["N1", "N2"]);
export const conversationStateEnum = appSchema.enum("conversation_state", [
  "agent",
  "awaiting_analyst",
  "with_analyst",
]);
export const conversationOutcomeEnum = appSchema.enum("conversation_outcome", [
  "resolved_by_agent",
  "ticket_confirmed",
  "transferred",
  "closed_by_analyst",
]);
export const authorTypeEnum = appSchema.enum("author_type", [
  "employee",
  "agent",
  "analyst",
  "system",
]);
export const draftActionEnum = appSchema.enum("draft_action", ["create", "update", "reopen"]);
export const draftStatusEnum = appSchema.enum("draft_status", [
  "pending",
  "confirmed",
  "cancelled",
]);
export const transferReasonEnum = appSchema.enum("transfer_reason", [
  "explicit_request",
  "critical",
  "overdue_accepted",
  "low_confidence",
]);
export const summarySourceEnum = appSchema.enum("summary_source", ["agent", "automatic"]);
export const handoffEndActionEnum = appSchema.enum("handoff_end_action", ["returned", "closed"]);

export const ticketTypeEnum = legacySchema.enum("ticket_type", ["INC", "REQ"]);
export const ticketCategoryEnum = legacySchema.enum("ticket_category", [
  "access",
  "network_vpn",
  "hardware",
  "software",
  "email",
  "other",
]);
export const ticketPriorityEnum = legacySchema.enum("ticket_priority", [
  "critical",
  "high",
  "medium",
  "low",
]);
export const ticketStatusEnum = legacySchema.enum("ticket_status", [
  "open",
  "awaiting_analyst",
  "in_progress",
  "approved",
  "resolved",
]);

export type UserRole = (typeof userRoleEnum.enumValues)[number];
export type AnalystLevel = (typeof analystLevelEnum.enumValues)[number];
export type ConversationState = (typeof conversationStateEnum.enumValues)[number];
export type ConversationOutcome = (typeof conversationOutcomeEnum.enumValues)[number];
export type AuthorType = (typeof authorTypeEnum.enumValues)[number];
export type DraftAction = (typeof draftActionEnum.enumValues)[number];
export type DraftStatus = (typeof draftStatusEnum.enumValues)[number];
export type TransferReason = (typeof transferReasonEnum.enumValues)[number];
export type SummarySource = (typeof summarySourceEnum.enumValues)[number];
export type TicketType = (typeof ticketTypeEnum.enumValues)[number];
export type TicketCategory = (typeof ticketCategoryEnum.enumValues)[number];
export type TicketPriority = (typeof ticketPriorityEnum.enumValues)[number];
export type TicketStatus = (typeof ticketStatusEnum.enumValues)[number];
