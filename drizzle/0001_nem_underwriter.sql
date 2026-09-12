CREATE TABLE "underwriter_transaction" (
	"id" text PRIMARY KEY NOT NULL,
	"orderId" text,
	"provider" text NOT NULL,
	"endpoint" text NOT NULL,
	"creditNoteNo" text NOT NULL,
	"status" text NOT NULL,
	"respCode" integer,
	"message" text,
	"request" jsonb,
	"response" jsonb,
	"createdAt" timestamp NOT NULL,
	CONSTRAINT "underwriter_transaction_creditNoteNo_unique" UNIQUE("creditNoteNo")
);
--> statement-breakpoint
ALTER TABLE "insurance_plan" ADD COLUMN "provider" text DEFAULT 'manual' NOT NULL;--> statement-breakpoint
ALTER TABLE "insurance_plan" ADD COLUMN "productCode" text;--> statement-breakpoint
ALTER TABLE "insurance_policy" ADD COLUMN "providerRef" text;--> statement-breakpoint
ALTER TABLE "insurance_policy" ADD COLUMN "naicomId" text;--> statement-breakpoint
ALTER TABLE "insurance_policy" ADD COLUMN "debitNoteUrl" text;--> statement-breakpoint
ALTER TABLE "insurance_policy" ADD COLUMN "creditNoteUrl" text;--> statement-breakpoint
ALTER TABLE "underwriter_transaction" ADD CONSTRAINT "underwriter_transaction_orderId_order_id_fk" FOREIGN KEY ("orderId") REFERENCES "public"."order"("id") ON DELETE set null ON UPDATE no action;