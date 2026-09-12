CREATE TABLE "account" (
	"id" text PRIMARY KEY NOT NULL,
	"accountId" text NOT NULL,
	"providerId" text NOT NULL,
	"userId" text NOT NULL,
	"accessToken" text,
	"refreshToken" text,
	"idToken" text,
	"accessTokenExpiresAt" timestamp,
	"refreshTokenExpiresAt" timestamp,
	"scope" text,
	"password" text,
	"createdAt" timestamp NOT NULL,
	"updatedAt" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "session" (
	"id" text PRIMARY KEY NOT NULL,
	"expiresAt" timestamp NOT NULL,
	"token" text NOT NULL,
	"createdAt" timestamp NOT NULL,
	"updatedAt" timestamp NOT NULL,
	"ipAddress" text,
	"userAgent" text,
	"userId" text NOT NULL,
	"impersonatedBy" text,
	CONSTRAINT "session_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "staff_invite" (
	"id" text PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"role" text NOT NULL,
	"status" text NOT NULL,
	"invitedByEmail" text,
	"createdAt" timestamp NOT NULL,
	"expiresAt" timestamp
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"emailVerified" boolean NOT NULL,
	"image" text,
	"createdAt" timestamp NOT NULL,
	"updatedAt" timestamp NOT NULL,
	"role" text,
	"banned" boolean,
	"banReason" text,
	"banExpires" timestamp,
	"company" text,
	"kyc" text,
	CONSTRAINT "user_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "verification" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expiresAt" timestamp NOT NULL,
	"createdAt" timestamp,
	"updatedAt" timestamp
);
--> statement-breakpoint
CREATE TABLE "audit_entry" (
	"id" text PRIMARY KEY NOT NULL,
	"seq" bigserial NOT NULL,
	"actorId" text,
	"actorName" text,
	"action" text,
	"actionTone" text,
	"targetType" text,
	"targetRef" text,
	"detail" text,
	"prevHash" text,
	"hash" text,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "insurance_plan" (
	"id" text PRIMARY KEY NOT NULL,
	"reference" text NOT NULL,
	"name" text,
	"underwriter" text,
	"premium" integer,
	"term" text,
	"category" text,
	"popular" boolean DEFAULT false,
	"features" jsonb,
	"active" boolean DEFAULT true,
	"updatedAt" timestamp,
	CONSTRAINT "insurance_plan_reference_unique" UNIQUE("reference")
);
--> statement-breakpoint
CREATE TABLE "insurance_policy" (
	"orderId" text PRIMARY KEY NOT NULL,
	"planId" text,
	"underwriter" text,
	"policyNo" text,
	"periodStart" timestamp,
	"periodEnd" timestamp,
	"termMonths" integer,
	"sumInsured" integer,
	"basePremium" integer,
	"stampDuty" integer,
	"vat" integer,
	"insuredParty" text,
	"details" jsonb,
	"certificateUrl" text,
	"boundAt" timestamp
);
--> statement-breakpoint
CREATE TABLE "integration" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text,
	"note" text,
	"status" text,
	"updatedAt" timestamp
);
--> statement-breakpoint
CREATE TABLE "kyc_profile" (
	"userId" text PRIMARY KEY NOT NULL,
	"bvnMasked" text,
	"bvnVerified" boolean DEFAULT false,
	"utilityBill" boolean DEFAULT false,
	"idCard" boolean DEFAULT false,
	"reviewedBy" text,
	"reviewedAt" timestamp
);
--> statement-breakpoint
CREATE TABLE "ledger_entry" (
	"id" text PRIMARY KEY NOT NULL,
	"walletId" text NOT NULL,
	"userId" text NOT NULL,
	"reference" text,
	"type" text NOT NULL,
	"description" text,
	"amount" integer NOT NULL,
	"balanceBefore" integer,
	"runningBalance" integer NOT NULL,
	"orderId" text,
	"createdBy" text,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "order" (
	"id" text PRIMARY KEY NOT NULL,
	"reference" text NOT NULL,
	"userId" text NOT NULL,
	"kind" text NOT NULL,
	"total" integer NOT NULL,
	"stage" text NOT NULL,
	"createdAt" timestamp NOT NULL,
	"paidAt" timestamp,
	CONSTRAINT "order_reference_unique" UNIQUE("reference")
);
--> statement-breakpoint
CREATE TABLE "paystack_transaction" (
	"id" text PRIMARY KEY NOT NULL,
	"reference" text NOT NULL,
	"userId" text NOT NULL,
	"amount" integer NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"channel" text,
	"gatewayResponse" text,
	"paidAt" timestamp,
	"createdAt" timestamp NOT NULL,
	"updatedAt" timestamp NOT NULL,
	CONSTRAINT "paystack_transaction_reference_unique" UNIQUE("reference")
);
--> statement-breakpoint
CREATE TABLE "setting" (
	"key" text PRIMARY KEY NOT NULL,
	"value" jsonb
);
--> statement-breakpoint
CREATE TABLE "ticket" (
	"id" text PRIMARY KEY NOT NULL,
	"reference" text NOT NULL,
	"userId" text NOT NULL,
	"subject" text,
	"channel" text,
	"priority" text,
	"status" text,
	"assignedTo" text,
	"orderId" text,
	"slaDueAt" timestamp,
	"createdAt" timestamp NOT NULL,
	"updatedAt" timestamp NOT NULL,
	CONSTRAINT "ticket_reference_unique" UNIQUE("reference")
);
--> statement-breakpoint
CREATE TABLE "ticket_message" (
	"id" text PRIMARY KEY NOT NULL,
	"ticketId" text NOT NULL,
	"authorId" text,
	"authorName" text,
	"authorRole" text,
	"body" text,
	"internal" boolean DEFAULT false NOT NULL,
	"createdAt" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "wallet" (
	"id" text PRIMARY KEY NOT NULL,
	"reference" text NOT NULL,
	"userId" text NOT NULL,
	"balance" integer DEFAULT 0 NOT NULL,
	"earmarked" integer DEFAULT 0 NOT NULL,
	"createdAt" timestamp NOT NULL,
	"updatedAt" timestamp NOT NULL,
	CONSTRAINT "wallet_reference_unique" UNIQUE("reference"),
	CONSTRAINT "wallet_userId_unique" UNIQUE("userId")
);
--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_entry" ADD CONSTRAINT "audit_entry_actorId_user_id_fk" FOREIGN KEY ("actorId") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "insurance_policy" ADD CONSTRAINT "insurance_policy_orderId_order_id_fk" FOREIGN KEY ("orderId") REFERENCES "public"."order"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "insurance_policy" ADD CONSTRAINT "insurance_policy_planId_insurance_plan_id_fk" FOREIGN KEY ("planId") REFERENCES "public"."insurance_plan"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kyc_profile" ADD CONSTRAINT "kyc_profile_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kyc_profile" ADD CONSTRAINT "kyc_profile_reviewedBy_user_id_fk" FOREIGN KEY ("reviewedBy") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ledger_entry" ADD CONSTRAINT "ledger_entry_walletId_wallet_id_fk" FOREIGN KEY ("walletId") REFERENCES "public"."wallet"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ledger_entry" ADD CONSTRAINT "ledger_entry_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ledger_entry" ADD CONSTRAINT "ledger_entry_orderId_order_id_fk" FOREIGN KEY ("orderId") REFERENCES "public"."order"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ledger_entry" ADD CONSTRAINT "ledger_entry_createdBy_user_id_fk" FOREIGN KEY ("createdBy") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order" ADD CONSTRAINT "order_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "paystack_transaction" ADD CONSTRAINT "paystack_transaction_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ticket" ADD CONSTRAINT "ticket_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ticket" ADD CONSTRAINT "ticket_assignedTo_user_id_fk" FOREIGN KEY ("assignedTo") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ticket" ADD CONSTRAINT "ticket_orderId_order_id_fk" FOREIGN KEY ("orderId") REFERENCES "public"."order"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ticket_message" ADD CONSTRAINT "ticket_message_ticketId_ticket_id_fk" FOREIGN KEY ("ticketId") REFERENCES "public"."ticket"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ticket_message" ADD CONSTRAINT "ticket_message_authorId_user_id_fk" FOREIGN KEY ("authorId") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wallet" ADD CONSTRAINT "wallet_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;