ALTER TABLE "insurance_plan" ALTER COLUMN "provider" SET DEFAULT 'nem';--> statement-breakpoint
ALTER TABLE "ledger_entry" ADD CONSTRAINT "ledger_entry_reference_unique" UNIQUE("reference");