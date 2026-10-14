CREATE TABLE "ad_campaigns" (
	"id" serial PRIMARY KEY,
	"name" text NOT NULL,
	"time" jsonb NOT NULL,
	"payload" jsonb NOT NULL,
	"campaignType" text DEFAULT 'SPM::SendToChats' NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"addressesForCampaign" jsonb NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "campaign_artifacts" (
	"id" serial PRIMARY KEY,
	"campaignId" integer NOT NULL,
	"text" text NOT NULL,
	"mood" text DEFAULT 'neutral' NOT NULL,
	"payload" jsonb NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "chat_groups" (
	"id" serial PRIMARY KEY,
	"name" text NOT NULL UNIQUE,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "chats" (
	"id" serial PRIMARY KEY,
	"peerId" bigint,
	"title" text,
	"username" text,
	"groupId" integer,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lookalike_users" (
	"id" serial PRIMARY KEY,
	"chatSeen" timestamp with time zone NOT NULL,
	"chatId" bigint NOT NULL,
	"peerId" bigint NOT NULL,
	"name" text NOT NULL,
	"username" text,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY,
	"name" text NOT NULL,
	"tgid" text UNIQUE,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "idx_status" ON "ad_campaigns" ("status");--> statement-breakpoint
CREATE INDEX "idx_campaign_type" ON "ad_campaigns" ("campaignType");--> statement-breakpoint
CREATE INDEX "idx_artifacts_campaign_id" ON "campaign_artifacts" ("campaignId");--> statement-breakpoint
CREATE INDEX "idx_artifacts_mood" ON "campaign_artifacts" ("mood");--> statement-breakpoint
CREATE INDEX "idx_username" ON "chats" ("username");--> statement-breakpoint
CREATE INDEX "idx_chats_peer_id" ON "chats" ("peerId");--> statement-breakpoint
CREATE INDEX "idx_group_id" ON "chats" ("groupId");--> statement-breakpoint
CREATE UNIQUE INDEX "lookalike_users_chat_id_peer_id_key" ON "lookalike_users" ("chatId","peerId");--> statement-breakpoint
CREATE INDEX "idx_chat_id" ON "lookalike_users" ("chatId");--> statement-breakpoint
CREATE INDEX "idx_peer_id" ON "lookalike_users" ("peerId");