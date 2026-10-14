CREATE TABLE "accounts" (
	"id" serial PRIMARY KEY,
	"name" text NOT NULL UNIQUE,
	"address" text NOT NULL UNIQUE,
	"tdataPath" text,
	"proxyId" integer,
	"enabled" boolean DEFAULT true NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "idx_accounts_proxy_id" ON "accounts" ("proxyId");--> statement-breakpoint
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_proxyId_proxies_id_fkey" FOREIGN KEY ("proxyId") REFERENCES "proxies"("id") ON DELETE SET NULL;