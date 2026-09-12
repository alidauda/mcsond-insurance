/**
 * McSond Insurance — shared UI types, static labels and demo fixtures.
 * Transactional screens read from the DB (lib/*.ts); the fixtures here feed
 * `scripts/seed.ts` and a few presentational fallbacks.
 * All money values are integers in Naira (₦). Format with lib/format.
 */

export type Status =
  | "active"
  | "renew"
  | "expired"
  | "cancelled"
  | "pending"
  | "failed"
  | "open"
  | "in-review"
  | "resolved"
  | "verified"
  | "pending"
  | "suspended"
  | "paid"
  | "attention"
  | "live";

/* ───────────────────────── Customer identity ───────────────────────── */

export const customer = {
  name: "Adaeze Onuoha",
  firstName: "Adaeze",
  initials: "AO",
  role: "Customer",
  location: "Lagos",
  walletId: "MSC-WLT-2049-Z",
  walletBalance: 320_500,
  email: "adaeze.o@procura.ng",
  phone: "+234 803 482 1190",
};

/* ───────────────────────── 02 · Insurance plans ───────────────────────── */

/**
 * Every plan must be backed by a real underwriter integration — McSond is a
 * broker and never prices or issues cover itself. Adding an underwriter means
 * adding its API client and a value here.
 */
export type PlanProvider = "nem";
/** NEM eInsurance products: third-party, comprehensive, enhanced third-party. */
export type NemProductCode = "mtp" | "comp" | "emtp";

export type InsurancePlan = {
  id: string;
  name: string;
  underwriter: string;
  premium: number; // per 12 months (for NEM plans: indicative "from" price)
  term: string;
  category: "Motor" | "Property" | "Goods" | "Health";
  popular?: boolean;
  features: string[];
  /** Underwriter that prices and issues the policy. */
  provider: PlanProvider;
  /** The underwriter's product code. */
  productCode: NemProductCode;
};

/** Admin catalogue row: customer-facing plan + management fields. */
export type AdminInsurancePlan = InsurancePlan & { active: boolean };

export const insurancePlans: InsurancePlan[] = [
  // NEM eInsurance motor products — priced and issued live via the broker API.
  { id: "nem-mtp", name: "Third-Party Motor (NEM)", underwriter: "NEM Insurance", premium: 15_000, term: "per 12 months", category: "Motor", provider: "nem", productCode: "mtp", popular: true, features: ["Statutory third-party cover", "NAICOM-verifiable certificate", "Issued instantly by NEM"] },
  { id: "nem-emtp", name: "Enhanced Third-Party (NEM)", underwriter: "NEM Insurance", premium: 30_000, term: "per 12 months", category: "Motor", provider: "nem", productCode: "emtp", features: ["Third-party + own damage to a limit", "Medical & legal expenses", "Towing"] },
  { id: "nem-comp", name: "Comprehensive Motor (NEM)", underwriter: "NEM Insurance", premium: 0, term: "5% of vehicle value", category: "Motor", provider: "nem", productCode: "comp", features: ["Own damage, theft & fire", "Third-party liability", "Optional excess buy-back"] },
];

export const insuranceCategories = ["All", "Motor", "Property", "Goods", "Health"] as const;
export type InsuranceCategory = InsurancePlan["category"];

/* ───────────────────────── 06 · Wallet & ledger ───────────────────────── */

export type LedgerEntry = {
  ref: string;
  date: string;
  type: "Insurance" | "Wallet top-up";
  description: string;
  amount: number; // negative = debit
  balanceBefore: number; // balance before the movement
  runningBalance: number; // balance after the movement
};

/* Newest first. Chained chronologically (bottom → top): each entry's
 * balanceBefore is the previous entry's runningBalance, and the newest
 * runningBalance equals the wallet's available balance (320,500). */
export const ledger: LedgerEntry[] = [
  { ref: "TXN-9019", date: "May 02, 2026", type: "Wallet top-up", description: "Paystack · GTBank ****4421", amount: 500_000, balanceBefore: 19_761, runningBalance: 519_761 },
  { ref: "TXN-8940", date: "Mar 10, 2026", type: "Wallet top-up", description: "Paystack · GTBank ****4421", amount: 150_000, balanceBefore: 3_681, runningBalance: 153_681 },
];

/* ───────────────────────── 07 · Policies & receipts ───────────────────────── */

export type Order = {
  id: string;
  date: string;
  item: string;
  qty: string;
  total: number;
  status: Status; // active | renew | expired | cancelled
  kind: "Insurance";
};

/* ───────────────────────── 08 · Support tickets (customer) ───────────────────────── */

export type TicketMessage = {
  author: string;
  time: string;
  role: "customer" | "operations";
  body: string;
  /** Staff-only note — shown to admins, hidden from the customer thread. */
  internal?: boolean;
};

export type CustomerTicket = {
  id: string;
  subject: string;
  channel: "Insurance" | "Wallet" | "Account";
  age: string;
  status: "open" | "in-review" | "resolved";
  priority?: "High priority";
  thread?: TicketMessage[];
};

export const customerTickets: CustomerTicket[] = [
  {
    id: "TKT-0421",
    subject: "Certificate shows the wrong vehicle plate",
    channel: "Insurance",
    age: "2h ago",
    status: "open",
    priority: "High priority",
    thread: [
      { author: "You", time: "14:08", role: "customer", body: "Policy INS-2049 was bound for LSR-394 GH but the certificate reads LSR-349 GH. I need a corrected certificate before the vehicle inspection on Tuesday." },
      { author: "Yetunde A.", time: "14:22", role: "operations", body: "Confirmed — the plate was transposed at bind time. Re-issuing the certificate with Leadway now; you'll have the corrected PDF within the hour. Apologies for the mix-up." },
    ],
  },
  { id: "TKT-0414", subject: "Wallet top-up not reflected", channel: "Wallet", age: "2d ago", status: "resolved" },
  { id: "TKT-0410", subject: "Update the insured party name", channel: "Insurance", age: "3d ago", status: "open" },
];

/* ═══════════════════════════ ADMIN ═══════════════════════════ */

export const admin = {
  name: "Super Admin",
  initials: "SA",
  email: "admin@mcsond.ng",
  session: "elevated session · 23m",
};

/* ───────────────────────── 10 · User control ───────────────────────── */

export type KycStatus = "verified" | "pending" | "unverified";

export type Account = {
  id: string;
  name: string;
  initials: string;
  email: string;
  joined: string;
  wallet: number;
  kyc: KycStatus;
  status: "active" | "suspended";
};

export const accounts: Account[] = [
  { id: "U-04128", name: "Adaeze Onuoha", initials: "AO", email: "adaeze.o@procura.ng", joined: "Mar 2025", wallet: 320_500, kyc: "verified", status: "active" },
  { id: "U-04127", name: "Tunde Bakare", initials: "TB", email: "tunde@bakareltd.ng", joined: "Mar 2025", wallet: 1_240_000, kyc: "verified", status: "active" },
  { id: "U-04126", name: "Chiamaka Iloba", initials: "CI", email: "chiamaka@buildwise.ng", joined: "Feb 2025", wallet: 8_200, kyc: "pending", status: "active" },
  { id: "U-04125", name: "Dapo Fashanu", initials: "DF", email: "d.fashanu@gmail.com", joined: "Feb 2025", wallet: 0, kyc: "verified", status: "suspended" },
  { id: "U-04124", name: "Hauwa Sani", initials: "HS", email: "hauwa.sani@aspect.ng", joined: "Jan 2025", wallet: 472_000, kyc: "verified", status: "active" },
  { id: "U-04123", name: "Olumide Adebayo", initials: "OA", email: "olumide.a@kondad.ng", joined: "Jan 2025", wallet: 95_000, kyc: "pending", status: "active" },
  { id: "U-04122", name: "Ngozi Ekwueme", initials: "NE", email: "ngozi.e@vesta.ng", joined: "Dec 2024", wallet: 18_400, kyc: "verified", status: "active" },
];

/* ───────────────────────── 11 · Staff & RBAC ───────────────────────── */

export const staff = [
  { name: "Yetunde Awoyemi", initials: "YA", id: "S-09", role: "Operations Lead", lastActive: "12 min ago" },
  { name: "Bashir Musa", initials: "BM", id: "S-08", role: "Finance Officer", lastActive: "1 hr ago" },
  { name: "Ifeoma Nwosu", initials: "IN", id: "S-07", role: "Support Agent", lastActive: "4 min ago" },
  { name: "Kola Adeyemi", initials: "KA", id: "S-06", role: "KYC Reviewer", lastActive: "2 hr ago" },
];

/* ───────────────────────── 12 · Audit trail ───────────────────────── */

export type AuditEntry = {
  time: string;
  actor: string;
  actorInitial: string;
  action: string;
  actionTone: "danger" | "neutral";
  target: string;
  detail: string;
};

export const auditTrail: AuditEntry[] = [
  { time: "14:22:08", actor: "Yetunde A.", actorInitial: "Y", action: "Certificate reissued", actionTone: "neutral", target: "INS-2049", detail: "Corrected vehicle plate · Leadway" },
  { time: "14:18:41", actor: "Bashir M.", actorInitial: "B", action: "Wallet adjustment", actionTone: "neutral", target: "U-04127", detail: "Credit ₦5,000 — manual reconciliation" },
  { time: "14:11:05", actor: "System", actorInitial: "S", action: "Paystack webhook ok", actionTone: "neutral", target: "TXN-9024", detail: "reference ps_4HC92Q" },
  { time: "13:54:17", actor: "Ifeoma N.", actorInitial: "I", action: "Ticket resolved", actionTone: "neutral", target: "TKT-0414", detail: "Wallet reconciliation completed" },
  { time: "13:31:52", actor: "Kola A.", actorInitial: "K", action: "KYC verified", actionTone: "neutral", target: "U-04129", detail: "BVN + utility bill on file" },
  { time: "13:02:09", actor: "Super Admin", actorInitial: "S", action: "Account suspended", actionTone: "neutral", target: "U-04125", detail: "Reason: chargeback abuse" },
  { time: "12:48:33", actor: "System", actorInitial: "S", action: "Daily reconciliation", actionTone: "neutral", target: "wallet_float", detail: "variance: ₦0" },
  { time: "12:45:30", actor: "Bashir M.", actorInitial: "B", action: "Refund issued", actionTone: "danger", target: "INS-1998", detail: "₦48,600 to MSC-WLT-2122-N — policy cancelled" },
  { time: "12:34:25", actor: "System", actorInitial: "S", action: "Policy bound", actionTone: "neutral", target: "INS-2051", detail: "Fire & Special Perils · Mutual Benefits" },
];

export const auditSummary = {
  date: "May 6, 2026",
  total: 247,
  byStaff: 182,
  bySystem: 61,
  bySuperAdmin: 4,
  headHash: "0x4f8a…b21c",
  verified: "13:48",
};

/* ───────────────────────── 13 · Reports ───────────────────────── */

export const reports = [
  { name: "Wallet reconciliation", cadence: "Daily", desc: "Daily wallet float vs Paystack settlements", lastRun: "Today 06:00 · 2.1MB" },
  { name: "GWP by underwriter", cadence: "Monthly", desc: "Gross written premium, broken down by issuer", lastRun: "May 1 · 420KB" },
  { name: "Renewals due", cadence: "Weekly", desc: "Policies expiring in the next 30 days, by underwriter", lastRun: "May 4 · 96KB" },
  { name: "KYC backlog", cadence: "Daily", desc: "Pending KYC reviews older than 48h", lastRun: "Today 06:00 · 64KB" },
  { name: "Refunds & chargebacks", cadence: "Weekly", desc: "All refund events with reason codes", lastRun: "May 4 · 88KB" },
  { name: "Active session log", cadence: "On demand", desc: "Authenticated sessions for compliance review", lastRun: "— · —" },
];

/* ───────────────────────── 14 · Support inbox (admin) ───────────────────────── */

export type QueueTicket = {
  id: string;
  subject: string;
  user: string;
  type: "Insurance" | "Wallet" | "Account";
  priority: "High" | "Normal";
  assigned: string;
  assignedInitials: string;
  sla: number; // 0..1, fraction of SLA elapsed (higher = at risk)
  updated: string;
};

export const supportQueue: QueueTicket[] = [
  { id: "TKT-0421", subject: "Certificate shows the wrong vehicle plate", user: "Adaeze O.", type: "Insurance", priority: "High", assigned: "Yetunde A.", assignedInitials: "YA", sla: 0.9, updated: "2h ago" },
  { id: "TKT-0418", subject: "Reissue insurance certificate", user: "Tunde Bakare", type: "Insurance", priority: "Normal", assigned: "Yetunde A.", assignedInitials: "YA", sla: 0.35, updated: "1d ago" },
  { id: "TKT-0414", subject: "Wallet top-up not reflected", user: "Chiamaka I.", type: "Wallet", priority: "High", assigned: "Yetunde A.", assignedInitials: "YA", sla: 0.85, updated: "2d ago" },
  { id: "TKT-0410", subject: "Update the insured party name", user: "Dapo Fashanu", type: "Insurance", priority: "Normal", assigned: "Yetunde A.", assignedInitials: "YA", sla: 0.3, updated: "3d ago" },
  { id: "TKT-0407", subject: "BVN verification failing", user: "Olumide A.", type: "Account", priority: "High", assigned: "Yetunde A.", assignedInitials: "YA", sla: 0.8, updated: "4d ago" },
  { id: "TKT-0405", subject: "Receipt missing for INS-2027", user: "Hauwa S.", type: "Insurance", priority: "Normal", assigned: "Yetunde A.", assignedInitials: "YA", sla: 0.25, updated: "5d ago" },
  { id: "TKT-0402", subject: "Policy cancelled — refund stuck", user: "Ngozi E.", type: "Insurance", priority: "High", assigned: "Yetunde A.", assignedInitials: "YA", sla: 0.95, updated: "1w ago" },
];

/* ───────────────────────── 16 · System profile ───────────────────────── */

export const systemProfile = {
  brokerage: {
    legalName: "McSond Insurance Brokers Ltd.",
    naicom: "NAICOM/BR/2024/0418",
    rc: "RC 1,824,902",
    office: "14 Karimu Kotun, Victoria Island, Lagos",
    complianceOfficer: "Bashir Musa",
    phone: "+234 1 906 2200",
  },
  integrations: [
    { name: "Paystack", note: "Connected · webhook v3", status: "live" as Status },
    { name: "Termii SMS", note: "Connected", status: "live" as Status },
    { name: "Leadway API", note: "Connected", status: "live" as Status },
    { name: "AIICO API", note: "Token expires in 9 days", status: "attention" as Status },
    { name: "Custodian API", note: "Connected", status: "live" as Status },
    { name: "NEM eInsurance API", note: "Sandbox · broker credentials set", status: "live" as Status },
  ],
  defaults: { currency: "NGN — Naira (₦)", stampDutyRate: "0.5%", vatRate: "7.5%" },
};

/* ───────────────────────── Sign-in (00) ───────────────────────── */

export const signIn = {
  eyebrow: "Insurance · Wallet",
  blurb: "Buy cover from any licensed underwriter. Move money once, into a wallet you can audit.",
  testimonial: {
    quote: "We bound fleet cover for eleven trucks in one afternoon — and the certificates were in my inbox before I left the office.",
    name: "Yetunde Awoyemi",
    title: "Fleet Manager · Aspect Logistics",
    initials: "YA",
  },
  trust: [
    { tag: "NAICOM", label: "Licensed broker" },
    { tag: "BVN-secured", label: "KYC verified accounts" },
    { tag: "Paystack", label: "PCI-DSS payments" },
  ],
};

/* ═══════════════════════ DETAIL PAGES (interaction targets) ═══════════════════════ */

/* ── User detail (admin · /admin/users/[id]) — KYC evidence fixtures ── */

export type KycEvidence = {
  bvnMasked: string;
  bvn: boolean;
  utilityBill: boolean;
  idCard: boolean;
  reviewedBy: string;
  reviewedOn: string;
};

const defaultKyc: KycEvidence = {
  bvnMasked: "****0000",
  bvn: true,
  utilityBill: true,
  idCard: true,
  reviewedBy: "Kola A.",
  reviewedOn: "Feb 2025",
};

const kycByAccount: Record<string, Partial<KycEvidence>> = {
  "U-04128": { bvnMasked: "****6481", reviewedOn: "14 Mar 2025" },
  "U-04127": { bvnMasked: "****2210", reviewedOn: "05 Mar 2025" },
  "U-04126": { bvnMasked: "****9043", bvn: false, utilityBill: true, idCard: false, reviewedBy: "—", reviewedOn: "pending" },
  "U-04125": { bvnMasked: "****1188" },
  "U-04124": { bvnMasked: "****3320" },
  "U-04123": { bvnMasked: "****7754", bvn: true, utilityBill: false, idCard: false, reviewedBy: "—", reviewedOn: "pending" },
  "U-04122": { bvnMasked: "****0912" },
};

export function getAccount(id: string): Account | undefined {
  return accounts.find((a) => a.id === id);
}

export function getKycEvidence(id: string): KycEvidence {
  return { ...defaultKyc, ...kycByAccount[id] };
}

/* ── Policy / receipt detail (customer · /orders/[id]) ── */

export type OrderStep = { label: string; done: boolean; active: boolean };
export type OrderDetail = {
  steps: OrderStep[];
  receipt: { reference: string; paidFrom: string; total: number; date: string };
  underwriter?: string;
  policyNo?: string;
  period?: string;
  sumInsured?: number;
  premium?: number;
  category?: string;
  hasCertificate?: boolean;
  certificateHref?: string;
  externalCertificateUrl?: string;
  provider?: PlanProvider;
  providerRef?: string;
};

/* ── Support ticket detail (admin · /admin/support/[id]) ── */

export const queueUserId: Record<string, string> = {
  "TKT-0421": "U-04128",
  "TKT-0418": "U-04127",
  "TKT-0414": "U-04126",
  "TKT-0410": "U-04125",
  "TKT-0407": "U-04123",
  "TKT-0405": "U-04124",
  "TKT-0402": "U-04122",
};

/** Tickets that reference a specific policy. Seeded tickets reference none,
 * since there is no seeded policy book to point at. */
export const queueOrderId: Record<string, string> = {};

const supportThreads: Record<string, TicketMessage[]> = {
  "TKT-0421": customerTickets[0].thread!,
  "TKT-0418": [
    { author: "Tunde Bakare", time: "Yesterday · 10:02", role: "customer", body: "I need the certificate for policy MTB/FSP/2026/010233 reissued — the PDF won't open on my phone." },
    { author: "Yetunde A.", time: "Yesterday · 10:40", role: "operations", body: "Re-generating now from Mutual's API. You'll get a fresh signed PDF by email within 10 minutes." },
  ],
  "TKT-0414": [
    { author: "Chiamaka Iloba", time: "2 days ago · 16:20", role: "customer", body: "I topped up ₦25,000 via Paystack but my wallet still shows the old balance." },
    { author: "Yetunde A.", time: "2 days ago · 16:38", role: "operations", body: "Found it — the webhook retried after a timeout. I've credited the ₦25,000 manually and reconciled the ledger." },
  ],
  "TKT-0402": [
    { author: "Ngozi Ekwueme", time: "1 week ago", role: "customer", body: "I cancelled policy INS-1998 but the refund hasn't hit my wallet." },
    { author: "Bashir M.", time: "1 week ago", role: "operations", body: "NEM has confirmed the cancellation. Releasing the refund to your wallet today." },
  ],
};

export function getQueueTicket(id: string): QueueTicket | undefined {
  return supportQueue.find((t) => t.id === id);
}

export function getTicketThread(id: string, subject: string): TicketMessage[] {
  return (
    supportThreads[id] ?? [
      { author: "Customer", time: "Recently", role: "customer", body: `${subject}. Awaiting an agent response.` },
    ]
  );
}

/* ── Policy book (admin · /admin/orders) ── */

/** Display stage: stored `pending`/`active`/`failed`/`cancelled`, with
 * `renew`/`expired` derived from the period end at read time. */
export type OrderStage = "pending" | "active" | "renew" | "expired" | "failed" | "cancelled";

export type AdminOrder = {
  id: string;
  date: string;
  customer: string;
  customerId: string;
  customerInitials: string;
  kind: "Insurance";
  item: string;
  qty: string;
  total: number;
  stage: OrderStage;
  planId?: string;
  category?: InsuranceCategory;
  underwriter?: string;
  policyNo?: string;
  period?: string;
  termMonths?: number;
  sumInsured?: number;
  premium?: number;
  insuredParty?: string;
  provider?: PlanProvider;
  productCode?: NemProductCode | null;
  providerRef?: string | null;
  naicomId?: string | null;
  certificateUrl?: string | null;
  debitNoteUrl?: string | null;
  creditNoteUrl?: string | null;
  details?: Record<string, string> | null;
};

/**
 * No seeded policy book. Every policy in this app is issued by an underwriter's
 * API, so fabricating one would mean inventing a policy number that no insurer
 * would honour. The book fills up as real cover is bound.
 */
export const adminOrders: AdminOrder[] = [];

export const adminOrderFilters = [
  { key: "all", label: "All" },
  { key: "active", label: "Active" },
  { key: "renew", label: "Renewing soon" },
  { key: "expired", label: "Expired" },
  { key: "cancelled", label: "Cancelled" },
  { key: "failed", label: "Failed / pending" },
];

export function getAdminOrder(id: string): AdminOrder | undefined {
  return adminOrders.find((o) => o.id === id);
}

/** Badge tone for a policy stage (renewing soon = needs action → warning). */
export function orderStageTone(stage: string): "success" | "warning" | "danger" | "neutral" | "info" {
  switch (stage) {
    case "active":
      return "success";
    case "renew":
    case "pending":
      return "warning";
    case "cancelled":
    case "failed":
      return "danger";
    default:
      return "neutral";
  }
}
