CREATE TABLE "kyc_verification" (
	"id" text PRIMARY KEY NOT NULL,
	"userId" text NOT NULL,
	"provider" text DEFAULT 'swiftcheck' NOT NULL,
	"method" text NOT NULL,
	"outcome" text NOT NULL,
	"code" text,
	"message" text,
	"nameMatchScore" integer,
	"providerRequestId" text,
	"providerConsentId" text,
	"request" jsonb,
	"response" jsonb,
	"actorId" text,
	"createdAt" timestamp NOT NULL
);
--> statement-breakpoint
ALTER TABLE "kyc_profile" ADD COLUMN "ninMethod" text;--> statement-breakpoint
ALTER TABLE "kyc_profile" ADD COLUMN "ninMasked" text;--> statement-breakpoint
ALTER TABLE "kyc_profile" ADD COLUMN "ninVerified" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "kyc_profile" ADD COLUMN "verifiedName" text;--> statement-breakpoint
ALTER TABLE "kyc_profile" ADD COLUMN "verifiedDob" text;--> statement-breakpoint
ALTER TABLE "kyc_profile" ADD COLUMN "verifiedGender" text;--> statement-breakpoint
ALTER TABLE "kyc_profile" ADD COLUMN "verifiedPhone" text;--> statement-breakpoint
ALTER TABLE "kyc_profile" ADD COLUMN "verifiedState" text;--> statement-breakpoint
ALTER TABLE "kyc_profile" ADD COLUMN "photoOnFile" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "kyc_profile" ADD COLUMN "nameMatchScore" integer;--> statement-breakpoint
ALTER TABLE "kyc_profile" ADD COLUMN "providerRequestId" text;--> statement-breakpoint
ALTER TABLE "kyc_profile" ADD COLUMN "providerConsentId" text;--> statement-breakpoint
ALTER TABLE "kyc_profile" ADD COLUMN "verifiedAt" timestamp;--> statement-breakpoint
ALTER TABLE "kyc_verification" ADD CONSTRAINT "kyc_verification_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kyc_verification" ADD CONSTRAINT "kyc_verification_actorId_user_id_fk" FOREIGN KEY ("actorId") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;