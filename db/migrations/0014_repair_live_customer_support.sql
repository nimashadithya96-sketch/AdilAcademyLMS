-- Idempotent repair for projects where the original support migration was
-- recorded but its tables were not created in the active Replit database.
CREATE TABLE IF NOT EXISTS "support_conversations" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "public_token_hash" text NOT NULL,
  "channel" text DEFAULT 'FAQ' NOT NULL,
  "status" text DEFAULT 'OPEN' NOT NULL,
  "visitor_name" text,
  "visitor_email" text,
  "visitor_user_id" uuid REFERENCES "users"("id") ON DELETE SET NULL,
  "assigned_to" uuid REFERENCES "users"("id") ON DELETE SET NULL,
  "claimed_at" timestamptz,
  "closed_at" timestamptz,
  "last_message_at" timestamptz DEFAULT now() NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "support_conversations_token_unique" ON "support_conversations" ("public_token_hash");
CREATE INDEX IF NOT EXISTS "support_conversations_queue_idx" ON "support_conversations" ("status", "last_message_at");

CREATE TABLE IF NOT EXISTS "support_messages" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "conversation_id" uuid NOT NULL REFERENCES "support_conversations"("id") ON DELETE CASCADE,
  "sender_type" text NOT NULL,
  "sender_user_id" uuid REFERENCES "users"("id") ON DELETE SET NULL,
  "body" text NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "support_messages_conversation_idx" ON "support_messages" ("conversation_id", "created_at");

CREATE TABLE IF NOT EXISTS "support_agent_presence" (
  "user_id" uuid PRIMARY KEY REFERENCES "users"("id") ON DELETE CASCADE,
  "last_seen_at" timestamptz DEFAULT now() NOT NULL
);
