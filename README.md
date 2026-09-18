# McSond Insurance

Standalone insurance brokerage portal: customers compare quotes from licensed
underwriters, bind a policy from their wallet and get an auto-issued
certificate; staff manage the policy book, plan catalogue, KYC, wallets and
support from the admin console.

This app is independent of the McSond cement portal — separate repository,
separate database, no shared code.

## Stack

- Next.js 16 (App Router, Server Actions) · React 19 · Tailwind v4
- Better Auth (Google OAuth only, admin plugin, RBAC)
- PostgreSQL + Drizzle ORM
- Paystack (wallet top-ups) · Zoho Mail SMTP via nodemailer (email)

## Getting started

```bash
cp .env.example .env        # fill in DATABASE_URL, BETTER_AUTH_SECRET, Google, Paystack
npm install
npm run db:migrate          # apply drizzle/ migrations to the new database
npm run db:seed             # optional demo data (plans, policies, users, tickets)
npm run dev                 # http://localhost:3001
```

The dev server runs on port **3001** so it can sit next to the cement portal
on 3000. Register `http://localhost:3001/api/auth/callback/google` as a Google
OAuth redirect URI.

## Routes

| Customer (`/`) | Staff (`/admin`) |
|---|---|
| `/dashboard` — wallet, active policies, total cover | `/admin` — KPIs (float, users, GWP, policies), GWP by underwriter |
| `/insurance` — compare underwriter plans | `/admin/orders` — policy book, cancel & refund |
| `/insurance/certificate/[id]` — auto-issued certificate | `/admin/insurance` — plan catalogue (premium, class, features) |
| `/orders`, `/orders/[id]` — policies & receipts | `/admin/users` — customers, KYC review |
| `/wallet` — Paystack top-up, ledger | `/admin/wallets`, `/admin/support`, `/admin/staff`, `/admin/audit`, `/admin/reports`, `/admin/settings` |
| `/kyc` — identity verification | |
| `/support` — tickets | |

## Underwriters (all cover is issued by one)

**McSond is a broker and never underwrites or prices cover itself.** Every plan
must map to a live underwriter product (`insurance_plan.provider` +
`productCode`); a row without one is skipped by `lib/catalog.ts`, so it can
never be quoted or sold even if someone inserts it straight into the database.
Adding an insurer means adding its API client and a `PlanProvider` value — there
is deliberately no "we price it ourselves" path.

Today the only integration is NEM. Plans are priced and issued through NEM's
eInsurance retail-broker API (`lib/nem.ts`; spec in `apiendpointfortesting (1)/`):

| Product | Endpoint | Premium source |
|---|---|---|
| `mtp` Third-Party Motor | `POST /buyMtp` | flat rate per vehicle type & usage (`GET /vehicleTypes`) |
| `emtp` Enhanced Third-Party | `POST /buyEmtp` | per variant Type A/B… (`GET /EnhancedPremium/{type}`) |
| `comp` Comprehensive | `POST /buyComp` | % of vehicle value (`GET /ComprehensivePremium/{value}/{type}/{buyback}`) |

Customer flow: `/insurance` → "Get NEM quote" → `/insurance/motor?plan=…`
(vehicle makes/models/types and branch locations come from NEM) → **Bind &
pay**. Binding is a two-phase saga in `bindMotorPolicy`: the wallet is debited
and the order created as `pending`, NEM is called, then the policy takes NEM's
policy number, NAICOM ID and PDF links and goes `active` — or the wallet is
refunded and the order marked `failed`. Every attempt is logged in
`underwriter_transaction` with credentials stripped.

Credentials: **Admin → Settings → NEM Insurance API** (stored in the DB) with
`NEM_BASE_URL` / `NEM_USERNAME` / `NEM_PASSWORD` / `NEM_API_KEY` as env
fallbacks. The sandbox host is `https://sandbox.einsurance.nem-insurance.com`;
"Test connection" checks reachability.

## Identity verification (KYC)

Nigerian insurance rules require a verified policyholder, so **cover cannot be
bound until the customer's identity clears**. Verification runs against
SwiftLink's SwiftCheck gateway (`lib/swiftcheck.ts`, domain logic in
`lib/kyc.ts`):

| Method | Endpoint | Customer supplies |
|---|---|---|
| NIN | `POST /nin-auth/raw-nin/verify` | 11-digit NIN |
| Phone | `POST /nin-auth/phone-number/verify` | the SIM their NIN is registered to |
| Share code | `POST /nin-auth/share-code/verify` | code from the NIMC app |
| Demography | `POST /nin-auth/demography/search` | name, date of birth, gender |

The customer verifies at `/kyc`. The name on the national record is compared
with the name on the account: **≥85%** clears automatically, **≥55%** goes to a
KYC reviewer at `/admin/users/[id]`, anything lower is refused. Staff can also
run a check on a customer's behalf from the same panel.

**Reviewer view.** `/admin/users/[id]` always shows the national record beside
the account details, the match score, the check history and an open form for
running a check on the customer's behalf — even when the last check failed,
since the comparison is rebuilt from the redacted attempt log.

**Privacy.** Raw NINs are never persisted: only a masked NIN (`*******8901`)
plus SwiftCheck's `requestId` / `consentId`. Every attempt is logged, redacted,
to `kyc_verification` — no NIN, no image bytes.

The NIMC face photograph **is** stored (`kyc_profile.photoData`) so reviewers
can eyeball it. That is biometric personal data under the NDPA, so it is:
kept only for checks that matched, readable only through `getKycPhoto`, which
requires the `user:kyc` permission, never included in `getKycEvidence` (so it
cannot reach the customer-facing pages), and deleted when a reviewer rejects
the record. Anyone extending this should keep those four properties, and the
business should hold a documented retention period for it.

**Entitlement.** Methods a business isn't licensed for answer `403 Insufficient
permissions`; the client learns this at runtime and stops offering that method.
Raw-NIN is off by default on test accounts.

Credentials live in **Admin → Settings → SwiftCheck identity API**, with
`SWIFTCHECK_BASE_URL` / `SWIFTCHECK_CLIENT_ID` / `SWIFTCHECK_CLIENT_SECRET` as
env fallbacks.

## Domain model

`insurance_plan` (catalogue) → `order` (wallet-facing total, stage
`active`/`cancelled`) ⟷ `insurance_policy` (underwriter, policy no., period,
sum insured, premium, stamp duty, VAT, certificate). Every kobo moves through
`ledger_entry` via `lib/wallet-mutations.ts`; binding lives in
`lib/policy-mutations.ts`; pure quote maths in `lib/quote.ts`.

Renewal state is derived at read time: a policy ending within 14 days shows as
**renew**, one past its period end as **expired**.

## Scripts

| Script | What it does |
|---|---|
| `npm run dev` | Dev server on :3001 |
| `npm run build` / `npm start` | Production build / serve on :3001 |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint |
| `npm run db:generate` | Generate a migration from `lib/schema.ts` + `lib/auth-schema.ts` |
| `npm run db:migrate` | Apply migrations |
| `npm run db:push` | Push schema directly (dev only) |
| `npm run db:seed` | Seed demo fixtures (idempotent) |
| `npm run auth:generate` | Regenerate `lib/auth-schema.ts` from Better Auth config |

See [AUTH.md](AUTH.md) for roles, permissions and the sign-in flow.
# mcsond-insurance
