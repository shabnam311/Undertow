CREATE TABLE "channel_performance" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"merchant_id" uuid NOT NULL,
	"channel" text NOT NULL,
	"tier" integer NOT NULL,
	"root_cause" text,
	"alpha" integer DEFAULT 1 NOT NULL,
	"beta" integer DEFAULT 1 NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "cases" ADD COLUMN "embedding" vector(384);--> statement-breakpoint
ALTER TABLE "channel_performance" ADD CONSTRAINT "channel_performance_merchant_id_merchants_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "public"."merchants"("id") ON DELETE no action ON UPDATE no action;