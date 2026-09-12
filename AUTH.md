# Authentication & admin user management

McSond Insurance uses [Better Auth](https://www.better-auth.com) with the **admin
plugin**, **Google OAuth**, and **PostgreSQL + Drizzle**. Two populations share
one app:

- **Customers** (`role: "user"`) — Google sign-in, land on `/dashboard`.
- **Internal staff** (`superadmin`, `operations`, `finance`, `support`,
  `kyc_reviewer`) — land on `/admin`.

## Architecture

| Layer | File | Responsibility |
|-------|------|----------------|
| Access-control model | `lib/permissions.ts` | Single source of truth: statements + role definitions (shared by server & client). |
| Auth server | `lib/auth.ts` | Google provider, Drizzle adapter, `admin` plugin, role-assignment hook, `nextCookies()` **last**. |
| Auth client | `lib/auth-client.ts` | `authClient` + `adminClient`. |
| DB schema | `lib/auth-schema.ts` | Drizzle tables (core + admin columns + `company`/`kyc`). |
| Server DAL | `lib/server-session.ts` | `getSession` (cached), `requireCustomer`, `requireStaff`, `requirePermission`. **The real security boundary.** |
| Route handler | `app/api/auth/[...all]/route.ts` | Mounts Better Auth. |
| Optimistic redirects | `proxy.ts` | Cookie-presence only — **not** a security boundary; never hits the DB. |

Gating happens server-side. Layouts call `requireCustomer` / `requireStaff`
for redirect UX, but because layouts don't re-run on client navigation, **every
mutating server action re-checks** via `requirePermission` (see
`app/admin/users/actions.ts`).

## Role assignment

At account creation (`databaseHooks.user.create.before` in `lib/auth.ts`):

1. email in `SUPERADMIN_EMAILS` → `superadmin`
2. else email domain === `STAFF_DOMAIN` → `STAFF_EMAIL_ROLE_MAP[email] ?? "support"`
   (map derived from `lib/mock-data.ts` `staff`)
3. else → `user`

Later changes go through `setRole` (Set role on `/admin/staff` / user detail).

## Setup

1. **Env** — copy and fill:
   ```bash
   cp .env.example .env
   ```
   - `DATABASE_URL` — Postgres (Neon/Supabase/local Docker).
   - `BETTER_AUTH_SECRET` — `openssl rand -base64 32`.
   - `BETTER_AUTH_URL` — `http://localhost:3001` in dev.
   - `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` — from Google Cloud Console.
   - `STAFF_DOMAIN`, `SUPERADMIN_EMAILS`.

2. **Google OAuth** — register redirect URI
   `http://localhost:3001/api/auth/callback/google` (add the prod URI later).

3. **Schema** — push tables:
   ```bash
   npm run db:push      # or: npm run db:generate && apply the migration
   ```

4. **Seed** (optional demo fixtures):
   ```bash
   npm run db:seed
   ```
   Seeds 1 superadmin + 4 staff (incl. a KYC reviewer) + 7 customers, plus
   6 insurance plans, 7 bound policies, tickets, ledger and KYC evidence. Because auth is Google-only,
   seeded rows are *managed* users (visible/manageable in the console) but can
   only sign in if a real Google account matches their email.

5. **Run**:
   ```bash
   npm run dev
   ```

## Verifying

- gmail account → `/dashboard`, blocked from `/admin`.
- `@mcsond.ng` / superadmin account → `/admin`, blocked from `/dashboard`.
- `/admin/users`: filter tabs work; open a user; **Suspend** flips the badge and
  sets `banned=true`; **Approve KYC** updates the badge; **Revoke all sessions**
  clears the session log; **View as user** impersonates.
- A `support` staffer hitting a role-restricted action (e.g. Set role / Approve
  KYC) gets a thrown `FORBIDDEN` from `requirePermission`.

## Regenerating the schema

If plugins or custom fields change:
```bash
npm run auth:generate   # regenerate lib/auth-schema.ts (Better Auth CLI)
npm run db:push
```
