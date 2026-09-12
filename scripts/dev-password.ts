/**
 * Dev utility: set (or reset) a password on an EXISTING user — handy for
 * accounts originally created via Google OAuth that need email+password login.
 *
 * Usage: npx tsx --env-file=.env scripts/dev-password.ts <email> <password>
 *
 * Upserts the better-auth `credential` account row with a properly hashed
 * password. Dev-only — real users should use the "Forgot password?" flow.
 */
import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import { hashPassword } from "better-auth/crypto";

async function main() {
  const [email, password] = process.argv.slice(2);
  if (!email || !password) {
    console.error("Usage: npx tsx --env-file=.env scripts/dev-password.ts <email> <password>");
    process.exit(1);
  }
  if (password.length < 8) {
    console.error("Password must be at least 8 characters (better-auth minimum).");
    process.exit(1);
  }

  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const users = await pool.query(`select id from "user" where email = $1`, [email.toLowerCase()]);
  const userId: string | undefined = users.rows[0]?.id;
  if (!userId) {
    console.error(`No user with email ${email} — sign them up first (or seed).`);
    process.exit(1);
  }

  const hash = await hashPassword(password);
  const existing = await pool.query(
    `select id from account where "userId" = $1 and "providerId" = 'credential'`,
    [userId],
  );
  if (existing.rows[0]) {
    await pool.query(`update account set password = $1, "updatedAt" = now() where id = $2`, [
      hash,
      existing.rows[0].id,
    ]);
    console.log(`Updated password for ${email}.`);
  } else {
    await pool.query(
      `insert into account (id, "accountId", "providerId", "userId", password, "createdAt", "updatedAt")
       values ($1, $2, 'credential', $2, $3, now(), now())`,
      [randomUUID(), userId, hash],
    );
    console.log(`Created credential login for ${email}.`);
  }
  await pool.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
