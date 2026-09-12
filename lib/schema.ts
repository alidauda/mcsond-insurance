/**
 * Drizzle schema for the McSond Insurance app domain (PostgreSQL).
 *
 * Conventions:
 *  - Text UUID primary keys (match Better Auth). Ids get a $defaultFn via
 *    node:crypto randomUUID.
 *  - Human-readable codes (INS-2049, TKT-0421, MSC-WLT-..., TXN-...) live in a
 *    separate UNIQUE `reference` column, never the PK.
 *  - Money is integer Naira everywhere.
 *  - Enum-like columns are plain text; allowed values documented inline.
 *  - FKs to user use references(() => user.id, { onDelete: ... }).
 */
import {
  pgTable,
  text,
  integer,
  timestamp,
  boolean,
  jsonb,
  bigserial,
} from "drizzle-orm/pg-core";
import { randomUUID } from "node:crypto";
import { user } from "./auth-schema";

// 1. wallet — cached balance per user.
export const wallet = pgTable("wallet", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => randomUUID()),
  reference: text("reference").notNull().unique(), // e.g. MSC-WLT-2049-Z
  userId: text("userId")
    .notNull()
    .unique()
    .references(() => user.id, { onDelete: "cascade" }),
  balance: integer("balance").notNull().default(0),
  earmarked: integer("earmarked").notNull().default(0),
  createdAt: timestamp("createdAt")
    .$defaultFn(() => new Date())
    .notNull(),
  updatedAt: timestamp("updatedAt")
    .$defaultFn(() => new Date())
    .notNull(),
});

// 2. ledger_entry — append-only wallet ledger.
export const ledgerEntry = pgTable("ledger_entry", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => randomUUID()),
  walletId: text("walletId")
    .notNull()
    .references(() => wallet.id, { onDelete: "cascade" }),
  userId: text("userId")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  // Customer-visible movement id, e.g. TXN-3F9A2C7B41. Unique: support looks
  // movements up by it, so two rows sharing one would be indistinguishable.
  reference: text("reference").unique(),
  // type: insurance | topup | refund | adjustment
  type: text("type").notNull(),
  description: text("description"),
  amount: integer("amount").notNull(), // signed
  // Balance snapshot before the movement. Nullable for legacy rows; derive
  // `runningBalance - amount` when absent.
  balanceBefore: integer("balanceBefore"),
  runningBalance: integer("runningBalance").notNull(), // balance after
  orderId: text("orderId").references(() => order.id, { onDelete: "set null" }),
  createdBy: text("createdBy").references(() => user.id, {
    onDelete: "set null",
  }),
  createdAt: timestamp("createdAt")
    .defaultNow()
    .notNull(),
});

// 2b. paystack_transaction — one row per initialized Paystack checkout.
// Status transitions: pending → success (webhook/callback verify) | failed.
// The success transition is the idempotency gate for crediting the wallet.
export const paystackTransaction = pgTable("paystack_transaction", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => randomUUID()),
  reference: text("reference").notNull().unique(), // ours; sent to Paystack, e.g. PSK-9F2C41D0A7B3
  userId: text("userId")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  amount: integer("amount").notNull(), // integer Naira requested
  // status: pending | success | failed
  status: text("status").notNull().default("pending"),
  channel: text("channel"), // card | bank | ussd … (reported by Paystack)
  gatewayResponse: text("gatewayResponse"),
  paidAt: timestamp("paidAt"),
  createdAt: timestamp("createdAt")
    .$defaultFn(() => new Date())
    .notNull(),
  updatedAt: timestamp("updatedAt")
    .$defaultFn(() => new Date())
    .notNull(),
});

// 3. insurance_plan — the catalogue of cover customers can bind.
export const insurancePlan = pgTable("insurance_plan", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => randomUUID()),
  reference: text("reference").notNull().unique(), // e.g. comp-motor
  name: text("name"),
  underwriter: text("underwriter"),
  premium: integer("premium"), // annual premium, integer Naira
  term: text("term"), // display label, e.g. "per 12 months"
  // category: Motor | Property | Goods | Health
  category: text("category"),
  popular: boolean("popular").default(false),
  features: jsonb("features").$type<string[]>(),
  // provider: the underwriter integration that prices and issues this cover.
  // Currently only "nem". McSond is a broker and never underwrites itself, so
  // a plan without a live provider + productCode is not sellable.
  provider: text("provider").notNull().default("nem"),
  // productCode: mtp | comp | emtp
  productCode: text("productCode"),
  active: boolean("active").default(true),
  updatedAt: timestamp("updatedAt")
    .$defaultFn(() => new Date()),
});

// 4. order — BASE (one per bound policy; carries the wallet-facing total)
export const order = pgTable("order", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => randomUUID()),
  reference: text("reference").notNull().unique(), // e.g. INS-2049
  userId: text("userId")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  // kind: insurance
  kind: text("kind").notNull(),
  total: integer("total").notNull(), // premium + stamp duty + VAT
  // stage: pending (awaiting underwriter) | active | failed (underwriter declined, refunded) | cancelled
  stage: text("stage").notNull(),
  createdAt: timestamp("createdAt")
    .$defaultFn(() => new Date())
    .notNull(),
  paidAt: timestamp("paidAt"),
});

// 5. insurance_policy — DETAIL (1:1 with order where kind=insurance)
export const insurancePolicy = pgTable("insurance_policy", {
  orderId: text("orderId")
    .primaryKey()
    .references(() => order.id, { onDelete: "cascade" }),
  planId: text("planId").references(() => insurancePlan.id, {
    onDelete: "set null",
  }),
  underwriter: text("underwriter"),
  policyNo: text("policyNo"),
  periodStart: timestamp("periodStart"),
  periodEnd: timestamp("periodEnd"),
  termMonths: integer("termMonths"),
  sumInsured: integer("sumInsured"),
  basePremium: integer("basePremium"),
  stampDuty: integer("stampDuty"),
  vat: integer("vat"),
  insuredParty: text("insuredParty"),
  // category-specific extras (e.g. motor: vehicle/plate), nullable
  details: jsonb("details").$type<Record<string, string>>(),
  certificateUrl: text("certificateUrl"),
  boundAt: timestamp("boundAt"),
  // Underwriter API references (provider-issued). Null for manual plans.
  providerRef: text("providerRef"), // e.g. NEM TransRef "MTP-1788619012NEM-ONL-TP"
  naicomId: text("naicomId"),
  debitNoteUrl: text("debitNoteUrl"),
  creditNoteUrl: text("creditNoteUrl"),
});

// 5b. underwriter_transaction — one row per call to an underwriter's purchase
// API. Credentials are stripped from `request` before storage. `creditNoteNo`
// is our unique per-attempt reference sent to the underwriter.
export const underwriterTransaction = pgTable("underwriter_transaction", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => randomUUID()),
  orderId: text("orderId").references(() => order.id, { onDelete: "set null" }),
  provider: text("provider").notNull(), // nem
  endpoint: text("endpoint").notNull(), // buyMtp | buyComp | buyEmtp
  creditNoteNo: text("creditNoteNo").notNull().unique(),
  // status: success | failed
  status: text("status").notNull(),
  respCode: integer("respCode"),
  message: text("message"),
  request: jsonb("request"),
  response: jsonb("response"),
  createdAt: timestamp("createdAt")
    .$defaultFn(() => new Date())
    .notNull(),
});

// 6. ticket
export const ticket = pgTable("ticket", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => randomUUID()),
  reference: text("reference").notNull().unique(), // e.g. TKT-0421
  userId: text("userId")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  subject: text("subject"),
  // channel: Insurance | Wallet | Account
  channel: text("channel"),
  // priority: high | normal
  priority: text("priority"),
  // status: open | in-review | resolved
  status: text("status"),
  assignedTo: text("assignedTo").references(() => user.id, {
    onDelete: "set null",
  }),
  orderId: text("orderId").references(() => order.id, { onDelete: "set null" }),
  slaDueAt: timestamp("slaDueAt"),
  createdAt: timestamp("createdAt")
    .$defaultFn(() => new Date())
    .notNull(),
  updatedAt: timestamp("updatedAt")
    .$defaultFn(() => new Date())
    .notNull(),
});

// 7. ticket_message
export const ticketMessage = pgTable("ticket_message", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => randomUUID()),
  ticketId: text("ticketId")
    .notNull()
    .references(() => ticket.id, { onDelete: "cascade" }),
  authorId: text("authorId").references(() => user.id, {
    onDelete: "set null",
  }),
  authorName: text("authorName"),
  // authorRole: customer | staff
  authorRole: text("authorRole"),
  body: text("body"),
  // Internal (staff-only) note — hidden from the customer thread.
  internal: boolean("internal").notNull().default(false),
  createdAt: timestamp("createdAt")
    .$defaultFn(() => new Date())
    .notNull(),
});

// 8. audit_entry — append-only, hash-chained
export const auditEntry = pgTable("audit_entry", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => randomUUID()),
  seq: bigserial("seq", { mode: "number" }),
  actorId: text("actorId").references(() => user.id, { onDelete: "set null" }), // null = System
  actorName: text("actorName"),
  action: text("action"),
  // actionTone: danger | neutral
  actionTone: text("actionTone"),
  targetType: text("targetType"),
  targetRef: text("targetRef"),
  detail: text("detail"),
  prevHash: text("prevHash"),
  hash: text("hash"),
  createdAt: timestamp("createdAt")
    .defaultNow()
    .notNull(),
});

// 9. kyc_profile — know-your-customer evidence per customer.
// PII rule: never store a raw NIN or a biometric image. The masked NIN plus
// SwiftCheck's requestId / consentId are what an auditor needs.
export const kycProfile = pgTable("kyc_profile", {
  userId: text("userId")
    .primaryKey()
    .references(() => user.id, { onDelete: "cascade" }),
  bvnMasked: text("bvnMasked"),
  bvnVerified: boolean("bvnVerified").default(false),
  utilityBill: boolean("utilityBill").default(false),
  idCard: boolean("idCard").default(false),
  // ── NIN identity check (SwiftCheck) ──
  // method: nin | phone | shareCode | demography
  ninMethod: text("ninMethod"),
  ninMasked: text("ninMasked"), // e.g. *******8901
  ninVerified: boolean("ninVerified").default(false),
  // Identity as returned by the provider, for the reviewer to compare.
  verifiedName: text("verifiedName"),
  verifiedDob: text("verifiedDob"), // DD-MM-YYYY, as provided
  verifiedGender: text("verifiedGender"),
  verifiedPhone: text("verifiedPhone"),
  verifiedState: text("verifiedState"),
  photoOnFile: boolean("photoOnFile").default(false),
  // NIMC face photograph as a base64 JPEG. Sensitive biometric data: only
  // readable by staff holding user:kyc (see getKycPhoto), never sent to the
  // customer-facing pages, and cleared when a review is rejected.
  photoData: text("photoData"),
  // 0-100 similarity between the account name and the verified name.
  nameMatchScore: integer("nameMatchScore"),
  providerRequestId: text("providerRequestId"),
  providerConsentId: text("providerConsentId"),
  verifiedAt: timestamp("verifiedAt"),
  reviewedBy: text("reviewedBy").references(() => user.id, {
    onDelete: "set null",
  }),
  reviewedAt: timestamp("reviewedAt"),
});

// 9b. kyc_verification — append-only log of every identity check attempted.
// Request and response are stored redacted (see lib/swiftcheck.ts).
export const kycVerification = pgTable("kyc_verification", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => randomUUID()),
  userId: text("userId")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  provider: text("provider").notNull().default("swiftcheck"),
  // method: nin | phone | shareCode | demography
  method: text("method").notNull(),
  // outcome: verified | review | failed
  outcome: text("outcome").notNull(),
  code: text("code"),
  message: text("message"),
  nameMatchScore: integer("nameMatchScore"),
  providerRequestId: text("providerRequestId"),
  providerConsentId: text("providerConsentId"),
  request: jsonb("request"),
  response: jsonb("response"),
  // Staff member who ran the check, when it wasn't the customer themselves.
  actorId: text("actorId").references(() => user.id, { onDelete: "set null" }),
  createdAt: timestamp("createdAt")
    .$defaultFn(() => new Date())
    .notNull(),
});

// 10. setting — key/value config
export const setting = pgTable("setting", {
  key: text("key").primaryKey(),
  value: jsonb("value"),
});

// 11. integration
export const integration = pgTable("integration", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => randomUUID()),
  name: text("name"),
  note: text("note"),
  // status: live | attention | down
  status: text("status"),
  updatedAt: timestamp("updatedAt")
    .$defaultFn(() => new Date()),
});

export const schema = {
  wallet,
  ledgerEntry,
  paystackTransaction,
  insurancePlan,
  order,
  insurancePolicy,
  underwriterTransaction,
  ticket,
  ticketMessage,
  auditEntry,
  kycProfile,
  kycVerification,
  setting,
  integration,
};
