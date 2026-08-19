/* Apply pending migrations. An explicit deploy step, never a side effect of boot —
 * several instances starting at once would otherwise migrate concurrently.
 *
 *   npm run db:migrate
 *
 * Drizzle takes a Postgres advisory lock for the run, so this is safe to invoke twice
 * by accident; the second call waits and then finds nothing to do. */

import { config as loadDotenv } from "dotenv";
import pg from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";

loadDotenv({ path: ".env.local", quiet: true });
loadDotenv({ path: ".env", quiet: true });

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is not set. See .env.example.");
  process.exit(1);
}

const bool = (v) => /^(true|1)$/i.test(v ?? "");

/* Mirrors lib/pg-url.ts. node-postgres lets `sslmode` in the URL override — and silently
   ignore — the ssl object below, so it is stripped and TLS decided from the environment.
   Kept inline because this script is plain .mjs and cannot import the TypeScript module. */
let connectionString = url;
let urlWantedSsl = false;
try {
  const parsed = new URL(url);
  const sslmode = parsed.searchParams.get("sslmode");
  urlWantedSsl = sslmode !== null && sslmode !== "disable";
  for (const p of ["sslmode", "uselibpqcompat", "ssl"]) parsed.searchParams.delete(p);
  connectionString = parsed.toString();
} catch {
  /* Not a URL — leave it alone. */
}

const useSsl = bool(process.env.DATABASE_SSL) || urlWantedSsl;

const pool = new pg.Pool({
  connectionString,
  max: 1,
  ssl: useSsl ? (bool(process.env.DATABASE_SSL_INSECURE) ? { rejectUnauthorized: false } : true) : undefined,
});

try {
  const db = drizzle(pool);
  console.log("Applying migrations from db/migrations …");
  await migrate(db, { migrationsFolder: "./db/migrations" });
  console.log("Migrations up to date.");
} catch (err) {
  console.error("Migration failed:", err);
  process.exitCode = 1;
} finally {
  await pool.end();
}
