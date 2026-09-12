import "server-only";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { schema as authSchema } from "./auth-schema";
import { schema as appSchema } from "./schema";

const schema = { ...authSchema, ...appSchema };

// Don't throw at import — that would break `next build` before DATABASE_URL is
// provided. The pool connects lazily on first query; a missing URL surfaces as
// a connection error at request time, which is the right moment to see it.
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

export const db = drizzle(pool, { schema });
