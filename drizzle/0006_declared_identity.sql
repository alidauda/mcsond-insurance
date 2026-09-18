ALTER TABLE "user" ADD COLUMN "phone" text;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "dateOfBirth" text;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "gender" text;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "stateOfOrigin" text;--> statement-breakpoint
ALTER TABLE "kyc_profile" ADD COLUMN "dobMatch" boolean;--> statement-breakpoint
ALTER TABLE "kyc_profile" ADD COLUMN "genderMatch" boolean;--> statement-breakpoint
ALTER TABLE "kyc_profile" ADD COLUMN "phoneMatch" boolean;