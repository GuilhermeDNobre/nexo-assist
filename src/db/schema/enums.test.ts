import { describe, expect, it } from "vitest";
import {
  authorTypeEnum,
  conversationOutcomeEnum,
  conversationStateEnum,
  draftActionEnum,
  draftStatusEnum,
  summarySourceEnum,
  ticketCategoryEnum,
  ticketPriorityEnum,
  ticketStatusEnum,
  ticketTypeEnum,
  transferReasonEnum,
  userRoleEnum,
  type TicketType,
} from "./enums";

describe("database enums", () => {
  it("exports the ticket type values used by the database enum", () => {
    const ticketType: TicketType = "INC";

    expect(ticketTypeEnum.enumValues).toEqual(["INC", "REQ"]);
    expect(ticketTypeEnum.enumValues).toContain(ticketType);
  });

  it("matches the ticket category values from the spec", () => {
    expect(ticketCategoryEnum.enumValues).toEqual([
      "access",
      "network_vpn",
      "hardware",
      "software",
      "email",
      "other",
    ]);
  });

  it("matches the ticket priority and status values from the spec", () => {
    expect(ticketPriorityEnum.enumValues).toEqual([
      "critical",
      "high",
      "medium",
      "low",
    ]);
    expect(ticketStatusEnum.enumValues).toEqual([
      "open",
      "awaiting_analyst",
      "in_progress",
      "approved",
      "resolved",
    ]);
  });

  it("matches the conversation and user values from the spec", () => {
    expect(userRoleEnum.enumValues).toEqual(["employee", "analyst"]);
    expect(conversationStateEnum.enumValues).toEqual([
      "agent",
      "awaiting_analyst",
      "with_analyst",
    ]);
    expect(conversationOutcomeEnum.enumValues).toEqual([
      "resolved_by_agent",
      "ticket_confirmed",
      "transferred",
      "closed_by_analyst",
    ]);
    expect(authorTypeEnum.enumValues).toEqual([
      "employee",
      "agent",
      "analyst",
      "system",
    ]);
  });

  it("matches the draft, transfer and summary values from the spec", () => {
    expect(draftActionEnum.enumValues).toEqual(["create", "update", "reopen"]);
    expect(draftStatusEnum.enumValues).toEqual([
      "pending",
      "confirmed",
      "cancelled",
    ]);
    expect(transferReasonEnum.enumValues).toEqual([
      "explicit_request",
      "critical",
      "overdue_accepted",
      "low_confidence",
    ]);
    expect(summarySourceEnum.enumValues).toEqual(["agent", "automatic"]);
  });
});
