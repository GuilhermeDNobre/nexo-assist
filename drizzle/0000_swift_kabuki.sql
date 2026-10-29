CREATE SCHEMA IF NOT EXISTS "app";--> statement-breakpoint
CREATE SCHEMA IF NOT EXISTS "legacy";--> statement-breakpoint
CREATE SCHEMA IF NOT EXISTS "kb";--> statement-breakpoint
CREATE TYPE "app"."analyst_level" AS ENUM('N1', 'N2');--> statement-breakpoint
CREATE TYPE "app"."author_type" AS ENUM('employee', 'agent', 'analyst', 'system');--> statement-breakpoint
CREATE TYPE "app"."conversation_outcome" AS ENUM('resolved_by_agent', 'ticket_confirmed', 'transferred', 'closed_by_analyst');--> statement-breakpoint
CREATE TYPE "app"."conversation_state" AS ENUM('agent', 'awaiting_analyst', 'with_analyst');--> statement-breakpoint
CREATE TYPE "app"."draft_action" AS ENUM('create', 'update', 'reopen');--> statement-breakpoint
CREATE TYPE "app"."draft_status" AS ENUM('pending', 'confirmed', 'cancelled');--> statement-breakpoint
CREATE TYPE "app"."handoff_end_action" AS ENUM('returned', 'closed');--> statement-breakpoint
CREATE TYPE "app"."summary_source" AS ENUM('agent', 'automatic');--> statement-breakpoint
CREATE TYPE "legacy"."ticket_category" AS ENUM('access', 'network_vpn', 'hardware', 'software', 'email', 'other');--> statement-breakpoint
CREATE TYPE "legacy"."ticket_priority" AS ENUM('critical', 'high', 'medium', 'low');--> statement-breakpoint
CREATE TYPE "legacy"."ticket_status" AS ENUM('open', 'awaiting_analyst', 'in_progress', 'approved', 'resolved');--> statement-breakpoint
CREATE TYPE "legacy"."ticket_type" AS ENUM('INC', 'REQ');--> statement-breakpoint
CREATE TYPE "app"."transfer_reason" AS ENUM('explicit_request', 'critical', 'overdue_accepted', 'low_confidence');--> statement-breakpoint
CREATE TYPE "app"."user_role" AS ENUM('employee', 'analyst');--> statement-breakpoint
CREATE TABLE "app"."conversations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"employee_id" uuid NOT NULL,
	"state" "app"."conversation_state" DEFAULT 'agent' NOT NULL,
	"assigned_analyst_id" uuid,
	"transfer_reason" "app"."transfer_reason",
	"transfer_confidence" real,
	"awaiting_since" timestamp with time zone,
	"wait_due_at" timestamp with time zone,
	"active_ticket_number" text,
	"last_outcome" "app"."conversation_outcome",
	"analyst_last_read_at" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "conversations_employee_id_unique" UNIQUE("employee_id")
);
--> statement-breakpoint
CREATE TABLE "app"."decisions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"message_id" uuid NOT NULL,
	"conversation_id" uuid NOT NULL,
	"classifier_source" text NOT NULL,
	"classification" jsonb NOT NULL,
	"action" text NOT NULL,
	"confidence" real,
	"rule_applied" text,
	"rationale" text,
	"tool_calls" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "app"."drafts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"conversation_id" uuid NOT NULL,
	"action" "app"."draft_action" NOT NULL,
	"target_ticket_number" text,
	"payload" jsonb NOT NULL,
	"status" "app"."draft_status" DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "app"."handoffs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"conversation_id" uuid NOT NULL,
	"reason" "app"."transfer_reason" NOT NULL,
	"confidence" real,
	"summary" text NOT NULL,
	"summary_source" "app"."summary_source" NOT NULL,
	"ticket_number" text,
	"target_level" "app"."analyst_level" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"assumed_by" uuid,
	"assumed_at" timestamp with time zone,
	"ended_at" timestamp with time zone,
	"end_action" "app"."handoff_end_action"
);
--> statement-breakpoint
CREATE TABLE "app"."messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"conversation_id" uuid NOT NULL,
	"author_type" "app"."author_type" NOT NULL,
	"author_id" uuid,
	"parts" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"counts_toward_limit" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "app"."usage_ledger" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"conversation_id" uuid NOT NULL,
	"provider" text NOT NULL,
	"model" text NOT NULL,
	"input_tokens" integer NOT NULL,
	"output_tokens" integer NOT NULL,
	"cost_usd" numeric(12, 6) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "app"."users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"name" text NOT NULL,
	"role" "app"."user_role" NOT NULL,
	"analyst_level" "app"."analyst_level",
	"device_os" text,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "legacy"."idempotency_keys" (
	"key" text PRIMARY KEY NOT NULL,
	"employee_id" uuid NOT NULL,
	"response" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "legacy"."ticket_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ticket_number" text NOT NULL,
	"kind" text NOT NULL,
	"body" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "legacy"."tickets" (
	"number" text PRIMARY KEY NOT NULL,
	"type" "legacy"."ticket_type" NOT NULL,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"category" "legacy"."ticket_category" NOT NULL,
	"priority" "legacy"."ticket_priority" NOT NULL,
	"status" "legacy"."ticket_status" NOT NULL,
	"affected" text NOT NULL,
	"requester_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"resolved_at" timestamp with time zone,
	"due_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "kb"."articles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"body" text NOT NULL,
	"applies_to" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"search" "tsvector" GENERATED ALWAYS AS (to_tsvector('portuguese', "title" || ' ' || "body")) STORED NOT NULL
);
--> statement-breakpoint
ALTER TABLE "app"."conversations" ADD CONSTRAINT "conversations_employee_id_users_id_fk" FOREIGN KEY ("employee_id") REFERENCES "app"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."conversations" ADD CONSTRAINT "conversations_assigned_analyst_id_users_id_fk" FOREIGN KEY ("assigned_analyst_id") REFERENCES "app"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."decisions" ADD CONSTRAINT "decisions_message_id_messages_id_fk" FOREIGN KEY ("message_id") REFERENCES "app"."messages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."decisions" ADD CONSTRAINT "decisions_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "app"."conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."drafts" ADD CONSTRAINT "drafts_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "app"."conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."handoffs" ADD CONSTRAINT "handoffs_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "app"."conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."handoffs" ADD CONSTRAINT "handoffs_assumed_by_users_id_fk" FOREIGN KEY ("assumed_by") REFERENCES "app"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."messages" ADD CONSTRAINT "messages_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "app"."conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."messages" ADD CONSTRAINT "messages_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "app"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."usage_ledger" ADD CONSTRAINT "usage_ledger_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "app"."conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "legacy"."ticket_events" ADD CONSTRAINT "ticket_events_ticket_number_tickets_number_fk" FOREIGN KEY ("ticket_number") REFERENCES "legacy"."tickets"("number") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "decisions_conversation_idx" ON "app"."decisions" USING btree ("conversation_id");--> statement-breakpoint
CREATE INDEX "drafts_conversation_idx" ON "app"."drafts" USING btree ("conversation_id","status");--> statement-breakpoint
CREATE INDEX "handoffs_conversation_idx" ON "app"."handoffs" USING btree ("conversation_id");--> statement-breakpoint
CREATE INDEX "messages_conversation_idx" ON "app"."messages" USING btree ("conversation_id","created_at");--> statement-breakpoint
CREATE INDEX "usage_ledger_conversation_idx" ON "app"."usage_ledger" USING btree ("conversation_id");--> statement-breakpoint
CREATE INDEX "ticket_events_ticket_idx" ON "legacy"."ticket_events" USING btree ("ticket_number","created_at");--> statement-breakpoint
CREATE INDEX "tickets_requester_idx" ON "legacy"."tickets" USING btree ("requester_id");--> statement-breakpoint
CREATE INDEX "tickets_status_idx" ON "legacy"."tickets" USING btree ("status");--> statement-breakpoint
CREATE INDEX "articles_search_idx" ON "kb"."articles" USING gin ("search");