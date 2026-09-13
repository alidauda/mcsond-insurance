// Applies the generated SQL migrations in ./drizzle to DATABASE_URL.
//
// Runs with a bare `node scripts/migrate.mjs` (no drizzle-kit / tsx needed), so
// it works inside the stripped standalone Docker image. The Dockerfile runs it
// once on container start, before `node server.js`. Drizzle tracks applied
// migrations in a metadata table, so re-running is a no-op.
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Pool } from "pg";

const MAX_ATTEMPTS = 10;

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is not set.");
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1 });

// A freshly provisioned Coolify database may still be booting when the app
// container starts, so wait for it rather than crash-looping.
for (let attempt = 1; ; attempt++) {
  try {
    await pool.query("select 1");
    break;
  } catch (err) {
    if (attempt >= MAX_ATTEMPTS) throw err;
    console.log(`Database not reachable (attempt ${attempt}/${MAX_ATTEMPTS}), retrying in 3s…`);
    await new Promise((r) => setTimeout(r, 3000));
  }
}

try {
  const db = drizzle(pool);
  await migrate(db, { migrationsFolder: "./drizzle" });
  console.log("Migrations applied.");
} finally {
  await pool.end();
}
