/**
 * Applies pending SQL migrations from ./drizzle using drizzle-orm's runtime
 * migrator (no drizzle-kit needed). Runs on container start before the server;
 * applied migrations are tracked in drizzle.__drizzle_migrations, so re-runs
 * are no-ops.
 *
 * Local: `npm run db:migrate:run`
 * Docker: bundled to migrate.cjs by the Dockerfile and run by docker-entrypoint.sh.
 */
import path from "node:path";
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";

const MAX_ATTEMPTS = 10;

async function waitForDb(pool: Pool) {
  for (let attempt = 1; ; attempt++) {
    try {
      await pool.query("select 1");
      return;
    } catch (err) {
      if (attempt >= MAX_ATTEMPTS) throw err;
      console.log(`[migrate] database not reachable (attempt ${attempt}/${MAX_ATTEMPTS}), retrying in 3s…`);
      await new Promise((r) => setTimeout(r, 3000));
    }
  }
}

async function main() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is not set.");
  const migrationsFolder = process.env.MIGRATIONS_DIR ?? path.join(process.cwd(), "drizzle");

  const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1 });
  try {
    await waitForDb(pool);
    console.log(`[migrate] applying migrations from ${migrationsFolder}`);
    await migrate(drizzle(pool), { migrationsFolder });
    console.log("[migrate] done");
  } finally {
    await pool.end();
  }
}

main().catch((e) => {
  console.error("[migrate] failed:", e);
  process.exit(1);
});
