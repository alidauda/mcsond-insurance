/**
 * Seeds console fixtures into an empty DB so the staff console is demoable.
 *
 * Seeded users are *managed* rows (they appear in the console and can be
 * banned / role-changed / KYC-reviewed) but can only sign in if a real Google
 * account matches their email, or after `npm run dev:password` sets one.
 *
 * Run: `npm run db:seed` (requires DATABASE_URL + a pushed schema).
 */
import { randomUUID, createHash } from "node:crypto";
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { eq } from "drizzle-orm";
import type { PgColumn, PgTable } from "drizzle-orm/pg-core";
import { user } from "../lib/auth-schema";
import {
  wallet,
  ledgerEntry,
  insurancePlan,
  order,
  insurancePolicy,
  ticket,
  ticketMessage,
  auditEntry,
  kycProfile,
  setting,
  integration,
} from "../lib/schema";
import {
  accounts,
  ledger,
  insurancePlans,
  adminOrders,
  supportQueue,
  customerTickets,
  queueUserId,
  queueOrderId,
  getTicketThread,
  getKycEvidence,
  auditTrail,
  systemProfile,
  type AdminOrder,
} from "../lib/mock-data";
import { STAMP_DUTY_RATE, INSURANCE_VAT_RATE } from "../lib/quote";

// Inline fixtures — kept independent of the UI mock data (lib/mock-data.ts).
const STAFF_FIXTURES: { name: string; email: string; role: string; createdAt: string }[] = [
  { name: "Super Admin", email: "admin@mcsond.ng", role: "superadmin", createdAt: "2024-12-01" },
  { name: "Yetunde Awoyemi", email: "yetunde.awoyemi@mcsond.ng", role: "operations", createdAt: "2025-01-08" },
  { name: "Bashir Musa", email: "bashir.musa@mcsond.ng", role: "finance", createdAt: "2025-01-15" },
  { name: "Ifeoma Nwosu", email: "ifeoma.nwosu@mcsond.ng", role: "support", createdAt: "2025-02-03" },
  { name: "Kola Adeyemi", email: "kola.adeyemi@mcsond.ng", role: "kyc_reviewer", createdAt: "2025-02-20" },
];

const CUSTOMER_FIXTURES: {
  name: string;
  email: string;
  company: string | null;
  banned: boolean;
  createdAt: string;
}[] = [
  { name: "Adaeze Onuoha", email: "adaeze.o@procura.ng", company: "Aspect Construction", banned: false, createdAt: "2025-03-12" },
  { name: "Tunde Bakare", email: "tunde@bakareltd.ng", company: "Bakare Ltd.", banned: false, createdAt: "2025-03-03" },
  { name: "Chiamaka Iloba", email: "chiamaka@buildwise.ng", company: "Buildwise", banned: false, createdAt: "2025-02-21" },
  { name: "Dapo Fashanu", email: "d.fashanu@gmail.com", company: null, banned: true, createdAt: "2025-02-09" },
  { name: "Hauwa Sani", email: "hauwa.sani@aspect.ng", company: null, banned: false, createdAt: "2025-01-18" },
  { name: "Olumide Adebayo", email: "olumide.a@kondad.ng", company: "Kondad Ltd.", banned: false, createdAt: "2025-01-11" },
  { name: "Ngozi Ekwueme", email: "ngozi.e@vesta.ng", company: "Vesta Ltd.", banned: false, createdAt: "2024-12-20" },
];

/** Adaeze's ledger debits → the policy they paid for. */
const LEDGER_ORDER_REF: Record<string, string> = {
  "TXN-9024": "INS-2049",
  "TXN-8997": "INS-2041",
  "TXN-8961": "INS-2032",
};

/** Motor policies carry vehicle details on the certificate. */
const POLICY_DETAILS: Record<string, Record<string, string>> = {
  "INS-2049": { vehicle: "Toyota Corolla 2020", plate: "LSR-394 GH" },
  "INS-2027": { vehicle: "Honda Accord 2018", plate: "ABJ-118 KJ" },
};

async function main() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is not set.");
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const db = drizzle(pool, { schema: { user } });

  const now = new Date();
  const kycByEmail = new Map(accounts.map((a) => [a.email.toLowerCase(), a.kyc]));

  const rows = [
    ...STAFF_FIXTURES.map((s) => ({
      id: randomUUID(),
      name: s.name,
      email: s.email.toLowerCase(),
      emailVerified: true,
      role: s.role,
      banned: false,
      company: null as string | null,
      kyc: "verified",
      createdAt: new Date(s.createdAt),
      updatedAt: now,
    })),
    ...CUSTOMER_FIXTURES.map((c) => ({
      id: randomUUID(),
      name: c.name,
      email: c.email.toLowerCase(),
      emailVerified: true,
      role: "user",
      banned: c.banned,
      company: c.company,
      kyc: kycByEmail.get(c.email.toLowerCase()) ?? "unverified",
      createdAt: new Date(c.createdAt),
      updatedAt: now,
    })),
  ];

  let inserted = 0;
  for (const row of rows) {
    const existing = await db.select().from(user).where(eq(user.email, row.email)).limit(1);
    if (existing[0]) {
      console.log(`skip (exists): ${row.email}`);
      continue;
    }
    await db.insert(user).values(row);
    inserted++;
    console.log(`seeded: ${row.email} (${row.role})`);
  }

  console.log(`\nUsers: inserted ${inserted} of ${rows.length} fixtures.`);

  await seedDomain(db);

  console.log(`\nDone.`);
  await pool.end();
}

/* ─────────────────────────── Domain seeding ─────────────────────────── */

type DB = ReturnType<typeof drizzle>;

async function seedDomain(db: DB) {
  // Resolve user ids by email (users were just seeded above).
  const userRows = await db.select().from(user);
  const idByEmail = new Map<string, string>();
  for (const u of userRows) idByEmail.set(u.email.toLowerCase(), u.id);

  // Map mock account ids (U-04xxx) → email → seeded user id.
  const emailByAccountId = new Map<string, string>();
  for (const a of accounts) emailByAccountId.set(a.id, a.email.toLowerCase());
  const userIdByAccountId = (acctId: string): string | null => {
    const email = emailByAccountId.get(acctId);
    if (!email) return null;
    return idByEmail.get(email) ?? null;
  };

  // Short staff names used across audit / KYC / threads → staff email.
  const staffEmailByShort: Record<string, string> = {
    "Yetunde A.": "yetunde.awoyemi@mcsond.ng",
    "Bashir M.": "bashir.musa@mcsond.ng",
    "Ifeoma N.": "ifeoma.nwosu@mcsond.ng",
    "Kola A.": "kola.adeyemi@mcsond.ng",
    "Super Admin": "admin@mcsond.ng",
  };
  const staffIdByShort = (short: string): string | null => {
    const email = staffEmailByShort[short];
    if (!email) return null;
    return idByEmail.get(email) ?? null;
  };

  // idempotency helpers ----------------------------------------------------
  const existsByRef = async (table: PgTable, refCol: PgColumn, ref: string) => {
    const r = await db.select().from(table).where(eq(refCol, ref)).limit(1);
    return !!r[0];
  };
  const existsById = existsByRef;

  /* ── Wallets ──────────────────────────────────────────────────────────
     Every seeded CUSTOMER gets a wallet, with the balance carried on the
     `accounts` fixture. Adaeze gets the human-readable MSC-WLT id. */
  const balanceByEmail = new Map<string, number>();
  for (const a of accounts) balanceByEmail.set(a.email.toLowerCase(), a.wallet);

  const customers = userRows.filter((u) => (u.role ?? "user") === "user");
  const walletIdByEmail = new Map<string, string>();
  let walletCount = 0;
  for (const c of customers) {
    const email = c.email.toLowerCase();
    const isAdaeze = email === "adaeze.o@procura.ng";
    const reference = isAdaeze
      ? "MSC-WLT-2049-Z"
      : `MSC-WLT-${randomUUID().slice(0, 8).toUpperCase()}`;
    const balance = balanceByEmail.get(email) ?? 0;
    // Earmarked funds are genuinely reserved by applyWalletMovement, so seeding
    // a figure nothing has reserved would lock money for no reason.
    const earmarked = 0;

    const existing = await db
      .select()
      .from(wallet)
      .where(eq(wallet.userId, c.id))
      .limit(1);
    if (existing[0]) {
      walletIdByEmail.set(email, existing[0].id);
      continue;
    }
    const id = randomUUID();
    await db.insert(wallet).values({ id, reference, userId: c.id, balance, earmarked });
    walletIdByEmail.set(email, id);
    walletCount++;

    // A cached balance with nothing in the ledger to explain it would show as
    // a reconciliation variance on /admin/wallets. Book the opening balance so
    // the ledger always sums to the wallet.
    if (balance > 0) {
      await db.insert(ledgerEntry).values({
        id: randomUUID(),
        walletId: id,
        userId: c.id,
        reference: `TXN-OPEN-${reference.slice(-6)}`,
        type: "topup",
        description: "Opening balance",
        amount: balance,
        balanceBefore: 0,
        runningBalance: balance,
        createdAt: c.createdAt ? new Date(c.createdAt) : new Date(),
      });
    }
  }
  console.log(`wallet: inserted ${walletCount}`);

  /* ── Insurance plans ──────────────────────────────────────────────── */
  let planCount = 0;
  for (const p of insurancePlans) {
    if (await existsByRef(insurancePlan, insurancePlan.reference, p.id)) continue;
    await db.insert(insurancePlan).values({
      id: randomUUID(),
      reference: p.id,
      name: p.name,
      underwriter: p.underwriter,
      premium: p.premium,
      term: p.term,
      category: p.category,
      popular: !!p.popular,
      features: p.features,
      provider: p.provider ?? "manual",
      productCode: p.productCode ?? null,
      active: true,
    });
    planCount++;
  }
  console.log(`insurance_plan: inserted ${planCount}`);
  const planRows = await db.select().from(insurancePlan);
  const planIdByRef = new Map<string, string>();
  for (const r of planRows) planIdByRef.set(r.reference, r.id);

  /* ── Policies (order + insurance_policy, from adminOrders) ──────────── */
  const orderIdByRef = new Map<string, string>();
  let orderCount = 0;

  const seedPolicy = async (o: AdminOrder) => {
    const uid = userIdByAccountId(o.customerId);
    if (!uid) {
      console.log(`policy skip (no user): ${o.id} / ${o.customerId}`);
      return;
    }
    if (await existsByRef(order, order.reference, o.id)) {
      const r = await db.select().from(order).where(eq(order.reference, o.id)).limit(1);
      if (r[0]) orderIdByRef.set(o.id, r[0].id);
      return;
    }
    const id = randomUUID();
    const cancelled = o.stage === "cancelled";
    const boundAt = mockDate(o.date);
    await db.insert(order).values({
      id,
      reference: o.id,
      userId: uid,
      kind: "insurance",
      total: o.total,
      stage: cancelled ? "cancelled" : "active",
      createdAt: boundAt,
      paidAt: boundAt,
    });
    orderIdByRef.set(o.id, id);
    orderCount++;

    // Parse "DD Mon YYYY – DD Mon YYYY".
    const [start, end] = (o.period ?? "").split("–").map((s) => s.trim());
    const premium = o.premium ?? o.total;
    await db.insert(insurancePolicy).values({
      orderId: id,
      planId: o.planId ? planIdByRef.get(o.planId) ?? null : null,
      underwriter: o.underwriter ?? null,
      policyNo: o.policyNo ?? null,
      periodStart: start ? fixtureDate(start) : null,
      periodEnd: end ? fixtureDate(end) : null,
      termMonths: o.termMonths ?? 12,
      sumInsured: o.sumInsured ?? null,
      basePremium: premium,
      stampDuty: Math.round(premium * STAMP_DUTY_RATE),
      vat: Math.round(premium * INSURANCE_VAT_RATE),
      insuredParty: o.insuredParty ?? o.customer,
      details: POLICY_DETAILS[o.id] ?? null,
      certificateUrl: cancelled ? null : `/insurance/certificate/${o.id}`,
      boundAt,
    });
  };

  for (const o of adminOrders) await seedPolicy(o);
  console.log(`order + insurance_policy: inserted ${orderCount}`);

  /* ── Ledger entries (primary customer Adaeze) ─────────────────────────
     mock `ledger` is newest-first; insert as-is using its runningBalance. */
  const adaezeEmail = "adaeze.o@procura.ng";
  const adaezeId = idByEmail.get(adaezeEmail);
  const adaezeWalletId = walletIdByEmail.get(adaezeEmail);
  const ledgerType = (t: string): string => {
    switch (t) {
      case "Insurance":
        return "insurance";
      case "Wallet top-up":
        return "topup";
      default:
        return "adjustment";
    }
  };
  let ledgerCount = 0;
  if (adaezeId && adaezeWalletId) {
    // Fixture rows carry their own running balances; they are re-chained below
    // so they sit on top of the opening entry rather than contradicting it.
    for (const e of ledger) {
      if (await existsByRef(ledgerEntry, ledgerEntry.reference, e.ref)) continue;
      const orderRef = LEDGER_ORDER_REF[e.ref];
      await db.insert(ledgerEntry).values({
        id: randomUUID(),
        walletId: adaezeWalletId,
        userId: adaezeId,
        reference: e.ref,
        type: ledgerType(e.type),
        description: e.description,
        amount: e.amount,
        balanceBefore: e.balanceBefore,
        runningBalance: e.runningBalance,
        orderId: orderRef ? orderIdByRef.get(orderRef) ?? null : null,
        createdAt: fixtureDate(e.date) ?? new Date(),
      });
      ledgerCount++;
    }
  }
  console.log(`ledger_entry: inserted ${ledgerCount}`);

  /* ── Re-chain every wallet ────────────────────────────────────────────
     Fixture rows carry hand-written balances. Recompute the chain from the
     movements themselves so balanceBefore → runningBalance is continuous and
     the cached wallet balance matches, which is what /admin/wallets checks. */
  for (const [, walletId] of walletIdByEmail) {
    const rows = await db
      .select()
      .from(ledgerEntry)
      .where(eq(ledgerEntry.walletId, walletId))
      .orderBy(ledgerEntry.createdAt);
    let running = 0;
    for (const r of rows) {
      running += r.amount;
      await db
        .update(ledgerEntry)
        .set({ balanceBefore: running - r.amount, runningBalance: running })
        .where(eq(ledgerEntry.id, r.id));
    }
    await db.update(wallet).set({ balance: running, updatedAt: new Date() }).where(eq(wallet.id, walletId));
  }
  console.log("wallet: re-chained ledgers and reconciled balances");

  /* ── Tickets + messages (supportQueue is the superset) ──────────────── */
  const slaFromUpdated = (sla: number): Date => {
    // Higher sla = more elapsed / more at risk → due sooner. Encode as offset.
    const hours = Math.round((1 - sla) * 72);
    return new Date(Date.now() + hours * 3600_000);
  };
  const ctByRef = new Map<string, (typeof customerTickets)[number]>();
  for (const t of customerTickets) ctByRef.set(t.id, t);
  const yetundeId = idByEmail.get("yetunde.awoyemi@mcsond.ng") ?? null;

  let ticketCount = 0;
  let msgCount = 0;
  for (const q of supportQueue) {
    const acctId = queueUserId[q.id];
    const uid = acctId ? userIdByAccountId(acctId) : null;
    if (!uid) {
      console.log(`ticket skip (no user): ${q.id}`);
      continue;
    }
    let ticketId: string;
    if (await existsByRef(ticket, ticket.reference, q.id)) {
      const r = await db.select().from(ticket).where(eq(ticket.reference, q.id)).limit(1);
      ticketId = r[0].id;
    } else {
      ticketId = randomUUID();
      const ct = ctByRef.get(q.id);
      const status = ct?.status ?? "open";
      const orderRef = queueOrderId[q.id];
      const orderId = orderRef ? orderIdByRef.get(orderRef) ?? null : null;
      await db.insert(ticket).values({
        id: ticketId,
        reference: q.id,
        userId: uid,
        subject: q.subject,
        channel: q.type,
        priority: q.priority === "High" ? "high" : "normal",
        status,
        assignedTo: yetundeId, // queue is all assigned to "Yetunde A."
        orderId,
        slaDueAt: slaFromUpdated(q.sla),
      });
      ticketCount++;
    }

    const existingMsgs = await db
      .select()
      .from(ticketMessage)
      .where(eq(ticketMessage.ticketId, ticketId))
      .limit(1);
    if (existingMsgs[0]) continue;
    const thread = getTicketThread(q.id, q.subject);
    for (const m of thread) {
      const isCustomer = m.role === "customer";
      await db.insert(ticketMessage).values({
        id: randomUUID(),
        ticketId,
        authorId: isCustomer ? uid : yetundeId,
        authorName: m.author,
        authorRole: isCustomer ? "customer" : "staff",
        body: m.body,
      });
      msgCount++;
    }
  }
  console.log(`ticket: inserted ${ticketCount} (ticket_message ${msgCount})`);

  /* ── Audit trail (hash-chained, chronological) ──────────────────────── */
  const chronological = [...auditTrail].reverse();
  let prevHash = "";
  let auditCount = 0;
  let seq = 0;
  for (const a of chronological) {
    seq++;
    const payload = JSON.stringify({
      actorName: a.actor,
      action: a.action,
      targetRef: a.target,
      detail: a.detail,
      seq,
    });
    const hash = createHash("sha256")
      .update(prevHash + payload)
      .digest("hex");
    const thisPrev = prevHash;
    prevHash = hash;

    if (await existsByRef(auditEntry, auditEntry.hash, hash)) continue;
    const actorId = a.actor === "System" ? null : staffIdByShort(a.actor);
    await db.insert(auditEntry).values({
      id: randomUUID(),
      actorId,
      actorName: a.actor,
      action: a.action,
      actionTone: a.actionTone,
      targetType: targetTypeOf(a.target),
      targetRef: a.target,
      detail: a.detail,
      prevHash: thisPrev,
      hash,
      createdAt: timeToday(a.time),
    });
    auditCount++;
  }
  console.log(`audit_entry: inserted ${auditCount}`);

  /* ── KYC profiles (evidence per customer) ───────────────────────────── */
  let kycCount = 0;
  for (const a of accounts) {
    const uid = userIdByAccountId(a.id);
    if (!uid) continue;
    if (await existsById(kycProfile, kycProfile.userId, uid)) continue;
    const k = getKycEvidence(a.id);
    await db.insert(kycProfile).values({
      userId: uid,
      bvnMasked: k.bvnMasked,
      bvnVerified: !!k.bvn,
      utilityBill: !!k.utilityBill,
      idCard: !!k.idCard,
      reviewedBy: staffIdByShort(k.reviewedBy),
      reviewedAt:
        k.reviewedOn && k.reviewedOn !== "pending" && k.reviewedOn !== "—"
          ? safeDate(k.reviewedOn)
          : null,
    });
    kycCount++;
  }
  console.log(`kyc_profile: inserted ${kycCount}`);

  /* ── Settings (from systemProfile.defaults) ─────────────────────────── */
  const settings: { key: string; value: string | number }[] = [
    { key: "currency", value: "NGN" },
    { key: "vatRate", value: 7.5 },
    { key: "stampDutyRate", value: 0.5 },
  ];
  let settingCount = 0;
  for (const s of settings) {
    if (await existsById(setting, setting.key, s.key)) continue;
    await db.insert(setting).values({ key: s.key, value: s.value });
    settingCount++;
  }
  console.log(`setting: inserted ${settingCount}`);

  /* ── Integrations (from systemProfile.integrations) ─────────────────── */
  let integrationCount = 0;
  for (const i of systemProfile.integrations) {
    const r = await db.select().from(integration).where(eq(integration.name, i.name)).limit(1);
    if (r[0]) continue;
    await db.insert(integration).values({
      id: randomUUID(),
      name: i.name,
      note: i.note,
      status: i.status,
    });
    integrationCount++;
  }
  console.log(`integration: inserted ${integrationCount}`);
}

/* ─────────────────────────── date helpers ─────────────────────────── */

// "May 02" / "Apr 28" (no year in adminOrders) → 2026 dates, pinned to noon so
// the calendar day survives timezone round-trips.
function mockDate(label: string): Date {
  const d = new Date(`${label} 2026 12:00:00`);
  return isNaN(d.getTime()) ? new Date("2026-05-01T12:00:00") : d;
}

// "04 May 2026" → local noon on that day (see mockDate).
function fixtureDate(label: string): Date | null {
  const d = new Date(`${label} 12:00:00`);
  return isNaN(d.getTime()) ? null : d;
}

// "14:22:08" → a Date on the demo day at that wall-clock time (audit ordering).
function timeToday(time: string): Date {
  const [h, m, s] = time.split(":").map((n) => parseInt(n, 10));
  const d = new Date("2026-05-06T00:00:00");
  d.setHours(h || 0, m || 0, s || 0, 0);
  return d;
}

function safeDate(s: string): Date | null {
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

// Classify an audit target into a coarse targetType for filtering.
function targetTypeOf(target: string): string {
  if (target.startsWith("TXN-")) return "transaction";
  if (target.startsWith("U-")) return "user";
  if (target.startsWith("TKT-")) return "ticket";
  if (target.startsWith("INS-")) return "order";
  return "system";
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
