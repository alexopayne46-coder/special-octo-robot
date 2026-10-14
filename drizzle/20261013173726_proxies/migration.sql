CREATE TABLE "proxies" (
	"id" serial PRIMARY KEY,
	"type" text NOT NULL,
	"name" text NOT NULL UNIQUE,
	"host" text NOT NULL,
	"port" integer NOT NULL,
	"rotationUrl" text,
	"username" text NOT NULL,
	"password" text NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
